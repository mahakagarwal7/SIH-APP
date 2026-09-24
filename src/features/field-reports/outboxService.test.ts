import { OutboxSyncError } from './outbox';
import { OutboxService } from './outboxService';
import { initialConfirmationText } from './reportEvidence';

import type {
  OutboxFileReader,
  OutboxIndex,
  OutboxRecord,
  OutboxTransport,
  RemoteMediaState,
} from './outbox';

const captureId = '10000000-0000-4000-8000-000000000001';
const fileId = '20000000-0000-4000-8000-000000000002';
const reportId = '30000000-0000-4000-8000-000000000003';
const bytes = new Uint8Array([1, 2, 3]);
const digest = 'a'.repeat(64);

function setup() {
  const rows = new Map<string, OutboxRecord>();
  const index: OutboxIndex = {
    get: jest.fn(async (userId, id) => {
      const row = rows.get(id);
      return row?.userId === userId ? structuredClone(row) : null;
    }),
    list: jest.fn(async (userId) =>
      [...rows.values()]
        .filter((row) => row.userId === userId)
        .map((row) => structuredClone(row)),
    ),
    put: jest.fn(
      async (row) => void rows.set(row.captureId, structuredClone(row)),
    ),
    remove: jest.fn(async (_userId, id) => void rows.delete(id)),
  };
  const reader: OutboxFileReader = { read: jest.fn(async () => bytes) };
  let inspected: RemoteMediaState = { status: 'processing' };
  const transport: OutboxTransport = {
    ensureAccess: jest.fn(async () => {}),
    reserve: jest.fn(async () => reportId),
    upload: jest.fn(async () => {}),
    finalize: jest.fn(async () => {}),
    inspect: jest.fn(async () => inspected),
    submit: jest.fn(async () => reportId),
    discard: jest.fn(async () => {}),
  };
  const releaseEvidence = jest.fn(async () => {});
  const cancelEvidence = jest.fn(async () => {});
  let clock = 0;
  const service = new OutboxService(
    index,
    reader,
    () => transport,
    async () => digest,
    () => `2026-09-24T00:00:0${clock++}.000Z`,
    releaseEvidence,
    cancelEvidence,
  );
  const input = {
    captureId,
    userId: 'user-one',
    projectId: 'project-one',
    projectName: 'Site project',
    kind: 'voice' as const,
    createdAt: '2026-09-24T00:00:00.000Z',
    text: '',
    manifest: {
      captureId,
      language: 'auto' as const,
      files: [
        {
          id: fileId,
          name: 'recording.wav',
          kind: 'audio' as const,
          mime: 'audio/wav' as const,
          bytes: bytes.length,
          sha256: digest,
          caption: '',
        },
      ],
    },
  };
  return {
    service,
    rows,
    index,
    reader,
    transport,
    releaseEvidence,
    cancelEvidence,
    input,
    setInspected(value: RemoteMediaState) {
      inspected = value;
    },
  };
}

it('freezes one manifest for a capture identifier', async () => {
  const { service, input } = setup();
  await expect(service.enqueue(input)).resolves.toMatchObject({
    state: 'queued',
  });
  await expect(
    service.enqueue({ ...input, text: 'different content' }),
  ).rejects.toThrow('different content');
});

it('queues Send before transcription and submits automatically when media is ready', async () => {
  const { service, input, setInspected, transport } = setup();
  await service.enqueue(input);
  const requested = await service.requestSend('user-one', captureId);
  expect(requested).toMatchObject({
    sendRequested: true,
    submissionState: 'unconfirmed',
  });
  expect(transport.submit).not.toHaveBeenCalled();

  setInspected({
    status: 'ready',
    originalTranscript: 'Two supports installed.',
  });
  const submitted = await service.sync('user-one', captureId);
  expect(submitted).toMatchObject({
    submissionState: 'submitted',
    originalTranscript: 'Two supports installed.',
    confirmedPayload: {
      text: 'Two supports installed.',
      workDate: null,
      activityId: null,
    },
  });
  expect(transport.reserve).toHaveBeenCalledTimes(1);
  expect(transport.submit).toHaveBeenCalledTimes(1);
});

it('does not stop automatic sync at confirmation when an early Send is queued', async () => {
  const { service, input, rows, transport } = setup();
  await service.enqueue(input);
  await service.requestSend('user-one', captureId);
  rows.set(captureId, {
    ...rows.get(captureId)!,
    reportId,
    state: 'needs_confirmation',
    originalTranscript: 'Verified transcript.',
  });
  await expect(service.syncAll('user-one')).resolves.toEqual([
    expect.objectContaining({ submissionState: 'submitted' }),
  ]);
  expect(transport.submit).toHaveBeenCalledTimes(1);
});

it('persists an automatic Send receipt failure for unchanged retry', async () => {
  const { service, input, setInspected, transport } = setup();
  await service.enqueue(input);
  await service.requestSend('user-one', captureId);
  setInspected({
    status: 'ready',
    originalTranscript: 'Verified transcript.',
  });
  jest
    .mocked(transport.submit)
    .mockRejectedValueOnce(
      new OutboxSyncError('Connection interrupted.', 'network', true),
    );
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    state: 'failed',
    submissionState: 'pending',
    confirmedPayload: { text: 'Verified transcript.' },
    retryable: true,
  });
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    submissionState: 'submitted',
  });
  expect(transport.submit).toHaveBeenCalledTimes(2);
});

it('cancels local evidence before reservation without creating a remote draft', async () => {
  const { service, input, rows, transport, cancelEvidence } = setup();
  await service.enqueue(input);
  await expect(service.cancel('user-one', captureId)).resolves.toMatchObject({
    cancelRequested: true,
    retryable: false,
  });
  expect(transport.discard).not.toHaveBeenCalled();
  expect(cancelEvidence).toHaveBeenCalledTimes(1);
  expect(rows.has(captureId)).toBe(false);
});

it('persists cancellation across a network failure and retries remote cleanup', async () => {
  const { service, input, rows, transport, cancelEvidence } = setup();
  await service.enqueue(input);
  rows.set(captureId, { ...rows.get(captureId)!, reportId });
  jest
    .mocked(transport.discard)
    .mockRejectedValueOnce(
      new OutboxSyncError('Connection interrupted.', 'network', true),
    );
  await expect(service.cancel('user-one', captureId)).resolves.toMatchObject({
    cancelRequested: true,
    state: 'failed',
    retryable: true,
  });
  expect(cancelEvidence).not.toHaveBeenCalled();
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    cancelRequested: true,
    retryable: false,
  });
  expect(transport.discard).toHaveBeenCalledTimes(2);
  expect(cancelEvidence).toHaveBeenCalledTimes(1);
  expect(rows.has(captureId)).toBe(false);
});

it('reserves, uploads, finalizes and persists progress for restart-safe retry', async () => {
  const { service, input, transport, rows } = setup();
  await service.enqueue(input);
  const first = await service.sync('user-one', captureId);
  expect(first).toMatchObject({
    reportId,
    state: 'processing',
    uploadedFiles: [fileId],
  });
  expect(transport.reserve).toHaveBeenCalledTimes(1);
  expect(transport.upload).toHaveBeenCalledWith(
    `project-one/${reportId}/${fileId}`,
    input.manifest.files[0],
    bytes,
  );
  expect(transport.finalize).toHaveBeenCalledTimes(1);

  rows.set(captureId, { ...first, state: 'uploading' });
  const retried = await service.sync('user-one', captureId);
  expect(retried.state).toBe('processing');
  expect(transport.reserve).toHaveBeenCalledTimes(1);
  expect(transport.upload).toHaveBeenCalledTimes(1);
  expect(transport.finalize).toHaveBeenCalledTimes(2);
});

it('moves processed media to needs confirmation without submitting it', async () => {
  const { service, input, setInspected, transport } = setup();
  await service.enqueue(input);
  const processing = await service.sync('user-one', captureId);
  setInspected({
    status: 'ready',
    originalTranscript: 'Two of eight complete.',
  });
  const ready = await service.sync('user-one', processing.captureId);
  expect(ready).toMatchObject({
    state: 'needs_confirmation',
    originalTranscript: 'Two of eight complete.',
    submissionState: 'unconfirmed',
  });
  expect(transport.upload).toHaveBeenCalledTimes(1);
  expect(transport.finalize).toHaveBeenCalledTimes(1);
  expect(transport.submit).not.toHaveBeenCalled();
});

it.each([
  ['voice', true, false, false],
  ['text', false, true, false],
  ['photo', false, false, true],
  ['voice + text', true, true, false],
  ['voice + photo', true, false, true],
  ['text + photo', false, true, true],
  ['voice + text + photo', true, true, true],
])(
  'confirms and submits %s evidence',
  async (_name, hasVoice, hasText, hasPhoto) => {
    const { service, input, rows, transport } = setup();
    const photo = {
      id: '40000000-0000-4000-8000-000000000004',
      name: 'evidence.jpg',
      kind: 'photo' as const,
      mime: 'image/jpeg' as const,
      bytes: bytes.length,
      sha256: digest,
      caption: '',
    };
    const files = [
      ...(hasVoice ? input.manifest.files : []),
      ...(hasPhoto ? [photo] : []),
    ];
    const capture = {
      ...input,
      kind: hasVoice ? ('voice' as const) : ('report' as const),
      text: hasText ? 'Two supports installed.' : '',
      manifest: { ...input.manifest, files },
    };
    await service.enqueue(capture);
    if (files.length) {
      rows.set(captureId, {
        ...rows.get(captureId)!,
        reportId,
        state: 'needs_confirmation',
        originalTranscript: hasVoice ? 'Voice progress update.' : null,
      });
    }
    const ready = rows.get(captureId)!;
    await service.confirm('user-one', captureId, {
      text: initialConfirmationText(ready),
      workDate: null,
      activityId: null,
    });
    await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
      submissionState: 'submitted',
    });
    expect(transport.submit).toHaveBeenCalledTimes(1);
  },
);

it('locks the confirmed payload before submit and retries a lost response unchanged', async () => {
  const { service, input, setInspected, transport, releaseEvidence } = setup();
  await service.enqueue(input);
  setInspected({
    status: 'ready',
    originalTranscript: 'Two of eight complete.',
  });
  await service.sync('user-one', captureId);
  const payload = {
    text: 'Two of eight complete; six remain unfinished.',
    workDate: '2026-09-24',
    activityId: '40000000-0000-4000-8000-000000000004',
  };
  const confirmed = await service.confirm('user-one', captureId, payload);
  expect(confirmed).toMatchObject({
    confirmedPayload: payload,
    submissionState: 'pending',
  });
  expect(transport.submit).not.toHaveBeenCalled();

  jest
    .mocked(transport.submit)
    .mockRejectedValueOnce(
      new OutboxSyncError('Connection interrupted.', 'network', true),
    );
  const uncertain = await service.sync('user-one', captureId);
  expect(uncertain).toMatchObject({
    state: 'failed',
    submissionState: 'pending',
    confirmedPayload: payload,
  });
  await expect(
    service.confirm('user-one', captureId, { ...payload, text: 'Changed' }),
  ).rejects.toThrow('locked');

  const submitted = await service.sync('user-one', captureId);
  expect(transport.submit).toHaveBeenNthCalledWith(2, reportId, payload);
  expect(submitted).toMatchObject({
    submissionState: 'submitted',
    evidenceReleased: true,
  });
  expect(releaseEvidence).toHaveBeenCalledTimes(1);
});

it('retries local evidence cleanup without resubmitting the report', async () => {
  const { service, input, setInspected, transport, releaseEvidence } = setup();
  setInspected({ status: 'ready', originalTranscript: 'Progress recorded.' });
  await service.enqueue(input);
  await service.sync('user-one', captureId);
  await service.confirm('user-one', captureId, {
    text: 'Progress recorded; remaining work is unfinished.',
    workDate: null,
    activityId: null,
  });
  releaseEvidence.mockRejectedValueOnce(new Error('File is busy.'));
  const submitted = await service.sync('user-one', captureId);
  expect(submitted).toMatchObject({
    submissionState: 'submitted',
    evidenceReleased: false,
  });
  const cleaned = await service.sync('user-one', captureId);
  expect(cleaned.evidenceReleased).toBe(true);
  expect(transport.submit).toHaveBeenCalledTimes(1);
  expect(releaseEvidence).toHaveBeenCalledTimes(2);
});

it('pauses after revoked access and only retries when explicitly requested', async () => {
  const { service, input, transport } = setup();
  jest
    .mocked(transport.ensureAccess)
    .mockRejectedValueOnce(
      new OutboxSyncError('Access changed.', 'access', false),
    );
  await service.enqueue(input);
  const paused = await service.sync('user-one', captureId);
  expect(paused).toMatchObject({ state: 'paused', lastErrorKind: 'access' });
  await service.sync('user-one', captureId);
  expect(transport.ensureAccess).toHaveBeenCalledTimes(1);
  const retried = await service.sync('user-one', captureId, {
    includePaused: true,
  });
  expect(retried.state).toBe('processing');
});

it('never uploads bytes that differ from the frozen manifest', async () => {
  const { service, input, transport } = setup();
  const mismatched = new OutboxService(
    {
      get: async () => service.enqueue(input),
      list: async () => [],
      put: async () => {},
      remove: async () => {},
    },
    { read: async () => new Uint8Array([9, 9, 9]) },
    () => transport,
    async () => 'b'.repeat(64),
  );
  const failed = await mismatched.sync('user-one', captureId);
  expect(failed).toMatchObject({ state: 'failed', lastErrorKind: 'local' });
  expect(transport.upload).not.toHaveBeenCalled();
});

it('persists retryability and stops retrying terminal worker failures', async () => {
  const { service, input, setInspected, transport } = setup();
  setInspected({ status: 'failed', message: 'media_retry_limit' });
  await service.enqueue(input);
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    state: 'failed',
    retryable: false,
  });
  await service.syncAll('user-one');
  await service.syncAll('user-one', { includePaused: true });
  expect(transport.finalize).toHaveBeenCalledTimes(1);
});

it('retains transient network failures for automatic retry', async () => {
  const { service, input, transport } = setup();
  jest
    .mocked(transport.upload)
    .mockRejectedValueOnce(
      new OutboxSyncError('Connection interrupted.', 'network', true),
    );
  await service.enqueue(input);
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    state: 'failed',
    retryable: true,
  });
  await service.syncAll('user-one');
  expect(transport.upload).toHaveBeenCalledTimes(2);
});

it('allows an explicit retry after local evidence becomes readable again', async () => {
  const { service, input, reader, transport } = setup();
  jest
    .mocked(reader.read)
    .mockRejectedValueOnce(new Error('Device storage temporarily unavailable'));
  await service.enqueue(input);
  await expect(service.sync('user-one', captureId)).resolves.toMatchObject({
    state: 'failed',
    lastErrorKind: 'local',
    retryable: false,
  });
  await service.syncAll('user-one');
  expect(reader.read).toHaveBeenCalledTimes(1);
  await service.syncAll('user-one', { includePaused: true });
  expect(transport.upload).toHaveBeenCalledTimes(1);
});
