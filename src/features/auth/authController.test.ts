import { SecureStorageError } from '@/lib/secureStorage';

import { AuthController } from './authController';

import type { AuthApi } from './authController';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export const savedSession: Session = {
  access_token: 'synthetic-access-token',
  refresh_token: 'synthetic-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'synthetic-user',
    email: 'reporter@example.test',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-09-23T00:00:00Z',
  },
};

function setup() {
  let callback:
    ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
  const unsubscribe = jest.fn();
  const api = {
    getSession: jest
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest
      .fn()
      .mockResolvedValue({ data: { session: savedSession }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn((listener) => {
      callback = listener;
      return { data: { subscription: { unsubscribe } } };
    }),
    startAutoRefresh: jest.fn().mockResolvedValue(undefined),
    stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
  } satisfies AuthApi;
  const controller = new AuthController(api);
  const stop = controller.start();
  return {
    api,
    controller,
    stop,
    unsubscribe,
    emit: (event: AuthChangeEvent, session: Session | null) =>
      callback?.(event, session),
  };
}

describe('auth lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('restores an existing session and expires it without leaving an authenticated screen open', async () => {
    const { api, controller, stop } = setup();
    api.getSession.mockResolvedValue({
      data: {
        session: {
          ...savedSession,
          expires_at: Math.floor(Date.now() / 1000) + 2,
        },
      },
      error: null,
    });
    await controller.restore();
    expect(controller.getSnapshot().status).toBe('signedIn');
    jest.advanceTimersByTime(2100);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      session: null,
    });
    stop();
  });

  it('does not replace a newer sign-out with a late startup result', async () => {
    const { api, controller, emit, stop } = setup();
    let finish!: (result: {
      data: { session: Session | null };
      error: null;
    }) => void;
    api.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const restoring = controller.restore();
    emit('SIGNED_OUT', null);
    finish({ data: { session: savedSession }, error: null });
    await restoring;
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      session: null,
    });
    stop();
  });

  it('keeps storage read failures visible and supports retry', async () => {
    const { api, controller, stop } = setup();
    api.getSession.mockRejectedValueOnce(new SecureStorageError());
    await controller.restore();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      session: null,
      message:
        'Secure storage is unavailable. Unlock your device and try again.',
    });
    await controller.restore();
    expect(controller.getSnapshot().status).toBe('signedOut');
    stop();
  });

  it('ignores INITIAL_SESSION null after a restore error', async () => {
    const { api, controller, emit, stop } = setup();
    api.getSession.mockRejectedValueOnce(new SecureStorageError());
    await controller.restore();
    emit('INITIAL_SESSION', null);
    expect(controller.getSnapshot().status).toBe('error');
    stop();
  });

  it('bounds startup waiting and ignores its result after unmount', async () => {
    const { api, controller, stop } = setup();
    let finish!: (result: {
      data: { session: Session | null };
      error: null;
    }) => void;
    api.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const restore = controller.restore();
    await jest.advanceTimersByTimeAsync(15_001);
    await restore;
    expect(controller.getSnapshot().status).toBe('error');
    stop();
    finish({ data: { session: savedSession }, error: null });
    await Promise.resolve();
    expect(controller.getSnapshot().status).toBe('error');
  });

  it('rejects an expired stored session and accepts a refreshed session event', async () => {
    const { api, controller, emit, stop } = setup();
    api.getSession.mockResolvedValue({
      data: { session: { ...savedSession, expires_at: 1 } },
      error: null,
    });
    await controller.restore();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      session: null,
    });
    emit('TOKEN_REFRESHED', savedSession);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedIn',
      session: savedSession,
    });
    stop();
  });

  it('maps credential errors without exposing raw server detail', async () => {
    const { api, controller, stop } = setup();
    await controller.restore();
    api.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'raw-server-detail' },
    });
    await controller.signIn('reporter@example.test', 'synthetic');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      message: 'Email or password is incorrect.',
    });
    stop();
  });

  it('validates credentials and preserves password whitespace', async () => {
    const { api, controller, stop } = setup();
    await controller.restore();
    await controller.signIn('invalid', 'secret');
    expect(api.signInWithPassword).not.toHaveBeenCalled();
    await controller.signIn(
      ' reporter@example.test ',
      '  synthetic password  ',
    );
    expect(api.signInWithPassword).toHaveBeenCalledWith({
      email: 'reporter@example.test',
      password: '  synthetic password  ',
    });
    stop();
  });

  it('submits once while a sign-in is pending and never persists the password in state', async () => {
    const { api, controller, stop } = setup();
    await controller.restore();
    let finish!: (result: { data: { session: Session }; error: null }) => void;
    api.signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = controller.signIn(
      'reporter@example.test',
      'synthetic password',
    );
    await controller.signIn('reporter@example.test', 'synthetic password');
    expect(api.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      'synthetic password',
    );
    finish({ data: { session: savedSession }, error: null });
    await first;
    stop();
  });

  it('never announces sign-in when storing the session fails', async () => {
    const { api, controller, stop } = setup();
    await controller.restore();
    api.signInWithPassword.mockRejectedValue(new SecureStorageError());
    await controller.signIn('reporter@example.test', 'synthetic password');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      session: null,
      busy: false,
    });
    expect(controller.getSnapshot().message).toContain('Secure storage');
    stop();
  });

  it('uses local sign-out scope and keeps local removal separate from server revocation', async () => {
    const { api, controller, emit, stop } = setup();
    emit('SIGNED_IN', savedSession);
    api.signOut.mockImplementation(async () => {
      emit('SIGNED_OUT', null);
      return { error: { name: 'AuthRetryableFetchError' } };
    });
    await controller.signOut();
    expect(api.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedOut',
      session: null,
      message:
        'Signed out on this device. Server sign-out could not be confirmed.',
    });
    stop();
  });

  it('keeps the account visible if secure deletion fails', async () => {
    const { api, controller, emit, stop } = setup();
    emit('SIGNED_IN', savedSession);
    api.signOut.mockRejectedValue(new SecureStorageError());
    await controller.signOut();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'signedIn',
      session: savedSession,
      busy: false,
    });
    stop();
  });

  it('starts foreground refresh once, stops it offline/backgrounded, and cleans up', async () => {
    const { api, controller, stop, unsubscribe, emit } = setup();
    controller.setRefreshEnabled(true);
    controller.setRefreshEnabled(true);
    expect(api.startAutoRefresh).toHaveBeenCalledTimes(1);
    controller.setRefreshEnabled(false);
    expect(api.stopAutoRefresh).toHaveBeenCalledTimes(1);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    const previous = controller.getSnapshot();
    emit('SIGNED_IN', savedSession);
    expect(controller.getSnapshot()).toBe(previous);
  });
});
