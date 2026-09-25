import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useLocalization } from '@/features/localization/LocalizationProvider';
import {
  formatDateTime,
  LocalizedText as Text,
  LocalizedPressable as Pressable,
} from '@/features/localization/LocalizedText';
import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

import {
  getReportsClient,
  loadRemoteReports,
  mergeMyReports,
} from './myReportsService';
import { getVoiceDraftStore } from './nativeDraftStore';
import {
  getNativeOutbox,
  prepareLocalOutbox,
  syncNativeOutbox,
} from './nativeOutbox';
import { getReportDraftStore } from './nativeReportDraftStore';
import { needsReportPolling } from './reportStatus';
import { useReportStatusPolling } from './useReportStatusPolling';

import type { Href } from 'expo-router';

function Action({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AccountReports({ userId }: { userId: string }) {
  useLocalization();
  const auth = useAuth();
  const router = useRouter();
  const mounted = useRef(true);
  const syncingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [message, setMessage] = useState('');
  const local = useQuery({
    queryKey: ['my-reports', userId, 'local'],
    networkMode: 'always',
    queryFn: async () => {
      const preparation = await prepareLocalOutbox(userId);
      const [voice, reports, outbox] = await Promise.all([
        (await getVoiceDraftStore()).list(userId),
        (await getReportDraftStore()).list(userId),
        (await getNativeOutbox()).list(userId),
      ]);
      return { voice, reports, outbox, preparation };
    },
  });
  const remote = useQuery({
    queryKey: ['my-reports', userId, 'remote'],
    enabled: !auth.offline,
    queryFn: ({ signal }) =>
      loadRemoteReports(getReportsClient(), userId, signal),
  });
  const localRefetch = local.refetch;
  const remoteRefetch = remote.refetch;
  const pollingRequired = needsReportPolling(remote.data ?? []);
  useReportStatusPolling({
    enabled: !auth.offline && pollingRequired,
    focused,
    refetch: remoteRefetch,
  });
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      setFocused(true);
      void localRefetch();
      if (!auth.offline) void remoteRefetch();
      return () => {
        setFocused(false);
      };
    }, [auth.offline, localRefetch, remoteRefetch]),
  );
  const items = useMemo(
    () =>
      mergeMyReports(
        local.data?.voice ?? [],
        local.data?.reports ?? [],
        local.data?.outbox ?? [],
        remote.data ?? [],
      ),
    [local.data, remote.data],
  );

  async function sync() {
    if (
      syncingRef.current ||
      auth.offline ||
      AppState.currentState !== 'active'
    )
      return;
    syncingRef.current = true;
    setSyncing(true);
    setMessage('Syncing saved reports…');
    try {
      await syncNativeOutbox(userId, { includePaused: true });
      await localRefetch();
      await remoteRefetch();
      if (mounted.current)
        setMessage(
          'Sync pass finished. Delivery status will update while the app remains open.',
        );
    } catch {
      if (mounted.current)
        setMessage('Sync could not start. Saved device copies are unchanged.');
    } finally {
      syncingRef.current = false;
      if (mounted.current) setSyncing(false);
    }
  }

  return (
    <ShellPage title="My reports" eyebrow="FIELD · DELIVERY STATUS">
      <Text style={shellStyles.body}>
        Saved, processing, submitted and accepted are separate stages.
      </Text>
      <View style={styles.toolbar}>
        <Action
          label={syncing ? 'Syncing…' : 'Sync now'}
          disabled={syncing || auth.offline}
          onPress={() => void sync()}
        />
        <Action
          label="Refresh"
          disabled={local.isFetching || remote.isFetching}
          onPress={() => {
            void localRefetch();
            if (!auth.offline) void remoteRefetch();
          }}
        />
      </View>
      {auth.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Showing saved device reports and the last loaded server
          status. Sync resumes in the foreground after reconnecting.
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      )}
      {!auth.offline && remote.isFetching && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          Checking production report status…
        </Text>
      )}
      {!auth.offline && !remote.isFetching && remote.dataUpdatedAt > 0 && (
        <Text style={styles.checked}>
          Last checked {new Date(remote.dataUpdatedAt).toLocaleTimeString()}
          {pollingRequired ? ' · Automatic checks active' : ''}
        </Text>
      )}
      {local.data?.preparation.unavailable ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {local.data.preparation.unavailable} local draft could not be prepared
          for sync because its saved evidence is incomplete.
        </Text>
      ) : null}
      {remote.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          Could not refresh production status. Saved device copies are
          unchanged.
        </Text>
      )}
      {local.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#266b8c" />
          <Text style={shellStyles.body}>Loading saved reports…</Text>
        </View>
      ) : local.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Could not read saved reports from this device.
        </Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No reports saved or submitted yet.</Text>
      ) : (
        items.map((item) => (
          <View key={item.captureId} style={shellStyles.card}>
            <Text style={styles.status}>{item.status}</Text>
            <Text accessibilityRole="header" style={shellStyles.cardTitle}>
              {item.projectName}
            </Text>
            {!!item.summary && (
              <Text numberOfLines={4} style={shellStyles.body}>
                {item.summary}
              </Text>
            )}
            <Text style={styles.detail}>
              {item.kind === 'voice'
                ? 'Voice report'
                : item.kind === 'remote'
                  ? 'Production report'
                  : 'Text/photo report'}{' '}
              ·{' '}
              {item.mediaCount === null
                ? 'Attachment count unavailable'
                : `${item.mediaCount} ${item.mediaCount === 1 ? 'file' : 'files'}`}
            </Text>
            <Text style={styles.detail}>{formatDateTime(item.createdAt)}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
            {item.canOpenConfirmation && (
              <Action
                label={item.canConfirm ? 'Check and send' : 'View confirmation'}
                disabled={false}
                onPress={() =>
                  router.push({
                    pathname: '/field-confirm/[captureId]',
                    params: { captureId: item.captureId },
                  } as Href)
                }
              />
            )}
            {item.canOpen && item.reportId && (
              <Action
                label="Open report and questions"
                disabled={false}
                onPress={() =>
                  router.push({
                    pathname: '/field-report/[reportId]',
                    params: { reportId: item.reportId! },
                  } as unknown as Href)
                }
              />
            )}
            {item.canSync && (
              <Text style={styles.retry}>Use Sync now to retry this item.</Text>
            )}
          </View>
        ))
      )}
    </ShellPage>
  );
}

export function MyReportsScreen() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : null;
  return userId ? <AccountReports key={userId} userId={userId} /> : null;
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 16,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
  },
  actionText: { color: '#266b8c', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  notice: {
    backgroundColor: '#e7edf0',
    color: '#17354c',
    padding: 14,
    marginBottom: 16,
    lineHeight: 22,
  },
  message: { color: '#17354c', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  error: { color: '#9d3434', fontSize: 15, lineHeight: 23, marginBottom: 12 },
  loading: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  empty: { color: '#586c7a', paddingVertical: 28, fontSize: 16 },
  status: { color: '#266b8c', fontWeight: '700', fontSize: 13, lineHeight: 21 },
  detail: { color: '#627786', fontSize: 13, lineHeight: 21 },
  retry: { color: '#76541d', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  checked: { color: '#627786', fontSize: 12, lineHeight: 20, marginBottom: 12 },
});
