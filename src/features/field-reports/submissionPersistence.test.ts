import { createRequire } from 'node:module';

import { OutboxSyncError, SubmissionRejectedError } from './outbox';
import { subscribeOutboxWork } from './outboxEvents';
import { createOutboxIndex } from './outboxIndex';
import { OutboxService } from './outboxService';

import type { OutboxTransport } from './outbox';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');
const captureId = '10000000-0000-4000-8000-000000000001';
const reportId = '20000000-0000-4000-8000-000000000002';
const activityId = '30000000-0000-4000-8000-000000000003';
const payload = {
  text: 'Two of eight installed; six remain.',
  workDate: '2026-09-24',
  activityId,
};

async function setup() {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (source: string) => sql.exec(source),
    getFirstAsync: async (
      source: string,
      ...params: (string | number | null)[]
    ) => sql.prepare(source).get(...params) ?? null,
    getAllAsync: async (
      source: string,
      ...params: (string | number | null)[]
    ) => sql.prepare(source).all(...params),
    runAsync: async (source: string, ...params: (string | number | null)[]) =>
      sql.prepare(source).run(...params),
  } as unknown as SQLiteDatabase;
  const index = await createOutboxIndex(db);
  const transport: OutboxTransport = {
    ensureAccess: jest.fn(async () => {}),
    reserve: jest.fn(async () => reportId),
    upload: jest.fn(async () => {}),
    finalize: jest.fn(async () => {}),
    inspect: jest.fn(async () => ({
      status: 'ready' as const,
      originalTranscript: null,
    })),
    submit: jest.fn(async () => reportId),
  };
  const release = jest.fn(async () => {});
  let tick = 0;
  const clock = () =>
    new Date(Date.UTC(2026, 8, 24, 0, 0, tick++)).toISOString();
  const reader = { read: async () => new Uint8Array() };
  const service = new OutboxService(
    index,
    reader,
    () => transport,
    async () => '',
    clock,
    release,
  );
  await service.enqueue({
    captureId,
    userId: 'alice',
    projectId: 'project',
    projectName: 'Site',
    kind: 'report',
    createdAt: '2026-09-24T00:00:00Z',
    text: 'Original words',
    manifest: { captureId, language: 'auto', files: [] },
  });
  return { sql, db, index, service, transport, release, reader, clock };
}

it('persists offline text confirmation before reservation and submits the same payload after restart', async () => {
  const s = await setup();
  try {
    const saved = await s.service.confirm(
      'alice',
      captureId,
      payload,
      'A-20 · Install supports',
    );
    expect(saved).toMatchObject({
      reportId: null,
      submissionState: 'pending',
      confirmedPayload: payload,
    });
    expect(s.transport.reserve).not.toHaveBeenCalled();
    expect(s.transport.submit).not.toHaveBeenCalled();
    const index = await createOutboxIndex(s.db);
    expect(await index.get('alice', captureId)).toMatchObject({
      confirmedActivityLabel: 'A-20 · Install supports',
      confirmedPayload: payload,
    });
    const restarted = new OutboxService(
      index,
      s.reader,
      () => s.transport,
      async () => '',
      s.clock,
      s.release,
    );
    await expect(restarted.sync('alice', captureId)).resolves.toMatchObject({
      submissionState: 'submitted',
      evidenceReleased: true,
    });
    expect(s.transport.reserve).toHaveBeenCalledTimes(1);
    expect(s.transport.submit).toHaveBeenCalledWith(reportId, payload);
    expect(s.release).toHaveBeenCalledTimes(1);
  } finally {
    s.sql.close();
  }
});

it('serializes automatic and direct receipt checks without a second RPC or conflicting SQLite receipt', async () => {
  const s = await setup();
  try {
    await s.service.confirm('alice', captureId, payload);
    let finish!: (id: string) => void;
    let started!: () => void;
    const sending = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.mocked(s.transport.submit).mockImplementationOnce(() => {
      started();
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const automatic = s.service.syncAll('alice');
    await sending;
    const manual = s.service.sync('alice', captureId, { includePaused: true });
    finish(reportId);
    await expect(automatic).resolves.toEqual([
      expect.objectContaining({ submissionState: 'submitted' }),
    ]);
    await expect(manual).resolves.toMatchObject({
      submissionState: 'submitted',
      evidenceReleased: true,
    });
    expect(s.transport.submit).toHaveBeenCalledTimes(1);
    expect(s.release).toHaveBeenCalledTimes(1);
  } finally {
    s.sql.close();
  }
});

it('allows correction only after an explicit pre-submit activity rejection, including after restart', async () => {
  const s = await setup();
  try {
    await s.service.confirm('alice', captureId, payload);
    jest
      .mocked(s.transport.submit)
      .mockRejectedValueOnce(new SubmissionRejectedError());
    const rejected = await s.service.sync('alice', captureId);
    expect(rejected).toMatchObject({
      submissionState: 'pending',
      submissionRejected: true,
      state: 'paused',
      retryable: false,
    });
    await s.service.syncAll('alice', { includePaused: true });
    expect(s.transport.submit).toHaveBeenCalledTimes(1);
    const index = await createOutboxIndex(s.db);
    const restarted = new OutboxService(
      index,
      s.reader,
      () => s.transport,
      async () => '',
      s.clock,
      s.release,
    );
    const corrected = { ...payload, activityId: null };
    await expect(
      restarted.confirm('alice', captureId, corrected),
    ).resolves.toMatchObject({
      confirmedPayload: corrected,
      submissionRejected: false,
    });
    await expect(restarted.sync('alice', captureId)).resolves.toMatchObject({
      submissionState: 'submitted',
    });
    expect(s.transport.submit).toHaveBeenLastCalledWith(reportId, corrected);
    const submitted = (await index.get('alice', captureId))!;
    await expect(
      index.put({ ...submitted, confirmedPayload: payload }),
    ).rejects.toThrow('different content');
  } finally {
    s.sql.close();
  }
});

it.each(['auth', 'access', 'network'] as const)(
  'keeps %s failures immutable rather than assuming the submission was rejected',
  async (kind) => {
    const s = await setup();
    try {
      await s.service.confirm('alice', captureId, payload);
      jest
        .mocked(s.transport.submit)
        .mockRejectedValueOnce(
          new OutboxSyncError('Receipt unavailable', kind, kind === 'network'),
        );
      const pending = await s.service.sync('alice', captureId);
      expect(pending.submissionRejected).toBe(false);
      await expect(
        s.service.confirm('alice', captureId, { ...payload, activityId: null }),
      ).rejects.toThrow('locked');
      await expect(
        s.index.put({
          ...pending,
          confirmedPayload: { ...payload, text: 'Changed' },
        }),
      ).rejects.toThrow('different content');
      await s.service.sync('alice', captureId, { includePaused: true });
      expect(s.transport.submit).toHaveBeenLastCalledWith(reportId, payload);
    } finally {
      s.sql.close();
    }
  },
);

it('wakes idle foreground cleanup after a manual receipt retry without resubmitting', async () => {
  const s = await setup();
  let unsubscribe = () => {};
  try {
    await s.service.confirm('alice', captureId, payload);
    jest
      .mocked(s.transport.submit)
      .mockRejectedValueOnce(
        new OutboxSyncError('Session expired', 'auth', false),
      );
    await s.service.sync('alice', captureId);
    await s.service.syncAll('alice');
    const wake = jest.fn();
    unsubscribe = subscribeOutboxWork(wake);
    s.release.mockRejectedValueOnce(new Error('File temporarily busy'));
    await expect(
      s.service.sync('alice', captureId, { includePaused: true }),
    ).resolves.toMatchObject({
      submissionState: 'submitted',
      evidenceReleased: false,
    });
    expect(wake).toHaveBeenCalledTimes(1);
    expect(wake).toHaveBeenCalledWith('alice');
    await expect(s.service.syncAll('alice')).resolves.toEqual([
      expect.objectContaining({ evidenceReleased: true }),
    ]);
    expect(s.transport.submit).toHaveBeenCalledTimes(2);
    expect(wake).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
    s.sql.close();
  }
});
