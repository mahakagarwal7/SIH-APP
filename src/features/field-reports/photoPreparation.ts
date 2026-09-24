import { MAX_PHOTO_BYTES, MAX_PHOTO_PIXELS } from './reportDraftStore';

export type NormalizedPhoto = {
  uri: string;
  width: number;
  height: number;
  byteLength: number;
  mimeType: 'image/jpeg';
};

export type PreparedPhoto = NormalizedPhoto & { bytes: Uint8Array };
export type PhotoSource = { uri: string; width: number; height: number };
export type Resize = { width?: number; height?: number };

const attempts = [
  { maxSide: 2048, compress: 0.82 },
  { maxSide: 1600, compress: 0.68 },
  { maxSide: 1280, compress: 0.55 },
];

function resizeFor(source: PhotoSource, maxSide: number): Resize | undefined {
  if (source.width < 1 || source.height < 1)
    throw new Error('The selected photo has no readable dimensions.');
  if (Math.max(source.width, source.height) <= maxSide) return undefined;
  return source.width >= source.height
    ? { width: maxSide }
    : { height: maxSide };
}

export function validatePreparedPhoto(photo: NormalizedPhoto): NormalizedPhoto {
  if (
    !Number.isInteger(photo.width) ||
    !Number.isInteger(photo.height) ||
    photo.width < 1 ||
    photo.height < 1
  )
    throw new Error('The photo dimensions are unavailable.');
  if (photo.width * photo.height > MAX_PHOTO_PIXELS)
    throw new Error('The photo exceeds 20 megapixels.');
  if (photo.byteLength < 1 || photo.byteLength > MAX_PHOTO_BYTES)
    throw new Error('The normalized photo must be 5 MB or smaller.');
  if (photo.mimeType !== 'image/jpeg')
    throw new Error('The normalized photo must be a JPEG.');
  return photo;
}

export async function preparePhoto(
  source: PhotoSource,
  render: (
    uri: string,
    resize: Resize | undefined,
    compress: number,
  ) => Promise<{ uri: string; width: number; height: number }>,
  read: (uri: string) => Promise<Uint8Array>,
): Promise<PreparedPhoto> {
  let last: PreparedPhoto | null = null;
  for (const attempt of attempts) {
    const result = await render(
      source.uri,
      resizeFor(source, attempt.maxSide),
      attempt.compress,
    );
    const bytes = await read(result.uri);
    last = {
      uri: result.uri,
      width: result.width,
      height: result.height,
      byteLength: bytes.length,
      mimeType: 'image/jpeg',
      bytes,
    };
    if (bytes.length <= MAX_PHOTO_BYTES) {
      validatePreparedPhoto(last);
      return last;
    }
  }
  if (!last) throw new Error('The selected photo could not be read.');
  validatePreparedPhoto(last);
  return last;
}
