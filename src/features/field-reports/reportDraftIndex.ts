import type {
  ReportDraft,
  ReportDraftIndex,
  SavedPhoto,
} from './reportDraftStore';
import type { SQLiteDatabase } from 'expo-sqlite';

type StoredDraft = Omit<ReportDraft, 'photos'> & { photos: string };

function hydrate(row: StoredDraft | null): ReportDraft | null {
  if (!row) return null;
  const photos = JSON.parse(row.photos) as SavedPhoto[];
  if (!Array.isArray(photos)) throw new Error('Invalid local photo metadata.');
  return { ...row, photos };
}

export async function createReportDraftIndex(
  db: SQLiteDatabase,
): Promise<ReportDraftIndex> {
  await db.execAsync(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_report_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      text TEXT NOT NULL,
      photos TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('saving', 'saved', 'deleting'))
    );
    CREATE INDEX IF NOT EXISTS local_report_owner ON local_report_drafts(userId, createdAt);`);
  return {
    async get(userId, id) {
      return hydrate(
        await db.getFirstAsync<StoredDraft>(
          'SELECT * FROM local_report_drafts WHERE userId = ? AND id = ?',
          userId,
          id,
        ),
      );
    },
    async list(userId) {
      const rows = await db.getAllAsync<StoredDraft>(
        'SELECT * FROM local_report_drafts WHERE userId = ? ORDER BY createdAt DESC, id DESC',
        userId,
      );
      return rows.map((row) => hydrate(row)!);
    },
    async insert(draft) {
      await db.runAsync(
        'INSERT INTO local_report_drafts (id,userId,projectId,projectName,createdAt,text,photos,state) VALUES (?,?,?,?,?,?,?,?)',
        draft.id,
        draft.userId,
        draft.projectId,
        draft.projectName,
        draft.createdAt,
        draft.text,
        JSON.stringify(draft.photos),
        draft.state,
      );
    },
    async setState(userId, id, state) {
      const result = await db.runAsync(
        'UPDATE local_report_drafts SET state = ? WHERE userId = ? AND id = ?',
        state,
        userId,
        id,
      );
      if (result.changes !== 1)
        throw new Error('Draft no longer exists for this account.');
    },
    async remove(userId, id) {
      await db.runAsync(
        'DELETE FROM local_report_drafts WHERE userId = ? AND id = ?',
        userId,
        id,
      );
    },
  };
}
