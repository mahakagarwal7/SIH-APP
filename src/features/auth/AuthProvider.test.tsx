import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { AuthProvider, useAuth } from './AuthProvider';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

function Consumer({ name }: { name: string }) {
  const auth = useAuth();
  return (
    <Text>
      {name}: {auth.status}
    </Text>
  );
}

describe('shared auth provider', () => {
  it('shares one subscription and state across screens until the provider unmounts', async () => {
    let emit:
      ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
    const unsubscribe = jest.fn();
    const auth = {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn((callback: NonNullable<typeof emit>) => {
        emit = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .mocked(getSupabase)
      .mockReturnValue({ auth } as unknown as NonNullable<
        ReturnType<typeof getSupabase>
      >);
    await render(
      <AuthProvider>
        <Consumer name="Screen" />
        <Consumer name="Header" />
      </AuthProvider>,
    );
    expect(await screen.findByText('Screen: signedOut')).toBeVisible();
    expect(screen.getByText('Header: signedOut')).toBeVisible();
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);

    const session: Session = {
      access_token: 'synthetic-access',
      refresh_token: 'synthetic-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'synthetic-user',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      },
    };
    await act(async () => {
      emit?.('SIGNED_IN', session);
    });
    expect(screen.getByText('Screen: signedIn')).toBeVisible();
    expect(screen.getByText('Header: signedIn')).toBeVisible();
    await screen.rerender(
      <AuthProvider>
        <Consumer name="Header" />
      </AuthProvider>,
    );
    expect(screen.getByText('Header: signedIn')).toBeVisible();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      emit?.('SIGNED_OUT', null);
    });
    expect(screen.getByText('Header: signedOut')).toBeVisible();
    await screen.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
