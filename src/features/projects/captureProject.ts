import type { ProjectContext } from './myWorkService';

export function selectCaptureProject(
  live: ProjectContext | null | undefined,
  remembered: ProjectContext | null | undefined,
  offline: boolean,
) {
  return live ?? (offline ? remembered : undefined);
}
