import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthView } from './AuthScreen';

import type { AuthViewState } from './AuthProvider';

function state(overrides: Partial<AuthViewState> = {}): AuthViewState {
  return {
    status: 'signedOut',
    session: null,
    message: null,
    busy: false,
    offline: false,
    persistent: true,
    signIn: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('sign-in screen', () => {
  it('labels credentials accessibly, hides the password, and clears it after submission', async () => {
    const auth = state();
    await render(<AuthView auth={auth} />);
    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'reporter@example.test',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Password'),
      'synthetic password',
    );
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signIn).toHaveBeenCalledWith(
      'reporter@example.test',
      'synthetic password',
    );
    expect(screen.getByLabelText('Password')).toHaveDisplayValue('');
  });

  it('disables sign-in while offline without inventing a session', async () => {
    const auth = state({ offline: true });
    await render(<AuthView auth={auth} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByText(/Offline/)).toBeVisible();
  });

  it('shows a recoverable restore failure', async () => {
    const auth = state({
      status: 'error',
      message: 'Could not restore your session.',
    });
    await render(<AuthView auth={auth} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(auth.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('shows incomplete setup without exposing environment variables or keys', async () => {
    await render(<AuthView auth={state({ status: 'unconfigured' })} />);
    expect(
      screen.getByRole('header', { name: 'Sign-in unavailable' }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByText(/SUPABASE/)).toBeNull();
  });

  it('keeps the form unavailable during restore and pending sign-in', async () => {
    await render(<AuthView auth={state({ status: 'loading' })} />);
    expect(screen.getByLabelText('Checking saved session')).toBeVisible();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await screen.rerender(<AuthView auth={state({ busy: true })} />);
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });
});
