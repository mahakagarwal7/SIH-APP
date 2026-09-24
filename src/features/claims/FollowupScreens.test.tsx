import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { getSupabase } from '@/lib/supabase';

import {
  FollowupWriteError,
  decideVerification,
  respondToClarification,
} from './followupService';
import { ReportFollowupScreen } from './ReportFollowupScreen';
import { useReportFollowups, useVerificationAssignments } from './useFollowups';
import {
  VerificationListScreen,
  VerificationScreen,
} from './VerificationScreens';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./followupService', () => ({
  ...jest.requireActual('./followupService'),
  respondToClarification: jest.fn(),
  decideVerification: jest.fn(),
}));
jest.mock('./useFollowups', () => ({
  useReportFollowups: jest.fn(),
  useVerificationAssignments: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const questionId = '10000000-0000-4000-8000-000000000005';
const requestId = '10000000-0000-4000-8000-000000000006';
const activityId = '10000000-0000-4000-8000-000000000007';
const revisionId = '10000000-0000-4000-8000-000000000008';
const refresh = jest.fn().mockResolvedValue(undefined);
const finish = jest.fn().mockResolvedValue(undefined);
const facts = {
  kind: 'ITEM_PROGRESS' as const,
  activityHint: 'PIP-1201',
  location: 'Unit 2',
  stage: 'Erection',
  discipline: 'Piping',
  scope: 'item' as const,
  fullScope: false,
  eventDate: '2026-09-23',
  dateOrigin: 'source_text' as const,
  quantity: { value: 2, unit: 'supports', mode: 'delta' as const },
  evidenceQuote: 'Installed two supports',
  qualifiers: [],
  missingFields: [],
};
const question = {
  id: questionId,
  project_id: projectId,
  claim_id: claimId,
  report_id: reportId,
  claim_version: 2,
  report_version: 1,
  version: 1,
  reason_code: 'location' as const,
  question_text: 'Where did this work happen?',
  options: [{ activityId, label: 'Unit 2 · PIP-1201' }],
  automatic: true,
  status: 'open' as const,
  created_at: '2026-09-24T00:01:00+00:00',
};
const reportData = {
  report: {
    id: reportId,
    project_id: projectId,
    author_id: userId,
    current_version: 1,
    lifecycle: 'submitted' as const,
    received_at: '2026-09-24T00:00:00+00:00',
    source_kind: 'voice' as const,
  },
  original: {
    report_id: reportId,
    version: 1,
    source_text: 'Installed supports in Unit 2.',
    work_date: '2026-09-23',
  },
  claims: [
    {
      id: claimId,
      project_id: projectId,
      report_id: reportId,
      report_version: 1,
      facts,
      validation_flags: [],
      state: 'clarification' as const,
      version: 2,
    },
  ],
  questions: [question],
  responses: [],
};
const verificationItem = {
  request: {
    id: requestId,
    project_id: projectId,
    claim_id: claimId,
    report_id: reportId,
    activity_id: activityId,
    verifier_id: userId,
    claim_version: 2,
    report_version: 1,
    plan_revision_id: revisionId,
    policy_version: 1,
    assignment_version: 4,
    facts_hash: 'facts',
    version: 1,
    status: 'open' as const,
    allocation_confirmed: false,
    work_confirmed: false,
    created_at: '2026-09-24T00:02:00+00:00',
  },
  reporterName: 'Site reporter',
  original: reportData.original,
  claim: { ...reportData.claims[0], state: 'verification' as const },
  activity: {
    id: activityId,
    projectId,
    revisionId,
    externalId: 'PIP-1201',
    name: 'Install supports',
    location: 'Unit 2',
  },
  decisions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSupabase).mockReturnValue({} as never);
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: reportData,
      error: null,
      isPending: false,
    },
    offline: false,
    refresh,
    finish,
  } as never);
  jest.mocked(useVerificationAssignments).mockReturnValue({
    project: {
      data: {
        member: {
          project_id: projectId,
          user_id: userId,
          display_name: 'Supervisor',
          role: 'supervisor',
          active: true,
          version: 1,
        },
        project: { id: projectId, name: 'Site project' },
      },
      error: null,
      isPending: false,
      offline: false,
    },
    assignments: {
      data: [verificationItem],
      error: null,
      isPending: false,
    },
    refresh,
    finish,
  } as never);
  jest.mocked(respondToClarification).mockResolvedValue({
    reportId,
    reportVersion: 2,
    processing: 'queued',
  });
  jest.mocked(decideVerification).mockResolvedValue({
    verificationId: requestId,
    status: 'confirmed',
    version: 2,
  });
});

it('records one explicit location answer without approving the claim', async () => {
  await render(<ReportFollowupScreen reportId={reportId} />);
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: 'Unit 2 · PIP-1201' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() =>
    expect(respondToClarification).toHaveBeenCalledWith(
      {},
      questionId,
      expect.objectContaining({
        expectedQuestionVersion: 1,
        answer: 'answer',
        activityIds: [activityId],
        text: '',
        eventDate: null,
      }),
    ),
  );
  expect(
    await screen.findByText(/does not approve schedule progress/),
  ).toBeVisible();
});

it('keeps entered clarification details after a stale response', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        questions: [
          {
            ...question,
            reason_code: 'detail',
            options: [],
            question_text: 'What remains?',
          },
        ],
      },
      error: null,
      isPending: false,
    },
    offline: false,
    refresh,
    finish,
  } as never);
  jest
    .mocked(respondToClarification)
    .mockRejectedValue(new FollowupWriteError('stale'));
  await render(<ReportFollowupScreen reportId={reportId} />);
  await fireEvent.changeText(
    screen.getByLabelText('Other details'),
    'NDT remains',
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  expect(await screen.findByDisplayValue('NDT remains')).toBeVisible();
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

it('opens the selected independent check from the My work entry screen', async () => {
  await render(<VerificationListScreen />);
  await fireEvent.press(screen.getByRole('button', { name: /PIP-1201/ }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/field-verifications/[requestId]',
    params: { requestId },
  });
});

it('requires both independent checks and a reason before attesting', async () => {
  await render(<VerificationScreen requestId={requestId} />);
  const submit = screen.getByRole('button', {
    name: 'Record supervisor check',
  });
  expect(submit).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Assignment check: Confirm' }),
  );
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Work check: Confirm' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Reason and evidence checked'),
    'Checked assignment register and installed supports.',
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Record supervisor check' }),
    ).toBeEnabled(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record supervisor check' }),
  );
  await waitFor(() =>
    expect(decideVerification).toHaveBeenCalledWith(
      {},
      requestId,
      expect.objectContaining({
        expectedVersion: 1,
        allocation: 'confirmed',
        work: 'confirmed',
      }),
    ),
  );
  expect(
    await screen.findByText(/planner still makes the schedule decision/),
  ).toBeVisible();
});
