import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useDefaultProject } from '@/features/projects/useMyWork';

import { choosePhoto, recoverPendingPhoto } from './nativePhotoPicker';
import { getReportDraftStore } from './nativeReportDraftStore';
import { TextPhotoReportScreen } from './TextPhotoReportScreen.native';

import type { ReportDraftStore } from './reportDraftStore';
import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useMyWork', () => ({
  useDefaultProject: jest.fn(),
}));
jest.mock('./nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));
jest.mock('./nativePhotoPicker', () => ({
  takePhoto: jest.fn(),
  choosePhoto: jest.fn(),
  recoverPendingPhoto: jest.fn(),
}));
jest.mock('./ReportMethodLinks', () => ({ ReportMethodLinks: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `local-${++mockUuid}` }));

const save = jest.fn();
const list = jest.fn();
const discard = jest.fn();

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
  jest.mocked(useDefaultProject).mockReturnValue({
    data: {
      member: { user_id: 'alice' },
      project: { id: 'project', name: 'Site project' },
    },
    isPending: false,
    isFetching: false,
    error: null,
  } as ReturnType<typeof useDefaultProject>);
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
    uri: 'cache/normalized.jpg',
    width: 1200,
    height: 800,
    byteLength: 4,
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3, 4]),
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
