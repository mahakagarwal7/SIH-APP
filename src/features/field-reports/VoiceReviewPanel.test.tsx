import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { getVoiceDraftStore } from './nativeDraftStore';
import {
  cancelNativeOutboxCapture,
  getNativeOutbox,
  prepareLocalOutbox,
  syncNativeOutbox,
} from './nativeOutbox';
import { notifyOutboxChanged } from './outboxEvents';
import { VoiceReviewPanel } from './VoiceReviewPanel.native';

import type { OutboxRecord } from './outbox';
import type { AuthViewState } from '@/features/auth/AuthProvider';

const mockShowToast = jest.fn();
jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/WorkDatePicker', () => ({
  WorkDatePicker: ({
    label,
    onChange,
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    value: string | null;
  }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Pressable, Text } = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');
    return React.createElement(
      Pressable,
      {
        accessibilityLabel: `Choose ${label.toLocaleLowerCase()}`,
        accessibilityRole: 'button',
        onPress: () => onChange('2026-09-24'),
      },
      React.createElement(Text, null, value ?? 'Choose date'),
    );
  },
}));
jest.mock('./nativeDraftStore', () => ({ getVoiceDraftStore: jest.fn() }));
jest.mock('./nativeOutbox', () => ({
  cancelNativeOutboxCapture: jest.fn(),
  getNativeOutbox: jest.fn(),
  prepareLocalOutbox: jest.fn(),
  syncNativeOutbox: jest.fn(),
}));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));

const captureId = '10000000-0000-4000-8000-000000000001';
const base: OutboxRecord = {
  captureId,
  userId: 'alice',
  projectId: 'project',
  projectName: 'Site project',
  kind: 'voice',
  createdAt: '2026-09-25T00:00:00Z',
  text: '',
  manifest: {
    captureId,
    language: 'auto',
    files: [
      {
        id: '20000000-0000-4000-8000-000000000002',
        name: 'voice.wav',
        kind: 'audio',
        mime: 'audio/wav',
        bytes: 100,
        sha256: 'a'.repeat(64),
        caption: '',
      },
    ],
  },
  reportId: null,
  uploadedFiles: [],
  originalTranscript: null,
  sendRequested: false,
  cancelRequested: false,
  confirmedPayload: null,
  confirmedActivityLabel: null,
  submissionRejected: false,
  submissionState: 'unconfirmed',
  submittedAt: null,
  evidenceReleased: false,
  state: 'queued',
  attemptCount: 0,
  lastErrorKind: null,
  lastError: null,
  retryable: true,
  updatedAt: '2026-09-25T00:00:00Z',
};

let stored: OutboxRecord;
const requestSend = jest.fn();
const onCanceled = jest.fn();

function App() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <VoiceReviewPanel
        userId="alice"
        captureId={captureId}
        onCanceled={onCanceled}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockShowToast.mockReset();
  stored = structuredClone(base);
  requestSend.mockReset().mockImplementation(async () => {
    stored = { ...stored, sendRequested: true };
    return structuredClone(stored);
  });
  onCanceled.mockReset();
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: false,
  } as AuthViewState);
  jest.mocked(prepareLocalOutbox).mockResolvedValue({
    enqueued: 1,
    unavailable: 0,
  });
  jest.mocked(syncNativeOutbox).mockReset().mockResolvedValue([]);
  jest.mocked(getNativeOutbox).mockResolvedValue({
    list: async () => [structuredClone(stored)],
    requestSend,
  } as never);
  jest.mocked(getVoiceDraftStore).mockResolvedValue({} as never);
  jest.mocked(cancelNativeOutboxCapture).mockReset();
});

it('requires a work date and queues Submit without waiting for transcription', async () => {
  let finishPreparation!: () => void;
  let prepared = false;
  jest.mocked(prepareLocalOutbox).mockReturnValue(
    new Promise((resolve) => {
      finishPreparation = () => {
        prepared = true;
        resolve({ enqueued: 1, unavailable: 0 });
      };
    }),
  );
  jest.mocked(getNativeOutbox).mockResolvedValue({
    list: async () => (prepared ? [structuredClone(stored)] : []),
    requestSend,
  } as never);
  await render(<App />);
  expect(await screen.findByText('Transcribing…')).toBeVisible();
  const send = screen.getByRole('button', { name: 'Submit' });
  expect(send).toBeEnabled();
  await fireEvent.press(send);
  expect(
    await screen.findByText('Choose today or an earlier work date.'),
  ).toBeVisible();
  expect(requestSend).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Choose work date' }),
  );
  expect(
    screen.queryByText('Choose today or an earlier work date.'),
  ).toBeNull();
  await fireEvent.press(send);
  await fireEvent.press(send);
  expect(
    await screen.findByText(
      'Send queued. The verified transcript will be attached before submission.',
    ),
  ).toBeVisible();
  expect(requestSend).not.toHaveBeenCalled();
  await act(() => finishPreparation());
  expect(requestSend).toHaveBeenCalledWith('alice', captureId, {
    text: '',
    workDate: '2026-09-24',
    activityId: null,
  });
});

it('shows the worker transcript on the same screen and sends edited wording', async () => {
  await render(<App />);
  await screen.findByText('Transcribing…');
  stored = {
    ...stored,
    reportId: '30000000-0000-4000-8000-000000000003',
    state: 'needs_confirmation',
    originalTranscript: 'Two supports installed.',
  };
  await act(() => notifyOutboxChanged('alice', captureId));
  const transcript = await screen.findByLabelText('Voice transcript');
  expect(transcript).toBeEnabled();
  await fireEvent.changeText(
    transcript,
    'Two supports installed; welding remains.',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Choose work date' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
  expect(requestSend).toHaveBeenCalledWith('alice', captureId, {
    text: 'Two supports installed; welding remains.',
    workDate: '2026-09-24',
    activityId: null,
  });
});

it('shows the saved work date after reopening a queued voice report', async () => {
  stored = {
    ...stored,
    sendRequested: true,
    requestedWorkDate: '2026-09-24',
  };
  await render(<App />);
  expect(await screen.findByText('2026-09-24')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
});

it('cancels local and reserved evidence through the outbox cancellation path', async () => {
  jest.mocked(cancelNativeOutboxCapture).mockResolvedValue({
    ...stored,
    cancelRequested: true,
    retryable: false,
  });
  await render(<App />);
  await screen.findByText('Transcribing…');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancelNativeOutboxCapture).toHaveBeenCalledWith('alice', captureId);
  expect(onCanceled).toHaveBeenCalledWith('Voice report canceled.');
});

it('reports a queued cancellation when server cleanup is still pending', async () => {
  jest.mocked(cancelNativeOutboxCapture).mockResolvedValue({
    ...stored,
    cancelRequested: true,
    retryable: false,
    lastError:
      'Cancellation is queued. Local evidence stays private until server cleanup succeeds.',
  });
  await render(<App />);
  await screen.findByText('Transcribing…');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCanceled).toHaveBeenCalledWith(
    'Cancellation queued. Server cleanup will retry after reconnecting.',
  );
  expect(mockShowToast).toHaveBeenCalledWith('Cancellation queued for retry.');
});
