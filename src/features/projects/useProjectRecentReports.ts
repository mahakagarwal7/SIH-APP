import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  getReportsClient,
  loadRemoteReportsForProject,
  mergeMyReports,
} from '@/features/field-reports/myReportsService';

export function useProjectRecentReports(projectId: string | undefined) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const {
    data,
    error,
    isPending,
    isFetching,
    refetch: refetchRemote,
  } = useQuery({
    queryKey: ['project-recent-reports', userId, projectId],
    enabled: !!userId && !!projectId && !auth.offline,
    queryFn: ({ signal }) =>
      loadRemoteReportsForProject(
        getReportsClient(),
        userId!,
        projectId!,
        signal,
      ),
  });
  const refetch = useCallback(
    () => (userId && projectId ? refetchRemote() : Promise.resolve(undefined)),
    [projectId, refetchRemote, userId],
  );
  return {
    items: mergeMyReports([], [], [], data ?? []).slice(0, 3),
    error,
    isPending: isPending && !auth.offline,
    isFetching,
    refetch,
  };
}
