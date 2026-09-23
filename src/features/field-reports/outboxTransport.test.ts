import { SupabaseOutboxTransport } from './outboxTransport';

import type { OutboxRecord } from './outbox';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Result = { data: unknown; error: unknown };

function chain(result: Result) {
  const value = {
    select: () => value,
    eq: () => value,
    in: () => value,
    maybeSingle: async () => result,
    then: (resolve: (result: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return value;
}

function record(): OutboxRecord {
  return {
    captureId: '10000000-0000-4000-8000-000000000001',
    userId: '20000000-0000-4000-8000-000000000002',
    projectId: '30000000-0000-4000-8000-000000000003',
    projectName: 'Site project',
    kind: 'voice',
    createdAt: '2026-09-24T00:00:00Z',
    text: '',
    manifest: {
      captureId: '10000000-0000-4000-8000-000000000001',
      language: 'auto',
      files: [],
    },
    reportId: null,
    uploadedFiles: [],
    originalTranscript: null,
    confirmedPayload: null,
    submissionState: 'unconfirmed',
    submittedAt: null,
    evidenceReleased: false,
    state: 'queued',
    attemptCount: 0,
    lastErrorKind: null,
    lastError: null,
    updatedAt: '2026-09-24T00:00:00Z',
  };
}

it('treats a duplicate immutable upload as a safe lost-response retry', async () => {
  const upload = jest.fn(async () => ({
    data: null,
    error: { statusCode: '409', error: 'Duplicate', message: 'already exists' },
  }));
  const client = {
    storage: { from: () => ({ upload }) },
  } as unknown as SupabaseClient<Database>;
  const transport = new SupabaseOutboxTransport(client);
  await expect(
    transport.upload(
      'project/report/file',
      {
        id: '40000000-0000-4000-8000-000000000004',
        name: 'voice.wav',
        kind: 'audio',
        mime: 'audio/wav',
        bytes: 3,
        sha256: 'a'.repeat(64),
        caption: '',
      },
      new Uint8Array([1, 2, 3]),
    ),
  ).resolves.toBeUndefined();
  expect(upload).toHaveBeenCalledWith(
    'project/report/file',
    expect.any(ArrayBuffer),
    expect.objectContaining({ contentType: 'audio/wav', upsert: false }),
  );
});

it('requires current membership and distinguishes ready, retryable and terminal media', async () => {
  const results = new Map<string, Result>([
    ['project_members', { data: { project_id: 'project' }, error: null }],
    [
      'attachments',
      {
        data: [{ id: 'attachment', state: 'reserved', media_kind: 'audio' }],
        error: null,
      },
    ],
    [
      'media_jobs',
      {
        data: [
          {
            attachment_id: 'attachment',
            status: 'failed',
            attempts: 2,
            error_code: 'worker_timeout',
          },
        ],
        error: null,
      },
    ],
    ['media_results', { data: [], error: null }],
  ]);
  const client = {
    from: (table: string) => chain(results.get(table)!),
  } as unknown as SupabaseClient<Database>;
  const transport = new SupabaseOutboxTransport(client);
  await expect(transport.ensureAccess(record())).resolves.toBeUndefined();
  await expect(transport.inspect('report')).resolves.toEqual({
    status: 'retryable',
    message: 'worker_timeout',
  });
  results.set('media_jobs', {
    data: [
      {
        attachment_id: 'attachment',
        status: 'failed',
        attempts: 3,
        error_code: 'media_retry_limit',
      },
    ],
    error: null,
  });
  await expect(transport.inspect('report')).resolves.toEqual({
    status: 'failed',
    message: 'media_retry_limit',
  });
  results.set('attachments', {
    data: [{ id: 'attachment', state: 'received', media_kind: 'audio' }],
    error: null,
  });
  results.set('media_results', {
    data: [
      {
        attachment_id: 'attachment',
        original_transcript: 'Two of eight complete.',
      },
    ],
    error: null,
  });
  await expect(transport.inspect('report')).resolves.toEqual({
    status: 'ready',
    originalTranscript: 'Two of eight complete.',
  });
});

it('submits the locked payload through the existing production RPC', async () => {
  const rpc = jest.fn(async () => ({ data: 'report-id', error: null }));
  const transport = new SupabaseOutboxTransport({
    rpc,
  } as unknown as SupabaseClient<Database>);
  await expect(
    transport.submit('report-id', {
      text: 'Two of eight complete; six remain unfinished.',
      workDate: '2026-09-24',
      activityId: '40000000-0000-4000-8000-000000000004',
    }),
  ).resolves.toBe('report-id');
  expect(rpc).toHaveBeenCalledWith('submit_field_capture', {
    p_report: 'report-id',
    p_text: 'Two of eight complete; six remain unfinished.',
    p_work_date: '2026-09-24',
    p_activity: '40000000-0000-4000-8000-000000000004',
  });
});
