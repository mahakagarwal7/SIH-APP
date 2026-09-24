const listeners = new Set<(userId: string) => void>();
const changes = new Set<(userId: string, captureId: string) => void>();

export function notifyOutboxChanged(userId: string, captureId: string) {
  for (const listener of changes) listener(userId, captureId);
}

export function subscribeOutboxChanges(
  listener: (userId: string, captureId: string) => void,
) {
  changes.add(listener);
  return () => {
    changes.delete(listener);
  };
}

export function notifyOutboxWork(userId: string) {
  for (const listener of listeners) listener(userId);
}

export function subscribeOutboxWork(listener: (userId: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
