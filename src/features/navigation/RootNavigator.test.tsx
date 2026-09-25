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
  '(app)/alerts-preview': () => <Text>Protected alerts preview</Text>,
});

const StatusContext = createContext<AuthViewState['status']>('signedOut');

function Harness({
  status,
  location = '/field',
}: {
  status: AuthViewState['status'];
  location?: string;
}) {
  return (
    <StatusContext.Provider value={status}>
      <ExpoRoot context={context} location={location} />
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

  it('keeps the alerts design preview behind the signed-in route boundary', async () => {
    const view = await render(
      <Harness status="signedOut" location="/alerts-preview" />,
    );
    expect(await screen.findByText('Sign-in boundary')).toBeVisible();
    expect(screen.queryByText('Protected alerts preview')).toBeNull();

    await view.rerender(
      <Harness status="signedIn" location="/alerts-preview" />,
    );
    expect(await screen.findByText('Protected alerts preview')).toBeVisible();
  });
});
