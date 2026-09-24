import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/features/localization/LocalizationProvider';
import {
  formatDate,
  LocalizedText as Text,
  LocalizedPressable as Pressable,
  LocalizedTextInput as TextInput,
} from '@/features/localization/LocalizedText';
import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';
import { getSupabase } from '@/lib/supabase';

import { FollowupWriteError, decideVerification } from './followupService';
import { stableCommand } from './reviewContracts';
import { useVerificationAssignments } from './useFollowups';

import type { AttestationCommand } from './followupContracts';
import type { StableCommand } from './reviewContracts';
import type { Href } from 'expo-router';

type CheckValue = 'confirmed' | 'denied' | 'needs_info';
type AttestationPayload = Omit<AttestationCommand, 'commandId'>;

const checkChoices: { value: CheckValue; label: string }[] = [
  { value: 'confirmed', label: 'Confirm' },
  { value: 'denied', label: 'Cannot confirm' },
  { value: 'needs_info', label: 'Need details' },
];

function statusLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export function VerificationListScreen() {
  useLocalization();
  const router = useRouter();
  const { project, assignments, refresh } = useVerificationAssignments();
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const error = project.error || assignments.error;
  const data = assignments.data;
  return (
    <ShellPage title="Supervisor checks" eyebrow="FIELD · INDEPENDENT CHECK">
      <BackButton />
      <Text style={shellStyles.body}>
        Check assignment authority and the reported work separately. A check
        never approves schedule progress.
      </Text>
      {project.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Connect to load current supervisor checks.
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Checks unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending || assignments.isPending ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'Connect to load assigned checks.'
              : 'Loading assigned supervisor checks…'}
          </Text>
        </View>
      ) : !project.data ? (
        <Text style={styles.notice}>No active project is selected.</Text>
      ) : !data?.length ? (
        <Text style={styles.empty}>
          No supervisor checks are assigned to you in this project.
        </Text>
      ) : (
        data.map((item) => (
          <Pressable
            key={item.request.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/field-verifications/[requestId]',
                params: { requestId: item.request.id },
              } as unknown as Href)
            }
            style={shellStyles.card}
          >
            <View style={styles.row}>
              <Text style={styles.status}>
                {statusLabel(item.request.status)}
              </Text>
              <Text style={styles.detail}>
                {formatDate(item.request.created_at)}
              </Text>
            </View>
            <Text accessibilityRole="header" style={shellStyles.cardTitle}>
              {item.activity
                ? `${item.activity.externalId} · ${item.activity.name}`
                : `Activity ${item.request.activity_id.slice(0, 8)}`}
            </Text>
            <Text style={shellStyles.body}>
              Reported by {item.reporterName}
            </Text>
            <Text numberOfLines={3} style={styles.quote}>
              “{item.claim.facts.evidenceQuote}”
            </Text>
            <Text style={styles.link}>Open supervisor check</Text>
          </Pressable>
        ))
      )}
    </ShellPage>
  );
}

function CheckChoices({
  title,
  name,
  value,
  disabled,
  setValue,
}: {
  title: string;
  name: string;
  value: CheckValue | '';
  disabled: boolean;
  setValue: (value: CheckValue) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      <Text style={styles.question}>{title}</Text>
      {checkChoices.map((choice) => (
        <Pressable
          key={choice.value}
          accessibilityLabel={`${name}: ${choice.label}`}
          accessibilityRole="radio"
          accessibilityState={{
            selected: value === choice.value,
            disabled,
          }}
          disabled={disabled}
          onPress={() => setValue(choice.value)}
          style={[
            styles.choice,
            value === choice.value && styles.selectedChoice,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.choiceText}>{choice.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function VerificationScreen({ requestId }: { requestId: string }) {
  const { project, assignments, refresh, finish } =
    useVerificationAssignments();
  const [allocation, setAllocation] = useState<CheckValue | ''>('');
  const [work, setWork] = useState<CheckValue | ''>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const command = useRef<StableCommand<AttestationPayload> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const item = assignments.data?.find(
    (candidate) => candidate.request.id === requestId,
  );
  const actionable =
    item &&
    item.requestIsCurrent &&
    ['open', 'needs_info'].includes(item.request.status);
  const complete = !!allocation && !!work && !!reason.trim();

  async function submit() {
    const client = getSupabase();
    if (
      !item ||
      project.offline ||
      !allocation ||
      !work ||
      !reason.trim() ||
      !client ||
      busy
    )
      return;
    const payload: AttestationPayload = {
      expectedVersion: item.request.version,
      allocation,
      work,
      reason: reason.trim(),
    };
    const stable = stableCommand(command.current, payload, randomUUID);
    command.current = stable;
    setBusy(true);
    setMessage('');
    try {
      await decideVerification(client, item.request.id, {
        ...stable.payload,
        commandId: stable.id,
      });
      setAllocation('');
      setWork('');
      setReason('');
      command.current = null;
      setMessage(
        'Supervisor check recorded. The planner still makes the schedule decision separately.',
      );
      await finish();
    } catch (error) {
      setMessage(
        error instanceof FollowupWriteError
          ? `${error.message} Your entered details remain here.`
          : 'Could not confirm receipt. Your entered details remain here; retry to check the same request.',
      );
      if (error instanceof FollowupWriteError && error.kind === 'stale')
        await refresh();
    } finally {
      setBusy(false);
    }
  }

  const error = project.error || assignments.error;
  return (
    <ShellPage title="Supervisor check" eyebrow="FIELD · INDEPENDENT EVIDENCE">
      <BackButton />
      {project.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Connect before recording a supervisor check.
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Check unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending || assignments.isPending ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>Loading current evidence…</Text>
        </View>
      ) : !item ? (
        <Text style={styles.notice}>
          This check is no longer assigned to your account in the selected
          project.
        </Text>
      ) : (
        <>
          <View style={shellStyles.card}>
            <View style={styles.row}>
              <Text style={styles.status}>
                {statusLabel(item.request.status)}
              </Text>
              <Text style={styles.detail}>Version {item.request.version}</Text>
            </View>
            <Text accessibilityRole="header" style={shellStyles.cardTitle}>
              {!item.scheduleIsCurrent
                ? 'Schedule changed since this check was assigned'
                : !item.requestIsCurrent
                  ? 'Evidence changed since this check was assigned'
                  : item.activity
                    ? `${item.activity.externalId} · ${item.activity.name}`
                    : 'Activity unavailable in the active schedule'}
            </Text>
            <Text style={styles.detail}>Reported by {item.reporterName}</Text>
            <Text style={styles.detail}>
              Location: {item.claim.facts.location ?? 'Not recorded'} · Work
              date: {item.claim.facts.eventDate ?? 'Not recorded'}
            </Text>
            <Text selectable style={styles.source}>
              {item.original.source_text}
            </Text>
            <Text style={styles.quote}>“{item.claim.facts.evidenceQuote}”</Text>
          </View>
          <Text style={styles.notice}>
            Confirm each point separately. Assignment authority does not prove
            completion, and this check does not accept the claim.
          </Text>
          {!item.requestIsCurrent && (
            <Text accessibilityRole="alert" style={styles.notice}>
              The claim, report, policy, assignment, or schedule changed after
              this check was assigned. It is read-only. Ask the planner for a
              fresh check against the current evidence.
            </Text>
          )}
          {item.decisions.map((decision) => (
            <View key={decision.id} style={styles.history}>
              <Text style={styles.historyTitle}>
                Earlier check · request version {decision.request_version}
              </Text>
              <Text style={styles.detail}>
                Assignment: {statusLabel(decision.allocation)} · Work:{' '}
                {statusLabel(decision.work)}
              </Text>
              <Text style={styles.detail}>{decision.reason}</Text>
            </View>
          ))}
          {actionable ? (
            <View style={styles.form}>
              <CheckChoices
                title="Was this reporter assigned or authorized to carry out work on this activity?"
                name="Assignment check"
                value={allocation}
                disabled={busy}
                setValue={setAllocation}
              />
              <CheckChoices
                title="Can you confirm this exact reported work and date?"
                name="Work check"
                value={work}
                disabled={busy}
                setValue={setWork}
              />
              <TextInput
                accessibilityLabel="Reason and evidence checked"
                editable={!busy}
                multiline
                maxLength={1000}
                onChangeText={setReason}
                placeholder="Record what you checked and why"
                style={styles.input}
                value={reason}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: project.offline || busy || !complete,
                }}
                disabled={project.offline || busy || !complete}
                onPress={() => void submit()}
                style={[
                  styles.primaryButton,
                  (project.offline || busy || !complete) && styles.disabled,
                ]}
              >
                <Text style={styles.primaryText}>Record supervisor check</Text>
              </Pressable>
            </View>
          ) : item.requestIsCurrent ? (
            <Text style={styles.notice}>
              This recorded check is retained. The planner makes the schedule
              decision separately.
            </Text>
          ) : null}
        </>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  notice: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    padding: 14,
    marginVertical: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  empty: {
    color: '#627786',
    paddingVertical: 28,
    fontSize: 16,
    lineHeight: 25,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  status: {
    color: '#266b8c',
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  source: { color: '#17354c', fontSize: 16, lineHeight: 26 },
  quote: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  link: { color: '#266b8c', fontSize: 15, lineHeight: 24, fontWeight: '600' },
  history: {
    borderBottomWidth: 1,
    borderBottomColor: '#d7e0e5',
    paddingVertical: 14,
    gap: 5,
  },
  historyTitle: {
    color: '#17354c',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  form: { gap: 18, marginTop: 10 },
  group: { gap: 8 },
  question: {
    color: '#17354c',
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '600',
  },
  choice: {
    minHeight: 48,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
  },
  selectedChoice: { borderColor: '#266b8c', backgroundColor: '#e8eff3' },
  choiceText: { color: '#17354c', fontSize: 15, lineHeight: 23 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
    color: '#17354c',
    padding: 13,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#17354c',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  message: {
    color: '#17354c',
    backgroundColor: '#fff2d9',
    padding: 14,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
  },
});
