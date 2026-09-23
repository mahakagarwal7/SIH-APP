export type PcmBuffer = {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
};

export class PcmWavCapture {
  private chunks: Uint8Array[] = [];
  private sampleRate = 0;
  private size = 0;
  private closed = false;

  get duration() {
    return this.sampleRate ? this.size / 2 / this.sampleRate : 0;
  }

  private fail(message: string): never {
    this.closed = true;
    this.chunks = [];
    throw new Error(message);
  }

  append(buffer: PcmBuffer): boolean {
    if (this.closed) throw new Error('This recording has already stopped.');
    if (
      buffer.channels !== 1 ||
      ![16000, 22050, 24000, 44100, 48000].includes(buffer.sampleRate) ||
      buffer.data.byteLength % 2
    ) {
      return this.fail('The microphone returned an unsupported audio format.');
    }
    if (this.sampleRate && buffer.sampleRate !== this.sampleRate) {
      return this.fail('The microphone format changed. Record again.');
    }
    this.sampleRate = buffer.sampleRate;
    const maximum = this.sampleRate * 2 * 25;
    const length = Math.min(buffer.data.byteLength, maximum - this.size);
    if (length) {
      // Native ArrayBuffer ownership is external; retain our own bounded copy.
      this.chunks.push(new Uint8Array(buffer.data, 0, length).slice());
      this.size += length;
    }
    return this.size === maximum;
  }

  finish(): { bytes: Uint8Array; duration: number; sampleRate: number } {
    if (this.closed) throw new Error('This recording has already stopped.');
    if (this.duration < 0.2)
      return this.fail(
        'The recording is too short. Record at least a moment of speech.',
      );
    const bytes = new Uint8Array(44 + this.size);
    const view = new DataView(bytes.buffer);
    const tag = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        bytes[offset + i] = value.charCodeAt(i);
    };
    tag(0, 'RIFF');
    view.setUint32(4, bytes.length - 8, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    tag(36, 'data');
    view.setUint32(40, this.size, true);
    let offset = 44;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    this.closed = true;
    let square = 0;
    for (let at = 44; at < bytes.length; at += 2)
      square += (view.getInt16(at, true) / 32768) ** 2;
    if (Math.sqrt(square / (this.size / 2)) < 0.0005)
      throw new Error('The recording is too quiet. Move closer and try again.');
    return { bytes, duration: this.duration, sampleRate: this.sampleRate };
  }
}
