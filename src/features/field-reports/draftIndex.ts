import type { DraftIndex, VoiceDraft } from './draftStore';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function createDraftIndex(
  db: SQLiteDatabase,
): Promise<DraftIndex> {
  await db.execAsync(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_voice_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      duration REAL NOT NULL,
      sampleRate INTEGER NOT NULL,
      byteLength INTEGER NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('saving', 'saved', 'deleting'))
    );
    CREATE INDEX IF NOT EXISTS local_voice_owner ON local_voice_drafts(userId, createdAt);`);
  return {
    get: (userId, id) =>
      db.getFirstAsync<VoiceDraft>(
        'SELECT * FROM local_voice_drafts WHERE userId = ? AND id = ?',
        userId,
        id,
      ),
    list: (userId) =>
      db.getAllAsync<VoiceDraft>(
        'SELECT * FROM local_voice_drafts WHERE userId = ? ORDER BY createdAt DESC, id DESC',
        userId,
      ),
    async insert(draft) {
      await db.runAsync(
        'INSERT INTO local_voice_drafts (id,userId,projectId,projectName,createdAt,duration,sampleRate,byteLength,state) VALUES (?,?,?,?,?,?,?,?,?)',
        draft.id,
        draft.userId,
        draft.projectId,
        draft.projectName,
        draft.createdAt,
        draft.duration,
        draft.sampleRate,
        draft.byteLength,
        draft.state,
      );
    },
    async setState(userId, id, state) {
      const result = await db.runAsync(
        'UPDATE local_voice_drafts SET state = ? WHERE userId = ? AND id = ?',
        state,
        userId,
        id,
      );
      if (result.changes !== 1)
        throw new Error('Draft no longer exists for this account.');
    },
    async remove(userId, id) {
      await db.runAsync(
        'DELETE FROM local_voice_drafts WHERE userId = ? AND id = ?',
        userId,
        id,
      );
    },
  };
}
