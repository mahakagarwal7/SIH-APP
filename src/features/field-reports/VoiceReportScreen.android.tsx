import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  StyleSheet,
  View,
} from 'react-native';

import { useToast } from '@/components/ToastProvider';
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
import { outboxStatus } from './myReportsService';
import { getVoiceDraftStore } from './nativeDraftStore';
import {
  assertLocalDraftCanBeDiscarded,
  getNativeOutbox,
  localDraftDiscardBlocker,
} from './nativeOutbox';
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

function VoiceHeader() {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/field')
        }
        style={styles.headerButton}
      >
        <Ionicons color="#17354c" name="arrow-back" size={20} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.headerTitle}>
        Speak Progress
      </Text>
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={() => router.push('/account')}
        style={styles.headerButton}
      >
        <Ionicons color="#17354c" name="settings-outline" size={20} />
      </Pressable>
    </View>
  );
}

function LanguageSelector() {
  const { locale, saving, setLocale } = useLocalization();
  return (
    <View accessibilityRole="radiogroup" style={styles.languages}>
      {(
        [
          { locale: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
          { locale: 'en', flag: '🇬🇧', label: 'English' },
        ] as const
      ).map((option) => {
        const selected = locale === option.locale;
        return (
          <Pressable
            accessibilityLabel={`Language ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: saving }}
            disabled={saving}
            key={option.locale}
            onPress={() => void setLocale(option.locale)}
            style={[styles.language, selected && styles.languageSelected]}
          >
            <Text style={styles.languageFlag}>{option.flag}</Text>
            <Text
              style={[
                styles.languageLabel,
                selected && styles.languageLabelSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const waveformShape = [
  0.32, 0.58, 0.86, 0.48, 1, 0.68, 0.4, 0.82, 0.56, 0.94, 0.5,
];

function VoiceWaveform({ level, active }: { level: number; active: boolean }) {
  const amplitude = active ? Math.max(0.18, level) : 0.12;
  return (
    <View
      accessibilityLabel={
        active ? `Voice level ${Math.round(level * 100)}%` : 'Voice waveform'
      }
      style={styles.waveform}
    >
      {waveformShape.map((shape, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            { height: 8 + 42 * shape * amplitude },
            active && styles.waveBarActive,
          ]}
        />
      ))}
    </View>
  );
}

function CapturePanel({
  userId,
  projectId,
  projectName,
  evidence,
  evidencePending,
  onBusy,
  onLeave,
  onSaved,
}: {
  userId: string;
  projectId: string;
  projectName: string;
  evidence: CombinedEvidence;
  evidencePending: boolean;
  onBusy: (busy: boolean) => void;
  onLeave: () => void;
  onSaved: (captureId: string) => void;
}) {
  const client = useQueryClient();
  const [discarding, setDiscarding] = useState(false);
  const discardPending = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState<CaptureState>({
    phase: 'idle',
    duration: 0,
    level: 0,
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
      <Text numberOfLines={1} style={styles.projectName}>
        {projectName}
      </Text>
      <Text style={styles.prompt}>
        Say the location or line tag, work completed and what remains.
      </Text>
      <View
        style={[
          styles.recordHaloOuter,
          state.phase === 'recording' && styles.recordHaloOuterActive,
        ]}
      >
        <View
          style={[
            styles.recordHaloInner,
            state.phase === 'recording' && styles.recordHaloInnerActive,
          ]}
        >
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
              state.phase === 'recording' && styles.recordActive,
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
        </View>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.recordingLabel,
          state.phase === 'recording' && styles.recordingLabelActive,
        ]}
      >
        {state.phase === 'recording' ? 'RECORDING VOICE…' : 'READY TO RECORD'}
      </Text>
      <VoiceWaveform active={state.phase === 'recording'} level={state.level} />
      <Text style={styles.timer}>{state.duration.toFixed(1)}s / 25s</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={state.phase === 'error' ? styles.error : shellStyles.body}
      >
        {state.message}
      </Text>
      <View style={styles.captureActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: state.phase === 'saving' || state.canRetry || discarding,
          }}
          disabled={state.phase === 'saving' || state.canRetry || discarding}
          onPress={() =>
            ['permission', 'recording'].includes(state.phase)
              ? controller.current?.cancel()
              : onLeave()
          }
          style={[
            styles.captureAction,
            styles.cancelAction,
            (state.phase === 'saving' || state.canRetry || discarding) &&
              styles.disabled,
          ]}
        >
          <Ionicons color="#ef5c64" name="close-circle-outline" size={18} />
          <Text style={styles.cancelActionText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit recording"
          accessibilityState={{ disabled: state.phase !== 'recording' }}
          disabled={state.phase !== 'recording'}
          onPress={() => void controller.current?.stop()}
          style={[
            styles.captureAction,
            styles.submitAction,
            state.phase !== 'recording' && styles.disabled,
          ]}
        >
          <Ionicons color="#ffffff" name="checkmark-circle-outline" size={18} />
          <Text style={styles.submitActionText}>Submit</Text>
        </Pressable>
      </View>
      <Text style={styles.limit}>
        Recording stops automatically at 25 seconds.
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
  const auth = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
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
  const outbox = useQuery({
    queryKey: ['field-outbox', userId],
    networkMode: 'always',
    queryFn: async () => (await getNativeOutbox()).list(userId),
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
      void client.invalidateQueries({ queryKey: ['field-outbox', userId] });
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
      showToast('Report discarded.');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not finish discarding. Retry the discard action.',
      );
      showToast('Report could not be discarded.', 'error');
    } finally {
      setDiscarding(null);
      void client.invalidateQueries({ queryKey: ['voice-drafts', userId] });
    }
  }
  return (
    <ShellPage>
      <VoiceHeader />
      <LanguageSelector />
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
          <CapturePanel
            key={`${userId}:${context.project.id}`}
            userId={userId}
            projectId={context.project.id}
            projectName={context.project.name}
            evidence={{ text, photos: readyPhotos }}
            evidencePending={evidencePending}
            onBusy={captureBusy}
            onLeave={() =>
              router.canGoBack() ? router.back() : router.replace('/field')
            }
            onSaved={openReview}
          />
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
          <Text style={styles.otherMethods}>OTHER REPORT METHODS</Text>
          <ReportMethodLinks active="voice" />
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
      {outbox.error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            Could not check whether drafts are queued. Discard is unavailable
            until this check succeeds.
          </Text>
          <Action
            label="Retry draft status"
            disabled={outbox.isFetching}
            onPress={() => void outbox.refetch()}
          />
        </View>
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
        drafts.data?.map((draft) => {
          const record = outbox.data?.find((row) => row.captureId === draft.id);
          const delivery = record ? outboxStatus(record) : null;
          const discardBlocker = localDraftDiscardBlocker(record ?? null);
          return (
            <View key={draft.id} style={shellStyles.card}>
              <Text style={styles.mode}>
                {draft.available
                  ? (delivery?.[0] ?? 'Saved on device')
                  : draft.state === 'deleting'
                    ? 'Discard incomplete'
                    : 'Recording incomplete or missing'}
              </Text>
              <Text style={shellStyles.cardTitle}>{draft.projectName}</Text>
              <Text style={shellStyles.body}>
                {draft.duration.toFixed(1)} seconds ·{' '}
                {formatDateTime(draft.createdAt)}
              </Text>
              <Text style={styles.detail}>
                {delivery?.[1] ?? 'Not sent for review'}
              </Text>
              {!!discardBlocker && (
                <Text style={styles.detail}>{discardBlocker}</Text>
              )}
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
                  disabled={
                    busy ||
                    !!discarding ||
                    !!discardBlocker ||
                    !outbox.isSuccess ||
                    outbox.isFetching
                  }
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
          );
        })
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
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e7ea',
  },
  headerTitle: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  languages: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  language: {
    minHeight: 40,
    minWidth: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfe5e9',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  languageSelected: { borderColor: '#7655d9', backgroundColor: '#f2eeff' },
  languageFlag: { fontSize: 16 },
  languageLabel: { color: '#667681', fontSize: 13, fontWeight: '700' },
  languageLabelSelected: { color: '#7655d9' },
  mode: { color: '#266b8c', fontWeight: '700', fontSize: 13, lineHeight: 21 },
  detail: { color: '#586c7a', fontSize: 13, lineHeight: 21 },
  companion: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e7ea',
    borderRadius: 16,
    padding: 20,
    marginTop: 22,
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
    paddingTop: 16,
    paddingHorizontal: 4,
    gap: 10,
    alignItems: 'center',
  },
  projectName: {
    color: '#73818b',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  prompt: {
    color: '#667681',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 330,
  },
  recordHaloOuter: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#eee9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  recordHaloOuterActive: { backgroundColor: '#fde3e5' },
  recordHaloInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#dcd2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordHaloInnerActive: { backgroundColor: '#fac8cc' },
  record: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#7655d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordActive: { backgroundColor: '#ef3f49' },
  recordingLabel: {
    color: '#7b8992',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  recordingLabelActive: { color: '#ef3f49' },
  waveform: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: '#d5dde2' },
  waveBarActive: { backgroundColor: '#ef5c64' },
  timer: {
    color: '#17354c',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  captureActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  captureAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  cancelAction: {
    borderWidth: 1,
    borderColor: '#f2a0a5',
    backgroundColor: '#fff1f2',
  },
  cancelActionText: { color: '#ef5c64', fontSize: 14, fontWeight: '800' },
  submitAction: { backgroundColor: '#27c76f' },
  submitActionText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  limit: { color: '#7b8992', fontSize: 11, lineHeight: 17 },
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
  otherMethods: {
    color: '#73818b',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 24,
  },
  empty: { color: '#586c7a', paddingVertical: 28, fontSize: 16 },
});
