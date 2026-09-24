import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useProjectSelection } from '../projects/useProjectSelection';

import { loadManagerOverview, OverviewReadError } from './overviewService';

function client() {
  const result = getSupabase();
  if (!result) throw new OverviewReadError('unavailable');
  return result;
}

export function useManagerOverview() {
  const project = useProjectSelection();
  const context = project.data;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const overview = useQuery({
    queryKey: [
      'manager-overview',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && authorized && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new OverviewReadError('access');
      return loadManagerOverview(client(), context, signal);
    },
  });
  const projectRefetch = project.refetch;
  const overviewRefetch = overview.refetch;
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
      current.member.version === version &&
      ['planner', 'manager'].includes(current.member.role)
    )
      await overviewRefetch();
  }, [overviewRefetch, project.offline, projectId, projectRefetch, version]);
  return { project, overview, refresh, authorized: !!authorized };
}
