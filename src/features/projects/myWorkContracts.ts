import { z } from 'zod';

const id = z.uuid();
const date = z.iso.date();
export const membershipSchema = z.object({
  project_id: id,
  user_id: id,
  display_name: z.string(),
  role: z.enum(['reporter', 'supervisor', 'planner', 'manager']),
  active: z.boolean(),
  version: z.number().int().positive(),
});
export const projectSchema = z.object({ id, name: z.string().min(1) });
export const assignmentSchema = z
  .object({
    project_id: id,
    activity_id: id,
    version: z.number().int().positive(),
    reporter_id: id,
    effective_from: date,
    effective_to: date,
  })
  .refine((row) => row.effective_to >= row.effective_from);

// Validate the fields consumed here against PlannedActivity/ScheduleActivity in the web contracts.
// Other snapshot fields (hierarchy, plan metadata) belong to later roadmap slices.
const activitySchema = z.object({
  id,
  projectId: id,
  revisionId: id,
  externalId: z.string().min(1),
  name: z.string().min(1),
  calendar: z.string().min(1).default('Source calendar not specified'),
  discipline: z.enum([
    'Civil',
    'Piping',
    'Electrical',
    'General',
    'HSE',
    'Quality',
    'Structural',
    'Mechanical',
    'Instrumentation',
  ]),
  location: z.string().min(1),
  assignedReporterId: id.nullable(),
  targetQuantity: z.number().positive().nullable(),
  unit: z.string().min(1).nullable(),
  acceptedQuantity: z.number().nonnegative(),
  actualStart: date.nullable(),
  actualFinish: date.nullable(),
  reportedProgress: z.boolean().default(false),
  acceptedPercent: z.number().min(0).max(100).nullable().default(null),
  percentBasis: z.string().nullable().default(null),
  progressAsOf: date.nullable().default(null),
  milestoneDate: date.nullable().default(null),
  nodeKind: z.enum(['task', 'milestone']).default('task'),
});
export const snapshotSchema = z.object({
  projectId: id,
  projectName: z.string(),
  revisionId: id.nullable(),
  activities: z.array(activitySchema),
});
