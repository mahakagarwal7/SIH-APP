import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';

import { assertLocalDraftCanBeDiscarded } from './nativeOutboxIndex';
import { createReportDraftIndex } from './reportDraftIndex';
import { ReportDraftStore } from './reportDraftStore';

import type { ReportDraft, SavedPhoto } from './reportDraftStore';

function privatePhoto(draft: ReportDraft, photo: SavedPhoto) {
  if (
    ![draft.userId, draft.id, photo.id].every((value) =>
      /^[a-zA-Z0-9-]+$/.test(value),
    )
  )
    throw new Error('Invalid local report identifier.');
  const directory = new Directory(
    Paths.document,
    'report-drafts',
    draft.userId,
    draft.id,
  );
  return { directory, file: new File(directory, `${photo.id}.jpg`) };
}

let store: Promise<ReportDraftStore> | undefined;
export function getReportDraftStore(): Promise<ReportDraftStore> {
  store ??= openDatabaseAsync('nirmaan-drafts.db')
    .then(
      async (db) =>
        new ReportDraftStore(
          await createReportDraftIndex(db),
          {
            async write(draft, photo, bytes) {
              const { directory, file } = privatePhoto(draft, photo);
              directory.create({ intermediates: true, idempotent: true });
              file.write(bytes);
            },
            async read(draft, photo) {
              return privatePhoto(draft, photo).file.bytes();
            },
            async size(draft, photo) {
              const { file } = privatePhoto(draft, photo);
              return file.exists ? file.size : null;
            },
            uri: (draft, photo) => privatePhoto(draft, photo).file.uri,
            async remove(draft, photo) {
              const { file } = privatePhoto(draft, photo);
              if (file.exists) file.delete();
            },
          },
          assertLocalDraftCanBeDiscarded,
        ),
    )
    .catch((error) => {
      store = undefined;
      throw error;
    });
  return store;
}
