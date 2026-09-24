import { createClient } from '@supabase/supabase-js';

import {
  FollowupWriteError,
  decideVerification,
  loadReportFollowups,
  loadVerificationAssignments,
  respondToClarification,
} from './followupService';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const questionId = '10000000-0000-4000-8000-000000000005';
const requestId = '10000000-0000-4000-8000-000000000006';
const activityId = '10000000-0000-4000-8000-000000000007';
const revisionId = '10000000-0000-4000-8000-000000000008';
const commandId = '10000000-0000-4000-8000-000000000009';
const secondClaimId = '10000000-0000-4000-8000-000000000010';
const secondQuestionId = '10000000-0000-4000-8000-000000000011';
const member = {
  project_id: projectId,
  user_id: userId,
  display_name: 'Field supervisor',
  role: 'supervisor' as const,
  active: true,
  version: 3,
};
const context: ProjectContext = {
  member,
  project: { id: projectId, name: 'Refinery upgrade' },
};
const report = {
  id: reportId,
  project_id: projectId,
  author_id: userId,
  current_version: 1,
  lifecycle: 'submitted',
  received_at: '2026-09-24T00:00:00+00:00',
  source_kind: 'voice',
};
const original = {
  report_id: reportId,
  version: 1,
  source_text: 'Installed supports in Unit 2.',
  work_date: '2026-09-23',
};
const facts = {
  kind: 'ITEM_PROGRESS',
  activityHint: 'PIP-1201',
  location: 'Unit 2',
  stage: 'Erection',
  discipline: 'Piping',
  scope: 'item',
  fullScope: false,
  eventDate: '2026-09-23',
  dateOrigin: 'source_text',
  quantity: { value: 2, unit: 'supports', mode: 'delta' },
  evidenceQuote: 'Installed two supports',
  qualifiers: [],
  missingFields: [],
};
const claim = {
  id: claimId,
  project_id: projectId,
  report_id: reportId,
  report_version: 1,
  facts,
  validation_flags: [],
  state: 'clarification',
  version: 2,
};
const question = {
  id: questionId,
  project_id: projectId,
  claim_id: claimId,
  report_id: reportId,
  claim_version: 2,
  report_version: 1,
  version: 1,
  reason_code: 'location',
  question_text: 'Where did this work happen?',
  options: [{ activityId, label: 'Unit 2 · PIP-1201' }],
  automatic: true,
  status: 'open',
  created_at: '2026-09-24T00:01:00+00:00',
};
const verification = {
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
  status: 'open',
  allocation_confirmed: false,
  work_confirmed: false,
  created_at: '2026-09-24T00:02:00+00:00',
};

function response(data: unknown, count?: number, offset = 0) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (count !== undefined) {
    const range =
      Array.isArray(data) && data.length
        ? `${offset}-${offset + data.length - 1}`
        : '*';
    headers['Content-Range'] = `${range}/${count}`;
  }
  return new Response(JSON.stringify(data), { status: 200, headers });
}

function pageResponse(rows: unknown[], url: URL) {
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? rows.length);
  return response(rows.slice(offset, offset + limit), rows.length, offset);
}

function client(fetcher: typeof fetch) {
  return createClient<Database>(
    'https://example.supabase.co',
    'synthetic-public-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetcher },
    },
  );
}

it('loads complete question history after another claim reply advances the report', async () => {
  const secondClaim = { ...claim, id: secondClaimId };
  const secondQuestion = {
    ...question,
    id: secondQuestionId,
    claim_id: secondClaimId,
    reason_code: 'detail' as const,
    options: [],
    created_at: '2026-09-24T00:02:00+00:00',
  };
  const advancedReport = { ...report, current_version: 2 };
  const firstReply = {
    id: '10000000-0000-4000-8000-000000000012',
    request_id: question.id,
    project_id: projectId,
    actor_id: userId,
    question_version: 1,
    input: { answer: 'answer' as const, activityIds: [activityId], text: '' },
    resulting_report_version: 2,
    created_at: '2026-09-24T00:01:30+00:00',
  };
  const calls: URL[] = [];
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/reports')) {
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 2, lifecycle: 'submitted' }]
          : [advancedReport],
      );
    }
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims'))
      return response(
        [{ ...claim, state: 'pending', version: 3 }, secondClaim],
        2,
      );
    if (url.pathname.endsWith('/clarification_requests'))
      return response([{ ...question, status: 'answered' }, secondQuestion], 2);
    if (url.pathname.endsWith('/clarification_responses'))
      return response([firstReply], 1);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  const result = await loadReportFollowups(
    client(fetcher as typeof fetch),
    userId,
    reportId,
    new AbortController().signal,
  );
  expect(result.report.current_version).toBe(2);
  expect(result.questions.map((row) => row.status)).toEqual([
    'answered',
    'open',
  ]);
  expect(result.questions[1]?.report_version).toBe(1);
  expect(result.responses).toEqual([firstReply]);
  expect(
    calls
      .find((url) => url.pathname.endsWith('/reports'))
      ?.searchParams.get('author_id'),
  ).toBe(`eq.${userId}`);
  expect(calls.every((url) => url.hostname === 'example.supabase.co')).toBe(
    true,
  );
});

it('rejects two open questions for the same claim', async () => {
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/reports'))
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 1, lifecycle: 'submitted' }]
          : [report],
      );
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims')) return response([claim], 1);
    if (url.pathname.endsWith('/clarification_requests'))
      return response([question, { ...question, id: secondQuestionId }], 2);
    if (url.pathname.endsWith('/clarification_responses'))
      return response([], 0);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadReportFollowups(
      client(fetcher as typeof fetch),
      userId,
      reportId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('rejects an open question whose claim snapshot has advanced', async () => {
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/reports'))
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 1, lifecycle: 'submitted' }]
          : [report],
      );
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims'))
      return response([{ ...claim, version: claim.version + 1 }], 1);
    if (url.pathname.endsWith('/clarification_requests'))
      return response([question], 1);
    if (url.pathname.endsWith('/clarification_responses'))
      return response([], 0);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadReportFollowups(
      client(fetcher as typeof fetch),
      userId,
      reportId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('rejects a question that changes while its responses are loading', async () => {
  let claimReads = 0;
  let questionReads = 0;
  const reply = {
    id: '10000000-0000-4000-8000-000000000012',
    request_id: questionId,
    project_id: projectId,
    actor_id: userId,
    question_version: 1,
    input: { answer: 'not_sure' as const, text: '' },
    resulting_report_version: null,
    created_at: '2026-09-24T00:01:30+00:00',
  };
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/reports'))
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 1, lifecycle: 'submitted' }]
          : [report],
      );
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims')) {
      claimReads += 1;
      return response(
        [
          claimReads === 1
            ? claim
            : { ...claim, state: 'pending', version: claim.version + 1 },
        ],
        1,
      );
    }
    if (url.pathname.endsWith('/clarification_requests')) {
      questionReads += 1;
      return response(
        [
          questionReads === 1
            ? question
            : { ...question, status: 'answered', version: 2 },
        ],
        1,
      );
    }
    if (url.pathname.endsWith('/clarification_responses'))
      return response([reply], 1);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });

  await expect(
    loadReportFollowups(
      client(fetcher as typeof fetch),
      userId,
      reportId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
  expect(claimReads).toBe(2);
  expect(questionReads).toBe(2);
});

it('loads report histories beyond one PostgREST page', async () => {
  const uuid = (value: number) =>
    `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const claims = Array.from({ length: 101 }, (_, index) => ({
    ...claim,
    id: uuid(100 + index),
    state: 'pending' as const,
  }));
  const questions = claims.map((row, index) => ({
    ...question,
    id: uuid(300 + index),
    claim_id: row.id,
    reason_code: 'detail' as const,
    question_text: `Earlier question ${index}`,
    options: [],
    status: 'answered' as const,
  }));
  const replies = questions.map((row, index) => ({
    id: uuid(500 + index),
    request_id: row.id,
    project_id: projectId,
    actor_id: userId,
    question_version: 1,
    input: { answer: 'answer' as const, text: `Reply ${index}` },
    resulting_report_version: null,
    created_at: `2026-09-${String(1 + (index % 24)).padStart(2, '0')}T00:00:00+00:00`,
  }));
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/reports'))
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 1, lifecycle: 'submitted' }]
          : [report],
      );
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims')) return pageResponse(claims, url);
    if (url.pathname.endsWith('/clarification_requests'))
      return pageResponse(questions, url);
    if (url.pathname.endsWith('/clarification_responses')) {
      const requestIds = new Set(
        url.searchParams.get('request_id')?.match(/[0-9a-f-]{36}/g) ?? [],
      );
      return pageResponse(
        replies.filter((reply) => requestIds.has(reply.request_id)),
        url,
      );
    }
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });

  const result = await loadReportFollowups(
    client(fetcher as typeof fetch),
    userId,
    reportId,
    new AbortController().signal,
  );
  expect(result.claims).toHaveLength(101);
  expect(result.questions).toHaveLength(101);
  expect(result.responses).toHaveLength(101);
});

it('rejects inconsistent question ownership and changed reports', async () => {
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/reports'))
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 2, lifecycle: 'submitted' }]
          : [report],
      );
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims')) return response([claim], 1);
    if (url.pathname.endsWith('/clarification_requests'))
      return response([{ ...question, project_id: requestId }], 1);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadReportFollowups(
      client(fetcher as typeof fetch),
      userId,
      reportId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('rejects a report row for another author before loading its questions', async () => {
  const fetcher = jest.fn(async () =>
    response([{ ...report, author_id: requestId }]),
  );
  await expect(
    loadReportFollowups(
      client(fetcher as typeof fetch),
      userId,
      reportId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('loads exact assigned supervisor checks with evidence and reporter context', async () => {
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/verification_requests'))
      return response([verification], 1);
    if (url.pathname.endsWith('/rpc/verification_context_v2'))
      return response(
        [
          {
            request_id: requestId,
            reporter_name: 'Site reporter',
            assignment_is_current: true,
          },
        ],
        1,
      );
    if (url.pathname.endsWith('/report_versions'))
      return response([original], 1);
    if (url.pathname.endsWith('/claims'))
      return response([{ ...claim, state: 'verification' }], 1);
    if (url.pathname.endsWith('/verification_decisions'))
      return response([], 0);
    if (url.pathname.endsWith('/reports'))
      return response(
        [{ id: reportId, project_id: projectId, lifecycle: 'submitted' }],
        1,
      );
    if (url.pathname.endsWith('/assignment_versions'))
      return response(
        [{ project_id: projectId, activity_id: activityId, version: 4 }],
        1,
      );
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
        policyVersion: 1,
        revisionId,
        activities: [
          {
            id: activityId,
            projectId,
            revisionId,
            externalId: 'PIP-1201',
            name: 'Install supports',
            location: 'Unit 2',
          },
        ],
      });
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    ),
  ).resolves.toMatchObject([
    {
      reporterName: 'Site reporter',
      activity: { externalId: 'PIP-1201' },
      scheduleIsCurrent: true,
      requestIsCurrent: true,
      request: { id: requestId, verifier_id: userId },
    },
  ]);
  expect(
    fetcher.mock.calls.some(([input]) =>
      new URL(String(input)).pathname.endsWith('/assignment_versions'),
    ),
  ).toBe(false);
});

it('keeps completed verification checks as history after the claim advances', async () => {
  const completedRequest = {
    ...verification,
    claim_version: claim.version + 1,
    status: 'confirmed',
    version: 2,
  };
  const decision = {
    id: '10000000-0000-4000-8000-000000000013',
    request_id: requestId,
    project_id: projectId,
    actor_id: userId,
    request_version: 1,
    allocation: 'confirmed',
    work: 'confirmed',
    reason: 'Checked the assignment record and observed the work.',
    created_at: '2026-09-24T00:03:00+00:00',
  };
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/verification_requests'))
      return response([completedRequest], 1);
    if (url.pathname.endsWith('/rpc/verification_context_v2'))
      return response(
        [
          {
            request_id: requestId,
            reporter_name: 'Site reporter',
            assignment_is_current: true,
          },
        ],
        1,
      );
    if (url.pathname.endsWith('/report_versions'))
      return response([original], 1);
    if (url.pathname.endsWith('/claims'))
      return response(
        [{ ...claim, version: claim.version + 1, state: 'pending' }],
        1,
      );
    if (url.pathname.endsWith('/verification_decisions'))
      return response([decision], 1);
    if (url.pathname.endsWith('/reports'))
      return response(
        [{ id: reportId, project_id: projectId, lifecycle: 'submitted' }],
        1,
      );
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
        policyVersion: 1,
        revisionId,
        activities: [],
      });
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });

  await expect(
    loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    ),
  ).resolves.toMatchObject([
    {
      requestIsCurrent: true,
      request: { status: 'confirmed' },
      claim: { state: 'pending', version: claim.version + 1 },
      decisions: [decision],
    },
  ]);
});

it('marks a verification from an older schedule read-only', async () => {
  const currentRevisionId = '10000000-0000-4000-8000-000000000012';
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/verification_requests'))
      return response([verification], 1);
    if (url.pathname.endsWith('/rpc/verification_context_v2'))
      return response(
        [
          {
            request_id: requestId,
            reporter_name: 'Site reporter',
            assignment_is_current: true,
          },
        ],
        1,
      );
    if (url.pathname.endsWith('/report_versions'))
      return response([original], 1);
    if (url.pathname.endsWith('/claims'))
      return response([{ ...claim, state: 'verification' }], 1);
    if (url.pathname.endsWith('/verification_decisions'))
      return response([], 0);
    if (url.pathname.endsWith('/reports'))
      return response(
        [{ id: reportId, project_id: projectId, lifecycle: 'submitted' }],
        1,
      );
    if (url.pathname.endsWith('/assignment_versions'))
      return response(
        [{ project_id: projectId, activity_id: activityId, version: 4 }],
        1,
      );
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
        policyVersion: 1,
        revisionId: currentRevisionId,
        activities: [
          {
            id: activityId,
            projectId,
            revisionId: currentRevisionId,
            externalId: 'PIP-1201-new',
            name: 'Install revised supports',
            location: 'Unit 3',
          },
        ],
      });
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    ),
  ).resolves.toMatchObject([
    { scheduleIsCurrent: false, requestIsCurrent: false, activity: null },
  ]);
});

it('marks checks read-only when claim, policy, assignment, or report context is stale', async () => {
  const scenarios = [
    {
      claimRow: { ...claim, state: 'clarification', version: 3 },
      policyVersion: 1,
      assignmentVersion: 4,
      assignmentIsCurrent: true,
      reportLifecycle: 'submitted',
    },
    {
      claimRow: { ...claim, state: 'verification' },
      policyVersion: 2,
      assignmentVersion: 4,
      assignmentIsCurrent: true,
      reportLifecycle: 'submitted',
    },
    {
      claimRow: { ...claim, state: 'verification' },
      policyVersion: 1,
      assignmentVersion: 4,
      assignmentIsCurrent: false,
      reportLifecycle: 'submitted',
    },
    {
      claimRow: { ...claim, state: 'verification' },
      policyVersion: 1,
      assignmentVersion: 4,
      assignmentIsCurrent: true,
      reportLifecycle: 'withdrawn',
    },
  ] as const;

  for (const scenario of scenarios) {
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/verification_requests'))
        return response([verification], 1);
      if (url.pathname.endsWith('/rpc/verification_context_v2'))
        return response(
          [
            {
              request_id: requestId,
              reporter_name: 'Site reporter',
              assignment_is_current: scenario.assignmentIsCurrent,
            },
          ],
          1,
        );
      if (url.pathname.endsWith('/report_versions'))
        return response([original], 1);
      if (url.pathname.endsWith('/claims'))
        return response([scenario.claimRow], 1);
      if (url.pathname.endsWith('/verification_decisions'))
        return response([], 0);
      if (url.pathname.endsWith('/reports'))
        return response(
          [
            {
              id: reportId,
              project_id: projectId,
              lifecycle: scenario.reportLifecycle,
            },
          ],
          1,
        );
      if (url.pathname.endsWith('/assignment_versions'))
        return response(
          [
            {
              project_id: projectId,
              activity_id: activityId,
              version: scenario.assignmentVersion,
            },
          ],
          1,
        );
      if (url.pathname.endsWith('/rpc/schedule_snapshot'))
        return response({
          projectId,
          policyVersion: scenario.policyVersion,
          revisionId,
          activities: [],
        });
      if (url.pathname.endsWith('/project_members')) return response([member]);
      throw new Error(`Unexpected URL ${url.pathname}`);
    });

    const result = await loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    );
    expect(result[0]?.scheduleIsCurrent).toBe(true);
    expect(result[0]?.requestIsCurrent).toBe(false);
  }
});

it('rejects verification history beyond the current request version', async () => {
  const terminalRequest = {
    ...verification,
    claim_version: claim.version + 1,
    status: 'confirmed',
    version: 2,
  };
  const decision = {
    id: '10000000-0000-4000-8000-000000000013',
    request_id: requestId,
    project_id: projectId,
    actor_id: userId,
    request_version: 2,
    allocation: 'confirmed',
    work: 'confirmed',
    reason: 'Checked the assignment record and observed the work.',
    created_at: '2026-09-24T00:03:00+00:00',
  };
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/verification_requests'))
      return response([terminalRequest], 1);
    if (url.pathname.endsWith('/rpc/verification_context_v2'))
      return response(
        [
          {
            request_id: requestId,
            reporter_name: 'Site reporter',
            assignment_is_current: true,
          },
        ],
        1,
      );
    if (url.pathname.endsWith('/report_versions'))
      return response([original], 1);
    if (url.pathname.endsWith('/claims'))
      return response(
        [{ ...claim, version: claim.version + 1, state: 'pending' }],
        1,
      );
    if (url.pathname.endsWith('/verification_decisions'))
      return response([decision], 1);
    if (url.pathname.endsWith('/reports'))
      return response(
        [{ id: reportId, project_id: projectId, lifecycle: 'submitted' }],
        1,
      );
    if (url.pathname.endsWith('/assignment_versions'))
      return response(
        [{ project_id: projectId, activity_id: activityId, version: 4 }],
        1,
      );
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
        policyVersion: 1,
        revisionId,
        activities: [],
      });
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  await expect(
    loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('loads assigned verification and decision histories beyond one page', async () => {
  const uuid = (value: number) =>
    `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const requests = Array.from({ length: 101 }, (_, index) => ({
    ...verification,
    id: uuid(1000 + index),
    claim_id: uuid(2000 + index),
    report_id: uuid(3000 + index),
    status: 'needs_info' as const,
    claim_version: 3,
    version: 2,
    created_at: `2026-09-24T00:${String(index % 60).padStart(2, '0')}:00+00:00`,
  }));
  const contexts = requests.map((request) => ({
    request_id: request.id,
    reporter_name: 'Site reporter',
    assignment_is_current: true,
  }));
  const versions = requests.map((request) => ({
    report_id: request.report_id,
    version: 1,
    source_text: original.source_text,
    work_date: original.work_date,
  }));
  const claims = requests.map((request) => ({
    ...claim,
    id: request.claim_id,
    report_id: request.report_id,
    version: 3,
    state: 'verification' as const,
  }));
  const decisions = requests.map((request, index) => ({
    id: uuid(4000 + index),
    request_id: request.id,
    project_id: projectId,
    actor_id: userId,
    request_version: 1,
    allocation: 'confirmed' as const,
    work: 'needs_info' as const,
    reason: 'The record needs another check.',
    created_at: '2026-09-24T00:03:00+00:00',
  }));
  const reports = requests.map((request) => ({
    id: request.report_id,
    project_id: projectId,
    lifecycle: 'submitted',
  }));
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/verification_requests'))
      return pageResponse(requests, url);
    if (url.pathname.endsWith('/rpc/verification_context_v2'))
      return pageResponse(contexts, url);
    if (url.pathname.endsWith('/report_versions')) {
      const reportIds = new Set(
        url.searchParams.get('report_id')?.match(/[0-9a-f-]{36}/g) ?? [],
      );
      return pageResponse(
        versions.filter((version) => reportIds.has(version.report_id)),
        url,
      );
    }
    if (url.pathname.endsWith('/claims')) {
      const claimIds = new Set(
        url.searchParams.get('id')?.match(/[0-9a-f-]{36}/g) ?? [],
      );
      return pageResponse(
        claims.filter((row) => claimIds.has(row.id)),
        url,
      );
    }
    if (url.pathname.endsWith('/verification_decisions')) {
      const requestIds = new Set(
        url.searchParams.get('request_id')?.match(/[0-9a-f-]{36}/g) ?? [],
      );
      return pageResponse(
        decisions.filter((decision) => requestIds.has(decision.request_id)),
        url,
      );
    }
    if (url.pathname.endsWith('/reports')) {
      const reportIds = new Set(
        url.searchParams.get('id')?.match(/[0-9a-f-]{36}/g) ?? [],
      );
      return pageResponse(
        reports.filter((report) => reportIds.has(report.id)),
        url,
      );
    }
    if (url.pathname.endsWith('/assignment_versions'))
      return response(
        [{ project_id: projectId, activity_id: activityId, version: 4 }],
        1,
      );
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
        policyVersion: 1,
        revisionId,
        activities: [],
      });
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });

  const result = await loadVerificationAssignments(
    client(fetcher as typeof fetch),
    context,
    new AbortController().signal,
  );
  expect(result).toHaveLength(101);
  expect(result[100]?.decisions).toHaveLength(1);
});

it('rejects a verification routed to another account before loading evidence', async () => {
  const fetcher = jest.fn(async () =>
    response([{ ...verification, verifier_id: requestId }], 1),
  );
  await expect(
    loadVerificationAssignments(
      client(fetcher as typeof fetch),
      context,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: 'changed' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

function writeHarness(
  name: 'respond_clarification' | 'decide_verification',
  data?: unknown,
  error?: { code: string; message: string },
) {
  const calls: { path: string; body: unknown }[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (!path.endsWith(`/rpc/${name}`))
        throw new Error(`Unexpected RPC ${path}`);
      calls.push({ path, body: JSON.parse(String(init?.body)) });
      if (error) return new Response(JSON.stringify(error), { status: 409 });
      return response(data);
    },
  );
  return { client: client(fetcher as typeof fetch), calls };
}

it('sends exact idempotent reply and attestation commands through production RPCs', async () => {
  const reply = writeHarness('respond_clarification', {
    reportId,
    reportVersion: 2,
    processing: 'queued',
  });
  await respondToClarification(reply.client, questionId, {
    commandId,
    expectedQuestionVersion: 1,
    answer: 'answer',
    text: '',
    activityIds: [activityId],
    eventDate: null,
  });
  expect(reply.calls[0]).toEqual({
    path: '/rest/v1/rpc/respond_clarification',
    body: {
      p_question: questionId,
      p_command: {
        commandId,
        expectedQuestionVersion: 1,
        answer: 'answer',
        text: '',
        activityIds: [activityId],
        eventDate: null,
      },
    },
  });

  const check = writeHarness('decide_verification', {
    verificationId: requestId,
    status: 'confirmed',
    version: 2,
  });
  await decideVerification(check.client, requestId, {
    commandId,
    expectedVersion: 1,
    allocation: 'confirmed',
    work: 'confirmed',
    reason: 'Checked assignment register and installed supports.',
  });
  expect(check.calls[0]).toMatchObject({
    path: '/rest/v1/rpc/decide_verification',
    body: {
      p_request: requestId,
      p_command: {
        expectedVersion: 1,
        allocation: 'confirmed',
        work: 'confirmed',
      },
    },
  });
});

it('maps stale verification responses without exposing database detail', async () => {
  const harness = writeHarness('decide_verification', undefined, {
    code: '40001',
    message: 'STALE_VERIFICATION',
  });
  await expect(
    decideVerification(harness.client, requestId, {
      commandId,
      expectedVersion: 1,
      allocation: 'confirmed',
      work: 'confirmed',
      reason: 'Checked evidence.',
    }),
  ).rejects.toEqual(
    expect.objectContaining<Partial<FollowupWriteError>>({
      kind: 'stale',
      message: expect.stringContaining('changed'),
    }),
  );
});
