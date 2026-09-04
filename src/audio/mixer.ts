/**
 * Era-aware crossfade mixer.
 *
 * Owns the native Web Audio graph for the timelapse: an ambient bed, a
 * traffic loop, a music loop and one-shot event layers. setEra(id)
 * crossfades every layer to the target era's synthesized buffers over a
 * bounded exponential ramp (~1.5 s) so transitions never click.
 *
 * Autoplay policy: the AudioContext stays suspended until the first user
 * gesture calls unlock(); the mute toggle always offers a hard exit.
 */
import { EraId, SFX_ERA_DATA } from '../eras';
import { EraAudioBuffers, SAMPLE_RATE, SampleBuffer, generateAllEraBuffers } from './sfx';
import { Scheduler } from './scheduler';

export interface SfxMixerOptions {
  /** Master output gain (0..1). */
  masterGain?: number;
  /** Crossfade duration in seconds. */
  fadeSeconds?: number;
  /** Seconds between ambient event one-shots. */
  eventInterval?: number;
}

interface Layer {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Current smoothed gain (0..1). */
  level: number;
  /** True while this layer is being faded out and can be stopped at 0. */
  retiring: boolean;
}

type LayerKind = 'ambient' | 'traffic' | 'music';

const DEFAULT_FADE_SECONDS = 1.5;
const TICK_SECONDS = 0.05;

export class SfxMixer {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly fadeSeconds: number;
  private readonly eventInterval: number;
  private readonly eraBuffers: Record<EraId, EraAudioBuffers>;
  private readonly playable: Partial<Record<EraId, PlayableEra>> = {};
  private readonly layers: Partial<Record<LayerKind, Layer[]>> = {};
  private readonly scheduler = new Scheduler(100);
  private readonly timerId: number | null = null;
  private currentEra: EraId = '1945';
  private unlocked = false;
  private muted = false;
  private eventStep = 0;
  private disposeUnregister: (() => void) | null = null;

  constructor(ctx: AudioContext, options: SfxMixerOptions = {}) {
    this.ctx = ctx;
    this.fadeSeconds = options.fadeSeconds ?? DEFAULT_FADE_SECONDS;
    this.eventInterval = options.eventInterval ?? 9;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = options.masterGain ?? 0.8;
    this.masterGain.connect(ctx.destination);
    this.eraBuffers = generateAllEraBuffers();
    this.layers.ambient = [];
    this.layers.traffic = [];
    this.layers.music = [];
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      this.timerId = window.setInterval(() => this.tick(), TICK_SECONDS * 1000);
    }
  }

  /** Must be called from a user gesture to satisfy browser autoplay policy. */
  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume();
    }
    // Start the current era's layers now that audio is allowed.
    this.startEraLayers(this.currentEra);
    this.scheduler.start();
    this.eventStep = 0;
  }

  /** Hard mute toggle; keeps the graph alive but silent. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.masterGain.gain.value = muted ? 0 : 0.8;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** True once the first user gesture has unlocked audio. */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  getEra(): EraId {
    return this.currentEra;
  }

  /**
   * Crossfade every layer to the target era. Idempotent; safe to call
   * before unlock() (layers start when audio is allowed).
   */
  setEra(id: EraId): void {
    if (id === this.currentEra) {
      return;
    }
    this.currentEra = id;
    if (this.unlocked) {
      this.startEraLayers(id);
    }
  }

  /** Fire a named event one-shot immediately (used for UI feedback too). */
  playEvent(kind: string, gain = 0.5): void {
    if (!this.unlocked || this.muted) {
      return;
    }
    const eraData = SFX_ERA_DATA[this.currentEra];
    const idx = eraData.events.findIndex((e) => e === kind);
    if (idx < 0) {
      return;
    }
    const playable = this.ensurePlayable(this.currentEra);
    const buffer = playable.events[idx];
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    const node = this.ctx.createGain();
    node.gain.value = gain;
    source.connect(node);
    node.connect(this.masterGain);
    source.start();
  }

  dispose(): void {
    if (this.timerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.timerId);
    }
    this.scheduler.dispose();
    if (this.disposeUnregister) {
      this.disposeUnregister();
      this.disposeUnregister = null;
    }
    for (const kind of ['ambient', 'traffic', 'music'] as LayerKind[]) {
      const layers = this.layers[kind];
      if (!layers) {
        continue;
      }
      for (const layer of layers) {
        this.stopLayer(layer);
      }
      layers.length = 0;
    }
    this.masterGain.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  private ensurePlayable(era: EraId): PlayableEra {
    const cached = this.playable[era];
    if (cached) {
      return cached;
    }
    const raw = this.eraBuffers[era];
    const ambient = this.toBuffer(raw.ambient);
    const traffic = this.toBuffer(raw.traffic);
    const music = raw.music ? this.toBuffer(raw.music) : null;
    const events = raw.events.map((e) => this.toBuffer(e));
    const playable: PlayableEra = { ambient, traffic, music, events };
    this.playable[era] = playable;
    return playable;
  }

  private toBuffer(data: SampleBuffer): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, data.length, SAMPLE_RATE);
    buffer.copyToChannel(Float32Array.from(data), 0);
    return buffer;
  }

  private startEraLayers(era: EraId): void {
    const playable = this.ensurePlayable(era);
    this.startLayer('ambient', playable.ambient, 1);
    this.startLayer('traffic', playable.traffic, 0.65);
    if (playable.music) {
      this.startLayer('music', playable.music, 0.5);
    } else {
      this.retireKind('music');
    }
    // Re-arm the event scheduler for this era.
    this.eventStep = 0;
    if (this.disposeUnregister) {
      this.disposeUnregister();
    }
    const kinds = SFX_ERA_DATA[era].events;
    const stepInterval = Math.max(1, Math.round((this.eventInterval / 0.14) / 4));
    const unregister = this.scheduler.onStep(() => {
      this.eventStep += 1;
      if (this.eventStep % stepInterval === 0) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        this.playEvent(kind, 0.4 + Math.random() * 0.3);
      }
    });
    this.disposeUnregister = unregister;
  }

  private startLayer(kind: LayerKind, buffer: AudioBuffer, target: number): void {
    this.retireKind(kind);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001; // start silent, ramp in
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    this.layers[kind]!.push({ source, gain, level: 0.0001, retiring: false });
    void target; // target handled by layerTarget() during tick smoothing
  }

  private retireKind(kind: LayerKind): void {
    const layers = this.layers[kind];
    if (!layers) {
      return;
    }
    for (const layer of layers) {
      layer.retiring = true;
    }
  }

  private stopLayer(layer: Layer): void {
    try {
      layer.source.stop();
    } catch {
      // Already stopped.
    }
    layer.gain.disconnect();
  }

  private tick(): void {
    if (!this.unlocked) {
      return;
    }
    const dt = TICK_SECONDS;
    const tau = this.fadeSeconds / 3;
    const k = Math.exp(-dt / tau);
    for (const kind of ['ambient', 'traffic', 'music'] as LayerKind[]) {
      const layers = this.layers[kind];
      if (!layers) {
        continue;
      }
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const target = layer.retiring ? 0.0001 : this.layerTarget(kind);
        layer.level += (target - layer.level) * (1 - k);
        layer.gain.gain.value = Math.max(0.0001, layer.level * (this.muted ? 0 : 1));
        if (layer.retiring && layer.level < 0.005) {
          this.stopLayer(layer);
          layers.splice(i, 1);
        }
      }
    }
  }

  private layerTarget(kind: LayerKind): number {
    switch (kind) {
      case 'ambient':
        return 1;
      case 'traffic':
        return 0.65;
      case 'music':
        return 0.5;
    }
  }
}

interface PlayableEra {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  music: AudioBuffer | null;
  events: AudioBuffer[];
}