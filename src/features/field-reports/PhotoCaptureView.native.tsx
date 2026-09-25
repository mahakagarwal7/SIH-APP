import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '@/features/localization/LocalizedText';

import type { PickedLocalPhoto } from './nativePhotoPicker';
import type { CameraType, FlashMode } from 'expo-camera';

export type PhotoCaptureItem = {
  id: string;
  caption: string;
  previewUri: string;
  ready: boolean;
  error: string | null;
};

export function PhotoCaptureView({
  projectName,
  photos,
  offline,
  recovering,
  choosing,
  saving,
  message,
  onAdd,
  onChoose,
  onCaption,
  onRemove,
  onSave,
}: {
  projectName: string;
  photos: PhotoCaptureItem[];
  offline: boolean;
  recovering: boolean;
  choosing: boolean;
  saving: boolean;
  message: string;
  onAdd(photo: PickedLocalPhoto): void;
  onChoose(): void;
  onCaption(id: string, caption: string): void;
  onRemove(id: string): void;
  onSave(): void;
}) {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const active = useRef(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const previousPhotoCount = useRef(0);
  const latest = photos.at(-1);
  const selected = photos.find((photo) => photo.id === selectedId) ?? latest;
  const limitReached = photos.length >= 3;
  const hasUnready = photos.some((photo) => !photo.ready);
  const flash: FlashMode = flashEnabled
    ? facing === 'front'
      ? 'screen'
      : 'on'
    : 'off';

  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );
  useEffect(() => {
    if (
      photos.length > previousPhotoCount.current ||
      (selectedId && !photos.some((photo) => photo.id === selectedId))
    )
      setSelectedId(latest?.id ?? null);
    previousPhotoCount.current = photos.length;
  }, [latest?.id, photos, selectedId]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/field');
  }

  async function capture() {
    if (!camera.current || !ready || capturing || choosing || limitReached)
      return;
    setCapturing(true);
    setCameraError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1 });
      if (active.current)
        onAdd({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          fileSize: null,
        });
    } catch (error) {
      if (active.current)
        setCameraError(
          error instanceof Error
            ? error.message
            : 'The camera could not take this photo.',
        );
    } finally {
      if (active.current) setCapturing(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {focused && permission?.granted ? (
        <CameraView
          facing={facing}
          flash={flash}
          mode="picture"
          onCameraReady={() => setReady(true)}
          onMountError={(event) => setCameraError(event.message)}
          ref={camera}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      <View pointerEvents="none" style={styles.grid}>
        <View style={[styles.gridLine, styles.verticalOne]} />
        <View style={[styles.gridLine, styles.verticalTwo]} />
        <View style={[styles.gridLine, styles.horizontalOne]} />
        <View style={[styles.gridLine, styles.horizontalTwo]} />
      </View>

      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={leave}
          style={styles.overlayButton}
        >
          <Feather color="#ffffff" name="arrow-left" size={21} />
        </Pressable>
        <Text numberOfLines={1} style={styles.projectName}>
          {projectName}
        </Text>
        <View style={styles.topActions}>
          <Pressable
            accessibilityLabel={
              flashEnabled ? 'Turn flash off' : 'Turn flash on'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: !permission?.granted }}
            disabled={!permission?.granted}
            onPress={() => setFlashEnabled((current) => !current)}
            style={styles.overlayButton}
          >
            <Feather
              color={flashEnabled ? '#ffd35c' : '#ffffff'}
              name={flashEnabled ? 'zap' : 'zap-off'}
              size={20}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Flip camera"
            accessibilityRole="button"
            accessibilityState={{ disabled: !permission?.granted }}
            disabled={!permission?.granted}
            onPress={() => {
              setReady(false);
              setFacing((current) => (current === 'back' ? 'front' : 'back'));
            }}
            style={styles.overlayButton}
          >
            <Feather color="#ffffff" name="refresh-cw" size={20} />
          </Pressable>
        </View>
      </View>

      {!permission ? (
        <View style={styles.permissionCard}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.permissionText}>Loading camera…</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.permissionCard}>
          <Feather color="#ffffff" name="camera-off" size={30} />
          <Text style={styles.permissionText}>
            Camera access is needed to take a site photo.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={styles.permissionAction}
          >
            <Text style={styles.permissionActionText}>Enable camera</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomPanel}>
        {(offline || recovering || message || cameraError) && (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {cameraError ||
              message ||
              (recovering
                ? 'Restoring photo…'
                : 'Offline · Photos stay on this device.')}
          </Text>
        )}
        {selected && (
          <TextInput
            accessibilityLabel={`Caption for photo ${photos.findIndex((photo) => photo.id === selected.id) + 1}`}
            editable={!saving}
            maxLength={500}
            onChangeText={(caption) => onCaption(selected.id, caption)}
            placeholder="Optional location or evidence note"
            placeholderTextColor="#cad2d8"
            style={styles.caption}
            value={selected.caption}
          />
        )}
        {photos.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: hasUnready || saving }}
            disabled={hasUnready || saving}
            onPress={onSave}
            style={[
              styles.saveAction,
              (hasUnready || saving) && styles.disabled,
            ]}
          >
            <Feather color="#ffffff" name="check" size={18} />
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : 'Save on device'}
            </Text>
          </Pressable>
        )}
        <View style={styles.controls}>
          <ScrollView
            contentContainerStyle={styles.thumbnails}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailStrip}
          >
            {photos.map((photo, position) => (
              <Pressable
                accessibilityLabel={`Edit caption for photo ${position + 1}`}
                accessibilityRole="button"
                key={photo.id}
                onPress={() => setSelectedId(photo.id)}
                style={[
                  styles.thumbnailFrame,
                  selected?.id === photo.id && styles.thumbnailSelected,
                ]}
              >
                <Image
                  accessibilityLabel={`Selected photo ${position + 1}`}
                  source={{ uri: photo.previewUri }}
                  style={styles.thumbnail}
                />
                {!photo.ready && <View style={styles.thumbnailPending} />}
              </Pressable>
            ))}
            {!limitReached && (
              <Pressable
                accessibilityLabel="Choose photo"
                accessibilityRole="button"
                accessibilityState={{ disabled: choosing || recovering }}
                disabled={choosing || recovering}
                onPress={onChoose}
                style={styles.addTile}
              >
                <Feather color="#ffffff" name="plus" size={24} />
              </Pressable>
            )}
          </ScrollView>
          <Pressable
            accessibilityLabel="Take photo"
            accessibilityRole="button"
            accessibilityState={{
              disabled:
                !permission?.granted ||
                !ready ||
                capturing ||
                choosing ||
                recovering ||
                limitReached,
            }}
            disabled={
              !permission?.granted ||
              !ready ||
              capturing ||
              choosing ||
              recovering ||
              limitReached
            }
            onPress={() => void capture()}
            style={[
              styles.shutterOuter,
              (capturing || limitReached) && styles.disabled,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            accessibilityLabel="Retake last photo"
            accessibilityRole="button"
            accessibilityState={{ disabled: !latest || saving }}
            disabled={!latest || saving}
            onPress={() => latest && onRemove(latest.id)}
            style={[styles.retake, (!latest || saving) && styles.disabled]}
          >
            <Feather color="#ffffff" name="rotate-ccw" size={22} />
          </Pressable>
        </View>
        <Text style={styles.count}>{photos.length} of 3 photos attached</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111a2b', overflow: 'hidden' },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.32,
  },
  gridLine: { position: 'absolute', backgroundColor: '#ffffff' },
  verticalOne: { top: 0, bottom: 0, left: '33.33%', width: 1 },
  verticalTwo: { top: 0, bottom: 0, left: '66.66%', width: 1 },
  horizontalOne: { left: 0, right: 0, top: '33.33%', height: 1 },
  horizontalTwo: { left: 0, right: 0, top: '66.66%', height: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  topActions: { flexDirection: 'row', gap: 8 },
  overlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 26, 43, 0.68)',
  },
  projectName: {
    flex: 1,
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  permissionCard: {
    position: 'absolute',
    left: 30,
    right: 30,
    top: '34%',
    backgroundColor: 'rgba(15, 26, 43, 0.88)',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  permissionAction: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionActionText: { color: '#17354c', fontWeight: '800' },
  bottomPanel: {
    marginTop: 'auto',
    backgroundColor: 'rgba(15, 26, 43, 0.9)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  status: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  caption: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  saveAction: {
    minHeight: 44,
    alignSelf: 'center',
    borderRadius: 22,
    backgroundColor: '#27c76f',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  saveText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  controls: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  thumbnailStrip: { flex: 1, maxHeight: 58 },
  thumbnails: { alignItems: 'center', gap: 6 },
  thumbnailFrame: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  thumbnailSelected: { borderColor: '#27c76f' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPending: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 174, 45, 0.42)',
  },
  addTile: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  retake: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: '#d9e0e5',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  disabled: { opacity: 0.42 },
});
