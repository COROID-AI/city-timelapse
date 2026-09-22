/**
 * Low-level Web Audio synthesis primitives for the era-aware sound director.
 *
 * Everything here is engine-agnostic: the director talks to a minimal
 * structural subset of the Web Audio API ({@link AudioContextLike}) so the
 * exact same production code runs against a real browser `AudioContext` and
 * against the deterministic fake used by the unit tests. No samples, files, or
 * decoders — every sound in the app is synthesized from oscillators and
 * procedurally generated noise buffers.
 *
 * Performance contract:
 * - the shared graph stays well under {@link NODE_BUDGET} live nodes;
 * - one-shot voices are served from a fixed-size {@link VoicePool}; shots that
 *   would exceed the pool are dropped (and counted) instead of allocating, so
 *   a burst of content hooks can never blow the CPU budget;
 * - parameter changes are short ramps scheduled on the audio clock, so the
 *   per-frame JS work never touches a node beyond a handful of `AudioParam`
 *   writes and allocates nothing.
 */

/** Structural `AudioParam` subset used by the director. */
export interface AudioParamLike {
  readonly value: number;
  setValueAtTime(value: number, startTime: number): AudioParamLike;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
  exponentialRampToValueAtTime(value: number, endTime: number): AudioParamLike;
  cancelScheduledValues(startTime: number): AudioParamLike;
}

/** Structural `AudioNode` subset: connect to a node or to an `AudioParam`. */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
  connect(destination: AudioParamLike): void;
  disconnect(): void;
}

/** A started/stoppable source (oscillator or buffer source). */
export interface AudioScheduledSourceLike extends AudioNodeLike {
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Gain node with a single automatable gain parameter. */
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

/** Oscillator node with waveform, frequency, and detune controls. */
export interface OscillatorNodeLike extends AudioScheduledSourceLike {
  readonly detune: AudioParamLike;
  readonly frequency: AudioParamLike;
  type: OscillatorType;
}

/** Biquad filter node (lowpass/bandpass/… color shaping). */
export interface BiquadFilterNodeLike extends AudioNodeLike {
  readonly Q: AudioParamLike;
  readonly frequency: AudioParamLike;
  readonly gain: AudioParamLike;
  type: BiquadFilterType;
}

/** In-memory audio buffer (the director only ever creates mono noise). */
export interface AudioBufferLike {
  readonly duration: number;
  readonly length: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/** Buffer source node used for looping beds and noise bursts. */
export interface AudioBufferSourceNodeLike extends AudioScheduledSourceLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  loopEnd: number;
  loopStart: number;
  readonly playbackRate: AudioParamLike;
}

/** Output limiter (last node before the destination) that guards clipping. */
export interface DynamicsCompressorNodeLike extends AudioNodeLike {
  readonly attack: AudioParamLike;
  readonly knee: AudioParamLike;
  readonly ratio: AudioParamLike;
  readonly release: AudioParamLike;
  readonly threshold: AudioParamLike;
}

/** Minimal context state union matching the Web Audio API. */
export type AudioContextStateLike = 'closed' | 'running' | 'suspended';

/** Minimal `AudioContext` subset the sound director depends on. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly sampleRate: number;
  readonly state: AudioContextStateLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createDynamicsCompressor(): DynamicsCompressorNodeLike;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  resume(): Promise<void>;
}

/**
 * Soft ceiling for simultaneously live nodes in the audio graph (looping
 * beds + era textures + pool chains + transient one-shot sources). The
 * director's full build sits comfortably below this; tests assert the bound.
 */
export const NODE_BUDGET = 128;

/** Short ramp used for era-mix crossfades (seconds). */
export const CROSSFADE_RAMP_SECONDS = 0.2;

/** Smallest usable scheduled ramp; guards against zero-length ramps. */
export const MIN_RAMP_SECONDS = 0.005;

/** Floor for exponential envelope ramps (they can never reach exactly 0). */
export const SILENCE = 0.0001;

/** Convert decibels to a linear gain factor. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Inverse-distance attenuation in 0..1: 1 at or inside `referenceDistance`,
 * then falling off smoothly and clamped above `maxDistance`. Pure and
 * allocation-free so it can run for every scheduled one-shot.
 */
export function distanceGain(
  distance: number,
  referenceDistance: number,
  maxDistance: number,
  rolloff: number,
): number {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : maxDistance;
  const ref = Math.max(0.0001, referenceDistance);
  if (d <= ref) return 1;
  const far = d > maxDistance ? maxDistance : d;
  const gain = ref / (ref + rolloff * (far - ref));
  if (gain < 0) return 0;
  return gain > 1 ? 1 : gain;
}

/** Set a parameter to an exact value at `time`, cancelling pending ramps. */
export function setParamImmediate(param: AudioParamLike, value: number, time: number): void {
  const v = Number.isFinite(value) ? value : 0;
  param.cancelScheduledValues(time);
  param.setValueAtTime(v, time);
}

/** Schedule a short linear ramp to `value` starting from the current value. */
export function rampParam(
  param: AudioParamLike,
  value: number,
  time: number,
  seconds: number = CROSSFADE_RAMP_SECONDS,
): void {
  const target = Number.isFinite(value) ? value : 0;
  const duration = Math.max(MIN_RAMP_SECONDS, seconds);
  // Read the computed value *before* cancelling: cancelling first would drop
  // the very event that determines this ramp's starting point, which breaks
  // the complementary era-bus ramps (their gains must always sum to 1).
  const current = param.value;
  param.cancelScheduledValues(time);
  param.setValueAtTime(current, time);
  param.linearRampToValueAtTime(target, time + duration);
}

/**
 * Percussive envelope: near-instant linear attack to `peak`, then an
 * exponential decay back to the silence floor at `time + durationSeconds`.
 */
export function decayEnvelope(
  param: AudioParamLike,
  time: number,
  peak: number,
  durationSeconds: number,
  attackSeconds = 0.008,
): void {
  const ceiling = Math.max(peak, SILENCE);
  const duration = Math.max(0.02, durationSeconds);
  const attack = Math.min(Math.max(0, attackSeconds), duration * 0.9);
  param.cancelScheduledValues(time);
  param.setValueAtTime(SILENCE, time);
  param.linearRampToValueAtTime(ceiling, time + attack);
  param.exponentialRampToValueAtTime(SILENCE, time + duration);
}

/** Deterministic 32-bit PRNG (mulberry32) so generated noise is reproducible. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a mono noise buffer in memory — the only "sample source" the app
 * uses. `white` is flat hiss (footsteps, bursts); `brown` is integrated noise
 * (traffic rumble, engine drones). Both loop cleanly as bed sources.
 */
export function createNoiseBuffer(
  context: AudioContextLike,
  kind: 'brown' | 'white',
  seconds = 1.5,
  seed = 0x9e3779b9,
): AudioBufferLike {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const random = mulberry32(seed);
  if (kind === 'white') {
    for (let i = 0; i < length; i += 1) data[i] = random() * 2 - 1;
    return buffer;
  }
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, last * 3.5));
  }
  return buffer;
}

/** Parameters for a single synthesized oscillator voice. */
export interface ToneVoiceSpec {
  readonly attackSeconds?: number;
  readonly durationSeconds: number;
  readonly filterHz?: number;
  readonly filterQ?: number;
  readonly filterType?: BiquadFilterType;
  readonly frequencyHz: number;
  readonly gain: number;
  readonly glideFilterHz?: number;
  readonly glideToHz?: number;
  readonly waveform: OscillatorType;
  /** Start offset from "now" on the audio clock (for little arpeggios). */
  readonly whenSeconds?: number;
}

/** Parameters for a single synthesized noise burst voice. */
export interface NoiseVoiceSpec {
  readonly attackSeconds?: number;
  readonly buffer: AudioBufferLike;
  readonly durationSeconds: number;
  readonly filterHz: number;
  readonly filterQ?: number;
  readonly filterType?: BiquadFilterType;
  readonly gain: number;
  readonly glideFilterHz?: number;
  readonly playbackRate?: number;
  readonly whenSeconds?: number;
}

interface VoiceSlot {
  readonly filter: BiquadFilterNodeLike;
  readonly input: GainNodeLike;
  busy: boolean;
}

/**
 * Fixed pool of pre-wired voice chains (gain -> filter -> destination).
 *
 * One-shots never allocate a chain: they acquire a free slot, hang a short-
 * lived oscillator or buffer source off it, envelope the slot gain, and free
 * the slot in the source's `onended`. When every slot is busy the shot is
 * dropped and counted — this is what keeps the node budget and CPU bounded
 * during event bursts (a wall of horns cannot allocate past the pool).
 */
export class VoicePool {
  readonly #context: AudioContextLike;
  readonly #slots: VoiceSlot[] = [];
  #dropped = 0;
  #live = 0;
  #disposed = false;

  constructor(context: AudioContextLike, destination: AudioNodeLike, size = 8) {
    this.#context = context;
    const count = Math.max(1, Math.floor(size));
    for (let i = 0; i < count; i += 1) {
      const input = context.createGain();
      input.gain.setValueAtTime(SILENCE, context.currentTime);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(12000, context.currentTime);
      filter.Q.setValueAtTime(1, context.currentTime);
      input.connect(filter);
      filter.connect(destination);
      this.#slots.push({ input, filter, busy: false });
    }
  }

  /** Number of pre-wired chains (fixed at construction). */
  get size(): number {
    return this.#slots.length;
  }

  /** Nodes held by the pool's pre-wired chains (for budget accounting). */
  get nodeCount(): number {
    return this.#slots.length * 2;
  }

  /** Currently busy voices (always <= `size`). */
  get activeCount(): number {
    return this.#live;
  }

  /** Shots refused because every slot was busy. */
  get droppedCount(): number {
    return this.#dropped;
  }

  /** Play a synthesized oscillator voice; false when the pool is saturated. */
  playTone(spec: ToneVoiceSpec): boolean {
    const slot = this.#acquire();
    if (!slot) {
      this.#dropped += 1;
      return false;
    }
    const now = this.#context.currentTime + Math.max(0, spec.whenSeconds ?? 0);
    const duration = Math.max(0.02, spec.durationSeconds);
    const oscillator = this.#context.createOscillator();
    oscillator.type = spec.waveform;
    oscillator.frequency.setValueAtTime(Math.max(1, spec.frequencyHz), now);
    if (spec.glideToHz !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, spec.glideToHz), now + duration);
    }
    slot.filter.type = spec.filterType ?? 'lowpass';
    slot.filter.frequency.cancelScheduledValues(now);
    slot.filter.frequency.setValueAtTime(spec.filterHz ?? 12000, now);
    if (spec.glideFilterHz !== undefined) {
      slot.filter.frequency.exponentialRampToValueAtTime(
        Math.max(1, spec.glideFilterHz),
        now + duration,
      );
    }
    slot.filter.Q.setValueAtTime(spec.filterQ ?? 1, now);
    decayEnvelope(slot.input.gain, now, spec.gain, duration, spec.attackSeconds ?? 0.008);
    this.#finish(oscillator, slot, now + duration);
    oscillator.connect(slot.input);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    return true;
  }

  /** Play a synthesized noise burst voice; false when the pool is saturated. */
  playNoise(spec: NoiseVoiceSpec): boolean {
    const slot = this.#acquire();
    if (!slot) {
      this.#dropped += 1;
      return false;
    }
    const now = this.#context.currentTime + Math.max(0, spec.whenSeconds ?? 0);
    const duration = Math.max(0.02, spec.durationSeconds);
    const source = this.#context.createBufferSource();
    source.buffer = spec.buffer;
    source.loop = false;
    source.playbackRate.setValueAtTime(spec.playbackRate ?? 1, now);
    slot.filter.type = spec.filterType ?? 'bandpass';
    slot.filter.frequency.cancelScheduledValues(now);
    slot.filter.frequency.setValueAtTime(Math.max(1, spec.filterHz), now);
    if (spec.glideFilterHz !== undefined) {
      slot.filter.frequency.exponentialRampToValueAtTime(
        Math.max(1, spec.glideFilterHz),
        now + duration,
      );
    }
    slot.filter.Q.setValueAtTime(spec.filterQ ?? 1, now);
    decayEnvelope(slot.input.gain, now, spec.gain, duration, spec.attackSeconds ?? 0.01);
    this.#finish(source, slot, now + duration);
    source.connect(slot.input);
    source.start(now);
    source.stop(now + duration + 0.02);
    return true;
  }

  /** Disconnect every chain; subsequent plays are refused. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const slot of this.#slots) {
      slot.input.disconnect();
      slot.filter.disconnect();
      slot.busy = false;
    }
    this.#live = 0;
  }

  #acquire(): VoiceSlot | null {
    if (this.#disposed) return null;
    for (const slot of this.#slots) {
      if (!slot.busy) {
        slot.busy = true;
        this.#live += 1;
        return slot;
      }
    }
    return null;
  }

  #finish(source: AudioScheduledSourceLike, slot: VoiceSlot, endTime: number): void {
    source.onended = () => {
      source.disconnect();
      if (slot.busy) {
        slot.busy = false;
        this.#live = Math.max(0, this.#live - 1);
      }
    };
    source.stop(endTime);
  }
}
