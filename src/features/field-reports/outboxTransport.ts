import { createClient } from '@supabase/supabase-js';

import { withTimeout } from '@/lib/request';
import { getSupabase, getSupabaseConnection } from '@/lib/supabase';

import { OutboxSyncError } from './outbox';

import type {
  CaptureFile,
  OutboxRecord,
  OutboxTransport,
  RemoteMediaState,
} from './outbox';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type ApiError = {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: number | string;
  name?: string;
  error?: string;
};

function status(error: ApiError) {
  const value = error.status ?? Number(error.statusCode);
  return Number.isFinite(value) ? value : undefined;
}

function transportError(error: unknown, fallback: string): OutboxSyncError {
  if (error instanceof OutboxSyncError) return error;
  const detail = (error ?? {}) as ApiError;
  const message = detail.message || detail.error || fallback;
  const http = status(detail);
  if (
    http === 401 ||
    detail.code === 'PGRST301' ||
    /jwt|session|token/i.test(message)
  )
    return new OutboxSyncError(
      'Your session expired. Sign in again.',
      'auth',
      false,
    );
  if (http === 403 || detail.code === '42501')
    return new OutboxSyncError(
      'Project access changed. Sync is paused for this report.',
      'access',
      false,
    );
  if (
    error instanceof TypeError ||
    /network|fetch|timeout|offline/i.test(message)
  )
    return new OutboxSyncError(
      'Connection interrupted. The saved report will retry.',
      'network',
      true,
    );
  return new OutboxSyncError(message || fallback, 'server', true);
}

function duplicateUpload(error: unknown) {
  const detail = (error ?? {}) as ApiError;
  return (
    status(detail) === 409 ||
    detail.name === 'Duplicate' ||
    detail.error === 'Duplicate' ||
    /already exists|duplicate/i.test(detail.message ?? '')
  );
}

export class SupabaseOutboxTransport implements OutboxTransport {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async ensureAccess(record: OutboxRecord) {
    const result = await this.client
      .from('project_members')
      .select('project_id,user_id,active')
      .eq('project_id', record.projectId)
      .eq('user_id', record.userId)
      .eq('active', true)
      .maybeSingle();
    if (result.error)
      throw transportError(result.error, 'Could not verify access.');
    if (!result.data)
      throw new OutboxSyncError(
        'Project access changed. Sync is paused for this report.',
        'access',
        false,
      );
  }

  async reserve(record: OutboxRecord) {
    const result = await this.client.rpc('reserve_field_capture', {
      p_project: record.projectId,
      p_capture: record.captureId,
      p_files: record.manifest.files,
      p_language: record.manifest.language,
    });
    if (result.error)
      throw transportError(result.error, 'Could not reserve this report.');
    if (typeof result.data !== 'string')
      throw new OutboxSyncError(
        'The server returned an invalid report identifier.',
        'server',
        true,
      );
    return result.data;
  }

  async upload(path: string, file: CaptureFile, bytes: Uint8Array) {
    const body = Uint8Array.from(bytes).buffer;
    const result = await this.client.storage
      .from('evidence')
      .upload(path, body, {
        contentType: file.mime,
        cacheControl: '3600',
        upsert: false,
      });
    if (result.error && !duplicateUpload(result.error))
      throw transportError(result.error, 'Could not upload saved evidence.');
  }

  async finalize(reportId: string) {
    const result = await this.client.rpc('finalize_field_media', {
      p_report: reportId,
    });
    if (result.error)
      throw transportError(result.error, 'Could not finalize saved evidence.');
  }

  async inspect(reportId: string): Promise<RemoteMediaState> {
    const attachments = await this.client
      .from('attachments')
      .select('id,state')
      .eq('report_id', reportId);
    if (attachments.error)
      throw transportError(
        attachments.error,
        'Could not check media processing.',
      );
    const rows = attachments.data ?? [];
    if (!rows.length) return { status: 'ready' };
    const ids = rows.map((row) => row.id);
    const [jobs, results] = await Promise.all([
      this.client
        .from('media_jobs')
        .select('attachment_id,status,attempts,error_code')
        .in('attachment_id', ids),
      this.client
        .from('media_results')
        .select('attachment_id')
        .in('attachment_id', ids),
    ]);
    if (jobs.error)
      throw transportError(jobs.error, 'Could not check media processing.');
    if (results.error)
      throw transportError(results.error, 'Could not check verified media.');
    const completed = new Set(
      (results.data ?? []).map((row) => row.attachment_id),
    );
    if (rows.every((row) => row.state === 'received' && completed.has(row.id)))
      return { status: 'ready' };
    const failed = (jobs.data ?? []).filter((job) => job.status === 'failed');
    if (failed.some((job) => job.attempts >= 3))
      return {
        status: 'failed',
        message:
          failed.find((job) => job.attempts >= 3)?.error_code ||
          'Media processing could not be completed.',
      };
    if (failed.length)
      return {
        status: 'retryable',
        message:
          failed[0]?.error_code || 'Media processing needs another attempt.',
      };
    return { status: 'processing' };
  }
}

export function createAccountOutboxTransport(
  userId: string,
  connection: { url: string; key: string },
  authClient: SupabaseClient<Database>,
  fetcher: typeof fetch = fetch,
) {
  // Each request obtains a token only for this outbox owner. The request keeps
  // that token even if the shared auth client changes accounts before fetch.
  const client = createClient<Database>(connection.url, connection.key, {
    accessToken: async () => {
      const { data, error } = await authClient.auth.getSession();
      if (error || data.session?.user.id !== userId)
        throw new OutboxSyncError(
          'The current session does not belong to the account that saved this report. Sign in again.',
          'auth',
          false,
        );
      return data.session.access_token;
    },
    global: { fetch: withTimeout(fetcher) },
  });
  return new SupabaseOutboxTransport(client);
}

export function getOutboxTransport(userId: string): OutboxTransport {
  const authClient = getSupabase();
  const connection = getSupabaseConnection();
  if (!authClient || !connection)
    throw new OutboxSyncError(
      'Production backend configuration is unavailable.',
      'server',
      false,
    );
  return createAccountOutboxTransport(userId, connection, authClient);
}
