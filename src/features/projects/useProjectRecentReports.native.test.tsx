import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  getReportsClient,
  loadRemoteReportsForProject,
} from '@/features/field-reports/myReportsService';
import { getVoiceDraftStore } from '@/features/field-reports/nativeDraftStore';
import { getNativeOutbox } from '@/features/field-reports/nativeOutbox';
import { getReportDraftStore } from '@/features/field-reports/nativeReportDraftStore';

import { useProjectRecentReports } from './useProjectRecentReports.native';

import type { RemoteReport } from '@/features/field-reports/myReportsService';
import type { ReactNode } from 'react';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/field-reports/myReportsService', () => ({
  ...jest.requireActual('@/features/field-reports/myReportsService'),
  getReportsClient: jest.fn(),
  loadRemoteReportsForProject: jest.fn(),
}));
jest.mock('@/features/field-reports/nativeDraftStore', () => ({
  getVoiceDraftStore: jest.fn(),
}));
jest.mock('@/features/field-reports/nativeOutbox', () => ({
  getNativeOutbox: jest.fn(),
}));
jest.mock('@/features/field-reports/nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000002';
const reportId = '30000000-0000-4000-8000-000000000003';
const captureId = '40000000-0000-4000-8000-000000000004';
const queryKey = ['project-recent-reports', userId, projectId, 'remote'];
const originalAppState = AppState.currentState;

function report(status: 'running' | 'succeeded'): RemoteReport {
  return {
    id: reportId,
    project_id: projectId,
    author_id: userId,
    capture_id: captureId,
    current_version: 1,
    lifecycle: 'submitted',
    received_at: '2026-09-24T01:00:00Z',
    source_kind: 'text',
    claims:
      status === 'succeeded'
        ? [
            {
              id: '50000000-0000-4000-8000-000000000005',
              report_id: reportId,
              report_version: 1,
              state: 'accepted',
            },
          ]
        : [],
    jobs: [
      {
        id: '60000000-0000-4000-8000-000000000006',
        report_id: reportId,
        report_version: 1,
        status,
        attempts: 1,
        error_code: null,
        claim_count: status === 'succeeded' ? 1 : null,
        created_at: '2026-09-24T01:01:00Z',
      },
    ],
  };
}

function Wrapper({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: userId } },
    offline: false,
  } as never);
  jest.mocked(getReportsClient).mockReturnValue({} as never);
  jest
    .mocked(loadRemoteReportsForProject)
    .mockResolvedValue([report('succeeded')]);
  jest.mocked(getVoiceDraftStore).mockResolvedValue({
    list: jest.fn().mockResolvedValue([]),
  } as never);
  jest.mocked(getReportDraftStore).mockResolvedValue({
    list: jest.fn().mockResolvedValue([]),
  } as never);
  jest.mocked(getNativeOutbox).mockResolvedValue({
    list: jest.fn().mockResolvedValue([]),
  } as never);
});

afterEach(() => {
  AppState.currentState = originalAppState;
  jest.useRealTimers();
});

it('refreshes Home status while focused until a submitted report is terminal', async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  client.setQueryData(queryKey, [report('running')]);
  const view = await renderHook(
    () => useProjectRecentReports(projectId, true),
    {
      wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper>,
    },
  );

  expect(view.result.current.items[0]?.status).toBe('Processing report');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });

  await waitFor(() =>
    expect(view.result.current.items[0]?.status).toBe('Accepted'),
  );
  expect(loadRemoteReportsForProject).toHaveBeenCalledTimes(1);
  await view.unmount();
  client.clear();
});
