import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useProjectSelection } from '../projects/useProjectSelection';

import { HierarchyReadError, loadTaskHierarchy } from './hierarchyService';

function client() {
  const result = getSupabase();
  if (!result) throw new HierarchyReadError('unavailable');
  return result;
}

export function useTaskHierarchy(activityId: string) {
  const project = useProjectSelection();
  const context = project.data;
  const hierarchy = useQuery({
    queryKey: [
      'task-hierarchy',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
      activityId,
    ],
    enabled: !!context && !!activityId && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new HierarchyReadError('access');
      return loadTaskHierarchy(client(), context, activityId, signal);
    },
  });
  const projectRefetch = project.refetch;
  const hierarchyRefetch = hierarchy.refetch;
  const projectId = context?.project.id;
  const version = context?.member.version;
  const refresh = useCallback(async () => {
    if (project.offline) return;
    const result = await projectRefetch();
    const current = result.data?.find(
      (candidate) => candidate.project.id === projectId,
    );
    if (current && current.member.version === version) await hierarchyRefetch();
  }, [hierarchyRefetch, project.offline, projectId, projectRefetch, version]);
  return { project, hierarchy, refresh };
}
