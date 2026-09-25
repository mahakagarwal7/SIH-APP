import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { choosePhoto, preparePickedPhoto } from './nativePhotoPicker';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  getPendingResultAsync: jest.fn(),
}));

const asset = {
  uri: 'cache/full-resolution.jpg',
  width: 4000,
  height: 3000,
  fileSize: 4_000_000,
} as ImagePicker.ImagePickerAsset;

beforeEach(() => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [asset],
  });
  jest.mocked(manipulateAsync).mockResolvedValue({
    uri: 'cache/compressed.jpg',
    width: 2048,
    height: 1536,
  });
  jest
    .mocked(File)
    .mockImplementation(
      () => ({ bytes: async () => new Uint8Array(400_000) }) as never,
    );
});

it('returns the selected source before starting compression', async () => {
  await expect(choosePhoto()).resolves.toBe(asset);
  expect(manipulateAsync).not.toHaveBeenCalled();
});

it('measures the source and prepared JPEG sizes independently', async () => {
  await expect(preparePickedPhoto(asset)).resolves.toMatchObject({
    uri: 'cache/compressed.jpg',
    width: 2048,
    height: 1536,
    sourceByteLength: 4_000_000,
    byteLength: 400_000,
    mimeType: 'image/jpeg',
  });
  expect(manipulateAsync).toHaveBeenCalledWith(
    asset.uri,
    [{ resize: { width: 2048 } }],
    { compress: 0.82, format: SaveFormat.JPEG },
  );
});
