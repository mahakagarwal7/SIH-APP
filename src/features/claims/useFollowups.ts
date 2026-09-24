import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useProjectSelection } from '@/features/projects/useProjectSelection';
import { getSupabase } from '@/lib/supabase';

import {
  FollowupReadError,
  loadReportFollowups,
  loadVerificationAssignments,
} from './followupService';

function client() {
  const result = getSupabase();
  if (!result) throw new FollowupReadError('unavailable');
  return result;
}

export function useReportFollowups(reportId: string) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const report = useQuery({
    queryKey: ['report-followups', userId, reportId],
    enabled: !!userId && !!reportId && !auth.offline,
    queryFn: ({ signal }) => {
      if (!userId) throw new FollowupReadError('access');
      return loadReportFollowups(client(), userId, reportId, signal);
    },
  });
  const finish = useCallback(async () => {
    await Promise.all([
      report.refetch(),
      queryClient.invalidateQueries({ queryKey: ['my-reports', userId] }),
      queryClient.invalidateQueries({
        queryKey: ['project-recent-reports', userId],
      }),
      queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
    ]);
  }, [queryClient, report, userId]);
  return { report, offline: auth.offline, refresh: report.refetch, finish };
}

export function useVerificationAssignments() {
  const project = useProjectSelection();
  const queryClient = useQueryClient();
  const context = project.data;
  const assignments = useQuery({
    queryKey: [
      'verification-assignments',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new FollowupReadError('access');
      return loadVerificationAssignments(client(), context, signal);
    },
  });
  const projectRefetch = project.refetch;
  const assignmentsRefetch = assignments.refetch;
  const projectId = context?.project.id;
  const memberVersion = context?.member.version;
  const refresh = useCallback(async () => {
    if (project.offline) return;
    const result = await projectRefetch();
    const current = result.data?.find(
      (candidate) => candidate.project.id === projectId,
    );
    if (current && current.member.version === memberVersion)
      await assignmentsRefetch();
  }, [
    assignmentsRefetch,
    memberVersion,
    project.offline,
    projectId,
    projectRefetch,
  ]);
  const finish = useCallback(async () => {
    await Promise.all([
      assignmentsRefetch(),
      queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['claim-decision'] }),
      queryClient.invalidateQueries({ queryKey: ['my-reports'] }),
    ]);
  }, [assignmentsRefetch, queryClient]);
  return { project, assignments, refresh, finish };
}
