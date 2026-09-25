import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { OutboxSyncAgent } from '@/features/field-reports/OutboxSyncAgent';

import { warnInDevelopment } from './devLog';

import type { ReactNode } from 'react';

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        warnInDevelopment(
          `Query failed: ${JSON.stringify(query.queryKey)}`,
          error,
        ),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        warnInDevelopment(
          `Mutation failed: ${JSON.stringify(mutation.options.mutationKey ?? ['unkeyed'])}`,
          error,
        ),
    }),
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 5 * 60_000 },
    },
  });
}

function SessionCache({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <OutboxSyncAgent />
      {children}
    </QueryClientProvider>
  );
}

export function ServerStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : null;
  useEffect(() => {
    onlineManager.setOnline(!auth.offline);
  }, [auth.offline]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  // Auth changes replace the entire cache synchronously. In-flight requests consume its abort signals.
  return <SessionCache key={userId ?? 'signed-out'}>{children}</SessionCache>;
}
