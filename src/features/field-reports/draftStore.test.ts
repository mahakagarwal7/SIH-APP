import { VoiceDraftStore } from './draftStore';

import type { DraftFiles, DraftIndex, VoiceDraft } from './draftStore';

const draft: VoiceDraft = {
  id: 'draft',
  userId: 'alice',
  projectId: 'project',
  projectName: 'Project',
  createdAt: '2026-09-23T00:00:00Z',
  duration: 1,
  sampleRate: 16000,
  byteLength: 4,
  state: 'saving',
};
function setup() {
  const rows = new Map<string, VoiceDraft>();
  const files = new Map<string, Uint8Array>();
  const index: DraftIndex = {
    get: jest.fn(async (userId, id) =>
      rows.get(id)?.userId === userId ? rows.get(id)! : null,
    ),
    list: jest.fn(async (userId) =>
      [...rows.values()].filter((row) => row.userId === userId),
    ),
    insert: jest.fn(async (row) => {
      if (rows.has(row.id)) throw new Error('Duplicate');
      rows.set(row.id, { ...row });
    }),
    setState: jest.fn(async (userId, id, state) => {
      const row = rows.get(id);
      if (row?.userId === userId) row.state = state;
    }),
    remove: jest.fn(async (userId, id) => {
      if (rows.get(id)?.userId === userId) rows.delete(id);
    }),
  };
  const media: DraftFiles = {
    write: jest.fn(async (row, bytes) => {
      files.set(row.id, bytes.slice());
    }),
    size: jest.fn(async (row) => files.get(row.id)?.length ?? null),
    remove: jest.fn(async (row) => {
      files.delete(row.id);
    }),
    uri: (row) => `private/${row.userId}/${row.id}.wav`,
  };
  return {
    store: new VoiceDraftStore(index, media),
    index,
    media,
    rows,
    files,
  };
}
it('reports saved only after durable file and metadata succeed; retries the same id without duplicating', async () => {
  const { store, media, index } = setup();
  await store.save(draft, new Uint8Array(4));
  await store.save(draft, new Uint8Array(4));
  expect(await store.list('alice')).toEqual([
    { ...draft, state: 'saved', available: true },
  ]);
  expect(media.write).toHaveBeenCalledTimes(1);
  expect(index.insert).toHaveBeenCalledTimes(1);
});
it('retains a failed save as incomplete, supports retry, and never marks partial files saved', async () => {
  const { store, media } = setup();
  jest.mocked(media.write).mockRejectedValueOnce(new Error('Disk full'));
  await expect(store.save(draft, new Uint8Array(4))).rejects.toThrow(
    'Disk full',
  );
  expect((await store.list('alice'))[0]).toMatchObject({
    state: 'saving',
    available: false,
  });
  await store.save(draft, new Uint8Array(4));
  expect((await store.list('alice'))[0]?.available).toBe(true);
});
it('isolates listing, playback and discard by the signed-in owner', async () => {
  const { store, files } = setup();
  await store.save(draft, new Uint8Array(4));
  expect(await store.list('bob')).toEqual([]);
  await expect(store.playbackUri('bob', 'draft')).rejects.toThrow();
  await expect(store.discard('bob', 'draft')).rejects.toThrow();
  expect(files.size).toBe(1);
  expect(await store.playbackUri('alice', 'draft')).toContain(
    'alice/draft.wav',
  );
});
it('keeps missing files honest and resumes explicit discard after a file deletion failure', async () => {
  const { store, media, files, rows } = setup();
  await store.save(draft, new Uint8Array(4));
  files.clear();
  expect((await store.list('alice'))[0]?.available).toBe(false);
  await expect(store.playbackUri('alice', 'draft')).rejects.toThrow();
  jest.mocked(media.remove).mockRejectedValueOnce(new Error('Busy'));
  await expect(store.discard('alice', 'draft')).rejects.toThrow('Busy');
  expect(rows.get('draft')?.state).toBe('deleting');
  await store.discard('alice', 'draft');
  expect(await store.list('alice')).toEqual([]);
});
it('does not report success if metadata commit fails after the file write', async () => {
  const { store, index } = setup();
  jest.mocked(index.setState).mockRejectedValueOnce(new Error('Database full'));
  await expect(store.save(draft, new Uint8Array(4))).rejects.toThrow();
  expect((await store.list('alice'))[0]?.available).toBe(false);
  await store.save(draft, new Uint8Array(4));
  expect((await store.list('alice'))[0]?.available).toBe(true);
});
