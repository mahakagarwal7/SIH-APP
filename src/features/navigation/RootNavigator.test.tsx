import { act, render, screen, waitFor } from '@testing-library/react-native';
import { ExpoRoot, router, Slot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { createContext, useContext } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { RootNavigator } from './RootNavigator';

import type { AuthViewState } from '@/features/auth/AuthProvider';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));

const context = getMockContext({
  _layout: RootNavigator,
  index: () => <Text>Sign-in boundary</Text>,
  '(app)/_layout': () => <Slot />,
  '(app)/workspaces': () => <Text>Workspace selection</Text>,
  '(app)/field/index': () => <Text>Protected field content</Text>,
});

const StatusContext = createContext<AuthViewState['status']>('signedOut');

function Harness({ status }: { status: AuthViewState['status'] }) {
  return (
    <StatusContext.Provider value={status}>
      <ExpoRoot context={context} location="/field" />
    </StatusContext.Provider>
  );
}

describe('route access', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockImplementation(function useMockAuth() {
      // This boundary consumes status only; context makes the guard update like the real provider.
      return {
        status: useContext(StatusContext),
        session: null,
      } as AuthViewState;
    });
  });

  it.each(['signedOut', 'loading', 'error', 'unconfigured'] as const)(
    'redirects a %s direct link before workspace content appears',
    async (status) => {
      await render(<Harness status={status} />);
      expect(await screen.findByText('Sign-in boundary')).toBeVisible();
      expect(screen.queryByText('Protected field content')).toBeNull();
    },
  );

  it('removes protected screens from back navigation after the session ends', async () => {
    await render(<Harness status="signedIn" />);
    expect(await screen.findByText('Protected field content')).toBeVisible();
    await screen.rerender(<Harness status="signedOut" />);
    expect(await screen.findByText('Sign-in boundary')).toBeVisible();
    await act(async () => {
      router.push('/field');
    });
    await waitFor(() =>
      expect(screen.queryByText('Protected field content')).toBeNull(),
    );
  });
});
