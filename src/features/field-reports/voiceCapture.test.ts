import { VoiceCapture } from './voiceCapture';

import type { PcmBuffer } from './pcmWav';
import type { CaptureState } from './voiceCapture';

function sample(seconds = 1, amplitude = 2048): PcmBuffer {
  const data = new ArrayBuffer(16000 * 2 * seconds);
  const view = new DataView(data);
  for (let i = 0; i < data.byteLength; i += 2)
    view.setInt16(i, amplitude, true);
  return { data, channels: 1, sampleRate: 16000 };
}
function setup() {
  const states: CaptureState[] = [];
  const callbacks: ((buffer: PcmBuffer) => void)[] = [];
  const mic = {
    start: jest.fn(async () => {}),
    stop: jest.fn(),
    release: jest.fn(),
  };
  const permission = jest.fn(async () => true);
  const save = jest.fn(async () => {});
  const controller = new VoiceCapture({
    permission,
    save,
    microphone: (callback) => {
      callbacks.push(callback);
      return mic;
    },
    onState: (state) => states.push(state),
  });
  return {
    controller,
    permission,
    save,
    mic,
    states,
    callbacks,
    feed: (seconds = 1) => callbacks.at(-1)!(sample(seconds)),
    state: () => states.at(-1),
  };
}
afterEach(() => jest.useRealTimers());
it('requests permission once under double taps and stops before persisting', async () => {
  const c = setup();
  await Promise.all([c.controller.start(), c.controller.start()]);
  expect(c.permission).toHaveBeenCalledTimes(1);
  c.feed();
  await Promise.all([c.controller.stop(), c.controller.stop()]);
  expect(c.mic.stop).toHaveBeenCalledTimes(1);
  expect(c.save).toHaveBeenCalledTimes(1);
  expect(c.state()?.phase).toBe('saved');
});
it('reports live audio level and cancels without persisting', async () => {
  const c = setup();
  await c.controller.start();
  c.feed();
  expect(c.state()).toMatchObject({ phase: 'recording', level: 0.75 });
  c.callbacks[0]!(sample(1, 32767));
  expect(c.state()).toMatchObject({ phase: 'recording', level: 1 });
  c.controller.cancel();
  expect(c.state()).toMatchObject({ phase: 'idle', duration: 0, level: 0 });
  expect(c.mic.stop).toHaveBeenCalledTimes(1);
  expect(c.mic.release).toHaveBeenCalledTimes(1);
  c.callbacks[0]!(sample());
  expect(c.save).not.toHaveBeenCalled();
});
it('never starts the microphone after permission is denied or granted after leaving', async () => {
  const c = setup();
  c.permission.mockResolvedValueOnce(false);
  await c.controller.start();
  expect(c.state()?.phase).toBe('error');
  expect(c.mic.start).not.toHaveBeenCalled();
  let resolve!: (value: boolean) => void;
  c.permission.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = c.controller.start();
  c.controller.interrupt();
  resolve(true);
  await pending;
  expect(c.mic.start).not.toHaveBeenCalled();
});
it('automatically saves at 25 seconds and ignores late native buffers', async () => {
  const c = setup();
  await c.controller.start();
  c.feed(26);
  await Promise.resolve();
  await Promise.resolve();
  expect(c.save).toHaveBeenCalledWith(
    expect.objectContaining({ duration: 25 }),
  );
  const late = c.callbacks[0]!;
  late(sample());
  expect(c.save).toHaveBeenCalledTimes(1);
  await c.controller.start();
  late(sample(10));
  c.feed();
  await c.controller.stop();
  expect(c.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ duration: 1 }),
  );
});
it('preserves stopped audio for a failed save retry, without starting another recording', async () => {
  const c = setup();
  c.save.mockRejectedValueOnce(new Error('Storage full'));
  await c.controller.start();
  c.feed();
  await c.controller.stop();
  expect(c.state()).toMatchObject({ phase: 'error', canRetry: true });
  await c.controller.start();
  expect(c.mic.start).toHaveBeenCalledTimes(1);
  await c.controller.retry();
  expect(c.state()?.phase).toBe('saved');
  expect(c.save.mock.calls[0]).toEqual(c.save.mock.calls[1]);
});
it('stops and saves on interruption, and releases native resources on disposal', async () => {
  const c = setup();
  await c.controller.start();
  c.feed();
  c.controller.dispose();
  await Promise.resolve();
  await Promise.resolve();
  expect(c.mic.stop).toHaveBeenCalledTimes(1);
  expect(c.mic.release).toHaveBeenCalledTimes(1);
  expect(c.save).toHaveBeenCalledTimes(1);
  c.callbacks[0]!(sample());
  expect(c.save).toHaveBeenCalledTimes(1);
});
it('times out a stalled microphone and never calls a zero-byte recording saved', async () => {
  jest.useFakeTimers();
  const c = setup();
  await c.controller.start();
  jest.advanceTimersByTime(4000);
  await Promise.resolve();
  expect(c.mic.stop).toHaveBeenCalledTimes(1);
  expect(c.state()?.phase).toBe('error');
  expect(c.save).not.toHaveBeenCalled();
});

it('distinguishes the Android permission dialog from leaving the recording screen', async () => {
  const states: CaptureState[] = [];
  const start = jest.fn(async () => {});
  let permission!: (allowed: boolean) => void;
  let active = false;
  const c = new VoiceCapture({
    permission: () =>
      new Promise((resolve) => {
        permission = resolve;
      }),
    isActive: () => active,
    microphone: () => ({ start, stop: jest.fn(), release: jest.fn() }),
    save: jest.fn(),
    onState: (s) => states.push(s),
  });
  const denied = c.start();
  c.background();
  permission(false);
  await denied;
  expect(states.at(-1)?.message).toContain('denied');
  const grantedWhileAway = c.start();
  c.background();
  permission(true);
  await grantedWhileAway;
  expect(start).not.toHaveBeenCalled();
  expect(states.at(-1)?.phase).toBe('idle');
  active = true;
  const granted = c.start();
  c.background();
  permission(true);
  await granted;
  expect(start).toHaveBeenCalledTimes(1);
  c.dispose();
});
