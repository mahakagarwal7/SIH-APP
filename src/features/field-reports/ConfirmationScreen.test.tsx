import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { ConfirmationScreen } from './ConfirmationScreen.native';
import { loadConfirmationActivities } from './confirmationService';
import { getNativeOutbox } from './nativeOutbox';

import type { OutboxRecord } from './outbox';
import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./nativeOutbox', () => ({ getNativeOutbox: jest.fn() }));
jest.mock('./confirmationService', () => ({
  getConfirmationClient: jest.fn(() => ({})),
  loadConfirmationActivities: jest.fn(),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    captureId: '10000000-0000-4000-8000-000000000001',
  }),
  useRouter: () => ({
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

const record: OutboxRecord = {
  captureId: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000002',
  projectId: '30000000-0000-4000-8000-000000000003',
  projectName: 'Site project',
  kind: 'voice',
  createdAt: '2026-09-24T00:00:00Z',
  text: '',
  manifest: {
    captureId: '10000000-0000-4000-8000-000000000001',
    language: 'auto',
    files: [],
  },
  reportId: '50000000-0000-4000-8000-000000000005',
  uploadedFiles: [],
  originalTranscript: 'Two of eight complete.',
  confirmedPayload: null,
  submissionState: 'unconfirmed',
  submittedAt: null,
  evidenceReleased: false,
  state: 'needs_confirmation',
  attemptCount: 1,
  lastErrorKind: null,
  lastError: null,
  updatedAt: '2026-09-24T00:00:00Z',
};

function App() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <ConfirmationScreen />
    </QueryClientProvider>
  );
}

const confirm = jest.fn();
const sync = jest.fn();

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: record.userId } },
    offline: false,
  } as AuthViewState);
  confirm.mockResolvedValue({
    ...record,
    confirmedPayload: {
      text: 'Two of eight complete; six remain unfinished.',
      workDate: null,
      activityId: null,
    },
    submissionState: 'pending',
  });
  sync.mockResolvedValue({
    ...record,
    submissionState: 'submitted',
    submittedAt: '2026-09-24T01:00:00Z',
  });
  jest.mocked(getNativeOutbox).mockResolvedValue({
    list: async () => [record],
    confirm,
    sync,
  } as never);
  jest.mocked(loadConfirmationActivities).mockResolvedValue([]);
});

it('shows the original transcript and requires an explicit wording check', async () => {
  await render(<App />);
  expect(await screen.findByText('Two of eight complete.')).toBeVisible();
  const send = screen.getByRole('button', { name: 'Confirm and send' });
  expect(send).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText('Confirmed report wording'),
    'Two of eight complete; six remain unfinished.',
  );
  await fireEvent.press(screen.getByRole('checkbox'));
  const enabledSend = screen.getByRole('button', { name: 'Confirm and send' });
  expect(enabledSend).toBeEnabled();
  await fireEvent.press(enabledSend);
  expect(confirm).toHaveBeenCalledWith(record.userId, record.captureId, {
    text: 'Two of eight complete; six remain unfinished.',
    workDate: null,
    activityId: null,
  });
  expect(
    await screen.findByText(
      'Sent for review. Planner acceptance is still pending.',
    ),
  ).toBeVisible();
});

it('persists confirmation offline without claiming it was sent', async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: record.userId } },
    offline: true,
  } as AuthViewState);
  await render(<App />);
  await screen.findByText('Two of eight complete.');
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Confirm and send' }),
  );
  expect(
    await screen.findByText(
      'Confirmation saved on this device. It will send after reconnecting.',
    ),
  ).toBeVisible();
  expect(sync).not.toHaveBeenCalled();
});
