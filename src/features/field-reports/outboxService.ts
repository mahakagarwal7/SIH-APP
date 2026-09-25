import { normalizeConfirmation } from './confirmation';
import {
  OutboxSyncError,
  SubmissionRejectedError,
  sameFrozenCapture,
  validateManifest,
} from './outbox';
import { notifyOutboxChanged, notifyOutboxWork } from './outboxEvents';
import {
  getReportEvidenceState,
  initialConfirmationText,
} from './reportEvidence';

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
  private readonly mutations = new Map<string, Promise<unknown>>();

  private mutate<T>(
    userId: string,
    captureId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const key = JSON.stringify([userId, captureId]);
    const previous = this.mutations.get(key) ?? Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(action)
      .finally(() => {
        if (this.mutations.get(key) === operation) this.mutations.delete(key);
      });
    this.mutations.set(key, operation);
    return operation;
  }

  constructor(
    private readonly index: OutboxIndex,
    private readonly files: OutboxFileReader,
    private readonly transportForAccount: (userId: string) => OutboxTransport,
    private readonly sha256: (bytes: Uint8Array) => Promise<string>,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly releaseEvidence: (
      record: OutboxRecord,
    ) => Promise<void> = async () => {},
    private readonly cancelEvidence: (
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
      sendRequested: false,
      requestedWorkDate: null,
      cancelRequested: false,
      confirmedPayload: null,
      confirmedActivityLabel: null,
      submissionRejected: false,
      submissionState: 'unconfirmed',
      submittedAt: null,
      evidenceReleased: false,
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
    notifyOutboxChanged(input.userId, input.captureId);
    notifyOutboxWork(input.userId);
    return candidate;
  }

  private async save(
    record: OutboxRecord,
    patch: Partial<OutboxRecord>,
  ): Promise<OutboxRecord> {
    const next = { ...record, ...patch, updatedAt: this.now() };
    await this.index.put(next);
    notifyOutboxChanged(record.userId, record.captureId);
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

  async confirm(
    userId: string,
    captureId: string,
    input: ConfirmedPayload,
    activityLabel: string | null = null,
  ): Promise<OutboxRecord> {
    const result = await this.mutate(userId, captureId, () =>
      this.confirmRecord(userId, captureId, input, activityLabel),
    );
    notifyOutboxWork(userId);
    return result;
  }

  async requestSend(
    userId: string,
    captureId: string,
    input?: ConfirmedPayload,
  ): Promise<OutboxRecord> {
    const result = await this.mutate(userId, captureId, async () => {
      const record = await this.index.get(userId, captureId);
      if (!record)
        throw new OutboxSyncError(
          'This report is unavailable for this account.',
          'local',
          false,
        );
      if (record.cancelRequested)
        throw new OutboxSyncError(
          'This report is already being canceled.',
          'local',
          false,
        );
      const evidence = getReportEvidenceState(record);
      if (!evidence.hasVoice)
        throw new OutboxSyncError(
          'Immediate Send is available for voice reports.',
          'local',
          false,
        );
      const requestedWorkDate = input
        ? normalizeConfirmation({
            ...input,
            text: input.text.trim() || 'Pending verified transcript',
            activityId: null,
          }).workDate
        : null;
      if (evidence.voiceTranscriptReady)
        return this.confirmRecord(
          userId,
          captureId,
          input ?? {
            text: initialConfirmationText(record),
            workDate: null,
            activityId: null,
          },
          null,
        );
      return this.save(record, {
        sendRequested: true,
        requestedWorkDate,
        lastError: null,
        lastErrorKind: null,
        retryable: true,
      });
    });
    notifyOutboxWork(userId);
    return result;
  }

  async cancel(userId: string, captureId: string): Promise<OutboxRecord> {
    const result = await this.mutate(userId, captureId, async () => {
      let record = await this.index.get(userId, captureId);
      if (!record)
        throw new OutboxSyncError(
          'This report is unavailable for this account.',
          'local',
          false,
        );
      if (record.submissionState === 'submitted')
        throw new OutboxSyncError(
          'A submitted report cannot be canceled from this review.',
          'server',
          false,
        );
      record = await this.save(record, {
        cancelRequested: true,
        sendRequested: false,
        lastError: null,
        lastErrorKind: null,
        retryable: true,
      });
      try {
        return await this.finishCancellation(
          record,
          this.transportForAccount(userId),
        );
      } catch (error) {
        const failure = asSyncError(error, 'server');
        return this.save(record, {
          state:
            failure.kind === 'auth' || failure.kind === 'access'
              ? 'paused'
              : 'failed',
          lastErrorKind: failure.kind,
          lastError:
            'Cancellation is queued. Local evidence stays private until server cleanup succeeds.',
          retryable: failure.retryable,
        });
      }
    });
    notifyOutboxWork(userId);
    return result;
  }

  private async confirmRecord(
    userId: string,
    captureId: string,
    input: ConfirmedPayload,
    activityLabel: string | null,
  ): Promise<OutboxRecord> {
    const record = await this.index.get(userId, captureId);
    if (!record)
      throw new OutboxSyncError(
        'This report is unavailable for this account.',
        'local',
        false,
      );
    const payload = normalizeConfirmation(input);
    if (record.confirmedPayload && !record.submissionRejected) {
      if (JSON.stringify(record.confirmedPayload) !== JSON.stringify(payload))
        throw new OutboxSyncError(
          'The confirmed wording is locked while its receipt is pending.',
          'local',
          false,
        );
      return record;
    }
    const evidence = getReportEvidenceState(record);
    if (!evidence.hasAny)
      throw new OutboxSyncError(
        'Add a voice recording, report text or a photo before sending.',
        'local',
        false,
      );
    const localText = evidence.hasText && record.manifest.files.length === 0;
    if (
      !record.submissionRejected &&
      !localText &&
      (record.state !== 'needs_confirmation' || !record.reportId)
    )
      throw new OutboxSyncError(
        'This report is not ready for confirmation.',
        'local',
        false,
      );
    if (!evidence.voiceTranscriptReady)
      throw new OutboxSyncError(
        'The verified voice transcript is not available yet.',
        'server',
        true,
      );
    return this.save(record, {
      confirmedPayload: payload,
      confirmedActivityLabel: payload.activityId
        ? activityLabel?.trim().slice(0, 500) || null
        : null,
      submissionRejected: false,
      submissionState: 'pending',
      state: record.reportId ? 'needs_confirmation' : 'queued',
      lastError: null,
      lastErrorKind: null,
      retryable: true,
    });
  }

  private async release(record: OutboxRecord): Promise<OutboxRecord> {
    if (record.evidenceReleased) return record;
    try {
      await this.releaseEvidence(record);
      return await this.save(record, {
        evidenceReleased: true,
        lastError: null,
        lastErrorKind: null,
      });
    } catch {
      return this.save(record, {
        lastErrorKind: 'local',
        lastError:
          'Sent for review. Device evidence cleanup will retry while the app is open.',
      });
    }
  }

  private async submit(
    record: OutboxRecord,
    transport: OutboxTransport,
  ): Promise<OutboxRecord> {
    const payload = record.confirmedPayload;
    if (!payload || !record.reportId)
      throw new OutboxSyncError(
        'Confirmed submission details are incomplete.',
        'local',
        false,
      );
    const returned = await transport.submit(record.reportId, payload);
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

  private async fulfillSendRequest(
    record: OutboxRecord,
    transport: OutboxTransport,
  ) {
    if (!record.sendRequested || !getReportEvidenceState(record).canSubmit)
      return record;
    const pending = await this.save(record, {
      confirmedPayload: normalizeConfirmation({
        text: initialConfirmationText(record),
        workDate: record.requestedWorkDate ?? null,
        activityId: null,
      }),
      confirmedActivityLabel: null,
      submissionState: 'pending',
      submissionRejected: false,
    });
    return this.submit(pending, transport);
  }

  private async finishCancellation(
    record: OutboxRecord,
    transport: OutboxTransport,
  ): Promise<OutboxRecord> {
    if (record.reportId) await transport.discard(record.reportId);
    await this.cancelEvidence(record);
    await this.index.remove(record.userId, record.captureId);
    notifyOutboxChanged(record.userId, record.captureId);
    return {
      ...record,
      state: 'failed',
      retryable: false,
      lastError: null,
      lastErrorKind: null,
    };
  }

  async sync(
    userId: string,
    captureId: string,
    options: { includePaused?: boolean } = {},
  ): Promise<OutboxRecord> {
    const result = await this.mutate(userId, captureId, () =>
      this.syncRecord(userId, captureId, options),
    );
    // A direct screen retry can finish after the automatic coordinator went idle.
    // Automatic passes schedule their own backoff; only explicit retries wake it.
    if (
      options.includePaused &&
      result.submissionState === 'submitted' &&
      !result.evidenceReleased
    )
      notifyOutboxWork(userId);
    return result;
  }

  private async syncRecord(
    userId: string,
    captureId: string,
    options: { includePaused?: boolean },
  ): Promise<OutboxRecord> {
    let record = await this.index.get(userId, captureId);
    if (!record)
      throw new OutboxSyncError(
        'This outbox item is unavailable for this account.',
        'local',
        false,
      );
    if (record.submissionState === 'submitted') return this.release(record);
    if (record.cancelRequested)
      try {
        return await this.finishCancellation(
          record,
          this.transportForAccount(userId),
        );
      } catch (error) {
        const failure = asSyncError(error, 'server');
        return this.save(record, {
          state:
            failure.kind === 'auth' || failure.kind === 'access'
              ? 'paused'
              : 'failed',
          lastErrorKind: failure.kind,
          lastError:
            'Cancellation is queued. Local evidence stays private until server cleanup succeeds.',
          retryable: failure.retryable,
        });
      }
    if (record.submissionRejected) return record;
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
      if (record.submissionState === 'pending') {
        if (!record.reportId) {
          if (record.kind !== 'report' || record.manifest.files.length)
            throw new OutboxSyncError(
              'Saved media must be verified before submission.',
              'local',
              false,
            );
          record = await this.phase(record, 'reserving');
          const reportId = await transport.reserve(record);
          record = await this.save(record, {
            reportId,
            state: 'needs_confirmation',
          });
        }
        return await this.submit(record, transport);
      }
      if (record.state === 'needs_confirmation') {
        if (record.kind !== 'voice' || record.originalTranscript)
          return await this.fulfillSendRequest(record, transport);
        const result = await transport.inspect(record.reportId!);
        if (result.status === 'ready')
          return await this.fulfillSendRequest(
            await this.save(record, {
              originalTranscript: result.originalTranscript,
              lastError: null,
              lastErrorKind: null,
            }),
            transport,
          );
        if (result.status === 'failed')
          throw new OutboxSyncError(result.message, 'server', false);
        if (result.status === 'retryable')
          throw new OutboxSyncError(result.message, 'server', true);
        return record;
      }
      if (record.reportId && record.state === 'processing') {
        const reportId = record.reportId;
        const result = await transport.inspect(reportId);
        if (result.status === 'ready')
          return await this.fulfillSendRequest(
            await this.save(record, {
              state: 'needs_confirmation',
              originalTranscript: result.originalTranscript,
              lastError: null,
              lastErrorKind: null,
            }),
            transport,
          );
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
        return await this.fulfillSendRequest(
          await this.save(record, {
            state: 'needs_confirmation',
            originalTranscript: result.originalTranscript,
            lastError: null,
            lastErrorKind: null,
          }),
          transport,
        );
      if (result.status === 'failed')
        throw new OutboxSyncError(result.message, 'server', false);
      if (result.status === 'retryable')
        throw new OutboxSyncError(result.message, 'server', true);
      return record;
    } catch (error) {
      const failure = asSyncError(error, 'server');
      const latest = (await this.index.get(userId, captureId)) ?? record;
      return this.save(latest, {
        state:
          failure.kind === 'auth' || failure.kind === 'access'
            ? 'paused'
            : 'failed',
        lastErrorKind: failure.kind,
        lastError: failure.message,
        retryable: failure.retryable,
        submissionRejected: error instanceof SubmissionRejectedError,
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
        !row.sendRequested &&
        !row.cancelRequested &&
        getReportEvidenceState(row).canSubmit
      ) {
        results.push(row);
        continue;
      }
      results.push(await this.sync(userId, row.captureId, options));
    }
    return results;
  }
}
