import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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

import { replyIsComplete, replySummary } from './followupContracts';
import { FollowupWriteError, respondToClarification } from './followupService';
import { stableCommand } from './reviewContracts';
import { useReportFollowups } from './useFollowups';

import type { ClarificationRequest, ReplyCommand } from './followupContracts';
import type { StableCommand } from './reviewContracts';

type ReplyPayload = Omit<ReplyCommand, 'commandId'>;
type ReplyDraft = {
  text: string;
  date: string;
  activityIds: string[];
  answer: 'yes' | 'no' | '';
};
const emptyReplyDraft: ReplyDraft = {
  text: '',
  date: '',
  activityIds: [],
  answer: '',
};

function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selectedChoice,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

function replyDraftSummary(question: ClarificationRequest, draft: ReplyDraft) {
  const selected = question.options
    .filter((option) => draft.activityIds.includes(option.activityId))
    .map((option) => option.label);
  const answer =
    draft.answer === 'yes' ? 'Yes' : draft.answer === 'no' ? 'No' : '';
  return (
    [answer, ...selected, draft.date, draft.text].filter(Boolean).join(' · ') ||
    'No details entered'
  );
}

export function ReportFollowupScreen({ reportId }: { reportId: string }) {
  const { report, offline, refresh, finish } = useReportFollowups(reportId);
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const command = useRef<{
    questionId: string;
    value: StableCommand<ReplyPayload>;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!offline) void refresh();
    }, [offline, refresh]),
  );

  const data = report.data;
  const question = data?.questions.find((item) => item.status === 'open');
  const questionClaim = data?.claims.find(
    (claim) => claim.id === question?.claim_id,
  );
  const draft = question
    ? (drafts[question.id] ?? emptyReplyDraft)
    : emptyReplyDraft;
  const updateDraft = (patch: Partial<ReplyDraft>) => {
    if (!question) return;
    setDrafts((current) => ({
      ...current,
      [question.id]: { ...(current[question.id] ?? emptyReplyDraft), ...patch },
    }));
  };
  const responseAnswer: ReplyCommand['answer'] =
    question?.reason_code === 'scope' || question?.reason_code === 'assignment'
      ? draft.answer || 'answer'
      : 'answer';
  const payload: ReplyPayload | null = question
    ? {
        expectedQuestionVersion: question.version,
        answer: responseAnswer,
        text: draft.text.trim(),
        activityIds: draft.activityIds,
        eventDate: draft.date.trim() || null,
      }
    : null;
  const complete =
    !!question && !!payload && replyIsComplete(question, payload);

  async function send(notSure = false) {
    const client = getSupabase();
    if (!question || !payload || !client || offline || busy) return;
    const request: ReplyPayload = notSure
      ? {
          expectedQuestionVersion: question.version,
          answer: 'not_sure',
          text: '',
          activityIds: [],
          eventDate: null,
        }
      : payload;
    const previous =
      command.current?.questionId === question.id
        ? command.current.value
        : null;
    const stable = stableCommand(previous, request, randomUUID);
    command.current = { questionId: question.id, value: stable };
    setBusy(true);
    setMessage('');
    try {
      await respondToClarification(client, question.id, {
        ...stable.payload,
        commandId: stable.id,
      });
      setMessage(
        'Answer recorded. It is a new proposal for review and does not approve schedule progress.',
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
      command.current = null;
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

  return (
    <ShellPage title="Report follow-up" eyebrow="FIELD · YOUR REPORT">
      <BackButton />
      {offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Connect before loading or answering a planner question.
        </Text>
      )}
      {report.error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Follow-up unavailable
          </Text>
          <Text style={shellStyles.body}>{report.error.message}</Text>
        </View>
      ) : report.isPending ? (
        <View style={styles.state}>
          {!offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {offline
              ? 'Connect to load the current question.'
              : 'Loading the report and its current questions…'}
          </Text>
        </View>
      ) : !data ? (
        <Text style={styles.notice}>This report is no longer available.</Text>
      ) : (
        <>
          <View style={shellStyles.card}>
            <Text style={styles.identifier}>
              FR-{data.report.id.slice(0, 8).toUpperCase()} ·{' '}
              {data.report.source_kind} report
            </Text>
            <Text accessibilityRole="header" style={shellStyles.cardTitle}>
              Your original report
            </Text>
            <Text selectable style={styles.source}>
              {data.original.source_text}
            </Text>
            <Text style={styles.detail}>
              Work date: {data.original.work_date ?? 'Not recorded'}
            </Text>
          </View>

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Review progress
          </Text>
          {data.claims.map((claim) => (
            <View key={claim.id} style={styles.claimCard}>
              <Text style={styles.historyStatus}>{claim.state}</Text>
              <Text style={styles.question}>
                {claim.facts.kind.replaceAll('_', ' ')} ·{' '}
                {claim.facts.eventDate ?? 'Date not recorded'}
              </Text>
              <Text style={styles.detail}>{claim.facts.evidenceQuote}</Text>
              {claim.validation_flags.map((flag) => (
                <Text key={flag} style={styles.flag}>
                  {flag}
                </Text>
              ))}
            </View>
          ))}

          {data.questions.map((item) => {
            const response = data.responses.find(
              (candidate) => candidate.request_id === item.id,
            );
            const unsentDraft = drafts[item.id];
            return item.id === question?.id ? null : (
              <View key={item.id} style={styles.history}>
                <Text style={styles.historyStatus}>
                  {item.status === 'open'
                    ? 'Waiting for the current question'
                    : item.status}
                </Text>
                <Text style={styles.question}>{item.question_text}</Text>
                <Text style={styles.detail}>
                  {item.status === 'open'
                    ? 'This question still needs your answer. It will appear after you answer the current question.'
                    : response
                      ? `Recorded reply: ${replySummary(item, response)}`
                      : 'The earlier question remains part of the report record.'}
                </Text>
                {unsentDraft && (
                  <Text selectable style={styles.detail}>
                    Unsent draft (not sent):{' '}
                    {replyDraftSummary(item, unsentDraft)}
                  </Text>
                )}
              </View>
            );
          })}

          {question ? (
            <View style={styles.followup}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                One detail to confirm
              </Text>
              {questionClaim && (
                <Text style={styles.quote}>
                  “{questionClaim.facts.evidenceQuote}”
                </Text>
              )}
              <Text style={styles.question}>{question.question_text}</Text>
              {question.reason_code === 'location' &&
                question.options.length > 0 && (
                  <>
                    <Text style={styles.label}>
                      Where did you work? You may choose more than one.
                    </Text>
                    {question.options.map((option) => {
                      const selected = draft.activityIds.includes(
                        option.activityId,
                      );
                      return (
                        <Pressable
                          key={option.activityId}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: selected,
                            disabled: busy,
                          }}
                          disabled={busy}
                          onPress={() => {
                            if (!selected && draft.activityIds.length >= 8) {
                              setMessage(
                                'Choose no more than eight work areas.',
                              );
                              return;
                            }
                            setMessage('');
                            updateDraft({
                              text: '',
                              activityIds: selected
                                ? draft.activityIds.filter(
                                    (id) => id !== option.activityId,
                                  )
                                : [...draft.activityIds, option.activityId],
                            });
                          }}
                          style={[
                            styles.choice,
                            selected && styles.selectedChoice,
                            busy && styles.disabled,
                          ]}
                        >
                          <Text style={styles.choiceText}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </>
                )}
              {question.reason_code === 'date' && (
                <TextInput
                  accessibilityLabel="Work date"
                  autoCapitalize="none"
                  editable={!busy}
                  maxLength={10}
                  onChangeText={(value) => updateDraft({ date: value })}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  value={draft.date}
                />
              )}
              {(question.reason_code === 'scope' ||
                question.reason_code === 'assignment') && (
                <View style={styles.options}>
                  <Text style={styles.label}>
                    {question.reason_code === 'scope'
                      ? 'Was the whole activity completed?'
                      : 'Is the reported location correct?'}
                  </Text>
                  <Choice
                    disabled={busy}
                    label="Yes"
                    selected={draft.answer === 'yes'}
                    onPress={() => {
                      updateDraft({
                        answer: 'yes',
                        ...(question.reason_code === 'scope'
                          ? { text: '' }
                          : {}),
                      });
                    }}
                  />
                  <Choice
                    disabled={busy}
                    label="No"
                    selected={draft.answer === 'no'}
                    onPress={() => updateDraft({ answer: 'no' })}
                  />
                </View>
              )}
              {question.reason_code !== 'date' && (
                <TextInput
                  accessibilityLabel={
                    question.reason_code === 'assignment'
                      ? 'Who assigned the work'
                      : question.reason_code === 'location'
                        ? 'Another work location'
                        : question.reason_code === 'scope'
                          ? 'Work that remains'
                          : 'Other details'
                  }
                  multiline
                  editable={!busy}
                  maxLength={1000}
                  onChangeText={(value) => {
                    setMessage('');
                    if (value && question.reason_code === 'location')
                      updateDraft({ text: value, activityIds: [] });
                    else updateDraft({ text: value });
                  }}
                  placeholder={
                    question.reason_code === 'assignment'
                      ? 'Who asked you to work there?'
                      : question.reason_code === 'location'
                        ? 'Or type another location'
                        : question.reason_code === 'scope'
                          ? 'If work remains, describe it'
                          : 'Record the missing detail'
                  }
                  style={styles.input}
                  value={draft.text}
                />
              )}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: offline || busy || !complete,
                  }}
                  disabled={offline || busy || !complete}
                  onPress={() => void send(false)}
                  style={[
                    styles.primaryButton,
                    (offline || busy || !complete) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryText}>Send answer</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: offline || busy }}
                  disabled={offline || busy}
                  onPress={() => void send(true)}
                  style={[
                    styles.secondaryButton,
                    (offline || busy) && styles.disabled,
                  ]}
                >
                  <Text style={shellStyles.linkText}>Not sure</Text>
                </Pressable>
              </View>
              <Text style={styles.detail}>
                Sending an answer does not approve the work. A planner reviews
                the new proposal separately.
              </Text>
            </View>
          ) : (
            <Text style={styles.notice}>
              No question currently needs your answer. Earlier questions and
              replies remain in this report.
            </Text>
          )}
          {data.claims.some((claim) => claim.state === 'clarification') &&
            !question && (
              <Text style={styles.detail}>
                The production worker or planner is processing the recorded
                clarification.
              </Text>
            )}
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
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 14,
    marginVertical: 12,
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
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  history: {
    borderBottomColor: '#d7e0e5',
    borderBottomWidth: 1,
    paddingVertical: 16,
    gap: 5,
  },
  claimCard: {
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    gap: 6,
  },
  historyStatus: {
    color: '#266b8c',
    textTransform: 'capitalize',
    fontSize: 13,
    fontWeight: '700',
  },
  followup: {
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 20,
    marginTop: 20,
    gap: 12,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  question: { color: '#17354c', fontSize: 16, lineHeight: 25 },
  quote: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  flag: {
    color: '#8a3d2e',
    backgroundColor: '#fbeae6',
    padding: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  label: { color: '#17354c', fontSize: 15, lineHeight: 24, fontWeight: '600' },
  options: { gap: 8 },
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
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
    color: '#17354c',
    padding: 13,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#17354c',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    backgroundColor: '#fff',
  },
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
