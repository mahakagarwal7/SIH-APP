import { openDatabaseAsync } from 'expo-sqlite';

import { createOutboxIndex } from './outboxIndex';

import type { OutboxIndex, OutboxRecord } from './outbox';

export const queuedDraftDiscardExplanation =
  'This report has entered the outbox. Its device copy is required while it is queued or uploading. Discard becomes available after delivery is confirmed.';

export function localDraftDiscardBlocker(record: OutboxRecord | null) {
  if (
    !record ||
    (record.submissionState === 'submitted' &&
      record.submittedAt &&
      record.confirmedPayload &&
      record.reportId)
  )
    return null;
  return queuedDraftDiscardExplanation;
}

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
  const record = await (await getNativeOutboxIndex()).get(userId, captureId);
  const blocker = localDraftDiscardBlocker(record);
  if (blocker) throw new Error(blocker);
}
