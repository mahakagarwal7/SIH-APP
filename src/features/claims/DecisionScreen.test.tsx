import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { getSupabase } from '@/lib/supabase';

import { DecisionScreen } from './DecisionScreen';
import {
  DecisionWriteError,
  previewDecision,
  requestClarification,
  requestVerification,
  submitDecision,
} from './decisionService';
import { useDecisionContext } from './useDecisionContext';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./decisionService', () => ({
  ...jest.requireActual('./decisionService'),
  previewDecision: jest.fn(),
  submitDecision: jest.fn(),
  requestClarification: jest.fn(),
  requestVerification: jest.fn(),
}));
jest.mock('./useDecisionContext', () => ({ useDecisionContext: jest.fn() }));
let mockUuidSequence = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `10000000-0000-4000-8000-${String(++mockUuidSequence).padStart(12, '0')}`,
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => callback(),
  useRouter: () => ({
    canGoBack: () => true,
    back: mockBack,
    replace: jest.fn(),
  }),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const runId = '10000000-0000-4000-8000-000000000005';
const revisionId = '10000000-0000-4000-8000-000000000006';
const activityId = '10000000-0000-4000-8000-000000000007';
const context = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Planner',
    role: 'planner' as const,
    active: true,
    version: 3,
  },
  project: { id: projectId, name: 'Refinery upgrade' },
};
const candidate = {
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
    actualsVersion: 4,
    unit: 'spools',
  },
};
const data = {
  claim: {
    id: claimId,
    project_id: projectId,
    report_id: reportId,
    report_version: 1,
    run_id: runId,
    ordinal: 0,
    facts: {
      kind: 'START' as const,
      activityHint: 'PIP-1201',
      location: 'Unit 2',
      stage: 'Erection',
      discipline: 'Piping',
      scope: 'activity' as const,
      fullScope: true,
      eventDate: '2026-09-23',
      dateOrigin: 'source_text' as const,
      quantity: null,
      evidenceQuote: 'Line erection started',
      qualifiers: [],
      missingFields: [],
    },
    validation_flags: [],
    state: 'pending' as const,
    version: 2,
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
    current_version: 1,
    lifecycle: 'submitted' as const,
    received_at: '2026-09-23T08:30:00+00:00',
    source_kind: 'voice' as const,
  },
  original: {
    report_id: reportId,
    version: 1 as const,
    source_text: 'Line erection started in Unit 2.',
    work_date: '2026-09-23',
    selected_activity_id: null,
    context: {},
  },
  reporterName: 'Field supervisor',
  candidates: [candidate],
  snapshot: {
    projectId,
    revisionId,
    policyVersion: 1,
    scheduleVersion: 7,
    activities: [candidate.activity],
  },
  verification: null,
};
const actuals = {
  actual_start: null,
  actual_finish: null,
  accepted_quantity: 0,
  accepted_percent: null,
  percent_basis: null,
  progress_as_of: null,
  milestone_date: null,
  version: 4,
};
const preview = {
  activityId,
  activityName: 'Line erection',
  before: actuals,
  after: { ...actuals, actual_start: '2026-09-23', version: 5 },
  disposition: 'applied',
  previewHash: 'a'.repeat(64),
};
const refresh = jest.fn();
const finish = jest.fn();

function hookState(
  overrides: {
    data?: unknown;
    error?: Error | null;
    pending?: boolean;
    offline?: boolean;
    authorized?: boolean;
  } = {},
) {
  return {
    project: {
      data: context,
      projects: [context],
      error: null,
      isPending: false,
      isFetching: false,
      offline: overrides.offline ?? false,
      remembered: false,
      refetch: jest.fn(),
      select: jest.fn(),
    },
    decision: {
      data: Object.prototype.hasOwnProperty.call(overrides, 'data')
        ? overrides.data
        : data,
      error: overrides.error ?? null,
      isPending: overrides.pending ?? false,
      refetch: jest.fn(),
    },
    refresh,
    finish,
    authorized: overrides.authorized ?? true,
  } as unknown as ReturnType<typeof useDecisionContext>;
}

beforeEach(() => {
  mockUuidSequence = 0;
  mockBack.mockReset();
  refresh.mockClear();
  finish.mockClear();
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
  jest.mocked(useDecisionContext).mockReturnValue(hookState());
  jest.mocked(previewDecision).mockReset().mockResolvedValue(preview);
  jest.mocked(submitDecision).mockReset().mockResolvedValue({
    state: 'accepted',
    claimId,
    activityId,
    scheduleVersion: 8,
  });
  jest
    .mocked(requestClarification)
    .mockReset()
    .mockResolvedValue({ questionId: userId });
  jest.mocked(requestVerification).mockReset().mockResolvedValue({
    verificationId: userId,
    status: 'open',
  });
});
afterEach(cleanup);

async function selectCandidateAndReason() {
  await fireEvent.press(screen.getByRole('radio', { name: /PIP-1201/ }));
  await fireEvent.changeText(
    screen.getByLabelText('Decision reason'),
    'Evidence confirms this activity.',
  );
}

it('requires deliberate activity selection and exact preview before acceptance', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  expect(screen.getByText(data.original.source_text)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Preview change' })).toBeDisabled();
  await selectCandidateAndReason();
  await fireEvent.press(screen.getByRole('button', { name: 'Preview change' }));
  await waitFor(() => expect(previewDecision).toHaveBeenCalledTimes(1));
  const previewCommand = jest.mocked(previewDecision).mock.calls[0]?.[1];
  expect(previewCommand).toMatchObject({
    activityId,
    expectedActualsVersion: 4,
    expectedClaimVersion: 2,
    expectedPolicyVersion: 1,
    action: 'accept',
  });
  expect(screen.getByText('Proposed schedule change')).toBeVisible();
  expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Accept verified event' }),
  );
  await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
  expect(jest.mocked(submitDecision).mock.calls[0]?.[1]).toEqual({
    ...previewCommand,
    previewHash: preview.previewHash,
  });
  expect(finish).toHaveBeenCalledWith(true);
  expect(mockBack).toHaveBeenCalled();
});

it('previews and submits when a planner types a reason and taps Accept directly', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  await selectCandidateAndReason();
  const accept = screen.getByRole('button', {
    name: 'Accept verified event',
  });
  expect(accept).toBeEnabled();
  await fireEvent.press(accept);
  await waitFor(() => expect(previewDecision).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
  expect(jest.mocked(submitDecision).mock.calls[0]?.[1]).toMatchObject({
    action: 'accept',
    previewHash: preview.previewHash,
    reason: 'Evidence confirms this activity.',
  });
  expect(finish).toHaveBeenCalledWith(true);
});

it('records rejection with a reason without inventing an activity selection', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  await fireEvent.changeText(
    screen.getByLabelText('Decision reason'),
    'Evidence is not credible.',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Reject claim' }));
  await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
  expect(jest.mocked(submitDecision).mock.calls[0]?.[1]).toMatchObject({
    action: 'reject',
    activityId: null,
    reason: 'Evidence is not credible.',
  });
  expect(finish).toHaveBeenCalledWith(true);
});

it('does not invent an optional corrected date for rejection', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  await fireEvent.changeText(
    screen.getByLabelText('Decision reason'),
    'Evidence is not credible.',
  );
  const rejectButton = screen.getByRole('button', { name: 'Reject claim' });
  expect(rejectButton).toBeEnabled();
  await fireEvent.press(rejectButton);

  await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
  expect(jest.mocked(submitDecision).mock.calls[0]?.[1]).toMatchObject({
    action: 'reject',
    correctedDate: null,
  });
});

it('visibly marks selected reconciliation and clarification reasons', async () => {
  const progressData = {
    ...data,
    claim: {
      ...data.claim,
      facts: { ...data.claim.facts, kind: 'ITEM_PROGRESS' as const },
    },
  };
  jest
    .mocked(useDecisionContext)
    .mockReturnValue(hookState({ data: progressData }));
  await render(<DecisionScreen claimId={claimId} />);

  const reconciliation = screen.getByRole('radio', {
    name: 'Equivalent reading already recorded',
  });
  await fireEvent.press(reconciliation);
  expect(reconciliation).toHaveStyle({
    backgroundColor: '#edf5f8',
    borderColor: '#266b8c',
    borderWidth: 2,
  });

  const clarification = screen.getByRole('radio', { name: 'Work location' });
  await fireEvent.press(clarification);
  expect(clarification).toHaveStyle({
    backgroundColor: '#edf5f8',
    borderColor: '#266b8c',
    borderWidth: 2,
  });
});

it('locks preview inputs until the current preview response arrives', async () => {
  let resolvePreview!: (result: typeof preview) => void;
  jest.mocked(previewDecision).mockReturnValue(
    new Promise((resolve) => {
      resolvePreview = resolve;
    }),
  );
  await render(<DecisionScreen claimId={claimId} />);
  await selectCandidateAndReason();
  await fireEvent.press(screen.getByRole('button', { name: 'Preview change' }));

  expect(screen.getByLabelText('Decision reason').props.editable).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Choose corrected work date' }),
  ).toBeDisabled();
  expect(screen.getByRole('radio', { name: /PIP-1201/ })).toBeDisabled();

  resolvePreview(preview);
  expect(await screen.findByText('Proposed schedule change')).toBeVisible();
});

it('requests a specific clarification without accepting the claim', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Work location' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Ask reporter' }));
  await waitFor(() => expect(requestClarification).toHaveBeenCalledTimes(1));
  expect(jest.mocked(requestClarification).mock.calls[0]?.[2]).toMatchObject({
    expectedClaimVersion: 2,
    reasonCode: 'location',
  });
  await waitFor(() => expect(finish).toHaveBeenCalledWith(false));
  expect(submitDecision).not.toHaveBeenCalled();
});

it('requests independent verification without accepting the claim', async () => {
  await render(<DecisionScreen claimId={claimId} />);
  await selectCandidateAndReason();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Request supervisor verification' }),
  );
  await waitFor(() => expect(requestVerification).toHaveBeenCalledTimes(1));
  expect(jest.mocked(requestVerification).mock.calls[0]?.[2]).toMatchObject({
    activityId,
    expectedClaimVersion: 2,
    reason: 'Evidence confirms this activity.',
  });
  expect(finish).toHaveBeenLastCalledWith(false);
  expect(submitDecision).not.toHaveBeenCalled();
});

it('clears a stale preview and refreshes current versions', async () => {
  jest
    .mocked(previewDecision)
    .mockRejectedValue(
      new DecisionWriteError(
        'stale',
        'The proposed change is no longer current.',
      ),
    );
  await render(<DecisionScreen claimId={claimId} />);
  await selectCandidateAndReason();
  await fireEvent.press(screen.getByRole('button', { name: 'Preview change' }));
  expect(await screen.findByText(/no longer current/)).toBeVisible();
  expect(refresh).toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Accept verified event' }),
  ).toBeEnabled();
});

it('blocks writes offline and shows role/access failures explicitly', async () => {
  jest
    .mocked(useDecisionContext)
    .mockReturnValue(hookState({ offline: true, data: undefined }));
  const view = await render(<DecisionScreen claimId={claimId} />);
  expect(
    screen.getByText(/Decisions require a current production connection/),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Accept verified event' }),
  ).toBeNull();

  jest
    .mocked(useDecisionContext)
    .mockReturnValue(hookState({ data: undefined, authorized: false }));
  await view.rerender(<DecisionScreen claimId={claimId} />);
  expect(screen.getByText('Manager access required')).toBeVisible();
});

it('disables every decision write when cached context becomes offline', async () => {
  const view = await render(<DecisionScreen claimId={claimId} />);
  await selectCandidateAndReason();
  await fireEvent.press(screen.getByRole('button', { name: 'Preview change' }));
  await waitFor(() => expect(previewDecision).toHaveBeenCalledTimes(1));

  jest
    .mocked(useDecisionContext)
    .mockReturnValue(hookState({ offline: true, data }));
  await view.rerender(<DecisionScreen claimId={claimId} />);

  for (const name of [
    'Preview change',
    'Accept verified event',
    'Reject claim',
    'Ask reporter',
    'Request supervisor verification',
  ]) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  expect(previewDecision).toHaveBeenCalledTimes(1);
  expect(submitDecision).not.toHaveBeenCalled();
  expect(requestClarification).not.toHaveBeenCalled();
  expect(requestVerification).not.toHaveBeenCalled();
});
