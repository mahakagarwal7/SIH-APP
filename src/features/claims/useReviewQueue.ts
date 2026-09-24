import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

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
  const context = project.data;
  const page = requestedProjectId === context?.project.id ? requestedPage : 0;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
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
  const projectRefetch = project.refetch;
  const queueRefetch = queue.refetch;
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
      await queueRefetch();
  }, [project.offline, projectId, projectRefetch, queueRefetch, version]);
  return { project, queue, refresh, authorized: !!authorized, page };
}
