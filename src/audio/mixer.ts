// Era-aware crossfade mixer. Owns AudioNodes for every era's beds and
// smooths the transition between eras with an exponential gain ramp
// (~1.5s window, click-free). Audio only starts after a user gesture.

import type { EraId, SfxEventKind } from '../eras';
import { ERA_IDS } from '../eras';
import type { EraAudioBuffers } from './sfx';
import { generateAllEraBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume (0..1). */
  volume?: number;
  /** Called on first successful audio init (inside a user gesture). */
  onReady?: () => void;
}

const CROSSFADE_SECONDS = 1.5;

interface EraVoice {
  ambientGain: GainNode;
  trafficGain: GainNode;
  musicGain: GainNode;
}

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: { ambient: GainNode; traffic: GainNode; music: GainNode } | null = null;

  private voices = new Map<EraId, EraVoice>();
  private buffers: Record<EraId, EraAudioBuffers> | null = null;

  private currentEra: EraId;
  private currentVolume: number;
  private ready = false;
  private muted = false;

  /** Per-era one-shot event scheduler state. */
  private eventState = new Map<EraId, { nextEventAt: number }>();

  private onReady?: () => void;

  constructor(options: SfxMixerOptions = {}) {
    this.currentEra = ERA_IDS[0];
    this.currentVolume = options.volume ?? 1;
    this.onReady = options.onReady;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get currentEraId(): EraId {
    return this.currentEra;
  }

  /** Call from a user gesture (pointerdown / keydown) to start audio. */
  init(): void {
    if (this.ready) return;
    const Ctor: typeof AudioContext | undefined = window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.currentVolume;
    this.master.connect(this.ctx.destination);

    this.buses = {
      ambient: this.makeBus(this.ctx, this.master, 1),
      traffic: this.makeBus(this.ctx, this.master, 1),
      music: this.makeBus(this.ctx, this.master, 1),
    };

    this.buffers = generateAllEraBuffers(this.ctx);

    for (const id of ERA_IDS) {
      const sets = this.buffers[id];
      this.voices.set(id, this.voiceFor(id, sets));
    }

    // Start the current era at full gain; everything else silent.
    this.applyCrossfade(this.currentEra, this.ctx.currentTime);
    this.ready = true;
    this.onReady?.();
  }

  private makeBus(ctx: AudioContext, dest: AudioNode, gain: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(dest);
    return g;
  }

  private voiceFor(_id: EraId, sets: EraAudioBuffers): EraVoice {
    if (!this.ctx || !this.buses) throw new Error('Mixer not initialized');
    const ctx = this.ctx;
    const voice: EraVoice = {
      ambientGain: ctx.createGain(),
      trafficGain: ctx.createGain(),
      musicGain: ctx.createGain(),
    };
    voice.ambientGain.gain.value = 0;
    voice.trafficGain.gain.value = 0;
    voice.musicGain.gain.value = 0;
    voice.ambientGain.connect(this.buses.ambient);
    voice.trafficGain.connect(this.buses.traffic);
    voice.musicGain.connect(this.buses.music);

    const srcAmbient = ctx.createBufferSource();
    srcAmbient.buffer = sets.ambient;
    srcAmbient.loop = true;
    srcAmbient.connect(voice.ambientGain);
    srcAmbient.start();

    const srcTraffic = ctx.createBufferSource();
    srcTraffic.buffer = sets.traffic;
    srcTraffic.loop = true;
    srcTraffic.connect(voice.trafficGain);
    srcTraffic.start();

    const srcMusic = ctx.createBufferSource();
    srcMusic.buffer = sets.music;
    srcMusic.loop = true;
    srcMusic.connect(voice.musicGain);
    srcMusic.start();

    this.eventState.set(_id, { nextEventAt: ctx.currentTime + 1 + Math.random() * 3 });
    return voice;
  }

  private applyCrossfade(target: EraId, when: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const start = Math.max(when, now);
    for (const [id, voice] of this.voices) {
      const active = id === target;
      this.rampTo(voice.ambientGain.gain, active ? 1 : 0, start);
      this.rampTo(voice.trafficGain.gain, active ? 1 : 0, start);
      this.rampTo(voice.musicGain.gain, active ? 1 : 0, start);
    }
    this.eventState.set(target, { nextEventAt: now + 1.5 + Math.random() * 2 });
  }

  private rampTo(param: AudioParam, target: number, start: number): void {
    const current = param.value;
    if (Math.abs(current - target) < 0.001) {
      param.setValueAtTime(target, start);
      return;
    }
    param.cancelScheduledValues(start);
    param.setValueAtTime(current, start);
    if (target > 0) {
      param.exponentialRampToValueAtTime(Math.max(target, 0.0001), start + CROSSFADE_SECONDS);
    } else {
      param.linearRampToValueAtTime(0, start + CROSSFADE_SECONDS);
    }
  }

  /** Switch the active era; crossfades all layers over ~1.5s. */
  setEra(id: EraId): void {
    this.currentEra = id;
    if (this.ready && this.ctx) {
      this.applyCrossfade(id, this.ctx.currentTime);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      const target = muted ? 0 : this.currentVolume;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(target, now + 0.15);
    }
  }

  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.master && !this.muted) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.currentVolume, now + 0.2);
    }
  }

  /** Fire a one-shot event when the era's scheduler says so. */
  update(delta: number): void {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    void delta;
    const st = this.eventState.get(this.currentEra);
    if (!st) return;
    if (now >= st.nextEventAt) {
      this.fireEvent(this.currentEra, now);
      st.nextEventAt = now + 2 + Math.random() * 6;
    }
  }

  private fireEvent(id: EraId, at: number): void {
    if (!this.ctx || !this.buffers) return;
    const sets = this.buffers[id];
    const kinds = Object.keys(sets.events) as SfxEventKind[];
    if (kinds.length === 0) return;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const buffer = sets.events[kind];
    if (!buffer || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    g.connect(this.buses ? this.buses.ambient : (this.master ?? this.ctx.destination));
    src.connect(g);
    src.start(at);
    src.onended = () => {
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        // already disconnected
      }
    };
  }

  dispose(): void {
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        // ignore
      }
    }
    this.ctx = null;
    this.master = null;
    this.buses = null;
    this.voices.clear();
    this.buffers = null;
    this.ready = false;
  }
}