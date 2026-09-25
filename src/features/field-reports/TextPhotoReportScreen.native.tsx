import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

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

import { assertLocalDraftCanBeDiscarded } from './nativeOutbox';
import {
  choosePhoto,
  preparePickedPhoto,
  recoverPendingPhoto,
  takePhoto,
} from './nativePhotoPicker';
import { getReportDraftStore } from './nativeReportDraftStore';
import { ReportMethodLinks } from './ReportMethodLinks';

import type { PickedLocalPhoto, PreparedLocalPhoto } from './nativePhotoPicker';
import type {
  LocalReportDraft,
  PreparedDraftPhoto,
  ReportDraft,
  SavedPhoto,
} from './reportDraftStore';

type LocalPhoto = {
  id: string;
  caption: string;
  previewUri: string;
  prepared: PreparedLocalPhoto | null;
  error: string | null;
};
type ReadyLocalPhoto = LocalPhoto & { prepared: PreparedLocalPhoto };
type PendingSave = { draft: ReportDraft; prepared: PreparedDraftPhoto[] };

function isReadyPhoto(photo: LocalPhoto): photo is ReadyLocalPhoto {
  return photo.prepared !== null;
}

function byteLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
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
      style={[styles.action, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function toSaved(photo: ReadyLocalPhoto): SavedPhoto {
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

function AccountTextPhotoScreen({
  userId,
  mode,
}: {
  userId: string;
  mode: 'text' | 'photo';
}) {
  useLocalization();
  const auth = useAuth();
  const project = useCaptureProject();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const recovered = useRef(false);
  const recoveryPending = useRef(true);
  const mutationPending = useRef(false);
  const drafts = useQuery({
    queryKey: ['report-drafts', userId],
    networkMode: 'always',
    queryFn: async () => (await getReportDraftStore()).list(userId),
  });
  const context =
    !project.error && project.data?.member.user_id === userId
      ? project.data
      : null;
  const mutationBusy = saving || picking || recovering || discarding !== null;
  const busy = mutationBusy || !!pending;
  const hasUnreadyPhotos = photos.some((photo) => !photo.prepared);

  const addPicked = useCallback((photo: PickedLocalPhoto | null) => {
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
    setMessage('Photo attached. Compression continues in the background.');
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
        setMessage('Photo compressed and ready to save.');
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        const detail =
          error instanceof Error ? error.message : 'Could not compress photo.';
        setPhotos((current) =>
          current.map((item) =>
            item.id === id ? { ...item, error: detail } : item,
          ),
        );
        setMessage(detail);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!recovered.current) {
      recovered.current = true;
      void recoverPendingPhoto()
        .then((photo) => mounted.current && addPicked(photo))
        .catch(
          (error: unknown) =>
            mounted.current &&
            setMessage(
              error instanceof Error
                ? error.message
                : 'Could not restore photo.',
            ),
        )
        .finally(() => {
          recoveryPending.current = false;
          if (mounted.current) setRecovering(false);
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [addPicked]);
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries({ queryKey: ['report-drafts', userId] });
    }, [client, userId]),
  );

  async function pick(source: 'camera' | 'library') {
    if (
      !mounted.current ||
      photos.length >= 3 ||
      busy ||
      mutationPending.current
    )
      return;
    mutationPending.current = true;
    setPicking(true);
    setMessage('');
    try {
      const photo =
        source === 'camera' ? await takePhoto() : await choosePhoto();
      if (mounted.current) addPicked(photo);
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not prepare this photo.',
        );
    } finally {
      mutationPending.current = false;
      if (mounted.current) setPicking(false);
    }
  }

  function createPending(): PendingSave | null {
    if (!context || hasUnreadyPhotos) return null;
    const id = randomUUID();
    const ready = photos.filter(isReadyPhoto);
    const saved = ready.map(toSaved);
    return {
      draft: {
        id,
        userId,
        projectId: context.project.id,
        projectName: context.project.name,
        createdAt: new Date().toISOString(),
        text,
        photos: saved,
        state: 'saving',
      },
      prepared: saved.map((photo, position) => ({
        photo,
        bytes: ready[position]!.prepared.bytes,
      })),
    };
  }

  async function save(attempt?: PendingSave) {
    if (!mounted.current || mutationPending.current || recoveryPending.current)
      return;
    if (!pending && !text.trim() && photos.length === 0) {
      setMessage('Add report text or a photo before saving.');
      return;
    }
    const target = attempt ?? pending ?? createPending();
    if (!target || saving) return;
    mutationPending.current = true;
    setPending(target);
    setSaving(true);
    setMessage('Saving to this device…');
    try {
      await (await getReportDraftStore()).save(target.draft, target.prepared);
      if (!mounted.current) return;
      setPending(null);
      setText('');
      setPhotos([]);
      setMessage('Saved on device. Not sent for review.');
      client.setQueryData<LocalReportDraft[]>(
        ['report-drafts', userId],
        (current = []) => [
          {
            ...target.draft,
            state: 'saved',
            available: true,
            photoUris: [],
          },
          ...current.filter((draft) => draft.id !== target.draft.id),
        ],
      );
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not finish saving this draft.',
        );
    } finally {
      mutationPending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function discard(id: string) {
    if (
      !mounted.current ||
      mutationPending.current ||
      pending ||
      recoveryPending.current
    )
      return;
    mutationPending.current = true;
    setDiscarding(id);
    setMessage('');
    try {
      await assertLocalDraftCanBeDiscarded(userId, id);
      await (await getReportDraftStore()).discard(userId, id);
      if (mounted.current)
        client.setQueryData<LocalReportDraft[]>(
          ['report-drafts', userId],
          (current = []) => current.filter((draft) => draft.id !== id),
        );
    } catch (error) {
      if (mounted.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not finish discarding. Retry the discard action.',
        );
        await client.invalidateQueries({ queryKey: ['report-drafts', userId] });
      }
    } finally {
      mutationPending.current = false;
      if (mounted.current) setDiscarding(null);
    }
  }

  async function discardFailedSave() {
    const attempt = pending;
    if (!attempt || !mounted.current || mutationPending.current) return;
    mutationPending.current = true;
    setDiscarding(attempt.draft.id);
    try {
      const store = await getReportDraftStore();
      if (
        (await store.list(userId)).some(
          (draft) => draft.id === attempt.draft.id,
        )
      )
        await store.discard(userId, attempt.draft.id);
      if (!mounted.current) return;
      setPending(null);
      setMessage('Unsaved attempt discarded.');
      client.setQueryData<LocalReportDraft[]>(
        ['report-drafts', userId],
        (current = []) =>
          current.filter((draft) => draft.id !== attempt.draft.id),
      );
    } catch {
      if (mounted.current)
        setMessage('Could not discard the incomplete save. Retry.');
    } finally {
      mutationPending.current = false;
      if (mounted.current) setDiscarding(null);
    }
  }

  return (
    <ShellPage title="Report progress" eyebrow="FIELD · TEXT AND PHOTO">
      <View style={styles.steps}>
        <Text style={styles.mode}>1 Report</Text>
        <Text style={styles.detail}>2 Check</Text>
        <Text style={styles.detail}>3 Send</Text>
      </View>
      <ReportMethodLinks active={mode} />
      {recovering && <Text style={styles.message}>Restoring photo…</Text>}
      {auth.offline && (
        <Text style={styles.notice}>Offline · Drafts stay on this device.</Text>
      )}
      {context ? (
        <View style={styles.form}>
          <Text style={styles.mode}>
            {mode === 'photo' ? 'PHOTO REPORT' : 'TYPE REPORT'}
          </Text>
          <Text style={shellStyles.cardTitle}>{context.project.name}</Text>
          <Text style={shellStyles.body}>
            Include the activity, location, work completed and what remains.
          </Text>
          <TextInput
            accessibilityLabel="Report details"
            editable={!busy}
            maxLength={10_000}
            multiline
            onChangeText={setText}
            placeholder="Example: Installed two supports at the north pipe rack; welding remains."
            style={styles.input}
            textAlignVertical="top"
            value={text}
          />
          <Text style={styles.counter}>{text.length} / 10,000</Text>
          {photos.map((photo, position) => (
            <View key={photo.id} style={styles.photoRow}>
              <Image
                accessibilityLabel={`Selected photo ${position + 1}`}
                source={{ uri: photo.previewUri }}
                style={styles.thumbnail}
              />
              <View style={styles.photoDetail}>
                <Text style={styles.detail}>
                  Photo {position + 1} ·{' '}
                  {photo.prepared
                    ? photo.prepared.sourceByteLength &&
                      photo.prepared.sourceByteLength >
                        photo.prepared.byteLength
                      ? `${byteLabel(photo.prepared.sourceByteLength)} → ${byteLabel(photo.prepared.byteLength)} · ${Math.round((1 - photo.prepared.byteLength / photo.prepared.sourceByteLength) * 100)}% smaller`
                      : byteLabel(photo.prepared.byteLength)
                    : photo.error
                      ? 'Compression failed'
                      : 'Compressing…'}
                </Text>
                <TextInput
                  accessibilityLabel={`Caption for photo ${position + 1}`}
                  editable={!busy}
                  maxLength={500}
                  onChangeText={(caption) =>
                    setPhotos((current) =>
                      current.map((item) =>
                        item.id === photo.id ? { ...item, caption } : item,
                      ),
                    )
                  }
                  placeholder="Optional location or evidence note"
                  style={styles.caption}
                  value={photo.caption}
                />
                <Action
                  label="Remove photo"
                  disabled={busy}
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
              disabled={busy || photos.length >= 3}
              onPress={() => void pick('camera')}
            />
            <Action
              label="Choose photo"
              disabled={busy || photos.length >= 3}
              onPress={() => void pick('library')}
            />
          </View>
          <Text style={styles.detail}>
            {photos.length} of 3 photos · Photos are converted to JPEG and
            stored privately.
          </Text>
          {pending ? (
            <View>
              <Action
                label={saving ? 'Saving…' : 'Retry save'}
                disabled={mutationBusy}
                onPress={() => void save()}
              />
              <Action
                label="Discard incomplete save"
                disabled={mutationBusy}
                onPress={() => void discardFailedSave()}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: mutationBusy || hasUnreadyPhotos,
              }}
              disabled={mutationBusy || hasUnreadyPhotos}
              onPress={() => void save()}
              style={[
                styles.primary,
                (mutationBusy || hasUnreadyPhotos) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>Save on device</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={shellStyles.card}>
          {project.isPending && !auth.offline && (
            <ActivityIndicator color="#266b8c" />
          )}
          <Text style={shellStyles.cardTitle}>
            {project.error
              ? 'Project unavailable'
              : project.isPending
                ? 'Load your project to save a report'
                : 'No active project access'}
          </Text>
          <Text style={shellStyles.body}>
            {auth.offline
              ? 'Connect once to load your project. Existing drafts remain available.'
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
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      )}
      <Text style={styles.detail}>
        Check and Send are implemented in later approved slices.
      </Text>
      <View style={styles.savedHeader}>
        <Text accessibilityRole="header" style={shellStyles.cardTitle}>
          Your local text and photo drafts
        </Text>
        <Action
          label="Refresh drafts"
          disabled={drafts.isFetching || mutationBusy}
          onPress={() => void drafts.refetch()}
        />
      </View>
      {drafts.isPending ? (
        <Text style={shellStyles.body}>Loading drafts from this device…</Text>
      ) : drafts.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Could not load local drafts. Free device storage and retry.
        </Text>
      ) : drafts.data?.length === 0 ? (
        <Text style={styles.empty}>No text or photo drafts saved yet.</Text>
      ) : (
        drafts.data?.map((draft) => (
          <View key={draft.id} style={shellStyles.card}>
            <Text style={styles.mode}>
              {draft.available
                ? 'Saved on device'
                : draft.state === 'deleting'
                  ? 'Discard incomplete'
                  : 'Draft incomplete or missing'}
            </Text>
            <Text style={shellStyles.cardTitle}>{draft.projectName}</Text>
            {!!draft.text.trim() && (
              <Text numberOfLines={4} style={shellStyles.body}>
                {draft.text.trim()}
              </Text>
            )}
            <Text style={styles.detail}>
              {draft.photos.length}{' '}
              {draft.photos.length === 1 ? 'photo' : 'photos'} ·{' '}
              {formatDateTime(draft.createdAt)}
            </Text>
            <Text style={styles.detail}>Not sent for review</Text>
            <Action
              label={discarding === draft.id ? 'Discarding…' : 'Discard draft'}
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Discard local report?',
                  'Its text and photos will be permanently removed from this device.',
                  [
                    { text: 'Keep draft', style: 'cancel' },
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () => mounted.current && void discard(draft.id),
                    },
                  ],
                )
              }
            />
          </View>
        ))
      )}
    </ShellPage>
  );
}

export function TextPhotoReportScreen({ mode }: { mode: 'text' | 'photo' }) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session?.user.id : null;
  return userId ? (
    <AccountTextPhotoScreen
      key={`${userId}:${mode}`}
      userId={userId}
      mode={mode}
    />
  ) : null;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 18 },
  mode: { color: '#266b8c', fontWeight: '700', fontSize: 13, lineHeight: 21 },
  detail: { color: '#586c7a', fontSize: 13, lineHeight: 21 },
  notice: {
    backgroundColor: '#e7edf0',
    color: '#17354c',
    padding: 14,
    marginBottom: 16,
  },
  form: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    padding: 20,
    gap: 12,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#b8c8d1',
    padding: 14,
    color: '#17354c',
    fontSize: 16,
    lineHeight: 24,
  },
  counter: { color: '#627786', alignSelf: 'flex-end', fontSize: 12 },
  photoRow: {
    borderTopWidth: 1,
    borderTopColor: '#d7e0e5',
    paddingTop: 14,
    flexDirection: 'row',
    gap: 14,
  },
  thumbnail: { width: 88, height: 88, backgroundColor: '#e7edf0' },
  photoDetail: { flex: 1, gap: 6 },
  caption: {
    borderWidth: 1,
    borderColor: '#b8c8d1',
    padding: 10,
    minHeight: 48,
    color: '#17354c',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { color: '#266b8c', fontSize: 15, fontWeight: '600' },
  primary: {
    minHeight: 52,
    backgroundColor: '#17354c',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  message: { color: '#17354c', fontSize: 14, lineHeight: 22 },
  error: { color: '#9d3434', fontSize: 15, lineHeight: 23 },
  savedHeader: { marginTop: 30, gap: 4 },
  empty: { color: '#586c7a', paddingVertical: 28, fontSize: 16 },
});
