import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
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

import type { RemoteReport } from './myReportsService';
import type { OutboxRecord } from './outbox';
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
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: mockPush }),
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
  jest.mocked(prepareLocalOutbox).mockReset().mockResolvedValue({
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
  expect(prepareLocalOutbox).not.toHaveBeenCalled();
});

it('shows active background delivery as a distinct Uploading chip', async () => {
  const uploading: OutboxRecord = {
    captureId: '10000000-0000-4000-8000-000000000001',
    userId: 'alice',
    projectId: '30000000-0000-4000-8000-000000000003',
    projectName: 'Site project',
    kind: 'voice',
    createdAt: '2026-09-24T00:00:00Z',
    text: 'Installed two supports.',
    manifest: {
      captureId: '10000000-0000-4000-8000-000000000001',
      language: 'auto',
      files: [
        {
          id: '20000000-0000-4000-8000-000000000002',
          name: 'report.wav',
          kind: 'audio',
          mime: 'audio/wav',
          bytes: 3,
          sha256: 'a'.repeat(64),
          caption: '',
        },
        {
          id: '20000000-0000-4000-8000-000000000003',
          name: 'evidence.jpg',
          kind: 'photo',
          mime: 'image/jpeg',
          bytes: 3,
          sha256: 'b'.repeat(64),
          caption: 'Installed support',
        },
      ],
    },
    reportId: null,
    uploadedFiles: [],
    originalTranscript: 'Voice progress update.',
    sendRequested: false,
    cancelRequested: false,
    confirmedPayload: null,
    confirmedActivityLabel: null,
    submissionRejected: false,
    submissionState: 'unconfirmed',
    submittedAt: null,
    evidenceReleased: false,
    state: 'uploading',
    attemptCount: 1,
    lastErrorKind: null,
    lastError: null,
    retryable: true,
    updatedAt: '2026-09-24T00:00:01Z',
  };
  jest
    .mocked(getVoiceDraftStore)
    .mockResolvedValue({ list: async () => [] } as never);
  jest
    .mocked(getNativeOutbox)
    .mockResolvedValue({ list: async () => [uploading] } as never);
  await render(<App />);
  expect(
    await screen.findByLabelText('Upload status: Uploading'),
  ).toBeVisible();
  expect(screen.getByText('Voice + text + photo · 2 files')).toBeVisible();
  expect(
    screen.getByText(
      'Saved on device. Upload continues in the background and resumes after reconnecting.',
    ),
  ).toBeVisible();
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

it('shows a retryable server error without mislabeling it as an empty report list', async () => {
  jest
    .mocked(getVoiceDraftStore)
    .mockResolvedValue({ list: async () => [] } as never);
  jest
    .mocked(getReportDraftStore)
    .mockResolvedValue({ list: async () => [] } as never);
  jest
    .mocked(getNativeOutbox)
    .mockResolvedValue({ list: async () => [] } as never);
  jest.mocked(loadRemoteReports).mockRejectedValue(new Error('RLS denied'));
  await render(<App />);
  expect(
    await screen.findByText(/Could not refresh production status/),
  ).toBeVisible();
  expect(screen.queryByText('No reports saved or submitted yet.')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Retry server status' }),
  );
  await waitFor(() => expect(loadRemoteReports).toHaveBeenCalledTimes(2));
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

it('re-enables Sync now when a pass finishes after the tab loses focus', async () => {
  let finish!: () => void;
  jest.mocked(syncNativeOutbox).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = () => resolve([]);
    }),
  );
  await render(<App />);
  const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
  let blur: ReturnType<typeof focus>;
  await act(() => {
    blur = focus();
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  await act(() => {
    if (typeof blur === 'function') blur();
  });
  await act(async () => {
    finish();
  });
  await act(() => {
    focus();
  });
  expect(await screen.findByRole('button', { name: 'Sync now' })).toBeEnabled();
});

it('labels unqueried server attachments as unavailable instead of zero files', async () => {
  jest
    .mocked(getVoiceDraftStore)
    .mockResolvedValue({ list: async () => [] } as never);
  jest.mocked(loadRemoteReports).mockResolvedValue([
    {
      id: 'report',
      project_id: 'project',
      author_id: 'alice',
      capture_id: 'capture',
      current_version: 1,
      lifecycle: 'submitted',
      received_at: '2026-09-24T00:00:00Z',
      source_kind: 'voice',
      claims: [],
      jobs: [],
    },
  ]);
  await render(<App />);
  expect(await screen.findByText(/Attachment count unavailable/)).toBeVisible();
  expect(screen.queryByText(/0 files/)).toBeNull();
});

it('shows server processing as distinct from planner review', async () => {
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    list: async () => [],
  } as never);
  jest.mocked(loadRemoteReports).mockResolvedValue([
    {
      id: '40000000-0000-4000-8000-000000000004',
      project_id: '30000000-0000-4000-8000-000000000003',
      author_id: 'alice',
      capture_id: '10000000-0000-4000-8000-000000000001',
      current_version: 1,
      lifecycle: 'submitted',
      received_at: '2026-09-24T00:00:00Z',
      source_kind: 'text',
      claims: [],
      jobs: [
        {
          id: '50000000-0000-4000-8000-000000000005',
          report_id: '40000000-0000-4000-8000-000000000004',
          report_version: 1,
          status: 'running',
          attempts: 1,
          error_code: null,
          created_at: '2026-09-24T00:00:01Z',
        },
      ],
    } as RemoteReport,
  ]);
  await render(<App />);
  expect(await screen.findByText('Processing report')).toBeVisible();
  expect(
    screen.getByText(
      'The current report version is queued or still processing.',
    ),
  ).toBeVisible();
  expect(screen.queryByText('Awaiting review')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Open report and questions' }),
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/field-report/[reportId]',
    params: { reportId: '40000000-0000-4000-8000-000000000004' },
  });
});
