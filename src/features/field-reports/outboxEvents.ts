const listeners = new Set<(userId: string) => void>();

export function notifyOutboxWork(userId: string) {
  for (const listener of listeners) listener(userId);
}

export function subscribeOutboxWork(listener: (userId: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
