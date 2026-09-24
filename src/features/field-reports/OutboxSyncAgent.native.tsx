import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { syncNativeOutbox } from './nativeOutbox';
import { subscribeOutboxWork } from './outboxEvents';

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
    let running = false;
    let requested = false;
    const run = async () => {
      if (!active || AppState.currentState !== 'active') return;
      if (running) {
        requested = true;
        return;
      }
      running = true;
      let again = false;
      try {
        const rows = await syncNativeOutbox(userId);
        if (!active) return;
        client.setQueryData(['field-outbox', userId], rows);
        void client.invalidateQueries({ queryKey: ['my-reports', userId] });
        again = rows.some((row) =>
          row.submissionState === 'submitted'
            ? !row.evidenceReleased
            : [
                'queued',
                'reserving',
                'uploading',
                'finalizing',
                'processing',
              ].includes(row.state) ||
              (row.state === 'failed' && row.retryable),
        );
      } catch {
        again = true;
      } finally {
        running = false;
        if (
          active &&
          AppState.currentState === 'active' &&
          (requested || again)
        ) {
          clearTimeout(timer);
          timer = setTimeout(() => void run(), requested ? 0 : backoff);
          backoff = Math.min(backoff * 2, 60_000);
        }
        requested = false;
      }
    };
    const wake = () => {
      clearTimeout(timer);
      backoff = 5_000;
      void run();
    };
    const unsubscribe = subscribeOutboxWork((owner) => {
      if (owner === userId) wake();
    });
    void run();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        wake();
      } else clearTimeout(timer);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      listener.remove();
      unsubscribe();
    };
  }, [client, offline, userId]);
  return null;
}
