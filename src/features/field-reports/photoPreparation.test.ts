import { preparePhoto, validatePreparedPhoto } from './photoPreparation';

it('accepts normalized JPEG bytes within the production media boundary', () => {
  expect(
    validatePreparedPhoto({
      uri: 'private-cache/photo.jpg',
      width: 1600,
      height: 1200,
      byteLength: 1024,
      mimeType: 'image/jpeg',
    }),
  ).toEqual({
    uri: 'private-cache/photo.jpg',
    width: 1600,
    height: 1200,
    byteLength: 1024,
    mimeType: 'image/jpeg',
  });
});

it.each([
  [{ width: 0, height: 10, byteLength: 10 }, 'dimensions'],
  [{ width: 5000, height: 5000, byteLength: 10 }, '20 megapixels'],
  [{ width: 10, height: 10, byteLength: 5 * 1024 * 1024 + 1 }, '5 MB'],
])('rejects invalid normalized output %j', (change, message) => {
  expect(() =>
    validatePreparedPhoto({
      uri: 'private-cache/photo.jpg',
      mimeType: 'image/jpeg',
      width: change.width ?? 100,
      height: change.height ?? 100,
      byteLength: change.byteLength ?? 10,
    }),
  ).toThrow(message);
});

it('re-encodes oversized output with smaller bounded attempts', async () => {
  const sizes = [5 * 1024 * 1024 + 1, 2048];
  const render = jest.fn(async (_uri, resize, compress) => ({
    uri: `cache/${compress}.jpg`,
    width: resize?.width ?? 1200,
    height: resize?.height ?? 800,
  }));
  const read = jest.fn(async () => new Uint8Array(sizes.shift()!));
  const result = await preparePhoto(
    { uri: 'source.heic', width: 4000, height: 3000 },
    render,
    read,
  );
  expect(result.byteLength).toBe(2048);
  expect(result.mimeType).toBe('image/jpeg');
  expect(render).toHaveBeenNthCalledWith(
    1,
    'source.heic',
    { width: 2048 },
    0.82,
  );
  expect(render).toHaveBeenNthCalledWith(
    2,
    'source.heic',
    { width: 1600 },
    0.68,
  );
});
