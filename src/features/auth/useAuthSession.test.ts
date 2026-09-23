import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';
import { AppState } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { useAuthSession } from './useAuthSession';

import type { AppStateStatus } from 'react-native';

jest.mock('expo-network', () => ({ useNetworkState: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

describe('auth hook', () => {
  it('connects refresh to foreground/connectivity and removes its subscriptions', async () => {
    let changed: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        changed = listener;
        return { remove };
      });
    const unsubscribe = jest.fn();
    const auth = {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    };
    // Only the auth interface is consumed; no database client is exercised in this hook test.
    jest
      .mocked(getSupabase)
      .mockReturnValue({ auth } as unknown as NonNullable<
        ReturnType<typeof getSupabase>
      >);
    jest
      .mocked(useNetworkState)
      .mockReturnValue({ isConnected: true, isInternetReachable: true });
    const rendered = await renderHook(() => useAuthSession());
    await waitFor(() =>
      expect(rendered.result.current.status).toBe('signedOut'),
    );
    await act(async () => {
      changed?.('active');
    });
    expect(auth.startAutoRefresh).toHaveBeenCalled();
    jest
      .mocked(useNetworkState)
      .mockReturnValue({ isConnected: false, isInternetReachable: false });
    await rendered.rerender(undefined);
    expect(auth.stopAutoRefresh).toHaveBeenCalled();
    await act(async () => {
      await rendered.result.current.signIn(
        'reporter@example.test',
        'synthetic',
      );
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    await rendered.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
