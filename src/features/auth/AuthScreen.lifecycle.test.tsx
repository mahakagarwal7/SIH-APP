import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';
import { AppState } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { AuthProvider } from './AuthProvider';
import AuthScreen from './AuthScreen';

import type { AppStateStatus } from 'react-native';

jest.mock('expo-network', () => ({ useNetworkState: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

it('retains entered credentials while returning from another app rechecks the session', async () => {
  let changed: ((state: AppStateStatus) => void) | undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      changed = listener;
      return { remove: jest.fn() };
    });
  const auth = {
    getSession: jest
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
    startAutoRefresh: jest.fn().mockResolvedValue(undefined),
    stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
  };
  jest
    .mocked(getSupabase)
    .mockReturnValue({ auth } as unknown as NonNullable<
      ReturnType<typeof getSupabase>
    >);
  jest
    .mocked(useNetworkState)
    .mockReturnValue({ isConnected: true, isInternetReachable: true });
  await render(
    <AuthProvider>
      <AuthScreen />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Email')).toBeVisible());
  await fireEvent.changeText(
    screen.getByLabelText('Email'),
    'reporter@example.test',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password'),
    'synthetic password',
  );
  let finish!: (value: { data: { session: null }; error: null }) => void;
  auth.getSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    changed?.('background');
  });
  await act(async () => {
    changed?.('active');
  });
  try {
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Email')).toHaveDisplayValue(
      'reporter@example.test',
    );
    expect(screen.getByLabelText('Password')).toHaveDisplayValue(
      'synthetic password',
    );
  } finally {
    await act(async () => {
      finish({ data: { session: null }, error: null });
    });
  }
  expect(screen.getByLabelText('Email')).toHaveDisplayValue(
    'reporter@example.test',
  );
  expect(screen.getByLabelText('Password')).toHaveDisplayValue(
    'synthetic password',
  );
});
