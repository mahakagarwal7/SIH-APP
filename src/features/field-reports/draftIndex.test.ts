import { createRequire } from 'node:module';

import { createDraftIndex } from './draftIndex';

import type { VoiceDraft } from './draftStore';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');

it('persists scoped draft metadata with real SQLite and rejects cross-account changes', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (source: string) => {
      sql.exec(source);
    },
    getFirstAsync: async (source: string, ...params: string[]) =>
      sql.prepare(source).get(...params) ?? null,
    getAllAsync: async (source: string, ...params: string[]) =>
      sql.prepare(source).all(...params),
    runAsync: async (source: string, ...params: (string | number)[]) =>
      sql.prepare(source).run(...params),
  } as unknown as SQLiteDatabase;
  try {
    const index = await createDraftIndex(db);
    const row: VoiceDraft = {
      id: 'one',
      userId: 'alice',
      projectId: 'p',
      projectName: "Plant ' A",
      createdAt: '2026-09-23T00:00:00Z',
      duration: 1,
      sampleRate: 16000,
      byteLength: 32044,
      state: 'saving',
    };
    await index.insert(row);
    await index.setState('alice', 'one', 'saved');
    expect(await index.list('alice')).toEqual([{ ...row, state: 'saved' }]);
    expect(await index.list("bob' OR 1=1 --")).toEqual([]);
    expect(await index.get('bob', 'one')).toBeNull();
    await expect(index.setState('bob', 'one', 'deleting')).rejects.toThrow();
    await index.remove('bob', 'one');
    const reopened = await createDraftIndex(db);
    expect((await reopened.get('alice', 'one'))?.state).toBe('saved');
    await reopened.remove('alice', 'one');
    expect(await reopened.list('alice')).toEqual([]);
  } finally {
    sql.close();
  }
});
