import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { ScheduleScreen } from './ScheduleScreen';
import { ScheduleReadError } from './scheduleService';
import { useManagerSchedule } from './useManagerSchedule';

import type { ScheduleActivity } from './scheduleContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';

jest.mock('./useManagerSchedule', () => ({ useManagerSchedule: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void) => callback()),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const revisionId = '10000000-0000-4000-8000-000000000003';
const context: ProjectContext = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Planner',
    role: 'planner',
    active: true,
    version: 1,
  },
  project: { id: projectId, name: 'Refinery upgrade' },
};
const activity: ScheduleActivity = {
  id: '10000000-0000-4000-8000-000000000004',
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  stage: 'Erection',
  plannedStart: '2026-09-20',
  plannedFinish: '2026-09-25',
  baselineStart: '2026-09-18',
  baselineFinish: '2026-09-24',
  assignedReporterId: null,
  targetQuantity: 4,
  unit: 'spools',
  actualStart: '2026-09-21',
  actualFinish: null,
  acceptedQuantity: 2,
  actualsVersion: 2,
  acceptedPercent: 50,
  reportedProgress: true,
  percentBasis: 'physical',
  milestoneDate: null,
  progressAsOf: '2026-09-23',
  nodeKind: 'task',
  hierarchyPath: [{ id: 'AREA-A', name: 'Area A' }],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: 'PIP-1100',
  calendar: 'Mon–Sat; Sunday off; no holidays',
};
const civil: ScheduleActivity = {
  ...activity,
  id: '10000000-0000-4000-8000-000000000005',
  externalId: 'CIV-0401',
  name: 'Pump foundation',
  discipline: 'Civil',
  stage: 'Concrete',
  actualStart: '2026-09-18',
  actualFinish: '2026-09-20',
  acceptedQuantity: 4,
};
const data = {
  projectId,
  projectName: 'Refinery upgrade',
  revisionId,
  revisionLabel: 'Imported baseline 01',
  nodes: [],
  policyVersion: 2,
  scheduleVersion: 7,
  activities: [activity, civil],
};

function state(
  overrides: {
    data?: unknown;
    error?: Error | null;
    pending?: boolean;
    offline?: boolean;
    authorized?: boolean;
    context?: ProjectContext | null;
  } = {},
) {
  return {
    project: {
      data: overrides.context === undefined ? context : overrides.context,
      projects: [context],
      error: null,
      isPending: overrides.pending ?? false,
      isFetching: false,
      offline: overrides.offline ?? false,
      remembered: false,
      refetch: jest.fn(),
      select: jest.fn(),
    },
    schedule: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : data,
      error: overrides.error ?? null,
      isFetching: false,
    },
    refresh: jest.fn().mockResolvedValue(undefined),
    authorized: overrides.authorized ?? true,
  } as unknown as ReturnType<typeof useManagerSchedule>;
}

beforeEach(() => {
  jest.mocked(useManagerSchedule).mockReturnValue(state());
});
afterEach(cleanup);

it('shows the active revision, planned dates and accepted actuals', async () => {
  await render(<ScheduleScreen />);
  expect(screen.getByText('Imported baseline 01')).toBeVisible();
  expect(screen.getByText('Schedule v7')).toBeVisible();
  expect(screen.getByText('2 activities')).toBeVisible();
  expect(screen.getByText('PIP-1201 · Piping')).toBeVisible();
  expect(screen.getByText('In progress')).toBeVisible();
  expect(screen.getByText(/2 of 4 spools accepted/)).toBeVisible();
  expect(
    screen.getAllByLabelText(/Planned 20 Sept 2026 to 25 Sept 2026/),
  ).toHaveLength(2);
});

it('filters disciplines, toggles baseline and exposes activity details', async () => {
  await render(<ScheduleScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Piping' }));
  expect(screen.getByText('1 activity')).toBeVisible();
  expect(screen.queryByText('CIV-0401 · Civil')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Baseline shown' }));
  expect(screen.getByRole('button', { name: 'Baseline hidden' })).toBeVisible();
  expect(screen.queryByText('— Baseline')).toBeNull();

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Show schedule details for PIP-1201',
    }),
  );
  expect(screen.getByText('Area A')).toBeVisible();
  expect(screen.getByText('1.2.1 · Activity')).toBeVisible();
  expect(screen.getByText('PIP-1100')).toBeVisible();
  expect(screen.getByText('50% · physical')).toBeVisible();
});

it('resets revision-scoped controls when the schedule version changes', async () => {
  const view = await render(<ScheduleScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Piping' }));
  expect(screen.getByText('1 activity')).toBeVisible();

  jest
    .mocked(useManagerSchedule)
    .mockReturnValue(state({ data: { ...data, scheduleVersion: 8 } }));
  await view.rerender(<ScheduleScreen />);
  expect(screen.getByText('Schedule v8')).toBeVisible();
  expect(screen.getByText('2 activities')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'All disciplines' }).props
      .accessibilityState,
  ).toEqual({ selected: true });
});

it('paginates long schedules without carrying expanded records', async () => {
  const activities = Array.from({ length: 26 }, (_, index) => ({
    ...activity,
    id: `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    externalId: `PIP-${String(index).padStart(4, '0')}`,
    name: `Activity ${index}`,
  }));
  jest
    .mocked(useManagerSchedule)
    .mockReturnValue(state({ data: { ...data, activities } }));
  await render(<ScheduleScreen />);
  expect(screen.getByText('1–25 of 26')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Next activities' }),
  );
  expect(screen.getByText('26–26 of 26')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Next activities' }),
  ).toBeDisabled();
});

it('renders loading, no-schedule, error, offline and role states explicitly', async () => {
  jest
    .mocked(useManagerSchedule)
    .mockReturnValue(state({ data: undefined, pending: true, context: null }));
  const view = await render(<ScheduleScreen />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();

  jest.mocked(useManagerSchedule).mockReturnValue(
    state({
      data: {
        ...data,
        revisionId: null,
        revisionLabel: null,
        activities: [],
      },
    }),
  );
  await view.rerender(<ScheduleScreen />);
  expect(screen.getByText('No active reporting schedule')).toBeVisible();

  jest
    .mocked(useManagerSchedule)
    .mockReturnValue(
      state({ data: undefined, error: new ScheduleReadError('changed') }),
    );
  await view.rerender(<ScheduleScreen />);
  expect(screen.getByText('Schedule unavailable')).toBeVisible();
  expect(screen.getByText(/active schedule changed/)).toBeVisible();

  jest.mocked(useManagerSchedule).mockReturnValue(state({ offline: true }));
  await view.rerender(<ScheduleScreen />);
  expect(screen.getByText(/Showing the last loaded schedule/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();

  jest
    .mocked(useManagerSchedule)
    .mockReturnValue(state({ data: undefined, authorized: false }));
  await view.rerender(<ScheduleScreen />);
  expect(screen.getByText('Manager access required')).toBeVisible();
});
