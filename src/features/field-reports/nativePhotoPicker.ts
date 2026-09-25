import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { preparePhoto } from './photoPreparation';

import type { PreparedPhoto, Resize } from './photoPreparation';
import type { ImagePickerAsset, ImagePickerResult } from 'expo-image-picker';

export type PreparedLocalPhoto = PreparedPhoto & {
  sourceByteLength: number | null;
};
export type PickedLocalPhoto = ImagePickerAsset;

export async function preparePickedPhoto(
  asset: ImagePickerAsset,
): Promise<PreparedLocalPhoto> {
  const prepared = await preparePhoto(
    asset,
    (uri, resize: Resize | undefined, compress) =>
      manipulateAsync(uri, resize ? [{ resize }] : [], {
        compress,
        format: SaveFormat.JPEG,
      }),
    async (uri) => new File(uri).bytes(),
  );
  return {
    ...prepared,
    sourceByteLength: asset.fileSize ?? null,
  };
}

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
};

async function selected(result: ImagePickerResult) {
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function takePhoto() {
  if (!(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error('Camera access is needed to take a site photo.');
  return selected(await ImagePicker.launchCameraAsync(options));
}

export async function choosePhoto() {
  if (!(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted)
    throw new Error('Photo access is needed to choose a site photo.');
  return selected(await ImagePicker.launchImageLibraryAsync(options));
}

export async function recoverPendingPhoto() {
  const result = await ImagePicker.getPendingResultAsync();
  if (!result) return null;
  if ('code' in result)
    throw new Error(
      'Android could not restore the selected photo. Choose it again.',
    );
  return selected(result);
}
