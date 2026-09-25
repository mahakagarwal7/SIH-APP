import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

import {
  getReportEvidenceState,
  initialConfirmationText,
  reportEvidenceLabel,
} from './reportEvidence';
import { reportDeliveryStatus } from './reportStatus';

import type { LocalVoiceDraft } from './draftStore';
import type { OutboxRecord } from './outbox';
import type { LocalReportDraft } from './reportDraftStore';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const reportSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  author_id: z.string().uuid(),
  capture_id: z.string().uuid(),
  current_version: z.number().int().nonnegative(),
  lifecycle: z.enum(['draft', 'submitted', 'withdrawn']),
  received_at: z.string(),
  source_kind: z.enum(['text', 'voice', 'spreadsheet']),
  projects: z.object({ name: z.string() }).nullable().optional(),
  report_versions: z
    .array(z.object({ version: z.number().int(), source_text: z.string() }))
    .optional(),
});
const claimSchema = z.object({
  id: z.string().uuid(),
  report_id: z.string().uuid(),
  report_version: z.number().int().positive(),
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
});
const jobSchema = z.object({
  id: z.string().uuid(),
  report_id: z.string().uuid(),
  report_version: z.number().int().positive(),
  status: z.enum(['queued', 'running', 'retry_wait', 'succeeded', 'failed']),
  attempts: z.number().int().nonnegative(),
  error_code: z.string().nullable(),
  claim_count: z.number().int().min(0).max(100).nullable(),
  created_at: z.string(),
});
const PAGE_SIZE = 200;
const MAX_STATUS_ROWS = 10_000;

export type RemoteReport = z.infer<typeof reportSchema> & {
  claims: z.infer<typeof claimSchema>[];
  jobs: z.infer<typeof jobSchema>[];
};

export type MyReportItem = {
  captureId: string;
  reportId: string | null;
  projectId: string;
  projectName: string;
  createdAt: string;
  kind: 'voice' | 'report' | 'remote';
  evidenceLabel: string;
  summary: string;
  mediaCount: number | null;
  status: string;
  detail: string;
  canSync: boolean;
  canConfirm: boolean;
  canOpenConfirmation: boolean;
  canOpen: boolean;
};

export class ReportsReadError extends Error {
  constructor() {
    super('Could not refresh reports. Saved device copies are unchanged.');
  }
}

export function outboxStatus(record: OutboxRecord) {
  if (record.cancelRequested)
    return [
      'Canceling report',
      record.lastError ||
        'Server cleanup will retry before local evidence is removed.',
    ] as const;
  if (record.submissionState === 'submitted')
    return [
      'Awaiting review',
      record.lastError || 'Submitted to the production project.',
    ] as const;
  if (record.submissionRejected)
    return [
      'Check report',
      record.lastError || 'Check the report before confirming again.',
    ] as const;
  if (
    record.sendRequested &&
    record.state !== 'failed' &&
    record.state !== 'paused'
  )
    return [
      'Sending for review',
      'The report will submit after its verified transcript is ready.',
    ] as const;
  if (
    record.submissionState === 'pending' &&
    record.state !== 'paused' &&
    record.state !== 'failed'
  )
    return [
      'Sending for review',
      'Confirmed wording is locked until the server receipt is verified.',
    ] as const;
  switch (record.state) {
    case 'queued':
    case 'reserving':
    case 'uploading':
    case 'finalizing':
      return [
        'Uploading',
        'Saved on device. Upload continues in the background and resumes after reconnecting.',
      ] as const;
    case 'processing':
      return [
        'Processing evidence',
        'Uploaded. Waiting for the server to finish transcription or photo validation.',
      ] as const;
    case 'needs_confirmation':
      return [
        'Needs confirmation',
        'Review the transcript or wording before sending.',
      ] as const;
    case 'paused':
      return [
        'Sync paused',
        record.lastError || 'Sign in and check project access.',
      ] as const;
    case 'failed':
      return [
        'Sync needs attention',
        record.lastError || 'Retry when connected.',
      ] as const;
  }
}

async function readCompleteRows<Row extends { id: string }>(
  loadPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: unknown;
    error: { code?: string } | null;
    count: number | null;
  }>,
  schema: z.ZodType<Row>,
  belongsToReports: (row: Row) => boolean,
): Promise<Row[]> {
  const rows: Row[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  let from = 0;

  while (from < MAX_STATUS_ROWS) {
    const response = await loadPage(from, from + PAGE_SIZE - 1);
    if (response.error) throw new ReportsReadError();
    if (
      response.count === null ||
      !Number.isSafeInteger(response.count) ||
      response.count > MAX_STATUS_ROWS ||
      (expected !== undefined && expected !== response.count)
    )
      throw new ReportsReadError();

    const page = z.array(schema).safeParse(response.data);
    if (
      !page.success ||
      page.data.some((row) => !belongsToReports(row) || ids.has(row.id))
    )
      throw new ReportsReadError();

    page.data.forEach((row) => ids.add(row.id));
    rows.push(...page.data);
    if (rows.length > response.count) throw new ReportsReadError();
    if (rows.length === response.count) return rows;
    if (!page.data.length) throw new ReportsReadError();

    expected = response.count;
    from += page.data.length;
  }

  throw new ReportsReadError();
}

export async function loadRemoteReports(
  client: SupabaseClient<Database>,
  userId: string,
  signal?: AbortSignal,
  projectId?: string,
): Promise<RemoteReport[]> {
  let reportsQuery = client
    .from('reports')
    .select(
      'id,project_id,author_id,capture_id,current_version,lifecycle,received_at,source_kind,projects(name),report_versions(version,source_text)',
    )
    .eq('author_id', userId)
    .order('received_at', { ascending: false })
    .limit(100);
  if (projectId) reportsQuery = reportsQuery.eq('project_id', projectId);
  if (signal) reportsQuery = reportsQuery.abortSignal(signal);
  const reports = await reportsQuery;
  if (reports.error) throw new ReportsReadError();
  const parsed = z.array(reportSchema).safeParse(reports.data);
  if (
    !parsed.success ||
    parsed.data.some(
      (row) =>
        row.author_id !== userId ||
        (projectId !== undefined && row.project_id !== projectId),
    )
  )
    throw new ReportsReadError();
  if (!parsed.data.length) return [];
  const ids = parsed.data.map((report) => report.id);
  const [claims, jobs] = await Promise.all([
    readCompleteRows(
      async (from, to) => {
        let query = client
          .from('claims')
          .select('id,report_id,report_version,state', { count: 'exact' })
          .in('report_id', ids)
          .neq('state', 'superseded')
          .order('report_id')
          .order('id')
          .range(from, to);
        if (signal) query = query.abortSignal(signal);
        return query;
      },
      claimSchema,
      (claim) => ids.includes(claim.report_id),
    ),
    readCompleteRows(
      async (from, to) => {
        let query = client
          .from('jobs')
          .select(
            'id,report_id,report_version,status,attempts,error_code,claim_count,created_at',
            { count: 'exact' },
          )
          .in('report_id', ids)
          .order('report_id')
          .order('report_version', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to);
        if (signal) query = query.abortSignal(signal);
        return query;
      },
      jobSchema,
      (job) => ids.includes(job.report_id),
    ),
  ]);
  return parsed.data.map((report) => ({
    ...report,
    claims: claims.filter((claim) => claim.report_id === report.id),
    jobs: jobs.filter((job) => job.report_id === report.id),
  }));
}

export function loadRemoteReportsForProject(
  client: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  signal?: AbortSignal,
) {
  return loadRemoteReports(client, userId, signal, projectId);
}

export function getReportsClient() {
  const client = getSupabase();
  if (!client) throw new ReportsReadError();
  return client;
}

export function mergeMyReports(
  voice: LocalVoiceDraft[],
  reports: LocalReportDraft[],
  outbox: OutboxRecord[],
  remote: RemoteReport[],
): MyReportItem[] {
  const remoteByCapture = new Map(remote.map((row) => [row.capture_id, row]));
  const outboxByCapture = new Map(outbox.map((row) => [row.captureId, row]));
  const voiceIds = new Set(voice.map((row) => row.id));
  const reportByCapture = new Map(reports.map((row) => [row.id, row]));
  const items: MyReportItem[] = [];
  for (const row of outbox) {
    const server = remoteByCapture.get(row.captureId);
    const serverStatus =
      server && server.lifecycle !== 'draft'
        ? reportDeliveryStatus(server)
        : null;
    const [status, detail] = serverStatus
      ? [serverStatus.status, serverStatus.detail]
      : outboxStatus(row);
    const evidence = getReportEvidenceState(row);
    const confirmationReady =
      evidence.canSubmit &&
      ((row.manifest.files.length === 0 && !row.reportId) ||
        row.state === 'needs_confirmation');
    items.push({
      captureId: row.captureId,
      reportId: server?.id ?? row.reportId,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: row.kind,
      evidenceLabel: reportEvidenceLabel(evidence),
      summary: (
        row.confirmedPayload?.text ?? initialConfirmationText(row)
      ).trim(),
      mediaCount: row.manifest.files.length,
      status,
      detail,
      canSync:
        !row.submissionRejected &&
        (row.submissionState === 'submitted'
          ? !row.evidenceReleased
          : row.state === 'paused' ||
            (row.state === 'failed' &&
              (row.retryable || row.lastErrorKind === 'local')) ||
            (row.submissionState === 'pending' && row.state !== 'failed')),
      canConfirm:
        (!server || server.lifecycle === 'draft') &&
        (row.submissionRejected ||
          (row.submissionState === 'unconfirmed' && confirmationReady)),
      canOpenConfirmation:
        !!row.confirmedPayload ||
        ((!server || server.lifecycle === 'draft') && confirmationReady),
      canOpen: server?.lifecycle === 'submitted',
    });
    remoteByCapture.delete(row.captureId);
  }
  for (const row of voice) {
    if (outboxByCapture.has(row.id)) continue;
    const companion = reportByCapture.get(row.id);
    items.push({
      captureId: row.id,
      reportId: null,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: 'voice',
      evidenceLabel: reportEvidenceLabel({
        hasVoice: true,
        hasText: !!companion?.text.trim(),
        hasPhoto: !!companion?.photos.length,
      }),
      summary: companion?.text.trim() ?? '',
      mediaCount: 1 + (companion?.photos.length ?? 0),
      status: row.available ? 'Saved on device' : 'Local draft incomplete',
      detail: row.available
        ? 'Waiting to sync.'
        : 'Recording bytes are missing or incomplete.',
      canSync: row.available,
      canConfirm: false,
      canOpenConfirmation: false,
      canOpen: false,
    });
  }
  for (const row of reports) {
    if (outboxByCapture.has(row.id) || voiceIds.has(row.id)) continue;
    items.push({
      captureId: row.id,
      reportId: null,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: 'report',
      evidenceLabel: reportEvidenceLabel({
        hasVoice: false,
        hasText: row.text.trim().length > 0,
        hasPhoto: row.photos.length > 0,
      }),
      summary: row.text.trim(),
      mediaCount: row.photos.length,
      status: row.available ? 'Saved on device' : 'Local draft incomplete',
      detail: row.available
        ? 'Waiting to sync.'
        : 'One or more saved photos are missing.',
      canSync: row.available,
      canConfirm: false,
      canOpenConfirmation: false,
      canOpen: false,
    });
  }
  // Local stores can be read independently of the outbox. Coalesce their
  // evidence with the server receipt even if the outbox is unavailable.
  for (const item of items) {
    const server = remoteByCapture.get(item.captureId);
    if (!server) continue;
    item.reportId = server.id;
    if (server.lifecycle !== 'draft') {
      const delivery = reportDeliveryStatus(server);
      item.status = delivery.status;
      item.detail = delivery.detail;
      item.canSync = false;
      item.canConfirm = false;
      item.canOpen = server.lifecycle === 'submitted';
    }
    remoteByCapture.delete(item.captureId);
  }
  for (const row of remoteByCapture.values()) {
    const delivery = reportDeliveryStatus(row);
    items.push({
      captureId: row.capture_id,
      reportId: row.id,
      projectId: row.project_id,
      projectName: row.projects?.name ?? 'Project report',
      createdAt: row.received_at,
      kind: 'remote',
      evidenceLabel:
        row.source_kind === 'voice'
          ? 'Voice'
          : row.source_kind === 'text'
            ? 'Text'
            : 'Imported report',
      summary:
        row.report_versions
          ?.find((version) => version.version === row.current_version)
          ?.source_text.trim() ?? '',
      mediaCount: null,
      status: delivery.status,
      detail: delivery.detail,
      canSync: false,
      canConfirm: false,
      canOpenConfirmation: false,
      canOpen: row.lifecycle === 'submitted',
    });
  }
  return items.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.captureId.localeCompare(left.captureId),
  );
}
