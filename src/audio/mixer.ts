import { ERA_IDS, SFX_ERA_DATA, type EraId } from '../eras';
import { generateAllEraBuffers, type EraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  initialEra?: EraId;
  crossfadeSeconds?: number;
  reducedMotion?: boolean;
}

interface LayerNodes {
  ambient: AudioBufferSourceNode;
  traffic: AudioBufferSourceNode;
  music: OscillatorNode;
  gain: GainNode;
}

const AudioContextConstructor = (): typeof AudioContext | undefined => {
  const windowWithWebkit = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return windowWithWebkit.AudioContext ?? windowWithWebkit.webkitAudioContext;
};

/** A gesture-activated, era-aware Web Audio mixer with click-free layer fades. */
export class SfxMixer {
  private readonly initialEra: EraId;
  private readonly crossfadeSeconds: number;
  private readonly reducedMotion: boolean;
  private context?: AudioContext;
  private master?: GainNode;
  private buffers?: Record<EraId, EraAudioBuffers>;
  private active?: LayerNodes;
  private era: EraId;
  private enabled = false;
  private disposed = false;
  private eventTimer?: number;
  private fadeTimers = new Set<number>();
  private eventSources = new Set<AudioBufferSourceNode>();

  constructor(options: SfxMixerOptions = {}) {
    this.initialEra = options.initialEra ?? ERA_IDS[0];
    this.crossfadeSeconds = Math.max(0.12, options.crossfadeSeconds ?? 1.5);
    this.reducedMotion = options.reducedMotion ?? false;
    this.era = this.initialEra;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentEra(): EraId {
    return this.era;
  }

  get isTransitioning(): boolean {
    return this.fadeTimers.size > 0;
  }

  /** Call from a click/tap/keydown handler; browsers then permit AudioContext resume. */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (this.disposed) return false;
    if (!enabled) {
      this.enabled = false;
      this.master?.gain.setTargetAtTime(0.0001, this.context?.currentTime ?? 0, 0.04);
      return true;
    }
    const ready = await this.ensureContext();
    if (!ready || !this.context || !this.master) return false;
    try {
      await this.context.resume();
      this.enabled = true;
      this.master.gain.setTargetAtTime(0.7, this.context.currentTime, 0.04);
      if (!this.active) this.startEra(this.era, 0);
      return true;
    } catch {
      return false;
    }
  }

  setEra(id: EraId): void {
    if (this.disposed) return;
    if (id === this.era && this.active) return;
    this.era = id;
    if (!this.enabled || !this.context) return;
    this.startEra(id, this.reducedMotion ? 0.08 : this.crossfadeSeconds);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.eventTimer !== undefined) window.clearTimeout(this.eventTimer);
    this.fadeTimers.forEach((timer) => window.clearTimeout(timer));
    this.fadeTimers.clear();
    this.active?.ambient.stop();
    this.active?.traffic.stop();
    this.active?.music.stop();
    this.eventSources.forEach((source) => {
      try { source.stop(); } catch { /* source already ended */ }
    });
    this.eventSources.clear();
    this.context?.close().catch(() => undefined);
    this.active = undefined;
  }

  private async ensureContext(): Promise<boolean> {
    if (this.context) return true;
    const Constructor = AudioContextConstructor();
    if (!Constructor) return false;
    try {
      this.context = new Constructor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.context.destination);
      this.buffers = generateAllEraBuffers(this.context, SFX_ERA_DATA);
      return true;
    } catch {
      this.context = undefined;
      this.master = undefined;
      return false;
    }
  }

  private startEra(id: EraId, fadeSeconds: number): void {
    if (!this.context || !this.master || !this.buffers) return;
    const previous = this.active;
    const next = this.createLayers(this.buffers[id], id);
    const now = this.context.currentTime;
    const duration = Math.max(0.05, fadeSeconds);
    next.gain.gain.setValueAtTime(0.0001, now);
    next.gain.gain.exponentialRampToValueAtTime(1, now + duration);
    previous?.gain.gain.cancelScheduledValues(now);
    if (previous) {
      previous.gain.gain.setValueAtTime(Math.max(0.0001, previous.gain.gain.value), now);
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      const timer = window.setTimeout(() => {
        this.fadeTimers.delete(timer);
        try {
          previous.ambient.stop();
          previous.traffic.stop();
          previous.music.stop();
        } catch {
          // A source may already have ended during a rapid scrub.
        }
      }, duration * 1000 + 40);
      this.fadeTimers.add(timer);
    }
    this.active = next;
    this.scheduleEvent(id);
  }

  private createLayers(buffers: EraAudioBuffers, id: EraId): LayerNodes {
    const context = this.context as AudioContext;
    const gain = context.createGain();
    gain.connect(this.master as GainNode);
    const ambient = context.createBufferSource();
    ambient.buffer = buffers.ambient;
    ambient.loop = true;
    ambient.connect(gain);
    ambient.start();
    const traffic = context.createBufferSource();
    traffic.buffer = buffers.traffic;
    traffic.loop = true;
    traffic.connect(gain);
    traffic.start();
    const music = context.createOscillator();
    music.type = id === '1945' ? 'triangle' : id === '2055' ? 'sine' : 'sawtooth';
    music.frequency.value = SFX_ERA_DATA[id].musicNotes[0];
    music.connect(gain);
    music.start();
    return { ambient, traffic, music, gain };
  }

  private scheduleEvent(id: EraId): void {
    if (this.eventTimer !== undefined) window.clearTimeout(this.eventTimer);
    if (!this.enabled || !this.context || !this.buffers) return;
    const delay = 4600 + Math.random() * 3200;
    this.eventTimer = window.setTimeout(() => {
      this.eventTimer = undefined;
      if (this.disposed || !this.context || !this.enabled || !this.buffers || this.era !== id) return;
      const events = this.buffers[id].events;
      const source = this.context.createBufferSource();
      this.eventSources.add(source);
      source.addEventListener('ended', () => this.eventSources.delete(source), { once: true });
      source.buffer = events[Math.floor(Math.random() * events.length)];
      const gain = this.context.createGain();
      gain.gain.value = 0.18;
      source.connect(gain).connect(this.master as GainNode);
      source.start();
      this.scheduleEvent(id);
    }, delay);
  }
}
