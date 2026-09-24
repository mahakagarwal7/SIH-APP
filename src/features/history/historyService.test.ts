import { createClient } from '@supabase/supabase-js';

import {
  defaultHistoryFilters,
  type ExecutionHistoryEntry,
} from './historyContracts';
import {
  filterHistoryEntries,
  historyPage,
  loadExecutionHistory,
} from './historyService';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const revisionId = '10000000-0000-4000-8000-000000000005';
const activityId = '10000000-0000-4000-8000-000000000006';
const eventId = '10000000-0000-4000-8000-000000000007';
const decisionId = '10000000-0000-4000-8000-000000000008';

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

const entry: ExecutionHistoryEntry = {
  eventId,
  claimId,
  reportId,
  decisionId,
  auditId: 41,
  activityId,
  externalId: 'PIP-1201',
  activityName: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  revisionId,
  eventKind: 'FINISH',
  eventDate: '2026-09-23',
  quote: 'Line erection finished',
  reason: 'Evidence and activity match were checked.',
  reviewer: 'Project planner',
  reviewerId: userId,
  acceptedAt: '2026-09-23T10:30:00+00:00',
  effective: true,
  supersedesEventId: null,
  sourceId: 'VOICE-41',
  source: 'Line erection finished in Unit 2.',
  sourceUrl: `/planner/review?claim=${claimId}`,
  provenance: {
    sourceRecordId: 'VOICE-41',
    sheet: 'Voice_Reports',
    row: 41,
    sourceMessageAt: null,
    reportingWorkDate: '2026-09-23',
    reportedByLabel: 'Site reporter',
    channel: 'voice',
    raw: {},
    timezone: 'Asia/Kolkata',
    datePolicy: 'confirmed work date',
  },
  media: [],
  matchScore: 0.94,
  matchReasons: { location: 1 },
  calendar: 'Standard',
  facts: {
    eventDate: '2026-09-23',
    evidenceQuote: 'Line erection finished',
  },
};

const activity = {
  id: activityId,
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  calendar: 'Mon–Sat; Sunday off; no holidays',
  discipline: 'Piping',
  location: 'Unit 2',
  assignedReporterId: null,
  targetQuantity: 4,
  unit: 'spools',
  acceptedQuantity: 4,
  actualStart: '2026-09-20',
  actualFinish: '2026-09-23',
  reportedProgress: true,
  acceptedPercent: null,
  percentBasis: null,
  progressAsOf: null,
  milestoneDate: null,
  nodeKind: 'task',
};

const snapshot = {
  projectId,
  projectName: 'Refinery upgrade',
  revisionId,
  activities: [activity],
};

function harness(
  options: {
    history?: unknown;
    snapshot?: unknown;
    access?: unknown[];
    errorPath?: 'history' | 'snapshot' | 'access';
    errorCode?: string;
    errorMessage?: string;
  } = {},
) {
  const calls: URL[] = [];
  const bodies = new Map<string, string>();
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url);
      const target = url.pathname.endsWith('/rpc/execution_history')
        ? 'history'
        : url.pathname.endsWith('/rpc/schedule_snapshot')
          ? 'snapshot'
          : url.pathname.endsWith('/project_members')
            ? 'access'
            : null;
      if (!target) throw new Error(`Unexpected URL ${url.pathname}`);
      if (init?.body) bodies.set(target, String(init.body));
      if (options.errorPath === target)
        return new Response(
          JSON.stringify({
            code: options.errorCode ?? 'XX000',
            message: options.errorMessage ?? 'database detail',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      const data =
        target === 'history'
          ? (options.history ?? [entry])
          : target === 'snapshot'
            ? (options.snapshot ?? snapshot)
            : (options.access ?? [context.member]);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(data), {
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
  return { client, calls, bodies };
}

const signal = () => new AbortController().signal;

it.each(['planner', 'manager'] as const)(
  'loads exact accepted records for an authorized %s and rechecks access',
  async (role) => {
    const selected = { ...context, member: { ...context.member, role } };
    const { client, calls, bodies } = harness({ access: [selected.member] });
    await expect(
      loadExecutionHistory(client, selected, signal()),
    ).resolves.toMatchObject({
      entries: [{ eventId, quote: entry.quote, effective: true }],
      snapshot: { projectId, activities: [{ id: activityId }] },
    });
    expect(JSON.parse(bodies.get('history')!)).toEqual({
      p_project: projectId,
    });
    expect(calls.some((url) => url.pathname.endsWith('/project_members'))).toBe(
      true,
    );
  },
);

it('accepts an empty production reviewer display name for UI fallback', async () => {
  const { client } = harness({ history: [{ ...entry, reviewer: '' }] });
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).resolves.toMatchObject({ entries: [{ reviewer: '' }] });
});

it('rejects a field role before making a backend request', async () => {
  const { client, calls } = harness();
  await expect(
    loadExecutionHistory(
      client,
      { ...context, member: { ...context.member, role: 'reporter' } },
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(calls).toHaveLength(0);
});

it.each([
  { history: [{ ...entry, quote: 'Different duplicated quote' }] },
  { history: [entry, entry] },
  {
    history: [
      entry,
      {
        ...entry,
        eventId: '10000000-0000-4000-8000-000000000001',
        decisionId: '10000000-0000-4000-8000-000000000011',
      },
    ],
  },
  { snapshot: { ...snapshot, projectId: userId } },
  { access: [] },
  { access: [{ ...context.member, version: 4 }] },
])('rejects malformed, mismatched or revoked reads: %j', async (options) => {
  const { client } = harness(options);
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).rejects.toThrow();
});

it('requires corrections to reference the same activity and status graph', async () => {
  const correction: ExecutionHistoryEntry = {
    ...entry,
    eventId: '10000000-0000-4000-8000-000000000009',
    decisionId: '10000000-0000-4000-8000-000000000010',
    acceptedAt: '2026-09-24T10:30:00+00:00',
    supersedesEventId: eventId,
  };
  const { client } = harness({
    history: [{ ...entry, effective: false }, correction],
  });
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).resolves.toMatchObject({
    entries: [{ effective: false }, { supersedesEventId: eventId }],
  });

  const invalid = harness({ history: [entry, correction] });
  await expect(
    loadExecutionHistory(invalid.client, context, signal()),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('maps access and prototype-limit errors without hiding their meaning', async () => {
  const denied = harness({ errorPath: 'history', errorCode: '42501' });
  await expect(
    loadExecutionHistory(denied.client, context, signal()),
  ).rejects.toMatchObject({ kind: 'access' });

  const limit = harness({
    errorPath: 'history',
    errorCode: '22023',
    errorMessage: 'History exceeds prototype limit; request a scoped export',
  });
  await expect(
    loadExecutionHistory(limit.client, context, signal()),
  ).rejects.toMatchObject({ kind: 'limit' });
});

it.each([
  'General',
  'HSE',
  'Quality',
  'Structural',
  'Mechanical',
  'Instrumentation',
])('loads valid production schedule discipline %s', async (discipline) => {
  const { client } = harness({
    snapshot: {
      ...snapshot,
      activities: [{ ...activity, discipline }],
    },
  });
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).resolves.toMatchObject({ snapshot: { activities: [{ discipline }] } });
});

it('preserves PostgreSQL microseconds when validating history order', async () => {
  const later: ExecutionHistoryEntry = {
    ...entry,
    eventId: '10000000-0000-4000-8000-000000000011',
    decisionId: '10000000-0000-4000-8000-000000000012',
    acceptedAt: '2026-09-23T10:00:00.123457+00:00',
  };
  const earlier: ExecutionHistoryEntry = {
    ...entry,
    eventId: 'f0000000-0000-4000-8000-000000000001',
    decisionId: 'f0000000-0000-4000-8000-000000000002',
    acceptedAt: '2026-09-23T10:00:00.123456+00:00',
  };
  const { client } = harness({ history: [earlier, later] });
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).resolves.toMatchObject({
    entries: [
      { acceptedAt: earlier.acceptedAt },
      { acceptedAt: later.acceptedAt },
    ],
  });
});

it.each([
  { media: 'not an array' },
  { media: [{ attachmentId: 'not-a-uuid' }] },
  { provenance: { sourceRecordId: 'VOICE-41' } },
])('rejects malformed capture evidence metadata: %j', async (metadata) => {
  const { client } = harness({ history: [{ ...entry, ...metadata }] });
  await expect(
    loadExecutionHistory(client, context, signal()),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('applies the web-supported evidence filters and newest-first paging', () => {
  const civil: ExecutionHistoryEntry = {
    ...entry,
    eventId: '10000000-0000-4000-8000-000000000011',
    decisionId: '10000000-0000-4000-8000-000000000012',
    activityId: '10000000-0000-4000-8000-000000000013',
    externalId: 'CIV-0401',
    activityName: 'Pump foundation',
    discipline: 'Civil',
    location: 'Pump house',
    acceptedAt: '2026-09-24T10:30:00+00:00',
    sourceId: null,
  };
  expect(
    filterHistoryEntries([entry, civil], {
      ...defaultHistoryFilters,
      search: 'pump house',
      discipline: 'Civil',
      state: 'effective',
    }).map((row) => row.eventId),
  ).toEqual([civil.eventId]);
  expect(
    filterHistoryEntries([entry, civil], defaultHistoryFilters).map(
      (row) => row.eventId,
    ),
  ).toEqual([civil.eventId, entry.eventId]);

  const rows = Array.from({ length: 42 }, (_, index) => index);
  expect(historyPage(rows, 2)).toMatchObject({
    rows: [40, 41],
    page: 2,
    from: 40,
    total: 42,
    hasNext: false,
  });
  expect(historyPage(rows, 99).page).toBe(2);
});
