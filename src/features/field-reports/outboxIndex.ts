import { validateManifest } from './outbox';

import type { CaptureManifest, OutboxIndex, OutboxRecord } from './outbox';
import type { SQLiteDatabase } from 'expo-sqlite';

type StoredOutbox = Omit<OutboxRecord, 'manifest' | 'uploadedFiles'> & {
  manifest: string;
  uploadedFiles: string;
};

function hydrate(row: StoredOutbox | null): OutboxRecord | null {
  if (!row) return null;
  const manifest = JSON.parse(row.manifest) as CaptureManifest;
  const uploadedFiles = JSON.parse(row.uploadedFiles) as string[];
  if (!Array.isArray(manifest.files) || !Array.isArray(uploadedFiles))
    throw new Error('Invalid local outbox metadata.');
  validateManifest(manifest);
  const declared = new Set(manifest.files.map((file) => file.id));
  if (
    new Set(uploadedFiles).size !== uploadedFiles.length ||
    uploadedFiles.some((id) => !declared.has(id))
  )
    throw new Error('Invalid local upload progress.');
  return { ...row, manifest, uploadedFiles };
}

export async function createOutboxIndex(
  db: SQLiteDatabase,
): Promise<OutboxIndex> {
  await db.execAsync(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_field_outbox (
      captureId TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('voice', 'report')),
      createdAt TEXT NOT NULL,
      text TEXT NOT NULL,
      manifest TEXT NOT NULL,
      reportId TEXT,
      uploadedFiles TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('queued','reserving','uploading','finalizing','processing','needs_confirmation','paused','failed')),
      attemptCount INTEGER NOT NULL,
      lastErrorKind TEXT CHECK(lastErrorKind IS NULL OR lastErrorKind IN ('auth','access','local','network','server')),
      lastError TEXT,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS local_outbox_owner ON local_field_outbox(userId, createdAt);`);
  return {
    async get(userId, captureId) {
      return hydrate(
        await db.getFirstAsync<StoredOutbox>(
          'SELECT * FROM local_field_outbox WHERE userId = ? AND captureId = ?',
          userId,
          captureId,
        ),
      );
    },
    async list(userId) {
      const rows = await db.getAllAsync<StoredOutbox>(
        'SELECT * FROM local_field_outbox WHERE userId = ? ORDER BY createdAt DESC, captureId DESC',
        userId,
      );
      return rows.map((row) => hydrate(row)!);
    },
    async put(record) {
      const result = await db.runAsync(
        `INSERT INTO local_field_outbox
          (captureId,userId,projectId,projectName,kind,createdAt,text,manifest,reportId,uploadedFiles,state,attemptCount,lastErrorKind,lastError,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(captureId) DO UPDATE SET
          userId=excluded.userId,projectId=excluded.projectId,projectName=excluded.projectName,kind=excluded.kind,
          createdAt=excluded.createdAt,text=excluded.text,manifest=excluded.manifest,reportId=excluded.reportId,
          uploadedFiles=excluded.uploadedFiles,state=excluded.state,attemptCount=excluded.attemptCount,
          lastErrorKind=excluded.lastErrorKind,lastError=excluded.lastError,updatedAt=excluded.updatedAt
         WHERE local_field_outbox.userId=excluded.userId
           AND local_field_outbox.projectId=excluded.projectId
           AND local_field_outbox.projectName=excluded.projectName
           AND local_field_outbox.kind=excluded.kind
           AND local_field_outbox.createdAt=excluded.createdAt
           AND local_field_outbox.text=excluded.text
           AND local_field_outbox.manifest=excluded.manifest
           AND (local_field_outbox.reportId IS NULL OR local_field_outbox.reportId=excluded.reportId)`,
        record.captureId,
        record.userId,
        record.projectId,
        record.projectName,
        record.kind,
        record.createdAt,
        record.text,
        JSON.stringify(record.manifest),
        record.reportId,
        JSON.stringify(record.uploadedFiles),
        record.state,
        record.attemptCount,
        record.lastErrorKind,
        record.lastError,
        record.updatedAt,
      );
      if (result.changes !== 1)
        throw new Error(
          'This capture identifier already belongs to different content.',
        );
    },
  };
}
