import { z } from 'zod';

const id = z.uuid();
const date = z.iso.date();
const discipline = z.enum([
  'Civil',
  'Piping',
  'Electrical',
  'General',
  'HSE',
  'Quality',
  'Structural',
  'Mechanical',
  'Instrumentation',
]);

export const scheduleNodeSchema = z
  .object({
    externalId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    name: z.string().min(1),
    kind: z.enum(['summary', 'task', 'milestone', 'external_dependency']),
    sourceLevel: z.string(),
    sourceWbs: z.string(),
    plannedStart: date,
    plannedFinish: date,
    reportable: z.boolean(),
  })
  .refine((node) => node.plannedFinish >= node.plannedStart, {
    path: ['plannedFinish'],
    message: 'Planned finish cannot precede planned start.',
  });

export const scheduleActivitySchema = z
  .object({
    id,
    projectId: id,
    revisionId: id,
    externalId: z.string().min(1),
    name: z.string().min(1),
    discipline,
    location: z.string().min(1),
    stage: z.string().min(1),
    plannedStart: date,
    plannedFinish: date,
    baselineStart: date,
    baselineFinish: date,
    assignedReporterId: id.nullable(),
    targetQuantity: z.number().positive().nullable(),
    unit: z.string().min(1).nullable(),
    actualStart: date.nullable(),
    actualFinish: date.nullable(),
    acceptedQuantity: z.number().nonnegative(),
    actualsVersion: z.number().int().nonnegative(),
    acceptedPercent: z.number().min(0).max(100).nullable().default(null),
    reportedProgress: z.boolean().default(false),
    percentBasis: z.string().nullable().default(null),
    milestoneDate: date.nullable().default(null),
    progressAsOf: date.nullable().default(null),
    nodeKind: z.enum(['task', 'milestone']).default('task'),
    hierarchyPath: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .default([]),
    sourceLevel: z.string().nullable().default(null),
    sourceWbs: z.string().nullable().default(null),
    sourceDiscipline: z.string().nullable().default(null),
    duration: z.number().nonnegative().nullable().default(null),
    predecessors: z.string().default(''),
    calendar: z.string().default('Source calendar not specified'),
  })
  .superRefine((activity, context) => {
    if (activity.plannedFinish < activity.plannedStart)
      context.addIssue({
        code: 'custom',
        path: ['plannedFinish'],
        message: 'Planned finish cannot precede planned start.',
      });
    if (activity.baselineFinish < activity.baselineStart)
      context.addIssue({
        code: 'custom',
        path: ['baselineFinish'],
        message: 'Baseline finish cannot precede baseline start.',
      });
    if (activity.actualFinish && !activity.actualStart)
      context.addIssue({
        code: 'custom',
        path: ['actualFinish'],
        message: 'Accepted finish requires an accepted start.',
      });
    if (
      activity.actualStart &&
      activity.actualFinish &&
      activity.actualFinish < activity.actualStart
    )
      context.addIssue({
        code: 'custom',
        path: ['actualFinish'],
        message: 'Accepted finish cannot precede accepted start.',
      });
    if (
      activity.nodeKind === 'milestone' &&
      activity.milestoneDate &&
      (activity.actualStart !== activity.milestoneDate ||
        activity.actualFinish !== activity.milestoneDate)
    )
      context.addIssue({
        code: 'custom',
        path: ['milestoneDate'],
        message: 'Milestone occurrence must match accepted actual dates.',
      });
  });

export const managerScheduleSchema = z
  .object({
    projectId: id,
    projectName: z.string().min(1),
    revisionId: id.nullable(),
    revisionLabel: z.string().nullable().default(null),
    nodes: z.array(scheduleNodeSchema).max(2500).default([]),
    policyVersion: z.number().int().positive(),
    scheduleVersion: z.number().int().nonnegative(),
    activities: z.array(scheduleActivitySchema).max(2500),
  })
  .superRefine((snapshot, context) => {
    const activityIds = snapshot.activities.map((activity) => activity.id);
    const activityExternalIds = snapshot.activities.map(
      (activity) => activity.externalId,
    );
    const nodeIds = snapshot.nodes.map((node) => node.externalId);
    if (
      new Set(activityIds).size !== activityIds.length ||
      new Set(activityExternalIds).size !== activityExternalIds.length ||
      new Set(nodeIds).size !== nodeIds.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Schedule identifiers must be unique.',
      });
    if (
      snapshot.activities.some(
        (activity) =>
          activity.projectId !== snapshot.projectId ||
          activity.revisionId !== snapshot.revisionId,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Activities must belong to the snapshot project and revision.',
      });
    if (
      snapshot.revisionId === null &&
      (snapshot.revisionLabel !== null ||
        snapshot.activities.length > 0 ||
        snapshot.nodes.length > 0)
    )
      context.addIssue({
        code: 'custom',
        message: 'No active revision cannot contain schedule rows.',
      });
  });

export type ManagerSchedule = z.infer<typeof managerScheduleSchema>;
export type ScheduleActivity = z.infer<typeof scheduleActivitySchema>;
