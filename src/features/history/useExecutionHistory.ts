import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useProjectSelection } from '../projects/useProjectSelection';

import { HistoryReadError, loadExecutionHistory } from './historyService';

function client() {
  const result = getSupabase();
  if (!result) throw new HistoryReadError('unavailable');
  return result;
}

export function useExecutionHistory() {
  const project = useProjectSelection();
  const context = project.data;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const history = useQuery({
    queryKey: [
      'execution-history',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && authorized && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new HistoryReadError('access');
      return loadExecutionHistory(client(), context, signal);
    },
  });
  const projectRefetch = project.refetch;
  const historyRefetch = history.refetch;
  const projectId = context?.project.id;
  const version = context?.member.version;
  const refresh = useCallback(async () => {
    if (project.offline) return;
    const result = await projectRefetch();
    const current = result.data?.find(
      (candidate) => candidate.project.id === projectId,
    );
    if (
      current &&
      current.project.id === projectId &&
      current.member.version === version &&
      ['planner', 'manager'].includes(current.member.role)
    )
      await historyRefetch();
  }, [historyRefetch, project.offline, projectId, projectRefetch, version]);
  return { project, history, refresh, authorized: !!authorized };
}
