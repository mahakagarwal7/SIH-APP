import { ReportDraftStore } from './reportDraftStore';

import type {
  LocalReportDraft,
  ReportDraft,
  ReportDraftFiles,
  ReportDraftIndex,
  SavedPhoto,
} from './reportDraftStore';

const photo: SavedPhoto = {
  id: 'photo-one',
  fileName: 'photo-one.jpg',
  mimeType: 'image/jpeg',
  caption: 'North pipe rack',
  byteLength: 4,
  width: 100,
  height: 80,
};
const draft: ReportDraft = {
  id: 'draft-one',
  userId: 'alice',
  projectId: 'project-one',
  projectName: 'Site project',
  createdAt: '2026-09-24T00:00:00Z',
  text: 'Installed two supports; welding remains.',
  photos: [photo],
  state: 'saving',
};

function setup() {
  const rows = new Map<string, ReportDraft>();
  const files = new Map<string, Uint8Array>();
  const index: ReportDraftIndex = {
    get: jest.fn(async (userId, id) =>
      rows.get(id)?.userId === userId ? rows.get(id)! : null,
    ),
    list: jest.fn(async (userId) =>
      [...rows.values()].filter((row) => row.userId === userId),
    ),
    insert: jest.fn(async (row) => {
      rows.set(row.id, { ...row });
    }),
    setState: jest.fn(async (userId, id, state) => {
      const row = rows.get(id);
      if (!row || row.userId !== userId) throw new Error('Missing draft');
      row.state = state;
    }),
    remove: jest.fn(async (userId, id) => {
      if (rows.get(id)?.userId === userId) rows.delete(id);
    }),
  };
  const media: ReportDraftFiles = {
    write: jest.fn(async (row, saved, bytes) => {
      files.set(`${row.id}:${saved.id}`, bytes.slice());
    }),
    size: jest.fn(
      async (row, saved) => files.get(`${row.id}:${saved.id}`)?.length ?? null,
    ),
    uri: (row, saved) => `private/${row.userId}/${row.id}/${saved.id}.jpg`,
    remove: jest.fn(async (row, saved) => {
      files.delete(`${row.id}:${saved.id}`);
    }),
  };
  return {
    store: new ReportDraftStore(index, media),
    rows,
    files,
    index,
    media,
  };
}

it('marks a text/photo report saved only after every private file is complete', async () => {
  const { store, index } = setup();
  await store.save(draft, [{ photo, bytes: new Uint8Array(4) }]);
  expect(await store.list('alice')).toEqual<LocalReportDraft[]>([
    {
      ...draft,
      state: 'saved',
      available: true,
      photoUris: ['private/alice/draft-one/photo-one.jpg'],
    },
  ]);
  expect(index.setState).toHaveBeenCalledWith('alice', 'draft-one', 'saved');
});

it('keeps failed saves incomplete and retries with the same draft identity', async () => {
  const { store, media } = setup();
  jest.mocked(media.write).mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    store.save(draft, [{ photo, bytes: new Uint8Array(4) }]),
  ).rejects.toThrow('Disk full');
  expect((await store.list('alice'))[0]).toMatchObject({
    id: 'draft-one',
    state: 'saving',
    available: false,
  });
  await store.save(draft, [{ photo, bytes: new Uint8Array(4) }]);
  expect((await store.list('alice'))[0]?.available).toBe(true);
});

it('supports text-only drafts and isolates listing and discard by account', async () => {
  const { store, rows } = setup();
  const textOnly = { ...draft, photos: [] };
  await store.save(textOnly, []);
  expect((await store.list('alice'))[0]?.available).toBe(true);
  expect(await store.list('bob')).toEqual([]);
  await expect(store.discard('bob', draft.id)).rejects.toThrow();
  expect(rows.has(draft.id)).toBe(true);
  await store.discard('alice', draft.id);
  expect(rows.has(draft.id)).toBe(false);
});

it('rejects empty, oversized and mismatched drafts before persisting them', async () => {
  const { store, rows } = setup();
  await expect(
    store.save({ ...draft, text: ' ', photos: [] }, []),
  ).rejects.toThrow('Add report text or a photo');
  await expect(
    store.save({ ...draft, text: 'x'.repeat(10001) }, [
      { photo, bytes: new Uint8Array(4) },
    ]),
  ).rejects.toThrow('10,000');
  await expect(
    store.save(draft, [{ photo, bytes: new Uint8Array(3) }]),
  ).rejects.toThrow('incomplete');
  expect(rows.size).toBe(0);
});

it('retains a deletion tombstone when a private file cannot be removed', async () => {
  const { store, media, rows } = setup();
  await store.save(draft, [{ photo, bytes: new Uint8Array(4) }]);
  jest.mocked(media.remove).mockRejectedValueOnce(new Error('Busy'));
  await expect(store.discard('alice', draft.id)).rejects.toThrow('Busy');
  expect(rows.get(draft.id)?.state).toBe('deleting');
  await store.discard('alice', draft.id);
  expect(await store.list('alice')).toEqual([]);
});
