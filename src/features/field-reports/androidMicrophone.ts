import { AudioModule } from 'expo-audio';

import type { PcmBuffer } from './pcmWav';
import type { Microphone } from './voiceCapture';

// Each capture owns a fresh stream/listener, so queued native events cannot
// become part of a subsequent recording. Only evaluated on Android.
export function androidMicrophone(
  onBuffer: (buffer: PcmBuffer) => void,
): Microphone {
  // eslint-disable-next-line import/namespace -- Expo's web barrel omits this verified SDK 57 native export.
  const { AudioStream } = AudioModule;
  const stream = new AudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
  });
  const listener = stream.addListener('audioStreamBuffer', onBuffer);
  let starting = false;
  let stopped = false;
  let stopApplied = false;
  let released = false;
  let cleaned = false;
  function cleanup() {
    if (starting || cleaned) return;
    if (stopped && !stopApplied) {
      stopApplied = true;
      stream.stop();
    }
    if (released) {
      cleaned = true;
      stream.release();
    }
  }
  return {
    async start() {
      starting = true;
      try {
        await stream.start();
      } finally {
        starting = false;
        cleanup();
      }
    },
    stop() {
      stopped = true;
      cleanup();
    },
    release() {
      released = true;
      listener.remove();
      cleanup();
    },
  };
}
