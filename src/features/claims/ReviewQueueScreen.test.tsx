import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { ReviewQueueScreen } from './ReviewQueueScreen';
import * as reviewQueueService from './reviewQueueService';
import { ReviewReadError } from './reviewQueueService';
import { useReviewQueue } from './useReviewQueue';

import type { ProjectContext } from '@/features/projects/myWorkService';

jest.mock('./useReviewQueue', () => ({ useReviewQueue: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
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
      assetTag: null,
      location: 'Unit 2',
      stage: 'Erection',
      discipline: 'Piping',
      scope: 'activity' as const,
      fullScope: true,
      eventDate: '2026-09-23',
      dateOrigin: 'source_text' as const,
      quantity: null,
      evidenceQuote: 'Line erection finished',
      observation: null,
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
  attachments: [],
  media: [],
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
    page?: number;
    accessDenied?: boolean;
    reportAccessDenied?: () => void;
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
    page: overrides.page ?? 0,
    accessDenied: overrides.accessDenied ?? false,
    reportAccessDenied: overrides.reportAccessDenied ?? jest.fn(),
  } as unknown as ReturnType<typeof useReviewQueue>;
}

beforeEach(() => {
  jest.mocked(useReviewQueue).mockReturnValue(state());
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

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
  expect(screen.getByText('Quantity: Not recorded')).toBeVisible();
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

it('labels planner rematches as explicit mappings instead of match scores', async () => {
  const rematched = {
    ...item,
    candidates: [
      {
        ...item.candidates[0],
        score: 0,
        features: { plannerMapping: 1 },
      },
    ],
  };
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: {
        items: [rematched],
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

  expect(screen.getByText('Explicit planner mapping')).toBeVisible();
  expect(
    screen.getByText('• Activity explicitly mapped by planner'),
  ).toBeVisible();
  expect(screen.queryByText('Match score 0%')).toBeNull();
  expect(
    screen.queryByText('• Candidate identified by the matcher'),
  ).toBeNull();
});

it('shows structured observation progress without relying on legacy quantity', async () => {
  const observationItem = {
    ...item,
    claim: {
      ...item.claim,
      facts: {
        ...item.claim.facts,
        kind: 'PERCENT_PROGRESS' as const,
        quantity: null,
        observation: {
          version: 2 as const,
          dateBasis: 'explicit' as const,
          dateEvidence: 'reported on 23 September',
          quantityCoverage: 'component' as const,
          component: 'support braces',
          dailyQuantity: { value: 2, unit: 'm' },
          items: ['BR-01', 'BR-02'],
          coverageStart: '2026-09-22',
          coverageEnd: '2026-09-23',
          percent: { value: 65, basis: 'physical' as const },
          inspectionRelation: null,
        },
      },
    },
  };
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: {
        items: [observationItem],
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

  expect(screen.getByText('Reported percentage: 65% · physical')).toBeVisible();
  expect(
    screen.getByText('Quantity coverage: component · support braces'),
  ).toBeVisible();
  expect(screen.getByText('Daily reading: 2 m')).toBeVisible();
  expect(screen.getByText('Explicit items: BR-01, BR-02')).toBeVisible();
  expect(screen.getByText(/Coverage dates:/)).toHaveTextContent(
    'Coverage dates: 22 Sept 2026 – 23 Sept 2026',
  );
});

it('does not invent activity scope when an observation component is missing', async () => {
  const unknownScopeItem = {
    ...item,
    claim: {
      ...item.claim,
      facts: {
        ...item.claim.facts,
        kind: 'PERCENT_PROGRESS' as const,
        observation: {
          version: 2 as const,
          dateBasis: 'missing' as const,
          dateEvidence: '',
          quantityCoverage: 'unknown' as const,
          component: null,
          dailyQuantity: null,
          items: [],
          coverageStart: null,
          coverageEnd: null,
          percent: null,
          inspectionRelation: null,
        },
      },
    },
  };
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: {
        items: [unknownScopeItem],
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
    screen.getByText('Quantity coverage: unknown · Not recorded'),
  ).toBeVisible();
});

it('shows original media evidence and correction context in the report review', async () => {
  const correctionItem = {
    ...item,
    claim: {
      ...item.claim,
      correction_of_event_id: '10000000-0000-4000-8000-000000000009',
    },
    attachments: [
      {
        id: '10000000-0000-4000-8000-000000000010',
        project_id: projectId,
        report_id: reportId,
        file_name: 'shift-audio.wav',
        mime_type: 'audio/wav',
        byte_size: 1200,
        sha256: 'a'.repeat(64),
        caption: '',
        media_kind: 'audio' as const,
        language: 'en',
      },
      {
        id: '10000000-0000-4000-8000-000000000011',
        project_id: projectId,
        report_id: reportId,
        file_name: 'north-rack.jpg',
        mime_type: 'image/jpeg',
        byte_size: 3200,
        sha256: 'b'.repeat(64),
        caption: 'North rack welds',
        media_kind: 'photo' as const,
        language: 'en',
      },
    ],
    media: [
      {
        attachmentId: '10000000-0000-4000-8000-000000000010',
        kind: 'audio' as const,
        sha256: 'a'.repeat(64),
        caption: '',
        originalTranscript: 'Line erection finished in Unit 2.',
        provider: 'fixture',
        model: 'speech-v1',
        language: 'en',
      },
      {
        attachmentId: '10000000-0000-4000-8000-000000000011',
        kind: 'photo' as const,
        sha256: 'b'.repeat(64),
        caption: 'North rack welds',
        originalTranscript: null,
        provider: null,
        model: null,
        language: 'en',
      },
    ],
  };
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      data: {
        items: [correctionItem],
        page: 0,
        pageSize: 20,
        total: 1,
        hasNext: false,
      },
    }),
  );
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const createUrl = jest
    .spyOn(reviewQueueService, 'createReviewEvidenceUrl')
    .mockResolvedValue('https://example.supabase.co/signed-evidence');
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);

  await render(<ReviewQueueScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Review report context' }),
  );

  expect(screen.getByText('Original media evidence')).toBeVisible();
  expect(
    screen.getByText('Original transcript: Line erection finished in Unit 2.'),
  ).toBeVisible();
  expect(screen.getByText('Photo caption: North rack welds')).toBeVisible();
  expect(screen.getByText(/SHA-256 a{64}/)).toBeVisible();
  expect(screen.getByText(/Correction proposal/)).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: 'Open original audio: shift-audio.wav',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Open original photo: north-rack.jpg' }),
  ).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Open original audio: shift-audio.wav',
    }),
  );
  await waitFor(() =>
    expect(createUrl).toHaveBeenCalledWith(
      expect.any(Object),
      context,
      reportId,
      '10000000-0000-4000-8000-000000000010',
      expect.any(AbortSignal),
    ),
  );
  expect(openUrl).toHaveBeenCalledWith(
    'https://example.supabase.co/signed-evidence',
  );
});

it('reports access denial when opening evidence fails with revoked membership', async () => {
  const reportAccessDenied = jest.fn();
  const attachmentId = '10000000-0000-4000-8000-000000000010';
  const evidenceItem = {
    ...item,
    attachments: [
      {
        id: attachmentId,
        project_id: projectId,
        report_id: reportId,
        file_name: 'shift-audio.wav',
        mime_type: 'audio/wav',
        byte_size: 1200,
        sha256: 'a'.repeat(64),
        caption: '',
        media_kind: 'audio' as const,
        language: 'en',
      },
    ],
    media: [],
  };
  jest.mocked(useReviewQueue).mockImplementation((page) => ({
    ...state({
      data: {
        items: [evidenceItem],
        page: 0,
        pageSize: 20,
        total: 1,
        hasNext: false,
      },
      reportAccessDenied,
    }),
    page,
  }));
  jest
    .spyOn(reviewQueueService, 'createReviewEvidenceUrl')
    .mockRejectedValue(new ReviewReadError('access'));
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);

  await render(<ReviewQueueScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Review report context' }),
  );
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Open original audio: shift-audio.wav',
    }),
  );

  expect(reportAccessDenied).toHaveBeenCalledTimes(1);
});

it('hides cached claims when useReviewQueue reports access denial', async () => {
  jest
    .mocked(useReviewQueue)
    .mockReturnValue(state({ accessDenied: true, page: 1, data: undefined }));

  await render(<ReviewQueueScreen />);

  expect(screen.getByText('Review queue unavailable')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Return to previous page' }),
  ).toBeNull();
  expect(screen.queryByText('PIP-1201')).toBeNull();
});

it('explains when queue changes leave the selected server page empty', async () => {
  jest.mocked(useReviewQueue).mockImplementation((page) => ({
    ...state({
      data: { items: [], page: 1, pageSize: 20, total: 19, hasNext: false },
    }),
    page,
  }));

  await render(<ReviewQueueScreen />);

  expect(
    screen.getByText('The review queue changed; this page is now empty.'),
  ).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Return to last available page' }),
  );
  expect(useReviewQueue).toHaveBeenLastCalledWith(0, projectId);
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

it('keeps a cached review page visible when refresh fails', async () => {
  jest
    .mocked(useReviewQueue)
    .mockReturnValue(state({ error: new ReviewReadError('unavailable') }));

  await render(<ReviewQueueScreen />);

  expect(screen.getByText('1 unresolved claim')).toBeVisible();
  expect(screen.getByText('PIP-1201')).toBeVisible();
  expect(
    screen.getByText(
      'Could not refresh. Showing the last loaded review page; claim states may have changed.',
    ),
  ).toBeVisible();
});

it('hides cached review data when the latest response denies access', async () => {
  jest
    .mocked(useReviewQueue)
    .mockReturnValue(state({ error: new ReviewReadError('access') }));

  await render(<ReviewQueueScreen />);

  expect(screen.getByText('Review queue unavailable')).toBeVisible();
  expect(screen.queryByText('PIP-1201')).toBeNull();
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

it('does not request an uncached next page while offline', async () => {
  jest.mocked(useReviewQueue).mockReturnValue(
    state({
      offline: true,
      data: { items: [item], page: 0, pageSize: 20, total: 21, hasNext: true },
    }),
  );

  await render(<ReviewQueueScreen />);

  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it('lets the reviewer return after the next page request fails', async () => {
  jest.mocked(useReviewQueue).mockImplementation((page) => ({
    ...state(
      page === 0
        ? {
            data: {
              items: [item],
              page: 0,
              pageSize: 20,
              total: 21,
              hasNext: true,
            },
          }
        : {
            data: undefined,
            error: new ReviewReadError('unavailable'),
          },
    ),
    page,
  }));

  await render(<ReviewQueueScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

  expect(screen.getByText('Review queue unavailable')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Return to previous page' }),
  );
  expect(useReviewQueue).toHaveBeenLastCalledWith(0, projectId);
});
