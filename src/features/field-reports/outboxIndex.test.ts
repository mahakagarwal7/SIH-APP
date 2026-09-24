import { createRequire } from 'node:module';

import { createOutboxIndex } from './outboxIndex';

import type { OutboxRecord } from './outbox';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');

it('persists and migrates retryability without losing manifests, progress or owner partitions', async () => {
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
    // Simulate the schema shipped by the original PR, then reopen it.
    sql.exec(
      "ALTER TABLE local_field_outbox DROP COLUMN retryable; UPDATE local_field_outbox SET lastErrorKind='local';",
    );
    const migrated = await createOutboxIndex(db);
    await expect(migrated.get('alice', row.captureId)).resolves.toMatchObject({
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
