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

  it('waits for the response body and leaves the original response readable', async () => {
    const response = new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
    const body = new Response('');
    jest
      .spyOn(body, 'arrayBuffer')
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(new ArrayBuffer(0)), 50),
          ),
      );
    jest.spyOn(response, 'clone').mockReturnValue(body);
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockResolvedValue(response);
    let settled = false;
    const pending = withTimeout(
      fetcher,
      100,
    )('https://example.supabase.co').then((result) => {
      settled = true;
      return result;
    });
    await jest.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(result).toBe(response);
    expect(result.status).toBe(201);
    expect(result.headers.get('content-type')).toBe('application/json');
    expect(await result.json()).toEqual({ ok: true });
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['deadline', 'caller'] as const)(
    'aborts a stalled body after headers arrive on %s cancellation',
    async (cancellation) => {
      const caller = new AbortController();
      const fetcher = jest
        .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
        .mockImplementation(async (_input, init) => {
          const response = new Response('');
          const body = new Response('');
          jest.spyOn(body, 'arrayBuffer').mockImplementation(
            () =>
              new Promise((_resolve, reject) => {
                init?.signal?.addEventListener(
                  'abort',
                  () => reject(new Error('body aborted')),
                  { once: true },
                );
              }),
          );
          jest.spyOn(response, 'clone').mockReturnValue(body);
          return response;
        });
      const result = withTimeout(fetcher, 100)('https://example.supabase.co', {
        signal: caller.signal,
      }).then(
        () => null,
        (error: unknown) => error,
      );
      await jest.advanceTimersByTimeAsync(1);
      if (cancellation === 'caller') caller.abort();
      else await jest.advanceTimersByTimeAsync(100);
      expect(await result).toEqual(new Error('body aborted'));
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
