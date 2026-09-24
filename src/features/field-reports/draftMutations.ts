const mutations = new Set<string>();

export class DraftBusyError extends Error {
  constructor() {
    super(
      'This draft is busy. Wait for its save, preparation or discard to finish.',
    );
  }
}

// Reject stale operations instead of queueing them behind a completed deletion.
export async function withDraftMutation<T>(
  userId: string,
  captureId: string,
  action: () => Promise<T>,
): Promise<T> {
  const key = JSON.stringify([userId, captureId]);
  if (mutations.has(key)) throw new DraftBusyError();
  mutations.add(key);
  try {
    return await action();
  } finally {
    mutations.delete(key);
  }
}
