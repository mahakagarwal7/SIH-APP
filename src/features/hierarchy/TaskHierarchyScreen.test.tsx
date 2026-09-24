import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { HierarchyReadError } from './hierarchyService';
import { TaskHierarchyScreen } from './TaskHierarchyScreen';
import { useTaskHierarchy } from './useTaskHierarchy';

import type { HierarchyGraph } from './hierarchyModel';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';

jest.mock('./useTaskHierarchy', () => ({ useTaskHierarchy: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void) => callback()),
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const activityId = '10000000-0000-4000-8000-000000000004';
const activity: ScheduleActivity = {
  id: activityId,
  projectId: '10000000-0000-4000-8000-000000000002',
  revisionId: '10000000-0000-4000-8000-000000000003',
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  stage: 'Erection',
  plannedStart: '2026-09-20',
  plannedFinish: '2026-09-25',
  baselineStart: '2026-09-18',
  baselineFinish: '2026-09-24',
  assignedReporterId: userId,
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
  hierarchyPath: [
    { id: 'PROJECT', name: 'Refinery upgrade' },
    { id: 'AREA-A', name: 'Area A' },
    { id: 'WBS-12', name: 'Piping installation' },
  ],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: 'PIP-1100',
  calendar: 'Mon–Sat',
};
const graph: HierarchyGraph = {
  selectedExternalId: activity.externalId,
  limited: false,
  nodes: [
    {
      externalId: 'PROJECT',
      parentId: null,
      name: 'Refinery upgrade',
      kind: 'summary',
      sourceLevel: 'Project',
      sourceWbs: '1',
      plannedStart: '2026-09-01',
      plannedFinish: '2027-01-31',
      reportable: false,
      activityId: null,
    },
    {
      externalId: 'AREA-A',
      parentId: 'PROJECT',
      name: 'Area A',
      kind: 'summary',
      sourceLevel: 'Area',
      sourceWbs: '1.2',
      plannedStart: '2026-09-10',
      plannedFinish: '2026-11-30',
      reportable: false,
      activityId: null,
    },
    {
      externalId: 'WBS-12',
      parentId: 'AREA-A',
      name: 'Piping installation',
      kind: 'summary',
      sourceLevel: 'WBS package',
      sourceWbs: '1.2.0',
      plannedStart: '2026-09-15',
      plannedFinish: '2026-10-31',
      reportable: false,
      activityId: null,
    },
    {
      externalId: 'PIP-1201',
      parentId: 'WBS-12',
      name: 'Line erection',
      kind: 'task',
      sourceLevel: 'Activity',
      sourceWbs: '1.2.1',
      plannedStart: '2026-09-20',
      plannedFinish: '2026-09-25',
      reportable: true,
      activityId,
    },
    {
      externalId: 'PIP-1202',
      parentId: 'WBS-12',
      name: 'Pressure testing',
      kind: 'task',
      sourceLevel: 'Activity',
      sourceWbs: '1.2.2',
      plannedStart: '2026-09-26',
      plannedFinish: '2026-09-28',
      reportable: true,
      activityId: '10000000-0000-4000-8000-000000000005',
    },
  ],
};
const context = {
  member: {
    project_id: activity.projectId,
    user_id: userId,
    display_name: 'Field worker',
    role: 'reporter' as const,
    active: true,
    version: 1,
  },
  project: { id: activity.projectId, name: 'Refinery upgrade' },
};
const data = {
  activity,
  hierarchy: graph,
  snapshot: {
    projectId: activity.projectId,
    projectName: 'Refinery upgrade',
    revisionId: activity.revisionId,
    revisionLabel: 'Imported baseline 01',
    nodes: [],
    policyVersion: 2,
    scheduleVersion: 7,
    activities: [activity],
  },
};

function state(
  overrides: {
    data?: typeof data;
    error?: Error | null;
    pending?: boolean;
    offline?: boolean;
    context?: typeof context | null;
  } = {},
) {
  const selectedContext =
    overrides.context === undefined ? context : overrides.context;
  return {
    project: {
      data: selectedContext,
      projects: selectedContext ? [selectedContext] : [],
      error: null,
      isPending: overrides.pending ?? false,
      isFetching: false,
      offline: overrides.offline ?? false,
      remembered: false,
      refetch: jest.fn(),
      select: jest.fn(),
    },
    hierarchy: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : data,
      error: overrides.error ?? null,
      isFetching: false,
    },
    refresh: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useTaskHierarchy>;
}

beforeEach(() => jest.mocked(useTaskHierarchy).mockReturnValue(state()));
afterEach(cleanup);

it('shows the exact source path and accepted activity facts', async () => {
  await render(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('Imported baseline 01')).toBeVisible();
  expect(screen.getByText('Schedule v7 · Source relationships')).toBeVisible();
  expect(screen.getAllByText('Refinery upgrade')).toHaveLength(2);
  expect(screen.getByText('Area A')).toBeVisible();
  expect(screen.getByText('Piping installation')).toBeVisible();
  expect(screen.getAllByText('Line erection')).toHaveLength(2);
  expect(screen.getByText('Assigned to you')).toBeVisible();
  expect(screen.getByText('2 of 4 spools accepted')).toBeVisible();
  expect(screen.getByText('Accepted progress: 50% · physical')).toBeVisible();
  expect(
    screen.getByText(/Parent nodes do not receive calculated progress/),
  ).toBeVisible();
});

it('drills from an ancestor into its real children and represents a leaf explicitly', async () => {
  await render(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('No child branches in this snapshot.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /WBS-12/ }));
  expect(screen.getByText('Pressure testing')).toBeVisible();
  expect(screen.queryByText('No child branches in this snapshot.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /PIP-1202/ }));
  expect(screen.getByText('No child branches in this snapshot.')).toBeVisible();
});

it('labels an RLS-limited path and a missing parent without inventing nodes', async () => {
  const limited = {
    ...data,
    hierarchy: {
      ...graph,
      limited: true,
      nodes: [
        { ...graph.nodes[1]!, parentId: 'HIDDEN-PARENT' },
        graph.nodes[3]!,
      ],
    },
  };
  jest.mocked(useTaskHierarchy).mockReturnValue(state({ data: limited }));
  await render(<TaskHierarchyScreen activityId={activityId} />);
  expect(
    screen.getByText(/Broader source branches are unavailable/),
  ).toBeVisible();
  expect(screen.getByText(/Source parent WBS-12 is unavailable/)).toBeVisible();
});

it('resets branch focus when the schedule revision changes', async () => {
  const view = await render(<TaskHierarchyScreen activityId={activityId} />);
  await fireEvent.press(screen.getByRole('button', { name: /WBS-12/ }));
  expect(screen.getByText('Pressure testing')).toBeVisible();
  jest.mocked(useTaskHierarchy).mockReturnValue(
    state({
      data: { ...data, snapshot: { ...data.snapshot, scheduleVersion: 8 } },
    }),
  );
  await view.rerender(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('Schedule v8 · Source relationships')).toBeVisible();
  expect(screen.getByText('No child branches in this snapshot.')).toBeVisible();
});

it('renders loading, access, error and offline states explicitly', async () => {
  jest
    .mocked(useTaskHierarchy)
    .mockReturnValue(state({ data: undefined, pending: true, context: null }));
  const view = await render(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();

  jest
    .mocked(useTaskHierarchy)
    .mockReturnValue(state({ data: undefined, context: null }));
  await view.rerender(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('No active project access')).toBeVisible();

  jest
    .mocked(useTaskHierarchy)
    .mockReturnValue(
      state({ data: undefined, error: new HierarchyReadError('missing') }),
    );
  await view.rerender(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText('Hierarchy unavailable')).toBeVisible();
  expect(
    screen.getByText(/not available in the selected project/),
  ).toBeVisible();

  jest.mocked(useTaskHierarchy).mockReturnValue(state({ offline: true }));
  await view.rerender(<TaskHierarchyScreen activityId={activityId} />);
  expect(screen.getByText(/Showing the last loaded hierarchy/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
});
