import { OutboxSyncError } from './outbox';
import { OutboxService } from './outboxService';

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
  };
  const reader: OutboxFileReader = { read: jest.fn(async () => bytes) };
  let inspected: RemoteMediaState = { status: 'processing' };
  const transport: OutboxTransport = {
    ensureAccess: jest.fn(async () => {}),
    reserve: jest.fn(async () => reportId),
    upload: jest.fn(async () => {}),
    finalize: jest.fn(async () => {}),
    inspect: jest.fn(async () => inspected),
  };
  let clock = 0;
  const service = new OutboxService(
    index,
    reader,
    transport,
    async () => digest,
    () => `2026-09-24T00:00:0${clock++}.000Z`,
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
  setInspected({ status: 'ready' });
  const ready = await service.sync('user-one', processing.captureId);
  expect(ready.state).toBe('needs_confirmation');
  expect(transport.upload).toHaveBeenCalledTimes(1);
  expect(transport.finalize).toHaveBeenCalledTimes(1);
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
    },
    { read: async () => new Uint8Array([9, 9, 9]) },
    transport,
    async () => 'b'.repeat(64),
  );
  const failed = await mismatched.sync('user-one', captureId);
  expect(failed).toMatchObject({ state: 'failed', lastErrorKind: 'local' });
  expect(transport.upload).not.toHaveBeenCalled();
});
