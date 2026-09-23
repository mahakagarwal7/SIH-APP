import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { syncNativeOutbox } from './nativeOutbox';

export function OutboxSyncAgent() {
  const auth = useAuth();
  const client = useQueryClient();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : null;
  const offline = auth.offline;
  useEffect(() => {
    if (!userId || offline) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 5_000;
    const run = async () => {
      if (!active || AppState.currentState !== 'active') return;
      try {
        const rows = await syncNativeOutbox(userId);
        if (!active) return;
        client.setQueryData(['field-outbox', userId], rows);
        void client.invalidateQueries({ queryKey: ['my-reports', userId] });
        const processing = rows.some((row) =>
          [
            'queued',
            'reserving',
            'uploading',
            'finalizing',
            'processing',
          ].includes(row.state),
        );
        if (processing) {
          timer = setTimeout(() => void run(), backoff);
          backoff = Math.min(backoff * 2, 60_000);
        }
      } catch {
        if (active)
          timer = setTimeout(() => void run(), Math.min(backoff, 60_000));
      }
    };
    void run();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        backoff = 5_000;
        void run();
      } else clearTimeout(timer);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      listener.remove();
    };
  }, [client, offline, userId]);
  return null;
}
