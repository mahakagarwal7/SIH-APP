import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import {
  readRememberedProjectContext,
  rememberProjectContext,
} from './captureProjectStore';
import { WorkReadError } from './myWorkService';
import { useCaptureProject } from './useCaptureProject';
import { useDefaultProject } from './useMyWork';

import type { ProjectContext } from './myWorkService';
import type { AuthViewState } from '@/features/auth/AuthProvider';
import type { ReactNode } from 'react';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./useMyWork', () => ({ useDefaultProject: jest.fn() }));
jest.mock('./captureProjectStore', () => ({
  readRememberedProjectContext: jest.fn(async () => null),
  rememberProjectContext: jest.fn(async () => {}),
}));
const context: ProjectContext = {
  member: {
    user_id: 'alice',
    project_id: 'project',
    active: true,
    display_name: 'Alice',
    role: 'reporter',
    version: 1,
  },
  project: { id: 'project', name: 'Site' },
};
it.each(['access', 'unavailable'] as const)(
  'does not hide an online %s failure behind cached project data',
  async (kind) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const error = new WorkReadError(kind);
    jest.mocked(useAuth).mockReturnValue({
      status: 'signedIn',
      session: { user: { id: 'alice' } },
      offline: false,
    } as AuthViewState);
    jest.mocked(useDefaultProject).mockReturnValue({
      data: context,
      error,
      isSuccess: false,
      isPending: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useDefaultProject>);
    jest.mocked(readRememberedProjectContext).mockResolvedValue(context);
    const { result, unmount } = await renderHook(() => useCaptureProject(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(error);
    expect(rememberProjectContext).not.toHaveBeenCalled();
    await unmount();
    client.clear();
  },
);
