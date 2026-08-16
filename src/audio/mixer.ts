/**
 * SfxMixer — era-aware crossfade audio engine for the City Timelapse project.
 *
 * Owns four playback layers (ambient bed, traffic loop, event one-shots, music).
 * Buffers are generated lazily per era via generateAllEraBuffers from src/audio/sfx.ts.
 * Crossfades use exponential gain ramps bounded to ~1.5 s with a short linear
 * pre-ramp for click-free transitions.
 */

import type { EraId } from '../eras.ts';
import { ERA_IDS, SFX_ERA_DATA } from '../eras.ts';
import type { EraData } from '../eras.ts';
import { generateAllEraBuffers } from './sfx.ts';

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

/** Callback invoked during lazy buffer generation to report progress. */
export type OnProgressCallback = (progress: number) => void;

/** Options for constructing an SfxMixer instance. */
export interface SfxMixerOptions {
  /** Sample rate for generated buffers (default: 44100). */
  sampleRate?: number;
  /** Duration in seconds for continuous bed buffers (default: 6). */
  durationSec?: number;
  /** Called with 0→1 progress while a new era's buffers are being generated. */
  onProgress?: OnProgressCallback;
}

// Internal: cached AudioBuffers for a single era.
interface CachedEraBuffers {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  events: AudioBuffer[];
  music: AudioBuffer;
}

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_DURATION_SEC = 6;
const CROSSFADE_DURATION = 1.5; // seconds
const PRE_RAMP_FRAC = 0.15; // fraction of crossfade used for linear pre-ramp
const EVENTS_PER_SECOND_BASE = 0.3; // base rate for stochastic event scheduling

// ──────────────────────────────────────────────────────────────────────
// Helper: click-free exponential ramp with linear pre-ramp
// ──────────────────────────────────────────────────────────────────────

/**
 * Schedule an exponential gain ramp from → to over `durationSec`,
 * preceded by a short linear pre-ramp segment to prevent clicks.
 */
function scheduleExponentialRamp(
  ctx: AudioContext,
  param: AudioParam,
  fromValue: number,
  toValue: number,
  durationSec: number,
): void {
  const now = ctx.currentTime;
  const preRampDur = durationSec * PRE_RAMP_FRAC;
  const expRampDur = durationSec - preRampDur;

  if (preRampDur > 0 && fromValue !== toValue) {
    // Linear pre-ramp: move from `fromValue` toward `toValue` by a small amount
    const preTarget = fromValue + (toValue - fromValue) * 0.3;
    param.setValueAtTime(fromValue, now);
    param.linearRampToValueAtTime(preTarget, now + preRampDur);
    // Exponential main ramp: rest of the way
    if (preTarget > 0 && toValue > 0) {
      param.exponentialRampToValueAtTime(
        Math.max(toValue, 0.0001),
        now + preRampDur + expRampDur,
      );
    } else {
      param.linearRampToValueAtTime(toValue, now + preRampDur + expRampDur);
    }
  } else {
    // No pre-ramp needed; direct exponential
    param.setValueAtTime(fromValue, now);
    if (toValue > 0) {
      param.exponentialRampToValueAtTime(
        Math.max(toValue, 0.0001),
        now + durationSec,
      );
    } else {
      param.linearRampToValueAtTime(0, now + durationSec);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Helper: create a looping AudioBufferSourceNode from Float32Array data
// ──────────────────────────────────────────────────────────────────────

function createLoopSource(
  ctx: AudioContext,
  data: Float32Array,
  sampleRate: number,
): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

// ──────────────────────────────────────────────────────────────────────
// Helper: derive music style string from era data
// ──────────────────────────────────────────────────────────────────────

/** Map an era to a music-style identifier used by composeMusic(). */
function deriveMusicStyle(eraId: EraId, _data: EraData): string {
  switch (eraId) {
    case '1945':
      return 'big_band';
    case '1965':
      return 'doo_wop';
    case '1985':
      return 'synth_arps';
    case '2005':
      return 'boombox';
    case '2025':
      return 'radio_static';
    default:
      return 'none';
  }
}

// ──────────────────────────────────────────────────────────────────────
// Helper: music layer composition based on era style
// ──────────────────────────────────────────────────────────────────────

/**
 * Generate a music buffer matching the given era's derived style.
 * Returns raw Float32Array data.
 */
function composeMusic(
  eraId: EraId,
  data: EraData,
  sampleRate: number,
  durationSec: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  const style = deriveMusicStyle(eraId, data);

  switch (style) {
    case 'doo_wop': {
      const stabDur = 0.5;
      const notesPerSec = 2;
      const rootHz = data.musicStyleParams?.['root'] ?? 220;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const notePhase = (t % (1 / notesPerSec)) / stabDur;
        if (notePhase < stabDur) {
          const ratios = [1, 1.2599, 1.4983];
          for (const r of ratios) {
            const freq = rootHz * r;
            buf[i] += 0.25 * Math.sin(2 * Math.PI * freq * t) *
                      Math.exp(-notePhase * 6);
          }
        }
      }
      break;
    }
    case 'big_band': {
      const stabDur = 0.8;
      const notesPerSec = 1.5;
      const rootHz = data.musicStyleParams?.['root'] ?? 260;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const notePhase = (t % (1 / notesPerSec)) / stabDur;
        if (notePhase < stabDur) {
          const ratios = [1, 1.189, 1.414, 1.682];
          for (const r of ratios) {
            const freq = rootHz * r;
            buf[i] += 0.06 * Math.sin(2 * Math.PI * freq * t) *
                      Math.exp(-notePhase * 3);
          }
        }
      }
      break;
    }
    case 'synth_arps': {
      const intervals = [1, 1.25, 1.5, 2, 2.5, 3];
      const rootHz = data.musicStyleParams?.['root'] ?? 220;
      const noteDur = 0.15;
      const numNotes = Math.floor(len / (sampleRate * noteDur));
      for (let n = 0; n < numNotes; n++) {
        const freq = rootHz * intervals[n % intervals.length];
        const offset = n * Math.round(sampleRate * noteDur);
        const chunkLen = Math.min(Math.round(sampleRate * noteDur), len - offset);
        if (chunkLen <= 0) break;
        for (let j = 0; j < chunkLen; j++) {
          const ti = (offset + j) / sampleRate;
          const phase = 2 * Math.PI * freq * ti;
          const pulse = (phase % (2 * Math.PI)) < Math.PI ? 1 : -1;
          const amp = 0.12 * Math.exp(-j / (sampleRate * noteDur * 0.6));
          buf[offset + j] += pulse * amp;
        }
      }
      break;
    }
    case 'boombox': {
      const pulseDur = 0.4;
      const pulsesPerSec = 2;
      const rootHz = data.musicStyleParams?.['root'] ?? 55;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const pulsePhase = (t % (1 / pulsesPerSec)) / pulseDur;
        if (pulsePhase < pulseDur) {
          buf[i] += 0.4 * Math.sin(2 * Math.PI * rootHz * t) *
                    Math.exp(-pulsePhase * 5) *
                    Math.min(pulsePhase * 200, 1);
          buf[i] += 0.15 * Math.sin(2 * Math.PI * rootHz * 2 * t) *
                     Math.exp(-pulsePhase * 5) *
                     Math.min(pulsePhase * 200, 1);
        }
      }
      break;
    }
    case 'coal_hiss': {
      for (let i = 0; i < len; i++) {
        const crackle = Math.random() < 0.02 ? 2 : 1;
        buf[i] = crackle * 0.08 * (Math.random() * 2 - 1);
      }
      break;
    }
    case 'train_whistle': {
      const freq = data.musicStyleParams?.['freq'] ?? 1200;
      for (let i = 0; i < len; i++) {
        const vib = 1 + 0.015 * Math.sin(i * 6 / sampleRate);
        buf[i] = 0.2 * Math.sin(2 * Math.PI * freq * i / sampleRate) * vib;
      }
      break;
    }
    case 'radio_static': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 500 * t);
        buf[i] = (Math.random() * 2 - 1) * mod * 0.1;
      }
      break;
    }
    // 'none' or unrecognized: silent buffer
    default:
      break;
  }

  return buf;
}

// ──────────────────────────────────────────────────────────────────────
// SfxMixer class
// ──────────────────────────────────────────────────────────────────────

export class SfxMixer {
  private _ctx: AudioContext | null = null;
  private _ready = false;
  private _initQueue: (() => void)[] = [];

  // Layers
  private _masterGain: GainNode | null = null;
  private _ambientGain: GainNode | null = null;
  private _trafficGain: GainNode | null = null;
  private _eventGain: GainNode | null = null;
  private _musicGain: GainNode | null = null;

  // Buffer source nodes (looping beds)
  private _ambientSrc: AudioBufferSourceNode | null = null;
  private _trafficSrc: AudioBufferSourceNode | null = null;
  private _musicSrc: AudioBufferSourceNode | null = null;

  // Currently active era
  private _currentEra: EraId | null = null;
  // Cached AudioBuffers per era
  private _audioBufferCache = new Map<string, CachedEraBuffers>();

  // Generation state
  private _generating = false;
  private _generationPromise: Promise<void> | null = null;

  // Configuration
  private readonly _sampleRate: number;
  private readonly _durationSec: number;
  private readonly _onProgress?: OnProgressCallback;

  // Visibility tracking
  private _visibilityHandler: (() => void) | null = null;

  // Event scheduling timer
  private _eventTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SfxMixerOptions = {}) {
    this._sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this._durationSec = options.durationSec ?? DEFAULT_DURATION_SEC;
    this._onProgress = options.onProgress;

    // Set up visibilitychange listener
    if (typeof document !== 'undefined') {
      this._setupVisibilityListener();
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────

  /**
   * Initialize the AudioContext. Must be called from a user gesture
   * (click, touch, keypress) to comply with autoplay policies.
   * Resolves immediately if already initialized.
   */
  async init(): Promise<void> {
    if (this._ready && this._ctx && this._ctx.state !== 'closed') {
      const ctx = this._ctx;
      // If context exists but is suspended (e.g., after tab hide), resume it
      if (ctx.state === 'suspended') {
        await ctx.resume();
        this._ready = true;
      }
      // Drain any queued callbacks
      const queue = [...this._initQueue];
      this._initQueue = [];
      for (const cb of queue) cb();
      return;
    }

    // Create new AudioContext
    this._ctx = new AudioContext({ sampleRate: this._sampleRate });

    // Build the node graph
    this._buildNodeGraph();

    // Defer resume until we're actually in a user-gesture handler
    // The caller should call init() from within their click/touch handler.
    try {
      await this._ctx.resume();
      this._ready = true;
    } catch {
      // Autoplay policy blocked resume — queue setEra calls instead
      this._ready = false;
    }

    // Resolve any pending initializers
    const queue = [...this._initQueue];
    this._initQueue = [];
    for (const cb of queue) cb();
  }

  /**
   * Switch to a new era. Triggers a ~1.5s crossfade across all layers.
   * If not yet initialized, queues the call to execute after init().
   * If the era hasn't been loaded yet, generates buffers lazily first.
   */
  async setEra(eraId: EraId): Promise<void> {
    // Validate era id
    if (!ERA_IDS.includes(eraId)) {
      console.warn(`[SfxMixer] Unknown era "${eraId}", ignoring.`);
      return;
    }

    // If not ready, queue the call
    if (!this._ready || !this._ctx) {
      return new Promise<void>((resolve) => {
        this._initQueue.push(() => {
          this.setEra(eraId).then(resolve).catch(resolve);
        });
      });
    }

    // If same era, no-op
    if (this._currentEra === eraId) return;

    // Ensure buffers exist for this era (lazy generation)
    await this._ensureEraLoaded(eraId);

    // Perform crossfade
    await this._crossfadeToEra(eraId);

    this._currentEra = eraId;
  }

  /**
   * Set the master output volume (0.0 → 1.0).
   */
  setMasterVolume(vol: number): void {
    if (!this._masterGain || !this._ctx) return;
    const clamped = Math.max(0, Math.min(1, vol));
    this._masterGain.gain.cancelScheduledValues(this._ctx.currentTime);
    this._masterGain.gain.setValueAtTime(clamped, this._ctx.currentTime);
  }

  /**
   * Toggle mute on the master output.
   */
  setMute(muted: boolean): void {
    if (!this._masterGain || !this._ctx) return;
    if (muted) {
      this._masterGain.gain.cancelScheduledValues(this._ctx.currentTime);
      this._masterGain.gain.setValueAtTime(0, this._ctx.currentTime);
    } else {
      // Restore to current volume setting
      const currentVol = this._masterGain.gain.value > 0 ? this._masterGain.gain.value : 1;
      this.setMasterVolume(currentVol);
    }
  }

  /**
   * Get the current era id, or null if none set.
   */
  get currentEra(): EraId | null {
    return this._currentEra;
  }

  /**
   * Check if the mixer is ready (AudioContext created and resumed).
   */
  get isReady(): boolean {
    return this._ready;
  }

  /**
   * Check if buffers are currently being generated for an era.
   */
  get isGenerating(): boolean {
    return this._generating;
  }

  /**
   * Dispose of all resources: disconnect nodes, stop sources, close context.
   */
  dispose(): void {
    // Stop event scheduling
    this._stopEventTimer();

    // Remove visibility listener
    this._removeVisibilityListener();

    // Stop all source nodes
    this._stopSource(this._ambientSrc);
    this._stopSource(this._trafficSrc);
    this._stopSource(this._musicSrc);

    // Disconnect all gains
    this._disconnectSafe(this._ambientGain);
    this._disconnectSafe(this._trafficGain);
    this._disconnectSafe(this._eventGain);
    this._disconnectSafe(this._musicGain);
    this._disconnectSafe(this._masterGain);

    // Close context
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }

    // Clear caches
    this._audioBufferCache.clear();

    this._ctx = null;
    this._masterGain = null;
    this._ambientGain = null;
    this._trafficGain = null;
    this._eventGain = null;
    this._musicGain = null;
    this._ambientSrc = null;
    this._trafficSrc = null;
    this._musicSrc = null;
    this._currentEra = null;
    this._ready = false;
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Node Graph Construction
  // ────────────────────────────────────────────────────────────────

  private _buildNodeGraph(): void {
    if (!this._ctx) return;

    const ctx = this._ctx;

    // Master gain
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 1;
    this._masterGain.connect(ctx.destination);

    // Layer gains → master
    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 1;
    this._ambientGain.connect(this._masterGain);

    this._trafficGain = ctx.createGain();
    this._trafficGain.gain.value = 1;
    this._trafficGain.connect(this._masterGain);

    this._eventGain = ctx.createGain();
    this._eventGain.gain.value = 1;
    this._eventGain.connect(this._masterGain);

    this._musicGain = ctx.createGain();
    this._musicGain.gain.value = 1;
    this._musicGain.connect(this._masterGain);
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Buffer Loading & Caching
  // ────────────────────────────────────────────────────────────────

  /**
   * Ensure the given era's buffers exist in the cache.
   * Generates them lazily if missing, reporting progress.
   */
  private async _ensureEraLoaded(eraId: string): Promise<void> {
    // If already cached, done
    if (this._audioBufferCache.has(eraId)) return;

    // If another generation is in flight, wait for it
    if (this._generationPromise) {
      await this._generationPromise;
      if (this._audioBufferCache.has(eraId)) return;
    }

    // Start generation (only one at a time)
    if (!this._generating) {
      this._generating = true;
      this._generationPromise = this._generateEraBuffers(eraId);
      await this._generationPromise;
      this._generating = false;
      this._generationPromise = null;
    }
  }

  private async _generateEraBuffers(eraId: string): Promise<void> {
    const data = SFX_ERA_DATA[eraId as EraId];
    if (!data) return;

    const progress = this._onProgress;

    // Report start
    progress?.(0);

    // Generate all era buffers (raw Float32Arrays)
    const rawBuffers = generateAllEraBuffers(
      this._sampleRate,
      this._durationSec,
    );

    // Report mid-point
    progress?.(0.5);

    // Convert to AudioBuffers if context is available
    if (this._ctx) {
      const eraRaw = rawBuffers[eraId as EraId];
      if (eraRaw) {
        const musicBuf = composeMusic(
          eraId as EraId,
          data,
          this._sampleRate,
          this._durationSec,
        );

        this._audioBufferCache.set(eraId, {
          ambient: this._float32ToAudioBuffer(eraRaw.ambient),
          traffic: this._float32ToAudioBuffer(eraRaw.traffic),
          events: eraRaw.events.map((e) => this._float32ToAudioBuffer(e)),
          music: this._float32ToAudioBuffer(musicBuf),
        });
      }
    }

    // Report completion
    progress?.(1);
  }

  private _float32ToAudioBuffer(data: Float32Array): AudioBuffer {
    if (!this._ctx) throw new Error('No AudioContext available');
    const buf = this._ctx.createBuffer(1, data.length, this._ctx.sampleRate);
    buf.getChannelData(0).set(data);
    return buf;
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Crossfade Logic
  // ────────────────────────────────────────────────────────────────

  private async _crossfadeToEra(eraId: string): Promise<void> {
    if (!this._ctx || !this._audioBufferCache.size) return;

    const eraData = this._audioBufferCache.get(eraId);
    if (!eraData) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const fadeDur = CROSSFADE_DURATION;

    // Ramp down old layers
    if (this._ambientGain) {
      scheduleExponentialRamp(ctx, this._ambientGain.gain, 1, 0, fadeDur);
    }
    if (this._trafficGain) {
      scheduleExponentialRamp(ctx, this._trafficGain.gain, 1, 0, fadeDur);
    }
    if (this._eventGain) {
      scheduleExponentialRamp(ctx, this._eventGain.gain, 1, 0, fadeDur);
    }
    if (this._musicGain) {
      scheduleExponentialRamp(ctx, this._musicGain.gain, 1, 0, fadeDur);
    }

    // Stop old sources after fade completes
    const stopTime = now + fadeDur + 0.1;
    this._scheduleStop(this._ambientSrc, stopTime);
    this._scheduleStop(this._trafficSrc, stopTime);
    this._scheduleStop(this._musicSrc, stopTime);

    // Set up new sources
    // Ambient
    this._ambientSrc = createLoopSource(ctx, eraData.ambient.getChannelData(0), ctx.sampleRate);
    this._ambientSrc.connect(this._ambientGain!);
    this._ambientSrc.start(now);
    if (this._ambientGain) {
      this._ambientGain.gain.cancelScheduledValues(now);
      this._ambientGain.gain.setValueAtTime(0, now);
      this._ambientGain.gain.exponentialRampToValueAtTime(1, now + fadeDur);
    }

    // Traffic
    this._trafficSrc = createLoopSource(ctx, eraData.traffic.getChannelData(0), ctx.sampleRate);
    this._trafficSrc.connect(this._trafficGain!);
    this._trafficSrc.start(now);
    if (this._trafficGain) {
      this._trafficGain.gain.cancelScheduledValues(now);
      this._trafficGain.gain.setValueAtTime(0, now);
      this._trafficGain.gain.exponentialRampToValueAtTime(1, now + fadeDur);
    }

    // Music
    this._musicSrc = createLoopSource(ctx, eraData.music.getChannelData(0), ctx.sampleRate);
    this._musicSrc.connect(this._musicGain!);
    this._musicSrc.start(now);
    if (this._musicGain) {
      this._musicGain.gain.cancelScheduledValues(now);
      this._musicGain.gain.setValueAtTime(0, now);
      this._musicGain.gain.exponentialRampToValueAtTime(1, now + fadeDur);
    }

    // Events: schedule stochastic one-shots for the new era
    this._startEventTimer(eraData.events, ctx);

    // Wait for crossfade to complete
    await new Promise<void>((resolve) => {
      setTimeout(resolve, fadeDur * 1000);
    });
  }

  private _scheduleStop(src: AudioBufferSourceNode | null, when: number): void {
    if (!src) return;
    try {
      src.stop(when);
    } catch {
      // Already stopped
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Event Scheduling
  // ────────────────────────────────────────────────────────────────

  private _startEventTimer(events: AudioBuffer[], ctx: AudioContext): void {
    // Stop any existing timer
    this._stopEventTimer();

    const rate = EVENTS_PER_SECOND_BASE * events.length;
    if (rate <= 0) return;

    // Schedule events in bursts
    const burstSize = Math.ceil(rate * 2); // 2 seconds worth of events
    let scheduledCount = 0;

    const scheduleBurst = (): void => {
      if (!this._ctx || this._ctx.state === 'closed') return;

      const now = this._ctx.currentTime;
      for (let i = 0; i < burstSize; i++) {
        const delay = (scheduledCount / rate) + (Math.random() * 0.5 / rate);
        const when = now + delay;

        if (when > now + 5) break; // Don't schedule too far ahead

        const evtBuf = events[Math.floor(Math.random() * events.length)];
        const src = ctx.createBufferSource();
        src.buffer = evtBuf;
        src.connect(ctx.destination);
        try {
          src.start(when);
        } catch {
          // start may fail for past times
        }
        scheduledCount++;
      }
    };

    // Initial burst
    scheduleBurst();

    // Continue scheduling periodically
    this._eventTimer = setInterval(() => {
      scheduleBurst();
    }, 2000);
  }

  private _stopEventTimer(): void {
    if (this._eventTimer) {
      clearInterval(this._eventTimer);
      this._eventTimer = null;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Visibility Change Handling
  // ────────────────────────────────────────────────────────────────

  private _setupVisibilityListener(): void {
    this._visibilityHandler = () => {
      if (!this._ctx) return;

      if (document.hidden) {
        // Tab hidden: suspend context to save resources
        this._ctx.suspend();
      } else {
        // Tab visible: resume context
        this._ctx.resume().catch(() => {
          // Resume may fail if no user gesture; next init() call will handle it
        });
      }
    };

    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  private _removeVisibilityListener(): void {
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Private: Safe Cleanup Helpers
  // ────────────────────────────────────────────────────────────────

  private _stopSource(src: AudioBufferSourceNode | null): void {
    if (!src) return;
    try {
      src.stop();
    } catch {
      // Already stopped or invalid state
    }
  }

  private _disconnectSafe(node: AudioNode | null): void {
    if (!node) return;
    try {
      node.disconnect();
    } catch {
      // Already disconnected
    }
  }
}
