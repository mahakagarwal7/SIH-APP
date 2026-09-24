import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';
import { managerScheduleSchema } from '@/features/schedule/scheduleContracts';

import { buildHierarchyGraph, HierarchyGraphError } from './hierarchyModel';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
const memberColumns = 'project_id,user_id,display_name,role,active,version';
const activityIdSchema = z.uuid();

export class HierarchyReadError extends Error {
  constructor(
    public readonly kind: 'access' | 'changed' | 'missing' | 'unavailable',
  ) {
    super(
      kind === 'access'
        ? 'Project access is no longer available.'
        : kind === 'changed'
          ? 'The task hierarchy changed while loading. Refresh to load its current revision.'
          : kind === 'missing'
            ? 'This activity is not available in the selected project.'
            : 'Could not load the task hierarchy. Connect and try again.',
    );
  }
}

function readError(error: { code?: string } | null) {
  if (error)
    throw new HierarchyReadError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'access'
        : 'unavailable',
    );
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HierarchyReadError('changed');
  return result.data;
}

export async function loadTaskHierarchy(
  client: Client,
  context: ProjectContext,
  activityId: string,
  signal: AbortSignal,
) {
  const { member, project } = context;
  const validActivityId = activityIdSchema.safeParse(activityId).success;
  if (!member.active || member.project_id !== project.id || !validActivityId)
    throw new HierarchyReadError(validActivityId ? 'access' : 'missing');

  const result = await client
    .rpc('schedule_snapshot', { p_project: project.id })
    .abortSignal(signal);
  readError(result.error);
  if (result.data === null) throw new HierarchyReadError('access');
  const snapshot = parse(managerScheduleSchema, result.data);
  if (snapshot.projectId !== project.id)
    throw new HierarchyReadError('changed');
  const activity = snapshot.activities.find((row) => row.id === activityId);
  if (!activity) throw new HierarchyReadError('missing');
  let hierarchy;
  try {
    hierarchy = buildHierarchyGraph(snapshot, activity);
  } catch (error) {
    if (error instanceof HierarchyGraphError)
      throw new HierarchyReadError('changed');
    throw error;
  }

  const accessResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new HierarchyReadError('access');
  const current = parse(membershipSchema, accessResult.data);
  if (
    current.project_id !== project.id ||
    current.user_id !== member.user_id ||
    !current.active
  )
    throw new HierarchyReadError('access');
  if (current.version !== member.version || current.role !== member.role)
    throw new HierarchyReadError('changed');
  return { snapshot, activity, hierarchy };
}
