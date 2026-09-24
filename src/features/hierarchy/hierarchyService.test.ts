import { createClient } from '@supabase/supabase-js';

import {
  assignmentContext,
  hierarchyChildren,
  hierarchyPath,
} from './hierarchyModel';
import { loadTaskHierarchy } from './hierarchyService';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const revisionId = '10000000-0000-4000-8000-000000000003';
const activityId = '10000000-0000-4000-8000-000000000004';
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
const activity: ScheduleActivity = {
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
  assignedReporterId: userId,
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
  hierarchyPath: [
    { id: 'PROJECT', name: 'Refinery upgrade' },
    { id: 'AREA-A', name: 'Area A' },
    { id: 'WBS-1', name: 'Piping works' },
  ],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: 'PIP-1100',
  calendar: 'Mon–Sat; Sunday off; no holidays',
};
const nodes = [
  {
    externalId: 'PROJECT',
    parentId: null,
    name: 'Refinery upgrade',
    kind: 'summary',
    sourceLevel: 'Project',
    sourceWbs: '1',
    plannedStart: '2026-09-01',
    plannedFinish: '2026-12-31',
    reportable: false,
  },
  {
    externalId: 'AREA-A',
    parentId: 'PROJECT',
    name: 'Area A',
    kind: 'summary',
    sourceLevel: 'Area',
    sourceWbs: '1.2',
    plannedStart: '2026-09-10',
    plannedFinish: '2026-11-30',
    reportable: false,
  },
  {
    externalId: 'WBS-1',
    parentId: 'AREA-A',
    name: 'Piping works',
    kind: 'summary',
    sourceLevel: 'WBS package',
    sourceWbs: '1.2.1',
    plannedStart: '2026-09-15',
    plannedFinish: '2026-10-31',
    reportable: false,
  },
  {
    externalId: 'PIP-1201',
    parentId: 'WBS-1',
    name: 'Line erection',
    kind: 'task',
    sourceLevel: 'Activity',
    sourceWbs: '1.2.1.1',
    plannedStart: '2026-09-20',
    plannedFinish: '2026-09-25',
    reportable: true,
  },
] as const;
const snapshot = {
  projectId,
  projectName: 'Refinery upgrade',
  revisionId,
  revisionLabel: 'Imported baseline 01',
  nodes,
  policyVersion: 2,
  scheduleVersion: 7,
  activities: [activity],
};

function harness(
  options: {
    snapshot?: unknown;
    access?: unknown[];
    error?: string;
  } = {},
) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      if (options.error)
        return new Response(
          JSON.stringify({ code: options.error, message: 'database detail' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      const data = url.pathname.endsWith('/rpc/schedule_snapshot')
        ? (options.snapshot ?? snapshot)
        : url.pathname.endsWith('/project_members')
          ? (options.access ?? [context.member])
          : null;
      if (data === null) throw new Error(`Unexpected URL ${url.pathname}`);
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
  return { client, calls };
}

const signal = () => new AbortController().signal;

it.each(['reporter', 'supervisor', 'planner', 'manager'] as const)(
  'loads only the hierarchy returned under an active %s membership',
  async (role) => {
    const selected = { ...context, member: { ...context.member, role } };
    const visibleSnapshot = ['planner', 'manager'].includes(role)
      ? snapshot
      : { ...snapshot, nodes: [] };
    const { client, calls } = harness({
      snapshot: visibleSnapshot,
      access: [selected.member],
    });
    const result = await loadTaskHierarchy(
      client,
      selected,
      activityId,
      signal(),
    );
    expect(
      hierarchyPath(result.hierarchy.nodes, activity.externalId).path.map(
        (node) => node.name,
      ),
    ).toEqual(['Refinery upgrade', 'Area A', 'Piping works', 'Line erection']);
    expect(result.hierarchy.limited).toBe(
      !['planner', 'manager'].includes(role),
    );
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ p_project: projectId }));
    expect(calls.at(-1)?.url.pathname).toContain('project_members');
  },
);

it('rejects invalid or non-visible activities without leaking another branch', async () => {
  const { client, calls } = harness();
  await expect(
    loadTaskHierarchy(client, context, 'not-a-uuid', signal()),
  ).rejects.toMatchObject({ kind: 'missing' });
  expect(calls).toHaveLength(0);
  await expect(
    loadTaskHierarchy(
      client,
      context,
      '10000000-0000-4000-8000-000000000099',
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'missing' });
});

it('keeps a branch visible when its source parent is missing', async () => {
  const orphanNodes = nodes.map((node) =>
    node.externalId === 'AREA-A' ? { ...node, parentId: 'MISSING' } : node,
  );
  const { client } = harness({ snapshot: { ...snapshot, nodes: orphanNodes } });
  const result = await loadTaskHierarchy(client, context, activityId, signal());
  expect(
    hierarchyPath(result.hierarchy.nodes, activity.externalId),
  ).toMatchObject({ missingParentId: 'MISSING' });
});

it('rejects cyclic source relationships rather than recursing forever', async () => {
  const cyclic = nodes.map((node) =>
    node.externalId === 'PROJECT' ? { ...node, parentId: 'WBS-1' } : node,
  );
  const { client } = harness({ snapshot: { ...snapshot, nodes: cyclic } });
  await expect(
    loadTaskHierarchy(client, context, activityId, signal()),
  ).rejects.toMatchObject({ kind: 'changed' });
});

it('represents a selected leaf as an empty branch and preserves assignment meaning', async () => {
  const { client } = harness();
  const result = await loadTaskHierarchy(client, context, activityId, signal());
  expect(
    hierarchyChildren(result.hierarchy.nodes, activity.externalId),
  ).toEqual([]);
  expect(assignmentContext(result.activity, userId)).toBe('Assigned to you');
  expect(
    assignmentContext({ ...result.activity, assignedReporterId: null }, userId),
  ).toBe('No reporter assigned');
});

it.each([{ access: [] }, { access: [{ ...context.member, version: 4 }] }])(
  'rejects revoked or changed membership: %j',
  async (options) => {
    const { client } = harness(options);
    await expect(
      loadTaskHierarchy(client, context, activityId, signal()),
    ).rejects.toThrow();
  },
);
