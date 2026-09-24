import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import {
  WorkReadError,
  type ProjectContext,
} from '@/features/projects/myWorkService';

import { HistoryScreen } from './HistoryScreen';
import { HistoryReadError } from './historyService';
import { useExecutionHistory } from './useExecutionHistory';

import type { ExecutionHistoryEntry } from './historyContracts';

jest.mock('./useExecutionHistory', () => ({
  useExecutionHistory: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void) => callback()),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const activityId = '10000000-0000-4000-8000-000000000003';
const revisionId = '10000000-0000-4000-8000-000000000004';

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

const entry: ExecutionHistoryEntry = {
  eventId: '10000000-0000-4000-8000-000000000005',
  claimId: '10000000-0000-4000-8000-000000000006',
  reportId: '10000000-0000-4000-8000-000000000007',
  decisionId: '10000000-0000-4000-8000-000000000008',
  auditId: 41,
  activityId,
  externalId: 'PIP-1201',
  activityName: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  revisionId,
  eventKind: 'FINISH',
  eventDate: '2026-09-23',
  quote: 'Line erection finished',
  reason: 'Evidence and activity match were checked.',
  reviewer: 'Project planner',
  reviewerId: userId,
  acceptedAt: '2026-09-23T10:30:00+00:00',
  effective: true,
  supersedesEventId: null,
  sourceId: 'VOICE-41',
  source: 'Line erection finished in Unit 2.',
  sourceUrl: '/planner/review',
  provenance: {
    sourceRecordId: 'VOICE-41',
    sheet: 'Voice_Reports',
    row: 41,
    sourceMessageAt: '2026-09-23T09:15:00+05:30',
    reportingWorkDate: '2026-09-23',
    reportedByLabel: null,
    channel: 'voice',
    raw: {},
    timezone: 'Asia/Kolkata',
    datePolicy: 'confirmed work date',
  },
  media: [],
  matchScore: 0.94,
  matchReasons: { location: 1 },
  calendar: 'Standard',
  facts: {
    eventDate: '2026-09-23',
    evidenceQuote: 'Line erection finished',
  },
};

const activity = {
  id: activityId,
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping' as const,
  location: 'Unit 2',
  assignedReporterId: null,
  targetQuantity: 4,
  unit: 'spools',
  acceptedQuantity: 4,
  actualStart: '2026-09-20',
  actualFinish: '2026-09-23',
  calendar: 'Standard shift',
  reportedProgress: true,
  acceptedPercent: null,
  percentBasis: null,
  progressAsOf: null,
  milestoneDate: null,
  nodeKind: 'task' as const,
};

const data = {
  entries: [entry],
  snapshot: {
    projectId,
    projectName: 'Refinery upgrade',
    revisionId,
    activities: [activity],
  },
};

function state(
  overrides: {
    data?: unknown;
    error?: Error | null;
    projectError?: Error | null;
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
      error: overrides.projectError ?? null,
      isPending: overrides.pending ?? false,
      isFetching: false,
      offline: overrides.offline ?? false,
      remembered: false,
      refetch: jest.fn(),
      select: jest.fn(),
    },
    history: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : data,
      error: overrides.error ?? null,
      isFetching: false,
    },
    refresh: jest.fn().mockResolvedValue(undefined),
    authorized: overrides.authorized ?? true,
    accessDenied: false,
  } as unknown as ReturnType<typeof useExecutionHistory>;
}

beforeEach(() => {
  jest.mocked(useExecutionHistory).mockReturnValue(state());
});
afterEach(cleanup);

it('shows completed work and accepted evidence with inspectable audit facts', async () => {
  await render(<HistoryScreen />);
  expect(screen.getByText('1 activity')).toBeVisible();
  expect(screen.getByText('1 event')).toBeVisible();
  expect(screen.getByText('Calendar: Standard shift')).toBeVisible();
  expect(screen.getByText('Current contribution')).toBeVisible();
  expect(screen.getByText('“Line erection finished”')).toBeVisible();
  expect(screen.queryByText(`Event ${entry.eventId}`)).toBeNull();

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Show audit references for PIP-1201',
    }),
  );
  expect(screen.getByText(`Event ${entry.eventId}`)).toBeVisible();
  expect(screen.getByText('Audit 41')).toBeVisible();
  expect(screen.getByText(entry.source)).toBeVisible();
  expect(screen.getByText(/evidenceQuote/)).toBeVisible();
});

it('shows provenance and voice/photo evidence with a mobile source fallback', async () => {
  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      data: {
        ...data,
        entries: [
          {
            ...entry,
            sourceId: null,
            provenance: null,
            media: [
              {
                attachmentId: '10000000-0000-4000-8000-000000000009',
                kind: 'audio',
                sha256: 'a'.repeat(64),
                caption: '',
                originalTranscript: 'The south line is complete.',
                provider: 'transcriber',
                model: 'field-v2',
                language: 'en',
              },
              {
                attachmentId: '10000000-0000-4000-8000-000000000010',
                kind: 'photo',
                sha256: 'b'.repeat(64),
                caption: '',
                originalTranscript: null,
                provider: null,
                model: null,
                language: 'en',
              },
            ],
          },
        ],
      },
    }),
  );
  await render(<HistoryScreen />);
  expect(screen.getByText(/Mobile capture/)).toBeVisible();
  expect(screen.getByText('The south line is complete.')).toBeVisible();
  expect(screen.getByText('Photo caption: No caption supplied')).toBeVisible();
});

it('shows imported-source provenance and explicit missing-value labels', async () => {
  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      data: {
        ...data,
        entries: [
          {
            ...entry,
            reviewer: '',
            provenance: {
              ...entry.provenance!,
              reportedByLabel: null,
              sourceMessageAt: null,
              reportingWorkDate: null,
            },
          },
        ],
      },
    }),
  );
  await render(<HistoryScreen />);
  expect(screen.getByText(/Voice_Reports/)).toBeVisible();
  expect(screen.getByText(/row 41/)).toBeVisible();
  expect(screen.getByText(/Named in source: Not supplied/)).toBeVisible();
  expect(screen.getByText(/Message time: Not supplied/)).toBeVisible();
  expect(screen.getByText(/Work date: Not supplied/)).toBeVisible();
  expect(screen.getByText(/Accepted by Name not recorded/)).toBeVisible();
});

it('labels reports without source identifiers or media as text reports', async () => {
  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      data: {
        ...data,
        entries: [
          {
            ...entry,
            sourceId: null,
            provenance: null,
            media: null,
          },
        ],
      },
    }),
  );
  await render(<HistoryScreen />);
  expect(screen.getByText(/Text report/)).toBeVisible();
});

it('shows cached history as stale after a temporary refresh failure', async () => {
  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(state({ error: new HistoryReadError('unavailable') }));
  await render(<HistoryScreen />);
  expect(screen.getByText(/Showing previously loaded history/)).toBeVisible();
  expect(screen.getByText('1 event')).toBeVisible();
  expect(screen.getByText('“Line erection finished”')).toBeVisible();
});

it('hides cached history when access is denied', async () => {
  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(state({ error: new HistoryReadError('access') }));
  await render(<HistoryScreen />);
  expect(
    screen.getByText('Manager access is no longer available for this project.'),
  ).toBeVisible();
  expect(screen.queryByText('“Line erection finished”')).toBeNull();
});

it('does not restore cached history after denial when project refresh also fails', async () => {
  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      error: new HistoryReadError('access'),
      projectError: new WorkReadError('unavailable'),
    }),
  );
  await render(<HistoryScreen />);
  expect(
    screen.getByText(/Manager access is no longer available/),
  ).toBeVisible();
  expect(screen.queryByText('“Line erection finished”')).toBeNull();
});

it('does not restore cached history after denial when the next history read fails', async () => {
  jest.mocked(useExecutionHistory).mockReturnValue({
    ...state({ error: new HistoryReadError('unavailable') }),
    accessDenied: true,
  });
  await render(<HistoryScreen />);
  expect(
    screen.getByText(/Manager access is no longer available/),
  ).toBeVisible();
  expect(screen.queryByText('“Line erection finished”')).toBeNull();
});

it('filters by wording, evidence state and completed activity', async () => {
  await render(<HistoryScreen />);
  await fireEvent.changeText(
    screen.getByLabelText('Find accepted work'),
    'not present',
  );
  expect(screen.getByText(/No completed activities match/)).toBeVisible();
  expect(screen.getByText(/No accepted events match/)).toBeVisible();

  await fireEvent.press(
    screen.getByRole('button', { name: 'Clear history filters' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Replaced' }));
  expect(screen.getByText(/No accepted events match/)).toBeVisible();

  await fireEvent.press(
    screen.getByRole('button', { name: 'Clear history filters' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Filter history to PIP-1201' }),
  );
  expect(screen.getByText('Showing one selected activity.')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Show all activities' }),
  );
  expect(screen.queryByText('Showing one selected activity.')).toBeNull();
});

it('paginates accepted evidence twenty records at a time', async () => {
  const entries = Array.from({ length: 21 }, (_, index) => ({
    ...entry,
    eventId: `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    decisionId: `20000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    sourceId: `VOICE-${index}`,
  }));
  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(state({ data: { ...data, entries } }));
  await render(<HistoryScreen />);
  expect(screen.getByText('1–20 of 21')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Next records' }));
  expect(screen.getByText('21–21 of 21')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next records' })).toBeDisabled();
});

it('paginates completed activities twenty records at a time', async () => {
  const activities = Array.from({ length: 21 }, (_, index) => ({
    ...activity,
    id: `30000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    externalId: `PIP-${1201 + index}`,
  }));
  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      data: { ...data, snapshot: { ...data.snapshot, activities } },
    }),
  );
  await render(<HistoryScreen />);
  expect(screen.getByText('1–20 of 21')).toBeVisible();
  expect(screen.queryByText('PIP-1221 · Piping')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Next activities' }),
  );
  expect(screen.getByText('21–21 of 21')).toBeVisible();
  expect(screen.getByText('PIP-1221 · Piping')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Next activities' }),
  ).toBeDisabled();
});

it('renders access, loading, empty, backend and offline states explicitly', async () => {
  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(state({ data: undefined, pending: true, context: null }));
  const view = await render(<HistoryScreen />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();

  jest.mocked(useExecutionHistory).mockReturnValue(
    state({
      data: {
        ...data,
        entries: [],
        snapshot: { ...data.snapshot, activities: [] },
      },
    }),
  );
  await view.rerender(<HistoryScreen />);
  expect(screen.getByText(/No accepted events match/)).toBeVisible();

  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(
      state({ data: undefined, error: new HistoryReadError('limit') }),
    );
  await view.rerender(<HistoryScreen />);
  expect(screen.getByText('Execution history unavailable')).toBeVisible();
  expect(screen.getByText(/too large for the mobile view/)).toBeVisible();

  jest.mocked(useExecutionHistory).mockReturnValue(state({ offline: true }));
  await view.rerender(<HistoryScreen />);
  expect(screen.getByText(/Showing previously loaded history/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();

  jest
    .mocked(useExecutionHistory)
    .mockReturnValue(state({ authorized: false, data: undefined }));
  await view.rerender(<HistoryScreen />);
  expect(screen.getByText('Manager access required')).toBeVisible();
});
