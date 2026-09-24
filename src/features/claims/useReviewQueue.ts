import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { getSupabase } from '@/lib/supabase';

import { WorkReadError } from '../projects/myWorkService';
import { useProjectSelection } from '../projects/useProjectSelection';

import { loadReviewQueue, ReviewReadError } from './reviewQueueService';

function client() {
  const result = getSupabase();
  if (!result) throw new ReviewReadError('unavailable');
  return result;
}

export function useReviewQueue(
  requestedPage: number,
  requestedProjectId?: string,
) {
  const project = useProjectSelection();
  const queryClient = useQueryClient();
  const context = project.data;
  const page = requestedProjectId === context?.project.id ? requestedPage : 0;
  const userId = context?.member.user_id;
  const projectId = context?.project.id;
  const version = context?.member.version;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const accessState = useQuery({
    queryKey: ['review-queue-access-denied', userId, projectId, version],
    queryFn: async () => false,
    enabled: false,
    staleTime: Infinity,
  });
  const queue = useQuery({
    queryKey: [
      'review-queue',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
      page,
    ],
    enabled: !!context && authorized && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new ReviewReadError('access');
      return loadReviewQueue(client(), context, page, signal);
    },
  });
  const projectAccessDenied =
    project.error instanceof WorkReadError && project.error.kind === 'access';
  const queueAccessDenied =
    queue.error instanceof ReviewReadError && queue.error.kind === 'access';
  const queryAccessDenied = projectAccessDenied || queueAccessDenied;
  const accessDenied = accessState.data === true || queryAccessDenied;
  const reportAccessDenied = useCallback(() => {
    queryClient.setQueryData(
      ['review-queue-access-denied', userId, projectId, version],
      true,
    );
    queryClient.removeQueries({
      queryKey:
        userId && projectId
          ? ['review-queue', userId, projectId]
          : ['review-queue'],
    });
  }, [projectId, queryClient, userId, version]);
  useEffect(() => {
    if (queryAccessDenied && accessState.data !== true) {
      queryClient.setQueryData(
        ['review-queue-access-denied', userId, projectId, version],
        true,
      );
      queryClient.removeQueries({
        queryKey:
          userId && projectId
            ? ['review-queue', userId, projectId]
            : ['review-queue'],
      });
    }
  }, [
    accessState.data,
    projectId,
    queryAccessDenied,
    queryClient,
    userId,
    version,
  ]);
  const projectRefetch = project.refetch;
  const queueRefetch = queue.refetch;
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
    ) {
      const refreshedQueue = await queueRefetch();
      if (!refreshedQueue.error)
        queryClient.setQueryData(
          ['review-queue-access-denied', userId, projectId, version],
          false,
        );
    }
  }, [
    project.offline,
    projectId,
    projectRefetch,
    queueRefetch,
    queryClient,
    userId,
    version,
  ]);
  return {
    project,
    queue,
    refresh,
    authorized: !!authorized,
    page,
    accessDenied,
    reportAccessDenied,
  };
}
