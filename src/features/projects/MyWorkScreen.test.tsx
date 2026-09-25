import { notifyManager, onlineManager } from '@tanstack/react-query';
import {
  act,
  cleanup,
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
import { loadActiveProjects, loadMyWork, WorkReadError } from './myWorkService';

import type { AuthViewState } from '@/features/auth/AuthProvider';
import type { Session } from '@supabase/supabase-js';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/field-reports/OutboxSyncAgent.native', () => ({
  OutboxSyncAgent: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./captureProjectStore', () => ({
  readRememberedProjectContext: jest.fn().mockResolvedValue(null),
  rememberProjectContext: jest.fn().mockResolvedValue(undefined),
  forgetRememberedProjectContext: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./captureProjectStore.native', () => ({
  readRememberedProjectContext: jest.fn().mockResolvedValue(null),
  rememberProjectContext: jest.fn().mockResolvedValue(undefined),
  forgetRememberedProjectContext: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./myWorkService', () => ({
  ...jest.requireActual('./myWorkService'),
  loadActiveProjects: jest.fn(),
  loadMyWork: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  Link: jest.requireActual('expo-router/build/ui/Slot').Slot,
}));

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
  calendar: 'Mon–Sat; Sunday off; no holidays',
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

async function pullToRefresh() {
  await act(async () =>
    screen
      .getByTestId('my-tasks-scroll')
      .props.refreshControl.props.onRefresh(),
  );
}

function refreshEnabled() {
  return screen.getByTestId('my-tasks-scroll').props.refreshControl.props
    .enabled as boolean;
}

const originalAppState = AppState.currentState;
afterAll(() => {
  AppState.currentState = originalAppState;
});
beforeEach(() => {
  jest.useFakeTimers();
  notifyManager.setScheduler((callback) => callback());
  AppState.currentState = 'active';
  onlineManager.setOnline(true);
  jest.mocked(useAuth).mockReturnValue(auth());
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
  jest.mocked(loadActiveProjects).mockReset().mockResolvedValue([context]);
  jest.mocked(loadMyWork).mockReset().mockResolvedValue(work);
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  jest.clearAllTimers();
  jest.useRealTimers();
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
});

it('matches the task-list shell without treating quantity as completion', async () => {
  await render(<App />);
  expect(await screen.findByText('2 of 8 spools accepted')).toBeVisible();
  expect(screen.getByRole('header', { name: 'My Tasks' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open settings' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous day' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next day' })).toBeVisible();
  expect(screen.getByText('START')).toBeVisible();
  expect(screen.getByText('—')).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: /Line erection.*Progress not recorded/,
    }),
  ).toBeVisible();
  expect(screen.queryByText('DONE')).toBeNull();
  expect(screen.getByText('Site project')).toBeVisible();
  expect(
    screen.getByRole('button', { name: /Open task hierarchy/ }),
  ).toBeVisible();
}, 20_000);

it('shows done, working, start, and delayed status treatments from accepted data', async () => {
  const activities = [
    { ...activity, id: 'done', name: 'Done task', actualFinish: '2026-09-24' },
    {
      ...activity,
      id: 'working',
      name: 'Working task',
      actualStart: '2026-09-24',
      acceptedPercent: 45,
    },
    { ...activity, id: 'start', name: 'Start task' },
    {
      ...activity,
      id: 'delayed',
      name: 'Delayed task',
      plannedFinish: '2026-09-24',
      acceptedPercent: 15,
    },
  ];
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: { ...work.snapshot, activities },
    assignments: activities.map((row) => ({
      ...assignment,
      activity_id: row.id,
    })),
  });
  await render(<App />);
  expect(await screen.findByText('DONE')).toBeVisible();
  expect(screen.getByText('WORKING')).toBeVisible();
  expect(screen.getByText('START')).toBeVisible();
  expect(screen.getByText('DELAYED')).toBeVisible();
  expect(screen.getByText('100%')).toBeVisible();
  expect(screen.getByText('45%')).toBeVisible();
  expect(screen.getByText('15%')).toBeVisible();
});

it('steps the date navigator without another server read', async () => {
  const currentDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
  const selected = `${currentDate.year}-${currentDate.month}-${currentDate.day}`;
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    assignments: [
      { ...assignment, effective_from: selected, effective_to: selected },
    ],
  });
  await render(<App />);
  expect(await screen.findByText('Line erection')).toBeVisible();
  expect(screen.getByText(/^TODAY,/)).toBeVisible();
  const reads = jest.mocked(loadMyWork).mock.calls.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Next day' }));
  expect(await screen.findByText('No assignment for this date.')).toBeVisible();
  expect(loadMyWork).toHaveBeenCalledTimes(reads);
  await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
  expect(await screen.findByText('Line erection')).toBeVisible();
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
  let finish!: (result: (typeof context)[]) => void;
  jest.mocked(loadActiveProjects).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<App />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();
  await act(async () => finish([]));
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
  expect(await screen.findByText('No assignment for this date.')).toBeVisible();
  jest.mocked(loadMyWork).mockResolvedValue({
    ...work,
    snapshot: { ...work.snapshot, revisionId: null, activities: [] },
    assignments: [],
  });
  await pullToRefresh();
  expect(await screen.findByText('No active schedule')).toBeVisible();
  expect(screen.queryByText('No assignment for this date.')).toBeNull();
});

it('does not fetch offline and fetches after reconnect', async () => {
  jest.mocked(useAuth).mockReturnValue(auth('reporter', true));
  await render(<App />);
  expect(
    screen.getByText('Offline · Connect to load your assigned work.'),
  ).toBeVisible();
  expect(refreshEnabled()).toBe(false);
  expect(loadActiveProjects).not.toHaveBeenCalled();
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
  await pullToRefresh();
  expect(await screen.findByText('Work unavailable')).toBeVisible();
  expect(screen.queryByText('Line erection')).toBeNull();
  jest.mocked(loadMyWork).mockResolvedValue(work);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Line erection')).toBeVisible();
});

it('drops the previous project records when membership disappears on refresh', async () => {
  await render(<App />);
  await screen.findByText('Line erection');
  jest.mocked(loadActiveProjects).mockResolvedValue([]);
  await pullToRefresh();
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
  jest.mocked(loadActiveProjects).mockResolvedValue([]);
  await screen.rerender(<App />);
  expect(previousSignal?.aborted).toBe(true);
  await act(async () => finish(work));
  expect(await screen.findByText('No active project access')).toBeVisible();
  expect(screen.queryByText('Line erection')).toBeNull();
  expect(loadActiveProjects).toHaveBeenLastCalledWith(
    expect.anything(),
    'another-user',
    expect.any(AbortSignal),
  );
});
