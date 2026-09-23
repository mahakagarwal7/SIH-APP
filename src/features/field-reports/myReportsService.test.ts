import { createClient } from '@supabase/supabase-js';

import { loadRemoteReports, mergeMyReports } from './myReportsService';

import type { OutboxRecord } from './outbox';
import type { Database } from '@/types/database';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000002';
const captureId = '30000000-0000-4000-8000-000000000003';
const reportId = '40000000-0000-4000-8000-000000000004';

const outbox: OutboxRecord = {
  captureId,
  userId,
  projectId,
  projectName: 'Site project',
  kind: 'report',
  createdAt: '2026-09-24T00:00:00Z',
  text: 'Installed two supports',
  manifest: { captureId, language: 'auto', files: [] },
  reportId,
  uploadedFiles: [],
  state: 'needs_confirmation',
  attemptCount: 1,
  lastErrorKind: null,
  lastError: null,
  updatedAt: '2026-09-24T00:00:00Z',
};

const remote = {
  id: reportId,
  project_id: projectId,
  author_id: userId,
  capture_id: captureId,
  lifecycle: 'submitted' as const,
  received_at: '2026-09-24T00:01:00Z',
  source_kind: 'text' as const,
  claims: [{ report_id: reportId, state: 'accepted' as const }],
};

it('deduplicates local/outbox/server identity and prefers accepted server status', () => {
  const items = mergeMyReports([], [], [outbox], [remote]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    captureId,
    reportId,
    status: 'Accepted',
    summary: 'Installed two supports',
    canSync: false,
  });
});

it('does not call a reserved server draft ready before local media processing finishes', () => {
  const items = mergeMyReports(
    [],
    [],
    [{ ...outbox, state: 'processing' }],
    [{ ...remote, lifecycle: 'draft', claims: [] }],
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    status: 'Processing evidence',
    detail: 'Voice transcription or photo validation is in progress.',
  });
});

it('keeps saved, processing, paused and incomplete local states honest', () => {
  const items = mergeMyReports(
    [
      {
        id: 'local-voice',
        userId,
        projectId,
        projectName: 'Site project',
        createdAt: '2026-09-23T00:00:00Z',
        duration: 2,
        sampleRate: 16_000,
        byteLength: 3,
        state: 'saved',
        available: true,
      },
    ],
    [],
    [
      {
        ...outbox,
        captureId: 'paused-capture',
        manifest: { ...outbox.manifest, captureId: 'paused-capture' },
        state: 'paused',
        lastErrorKind: 'access',
        lastError: 'Project access changed.',
      },
    ],
    [],
  );
  expect(items.map((item) => item.status)).toEqual([
    'Sync paused',
    'Saved on device',
  ]);
  expect(items[0]?.detail).toBe('Project access changed.');
});

it('queries only the signed-in author and joins permitted claim statuses', async () => {
  const calls: URL[] = [];
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const data = url.pathname.endsWith('/reports')
      ? [{ ...remote, claims: undefined }]
      : remote.claims;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient<Database>(
    'https://example.supabase.co',
    'synthetic-public-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetcher },
    },
  );
  await expect(loadRemoteReports(client, userId)).resolves.toEqual([remote]);
  expect(calls[0]?.searchParams.get('author_id')).toBe(`eq.${userId}`);
  expect(calls[0]?.searchParams.get('limit')).toBe('100');
  expect(calls[1]?.searchParams.get('report_id')).toContain(reportId);
});

it('rejects server rows for another author instead of showing them', async () => {
  const client = createClient<Database>(
    'https://example.supabase.co',
    'synthetic-public-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async () =>
          new Response(
            JSON.stringify([
              { ...remote, author_id: projectId, claims: undefined },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      },
    },
  );
  await expect(loadRemoteReports(client, userId)).rejects.toThrow(
    'Could not refresh reports',
  );
});
