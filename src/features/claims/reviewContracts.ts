import { z } from 'zod';

const id = z.uuid();
const date = z.iso.date();

export const actionableReviewStates = [
  'pending',
  'clarification',
  'verification',
  'disputed',
] as const;

export const claimFactsSchema = z.object({
  kind: z.enum([
    'START',
    'FINISH',
    'ITEM_PROGRESS',
    'PERCENT_PROGRESS',
    'MILESTONE',
    'INSPECTION',
    'BLOCKED',
    'RESUMED',
    'CORRECTION',
    'PLANNED_INTENT',
    'UNKNOWN',
  ]),
  activityHint: z.string().nullable(),
  assetTag: z.string().nullable().optional(),
  location: z.string().nullable(),
  stage: z.string().nullable(),
  discipline: z.string().min(1).nullable(),
  scope: z.enum(['activity', 'item', 'unknown']),
  fullScope: z.boolean(),
  eventDate: date.nullable(),
  dateOrigin: z.enum([
    'source_text',
    'reporter_confirmed',
    'unknown',
    'source_work_date',
    'message_date',
    'relative',
    'planner_corrected',
  ]),
  quantity: z
    .object({
      value: z.number().nonnegative(),
      unit: z.string(),
      mode: z.enum(['delta', 'cumulative', 'item']),
    })
    .nullable(),
  evidenceQuote: z.string().min(1),
  qualifiers: z.array(z.string()),
  missingFields: z.array(z.string()),
  observation: z
    .object({
      version: z.literal(2),
      dateBasis: z.enum([
        'explicit',
        'work_date',
        'relative',
        'message_date',
        'confirmed',
        'missing',
      ]),
      dateEvidence: z.string(),
      quantityCoverage: z.enum([
        'activity_total',
        'component',
        'supporting',
        'unknown',
      ]),
      component: z.string().nullable(),
      dailyQuantity: z
        .object({ value: z.number().nonnegative(), unit: z.string() })
        .strict()
        .nullable(),
      items: z.array(z.string()).max(1000),
      coverageStart: date.nullable(),
      coverageEnd: date.nullable(),
      percent: z
        .object({
          value: z.number().min(0).max(100),
          basis: z.enum(['physical', 'duration', 'unspecified', 'test_result']),
        })
        .strict()
        .nullable(),
      inspectionRelation: z
        .enum(['included', 'separate', 'unknown'])
        .nullable(),
    })
    .strict()
    .nullable()
    .optional(),
});

export const reviewClaimSchema = z.object({
  id,
  project_id: id,
  report_id: id,
  report_version: z.number().int().positive(),
  run_id: id,
  ordinal: z.number().int().nonnegative(),
  facts: claimFactsSchema,
  validation_flags: z.array(z.string()),
  state: z.enum(actionableReviewStates),
  version: z.number().int().positive(),
  plan_revision_id: id,
  policy_version: z.number().int().positive(),
  parent_claim_id: id.nullable(),
  root_claim_id: id.nullable(),
  followup_round: z.number().int().nonnegative(),
  manual_review: z.boolean(),
  correction_of_event_id: id.nullable(),
});

export const reviewReportSchema = z.object({
  id,
  project_id: id,
  author_id: id,
  received_at: z.iso.datetime({ offset: true }),
  source_kind: z.enum(['text', 'voice', 'spreadsheet']),
});

export const originalVersionSchema = z.object({
  report_id: id,
  version: z.literal(1),
  source_text: z.string().min(1).max(10_000),
  work_date: date.nullable(),
  selected_activity_id: id.nullable(),
  context: z.unknown(),
});

export const reviewMediaSchema = z.object({
  attachmentId: id,
  kind: z.enum(['audio', 'photo']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  caption: z.string().nullable(),
  originalTranscript: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  language: z.string().nullable(),
});

export const reviewAttachmentSchema = z.object({
  id,
  project_id: id,
  report_id: id,
  object_path: z.string().min(1),
  state: z.literal('received'),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  byte_size: z.number().int().positive().max(5_242_880),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  caption: z.string(),
  media_kind: z.enum(['audio', 'photo']).nullable(),
  language: z.string().nullable(),
});

export const candidateSchema = z.object({
  claim_id: id,
  project_id: id,
  activity_id: id,
  revision_id: id,
  rank: z.number().int().min(1).max(8),
  score: z.coerce.number().min(0).max(1),
  features: z.record(z.string(), z.number()),
  mismatch_flags: z.array(z.string()),
});

export const reviewMemberSchema = z.object({
  user_id: id,
  display_name: z.string(),
});

export const reviewActivitySchema = z.object({
  id,
  projectId: id,
  revisionId: id,
  externalId: z.string().min(1),
  name: z.string().min(1),
  location: z.string().min(1),
});

export const reviewSnapshotSchema = z.object({
  projectId: id,
  revisionId: id.nullable(),
  activities: z.array(reviewActivitySchema),
});

export type ReviewClaim = z.infer<typeof reviewClaimSchema>;
export type CandidateMatch = z.infer<typeof candidateSchema>;
export type ReviewActivity = z.infer<typeof reviewActivitySchema>;

const positiveReasons: readonly [string, string][] = [
  ['tag', 'Matching asset tag'],
  ['location', 'Same work location'],
  ['stage', 'Matching activity stage'],
  ['description', 'Matching activity description'],
  ['discipline', 'Same discipline'],
  ['assignment', 'Reporter is assigned to this activity'],
];

export function candidateReasons(candidate: CandidateMatch) {
  if (candidate.features.plannerMapping === 1) {
    return [
      ...candidate.mismatch_flags,
      'Activity explicitly mapped by planner',
    ];
  }
  if (candidate.mismatch_flags.length) return candidate.mismatch_flags;
  const reasons = positiveReasons
    .filter(([key]) => (candidate.features[key] ?? 0) > 0)
    .sort(
      ([a], [b]) => (candidate.features[b] ?? 0) - (candidate.features[a] ?? 0),
    )
    .map(([, label]) => label);
  return reasons.length ? reasons : ['Candidate identified by the matcher'];
}

export const reviewStateLabels: Record<ReviewClaim['state'], string> = {
  pending: 'Needs review',
  clarification: 'Awaiting clarification',
  verification: 'Awaiting verification',
  disputed: 'Disputed evidence',
};
