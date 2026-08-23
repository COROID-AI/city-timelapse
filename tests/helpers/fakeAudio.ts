/**
 * Minimal in-memory Web Audio graph for headless unit tests (node env).
 *
 * Implements just enough surface for `src/audio/sfx.ts` and
 * `src/audio/mixer.ts`: `createBuffer`, `createGain`, `createBufferSource`,
 * `resume`, `close`, plus recorded automation so tests can assert on exact
 * GainNode ramp scheduling.
 */

export interface AutomationEvent {
  op: 'setValue' | 'exponentialRamp' | 'linearRamp';
  time: number;
  value: number;
}

export class FakeAudioParam {
  readonly automation: AutomationEvent[] = [];
  readonly cancels: number[] = [];

  #value: number;

  constructor(initial: number) {
    this.#value = initial;
  }

  get value(): number {
    return this.#value;
  }

  set value(v: number) {
    this.#value = v;
  }

  setValueAtTime(value: number, time: number): this {
    this.#value = value;
    this.automation.push({ op: 'setValue', time, value });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.#value = value;
    this.automation.push({ op: 'linearRamp', time, value });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.#value = value;
    this.automation.push({ op: 'exponentialRamp', time, value });
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.cancels.push(time);
    return this;
  }

  /** Scheduled (non-setValue) ramps strictly after the given time. */
  rampsAfter(time: number): AutomationEvent[] {
    return this.automation.filter((e) => e.op !== 'setValue' && e.time > time);
  }

  /** All recorded setValue events. */
  setValues(): AutomationEvent[] {
    return this.automation.filter((e) => e.op === 'setValue');
  }
}

export class FakeAudioBuffer {
  readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  getChannelData(channel: number): Float32Array {
    if (!Number.isInteger(channel) || channel < 0 || channel >= this.channels.length) {
      throw new RangeError(`FakeAudioBuffer: invalid channel ${channel}`);
    }
    return this.channels[channel];
  }

  /** Sum of absolute samples — a cheap deterministic fingerprint. */
  checksum(): number {
    let sum = 0;
    for (const data of this.channels) {
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
    }
    return sum;
  }

  peak(): number {
    let peak = 0;
    for (const data of this.channels) {
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
    return peak;
  }
}

export interface StartCall {
  when: number | undefined;
  offset: number | undefined;
}

export class FakeAudioBufferSourceNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeAudioParam(1);
  readonly connections: unknown[] = [];
  readonly startCalls: StartCall[] = [];
  readonly stopCalls: number[] = [];
  onended: (() => void) | null = null;

  readonly #listeners = new Map<string, Array<() => void>>();

  constructor(readonly context: FakeAudioContext) {}

  /** EventTarget surface used by the mixer for `ended` bookkeeping. */
  addEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  }

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.connections.length = 0;
  }

  start(when?: number, offset?: number): void {
    if (this.startCalls.length > 0) {
      throw new Error('FakeAudioBufferSourceNode.start called twice');
    }
    this.startCalls.push({ when, offset });
  }

  stop(when?: number): void {
    if (this.startCalls.length === 0) {
      throw new Error('FakeAudioBufferSourceNode.stop called before start');
    }
    this.stopCalls.push(when ?? this.context.currentTime);
  }

  /** Simulate playback finishing (fires `ended` listeners). */
  end(): void {
    for (const listener of [...(this.#listeners.get('ended') ?? [])]) {
      listener();
    }
    this.onended?.();
  }
}

export class FakeGainNode {
  readonly gain = new FakeAudioParam(1);
  readonly connections: unknown[] = [];

  constructor(readonly context: FakeAudioContext) {}

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate: number;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  resumeCount = 0;
  closeCount = 0;
  resumeRejects = false;
  readonly destination = new FakeGainNode(this);
  readonly createdGains: FakeGainNode[] = [];
  readonly createdSources: FakeAudioBufferSourceNode[] = [];

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  async resume(): Promise<void> {
    if (this.resumeRejects) throw new Error('FakeAudioContext: resume rejected');
    this.resumeCount += 1;
    if (this.state !== 'closed') this.state = 'running';
  }

  async suspend(): Promise<void> {
    if (this.state !== 'closed') this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.closeCount += 1;
    this.state = 'closed';
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode(this);
    this.createdGains.push(gain);
    return gain;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    if (numberOfChannels <= 0 || length <= 0 || sampleRate <= 0) {
      throw new RangeError('FakeAudioContext.createBuffer: invalid arguments');
    }
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource(): FakeAudioBufferSourceNode {
    const source = new FakeAudioBufferSourceNode(this);
    this.createdSources.push(source);
    return source;
  }

  advance(seconds: number): void {
    this.currentTime += seconds;
  }

  /** The master gain node, i.e. the gain connected to the destination. */
  masterGain(): FakeGainNode {
    const found = this.createdGains.find((gain) =>
      gain.connections.includes(this.destination),
    );
    if (!found) throw new Error('FakeAudioContext: no master gain connected to destination');
    return found;
  }

  /** Gains routed into the given node (layer slot gains for the master). */
  gainsConnectedTo(node: unknown): FakeGainNode[] {
    return this.createdGains.filter((gain) => gain.connections.includes(node));
  }
}

/** Cast a fake context for APIs typed against the DOM AudioContext. */
export function asAudioContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext;
}

/** Cast a fake buffer for APIs typed against the DOM AudioBuffer. */
export function asAudioBuffer(fake: FakeAudioBuffer): AudioBuffer {
  return fake as unknown as AudioBuffer;
}
