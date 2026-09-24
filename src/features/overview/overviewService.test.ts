import { createClient } from '@supabase/supabase-js';

import { loadManagerOverview } from './overviewService';

import type { ReviewClaim } from '@/features/claims/reviewContracts';
import type { ExecutionHistoryEntry } from '@/features/history/historyContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const revisionId = '10000000-0000-4000-8000-000000000003';
const activityId = '10000000-0000-4000-8000-000000000004';
const claimId = '10000000-0000-4000-8000-000000000005';
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
const activity = {
  id: activityId,
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  stage: 'Erection',
  plannedStart: '2026-09-20',
  plannedFinish: '2026-09-25',
  baselineStart: '2026-09-18',
  baselineFinish: '2026-09-24',
  assignedReporterId: null,
  targetQuantity: 4,
  unit: 'spools',
  actualStart: '2026-09-21',
  actualFinish: null,
  acceptedQuantity: 2,
  actualsVersion: 2,
  acceptedPercent: 50,
  reportedProgress: true,
  percentBasis: 'physical',
  milestoneDate: null,
  progressAsOf: '2026-09-23',
  nodeKind: 'task',
  hierarchyPath: [],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: '',
  calendar: 'Standard',
} satisfies ScheduleActivity;
const snapshot = {
  projectId,
  projectName: 'Refinery upgrade',
  revisionId,
  revisionLabel: 'Imported baseline 01',
  nodes: [],
  policyVersion: 2,
  scheduleVersion: 7,
  activities: [activity],
};
const claim = {
  id: claimId,
  project_id: projectId,
  report_id: '10000000-0000-4000-8000-000000000006',
  report_version: 1,
  run_id: '10000000-0000-4000-8000-000000000007',
  ordinal: 0,
  facts: {
    kind: 'START',
    activityHint: 'Line erection',
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
  version: 1,
  plan_revision_id: revisionId,
  policy_version: 2,
  parent_claim_id: null,
  root_claim_id: null,
  followup_round: 0,
  manual_review: false,
  correction_of_event_id: null,
} satisfies ReviewClaim;
const history = [
  {
    eventId: '10000000-0000-4000-8000-000000000008',
    claimId,
    reportId: claim.report_id,
    decisionId: '10000000-0000-4000-8000-000000000009',
    auditId: 41,
    activityId,
    externalId: 'PIP-1201',
    activityName: 'Line erection',
    discipline: 'Piping',
    location: 'Unit 2',
    revisionId,
    eventKind: 'START',
    eventDate: '2026-09-23',
    quote: 'Line erection started',
    reason: 'Evidence checked',
    reviewer: 'Project planner',
    reviewerId: userId,
    acceptedAt: '2026-09-23T10:30:00+00:00',
    effective: true,
    supersedesEventId: null,
    sourceId: 'VOICE-41',
    source: 'Line erection started',
    sourceUrl: `/planner/review?claim=${claimId}`,
    provenance: {},
    media: [],
    matchScore: 0.94,
    matchReasons: { location: 1 },
    calendar: 'Standard',
    facts: {
      eventDate: '2026-09-23',
      evidenceQuote: 'Line erection started',
    },
  },
] satisfies ExecutionHistoryEntry[];

function harness(
  options: {
    snapshot?: unknown;
    history?: unknown;
    claims?: unknown[];
    claimCount?: number;
    access?: unknown[];
    errorPath?: 'schedule' | 'history' | 'claims' | 'access';
    errorCode?: string;
    errorMessage?: string;
  } = {},
) {
  const calls: { target: string; url: URL; init?: RequestInit }[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const target = url.pathname.endsWith('/rpc/schedule_snapshot')
        ? 'schedule'
        : url.pathname.endsWith('/rpc/execution_history')
          ? 'history'
          : url.pathname.endsWith('/claims')
            ? 'claims'
            : url.pathname.endsWith('/project_members')
              ? 'access'
              : '';
      if (!target) throw new Error(`Unexpected URL ${url.pathname}`);
      calls.push({ target, url, init });
      if (options.errorPath === target)
        return new Response(
          JSON.stringify({
            code: options.errorCode ?? 'XX000',
            message: options.errorMessage ?? 'database detail',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      const data: unknown =
        target === 'schedule'
          ? (options.snapshot ?? snapshot)
          : target === 'history'
            ? (options.history ?? history)
            : target === 'claims'
              ? (options.claims ?? [claim])
              : (options.access ?? [context.member]);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (target === 'claims') {
        const rowCount = Array.isArray(data) ? data.length : 0;
        headers['Content-Range'] =
          `0-${Math.max(0, rowCount - 1)}/${options.claimCount ?? rowCount}`;
      }
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
  'loads the three defined overview sources for an authorized %s and rechecks access',
  async (role) => {
    const selected = { ...context, member: { ...context.member, role } };
    const { client, calls } = harness({ access: [selected.member] });
    await expect(
      loadManagerOverview(client, selected, signal()),
    ).resolves.toMatchObject({
      snapshot: { scheduleVersion: 7, activities: [{ id: activityId }] },
      history: [{ eventId: history[0]!.eventId }],
      attention: [{ id: claimId }],
      actionableCount: 1,
    });
    expect(
      calls.filter((call) => call.target === 'schedule')[0]?.init?.body,
    ).toBe(JSON.stringify({ p_project: projectId }));
    expect(
      calls.filter((call) => call.target === 'history')[0]?.init?.body,
    ).toBe(JSON.stringify({ p_project: projectId }));
    expect(calls.at(-1)?.target).toBe('access');
  },
);

it('rejects field roles without reading overview data', async () => {
  const { client, calls } = harness();
  await expect(
    loadManagerOverview(
      client,
      { ...context, member: { ...context.member, role: 'reporter' } },
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(calls).toHaveLength(0);
});

it('keeps the attention preview bounded while retaining the exact claim count', async () => {
  const claims = Array.from({ length: 5 }, (_, index) => ({
    ...claim,
    id: `10000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
  }));
  const { client } = harness({ claims, claimCount: 6 });
  await expect(
    loadManagerOverview(client, context, signal()),
  ).resolves.toMatchObject({ actionableCount: 6, attention: claims });
});

it.each([
  { snapshot: { ...snapshot, projectId: userId } },
  { history: [{ ...history[0], quote: 'Different duplicated quote' }] },
  { claims: [{ ...claim, project_id: userId }] },
  { claims: [claim], claimCount: 2 },
  { access: [] },
  { access: [{ ...context.member, version: 4 }] },
])(
  'rejects malformed, incomplete, cross-project or changed data: %j',
  async (options) => {
    const { client } = harness(options);
    await expect(
      loadManagerOverview(client, context, signal()),
    ).rejects.toThrow();
  },
);

it('maps authorization, history-limit and transport failures', async () => {
  await expect(
    loadManagerOverview(
      harness({ errorPath: 'claims', errorCode: '42501' }).client,
      context,
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  await expect(
    loadManagerOverview(
      harness({
        errorPath: 'history',
        errorCode: '22023',
        errorMessage:
          'History exceeds prototype limit; request a scoped export',
      }).client,
      context,
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'limit' });
  await expect(
    loadManagerOverview(
      harness({ errorPath: 'schedule' }).client,
      context,
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'unavailable' });
});
