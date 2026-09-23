export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function withTimeout(fetcher: Fetcher, milliseconds = 10_000): Fetcher {
  return async (input, init) => {
    const controller = new AbortController();
    const signal =
      init?.signal ??
      (typeof input === 'object' && 'signal' in input
        ? input.signal
        : undefined);
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, milliseconds);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}
