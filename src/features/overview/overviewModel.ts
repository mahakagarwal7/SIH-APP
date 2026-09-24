import type { ReviewClaim } from '@/features/claims/reviewContracts';
import type { ExecutionHistoryEntry } from '@/features/history/historyContracts';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';

export type DisciplineProgress = {
  discipline: string;
  planned: number;
  completed: number;
  inProgress: number;
  percent: number;
};

export type AcceptedEventWeek = {
  start: string;
  end: string;
  count: number;
};

const DAY_MS = 86_400_000;

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function monday(value: string) {
  const date = utcDate(value);
  const day = date.getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

export function overviewSummary(
  activities: ScheduleActivity[],
  actionableClaims: number,
) {
  return {
    planned: activities.length,
    completed: activities.filter((activity) => activity.actualFinish).length,
    inProgress: activities.filter(
      (activity) => activity.actualStart && !activity.actualFinish,
    ).length,
    unresolvedProgress: activities.filter(
      (activity) => activity.reportedProgress && !activity.actualStart,
    ).length,
    actionableClaims,
  };
}

export function disciplineProgress(activities: ScheduleActivity[]) {
  const disciplines = [
    ...new Set(activities.map((row) => row.discipline)),
  ].sort();
  return disciplines.map((discipline): DisciplineProgress => {
    const rows = activities.filter((row) => row.discipline === discipline);
    const completed = rows.filter((row) => row.actualFinish).length;
    const inProgress = rows.filter(
      (row) => row.actualStart && !row.actualFinish,
    ).length;
    return {
      discipline,
      planned: rows.length,
      completed,
      inProgress,
      percent: rows.length ? Math.round((completed / rows.length) * 100) : 0,
    };
  });
}

export function acceptedEventWeeks(
  entries: ExecutionHistoryEntry[],
  today: string,
  count = 6,
) {
  const currentMonday = monday(today);
  const firstMonday = addDays(currentMonday, -(count - 1) * 7);
  return Array.from({ length: count }, (_, index): AcceptedEventWeek => {
    const start = addDays(firstMonday, index * 7);
    const end = addDays(start, 6);
    const startValue = dateOnly(start);
    const endValue = dateOnly(end);
    return {
      start: startValue,
      end: endValue,
      count: entries.filter(
        (entry) =>
          entry.effective &&
          entry.eventDate >= startValue &&
          entry.eventDate <= endValue,
      ).length,
    };
  });
}

export function recentAcceptedEvents(
  entries: ExecutionHistoryEntry[],
  limit = 5,
) {
  return entries
    .filter((entry) => entry.effective)
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.acceptedAt) - Date.parse(a.acceptedAt) ||
        b.eventId.localeCompare(a.eventId),
    )
    .slice(0, limit);
}

export function attentionReason(
  claim: Pick<ReviewClaim, 'manual_review' | 'state' | 'validation_flags'>,
) {
  if (claim.manual_review) return 'Planner follow-up needed';
  if (claim.state === 'verification') return 'Supervisor check pending';
  if (claim.state === 'disputed') return 'Supervisor could not confirm';
  if (claim.state === 'clarification') return 'Reporter answer needed';
  return claim.validation_flags[0] ?? 'Planner decision required';
}
