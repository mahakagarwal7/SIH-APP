import { onlineManager } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { ServerStateProvider } from '@/lib/queryClient';
import { getSupabase } from '@/lib/supabase';

import { MyWorkScreen } from './MyWorkScreen';
import { loadDefaultProject, loadMyWork, WorkReadError } from './myWorkService';

import type { AuthViewState } from '@/features/auth/AuthProvider';
import type { Session } from '@supabase/supabase-js';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./myWorkService', () => ({
  ...jest.requireActual('./myWorkService'),
  loadDefaultProject: jest.fn(),
  loadMyWork: jest.fn(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

const member = {
  project_id: 'project',
  user_id: 'reporter',
  display_name: 'Field worker',
  role: 'reporter' as const,
  active: true,
  version: 1,
};
const context = { member, project: { id: 'project', name: 'Site project' } };
const assignment = {
  project_id: 'project',
  activity_id: 'task',
  reporter_id: 'reporter',
  version: 1,
  effective_from: '2026-01-01',
  effective_to: '2099-01-01',
};
const activity = {
  id: 'task',
  projectId: 'project',
  revisionId: 'revision',
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping' as const,
  location: 'Unit 2',
  assignedReporterId: 'reporter',
  targetQuantity: 8,
  unit: 'spools',
  acceptedQuantity: 2,
  actualStart: null,
  actualFinish: null,
  reportedProgress: false,
  acceptedPercent: null,
  percentBasis: null,
  progressAsOf: null,
  milestoneDate: null,
  nodeKind: 'task' as const,
};
const work = {
  snapshot: {
    projectId: 'project',
    projectName: 'Site project',
    revisionId: 'revision',
    activities: [activity],
  },
  assignments: [assignment],
};
function auth(userId = 'reporter', offline = false): AuthViewState {
  const session: Session = {
    access_token: 'synthetic',
    refresh_token: 'synthetic',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: userId,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
  return {
    status: 'signedIn',
    session,
    offline,
    persistent: true,
    busy: false,
    message: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    retry: jest.fn(),
  };
}
function App() {
  return (
    <ServerStateProvider>
      <MyWorkScreen />
    </ServerStateProvider>
  );
}

const originalAppState = AppState.currentState;
afterAll(() => {
  AppState.currentState = originalAppState;
});
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  onlineManager.setOnline(true);
  jest.mocked(useAuth).mockReturnValue(auth());
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
  jest.mocked(loadDefaultProject).mockReset().mockResolvedValue(context);
  jest.mocked(loadMyWork).mockReset().mockResolvedValue(work);
});
afterEach(() => {
  onlineManager.setOnline(true);
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

it('shows accepted quantity separately from completion and missing actual dates', async () => {
  await render(<App />);
  expect(await screen.findByText('2 of 8 spools accepted')).toBeVisible();
  expect(screen.getByText('Actual start: Not recorded')).toBeVisible();
  expect(screen.getByText('Actual finish: Not recorded')).toBeVisible();
  expect(screen.getByText('Assigned')).toBeVisible();
  expect(screen.queryByText('Complete')).toBeNull();
  expect(screen.getByText('Site project')).toBeVisible();
});

it.each([
  {
    acceptedQuantity: 0.0004,
    targetQuantity: 8.0004,
    unit: 't',
    label: '0.0004 of 8.0004 t accepted',
  },
  {
    acceptedQuantity: 0.12345678901234566,
    targetQuantity: 1234567.8901234567,
    unit: 'm',
    label: '0.12345678901234566 of 12,34,567.8901234567 m accepted',
  },
  {
    acceptedQuantity: 0.0000001,
    targetQuantity: null,
    unit: null,
    label:
      '0.0000001 (unit not recorded) accepted · Planned quantity not recorded',
  },
  {
    acceptedQuantity: 0,
    targetQuantity: 8,
    unit: 'spools',
    label: '0 of 8 spools accepted',
  },
])('preserves recorded quantity precision: $label', async (testCase) => {
  const { label, ...quantities } = testCase;
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: {
      ...work.snapshot,
      activities: [{ ...activity, ...quantities }],
    },
  });
  await render(<App />);
  expect(await screen.findByText(label)).toBeVisible();
  expect(screen.queryByText('Complete')).toBeNull();
});

it('provides a loading state and an explicit no-access state', async () => {
  let finish!: (result: null) => void;
  jest.mocked(loadDefaultProject).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<App />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();
  await act(async () => finish(null));
  expect(await screen.findByText('No active project access')).toBeVisible();
  expect(loadMyWork).not.toHaveBeenCalled();
});

it('shows an empty assignment period and no-active-schedule as different states', async () => {
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: { ...work.snapshot, activities: [] },
    assignments: [],
  });
  await render(<App />);
  expect(await screen.findByText('No assignment today.')).toBeVisible();
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: { ...work.snapshot, revisionId: null, activities: [] },
    assignments: [],
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('No active schedule')).toBeVisible();
  expect(screen.queryByText('No assignment today.')).toBeNull();
});

it('does not fetch offline and fetches after reconnect', async () => {
  jest.mocked(useAuth).mockReturnValue(auth('reporter', true));
  await render(<App />);
  expect(
    screen.getByText('Offline · Connect to load your assigned work.'),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  expect(loadDefaultProject).not.toHaveBeenCalled();
  jest.mocked(useAuth).mockReturnValue(auth());
  await screen.rerender(<App />);
  expect(await screen.findByText('2 of 8 spools accepted')).toBeVisible();
});

it('labels cached work offline and replaces it on reconnect', async () => {
  await render(<App />);
  await screen.findByText('2 of 8 spools accepted');
  jest.mocked(useAuth).mockReturnValue(auth('reporter', true));
  await screen.rerender(<App />);
  expect(
    screen.getByText(
      'Offline · Showing previously loaded work. Assignments may have changed.',
    ),
  ).toBeVisible();
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: {
      ...work.snapshot,
      activities: [{ ...activity, acceptedQuantity: 3 }],
    },
  });
  jest.mocked(useAuth).mockReturnValue(auth());
  await screen.rerender(<App />);
  expect(await screen.findByText('3 of 8 spools accepted')).toBeVisible();
});

it('hides previous records after access is revoked, then supports retry', async () => {
  await render(<App />);
  await screen.findByText('Line erection');
  jest.mocked(loadMyWork).mockRejectedValue(new WorkReadError('access'));
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Work unavailable')).toBeVisible();
  expect(screen.queryByText('Line erection')).toBeNull();
  jest.mocked(loadMyWork).mockResolvedValue(work);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Line erection')).toBeVisible();
});

it('drops the previous project records when membership disappears on refresh', async () => {
  await render(<App />);
  await screen.findByText('Line erection');
  jest.mocked(loadDefaultProject).mockResolvedValue(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('No active project access')).toBeVisible();
  expect(screen.queryByText('Line erection')).toBeNull();
});

it('cancels the previous user’s read and cannot display its late response for a different user', async () => {
  let previousSignal: AbortSignal | undefined;
  let finish!: (value: typeof work) => void;
  jest.mocked(loadMyWork).mockImplementation((_client, _context, signal) => {
    previousSignal = signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await render(<App />);
  await waitFor(() => expect(previousSignal).toBeDefined());
  jest.mocked(useAuth).mockReturnValue(auth('another-user'));
  jest.mocked(loadDefaultProject).mockResolvedValue(null);
  await screen.rerender(<App />);
  expect(previousSignal?.aborted).toBe(true);
  await act(async () => finish(work));
  expect(await screen.findByText('No active project access')).toBeVisible();
  expect(screen.queryByText('Line erection')).toBeNull();
  expect(loadDefaultProject).toHaveBeenLastCalledWith(
    expect.anything(),
    'another-user',
    expect.any(AbortSignal),
  );
});
