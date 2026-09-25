import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';

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
let mockUuidSequence = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `10000000-0000-4000-8000-${String(++mockUuidSequence).padStart(12, '0')}`,
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
const secondClaimId = '10000000-0000-4000-8000-000000000010';
const secondQuestionId = '10000000-0000-4000-8000-000000000011';
const refresh = jest.fn().mockResolvedValue(undefined);
const finish = jest.fn().mockResolvedValue(undefined);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
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
const secondQuestion = {
  ...question,
  id: secondQuestionId,
  claim_id: secondClaimId,
  reason_code: 'detail' as const,
  question_text: 'What still needs to be checked?',
  options: [],
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
  scheduleIsCurrent: true,
  requestIsCurrent: true,
  decisions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useFocusEffect).mockReset();
  mockUuidSequence = 0;
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

// Windows cold-start rendering can exceed Jest's default 5s limit; each
// waitFor assertion still has its own short deadline for a broken interaction.
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
  expect(
    screen.getByRole('checkbox', { name: 'Unit 2 · PIP-1201' }),
  ).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
}, 15_000);

it('uses a required calendar control for a work-date clarification', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        questions: [
          {
            ...question,
            reason_code: 'date',
            question_text: 'When was this work completed?',
            options: [],
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

  await render(<ReportFollowupScreen reportId={reportId} />);

  expect(screen.getByText('Work date · Required')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Choose work date' }),
  ).toBeEnabled();
  expect(screen.getByText('Not recorded')).toBeVisible();
  expect(screen.queryByPlaceholderText('YYYY-MM-DD')).toBeNull();
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
});

it('freezes clarification inputs while the captured answer is sending', async () => {
  const pending = deferred<{
    reportId: string;
    reportVersion: number;
    processing: 'queued';
  }>();
  jest.mocked(respondToClarification).mockReturnValue(pending.promise);
  await render(<ReportFollowupScreen reportId={reportId} />);
  const location = screen.getByRole('checkbox', {
    name: 'Unit 2 · PIP-1201',
  });
  const otherLocation = screen.getByLabelText('Another work location');
  await fireEvent.press(location);
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() => expect(respondToClarification).toHaveBeenCalledTimes(1));

  expect(location).toBeDisabled();
  expect(otherLocation.props.editable).toBe(false);

  await act(async () => {
    pending.resolve({ reportId, reportVersion: 2, processing: 'queued' });
    await pending.promise;
  });
  await waitFor(() => expect(finish).toHaveBeenCalled());
});

it('queues other open questions and explains they will become active next', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        claims: [
          ...reportData.claims,
          { ...reportData.claims[0], id: secondClaimId },
        ],
        questions: [question, secondQuestion],
      },
      error: null,
      isPending: false,
    },
    offline: false,
    refresh,
    finish,
  } as never);
  await render(<ReportFollowupScreen reportId={reportId} />);
  expect(screen.getByText('Waiting for the current question')).toBeVisible();
  expect(
    screen.getByText(/will appear after you answer the current question/),
  ).toBeVisible();
  expect(screen.getByText('Where did this work happen?')).toBeVisible();
});

it('shows every offered location but limits replies to eight selections', async () => {
  const options = Array.from({ length: 9 }, (_, index) => ({
    activityId: `10000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
    label: `Unit ${index + 1}`,
  }));
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        questions: [{ ...question, options }],
      },
      error: null,
      isPending: false,
    },
    offline: false,
    refresh,
    finish,
  } as never);
  await render(<ReportFollowupScreen reportId={reportId} />);
  for (const option of options.slice(0, 8))
    await fireEvent.press(screen.getByRole('checkbox', { name: option.label }));
  const send = screen.getByRole('button', { name: 'Send answer' });
  expect(send).toBeEnabled();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: options[8]?.label ?? '' }),
  );
  expect(
    screen.getByText('Choose no more than eight work areas.'),
  ).toBeVisible();
  await fireEvent.changeText(
    screen.getByLabelText('Another work location'),
    'Unit 9',
  );
  expect(
    screen.queryByText('Choose no more than eight work areas.'),
  ).toBeNull();
  await fireEvent.press(send);
  await waitFor(() =>
    expect(respondToClarification).toHaveBeenCalledWith(
      {},
      questionId,
      expect.objectContaining({ activityIds: [], text: 'Unit 9' }),
    ),
  );
});

it('clears entered text after a successful reply', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        questions: [
          {
            ...question,
            reason_code: 'detail',
            options: [],
            question_text: 'What still needs to be checked?',
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
  await render(<ReportFollowupScreen reportId={reportId} />);
  const details = screen.getByLabelText('Other details');
  await fireEvent.changeText(details, 'NDT remains');
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() => expect(finish).toHaveBeenCalled());
  expect(details).toHaveDisplayValue('');
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
});

it('blocks cached report answers while offline', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: { data: reportData, error: null, isPending: false },
    offline: true,
    refresh,
    finish,
  } as never);
  await render(<ReportFollowupScreen reportId={reportId} />);
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Not sure' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Not sure' }));
  expect(respondToClarification).not.toHaveBeenCalled();
});

it('keeps cached report history visible offline without a focus refresh', async () => {
  jest.mocked(useReportFollowups).mockReturnValue({
    report: { data: reportData, error: null, isPending: false },
    offline: true,
    refresh,
    finish,
  } as never);
  jest.mocked(useFocusEffect).mockImplementation((callback) => {
    callback();
  });

  await render(<ReportFollowupScreen reportId={reportId} />);

  expect(screen.getByText('Your original report')).toBeVisible();
  expect(refresh).not.toHaveBeenCalled();
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

it('keeps stale reply drafts scoped to their question after refresh', async () => {
  const view = await render(<ReportFollowupScreen reportId={reportId} />);
  jest
    .mocked(respondToClarification)
    .mockRejectedValueOnce(new FollowupWriteError('stale'));
  await fireEvent.changeText(
    screen.getByLabelText('Another work location'),
    'Unit 9',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());

  jest.mocked(useReportFollowups).mockReturnValue({
    report: {
      data: {
        ...reportData,
        report: { ...reportData.report, current_version: 2 },
        claims: [
          { ...reportData.claims[0], state: 'pending' as const, version: 3 },
          { ...reportData.claims[0], id: secondClaimId },
        ],
        questions: [
          { ...question, status: 'answered' as const },
          secondQuestion,
        ],
      },
      error: null,
      isPending: false,
    },
    offline: false,
    refresh,
    finish,
  } as never);
  await view.rerender(<ReportFollowupScreen reportId={reportId} />);
  expect(screen.getByLabelText('Other details')).toHaveDisplayValue('');
  expect(screen.getByText(/Unsent draft \(not sent\): Unit 9/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('Other details'), 'Unit 9');
  await fireEvent.press(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() => expect(respondToClarification).toHaveBeenCalledTimes(2));
  const [firstCall, secondCall] = jest.mocked(respondToClarification).mock
    .calls;
  expect(firstCall?.[1]).toBe(questionId);
  expect(secondCall?.[1]).toBe(secondQuestionId);
  expect(secondCall?.[2]).toEqual(
    expect.objectContaining({
      text: 'Unit 9',
      activityIds: [],
      eventDate: null,
    }),
  );
  expect(secondCall?.[2].commandId).not.toBe(firstCall?.[2].commandId);
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

it('freezes verification inputs while the captured check is sending', async () => {
  const pending = deferred<{
    verificationId: string;
    status: 'confirmed';
    version: number;
  }>();
  jest.mocked(decideVerification).mockReturnValue(pending.promise);
  await render(<VerificationScreen requestId={requestId} />);
  const assignment = screen.getByRole('radio', {
    name: 'Assignment check: Confirm',
  });
  const work = screen.getByRole('radio', { name: 'Work check: Confirm' });
  const reason = screen.getByLabelText('Reason and evidence checked');
  await fireEvent.press(assignment);
  await fireEvent.press(work);
  await fireEvent.changeText(reason, 'Checked the register and the work.');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record supervisor check' }),
  );
  await waitFor(() => expect(decideVerification).toHaveBeenCalledTimes(1));

  expect(assignment).toBeDisabled();
  expect(work).toBeDisabled();
  expect(reason.props.editable).toBe(false);

  await act(async () => {
    pending.resolve({
      verificationId: requestId,
      status: 'confirmed',
      version: 2,
    });
    await pending.promise;
  });
  await waitFor(() => expect(finish).toHaveBeenCalled());
});

it('asks about assignment authority separately from reported work', async () => {
  await render(<VerificationScreen requestId={requestId} />);
  expect(
    screen.getByText(
      'Was this reporter assigned or authorized to carry out work on this activity?',
    ),
  ).toBeVisible();
  expect(
    screen.getByText('Can you confirm this exact reported work and date?'),
  ).toBeVisible();
});

it('shows a completed verification as retained history, not stale evidence', async () => {
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
      data: [
        {
          ...verificationItem,
          request: {
            ...verificationItem.request,
            claim_version: 3,
            version: 2,
            status: 'confirmed',
          },
          claim: {
            ...verificationItem.claim,
            version: 3,
            state: 'pending',
          },
          decisions: [
            {
              id: '10000000-0000-4000-8000-000000000013',
              request_id: requestId,
              project_id: projectId,
              actor_id: userId,
              request_version: 1,
              allocation: 'confirmed',
              work: 'confirmed',
              reason: 'Checked the assignment record and observed the work.',
              created_at: '2026-09-24T00:03:00+00:00',
            },
          ],
        },
      ],
      error: null,
      isPending: false,
    },
    refresh,
    finish,
  } as never);

  await render(<VerificationScreen requestId={requestId} />);

  expect(
    screen.getByText(
      'This recorded check is retained. The planner makes the schedule decision separately.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(/changed after this check was assigned/),
  ).toBeNull();
  expect(
    screen.getByText('Checked the assignment record and observed the work.'),
  ).toBeVisible();
});

it('clears a successful needs-info response before another attestation', async () => {
  jest.mocked(decideVerification).mockResolvedValue({
    verificationId: requestId,
    status: 'needs_info',
    version: 2,
  });
  await render(<VerificationScreen requestId={requestId} />);

  async function answerNeedsInfo() {
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Assignment check: Need details' }),
    );
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Work check: Confirm' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Reason and evidence checked'),
      'Check the revised assignment register.',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Record supervisor check' }),
    );
  }

  await answerNeedsInfo();
  await waitFor(() => expect(decideVerification).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Reason and evidence checked').props.value).toBe(
    '',
  );
  expect(
    screen.getByRole('button', { name: 'Record supervisor check' }),
  ).toBeDisabled();
  const firstCommand = jest.mocked(decideVerification).mock.calls[0]?.[2];

  await answerNeedsInfo();
  await waitFor(() => expect(decideVerification).toHaveBeenCalledTimes(2));
  const secondCommand = jest.mocked(decideVerification).mock.calls[1]?.[2];
  expect(secondCommand?.commandId).not.toBe(firstCommand?.commandId);
});

it('blocks a cached supervisor attestation while offline', async () => {
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
      offline: true,
    },
    assignments: {
      data: [verificationItem],
      error: null,
      isPending: false,
    },
    refresh,
    finish,
  } as never);
  await render(<VerificationScreen requestId={requestId} />);
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
  expect(
    screen.getByRole('button', { name: 'Record supervisor check' }),
  ).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Record supervisor check' }),
  );
  expect(decideVerification).not.toHaveBeenCalled();
});

it('keeps checks from a previous schedule revision read-only', async () => {
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
      data: [
        {
          ...verificationItem,
          activity: null,
          scheduleIsCurrent: false,
          requestIsCurrent: false,
        },
      ],
      error: null,
      isPending: false,
    },
    refresh,
    finish,
  } as never);
  await render(<VerificationScreen requestId={requestId} />);
  expect(
    screen.getByText('Schedule changed since this check was assigned'),
  ).toBeVisible();
  expect(screen.getByRole('alert').props.children).toContain(
    'The claim, report, policy, assignment, or schedule changed after',
  );
  expect(
    screen.queryByRole('button', { name: 'Record supervisor check' }),
  ).toBeNull();
});

it('records a cannot-confirm assignment and a need-details work check', async () => {
  jest.mocked(decideVerification).mockResolvedValue({
    verificationId: requestId,
    status: 'denied',
    version: 2,
  });
  await render(<VerificationScreen requestId={requestId} />);
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Assignment check: Cannot confirm' }),
  );
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Work check: Need details' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Reason and evidence checked'),
    'Assignment register lists another crew; quantity evidence missing.',
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
        allocation: 'denied',
        work: 'needs_info',
        reason:
          'Assignment register lists another crew; quantity evidence missing.',
      }),
    ),
  );
  expect(
    await screen.findByText(/planner still makes the schedule decision/),
  ).toBeVisible();
});
