import { z } from 'zod';

import {
  actionableReviewStates,
  reviewClaimSchema,
} from '@/features/claims/reviewContracts';
import { reviewClaimColumns } from '@/features/claims/reviewQueueService';
import { executionHistorySchema } from '@/features/history/historyContracts';
import { membershipSchema } from '@/features/projects/myWorkContracts';
import { managerScheduleSchema } from '@/features/schedule/scheduleContracts';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
const memberColumns = 'project_id,user_id,display_name,role,active,version';
export const OVERVIEW_ATTENTION_LIMIT = 5;

export class OverviewReadError extends Error {
  constructor(
    public readonly kind: 'access' | 'changed' | 'limit' | 'unavailable',
  ) {
    super(
      kind === 'access'
        ? 'Manager access is no longer available for this project.'
        : kind === 'changed'
          ? 'Overview data changed while loading. Refresh to load a consistent view.'
          : kind === 'limit'
            ? 'Accepted history is too large for the mobile overview. Use a scoped planner export.'
            : 'Could not load the execution overview. Connect and try again.',
    );
  }
}

function readError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  throw new OverviewReadError(
    error.code === '42501' || error.code === 'PGRST301'
      ? 'access'
      : error.code === '22023' &&
          error.message?.includes('History exceeds prototype limit')
        ? 'limit'
        : 'unavailable',
  );
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new OverviewReadError('changed');
  return result.data;
}

export async function loadManagerOverview(
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
    throw new OverviewReadError('access');

  const [scheduleResult, historyResult, claimsResult] = await Promise.all([
    client
      .rpc('schedule_snapshot', { p_project: project.id })
      .abortSignal(signal),
    client
      .rpc('execution_history', { p_project: project.id })
      .abortSignal(signal),
    client
      .from('claims')
      .select(reviewClaimColumns, { count: 'exact' })
      .eq('project_id', project.id)
      .in('state', [...actionableReviewStates])
      .order('id')
      .range(0, OVERVIEW_ATTENTION_LIMIT - 1)
      .abortSignal(signal),
  ]);
  [scheduleResult, historyResult, claimsResult].forEach((result) =>
    readError(result.error),
  );
  if (
    claimsResult.count === null ||
    !Number.isSafeInteger(claimsResult.count) ||
    claimsResult.count < 0
  )
    throw new OverviewReadError('changed');

  const snapshot = parse(managerScheduleSchema, scheduleResult.data);
  const history = parse(executionHistorySchema, historyResult.data);
  const attention = parse(z.array(reviewClaimSchema), claimsResult.data);
  if (
    snapshot.projectId !== project.id ||
    attention.length !==
      Math.min(OVERVIEW_ATTENTION_LIMIT, claimsResult.count) ||
    new Set(attention.map((claim) => claim.id)).size !== attention.length ||
    attention.some((claim) => claim.project_id !== project.id)
  )
    throw new OverviewReadError('changed');

  const accessResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new OverviewReadError('access');
  const current = parse(membershipSchema, accessResult.data);
  if (
    current.project_id !== project.id ||
    current.user_id !== member.user_id ||
    !current.active ||
    !['planner', 'manager'].includes(current.role)
  )
    throw new OverviewReadError('access');
  if (current.version !== member.version || current.role !== member.role)
    throw new OverviewReadError('changed');

  return {
    snapshot,
    history,
    attention,
    actionableCount: claimsResult.count,
  };
}

export type ManagerOverviewData = Awaited<
  ReturnType<typeof loadManagerOverview>
>;
