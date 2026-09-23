import { withTimeout } from './request';

import type { Fetcher } from './request';

describe('bounded auth requests', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('aborts an unresponsive request', async () => {
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      );
    const pending = withTimeout(
      fetcher,
      100,
    )('https://example.supabase.co/auth/v1/token');
    const check = expect(pending).rejects.toThrow('aborted');
    await jest.advanceTimersByTimeAsync(101);
    await check;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves caller cancellation and removes the deadline after success', async () => {
    const controller = new AbortController();
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockResolvedValue(new Response('{}'));
    await withTimeout(fetcher)('https://example.supabase.co', {
      signal: controller.signal,
    });
    expect(jest.getTimerCount()).toBe(0);
    controller.abort();
  });

  it('forwards an abort during the request and clears its deadline', async () => {
    const controller = new AbortController();
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('caller aborted')),
            );
          }),
      );
    const pending = withTimeout(fetcher)('https://example.supabase.co', {
      signal: controller.signal,
    });
    const check = expect(pending).rejects.toThrow('caller aborted');
    controller.abort();
    await check;
    expect(jest.getTimerCount()).toBe(0);
  });
});
