// Era-aware crossfade mixer. Owns AudioNodes for every era's beds and
// smooths the transition between eras with an exponential gain ramp
// (~1.5s window, click-free). Audio only starts after a user gesture.
//
// Buffers are generated lazily: only the first era's beds are synthesized
// on first gesture, and the remaining eras are generated incrementally
// across idle frames so the initial user interaction is never janked.
// Only the active era's sources are running; others are created when
// their era becomes active.

import type { EraId, SfxEventKind } from '../eras';
import { ERA_IDS, SFX_ERA_DATA } from '../eras';
import type { EraAudioBuffers } from './sfx';
import { generateEraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume (0..1). */
  volume?: number;
  /** Called on first successful audio init (inside a user gesture). */
  onReady?: () => void;
  /** Max milliseconds of buffer synthesis per idle tick (default 14). */
  lazyBudgetPerTickMs?: number;
}

const CROSSFADE_SECONDS = 1.5;
const DEFAULT_LAZY_BUDGET_MS = 14;

interface EraVoice {
  ambientGain: GainNode;
  trafficGain: GainNode;
  musicGain: GainNode;
  sources: { ambient: AudioBufferSourceNode; traffic: AudioBufferSourceNode; music: AudioBufferSourceNode } | null;
}

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: { ambient: GainNode; traffic: GainNode; music: GainNode } | null = null;

  private voices = new Map<EraId, EraVoice>();
  private buffers: Partial<Record<EraId, EraAudioBuffers>> = {};

  private currentEra: EraId;
  private currentVolume: number;
  private ready = false;
  private muted = false;

  /** Per-era one-shot event scheduler state. */
  private eventState = new Map<EraId, { nextEventAt: number }>();

  private pendingEras: EraId[] = [];
  private lazyBudgetMs: number;

  private onReady?: () => void;

  constructor(options: SfxMixerOptions = {}) {
    this.currentEra = ERA_IDS[0];
    this.currentVolume = options.volume ?? 1;
    this.onReady = options.onReady;
    this.lazyBudgetMs = options.lazyBudgetPerTickMs ?? DEFAULT_LAZY_BUDGET_MS;
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
    if (this.ready || this.ctx) return;
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

    // Synthesize only the initial era now; the rest lazily in update().
    for (const id of ERA_IDS) {
      this.voices.set(id, this.makeVoice(id));
    }
    this.pendingEras = ERA_IDS.filter((id) => id !== this.currentEra);
    this.ensureEraBuffers(this.currentEra);
    this.activateVoice(this.currentEra);

    this.ready = true;
    this.onReady?.();
  }

  private makeBus(ctx: AudioContext, dest: AudioNode, gain: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(dest);
    return g;
  }

  private makeVoice(id: EraId): EraVoice {
    if (!this.ctx || !this.buses) throw new Error('Mixer not initialized');
    const ctx = this.ctx;
    const voice: EraVoice = {
      ambientGain: ctx.createGain(),
      trafficGain: ctx.createGain(),
      musicGain: ctx.createGain(),
      sources: null,
    };
    voice.ambientGain.gain.value = 0;
    voice.trafficGain.gain.value = 0;
    voice.musicGain.gain.value = 0;
    voice.ambientGain.connect(this.buses.ambient);
    voice.trafficGain.connect(this.buses.traffic);
    voice.musicGain.connect(this.buses.music);
    this.eventState.set(id, { nextEventAt: ctx.currentTime + 1 + Math.random() * 2 });
    return voice;
  }

  private ensureEraBuffers(id: EraId): void {
    if (!this.ctx) return;
    if (this.buffers[id]) return;
    this.buffers[id] = generateEraAudioBuffers(
      this.ctx,
      SFX_ERA_DATA[id],
    );
  }

  private startVoiceSources(id: EraId): void {
    if (!this.ctx || !this.buses) return;
    const voice = this.voices.get(id);
    const sets = this.buffers[id];
    if (!voice || !sets || voice.sources) return;
    const ctx = this.ctx;
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
    voice.sources = { ambient: srcAmbient, traffic: srcTraffic, music: srcMusic };
  }

  /** Start sources for the active era at full gain; others at zero. */
  private activateVoice(id: EraId, previous?: EraId): void {
    if (!this.ctx) return;
    this.ensureEraBuffers(id);
    this.startVoiceSources(id);
    this.applyCrossfade(id, this.ctx.currentTime, previous);
    this.eventState.set(id, { nextEventAt: this.ctx.currentTime + 1.5 + Math.random() * 2 });
  }

  private applyCrossfade(target: EraId, when: number, previous?: EraId): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const start = Math.max(when, now);
    // Schedule cleanup of the previously active era's sources after the
    // crossfade completes so we don't run muted looping sources forever.
    if (previous && previous !== target) {
      const stopAt = start + CROSSFADE_SECONDS + 0.15;
      const prevVoice = this.voices.get(previous);
      if (prevVoice && prevVoice.sources) {
        const srcs = prevVoice.sources;
        for (const s of [srcs.ambient, srcs.traffic, srcs.music]) {
          try {
            s.stop(stopAt);
          } catch {
            // already stopped
          }
        }
        prevVoice.sources = null;
      }
    }
    for (const [id, voice] of this.voices) {
      const active = id === target;
      this.rampTo(voice.ambientGain.gain, active ? 1 : 0, start);
      this.rampTo(voice.trafficGain.gain, active ? 1 : 0, start);
      this.rampTo(voice.musicGain.gain, active ? 1 : 0, start);
    }
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
    const previous = this.currentEra;
    this.currentEra = id;
    if (this.ready && this.ctx) {
      this.activateVoice(id, previous);
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

  /** Idle-phase lazy buffer generation + one-shot event scheduler. */
  update(delta: number): void {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    void delta;

    // Generate remaining era buffers within a small per-tick budget.
    if (this.pendingEras.length > 0) {
      const deadline = performance.now() + this.lazyBudgetMs;
      while (this.pendingEras.length > 0) {
        const id = this.pendingEras[this.pendingEras.length - 1];
        this.ensureEraBuffers(id);
        this.pendingEras.pop();
        if (performance.now() > deadline) break;
      }
    }

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
    if (!sets) return;
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
    this.buffers = {};
    this.pendingEras = [];
    this.ready = false;
  }
}

