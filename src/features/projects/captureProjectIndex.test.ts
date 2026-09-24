import { createRequire } from 'node:module';

import { createCaptureProjectIndex } from './captureProjectIndex';

import type { ProjectContext } from './myWorkService';
import type { SQLiteDatabase } from 'expo-sqlite';

const { DatabaseSync } = createRequire(__filename)(
  'node:sqlite',
) as typeof import('node:sqlite');

it('remembers only the verified context under its exact account key', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (source: string) => sql.exec(source),
    getFirstAsync: async (
      source: string,
      ...params: (string | number | null)[]
    ) => sql.prepare(source).get(...params) ?? null,
    runAsync: async (source: string, ...params: (string | number | null)[]) =>
      sql.prepare(source).run(...params),
  } as unknown as SQLiteDatabase;
  const context: ProjectContext = {
    member: {
      project_id: 'project',
      user_id: 'alice',
      display_name: 'Alice',
      role: 'reporter',
      active: true,
      version: 3,
    },
    project: { id: 'project', name: "Plant ' A" },
  };
  try {
    const index = await createCaptureProjectIndex(db);
    await index.put('alice', context);
    await expect(index.get('alice')).resolves.toEqual(context);
    await expect(index.get('bob')).resolves.toBeNull();
    await expect(index.get("bob' OR 1=1 --")).resolves.toBeNull();
  } finally {
    sql.close();
  }
});
