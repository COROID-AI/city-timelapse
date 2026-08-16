// ─── Era-Aware Crossfade Mixer ────────────────────────────────────────
// SfxMixer manages era changes with click-free GainNode crossfades.
// All layers: ambient bed, traffic loop, event one-shots, music.

import type { EraId } from '../eras.js';
import type { EraAudioBuffers } from './sfx.js';

/** Configuration options for the SFX mixer */
export interface SfxMixerOptions {
  /** Master volume (0 → 1) */
  masterVolume?: number;
  /** Ambient layer volume (0 → 1) */
  ambientVolume?: number;
  /** Traffic layer volume (0 → 1) */
  trafficVolume?: number;
  /** Event layer volume (0 → 1) */
  eventsVolume?: number;
  /** Music layer volume (0 → 1) */
  musicVolume?: number;
}

const DEFAULT_OPTIONS: Required<SfxMixerOptions> = {
  masterVolume: 0.8,
  ambientVolume: 0.7,
  trafficVolume: 0.6,
  eventsVolume: 0.8,
  musicVolume: 0.5,
};

const CROSSFADE_DURATION = 1.5; // seconds — bounded ~1.5s window

/** Internal layer state for tracking active sources */
interface LayerState {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  buffer: AudioBuffer | null;
}

/**
 * Era-aware procedural SFX mixer.
 *
 * Manages four layers (ambient, traffic, events, music) and performs
 * click-free crossfades between eras using exponential GainNode ramps.
 *
 * AudioContext is lazily initialized on first user gesture to comply
 * with autoplay policies. Call `init()` or call `setEra()` after a
 * user gesture to start playback.
 */
export class SfxMixer {
  private ctx: AudioContext | null = null;
  private ready = false;

  /** Master output gain */
  private masterGain!: GainNode;

  /** Per-layer states */
  private ambientLayer!: LayerState;
  private trafficLayer!: LayerState;
  private eventsLayer!: LayerState;
  private musicLayer!: LayerState;

  /** Currently playing era id */
  private currentEra: EraId | null = null;

  /** Buffers for all eras (populated by caller via setAllBuffers) */
  private allBuffers: Record<EraId, EraAudioBuffers> | null = null;

  /** Whether we have been initialized (AudioContext created) */
  private _initialized = false;

  /** Whether audio is muted */
  private _muted = false;

  private opts: Required<SfxMixerOptions>;

  constructor(options: SfxMixerOptions = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    // Nodes are created lazily on init()
  }

  /** Create a layer with gain node (must be called from within init()) */
  private createLayer(volume: number): LayerState {
    const gain = this.ctx!.createGain();
    gain.gain.value = volume;
    return { source: null, gain, buffer: null };
  }

  // ── Lazy initialization ────────────────────────────────────────────

  /**
   * Initialize the AudioContext. Must be called from a user gesture
   * handler (click, keydown, touchstart) to comply with autoplay policy.
   */
  async init(): Promise<void> {
    if (this._initialized && this.ctx) return;
    this.ctx = new AudioContext();
    await this.ctx.resume();

    // Create master chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.opts.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // Create per-layer chains
    this.ambientLayer = this.createLayer(this.opts.ambientVolume);
    this.trafficLayer = this.createLayer(this.opts.trafficVolume);
    this.eventsLayer = this.createLayer(this.opts.eventsVolume);
    this.musicLayer = this.createLayer(this.opts.musicVolume);

    this._initialized = true;
    this.ready = true;
  }

  /**
   * Auto-init on first interaction. Call this once at app boot; it will
   * register a one-shot listener that calls init() on any pointerdown /
   * keydown event.
   */
  autoInitOnGesture(): void {
    if (this._initialized) return;
    const handler = () => {
      this.init().catch(() => {});
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
  }

  /** Check if the AudioContext is ready */
  get isReady(): boolean {
    return this.ready;
  }

  // ── Buffer management ──────────────────────────────────────────────

  /**
   * Provide pre-generated buffers for all eras.
   * Typically called once after generateAllEraBuffers(ctx).
   */
  setAllBuffers(buffers: Record<EraId, EraAudioBuffers>): void {
    this.allBuffers = buffers;
  }

  /** Get the current era's buffers */
  private getCurrentBuffers(): EraAudioBuffers | null {
    if (!this.currentEra || !this.allBuffers) return null;
    return this.allBuffers[this.currentEra];
  }

  // ── Layer source management ────────────────────────────────────────

  /** Stop and disconnect an existing source in a layer */
  private stopLayer(layer: LayerState): void {
    if (layer.source) {
      try {
        layer.source.stop();
      } catch { /* already stopped */ }
      layer.source.disconnect();
      layer.source = null;
    }
  }

  /** Start a looping source from a buffer on a layer */
  private startLoop(layer: LayerState, buffer: AudioBuffer): void {
    if (!this.ctx) return;
    this.stopLayer(layer);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(layer.gain);
    layer.buffer = buffer;
    layer.source = source;
    source.start();
  }

  /** Play a one-shot event from a buffer on the events layer */
  private playOneShot(_name: string, buffer: AudioBuffer): void {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.eventsLayer.gain);
    source.start();
  }

  // ── Crossfade logic ────────────────────────────────────────────────

  /**
   * Crossfade all layers from old era to new era.
   * Uses exponential gain ramps over CROSSFADE_DURATION (~1.5s) for
   * click-free transitions. Non-zero floor prevents audible gaps.
   */
  private crossfadeTo(_newEra: EraId): void {
    if (!this.ctx || !this.allBuffers) return;

    const fadeTime = CROSSFADE_DURATION;
    const now = this.ctx.currentTime;

    // Ramp down all layers simultaneously
    const layers = [
      this.ambientLayer,
      this.trafficLayer,
      this.eventsLayer,
      this.musicLayer,
    ];

    for (const layer of layers) {
      const oldGain = layer.gain.gain.value;
      layer.gain.gain.setValueAtTime(oldGain, now);
      layer.gain.gain.exponentialRampToValueAtTime(0.001, now + fadeTime);
    }

    // After fade-out completes, swap buffers and ramp up
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;

      const newBuffers = this.getCurrentBuffers();
      if (!newBuffers) return;

      // Update each layer
      this.startLoop(this.ambientLayer, newBuffers.ambient);
      this.startLoop(this.trafficLayer, newBuffers.traffic);

      // Ramp up all gains simultaneously
      for (const layer of layers) {
        layer.gain.gain.cancelScheduledValues(t2);
        layer.gain.gain.setValueAtTime(0.001, t2);
        // Read the target volume from our stored options
        let targetVol = 0.001;
        if (layer === this.ambientLayer) targetVol = this.opts.ambientVolume;
        else if (layer === this.trafficLayer) targetVol = this.opts.trafficVolume;
        else if (layer === this.eventsLayer) targetVol = this.opts.eventsVolume;
        else if (layer === this.musicLayer) targetVol = this.opts.musicVolume;
        layer.gain.gain.exponentialRampToValueAtTime(targetVol, t2 + 0.1);
      }

      // Trigger era-specific events
      for (const name of Object.keys(newBuffers.events)) {
        this.playOneShot(name, newBuffers.events[name]);
      }
    }, fadeTime * 1000);
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Switch to a new era. Performs click-free crossfade across all layers.
   * If not yet initialized, auto-initializes from user gesture context.
   */
  async setEra(id: EraId): Promise<void> {
    // Ensure audio context is ready
    if (!this._initialized) {
      await this.init();
    }

    const prevEra = this.currentEra;
    this.currentEra = id;

    if (prevEra && prevEra !== id && this.allBuffers) {
      this.crossfadeTo(id);
    } else if (this.allBuffers) {
      // First era set — just start playing
      const buffers = this.allBuffers[id];
      if (buffers) {
        this.startLoop(this.ambientLayer, buffers.ambient);
        this.startLoop(this.trafficLayer, buffers.traffic);
        for (const name of Object.keys(buffers.events)) {
          this.playOneShot(name, buffers.events[name]);
        }
      }
    }
  }

  /** Whether audio is currently muted */
  get muted(): boolean {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v ? 0 : this.opts.masterVolume, this.ctx.currentTime);
    }
  }

  /** Toggle mute state and return new state */
  setMuted(mute: boolean): void {
    this.muted = mute;
  }

  setVolumes(volumes: Partial<SfxMixerOptions>): void {
    const o = { ...this.opts, ...volumes };
    if (this.masterGain) {
      this.masterGain.gain.value = o.masterVolume;
    }
    this.ambientLayer.gain.gain.value = o.ambientVolume;
    this.trafficLayer.gain.gain.value = o.trafficVolume;
    this.eventsLayer.gain.gain.value = o.eventsVolume;
    this.musicLayer.gain.gain.value = o.musicVolume;
  }

  /**
   * Full cleanup: stop all sources, disconnect all nodes, release resources.
   */
  dispose(): void {
    // Stop all layers
    for (const layer of [this.ambientLayer, this.trafficLayer, this.eventsLayer, this.musicLayer]) {
      this.stopLayer(layer);
    }

    // Disconnect all gains
    for (const layer of [this.ambientLayer, this.trafficLayer, this.eventsLayer, this.musicLayer]) {
      layer.gain.disconnect();
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
    }

    // Close the context if it exists
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }

    this.currentEra = null;
    this.allBuffers = null;
    this._initialized = false;
    this.ready = false;
  }
}
