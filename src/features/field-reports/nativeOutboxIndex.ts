import { openDatabaseAsync } from 'expo-sqlite';

import { createOutboxIndex } from './outboxIndex';

import type { OutboxIndex } from './outbox';

let index: Promise<OutboxIndex> | undefined;
export function getNativeOutboxIndex() {
  index ??= openDatabaseAsync('nirmaan-drafts.db')
    .then(createOutboxIndex)
    .catch((error) => {
      index = undefined;
      throw error;
    });
  return index;
}

// The draft store calls this while holding the same lock as preparation.
export async function assertLocalDraftCanBeDiscarded(
  userId: string,
  captureId: string,
) {
  if (await (await getNativeOutboxIndex()).get(userId, captureId))
    throw new Error(
      'This report has entered the outbox. Keep its device copy until confirmation is complete.',
    );
}
