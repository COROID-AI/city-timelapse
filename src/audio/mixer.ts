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
import { generateAllEraBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume (0..1). */
  masterVolume?: number;
  /** Crossfade duration in seconds (default 1.5). */
  fadeSeconds?: number;
}

interface Layer {
  gain: GainNode;
  /** Current era-specific source, if playing. */
  source: AudioBufferSourceNode | null;
}

interface EventLayer {
  gain: GainNode;
  lastPlay: number;
}

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Record<EraId, EraAudioBuffers> | null = null;
  private layers: Record<'ambient' | 'traffic' | 'music', Layer> | null = null;
  private eventLayer: EventLayer | null = null;
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
      this.buffers = generateAllEraBuffers(this.ctx);
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
  }

  private startLoop(layerName: 'ambient' | 'traffic'): void {
    if (!this.ctx || !this.buffers || !this.layers) return;
    const layer = this.layers[layerName];
    const buf = this.buffers[this.currentEra][layerName];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(layer.gain);
    src.start();
    layer.source = src;
  }

  private startMusic(): void {
    if (!this.ctx || !this.layers) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.layers || !this.buffers) return;
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
    this.currentEra = era;
    if (!this.ctx || !this.buffers || !this.layers) return;
    const t = this.ctx.currentTime;
    const fade = this.fadeSeconds;
    const swap = (layerName: 'ambient' | 'traffic') => {
      const layer = this.layers![layerName];
      const old = layer.source;
      if (old) {
        old.stop(t + fade + 0.05);
      }
      const buf = this.buffers![era][layerName];
      const src = this.ctx!.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(layer.gain);
      src.start(t + 0.02);
      layer.source = src;
      // Reset the layer gain to 0 then ramp up (avoids clicks on swap).
      layer.gain.gain.cancelScheduledValues(t);
      layer.gain.gain.setValueAtTime(0, t);
      layer.gain.gain.exponentialRampToValueAtTime(1, t + fade);
    };
    swap('ambient');
    swap('traffic');
    // Music: retune by scheduling a micro fade of the music bus.
    this.layers.music.gain.gain.cancelScheduledValues(t);
    this.layers.music.gain.gain.setValueAtTime(
      Math.max(0.0001, this.layers.music.gain.gain.value),
      t,
    );
    this.layers.music.gain.gain.exponentialRampToValueAtTime(1, t + 0.25);
  }

  /** Fire a one-shot ambience event if its era supports it. */
  playEvent(type: SfxEventType): void {
    if (!this.ctx || !this.buffers || !this.layers || !this.eventLayer) return;
    const buf = this.buffers[this.currentEra].events[type];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.eventLayer.gain);
    const t = this.ctx.currentTime;
    src.start(t);
    src.stop(t + buf.duration + 0.05);
  }

  /** Chance-based spontaneous event scheduler; call from the update loop. */
  updateSpontaneousEvents(): void {
    if (!this.ctx || !this.eventLayer || !this.buffers) return;
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
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.master = null;
    this.layers = null;
    this.eventLayer = null;
    this.buffers = null;
  }
}