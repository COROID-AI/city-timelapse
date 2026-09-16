/**
 * audioContextFake.ts — Lightweight, headless Web Audio fake.
 *
 * Implements the AudioContextLike duck-type declared in audioLayer.ts with
 * plain objects: every node records its parameters, scheduled parameter
 * events, connections, start/stop calls and disconnection count. Tests assert
 * against this graph directly — no real audio output and no user-gesture
 * gating. The context starts `suspended` (like a browser before a gesture) and
 * `resume()` flips it to `running` and records the call.
 *
 * Parameter semantics: direct `.value = x` assignment mutates `value`; the
 * scheduling methods (setValueAtTime, linear/exponentialRamp..., etc.) only
 * append to `events` so tests can assert the exact automation graph without a
 * clock.
 */
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from './audioLayer';

export type ParamEventMethod =
  | 'setValueAtTime'
  | 'linearRampToValueAtTime'
  | 'exponentialRampToValueAtTime'
  | 'cancelScheduledValues'
  | 'setTargetAtTime';

export interface ParamEvent {
  readonly method: ParamEventMethod;
  readonly value: number;
  readonly time: number;
  readonly timeConstant?: number;
}

export class FakeAudioParam implements AudioParamLike {
  value: number;
  readonly events: ParamEvent[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'setValueAtTime', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'linearRampToValueAtTime', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ method: 'cancelScheduledValues', value: this.value, time });
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): void {
    this.events.push({ method: 'setTargetAtTime', value, time, timeConstant });
  }
}

let nextNodeId = 1;

export class FakeAudioNode implements AudioNodeLike {
  readonly kind: string;
  readonly id: number;
  readonly params = new Map<string, FakeAudioParam>();
  readonly connections: FakeAudioNode[] = [];
  /** Number of `disconnect()` calls made against this node. */
  disconnectedCount = 0;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  constructor(kind: string) {
    this.kind = kind;
    this.id = nextNodeId;
    nextNodeId += 1;
  }

  connect(destination: AudioNodeLike): AudioNodeLike {
    this.connections.push(destination as FakeAudioNode);
    return this;
  }

  disconnect(destination?: AudioNodeLike): void {
    if (destination === undefined) {
      if (this.connections.length > 0) {
        this.disconnectedCount += this.connections.length;
        this.connections.length = 0;
      }
      return;
    }
    const index = this.connections.findIndex((node) => node === destination);
    if (index >= 0) {
      this.connections.splice(index, 1);
      this.disconnectedCount += 1;
    }
  }

  start(when = 0): void {
    this.startedAt = when;
  }

  stop(when = 0): void {
    this.stoppedAt = when;
  }

  param(name: string): FakeAudioParam {
    const param = this.params.get(name);
    if (!param) {
      throw new Error(`FakeAudioNode #${this.id} (${this.kind}) has no param "${name}"`);
    }
    return param;
  }
}

export class FakeOscillator extends FakeAudioNode implements OscillatorNodeLike {
  type: OscillatorType;
  readonly frequency: FakeAudioParam;

  constructor(type: OscillatorType = 'sine') {
    super('oscillator');
    this.type = type;
    this.frequency = new FakeAudioParam(440);
    this.params.set('frequency', this.frequency);
  }
}

export class FakeGain extends FakeAudioNode implements GainNodeLike {
  readonly gain: FakeAudioParam;

  constructor(value = 1) {
    super('gain');
    this.gain = new FakeAudioParam(value);
    this.params.set('gain', this.gain);
  }
}

export class FakeBiquadFilter extends FakeAudioNode implements BiquadFilterNodeLike {
  type: BiquadFilterType;
  readonly frequency: FakeAudioParam;
  readonly Q: FakeAudioParam;

  constructor(type: BiquadFilterType = 'lowpass') {
    super('filter');
    this.type = type;
    this.frequency = new FakeAudioParam(350);
    this.Q = new FakeAudioParam(1);
    this.params.set('frequency', this.frequency);
    this.params.set('Q', this.Q);
  }
}

export class FakeBufferSource extends FakeAudioNode implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;

  constructor() {
    super('buffer-source');
  }
}

export class FakeAudioBuffer implements AudioBufferLike {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private readonly channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new Error(
        `FakeAudioBuffer: channel ${channel} out of range (0..${this.numberOfChannels - 1})`,
      );
    }
    return this.channels[channel];
  }
}

export class FakeAudioContext implements AudioContextLike {
  readonly kind = 'fake';
  /** Browser-like: suspended until a user gesture calls resume(). */
  state: AudioContextState = 'suspended';
  /** Mutable clock. Tests advance it to exercise SFX pruning/automation. */
  currentTime = 0;
  sampleRate = 44100;
  readonly destination: FakeAudioNode;
  /** Append-only log of every node ever created (retired nodes remain). */
  readonly nodes: FakeAudioNode[] = [];
  resumeCalls = 0;
  closeCalls = 0;

  constructor() {
    this.destination = new FakeAudioNode('destination');
  }

  createOscillator(type: OscillatorType = 'sine'): FakeOscillator {
    return this.record(new FakeOscillator(type));
  }

  createGain(value = 1): FakeGain {
    return this.record(new FakeGain(value));
  }

  createBiquadFilter(type: BiquadFilterType = 'lowpass'): FakeBiquadFilter {
    return this.record(new FakeBiquadFilter(type));
  }

  createBufferSource(): FakeBufferSource {
    return this.record(new FakeBufferSource());
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
    return Promise.resolve();
  }

  private record<T extends FakeAudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}

/** Convenience factory: `const ctx = createFakeAudioContext();`. */
export function createFakeAudioContext(): FakeAudioContext {
  return new FakeAudioContext();
}

/** All nodes of a given kind (oscillator / gain / filter / buffer-source...). */
export function nodesByKind(context: FakeAudioContext, kind: string): FakeAudioNode[] {
  return context.nodes.filter((node) => node.kind === kind);
}

/** Typed param accessor for assertions; throws when the node lacks the param. */
export function paramOf(node: FakeAudioNode, name: string): FakeAudioParam {
  return node.param(name);
}