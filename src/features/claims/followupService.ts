import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';

import {
  attestationCommandSchema,
  attestationResultSchema,
  clarificationRequestSchema,
  clarificationResponseSchema,
  followupClaimSchema,
  followupReportSchema,
  followupVersionSchema,
  replyCommandSchema,
  replyResultSchema,
  verificationContextSchema,
  verificationDecisionSchema,
  verificationRequestSchema,
} from './followupContracts';
import { reviewSnapshotSchema } from './reviewContracts';

import type { AttestationCommand, ReplyCommand } from './followupContracts';
import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database, Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
const MAX_FOLLOWUPS = 100;
const reportColumns =
  'id,project_id,author_id,current_version,lifecycle,received_at,source_kind';
const claimColumns =
  'id,project_id,report_id,report_version,facts,validation_flags,state,version';
const questionColumns =
  'id,project_id,claim_id,report_id,claim_version,report_version,version,reason_code,question_text,options,automatic,status,created_at';
const responseColumns =
  'id,request_id,project_id,actor_id,question_version,input,resulting_report_version,created_at';
const verificationColumns =
  'id,project_id,claim_id,report_id,activity_id,verifier_id,claim_version,report_version,plan_revision_id,policy_version,assignment_version,facts_hash,version,status,allocation_confirmed,work_confirmed,created_at';
const decisionColumns =
  'id,request_id,project_id,actor_id,request_version,allocation,work,reason,created_at';

export class FollowupReadError extends Error {
  constructor(public readonly kind: 'access' | 'changed' | 'unavailable') {
    super(
      kind === 'access'
        ? 'This follow-up is no longer available for your account.'
        : kind === 'changed'
          ? 'The follow-up changed while loading. Refresh to see its current state.'
          : 'Could not load the follow-up. Connect and try again.',
    );
  }
}

export class FollowupWriteError extends Error {
  constructor(
    public readonly kind: 'access' | 'stale' | 'validation' | 'unavailable',
    message?: string,
  ) {
    super(
      message ??
        (kind === 'access'
          ? 'Your access to this follow-up changed.'
          : kind === 'stale'
            ? 'This follow-up changed. Refresh it before sending again.'
            : kind === 'validation'
              ? 'Check every required response before sending.'
              : 'Could not confirm receipt. Keep these details and retry.'),
    );
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new FollowupReadError('unavailable');
  return parsed.data;
}

function readError(error: { code?: string } | null) {
  if (!error) return;
  throw new FollowupReadError(
    error.code === '42501' || error.code === 'PGRST301'
      ? 'access'
      : 'unavailable',
  );
}

const validationMessages: Record<string, string> = {
  'Invalid reply':
    'Choose a supported answer and keep notes under 1,000 characters.',
  MIXED_LOCATION_REPLY:
    'Choose listed work areas or type another location, not both.',
  SCOPE_REPLY_NEEDS_REVIEW:
    'A whole-activity confirmation cannot also include unfinished-work wording.',
  'Too many choices': 'Choose no more than eight work areas.',
  'Location required': 'Choose a listed work area or type the location.',
  'Date required': 'Enter the date when this work happened.',
  'Confirm scope': 'Confirm whether the whole activity was completed.',
  'Confirm location and who assigned the work':
    'Confirm the location and record who assigned the work.',
  'Both checks and a reason are required':
    'Answer both supervisor checks and record the evidence you checked.',
};

function writeError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const message = error.message ?? '';
  if (error.code === '42501' || error.code === 'PGRST301')
    throw new FollowupWriteError('access');
  if (error.code === '40001')
    throw new FollowupWriteError(
      'stale',
      message === 'COMMAND_ID_REUSED'
        ? 'This retry ID belongs to different response details. Refresh and retry.'
        : 'This question or supervisor check changed. Review the current version before sending again.',
    );
  if (error.code?.startsWith('22'))
    throw new FollowupWriteError(
      'validation',
      validationMessages[message] ??
        'Check every required response before sending.',
    );
  throw new FollowupWriteError('unavailable');
}

function unique<T>(rows: T[], key: (row: T) => string) {
  if (new Set(rows.map(key)).size !== rows.length)
    throw new FollowupReadError('changed');
}

export async function loadReportFollowups(
  client: Client,
  userId: string,
  reportId: string,
  signal: AbortSignal,
) {
  if (
    !z.uuid().safeParse(userId).success ||
    !z.uuid().safeParse(reportId).success
  )
    throw new FollowupReadError('access');
  const reportResult = await client
    .from('reports')
    .select(reportColumns)
    .eq('id', reportId)
    .eq('author_id', userId)
    .abortSignal(signal)
    .maybeSingle();
  readError(reportResult.error);
  if (!reportResult.data) throw new FollowupReadError('access');
  const report = parse(followupReportSchema, reportResult.data);
  if (report.author_id !== userId) throw new FollowupReadError('access');

  const [versionResult, claimResult, questionResult] = await Promise.all([
    client
      .from('report_versions')
      .select('report_id,version,source_text,work_date')
      .eq('report_id', report.id)
      .eq('version', 1)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('claims')
      .select(claimColumns, { count: 'exact' })
      .eq('project_id', report.project_id)
      .eq('report_id', report.id)
      .order('ordinal')
      .range(0, MAX_FOLLOWUPS - 1)
      .abortSignal(signal),
    client
      .from('clarification_requests')
      .select(questionColumns, { count: 'exact' })
      .eq('project_id', report.project_id)
      .eq('report_id', report.id)
      .order('created_at')
      .range(0, MAX_FOLLOWUPS - 1)
      .abortSignal(signal),
  ]);
  [versionResult, claimResult, questionResult].forEach((result) =>
    readError(result.error),
  );
  if (!versionResult.data) throw new FollowupReadError('changed');
  if (
    claimResult.count === null ||
    questionResult.count === null ||
    claimResult.count > MAX_FOLLOWUPS ||
    questionResult.count > MAX_FOLLOWUPS
  )
    throw new FollowupReadError('unavailable');
  const original = parse(followupVersionSchema, versionResult.data);
  const claims = parse(z.array(followupClaimSchema), claimResult.data);
  const questions = parse(
    z.array(clarificationRequestSchema),
    questionResult.data,
  );
  unique(claims, (claim) => claim.id);
  unique(questions, (question) => question.id);
  if (
    original.report_id !== report.id ||
    claims.length !== claimResult.count ||
    questions.length !== questionResult.count ||
    claims.some(
      (claim) =>
        claim.project_id !== report.project_id || claim.report_id !== report.id,
    ) ||
    questions.some(
      (question) =>
        question.project_id !== report.project_id ||
        question.report_id !== report.id ||
        !claims.some((claim) => claim.id === question.claim_id),
    ) ||
    questions.filter((question) => question.status === 'open').length > 1
  )
    throw new FollowupReadError('changed');

  let responses: z.infer<typeof clarificationResponseSchema>[] = [];
  if (questions.length) {
    const responseResult = await client
      .from('clarification_responses')
      .select(responseColumns, { count: 'exact' })
      .eq('project_id', report.project_id)
      .in(
        'request_id',
        questions.map((question) => question.id),
      )
      .order('created_at')
      .range(0, MAX_FOLLOWUPS - 1)
      .abortSignal(signal);
    readError(responseResult.error);
    if (responseResult.count === null || responseResult.count > MAX_FOLLOWUPS)
      throw new FollowupReadError('unavailable');
    responses = parse(
      z.array(clarificationResponseSchema),
      responseResult.data,
    );
    unique(responses, (response) => response.id);
    if (
      responses.length !== responseResult.count ||
      responses.some(
        (response) =>
          response.project_id !== report.project_id ||
          response.actor_id !== userId ||
          !questions.some((question) => question.id === response.request_id),
      )
    )
      throw new FollowupReadError('changed');
  }

  const [stableReportResult, membershipResult] = await Promise.all([
    client
      .from('reports')
      .select('id,current_version,lifecycle')
      .eq('id', report.id)
      .eq('author_id', userId)
      .abortSignal(signal)
      .maybeSingle(),
    client
      .from('project_members')
      .select('project_id,user_id,display_name,role,active,version')
      .eq('project_id', report.project_id)
      .eq('user_id', userId)
      .eq('active', true)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  readError(stableReportResult.error);
  readError(membershipResult.error);
  if (!stableReportResult.data || !membershipResult.data)
    throw new FollowupReadError('access');
  const stableReport = parse(
    z.object({
      id: z.uuid(),
      current_version: z.number().int().positive(),
      lifecycle: z.literal('submitted'),
    }),
    stableReportResult.data,
  );
  const membership = parse(membershipSchema, membershipResult.data);
  if (
    stableReport.id !== report.id ||
    stableReport.current_version !== report.current_version ||
    membership.project_id !== report.project_id ||
    membership.user_id !== userId ||
    !membership.active
  )
    throw new FollowupReadError('changed');
  return { report, original, claims, questions, responses };
}

export async function loadVerificationAssignments(
  client: Client,
  context: ProjectContext,
  signal: AbortSignal,
) {
  const { member, project } = context;
  if (!member.active) throw new FollowupReadError('access');
  const requestResult = await client
    .from('verification_requests')
    .select(verificationColumns, { count: 'exact' })
    .eq('project_id', project.id)
    .eq('verifier_id', member.user_id)
    .in('status', ['open', 'needs_info', 'confirmed', 'denied'])
    .order('created_at', { ascending: false })
    .range(0, MAX_FOLLOWUPS - 1)
    .abortSignal(signal);
  readError(requestResult.error);
  if (requestResult.count === null || requestResult.count > MAX_FOLLOWUPS)
    throw new FollowupReadError('unavailable');
  const requests = parse(
    z.array(verificationRequestSchema),
    requestResult.data,
  );
  unique(requests, (request) => request.id);
  if (
    requests.length !== requestResult.count ||
    requests.some(
      (request) =>
        request.project_id !== project.id ||
        request.verifier_id !== member.user_id,
    )
  )
    throw new FollowupReadError('changed');

  let contexts: z.infer<typeof verificationContextSchema>[] = [];
  let versions: z.infer<typeof followupVersionSchema>[] = [];
  let claims: z.infer<typeof followupClaimSchema>[] = [];
  let decisions: z.infer<typeof verificationDecisionSchema>[] = [];
  let snapshot: z.infer<typeof reviewSnapshotSchema> = {
    projectId: project.id,
    revisionId: null,
    activities: [],
  };
  if (requests.length) {
    const reportIds = [
      ...new Set(requests.map((request) => request.report_id)),
    ];
    const reportVersions = [
      ...new Set(requests.map((request) => request.report_version)),
    ];
    const [
      contextResult,
      versionResult,
      claimResult,
      decisionResult,
      snapshotResult,
    ] = await Promise.all([
      client
        .rpc('verification_context', { p_project: project.id })
        .abortSignal(signal),
      client
        .from('report_versions')
        .select('report_id,version,source_text,work_date', { count: 'exact' })
        .in('report_id', reportIds)
        .in('version', reportVersions)
        .range(0, MAX_FOLLOWUPS * MAX_FOLLOWUPS - 1)
        .abortSignal(signal),
      client
        .from('claims')
        .select(claimColumns)
        .eq('project_id', project.id)
        .in(
          'id',
          requests.map((request) => request.claim_id),
        )
        .abortSignal(signal),
      client
        .from('verification_decisions')
        .select(decisionColumns, { count: 'exact' })
        .eq('project_id', project.id)
        .in(
          'request_id',
          requests.map((request) => request.id),
        )
        .order('created_at')
        .range(0, MAX_FOLLOWUPS - 1)
        .abortSignal(signal),
      client
        .rpc('schedule_snapshot', { p_project: project.id })
        .abortSignal(signal),
    ]);
    [
      contextResult,
      versionResult,
      claimResult,
      decisionResult,
      snapshotResult,
    ].forEach((result) => readError(result.error));
    if (
      versionResult.count === null ||
      versionResult.count > MAX_FOLLOWUPS * MAX_FOLLOWUPS ||
      decisionResult.count === null ||
      decisionResult.count > MAX_FOLLOWUPS
    )
      throw new FollowupReadError('unavailable');
    contexts = parse(z.array(verificationContextSchema), contextResult.data);
    versions = parse(z.array(followupVersionSchema), versionResult.data);
    claims = parse(z.array(followupClaimSchema), claimResult.data);
    decisions = parse(z.array(verificationDecisionSchema), decisionResult.data);
    snapshot = parse(reviewSnapshotSchema, snapshotResult.data);
    unique(contexts, (row) => row.request_id);
    unique(versions, (row) => `${row.report_id}:${row.version}`);
    unique(claims, (row) => row.id);
    unique(decisions, (row) => row.id);
    const requestIds = new Set(requests.map((request) => request.id));
    if (
      snapshot.projectId !== project.id ||
      claims.some(
        (claim) =>
          claim.project_id !== project.id ||
          !requests.some((request) => request.claim_id === claim.id),
      ) ||
      decisions.length !== decisionResult.count ||
      decisions.some(
        (decision) =>
          decision.project_id !== project.id ||
          !requestIds.has(decision.request_id),
      ) ||
      requests.some(
        (request) =>
          !contexts.some((row) => row.request_id === request.id) ||
          !versions.some(
            (version) =>
              version.report_id === request.report_id &&
              version.version === request.report_version,
          ) ||
          !claims.some((claim) => claim.id === request.claim_id),
      )
    )
      throw new FollowupReadError('changed');
  }

  const accessResult = await client
    .from('project_members')
    .select('project_id,user_id,display_name,role,active,version')
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new FollowupReadError('access');
  const access = parse(membershipSchema, accessResult.data);
  if (
    access.project_id !== project.id ||
    access.user_id !== member.user_id ||
    !access.active
  )
    throw new FollowupReadError('access');
  if (access.version !== member.version || access.role !== member.role)
    throw new FollowupReadError('changed');

  const activities = new Map(
    snapshot.activities.map((activity) => [activity.id, activity]),
  );
  return requests.map((request) => ({
    request,
    reporterName:
      contexts.find((row) => row.request_id === request.id)?.reporter_name ||
      'Project reporter',
    original: versions.find(
      (version) =>
        version.report_id === request.report_id &&
        version.version === request.report_version,
    )!,
    claim: claims.find((claim) => claim.id === request.claim_id)!,
    activity: activities.get(request.activity_id) ?? null,
    decisions: decisions.filter(
      (decision) => decision.request_id === request.id,
    ),
  }));
}

export async function respondToClarification(
  client: Client,
  questionId: string,
  command: ReplyCommand,
  signal?: AbortSignal,
) {
  const parsedId = z.uuid().parse(questionId);
  const parsed = replyCommandSchema.parse(command);
  let request = client.rpc('respond_clarification', {
    p_question: parsedId,
    p_command: parsed as Json,
  });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const response = replyResultSchema.safeParse(result.data);
  if (!response.success) throw new FollowupWriteError('unavailable');
  return response.data;
}

export async function decideVerification(
  client: Client,
  requestId: string,
  command: AttestationCommand,
  signal?: AbortSignal,
) {
  const parsedId = z.uuid().parse(requestId);
  const parsed = attestationCommandSchema.parse(command);
  let request = client.rpc('decide_verification', {
    p_request: parsedId,
    p_command: parsed as Json,
  });
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  writeError(result.error);
  const response = attestationResultSchema.safeParse(result.data);
  if (!response.success) throw new FollowupWriteError('unavailable');
  return response.data;
}
