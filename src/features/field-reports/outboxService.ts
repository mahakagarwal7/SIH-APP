import { normalizeConfirmation } from './confirmation';
import { OutboxSyncError, sameFrozenCapture, validateManifest } from './outbox';

import type {
  OutboxFileReader,
  OutboxIndex,
  OutboxRecord,
  OutboxState,
  OutboxTransport,
  ConfirmedPayload,
} from './outbox';

export type NewOutboxRecord = Pick<
  OutboxRecord,
  | 'captureId'
  | 'userId'
  | 'projectId'
  | 'projectName'
  | 'kind'
  | 'createdAt'
  | 'text'
  | 'manifest'
>;

function asSyncError(error: unknown, fallbackKind: 'local' | 'server') {
  if (error instanceof OutboxSyncError) return error;
  return new OutboxSyncError(
    error instanceof Error ? error.message : 'Outbox synchronization failed.',
    fallbackKind,
    fallbackKind === 'server',
  );
}

export class OutboxService {
  constructor(
    private readonly index: OutboxIndex,
    private readonly files: OutboxFileReader,
    private readonly transport: OutboxTransport,
    private readonly sha256: (bytes: Uint8Array) => Promise<string>,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly releaseEvidence: (
      record: OutboxRecord,
    ) => Promise<void> = async () => {},
  ) {}

  list(userId: string) {
    return this.index.list(userId);
  }

  async enqueue(input: NewOutboxRecord): Promise<OutboxRecord> {
    if (input.manifest.captureId !== input.captureId)
      throw new OutboxSyncError(
        'The local manifest does not match its capture.',
        'local',
        false,
      );
    validateManifest(input.manifest);
    const candidate: OutboxRecord = {
      ...input,
      reportId: null,
      uploadedFiles: [],
      originalTranscript: null,
      confirmedPayload: null,
      submissionState: 'unconfirmed',
      submittedAt: null,
      evidenceReleased: false,
      state: 'queued',
      attemptCount: 0,
      lastErrorKind: null,
      lastError: null,
      updatedAt: this.now(),
    };
    const existing = await this.index.get(input.userId, input.captureId);
    if (existing) {
      if (!sameFrozenCapture(existing, candidate))
        throw new OutboxSyncError(
          'This capture identifier already belongs to different content.',
          'local',
          false,
        );
      return existing;
    }
    await this.index.put(candidate);
    return candidate;
  }

  private async save(
    record: OutboxRecord,
    patch: Partial<OutboxRecord>,
  ): Promise<OutboxRecord> {
    const next = { ...record, ...patch, updatedAt: this.now() };
    await this.index.put(next);
    return next;
  }

  private async phase(record: OutboxRecord, state: OutboxState) {
    return this.save(record, {
      state,
      lastError: null,
      lastErrorKind: null,
    });
  }

  async confirm(
    userId: string,
    captureId: string,
    input: ConfirmedPayload,
  ): Promise<OutboxRecord> {
    const record = await this.index.get(userId, captureId);
    if (!record)
      throw new OutboxSyncError(
        'This report is unavailable for this account.',
        'local',
        false,
      );
    const payload = normalizeConfirmation(input);
    if (record.confirmedPayload) {
      if (JSON.stringify(record.confirmedPayload) !== JSON.stringify(payload))
        throw new OutboxSyncError(
          'The confirmed wording is locked while its receipt is pending.',
          'local',
          false,
        );
      return record;
    }
    if (record.state !== 'needs_confirmation' || !record.reportId)
      throw new OutboxSyncError(
        'This report is not ready for confirmation.',
        'local',
        false,
      );
    if (record.kind === 'voice' && !record.originalTranscript?.trim())
      throw new OutboxSyncError(
        'The verified voice transcript is not available yet.',
        'server',
        true,
      );
    return this.save(record, {
      confirmedPayload: payload,
      submissionState: 'pending',
      lastError: null,
      lastErrorKind: null,
    });
  }

  private async release(record: OutboxRecord): Promise<OutboxRecord> {
    if (record.evidenceReleased) return record;
    try {
      await this.releaseEvidence(record);
      return this.save(record, { evidenceReleased: true });
    } catch {
      return record;
    }
  }

  private async submit(record: OutboxRecord): Promise<OutboxRecord> {
    const payload = record.confirmedPayload;
    if (!payload || !record.reportId)
      throw new OutboxSyncError(
        'Confirmed submission details are incomplete.',
        'local',
        false,
      );
    const returned = await this.transport.submit(record.reportId, payload);
    if (returned !== record.reportId)
      throw new OutboxSyncError(
        'The server returned an invalid submission receipt.',
        'server',
        true,
      );
    const submitted = await this.save(record, {
      submissionState: 'submitted',
      submittedAt: this.now(),
      lastError: null,
      lastErrorKind: null,
    });
    return this.release(submitted);
  }

  async sync(
    userId: string,
    captureId: string,
    options: { includePaused?: boolean } = {},
  ): Promise<OutboxRecord> {
    let record = await this.index.get(userId, captureId);
    if (!record)
      throw new OutboxSyncError(
        'This outbox item is unavailable for this account.',
        'local',
        false,
      );
    if (record.submissionState === 'submitted') return this.release(record);
    if (record.state === 'paused' && !options.includePaused) return record;
    if (
      record.state === 'failed' &&
      record.lastErrorKind === 'local' &&
      !options.includePaused
    )
      return record;
    record = await this.save(record, {
      attemptCount: record.attemptCount + 1,
      lastError: null,
      lastErrorKind: null,
    });
    try {
      await this.transport.ensureAccess(record);
      if (record.submissionState === 'pending')
        return await this.submit(record);
      if (record.state === 'needs_confirmation') {
        if (record.kind !== 'voice' || record.originalTranscript) return record;
        const result = await this.transport.inspect(record.reportId!);
        if (result.status === 'ready')
          return this.save(record, {
            originalTranscript: result.originalTranscript,
            lastError: null,
            lastErrorKind: null,
          });
        if (result.status === 'failed')
          throw new OutboxSyncError(result.message, 'server', false);
        if (result.status === 'retryable')
          throw new OutboxSyncError(result.message, 'server', true);
        return record;
      }
      if (record.reportId && record.state === 'processing') {
        const reportId = record.reportId;
        const result = await this.transport.inspect(reportId);
        if (result.status === 'ready')
          return this.save(record, {
            state: 'needs_confirmation',
            originalTranscript: result.originalTranscript,
            lastError: null,
            lastErrorKind: null,
          });
        if (result.status === 'processing') return record;
        if (result.status === 'failed')
          throw new OutboxSyncError(result.message, 'server', false);
        record = await this.phase(record, 'finalizing');
        await this.transport.finalize(reportId);
        return this.phase(record, 'processing');
      }
      if (!record.reportId) {
        record = await this.phase(record, 'reserving');
        const reportId = await this.transport.reserve(record);
        record = await this.save(record, {
          reportId,
          state: 'uploading',
          lastError: null,
          lastErrorKind: null,
        });
      } else {
        record = await this.phase(record, 'uploading');
      }
      for (const file of record.manifest.files) {
        if (record.uploadedFiles.includes(file.id)) continue;
        let bytes: Uint8Array;
        try {
          bytes = await this.files.read(record, file);
        } catch (error) {
          throw asSyncError(error, 'local');
        }
        if (
          bytes.length !== file.bytes ||
          (await this.sha256(bytes)) !== file.sha256
        )
          throw new OutboxSyncError(
            'Local evidence changed after its upload manifest was saved.',
            'local',
            false,
          );
        await this.transport.upload(
          `${record.projectId}/${record.reportId}/${file.id}`,
          file,
          bytes,
        );
        record = await this.save(record, {
          uploadedFiles: [...record.uploadedFiles, file.id],
        });
      }
      record = await this.phase(record, 'finalizing');
      await this.transport.finalize(record.reportId!);
      record = await this.phase(record, 'processing');
      const result = await this.transport.inspect(record.reportId!);
      if (result.status === 'ready')
        return this.save(record, {
          state: 'needs_confirmation',
          originalTranscript: result.originalTranscript,
          lastError: null,
          lastErrorKind: null,
        });
      if (result.status === 'failed')
        throw new OutboxSyncError(result.message, 'server', false);
      if (result.status === 'retryable')
        throw new OutboxSyncError(result.message, 'server', true);
      return record;
    } catch (error) {
      const failure = asSyncError(error, 'server');
      return this.save(record, {
        state:
          failure.kind === 'auth' || failure.kind === 'access'
            ? 'paused'
            : 'failed',
        lastErrorKind: failure.kind,
        lastError: failure.message,
      });
    }
  }

  async syncAll(
    userId: string,
    options: { includePaused?: boolean } = {},
  ): Promise<OutboxRecord[]> {
    const rows = await this.index.list(userId);
    const results: OutboxRecord[] = [];
    for (const row of rows) {
      if (
        row.state === 'needs_confirmation' &&
        row.submissionState === 'unconfirmed' &&
        (row.kind !== 'voice' || !!row.originalTranscript)
      ) {
        results.push(row);
        continue;
      }
      results.push(await this.sync(userId, row.captureId, options));
    }
    return results;
  }
}
