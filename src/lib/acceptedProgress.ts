type Progress = {
  actualFinish: string | null;
  acceptedPercent?: number | null;
};

export function acceptedProgress(activity: Progress): number | null {
  if (activity.actualFinish) return 100;
  const percent = activity.acceptedPercent;
  return typeof percent === 'number' && Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : null;
}

export function meanAcceptedProgress(activities: Progress[]): number | null {
  if (!activities.length) return null;
  const values = activities.map(acceptedProgress);
  if (values.some((value) => value === null)) return null;
  return Math.round(
    values.reduce<number>((sum, value) => sum + value!, 0) / values.length,
  );
}
