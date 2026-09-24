import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase';

import {
  forgetRememberedProjectContext,
  readRememberedProjectContext,
  rememberProjectContext,
} from './captureProjectStore';
import { loadActiveProjects } from './myWorkService';
import { useProjectSelection } from './useProjectSelection';

import type { ProjectContext } from './myWorkService';
import type { AuthViewState } from '@/features/auth/AuthProvider';
import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('./myWorkService', () => ({
  ...jest.requireActual('./myWorkService'),
  loadActiveProjects: jest.fn(),
}));
jest.mock('./captureProjectStore', () => ({
  readRememberedProjectContext: jest.fn(),
  rememberProjectContext: jest.fn(),
  forgetRememberedProjectContext: jest.fn(),
}));
jest.mock('./captureProjectStore.native', () => ({
  readRememberedProjectContext: jest.fn(),
  rememberProjectContext: jest.fn(),
  forgetRememberedProjectContext: jest.fn(),
}));

const userId = '10000000-0000-4000-8000-000000000001';
function project(id: string, version = 1): ProjectContext {
  return {
    member: {
      project_id: id,
      user_id: userId,
      display_name: 'Field worker',
      role: 'reporter',
      active: true,
      version,
    },
    project: { id, name: `Project ${id}` },
  };
}
const one = project('10000000-0000-4000-8000-000000000002');
const two = project('10000000-0000-4000-8000-000000000003');

function auth(offline = false): AuthViewState {
  return {
    status: 'signedIn',
    session: {
      access_token: 'synthetic',
      refresh_token: 'synthetic',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: userId,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      },
    } as Session,
    offline,
    persistent: true,
    busy: false,
    message: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    retry: jest.fn(),
  };
}

function Consumer() {
  const selection = useProjectSelection();
  return (
    <View>
      <Text>{selection.data?.project.name ?? 'No selection'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void selection.select(two.project.id)}
      >
        <Text>Select two</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void selection.refetch()}
      >
        <Text>Refresh</Text>
      </Pressable>
    </View>
  );
}

function Provider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue(auth());
  jest
    .mocked(getSupabase)
    .mockReturnValue({} as NonNullable<ReturnType<typeof getSupabase>>);
  jest.mocked(readRememberedProjectContext).mockResolvedValue(null);
  jest.mocked(rememberProjectContext).mockResolvedValue();
  jest.mocked(forgetRememberedProjectContext).mockResolvedValue();
  jest.mocked(loadActiveProjects).mockResolvedValue([one, two]);
});

it('switches to a verified membership and clears every project-scoped cache', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['my-work', userId, one.project.id, 1], {
    private: 'one',
  });
  client.setQueryData(
    ['project-recent-reports', userId, one.project.id],
    ['one'],
  );
  await render(<Consumer />, {
    wrapper: ({ children }) => <Provider client={client}>{children}</Provider>,
  });
  expect(await screen.findByText(one.project.name)).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Select two' }));
  expect(await screen.findByText(two.project.name)).toBeVisible();
  expect(rememberProjectContext).toHaveBeenLastCalledWith(userId, two);
  expect(
    client.getQueryData(['my-work', userId, one.project.id, 1]),
  ).toBeUndefined();
  expect(
    client.getQueryData(['project-recent-reports', userId, one.project.id]),
  ).toBeUndefined();
});

it('falls back after membership removal and deletes a choice when access is empty', async () => {
  jest.mocked(readRememberedProjectContext).mockResolvedValue(two);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(<Consumer />, {
    wrapper: ({ children }) => <Provider client={client}>{children}</Provider>,
  });
  expect(await screen.findByText(two.project.name)).toBeVisible();
  jest.mocked(loadActiveProjects).mockResolvedValue([one]);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText(one.project.name)).toBeVisible();
  await waitFor(() =>
    expect(rememberProjectContext).toHaveBeenLastCalledWith(userId, one),
  );
  jest.mocked(loadActiveProjects).mockResolvedValue([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('No selection')).toBeVisible();
  await waitFor(() =>
    expect(forgetRememberedProjectContext).toHaveBeenCalledWith(userId),
  );
});

it('restores same-account context offline without querying Supabase', async () => {
  jest.mocked(useAuth).mockReturnValue(auth(true));
  jest.mocked(readRememberedProjectContext).mockResolvedValue(two);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(<Consumer />, {
    wrapper: ({ children }) => <Provider client={client}>{children}</Provider>,
  });
  expect(await screen.findByText(two.project.name)).toBeVisible();
  expect(loadActiveProjects).not.toHaveBeenCalled();
});
