import type { EraId } from '../eras/types';
import { ERA_IDS, isEraId } from '../eras/types';

/**
 * Per-era audio channel contract.
 *
 * The bus is intentionally backend-agnostic: it owns the numeric fade state
 * (base levels x era blend weights x master volume) and forwards delivered
 * levels to an injectable {@link AudioBusBackend}. The default null backend
 * keeps the system safe in headless/test environments and before a user
 * gesture unlocks Web Audio; a real WebAudio backend maps
 * {@link AudioBusBackend.setLevel} onto `GainNode.gain.setTargetAtTime`.
 */

/** The two channels every era may register. */
export type EraChannelKind = 'ambience' | 'sfx';

export const ERA_CHANNEL_KINDS: readonly EraChannelKind[] = ['ambience', 'sfx'];

/** Descriptors a builder attaches to its content; consumed by the bus. */
export interface EraAudioDescriptor {
  /** Base level (0..1) of the era's looping ambience bed. Default 1. */
  readonly ambience?: number;
  /** Base level (0..1) of the era's one-shot SFX layer. Default 1. */
  readonly sfx?: number;
  /** Free-form payload handed through to a richer audio backend. */
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * Sink for delivered channel levels. Implementations translate numeric levels
 * into their audio graph (or nothing at all, like the bundled null backend).
 */
export interface AudioBusBackend {
  createChannel(eraId: EraId, kind: EraChannelKind): void;
  setLevel(eraId: EraId, kind: EraChannelKind, level: number): void;
  setMasterVolume(volume: number): void;
  removeChannel(eraId: EraId, kind: EraChannelKind): void;
  dispose(): void;
}

/** Backend that stores nothing — safe default for stub/headless use. */
export class NullAudioBusBackend implements AudioBusBackend {
  createChannel(): void {}
  setLevel(): void {}
  setMasterVolume(): void {}
  removeChannel(): void {}
  dispose(): void {}
}

interface ChannelState {
  /** Descriptor level (0..1). */
  base: number;
  /** Current era blend weight (0..1), driven by TransitionSystem. */
  weight: number;
  /** Currently effective level. */
  current: number;
  /** Ramp origin. */
  origin: number;
  /** Ramp endpoint. */
  target: number;
  /** Seconds remaining in the active ramp. */
  remaining: number;
  /** Total ramp length in seconds. */
  duration: number;
  /** Whether any level has been forwarded to the backend yet. */
  delivered: boolean;
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const LEVEL_EPSILON = 1e-5;

/**
 * Registry of per-era ambience/SFX channels plus the fade engine that keeps
 * them click-free while TransitionSystem drives blend weights every frame.
 * Every level change travels through a bounded ramp, so retargeting a
 * transition mid-flight never produces clicks or level jumps.
 */
export class AudioBus {
  readonly #backend: AudioBusBackend;
  readonly #channels = new Map<string, ChannelState>();
  readonly #descriptors = new Map<EraId, EraAudioDescriptor>();
  readonly #rampSeconds: number;

  #masterVolume = 1;

  constructor(options: { backend?: AudioBusBackend; rampSeconds?: number } = {}) {
    this.#backend = options.backend ?? new NullAudioBusBackend();
    const ramp = options.rampSeconds ?? 0.08;
    this.#rampSeconds = Number.isFinite(ramp) ? Math.max(ramp, 0) : 0;
  }

  get masterVolume(): number {
    return this.#masterVolume;
  }

  get registeredEras(): readonly EraId[] {
    return ERA_IDS.filter((id) => this.hasEra(id));
  }

  /** Descriptor a richer backend can inspect (event kinds, drone Hz, ...). */
  getDescriptor(eraId: EraId): EraAudioDescriptor | undefined {
    return this.#descriptors.get(eraId);
  }

  /**
   * Register (or re-register) both channels for one era. Re-registration
   * updates base levels/descriptors without dropping the channel state, so
   * runtime content swaps keep fading smoothly.
   */
  registerEra(eraId: EraId, descriptor: EraAudioDescriptor = {}): void {
    if (!isEraId(eraId)) {
      throw new TypeError(`AudioBus: unknown era "${String(eraId)}"`);
    }
    this.#descriptors.set(eraId, descriptor);
    for (const kind of ERA_CHANNEL_KINDS) {
      const key = this.#key(eraId, kind);
      const base = clamp01(kind === 'ambience' ? descriptor.ambience ?? 1 : descriptor.sfx ?? 1);
      const existing = this.#channels.get(key);
      if (existing) {
        existing.base = base;
        // Move smoothly toward the new descriptor level right away; the next
        // weight update will re-schedule from wherever this ramp has reached.
        this.#schedule(existing, this.#desired(existing), this.#rampSeconds);
        continue;
      }
      this.#channels.set(key, {
        base,
        weight: 0,
        current: 0,
        origin: 0,
        target: 0,
        remaining: 0,
        duration: 0,
        delivered: false,
      });
      this.#backend.createChannel(eraId, kind);
    }
  }

  hasEra(eraId: EraId): boolean {
    return this.#channels.has(this.#key(eraId, 'ambience'));
  }

  /** Drop both channels for one era. */
  unregisterEra(eraId: EraId): void {
    if (!this.hasEra(eraId)) {
      return;
    }
    for (const kind of ERA_CHANNEL_KINDS) {
      this.#channels.delete(this.#key(eraId, kind));
      this.#backend.removeChannel(eraId, kind);
    }
    this.#descriptors.delete(eraId);
  }

  /**
   * Drive per-era blend weights. TransitionSystem calls this every tick with
   * the weights it derived from TimelineController's normalized t-value, so
   * ambience levels stay in lockstep with the visual crossfade.
   */
  applyEraWeights(weights: ReadonlyMap<EraId, number> | Readonly<Record<string, number>>): void {
    const lookup =
      weights instanceof Map
        ? (eraId: EraId): number | undefined =>
            (weights as ReadonlyMap<EraId, number>).get(eraId)
        : (eraId: EraId): number | undefined =>
            (weights as Readonly<Record<string, number>>)[eraId];
    for (const [key, channel] of this.#channels) {
      const [eraId] = this.#splitKey(key);
      const raw = lookup(eraId);
      channel.weight = clamp01(typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
      this.#schedule(channel, this.#desired(channel), this.#rampSeconds);
    }
  }

  /**
   * Manually fade one channel to an absolute level over `seconds` (mute
   * ducks, one-shot stingers, ...). The next weight/master change ramps
   * onward smoothly from wherever this fade left the channel.
   */
  fadeChannel(eraId: EraId, kind: EraChannelKind, targetLevel: number, seconds = 0.15): void {
    const channel = this.#requireChannel(eraId, kind);
    const duration = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
    this.#schedule(channel, clamp01(targetLevel), duration);
  }

  setMasterVolume(volume: number): void {
    const next = clamp01(Number.isFinite(volume) ? volume : 0);
    if (next === this.#masterVolume) {
      return;
    }
    this.#masterVolume = next;
    this.#backend.setMasterVolume(next);
    for (const channel of this.#channels.values()) {
      this.#schedule(channel, this.#desired(channel), this.#rampSeconds);
    }
  }

  /** Advance all active ramps. Call once per frame alongside the timeline. */
  update(deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds) ? Math.max(deltaSeconds, 0) : 0;
    for (const [key, channel] of this.#channels) {
      if (channel.remaining > 0) {
        channel.remaining = Math.max(0, channel.remaining - dt);
        const progress = channel.duration > 0 ? 1 - channel.remaining / channel.duration : 1;
        channel.current = channel.origin + (channel.target - channel.origin) * progress;
        if (channel.remaining === 0) {
          channel.current = channel.target;
          channel.duration = 0;
        }
      } else if (channel.current !== channel.target) {
        channel.current = channel.target;
      }
      this.#deliver(key, channel);
    }
  }

  /** Currently effective level for one channel. */
  getLevel(eraId: EraId, kind: EraChannelKind): number {
    return this.#requireChannel(eraId, kind).current;
  }

  /** Debug/QA snapshot of effective levels per era. */
  snapshotLevels(): Record<EraId, { ambience: number; sfx: number }> {
    const out = {} as Record<EraId, { ambience: number; sfx: number }>;
    for (const id of this.registeredEras) {
      out[id] = {
        ambience: this.getLevel(id, 'ambience'),
        sfx: this.getLevel(id, 'sfx'),
      };
    }
    return out;
  }

  dispose(): void {
    this.#channels.clear();
    this.#descriptors.clear();
    this.#backend.dispose();
  }

  #key(eraId: EraId, kind: EraChannelKind): string {
    return `${eraId}:${kind}`;
  }

  #splitKey(key: string): [EraId, EraChannelKind] {
    const index = key.indexOf(':');
    return [key.slice(0, index) as EraId, key.slice(index + 1) as EraChannelKind];
  }

  #requireChannel(eraId: EraId, kind: EraChannelKind): ChannelState {
    const channel = this.#channels.get(this.#key(eraId, kind));
    if (!channel) {
      throw new Error(`AudioBus: no "${kind}" channel registered for era "${eraId}"`);
    }
    return channel;
  }

  #desired(channel: ChannelState): number {
    return clamp01(channel.base * channel.weight * this.#masterVolume);
  }

  #schedule(channel: ChannelState, target: number, duration: number): void {
    if (duration <= 0 || Math.abs(target - channel.current) < LEVEL_EPSILON) {
      channel.origin = target;
      channel.target = target;
      channel.current = target;
      channel.remaining = 0;
      channel.duration = 0;
      return;
    }
    channel.origin = channel.current;
    channel.target = target;
    channel.remaining = duration;
    channel.duration = duration;
  }

  #deliver(key: string, channel: ChannelState): void {
    // Silent channels that never produced sound stay off the backend until
    // their first meaningful level arrives.
    if (!channel.delivered && channel.current === 0 && channel.target === 0) {
      return;
    }
    channel.delivered = true;
    const [eraId, kind] = this.#splitKey(key);
    this.#backend.setLevel(eraId, kind, channel.current);
  }
}
