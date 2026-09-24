import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  getReportsClient,
  loadRemoteReportsForProject,
  mergeMyReports,
} from '@/features/field-reports/myReportsService';

export function useProjectRecentReports(projectId: string | undefined) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const remote = useQuery({
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
  return {
    items: mergeMyReports([], [], [], remote.data ?? []).slice(0, 3),
    error: remote.error,
    isPending: remote.isPending && !auth.offline,
    isFetching: remote.isFetching,
    refetch: () =>
      userId && projectId ? remote.refetch() : Promise.resolve(undefined),
  };
}
