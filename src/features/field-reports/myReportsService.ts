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
    'observed',
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
  mediaCount: number | null;
  status: string;
  detail: string;
  canSync: boolean;
};

export class ReportsReadError extends Error {
  constructor() {
    super('Could not refresh reports. Saved device copies are unchanged.');
  }
}

function outboxStatus(record: OutboxRecord) {
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
  if (claims.every((claim) => claim.state === 'withdrawn')) return 'Withdrawn';
  if (claims.some((claim) => claim.state === 'disputed'))
    return 'Needs planner attention';
  if (claims.some((claim) => claim.state === 'clarification'))
    return 'Answer needed';
  if (claims.some((claim) => claim.state === 'verification'))
    return 'Supervisor check';
  if (claims.every((claim) => claim.state === 'accepted')) return 'Accepted';
  if (claims.some((claim) => claim.state === 'accepted'))
    return 'Partly accepted';
  if (claims.every((claim) => claim.state === 'observed'))
    return 'Observed — schedule unchanged';
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
  const claims = await loadClaims(client, ids, signal);
  return parsed.data.map((report) => ({
    ...report,
    claims: claims.filter((claim) => claim.report_id === report.id),
  }));
}

async function loadClaims(
  client: SupabaseClient<Database>,
  ids: string[],
  signal?: AbortSignal,
) {
  const rows: z.infer<typeof claimSchema>[] = [];
  const seen = new Set<string>();
  let expected: number | undefined;
  while (rows.length < 10000) {
    let query = client
      .from('claims')
      .select('id,report_id,state', { count: 'exact' })
      .in('report_id', ids)
      .order('id')
      .range(rows.length, rows.length + 199);
    if (signal) query = query.abortSignal(signal);
    const result = await query;
    if (
      result.error ||
      result.count === null ||
      result.count > 10000 ||
      (expected !== undefined && result.count !== expected)
    )
      throw new ReportsReadError();
    expected = result.count;
    const page = z
      .array(claimSchema.extend({ id: z.string().uuid() }))
      .safeParse(result.data);
    if (!page.success) throw new ReportsReadError();
    for (const row of page.data) {
      if (seen.has(row.id) || !ids.includes(row.report_id))
        throw new ReportsReadError();
      seen.add(row.id);
      rows.push({ report_id: row.report_id, state: row.state });
    }
    if (rows.length === expected) return rows;
    if (!page.data.length || rows.length > expected)
      throw new ReportsReadError();
  }
  throw new ReportsReadError();
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
      summary: row.text.trim(),
      mediaCount: row.manifest.files.length,
      status,
      detail,
      canSync:
        row.state === 'paused' ||
        (row.state === 'failed' &&
          (row.retryable || row.lastErrorKind === 'local')),
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
      mediaCount: null,
      status: submittedStatus(row),
      detail:
        row.lifecycle === 'draft'
          ? 'Media may still be processing; continue on the device that created it.'
          : 'Submitted to the production project.',
      canSync: false,
    });
  return items.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.captureId.localeCompare(left.captureId),
  );
}
