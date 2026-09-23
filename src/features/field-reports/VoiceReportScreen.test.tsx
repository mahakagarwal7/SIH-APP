import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Alert, AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptureProject } from '@/features/projects/useCaptureProject';

import { androidMicrophone } from './androidMicrophone';
import { getVoiceDraftStore } from './nativeDraftStore';
import { assertLocalDraftCanBeDiscarded } from './nativeOutbox';
import { VoiceReportScreen } from './VoiceReportScreen.android';

import type { VoiceDraftStore } from './draftStore';
import type { PcmBuffer } from './pcmWav';
import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useCaptureProject', () => ({
  useCaptureProject: jest.fn(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('./androidMicrophone', () => ({ androidMicrophone: jest.fn() }));
jest.mock('./nativeDraftStore', () => ({ getVoiceDraftStore: jest.fn() }));
jest.mock('./nativeOutbox', () => ({
  assertLocalDraftCanBeDiscarded: jest.fn(async () => {}),
}));
jest.mock('./ReportMethodLinks', () => ({ ReportMethodLinks: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'draft-id' }));
const mockPlayer = { pause: jest.fn(), replace: jest.fn(), play: jest.fn() };
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false }),
}));

let feed: (buffer: PcmBuffer) => void;
const save = jest.fn();
const list = jest.fn();
const originalAppState = AppState.currentState;
afterAll(() => {
  AppState.currentState = originalAppState;
});
function signedIn(userId = 'alice', offline = false) {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: userId } },
    offline,
  } as AuthViewState);
}
function App() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <VoiceReportScreen />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  signedIn();
  jest.mocked(useCaptureProject).mockReturnValue({
    data: {
      member: { user_id: 'alice' },
      project: { id: 'project', name: 'Site project' },
    },
    isPending: false,
    error: null,
  } as ReturnType<typeof useCaptureProject>);
  jest
    .mocked(requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof requestRecordingPermissionsAsync>
    >);
  jest.mocked(androidMicrophone).mockImplementation((callback) => {
    feed = callback;
    return { start: async () => {}, stop: jest.fn(), release: jest.fn() };
  });
  save.mockReset().mockResolvedValue(undefined);
  list.mockReset().mockResolvedValue([]);
  jest.mocked(assertLocalDraftCanBeDiscarded).mockResolvedValue(undefined);
  jest
    .mocked(getVoiceDraftStore)
    .mockResolvedValue({ save, list } as unknown as VoiceDraftStore);
});
afterEach(() => jest.useRealTimers());
it('does not label a recording saved while the durable write is pending', async () => {
  let finish!: () => void;
  save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await render(<App />);
  expect(await screen.findByText('No voice drafts saved yet.')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record voice report' }),
  );
  const data = new ArrayBuffer(32000);
  const view = new DataView(data);
  for (let i = 0; i < data.byteLength; i += 2) view.setInt16(i, 2048, true);
  await act(() => feed({ data, sampleRate: 16000, channels: 1 }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop and save recording' }),
  );
  expect(screen.getByText('Saving on this device…')).toBeVisible();
  expect(
    screen.queryByText('Saved on device. Not sent for review.'),
  ).toBeNull();
  await act(async () => finish());
  expect(
    await screen.findByText('Saved on device. Not sent for review.'),
  ).toBeVisible();
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'alice',
      projectId: 'project',
      id: 'draft-id',
    }),
    expect.any(Uint8Array),
  );
});
it('shows permission denial and never opens the native recorder', async () => {
  jest
    .mocked(requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof requestRecordingPermissionsAsync>
    >);
  await render(<App />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record voice report' }),
  );
  expect(await screen.findByText(/Microphone access is denied/)).toBeVisible();
  expect(androidMicrophone).not.toHaveBeenCalled();
});
it('prevents draft deletion and save retry from racing over an unsaved recording', async () => {
  save.mockRejectedValueOnce(new Error('Storage full'));
  list.mockResolvedValue([
    {
      id: 'draft-id',
      projectName: 'Site project',
      createdAt: '2026-09-23T00:00:00Z',
      duration: 1,
      state: 'saving',
      available: false,
    },
  ]);
  let finishDiscard!: () => void;
  const discard = jest.fn(
    () => new Promise<void>((resolve) => (finishDiscard = resolve)),
  );
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    save,
    list,
    discard,
  } as unknown as VoiceDraftStore);
  const alert = jest.spyOn(Alert, 'alert');
  await render(<App />);
  await screen.findByText('Recording incomplete or missing');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record voice report' }),
  );
  const samples = new Int16Array(16000).fill(2048);
  await act(() =>
    feed({ data: samples.buffer, sampleRate: 16000, channels: 1 }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop and save recording' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Retry save' }),
  ).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Discard draft' })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Discard unsaved recording' }),
  );
  await act(() =>
    alert.mock.calls
      .at(-1)?.[2]
      ?.find((button) => button.text === 'Discard')
      ?.onPress?.(),
  );
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeDisabled();
  await act(async () => finishDiscard());
  expect(screen.getByText('Recording discarded.')).toBeVisible();
  expect(save).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
it('loads local drafts while offline without project access and labels incomplete media honestly', async () => {
  signedIn('alice', true);
  jest.mocked(useCaptureProject).mockReturnValue({
    isPending: true,
    data: undefined,
    error: null,
  } as ReturnType<typeof useCaptureProject>);
  list.mockResolvedValue([
    {
      id: 'missing',
      projectName: 'Previous project',
      createdAt: '2026-09-23T00:00:00Z',
      duration: 1,
      state: 'saved',
      available: false,
    },
  ]);
  await render(<App />);
  expect(
    await screen.findByText('Recording incomplete or missing'),
  ).toBeVisible();
  expect(screen.getByText('Load your project to record')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Listen' })).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Record voice report' }),
  ).toBeNull();
  expect(list).toHaveBeenCalledWith('alice');
});
it('hides stale project access and lists only the currently signed-in account', async () => {
  signedIn('bob');
  await render(<App />);
  expect(await screen.findByText('No voice drafts saved yet.')).toBeVisible();
  expect(list).toHaveBeenCalledWith('bob');
  expect(
    screen.queryByRole('button', { name: 'Record voice report' }),
  ).toBeNull();
});

it('ignores a discard confirmation after its account screen unmounts', async () => {
  list.mockResolvedValue([
    {
      id: 'previous-account-draft',
      projectName: 'Site project',
      createdAt: '2026-09-23T00:00:00Z',
      duration: 1,
      state: 'saved',
      available: true,
    },
  ]);
  const discard = jest.fn(async () => {});
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    save,
    list,
    discard,
  } as unknown as VoiceDraftStore);
  const alert = jest.spyOn(Alert, 'alert');
  const view = await render(<App />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Discard draft' }),
  );
  const confirm = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.text === 'Discard');
  expect(confirm).toBeDefined();
  await view.unmount();
  await act(() => confirm?.onPress?.());
  expect(discard).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('retains local evidence after the draft enters the outbox', async () => {
  list.mockResolvedValue([
    {
      id: 'outbox-draft',
      projectName: 'Site project',
      duration: 2,
      createdAt: '2026-09-24T00:00:00Z',
      state: 'saved',
      available: true,
    },
  ]);
  const discard = jest.fn(async () => {});
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    save,
    list,
    discard,
  } as unknown as VoiceDraftStore);
  jest
    .mocked(assertLocalDraftCanBeDiscarded)
    .mockRejectedValueOnce(new Error('Keep this device copy.'));
  const alert = jest.spyOn(Alert, 'alert');
  await render(<App />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Discard draft' }),
  );
  const confirm = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.text === 'Discard');
  await act(() => confirm?.onPress?.());
  expect(discard).not.toHaveBeenCalled();
  expect(await screen.findByText('Keep this device copy.')).toBeVisible();
  alert.mockRestore();
});
