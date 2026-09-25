import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  StyleSheet,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useLocalization } from '@/features/localization/LocalizationProvider';
import {
  formatDateTime,
  LocalizedText as Text,
  LocalizedAlert as Alert,
  LocalizedPressable as Pressable,
  LocalizedTextInput as TextInput,
} from '@/features/localization/LocalizedText';
import { ShellPage, shellStyles } from '@/features/navigation/shellUi';
import { useCaptureProject } from '@/features/projects/useCaptureProject';

import { androidMicrophone } from './androidMicrophone';
import { saveCombinedVoiceDraft } from './combinedDraftStore';
import { getVoiceDraftStore } from './nativeDraftStore';
import { assertLocalDraftCanBeDiscarded } from './nativeOutbox';
import {
  choosePhoto,
  preparePickedPhoto,
  takePhoto,
} from './nativePhotoPicker';
import { ReportMethodLinks } from './ReportMethodLinks';
import { VoiceCapture } from './voiceCapture';
import { VoiceReviewPanel } from './VoiceReviewPanel.native';

import type { VoiceDraft } from './draftStore';
import type { PickedLocalPhoto, PreparedLocalPhoto } from './nativePhotoPicker';
import type {
  PreparedDraftPhoto,
  ReportDraft,
  SavedPhoto,
} from './reportDraftStore';
import type { CaptureState, RecordedVoice } from './voiceCapture';

type LocalPhoto = {
  id: string;
  caption: string;
  previewUri: string;
  prepared: PreparedLocalPhoto | null;
  error: string | null;
};
type ReadyLocalPhoto = LocalPhoto & { prepared: PreparedLocalPhoto };
type CombinedEvidence = { text: string; photos: ReadyLocalPhoto[] };

function isReadyPhoto(photo: LocalPhoto): photo is ReadyLocalPhoto {
  return photo.prepared !== null;
}

function toSavedPhoto(photo: ReadyLocalPhoto): SavedPhoto {
  return {
    id: photo.id,
    fileName: `${photo.id}.jpg`,
    mimeType: 'image/jpeg',
    caption: photo.caption,
    byteLength: photo.prepared.byteLength,
    width: photo.prepared.width,
    height: photo.prepared.height,
  };
}

function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[shellStyles.link, disabled && styles.disabled]}
    >
      <Text style={shellStyles.linkText}>{label}</Text>
    </Pressable>
  );
}

function CapturePanel({
  userId,
  projectId,
  projectName,
  evidence,
  evidencePending,
  onBusy,
  onSaved,
}: {
  userId: string;
  projectId: string;
  projectName: string;
  evidence: CombinedEvidence;
  evidencePending: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: (captureId: string) => void;
}) {
  const client = useQueryClient();
  const [discarding, setDiscarding] = useState(false);
  const discardPending = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState<CaptureState>({
    phase: 'idle',
    duration: 0,
    message: 'Ready to record',
    canRetry: false,
  });
  const identity = useRef<{
    recording: RecordedVoice;
    draft: VoiceDraft;
  } | null>(null);
  const controller = useRef<VoiceCapture | null>(null);
  const currentProjectName = useRef(projectName);
  const currentEvidence = useRef(evidence);
  useEffect(() => {
    currentProjectName.current = projectName;
  }, [projectName]);
  useEffect(() => {
    currentEvidence.current = evidence;
  }, [evidence]);
  useEffect(() => {
    mounted.current = true;
    const capture = new VoiceCapture({
      permission: async () =>
        (await requestRecordingPermissionsAsync()).granted,
      isActive: () => AppState.currentState === 'active',
      microphone: androidMicrophone,
      onState: (next) => {
        setState(next);
        onBusy(
          ['permission', 'recording', 'saving'].includes(next.phase) ||
            next.canRetry,
        );
      },
      async save(recording) {
        if (identity.current?.recording !== recording)
          identity.current = {
            recording,
            draft: {
              id: randomUUID(),
              userId,
              projectId,
              projectName: currentProjectName.current,
              createdAt: new Date().toISOString(),
              duration: recording.duration,
              sampleRate: recording.sampleRate,
              byteLength: recording.bytes.length,
              state: 'saving',
            },
          };
        const draft = identity.current.draft;
        const selected = currentEvidence.current;
        const savedPhotos = selected.photos.map(toSavedPhoto);
        const companion:
          | {
              draft: ReportDraft;
              prepared: PreparedDraftPhoto[];
            }
          | undefined =
          selected.text.trim() || savedPhotos.length
            ? {
                draft: {
                  id: draft.id,
                  userId: draft.userId,
                  projectId: draft.projectId,
                  projectName: draft.projectName,
                  createdAt: draft.createdAt,
                  text: selected.text,
                  photos: savedPhotos,
                  state: 'saving',
                },
                prepared: savedPhotos.map((photo, position) => ({
                  photo,
                  bytes: selected.photos[position]!.prepared.bytes,
                })),
              }
            : undefined;
        try {
          await saveCombinedVoiceDraft(draft, recording.bytes, companion);
          if (mounted.current) onSaved(draft.id);
        } finally {
          void client.invalidateQueries({
            queryKey: ['voice-drafts', userId],
          });
        }
      },
    });
    controller.current = capture;
    const listener = AppState.addEventListener('change', (next) => {
      if (next !== 'active') capture.background();
    });
    return () => {
      mounted.current = false;
      listener.remove();
      capture.dispose();
      onBusy(false);
    };
  }, [client, onBusy, onSaved, projectId, userId]);
  useFocusEffect(useCallback(() => () => controller.current?.interrupt(), []));
  const busy = ['permission', 'recording', 'saving'].includes(state.phase);

  async function discard() {
    if (!mounted.current || discardPending.current) return;
    discardPending.current = true;
    setDiscarding(true);
    try {
      if (identity.current) {
        const store = await getVoiceDraftStore();
        if (
          (await store.list(userId)).some(
            (d) => d.id === identity.current!.draft.id,
          )
        )
          await store.discard(userId, identity.current.draft.id);
      }
      identity.current = null;
      controller.current?.discardUnsaved();
      void client.invalidateQueries({ queryKey: ['voice-drafts', userId] });
    } catch {
      Alert.alert(
        'Could not discard',
        'Try again after device storage is available.',
      );
    } finally {
      discardPending.current = false;
      setDiscarding(false);
    }
  }

  return (
    <View style={styles.capture}>
      <Text style={styles.mode}>VOICE</Text>
      <Text style={shellStyles.cardTitle}>{projectName}</Text>
      <Text style={shellStyles.body}>
        Say the location or line tag, the work completed and what remains.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          state.phase === 'recording'
            ? 'Stop and save recording'
            : 'Record voice report'
        }
        accessibilityState={{
          disabled:
            (busy && state.phase !== 'recording') ||
            state.canRetry ||
            evidencePending,
        }}
        disabled={
          (busy && state.phase !== 'recording') ||
          state.canRetry ||
          evidencePending
        }
        onPress={() =>
          void (state.phase === 'recording'
            ? controller.current?.stop()
            : controller.current?.start())
        }
        style={[
          styles.record,
          ((busy && state.phase !== 'recording') ||
            state.canRetry ||
            evidencePending) &&
            styles.disabled,
        ]}
      >
        <Ionicons
          name={state.phase === 'recording' ? 'stop' : 'mic'}
          size={38}
          color="#fff"
        />
      </Pressable>
      <Text style={styles.timer}>{state.duration.toFixed(1)}s / 25s</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={state.phase === 'error' ? styles.error : shellStyles.body}
      >
        {state.message}
      </Text>
      <Text style={styles.detail}>
        Tap to {state.phase === 'recording' ? 'stop and save' : 'record'}.
        Recording stops at 25 seconds.
      </Text>
      {state.canRetry && (
        <View>
          <Action
            label="Retry save"
            disabled={discarding}
            onPress={() => void controller.current?.retry()}
          />
          <Action
            label="Discard unsaved recording"
            disabled={discarding}
            onPress={() =>
              Alert.alert('Discard this recording?', 'This cannot be undone.', [
                { text: 'Keep recording', style: 'cancel' },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => void discard(),
                },
              ])
            }
          />
        </View>
      )}
    </View>
  );
}

function AccountVoiceScreen({ userId }: { userId: string }) {
  useLocalization();
  const auth = useAuth();
  const project = useCaptureProject();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [reviewCaptureId, setReviewCaptureId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState<string | null>(null);
  const playbackAttempt = useRef(0);
  const mounted = useRef(true);
  const releasePlayback = useRef<(() => void) | null>(null);
  const drafts = useQuery({
    queryKey: ['voice-drafts', userId],
    networkMode: 'always',
    queryFn: async () => (await getVoiceDraftStore()).list(userId),
  });
  const context =
    !project.error && project.data?.member.user_id === userId
      ? project.data
      : null;
  const evidencePending = photos.some((photo) => !photo.prepared);
  const readyPhotos = photos.filter(isReadyPhoto);
  const stopPlayback = useCallback(() => {
    ++playbackAttempt.current;
    const release = releasePlayback.current;
    releasePlayback.current = null;
    try {
      release?.();
    } catch {
      /* Cleanup still clears the session if native disposal reports an error. */
    }
    setPlaying(null);
    setLoadingPlayback(false);
  }, []);
  const captureBusy = useCallback(
    (next: boolean) => {
      if (next) stopPlayback();
      setBusy(next);
    },
    [stopPlayback],
  );
  const openReview = useCallback((captureId: string) => {
    setText('');
    setPhotos([]);
    setReviewCaptureId(captureId);
  }, []);
  function addPicked(photo: PickedLocalPhoto | null) {
    if (!photo) return;
    const id = randomUUID();
    setPhotos((current) => [
      ...current,
      {
        id,
        caption: '',
        previewUri: photo.uri,
        prepared: null,
        error: null,
      },
    ]);
    void preparePickedPhoto(photo)
      .then((prepared) => {
        if (!mounted.current) return;
        setPhotos((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, previewUri: prepared.uri, prepared, error: null }
              : item,
          ),
        );
      })
      .catch((reason: unknown) => {
        if (!mounted.current) return;
        const detail =
          reason instanceof Error
            ? reason.message
            : 'Could not compress photo.';
        setPhotos((current) =>
          current.map((item) =>
            item.id === id ? { ...item, error: detail } : item,
          ),
        );
        setError(detail);
      });
  }
  async function pick(source: 'camera' | 'library') {
    if (busy || picking || photos.length >= 3) return;
    setPicking(true);
    setError('');
    try {
      const selected =
        source === 'camera' ? await takePhoto() : await choosePhoto();
      if (mounted.current) addPicked(selected);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not prepare this photo.',
        );
    } finally {
      if (mounted.current) setPicking(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stopPlayback();
    });
    return () => {
      mounted.current = false;
      listener.remove();
      stopPlayback();
    };
  }, [stopPlayback]);
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries({ queryKey: ['voice-drafts', userId] });
      return stopPlayback;
    }, [client, userId, stopPlayback]),
  );
  async function play(id: string) {
    stopPlayback();
    setError('');
    const attempt = playbackAttempt.current;
    try {
      const uri = await (await getVoiceDraftStore()).playbackUri(userId, id);
      if (!mounted.current || attempt !== playbackAttempt.current) return;
      if (AppState.currentState !== 'active') return;
      const player = createAudioPlayer({ uri });
      // Android can resume paused players on foreground. Unregister this
      // session as well as releasing its native resources when it stops.
      const release = () => {
        try {
          player.remove();
        } finally {
          player.release();
        }
      };
      releasePlayback.current = release;
      setPlaying(id);
      setLoadingPlayback(!player.isLoaded);
      const subscription = player.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (!mounted.current || attempt !== playbackAttempt.current) return;
          if (status.error || status.didJustFinish) {
            stopPlayback();
            if (status.error)
              setError(
                'This recording could not be played. Try listening again.',
              );
          } else {
            setLoadingPlayback(!status.isLoaded);
          }
        },
      );
      releasePlayback.current = () => {
        try {
          subscription.remove();
        } finally {
          release();
        }
      };
      player.play();
    } catch {
      if (mounted.current && attempt === playbackAttempt.current) {
        stopPlayback();
        setError(
          'This recording could not be played. Retry or check device storage.',
        );
      }
    }
  }
  async function discard(id: string) {
    if (!mounted.current) return;
    stopPlayback();
    setDiscarding(id);
    setError('');
    try {
      await assertLocalDraftCanBeDiscarded(userId, id);
      await (await getVoiceDraftStore()).discard(userId, id);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not finish discarding. Retry the discard action.',
      );
    } finally {
      setDiscarding(null);
      void client.invalidateQueries({ queryKey: ['voice-drafts', userId] });
    }
  }
  return (
    <ShellPage title="Report progress" eyebrow="FIELD · VOICE REPORT">
      <View style={styles.steps}>
        <Text style={styles.mode}>1 Report</Text>
        <Text style={styles.detail}>2 Check</Text>
        <Text style={styles.detail}>3 Send</Text>
      </View>
      <ReportMethodLinks active="voice" />
      <Text style={shellStyles.body}>
        Add a voice note, typed details or photos in any combination.
      </Text>
      {auth.offline && (
        <Text style={styles.notice}>
          Offline · Recordings stay on this device.
        </Text>
      )}
      {reviewCaptureId ? (
        <VoiceReviewPanel
          userId={userId}
          captureId={reviewCaptureId}
          onCanceled={(nextMessage) => {
            setReviewCaptureId(null);
            setReviewMessage(nextMessage);
          }}
        />
      ) : context ? (
        <>
          <View style={styles.companion}>
            <Text style={styles.mode}>OPTIONAL SUPPORTING EVIDENCE</Text>
            <TextInput
              accessibilityLabel="Report details"
              editable={!busy && !picking}
              maxLength={10_000}
              multiline
              onChangeText={setText}
              placeholder="Add typed details (optional)"
              style={styles.input}
              textAlignVertical="top"
              value={text}
            />
            {photos.map((photo, position) => (
              <View key={photo.id} style={styles.photoRow}>
                <Image
                  accessibilityLabel={`Selected photo ${position + 1}`}
                  source={{ uri: photo.previewUri }}
                  style={styles.thumbnail}
                />
                <View style={styles.photoDetail}>
                  {!photo.prepared && (
                    <Text style={photo.error ? styles.error : styles.detail}>
                      {photo.error
                        ? 'Photo compression failed.'
                        : 'Compressing photo…'}
                    </Text>
                  )}
                  <TextInput
                    accessibilityLabel={`Caption for photo ${position + 1}`}
                    editable={!busy && !picking}
                    maxLength={500}
                    onChangeText={(caption) =>
                      setPhotos((current) =>
                        current.map((item) =>
                          item.id === photo.id ? { ...item, caption } : item,
                        ),
                      )
                    }
                    placeholder="Optional photo caption"
                    style={styles.caption}
                    value={photo.caption}
                  />
                  <Action
                    label="Remove photo"
                    disabled={busy || picking}
                    onPress={() =>
                      setPhotos((current) =>
                        current.filter((item) => item.id !== photo.id),
                      )
                    }
                  />
                </View>
              </View>
            ))}
            <View style={styles.actions}>
              <Action
                label={picking ? 'Preparing photo…' : 'Take photo'}
                disabled={busy || picking || photos.length >= 3}
                onPress={() => void pick('camera')}
              />
              <Action
                label="Choose photo"
                disabled={busy || picking || photos.length >= 3}
                onPress={() => void pick('library')}
              />
            </View>
            <Text style={styles.detail}>
              {photos.length} of 3 photos selected
            </Text>
          </View>
          <CapturePanel
            key={`${userId}:${context.project.id}`}
            userId={userId}
            projectId={context.project.id}
            projectName={context.project.name}
            evidence={{ text, photos: readyPhotos }}
            evidencePending={evidencePending}
            onBusy={captureBusy}
            onSaved={openReview}
          />
        </>
      ) : (
        <View style={shellStyles.card}>
          {project.isPending && !auth.offline && (
            <ActivityIndicator color="#266b8c" />
          )}
          <Text style={shellStyles.cardTitle}>
            {project.error
              ? 'Project unavailable'
              : project.isPending
                ? 'Load your project to record'
                : 'No active project access'}
          </Text>
          <Text style={shellStyles.body}>
            {auth.offline
              ? 'Connect once to load your project. Existing drafts stay on this device.'
              : (project.error?.message ??
                'Your active project membership is needed for a new report.')}
          </Text>
          <Action
            label="Refresh project"
            disabled={auth.offline || project.isFetching}
            onPress={() => void project.refetch()}
          />
        </View>
      )}
      {!!reviewMessage && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {reviewMessage}
        </Text>
      )}
      <View style={styles.savedHeader}>
        <Text accessibilityRole="header" style={shellStyles.cardTitle}>
          Your local voice drafts
        </Text>
        <Action
          label="Refresh drafts"
          onPress={() => void drafts.refetch()}
          disabled={drafts.isFetching || busy}
        />
      </View>
      <Text style={styles.detail}>
        Drafts stay here after logout and are visible only to this account.
        Discard removes them permanently. Clearing app data or uninstalling also
        removes them.
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {playing && loadingPlayback && (
        <Text style={styles.detail}>Loading recording…</Text>
      )}
      {drafts.isPending ? (
        <Text style={shellStyles.body}>Loading drafts from this device…</Text>
      ) : drafts.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Could not load local drafts. Free device storage and retry.
        </Text>
      ) : drafts.data?.length === 0 ? (
        <Text style={styles.empty}>No voice drafts saved yet.</Text>
      ) : (
        drafts.data?.map((draft) => (
          <View key={draft.id} style={shellStyles.card}>
            <Text style={styles.mode}>
              {draft.available
                ? 'Saved on device'
                : draft.state === 'deleting'
                  ? 'Discard incomplete'
                  : 'Recording incomplete or missing'}
            </Text>
            <Text style={shellStyles.cardTitle}>{draft.projectName}</Text>
            <Text style={shellStyles.body}>
              {draft.duration.toFixed(1)} seconds ·{' '}
              {formatDateTime(draft.createdAt)}
            </Text>
            <Text style={styles.detail}>Not sent for review</Text>
            <View style={styles.actions}>
              <Action
                label={playing === draft.id ? 'Stop playback' : 'Listen'}
                disabled={!draft.available || busy || !!discarding}
                onPress={() =>
                  playing === draft.id ? stopPlayback() : void play(draft.id)
                }
              />
              <Action
                label={
                  discarding === draft.id ? 'Discarding…' : 'Discard draft'
                }
                disabled={busy || !!discarding}
                onPress={() =>
                  Alert.alert(
                    'Discard voice draft?',
                    'The recording will be permanently removed from this device.',
                    [
                      { text: 'Keep draft', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => void discard(draft.id),
                      },
                    ],
                  )
                }
              />
            </View>
          </View>
        ))
      )}
    </ShellPage>
  );
}

export function VoiceReportScreen() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : null;
  return userId ? <AccountVoiceScreen key={userId} userId={userId} /> : null;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 18 },
  mode: { color: '#266b8c', fontWeight: '700', fontSize: 13, lineHeight: 21 },
  detail: { color: '#586c7a', fontSize: 13, lineHeight: 21 },
  companion: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    padding: 20,
    gap: 10,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    padding: 14,
    color: '#17354c',
    fontSize: 16,
  },
  photoRow: {
    borderTopWidth: 1,
    borderTopColor: '#d7e0e5',
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  thumbnail: { width: 76, height: 76, backgroundColor: '#e7edf0' },
  photoDetail: { flex: 1, gap: 6 },
  caption: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    padding: 10,
    color: '#17354c',
  },
  capture: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    padding: 20,
    marginVertical: 22,
    gap: 10,
    alignItems: 'center',
  },
  record: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#17354c',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  timer: {
    color: '#17354c',
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  disabled: { opacity: 0.45 },
  error: { color: '#9d3434', fontSize: 15, lineHeight: 23 },
  notice: {
    backgroundColor: '#e7edf0',
    color: '#17354c',
    padding: 14,
    marginTop: 16,
    lineHeight: 22,
  },
  savedHeader: { marginTop: 30, gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  empty: { color: '#586c7a', paddingVertical: 28, fontSize: 16 },
});
