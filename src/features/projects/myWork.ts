export type Assignment = {
  project_id: string;
  activity_id: string;
  version: number;
  reporter_id: string;
  effective_from: string;
  effective_to: string;
};

export type WorkActivity = {
  id: string;
  projectId: string;
  revisionId: string;
  externalId: string;
  name: string;
  discipline: string;
  location: string;
  assignedReporterId: string | null;
  targetQuantity: number | null;
  unit: string | null;
  acceptedQuantity: number;
  actualStart: string | null;
  actualFinish: string | null;
  reportedProgress: boolean;
  acceptedPercent?: number | null;
  percentBasis?: string | null;
  progressAsOf?: string | null;
  milestoneDate?: string | null;
  nodeKind?: 'task' | 'milestone';
};

export type WorkItem = { activity: WorkActivity; assignment: Assignment };
export type WorkGroup = { title: string; items: WorkItem[] };

export function groupMyWork(
  activities: WorkActivity[],
  assignments: Assignment[],
  userId: string,
  today: string,
): WorkGroup[] {
  const latest = new Map<string, Assignment>();
  for (const row of assignments) {
    const previous = latest.get(row.activity_id);
    if (!previous || row.version > previous.version)
      latest.set(row.activity_id, row);
  }
  const groups: WorkGroup[] = ['Today', 'Up next', 'Earlier assignments'].map(
    (title) => ({ title, items: [] }),
  );
  for (const activity of activities) {
    if (activity.assignedReporterId !== userId) continue;
    const assignment = latest.get(activity.id);
    if (
      !assignment ||
      assignment.project_id !== activity.projectId ||
      assignment.reporter_id !== userId
    ) {
      throw new Error('Assignment details changed. Refresh My work.');
    }
    const index =
      assignment.effective_from > today
        ? 1
        : assignment.effective_to < today
          ? 2
          : 0;
    groups[index]!.items.push({ activity, assignment });
  }
  for (const group of groups) {
    group.items.sort(
      (a, b) =>
        a.assignment.effective_from.localeCompare(
          b.assignment.effective_from,
        ) ||
        a.activity.externalId.localeCompare(b.activity.externalId) ||
        a.activity.id.localeCompare(b.activity.id),
    );
  }
  return groups;
}

export function siteToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
