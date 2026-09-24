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
const PAGE_SIZE = 100;
const MAX_FOLLOWUPS = 10_000;
const ID_BATCH_SIZE = 100;
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
const verificationSnapshotSchema = reviewSnapshotSchema.extend({
  policyVersion: z.number().int().positive(),
});
const verificationReportSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  lifecycle: z.enum(['draft', 'submitted', 'withdrawn']),
});
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

type PageResponse = {
  data: unknown;
  error: { code?: string } | null;
  count: number | null;
};

async function readPagedRows(
  loadPage: (from: number, to: number) => PromiseLike<PageResponse>,
) {
  const rows: unknown[] = [];
  let expectedCount: number | undefined;

  for (let from = 0; from < MAX_FOLLOWUPS; from += PAGE_SIZE) {
    const response = await loadPage(from, from + PAGE_SIZE - 1);
    readError(response.error);
    if (
      response.count === null ||
      !Number.isSafeInteger(response.count) ||
      response.count > MAX_FOLLOWUPS ||
      (expectedCount !== undefined && expectedCount !== response.count)
    )
      throw new FollowupReadError('unavailable');
    const page = z.array(z.unknown()).safeParse(response.data);
    if (!page.success || page.data.length > PAGE_SIZE)
      throw new FollowupReadError('unavailable');

    expectedCount = response.count;
    rows.push(...page.data);
    if (rows.length > expectedCount) throw new FollowupReadError('changed');
    if (rows.length === expectedCount) return { rows, count: expectedCount };
    if (!page.data.length) throw new FollowupReadError('changed');
  }

  throw new FollowupReadError('unavailable');
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

async function readPagedBatches<T>(
  items: T[],
  loadBatch: (batch: T[]) => Promise<unknown[]>,
) {
  const rows: unknown[] = [];
  const batches = chunks(items, ID_BATCH_SIZE);
  for (let index = 0; index < batches.length; index += 4) {
    const pages = await Promise.all(
      batches.slice(index, index + 4).map(loadBatch),
    );
    pages.forEach((page) => rows.push(...page));
    if (rows.length > MAX_FOLLOWUPS) throw new FollowupReadError('unavailable');
  }
  return rows;
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

  const [versionResult, claimPage, questionPage] = await Promise.all([
    client
      .from('report_versions')
      .select('report_id,version,source_text,work_date')
      .eq('report_id', report.id)
      .eq('version', 1)
      .abortSignal(signal)
      .maybeSingle(),
    readPagedRows((from, to) =>
      client
        .from('claims')
        .select(claimColumns, { count: 'exact' })
        .eq('project_id', report.project_id)
        .eq('report_id', report.id)
        .order('ordinal')
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
    readPagedRows((from, to) =>
      client
        .from('clarification_requests')
        .select(questionColumns, { count: 'exact' })
        .eq('project_id', report.project_id)
        .eq('report_id', report.id)
        .order('created_at')
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
  ]);
  readError(versionResult.error);
  if (!versionResult.data) throw new FollowupReadError('changed');
  const original = parse(followupVersionSchema, versionResult.data);
  const claims = parse(z.array(followupClaimSchema), claimPage.rows);
  const questions = parse(
    z.array(clarificationRequestSchema),
    questionPage.rows,
  );
  unique(claims, (claim) => claim.id);
  unique(questions, (question) => question.id);
  const openQuestions = questions.filter(
    (question) => question.status === 'open',
  );
  if (
    original.report_id !== report.id ||
    claims.length !== claimPage.count ||
    questions.length !== questionPage.count ||
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
    new Set(openQuestions.map((question) => question.claim_id)).size !==
      openQuestions.length ||
    openQuestions.some((question) => {
      const claim = claims.find((row) => row.id === question.claim_id);
      return (
        !claim ||
        claim.version !== question.claim_version ||
        claim.report_version !== question.report_version ||
        question.report_version > report.current_version ||
        claim.state !== 'clarification'
      );
    })
  )
    throw new FollowupReadError('changed');

  let responses: z.infer<typeof clarificationResponseSchema>[] = [];
  if (questions.length) {
    const responseRows = await readPagedBatches(
      questions.map((question) => question.id),
      async (requestIds) => {
        const page = await readPagedRows((from, to) =>
          client
            .from('clarification_responses')
            .select(responseColumns, { count: 'exact' })
            .eq('project_id', report.project_id)
            .in('request_id', requestIds)
            .order('created_at')
            .order('id')
            .range(from, to)
            .abortSignal(signal),
        );
        return page.rows;
      },
    );
    responses = parse(z.array(clarificationResponseSchema), responseRows);
    unique(responses, (response) => response.id);
    if (
      responses.some(
        (response) =>
          response.project_id !== report.project_id ||
          response.actor_id !== userId ||
          !questions.some((question) => question.id === response.request_id),
      )
    )
      throw new FollowupReadError('changed');
  }

  const [
    stableReportResult,
    membershipResult,
    stableClaimPage,
    stableQuestionPage,
  ] = await Promise.all([
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
    readPagedRows((from, to) =>
      client
        .from('claims')
        .select(claimColumns, { count: 'exact' })
        .eq('project_id', report.project_id)
        .eq('report_id', report.id)
        .order('ordinal')
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
    readPagedRows((from, to) =>
      client
        .from('clarification_requests')
        .select(questionColumns, { count: 'exact' })
        .eq('project_id', report.project_id)
        .eq('report_id', report.id)
        .order('created_at')
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
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
  const stableClaims = parse(
    z.array(followupClaimSchema),
    stableClaimPage.rows,
  );
  const stableQuestions = parse(
    z.array(clarificationRequestSchema),
    stableQuestionPage.rows,
  );
  unique(stableClaims, (claim) => claim.id);
  unique(stableQuestions, (question) => question.id);
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const questionsById = new Map(
    questions.map((question) => [question.id, question]),
  );
  if (
    stableReport.id !== report.id ||
    stableReport.current_version !== report.current_version ||
    membership.project_id !== report.project_id ||
    membership.user_id !== userId ||
    !membership.active ||
    stableClaims.length !== claims.length ||
    stableClaims.length !== stableClaimPage.count ||
    stableQuestions.length !== questions.length ||
    stableQuestions.length !== stableQuestionPage.count ||
    stableClaims.some((stableClaim) => {
      const initial = claimsById.get(stableClaim.id);
      return (
        !initial ||
        stableClaim.version !== initial.version ||
        stableClaim.state !== initial.state ||
        stableClaim.report_version !== initial.report_version
      );
    }) ||
    stableQuestions.some((stableQuestion) => {
      const initial = questionsById.get(stableQuestion.id);
      return (
        !initial ||
        stableQuestion.version !== initial.version ||
        stableQuestion.status !== initial.status ||
        stableQuestion.claim_version !== initial.claim_version ||
        stableQuestion.report_version !== initial.report_version
      );
    })
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
  const requestPage = await readPagedRows((from, to) =>
    client
      .from('verification_requests')
      .select(verificationColumns, { count: 'exact' })
      .eq('project_id', project.id)
      .eq('verifier_id', member.user_id)
      .in('status', ['open', 'needs_info', 'confirmed', 'denied'])
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
      .abortSignal(signal),
  );
  const requests = parse(z.array(verificationRequestSchema), requestPage.rows);
  unique(requests, (request) => request.id);
  if (
    requests.length !== requestPage.count ||
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
  let snapshot: z.infer<typeof verificationSnapshotSchema> | null = null;
  const reportsById = new Map<
    string,
    z.infer<typeof verificationReportSchema>
  >();
  if (requests.length) {
    const requestedVersions = [
      ...new Map(
        requests.map((request) => [
          `${request.report_id}:${request.report_version}`,
          {
            reportId: request.report_id,
            version: request.report_version,
          },
        ]),
      ).values(),
    ];
    const claimIds = [...new Set(requests.map((request) => request.claim_id))];
    const requestIds = requests.map((request) => request.id);
    const reportIds = [
      ...new Set(requests.map((request) => request.report_id)),
    ];
    const reportIdsByVersion = new Map<number, Set<string>>();
    requestedVersions.forEach(({ reportId, version }) => {
      const reportIds = reportIdsByVersion.get(version) ?? new Set<string>();
      reportIds.add(reportId);
      reportIdsByVersion.set(version, reportIds);
    });
    const versionGroups = [...reportIdsByVersion].map(
      ([version, reportIds]) => ({ version, reportIds: [...reportIds] }),
    );
    const [
      contextPage,
      versionRows,
      claimRows,
      decisionRows,
      reportRows,
      snapshotResult,
    ] = await Promise.all([
      readPagedRows((from, to) =>
        client
          .rpc(
            'verification_context_v2',
            { p_project: project.id },
            {
              count: 'exact',
            },
          )
          .order('request_id')
          .range(from, to)
          .abortSignal(signal),
      ),
      (async () => {
        const rows: unknown[] = [];
        for (let index = 0; index < versionGroups.length; index += 4) {
          const groups = await Promise.all(
            versionGroups.slice(index, index + 4).map(async (group) =>
              readPagedBatches(group.reportIds, async (reportIds) => {
                const page = await readPagedRows((from, to) =>
                  client
                    .from('report_versions')
                    .select('report_id,version,source_text,work_date', {
                      count: 'exact',
                    })
                    .in('report_id', reportIds)
                    .eq('version', group.version)
                    .range(from, to)
                    .abortSignal(signal),
                );
                return page.rows;
              }),
            ),
          );
          groups.forEach((groupRows) => rows.push(...groupRows));
          if (rows.length > MAX_FOLLOWUPS)
            throw new FollowupReadError('unavailable');
        }
        return rows;
      })(),
      readPagedBatches(claimIds, async (batch) => {
        const page = await readPagedRows((from, to) =>
          client
            .from('claims')
            .select(claimColumns, { count: 'exact' })
            .eq('project_id', project.id)
            .in('id', batch)
            .order('id')
            .range(from, to)
            .abortSignal(signal),
        );
        return page.rows;
      }),
      readPagedBatches(requestIds, async (batch) => {
        const page = await readPagedRows((from, to) =>
          client
            .from('verification_decisions')
            .select(decisionColumns, { count: 'exact' })
            .eq('project_id', project.id)
            .in('request_id', batch)
            .order('created_at')
            .order('id')
            .range(from, to)
            .abortSignal(signal),
        );
        return page.rows;
      }),
      readPagedBatches(reportIds, async (batch) => {
        const page = await readPagedRows((from, to) =>
          client
            .from('reports')
            .select('id,project_id,lifecycle', { count: 'exact' })
            .eq('project_id', project.id)
            .in('id', batch)
            .order('id')
            .range(from, to)
            .abortSignal(signal),
        );
        return page.rows;
      }),
      client
        .rpc('schedule_snapshot', { p_project: project.id })
        .abortSignal(signal),
    ]);
    readError(snapshotResult.error);
    contexts = parse(z.array(verificationContextSchema), contextPage.rows);
    const parsedVersions = parse(z.array(followupVersionSchema), versionRows);
    const expectedVersionKeys = new Set(
      requestedVersions.map((item) => `${item.reportId}:${item.version}`),
    );
    versions = [
      ...new Map(
        parsedVersions
          .filter((version) =>
            expectedVersionKeys.has(`${version.report_id}:${version.version}`),
          )
          .map((version) => [
            `${version.report_id}:${version.version}`,
            version,
          ]),
      ).values(),
    ];
    claims = parse(z.array(followupClaimSchema), claimRows);
    decisions = parse(z.array(verificationDecisionSchema), decisionRows);
    snapshot = parse(verificationSnapshotSchema, snapshotResult.data);
    const currentReports = parse(z.array(verificationReportSchema), reportRows);
    unique(contexts, (row) => row.request_id);
    unique(versions, (row) => `${row.report_id}:${row.version}`);
    unique(claims, (row) => row.id);
    unique(decisions, (row) => row.id);
    unique(currentReports, (row) => row.id);
    const reportIdSet = new Set(reportIds);
    const requestIdSet = new Set(requestIds);
    if (
      snapshot.projectId !== project.id ||
      currentReports.length !== reportIds.length ||
      currentReports.some(
        (report) =>
          report.project_id !== project.id || !reportIdSet.has(report.id),
      ) ||
      claims.some(
        (claim) =>
          claim.project_id !== project.id ||
          !requests.some((request) => request.claim_id === claim.id),
      ) ||
      claims.length !== claimIds.length ||
      decisions.some(
        (decision) =>
          decision.project_id !== project.id ||
          !requestIdSet.has(decision.request_id),
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

    const requestsById = new Map(
      requests.map((request) => [request.id, request]),
    );
    currentReports.forEach((report) => reportsById.set(report.id, report));
    const decisionsByVersion = new Set<string>();
    if (
      decisions.some((decision) => {
        const request = requestsById.get(decision.request_id);
        const key = `${decision.request_id}:${decision.request_version}`;
        if (
          !request ||
          decision.actor_id !== request.verifier_id ||
          decision.request_version >= request.version ||
          decisionsByVersion.has(key)
        )
          return true;
        decisionsByVersion.add(key);
        return false;
      })
    )
      throw new FollowupReadError('changed');
  }

  const contextsByRequestId = new Map(
    contexts.map((row) => [row.request_id, row]),
  );
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
    (snapshot?.activities ?? []).map((activity) => [activity.id, activity]),
  );
  return requests.map((request) => {
    const claim = claims.find((row) => row.id === request.claim_id)!;
    const currentReport = reportsById?.get(request.report_id);
    const verificationContext = contextsByRequestId.get(request.id);
    const scheduleIsCurrent = snapshot?.revisionId === request.plan_revision_id;
    const awaitsVerifier = ['open', 'needs_info'].includes(request.status);
    const requestIsCurrent =
      !awaitsVerifier ||
      (scheduleIsCurrent &&
        snapshot?.policyVersion === request.policy_version &&
        currentReport?.lifecycle === 'submitted' &&
        claim.version === request.claim_version &&
        claim.report_version === request.report_version &&
        claim.state === 'verification' &&
        verificationContext?.assignment_is_current === true);
    return {
      request,
      reporterName: verificationContext?.reporter_name || 'Project reporter',
      original: versions.find(
        (version) =>
          version.report_id === request.report_id &&
          version.version === request.report_version,
      )!,
      claim,
      activity: scheduleIsCurrent
        ? (activities.get(request.activity_id) ?? null)
        : null,
      scheduleIsCurrent,
      requestIsCurrent,
      decisions: decisions.filter(
        (decision) => decision.request_id === request.id,
      ),
    };
  });
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
