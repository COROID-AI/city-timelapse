import type { EraId } from '../types';
import { buildBed, type EraBed } from './ambience';
import { AMBIENCE_BUS_GAIN, CROSSFADE_SECONDS, DEFAULT_VOLUME, SFX_BUS_GAIN } from './constants';
import { buildRainLoop, buildWindLoop, playOneShot, type LoopName, type SfxLoop, type SfxName } from './sfx';

/**
 * Procedural Web Audio engine for the City Time Period Timelapse.
 *
 * The engine owns:
 *  - lazy `AudioContext` creation, unlocked only on the first user gesture,
 *  - per-era ambience beds that crossfade smoothly over 2–4s on era changes,
 *  - a master gain + mute, an ambience bus, and an SFX bus,
 *  - one-shot and looping SFX (footsteps, pass-bys, horns, whooshes, rain/wind).
 *
 * The `AudioContext` is NOT created at construction time — it is created lazily
 * on the first `unlock()` call, which must happen inside a user gesture. This
 * satisfies browser autoplay policy and avoids autoplay errors.
 */

/** Public surface returned by `createAudioEngine()`. */
export interface AudioEngine {
  /**
   * Create/resume the AudioContext. MUST be called from a user gesture handler
   * (overlay click) to satisfy autoplay policy. Safe to call repeatedly.
   */
  unlock(): void;
  /** Start the ambience bed for an era, crossfading from the current one. */
  setEra(era: EraId): void;
  /** Set the master volume 0..1. */
  setVolume(volume: number): void;
  /** Toggle mute; returns the new muted state. */
  toggleMute(): boolean;
  /** Play a one-shot SFX. `era` tunes era-appropriate horns. */
  playSfx(name: SfxName, era?: EraId): void;
  /** Start a looping SFX (rain / wind) at the given level 0..1. */
  startLoop(name: LoopName, level?: number): void;
  /** Stop a looping SFX. */
  stopLoop(name: LoopName): void;
  /** Whether the AudioContext has been created. */
  readonly isUnlocked: boolean;
  /** Whether audio is currently muted. */
  readonly isMuted: boolean;
  /** Release all audio resources and disconnect the context. */
  dispose(): void;
}

export interface AudioEngineOptions {
  /** Crossfade duration in seconds (defaults to shared constant, 2–4s). */
  crossfadeSeconds?: number;
  /** Factory for the AudioContext; defaults to `new AudioContext()`. */
  createContext?: () => AudioContext;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const crossfadeSeconds = options.crossfadeSeconds ?? CROSSFADE_SECONDS;
  let ctx: AudioContext | null = null;

  // Buses and their nodes, created once the context exists.
  let master: GainNode | null = null;
  let ambienceBus: GainNode | null = null;
  let sfxBus: GainNode | null = null;

  let volume = DEFAULT_VOLUME;
  let muted = false;
  let currentBed: EraBed | null = null;
  let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;

  const loops = new Map<LoopName, SfxLoop>();

  const createGraph = (context: AudioContext): void => {
    master = context.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(context.destination);

    ambienceBus = context.createGain();
    ambienceBus.gain.value = AMBIENCE_BUS_GAIN;
    ambienceBus.connect(master);

    sfxBus = context.createGain();
    sfxBus.gain.value = SFX_BUS_GAIN;
    sfxBus.connect(master);
  };

  const ensureContext = (): AudioContext => {
    if (!ctx) {
      ctx = options.createContext ? options.createContext() : new AudioContext();
      createGraph(ctx);
    }
    return ctx;
  };

  const scheduleBedUpdate = (): void => {
    if (crossfadeTimer) clearTimeout(crossfadeTimer);
    crossfadeTimer = setTimeout(() => {
      crossfadeTimer = null;
      if (currentBed) currentBed.update(ctx ? ctx.currentTime : 0);
      scheduleBedUpdate();
    }, 250);
  };

  const stopBedUpdate = (): void => {
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
    }
  };

  const engine: AudioEngine = {
    unlock() {
      const context = ensureContext();
      if (context.state === 'suspended') {
        void context.resume();
      }
    },

    setEra(era) {
      const context = ensureContext();
      if (!ambienceBus) return;
      const now = context.currentTime;

      // If no bed is active yet, just fade the new one in.
      if (!currentBed) {
        currentBed = buildBed(context, era);
        currentBed.gain.connect(ambienceBus);
        currentBed.gain.gain.setValueAtTime(0, now);
        currentBed.gain.gain.linearRampToValueAtTime(1, now + crossfadeSeconds);
        scheduleBedUpdate();
        return;
      }

      // Crossfade: fade the old bed out and the new bed in over the same window.
      const oldBed = currentBed;
      oldBed.gain.gain.cancelScheduledValues(now);
      oldBed.gain.gain.setValueAtTime(oldBed.gain.gain.value, now);
      oldBed.gain.gain.linearRampToValueAtTime(0, now + crossfadeSeconds);

      const newBed = buildBed(context, era);
      newBed.gain.connect(ambienceBus);
      newBed.gain.gain.setValueAtTime(0, now);
      newBed.gain.gain.linearRampToValueAtTime(1, now + crossfadeSeconds);

      currentBed = newBed;

      // Dispose the old bed after the crossfade completes.
      setTimeout(() => {
        oldBed.dispose();
      }, Math.ceil(crossfadeSeconds * 1000) + 200);
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master && !muted) {
        master.gain.setTargetAtTime(volume, ctx ? ctx.currentTime : 0, 0.02);
      }
    },

    toggleMute() {
      muted = !muted;
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
      }
      return muted;
    },

    playSfx(name, era) {
      const context = ensureContext();
      if (!sfxBus) return;
      playOneShot(context, name, sfxBus, era);
    },

    startLoop(name, level = 0.7) {
      const context = ensureContext();
      if (!sfxBus) return;
      const existing = loops.get(name);
      if (existing) {
        existing.setLevel(level);
        return;
      }
      const loop = name === 'rain' ? buildRainLoop(context) : buildWindLoop(context);
      loop.gain.connect(sfxBus);
      loop.setLevel(level);
      loops.set(name, loop);
    },

    stopLoop(name) {
      const loop = loops.get(name);
      if (!loop) return;
      loops.delete(name);
      loop.setLevel(0);
      setTimeout(() => loop.dispose(), 300);
    },

    get isUnlocked() {
      return ctx !== null;
    },

    get isMuted() {
      return muted;
    },

    dispose() {
      stopBedUpdate();
      if (currentBed) {
        currentBed.dispose();
        currentBed = null;
      }
      for (const loop of loops.values()) loop.dispose();
      loops.clear();
      if (ctx) {
        void ctx.close().catch(() => undefined);
        ctx = null;
      }
      master = null;
      ambienceBus = null;
      sfxBus = null;
    },
  };

  return engine;
}

/**
 * Process-wide singleton audio engine, imported at boot and driven by the
 * integration owner. The AudioContext is created lazily on the first
 * `unlock()` call (from a user gesture), satisfying autoplay policy.
 */
export const audioEngine = createAudioEngine();