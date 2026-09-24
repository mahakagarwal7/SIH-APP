import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';

import {
  activeVerificationSchema,
  candidateSchema,
  clarificationResultSchema,
  decisionCommandSchema,
  decisionPreviewSchema,
  decisionResultSchema,
  decisionSnapshotSchema,
  originalVersionSchema,
  reviewClaimSchema,
  reviewMemberSchema,
  verificationResultSchema,
} from './reviewContracts';
import { ReviewReadError, reviewClaimColumns } from './reviewQueueService';

import type { DecisionCommand } from './reviewContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database, Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;

const decisionReportSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  author_id: z.uuid(),
  current_version: z.number().int().positive(),
  lifecycle: z.literal('submitted'),
  received_at: z.iso.datetime({ offset: true }),
  source_kind: z.enum(['text', 'voice', 'spreadsheet']),
});

const validationMessages: Record<string, string> = {
  CHANGE_PREVIEW_REQUIRED: 'Preview the proposed change before accepting it.',
  VERIFICATION_REQUIRED_OR_STALE:
    'An independent supervisor must confirm this exact work before acceptance.',
  REPORTER_CONFIRMATION_REQUIRED:
    'Ask the reporter to confirm the changed assignment before requesting a supervisor check.',
  VERIFICATION_ALREADY_OPEN:
    'A supervisor check is already open for this claim.',
  NO_AUTHORIZED_VERIFIER:
    'No independent supervisor currently has authority for this work area.',
  OPEN_QUESTION:
    'The reporter must answer the open question before acceptance.',
  MATCH_REQUIRES_CLARIFICATION:
    'The selected activity conflicts with the report. Request clarification first.',
  MISSING_OR_UNRESOLVED_FACTS:
    'Required report details remain missing or unresolved.',
  MISSING_EVENT_DATE: 'Confirm when the work happened before accepting it.',
  PARTIAL_SCOPE: 'Confirm which complete activity started.',
  PARTIAL_SCOPE_CANNOT_FINISH:
    'Partial work cannot mark the whole activity complete.',
  MISSING_ACTUAL_START:
    'Accept the activity start before accepting its finish.',
  FINISH_BEFORE_START: 'The finish date cannot precede the accepted start.',
  FINISH_BEFORE_PROGRESS:
    'Progress exists after this proposed finish date. Review the dates first.',
  COMPOUND_SCOPE_INCOMPLETE:
    'The report does not confirm every stage of this compound activity.',
  INCOMPLETE_QUANTITY:
    'The reported quantity does not support completion of the whole activity.',
  QUANTITY_SCOPE_REQUIRES_REVIEW:
    'Confirm the quantity, unit and whether it is a total or an addition.',
  INVALID_PROGRESS_PERCENT:
    'Confirm that this is activity progress and record its basis.',
};

const staleMessages: Record<string, string> = {
  STALE_REVIEW:
    'The claim or review policy changed. Refresh and review it again.',
  STALE_ACTUALS: 'Accepted activity progress changed. Refresh before deciding.',
  STALE_CHANGE_PREVIEW:
    'The proposed change is no longer current. Preview it again.',
  COMMAND_ID_REUSED:
    'This retry ID belongs to different decision details. Refresh and retry.',
  VERIFICATION_ALREADY_OPEN:
    'A supervisor check is already open for this claim.',
};

export class DecisionWriteError extends Error {
  constructor(
    public readonly kind: 'access' | 'stale' | 'validation' | 'unavailable',
    message?: string,
  ) {
    super(
      message ??
        (kind === 'access'
          ? 'Manager access is no longer available for this project.'
          : kind === 'stale'
            ? 'The claim changed. Refresh and review it again.'
            : kind === 'validation'
              ? 'Check the decision details before submitting.'
              : 'Could not save the decision. Connect and retry.'),
    );
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ReviewReadError('unavailable');
  return result.data;
}

function readError(error: { code?: string } | null) {
  if (error)
    throw new ReviewReadError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'access'
        : 'unavailable',
    );
}

function writeError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const message = error.message ?? '';
  if (error.code === '42501' || error.code === 'PGRST301')
    throw new DecisionWriteError('access');
  if (error.code === '40001')
    throw new DecisionWriteError(
      'stale',
      staleMessages[message] ??
        'The claim changed. Refresh and review it again.',
    );
  if (error.code?.startsWith('22'))
    throw new DecisionWriteError(
      'validation',
      validationMessages[message] ??
        'Check the report details before submitting.',
    );
  throw new DecisionWriteError('unavailable');
}

export async function loadDecisionContext(
  client: Client,
  context: ProjectContext,
  claimId: string,
  signal: AbortSignal,
) {
  const { member, project } = context;
  if (
    !z.uuid().safeParse(claimId).success ||
    !member.active ||
    !['planner', 'manager'].includes(member.role)
  )
    throw new ReviewReadError('access');

  const claimResult = await client
    .from('claims')
    .select(reviewClaimColumns)
    .eq('project_id', project.id)
    .eq('id', claimId)
    .in('state', ['pending', 'clarification', 'verification', 'disputed'])
    .abortSignal(signal)
    .maybeSingle();
  readError(claimResult.error);
  if (!claimResult.data) throw new ReviewReadError('access');
  const claim = parse(reviewClaimSchema, claimResult.data);
  if (claim.project_id !== project.id) throw new ReviewReadError('changed');

  const [
    reportResult,
    versionResult,
    candidateResult,
    snapshotResult,
    verificationResult,
  ] = await Promise.all([
    client
      .from('reports')
      .select(
        'id,project_id,author_id,current_version,lifecycle,received_at,source_kind',
      )
      .eq('project_id', project.id)
      .eq('id', claim.report_id)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('report_versions')
      .select(
        'report_id,version,source_text,work_date,selected_activity_id,context',
      )
      .eq('report_id', claim.report_id)
      .eq('version', 1)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('candidate_matches')
      .select(
        'claim_id,project_id,activity_id,revision_id,rank,score,features,mismatch_flags',
        { count: 'exact' },
      )
      .eq('project_id', project.id)
      .eq('claim_id', claim.id)
      .order('rank')
      .range(0, 8)
      .abortSignal(signal),
    client
      .rpc('schedule_snapshot', { p_project: project.id })
      .abortSignal(signal),
    client
      .from('verification_requests')
      .select(
        'id,project_id,claim_id,report_id,activity_id,verifier_id,claim_version,report_version,plan_revision_id,policy_version,assignment_version,facts_hash,status,allocation_confirmed,work_confirmed,version,created_at',
      )
      .eq('project_id', project.id)
      .eq('claim_id', claim.id)
      .in('status', ['open', 'confirmed', 'needs_info', 'denied'])
      .limit(2)
      .abortSignal(signal),
  ]);
  [
    reportResult,
    versionResult,
    candidateResult,
    snapshotResult,
    verificationResult,
  ].forEach((response) => readError(response.error));
  if (!reportResult.data || !versionResult.data)
    throw new ReviewReadError('changed');
  const report = parse(decisionReportSchema, reportResult.data);
  const original = parse(originalVersionSchema, versionResult.data);
  const candidates = parse(
    z.array(candidateSchema).max(8),
    candidateResult.data,
  );
  const snapshot = parse(decisionSnapshotSchema, snapshotResult.data);
  const verifications = parse(
    z.array(activeVerificationSchema).max(1),
    verificationResult.data,
  );
  if (
    candidateResult.count === null ||
    candidateResult.count !== candidates.length ||
    report.id !== claim.report_id ||
    report.project_id !== project.id ||
    original.report_id !== claim.report_id ||
    snapshot.projectId !== project.id ||
    snapshot.revisionId !== claim.plan_revision_id ||
    snapshot.policyVersion !== claim.policy_version ||
    new Set(candidates.map((candidate) => candidate.activity_id)).size !==
      candidates.length ||
    candidates.some(
      (candidate) =>
        candidate.claim_id !== claim.id ||
        candidate.project_id !== project.id ||
        candidate.revision_id !== claim.plan_revision_id,
    ) ||
    snapshot.activities.some(
      (activity) =>
        activity.projectId !== project.id ||
        activity.revisionId !== snapshot.revisionId,
    ) ||
    verifications.some(
      (verification) =>
        verification.project_id !== project.id ||
        verification.claim_id !== claim.id ||
        verification.report_id !== claim.report_id,
    )
  )
    throw new ReviewReadError('changed');

  const [reporterResult, accessResult, stableClaimResult] = await Promise.all([
    client
      .from('project_members')
      .select('user_id,display_name')
      .eq('project_id', project.id)
      .eq('user_id', report.author_id)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('project_members')
      .select('project_id,user_id,display_name,role,active,version')
      .eq('project_id', project.id)
      .eq('user_id', member.user_id)
      .eq('active', true)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('claims')
      .select('id,version,state')
      .eq('project_id', project.id)
      .eq('id', claim.id)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  [reporterResult, accessResult, stableClaimResult].forEach((response) =>
    readError(response.error),
  );
  if (!accessResult.data || !stableClaimResult.data)
    throw new ReviewReadError('access');
  const access = parse(membershipSchema, accessResult.data);
  const stableClaim = parse(
    z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      state: z.enum(['pending', 'clarification', 'verification', 'disputed']),
    }),
    stableClaimResult.data,
  );
  const reporter = reporterResult.data
    ? parse(reviewMemberSchema, reporterResult.data)
    : null;
  if (
    access.project_id !== project.id ||
    access.user_id !== member.user_id ||
    !access.active ||
    !['planner', 'manager'].includes(access.role)
  )
    throw new ReviewReadError('access');
  if (
    access.version !== member.version ||
    access.role !== member.role ||
    stableClaim.id !== claim.id ||
    stableClaim.version !== claim.version ||
    stableClaim.state !== claim.state
  )
    throw new ReviewReadError('changed');

  const activities = new Map(
    snapshot.activities.map((activity) => [activity.id, activity]),
  );
  return {
    claim,
    report,
    original,
    reporterName: reporter?.display_name || 'Name not recorded',
    candidates: candidates.map((candidate) => ({
      ...candidate,
      activity: activities.get(candidate.activity_id) ?? null,
    })),
    snapshot,
    verification: verifications[0] ?? null,
  };
}

export type DecisionContext = Awaited<ReturnType<typeof loadDecisionContext>>;

export async function previewDecision(
  client: Client,
  command: DecisionCommand,
  signal?: AbortSignal,
) {
  const parsed = decisionCommandSchema.parse(command);
  if (parsed.action !== 'accept')
    throw new DecisionWriteError(
      'validation',
      'Only acceptance has a change preview.',
    );
  let request = client.rpc('preview_claim', { p_command: parsed as Json });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const preview = decisionPreviewSchema.safeParse(result.data);
  if (!preview.success) throw new DecisionWriteError('unavailable');
  return preview.data;
}

export async function submitDecision(
  client: Client,
  command: DecisionCommand,
  signal?: AbortSignal,
) {
  const parsed = decisionCommandSchema.parse(command);
  let request = client.rpc('decide_claim', { p_command: parsed as Json });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const decision = decisionResultSchema.safeParse(result.data);
  if (!decision.success) throw new DecisionWriteError('unavailable');
  return decision.data;
}

export async function requestClarification(
  client: Client,
  claimId: string,
  command: {
    commandId: string;
    expectedClaimVersion: number;
    reasonCode: 'location' | 'date' | 'scope' | 'assignment' | 'detail';
  },
  signal?: AbortSignal,
) {
  const parsed = z
    .object({
      commandId: z.uuid(),
      expectedClaimVersion: z.number().int().positive(),
      reasonCode: z.enum(['location', 'date', 'scope', 'assignment', 'detail']),
    })
    .parse(command);
  let request = client.rpc('request_clarification', {
    p_claim: z.uuid().parse(claimId),
    p_command: parsed as Json,
  });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const response = clarificationResultSchema.safeParse(result.data);
  if (!response.success) throw new DecisionWriteError('unavailable');
  return response.data;
}

export async function requestVerification(
  client: Client,
  claimId: string,
  command: {
    commandId: string;
    expectedClaimVersion: number;
    activityId: string;
    reason: string;
  },
  signal?: AbortSignal,
) {
  const parsed = z
    .object({
      commandId: z.uuid(),
      expectedClaimVersion: z.number().int().positive(),
      activityId: z.uuid(),
      reason: z.string().trim().min(1).max(1000),
    })
    .parse(command);
  let request = client.rpc('request_verification', {
    p_claim: z.uuid().parse(claimId),
    p_command: parsed as Json,
  });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const response = verificationResultSchema.safeParse(result.data);
  if (!response.success) throw new DecisionWriteError('unavailable');
  return response.data;
}
