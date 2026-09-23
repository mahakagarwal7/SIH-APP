import { createRequire } from 'node:module';

import { createReportDraftIndex } from './reportDraftIndex';

import type { ReportDraft } from './reportDraftStore';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');

it('persists report metadata and binds owner parameters in SQLite', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (source: string) => sql.exec(source),
    getFirstAsync: async (source: string, ...params: string[]) =>
      sql.prepare(source).get(...params) ?? null,
    getAllAsync: async (source: string, ...params: string[]) =>
      sql.prepare(source).all(...params),
    runAsync: async (source: string, ...params: (string | number)[]) =>
      sql.prepare(source).run(...params),
  } as unknown as SQLiteDatabase;
  try {
    const index = await createReportDraftIndex(db);
    const row: ReportDraft = {
      id: 'one',
      userId: 'alice',
      projectId: 'project',
      projectName: "Plant ' A",
      createdAt: '2026-09-24T00:00:00Z',
      text: 'Two supports installed',
      photos: [
        {
          id: 'image',
          fileName: 'image.jpg',
          mimeType: 'image/jpeg',
          caption: 'Support A',
          byteLength: 4,
          width: 10,
          height: 10,
        },
      ],
      state: 'saving',
    };
    await index.insert(row);
    await index.setState('alice', 'one', 'saved');
    expect(await index.list('alice')).toEqual([{ ...row, state: 'saved' }]);
    expect(await index.list("bob' OR 1=1 --")).toEqual([]);
    await expect(index.setState('bob', 'one', 'deleting')).rejects.toThrow();
    expect(
      (await createReportDraftIndex(db)).get('alice', 'one'),
    ).resolves.toMatchObject({
      text: 'Two supports installed',
      photos: [{ caption: 'Support A' }],
    });
  } finally {
    sql.close();
  }
});
