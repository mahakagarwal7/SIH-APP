import { createClient } from '@supabase/supabase-js';

import {
  loadRemoteReports,
  loadRemoteReportsForProject,
  mergeMyReports,
} from './myReportsService';
import { needsReportPolling } from './reportStatus';

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
  originalTranscript: null,
  confirmedPayload: null,
  confirmedActivityLabel: null,
  submissionRejected: false,
  submissionState: 'unconfirmed',
  submittedAt: null,
  evidenceReleased: false,
  state: 'needs_confirmation',
  attemptCount: 1,
  lastErrorKind: null,
  lastError: null,
  retryable: true,
  updatedAt: '2026-09-24T00:00:00Z',
};

const remote = {
  id: reportId,
  project_id: projectId,
  author_id: userId,
  capture_id: captureId,
  current_version: 1,
  lifecycle: 'submitted' as const,
  received_at: '2026-09-24T00:01:00Z',
  source_kind: 'text' as const,
  claims: [
    {
      id: '50000000-0000-4000-8000-000000000005',
      report_id: reportId,
      report_version: 1,
      state: 'accepted' as const,
    },
  ],
  jobs: [],
};

it('identifies remote reports using their project and current wording, never superseded wording', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [],
      [
        {
          ...remote,
          current_version: 2,
          projects: { name: 'Plant expansion' },
          report_versions: [
            { version: 1, source_text: 'Superseded wording' },
            { version: 2, source_text: '  Current verified wording  ' },
          ],
        },
      ],
    )[0],
  ).toMatchObject({
    projectName: 'Plant expansion',
    summary: 'Current verified wording',
  });
});

it('does not display an older version when the current wording is unavailable', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [],
      [
        {
          ...remote,
          current_version: 2,
          report_versions: [{ version: 1, source_text: 'Superseded wording' }],
        },
      ],
    )[0]?.summary,
  ).toBe('');
});

it('deduplicates local/outbox/server identity and prefers accepted server status', () => {
  const items = mergeMyReports([], [], [outbox], [remote]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    captureId,
    reportId,
    status: 'Accepted',
    summary: 'Installed two supports',
    canSync: false,
    canConfirm: false,
    canOpen: true,
  });
});

it.each(['draft', 'withdrawn'] as const)(
  'does not open a remote-only %s report that the detail loader rejects',
  (lifecycle) => {
    expect(
      mergeMyReports(
        [],
        [],
        [],
        [{ ...remote, lifecycle, claims: [], jobs: [] }],
      )[0],
    ).toMatchObject({ canOpen: false });
  },
);

it('opens confirmation only for a ready, still-unsubmitted outbox record', () => {
  const [item] = mergeMyReports([], [], [outbox], []);
  expect(item).toMatchObject({
    status: 'Needs confirmation',
    canConfirm: true,
    canSync: false,
    canOpen: false,
  });
});

it('labels early voice Send intent while transcription is pending', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [
        {
          ...outbox,
          kind: 'voice',
          text: '',
          state: 'processing',
          sendRequested: true,
        },
      ],
      [],
    )[0],
  ).toMatchObject({
    status: 'Sending for review',
    detail: 'The report will submit after its verified transcript is ready.',
  });
});

it.each(['failed', 'paused'] as const)(
  'does not hide a %s upload behind early Send intent',
  (state) => {
    expect(
      mergeMyReports(
        [],
        [],
        [
          {
            ...outbox,
            state,
            sendRequested: true,
            lastError: 'Upload stopped.',
          },
        ],
        [],
      )[0],
    ).toMatchObject({
      status: state === 'failed' ? 'Sync needs attention' : 'Sync paused',
      detail: 'Upload stopped.',
    });
  },
);

it('coalesces combined drafts and their server receipt when the outbox cannot be read', () => {
  const shared = {
    id: captureId,
    userId,
    projectId,
    projectName: 'Site project',
    createdAt: remote.received_at,
    state: 'saved' as const,
    available: true,
  };
  const result = mergeMyReports(
    [{ ...shared, duration: 2, sampleRate: 16000, byteLength: 64044 }],
    [{ ...shared, text: 'Combined wording', photos: [], photoUris: [] }],
    [],
    [remote],
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    captureId,
    status: 'Accepted',
    summary: 'Combined wording',
    canSync: false,
    canOpen: true,
  });
});

it.each(['queued', 'reserving', 'uploading', 'finalizing'] as const)(
  'labels the %s delivery phase as Uploading',
  (state) => {
    expect(mergeMyReports([], [], [{ ...outbox, state }], [])[0]).toMatchObject(
      {
        status: 'Uploading',
        detail:
          'Saved on device. Upload continues in the background and resumes after reconnecting.',
      },
    );
  },
);

it('labels durable cancellation intent ahead of ordinary sync failures', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [
        {
          ...outbox,
          state: 'failed',
          cancelRequested: true,
          lastError: null,
        },
      ],
      [],
    )[0],
  ).toMatchObject({
    status: 'Canceling report',
    detail: 'Server cleanup will retry before local evidence is removed.',
  });
});

it('opens an offline text draft for confirmation before server reservation', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [{ ...outbox, reportId: null, state: 'queued' }],
      [],
    )[0],
  ).toMatchObject({ canConfirm: true, canOpenConfirmation: true });
});

it.each(['paused', 'failed'] as const)(
  'shows a pending submission %s error and keeps its detail accessible',
  (state) => {
    expect(
      mergeMyReports(
        [],
        [],
        [
          {
            ...outbox,
            submissionState: 'pending',
            confirmedPayload: {
              text: 'Checked wording',
              workDate: null,
              activityId: null,
            },
            state,
            lastError: 'Project access changed',
          },
        ],
        [],
      )[0],
    ).toMatchObject({
      status: state === 'paused' ? 'Sync paused' : 'Sync needs attention',
      detail: 'Project access changed',
      canConfirm: false,
      canOpenConfirmation: true,
    });
  },
);

it('offers correction instead of blind retry after definite rejection', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [
        {
          ...outbox,
          submissionState: 'pending',
          confirmedPayload: {
            text: 'Checked wording',
            workDate: null,
            activityId: null,
          },
          state: 'paused',
          submissionRejected: true,
        },
      ],
      [],
    )[0],
  ).toMatchObject({
    status: 'Check report',
    canConfirm: true,
    canOpenConfirmation: true,
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
    detail:
      'Uploaded. Waiting for the server to finish transcription or photo validation.',
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

it('queries only the signed-in author and selected project, then joins permitted statuses', async () => {
  const calls: URL[] = [];
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const isReport = url.pathname.endsWith('/reports');
    const isClaim = url.pathname.endsWith('/claims');
    const data = isReport
      ? [{ ...remote, claims: undefined, jobs: undefined }]
      : isClaim
        ? remote.claims
        : [];
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': isClaim ? '0-0/1' : '*/0',
      },
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
  await expect(
    loadRemoteReportsForProject(client, userId, projectId),
  ).resolves.toEqual([remote]);
  expect(calls[0]?.searchParams.get('author_id')).toBe(`eq.${userId}`);
  expect(calls[0]?.searchParams.get('project_id')).toBe(`eq.${projectId}`);
  expect(calls[0]?.searchParams.get('limit')).toBe('100');
  expect(calls[1]?.searchParams.get('report_id')).toContain(reportId);
  expect(calls[2]?.pathname).toContain('/jobs');
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
              {
                ...remote,
                author_id: projectId,
                claims: undefined,
                jobs: undefined,
              },
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

it.each([
  ['clarification', 'Answer needed'],
  ['verification', 'Supervisor check'],
  ['disputed', 'Needs planner attention'],
] as const)('prioritizes %s over partial acceptance', (state, status) => {
  expect(
    mergeMyReports(
      [],
      [],
      [],
      [
        {
          ...remote,
          claims: [
            ...remote.claims,
            {
              id: '60000000-0000-4000-8000-000000000006',
              report_id: reportId,
              report_version: 1,
              state,
            },
          ],
        },
      ],
    )[0]?.status,
  ).toBe(status);
});

it('does not invent attachment counts for reports loaded from another device', () => {
  expect(
    mergeMyReports(
      [],
      [],
      [],
      [
        {
          ...remote,
          source_kind: 'voice',
        },
      ],
    )[0]?.mediaCount,
  ).toBeNull();
});

function reportClient(
  claims: { id: string; report_id: string; state: string }[],
  pageCap = 200,
  mutateCount = false,
) {
  const offsets: number[] = [];
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
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith('/reports'))
            return new Response(
              JSON.stringify([
                { ...remote, claims: undefined, jobs: undefined },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          if (url.pathname.endsWith('/jobs'))
            return new Response('[]', {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Content-Range': '*/0',
              },
            });
          const offset = Number(url.searchParams.get('offset') || 0);
          offsets.push(offset);
          const page = claims
            .slice(offset, offset + pageCap)
            .map((claim) => ({ ...claim, report_version: 1 }));
          return new Response(JSON.stringify(page), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': `${offset}-${offset + page.length - 1}/${claims.length + (mutateCount && offset > 0 ? 1 : 0)}`,
            },
          });
        },
      },
    },
  );
  return { client, offsets };
}

it('accepts the production observed state and preserves its honest outcome', async () => {
  const { client } = reportClient([
    {
      id: '50000000-0000-4000-8000-000000000005',
      report_id: reportId,
      state: 'observed',
    },
  ]);
  const reports = await loadRemoteReports(client, userId);
  expect(mergeMyReports([], [], [], reports)[0]?.status).toBe(
    'Observed — schedule unchanged',
  );
});

it('reads all claim pages even when the server caps pages below the requested size', async () => {
  const claims = Array.from({ length: 201 }, (_, i) => ({
    id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000005`,
    report_id: reportId,
    state: i === 200 ? 'rejected' : 'accepted',
  }));
  const { client, offsets } = reportClient(claims, 80);
  const reports = await loadRemoteReports(client, userId);
  expect(offsets).toEqual([0, 80, 160]);
  expect(reports[0]?.claims).toHaveLength(201);
  expect(mergeMyReports([], [], [], reports)[0]?.status).toBe(
    'Partly accepted',
  );
});

it('reads claims beyond the production row cap before displaying final outcomes', async () => {
  const claims = Array.from({ length: 2_101 }, (_, index) => ({
    id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000005`,
    report_id: reportId,
    state: index === 200 ? 'pending' : 'accepted',
  }));
  const { client, offsets } = reportClient(claims, 200);
  const reports = await loadRemoteReports(client, userId);

  expect(offsets).toEqual(
    Array.from({ length: 11 }, (_, index) => index * 200),
  );
  expect(reports[0]?.claims).toHaveLength(2_101);
  expect(mergeMyReports([], [], [], reports)[0]?.status).toBe(
    'Partly accepted',
  );
  expect(needsReportPolling(reports)).toBe(true);
});

it('rejects a changing claim count instead of displaying partial acceptance evidence', async () => {
  const claims = Array.from({ length: 3 }, (_, i) => ({
    id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000005`,
    report_id: reportId,
    state: 'accepted',
  }));
  await expect(
    loadRemoteReports(reportClient(claims, 2, true).client, userId),
  ).rejects.toThrow('Could not refresh reports');
});

it('rejects job rows outside the selected author reports', async () => {
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
        fetch: async (input) => {
          const path = new URL(String(input)).pathname;
          const data = path.endsWith('/reports')
            ? [{ ...remote, claims: undefined, jobs: undefined }]
            : path.endsWith('/claims')
              ? []
              : [
                  {
                    id: '60000000-0000-4000-8000-000000000006',
                    report_id: captureId,
                    report_version: 1,
                    status: 'succeeded',
                    attempts: 1,
                    error_code: null,
                    created_at: '2026-09-24T00:01:00Z',
                  },
                ];
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': data.length ? `0-${data.length - 1}/1` : '*/0',
            },
          });
        },
      },
    },
  );
  await expect(loadRemoteReports(client, userId)).rejects.toThrow(
    'Could not refresh reports',
  );
});
