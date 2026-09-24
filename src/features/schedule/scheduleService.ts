import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';

import { managerScheduleSchema } from './scheduleContracts';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
const memberColumns = 'project_id,user_id,display_name,role,active,version';

export class ScheduleReadError extends Error {
  constructor(public readonly kind: 'access' | 'changed' | 'unavailable') {
    super(
      kind === 'access'
        ? 'Manager access is no longer available for this project.'
        : kind === 'changed'
          ? 'The active schedule changed while loading. Refresh to load its current revision.'
          : 'Could not load the accepted schedule. Connect and try again.',
    );
  }
}

function readError(error: { code?: string } | null) {
  if (error)
    throw new ScheduleReadError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'access'
        : 'unavailable',
    );
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ScheduleReadError('changed');
  return result.data;
}

export async function loadManagerSchedule(
  client: Client,
  context: ProjectContext,
  signal: AbortSignal,
) {
  const { member, project } = context;
  if (
    !member.active ||
    member.project_id !== project.id ||
    !['planner', 'manager'].includes(member.role)
  )
    throw new ScheduleReadError('access');

  const result = await client
    .rpc('schedule_snapshot', { p_project: project.id })
    .abortSignal(signal);
  readError(result.error);
  if (result.data === null) throw new ScheduleReadError('access');
  const snapshot = parse(managerScheduleSchema, result.data);
  if (snapshot.projectId !== project.id) throw new ScheduleReadError('changed');

  const accessResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new ScheduleReadError('access');
  const current = parse(membershipSchema, accessResult.data);
  if (
    current.project_id !== project.id ||
    current.user_id !== member.user_id ||
    !current.active ||
    !['planner', 'manager'].includes(current.role)
  )
    throw new ScheduleReadError('access');
  if (current.version !== member.version || current.role !== member.role)
    throw new ScheduleReadError('changed');
  return snapshot;
}
