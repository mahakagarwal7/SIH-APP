import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useProjectSelection } from '../projects/useProjectSelection';

import { loadManagerSchedule, ScheduleReadError } from './scheduleService';

function client() {
  const result = getSupabase();
  if (!result) throw new ScheduleReadError('unavailable');
  return result;
}

export function useManagerSchedule() {
  const project = useProjectSelection();
  const context = project.data;
  const authorized =
    context?.member.role === 'planner' || context?.member.role === 'manager';
  const schedule = useQuery({
    queryKey: [
      'manager-schedule',
      context?.member.user_id,
      context?.project.id,
      context?.member.version,
    ],
    enabled: !!context && authorized && !project.offline,
    queryFn: ({ signal }) => {
      if (!context) throw new ScheduleReadError('access');
      return loadManagerSchedule(client(), context, signal);
    },
  });
  const projectRefetch = project.refetch;
  const scheduleRefetch = schedule.refetch;
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
      current.member.version === version &&
      ['planner', 'manager'].includes(current.member.role)
    )
      await scheduleRefetch();
  }, [project.offline, projectId, projectRefetch, scheduleRefetch, version]);
  return { project, schedule, refresh, authorized: !!authorized };
}
