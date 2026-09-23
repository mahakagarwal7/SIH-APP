import { PcmWavCapture } from './pcmWav';

function pcm(frames: number, sample = 2048): ArrayBuffer {
  const bytes = new ArrayBuffer(frames * 2);
  const view = new DataView(bytes);
  for (let i = 0; i < frames; i++)
    view.setInt16(i * 2, i % 2 ? sample : -sample, true);
  return bytes;
}

it('writes mono PCM16 RIFF/WAVE bytes and derives duration from actual samples', () => {
  const capture = new PcmWavCapture();
  capture.append({ data: pcm(1600), sampleRate: 16000, channels: 1 });
  capture.append({ data: pcm(1600), sampleRate: 16000, channels: 1 });
  const result = capture.finish();
  const view = new DataView(result.bytes.buffer);
  expect(String.fromCharCode(...result.bytes.slice(0, 4))).toBe('RIFF');
  expect(String.fromCharCode(...result.bytes.slice(8, 12))).toBe('WAVE');
  expect(view.getUint32(4, true)).toBe(result.bytes.length - 8);
  expect(view.getUint16(20, true)).toBe(1);
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(28, true)).toBe(32000);
  expect(view.getUint16(32, true)).toBe(2);
  expect(view.getUint16(34, true)).toBe(16);
  expect(view.getUint32(40, true)).toBe(6400);
  expect(view.getInt16(44, true)).toBe(-2048);
  expect(result.duration).toBe(0.2);
});

it('bounds capture at 25 seconds even when the final native buffer crosses the limit', () => {
  const capture = new PcmWavCapture();
  expect(
    capture.append({ data: pcm(48000 * 24), sampleRate: 48000, channels: 1 }),
  ).toBe(false);
  expect(
    capture.append({ data: pcm(48000 * 2), sampleRate: 48000, channels: 1 }),
  ).toBe(true);
  const result = capture.finish();
  expect(result.duration).toBe(25);
  expect(result.bytes.length).toBe(44 + 48000 * 25 * 2);
});

it.each([8000, 96000, NaN])(
  'rejects unsupported actual sample rate %s',
  (sampleRate) => {
    expect(() =>
      new PcmWavCapture().append({ data: pcm(3200), sampleRate, channels: 1 }),
    ).toThrow();
  },
);

it('rejects stereo, partial samples and format changes during capture', () => {
  expect(() =>
    new PcmWavCapture().append({
      data: pcm(3200),
      sampleRate: 16000,
      channels: 2,
    }),
  ).toThrow();
  expect(() =>
    new PcmWavCapture().append({
      data: new ArrayBuffer(3),
      sampleRate: 16000,
      channels: 1,
    }),
  ).toThrow();
  const capture = new PcmWavCapture();
  capture.append({ data: pcm(1600), sampleRate: 16000, channels: 1 });
  expect(() =>
    capture.append({ data: pcm(1600), sampleRate: 48000, channels: 1 }),
  ).toThrow();
});

it('rejects missing, too-short and near-silent input like the existing worker', () => {
  expect(() => new PcmWavCapture().finish()).toThrow();
  const short = new PcmWavCapture();
  short.append({ data: pcm(3199), sampleRate: 16000, channels: 1 });
  expect(() => short.finish()).toThrow();
  const silent = new PcmWavCapture();
  silent.append({ data: pcm(3200, 1), sampleRate: 16000, channels: 1 });
  expect(() => silent.finish()).toThrow();
});

it('copies native buffers and rejects late events after finishing', () => {
  const capture = new PcmWavCapture();
  const data = pcm(3200);
  capture.append({ data, sampleRate: 16000, channels: 1 });
  new Uint8Array(data).fill(0);
  expect(capture.finish().duration).toBe(0.2);
  expect(() =>
    capture.append({ data, sampleRate: 16000, channels: 1 }),
  ).toThrow();
});
