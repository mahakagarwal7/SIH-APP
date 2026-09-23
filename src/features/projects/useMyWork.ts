import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase';

import { loadDefaultProject, loadMyWork, WorkReadError } from './myWorkService';

function client() {
  const result = getSupabase();
  if (!result) throw new WorkReadError('unavailable');
  return result;
}

export function useDefaultProject() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  return useQuery({
    queryKey: ['default-project', userId],
    enabled: !!userId && !auth.offline,
    queryFn: ({ signal }) => {
      if (!userId) throw new WorkReadError('access');
      return loadDefaultProject(client(), userId, signal);
    },
  });
}

export function useMyWork() {
  const auth = useAuth();
  const project = useDefaultProject();
  const context = project.data;
  const work = useQuery({
    queryKey: [
      'my-work',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && project.isSuccess && !auth.offline,
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
    if (auth.offline || auth.status !== 'signedIn') return;
    const result = await projectRefetch();
    // A different project/version starts its own query. Never refetch the previous context after lost access.
    if (
      result.isSuccess &&
      result.data &&
      result.data.project.id === projectId &&
      result.data.member.version === version
    ) {
      await workRefetch();
    }
  }, [
    auth.offline,
    auth.status,
    projectRefetch,
    workRefetch,
    projectId,
    version,
  ]);
  return { project, work, refresh, offline: auth.offline };
}
