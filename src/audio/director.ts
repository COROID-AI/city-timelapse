/**
 * Era-aware audio director: the single owner of the app's Web Audio graph.
 *
 * Responsibilities:
 * - **First-gesture unlock** — no `AudioContext` and no nodes exist until the
 *   user interacts. {@link AudioDirector.armFirstGesture} wires one-shot
 *   gesture listeners and {@link AudioDirector.enable} (documented to run
 *   inside that gesture) resumes the context and builds the graph.
 * - **Master mute** — {@link AudioDirector.setMuted} zeroes the master gain
 *   with an immediate, unramped set, silencing every branch on the same tick;
 *   muting before unlock is honored when the graph comes up.
 * - **Era mixing** — subscribes to era changes *only* through the era
 *   timeline core, follows its continuous blend on every
 *   {@link AudioDirector.update} tick (crossfading era buses, re-balancing the
 *   traffic/footsteps/chatter beds and their filter colors), and plays a
 *   whoosh + era chime whenever the selected year changes.
 * - **Content hooks** — answers the documented hook events in
 *   `src/audio/hooks.ts` (horns, neon hum, doors, ringtones…) with pooled,
 *   distance-ducked one-shots.
 * - **Spatial ducking** — {@link AudioDirector.setListenerPosition} follows
 *   the camera on the ground plane: beds and era textures duck globally with
 *   distance from the street, and each one-shot is attenuated by the distance
 *   between the listener and its emitter.
 * - **Budgeting** — one fixed {@link VoicePool} serves every one-shot (extra
 *   shots are dropped, not allocated), and the whole graph stays under
 *   `NODE_BUDGET` live nodes. `update` touches only `AudioParam`s and does no
 *   per-frame allocation beyond the timeline core's own blend object.
 *
 * Integration contract for the render owner: call `update(deltaSeconds)` each
 * frame, and `setListenerPosition(cameraX, cameraZ)` when the camera moves.
 */

import { blendForPosition } from '../era/timeline';
import type { EraTimelineCore, EraTimelineSnapshot, EraYear } from '../era/timeline';
import { AUDIO_HOOK_EVENTS, HOOK_ONE_SHOTS, createAudioHookBus } from './hooks';
import type { AudioHookBus, AudioHookEvent, AudioHookEventName } from './hooks';
import { ERA_CHIME_FREQUENCY, ERAS, playOneShot } from './soundscapes';
import type { OneShotOptions, OneShotVoice, PatternLayerSpec, TextureLayerSpec } from './soundscapes';
import {
  CROSSFADE_RAMP_SECONDS,
  VoicePool,
  createNoiseBuffer,
  distanceGain,
  rampParam,
  setParamImmediate,
} from './synthesis';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  AudioScheduledSourceLike,
  BiquadFilterNodeLike,
  GainNodeLike,
} from './synthesis';

/** Master gain applied above every bus (limiter still guards peaks). */
export const AUDIO_MASTER_LEVEL = 0.85;

/** Internal trim that keeps the summed beds comfortably below clipping. */
const BED_BUS_TRIM = 0.35;

/** Ramp used when re-balancing the persistent beds (seconds). */
const BED_RAMP_SECONDS = 0.25;

/** Ramp used when the listener walks away from the street (seconds). */
const SPATIAL_RAMP_SECONDS = 0.12;

/** Reference distance inside which the street bed plays at full level. */
const SPATIAL_REFERENCE_DISTANCE = 24;

/** Distance beyond which the spatial duck holds its floor. */
const SPATIAL_MAX_DISTANCE = 240;

/** Rolloff slope of the spatial duck. */
const SPATIAL_ROLLOFF = 0.7;

/** Street beds never duck below this level (the block stays audible). */
const MIN_SPATIAL_GAIN = 0.3;

/** Per-shot reference distance for content hook events. */
const HOOK_REFERENCE_DISTANCE = 6;

/** Per-shot maximum distance for content hook events. */
const HOOK_MAX_DISTANCE = 120;

/** Per-shot reference distance for scheduled era patterns. */
const PATTERN_REFERENCE_DISTANCE = 10;

/** Per-shot maximum distance for scheduled era patterns. */
const PATTERN_MAX_DISTANCE = 140;

/** Era patterns only spawn while their era carries at least this weight. */
const PATTERN_MIN_WEIGHT = 0.15;

/** Ignore spatial updates smaller than this (camera micro-movement). */
const SPATIAL_EPSILON = 0.005;

/** Fixed number of pooled one-shot voice chains. */
export const DEFAULT_VOICE_POOL_SIZE = 8;

/** Gesture events that may unlock audio (any one of them suffices). */
const GESTURE_EVENTS = ['pointerdown', 'mousedown', 'touchend', 'keydown'] as const;

/** Timeline stop -> index in the weight array (matches `ERA_YEARS` order). */
const ERA_INDEX: Readonly<Record<EraYear, number>> = {
  1945: 0,
  1965: 1,
  1985: 2,
  2005: 3,
  2025: 4,
};

/** Diagnostic view of the live mix levels (intrinsic `AudioParam` values). */
export interface AudioMixSnapshot {
  readonly master: number;
  readonly spatial: number;
  readonly traffic: number;
  readonly footsteps: number;
  readonly chatter: number;
  /** Current per-era crossfade weights in `ERA_YEARS` order. */
  readonly eraWeights: number[];
  /** Ramped per-era mix bus gains in `ERA_YEARS` order (0 before unlock). */
  readonly eraBusGains: number[];
}

/** Telemetry/health counters for QA and the debug overlay. */
export interface AudioDirectorStats {
  readonly unlocked: boolean;
  readonly muted: boolean;
  readonly activeVoices: number;
  readonly droppedVoices: number;
  /** Gain requested for the most recent one-shot (0 before the first shot). */
  readonly lastShotGain: number;
  readonly cueCount: number;
  readonly hookCount: number;
  readonly layersBuilt: number;
  readonly nodeCount: number;
}

/** Construction options for {@link AudioDirector}. */
export interface AudioDirectorOptions {
  /** Era timeline core; the director subscribes to it for year changes. */
  readonly core: EraTimelineCore;
  /** Hook bus content modules emit on (a fresh one is created if omitted). */
  readonly hooks?: AudioHookBus;
  /**
   * Pre-created context (tests / dependency injection). Still gated: nothing
   * is built until `enable()` runs.
   */
  readonly context?: AudioContextLike;
  /** Deterministic RNG for pattern scheduling (defaults to `Math.random`). */
  readonly random?: () => number;
  /** Pooled voice chains (defaults to {@link DEFAULT_VOICE_POOL_SIZE}). */
  readonly voicePoolSize?: number;
  /** Gesture target for `armFirstGesture` (defaults to `document`). */
  readonly gestureTarget?: EventTarget | null;
}

/** Mutable runtime state of one scheduled era pattern layer. */
interface PatternRuntime {
  readonly era: EraYear;
  readonly eraIndex: number;
  readonly spec: PatternLayerSpec;
  countdownSeconds: number;
}

/** LFO placement for a persistent bed layer. */
type BedLfo =
  | { readonly target: 'filter-frequency'; readonly rateHz: number; readonly depth: number }
  | { readonly target: GainNodeLike; readonly rateHz: number; readonly depth: number };

/** Create a browser `AudioContext`, or null outside a browser. */
function createBrowserContext(): AudioContextLike | null {
  const scope = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
  const Ctor = (scope.AudioContext ?? scope.webkitAudioContext) as (new () => unknown) | undefined;
  if (!Ctor) return null;
  return new Ctor() as AudioContextLike;
}

/** Default gesture target: the page's document when one exists. */
function defaultGestureTarget(): EventTarget | null {
  return typeof document !== 'undefined' ? document : null;
}

/**
 * Owns the synthesized street. Construct it once (app boot), arm the first
 * gesture immediately, then drive it from the render loop.
 */
export class AudioDirector {
  readonly #core: EraTimelineCore;
  readonly #providedContext: AudioContextLike | null;
  readonly #hooks: AudioHookBus;
  readonly #random: () => number;
  readonly #voicePoolSize: number;
  readonly #gestureTarget: EventTarget | null;

  #context: AudioContextLike | null = null;
  #enablePromise: Promise<boolean> | null = null;
  #gestureDisarm: (() => void) | null = null;
  #eraUnsubscribe: (() => void) | null = null;
  #hookUnsubscribes: Array<() => void> = [];

  #unlocked = false;
  #muted = false;
  #disposed = false;

  #master: GainNodeLike | null = null;
  #spatial: GainNodeLike | null = null;
  #trafficGain: GainNodeLike | null = null;
  #footstepsGain: GainNodeLike | null = null;
  #chatterGain: GainNodeLike | null = null;
  #trafficFilter: BiquadFilterNodeLike | null = null;
  #chatterFilter: BiquadFilterNodeLike | null = null;
  readonly #eraBuses = new Map<EraYear, GainNodeLike>();
  #pool: VoicePool | null = null;
  #white: AudioBufferLike | null = null;
  #brown: AudioBufferLike | null = null;

  readonly #staticNodes: AudioNodeLike[] = [];
  readonly #persistentSources: AudioScheduledSourceLike[] = [];
  readonly #patterns: PatternRuntime[] = [];

  readonly #weights: number[] = [1, 0, 0, 0, 0];
  #lastPosition = -1;
  #lastSpatialTarget = 1;
  #listenerX = 0;
  #listenerZ = 0;
  #lastCueYear: EraYear | null;
  #cueCount = 0;
  #hookCount = 0;
  #layersBuilt = 0;
  #lastShotGain = 0;

  constructor(options: AudioDirectorOptions) {
    this.#core = options.core;
    this.#providedContext = options.context ?? null;
    this.#hooks = options.hooks ?? createAudioHookBus();
    this.#random = options.random ?? Math.random;
    this.#voicePoolSize = Math.max(1, Math.floor(options.voicePoolSize ?? DEFAULT_VOICE_POOL_SIZE));
    this.#gestureTarget =
      options.gestureTarget === undefined ? defaultGestureTarget() : options.gestureTarget;
    this.#lastCueYear = options.core.selectedYear;

    // Era changes are observed only through the era timeline core.
    this.#eraUnsubscribe = options.core.subscribe((snapshot) => {
      this.#onEraSnapshot(snapshot);
    });
    // Documented hook events emitted by content modules.
    for (const name of AUDIO_HOOK_EVENTS) {
      this.#hookUnsubscribes.push(
        this.#hooks.on(name, (event) => {
          this.#onHook(name, event);
        }),
      );
    }
  }

  /** Hook bus content modules emit on. */
  get hooks(): AudioHookBus {
    return this.#hooks;
  }

  /** True once the first gesture unlocked audio and the graph is built. */
  get isUnlocked(): boolean {
    return this.#unlocked;
  }

  /** True while the master mute is engaged. */
  get isMuted(): boolean {
    return this.#muted;
  }

  /**
   * Arm one-shot first-gesture listeners that call {@link enable}. Idempotent:
   * re-arming returns the existing disarm function. Returns a disarm function.
   * Disarm happens automatically once unlock succeeds; if the browser refuses
   * the resume, the listeners stay armed for the next gesture.
   */
  armFirstGesture(target?: EventTarget | null): () => void {
    const resolved = target === undefined ? this.#gestureTarget : target;
    if (this.#unlocked || this.#disposed || !resolved) {
      return () => undefined;
    }
    if (this.#gestureDisarm) return this.#gestureDisarm;

    const onGesture = (): void => {
      if (this.#unlocking || this.#unlocked) return;
      this.#unlocking = true;
      void this.enable().then(() => {
        this.#unlocking = false;
      });
    };
    for (const event of GESTURE_EVENTS) resolved.addEventListener(event, onGesture);
    const disarm = (): void => {
      for (const event of GESTURE_EVENTS) resolved.removeEventListener(event, onGesture);
      if (this.#gestureDisarm === disarm) this.#gestureDisarm = null;
    };
    this.#gestureDisarm = disarm;
    return disarm;
  }

  #unlocking = false;

  /**
   * Unlock audio: resume the context and build the whole graph. Call this
   * from inside a user-gesture handler (the armed gesture listeners do it for
   * you); tests may call it directly to simulate the gesture. Idempotent and
   * safe to await from concurrent callers. Resolves false when the context
   * cannot start or the director was disposed.
   */
  enable(): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);
    if (this.#unlocked) return Promise.resolve(true);
    if (this.#enablePromise) return this.#enablePromise;
    const attempt = this.#doEnable().then((ok) => {
      if (this.#enablePromise === attempt) this.#enablePromise = null;
      return ok;
    });
    this.#enablePromise = attempt;
    return attempt;
  }

  /**
   * Engage or release the master mute. Engaging zeroes the master gain with an
   * immediate (unramped) parameter set, so every branch — beds, era textures,
   * one-shots, transition cues — is silent on the same audio-clock tick.
   * While muted the director also stops scheduling new one-shots (CPU).
   */
  setMuted(muted: boolean): void {
    if (this.#disposed) return;
    this.#muted = muted;
    this.#applyMasterLevel();
  }

  /**
   * Follow the camera on the ground plane (X/Z). Beds and era textures duck
   * smoothly with distance from the street center; one-shots use their own
   * emitter positions. Small movements below an epsilon are ignored.
   */
  setListenerPosition(x: number, z: number): void {
    this.#listenerX = Number.isFinite(x) ? x : 0;
    this.#listenerZ = Number.isFinite(z) ? z : 0;
    const spatial = this.#spatial;
    const context = this.#context;
    if (!spatial || !context || this.#disposed) return;
    const distance = Math.sqrt(this.#listenerX * this.#listenerX + this.#listenerZ * this.#listenerZ);
    const falloff = distanceGain(distance, SPATIAL_REFERENCE_DISTANCE, SPATIAL_MAX_DISTANCE, SPATIAL_ROLLOFF);
    const target = MIN_SPATIAL_GAIN + (1 - MIN_SPATIAL_GAIN) * falloff;
    if (Math.abs(target - this.#lastSpatialTarget) < SPATIAL_EPSILON) return;
    this.#lastSpatialTarget = target;
    rampParam(spatial.gain, target, context.currentTime, SPATIAL_RAMP_SECONDS);
  }

  /**
   * Per-frame driver: re-reads the timeline core's blend (era crossfade +
   * bed re-balancing) and counts down the era pattern layers, spawning due
   * one-shots. Call once per render tick with the frame delta. Allocation-free
   * apart from the timeline core's own blend object when the position moved.
   */
  update(deltaSeconds: number): void {
    if (!this.#unlocked || this.#disposed) return;
    const delta =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? Math.min(deltaSeconds, 0.25) : 0;
    this.#followTimeline(false);
    if (delta > 0) this.#tickPatterns(delta);
  }

  /** Current intrinsic mix levels (diagnostic; allocates a small object). */
  mixSnapshot(): AudioMixSnapshot {
    const weights = [
      this.#weights[0],
      this.#weights[1],
      this.#weights[2],
      this.#weights[3],
      this.#weights[4],
    ];
    const eraBusGains: number[] = [];
    for (const era of ERAS) {
      const bus = this.#eraBuses.get(era.year);
      eraBusGains.push(bus ? bus.gain.value : 0);
    }
    const master = this.#master;
    const spatial = this.#spatial;
    const traffic = this.#trafficGain;
    const footsteps = this.#footstepsGain;
    const chatter = this.#chatterGain;
    if (!this.#unlocked || !master || !spatial || !traffic || !footsteps || !chatter) {
      return {
        master: 0,
        spatial: 0,
        traffic: 0,
        footsteps: 0,
        chatter: 0,
        eraWeights: weights,
        eraBusGains,
      };
    }
    return {
      master: master.gain.value,
      spatial: spatial.gain.value,
      traffic: traffic.gain.value,
      footsteps: footsteps.gain.value,
      chatter: chatter.gain.value,
      eraWeights: weights,
      eraBusGains,
    };
  }

  /** Health counters for QA/debug (allocates; not for the frame loop). */
  stats(): AudioDirectorStats {
    const pool = this.#pool;
    return {
      unlocked: this.#unlocked,
      muted: this.#muted,
      activeVoices: pool ? pool.activeCount : 0,
      droppedVoices: pool ? pool.droppedCount : 0,
      lastShotGain: this.#lastShotGain,
      cueCount: this.#cueCount,
      hookCount: this.#hookCount,
      layersBuilt: this.#layersBuilt,
      nodeCount: this.#staticNodes.length + (pool ? pool.nodeCount : 0),
    };
  }

  /**
   * Tear everything down: unsubscribe from the core and hook bus, disarm the
   * gesture, stop every looping source, and disconnect all nodes. Idempotent.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unlocked = false;
    this.#eraUnsubscribe?.();
    this.#eraUnsubscribe = null;
    for (const off of this.#hookUnsubscribes) off();
    this.#hookUnsubscribes = [];
    this.#gestureDisarm?.();
    this.#gestureDisarm = null;

    for (const source of this.#persistentSources) {
      try {
        source.stop();
      } catch {
        // Already stopped — disposal must continue.
      }
      source.disconnect();
    }
    this.#persistentSources.length = 0;
    this.#pool?.dispose();
    this.#pool = null;
    for (const node of this.#staticNodes) node.disconnect();
    this.#staticNodes.length = 0;
    this.#eraBuses.clear();
    this.#patterns.length = 0;
    this.#master = null;
    this.#spatial = null;
    this.#trafficGain = null;
    this.#footstepsGain = null;
    this.#chatterGain = null;
    this.#trafficFilter = null;
    this.#chatterFilter = null;
    this.#white = null;
    this.#brown = null;
    this.#context = null;
  }

  async #doEnable(): Promise<boolean> {
    try {
      if (this.#disposed || this.#unlocked) return this.#unlocked;
      const context = this.#providedContext ?? createBrowserContext();
      if (!context) return false;
      if (context.state !== 'running') await context.resume();
      if (this.#disposed || context.state !== 'running') return false;
      this.#context = context;
      this.#buildGraph(context);
      this.#unlocked = true;
      this.#applyMasterLevel();
      this.#lastPosition = -1;
      this.#followTimeline(true);
      this.#disarmGesture();
      return true;
    } catch {
      return false;
    }
  }

  #disarmGesture(): void {
    this.#gestureDisarm?.();
    this.#gestureDisarm = null;
  }

  #applyMasterLevel(): void {
    const master = this.#master;
    const context = this.#context;
    if (!master || !context) return;
    setParamImmediate(master.gain, this.#muted ? 0 : AUDIO_MASTER_LEVEL, context.currentTime);
  }

  /** Era timeline core notified: fire a transition cue on year changes. */
  #onEraSnapshot(snapshot: EraTimelineSnapshot): void {
    const previous = this.#lastCueYear;
    this.#lastCueYear = snapshot.selectedYear;
    if (previous === null || previous === snapshot.selectedYear) return;
    this.#cueCount += 1;
    const pool = this.#pool;
    if (!this.#unlocked || this.#muted || !pool) return;
    if (this.#white) {
      this.#playShot('whoosh', { gain: 0.5, noiseBuffer: this.#white });
    }
    this.#playShot('era-chime', {
      gain: 0.55,
      baseFrequencyHz: ERA_CHIME_FREQUENCY[snapshot.selectedYear],
    });
  }

  /** Documented hook event received: play its mapped one-shot, ducked. */
  #onHook(name: AudioHookEventName, event: AudioHookEvent): void {
    this.#hookCount += 1;
    const pool = this.#pool;
    if (!this.#unlocked || this.#muted || !pool || !this.#white) return;
    const binding = HOOK_ONE_SHOTS[name];
    let factor = 1;
    if (event.x !== undefined || event.z !== undefined) {
      const dx = (event.x ?? 0) - this.#listenerX;
      const dz = (event.z ?? 0) - this.#listenerZ;
      factor = distanceGain(
        Math.sqrt(dx * dx + dz * dz),
        HOOK_REFERENCE_DISTANCE,
        HOOK_MAX_DISTANCE,
        1,
      );
    }
    const intensity =
      event.gain !== undefined && Number.isFinite(event.gain) && event.gain >= 0
        ? event.gain
        : 1;
    this.#playShot(binding.voice, {
      gain: binding.gain * intensity * factor,
      noiseBuffer: this.#white,
    });
  }

  /** Count down era pattern layers and spawn the due one-shots. */
  #tickPatterns(deltaSeconds: number): void {
    const pool = this.#pool;
    if (!pool) return;
    for (let i = 0; i < this.#patterns.length; i += 1) {
      const runtime = this.#patterns[i];
      runtime.countdownSeconds -= deltaSeconds;
      if (runtime.countdownSeconds > 0) continue;
      const spec = runtime.spec;
      const weight = this.#weights[runtime.eraIndex];
      if (!this.#muted && this.#white && weight >= PATTERN_MIN_WEIGHT) {
        const dx = spec.position[0] - this.#listenerX;
        const dz = spec.position[1] - this.#listenerZ;
        const factor = distanceGain(
          Math.sqrt(dx * dx + dz * dz),
          PATTERN_REFERENCE_DISTANCE,
          PATTERN_MAX_DISTANCE,
          1,
        );
        this.#playShot(spec.voice, {
          gain: spec.gain * weight * factor,
          noiseBuffer: this.#white,
        });
      }
      const span = Math.max(0, spec.maxIntervalSeconds - spec.minIntervalSeconds);
      runtime.countdownSeconds = spec.minIntervalSeconds + span * this.#random01();
    }
  }

  #random01(): number {
    const value = this.#random();
    if (!Number.isFinite(value)) return 0.5;
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** Play a one-shot through the pool, recording its requested gain. */
  #playShot(voice: OneShotVoice, options: OneShotOptions): number {
    const pool = this.#pool;
    if (!pool) return 0;
    this.#lastShotGain = options.gain;
    return playOneShot(pool, voice, options);
  }

  /**
   * Follow the timeline core's current position: recompute era weights and
   * ramp the era buses plus the shared bed levels/filter colors. Runs only
   * when the position actually changed (or once immediately at unlock).
   */
  #followTimeline(immediate: boolean): void {
    const context = this.#context;
    const trafficGain = this.#trafficGain;
    const footstepsGain = this.#footstepsGain;
    const chatterGain = this.#chatterGain;
    const trafficFilter = this.#trafficFilter;
    const chatterFilter = this.#chatterFilter;
    if (!context || !trafficGain || !footstepsGain || !chatterGain || !trafficFilter || !chatterFilter) {
      return;
    }
    const position = this.#core.position;
    if (!immediate && position === this.#lastPosition) return;
    this.#lastPosition = position;

    const blend = blendForPosition(position);
    const weights = this.#weights;
    for (let i = 0; i < weights.length; i += 1) weights[i] = 0;
    weights[ERA_INDEX[blend.from]] += 1 - blend.fraction;
    weights[ERA_INDEX[blend.to]] += blend.fraction;

    const now = context.currentTime;
    let traffic = 0;
    let footsteps = 0;
    let chatter = 0;
    let trafficHz = 0;
    let chatterHz = 0;
    for (let i = 0; i < ERAS.length; i += 1) {
      const weight = weights[i];
      const profile = ERAS[i];
      traffic += weight * profile.beds.traffic;
      footsteps += weight * profile.beds.footsteps;
      chatter += weight * profile.beds.chatter;
      trafficHz += weight * profile.trafficFilterHz;
      chatterHz += weight * profile.chatterFilterHz;
      const bus = this.#eraBuses.get(profile.year);
      if (bus) this.#set(bus.gain, weight, now, immediate, CROSSFADE_RAMP_SECONDS);
    }
    this.#set(trafficGain.gain, traffic, now, immediate, BED_RAMP_SECONDS);
    this.#set(footstepsGain.gain, footsteps, now, immediate, BED_RAMP_SECONDS);
    this.#set(chatterGain.gain, chatter, now, immediate, BED_RAMP_SECONDS);
    this.#set(trafficFilter.frequency, trafficHz, now, immediate, BED_RAMP_SECONDS);
    this.#set(chatterFilter.frequency, chatterHz, now, immediate, BED_RAMP_SECONDS);
  }

  #set(
    param: AudioParamLike,
    value: number,
    now: number,
    immediate: boolean,
    rampSeconds: number,
  ): void {
    if (immediate) setParamImmediate(param, value, now);
    else rampParam(param, value, now, rampSeconds);
  }

  /** Build the complete graph: master -> limiter, buses, beds, eras, pool. */
  #buildGraph(context: AudioContextLike): void {
    const now = context.currentTime;

    // Master chain: every branch -> master -> soft limiter -> destination.
    const master = this.#register(context.createGain());
    setParamImmediate(master.gain, AUDIO_MASTER_LEVEL, now);
    const limiter = this.#register(context.createDynamicsCompressor());
    limiter.threshold.setValueAtTime(-8, now);
    limiter.knee.setValueAtTime(6, now);
    limiter.ratio.setValueAtTime(12, now);
    limiter.attack.setValueAtTime(0.003, now);
    limiter.release.setValueAtTime(0.25, now);
    master.connect(limiter);
    limiter.connect(context.destination);
    this.#master = master;

    // Branch buses.
    const cueBus = this.#register(context.createGain());
    setParamImmediate(cueBus.gain, 1, now);
    cueBus.connect(master);
    const oneshotBus = this.#register(context.createGain());
    setParamImmediate(oneshotBus.gain, 1, now);
    oneshotBus.connect(master);
    const spatial = this.#register(context.createGain());
    setParamImmediate(spatial.gain, 1, now);
    spatial.connect(master);
    this.#spatial = spatial;

    const bedBus = this.#register(context.createGain());
    setParamImmediate(bedBus.gain, BED_BUS_TRIM, now);
    bedBus.connect(spatial);

    const trafficGain = this.#register(context.createGain());
    trafficGain.connect(bedBus);
    const footstepsGain = this.#register(context.createGain());
    footstepsGain.connect(bedBus);
    const chatterGain = this.#register(context.createGain());
    chatterGain.connect(bedBus);
    this.#trafficGain = trafficGain;
    this.#footstepsGain = footstepsGain;
    this.#chatterGain = chatterGain;

    // Procedural noise shared by beds, textures, and noise-based one-shots.
    const white = createNoiseBuffer(context, 'white', 1.5, 0x51ed270b);
    const brown = createNoiseBuffer(context, 'brown', 2, 0x1b873593);
    this.#white = white;
    this.#brown = brown;

    // Persistent beds: traffic (rumble), footsteps (patter), chatter (murmur).
    this.#trafficFilter = this.#buildBedLayer(
      context,
      brown,
      trafficGain,
      now,
      'lowpass',
      ERAS[0].trafficFilterHz,
      0.7,
      { target: 'filter-frequency', rateHz: 0.08, depth: 80 },
    );
    this.#buildBedLayer(context, white, footstepsGain, now, 'bandpass', 1500, 1.6, {
      target: footstepsGain,
      rateHz: 1.7,
      depth: 0.16,
    });
    this.#chatterFilter = this.#buildBedLayer(
      context,
      white,
      chatterGain,
      now,
      'bandpass',
      ERAS[0].chatterFilterHz,
      1.1,
      { target: chatterGain, rateHz: 0.32, depth: 0.12 },
    );

    // Era mix buses + era-defining textures.
    for (const era of ERAS) {
      const bus = this.#register(context.createGain());
      setParamImmediate(bus.gain, 0, now);
      bus.connect(spatial);
      this.#eraBuses.set(era.year, bus);
      for (const texture of era.textures) this.#buildTexture(context, texture, bus, now);
      const eraIndex = ERA_INDEX[era.year];
      for (const spec of era.patterns) {
        const span = Math.max(0, spec.maxIntervalSeconds - spec.minIntervalSeconds);
        this.#patterns.push({
          era: era.year,
          eraIndex,
          spec,
          countdownSeconds: spec.minIntervalSeconds + span * this.#random01(),
        });
      }
    }

    this.#pool = new VoicePool(context, oneshotBus, this.#voicePoolSize);
  }

  /**
   * Build one looping bed layer: noise source -> filter -> destination, with
   * an optional slow LFO on either the filter cutoff or the destination gain.
   * Returns the filter so callers can automate its cutoff per era.
   */
  #buildBedLayer(
    context: AudioContextLike,
    buffer: AudioBufferLike,
    destination: GainNodeLike,
    now: number,
    filterType: BiquadFilterType,
    filterHz: number,
    filterQ: number,
    lfo: BedLfo | null,
  ): BiquadFilterNodeLike {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterHz, now);
    filter.Q.setValueAtTime(filterQ, now);
    source.connect(filter);
    filter.connect(destination);
    source.start(now);
    this.#register(source);
    this.#register(filter);
    this.#persistentSources.push(source);

    if (lfo) {
      const lfoOsc = this.#register(context.createOscillator());
      lfoOsc.type = 'sine';
      lfoOsc.frequency.setValueAtTime(lfo.rateHz, now);
      const depth = this.#register(context.createGain());
      depth.gain.setValueAtTime(lfo.depth, now);
      lfoOsc.connect(depth);
      depth.connect(lfo.target === 'filter-frequency' ? filter.frequency : lfo.target.gain);
      lfoOsc.start(now);
      this.#persistentSources.push(lfoOsc);
    }
    return filter;
  }

  /**
   * Build one continuous era texture (noise or oscillator) into its era bus:
   * source -> color filter -> layer gain, with an optional LFO on the filter
   * cutoff, the layer gain, or the oscillator pitch. Runs forever; the era
   * bus gain provides the crossfade.
   */
  #buildTexture(
    context: AudioContextLike,
    spec: TextureLayerSpec,
    destination: GainNodeLike,
    now: number,
  ): void {
    let source: AudioScheduledSourceLike;
    let pitchParam: AudioParamLike | null = null;
    if (spec.source === 'oscillator') {
      const oscillator = context.createOscillator();
      oscillator.type = spec.waveform ?? 'sine';
      oscillator.frequency.setValueAtTime(Math.max(1, spec.frequencyHz), now);
      pitchParam = oscillator.frequency;
      source = oscillator;
    } else {
      const buffer = spec.source === 'brown-noise' ? this.#brown : this.#white;
      if (!buffer) return;
      const noiseSource = context.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      source = noiseSource;
    }

    const filter = context.createBiquadFilter();
    filter.type = spec.filterType ?? 'lowpass';
    const cutoff =
      spec.filterHz ??
      (spec.source === 'oscillator' ? spec.frequencyHz * 6 : spec.frequencyHz);
    filter.frequency.setValueAtTime(Math.max(1, cutoff), now);
    filter.Q.setValueAtTime(spec.q ?? 1, now);
    const layerGain = context.createGain();
    setParamImmediate(layerGain.gain, Math.max(0, spec.gain), now);

    source.connect(filter);
    filter.connect(layerGain);
    layerGain.connect(destination);
    source.start(now);
    this.#register(source);
    this.#register(filter);
    this.#register(layerGain);
    this.#persistentSources.push(source);
    this.#layersBuilt += 1;

    if (spec.lfo) {
      const lfo = this.#register(context.createOscillator());
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(Math.max(0.01, spec.lfo.rateHz), now);
      const depth = this.#register(context.createGain());
      depth.gain.setValueAtTime(spec.lfo.depth, now);
      lfo.connect(depth);
      const target =
        spec.lfo.target === 'filter-frequency'
          ? filter.frequency
          : spec.lfo.target === 'layer-gain'
            ? layerGain.gain
            : pitchParam;
      if (target) depth.connect(target);
      lfo.start(now);
      this.#persistentSources.push(lfo);
    }
  }

  /** Track a graph node for teardown and budget accounting. */
  #register<T extends AudioNodeLike>(node: T): T {
    this.#staticNodes.push(node);
    return node;
  }
}
