import { z } from 'zod';

import {
  membershipSchema,
  snapshotSchema,
} from '@/features/projects/myWorkContracts';

import {
  executionHistorySchema,
  type ExecutionHistoryEntry,
  type HistoryFilters,
} from './historyContracts';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
const memberColumns = 'project_id,user_id,display_name,role,active,version';
export const HISTORY_PAGE_SIZE = 20;

export class HistoryReadError extends Error {
  constructor(
    public readonly kind: 'access' | 'changed' | 'limit' | 'unavailable',
  ) {
    super(
      kind === 'access'
        ? 'Manager access is no longer available for this project.'
        : kind === 'changed'
          ? 'Execution history changed while loading. Refresh to load a consistent record.'
          : kind === 'limit'
            ? 'This project history is too large for the mobile view. Use a scoped planner export.'
            : 'Could not load execution history. Connect and try again.',
    );
  }
}

function readError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  throw new HistoryReadError(
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
  if (!result.success) throw new HistoryReadError('changed');
  return result.data;
}

export async function loadExecutionHistory(
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
    throw new HistoryReadError('access');

  const [historyResult, snapshotResult] = await Promise.all([
    client
      .rpc('execution_history', { p_project: project.id })
      .abortSignal(signal),
    client
      .rpc('schedule_snapshot', { p_project: project.id })
      .abortSignal(signal),
  ]);
  readError(historyResult.error);
  readError(snapshotResult.error);
  const entries = parse(executionHistorySchema, historyResult.data);
  const snapshot = parse(snapshotSchema, snapshotResult.data);
  if (
    snapshot.projectId !== project.id ||
    snapshot.activities.some(
      (activity) =>
        activity.projectId !== project.id ||
        activity.revisionId !== snapshot.revisionId,
    )
  )
    throw new HistoryReadError('changed');

  const accessResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new HistoryReadError('access');
  const current = parse(membershipSchema, accessResult.data);
  if (
    current.project_id !== project.id ||
    current.user_id !== member.user_id ||
    !current.active ||
    !['planner', 'manager'].includes(current.role)
  )
    throw new HistoryReadError('access');
  if (current.version !== member.version || current.role !== member.role)
    throw new HistoryReadError('changed');

  return { entries, snapshot };
}

export function filterHistoryEntries(
  entries: ExecutionHistoryEntry[],
  filters: HistoryFilters,
) {
  const query = filters.search.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry) =>
        (filters.discipline === 'All' ||
          entry.discipline === filters.discipline) &&
        (filters.state === 'all' ||
          (filters.state === 'effective') === entry.effective) &&
        (!filters.activityId || entry.activityId === filters.activityId) &&
        `${entry.externalId} ${entry.activityName} ${entry.location} ${entry.sourceId ?? ''} ${entry.quote} ${entry.reason}`
          .toLocaleLowerCase()
          .includes(query),
    )
    .slice()
    .reverse();
}

export function historyPage<T>(rows: T[], requestedPage: number) {
  const lastPage = Math.max(0, Math.ceil(rows.length / HISTORY_PAGE_SIZE) - 1);
  const page = Math.min(Math.max(0, requestedPage), lastPage);
  const from = page * HISTORY_PAGE_SIZE;
  return {
    rows: rows.slice(from, from + HISTORY_PAGE_SIZE),
    page,
    from,
    total: rows.length,
    hasNext: from + HISTORY_PAGE_SIZE < rows.length,
  };
}

export type ExecutionHistoryData = Awaited<
  ReturnType<typeof loadExecutionHistory>
>;
export type HistoryActivity =
  ExecutionHistoryData['snapshot']['activities'][number];
