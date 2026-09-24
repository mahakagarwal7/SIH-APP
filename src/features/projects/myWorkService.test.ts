import { createClient } from '@supabase/supabase-js';

import {
  loadActiveProjects,
  loadDefaultProject,
  loadMyWork,
} from './myWorkService';

import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const activityId = '10000000-0000-4000-8000-000000000003';
const revisionId = '10000000-0000-4000-8000-000000000004';
const context = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Field worker',
    role: 'reporter' as const,
    active: true,
    version: 1,
  },
  project: { id: projectId, name: 'Site project' },
};
const activity = {
  id: activityId,
  projectId,
  revisionId,
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  assignedReporterId: userId,
  targetQuantity: 8,
  unit: 'spools',
  acceptedQuantity: 2,
  actualStart: null,
  actualFinish: null,
};
const snapshot = {
  projectId,
  projectName: 'Site project',
  revisionId,
  activities: [activity],
};
const assignment = {
  project_id: projectId,
  activity_id: activityId,
  version: 1,
  reporter_id: userId,
  effective_from: '2026-09-23',
  effective_to: '2026-09-24',
};
const signal = () => new AbortController().signal;

function harness(
  options: {
    memberships?: unknown;
    project?: unknown;
    snapshot?: unknown;
    assignments?: unknown[];
    count?: number | null;
    page?: (offset: number) => { data: unknown[]; count: number | null };
    revoke?: boolean;
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
          { status: 403 },
        );
      let data: unknown;
      let count: number | null | undefined;
      if (url.pathname.endsWith('/projects'))
        data =
          options.project === undefined ? [context.project] : options.project;
      else if (url.pathname.endsWith('/project_members')) {
        const isAccessCheck = url.searchParams.has('project_id');
        data =
          isAccessCheck && options.revoke
            ? []
            : (options.memberships ?? [context.member]);
      } else if (url.pathname.endsWith('/rpc/schedule_snapshot'))
        data = options.snapshot === undefined ? snapshot : options.snapshot;
      else if (url.pathname.endsWith('/assignment_versions')) {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const page = options.page?.(offset);
        data = page?.data ?? options.assignments ?? [assignment];
        count = page
          ? page.count
          : options.count === undefined
            ? (data as unknown[]).length
            : options.count;
      } else throw new Error(`Unexpected URL: ${url.pathname}`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (count != null) headers['Content-Range'] = `0-199/${count}`;
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

it('selects only the signed-in active membership with the web default ordering', async () => {
  const { client, calls } = harness();
  await expect(loadDefaultProject(client, userId, signal())).resolves.toEqual(
    context,
  );
  expect(calls[0]?.url.searchParams.get('user_id')).toBe(`eq.${userId}`);
  expect(calls[0]?.url.searchParams.get('active')).toBe('eq.true');
  expect(calls[0]?.url.searchParams.get('order')).toBe('project_id.asc');
  expect(calls[0]?.url.searchParams.get('limit')).toBe('1');
});

it('loads every active membership and maps projects in stable membership order', async () => {
  const secondProjectId = '10000000-0000-4000-8000-000000000005';
  const secondMember = {
    ...context.member,
    project_id: secondProjectId,
    version: 2,
  };
  const { client, calls } = harness({
    memberships: [context.member, secondMember],
    project: [{ id: secondProjectId, name: 'Second site' }, context.project],
  });
  await expect(loadActiveProjects(client, userId, signal())).resolves.toEqual([
    context,
    {
      member: secondMember,
      project: { id: secondProjectId, name: 'Second site' },
    },
  ]);
  expect(calls[0]?.url.searchParams.get('limit')).toBe('101');
  expect(calls[1]?.url.searchParams.get('id')).toContain(projectId);
  expect(calls[1]?.url.searchParams.get('id')).toContain(secondProjectId);
});

it('rejects incomplete project membership results', async () => {
  const missing = harness({ memberships: [context.member], project: [] });
  await expect(
    loadActiveProjects(missing.client, userId, signal()),
  ).rejects.toMatchObject({
    kind: 'changed',
  });
  const crossAccount = harness({
    memberships: [{ ...context.member, user_id: projectId }],
  });
  await expect(
    loadActiveProjects(crossAccount.client, userId, signal()),
  ).rejects.toMatchObject({
    kind: 'access',
  });
});

it('keeps no active membership distinct from a query failure', async () => {
  const empty = harness({ memberships: [] });
  await expect(
    loadDefaultProject(empty.client, userId, signal()),
  ).resolves.toBeNull();
  expect(empty.calls).toHaveLength(1);
  const denied = harness({ error: '42501' });
  await expect(
    loadDefaultProject(denied.client, userId, signal()),
  ).rejects.toMatchObject({ kind: 'access' });
});

it('reads the existing RPC and complete assignment pages then rechecks membership', async () => {
  const { client, calls } = harness({
    page: (offset) => ({
      data:
        offset === 0
          ? Array.from({ length: 200 }, (_, i) => ({
              ...assignment,
              version: 202 - i,
            }))
          : [{ ...assignment, version: 2 }],
      count: 201,
    }),
  });
  const data = await loadMyWork(client, context, signal());
  expect(data.assignments).toHaveLength(201);
  expect(
    calls.find((c) => c.url.pathname.endsWith('/schedule_snapshot'))?.init
      ?.body,
  ).toBe(JSON.stringify({ p_project: projectId }));
  const pages = calls.filter((c) =>
    c.url.pathname.endsWith('/assignment_versions'),
  );
  expect(pages.map((p) => p.url.searchParams.get('offset'))).toEqual([
    '0',
    '200',
  ]);
  expect(pages[0]?.url.searchParams.get('order')).toBe(
    'activity_id.asc,version.desc',
  );
  expect(pages[0]?.url.searchParams.has('reporter_id')).toBe(false);
  expect(calls.at(-1)?.url.searchParams.get('project_id')).toBe(
    `eq.${projectId}`,
  );
  expect(calls.every((c) => c.init?.signal instanceof AbortSignal)).toBe(true);
});

it.each([
  'Civil',
  'Piping',
  'Electrical',
  'General',
  'HSE',
  'Quality',
  'Structural',
  'Mechanical',
  'Instrumentation',
])('loads assignments for the supported %s discipline', async (discipline) => {
  const { client } = harness({
    snapshot: { ...snapshot, activities: [{ ...activity, discipline }] },
  });
  await expect(loadMyWork(client, context, signal())).resolves.toMatchObject({
    snapshot: { activities: [{ discipline }] },
  });
});

it('rejects a discipline outside the backend contract', async () => {
  const { client } = harness({
    snapshot: {
      ...snapshot,
      activities: [{ ...activity, discipline: 'Unsupported' }],
    },
  });
  await expect(loadMyWork(client, context, signal())).rejects.toMatchObject({
    kind: 'unavailable',
  });
});

it.each([
  { count: null },
  { count: 10001 },
  { count: 2, assignments: [assignment] },
  { assignments: [{ ...assignment, effective_from: '2026-02-30' }] },
  {
    snapshot: {
      ...snapshot,
      activities: [{ ...activity, acceptedQuantity: undefined }],
    },
  },
  {
    snapshot: { ...snapshot, activities: [{ ...activity, projectId: userId }] },
  },
  { assignments: [] },
])('rejects incomplete or inconsistent results: %j', async (options) => {
  const { client } = harness(options);
  await expect(loadMyWork(client, context, signal())).rejects.toThrow();
});

it('rejects a changed page count rather than displaying a truncated task list', async () => {
  const { client } = harness({
    page: (offset) => ({
      data:
        offset === 0
          ? Array.from({ length: 200 }, (_, i) => ({
              ...assignment,
              version: i + 2,
            }))
          : [assignment],
      count: offset === 0 ? 201 : 202,
    }),
  });
  await expect(loadMyWork(client, context, signal())).rejects.toMatchObject({
    kind: 'changed',
  });
});

it('removes access when membership is revoked while work is loading', async () => {
  const { client } = harness({ revoke: true });
  await expect(loadMyWork(client, context, signal())).rejects.toMatchObject({
    kind: 'access',
  });
});

it('represents no active schedule without fabricated work', async () => {
  const { client } = harness({
    snapshot: { ...snapshot, revisionId: null, activities: [] },
    assignments: [],
  });
  await expect(loadMyWork(client, context, signal())).resolves.toMatchObject({
    snapshot: { revisionId: null, activities: [] },
  });
});
