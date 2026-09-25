export type CaptureKind = 'voice' | 'report';
export type OutboxState =
  | 'queued'
  | 'reserving'
  | 'uploading'
  | 'finalizing'
  | 'processing'
  | 'needs_confirmation'
  | 'paused'
  | 'failed';
export type OutboxErrorKind =
  'auth' | 'access' | 'local' | 'network' | 'server';

export type CaptureFile = {
  id: string;
  name: string;
  kind: 'audio' | 'photo';
  mime: 'audio/wav' | 'image/jpeg';
  bytes: number;
  sha256: string;
  caption: string;
};

export type CaptureManifest = {
  captureId: string;
  language: 'en' | 'hi' | 'auto';
  files: CaptureFile[];
};

export type ConfirmedPayload = {
  text: string;
  workDate: string | null;
  activityId: string | null;
};
export type SubmissionState = 'unconfirmed' | 'pending' | 'submitted';

export type OutboxRecord = {
  captureId: string;
  userId: string;
  projectId: string;
  projectName: string;
  kind: CaptureKind;
  createdAt: string;
  text: string;
  manifest: CaptureManifest;
  reportId: string | null;
  uploadedFiles: string[];
  originalTranscript: string | null;
  sendRequested?: boolean;
  requestedWorkDate?: string | null;
  cancelRequested?: boolean;
  confirmedPayload: ConfirmedPayload | null;
  confirmedActivityLabel: string | null;
  submissionRejected: boolean;
  submissionState: SubmissionState;
  submittedAt: string | null;
  evidenceReleased: boolean;
  state: OutboxState;
  attemptCount: number;
  lastErrorKind: OutboxErrorKind | null;
  lastError: string | null;
  retryable: boolean;
  updatedAt: string;
};

export type OutboxIndex = {
  get(userId: string, captureId: string): Promise<OutboxRecord | null>;
  list(userId: string): Promise<OutboxRecord[]>;
  put(record: OutboxRecord): Promise<void>;
  remove(userId: string, captureId: string): Promise<void>;
};

export type OutboxFileReader = {
  read(record: OutboxRecord, file: CaptureFile): Promise<Uint8Array>;
};

export type RemoteMediaState =
  | { status: 'processing' }
  | { status: 'ready'; originalTranscript: string | null }
  | { status: 'retryable'; message: string }
  | { status: 'failed'; message: string };

export type OutboxTransport = {
  ensureAccess(record: OutboxRecord): Promise<void>;
  reserve(record: OutboxRecord): Promise<string>;
  upload(path: string, file: CaptureFile, bytes: Uint8Array): Promise<void>;
  finalize(reportId: string): Promise<void>;
  inspect(reportId: string): Promise<RemoteMediaState>;
  submit(reportId: string, payload: ConfirmedPayload): Promise<string>;
  discard(reportId: string): Promise<void>;
};

export class OutboxSyncError extends Error {
  constructor(
    message: string,
    public readonly kind: OutboxErrorKind,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

// This RPC error is emitted only after checking submitted-report replay.
export class SubmissionRejectedError extends OutboxSyncError {
  constructor() {
    super(
      'The selected activity is no longer available. Check the report and choose another activity or leave it unselected.',
      'access',
      false,
    );
  }
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateManifest(manifest: CaptureManifest) {
  if (!uuid.test(manifest.captureId))
    throw new OutboxSyncError(
      'Invalid local capture identifier.',
      'local',
      false,
    );
  if (manifest.files.length > 4)
    throw new OutboxSyncError('Too many local media files.', 'local', false);
  if (
    manifest.files.filter((file) => file.kind === 'audio').length > 1 ||
    manifest.files.filter((file) => file.kind === 'photo').length > 3 ||
    new Set(manifest.files.map((file) => file.id)).size !==
      manifest.files.length
  )
    throw new OutboxSyncError('Invalid local media manifest.', 'local', false);
  for (const file of manifest.files) {
    if (
      !uuid.test(file.id) ||
      !file.name ||
      file.name.length > 120 ||
      /[\\/]/.test(file.name) ||
      file.bytes < 1 ||
      file.bytes > 5 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      file.caption.length > 500 ||
      (file.kind === 'audio' && file.mime !== 'audio/wav') ||
      (file.kind === 'photo' && file.mime !== 'image/jpeg')
    )
      throw new OutboxSyncError(
        'Invalid local media declaration.',
        'local',
        false,
      );
  }
}

export function sameFrozenCapture(left: OutboxRecord, right: OutboxRecord) {
  return (
    left.captureId === right.captureId &&
    left.userId === right.userId &&
    left.projectId === right.projectId &&
    left.projectName === right.projectName &&
    left.kind === right.kind &&
    left.createdAt === right.createdAt &&
    left.text === right.text &&
    JSON.stringify(left.manifest) === JSON.stringify(right.manifest)
  );
}
