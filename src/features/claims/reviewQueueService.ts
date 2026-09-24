import { z } from 'zod';

import { membershipSchema } from '@/features/projects/myWorkContracts';

import {
  actionableReviewStates,
  reviewAttachmentSchema,
  candidateSchema,
  originalVersionSchema,
  reviewClaimSchema,
  reviewMediaSchema,
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
export type ReviewQueuePage = Awaited<ReturnType<typeof loadReviewQueue>>;
export const REVIEW_PAGE_SIZE = 20;
export const reviewClaimColumns =
  'id,project_id,report_id,report_version,run_id,ordinal,facts,validation_flags,state,version,plan_revision_id,policy_version,parent_claim_id,root_claim_id,followup_round,manual_review,correction_of_event_id';
const memberColumns = 'project_id,user_id,display_name,role,active,version';
const mediaContextSchema = z
  .object({ media: z.array(reviewMediaSchema).optional() })
  .passthrough();
const attachmentPathSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  report_id: z.uuid(),
  object_path: z.string().min(1),
  state: z.literal('received'),
});

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

function readMediaContext(context: unknown) {
  const result = mediaContextSchema.safeParse(context);
  if (!result.success) throw new ReviewReadError('unavailable');
  const media = result.data.media ?? [];
  unique(media, (item) => item.attachmentId);
  return media;
}

async function recheckManagerAccess(
  client: Client,
  context: ProjectContext,
  signal: AbortSignal,
) {
  const { member, project } = context;
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
    .select(reviewClaimColumns, { count: 'exact' })
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
  let attachments: z.infer<typeof reviewAttachmentSchema>[] = [];
  let snapshot: z.infer<typeof reviewSnapshotSchema> = {
    projectId: project.id,
    revisionId: null,
    activities: [],
  };

  if (claims.length) {
    const [
      reportResult,
      versionResult,
      candidateResult,
      snapshotResult,
      attachmentResult,
    ] = await Promise.all([
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
      client
        .from('attachments')
        .select(
          'id,project_id,report_id,object_path,state,file_name,mime_type,byte_size,sha256,caption,media_kind,language',
          { count: 'exact' },
        )
        .eq('project_id', project.id)
        .in('report_id', reportIds)
        .eq('state', 'received')
        .order('report_id')
        .order('id')
        .range(0, reportIds.length * 4 - 1)
        .abortSignal(signal),
    ]);
    await recheckManagerAccess(client, context, signal);
    [
      reportResult,
      versionResult,
      candidateResult,
      snapshotResult,
      attachmentResult,
    ].forEach((response) => readError(response.error));
    if (
      candidateResult.count === null ||
      candidateResult.count > REVIEW_PAGE_SIZE * 8
    )
      throw new ReviewReadError('changed');
    if (
      attachmentResult.count === null ||
      attachmentResult.count > reportIds.length * 4
    )
      throw new ReviewReadError('changed');
    reports = parse(z.array(reviewReportSchema), reportResult.data);
    versions = parse(z.array(originalVersionSchema), versionResult.data);
    candidates = parse(z.array(candidateSchema), candidateResult.data);
    attachments = parse(z.array(reviewAttachmentSchema), attachmentResult.data);
    snapshot = parse(reviewSnapshotSchema, snapshotResult.data);
    unique(reports, (report) => report.id);
    unique(versions, (version) => version.report_id);
    unique(attachments, (attachment) => attachment.id);
    unique(
      candidates,
      (candidate) => `${candidate.claim_id}:${candidate.rank}`,
    );
    if (
      reports.length !== reportIds.length ||
      versions.length !== reportIds.length ||
      candidates.length !== candidateResult.count ||
      attachments.length !== attachmentResult.count ||
      snapshot.projectId !== project.id ||
      reports.some((report) => report.project_id !== project.id) ||
      versions.some((version) => !reportIds.includes(version.report_id)) ||
      attachments.some(
        (attachment) =>
          attachment.project_id !== project.id ||
          !reportIds.includes(attachment.report_id),
      ) ||
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

    const attachmentsById = new Map(
      attachments.map((attachment) => [attachment.id, attachment]),
    );
    for (const version of versions) {
      for (const media of readMediaContext(version.context)) {
        const attachment = attachmentsById.get(media.attachmentId);
        if (
          !attachment ||
          attachment.report_id !== version.report_id ||
          attachment.sha256 !== media.sha256 ||
          attachment.media_kind !== media.kind ||
          attachment.language !== media.language ||
          attachment.caption !== (media.caption ?? '')
        )
          throw new ReviewReadError('changed');
      }
    }

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

  await recheckManagerAccess(client, context, signal);

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
  const attachmentsByReport = new Map<string, typeof attachments>();
  for (const attachment of attachments) {
    const current = attachmentsByReport.get(attachment.report_id) ?? [];
    current.push(attachment);
    attachmentsByReport.set(attachment.report_id, current);
  }
  const mediaByReport = new Map(
    versions.map((version) => [
      version.report_id,
      readMediaContext(version.context),
    ]),
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
      attachments: (attachmentsByReport.get(claim.report_id) ?? []).map(
        (attachment) => ({
          id: attachment.id,
          project_id: attachment.project_id,
          report_id: attachment.report_id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          byte_size: attachment.byte_size,
          sha256: attachment.sha256,
          caption: attachment.caption,
          media_kind: attachment.media_kind,
          language: attachment.language,
        }),
      ),
      media: mediaByReport.get(claim.report_id) ?? [],
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

export async function createReviewEvidenceUrl(
  client: Client,
  context: ProjectContext,
  reportId: string,
  attachmentId: string,
  signal: AbortSignal,
) {
  await recheckManagerAccess(client, context, signal);
  const result = await client
    .from('attachments')
    .select('id,project_id,report_id,object_path,state')
    .eq('id', attachmentId)
    .eq('project_id', context.project.id)
    .eq('report_id', reportId)
    .eq('state', 'received')
    .abortSignal(signal)
    .maybeSingle();
  readError(result.error);
  if (!result.data) {
    await recheckManagerAccess(client, context, signal);
    throw new ReviewReadError('changed');
  }
  const attachment = parse(attachmentPathSchema, result.data);
  if (
    attachment.id !== attachmentId ||
    attachment.project_id !== context.project.id ||
    attachment.report_id !== reportId
  )
    throw new ReviewReadError('changed');
  const signed = await client.storage
    .from('evidence')
    .createSignedUrl(attachment.object_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    await recheckManagerAccess(client, context, signal);
    throw new ReviewReadError('unavailable');
  }
  await recheckManagerAccess(client, context, signal);
  return signed.data.signedUrl;
}
