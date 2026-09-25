import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useProjectSelection } from '../projects/useProjectSelection';

import { removeClaimFromReviewCache } from './decisionCache';
import { loadDecisionContext } from './decisionService';
import { ReviewReadError } from './reviewQueueService';

function client() {
  const result = getSupabase();
  if (!result) throw new ReviewReadError('unavailable');
  return result;
}

export function useDecisionContext(claimId: string) {
  const project = useProjectSelection();
  const queryClient = useQueryClient();
  const context = project.data;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const decision = useQuery({
    queryKey: [
      'claim-decision',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
      claimId,
    ],
    enabled: !!context && authorized && !project.offline && !!claimId,
    queryFn: ({ signal }) => {
      if (!context) throw new ReviewReadError('access');
      return loadDecisionContext(client(), context, claimId, signal);
    },
  });
  const projectOffline = project.offline;
  const projectRefetch = project.refetch;
  const decisionRefetch = decision.refetch;
  const projectId = context?.project.id;
  const memberVersion = context?.member.version;
  const refresh = useCallback(async () => {
    if (projectOffline) return;
    const result = await projectRefetch();
    const current = result.data?.find(
      (candidate) => candidate.project.id === projectId,
    );
    if (
      current &&
      current.member.version === memberVersion &&
      ['planner', 'manager'].includes(current.member.role)
    )
      await decisionRefetch();
  }, [
    decisionRefetch,
    memberVersion,
    projectId,
    projectOffline,
    projectRefetch,
  ]);
  const finish = useCallback(
    (removeFromQueue: boolean) => {
      if (!context) return;
      if (removeFromQueue)
        removeClaimFromReviewCache(
          queryClient,
          context.member.user_id,
          context.project.id,
          context.member.version,
          claimId,
        );
      void queryClient.invalidateQueries({
        queryKey: ['review-queue', context.member.user_id, context.project.id],
      });
      for (const key of [
        'manager-overview',
        'manager-schedule',
        'execution-history',
        'my-work',
        'project-recent-reports',
      ])
        void queryClient.invalidateQueries({
          queryKey: [key, context.member.user_id, context.project.id],
        });
      void queryClient.invalidateQueries({
        queryKey: ['my-reports', context.member.user_id],
      });
      queryClient.removeQueries({
        queryKey: [
          'claim-decision',
          context.member.user_id,
          context.project.id,
          context.member.version,
          claimId,
        ],
      });
    },
    [claimId, context, queryClient],
  );
  return { project, decision, refresh, finish, authorized: !!authorized };
}
