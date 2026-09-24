import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { loadMyWork, WorkReadError } from './myWorkService';
import { useProjectSelection } from './useProjectSelection';

function client() {
  const result = getSupabase();
  if (!result) throw new WorkReadError('unavailable');
  return result;
}

export function useDefaultProject() {
  return useProjectSelection();
}

export function useMyWork() {
  const project = useProjectSelection();
  const context = project.data;
  const work = useQuery({
    queryKey: [
      'my-work',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new WorkReadError('access');
      return loadMyWork(client(), context, signal);
    },
  });
  const projectRefetch = project.refetch;
  const workRefetch = work.refetch;
  const projectId = context?.project.id;
  const version = context?.member.version;
  const refresh = useCallback(async () => {
    if (project.offline) return;
    const result = await projectRefetch();
    const current = result.data?.find(
      (candidate) => candidate.project.id === projectId,
    );
    // A different project/version starts its own query. Never refetch the previous context after lost access.
    if (
      current &&
      current.project.id === projectId &&
      current.member.version === version
    ) {
      await workRefetch();
    }
  }, [project.offline, projectRefetch, workRefetch, projectId, version]);
  return { project, work, refresh, offline: project.offline };
}
