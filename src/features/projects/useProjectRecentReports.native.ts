import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  getReportsClient,
  loadRemoteReportsForProject,
  mergeMyReports,
} from '@/features/field-reports/myReportsService';
import { getVoiceDraftStore } from '@/features/field-reports/nativeDraftStore';
import { getNativeOutbox } from '@/features/field-reports/nativeOutbox';
import { getReportDraftStore } from '@/features/field-reports/nativeReportDraftStore';

export function useProjectRecentReports(projectId: string | undefined) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const local = useQuery({
    queryKey: ['project-recent-reports', userId, projectId, 'local'],
    enabled: !!userId && !!projectId,
    networkMode: 'always',
    queryFn: async () => {
      const [voice, reports, outbox] = await Promise.all([
        (await getVoiceDraftStore()).list(userId!),
        (await getReportDraftStore()).list(userId!),
        (await getNativeOutbox()).list(userId!),
      ]);
      return { voice, reports, outbox };
    },
  });
  const remote = useQuery({
    queryKey: ['project-recent-reports', userId, projectId, 'remote'],
    enabled: !!userId && !!projectId && !auth.offline,
    queryFn: ({ signal }) =>
      loadRemoteReportsForProject(
        getReportsClient(),
        userId!,
        projectId!,
        signal,
      ),
  });
  const items = mergeMyReports(
    local.data?.voice ?? [],
    local.data?.reports ?? [],
    local.data?.outbox ?? [],
    remote.data ?? [],
  )
    .filter((item) => item.projectId === projectId)
    .slice(0, 3);
  const localRefetch = local.refetch;
  const remoteRefetch = remote.refetch;
  const refetch = useCallback(async () => {
    if (!userId || !projectId) return;
    await Promise.all([
      localRefetch(),
      ...(auth.offline ? [] : [remoteRefetch()]),
    ]);
  }, [auth.offline, localRefetch, projectId, remoteRefetch, userId]);
  return {
    items,
    error: local.error ?? remote.error,
    isPending: local.isPending || (!auth.offline && remote.isPending),
    isFetching: local.isFetching || remote.isFetching,
    refetch,
  };
}
