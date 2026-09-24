import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { ReviewQueueScreen } from './ReviewQueueScreen';
import { ReviewReadError } from './reviewQueueService';
import { useReviewQueue } from './useReviewQueue';

import type { ProjectContext } from '@/features/projects/myWorkService';

jest.mock('./useReviewQueue', () => ({ useReviewQueue: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void) => callback()),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const revisionId = '10000000-0000-4000-8000-000000000005';
const activityId = '10000000-0000-4000-8000-000000000006';
const item = {
  claim: {
    id: claimId,
    project_id: projectId,
    report_id: reportId,
    report_version: 1,
    run_id: '10000000-0000-4000-8000-000000000007',
    ordinal: 0,
    facts: {
      kind: 'FINISH' as const,
      activityHint: 'PIP-1201',
      location: 'Unit 2',
      stage: 'Erection',
      discipline: 'Piping',
      scope: 'activity' as const,
      fullScope: true,
      eventDate: '2026-09-23',
      dateOrigin: 'source_text' as const,
      quantity: null,
      evidenceQuote: 'Line erection finished',
      qualifiers: ['NDT record pending'],
      missingFields: [],
    },
    validation_flags: ['Finish has unresolved qualifications'],
    state: 'pending' as const,
    version: 1,
    plan_revision_id: revisionId,
    policy_version: 1,
    parent_claim_id: null,
    root_claim_id: null,
    followup_round: 0,
    manual_review: false,
    correction_of_event_id: null,
  },
  report: {
    id: reportId,
    project_id: projectId,
    author_id: userId,
    received_at: '2026-09-23T08:30:00+00:00',
    source_kind: 'voice' as const,
  },
  original: {
    report_id: reportId,
    version: 1 as const,
    source_text: 'Line erection finished in Unit 2. NDT record pending.',
    work_date: '2026-09-23',
    selected_activity_id: null,
    context: {},
  },
  reporterName: 'Field supervisor',
  candidates: [
    {
      claim_id: claimId,
      project_id: projectId,
      activity_id: activityId,
      revision_id: revisionId,
      rank: 1,
      score: 0.9,
      features: { location: 1 },
      mismatch_flags: [],
      activity: {
        id: activityId,
        projectId,
        revisionId,
        externalId: 'PIP-1201',
        name: 'Line erection',
        location: 'Unit 2',
      },
    },
  ],
  currentRevisionId: revisionId,
};
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
    queue: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : { items: [item], page: 0, pageSize: 20, total: 1, hasNext: false },
      error: overrides.error ?? null,
      isFetching: false,
    },
    refresh: jest.fn().mockResolvedValue(undefined),
    authorized: overrides.authorized ?? true,
    page: 0,
  } as unknown as ReturnType<typeof useReviewQueue>;
}

beforeEach(() => {
  jest.mocked(useReviewQueue).mockReturnValue(state());
});
afterEach(cleanup);

it('shows unresolved evidence and expands the verbatim report with match reasons', async () => {
  await render(<ReviewQueueScreen />);
  expect(screen.getByText('1 unresolved claim')).toBeVisible();
  expect(screen.getByText('Needs review')).toBeVisible();
  expect(screen.getByText(/Field supervisor · Voice report/)).toBeVisible();
  expect(screen.queryByText(item.original.source_text)).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Review report context' }),
  );
  expect(screen.getByText(item.original.source_text)).toBeVisible();
  expect(screen.getByText('PIP-1201 · Line erection')).toBeVisible();
  expect(screen.getByText('• Same work location')).toBeVisible();
  expect(screen.getByText('Why it needs review')).toBeVisible();
  expect(screen.getByText('Match score 90%')).toBeVisible();
});

it('marks a historical candidate using the candidate revision itself', async () => {
  const historical = {
    ...item,
    candidates: [
      {
        ...item.candidates[0],
        revision_id: '10000000-0000-4000-8000-000000000008',
        activity: null,
      },
    ],
  };
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: {
        items: [historical],
        page: 0,
        pageSize: 20,
        total: 1,
        hasNext: false,
      },
    }),
  );

  await render(<ReviewQueueScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Review report context' }),
  );

  expect(
    screen.getByText(
      'Candidate belongs to the report’s earlier schedule revision.',
    ),
  ).toBeVisible();
});

it('renders loading, empty and backend error states explicitly', async () => {
  jest
    .mocked(useReviewQueue)
    .mockReturnValue(state({ data: undefined, pending: true, context: null }));
  const view = await render(<ReviewQueueScreen />);
  expect(screen.getByText('Loading your project access…')).toBeVisible();

  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: { items: [], page: 0, pageSize: 20, total: 0, hasNext: false },
    }),
  );
  await view.rerender(<ReviewQueueScreen />);
  expect(screen.getByText('Queue is clear')).toBeVisible();

  jest
    .mocked(useReviewQueue)
    .mockReturnValue(
      state({ data: undefined, error: new ReviewReadError('unavailable') }),
    );
  await view.rerender(<ReviewQueueScreen />);
  expect(screen.getByText('Review queue unavailable')).toBeVisible();
  expect(screen.getByText(/Could not load the review queue/)).toBeVisible();
});

it('blocks non-manager project roles before showing queue content', async () => {
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      authorized: false,
      context: {
        ...context,
        member: { ...context.member, role: 'reporter' },
      },
      data: undefined,
    }),
  );
  await render(<ReviewQueueScreen />);
  expect(screen.getByText('Manager access required')).toBeVisible();
  expect(screen.queryByText('PIP-1201')).toBeNull();
});

it('labels cached content as stale when offline and disables refresh', async () => {
  jest.mocked(useReviewQueue).mockReturnValue(state({ offline: true }));
  await render(<ReviewQueueScreen />);
  expect(
    screen.getByText(/Showing the previously loaded review page/),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
});

it('moves to the next server page without carrying expanded report context', async () => {
  jest.mocked(useReviewQueue).mockImplementation((page) => ({
    ...state({
      data:
        page === 0
          ? { items: [item], page: 0, pageSize: 20, total: 21, hasNext: true }
          : { items: [], page: 1, pageSize: 20, total: 21, hasNext: false },
    }),
    page,
  }));
  await render(<ReviewQueueScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Review report context' }),
  );
  expect(screen.getByText(item.original.source_text)).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2')).toBeVisible();
  expect(screen.queryByText(item.original.source_text)).toBeNull();
  expect(useReviewQueue).toHaveBeenLastCalledWith(1, projectId);
});
