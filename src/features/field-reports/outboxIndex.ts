import { normalizeConfirmation } from './confirmation';
import { validateManifest } from './outbox';

import type {
  CaptureManifest,
  ConfirmedPayload,
  OutboxIndex,
  OutboxRecord,
} from './outbox';
import type { SQLiteDatabase } from 'expo-sqlite';

type StoredOutbox = Omit<
  OutboxRecord,
  | 'manifest'
  | 'uploadedFiles'
  | 'confirmedPayload'
  | 'evidenceReleased'
  | 'retryable'
  | 'submissionRejected'
> & {
  manifest: string;
  uploadedFiles: string;
  confirmedPayload: string | null;
  evidenceReleased: number;
  retryable: number;
  submissionRejected: number;
};

function hydrate(row: StoredOutbox | null): OutboxRecord | null {
  if (!row) return null;
  const manifest = JSON.parse(row.manifest) as CaptureManifest;
  const uploadedFiles = JSON.parse(row.uploadedFiles) as string[];
  const confirmedPayload = row.confirmedPayload
    ? normalizeConfirmation(
        JSON.parse(row.confirmedPayload) as ConfirmedPayload,
      )
    : null;
  if (!Array.isArray(manifest.files) || !Array.isArray(uploadedFiles))
    throw new Error('Invalid local outbox metadata.');
  validateManifest(manifest);
  const declared = new Set(manifest.files.map((file) => file.id));
  if (
    new Set(uploadedFiles).size !== uploadedFiles.length ||
    uploadedFiles.some((id) => !declared.has(id))
  )
    throw new Error('Invalid local upload progress.');
  if (
    (row.submissionState === 'unconfirmed' && confirmedPayload !== null) ||
    (row.submissionState !== 'unconfirmed' && confirmedPayload === null) ||
    (row.submissionState === 'submitted' && !row.submittedAt) ||
    (row.evidenceReleased === 1 && row.submissionState !== 'submitted') ||
    (row.submissionRejected === 1 && row.submissionState !== 'pending')
  )
    throw new Error('Invalid local confirmation state.');
  return {
    ...row,
    manifest,
    uploadedFiles,
    confirmedPayload,
    evidenceReleased: row.evidenceReleased === 1,
    retryable: row.retryable === 1,
    submissionRejected: row.submissionRejected === 1,
  };
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
      originalTranscript TEXT,
      confirmedPayload TEXT,
      confirmedActivityLabel TEXT,
      submissionRejected INTEGER NOT NULL DEFAULT 0 CHECK(submissionRejected IN (0,1)),
      submissionState TEXT NOT NULL DEFAULT 'unconfirmed' CHECK(submissionState IN ('unconfirmed','pending','submitted')),
      submittedAt TEXT,
      evidenceReleased INTEGER NOT NULL DEFAULT 0 CHECK(evidenceReleased IN (0,1)),
      state TEXT NOT NULL CHECK(state IN ('queued','reserving','uploading','finalizing','processing','needs_confirmation','paused','failed')),
      attemptCount INTEGER NOT NULL,
      lastErrorKind TEXT CHECK(lastErrorKind IS NULL OR lastErrorKind IN ('auth','access','local','network','server')),
      lastError TEXT,
      updatedAt TEXT NOT NULL,
      retryable INTEGER NOT NULL DEFAULT 1 CHECK(retryable IN (0,1))
    );
    CREATE INDEX IF NOT EXISTS local_outbox_owner ON local_field_outbox(userId, createdAt);`);
  const columns = new Set(
    (
      await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(local_field_outbox)',
      )
    ).map((column) => column.name),
  );
  if (!columns.has('originalTranscript'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN originalTranscript TEXT',
    );
  if (!columns.has('confirmedActivityLabel'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN confirmedActivityLabel TEXT',
    );
  if (!columns.has('submissionRejected'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN submissionRejected INTEGER NOT NULL DEFAULT 0 CHECK(submissionRejected IN (0,1))',
    );
  if (!columns.has('retryable'))
    await db.execAsync(`ALTER TABLE local_field_outbox ADD COLUMN retryable INTEGER NOT NULL DEFAULT 1 CHECK(retryable IN (0,1));
      UPDATE local_field_outbox SET retryable=0 WHERE lastErrorKind IN ('auth','access','local');`);
  if (!columns.has('confirmedPayload'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN confirmedPayload TEXT',
    );
  if (!columns.has('submissionState'))
    await db.execAsync(
      "ALTER TABLE local_field_outbox ADD COLUMN submissionState TEXT NOT NULL DEFAULT 'unconfirmed' CHECK(submissionState IN ('unconfirmed','pending','submitted'))",
    );
  if (!columns.has('submittedAt'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN submittedAt TEXT',
    );
  if (!columns.has('evidenceReleased'))
    await db.execAsync(
      'ALTER TABLE local_field_outbox ADD COLUMN evidenceReleased INTEGER NOT NULL DEFAULT 0 CHECK(evidenceReleased IN (0,1))',
    );
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
          (captureId,userId,projectId,projectName,kind,createdAt,text,manifest,reportId,uploadedFiles,originalTranscript,confirmedPayload,submissionState,submittedAt,evidenceReleased,state,attemptCount,lastErrorKind,lastError,updatedAt,retryable,submissionRejected,confirmedActivityLabel)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(captureId) DO UPDATE SET
          userId=excluded.userId,projectId=excluded.projectId,projectName=excluded.projectName,kind=excluded.kind,
          createdAt=excluded.createdAt,text=excluded.text,manifest=excluded.manifest,reportId=excluded.reportId,
          uploadedFiles=excluded.uploadedFiles,originalTranscript=excluded.originalTranscript,
          confirmedPayload=excluded.confirmedPayload,submissionState=excluded.submissionState,
          submittedAt=excluded.submittedAt,evidenceReleased=excluded.evidenceReleased,
          state=excluded.state,attemptCount=excluded.attemptCount,
          lastErrorKind=excluded.lastErrorKind,lastError=excluded.lastError,updatedAt=excluded.updatedAt,
          retryable=excluded.retryable,submissionRejected=excluded.submissionRejected,confirmedActivityLabel=excluded.confirmedActivityLabel
         WHERE local_field_outbox.userId=excluded.userId
           AND local_field_outbox.projectId=excluded.projectId
           AND local_field_outbox.projectName=excluded.projectName
           AND local_field_outbox.kind=excluded.kind
           AND local_field_outbox.createdAt=excluded.createdAt
           AND local_field_outbox.text=excluded.text
           AND local_field_outbox.manifest=excluded.manifest
           AND (local_field_outbox.reportId IS NULL OR local_field_outbox.reportId=excluded.reportId)
           AND (local_field_outbox.originalTranscript IS NULL OR local_field_outbox.originalTranscript=excluded.originalTranscript)
           AND (local_field_outbox.confirmedPayload IS NULL OR local_field_outbox.confirmedPayload=excluded.confirmedPayload
             OR (local_field_outbox.submissionRejected=1 AND excluded.submissionRejected=0
               AND local_field_outbox.submissionState='pending' AND excluded.submissionState='pending'
               AND local_field_outbox.submittedAt IS NULL AND excluded.submittedAt IS NULL))
           AND (local_field_outbox.submittedAt IS NULL OR local_field_outbox.submittedAt=excluded.submittedAt)
           AND (local_field_outbox.submissionState=excluded.submissionState
             OR (local_field_outbox.submissionState='unconfirmed' AND excluded.submissionState='pending')
             OR (local_field_outbox.submissionState='pending' AND excluded.submissionState='submitted'))
           AND local_field_outbox.evidenceReleased<=excluded.evidenceReleased`,
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
        record.originalTranscript,
        record.confirmedPayload
          ? JSON.stringify(record.confirmedPayload)
          : null,
        record.submissionState,
        record.submittedAt,
        record.evidenceReleased ? 1 : 0,
        record.state,
        record.attemptCount,
        record.lastErrorKind,
        record.lastError,
        record.updatedAt,
        record.retryable ? 1 : 0,
        record.submissionRejected ? 1 : 0,
        record.confirmedActivityLabel,
      );
      if (result.changes !== 1)
        throw new Error(
          'This capture identifier already belongs to different content.',
        );
    },
  };
}
