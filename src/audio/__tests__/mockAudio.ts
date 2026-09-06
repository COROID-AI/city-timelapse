/**
 * A minimal in-memory stub of the Web Audio API for unit/composition tests.
 *
 * The engine's real synthesis code runs against this stub: gains record their
 * scheduled automation so tests can assert crossfade timing, mute/volume
 * behaviour, and bus routing without a real audio device.
 */

export class MockAudioParam {
  value: number;
  events: Array<Record<string, unknown>> = [];

  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'linear', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'exponential', value, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ type: 'cancel', time });
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): void {
    this.value = value;
    this.events.push({ type: 'target', value, time, timeConstant });
  }
}

export class MockAudioNode {
  /** Gain audio param present on gain nodes; undefined elsewhere. */
  gain: MockAudioParam | undefined;
  connections: MockAudioNode[] = [];
  paramConnections: MockAudioParam[] = [];

  connect(dest: MockAudioNode | MockAudioParam): MockAudioNode | MockAudioParam {
    if (dest instanceof MockAudioParam) {
      this.paramConnections.push(dest);
    } else {
      this.connections.push(dest);
    }
    return dest;
  }

  disconnect(): void {
    this.connections = [];
    this.paramConnections = [];
  }
}

export class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam(440);
  detune = new MockAudioParam(0);
  onended: (() => void) | null = null;
  private _started = false;
  private _stopped = false;

  start(): void {
    this._started = true;
  }

  stop(): void {
    this._stopped = true;
    if (this.onended) this.onended();
  }

  get started(): boolean {
    return this._started;
  }

  get stopped(): boolean {
    return this._stopped;
  }
}

export class MockBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  private _started = false;
  private _stopped = false;

  start(): void {
    this._started = true;
  }

  stop(): void {
    this._stopped = true;
    if (this.onended) this.onended();
  }

  get started(): boolean {
    return this._started;
  }

  get stopped(): boolean {
    return this._stopped;
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam(350);
  Q = new MockAudioParam(1);
}

export class MockAudioBuffer {
  constructor(
    public readonly numberOfChannels: number,
    public readonly length: number,
    public readonly sampleRate: number,
  ) {}

  getChannelData(_channel: number): Float32Array {
    return new Float32Array(this.length);
  }
}

export class MockAudioContext {
  readonly sampleRate = 44100;
  readonly destination = new MockAudioNode();
  state: AudioContextState = 'running';
  currentTime = 0;
  readonly nodes: MockAudioNode[] = [];
  readonly buffers: MockAudioBuffer[] = [];
  resumed = false;
  closed = false;

  createGain(): MockAudioNode {
    const g = new MockAudioNode();
    g.gain = new MockAudioParam(0);
    this.nodes.push(g);
    return g;
  }

  createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    const b = new MockAudioBuffer(channels, length, sampleRate);
    this.buffers.push(b);
    return b;
  }

  createBiquadFilter(): MockBiquadFilterNode {
    const f = new MockBiquadFilterNode();
    this.nodes.push(f);
    return f;
  }

  createOscillator(): MockOscillatorNode {
    const o = new MockOscillatorNode();
    this.nodes.push(o);
    return o;
  }

  createBufferSource(): MockBufferSourceNode {
    const s = new MockBufferSourceNode();
    this.nodes.push(s);
    return s;
  }

  resume(): Promise<void> {
    this.resumed = true;
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}