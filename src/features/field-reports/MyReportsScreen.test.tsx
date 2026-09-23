import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { MyReportsScreen } from './MyReportsScreen.native';
import { loadRemoteReports } from './myReportsService';
import { getVoiceDraftStore } from './nativeDraftStore';
import {
  getNativeOutbox,
  prepareLocalOutbox,
  syncNativeOutbox,
} from './nativeOutbox';
import { getReportDraftStore } from './nativeReportDraftStore';

import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./nativeDraftStore', () => ({ getVoiceDraftStore: jest.fn() }));
jest.mock('./nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));
jest.mock('./nativeOutbox', () => ({
  getNativeOutbox: jest.fn(),
  prepareLocalOutbox: jest.fn(),
  syncNativeOutbox: jest.fn(),
}));
jest.mock('./myReportsService', () => {
  const actual =
    jest.requireActual<typeof import('./myReportsService')>(
      './myReportsService',
    );
  return {
    ...actual,
    getReportsClient: jest.fn(() => ({})),
    loadRemoteReports: jest.fn(),
  };
});
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));

const originalAppState = AppState.currentState;

function App() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <MyReportsScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  AppState.currentState = 'active';
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: false,
  } as AuthViewState);
  jest.mocked(prepareLocalOutbox).mockResolvedValue({
    enqueued: 0,
    unavailable: 0,
  });
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    list: async () => [
      {
        id: 'local-voice',
        userId: 'alice',
        projectId: 'project',
        projectName: 'Site project',
        createdAt: '2026-09-24T00:00:00Z',
        duration: 2,
        sampleRate: 16_000,
        byteLength: 3,
        state: 'saved',
        available: true,
      },
    ],
  } as never);
  jest
    .mocked(getReportDraftStore)
    .mockResolvedValue({ list: async () => [] } as never);
  jest
    .mocked(getNativeOutbox)
    .mockResolvedValue({ list: async () => [] } as never);
  jest.mocked(syncNativeOutbox).mockResolvedValue([]);
  jest.mocked(loadRemoteReports).mockResolvedValue([]);
});

afterAll(() => {
  AppState.currentState = originalAppState;
});

it('shows a device-saved report without claiming it reached review', async () => {
  await render(<App />);
  expect(await screen.findByText('Saved on device')).toBeVisible();
  expect(screen.getByText('Waiting to sync.')).toBeVisible();
  expect(screen.queryByText('Awaiting review')).toBeNull();
});

it('keeps sync disabled offline while local reports remain visible', async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: true,
  } as AuthViewState);
  await render(<App />);
  expect(await screen.findByText('Saved on device')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
  expect(loadRemoteReports).not.toHaveBeenCalled();
});

it('manually retries paused work and reports completion without claiming submission', async () => {
  await render(<App />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Sync now' }),
  );
  expect(syncNativeOutbox).toHaveBeenCalledWith('alice', {
    includePaused: true,
  });
  expect(
    await screen.findByText(
      'Sync pass finished. Delivery status will update while the app remains open.',
    ),
  ).toBeVisible();
  expect(screen.queryByText('Sent for review')).toBeNull();
});
