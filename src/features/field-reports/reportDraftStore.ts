import { withDraftMutation } from './draftMutations';
import { notifyOutboxWork } from './outboxEvents';

export const MAX_REPORT_TEXT = 10_000;
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 20_000_000;

export type SavedPhoto = {
  id: string;
  fileName: string;
  mimeType: 'image/jpeg';
  caption: string;
  byteLength: number;
  width: number;
  height: number;
};

export type ReportDraft = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  text: string;
  photos: SavedPhoto[];
  state: 'saving' | 'saved' | 'deleting';
};

export type PreparedDraftPhoto = { photo: SavedPhoto; bytes: Uint8Array };

export type ReportDraftIndex = {
  get(userId: string, id: string): Promise<ReportDraft | null>;
  list(userId: string): Promise<ReportDraft[]>;
  insert(draft: ReportDraft): Promise<void>;
  setState(
    userId: string,
    id: string,
    state: ReportDraft['state'],
  ): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
};

export type ReportDraftFiles = {
  write(
    draft: ReportDraft,
    photo: SavedPhoto,
    bytes: Uint8Array,
  ): Promise<void>;
  read(draft: ReportDraft, photo: SavedPhoto): Promise<Uint8Array>;
  size(draft: ReportDraft, photo: SavedPhoto): Promise<number | null>;
  uri(draft: ReportDraft, photo: SavedPhoto): string;
  remove(draft: ReportDraft, photo: SavedPhoto): Promise<void>;
};

export type LocalReportDraft = ReportDraft & {
  available: boolean;
  photoUris: string[];
};

function validatePhoto(photo: SavedPhoto) {
  if (!/^[a-zA-Z0-9-]+$/.test(photo.id))
    throw new Error('Invalid local photo identifier.');
  if (photo.mimeType !== 'image/jpeg' || !photo.fileName.endsWith('.jpg'))
    throw new Error('Photos must be saved as JPEG files.');
  if (photo.caption.length > 500)
    throw new Error('Photo captions must be 500 characters or fewer.');
  if (photo.byteLength < 1 || photo.byteLength > MAX_PHOTO_BYTES)
    throw new Error('Each photo must be 5 MB or smaller.');
  if (
    !Number.isInteger(photo.width) ||
    !Number.isInteger(photo.height) ||
    photo.width < 1 ||
    photo.height < 1 ||
    photo.width * photo.height > MAX_PHOTO_PIXELS
  )
    throw new Error('Photo dimensions are not supported.');
}

function validateDraft(draft: ReportDraft, prepared: PreparedDraftPhoto[]) {
  const text = draft.text.trim();
  if (!text && draft.photos.length === 0)
    throw new Error('Add report text or a photo before saving.');
  if (draft.text.length > MAX_REPORT_TEXT)
    throw new Error('Report text must be 10,000 characters or fewer.');
  if (draft.photos.length > MAX_PHOTOS)
    throw new Error('A report can include up to three photos.');
  if (
    new Set(draft.photos.map((photo) => photo.id)).size !== draft.photos.length
  )
    throw new Error('Each photo needs a unique identifier.');
  for (const photo of draft.photos) validatePhoto(photo);
  if (
    prepared.length !== draft.photos.length ||
    prepared.some(
      ({ photo, bytes }, position) =>
        photo.id !== draft.photos[position]?.id ||
        bytes.length !== photo.byteLength,
    )
  )
    throw new Error('The prepared photo data is incomplete.');
}

function sameDraft(left: ReportDraft, right: ReportDraft) {
  return (
    JSON.stringify({ ...left, state: 'saving' }) ===
    JSON.stringify({ ...right, state: 'saving' })
  );
}

// This service owns local data only. Upload and submission belong to the outbox slice.
export class ReportDraftStore {
  constructor(
    private index: ReportDraftIndex,
    private files: ReportDraftFiles,
    private beforeDiscard: (
      userId: string,
      id: string,
    ) => Promise<void> = async () => {},
  ) {}

  // Reject overlap instead of queueing a stale retry behind a completed discard.
  private async mutate(
    userId: string,
    id: string,
    action: () => Promise<void>,
  ) {
    return withDraftMutation(userId, id, action);
  }

  async list(userId: string): Promise<LocalReportDraft[]> {
    const rows = await this.index.list(userId);
    return Promise.all(
      rows.map(async (row) => {
        const sizes = await Promise.all(
          row.photos.map((photo) => this.files.size(row, photo)),
        );
        return {
          ...row,
          available:
            row.state === 'saved' &&
            sizes.every(
              (size, index) => size === row.photos[index]?.byteLength,
            ),
          photoUris: row.photos.map((photo) => this.files.uri(row, photo)),
        };
      }),
    );
  }

  async save(
    draft: ReportDraft,
    prepared: PreparedDraftPhoto[],
  ): Promise<void> {
    await this.mutate(draft.userId, draft.id, () =>
      this.persist(draft, prepared),
    );
    notifyOutboxWork(draft.userId);
  }

  // A combined evidence save already owns the shared capture mutation lock.
  async saveWithinMutation(
    draft: ReportDraft,
    prepared: PreparedDraftPhoto[],
  ): Promise<void> {
    await this.persist(draft, prepared);
  }

  private async persist(
    draft: ReportDraft,
    prepared: PreparedDraftPhoto[],
  ): Promise<void> {
    validateDraft(draft, prepared);
    const existing = await this.index.get(draft.userId, draft.id);
    if (existing?.state === 'deleting')
      throw new Error('This draft is being discarded.');
    if (existing && !sameDraft(existing, draft))
      throw new Error(
        'This draft identifier already belongs to different content.',
      );
    if (existing?.state === 'saved') {
      const complete = await Promise.all(
        existing.photos.map(
          async (photo) =>
            (await this.files.size(existing, photo)) === photo.byteLength,
        ),
      );
      if (!complete.every(Boolean))
        throw new Error('A saved photo is missing or incomplete.');
      return;
    }
    if (!existing) await this.index.insert({ ...draft, state: 'saving' });
    for (const { photo, bytes } of prepared)
      await this.files.write(draft, photo, bytes);
    for (const photo of draft.photos)
      if ((await this.files.size(draft, photo)) !== photo.byteLength)
        throw new Error('A photo could not be saved completely.');
    await this.index.setState(draft.userId, draft.id, 'saved');
  }

  async materialize(
    userId: string,
    id: string,
  ): Promise<{
    draft: ReportDraft;
    prepared: PreparedDraftPhoto[];
  }> {
    const draft = await this.index.get(userId, id);
    if (!draft || draft.state !== 'saved')
      throw new Error('This report draft is unavailable on this device.');
    const prepared: PreparedDraftPhoto[] = [];
    for (const photo of draft.photos) {
      if ((await this.files.size(draft, photo)) !== photo.byteLength)
        throw new Error('A saved photo is missing or incomplete.');
      const bytes = await this.files.read(draft, photo);
      if (bytes.length !== photo.byteLength)
        throw new Error('A saved photo is missing or incomplete.');
      prepared.push({ photo, bytes });
    }
    return { draft, prepared };
  }

  async discard(userId: string, id: string): Promise<void> {
    return this.mutate(userId, id, async () => {
      await this.beforeDiscard(userId, id);
      const draft = await this.index.get(userId, id);
      if (!draft)
        throw new Error('This draft is unavailable for this account.');
      await this.index.setState(userId, id, 'deleting');
      for (const photo of draft.photos) await this.files.remove(draft, photo);
      await this.index.remove(userId, id);
    });
  }
}
