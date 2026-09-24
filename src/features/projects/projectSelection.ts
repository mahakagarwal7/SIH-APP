import type { ProjectContext } from './myWorkService';

export function resolveProjectSelection(
  live: ProjectContext[] | undefined,
  remembered: ProjectContext | null | undefined,
  offline: boolean,
) {
  if (offline) return remembered ?? undefined;
  if (!live) return undefined;
  return (
    live.find((context) => context.project.id === remembered?.project.id) ??
    live[0]
  );
}

export function sameProjectContext(
  left: ProjectContext | null | undefined,
  right: ProjectContext | null | undefined,
) {
  return (
    left?.project.id === right?.project.id &&
    left?.project.name === right?.project.name &&
    left?.member.user_id === right?.member.user_id &&
    left?.member.version === right?.member.version &&
    left?.member.active === right?.member.active
  );
}
