import { SubmissionRejectedError } from './outbox';
import { OutboxService } from './outboxService';
import {
  createAccountOutboxTransport,
  SupabaseOutboxTransport,
} from './outboxTransport';

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
    confirmedActivityLabel: null,
    submissionRejected: false,
    submissionState: 'unconfirmed',
    submittedAt: null,
    evidenceReleased: false,
    state: 'queued',
    attemptCount: 0,
    lastErrorKind: null,
    lastError: null,
    retryable: true,
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

it.each([
  ['42501', 'Activity access denied', true],
  ['42501', 'Author required', false],
  ['42501', 'Access changed', false],
  ['40001', 'CAPTURE_ID_REUSED', false],
  ['22023', 'Invalid capture submission', false],
] as const)(
  'classifies %s/%s as safely editable only for a definite activity rejection',
  async (code, message, rejected) => {
    const transport = new SupabaseOutboxTransport({
      rpc: async () => ({ data: null, error: { code, message } }),
    } as unknown as SupabaseClient<Database>);
    try {
      await transport.submit('report', {
        text: 'Work completed',
        workDate: null,
        activityId: null,
      });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error instanceof SubmissionRejectedError).toBe(rejected);
      expect(error).toHaveProperty('kind');
    }
  },
);

it.each(['membership', 'reservation'] as const)(
  'pauses when accounts change after %s without sending another account token',
  async (phase) => {
    const draft = record();
    draft.manifest.files = [
      {
        id: '40000000-0000-4000-8000-000000000004',
        name: 'voice.wav',
        kind: 'audio',
        mime: 'audio/wav',
        bytes: 3,
        sha256: 'a'.repeat(64),
        caption: '',
      },
    ];
    let owner = draft.userId;
    const requests: { path: string; authorization: string | null }[] = [];
    const authClient = {
      auth: {
        getSession: async () => ({
          data: {
            session: {
              user: { id: owner },
              access_token:
                owner === draft.userId ? 'alice-token' : 'bob-token',
            },
          },
          error: null,
        }),
      },
    } as unknown as SupabaseClient<Database>;
    const transport = createAccountOutboxTransport(
      draft.userId,
      {
        url: 'https://example.supabase.co',
        key: 'synthetic-public-key',
      },
      authClient,
      async (input, init) => {
        const path = new URL(String(input)).pathname;
        requests.push({
          path,
          authorization: new Headers(init?.headers).get('authorization'),
        });
        const data = path.endsWith('/project_members')
          ? [
              {
                project_id: draft.projectId,
                user_id: draft.userId,
                active: true,
              },
            ]
          : '50000000-0000-4000-8000-000000000005';
        if (
          (phase === 'membership' && path.endsWith('/project_members')) ||
          (phase === 'reservation' && path.endsWith('/reserve_field_capture'))
        )
          owner = 'bob';
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
    let stored: OutboxRecord | null = null;
    const service = new OutboxService(
      {
        get: async () => stored,
        list: async () => (stored ? [stored] : []),
        put: async (row) => {
          stored = row;
        },
      },
      { read: async () => new Uint8Array([1, 2, 3]) },
      () => transport,
      async () => 'a'.repeat(64),
    );
    await service.enqueue(draft);
    const result = await service.sync(draft.userId, draft.captureId);
    expect(result).toMatchObject({
      state: 'paused',
      lastErrorKind: 'auth',
      userId: draft.userId,
    });
    expect(requests).toHaveLength(phase === 'membership' ? 1 : 2);
    expect(
      requests.every(
        (request) => request.authorization === 'Bearer alice-token',
      ),
    ).toBe(true);
  },
);
