/**
 * Era-aware crossfade mixer.
 *
 * Maintains a bus per layer (ambient bed, traffic loop, event one-shots,
 * music) and crossfades the *era-specific* buffer sources with exponential
 * gain ramps bounded to ~1.5 s so there are no clicks.
 *
 * Autoplay policy: the AudioContext is only created/resumed inside
 * `unlock()` (first user gesture). Until then the mixer is inert.
 */

import { SFX_ERA_DATA } from '../eras';
import type { EraId, SfxEraData, SfxEventType } from '../eras';
import type { EraAudioBuffers } from './sfx';
import { generateEraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume (0..1). */
  masterVolume?: number;
  /** Crossfade duration in seconds (default 1.5). */
  fadeSeconds?: number;
}

interface Layer {
  gain: GainNode;
  /** Current era-specific source, if playing. */
  source: { src: AudioBufferSourceNode; gain: GainNode } | null;
}

interface EventLayer {
  gain: GainNode;
  lastPlay: number;
}

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Lazily synthesized era buffers (LRU-capped). */
  private buffers: Partial<Record<EraId, EraAudioBuffers>> | null = null;
  /** Most-recently-used era order — oldest first. */
  private usedEras: EraId[] = [];
  private layers: Record<'ambient' | 'traffic' | 'music', Layer> | null = null;
  private eventLayer: EventLayer | null = null;
  /** Currently playing one-shot sources (stopped on dispose). */
  private sourcesToStop: AudioBufferSourceNode[] = [];
  private currentEra: EraId = '1945';
  private fadeSeconds: number;
  private masterVolume: number;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private disposed = false;

  constructor(options: SfxMixerOptions = {}) {
    this.masterVolume = options.masterVolume ?? 0.7;
    this.fadeSeconds = options.fadeSeconds ?? 1.5;
  }

  /** Create/resume the AudioContext from a user gesture. Safe to call often. */
  unlock(): void {
    if (this.disposed) return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.buffers = {};
      this.ensureEra(this.currentEra);
      this.buildLayers();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private buildLayers(): void {
    if (!this.ctx || !this.master || !this.buffers) return;
    const mkLayer = (): Layer => {
      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      gain.connect(this.master!);
      return { gain, source: null };
    };
    this.layers = { ambient: mkLayer(), traffic: mkLayer(), music: mkLayer() };
    this.eventLayer = { gain: this.ctx.createGain(), lastPlay: 0 };
    this.eventLayer.gain.gain.value = 1;
    this.eventLayer.gain.connect(this.master);
    this.startLoop('ambient');
    this.startLoop('traffic');
    this.startMusic();
    // Put the buses at the current era's mix levels so the loops are audible.
    this.openLayerGains(this.ctx.currentTime, 0.3);
  }

  private startLoop(layerName: 'ambient' | 'traffic'): void {
    if (!this.ctx || !this.layers) return;
    const eraBufs = this.ensureEra(this.currentEra);
    if (!eraBufs) return;
    const layer = this.layers[layerName];
    const buf = eraBufs[layerName];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(layer.gain);
    src.start();
    layer.source = { src, gain: g };
  }

  /** Get (synthesizing on first use) the buffer set for an era, LRU-capped. */
  private ensureEra(era: EraId): EraAudioBuffers | null {
    if (!this.ctx || !this.buffers) return null;
    let eraBufs = this.buffers[era];
    if (!eraBufs) {
      eraBufs = generateEraAudioBuffers(this.ctx, SFX_ERA_DATA[era]);
      this.buffers[era] = eraBufs;
    }
    this.usedEras = this.usedEras.filter((e) => e !== era);
    this.usedEras.push(era);
    this.trimEraBuffers();
    return eraBufs;
  }

  /** Keep at most 3 synthesized eras resident; never the currently playing one. */
  private trimEraBuffers(): void {
    if (!this.buffers || this.usedEras.length <= 3) return;
    while (this.usedEras.length > 3) {
      const drop = this.usedEras.shift();
      if (drop && drop !== this.currentEra) delete this.buffers[drop];
    }
  }

  /** Ramp every layer bus to the current era's mix gains — click-free. */
  private openLayerGains(t: number, duration: number): void {
    if (!this.ctx || !this.layers) return;
    const data = SFX_ERA_DATA[this.currentEra];
    const targets: Record<'ambient' | 'traffic' | 'music', number> = {
      ambient: data.ambient.gain,
      traffic: data.traffic.gain,
      music: data.music.gain,
    };
    for (const name of ['ambient', 'traffic', 'music'] as const) {
      const gain = this.layers[name].gain.gain;
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(Math.max(0.0001, gain.value), t);
      gain.exponentialRampToValueAtTime(Math.max(0.0001, targets[name]), t + duration);
    }
  }

  private startMusic(): void {
    if (!this.ctx || !this.layers) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.layers) return;
    const data = SFX_ERA_DATA[this.currentEra].music;
    const spb = 60 / data.tempo / 2; // 8th notes
    const lookahead = 0.18;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.playStep(this.nextNoteTime, data, this.step);
      this.nextNoteTime += spb;
      this.step++;
    }
  }

  private playStep(
    time: number,
    data: SfxEraData['music'],
    step: number,
  ): void {
    if (!this.ctx || !this.layers) return;
    const scale = data.scale;
    const root = data.root;
    const bar = Math.floor(step / 8) % 4;
    const stepInBar = step % 8;
    const layer = this.layers.music;

    const mkVoice = (type: OscillatorType, freq: number, dur: number, gain: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(g);
      g.connect(layer.gain);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    };

    // Bass: root on beats 0 and 4 of each bar.
    if (stepInBar === 0 || stepInBar === 4) {
      const midi = root - 12;
      mkVoice(data.bassWave, 440 * Math.pow(2, (midi - 69) / 12), 0.4, 0.5);
    }
    // Pad: sustained chord on bar starts.
    if (stepInBar === 0) {
      const chord = [0, 4, 7];
      for (const off of chord) {
        const midi = root + off;
        mkVoice(data.padWave, 440 * Math.pow(2, (midi - 69) / 12), 1.6, 0.22);
      }
    }
    // Lead: sparse melodic notes.
    if (stepInBar % 2 === 0 && (stepInBar === 0 || stepInBar === 2 || stepInBar === 6)) {
      const idx = (step + bar * 2) % scale.length;
      const midi = root + 12 + scale[idx];
      mkVoice(data.leadWave, 440 * Math.pow(2, (midi - 69) / 12), 0.5, 0.35);
    }
  }

  /** Crossfade all layers to the given era. */
  setEra(era: EraId): void {
    if (era === this.currentEra && this.ctx) return;
    this.currentEra = era;
    if (!this.ctx || !this.buffers || !this.layers) return;
    const eraBufs = this.ensureEra(era);
    if (!eraBufs) return;
    const t = this.ctx.currentTime;
    const fade = this.fadeSeconds;
    const swap = (layerName: 'ambient' | 'traffic') => {
      const layer = this.layers![layerName];
      const old = layer.source;
      if (old) {
        // ramp the *old* source's own gain down to silence, then stop it
        old.gain.gain.cancelScheduledValues(t);
        old.gain.gain.setValueAtTime(old.gain.gain.value, t);
        old.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        old.src.stop(t + fade + 0.1);
      }
      const buf = eraBufs[layerName];
      const src = this.ctx!.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + fade);
      src.connect(g);
      g.connect(layer.gain);
      src.start(t + 0.02);
      layer.source = { src, gain: g };
    };
    swap('ambient');
    swap('traffic');
    // Retune the music bus to the new era's level (micro fade).
    const musicGain = this.layers.music.gain.gain;
    const musicTarget = Math.max(0.0001, SFX_ERA_DATA[era].music.gain);
    musicGain.cancelScheduledValues(t);
    musicGain.setValueAtTime(Math.max(0.0001, musicGain.value), t);
    musicGain.exponentialRampToValueAtTime(musicTarget, t + 0.25);
    // Ambient / traffic buses follow the era's mix gains over the same ramp.
    this.openLayerGains(t, fade);
  }

  /** Fire a one-shot ambience event if its era supports it. */
  playEvent(type: SfxEventType): void {
    if (!this.ctx || !this.buffers || !this.layers || !this.eventLayer) return;
    const eraBufs = this.ensureEra(this.currentEra);
    const buf = eraBufs?.events[type];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.eventLayer.gain);
    this.sourcesToStop.push(src);
    const t = this.ctx.currentTime;
    src.start(t);
    src.stop(t + buf.duration + 0.05);
  }

  /** Chance-based spontaneous event scheduler; call from the update loop. */
  updateSpontaneousEvents(): void {
    if (!this.ctx || !this.eventLayer) return;
    const data = SFX_ERA_DATA[this.currentEra].events;
    const now = performance.now() / 1000;
    if (now - this.eventLayer.lastPlay < data.interval) return;
    const r = Math.random();
    let acc = 0;
    let chosen: SfxEventType | null = null;
    for (let i = 0; i < data.types.length; i++) {
      acc += data.weights[i];
      if (r <= acc) {
        chosen = data.types[i];
        break;
      }
    }
    if (chosen) {
      this.playEvent(chosen);
      this.eventLayer.lastPlay = now;
    }
  }

  setMuted(muted: boolean): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.exponentialRampToValueAtTime(
      muted ? 0.0001 : Math.max(0.0001, this.masterVolume),
      t + 0.15,
    );
  }

  dispose(): void {
    this.disposed = true;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx) {
      for (const src of this.sourcesToStop) {
        try {
          src.stop();
        } catch {
          // already stopped
        }
      }
      this.sourcesToStop.length = 0;
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.master = null;
    this.layers = null;
    this.eventLayer = null;
    this.buffers = null;
    this.usedEras = [];
  }
}