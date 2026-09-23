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
      const response = await fetcher(input, {
        ...init,
        signal: controller.signal,
      });
      // Auth responses are buffered: keep cancellation active after headers arrive.
      // Reading a clone leaves the original body and response metadata intact for the SDK.
      await response.clone().arrayBuffer();
      return response;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}
