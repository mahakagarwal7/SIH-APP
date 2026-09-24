import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase';

import {
  forgetRememberedProjectContext,
  readRememberedProjectContext,
  rememberProjectContext,
} from './captureProjectStore';
import { loadActiveProjects, WorkReadError } from './myWorkService';
import {
  resolveProjectSelection,
  sameProjectContext,
} from './projectSelection';

function client() {
  const result = getSupabase();
  if (!result) throw new WorkReadError('unavailable');
  return result;
}

const projectScopedQueries = new Set([
  'my-work',
  'project-recent-reports',
  'review-queue',
  'verification-assignments',
  'execution-history',
  'manager-schedule',
  'manager-overview',
  'task-hierarchy',
]);

export function useProjectSelection() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const remembered = useQuery({
    queryKey: ['selected-project', userId],
    enabled: !!userId,
    networkMode: 'always',
    queryFn: () => readRememberedProjectContext(userId!),
  });
  const projects = useQuery({
    queryKey: ['active-projects', userId],
    enabled: !!userId && !auth.offline,
    queryFn: ({ signal }) => {
      if (!userId) throw new WorkReadError('access');
      return loadActiveProjects(client(), userId, signal);
    },
  });
  const canUseProjectData =
    projects.isSuccess ||
    (projects.data !== undefined &&
      (!(projects.error instanceof WorkReadError) ||
        projects.error.kind === 'unavailable'));
  const projectContexts = canUseProjectData ? projects.data : undefined;
  const ready = auth.offline
    ? remembered.isSuccess
    : canUseProjectData && (remembered.isSuccess || remembered.isError);
  const data = ready
    ? resolveProjectSelection(projectContexts, remembered.data, auth.offline)
    : undefined;

  useEffect(() => {
    if (
      !userId ||
      auth.offline ||
      !projects.isSuccess ||
      (!remembered.isSuccess && !remembered.isError)
    )
      return;
    if (data) {
      if (remembered.isSuccess && sameProjectContext(data, remembered.data))
        return;
      void rememberProjectContext(userId, data)
        .then(() =>
          queryClient.setQueryData(['selected-project', userId], data),
        )
        .catch(() => {});
    } else if (remembered.isSuccess && remembered.data) {
      void forgetRememberedProjectContext(userId)
        .then(() =>
          queryClient.setQueryData(['selected-project', userId], null),
        )
        .catch(() => {});
    }
  }, [
    auth.offline,
    data,
    projects.isSuccess,
    queryClient,
    remembered.data,
    remembered.isError,
    remembered.isSuccess,
    userId,
  ]);

  const select = useCallback(
    async (projectId: string) => {
      if (!userId || auth.offline || !projectContexts)
        throw new WorkReadError('unavailable');
      const context = projectContexts.find(
        (candidate) => candidate.project.id === projectId,
      );
      if (!context) throw new WorkReadError('access');
      await queryClient.cancelQueries({
        predicate: (query) =>
          projectScopedQueries.has(String(query.queryKey[0])),
      });
      queryClient.removeQueries({
        predicate: (query) =>
          projectScopedQueries.has(String(query.queryKey[0])),
      });
      await rememberProjectContext(userId, context);
      queryClient.setQueryData(['selected-project', userId], context);
    },
    [auth.offline, projectContexts, queryClient, userId],
  );

  return {
    userId,
    data,
    projects: projectContexts ?? (auth.offline && data ? [data] : []),
    error: auth.offline ? remembered.error : projects.error,
    isPending: !ready,
    isFetching: projects.isFetching || remembered.isFetching,
    offline: auth.offline,
    remembered: auth.offline && !!data,
    refetch: projects.refetch,
    select,
  };
}
