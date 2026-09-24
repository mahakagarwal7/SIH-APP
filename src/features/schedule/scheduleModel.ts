import type { ScheduleActivity } from './scheduleContracts';

export type ScheduleStatus =
  | 'Complete'
  | 'In progress'
  | 'Progress reported · start unresolved'
  | 'Not started';

export function scheduleStatus(activity: ScheduleActivity): ScheduleStatus {
  return activity.actualFinish
    ? 'Complete'
    : activity.actualStart
      ? 'In progress'
      : activity.reportedProgress
        ? 'Progress reported · start unresolved'
        : 'Not started';
}

export function filterScheduleActivities(
  activities: ScheduleActivity[],
  discipline: string,
) {
  return activities.filter(
    (activity) => discipline === 'All' || activity.discipline === discipline,
  );
}

const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function scheduleDateRange(activities: ScheduleActivity[]) {
  if (!activities.length) return null;
  const dates = activities.flatMap((activity) => [
    activity.baselineStart,
    activity.baselineFinish,
    activity.plannedStart,
    activity.plannedFinish,
    ...(activity.actualStart ? [activity.actualStart] : []),
    ...(activity.actualFinish ? [activity.actualFinish] : []),
  ]);
  return {
    start: dates.slice().sort()[0]!,
    finish: dates.slice().sort().at(-1)!,
  };
}

export function scheduleBar(
  from: string,
  to: string,
  range: { start: string; finish: string },
) {
  const start = time(range.start);
  const span = Math.max(86_400_000, time(range.finish) - start + 86_400_000);
  const left = Math.max(0, Math.min(1, (time(from) - start) / span));
  const finish = Math.max(time(from), time(to));
  const right = Math.max(
    left,
    Math.min(1, (finish - start + 86_400_000) / span),
  );
  return {
    left: `${left * 100}%` as `${number}%`,
    width: `${Math.max(1.5, (right - left) * 100)}%` as `${number}%`,
  };
}

export const SCHEDULE_PAGE_SIZE = 25;

export function schedulePage<T>(rows: T[], requestedPage: number) {
  const last = Math.max(0, Math.ceil(rows.length / SCHEDULE_PAGE_SIZE) - 1);
  const page = Math.min(Math.max(0, requestedPage), last);
  const from = page * SCHEDULE_PAGE_SIZE;
  return {
    rows: rows.slice(from, from + SCHEDULE_PAGE_SIZE),
    page,
    from,
    total: rows.length,
    hasNext: from + SCHEDULE_PAGE_SIZE < rows.length,
  };
}
