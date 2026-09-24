import { createRequire } from 'node:module';

import { createOutboxIndex } from './outboxIndex';

import type { OutboxRecord } from './outbox';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');

function adapter(sql: InstanceType<typeof DatabaseSync>) {
  return {
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
}

it('persists the frozen manifest, upload progress and owner partition', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = adapter(sql);
  try {
    const index = await createOutboxIndex(db);
    const row: OutboxRecord = {
      captureId: '10000000-0000-4000-8000-000000000001',
      userId: 'alice',
      projectId: 'project',
      projectName: "Plant ' A",
      kind: 'voice',
      createdAt: '2026-09-24T00:00:00Z',
      text: '',
      manifest: {
        captureId: '10000000-0000-4000-8000-000000000001',
        language: 'auto',
        files: [
          {
            id: '20000000-0000-4000-8000-000000000002',
            name: 'voice.wav',
            kind: 'audio',
            mime: 'audio/wav',
            bytes: 3,
            sha256: 'a'.repeat(64),
            caption: '',
          },
        ],
      },
      reportId: null,
      uploadedFiles: [],
      originalTranscript: null,
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
      updatedAt: '2026-09-24T00:00:00Z',
    };
    await index.put(row);
    await index.put({
      ...row,
      reportId: '30000000-0000-4000-8000-000000000003',
      uploadedFiles: [row.manifest.files[0]!.id],
      state: 'processing',
      attemptCount: 1,
    });
    await expect(index.get('alice', row.captureId)).resolves.toMatchObject({
      state: 'processing',
      attemptCount: 1,
      manifest: { files: [{ sha256: 'a'.repeat(64) }] },
      sendRequested: false,
      cancelRequested: false,
    });
    const processing = (await index.get('alice', row.captureId))!;
    await index.put({ ...processing, sendRequested: true });
    await expect(index.get('alice', row.captureId)).resolves.toMatchObject({
      sendRequested: true,
    });
    await index.put({
      ...(await index.get('alice', row.captureId))!,
      sendRequested: false,
      cancelRequested: true,
    });
    await expect(index.get('alice', row.captureId)).resolves.toMatchObject({
      sendRequested: false,
      cancelRequested: true,
    });
    await expect(index.put({ ...row, text: 'different' })).rejects.toThrow(
      'different content',
    );
    await expect(
      index.put({
        ...row,
        reportId: '50000000-0000-4000-8000-000000000005',
        uploadedFiles: [row.manifest.files[0]!.id],
        state: 'processing',
      }),
    ).rejects.toThrow('different content');
    await expect(index.list("bob' OR 1=1 --")).resolves.toEqual([]);
    await expect(
      (await createOutboxIndex(db)).list('alice'),
    ).resolves.toHaveLength(1);
    const persisted = (await index.get('alice', row.captureId))!;
    await index.put({
      ...persisted,
      state: 'failed',
      lastErrorKind: 'server',
      retryable: false,
    });
    await expect(
      (await createOutboxIndex(db)).get('alice', row.captureId),
    ).resolves.toMatchObject({ retryable: false });
    sql.exec(
      "ALTER TABLE local_field_outbox DROP COLUMN retryable; UPDATE local_field_outbox SET lastErrorKind='local';",
    );
    await expect(
      (await createOutboxIndex(db)).get('alice', row.captureId),
    ).resolves.toMatchObject({
      retryable: false,
      state: 'failed',
      reportId: persisted.reportId,
      uploadedFiles: persisted.uploadedFiles,
      manifest: persisted.manifest,
    });
  } finally {
    sql.close();
  }
});

it('migrates an existing roadmap 1.5 outbox without replacing its rows', async () => {
  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec(`CREATE TABLE local_field_outbox (
      captureId TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      kind TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      text TEXT NOT NULL,
      manifest TEXT NOT NULL,
      reportId TEXT,
      uploadedFiles TEXT NOT NULL,
      state TEXT NOT NULL,
      attemptCount INTEGER NOT NULL,
      lastErrorKind TEXT,
      lastError TEXT,
      updatedAt TEXT NOT NULL
    );
    INSERT INTO local_field_outbox VALUES (
      '10000000-0000-4000-8000-000000000001','alice','project','Site project','report',
      '2026-09-24T00:00:00Z','Progress recorded.',
      '{"captureId":"10000000-0000-4000-8000-000000000001","language":"auto","files":[]}',
      '30000000-0000-4000-8000-000000000003','[]','needs_confirmation',1,NULL,NULL,
      '2026-09-24T00:01:00Z'
    );`);
    const index = await createOutboxIndex(adapter(sql));
    await expect(
      index.get('alice', '10000000-0000-4000-8000-000000000001'),
    ).resolves.toMatchObject({
      text: 'Progress recorded.',
      submissionState: 'unconfirmed',
      confirmedPayload: null,
      confirmedActivityLabel: null,
      submissionRejected: false,
      evidenceReleased: false,
    });
  } finally {
    sql.close();
  }
});
