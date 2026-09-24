import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useProjectSelection } from '@/features/projects/useProjectSelection';
import { getSupabase } from '@/lib/supabase';

import { loadReviewQueue, ReviewReadError } from './reviewQueueService';
import { useReviewQueue } from './useReviewQueue';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { ReactNode } from 'react';

jest.mock('@/features/projects/useProjectSelection', () => ({
  useProjectSelection: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./reviewQueueService', () => ({
  ...jest.requireActual('./reviewQueueService'),
  loadReviewQueue: jest.fn(),
}));

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const context: ProjectContext = {
  member: {
    project_id: projectId,
    user_id: userId,
    display_name: 'Planner',
    role: 'planner',
    active: true,
    version: 1,
  },
  project: { id: projectId, name: 'Refinery upgrade' },
};

function selection(offline: boolean) {
  return {
    data: context,
    projects: [context],
    error: null,
    isPending: false,
    isFetching: false,
    offline,
    remembered: false,
    refetch: jest.fn().mockResolvedValue({ data: [context] }),
    select: jest.fn(),
  } as unknown as ReturnType<typeof useProjectSelection>;
}

function wrapper(client: QueryClient) {
  function TestQueryProvider({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return TestQueryProvider;
}

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

beforeEach(() => {
  jest.mocked(useProjectSelection).mockReturnValue(selection(true));
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
});

it('purges all cached project pages when access is explicitly denied', async () => {
  const client = queryClient();
  client.setQueryData(['review-queue', userId, projectId, 1, 0], {
    items: ['first page'],
  });
  client.setQueryData(['review-queue', userId, projectId, 1, 1], {
    items: ['second page'],
  });
  const view = await renderHook(() => useReviewQueue(0), {
    wrapper: wrapper(client),
  });

  await act(async () => view.result.current.reportAccessDenied());

  await waitFor(() => expect(view.result.current.accessDenied).toBe(true));
  expect(
    client
      .getQueriesData({ queryKey: ['review-queue', userId, projectId] })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});

it('purges all cached pages when loading any page confirms access denial', async () => {
  const client = queryClient();
  jest.mocked(useProjectSelection).mockReturnValue(selection(false));
  jest.mocked(loadReviewQueue).mockRejectedValue(new ReviewReadError('access'));
  client.setQueryData(['review-queue', userId, projectId, 1, 0], {
    items: ['cached first page'],
  });
  const view = await renderHook(() => useReviewQueue(1, projectId), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(view.result.current.accessDenied).toBe(true));

  expect(
    client
      .getQueriesData({ queryKey: ['review-queue', userId, projectId] })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});
