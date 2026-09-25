import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useToast } from '@/components/ToastProvider';
import { WorkDatePicker } from '@/components/WorkDatePicker';
import {
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

import {
  DecisionWriteError,
  previewDecision,
  requestClarification,
  requestVerification,
  submitDecision,
} from './decisionService';
import {
  candidateReasons,
  stableCommand,
  validWorkDate,
} from './reviewContracts';
import { useDecisionContext } from './useDecisionContext';

import type {
  DecisionCommand,
  DecisionPreview,
  StableCommand,
} from './reviewContracts';

type BaseDecision = Omit<DecisionCommand, 'commandId' | 'previewHash'>;
type ReasonCode = 'location' | 'date' | 'scope' | 'assignment' | 'detail';

const clarificationReasons: { code: ReasonCode; label: string }[] = [
  { code: 'location', label: 'Work location' },
  { code: 'date', label: 'Work date' },
  { code: 'scope', label: 'Complete or partial scope' },
  { code: 'assignment', label: 'Assignment authority' },
  { code: 'detail', label: 'Other unfinished detail' },
];

function display(value: string | number | null) {
  return value === null || value === '' ? 'Not recorded' : String(value);
}

function errorMessage(error: unknown) {
  return error instanceof DecisionWriteError
    ? error.message
    : 'Could not confirm the response. Retry the same action to check its recorded result.';
}

function ChangePreview({
  preview,
  unit,
}: {
  preview: DecisionPreview;
  unit: string | null;
}) {
  const fields: {
    key: keyof DecisionPreview['before'];
    label: string;
  }[] = [
    { key: 'actual_start', label: 'Actual start' },
    { key: 'actual_finish', label: 'Actual finish' },
    { key: 'accepted_quantity', label: 'Accepted quantity' },
    { key: 'accepted_percent', label: 'Accepted progress' },
    { key: 'percent_basis', label: 'Progress basis' },
    { key: 'milestone_date', label: 'Milestone date' },
    { key: 'progress_as_of', label: 'Progress as of' },
  ];
  return (
    <View style={styles.preview} accessibilityLabel="Proposed schedule change">
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Proposed schedule change
      </Text>
      <Text style={styles.detail}>
        {preview.activityName} · {preview.disposition}
      </Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.fieldCell]}>Field</Text>
        <Text style={styles.tableCell}>Before</Text>
        <Text style={styles.tableCell}>After</Text>
      </View>
      {fields.map(({ key, label }) => (
        <View key={key} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.fieldCell]}>{label}</Text>
          <Text style={styles.tableCell}>
            {key === 'accepted_quantity'
              ? `${display(preview.before[key])} ${unit || '(unit not recorded)'}`
              : key === 'accepted_percent' && preview.before[key] !== null
                ? `${preview.before[key]}%`
                : display(preview.before[key])}
          </Text>
          <Text style={styles.tableCell}>
            {key === 'accepted_quantity'
              ? `${display(preview.after[key])} ${unit || '(unit not recorded)'}`
              : key === 'accepted_percent' && preview.after[key] !== null
                ? `${preview.after[key]}%`
                : display(preview.after[key])}
          </Text>
        </View>
      ))}
      <Text style={styles.detail}>
        Quantity and progress fields are recorded facts. They do not by
        themselves mark the activity complete.
      </Text>
    </View>
  );
}

export function DecisionScreen({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const { project, decision, refresh, finish, authorized } =
    useDecisionContext(claimId);
  const canWrite = !project.offline;
  const [activityId, setActivityId] = useState('');
  const [reason, setReason] = useState('');
  const [correctedDate, setCorrectedDate] = useState('');
  const [reconciliation, setReconciliation] = useState<'apply' | 'corroborate'>(
    'apply',
  );
  const [reasonCode, setReasonCode] = useState<ReasonCode>('detail');
  const [preview, setPreview] = useState<{
    data: DecisionPreview;
    command: DecisionCommand;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const decisionCommand = useRef<StableCommand<BaseDecision> | null>(null);
  const previewRequest = useRef(0);
  const clarificationCommand = useRef<StableCommand<{
    expectedClaimVersion: number;
    reasonCode: ReasonCode;
  }> | null>(null);
  const verificationCommand = useRef<StableCommand<{
    expectedClaimVersion: number;
    activityId: string;
    reason: string;
  }> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const data = decision.data;
  const selected = data?.candidates.find(
    (candidate) => candidate.activity_id === activityId,
  );
  const currentPreview =
    preview &&
    data &&
    preview.command.claimId === data.claim.id &&
    preview.command.expectedClaimVersion === data.claim.version &&
    preview.command.expectedPlanRevisionId === data.snapshot.revisionId &&
    preview.command.expectedPolicyVersion === data.snapshot.policyVersion &&
    preview.command.expectedActualsVersion ===
      (selected?.activity?.actualsVersion ?? 0)
      ? preview
      : null;
  const clearPreview = () => {
    previewRequest.current += 1;
    setPreview(null);
    setMessage('');
  };
  const leave = (removeFromQueue: boolean) => {
    finish(removeFromQueue);
    if (router.canGoBack()) router.back();
    else router.replace('/manager/review');
  };
  const makeBaseDecision = (
    action: BaseDecision['action'],
  ): DecisionCommand | null => {
    if (!data) return null;
    const payload: BaseDecision = {
      claimId: data.claim.id,
      activityId: selected?.activity_id ?? null,
      action,
      expectedReportVersion: data.claim.report_version,
      expectedRunId: data.claim.run_id,
      expectedClaimVersion: data.claim.version,
      expectedPlanRevisionId: data.snapshot.revisionId,
      expectedActualsVersion: selected?.activity?.actualsVersion ?? 0,
      expectedPolicyVersion: data.snapshot.policyVersion,
      reason: reason.trim(),
      correctedDate: action === 'reject' ? null : correctedDate.trim() || null,
      reconciliation,
      expectedVerificationId: data.verification?.id ?? null,
      expectedVerificationVersion: data.verification?.version ?? null,
    };
    const stable = stableCommand(decisionCommand.current, payload, randomUUID);
    decisionCommand.current = stable;
    return { ...stable.payload, commandId: stable.id };
  };
  const handleError = async (error: unknown) => {
    const detail = errorMessage(error);
    setMessage(detail);
    showToast(detail, 'error');
    if (error instanceof DecisionWriteError && error.kind === 'stale') {
      setPreview(null);
      await refresh();
    }
  };
  const runPreview = async () => {
    const command = makeBaseDecision('accept');
    const client = getSupabase();
    if (!canWrite || !command || !client) return;
    const requestId = ++previewRequest.current;
    setBusy(true);
    setMessage('');
    try {
      const result = await previewDecision(client, command);
      if (requestId !== previewRequest.current) return;
      setPreview({ data: result, command });
      setMessage('Check every proposed field before accepting.');
    } catch (error) {
      if (requestId === previewRequest.current) await handleError(error);
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    if (!currentPreview) {
      await runPreview();
      return;
    }
    const client = getSupabase();
    if (!canWrite || !client) return;
    setBusy(true);
    setMessage('');
    try {
      await submitDecision(client, {
        ...currentPreview.command,
        previewHash: currentPreview.data.previewHash,
      });
      showToast('Claim accepted.');
      leave(true);
    } catch (error) {
      await handleError(error);
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    const client = getSupabase();
    const command = makeBaseDecision('reject');
    if (!canWrite || !command || !client) return;
    setBusy(true);
    setMessage('');
    try {
      await submitDecision(client, command);
      showToast('Claim rejected.');
      leave(true);
    } catch (error) {
      await handleError(error);
    } finally {
      setBusy(false);
    }
  };
  const clarify = async () => {
    const client = getSupabase();
    if (!canWrite || !data || !client) return;
    const stable = stableCommand(
      clarificationCommand.current,
      { expectedClaimVersion: data.claim.version, reasonCode },
      randomUUID,
    );
    clarificationCommand.current = stable;
    setBusy(true);
    setMessage('');
    try {
      await requestClarification(client, data.claim.id, {
        ...stable.payload,
        commandId: stable.id,
      });
      leave(false);
    } catch (error) {
      await handleError(error);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    const client = getSupabase();
    if (!canWrite || !data || !selected || !client) return;
    const payload = {
      expectedClaimVersion: data.claim.version,
      activityId: selected.activity_id,
      reason: reason.trim(),
    };
    const stable = stableCommand(
      verificationCommand.current,
      payload,
      randomUUID,
    );
    verificationCommand.current = stable;
    setBusy(true);
    setMessage('');
    try {
      await requestVerification(client, data.claim.id, {
        ...stable.payload,
        commandId: stable.id,
      });
      leave(false);
    } catch (error) {
      await handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const acceptCandidate =
    selected &&
    selected.activity &&
    selected.mismatch_flags.length === 0 &&
    data?.claim.state === 'pending';
  const unresolvedFlags =
    data?.claim.validation_flags.filter(
      (flag) => flag !== 'Work date missing',
    ) ?? [];
  const needsDate =
    data?.claim.validation_flags.includes('Work date missing') ||
    !data?.claim.facts.eventDate;
  const canPreview =
    canWrite &&
    !!acceptCandidate &&
    !unresolvedFlags.length &&
    !!reason.trim() &&
    (!needsDate || validWorkDate(correctedDate));
  const canVerify =
    canWrite &&
    !!selected?.activity &&
    selected.mismatch_flags.length === 0 &&
    !data?.claim.validation_flags.length &&
    !!data &&
    ['pending', 'verification', 'disputed'].includes(data.claim.state) &&
    !!reason.trim() &&
    (!data.verification ||
      (data.verification.status === 'denied' &&
        project.data?.member.role === 'manager'));
  const dateValid = !correctedDate || validWorkDate(correctedDate);
  const error = project.error || decision.error;

  return (
    <ShellPage title="Review decision" eyebrow="MANAGER · CONTROLLED CHANGE">
      <BackButton />
      {project.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Decisions require a current production connection.
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Decision unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending || decision.isPending ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'Connect to load current claim and schedule versions.'
              : 'Loading the current evidence and schedule versions…'}
          </Text>
        </View>
      ) : !project.data || !authorized ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Manager access required
          </Text>
          <Text style={shellStyles.body}>
            An active planner or manager membership is required to decide
            claims.
          </Text>
        </View>
      ) : !data ? (
        <View style={styles.state}>
          <Text style={shellStyles.body}>
            This claim is no longer available for review.
          </Text>
        </View>
      ) : (
        <>
          <View style={shellStyles.card}>
            <Text style={styles.identifier}>
              FR-{data.report.id.slice(0, 8).toUpperCase()} ·{' '}
              {data.claim.facts.kind.replaceAll('_', ' ')}
            </Text>
            <Text accessibilityRole="header" style={shellStyles.cardTitle}>
              Original field report
            </Text>
            <Text selectable style={styles.source}>
              {data.original.source_text}
            </Text>
            <Text style={styles.detail}>
              {data.reporterName} · State: {data.claim.state}
            </Text>
            <Text style={styles.quote}>“{data.claim.facts.evidenceQuote}”</Text>
            {data.claim.validation_flags.map((flag) => (
              <Text key={flag} style={styles.flag}>
                {flag}
              </Text>
            ))}
          </View>

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Choose the exact activity
          </Text>
          <Text style={styles.detail}>
            A match score ranks candidates; it is not a probability or proof of
            completion.
          </Text>
          {data.candidates.map((candidate) => (
            <Pressable
              key={candidate.activity_id}
              accessibilityRole="radio"
              accessibilityState={{
                selected: activityId === candidate.activity_id,
                disabled: busy,
              }}
              disabled={busy}
              onPress={() => {
                setActivityId(candidate.activity_id);
                clearPreview();
              }}
              style={[
                styles.candidate,
                activityId === candidate.activity_id &&
                  styles.selectedCandidate,
              ]}
            >
              <Text style={styles.candidateTitle}>
                {candidate.activity
                  ? `${candidate.activity.externalId} · ${candidate.activity.name}`
                  : `Activity ${candidate.activity_id.slice(0, 8)} is unavailable in the active schedule`}
              </Text>
              <Text style={styles.detail}>
                Rank {candidate.rank} · Match score{' '}
                {Math.round(candidate.score * 100)}%
              </Text>
              {candidateReasons(candidate).map((matchReason) => (
                <Text key={matchReason} style={styles.detail}>
                  • {matchReason}
                </Text>
              ))}
            </Pressable>
          ))}

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Decision reason
          </Text>
          <TextInput
            accessibilityLabel="Decision reason"
            editable={!busy}
            multiline
            maxLength={1000}
            onChangeText={(value) => {
              setReason(value);
              clearPreview();
            }}
            placeholder="Record why this decision is supported by the evidence"
            style={styles.input}
            value={reason}
          />
          <WorkDatePicker
            disabled={busy}
            label="Corrected work date"
            onChange={(value) => {
              setCorrectedDate(value ?? '');
              clearPreview();
            }}
            required={needsDate}
            value={correctedDate || null}
          />
          {['ITEM_PROGRESS', 'PERCENT_PROGRESS'].includes(
            data.claim.facts.kind,
          ) && (
            <View style={styles.optionRow}>
              {(['apply', 'corroborate'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: reconciliation === value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    setReconciliation(value);
                    clearPreview();
                  }}
                  style={[
                    styles.option,
                    reconciliation === value && styles.selectedOption,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.optionText}>
                    {value === 'apply'
                      ? 'Apply as progress'
                      : 'Equivalent reading already recorded'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {data.verification && (
            <Text style={styles.notice}>
              Supervisor check: {data.verification.status} · version{' '}
              {data.verification.version}
            </Text>
          )}
          {currentPreview && (
            <ChangePreview
              preview={currentPreview.data}
              unit={selected?.activity?.unit ?? null}
            />
          )}
          {message && (
            <Text accessibilityRole="alert" style={styles.message}>
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: busy || !canPreview || !dateValid,
              }}
              disabled={busy || !canPreview || !dateValid}
              onPress={() => void runPreview()}
              style={[
                styles.secondaryButton,
                (busy || !canPreview || !dateValid) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Preview change</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: busy || !canPreview || !dateValid,
              }}
              disabled={busy || !canPreview || !dateValid}
              onPress={() => void accept()}
              style={[
                styles.primaryButton,
                (busy || !canPreview || !dateValid) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                {currentPreview
                  ? 'Confirm acceptance'
                  : 'Review before acceptance'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: busy || !canWrite || !reason.trim(),
              }}
              disabled={busy || !canWrite || !reason.trim()}
              onPress={() => void reject()}
              style={[
                styles.dangerButton,
                (busy || !canWrite || !reason.trim()) && styles.disabled,
              ]}
            >
              <Text style={styles.dangerText}>Reject claim</Text>
            </Pressable>
          </View>

          <View style={styles.followup}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Resolve uncertainty
            </Text>
            <Text style={styles.detail}>
              Ask the reporter one specific question.
            </Text>
            <View style={styles.optionRow}>
              {clarificationReasons.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: reasonCode === item.code,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => setReasonCode(item.code)}
                  style={[
                    styles.option,
                    reasonCode === item.code && styles.selectedOption,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !canWrite }}
              disabled={busy || !canWrite}
              onPress={() => void clarify()}
              style={[
                styles.secondaryButton,
                (busy || !canWrite) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Ask reporter</Text>
            </Pressable>
            <Text style={styles.detail}>
              A supervisor check is independent evidence and does not accept the
              claim.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !canVerify }}
              disabled={busy || !canVerify}
              onPress={() => void verify()}
              style={[
                styles.secondaryButton,
                (busy || !canVerify) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>
                Request supervisor verification
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 14,
    marginVertical: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  identifier: {
    color: '#627786',
    fontSize: 13,
    lineHeight: 21,
    letterSpacing: 0.4,
  },
  source: { color: '#17354c', fontSize: 16, lineHeight: 26 },
  quote: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  flag: {
    color: '#8a3d2e',
    backgroundColor: '#fbeae6',
    padding: 9,
    fontSize: 14,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '600',
    marginTop: 22,
  },
  candidate: {
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
    padding: 15,
    gap: 5,
    marginTop: 10,
  },
  selectedCandidate: {
    borderColor: '#266b8c',
    borderWidth: 2,
    backgroundColor: '#edf5f8',
  },
  candidateTitle: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#aebdc7',
    backgroundColor: '#fff',
    color: '#17354c',
    minHeight: 52,
    padding: 14,
    marginTop: 10,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: {
    borderWidth: 1,
    borderColor: '#aebdc7',
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectedOption: {
    borderColor: '#266b8c',
    borderWidth: 2,
    backgroundColor: '#edf5f8',
  },
  optionText: { color: '#17354c', fontSize: 14, lineHeight: 21 },
  preview: {
    borderWidth: 1,
    borderColor: '#266b8c',
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 18,
    gap: 8,
  },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e8eff3', padding: 8 },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#d7e0e5',
    padding: 8,
  },
  tableCell: { color: '#455d6d', flex: 1, fontSize: 12, lineHeight: 18 },
  fieldCell: { color: '#17354c', fontWeight: '600' },
  message: {
    color: '#17354c',
    backgroundColor: '#fff2d9',
    padding: 12,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  actions: { gap: 10, marginTop: 16 },
  primaryButton: {
    minHeight: 50,
    backgroundColor: '#17354c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#aebdc7',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dangerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#9b4638',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dangerText: {
    color: '#8a3d2e',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  disabled: { opacity: 0.5 },
  followup: {
    borderTopWidth: 1,
    borderTopColor: '#d7e0e5',
    marginTop: 28,
    gap: 10,
    paddingBottom: 24,
  },
});
