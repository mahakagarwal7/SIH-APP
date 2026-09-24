import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { needsReportPolling, nextReportPollDelay } from './reportStatus';

import type { RemoteReport } from './myReportsService';

type RefetchResult = { data?: RemoteReport[] };

export function useReportStatusPolling({
  enabled,
  focused,
  refetch,
}: {
  enabled: boolean;
  focused: boolean;
  refetch: () => Promise<RefetchResult>;
}) {
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !focused || !foreground) return;
    let stopped = false;
    let delay = 5_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(async () => {
        let keepPolling = true;
        try {
          const result = await refetch();
          if (result.data) keepPolling = needsReportPolling(result.data);
        } catch {
          // React Query retains the last honest status; a later bounded retry
          // can recover without replacing it with an invented state.
        }
        if (stopped || !keepPolling) return;
        delay = nextReportPollDelay(delay);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled, focused, foreground, refetch]);
}
