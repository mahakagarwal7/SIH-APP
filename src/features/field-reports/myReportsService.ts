import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

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
  lifecycle: z.enum(['draft', 'submitted', 'withdrawn']),
  received_at: z.string(),
  source_kind: z.enum(['text', 'voice', 'spreadsheet']),
});
const claimSchema = z.object({
  report_id: z.string().uuid(),
  state: z.enum([
    'pending',
    'clarification',
    'verification',
    'disputed',
    'accepted',
    'rejected',
    'unplanned',
    'superseded',
    'withdrawn',
  ]),
});

export type RemoteReport = z.infer<typeof reportSchema> & {
  claims: z.infer<typeof claimSchema>[];
};

export type MyReportItem = {
  captureId: string;
  reportId: string | null;
  projectId: string;
  projectName: string;
  createdAt: string;
  kind: 'voice' | 'report' | 'remote';
  summary: string;
  mediaCount: number;
  status: string;
  detail: string;
  canSync: boolean;
  canConfirm: boolean;
};

export class ReportsReadError extends Error {
  constructor() {
    super('Could not refresh reports. Saved device copies are unchanged.');
  }
}

function outboxStatus(record: OutboxRecord) {
  if (record.submissionState === 'submitted')
    return ['Awaiting review', 'Submitted to the production project.'] as const;
  if (record.submissionState === 'pending')
    return [
      'Sending for review',
      'Confirmed wording is locked until the server receipt is verified.',
    ] as const;
  switch (record.state) {
    case 'queued':
    case 'reserving':
    case 'uploading':
    case 'finalizing':
      return ['Syncing', 'Keep the app open while evidence uploads.'] as const;
    case 'processing':
      return [
        'Processing evidence',
        'Voice transcription or photo validation is in progress.',
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

function submittedStatus(report: RemoteReport) {
  if (report.lifecycle === 'withdrawn') return 'Withdrawn';
  if (report.lifecycle === 'draft') return 'Server draft';
  const claims = report.claims.filter((claim) => claim.state !== 'superseded');
  if (!claims.length) return 'Awaiting review';
  if (claims.every((claim) => claim.state === 'accepted')) return 'Accepted';
  if (claims.some((claim) => claim.state === 'accepted'))
    return 'Partly accepted';
  if (claims.some((claim) => claim.state === 'clarification'))
    return 'Answer needed';
  if (claims.some((claim) => claim.state === 'verification'))
    return 'Supervisor check';
  if (claims.some((claim) => claim.state === 'disputed'))
    return 'Needs planner attention';
  if (claims.every((claim) => claim.state === 'rejected')) return 'Rejected';
  if (claims.every((claim) => claim.state === 'unplanned'))
    return 'Kept as unplanned';
  return 'Awaiting review';
}

export async function loadRemoteReports(
  client: SupabaseClient<Database>,
  userId: string,
  signal?: AbortSignal,
): Promise<RemoteReport[]> {
  let reportsQuery = client
    .from('reports')
    .select(
      'id,project_id,author_id,capture_id,lifecycle,received_at,source_kind',
    )
    .eq('author_id', userId)
    .order('received_at', { ascending: false })
    .limit(100);
  if (signal) reportsQuery = reportsQuery.abortSignal(signal);
  const reports = await reportsQuery;
  if (reports.error) throw new ReportsReadError();
  const parsed = z.array(reportSchema).safeParse(reports.data);
  if (!parsed.success || parsed.data.some((row) => row.author_id !== userId))
    throw new ReportsReadError();
  if (!parsed.data.length) return [];
  const ids = parsed.data.map((report) => report.id);
  let claimsQuery = client
    .from('claims')
    .select('report_id,state')
    .in('report_id', ids)
    .limit(2000);
  if (signal) claimsQuery = claimsQuery.abortSignal(signal);
  const claims = await claimsQuery;
  if (claims.error) throw new ReportsReadError();
  const parsedClaims = z.array(claimSchema).safeParse(claims.data);
  if (!parsedClaims.success) throw new ReportsReadError();
  return parsed.data.map((report) => ({
    ...report,
    claims: parsedClaims.data.filter((claim) => claim.report_id === report.id),
  }));
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
  const items: MyReportItem[] = [];
  for (const row of outbox) {
    const server = remoteByCapture.get(row.captureId);
    const [status, detail] =
      server && server.lifecycle !== 'draft'
        ? [
            submittedStatus(server),
            server.lifecycle === 'withdrawn'
              ? 'Withdrawn from the production project.'
              : 'Submitted to the production project.',
          ]
        : outboxStatus(row);
    items.push({
      captureId: row.captureId,
      reportId: server?.id ?? row.reportId,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: row.kind,
      summary: (row.confirmedPayload?.text ?? row.text).trim(),
      mediaCount: row.manifest.files.length,
      status,
      detail,
      canSync:
        row.submissionState === 'pending' ||
        (row.submissionState === 'unconfirmed' &&
          (row.state === 'paused' || row.state === 'failed')),
      canConfirm:
        (!server || server.lifecycle === 'draft') &&
        row.state === 'needs_confirmation' &&
        row.submissionState === 'unconfirmed' &&
        (row.kind !== 'voice' || !!row.originalTranscript),
    });
    remoteByCapture.delete(row.captureId);
  }
  for (const row of voice) {
    if (outboxByCapture.has(row.id)) continue;
    items.push({
      captureId: row.id,
      reportId: null,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: 'voice',
      summary: '',
      mediaCount: 1,
      status: row.available ? 'Saved on device' : 'Local draft incomplete',
      detail: row.available
        ? 'Waiting to sync.'
        : 'Recording bytes are missing or incomplete.',
      canSync: row.available,
      canConfirm: false,
    });
  }
  for (const row of reports) {
    if (outboxByCapture.has(row.id)) continue;
    items.push({
      captureId: row.id,
      reportId: null,
      projectId: row.projectId,
      projectName: row.projectName,
      createdAt: row.createdAt,
      kind: 'report',
      summary: row.text.trim(),
      mediaCount: row.photos.length,
      status: row.available ? 'Saved on device' : 'Local draft incomplete',
      detail: row.available
        ? 'Waiting to sync.'
        : 'One or more saved photos are missing.',
      canSync: row.available,
      canConfirm: false,
    });
  }
  for (const row of remoteByCapture.values())
    items.push({
      captureId: row.capture_id,
      reportId: row.id,
      projectId: row.project_id,
      projectName: 'Production project',
      createdAt: row.received_at,
      kind: 'remote',
      summary: '',
      mediaCount: 0,
      status: submittedStatus(row),
      detail:
        row.lifecycle === 'draft'
          ? 'Media may still be processing; continue on the device that created it.'
          : 'Submitted to the production project.',
      canSync: false,
      canConfirm: false,
    });
  return items.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.captureId.localeCompare(left.captureId),
  );
}
