import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

import { selectCaptureProject } from './captureProject';
import {
  readRememberedProjectContext,
  rememberProjectContext,
} from './captureProjectStore';
import { useDefaultProject } from './useMyWork';

export function useCaptureProject() {
  const auth = useAuth();
  const client = useQueryClient();
  const live = useDefaultProject();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  const remembered = useQuery({
    queryKey: ['capture-project', userId],
    enabled: !!userId,
    networkMode: 'always',
    queryFn: () => readRememberedProjectContext(userId!),
  });
  useEffect(() => {
    const context = live.data;
    if (
      !userId ||
      live.error ||
      !live.isSuccess ||
      !context ||
      context.member.user_id !== userId
    )
      return;
    void rememberProjectContext(userId, context)
      .then(() => client.setQueryData(['capture-project', userId], context))
      .catch(() => {});
  }, [client, live.data, live.error, live.isSuccess, userId]);
  // A remembered membership permits capture only when the device is known offline.
  // An online denial/error must not be hidden behind stale local access.
  const liveContext = live.error ? undefined : live.data;
  const data = selectCaptureProject(liveContext, remembered.data, auth.offline);
  return {
    ...live,
    data,
    error: data ? null : live.error,
    isPending: !data && (live.isPending || remembered.isPending),
    isFetching: live.isFetching || remembered.isFetching,
    remembered: auth.offline && !liveContext && !!remembered.data,
  };
}
