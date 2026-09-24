import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase';

import {
  loadReportFollowups,
  loadVerificationAssignments,
} from './followupService';
import { useReportFollowups, useVerificationAssignments } from './useFollowups';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { ReactNode } from 'react';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useProjectSelection', () => ({
  useProjectSelection: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./followupService', () => ({
  ...jest.requireActual('./followupService'),
  loadReportFollowups: jest.fn(),
  loadVerificationAssignments: jest.fn(),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const reportId = '10000000-0000-4000-8000-000000000003';
const context: ProjectContext = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Supervisor',
    role: 'supervisor',
    active: true,
    version: 3,
  },
  project: { id: projectId, name: 'Refinery upgrade' },
};

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return function QueryProvider({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: userId } },
    offline: false,
  } as never);
  jest.mocked(getSupabase).mockReturnValue({} as never);
  jest.mocked(loadReportFollowups).mockResolvedValue({} as never);
  jest.mocked(loadVerificationAssignments).mockResolvedValue([]);
  const { useProjectSelection } = jest.requireMock(
    '@/features/projects/useProjectSelection',
  ) as { useProjectSelection: jest.Mock };
  useProjectSelection.mockReturnValue({
    data: context,
    error: null,
    isPending: false,
    offline: false,
    refetch: jest.fn().mockResolvedValue({ data: [context] }),
  });
});

it('refreshes and invalidates report-dependent caches after a reply', async () => {
  const client = queryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const view = await renderHook(() => useReportFollowups(reportId), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(loadReportFollowups).toHaveBeenCalled());
  await act(async () => view.result.current.finish());

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['my-reports', userId],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['project-recent-reports', userId],
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['review-queue'] });
  client.clear();
});

it('invalidates verification and planner views after an attestation', async () => {
  const client = queryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const view = await renderHook(() => useVerificationAssignments(), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(loadVerificationAssignments).toHaveBeenCalled());
  await act(async () => view.result.current.finish());

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['review-queue'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['claim-decision'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-reports'] });
  client.clear();
});
