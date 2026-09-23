import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { ShellPage, shellStyles } from '@/features/navigation/shellUi';
import { useDefaultProject } from '@/features/projects/useMyWork';

import {
  choosePhoto,
  recoverPendingPhoto,
  takePhoto,
} from './nativePhotoPicker';
import { getReportDraftStore } from './nativeReportDraftStore';
import { ReportMethodLinks } from './ReportMethodLinks';

import type { PreparedLocalPhoto } from './nativePhotoPicker';
import type {
  LocalReportDraft,
  PreparedDraftPhoto,
  ReportDraft,
  SavedPhoto,
} from './reportDraftStore';

type LocalPhoto = PreparedLocalPhoto & { id: string; caption: string };
type PendingSave = { draft: ReportDraft; prepared: PreparedDraftPhoto[] };

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

function toSaved(photo: LocalPhoto): SavedPhoto {
  return {
    id: photo.id,
    fileName: `${photo.id}.jpg`,
    mimeType: 'image/jpeg',
    caption: photo.caption,
    byteLength: photo.byteLength,
    width: photo.width,
    height: photo.height,
  };
}

function AccountTextPhotoScreen({
  userId,
  mode,
}: {
  userId: string;
  mode: 'text' | 'photo';
}) {
  const auth = useAuth();
  const project = useDefaultProject();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const recovered = useRef(false);
  const drafts = useQuery({
    queryKey: ['report-drafts', userId],
    networkMode: 'always',
    queryFn: async () => (await getReportDraftStore()).list(userId),
  });
  const context =
    !project.error && project.data?.member.user_id === userId
      ? project.data
      : null;
  const busy = saving || picking || !!pending;

  const addPrepared = useCallback((photo: PreparedLocalPhoto | null) => {
    if (!photo) return;
    setPhotos((current) =>
      current.length >= 3
        ? current
        : [...current, { ...photo, id: randomUUID(), caption: '' }],
    );
    setMessage('Photo ready to save with this draft.');
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!recovered.current) {
      recovered.current = true;
      void recoverPendingPhoto()
        .then((photo) => mounted.current && addPrepared(photo))
        .catch(
          (error: unknown) =>
            mounted.current &&
            setMessage(
              error instanceof Error
                ? error.message
                : 'Could not restore photo.',
            ),
        );
    }
    return () => {
      mounted.current = false;
    };
  }, [addPrepared]);
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries({ queryKey: ['report-drafts', userId] });
    }, [client, userId]),
  );

  async function pick(source: 'camera' | 'library') {
    if (photos.length >= 3 || busy) return;
    setPicking(true);
    setMessage('');
    try {
      const photo =
        source === 'camera' ? await takePhoto() : await choosePhoto();
      if (mounted.current) addPrepared(photo);
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not prepare this photo.',
        );
    } finally {
      if (mounted.current) setPicking(false);
    }
  }

  function createPending(): PendingSave | null {
    if (!context) return null;
    const id = randomUUID();
    const saved = photos.map(toSaved);
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
        bytes: photos[position]!.bytes,
      })),
    };
  }

  async function save(attempt?: PendingSave) {
    if (!pending && !text.trim() && photos.length === 0) {
      setMessage('Add report text or a photo before saving.');
      return;
    }
    const target = attempt ?? pending ?? createPending();
    if (!target || saving) return;
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
      if (mounted.current) setSaving(false);
    }
  }

  async function discard(id: string) {
    if (!mounted.current) return;
    setDiscarding(id);
    setMessage('');
    try {
      await (await getReportDraftStore()).discard(userId, id);
    } catch {
      if (mounted.current)
        setMessage('Could not finish discarding. Retry the discard action.');
    } finally {
      if (mounted.current) {
        setDiscarding(null);
        client.setQueryData<LocalReportDraft[]>(
          ['report-drafts', userId],
          (current = []) => current.filter((draft) => draft.id !== id),
        );
      }
    }
  }

  async function discardFailedSave() {
    const attempt = pending;
    if (!attempt || !mounted.current) return;
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
                source={{ uri: photo.uri }}
                style={styles.thumbnail}
              />
              <View style={styles.photoDetail}>
                <Text style={styles.detail}>
                  Photo {position + 1} · {(photo.byteLength / 1024).toFixed(0)}{' '}
                  KB
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
                disabled={saving}
                onPress={() => void save()}
              />
              <Action
                label="Discard incomplete save"
                disabled={saving}
                onPress={() => void discardFailedSave()}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || picking }}
              disabled={saving || picking}
              onPress={() => void save()}
              style={[styles.primary, (saving || picking) && styles.disabled]}
            >
              <Text style={styles.primaryText}>Save on device</Text>
            </Pressable>
          )}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
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
      <Text style={styles.detail}>
        Check and Send are implemented in later approved slices.
      </Text>
      <View style={styles.savedHeader}>
        <Text accessibilityRole="header" style={shellStyles.cardTitle}>
          Your local text and photo drafts
        </Text>
        <Action
          label="Refresh drafts"
          disabled={drafts.isFetching || saving}
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
              {new Date(draft.createdAt).toLocaleString()}
            </Text>
            <Text style={styles.detail}>Not sent for review</Text>
            <Action
              label={discarding === draft.id ? 'Discarding…' : 'Discard draft'}
              disabled={!!discarding || saving}
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
  detail: { color: '#627786', fontSize: 13, lineHeight: 21 },
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
  empty: { color: '#627786', paddingVertical: 28, fontSize: 16 },
});
