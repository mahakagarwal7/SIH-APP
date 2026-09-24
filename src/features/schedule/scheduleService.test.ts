import { createClient } from '@supabase/supabase-js';

import {
  filterScheduleActivities,
  scheduleBar,
  scheduleDateRange,
  schedulePage,
  scheduleStatus,
} from './scheduleModel';
import { loadManagerSchedule } from './scheduleService';

import type { ScheduleActivity } from './scheduleContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';
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
  hierarchyPath: [{ id: 'AREA-A', name: 'Area A' }],
  sourceLevel: 'Activity',
  sourceWbs: '1.2.1',
  sourceDiscipline: 'Piping',
  duration: 6,
  predecessors: 'PIP-1100',
  calendar: 'Mon–Sat; Sunday off; no holidays',
};
const snapshot = {
  projectId,
  projectName: 'Refinery upgrade',
  revisionId,
  revisionLabel: 'Imported baseline 01',
  nodes: [
    {
      externalId: 'PIP-1201',
      parentId: null,
      name: 'Line erection',
      kind: 'task',
      sourceLevel: 'Activity',
      sourceWbs: '1.2.1',
      plannedStart: '2026-09-20',
      plannedFinish: '2026-09-25',
      reportable: true,
    },
  ],
  policyVersion: 2,
  scheduleVersion: 7,
  activities: [activity],
};

function harness(
  options: {
    snapshot?: unknown;
    access?: unknown[];
    errorPath?: 'schedule' | 'access';
    errorCode?: string;
  } = {},
) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      const target = url.pathname.endsWith('/rpc/schedule_snapshot')
        ? 'schedule'
        : url.pathname.endsWith('/project_members')
          ? 'access'
          : null;
      if (!target) throw new Error(`Unexpected URL ${url.pathname}`);
      if (options.errorPath === target)
        return new Response(
          JSON.stringify({
            code: options.errorCode ?? 'XX000',
            message: 'database detail',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      const data =
        target === 'schedule'
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
  return { client, calls };
}

const signal = () => new AbortController().signal;

it.each(['planner', 'manager'] as const)(
  'loads the active schedule for an authorized %s and rechecks access',
  async (role) => {
    const selected = { ...context, member: { ...context.member, role } };
    const { client, calls } = harness({ access: [selected.member] });
    await expect(
      loadManagerSchedule(client, selected, signal()),
    ).resolves.toMatchObject({
      revisionLabel: 'Imported baseline 01',
      scheduleVersion: 7,
      activities: [{ externalId: 'PIP-1201', actualFinish: null }],
    });
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ p_project: projectId }));
    expect(calls.at(-1)?.url.pathname).toContain('project_members');
  },
);

it('rejects field roles before reading the schedule', async () => {
  const { client, calls } = harness();
  await expect(
    loadManagerSchedule(
      client,
      { ...context, member: { ...context.member, role: 'reporter' } },
      signal(),
    ),
  ).rejects.toMatchObject({ kind: 'access' });
  expect(calls).toHaveLength(0);
});

it.each([
  { snapshot: { ...snapshot, projectId: userId } },
  { snapshot: { ...snapshot, activities: [activity, activity] } },
  {
    snapshot: {
      ...snapshot,
      activities: [
        { ...activity, actualStart: null, actualFinish: '2026-09-23' },
      ],
    },
  },
  {
    snapshot: {
      ...snapshot,
      activities: [{ ...activity, baselineFinish: '2026-09-01' }],
    },
  },
  { access: [] },
  { access: [{ ...context.member, version: 4 }] },
])(
  'rejects malformed, cross-project or changed snapshots: %j',
  async (options) => {
    const { client } = harness(options);
    await expect(
      loadManagerSchedule(client, context, signal()),
    ).rejects.toThrow();
  },
);

it('represents the absence of an active schedule without fabricated rows', async () => {
  const { client } = harness({
    snapshot: {
      ...snapshot,
      revisionId: null,
      revisionLabel: null,
      nodes: [],
      activities: [],
    },
  });
  await expect(
    loadManagerSchedule(client, context, signal()),
  ).resolves.toMatchObject({ revisionId: null, activities: [] });
});

it('maps backend authorization failures', async () => {
  const { client } = harness({ errorPath: 'schedule', errorCode: '42501' });
  await expect(
    loadManagerSchedule(client, context, signal()),
  ).rejects.toMatchObject({ kind: 'access' });
});

it('derives honest status, discipline filters, date bars and local pages', () => {
  expect(scheduleStatus(activity)).toBe('In progress');
  expect(
    scheduleStatus({ ...activity, actualStart: null, reportedProgress: true }),
  ).toBe('Progress reported · start unresolved');
  expect(filterScheduleActivities([activity], 'Civil')).toHaveLength(0);
  const range = scheduleDateRange([activity])!;
  expect(range).toEqual({ start: '2026-09-18', finish: '2026-09-25' });
  expect(scheduleBar('2026-09-20', '2026-09-25', range)).toEqual({
    left: '25%',
    width: '75%',
  });
  expect(
    schedulePage(
      Array.from({ length: 27 }, (_, index) => index),
      1,
    ),
  ).toMatchObject({ rows: [25, 26], page: 1, total: 27, hasNext: false });
});
