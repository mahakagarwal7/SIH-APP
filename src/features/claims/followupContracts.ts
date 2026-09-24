import { z } from 'zod';

import { claimFactsSchema, validWorkDate } from './reviewContracts';

const id = z.uuid();
const date = z.iso.date();
const responseChoice = z.enum(['confirmed', 'denied', 'needs_info']);

export const clarificationOptionSchema = z.object({
  activityId: id,
  label: z.string().min(1),
});

export const clarificationRequestSchema = z.object({
  id,
  project_id: id,
  claim_id: id,
  report_id: id,
  claim_version: z.number().int().positive(),
  report_version: z.number().int().positive(),
  version: z.number().int().positive(),
  reason_code: z.enum(['location', 'date', 'scope', 'assignment', 'detail']),
  question_text: z.string().min(1),
  options: z.array(clarificationOptionSchema).max(8),
  automatic: z.boolean(),
  status: z.enum(['open', 'answered', 'resolved', 'superseded', 'cancelled']),
  created_at: z.iso.datetime({ offset: true }),
});

export const replyInputSchema = z.object({
  answer: z.enum(['answer', 'yes', 'no', 'not_sure']),
  text: z.string().max(1000).optional(),
  activityIds: z.array(id).max(8).optional(),
  eventDate: date.nullable().optional(),
});

export const clarificationResponseSchema = z.object({
  id,
  request_id: id,
  project_id: id,
  actor_id: id,
  question_version: z.number().int().positive(),
  input: replyInputSchema,
  resulting_report_version: z.number().int().positive().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export const followupReportSchema = z.object({
  id,
  project_id: id,
  author_id: id,
  current_version: z.number().int().positive(),
  lifecycle: z.literal('submitted'),
  received_at: z.iso.datetime({ offset: true }),
  source_kind: z.enum(['text', 'voice', 'spreadsheet']),
});

export const followupVersionSchema = z.object({
  report_id: id,
  version: z.number().int().positive(),
  source_text: z.string().min(1).max(10_000),
  work_date: date.nullable(),
});

export const followupClaimSchema = z.object({
  id,
  project_id: id,
  report_id: id,
  report_version: z.number().int().positive(),
  facts: claimFactsSchema,
  validation_flags: z.array(z.string()),
  state: z.enum([
    'pending',
    'clarification',
    'verification',
    'disputed',
    'accepted',
    'rejected',
    'observed',
    'unplanned',
    'superseded',
    'withdrawn',
  ]),
  version: z.number().int().positive(),
});

export const verificationRequestSchema = z.object({
  id,
  project_id: id,
  claim_id: id,
  report_id: id,
  activity_id: id,
  verifier_id: id,
  claim_version: z.number().int().positive(),
  report_version: z.number().int().positive(),
  plan_revision_id: id,
  policy_version: z.number().int().positive(),
  assignment_version: z.number().int().positive(),
  facts_hash: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['open', 'confirmed', 'denied', 'needs_info']),
  allocation_confirmed: z.boolean(),
  work_confirmed: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
});

export const verificationDecisionSchema = z.object({
  id,
  request_id: id,
  project_id: id,
  actor_id: id,
  request_version: z.number().int().positive(),
  allocation: responseChoice,
  work: responseChoice,
  reason: z.string().min(1).max(1000),
  created_at: z.iso.datetime({ offset: true }),
});

export const verificationContextSchema = z.object({
  request_id: id,
  reporter_name: z.string(),
});

export const replyCommandSchema = z
  .object({
    commandId: id,
    expectedQuestionVersion: z.number().int().positive(),
    answer: z.enum(['answer', 'yes', 'no', 'not_sure']),
    text: z.string().trim().max(1000),
    activityIds: z.array(id).max(8),
    eventDate: date.nullable(),
  })
  .strict();

export const attestationCommandSchema = z
  .object({
    commandId: id,
    expectedVersion: z.number().int().positive(),
    allocation: responseChoice,
    work: responseChoice,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const replyResultSchema = z.union([
  z.object({
    reportId: id,
    reportVersion: z.number().int().positive(),
    processing: z.literal('queued'),
  }),
  z.object({ reportId: id, status: z.literal('needs_review') }),
]);

export const attestationResultSchema = z.object({
  verificationId: id,
  status: z.enum(['confirmed', 'denied', 'needs_info']),
  version: z.number().int().positive(),
});

export type ClarificationRequest = z.infer<typeof clarificationRequestSchema>;
export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>;
export type ReplyCommand = z.infer<typeof replyCommandSchema>;
export type AttestationCommand = z.infer<typeof attestationCommandSchema>;

export function replySummary(
  question: ClarificationRequest,
  response: ClarificationResponse,
) {
  const selected = question.options
    .filter((option) => response.input.activityIds?.includes(option.activityId))
    .map((option) => option.label);
  const answer =
    response.input.answer === 'not_sure'
      ? 'Not sure'
      : response.input.answer === 'yes'
        ? 'Yes'
        : response.input.answer === 'no'
          ? 'No'
          : '';
  return (
    [answer, ...selected, response.input.eventDate, response.input.text]
      .filter(Boolean)
      .join(' · ') || 'Reply recorded'
  );
}

export function replyIsComplete(
  question: ClarificationRequest,
  input: Pick<ReplyCommand, 'answer' | 'text' | 'activityIds' | 'eventDate'>,
) {
  if (input.answer === 'not_sure') return true;
  switch (question.reason_code) {
    case 'date':
      return !!input.eventDate && validWorkDate(input.eventDate);
    case 'location':
      return (
        (input.activityIds.length > 0 && !input.text) ||
        (input.activityIds.length === 0 && !!input.text)
      );
    case 'scope':
      return (
        ['yes', 'no'].includes(input.answer) &&
        (input.answer !== 'yes' || !input.text)
      );
    case 'assignment':
      return ['yes', 'no'].includes(input.answer) && !!input.text;
    case 'detail':
      return !!input.text;
  }
}
