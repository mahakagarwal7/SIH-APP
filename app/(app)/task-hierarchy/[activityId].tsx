import { useLocalSearchParams } from 'expo-router';

import { TaskHierarchyScreen } from '@/features/hierarchy/TaskHierarchyScreen';

export default function TaskHierarchyRoute() {
  const params = useLocalSearchParams<{ activityId?: string | string[] }>();
  const activityId = Array.isArray(params.activityId)
    ? (params.activityId[0] ?? '')
    : (params.activityId ?? '');
  return <TaskHierarchyScreen activityId={activityId} />;
}
