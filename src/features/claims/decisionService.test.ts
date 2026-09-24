import { createClient } from '@supabase/supabase-js';

import {
  DecisionWriteError,
  loadDecisionContext,
  previewDecision,
  requestClarification,
  requestVerification,
  submitDecision,
} from './decisionService';

import type { DecisionCommand } from './reviewContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const runId = '10000000-0000-4000-8000-000000000005';
const revisionId = '10000000-0000-4000-8000-000000000006';
const activityId = '10000000-0000-4000-8000-000000000007';
const reporterId = '10000000-0000-4000-8000-000000000008';
const commandId = '10000000-0000-4000-8000-000000000009';
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
const claim = {
  id: claimId,
  project_id: projectId,
  report_id: reportId,
  report_version: 1,
  run_id: runId,
  ordinal: 0,
  facts: {
    kind: 'START',
    activityHint: 'PIP-1201',
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
  validation_flags: [],
  state: 'pending',
  version: 2,
  plan_revision_id: revisionId,
  policy_version: 1,
  parent_claim_id: null,
  root_claim_id: null,
  followup_round: 0,
  manual_review: false,
  correction_of_event_id: null,
};
const report = {
  id: reportId,
  project_id: projectId,
  author_id: reporterId,
  current_version: 1,
  lifecycle: 'submitted',
  received_at: '2026-09-23T08:30:00+00:00',
  source_kind: 'voice',
};
const original = {
  report_id: reportId,
  version: 1,
  source_text: 'Line erection started in Unit 2.',
  work_date: '2026-09-23',
  selected_activity_id: null,
  context: {},
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
};
const activity = {
  id: activityId,
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  location: 'Unit 2',
  actualsVersion: 4,
  unit: 'spools',
};
const snapshot = {
  projectId,
  revisionId,
  policyVersion: 1,
  scheduleVersion: 7,
  activities: [activity],
};
const signal = () => new AbortController().signal;

function readHarness(
  options: {
    claim?: unknown;
    stableClaim?: unknown;
    report?: unknown;
    original?: unknown;
    candidates?: unknown[];
    candidateCount?: number | null;
    snapshot?: unknown;
    verifications?: unknown[];
    access?: unknown;
    reporter?: unknown;
    error?: string;
  } = {},
) {
  const calls: URL[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url);
      if (options.error)
        return new Response(
          JSON.stringify({ code: options.error, message: 'database detail' }),
          { status: 403 },
        );
      let data: unknown;
      let count: number | null | undefined;
      if (url.pathname.endsWith('/claims')) {
        data =
          url.searchParams.get('select') === 'id,version,state'
            ? [
                options.stableClaim ?? {
                  id: claimId,
                  version: 2,
                  state: 'pending',
                },
              ]
            : [options.claim ?? claim];
      } else if (url.pathname.endsWith('/reports')) {
        data = [options.report ?? report];
      } else if (url.pathname.endsWith('/report_versions')) {
        data = [options.original ?? original];
      } else if (url.pathname.endsWith('/candidate_matches')) {
        data = options.candidates ?? [candidate];
        count =
          options.candidateCount === undefined
            ? (data as unknown[]).length
            : options.candidateCount;
      } else if (url.pathname.endsWith('/rpc/schedule_snapshot')) {
        data = options.snapshot ?? snapshot;
      } else if (url.pathname.endsWith('/verification_requests')) {
        data = options.verifications ?? [];
      } else if (url.pathname.endsWith('/project_members')) {
        data = url.searchParams.has('active')
          ? [options.access ?? context.member]
          : [
              options.reporter ?? {
                user_id: reporterId,
                display_name: 'Field supervisor',
              },
            ];
      } else throw new Error(`Unexpected URL ${url.pathname}`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (count != null) headers['Content-Range'] = `0-8/${count}`;
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(data), { status: 200, headers });
    },
  );
  const client = createClient<Database>(
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
  return { client, calls };
}

it('loads an exact current claim, schedule version and candidate under manager RLS', async () => {
  const { client, calls } = readHarness();
  const result = await loadDecisionContext(client, context, claimId, signal());
  expect(result).toMatchObject({
    reporterName: 'Field supervisor',
    snapshot: { scheduleVersion: 7, policyVersion: 1 },
    candidates: [{ activity: { actualsVersion: 4 } }],
    verification: null,
  });
  expect(
    calls
      .find((url) => url.pathname.endsWith('/claims'))
      ?.searchParams.get('project_id'),
  ).toBe(`eq.${projectId}`);
  expect(calls.every((url) => url.hostname === 'example.supabase.co')).toBe(
    true,
  );
});

it('rejects a field role without making a production read', async () => {
  const { client, calls } = readHarness();
  await expect(
    loadDecisionContext(
      client,
      { ...context, member: { ...context.member, role: 'reporter' } },
      claimId,
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(calls).toHaveLength(0);
});

it.each([
  { snapshot: { ...snapshot, revisionId: reporterId } },
  { snapshot: { ...snapshot, policyVersion: 2 } },
  { candidates: [{ ...candidate, project_id: reporterId }] },
  { candidateCount: 2 },
  { verifications: [{}, {}] },
  { stableClaim: { id: claimId, version: 3, state: 'pending' } },
  { access: { ...context.member, role: 'reporter', version: 4 } },
])(
  'rejects stale, incomplete or cross-project context: %j',
  async (options) => {
    const { client } = readHarness(options);
    await expect(
      loadDecisionContext(client, context, claimId, signal()),
    ).rejects.toThrow();
  },
);

const command: DecisionCommand = {
  commandId,
  claimId,
  activityId,
  action: 'accept',
  expectedReportVersion: 1,
  expectedRunId: runId,
  expectedClaimVersion: 2,
  expectedPlanRevisionId: revisionId,
  expectedActualsVersion: 4,
  expectedPolicyVersion: 1,
  reason: 'Evidence confirms the activity start.',
  correctedDate: null,
  reconciliation: 'apply',
  expectedVerificationId: null,
  expectedVerificationVersion: null,
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

function writeHarness(
  responses: Record<
    string,
    { data?: unknown; error?: { code: string; message: string } }
  >,
) {
  const calls: { path: string; body: unknown }[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const name = url.pathname.split('/').at(-1)!;
      calls.push({ path: url.pathname, body: JSON.parse(String(init?.body)) });
      const response = responses[name];
      if (!response) throw new Error(`Unexpected RPC ${name}`);
      if (response.error)
        return new Response(JSON.stringify(response.error), { status: 409 });
      return new Response(JSON.stringify(response.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );
  const client = createClient<Database>(
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
  return { client, calls };
}

it('previews then submits the exact command and preview hash through business RPCs', async () => {
  const { client, calls } = writeHarness({
    preview_claim: { data: preview },
    decide_claim: {
      data: {
        state: 'accepted',
        claimId,
        eventId: reporterId,
        activityId,
        actualsVersion: 5,
        scheduleVersion: 8,
        deliveryState: 'pending',
      },
    },
  });
  await expect(previewDecision(client, command)).resolves.toEqual(preview);
  await expect(
    submitDecision(client, { ...command, previewHash: preview.previewHash }),
  ).resolves.toMatchObject({ state: 'accepted', scheduleVersion: 8 });
  expect(calls[0]?.body).toEqual({ p_command: command });
  expect(calls[1]?.body).toEqual({
    p_command: { ...command, previewHash: preview.previewHash },
  });
});

it('requests clarification and independent verification with stable command IDs', async () => {
  const { client, calls } = writeHarness({
    request_clarification: { data: { questionId: reporterId } },
    request_verification: {
      data: { verificationId: reporterId, status: 'open' },
    },
  });
  await requestClarification(client, claimId, {
    commandId,
    expectedClaimVersion: 2,
    reasonCode: 'location',
  });
  await requestVerification(client, claimId, {
    commandId,
    expectedClaimVersion: 2,
    activityId,
    reason: 'Confirm this work independently.',
  });
  expect(calls[0]?.body).toEqual({
    p_claim: claimId,
    p_command: { commandId, expectedClaimVersion: 2, reasonCode: 'location' },
  });
  expect(calls[1]?.body).toEqual({
    p_claim: claimId,
    p_command: {
      commandId,
      expectedClaimVersion: 2,
      activityId,
      reason: 'Confirm this work independently.',
    },
  });
});

it.each([
  {
    error: { code: '40001', message: 'STALE_CHANGE_PREVIEW' },
    kind: 'stale' as const,
    text: 'no longer current',
  },
  {
    error: { code: '42501', message: 'Review authority required' },
    kind: 'access' as const,
    text: 'Manager access',
  },
  {
    error: { code: '22023', message: 'MISSING_EVENT_DATE' },
    kind: 'validation' as const,
    text: 'when the work happened',
  },
])(
  'maps production error $error.message without database detail',
  async ({ error, kind, text }) => {
    const { client } = writeHarness({ preview_claim: { error } });
    await expect(previewDecision(client, command)).rejects.toEqual(
      expect.objectContaining<Partial<DecisionWriteError>>({
        kind,
        message: expect.stringContaining(text),
      }),
    );
  },
);
