import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { Alert, AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptureProject } from '@/features/projects/useCaptureProject';

import { androidMicrophone } from './androidMicrophone';
import { saveCombinedVoiceDraft } from './combinedDraftStore';
import { getVoiceDraftStore } from './nativeDraftStore';
import { assertLocalDraftCanBeDiscarded } from './nativeOutbox';
import { choosePhoto } from './nativePhotoPicker';
import { VoiceReportScreen } from './VoiceReportScreen.android';

import type { VoiceDraftStore } from './draftStore';
import type { PcmBuffer } from './pcmWav';
import type { AuthViewState } from '@/features/auth/AuthProvider';
import type { AppStateStatus } from 'react-native';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useCaptureProject', () => ({
  useCaptureProject: jest.fn(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('./androidMicrophone', () => ({ androidMicrophone: jest.fn() }));
jest.mock('./combinedDraftStore', () => ({
  saveCombinedVoiceDraft: jest.fn(),
}));
jest.mock('./nativeDraftStore', () => ({ getVoiceDraftStore: jest.fn() }));
jest.mock('./nativePhotoPicker', () => ({
  takePhoto: jest.fn(),
  choosePhoto: jest.fn(),
}));
jest.mock('./nativeOutbox', () => ({
  assertLocalDraftCanBeDiscarded: jest.fn(async () => {}),
}));
jest.mock('./ReportMethodLinks', () => ({ ReportMethodLinks: () => null }));
jest.mock('./VoiceReviewPanel.native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  return {
    VoiceReviewPanel: ({ captureId }: { captureId: string }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Text,
          null,
          'Saved on device. Not sent for review.',
        ),
        React.createElement(Text, null, `Voice review ${captureId}`),
      ),
  };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => 'draft-id' }));
const mockPlayer = {
  pause: jest.fn(),
  replace: jest.fn(),
  play: jest.fn(),
  remove: jest.fn(),
  release: jest.fn(),
  addListener: jest.fn(),
};
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(),
  createAudioPlayer: jest.fn(() => mockPlayer),
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
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <VoiceReportScreen />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  mockPlayer.addListener.mockReturnValue({ remove: jest.fn() });
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
  jest
    .mocked(saveCombinedVoiceDraft)
    .mockImplementation(async (draft, bytes) => save(draft, bytes));
  jest.mocked(choosePhoto).mockReset().mockResolvedValue(null);
  list.mockReset().mockResolvedValue([]);
  jest.mocked(assertLocalDraftCanBeDiscarded).mockResolvedValue(undefined);
  jest
    .mocked(getVoiceDraftStore)
    .mockResolvedValue({ save, list } as unknown as VoiceDraftStore);
});

it('freezes voice, typed text and a selected photo as one capture', async () => {
  jest.mocked(choosePhoto).mockResolvedValue({
    uri: 'cache/evidence.jpg',
    width: 100,
    height: 80,
    byteLength: 4,
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3, 4]),
  });
  await render(<App />);
  await screen.findByText('No voice drafts saved yet.');
  await fireEvent.changeText(
    screen.getByLabelText('Report details'),
    'Two supports installed.',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
  await screen.findByLabelText('Selected photo 1');
  await recordOneSecond();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop and save recording' }),
  );
  expect(
    await screen.findByText('Saved on device. Not sent for review.'),
  ).toBeVisible();
  expect(saveCombinedVoiceDraft).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'draft-id' }),
    expect.any(Uint8Array),
    expect.objectContaining({
      draft: expect.objectContaining({
        id: 'draft-id',
        text: 'Two supports installed.',
        photos: [expect.objectContaining({ mimeType: 'image/jpeg' })],
      }),
      prepared: [
        expect.objectContaining({ bytes: new Uint8Array([1, 2, 3, 4]) }),
      ],
    }),
  );
});

function renameProject() {
  const current = jest.mocked(useCaptureProject).mock.results.at(-1)!.value;
  jest.mocked(useCaptureProject).mockReturnValue({
    ...current,
    data: {
      ...current.data,
      project: { ...current.data.project, name: 'Renamed site' },
    },
  });
}
async function recordOneSecond() {
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record voice report' }),
  );
  await act(() =>
    feed({
      data: new Int16Array(16000).fill(2048).buffer,
      sampleRate: 16000,
      channels: 1,
    }),
  );
}
it('keeps the active recording operable when project metadata refreshes', async () => {
  const view = await render(<App />);
  await recordOneSecond();
  renameProject();
  await view.rerender(<App />);
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop and save recording' }),
  );
  expect(
    await screen.findByText('Saved on device. Not sent for review.'),
  ).toBeVisible();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].projectName).toBe('Renamed site');
  expect(screen.getByText('Voice review draft-id')).toBeVisible();
  expect(androidMicrophone).toHaveBeenCalledTimes(1);
});
it('retries the same recording and draft after a project-name refresh', async () => {
  save.mockRejectedValueOnce(new Error('Storage full'));
  const view = await render(<App />);
  await recordOneSecond();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop and save recording' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Retry save' }),
  ).toBeEnabled();
  renameProject();
  await view.rerender(<App />);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
  expect(save.mock.calls[1][1]).toBe(save.mock.calls[0][1]);
  expect(
    await screen.findByText('Saved on device. Not sent for review.'),
  ).toBeVisible();
});

function playableDraft() {
  list.mockResolvedValue([
    {
      id: 'playable',
      projectName: 'Site project',
      createdAt: '2026-09-23T00:00:00Z',
      duration: 1,
      state: 'saved',
      available: true,
    },
  ]);
  const playbackUri = jest.fn().mockResolvedValue('file:///voice.wav');
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    save,
    list,
    playbackUri,
  } as unknown as VoiceDraftStore);
  return playbackUri;
}
it('removes native playback on background so Android cannot resume it invisibly', async () => {
  playableDraft();
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
  await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Listen' }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(() => listeners.forEach((listener) => listener('background')));
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  expect(mockPlayer.release).toHaveBeenCalledTimes(1);
  await act(() => listeners.forEach((listener) => listener('active')));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Listen' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Listen' }));
  expect(createAudioPlayer).toHaveBeenCalledTimes(2);
});
it('releases playback when its account screen unmounts', async () => {
  playableDraft();
  const view = await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Listen' }));
  await view.unmount();
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  expect(mockPlayer.release).toHaveBeenCalledTimes(1);
});
it('cancels a pending playback lookup when leaving the screen', async () => {
  const playbackUri = playableDraft();
  let finish!: (uri: string) => void;
  playbackUri.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Listen' }));
  const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
  let blur: void | (() => void);
  await act(() => {
    blur = focus();
  });
  await act(() => {
    blur?.();
  });
  await act(() => finish('file:///late.wav'));
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Listen' })).toBeEnabled();
});
it('releases playback before opening the microphone', async () => {
  playableDraft();
  await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Listen' }));
  jest.mocked(androidMicrophone).mockImplementation(() => {
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    expect(mockPlayer.release).toHaveBeenCalledTimes(1);
    return { start: async () => {}, stop: jest.fn(), release: jest.fn() };
  });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record voice report' }),
  );
  expect(androidMicrophone).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Listen' })).toBeDisabled();
});
it.each(['finished', 'error'])(
  'clears and releases a %s playback session',
  async (outcome) => {
    playableDraft();
    await render(<App />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Listen' }),
    );
    const listener = mockPlayer.addListener.mock.calls.at(-1)![1];
    await act(() =>
      listener({
        didJustFinish: outcome === 'finished',
        error: outcome === 'error' ? 'decode failed' : null,
        isLoaded: true,
      }),
    );
    expect(mockPlayer.release).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Listen' })).toBeEnabled();
    if (outcome === 'error')
      expect(screen.getByRole('alert')).toHaveTextContent(
        /could not be played/,
      );
    await fireEvent.press(screen.getByRole('button', { name: 'Listen' }));
    // Ignore a status event already queued by the released native session.
    await act(() =>
      listener({ didJustFinish: true, error: null, isLoaded: true }),
    );
    expect(screen.getByRole('button', { name: 'Stop playback' })).toBeEnabled();
  },
);
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
