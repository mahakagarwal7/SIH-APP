import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { WorkReadError } from '@/features/projects/myWorkService';
import { useProjectSelection } from '@/features/projects/useProjectSelection';
import { getSupabase } from '@/lib/supabase';

import { HistoryReadError, loadExecutionHistory } from './historyService';
import { useExecutionHistory } from './useExecutionHistory';

import type { ProjectContext } from '@/features/projects/myWorkService';
import type { ReactNode } from 'react';

jest.mock('@/features/projects/useProjectSelection', () => ({
  useProjectSelection: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./historyService', () => ({
  ...jest.requireActual('./historyService'),
  loadExecutionHistory: jest.fn(),
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

function selection(
  data: ProjectContext | undefined = context,
  error: Error | null = null,
) {
  return {
    userId,
    data,
    projects: data ? [data] : [],
    error,
    isPending: false,
    isFetching: false,
    offline: false,
    remembered: false,
    refetch: jest.fn().mockResolvedValue({ data: data ? [data] : [] }),
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

beforeEach(() => {
  jest.mocked(useProjectSelection).mockReturnValue(selection());
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
});

it('keeps a project-list denial keyed through a later transient failure', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  jest.mocked(loadExecutionHistory).mockResolvedValue({
    entries: [],
    snapshot: { activities: [] },
  } as unknown as Awaited<ReturnType<typeof loadExecutionHistory>>);
  const view = await renderHook(() => useExecutionHistory(), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(view.result.current.history.isSuccess).toBe(true));

  jest
    .mocked(useProjectSelection)
    .mockReturnValue(selection(undefined, new WorkReadError('access')));
  await view.rerender({});
  await waitFor(() => expect(view.result.current.accessDenied).toBe(true));
  await waitFor(() =>
    expect(
      client.getQueryData([
        'execution-history-access-denied',
        userId,
        projectId,
        1,
      ]),
    ).toBe(true),
  );

  jest
    .mocked(loadExecutionHistory)
    .mockRejectedValue(new HistoryReadError('unavailable'));
  jest
    .mocked(useProjectSelection)
    .mockReturnValue(selection(context, new WorkReadError('unavailable')));
  await view.rerender({});
  await act(async () => {
    await view.result.current.history.refetch();
  });
  await waitFor(() =>
    expect(view.result.current.history.error).toMatchObject({
      kind: 'unavailable',
    }),
  );
  expect(view.result.current.accessDenied).toBe(true);
});

it('clears a prior denial after an automatic authorized history reload', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(
    ['execution-history-access-denied', userId, projectId, 1],
    true,
  );
  jest.mocked(loadExecutionHistory).mockResolvedValue({
    entries: [],
    snapshot: { activities: [] },
  } as unknown as Awaited<ReturnType<typeof loadExecutionHistory>>);

  const view = await renderHook(() => useExecutionHistory(), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(view.result.current.history.isSuccess).toBe(true));
  await waitFor(() => expect(view.result.current.accessDenied).toBe(false));
});

it('keeps a confirmed access denial sticky and evicts cached history', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['execution-history', userId, projectId, 1], {
    entries: ['cached evidence'],
  });
  jest
    .mocked(loadExecutionHistory)
    .mockRejectedValue(new HistoryReadError('access'));

  const view = await renderHook(() => useExecutionHistory(), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(view.result.current.accessDenied).toBe(true));
  expect(
    client.getQueryData(['execution-history', userId, projectId, 1]),
  ).toBeUndefined();

  jest
    .mocked(loadExecutionHistory)
    .mockRejectedValue(new HistoryReadError('unavailable'));
  await act(async () => {
    await view.result.current.history.refetch();
  });

  await waitFor(() => expect(view.result.current.accessDenied).toBe(true));
  expect(
    client.getQueryData(['execution-history', userId, projectId, 1]),
  ).toBeUndefined();
});
