import { PcmWavCapture } from './pcmWav';

import type { PcmBuffer } from './pcmWav';

export type RecordedVoice = {
  bytes: Uint8Array;
  duration: number;
  sampleRate: number;
};
export type Microphone = {
  start(): Promise<void>;
  stop(): void;
  release(): void;
};
export type CaptureState = {
  phase: 'idle' | 'permission' | 'recording' | 'saving' | 'saved' | 'error';
  duration: number;
  level: number;
  message: string;
  canRetry: boolean;
};
export type CaptureDependencies = {
  permission(): Promise<boolean>;
  isActive?(): boolean;
  microphone(onBuffer: (buffer: PcmBuffer) => void): Microphone;
  save(recording: RecordedVoice): Promise<void>;
  onState(state: CaptureState): void;
};
export class VoiceCapture {
  private state: CaptureState = {
    phase: 'idle',
    duration: 0,
    level: 0,
    message: 'Ready to record',
    canRetry: false,
  };
  private generation = 0;
  private disposed = false;
  private microphone: Microphone | null = null;
  private capture: PcmWavCapture | null = null;
  private pending: RecordedVoice | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastBufferAt = 0;

  constructor(private deps: CaptureDependencies) {}

  private update(
    phase: CaptureState['phase'],
    message: string,
    level = phase === 'recording' ? this.state.level : 0,
  ) {
    this.state = {
      phase,
      message,
      level,
      duration:
        this.capture?.duration ?? this.pending?.duration ?? this.state.duration,
      canRetry: phase === 'error' && !!this.pending,
    };
    if (!this.disposed) this.deps.onState(this.state);
  }

  private release() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const microphone = this.microphone;
    this.microphone = null;
    if (microphone) {
      try {
        microphone.stop();
      } finally {
        microphone.release();
      }
    }
  }

  async start() {
    if (
      this.disposed ||
      this.pending ||
      ['permission', 'recording', 'saving'].includes(this.state.phase)
    )
      return;
    const generation = ++this.generation;
    this.state = { ...this.state, duration: 0 };
    this.update('permission', 'Allow microphone access to record.');
    try {
      const allowed = await this.deps.permission();
      if (generation !== this.generation || this.disposed) return;
      if (!allowed)
        throw new Error(
          'Microphone access is denied. Allow it in device settings, then try again.',
        );
      if (this.deps.isActive && !this.deps.isActive()) {
        this.update(
          'idle',
          'Microphone access granted. Tap Record when you return.',
        );
        return;
      }
      this.capture = new PcmWavCapture();
      const microphone = this.deps.microphone((buffer) => {
        if (
          generation !== this.generation ||
          this.state.phase !== 'recording' ||
          !this.capture
        )
          return;
        try {
          const limit = this.capture.append(buffer);
          this.lastBufferAt = Date.now();
          const samples = new Int16Array(buffer.data);
          let square = 0;
          for (const sample of samples) square += (sample / 32768) ** 2;
          const rms = samples.length ? Math.sqrt(square / samples.length) : 0;
          // Speech uses a small part of the PCM range. Amplify it for a useful
          // meter while keeping the value bounded for rendering.
          this.update(
            'recording',
            'Recording… Speak clearly.',
            Math.min(1, rms * 12),
          );
          if (limit) void this.stop('25-second limit reached.');
        } catch (error) {
          ++this.generation;
          try {
            this.release();
          } catch {
            /* release already attempted */
          }
          this.capture = null;
          this.update(
            'error',
            error instanceof Error
              ? error.message
              : 'The microphone could not record.',
          );
        }
      });
      this.microphone = microphone;
      this.update('recording', 'Starting microphone…');
      await microphone.start();
      if (generation !== this.generation || this.disposed) {
        // A pending native start may settle after navigation or logout.
        // The adapter defers release until that start has settled.
        return;
      }
      this.lastBufferAt = Date.now();
      const startedAt = Date.now();
      this.timer = setInterval(() => {
        if (Date.now() - this.lastBufferAt >= 3000)
          void this.stop(
            'Recording stopped because the microphone stopped responding.',
          );
        else if (Date.now() - startedAt >= 26000)
          void this.stop('Recording time limit reached.');
      }, 500);
    } catch (error) {
      if (generation !== this.generation) return;
      ++this.generation;
      try {
        this.release();
      } catch {
        /* report the original start failure */
      }
      this.capture = null;
      this.update(
        'error',
        error instanceof Error
          ? error.message
          : 'Could not start the microphone. Try again.',
      );
    }
  }

  async stop(message = '') {
    if (this.state.phase !== 'recording' || !this.capture) return;
    ++this.generation;
    const capture = this.capture;
    this.capture = null;
    this.update('saving', 'Saving on this device…');
    try {
      this.release();
      this.pending = capture.finish();
    } catch (error) {
      this.update(
        'error',
        error instanceof Error
          ? error.message
          : 'Could not finish the recording.',
      );
      return;
    }
    await this.persist(message);
  }

  private async persist(message = '') {
    if (!this.pending) return;
    this.update('saving', 'Saving on this device…');
    try {
      await this.deps.save(this.pending);
      this.update(
        'saved',
        `${message ? `${message} ` : ''}Saved on device. Not sent for review.`,
      );
      this.pending = null;
    } catch {
      this.update(
        'error',
        'Could not save the recording. Keep this screen open and retry after freeing device storage.',
      );
    }
  }

  async retry() {
    if (this.state.phase === 'error' && this.pending && !this.disposed)
      await this.persist();
  }

  cancel() {
    if (!['permission', 'recording'].includes(this.state.phase)) return;
    ++this.generation;
    try {
      this.release();
    } catch {
      // The capture is being abandoned; still clear it if native teardown
      // reports an error after releasing its resources.
    } finally {
      this.capture = null;
      this.pending = null;
      this.state = { ...this.state, duration: 0, level: 0 };
      this.update('idle', 'Recording cancelled. Tap Record when ready.');
    }
  }

  discardUnsaved() {
    if (this.state.phase !== 'error') return;
    this.pending = null;
    this.state = { ...this.state, duration: 0, level: 0 };
    this.update('idle', 'Recording discarded.');
  }

  interrupt() {
    if (this.state.phase === 'recording')
      void this.stop('Recording stopped when you left the screen.');
    else if (this.state.phase === 'permission') {
      ++this.generation;
      this.update('idle', 'Recording cancelled. Tap Record when ready.');
    }
  }

  dispose() {
    this.disposed = true;
    this.interrupt();
  }

  background() {
    // Android's permission dialog also backgrounds the activity. Let its result
    // settle, then check foreground state before opening the microphone.
    if (this.state.phase === 'recording') this.interrupt();
  }
}
