import { cleanup, render, screen } from '@testing-library/react-native';

import { ManagerOverviewScreen } from './ManagerOverviewScreen';
import { OverviewReadError } from './overviewService';
import { useManagerOverview } from './useManagerOverview';

import type { ManagerOverviewData } from './overviewService';
import type { ProjectContext } from '@/features/projects/myWorkService';

jest.mock('./useManagerOverview', () => ({ useManagerOverview: jest.fn() }));
jest.mock('@/features/projects/myWork', () => ({
  siteToday: () => '2026-09-24',
}));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const revisionId = '10000000-0000-4000-8000-000000000003';
const activityId = '10000000-0000-4000-8000-000000000004';
const claimId = '10000000-0000-4000-8000-000000000005';
const context: ProjectContext = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Planner',
    role: 'planner',
    active: true,
    version: 3,
  },
  project: { id: projectId, name: 'Refinery upgrade' },
};
const activity = {
  id: activityId,
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
  hierarchyPath: [],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: '',
  calendar: 'Standard',
};
const attention = {
  id: claimId,
  project_id: projectId,
  report_id: '10000000-0000-4000-8000-000000000006',
  report_version: 1,
  run_id: '10000000-0000-4000-8000-000000000007',
  ordinal: 0,
  facts: {
    kind: 'START',
    activityHint: 'Line erection',
    location: 'Unit 2',
    stage: 'Erection',
    discipline: 'Piping',
    scope: 'activity',
    fullScope: true,
    eventDate: '2026-09-23',
    dateOrigin: 'source_text',
    quantity: null,
    evidenceQuote: 'Line erection started',
    qualifiers: [],
    missingFields: [],
  },
  validation_flags: ['Start date needs review'],
  state: 'pending',
  version: 1,
  plan_revision_id: revisionId,
  policy_version: 2,
  parent_claim_id: null,
  root_claim_id: null,
  followup_round: 0,
  manual_review: false,
  correction_of_event_id: null,
};
const accepted = {
  eventId: '10000000-0000-4000-8000-000000000008',
  claimId,
  reportId: attention.report_id,
  decisionId: '10000000-0000-4000-8000-000000000009',
  auditId: 41,
  activityId,
  externalId: 'PIP-1201',
  activityName: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  revisionId,
  eventKind: 'START',
  eventDate: '2026-09-23',
  quote: 'Line erection started',
  reason: 'Evidence checked',
  reviewer: 'Project planner',
  reviewerId: userId,
  acceptedAt: '2026-09-23T10:30:00+00:00',
  effective: true,
  supersedesEventId: null,
  sourceId: 'VOICE-41',
  source: 'Line erection started',
  sourceUrl: `/planner/review?claim=${claimId}`,
  provenance: { reportedByLabel: 'Site reporter' },
  media: [],
  matchScore: 0.94,
  matchReasons: { location: 1 },
  calendar: 'Standard',
  facts: {
    eventDate: '2026-09-23',
    evidenceQuote: 'Line erection started',
  },
};
const attentions = Array.from({ length: 5 }, (_, index) => ({
  ...attention,
  id: `10000000-0000-4000-8000-${String(index + 5).padStart(12, '0')}`,
  facts: {
    ...attention.facts,
    activityHint: index === 0 ? 'Line erection' : `Activity ${index + 1}`,
    evidenceQuote:
      index === 0 ? 'Line erection started' : `Evidence ${index + 1}`,
  },
  validation_flags: [
    index === 0 ? 'Start date needs review' : `Review reason ${index + 1}`,
  ],
}));
const data = {
  snapshot: {
    projectId,
    projectName: 'Refinery upgrade',
    revisionId,
    revisionLabel: 'Imported baseline 01',
    nodes: [],
    policyVersion: 2,
    scheduleVersion: 7,
    activities: [
      activity,
      {
        ...activity,
        id: '10000000-0000-4000-8000-000000000010',
        externalId: 'PIP-1202',
        name: 'Pressure testing',
        actualFinish: '2026-09-23',
      },
      {
        ...activity,
        id: '10000000-0000-4000-8000-000000000011',
        externalId: 'CIV-0401',
        name: 'Pump foundation',
        discipline: 'Civil',
        actualStart: null,
        actualFinish: null,
        reportedProgress: true,
      },
    ],
  },
  history: [accepted],
  attention: attentions,
  actionableCount: 6,
} as unknown as ManagerOverviewData;

function state(
  overrides: {
    data?: ManagerOverviewData;
    error?: Error | null;
    pending?: boolean;
    offline?: boolean;
    authorized?: boolean;
    context?: ProjectContext | null;
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
    overview: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : data,
      error: overrides.error ?? null,
      isFetching: false,
    },
    refresh: jest.fn().mockResolvedValue(undefined),
    authorized: overrides.authorized ?? true,
  } as unknown as ReturnType<typeof useManagerOverview>;
}

beforeEach(() => jest.mocked(useManagerOverview).mockReturnValue(state()));
afterEach(cleanup);

it('shows the manager panel with supported task counts and unavailable metrics', async () => {
  await render(<ManagerOverviewScreen />);
  expect(screen.getByRole('header', { name: 'Manager Panel' })).toBeVisible();
  expect(screen.getByText(/Imported baseline 01/)).toBeVisible();
  expect(screen.getByText('1/3')).toBeVisible();
  expect(screen.getByText('TIMELINE SCHEDULER')).toBeVisible();
  expect(screen.getByText('RECENT VERIFIED FIELD UPDATES')).toBeVisible();
  expect(
    screen.getByText(/accepted-finished tasks out of 3 planned/),
  ).toBeVisible();
  expect(screen.getAllByText('Not recorded')).toHaveLength(4);
  expect(screen.queryByText(/healthy/i)).toBeNull();
});

it('renders real discipline progress and verified update provenance', async () => {
  await render(<ManagerOverviewScreen />);
  expect(
    screen.getByLabelText('Civil: 0 of 1 activities complete'),
  ).toBeVisible();
  expect(
    screen.getByLabelText('Piping: 1 of 2 activities complete'),
  ).toBeVisible();
  expect(screen.getByText(/activity-count completion/)).toBeVisible();
  expect(screen.getByText(/Actual start accepted/)).toBeVisible();
  expect(screen.getByText('Site reporter')).toBeVisible();
  expect(screen.getByText('PIP-1201 · Line erection')).toBeVisible();
  expect(screen.getByText(/ago|Just now/)).toBeVisible();
});

it('keeps no-schedule, unresolved progress and empty records explicit', async () => {
  jest.mocked(useManagerOverview).mockReturnValue(
    state({
      data: {
        ...data,
        snapshot: {
          ...data.snapshot,
          revisionId: null,
          revisionLabel: null,
          nodes: [],
          activities: [],
        },
        history: [],
        attention: [],
        actionableCount: 0,
      },
    }),
  );
  await render(<ManagerOverviewScreen />);
  expect(screen.getByText(/No active schedule · Schedule v7/)).toBeVisible();
  expect(screen.getByText(/activity counts stay at zero/)).toBeVisible();
  expect(screen.getByText('0/0')).toBeVisible();
  expect(screen.getByText(/No verified field updates/)).toBeVisible();
  expect(screen.getByText(/No active schedule activities/)).toBeVisible();
});

it('renders loading, no-access, wrong-role, error and offline states', async () => {
  jest
    .mocked(useManagerOverview)
    .mockReturnValue(state({ data: undefined, pending: true, context: null }));
  const view = await render(<ManagerOverviewScreen />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();

  jest
    .mocked(useManagerOverview)
    .mockReturnValue(state({ data: undefined, context: null }));
  await view.rerender(<ManagerOverviewScreen />);
  expect(screen.getByText('No active project access')).toBeVisible();

  jest
    .mocked(useManagerOverview)
    .mockReturnValue(state({ data: undefined, authorized: false }));
  await view.rerender(<ManagerOverviewScreen />);
  expect(screen.getByText('Manager access required')).toBeVisible();

  jest
    .mocked(useManagerOverview)
    .mockReturnValue(
      state({ data: undefined, error: new OverviewReadError('changed') }),
    );
  await view.rerender(<ManagerOverviewScreen />);
  expect(screen.getByText('Overview unavailable')).toBeVisible();
  expect(screen.getByText(/changed while loading/)).toBeVisible();

  jest.mocked(useManagerOverview).mockReturnValue(state({ offline: true }));
  await view.rerender(<ManagerOverviewScreen />);
  expect(screen.getByText(/Showing the last loaded overview/)).toBeVisible();
  expect(
    screen.getByTestId('manager-panel-scroll').props.refreshControl.props
      .enabled,
  ).toBe(false);
});
