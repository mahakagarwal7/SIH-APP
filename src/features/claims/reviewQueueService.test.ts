import { createClient } from '@supabase/supabase-js';

import { loadReviewQueue } from './reviewQueueService';

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
const facts = {
  kind: 'FINISH',
  activityHint: 'PIP-1201',
  location: 'Unit 2',
  stage: 'Erection',
  discipline: 'Piping',
  scope: 'activity',
  fullScope: true,
  eventDate: '2026-09-23',
  dateOrigin: 'source_text',
  quantity: null,
  evidenceQuote: 'Line erection finished',
  qualifiers: [],
  missingFields: [],
};
const claim = {
  id: claimId,
  project_id: projectId,
  report_id: reportId,
  report_version: 1,
  run_id: runId,
  ordinal: 0,
  facts,
  validation_flags: ['Finish has unresolved qualifications'],
  state: 'pending',
  version: 1,
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
  received_at: '2026-09-23T08:30:00+00:00',
  source_kind: 'voice',
};
const original = {
  report_id: reportId,
  version: 1,
  source_text: 'Line erection finished in Unit 2.',
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
const snapshot = {
  projectId,
  revisionId,
  activities: [
    {
      id: activityId,
      projectId,
      revisionId,
      externalId: 'PIP-1201',
      name: 'Line erection',
      location: 'Unit 2',
    },
  ],
};

function harness(
  options: {
    claims?: unknown[];
    claimCount?: number | null;
    reports?: unknown[];
    versions?: unknown[];
    candidates?: unknown[];
    candidateCount?: number | null;
    snapshot?: unknown;
    access?: unknown[];
    reporterRows?: unknown[];
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
      let data: unknown = [];
      let count: number | null | undefined;
      if (url.pathname.endsWith('/claims')) {
        data = options.claims ?? [claim];
        count =
          options.claimCount === undefined
            ? (data as unknown[]).length
            : options.claimCount;
      } else if (url.pathname.endsWith('/reports')) {
        data = options.reports ?? [report];
      } else if (url.pathname.endsWith('/report_versions')) {
        data = options.versions ?? [original];
      } else if (url.pathname.endsWith('/candidate_matches')) {
        data = options.candidates ?? [candidate];
        count =
          options.candidateCount === undefined
            ? (data as unknown[]).length
            : options.candidateCount;
      } else if (url.pathname.endsWith('/rpc/schedule_snapshot')) {
        data = options.snapshot ?? snapshot;
      } else if (url.pathname.endsWith('/project_members')) {
        data = url.searchParams.has('active')
          ? (options.access ?? [context.member])
          : (options.reporterRows ?? [
              { user_id: reporterId, display_name: 'Field supervisor' },
            ]);
      } else throw new Error(`Unexpected URL ${url.pathname}`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (count != null) headers['Content-Range'] = `0-19/${count}`;
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

const signal = () => new AbortController().signal;

it.each(['planner', 'manager'] as const)(
  'loads an isolated review page for an authorized %s',
  async (role) => {
    const selected = {
      ...context,
      member: { ...context.member, role },
    };
    const { client, calls } = harness({ access: [selected.member] });
    const result = await loadReviewQueue(client, selected, 0, signal());
    expect(result).toMatchObject({ total: 1, page: 0, hasNext: false });
    expect(result.items[0]).toMatchObject({
      reporterName: 'Field supervisor',
      original: { source_text: original.source_text },
      candidates: [{ activity: { externalId: 'PIP-1201' } }],
    });
    const claimCall = calls.find((url) => url.pathname.endsWith('/claims'))!;
    expect(claimCall.searchParams.get('project_id')).toBe(`eq.${projectId}`);
    expect(claimCall.searchParams.get('state')).toContain('pending');
    expect(claimCall.searchParams.get('order')).toBe('id.asc');
  },
);

it('uses stable server pagination and reports whether another page exists', async () => {
  const { client, calls } = harness({ claimCount: 41 });
  const result = await loadReviewQueue(client, context, 2, signal());
  expect(result).toMatchObject({ page: 2, total: 41, hasNext: false });
  const url = calls.find((call) => call.pathname.endsWith('/claims'))!;
  expect(url.searchParams.get('offset')).toBe('40');
  expect(url.searchParams.get('limit')).toBe('20');
});

it('rejects a field role before making a backend request', async () => {
  const { client, calls } = harness();
  await expect(
    loadReviewQueue(
      client,
      { ...context, member: { ...context.member, role: 'reporter' } },
      0,
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(calls).toHaveLength(0);
});

it('returns an explicit empty queue while still rechecking membership', async () => {
  const { client, calls } = harness({ claims: [], claimCount: 0 });
  await expect(loadReviewQueue(client, context, 0, signal())).resolves.toEqual({
    items: [],
    page: 0,
    pageSize: 20,
    total: 0,
    hasNext: false,
  });
  expect(calls.map((url) => url.pathname)).toEqual([
    '/rest/v1/claims',
    '/rest/v1/project_members',
  ]);
});

it('does not substitute active-schedule labels for a historical candidate', async () => {
  const historicalRevision = '10000000-0000-4000-8000-000000000009';
  const { client } = harness({
    candidates: [{ ...candidate, revision_id: historicalRevision }],
  });
  const result = await loadReviewQueue(client, context, 0, signal());
  expect(result.items[0]?.candidates[0]).toMatchObject({
    revision_id: historicalRevision,
    activity: null,
  });
});

it.each([
  { reports: [] },
  { versions: [] },
  { claimCount: null },
  { claimCount: 2 },
  { candidateCount: 2 },
  { candidates: [{ ...candidate, project_id: reporterId }] },
  { snapshot: { ...snapshot, projectId: reporterId } },
])('rejects incomplete or cross-project results: %j', async (options) => {
  const { client } = harness(options);
  await expect(loadReviewQueue(client, context, 0, signal())).rejects.toThrow();
});

it('rejects revoked or downgraded membership after the queue read', async () => {
  const revoked = harness({ access: [] });
  await expect(
    loadReviewQueue(revoked.client, context, 0, signal()),
  ).rejects.toMatchObject({ kind: 'access' });
  const downgraded = harness({
    access: [{ ...context.member, role: 'reporter', version: 4 }],
  });
  await expect(
    loadReviewQueue(downgraded.client, context, 0, signal()),
  ).rejects.toMatchObject({ kind: 'access' });
});

it('maps production permission failures without exposing database details', async () => {
  const { client } = harness({ error: '42501' });
  await expect(loadReviewQueue(client, context, 0, signal())).rejects.toEqual(
    expect.objectContaining({
      kind: 'access',
      message: 'Manager access is no longer available for this project.',
    }),
  );
});
