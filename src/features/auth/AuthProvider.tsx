import { createContext, useContext } from 'react';

import { useAuthSession } from './useAuthSession';

import type { AuthViewState } from './useAuthSession';
import type { ReactNode } from 'react';

export type { AuthViewState } from './useAuthSession';

const AuthContext = createContext<AuthViewState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider.');
  return auth;
}
