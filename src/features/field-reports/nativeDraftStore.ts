import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';

import { createDraftIndex } from './draftIndex';
import { VoiceDraftStore } from './draftStore';

import type { VoiceDraft } from './draftStore';

function fileFor(draft: VoiceDraft) {
  if (![draft.userId, draft.id].every((value) => /^[a-zA-Z0-9-]+$/.test(value)))
    throw new Error('Invalid local recording identifier.');
  const directory = new Directory(Paths.document, 'voice-drafts', draft.userId);
  return { directory, file: new File(directory, `${draft.id}.wav`) };
}

let store: Promise<VoiceDraftStore> | undefined;
export function getVoiceDraftStore(): Promise<VoiceDraftStore> {
  store ??= openDatabaseAsync('nirmaan-drafts.db')
    .then(
      async (db) =>
        new VoiceDraftStore(await createDraftIndex(db), {
          async write(draft, bytes) {
            const { directory, file } = fileFor(draft);
            directory.create({ intermediates: true, idempotent: true });
            file.write(bytes);
          },
          async size(draft) {
            const { file } = fileFor(draft);
            return file.exists ? file.size : null;
          },
          async remove(draft) {
            const { file } = fileFor(draft);
            if (file.exists) file.delete();
          },
          uri: (draft) => fileFor(draft).file.uri,
        }),
    )
    .catch((error) => {
      store = undefined;
      throw error;
    });
  return store;
}
