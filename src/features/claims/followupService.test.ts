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

function response(data: unknown, count?: number) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (count !== undefined)
    headers['Content-Range'] = `0-${Math.max(0, count - 1)}/${count}`;
  return new Response(JSON.stringify(data), { status: 200, headers });
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

it('loads only the signed-in reporter report and its complete question history', async () => {
  const calls: URL[] = [];
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/reports')) {
      return response(
        url.searchParams.get('select') === 'id,current_version,lifecycle'
          ? [{ id: reportId, current_version: 1, lifecycle: 'submitted' }]
          : [report],
      );
    }
    if (url.pathname.endsWith('/report_versions')) return response([original]);
    if (url.pathname.endsWith('/claims')) return response([claim], 1);
    if (url.pathname.endsWith('/clarification_requests'))
      return response([question], 1);
    if (url.pathname.endsWith('/clarification_responses'))
      return response([], 0);
    if (url.pathname.endsWith('/project_members')) return response([member]);
    throw new Error(`Unexpected URL ${url.pathname}`);
  });
  const result = await loadReportFollowups(
    client(fetcher as typeof fetch),
    userId,
    reportId,
    new AbortController().signal,
  );
  expect(result.questions).toEqual([question]);
  expect(
    calls
      .find((url) => url.pathname.endsWith('/reports'))
      ?.searchParams.get('author_id'),
  ).toBe(`eq.${userId}`);
  expect(calls.every((url) => url.hostname === 'example.supabase.co')).toBe(
    true,
  );
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
    if (url.pathname.endsWith('/rpc/verification_context'))
      return response([
        { request_id: requestId, reporter_name: 'Site reporter' },
      ]);
    if (url.pathname.endsWith('/report_versions'))
      return response([original], 1);
    if (url.pathname.endsWith('/claims'))
      return response([{ ...claim, state: 'verification' }]);
    if (url.pathname.endsWith('/verification_decisions'))
      return response([], 0);
    if (url.pathname.endsWith('/rpc/schedule_snapshot'))
      return response({
        projectId,
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
      request: { id: requestId, verifier_id: userId },
    },
  ]);
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
