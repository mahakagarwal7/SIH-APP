import { SecureStorageError } from '@/lib/secureStorage';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface AuthApi {
  getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { session: Session | null }; error: unknown }>;
  signOut(options: { scope: 'local' }): Promise<{ error: unknown }>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}

export type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn' | 'error' | 'unconfigured';
  session: Session | null;
  busy: boolean;
  message: string | null;
};

export class AuthController {
  private state: AuthState = {
    status: 'loading',
    session: null,
    busy: false,
    message: null,
  };
  private listeners = new Set<() => void>();
  private active = false;
  private lifetime = 0;
  private revision = 0;
  private refreshing = false;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly api: AuthApi | null) {
    if (!api) this.state = { ...this.state, status: 'unconfigured' };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(next: Partial<AuthState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private accept(session: Session | null) {
    clearTimeout(this.expiryTimer);
    const remaining = (session?.expires_at ?? 0) * 1000 - Date.now();
    if (!session || !Number.isFinite(remaining) || remaining <= 0) {
      this.update({
        status: 'signedOut',
        session: null,
        message: session ? 'Your session has expired. Sign in again.' : null,
      });
      return;
    }
    this.update({ status: 'signedIn', session, message: null });
    this.expiryTimer = setTimeout(
      () => {
        this.revision += 1;
        this.accept(session);
      },
      Math.min(remaining, 2_147_483_647),
    );
  }

  start() {
    this.active = true;
    const lifetime = ++this.lifetime;
    const subscription = this.api?.onAuthStateChange((event, session) => {
      // SDK INITIAL_SESSION can contain null after a storage error. Restore owns that state.
      if (
        !this.active ||
        lifetime !== this.lifetime ||
        event === 'INITIAL_SESSION'
      )
        return;
      this.revision += 1;
      this.accept(session);
    }).data.subscription;
    return () => {
      if (lifetime !== this.lifetime) return;
      this.active = false;
      this.lifetime += 1;
      this.revision += 1;
      clearTimeout(this.expiryTimer);
      subscription?.unsubscribe();
      this.refreshing = false;
      void this.api?.stopAutoRefresh().catch(() => {});
    };
  }

  async restore() {
    if (!this.api || !this.active || this.state.busy) return;
    const revision = ++this.revision;
    const hasValidSession =
      this.state.status === 'signedIn' &&
      (this.state.session?.expires_at ?? 0) * 1000 > Date.now();
    if (!hasValidSession) {
      clearTimeout(this.expiryTimer);
      // Keep an established sign-in form mounted while a resume check is pending.
      if (this.state.status !== 'signedOut')
        this.update({ status: 'loading', session: null, message: null });
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.api.getSession(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('restore-timeout')),
            15_000,
          );
        }),
      ]);
      if (revision !== this.revision || !this.active) return;
      if (result.error) throw result.error;
      this.accept(result.data.session);
    } catch (error) {
      if (revision === this.revision) {
        clearTimeout(this.expiryTimer);
        this.update({
          status: 'error',
          session: null,
          message: authMessage(
            error,
            'Could not restore your session. Check your connection and try again.',
          ),
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async signIn(email: string, password: string) {
    if (
      !this.api ||
      !this.active ||
      this.state.busy ||
      this.state.status !== 'signedOut'
    )
      return;
    const normalizedEmail = email.trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254 ||
      !password ||
      password.length > 256
    ) {
      this.update({
        message: 'Enter a valid email address and your password.',
      });
      return;
    }
    const lifetime = this.lifetime;
    // An older resume check cannot replace the result of this sign-in attempt.
    const revision = ++this.revision;
    this.update({ busy: true, message: null });
    try {
      const result = await this.api.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (result.error) throw result.error;
      if (lifetime === this.lifetime && revision === this.revision)
        this.accept(result.data.session);
    } catch (error) {
      if (lifetime === this.lifetime)
        this.update({
          message: authMessage(
            error,
            'Could not sign in. Check your connection and try again.',
          ),
        });
    } finally {
      if (lifetime === this.lifetime) this.update({ busy: false });
    }
  }

  async signOut() {
    if (
      !this.api ||
      !this.active ||
      this.state.busy ||
      this.state.status !== 'signedIn'
    )
      return;
    const lifetime = this.lifetime;
    this.update({ busy: true, message: null });
    try {
      const { error } = await this.api.signOut({ scope: 'local' });
      if (lifetime !== this.lifetime) return;
      if (error) {
        // The SDK may remove local tokens even when server revocation cannot be reached.
        if (!this.state.session)
          this.update({
            message:
              'Signed out on this device. Server sign-out could not be confirmed.',
          });
        else throw error;
      } else {
        this.revision += 1;
        this.accept(null);
      }
    } catch (error) {
      if (lifetime === this.lifetime)
        this.update({
          message: authMessage(error, 'Could not sign out. Try again.'),
        });
    } finally {
      if (lifetime === this.lifetime) this.update({ busy: false });
    }
  }

  setRefreshEnabled(enabled: boolean) {
    if (!this.api || !this.active || this.refreshing === enabled) return;
    this.refreshing = enabled;
    const action = enabled
      ? this.api.startAutoRefresh()
      : this.api.stopAutoRefresh();
    void action.catch(() => {
      this.update({
        message: 'Session refresh is unavailable. Try again when connected.',
      });
    });
  }
}

function authMessage(error: unknown, fallback: string): string {
  if (error instanceof SecureStorageError)
    return 'Secure storage is unavailable. Unlock your device and try again.';
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && error.code === 'invalid_credentials')
      return 'Email or password is incorrect.';
    if ('code' in error && error.code === 'email_not_confirmed')
      return 'Confirm your email before signing in.';
    if ('status' in error && error.status === 429)
      return 'Too many attempts. Please try again later.';
  }
  return fallback;
}
