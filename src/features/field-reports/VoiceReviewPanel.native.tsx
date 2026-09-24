import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
  LocalizedTextInput as TextInput,
} from '@/features/localization/LocalizedText';
import { shellStyles } from '@/features/navigation/shellUi';

import { getVoiceDraftStore } from './nativeDraftStore';
import {
  cancelNativeOutboxCapture,
  getNativeOutbox,
  prepareLocalOutbox,
  syncNativeOutbox,
} from './nativeOutbox';
import { subscribeOutboxChanges } from './outboxEvents';
import { initialConfirmationText } from './reportEvidence';

function ReviewAction({
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

export function VoiceReviewPanel({
  userId,
  captureId,
  onCanceled,
}: {
  userId: string;
  captureId: string;
  onCanceled: (message: string) => void;
}) {
  const auth = useAuth();
  const client = useQueryClient();
  const mounted = useRef(true);
  const playerRelease = useRef<(() => void) | null>(null);
  const [editedText, setEditedText] = useState<string>();
  const [localSendRequested, setLocalSendRequested] = useState(false);
  const [busy, setBusy] = useState<'send' | 'cancel' | 'play' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const review = useQuery({
    queryKey: ['voice-review', userId, captureId],
    networkMode: 'always',
    queryFn: async () => {
      return (
        (await (await getNativeOutbox()).list(userId)).find(
          (row) => row.captureId === captureId,
        ) ?? null
      );
    },
  });

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeOutboxChanges((owner, id) => {
      if (owner === userId && id === captureId)
        void client.invalidateQueries({
          queryKey: ['voice-review', userId, captureId],
        });
    });
    void prepareLocalOutbox(userId)
      .then(() => (auth.offline ? undefined : syncNativeOutbox(userId)))
      .finally(() => {
        if (mounted.current)
          void client.invalidateQueries({
            queryKey: ['voice-review', userId, captureId],
          });
      });
    return () => {
      mounted.current = false;
      unsubscribe();
      playerRelease.current?.();
      playerRelease.current = null;
    };
  }, [auth.offline, captureId, client, userId]);

  function stopPlayback() {
    playerRelease.current?.();
    playerRelease.current = null;
    setPlaying(false);
  }

  async function play() {
    if (busy) return;
    if (playing) {
      stopPlayback();
      return;
    }
    setBusy('play');
    setError('');
    try {
      const uri = await (
        await getVoiceDraftStore()
      ).playbackUri(userId, captureId);
      if (!mounted.current) return;
      const player = createAudioPlayer({ uri });
      const status = player.addListener('playbackStatusUpdate', (event) => {
        if (event.didJustFinish || event.error) {
          stopPlayback();
          if (event.error)
            setError('This recording could not be played. Try again.');
        }
      });
      playerRelease.current = () => {
        status.remove();
        player.remove();
        player.release();
      };
      setPlaying(true);
      player.play();
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'This recording could not be played. Try again.',
        );
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function send() {
    const current = review.data;
    if (busy || current?.submissionState === 'submitted') return;
    setLocalSendRequested(true);
    setBusy('send');
    setError('');
    setMessage(
      current?.originalTranscript
        ? 'Sending for review…'
        : 'Send queued. The verified transcript will be attached before submission.',
    );
    try {
      await prepareLocalOutbox(userId);
      const record = (await (await getNativeOutbox()).list(userId)).find(
        (row) => row.captureId === captureId,
      );
      if (!record)
        throw new Error('The saved recording could not enter the outbox.');
      const readyText = record.originalTranscript
        ? (editedText ?? initialConfirmationText(record))
        : undefined;
      const next = await (
        await getNativeOutbox()
      ).requestSend(
        userId,
        captureId,
        readyText
          ? { text: readyText, workDate: null, activityId: null }
          : undefined,
      );
      if (!mounted.current) return;
      client.setQueryData(['voice-review', userId, captureId], next);
      if (!auth.offline)
        void syncNativeOutbox(userId).finally(() => {
          if (mounted.current)
            void client.invalidateQueries({
              queryKey: ['voice-review', userId, captureId],
            });
        });
    } catch (reason) {
      if (mounted.current) {
        setLocalSendRequested(false);
        setError(reason instanceof Error ? reason.message : 'Send failed.');
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy('cancel');
    setError('');
    stopPlayback();
    try {
      const result = await cancelNativeOutboxCapture(userId, captureId);
      if (!mounted.current) return;
      onCanceled(
        result?.lastError
          ? 'Cancellation queued. Server cleanup will retry after reconnecting.'
          : 'Voice report canceled.',
      );
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : 'Cancellation failed.',
        );
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  const record = review.data;
  const transcript = record?.originalTranscript?.trim() ?? '';
  const submitted = record?.submissionState === 'submitted';
  const sendQueued = localSendRequested || Boolean(record?.sendRequested);
  const text =
    editedText ?? (record && transcript ? initialConfirmationText(record) : '');

  return (
    <View style={styles.panel}>
      <Text style={styles.mode}>REVIEW VOICE REPORT</Text>
      <Text accessibilityRole="header" style={shellStyles.cardTitle}>
        Recording saved on this device
      </Text>
      {(review.isPending || !record) && (
        <View style={styles.preparing}>
          <ActivityIndicator color="#266b8c" />
          <Text style={shellStyles.body}>Preparing secure upload…</Text>
        </View>
      )}
      <ReviewAction
        label={playing ? 'Stop playback' : 'Play recording'}
        disabled={busy === 'cancel' || submitted}
        onPress={() => void play()}
      />
      <Text style={styles.label}>Transcript</Text>
      {transcript ? (
        <TextInput
          accessibilityLabel="Voice transcript"
          editable={!sendQueued && !submitted && busy === null}
          multiline
          maxLength={10_000}
          onChangeText={setEditedText}
          style={styles.transcript}
          value={text}
        />
      ) : (
        <Text accessibilityLiveRegion="polite" style={styles.transcribing}>
          Transcribing…
        </Text>
      )}
      {auth.offline && (
        <Text style={styles.help}>
          Offline · Upload resumes after reconnecting.
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.help}>
          {message}
        </Text>
      )}
      {sendQueued && !submitted && (
        <Text style={styles.help}>
          Send requested · Waiting for verified media.
        </Text>
      )}
      {submitted && <Text style={styles.success}>Sent for review.</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!submitted && (
        <View style={styles.actions}>
          <ReviewAction
            label={busy === 'cancel' ? 'Canceling…' : 'Cancel'}
            disabled={busy !== null}
            onPress={() => void cancel()}
          />
          <ReviewAction
            label={busy === 'send' ? 'Queuing…' : 'Send'}
            disabled={busy !== null || sendQueued}
            onPress={() => void send()}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    padding: 20,
    gap: 12,
  },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mode: { color: '#266b8c', fontWeight: '700', fontSize: 13 },
  label: { color: '#17354c', fontSize: 15, fontWeight: '700' },
  transcript: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    padding: 14,
    color: '#17354c',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  transcribing: {
    minHeight: 64,
    backgroundColor: '#e7edf0',
    color: '#17354c',
    padding: 16,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  action: {
    minHeight: 48,
    minWidth: 112,
    borderWidth: 1,
    borderColor: '#266b8c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  actionText: { color: '#266b8c', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  help: { color: '#586c7a', fontSize: 14, lineHeight: 22 },
  success: { color: '#27734f', fontSize: 15, fontWeight: '700' },
  error: { color: '#9d3434', fontSize: 15, lineHeight: 23 },
});
