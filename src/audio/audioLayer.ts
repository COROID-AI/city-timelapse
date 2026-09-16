/**
 * audioLayer.ts — Procedural era ambience and SFX with the Web Audio API.
 *
 * Every sound in the city block timelapse is synthesized in code from the
 * era registry (src/eras/eraSystem.ts, read-only): a per-era ambience bed of
 * oscillators plus a filtered noise "traffic" bed, a transition whoosh for
 * slider selections, slider ticks and UI click feedback (menu open/close).
 * There are zero audio assets.
 *
 * The layer is headless-friendly: the AudioContext is injected, either as an
 * instance through `attach(context)` or from a `contextFactory` option. Tests
 * exercise the entire graph through src/audio/audioContextFake.ts — plain
 * nodes with assertable parameters, no real audio output and no user-gesture
 * gating. In the browser t11-app-integration calls `resume()` from the first
 * user gesture to unlock a suspended context.
 *
 * Lifecycle:
 *  - `attach(context?)`  — register the context and build the master bus.
 *  - `applyEra(eraId, progress)` — crossfade ambience toward `eraId`; playing
 *    the transition whoosh when a new era is selected (progress 0).
 *  - `update(deltaSeconds)` — per-frame ambience modulation (breathing beds,
 *    pruning finished one-shot SFX).
 *  - `dispose()` — stop, disconnect and release every owned audio node.
 */
import {
  ERA_IDS,
  getEraDefinition,
  isEraId,
  type EraId,
} from '../eras/eraSystem';

/** Master bus level applied at the layer output (0..1). */
export const LAYER_MASTER_LEVEL = 0.9;
/** Duration of the transition whoosh in seconds. */
export const WHOOSH_DURATION_SECONDS = 0.7;

/* ------------------------------------------------------------------ *
 * Minimal Web Audio duck-types. Real AudioContext/OscillatorNode ... all
 * satisfy these structurally; the fake context in audioContextFake.ts
 * implements them with plain, assertable objects.
 * ------------------------------------------------------------------ */

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
  cancelScheduledValues(time: number): void;
  setTargetAtTime(value: number, time: number, timeConstant: number): void;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike;
  disconnect(destination?: AudioNodeLike): void;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface AudioBufferLike {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike;
  resume?(): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Options and stats.
 * ------------------------------------------------------------------ */

export interface AudioLayerOptions {
  /** Supplies the AudioContext when `attach()` is called without an instance. */
  contextFactory?: () => AudioContextLike;
}

export type PlayClickKind = 'tap' | 'open' | 'close';

export interface AudioLayerStats {
  /** Number of transition whooshes played (one per slider selection). */
  readonly whooshes: number;
  /** Number of slider ticks played. */
  readonly ticks: number;
  /** UI click feedback counts per kind (tap / menu open / menu close). */
  readonly clicks: Readonly<Record<PlayClickKind, number>>;
}

/* ------------------------------------------------------------------ *
 * Per-era ambience sound design (data, matching src/eras/eraSystem.ts).
 * ------------------------------------------------------------------ */

export interface BedToneSpec {
  /** Oscillator waveform for this era layer. */
  readonly type: OscillatorType;
  /** Base frequency in Hz. */
  readonly frequency: number;
  /** Relative level 0..1. */
  readonly level: number;
}

export interface BedSpec {
  /** Tonal layers: engine rumble, neon/electrical hum, digital drones... */
  readonly tones: readonly BedToneSpec[];
  /** Low-pass cutoff of the era's traffic-noise bed (Hz). */
  readonly noiseCutoff: number;
  /** Traffic-noise bed level 0..1 (1965/1985/2005 are busier). */
  readonly noiseLevel: number;
  /** Ambience breathing rate in Hz (drives per-frame filter modulation). */
  readonly lfoRate: number;
}

/**
 * Five distinct timbral sets, one per era:
 *  1945 quiet post-war street   — muted rumble + trolley-wire hum.
 *  1965 traffic + neon          — engine body + neon hum harmonics.
 *  1985 neon-soaked night       — deep low-frequency rumble + CRT whine.
 *  2005 early digital           — ventilation hum + digital drone.
 *  2025 EV silence              — whisper-quiet EV/LED/digital air.
 */
export const BED_SPECS: Readonly<Record<EraId, BedSpec>> = {
  1945: {
    tones: [
      { type: 'sine', frequency: 55, level: 0.1 },
      { type: 'sine', frequency: 120, level: 0.045 },
      { type: 'triangle', frequency: 240, level: 0.015 },
    ],
    noiseCutoff: 340,
    noiseLevel: 0.05,
    lfoRate: 0.07,
  },
  1965: {
    tones: [
      { type: 'sine', frequency: 60, level: 0.17 },
      { type: 'sawtooth', frequency: 90, level: 0.05 },
      { type: 'sine', frequency: 120, level: 0.09 },
      { type: 'sawtooth', frequency: 240, level: 0.04 },
    ],
    noiseCutoff: 700,
    noiseLevel: 0.1,
    lfoRate: 0.15,
  },
  1985: {
    tones: [
      { type: 'sine', frequency: 38, level: 0.26 },
      { type: 'sawtooth', frequency: 120, level: 0.12 },
      { type: 'sawtooth', frequency: 240, level: 0.06 },
      { type: 'sine', frequency: 15625, level: 0.01 },
    ],
    noiseCutoff: 1100,
    noiseLevel: 0.17,
    lfoRate: 0.24,
  },
  2005: {
    tones: [
      { type: 'sine', frequency: 60, level: 0.18 },
      { type: 'sine', frequency: 120, level: 0.06 },
      { type: 'triangle', frequency: 220, level: 0.04 },
    ],
    noiseCutoff: 1300,
    noiseLevel: 0.18,
    lfoRate: 0.3,
  },
  2025: {
    tones: [
      { type: 'sine', frequency: 180, level: 0.02 },
      { type: 'sine', frequency: 250, level: 0.02 },
      { type: 'sine', frequency: 880, level: 0.008 },
    ],
    noiseCutoff: 420,
    noiseLevel: 0.035,
    lfoRate: 0.42,
  },
};

/* ------------------------------------------------------------------ *
 * Internal node-graph state.
 * ------------------------------------------------------------------ */

interface Bed {
  readonly eraId: EraId;
  readonly spec: BedSpec;
  readonly master: GainNodeLike;
  readonly animatedFilter: BiquadFilterNodeLike;
  readonly baseFilterFrequency: number;
  /** Gain the bed settles at — the era registry's sfx.masterLevel. */
  readonly targetGain: number;
  readonly nodes: AudioNodeLike[];
  readonly sources: Array<OscillatorNodeLike | AudioBufferSourceNodeLike>;
}

interface SfxEntry {
  readonly stopAt: number;
  readonly nodes: AudioNodeLike[];
}

const TICK_DURATION_SECONDS = 0.05;
const TICK_LEVEL = 0.14;

const CLICK_DURATION: Readonly<Record<PlayClickKind, number>> = {
  tap: 0.06,
  open: 0.11,
  close: 0.09,
};
const CLICK_START_FREQUENCY: Readonly<Record<PlayClickKind, number>> = {
  tap: 420,
  open: 340,
  close: 720,
};
const CLICK_END_FREQUENCY: Readonly<Record<PlayClickKind, number>> = {
  tap: 170,
  open: 700,
  close: 260,
};

/** Clamp to [0, 1]. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Procedural era ambience + SFX layer. All synthesis is Web Audio code; the
 * context is injected for headless tests. See module docs for the lifecycle.
 */
export class AudioLayer {
  private readonly options: AudioLayerOptions;
  private context: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private readonly ownedNodes = new Set<AudioNodeLike>();
  private readonly beds = new Map<EraId, Bed>();
  private activeBed: Bed | null = null;
  private incomingBed: Bed | null = null;
  private sfx: SfxEntry[] = [];
  private noiseBuffer: AudioBufferLike | null = null;
  private noiseContext: AudioContextLike | null = null;
  private elapsedSeconds = 0;
  private muted = false;
  private everAppliedEra = false;
  private whooshes = 0;
  private ticksPlayed = 0;
  private readonly clicksPlayed: Record<PlayClickKind, number> = {
    tap: 0,
    open: 0,
    close: 0,
  };

  constructor(options: AudioLayerOptions = {}) {
    this.options = options;
  }

  /** The era whose ambience bed is currently settled, if any. */
  get activeEra(): EraId | null {
    return this.activeBed?.eraId ?? null;
  }

  /** Number of audio nodes this layer currently owns (beds + SFX + master). */
  get nodeCount(): number {
    return this.ownedNodes.size;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Cumulative SFX playback counters (whooshes / ticks / clicks). */
  get stats(): AudioLayerStats {
    return {
      whooshes: this.whooshes,
      ticks: this.ticksPlayed,
      clicks: {
        tap: this.clicksPlayed.tap,
        open: this.clicksPlayed.open,
        close: this.clicksPlayed.close,
      },
    };
  }

  /**
   * Register the AudioContext (instance or factory) and build the master bus.
   * Does not auto-resume: browsers gate audio on a user gesture, so the
   * integration calls `resume()` from the first gesture handler.
   */
  attach(context?: AudioContextLike): void {
    if (this.context) {
      throw new Error('AudioLayer.attach: already attached; dispose() then attach() to re-initialize.');
    }
    const ctx = context ?? this.options.contextFactory?.();
    if (!ctx) {
      throw new Error('AudioLayer.attach: pass an AudioContext instance or configure a contextFactory.');
    }
    this.context = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : LAYER_MASTER_LEVEL;
    master.connect(ctx.destination);
    this.masterGain = master;
    this.ownedNodes.add(master);
    // The shared noise buffer belongs to this context.
    this.noiseBuffer = null;
    this.noiseContext = ctx;
  }

  /**
   * Unlock the context from a user gesture. No-op for contexts that are
   * already running; the fake context records the call for assertions.
   */
  async resume(): Promise<void> {
    this.assertAttached();
    const context = this.requireContext();
    if (typeof context.resume === 'function') {
      await context.resume();
    }
  }

  /**
   * Apply an era selection / blend progress.
   *
   * - progress 0 selects a *new* era: the previous in-flight bed is retired,
   *   the target bed is built silent, and the transition whoosh plays.
   * - 0 < progress < 1 crossfades ambience: the incoming bed rises to
   *   `progress * era.sfx.masterLevel` while the outgoing bed falls to
   *   `(1 - progress) * target` (per-frame ambience updates).
   * - progress 1 settles the target: the outgoing bed is freed and the
   *   target bed becomes active.
   */
  applyEra(eraId: EraId, progress = 1): void {
    this.assertAttached();
    if (!isEraId(eraId)) {
      throw new Error(`AudioLayer.applyEra: unknown era ${String(eraId)}; known eras: ${ERA_IDS.join(', ')}`);
    }
    const p = clamp01(progress);

    // Already fully settled on this era: a stray progress nudge only breathes.
    if (this.activeBed !== null && this.incomingBed === null && this.activeBed.eraId === eraId) {
      this.updateBedBreathing(this.activeBed);
      return;
    }

    // First-ever call adopts the era without a selection whoosh (app boot).
    if (this.activeBed === null && this.incomingBed === null) {
      this.incomingBed = this.createBed(eraId);
    }

    // A different target replaces any in-flight (non-settled) bed and counts
    // as a slider selection, which fires the transition whoosh.
    if (this.incomingBed === null || this.incomingBed.eraId !== eraId) {
      if (this.incomingBed !== null) this.retireBed(this.incomingBed);
      this.incomingBed = this.createBed(eraId);
      if (this.everAppliedEra) {
        this.playWhoosh();
      }
    }
    this.everAppliedEra = true;

    // Crossfade: incoming rises with progress, outgoing falls to match.
    const incoming = this.incomingBed;
    incoming.master.gain.value = p * incoming.targetGain;
    if (this.activeBed !== null && this.activeBed !== incoming) {
      this.activeBed.master.gain.value = (1 - p) * this.activeBed.targetGain;
    }
    this.updateBedBreathing(incoming);

    // Settled: promote the incoming bed and free the outgoing one.
    if (p >= 1) {
      if (this.activeBed !== null && this.activeBed !== incoming) {
        this.retireBed(this.activeBed);
      }
      this.activeBed = incoming;
      this.incomingBed = null;
    }
  }

  /**
   * Per-frame ambience update: advances the modulation clock, breathes the
   * active (or in-flight) bed's noise filter and prunes finished one-shots.
   * Silent no-op before `attach()` so frame loops may tick early.
   */
  update(deltaSeconds = 1 / 60): void {
    if (!this.context) return;
    this.elapsedSeconds += Math.max(0, deltaSeconds);
    this.pruneSfx();
    const bed = this.incomingBed ?? this.activeBed;
    if (bed) this.updateBedBreathing(bed);
  }

  /** Slider tick: a short 1.1kHz blip falling to 650Hz. */
  playTick(): void {
    this.assertAttached();
    const ctx = this.requireContext();
    this.ticksPlayed += 1;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(650, t + TICK_DURATION_SECONDS * 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(TICK_LEVEL, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + TICK_DURATION_SECONDS);

    osc.connect(gain);
    gain.connect(this.requireMaster());
    osc.start(t);
    osc.stop(t + TICK_DURATION_SECONDS + 0.02);
    this.registerSfx([osc, gain], t + TICK_DURATION_SECONDS + 0.02);
  }

  /**
   * UI click feedback. `open`/`close` have distinct rising/falling pitches for
   * the menu lifecycle; `tap` is the default short thunk.
   */
  playClick(kind: PlayClickKind = 'tap'): void {
    this.assertAttached();
    const ctx = this.requireContext();
    this.clicksPlayed[kind] += 1;

    const t = ctx.currentTime;
    const duration = CLICK_DURATION[kind];
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(CLICK_START_FREQUENCY[kind], t);
    osc.frequency.exponentialRampToValueAtTime(CLICK_END_FREQUENCY[kind], t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.requireMaster());
    osc.start(t);
    osc.stop(t + duration + 0.02);
    this.registerSfx([osc, gain], t + duration + 0.02);
  }

  /**
   * Transition whoosh: a band-passed noise sweep (280Hz -> 2.6kHz) layered
   * with a rising sine glide. `applyEra` calls this on each selection.
   */
  playWhoosh(): void {
    this.assertAttached();
    const ctx = this.requireContext();
    this.whooshes += 1;

    const t = ctx.currentTime;
    const duration = WHOOSH_DURATION_SECONDS;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getOrCreateNoiseBuffer();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(280, t);
    band.frequency.exponentialRampToValueAtTime(2600, t + duration);
    band.Q.setValueAtTime(0.9, t);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.linearRampToValueAtTime(0.5, t + 0.18);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(this.requireMaster());
    noise.start(t);
    noise.stop(t + duration + 0.05);

    const glide = ctx.createOscillator();
    glide.type = 'sine';
    glide.frequency.setValueAtTime(220, t);
    glide.frequency.exponentialRampToValueAtTime(880, t + duration);
    const glideGain = ctx.createGain();
    glideGain.gain.setValueAtTime(0.0001, t);
    glideGain.gain.exponentialRampToValueAtTime(0.08, t + 0.15);
    glideGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    glide.connect(glideGain);
    glideGain.connect(this.requireMaster());
    glide.start(t);
    glide.stop(t + duration + 0.05);

    this.registerSfx([noise, band, noiseGain, glide, glideGain], t + duration + 0.05);
  }

  /** Mute/unmute the master bus. Bed gains keep their per-era mix. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : LAYER_MASTER_LEVEL;
    }
  }

  /** Toggle master mute; returns the new muted state. */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Current gain of a live era bed, or null when the bed is retired. */
  getBedGain(eraId: EraId): number | null {
    const liveBeds = [this.incomingBed, this.activeBed];
    const bed = liveBeds.find((candidate): candidate is Bed => candidate !== null && candidate.eraId === eraId);
    return bed ? bed.master.gain.value : null;
  }

  /**
   * Stop, disconnect and release every owned node (beds, one-shot SFX and the
   * master bus). Idempotent; safe to call before `attach()`.
   */
  dispose(): void {
    if (this.context === null && this.masterGain === null) return;
    for (const bed of this.beds.values()) {
      this.retireBed(bed);
    }
    this.activeBed = null;
    this.incomingBed = null;
    this.beds.clear();
    for (const entry of this.sfx) {
      for (const node of entry.nodes) {
        node.disconnect();
        this.ownedNodes.delete(node);
      }
    }
    this.sfx = [];
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
      this.masterGain.disconnect();
      this.ownedNodes.delete(this.masterGain);
      this.masterGain = null;
    }
    this.ownedNodes.clear();
    this.noiseBuffer = null;
    this.noiseContext = null;
    this.context = null;
    this.elapsedSeconds = 0;
    this.muted = false;
    this.everAppliedEra = false;
  }

  /* ---------------------------------------------------------------- *
   * Internals.
   * ---------------------------------------------------------------- */

  private createBed(eraId: EraId): Bed {
    const era = getEraDefinition(eraId);
    const spec = BED_SPECS[eraId];
    const ctx = this.requireContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(this.requireMaster());
    const nodes: AudioNodeLike[] = [master];
    const sources: Array<OscillatorNodeLike | AudioBufferSourceNodeLike> = [];

    for (const tone of spec.tones) {
      const osc = ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.value = tone.frequency;
      const gain = ctx.createGain();
      gain.gain.value = tone.level;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      nodes.push(osc, gain);
      sources.push(osc);
    }

    // Traffic-noise bed: looped noise through a breathing low-pass.
    const noise = ctx.createBufferSource();
    noise.buffer = this.getOrCreateNoiseBuffer();
    noise.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = spec.noiseCutoff;
    lowpass.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = spec.noiseLevel;
    noise.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    nodes.push(noise, lowpass, noiseGain);
    sources.push(noise);

    const bed: Bed = {
      eraId,
      spec,
      master,
      animatedFilter: lowpass,
      baseFilterFrequency: spec.noiseCutoff,
      targetGain: era.sfx.masterLevel,
      nodes,
      sources,
    };
    for (const node of nodes) this.ownedNodes.add(node);
    this.beds.set(eraId, bed);
    return bed;
  }

  /** Stop sources, disconnect nodes and forget a bed (releases its nodes). */
  private retireBed(bed: Bed): void {
    for (const source of bed.sources) {
      source.stop();
    }
    for (const node of bed.nodes) {
      node.disconnect();
      this.ownedNodes.delete(node);
    }
    this.beds.delete(bed.eraId);
  }

  /** Slow sinusoidal modulation of the bed's noise-filter cutoff each frame. */
  private updateBedBreathing(bed: Bed): void {
    const phase = this.elapsedSeconds * bed.spec.lfoRate * Math.PI * 2;
    const breathe = 0.5 + 0.5 * Math.sin(phase);
    bed.animatedFilter.frequency.value = bed.baseFilterFrequency * (0.72 + 0.56 * breathe);
  }

  private registerSfx(nodes: AudioNodeLike[], stopAt: number): void {
    for (const node of nodes) this.ownedNodes.add(node);
    this.sfx.push({ stopAt, nodes });
  }

  /** Disconnect one-shot SFX whose scheduled stop time has passed. */
  private pruneSfx(): void {
    if (this.sfx.length === 0) return;
    const now = this.requireContext().currentTime;
    const remaining: SfxEntry[] = [];
    for (const entry of this.sfx) {
      if (now < entry.stopAt) {
        remaining.push(entry);
        continue;
      }
      for (const node of entry.nodes) {
        node.disconnect();
        this.ownedNodes.delete(node);
      }
    }
    this.sfx = remaining;
  }

  /** 2-second procedurally generated brown-ish noise buffer, cached per context. */
  private getOrCreateNoiseBuffer(): AudioBufferLike {
    const ctx = this.requireContext();
    if (this.noiseBuffer !== null && this.noiseContext === ctx) {
      return this.noiseBuffer;
    }
    const length = Math.max(2, Math.floor(ctx.sampleRate * 2));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.5));
    }
    this.noiseBuffer = buffer;
    this.noiseContext = ctx;
    return buffer;
  }

  private requireMaster(): GainNodeLike {
    if (!this.masterGain) {
      throw new Error('AudioLayer: master gain not initialized; call attach(context) first.');
    }
    return this.masterGain;
  }

  private requireContext(): AudioContextLike {
    if (!this.context) {
      throw new Error('AudioLayer: no AudioContext attached; call attach(context) first.');
    }
    return this.context;
  }

  private assertAttached(): void {
    if (!this.context) {
      throw new Error('AudioLayer: not attached; call attach(context) first.');
    }
  }
}