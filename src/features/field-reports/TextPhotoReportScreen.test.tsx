import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptureProject } from '@/features/projects/useCaptureProject';

import {
  choosePhoto,
  preparePickedPhoto,
  recoverPendingPhoto,
} from './nativePhotoPicker';
import { getReportDraftStore } from './nativeReportDraftStore';
import { TextPhotoReportScreen } from './TextPhotoReportScreen.native';

import type { LocalReportDraft, ReportDraftStore } from './reportDraftStore';
import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useCaptureProject', () => ({
  useCaptureProject: jest.fn(),
}));
jest.mock('./nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));
jest.mock('./nativeOutbox', () => ({
  assertLocalDraftCanBeDiscarded: jest.fn(async () => {}),
}));
jest.mock('./nativePhotoPicker', () => ({
  takePhoto: jest.fn(),
  choosePhoto: jest.fn(),
  preparePickedPhoto: jest.fn(),
  recoverPendingPhoto: jest.fn(),
}));
jest.mock('./ReportMethodLinks', () => ({ ReportMethodLinks: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `local-${++mockUuid}` }));

const save = jest.fn();
const list = jest.fn();
const discard = jest.fn();

beforeAll(() => {
  notifyManager.setScheduler((callback) => callback());
});

afterAll(() => {
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
});

function App({ mode = 'text' }: { mode?: 'text' | 'photo' }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <TextPhotoReportScreen mode={mode} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockUuid = 0;
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'alice' } },
    offline: false,
  } as AuthViewState);
  jest.mocked(useCaptureProject).mockReturnValue({
    data: {
      member: { user_id: 'alice' },
      project: { id: 'project', name: 'Site project' },
    },
    isPending: false,
    isFetching: false,
    error: null,
  } as ReturnType<typeof useCaptureProject>);
  save.mockReset().mockResolvedValue(undefined);
  list.mockReset().mockResolvedValue([]);
  discard.mockReset().mockResolvedValue(undefined);
  jest.mocked(getReportDraftStore).mockResolvedValue({
    save,
    list,
    discard,
  } as unknown as ReportDraftStore);
  jest.mocked(recoverPendingPhoto).mockResolvedValue(null);
  jest.mocked(choosePhoto).mockResolvedValue(null);
  jest.mocked(preparePickedPhoto).mockResolvedValue({
    uri: 'cache/normalized.jpg',
    width: 1200,
    height: 800,
    byteLength: 4,
    sourceByteLength: 40,
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3, 4]),
  });
});

it('does not claim a text draft is saved until durable persistence completes', async () => {
  let finish!: () => void;
  save.mockImplementation(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  await render(<App />);
  expect(
    await screen.findByText('No text or photo drafts saved yet.'),
  ).toBeVisible();
  await fireEvent.changeText(
    screen.getByLabelText('Report details'),
    'Installed two supports; welding remains.',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  expect(await screen.findByText('Saving to this device…')).toBeVisible();
  expect(
    screen.queryByText('Saved on device. Not sent for review.'),
  ).toBeNull();
  await act(async () => {
    finish();
    await Promise.resolve();
  });
  expect(
    await screen.findByText('Saved on device. Not sent for review.'),
  ).toBeVisible();
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'local-1',
      userId: 'alice',
      projectId: 'project',
      text: 'Installed two supports; welding remains.',
      photos: [],
    }),
    [],
  );
});

it('normalizes a chosen photo, keeps its caption, and saves the actual bytes', async () => {
  jest.mocked(choosePhoto).mockResolvedValue({
    uri: 'cache/source.jpg',
    width: 1200,
    height: 800,
    fileSize: 40,
  });
  await render(<App mode="photo" />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
  expect(await screen.findByLabelText('Selected photo 1')).toBeVisible();
  await fireEvent.changeText(
    screen.getByLabelText('Caption for photo 1'),
    'North pipe rack',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  await screen.findByText('Saved on device. Not sent for review.');
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'local-2',
      text: '',
      photos: [
        expect.objectContaining({
          id: 'local-1',
          fileName: 'local-1.jpg',
          caption: 'North pipe rack',
          byteLength: 4,
        }),
      ],
    }),
    [expect.objectContaining({ bytes: new Uint8Array([1, 2, 3, 4]) })],
  );
});

it('shows a picked photo immediately while compression continues in the background', async () => {
  let finish!: (photo: Awaited<ReturnType<typeof preparePickedPhoto>>) => void;
  jest.mocked(choosePhoto).mockResolvedValue({
    uri: 'cache/full-resolution.jpg',
    width: 4000,
    height: 3000,
    fileSize: 4_000_000,
  });
  jest.mocked(preparePickedPhoto).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(<App mode="photo" />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
  expect(await screen.findByLabelText('Selected photo 1')).toBeVisible();
  expect(screen.getByText('Photo 1 · Compressing…')).toBeVisible();
  expect(screen.getByLabelText('Report details')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save on device' })).toBeDisabled();
  await act(async () =>
    finish({
      uri: 'cache/compressed.jpg',
      width: 1600,
      height: 1200,
      byteLength: 400_000,
      sourceByteLength: 4_000_000,
      mimeType: 'image/jpeg',
      bytes: new Uint8Array(400_000),
    }),
  );
  expect(
    await screen.findByText(/3.8 MB → 391 KB · 90% smaller/),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save on device' })).toBeEnabled();
});

it('keeps a failed background compression removable without locking the form', async () => {
  jest.mocked(choosePhoto).mockResolvedValue({
    uri: 'cache/unreadable.jpg',
    width: 4000,
    height: 3000,
    fileSize: 4_000_000,
  });
  jest
    .mocked(preparePickedPhoto)
    .mockRejectedValue(new Error('Photo codec unavailable.'));
  await render(<App mode="photo" />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
  expect(await screen.findByText('Photo codec unavailable.')).toBeVisible();
  expect(screen.getByLabelText('Report details')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save on device' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
  expect(screen.getByRole('button', { name: 'Save on device' })).toBeEnabled();
});

it('retains a failed save for same-identity retry', async () => {
  save
    .mockRejectedValueOnce(new Error('Disk full'))
    .mockResolvedValueOnce(undefined);
  await render(<App />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.changeText(
    screen.getByLabelText('Report details'),
    'Progress update',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  expect(await screen.findByText('Disk full')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await screen.findByText('Saved on device. Not sent for review.');
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0]?.[0].id).toBe(save.mock.calls[1]?.[0].id);
});

it('keeps an empty report editable instead of creating a retry-locked draft', async () => {
  await render(<App />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  expect(
    await screen.findByText('Add report text or a photo before saving.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Report details')).toBeEnabled();
  expect(save).not.toHaveBeenCalled();
});

it('hides stale project access for a different signed-in account', async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'bob' } },
    offline: true,
  } as AuthViewState);
  await render(<App />);
  expect(await screen.findByText('No active project access')).toBeVisible();
  expect(screen.queryByLabelText('Report details')).toBeNull();
  expect(list).toHaveBeenCalledWith('bob');
});

const savedDraft: LocalReportDraft = {
  id: 'saved-draft',
  userId: 'alice',
  projectId: 'project',
  projectName: 'Site project',
  createdAt: '2026-09-24T00:00:00Z',
  text: 'Keep this evidence until discard succeeds',
  photos: [],
  state: 'saved',
  available: true,
  photoUris: [],
};

it('keeps a failed discard visible and allows the user to retry it', async () => {
  list.mockResolvedValue([savedDraft]);
  discard.mockRejectedValueOnce(new Error('Disk busy'));
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.text === 'Discard')?.onPress?.();
  });
  await render(<App />);
  await screen.findByText(savedDraft.text);
  await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
  await screen.findByText('Disk busy');
  expect(screen.getByText(savedDraft.text)).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Discard draft' })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
  await screen.findByText('No text or photo drafts saved yet.');
  expect(discard).toHaveBeenCalledTimes(2);
});

it('prevents retry and repeated discard while incomplete-save deletion is pending', async () => {
  save.mockRejectedValueOnce(new Error('Disk full'));
  list.mockImplementation(async () =>
    save.mock.calls[0]
      ? [{ ...save.mock.calls[0][0], available: false, photoUris: [] }]
      : [],
  );
  let finish!: () => void;
  discard.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await render(<App />);
  await screen.findByText('No text or photo drafts saved yet.');
  await fireEvent.changeText(
    screen.getByLabelText('Report details'),
    'Retry safely',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  await screen.findByText('Disk full');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Discard incomplete save' }),
  );
  await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
  try {
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Discard incomplete save' }),
    ).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Discard incomplete save' }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      finish();
    });
  }
  await screen.findByText('Unsaved attempt discarded.');
  expect(screen.getByLabelText('Report details')).toBeEnabled();
});

it('waits for photo recovery before allowing save and persists the recovered bytes', async () => {
  let recover!: (
    photo: Awaited<ReturnType<typeof recoverPendingPhoto>>,
  ) => void;
  jest.mocked(recoverPendingPhoto).mockImplementation(
    () =>
      new Promise((resolve) => {
        recover = resolve;
      }),
  );
  await render(<App />);
  await screen.findByText('No text or photo drafts saved yet.');
  expect(screen.getByRole('button', { name: 'Save on device' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Choose photo' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  expect(save).not.toHaveBeenCalled();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await act(async () => {
    recover({
      uri: 'cache/recovered-source.jpg',
      width: 100,
      height: 100,
      fileSize: 40,
    });
  });
  await screen.findByLabelText('Selected photo 1');
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  await screen.findByText('Saved on device. Not sent for review.');
  expect(save.mock.calls[0]?.[0].photos).toHaveLength(1);
  expect(save.mock.calls[0]?.[1][0].bytes).toEqual(bytes);
});

it('releases the form after photo recovery fails', async () => {
  jest
    .mocked(recoverPendingPhoto)
    .mockRejectedValue(new Error('Could not recover the selected photo'));
  await render(<App />);
  await screen.findByText('Could not recover the selected photo');
  expect(screen.getByLabelText('Report details')).toBeEnabled();
  await fireEvent.changeText(
    screen.getByLabelText('Report details'),
    'A text-only report',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save on device' }));
  await screen.findByText('Saved on device. Not sent for review.');
});

it('shows discard failure even when project access is unavailable', async () => {
  jest.mocked(useCaptureProject).mockReturnValue({
    userId: undefined,
    data: undefined,
    projects: [],
    isPending: false,
    isFetching: false,
    error: null,
    offline: false,
    remembered: false,
    refetch: jest.fn(),
    select: jest.fn(),
  } as ReturnType<typeof useCaptureProject>);
  list.mockResolvedValue([savedDraft]);
  discard.mockRejectedValue(new Error('Disk busy'));
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.text === 'Discard')?.onPress?.();
  });
  await render(<App />);
  await screen.findByText(savedDraft.text);
  await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
  expect(await screen.findByText('Disk busy')).toBeVisible();
});
