import { withDraftMutation } from './draftMutations';
import { notifyOutboxWork } from './outboxEvents';

export type VoiceDraft = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  duration: number;
  sampleRate: number;
  byteLength: number;
  state: 'saving' | 'saved' | 'deleting';
};

export type DraftIndex = {
  get(userId: string, id: string): Promise<VoiceDraft | null>;
  list(userId: string): Promise<VoiceDraft[]>;
  insert(draft: VoiceDraft): Promise<void>;
  setState(
    userId: string,
    id: string,
    state: VoiceDraft['state'],
  ): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
};

export type DraftFiles = {
  write(draft: VoiceDraft, bytes: Uint8Array): Promise<void>;
  read(draft: VoiceDraft): Promise<Uint8Array>;
  size(draft: VoiceDraft): Promise<number | null>;
  remove(draft: VoiceDraft): Promise<void>;
  uri(draft: VoiceDraft): string;
};

export type LocalVoiceDraft = VoiceDraft & { available: boolean };

// Only local metadata and app-private files. This service never sends a report.
export class VoiceDraftStore {
  constructor(
    private index: DraftIndex,
    private files: DraftFiles,
    private beforeDiscard: (
      userId: string,
      id: string,
    ) => Promise<void> = async () => {},
  ) {}

  async list(userId: string): Promise<LocalVoiceDraft[]> {
    const rows = await this.index.list(userId);
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        available:
          row.state === 'saved' &&
          (await this.files.size(row)) === row.byteLength,
      })),
    );
  }

  async save(draft: VoiceDraft, bytes: Uint8Array): Promise<void> {
    await withDraftMutation(draft.userId, draft.id, () =>
      this.persist(draft, bytes),
    );
    notifyOutboxWork(draft.userId);
  }

  // A combined evidence save already owns the shared capture mutation lock.
  async saveWithinMutation(
    draft: VoiceDraft,
    bytes: Uint8Array,
  ): Promise<void> {
    await this.persist(draft, bytes);
  }

  private async persist(draft: VoiceDraft, bytes: Uint8Array): Promise<void> {
    if (bytes.length !== draft.byteLength)
      throw new Error('Incomplete recording.');
    const existing = await this.index.get(draft.userId, draft.id);
    if (existing?.state === 'deleting')
      throw new Error('This draft is being discarded.');
    if (existing?.state === 'saved') {
      if ((await this.files.size(existing)) !== existing.byteLength)
        throw new Error('The saved recording is missing or incomplete.');
      return;
    }
    if (!existing) await this.index.insert({ ...draft, state: 'saving' });
    await this.files.write(draft, bytes);
    if ((await this.files.size(draft)) !== draft.byteLength)
      throw new Error('The recording could not be saved completely.');
    await this.index.setState(draft.userId, draft.id, 'saved');
  }

  async playbackUri(userId: string, id: string): Promise<string> {
    const draft = await this.index.get(userId, id);
    if (
      !draft ||
      draft.state !== 'saved' ||
      (await this.files.size(draft)) !== draft.byteLength
    )
      throw new Error('This recording is unavailable on this device.');
    return this.files.uri(draft);
  }

  async recording(
    userId: string,
    id: string,
  ): Promise<{
    draft: VoiceDraft;
    bytes: Uint8Array;
  }> {
    const draft = await this.index.get(userId, id);
    if (
      !draft ||
      draft.state !== 'saved' ||
      (await this.files.size(draft)) !== draft.byteLength
    )
      throw new Error('This recording is unavailable on this device.');
    const bytes = await this.files.read(draft);
    if (bytes.length !== draft.byteLength)
      throw new Error('This recording is incomplete on this device.');
    return { draft, bytes };
  }

  async discard(userId: string, id: string): Promise<void> {
    return this.discardLocal(userId, id, true);
  }

  async discardAfterCancellation(userId: string, id: string): Promise<void> {
    return this.discardLocal(userId, id, false);
  }

  private async discardLocal(
    userId: string,
    id: string,
    checkOutbox: boolean,
  ): Promise<void> {
    return withDraftMutation(userId, id, async () => {
      if (checkOutbox) await this.beforeDiscard(userId, id);
      const draft = await this.index.get(userId, id);
      if (!draft)
        throw new Error('This draft is unavailable for this account.');
      // Keep a tombstone if file deletion fails, allowing an explicit retry.
      await this.index.setState(userId, id, 'deleting');
      await this.files.remove(draft);
      await this.index.remove(userId, id);
    });
  }
}
