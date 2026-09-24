import { z } from 'zod';

import { groupMyWork } from './myWork';
import {
  assignmentSchema,
  membershipSchema,
  projectSchema,
  snapshotSchema,
} from './myWorkContracts';

import type { Database, MembershipRow, ProjectRow } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
export type ProjectContext = { member: MembershipRow; project: ProjectRow };
const memberColumns = 'project_id,user_id,display_name,role,active,version';
const assignmentColumns =
  'project_id,activity_id,version,reporter_id,effective_from,effective_to';

export class WorkReadError extends Error {
  constructor(public readonly kind: 'access' | 'changed' | 'unavailable') {
    super(
      kind === 'access'
        ? 'Project access is no longer available. Refresh to check your access.'
        : kind === 'changed'
          ? 'Work changed while loading. Refresh to load a complete list.'
          : 'Could not load your work. Connect and try again.',
    );
  }
}

function readError(error: { code?: string } | null) {
  if (error)
    throw new WorkReadError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'access'
        : 'unavailable',
    );
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new WorkReadError('unavailable');
  return result.data;
}

export async function loadDefaultProject(
  client: Client,
  userId: string,
  signal: AbortSignal,
): Promise<ProjectContext | null> {
  const members = await client
    .from('project_members')
    .select(memberColumns)
    .eq('user_id', userId)
    .eq('active', true)
    .order('project_id')
    .limit(1)
    .abortSignal(signal);
  readError(members.error);
  const rows = parse(z.array(membershipSchema).max(1), members.data);
  const member = rows[0];
  if (!member) return null;
  if (member.user_id !== userId || !member.active)
    throw new WorkReadError('access');
  const result = await client
    .from('projects')
    .select('id,name')
    .eq('id', member.project_id)
    .abortSignal(signal)
    .maybeSingle();
  readError(result.error);
  if (!result.data) throw new WorkReadError('access');
  const project = parse(projectSchema, result.data);
  if (project.id !== member.project_id) throw new WorkReadError('access');
  return { member, project };
}

export async function loadActiveProjects(
  client: Client,
  userId: string,
  signal: AbortSignal,
): Promise<ProjectContext[]> {
  const membersResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('user_id', userId)
    .eq('active', true)
    .order('project_id')
    .limit(101)
    .abortSignal(signal);
  readError(membersResult.error);
  const members = parse(z.array(membershipSchema).max(100), membersResult.data);
  if (
    members.some((member) => member.user_id !== userId || !member.active) ||
    new Set(members.map((member) => member.project_id)).size !== members.length
  )
    throw new WorkReadError('access');
  if (!members.length) return [];
  const projectIds = members.map((member) => member.project_id);
  const projectsResult = await client
    .from('projects')
    .select('id,name')
    .in('id', projectIds)
    .abortSignal(signal);
  readError(projectsResult.error);
  const projects = parse(z.array(projectSchema).max(100), projectsResult.data);
  const projectsById = new Map(
    projects.map((project) => [project.id, project]),
  );
  if (
    projects.length !== members.length ||
    projects.some((project) => !projectIds.includes(project.id))
  )
    throw new WorkReadError('changed');
  return members.map((member) => {
    const project = projectsById.get(member.project_id);
    if (!project) throw new WorkReadError('changed');
    return { member, project };
  });
}

async function readAssignments(
  client: Client,
  projectId: string,
  signal: AbortSignal,
) {
  const rows: z.infer<typeof assignmentSchema>[] = [];
  const keys = new Set<string>();
  let expected: number | undefined;
  for (let from = 0; from < 10000; from += 200) {
    const result = await client
      .from('assignment_versions')
      .select(assignmentColumns, { count: 'exact' })
      .eq('project_id', projectId)
      .order('activity_id')
      .order('version', { ascending: false })
      .range(from, from + 199)
      .abortSignal(signal);
    readError(result.error);
    if (result.count === null || result.count > 10000)
      throw new WorkReadError('unavailable');
    if (expected !== undefined && expected !== result.count)
      throw new WorkReadError('changed');
    expected = result.count;
    const page = parse(z.array(assignmentSchema), result.data);
    for (const row of page) {
      const key = `${row.activity_id}:${row.version}`;
      if (keys.has(key) || row.project_id !== projectId)
        throw new WorkReadError('changed');
      keys.add(key);
      rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (!page.length || rows.length > expected)
      throw new WorkReadError('changed');
  }
  throw new WorkReadError('unavailable');
}

export async function loadMyWork(
  client: Client,
  context: ProjectContext,
  signal: AbortSignal,
) {
  const { member, project } = context;
  const [result, assignments] = await Promise.all([
    client
      .rpc('schedule_snapshot', { p_project: project.id })
      .abortSignal(signal),
    readAssignments(client, project.id, signal),
  ]);
  readError(result.error);
  if (result.data === null) throw new WorkReadError('access');
  const snapshot = parse(snapshotSchema, result.data);
  if (
    snapshot.projectId !== project.id ||
    snapshot.activities.some(
      (a) => a.projectId !== project.id || a.revisionId !== snapshot.revisionId,
    ) ||
    new Set(snapshot.activities.map((a) => a.id)).size !==
      snapshot.activities.length
  )
    throw new WorkReadError('changed');
  // The snapshot and assignment pages are separate reads. Reject detected mismatches instead of inventing a coherent result.
  try {
    groupMyWork(snapshot.activities, assignments, member.user_id, '2000-01-01');
  } catch {
    throw new WorkReadError('changed');
  }
  const access = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(access.error);
  if (!access.data) throw new WorkReadError('access');
  const current = parse(membershipSchema, access.data);
  if (
    !current.active ||
    current.user_id !== member.user_id ||
    current.project_id !== project.id
  )
    throw new WorkReadError('access');
  if (current.version !== member.version) throw new WorkReadError('changed');
  return { snapshot, assignments };
}
