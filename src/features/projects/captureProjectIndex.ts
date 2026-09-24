import type { ProjectContext } from './myWorkService';
import type { SQLiteDatabase } from 'expo-sqlite';

type StoredContext = { context: string };

export async function createCaptureProjectIndex(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_project_context (
      userId TEXT PRIMARY KEY NOT NULL,
      context TEXT NOT NULL,
      verifiedAt TEXT NOT NULL
    );`);
  return {
    async put(userId: string, context: ProjectContext) {
      await db.runAsync(
        `INSERT INTO local_project_context (userId,context,verifiedAt) VALUES (?,?,?)
         ON CONFLICT(userId) DO UPDATE SET context=excluded.context,verifiedAt=excluded.verifiedAt`,
        userId,
        JSON.stringify(context),
        new Date().toISOString(),
      );
    },
    async get(userId: string) {
      const row = await db.getFirstAsync<StoredContext>(
        'SELECT context FROM local_project_context WHERE userId = ?',
        userId,
      );
      return row ? (JSON.parse(row.context) as ProjectContext) : null;
    },
    async remove(userId: string) {
      await db.runAsync(
        'DELETE FROM local_project_context WHERE userId = ?',
        userId,
      );
    },
  };
}
