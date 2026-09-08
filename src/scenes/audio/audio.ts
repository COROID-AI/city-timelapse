/**
 * Per-era SFX / ambient audio engine.
 *
 * Owns the Web Audio graph that produces the city-block ambience for each era
 * (1945 -> 2025). It is a pure consumer of the shared era registry
 * (`src/scenes/eras`) and drives the reproduced WebAudio oscillators from the
 * era's `SfxProfile` data.
 *
 * ## Lifecycle
 *
 * - `attach(year)`: (re)builds and starts the oscillator layers for an era.
 * - `update(year)`: re-tunes the running ambience to another era, stopping all
 *   previously-running oscillators first (fix `920f34e7`).
 * - `dispose()`: stops every oscillator and closes the `AudioContext`
 *   on unmount (fix `8106c2a7`).
 *
 * The AudioContext is created lazily on first `attach`/`update` so the module
 * can be imported in environments without the Web Audio API (e.g. during
 * type-check); constructing a graph only happens when audio is actually used.
 */

import type { EraData } from '../eras';
import { getEra } from '../eras';
import { buildEraAmbientProfile } from './layers';
import type { EraAmbientProfile, OscillatorLayer } from './layers';
import type {
  AudioContextLike,
  AudioContextFactory,
  GainLike,
  OscillatorLike,
} from './types';

/** Default factory: use the environment's global `AudioContext`. */
function defaultAudioContextFactory(): AudioContextLike {
  const GlobalAudioContext =
    (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (globalThis as { webkitAudioContext?: new () => AudioContextLike })
      .webkitAudioContext;
  if (!GlobalAudioContext) {
    throw new Error(
      'AmbientAudio: Web Audio API is not available in this environment.',
    );
  }
  return new GlobalAudioContext();
}

/** One live oscillator bound to the master gain plus its owning layer config. */
interface LiveOscillator {
  layer: OscillatorLayer;
  node: OscillatorLike;
}

/**
 * Ambient audio controller. Create one per scene; call {@link attach} on era
 * selection, {@link update} on era change, and {@link dispose} on unmount.
 */
export class AmbientAudio {
  private readonly audioContextFactory: AudioContextFactory;
  private audioContext: AudioContextLike | null = null;
  private masterGain: GainLike | null = null;
  private liveOscillators: LiveOscillator[] = [];
  private disposed = false;

  constructor(options: { audioContextFactory?: AudioContextFactory } = {}) {
    this.audioContextFactory =
      options.audioContextFactory ?? defaultAudioContextFactory;
  }

  /**
   * Compose the per-era ambient profile from the era registry (read-only).
   * Consumes the shared `getEra` contract; throws on unknown years.
   */
  getProfile(year: number): EraAmbientProfile {
    const era: EraData = getEra(year);
    return buildEraAmbientProfile(era.year, era.sfx);
  }

  /**
   * Attach the ambience for an era, creating the AudioContext (if needed) and
   * starting all of the era's oscillator layers. If an ambience for a different
   * era is already running it is stopped first.
   */
  attach(year: number): string {
    this.ensureNotDisposed();
    // Stop any previously-running layers so the profile switches cleanly.
    this.stopAll();
    const profile = this.getProfile(year);
    this.ensureGraph();
    for (const layer of profile.layers) {
      this.startLayer(layer);
    }
    if (this.masterGain !== null) {
      this.masterGain.gain.value = profile.ambienceLevel;
    }
    return profile.soundbankId;
  }

  /**
   * Re-tune the running ambience to another era, preserving the reviewed "stop
   * all oscillators on era change" fix (`920f34e7`).
   */
  update(year: number): string {
    return this.attach(year);
  }

  /**
   * Dispose of the audio graph: stop every running oscillator and close the
   * `AudioContext` so no WebAudio nodes leak after the scene unmounts
   * (`8106c2a7`).
   */
  async dispose(): Promise<void> {
    this.stopAll();
    if (this.audioContext !== null) {
      await this.audioContext.close();
    }
    this.audioContext = null;
    this.masterGain = null;
    this.disposed = true;
  }

  /** Number of currently running oscillator layers (test helper). */
  get runningOscillatorCount(): number {
    return this.liveOscillators.length;
  }

  /** Whether the AudioContext is currently open. */
  get hasOpenContext(): boolean {
    return this.audioContext !== null;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('AmbientAudio has been disposed; cannot attach again.');
    }
  }

  private ensureGraph(): void {
    if (this.audioContext === null) {
      const ctx = this.ctx();
      this.audioContext = ctx;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      this.masterGain = master;
    }
  }

  private startLayer(layer: OscillatorLayer): void {
    if (this.audioContext === null || this.masterGain === null) {
      return;
    }
    const osc = this.audioContext.createOscillator();
    osc.type = layer.shape;
    osc.frequency.value = layer.frequency;
    osc.detune.value = layer.detune;
    osc.connect(this.masterGain);
    osc.start();
    this.liveOscillators.push({ layer, node: osc });
  }

  private stopAll(): void {
    for (const live of this.liveOscillators) {
      live.node.stop();
    }
    this.liveOscillators = [];
  }

  private ctx(): AudioContextLike {
    return this.audioContextFactory();
  }
}