import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';

import {
  getConfirmationClient,
  loadConfirmationActivities,
} from './confirmationService';
import { getNativeOutbox } from './nativeOutbox';
import { subscribeOutboxChanges } from './outboxEvents';

function PrimaryAction({
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
      style={[styles.primary, disabled && styles.disabled]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function AccountConfirmation({
  userId,
  captureId,
}: {
  userId: string;
  captureId: string;
}) {
  const auth = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeOutboxChanges((owner, id) => {
      if (owner === userId && id === captureId)
        void client.invalidateQueries({
          queryKey: ['confirmation', userId, captureId],
        });
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [client, userId, captureId]);
  const [editedText, setEditedText] = useState<string>();
  const [editedWorkDate, setEditedWorkDate] = useState<string>();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const local = useQuery({
    queryKey: ['confirmation', userId, captureId],
    networkMode: 'always',
    queryFn: async () => {
      const record = await (
        await getNativeOutbox()
      )
        .list(userId)
        .then((rows) =>
          rows.find((candidate) => candidate.captureId === captureId),
        );
      if (!record) throw new Error('This saved report is unavailable.');
      return record;
    },
  });
  const record = local.data;
  const activities = useQuery({
    queryKey: [
      'confirmation-activities',
      userId,
      record?.projectId,
      record?.reportId,
    ],
    enabled: !!record && !auth.offline,
    queryFn: ({ signal }) =>
      loadConfirmationActivities(getConfirmationClient(), record!, signal),
  });

  async function submitConfirmed() {
    if (!record || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const outbox = await getNativeOutbox();
      const selected = activities.data?.find(
        (activity) => activity.id === activityId,
      );
      const confirmed = await outbox.confirm(
        userId,
        captureId,
        {
          text,
          workDate: workDate || null,
          activityId,
        },
        selected
          ? `${selected.externalId} · ${selected.name}`
          : record.confirmedActivityLabel,
      );
      if (!mounted.current) return;
      client.setQueryData(['confirmation', userId, captureId], confirmed);
      setChecked(false);
      if (auth.offline) {
        setMessage(
          'Confirmation saved on this device. It will send after reconnecting.',
        );
      } else {
        const result = await outbox.sync(userId, captureId, {
          includePaused: true,
        });
        if (!mounted.current) return;
        client.setQueryData(['confirmation', userId, captureId], result);
        if (result.submissionState === 'submitted') {
          setMessage('Sent for review. Planner acceptance is still pending.');
          await local.refetch();
        } else {
          setMessage(
            result.submissionRejected
              ? 'Check the activity and confirm the corrected report.'
              : 'Your confirmed wording is saved and locked until its receipt is verified.',
          );
          await local.refetch();
        }
      }
    } catch (reason) {
      if (!mounted.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not save this confirmation.',
      );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function retry() {
    if (!record || busyRef.current || auth.offline) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await (
        await getNativeOutbox()
      ).sync(userId, captureId, {
        includePaused: true,
      });
      if (!mounted.current) return;
      client.setQueryData(['confirmation', userId, captureId], result);
      setMessage(
        result.submissionState === 'submitted'
          ? 'Sent for review. Planner acceptance is still pending.'
          : 'Receipt is still pending. Your confirmed wording remains locked.',
      );
      await local.refetch();
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : 'Retry failed.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (local.isPending)
    return (
      <ShellPage title="Check your report" eyebrow="FIELD · CHECK">
        <ActivityIndicator color="#266b8c" />
        <Text style={shellStyles.body}>Loading saved report…</Text>
      </ShellPage>
    );
  if (local.error || !record)
    return (
      <ShellPage title="Check your report" eyebrow="FIELD · CHECK">
        <BackButton />
        <Text accessibilityRole="alert" style={styles.error}>
          This saved report is unavailable for this account.
        </Text>
      </ShellPage>
    );

  const locked =
    record.submissionState !== 'unconfirmed' && !record.submissionRejected;
  const submitted = record.submissionState === 'submitted';
  const text =
    (locked ? record.confirmedPayload?.text : undefined) ??
    editedText ??
    record.confirmedPayload?.text ??
    (record.kind === 'voice' ? (record.originalTranscript ?? '') : record.text);
  const workDate = locked
    ? (record.confirmedPayload?.workDate ?? '')
    : (editedWorkDate ?? record.confirmedPayload?.workDate ?? '');
  const activityId = locked
    ? (record.confirmedPayload?.activityId ?? null)
    : selectedActivityId !== undefined
      ? selectedActivityId
      : (record.confirmedPayload?.activityId ?? null);
  const ready =
    record.submissionRejected ||
    (record.kind === 'report' && record.manifest.files.length === 0) ||
    (record.state === 'needs_confirmation' &&
      (record.kind !== 'voice' || !!record.originalTranscript));

  return (
    <ShellPage title="Check your report" eyebrow="FIELD · CHECK · SEND">
      <BackButton />
      <Text style={shellStyles.body}>{record.projectName}</Text>
      {auth.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · You can save this confirmation now. Sending resumes after
          reconnecting.
        </Text>
      )}
      {(submitted || record.submissionRejected || !!message) && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {submitted
            ? 'Sent for review. Planner acceptance is still pending.'
            : record.submissionRejected
              ? 'Check the activity and confirm the corrected report.'
              : message}
        </Text>
      )}
      {!!((submitted ? '' : error) || record.lastError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {(submitted ? '' : error) || record.lastError}
        </Text>
      )}
      {record.kind === 'voice' && (
        <View style={shellStyles.card}>
          <Text style={styles.label}>Original voice transcript</Text>
          <Text style={styles.quote}>
            {record.originalTranscript || 'Verified transcript not available.'}
          </Text>
          <Text style={styles.help}>
            Check names, dates, quantities and words such as “not.” The edited
            wording below is what will be submitted.
          </Text>
        </View>
      )}
      {!ready && !locked ? (
        <View style={shellStyles.card}>
          <Text style={shellStyles.cardTitle}>Still preparing evidence</Text>
          <Text style={shellStyles.body}>
            Return to My reports and sync until verified media is ready.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Confirmed report wording</Text>
          <TextInput
            accessibilityLabel="Confirmed report wording"
            editable={!locked && !busy}
            multiline
            maxLength={10_000}
            onChangeText={setEditedText}
            placeholder="Describe completed quantities and anything unfinished."
            style={[styles.input, styles.multiline, locked && styles.locked]}
            value={text}
          />
          <Text style={styles.help}>
            State partial or unfinished work explicitly, for example “2 of 8
            complete; 6 remain unfinished.”
          </Text>

          <Text style={styles.label}>Work date</Text>
          <TextInput
            accessibilityLabel="Work date"
            editable={!locked && !busy}
            onChangeText={setEditedWorkDate}
            placeholder="YYYY-MM-DD (optional)"
            style={[styles.input, locked && styles.locked]}
            value={workDate}
          />
          {!workDate && <Text style={styles.help}>Not recorded</Text>}

          <Text style={styles.label}>Activity</Text>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: activityId === null }}
            disabled={locked || busy}
            onPress={() => setSelectedActivityId(null)}
            style={[styles.choice, activityId === null && styles.selected]}
          >
            <Text style={styles.choiceTitle}>Not selected</Text>
            <Text style={styles.help}>
              Planner matching will use the wording.
            </Text>
          </Pressable>
          {!auth.offline && activities.isPending && (
            <Text style={styles.help}>Loading authorized activities…</Text>
          )}
          {activityId &&
            !activities.data?.some(
              (activity) => activity.id === activityId,
            ) && (
              <View style={[styles.choice, styles.selected]}>
                <Text style={styles.choiceTitle}>Selected activity</Text>
                <Text style={styles.help}>
                  {record.confirmedActivityLabel || activityId}
                </Text>
                <Text style={styles.help}>
                  Saved selection. Current activity details are unavailable.
                </Text>
              </View>
            )}
          {activities.data?.map((activity) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: activityId === activity.id }}
              disabled={locked || busy}
              key={activity.id}
              onPress={() => setSelectedActivityId(activity.id)}
              style={[
                styles.choice,
                activityId === activity.id && styles.selected,
              ]}
            >
              <Text style={styles.choiceTitle}>
                {activity.externalId} · {activity.name}
              </Text>
              <Text style={styles.help}>{activity.location}</Text>
            </Pressable>
          ))}
          {activities.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              Could not load authorized activities. Leave activity unselected or
              reconnect and retry.
            </Text>
          )}

          {!locked && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              disabled={busy}
              onPress={() => setChecked((value) => !value)}
              style={styles.check}
            >
              <View style={[styles.box, checked && styles.boxChecked]} />
              <Text style={styles.checkText}>
                I checked the wording, quantities, work date and unfinished
                work.
              </Text>
            </Pressable>
          )}

          {submitted ? (
            <PrimaryAction
              label="Return to My reports"
              disabled={false}
              onPress={() => router.replace('/field/reports')}
            />
          ) : locked ? (
            <PrimaryAction
              label={busy ? 'Checking receipt…' : 'Check receipt / retry'}
              disabled={busy || auth.offline}
              onPress={() => void retry()}
            />
          ) : (
            <PrimaryAction
              label={busy ? 'Saving confirmation…' : 'Confirm and send'}
              disabled={busy || !checked || !text.trim()}
              onPress={() => void submitConfirmed()}
            />
          )}
          <Text style={styles.help}>
            Sending creates a report for review. Only an accepted planner
            decision changes project progress.
          </Text>
        </>
      )}
    </ShellPage>
  );
}

export function ConfirmationScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ captureId?: string | string[] }>();
  const captureId = Array.isArray(params.captureId)
    ? params.captureId[0]
    : params.captureId;
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : undefined;
  if (!userId || !captureId) return null;
  return (
    <AccountConfirmation
      key={`${userId}:${captureId}`}
      userId={userId}
      captureId={captureId}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#17354c',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
    color: '#17354c',
    fontSize: 16,
    padding: 14,
  },
  multiline: { minHeight: 150, textAlignVertical: 'top' },
  locked: { backgroundColor: '#e7edf0' },
  help: { color: '#586c7a', fontSize: 14, lineHeight: 22, marginTop: 6 },
  quote: { color: '#17354c', fontSize: 17, lineHeight: 27 },
  notice: {
    color: '#17354c',
    backgroundColor: '#e7edf0',
    padding: 14,
    lineHeight: 22,
    marginTop: 14,
  },
  error: { color: '#9d3434', fontSize: 15, lineHeight: 23, marginTop: 14 },
  choice: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 8,
  },
  selected: { borderColor: '#266b8c', borderWidth: 2 },
  choiceTitle: { color: '#17354c', fontSize: 15, fontWeight: '600' },
  check: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: '#627786' },
  boxChecked: { backgroundColor: '#266b8c', borderColor: '#266b8c' },
  checkText: { flex: 1, color: '#17354c', fontSize: 15, lineHeight: 23 },
  primary: {
    minHeight: 52,
    backgroundColor: '#17354c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 20,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
