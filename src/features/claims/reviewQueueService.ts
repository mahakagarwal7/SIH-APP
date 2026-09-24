import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';

import {
  actionableReviewStates,
  candidateSchema,
  originalVersionSchema,
  reviewClaimSchema,
  reviewMemberSchema,
  reviewReportSchema,
  reviewSnapshotSchema,
} from './reviewContracts';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;
export type ReviewQueueItem = Awaited<
  ReturnType<typeof loadReviewQueue>
>['items'][number];
export const REVIEW_PAGE_SIZE = 20;
const claimColumns =
  'id,project_id,report_id,report_version,run_id,ordinal,facts,validation_flags,state,version,plan_revision_id,policy_version,parent_claim_id,root_claim_id,followup_round,manual_review,correction_of_event_id';
const memberColumns = 'project_id,user_id,display_name,role,active,version';

export class ReviewReadError extends Error {
  constructor(public readonly kind: 'access' | 'changed' | 'unavailable') {
    super(
      kind === 'access'
        ? 'Manager access is no longer available for this project.'
        : kind === 'changed'
          ? 'The review queue changed while loading. Refresh to load a consistent page.'
          : 'Could not load the review queue. Connect and try again.',
    );
  }
}

function readError(error: { code?: string } | null) {
  if (error)
    throw new ReviewReadError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'access'
        : 'unavailable',
    );
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ReviewReadError('unavailable');
  return result.data;
}

function unique<T>(rows: T[], key: (row: T) => string) {
  if (new Set(rows.map(key)).size !== rows.length)
    throw new ReviewReadError('changed');
}

export async function loadReviewQueue(
  client: Client,
  context: ProjectContext,
  page: number,
  signal: AbortSignal,
) {
  const { member, project } = context;
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !member.active ||
    !['planner', 'manager'].includes(member.role)
  )
    throw new ReviewReadError('access');

  const from = page * REVIEW_PAGE_SIZE;
  const result = await client
    .from('claims')
    .select(claimColumns, { count: 'exact' })
    .eq('project_id', project.id)
    .in('state', [...actionableReviewStates])
    .order('id')
    .range(from, from + REVIEW_PAGE_SIZE - 1)
    .abortSignal(signal);
  readError(result.error);
  if (
    result.count === null ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  )
    throw new ReviewReadError('unavailable');
  const claims = parse(z.array(reviewClaimSchema), result.data);
  unique(claims, (claim) => claim.id);
  const expectedPageLength = Math.max(
    0,
    Math.min(REVIEW_PAGE_SIZE, result.count - from),
  );
  if (claims.some((claim) => claim.project_id !== project.id))
    throw new ReviewReadError('changed');
  if (claims.length !== expectedPageLength)
    throw new ReviewReadError('changed');

  const reportIds = [...new Set(claims.map((claim) => claim.report_id))];
  let reports: z.infer<typeof reviewReportSchema>[] = [];
  let versions: z.infer<typeof originalVersionSchema>[] = [];
  let candidates: z.infer<typeof candidateSchema>[] = [];
  let reporters: z.infer<typeof reviewMemberSchema>[] = [];
  let snapshot: z.infer<typeof reviewSnapshotSchema> = {
    projectId: project.id,
    revisionId: null,
    activities: [],
  };

  if (claims.length) {
    const [reportResult, versionResult, candidateResult, snapshotResult] =
      await Promise.all([
        client
          .from('reports')
          .select('id,project_id,author_id,received_at,source_kind')
          .eq('project_id', project.id)
          .in('id', reportIds)
          .abortSignal(signal),
        client
          .from('report_versions')
          .select(
            'report_id,version,source_text,work_date,selected_activity_id,context',
          )
          .in('report_id', reportIds)
          .eq('version', 1)
          .abortSignal(signal),
        client
          .from('candidate_matches')
          .select(
            'claim_id,project_id,activity_id,revision_id,rank,score,features,mismatch_flags',
            { count: 'exact' },
          )
          .eq('project_id', project.id)
          .in(
            'claim_id',
            claims.map((claim) => claim.id),
          )
          .order('claim_id')
          .order('rank')
          .range(0, REVIEW_PAGE_SIZE * 8)
          .abortSignal(signal),
        client
          .rpc('schedule_snapshot', { p_project: project.id })
          .abortSignal(signal),
      ]);
    [reportResult, versionResult, candidateResult, snapshotResult].forEach(
      (response) => readError(response.error),
    );
    if (
      candidateResult.count === null ||
      candidateResult.count > REVIEW_PAGE_SIZE * 8
    )
      throw new ReviewReadError('changed');
    reports = parse(z.array(reviewReportSchema), reportResult.data);
    versions = parse(z.array(originalVersionSchema), versionResult.data);
    candidates = parse(z.array(candidateSchema), candidateResult.data);
    snapshot = parse(reviewSnapshotSchema, snapshotResult.data);
    unique(reports, (report) => report.id);
    unique(versions, (version) => version.report_id);
    unique(
      candidates,
      (candidate) => `${candidate.claim_id}:${candidate.rank}`,
    );
    if (
      reports.length !== reportIds.length ||
      versions.length !== reportIds.length ||
      candidates.length !== candidateResult.count ||
      snapshot.projectId !== project.id ||
      reports.some((report) => report.project_id !== project.id) ||
      versions.some((version) => !reportIds.includes(version.report_id)) ||
      candidates.some(
        (candidate) =>
          candidate.project_id !== project.id ||
          !claims.some((claim) => claim.id === candidate.claim_id),
      ) ||
      snapshot.activities.some(
        (activity) =>
          activity.projectId !== project.id ||
          activity.revisionId !== snapshot.revisionId,
      )
    )
      throw new ReviewReadError('changed');

    const authorIds = [...new Set(reports.map((report) => report.author_id))];
    const reporterResult = await client
      .from('project_members')
      .select('user_id,display_name')
      .eq('project_id', project.id)
      .in('user_id', authorIds)
      .abortSignal(signal);
    readError(reporterResult.error);
    reporters = parse(z.array(reviewMemberSchema), reporterResult.data);
    unique(reporters, (reporter) => reporter.user_id);
  }

  const accessResult = await client
    .from('project_members')
    .select(memberColumns)
    .eq('project_id', project.id)
    .eq('user_id', member.user_id)
    .eq('active', true)
    .abortSignal(signal)
    .maybeSingle();
  readError(accessResult.error);
  if (!accessResult.data) throw new ReviewReadError('access');
  const current = parse(membershipSchema, accessResult.data);
  if (
    current.project_id !== project.id ||
    current.user_id !== member.user_id ||
    !current.active ||
    !['planner', 'manager'].includes(current.role)
  )
    throw new ReviewReadError('access');
  if (current.version !== member.version || current.role !== member.role)
    throw new ReviewReadError('changed');

  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const versionsByReport = new Map(
    versions.map((version) => [version.report_id, version]),
  );
  const reportersById = new Map(
    reporters.map((reporter) => [reporter.user_id, reporter.display_name]),
  );
  const activitiesById = new Map(
    snapshot.activities.map((activity) => [activity.id, activity]),
  );
  const items = claims.map((claim) => {
    const report = reportsById.get(claim.report_id);
    const original = versionsByReport.get(claim.report_id);
    if (!report || !original) throw new ReviewReadError('changed');
    return {
      claim,
      report,
      original,
      reporterName: reportersById.get(report.author_id) || 'Name not recorded',
      candidates: candidates
        .filter((candidate) => candidate.claim_id === claim.id)
        .map((candidate) => ({
          ...candidate,
          activity:
            candidate.revision_id === snapshot.revisionId
              ? (activitiesById.get(candidate.activity_id) ?? null)
              : null,
        })),
      currentRevisionId: snapshot.revisionId,
    };
  });

  return {
    items,
    page,
    pageSize: REVIEW_PAGE_SIZE,
    total: result.count,
    hasNext: from + items.length < result.count,
  };
}
