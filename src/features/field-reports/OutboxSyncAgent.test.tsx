import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { syncNativeOutbox } from './nativeOutbox';
import { notifyOutboxWork } from './outboxEvents';
import { OutboxSyncAgent } from './OutboxSyncAgent.native';

import type { OutboxRecord } from './outbox';
import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./nativeOutbox', () => ({ syncNativeOutbox: jest.fn() }));
const originalState = AppState.currentState;
let client: QueryClient;
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: false,
  } as AuthViewState);
  jest.mocked(syncNativeOutbox).mockReset().mockResolvedValue([]);
});
afterEach(() => {
  client.clear();
  jest.useRealTimers();
  AppState.currentState = originalState;
});
function App() {
  return (
    <QueryClientProvider client={client}>
      <OutboxSyncAgent />
    </QueryClientProvider>
  );
}

it('wakes after idle when this account saves/enqueues work, but ignores other accounts', async () => {
  await render(<App />);
  expect(syncNativeOutbox).toHaveBeenCalledTimes(1);
  await act(() => notifyOutboxWork('bob'));
  expect(syncNativeOutbox).toHaveBeenCalledTimes(1);
  await act(() => notifyOutboxWork('alice'));
  expect(syncNativeOutbox).toHaveBeenCalledTimes(2);
});

it('retries a transient failure with backoff and keeps polling processing media', async () => {
  jest
    .mocked(syncNativeOutbox)
    .mockResolvedValueOnce([
      { state: 'failed', retryable: true },
    ] as OutboxRecord[])
    .mockResolvedValueOnce([
      { state: 'processing', retryable: true },
    ] as OutboxRecord[])
    .mockResolvedValue([]);
  await render(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(2);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(3);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(120000);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(3);
});

it('does not schedule terminal failures and unsubscribes on unmount', async () => {
  jest
    .mocked(syncNativeOutbox)
    .mockResolvedValue([
      { state: 'failed', retryable: false },
    ] as OutboxRecord[]);
  const view = await render(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(120000);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(1);
  await view.unmount();
  await act(() => notifyOutboxWork('alice'));
  expect(syncNativeOutbox).toHaveBeenCalledTimes(1);
});

it('retains work notifications that arrive during a pass without overlapping passes', async () => {
  let finish!: (rows: OutboxRecord[]) => void;
  jest.mocked(syncNativeOutbox).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<App />);
  await act(() => notifyOutboxWork('alice'));
  expect(syncNativeOutbox).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish([]);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(2);
});

it('restarts processing polls after an explicit sync finishes while the coordinator is idle', async () => {
  await render(<App />);
  jest
    .mocked(syncNativeOutbox)
    .mockResolvedValueOnce([
      { state: 'processing', retryable: true },
    ] as OutboxRecord[]);
  await act(() => notifyOutboxWork('alice'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(syncNativeOutbox).toHaveBeenCalledTimes(3);
});

it('does not start a pass for a new draft while offline', async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: true,
  } as AuthViewState);
  await render(<App />);
  await act(() => notifyOutboxWork('alice'));
  expect(syncNativeOutbox).not.toHaveBeenCalled();
});
