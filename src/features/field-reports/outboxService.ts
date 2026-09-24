import { OutboxSyncError, sameFrozenCapture, validateManifest } from './outbox';
import { notifyOutboxWork } from './outboxEvents';

import type {
  OutboxFileReader,
  OutboxIndex,
  OutboxRecord,
  OutboxState,
  OutboxTransport,
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
    private readonly transportForAccount: (userId: string) => OutboxTransport,
    private readonly sha256: (bytes: Uint8Array) => Promise<string>,
    private readonly now: () => string = () => new Date().toISOString(),
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
      state: 'queued',
      attemptCount: 0,
      lastErrorKind: null,
      lastError: null,
      retryable: true,
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
    notifyOutboxWork(input.userId);
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
      retryable: true,
    });
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
    if (record.state === 'needs_confirmation') return record;
    if (record.state === 'paused' && !options.includePaused) return record;
    if (
      record.state === 'failed' &&
      !record.retryable &&
      !(options.includePaused && record.lastErrorKind === 'local')
    )
      return record;
    record = await this.save(record, {
      attemptCount: record.attemptCount + 1,
      lastError: null,
      lastErrorKind: null,
    });
    try {
      const transport = this.transportForAccount(userId);
      await transport.ensureAccess(record);
      if (record.reportId && record.state === 'processing') {
        const reportId = record.reportId;
        const result = await transport.inspect(reportId);
        if (result.status === 'ready')
          return this.phase(record, 'needs_confirmation');
        if (result.status === 'processing') return record;
        if (result.status === 'failed')
          throw new OutboxSyncError(result.message, 'server', false);
        record = await this.phase(record, 'finalizing');
        await transport.finalize(reportId);
        return this.phase(record, 'processing');
      }
      if (!record.reportId) {
        record = await this.phase(record, 'reserving');
        const reportId = await transport.reserve(record);
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
        await transport.upload(
          `${record.projectId}/${record.reportId}/${file.id}`,
          file,
          bytes,
        );
        record = await this.save(record, {
          uploadedFiles: [...record.uploadedFiles, file.id],
        });
      }
      record = await this.phase(record, 'finalizing');
      await transport.finalize(record.reportId!);
      record = await this.phase(record, 'processing');
      const result = await transport.inspect(record.reportId!);
      if (result.status === 'ready')
        return this.phase(record, 'needs_confirmation');
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
        retryable: failure.retryable,
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
      if (row.state === 'needs_confirmation') {
        results.push(row);
        continue;
      }
      results.push(await this.sync(userId, row.captureId, options));
    }
    return results;
  }
}
