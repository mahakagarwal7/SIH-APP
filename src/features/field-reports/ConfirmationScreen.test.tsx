import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { ConfirmationScreen } from './ConfirmationScreen.native';
import { loadConfirmationActivities } from './confirmationService';
import { getNativeOutbox } from './nativeOutbox';
import { notifyOutboxChanged } from './outboxEvents';

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
  confirmedActivityLabel: null,
  submissionRejected: false,
  submissionState: 'unconfirmed',
  submittedAt: null,
  evidenceReleased: false,
  state: 'needs_confirmation',
  attemptCount: 1,
  lastErrorKind: null,
  lastError: null,
  retryable: true,
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
let stored: OutboxRecord;
beforeAll(() => notifyManager.setScheduler((callback) => callback()));
afterAll(() =>
  notifyManager.setScheduler((callback) => setTimeout(callback, 0)),
);

beforeEach(() => {
  stored = structuredClone(record);
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: record.userId } },
    offline: false,
  } as AuthViewState);
  confirm
    .mockReset()
    .mockImplementation(async (_user, _capture, payload, label) => {
      stored = {
        ...stored,
        confirmedPayload: payload,
        confirmedActivityLabel: label,
        submissionState: 'pending',
        submissionRejected: false,
      };
      return structuredClone(stored);
    });
  sync.mockReset().mockImplementation(async () => {
    stored = {
      ...stored,
      submissionState: 'submitted',
      submittedAt: '2026-09-24T01:00:00Z',
    };
    return structuredClone(stored);
  });
  jest.mocked(getNativeOutbox).mockResolvedValue({
    list: async () => [structuredClone(stored)],
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
  expect(confirm).toHaveBeenCalledWith(
    record.userId,
    record.captureId,
    {
      text: 'Two of eight complete; six remain unfinished.',
      workDate: null,
      activityId: null,
    },
    null,
  );
  expect(
    await screen.findByText(
      'Sent for review. Planner acceptance is still pending.',
    ),
  ).toBeVisible();
});

it('keeps Send reachable for a large schedule and lets the reporter search every activity', async () => {
  jest.mocked(loadConfirmationActivities).mockResolvedValue(
    Array.from({ length: 149 }, (_, index) => ({
      id: `activity-${index}`,
      externalId: `CIV-${index}`,
      name: `Task ${index}`,
      location: 'Site',
    })) as never,
  );
  await render(<App />);
  await screen.findByRole('button', { name: 'Choose activity' });
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'Confirm and send' }),
  ).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Choose activity' }),
  );
  expect(screen.getAllByRole('radio')).toHaveLength(9);
  await fireEvent.changeText(
    screen.getByLabelText('Search activities'),
    'CIV-148',
  );
  await fireEvent.press(screen.getByText('CIV-148 · Task 148'));
  expect(screen.queryByLabelText('Search activities')).toBeNull();
  expect(
    screen.getByRole('radio', { checked: true, name: /CIV-148/ }),
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
  expect(screen.getByLabelText('Confirmed report wording').props.editable).toBe(
    false,
  );
  expect(
    screen.getByRole('button', { name: 'Check receipt / retry' }),
  ).toBeDisabled();
});

it('freezes editing during a delayed confirmation and shows only the persisted wording afterward', async () => {
  let finish!: () => void;
  confirm.mockImplementationOnce(async (_user, _capture, payload) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    stored = {
      ...stored,
      confirmedPayload: payload,
      submissionState: 'pending',
    };
    return structuredClone(stored);
  });
  await render(<App />);
  await screen.findByLabelText('Confirmed report wording');
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Confirm and send' }),
  );
  expect(screen.getByLabelText('Confirmed report wording').props.editable).toBe(
    false,
  );
  expect(
    screen.getByRole('button', { name: 'Choose work date' }),
  ).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByLabelText('Confirmed report wording').props.value).toBe(
    stored.confirmedPayload?.text,
  );
  expect(
    screen.getByRole('button', { name: 'Return to My reports' }),
  ).toBeVisible();
});

it('updates an open confirmation when foreground sync records a receipt', async () => {
  stored = {
    ...stored,
    submissionState: 'pending',
    confirmedPayload: {
      text: 'Checked wording',
      workDate: null,
      activityId: null,
    },
  };
  await render(<App />);
  await screen.findByRole('button', { name: 'Check receipt / retry' });
  stored = {
    ...stored,
    submissionState: 'submitted',
    submittedAt: '2026-09-24T01:00:00Z',
  };
  await act(() => notifyOutboxChanged(record.userId, record.captureId));
  expect(
    await screen.findByRole('button', { name: 'Return to My reports' }),
  ).toBeVisible();
  expect(
    screen.getByText('Sent for review. Planner acceptance is still pending.'),
  ).toBeVisible();
});

it('shows the saved activity label when restored offline', async () => {
  stored = {
    ...stored,
    submissionState: 'pending',
    confirmedPayload: {
      text: 'Checked wording',
      workDate: '2026-09-24',
      activityId: '40000000-0000-4000-8000-000000000004',
    },
    confirmedActivityLabel: 'A-20 · Install supports',
  };
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: record.userId } },
    offline: true,
  } as AuthViewState);
  await render(<App />);
  expect(await screen.findByText('A-20 · Install supports')).toBeVisible();
  expect(screen.getByText('24 Sept 2026')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Choose work date' }),
  ).toBeDisabled();
});

it('shows access errors and permits correction after a definitive activity rejection', async () => {
  sync.mockImplementationOnce(async () => {
    stored = {
      ...stored,
      state: 'paused',
      submissionRejected: true,
      lastErrorKind: 'access',
      lastError: 'The selected activity is no longer available.',
    };
    return structuredClone(stored);
  });
  await render(<App />);
  await screen.findByLabelText('Confirmed report wording');
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Confirm and send' }),
  );
  expect(
    await screen.findByText('The selected activity is no longer available.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Confirmed report wording').props.editable).toBe(
    true,
  );
  expect(
    screen.getByRole('button', { name: 'Confirm and send' }),
  ).toBeDisabled();
});
