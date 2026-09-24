import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { getSupabase } from '@/lib/supabase';

import { WorkReadError } from '../projects/myWorkService';
import { useProjectSelection } from '../projects/useProjectSelection';

import { HistoryReadError, loadExecutionHistory } from './historyService';

function client() {
  const result = getSupabase();
  if (!result) throw new HistoryReadError('unavailable');
  return result;
}

export function useExecutionHistory() {
  const project = useProjectSelection();
  const queryClient = useQueryClient();
  const context = project.data;
  const userId = context?.member.user_id ?? project.userId;
  const contextProjectId = context?.project.id;
  const contextVersion = context?.member.version;
  const identityState = useQuery<
    { projectId: string; version: number } | undefined
  >({
    queryKey: ['execution-history-last-identity', userId],
    queryFn: async () => undefined,
    enabled: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (userId && contextProjectId && contextVersion)
      queryClient.setQueryData(['execution-history-last-identity', userId], {
        projectId: contextProjectId,
        version: contextVersion,
      });
  }, [contextProjectId, contextVersion, queryClient, userId]);
  const projectId = contextProjectId ?? identityState.data?.projectId;
  const version = contextVersion ?? identityState.data?.version;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const accessState = useQuery({
    queryKey: ['execution-history-access-denied', userId, projectId, version],
    queryFn: async () => false,
    enabled: false,
    staleTime: Infinity,
  });
  const denialEpoch = useRef(0);
  const denialObserved = useRef(false);
  const successfulRequestEpoch = useRef(-1);
  const history = useQuery({
    queryKey: ['execution-history', userId, projectId, version],
    enabled: !!context && authorized && !project.offline,
    queryFn: async ({ signal }) => {
      if (!context) throw new HistoryReadError('access');
      const requestEpoch = denialEpoch.current;
      const result = await loadExecutionHistory(client(), context, signal);
      successfulRequestEpoch.current = requestEpoch;
      return result;
    },
  });
  const projectAccessDenied =
    project.error instanceof WorkReadError && project.error.kind === 'access';
  const historyAccessDenied =
    history.error instanceof HistoryReadError &&
    history.error.kind === 'access';
  const queryAccessDenied = projectAccessDenied || historyAccessDenied;
  const accessDenied = accessState.data === true || queryAccessDenied;
  useEffect(() => {
    if (!queryAccessDenied) {
      denialObserved.current = false;
      return;
    }
    if (!denialObserved.current) {
      denialObserved.current = true;
      denialEpoch.current += 1;
    }
    if (queryAccessDenied && accessState.data !== true) {
      queryClient.setQueryData(
        ['execution-history-access-denied', userId, projectId, version],
        true,
      );
      queryClient.removeQueries({
        queryKey:
          userId && projectId
            ? ['execution-history', userId, projectId]
            : ['execution-history'],
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
  useEffect(() => {
    if (
      !history.isSuccess ||
      queryAccessDenied ||
      project.error !== null ||
      accessState.data !== true ||
      successfulRequestEpoch.current !== denialEpoch.current
    )
      return;
    queryClient.setQueryData(
      ['execution-history-access-denied', userId, projectId, version],
      false,
    );
  }, [
    accessState.data,
    history.isSuccess,
    projectId,
    project.error,
    queryAccessDenied,
    queryClient,
    userId,
    version,
  ]);
  const projectRefetch = project.refetch;
  const historyRefetch = history.refetch;
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
      const refreshedHistory = await historyRefetch();
      if (!refreshedHistory.error)
        queryClient.setQueryData(
          ['execution-history-access-denied', userId, projectId, version],
          false,
        );
    }
  }, [
    historyRefetch,
    project.offline,
    projectId,
    projectRefetch,
    queryClient,
    userId,
    version,
  ]);
  return {
    project,
    history,
    refresh,
    authorized: !!authorized,
    accessDenied,
  };
}
