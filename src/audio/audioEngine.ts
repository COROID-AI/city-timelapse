/**
 * Master Web Audio SFX and Ambience Engine.
 *
 * Coordinates synthesized era sound beds, equal-power crossfading across
 * timelapse eras, transition whoosh SFX, UI clicks, master volume / mute automation,
 * and first-gesture autoplay unlock.
 *
 * No external audio files or network fetches — all sound is 100% procedurally synthesized.
 */

import { clamp } from '../lib/math';
import {
  type AmbienceBedInstance,
  createAmbienceBed,
  createNoiseBuffer,
  DEFAULT_ERA_AMBIENCE,
  type EraAmbienceDescriptor,
  type EraId,
} from './ambience';
import {
  type ClickOptions,
  playClick,
  playSuccessTick,
  playTransitionWhoosh,
  type SfxHandle,
  type SuccessTickOptions,
  type TransitionWhooshOptions,
} from './sfx';

export interface AudioEngineOptions {
  /**
   * Factory returning an AudioContext instance.
   * Defaults to window.AudioContext or webkitAudioContext when running in a browser.
   */
  readonly audioContextFactory?: () => AudioContext;
  /** Initial master gain volume in [0, 1] (default: 0.8). */
  readonly initialMasterVolume?: number;
  /** Default crossfade transition duration in seconds (default: 1.8s). */
  readonly defaultCrossfadeDuration?: number;
  /** Map of custom era ambience descriptors to override or extend defaults. */
  readonly ambienceDescriptors?: Record<string, EraAmbienceDescriptor>;
  /** Automatically register once-listeners for pointerdown/keydown to unlock autoplay. (default: true) */
  readonly autoUnlock?: boolean;
}

/**
 * Standard AudioContext factory fallback.
 */
function defaultContextFactory(): AudioContext {
  const win = typeof window !== 'undefined' ? window : null;
  const AudioContextClass =
    win &&
    (win.AudioContext ||
      (win as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  if (!AudioContextClass) {
    throw new Error(
      'AudioContext is not supported in this environment. Provide an audioContextFactory option.',
    );
  }

  return new AudioContextClass();
}

export class AudioEngine {
  private readonly _contextFactory: () => AudioContext;
  private readonly _defaultCrossfadeDuration: number;
  private readonly _ambienceDescriptors: Record<string, EraAmbienceDescriptor>;

  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _ambienceGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;
  private _sharedNoiseBuffer: AudioBuffer | null = null;

  private readonly _activeBeds = new Map<string, AmbienceBedInstance>();
  private _currentEra: string | null = null;
  private _isTransitioning = false;
  private _crossfadeTimeout: ReturnType<typeof setTimeout> | null = null;

  private _masterVolume: number;
  private _preMuteVolume: number;
  private _isMuted = false;
  private _isUnlocked = false;
  private _isDisposed = false;
  private _cleanupGestureListeners: (() => void) | null = null;

  constructor(options: AudioEngineOptions = {}) {
    this._contextFactory = options.audioContextFactory ?? defaultContextFactory;
    this._masterVolume = clamp(options.initialMasterVolume ?? 0.8, 0, 1);
    this._preMuteVolume = this._masterVolume;
    this._defaultCrossfadeDuration = options.defaultCrossfadeDuration ?? 1.8;
    this._ambienceDescriptors = {
      ...DEFAULT_ERA_AMBIENCE,
      ...(options.ambienceDescriptors ?? {}),
    };

    if (options.autoUnlock !== false && typeof window !== 'undefined') {
      this._registerAutoplayUnlockGestures();
    }
  }

  /**
   * Lazily initialize or retrieve the underlying AudioContext and master node graph.
   */
  private _ensureContext(): AudioContext {
    if (this._isDisposed) {
      throw new Error('AudioEngine has been disposed.');
    }

    if (this._ctx) {
      return this._ctx;
    }

    const ctx = this._contextFactory();
    this._ctx = ctx;

    // Master gain node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this._isMuted ? 0 : this._masterVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this._masterGain = masterGain;

    // Sub-master gains for ambience and SFX routing
    const ambienceGain = ctx.createGain();
    ambienceGain.gain.setValueAtTime(1.0, ctx.currentTime);
    ambienceGain.connect(masterGain);
    this._ambienceGain = ambienceGain;

    const sfxGain = ctx.createGain();
    sfxGain.gain.setValueAtTime(1.0, ctx.currentTime);
    sfxGain.connect(masterGain);
    this._sfxGain = sfxGain;

    // Pre-create shared procedural noise buffer for efficiency
    try {
      this._sharedNoiseBuffer = createNoiseBuffer(ctx, 4, 42);
    } catch {
      this._sharedNoiseBuffer = null;
    }

    return ctx;
  }

  /**
   * Register user gesture listeners for suspended-safe autoplay unlocking.
   */
  private _registerAutoplayUnlockGestures(): void {
    const events: Array<'pointerdown' | 'keydown' | 'touchstart' | 'click'> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'click',
    ];

    const onGesture = () => {
      this.unlock().catch(() => {});
    };

    if (typeof window !== 'undefined') {
      for (const evt of events) {
        window.addEventListener(evt, onGesture, { once: true, passive: true });
      }

      this._cleanupGestureListeners = () => {
        for (const evt of events) {
          window.removeEventListener(evt, onGesture);
        }
      };
    }
  }

  /**
   * Start / initialize the audio context.
   */
  start(): AudioContext {
    return this._ensureContext();
  }

  /**
   * Autoplay unlock: resumes the AudioContext on first user gesture.
   * Safe to call multiple times (idempotent). Preserves active mute state.
   */
  async unlock(): Promise<boolean> {
    if (this._isDisposed) {
      return false;
    }

    if (this._cleanupGestureListeners) {
      this._cleanupGestureListeners();
      this._cleanupGestureListeners = null;
    }

    const ctx = this._ensureContext();

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        await ctx.resume();
        this._isUnlocked = true;
        return true;
      } catch {
        return false;
      }
    }

    this._isUnlocked = true;
    return true;
  }

  /**
   * Return whether autoplay unlock has completed.
   */
  isUnlocked(): boolean {
    return this._isUnlocked;
  }

  /**
   * Current active era identifier (or null if no era has been set).
   */
  getCurrentEra(): string | null {
    return this._currentEra;
  }

  /**
   * Get the active AudioContext instance if initialized.
   */
  getContext(): AudioContext | null {
    return this._ctx;
  }

  /**
   * Set the master output volume in [0, 1].
   * If currently muted, preserves the requested volume to restore on unmute.
   */
  setMasterVolume(volume: number, rampDuration = 0.05): void {
    const clamped = clamp(volume, 0, 1);
    this._masterVolume = clamped;
    this._preMuteVolume = clamped;

    if (!this._isMuted && this._masterGain && this._ctx) {
      const now = this._ctx.currentTime;
      this._masterGain.gain.cancelScheduledValues(now);
      this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
      if (rampDuration > 0) {
        this._masterGain.gain.linearRampToValueAtTime(clamped, now + rampDuration);
      } else {
        this._masterGain.gain.setValueAtTime(clamped, now);
      }
    }
  }

  /**
   * Return the current master volume setting (even if muted).
   */
  getMasterVolume(): number {
    return this._masterVolume;
  }

  /**
   * Mute all audio by smoothly ramping master gain to zero.
   * Preserves current volume level in memory for clean restoration on unmute.
   */
  mute(rampDuration = 0.05): void {
    if (this._isMuted) return;
    this._isMuted = true;

    if (this._masterGain && this._ctx) {
      const now = this._ctx.currentTime;
      this._masterGain.gain.cancelScheduledValues(now);
      this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
      if (rampDuration > 0) {
        this._masterGain.gain.linearRampToValueAtTime(0, now + rampDuration);
      } else {
        this._masterGain.gain.setValueAtTime(0, now);
      }
    }
  }

  /**
   * Unmute audio by smoothly ramping master gain back to pre-muted volume.
   */
  unmute(rampDuration = 0.05): void {
    if (!this._isMuted) return;
    this._isMuted = false;

    const target = this._preMuteVolume > 0 ? this._preMuteVolume : 0.8;
    this._masterVolume = target;

    if (this._masterGain && this._ctx) {
      const now = this._ctx.currentTime;
      this._masterGain.gain.cancelScheduledValues(now);
      this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
      if (rampDuration > 0) {
        this._masterGain.gain.linearRampToValueAtTime(target, now + rampDuration);
      } else {
        this._masterGain.gain.setValueAtTime(target, now);
      }
    }
  }

  /**
   * Toggle mute state. Returns true if now muted, false if unmuted.
   */
  toggleMute(rampDuration = 0.05): boolean {
    if (this._isMuted) {
      this.unmute(rampDuration);
      return false;
    } else {
      this.mute(rampDuration);
      return true;
    }
  }

  /**
   * Return whether the engine is currently muted.
   */
  isMuted(): boolean {
    return this._isMuted;
  }

  /**
   * Crossfade the active ambience bed to the specified era over `duration` seconds.
   *
   * Equal-power linear gain curves ensure sound energy remains stable during transition.
   * Mid-fade calls cleanly cancel and retarget without node leaks or pops.
   * Calling with the currently active era while not transitioning is a no-op.
   */
  setEra(eraId: EraId, ambience?: EraAmbienceDescriptor, duration?: number): void {
    if (this._isDisposed) return;

    const fadeDuration = duration ?? this._defaultCrossfadeDuration;

    // Same era is a no-op if no transition is in progress
    if (eraId === this._currentEra && !this._isTransitioning) {
      return;
    }

    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    this._currentEra = eraId;
    this._isTransitioning = true;

    if (this._crossfadeTimeout !== null) {
      clearTimeout(this._crossfadeTimeout);
      this._crossfadeTimeout = null;
    }

    const descriptor: EraAmbienceDescriptor =
      ambience ??
      this._ambienceDescriptors[eraId] ??
      DEFAULT_ERA_AMBIENCE[eraId] ??
      DEFAULT_ERA_AMBIENCE['1945']!;

    // 1. Fade out any existing beds that belong to previous eras
    for (const [id, bed] of this._activeBeds.entries()) {
      if (id !== eraId) {
        bed.setVolume(0, fadeDuration, now);
      }
    }

    // 2. Create or fade in the incoming target era bed
    let targetBed = this._activeBeds.get(eraId);
    if (!targetBed) {
      targetBed = createAmbienceBed(
        ctx,
        this._ambienceGain!,
        descriptor,
        this._sharedNoiseBuffer ?? undefined,
      );
      this._activeBeds.set(eraId, targetBed);
    }
    targetBed.setVolume(descriptor.baseVolume, fadeDuration, now);

    // 3. Schedule cleanup of outgoing beds once crossfade completes
    this._crossfadeTimeout = setTimeout(() => {
      if (this._isDisposed) return;
      for (const [id, bed] of Array.from(this._activeBeds.entries())) {
        if (id !== this._currentEra) {
          bed.stop(ctx.currentTime);
          bed.disconnect();
          this._activeBeds.delete(id);
        }
      }
      this._isTransitioning = false;
      this._crossfadeTimeout = null;
    }, Math.max(20, Math.floor(fadeDuration * 1000 + 60)));
  }

  /**
   * Play the time-travel morph transition whoosh SFX.
   */
  playTransitionWhoosh(duration?: number, intensity?: number): SfxHandle | null {
    if (this._isDisposed) return null;
    const ctx = this._ensureContext();
    const options: TransitionWhooshOptions = {
      duration,
      intensity,
      sharedNoiseBuffer: this._sharedNoiseBuffer ?? undefined,
    };
    return playTransitionWhoosh(ctx, this._sfxGain!, options);
  }

  /**
   * Play a crisp UI click burst SFX.
   */
  playClick(frequency?: number, duration?: number): SfxHandle | null {
    if (this._isDisposed) return null;
    const ctx = this._ensureContext();
    const options: ClickOptions = {
      frequency,
      duration,
    };
    return playClick(ctx, this._sfxGain!, options);
  }

  /**
   * Play a pleasant soft success tick chime SFX.
   */
  playSuccessTick(volume?: number): SfxHandle | null {
    if (this._isDisposed) return null;
    const ctx = this._ensureContext();
    const options: SuccessTickOptions = {
      volume,
    };
    return playSuccessTick(ctx, this._sfxGain!, options);
  }

  /**
   * Completely shut down the audio engine, disconnect all nodes, and remove event listeners.
   */
  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;

    if (this._crossfadeTimeout !== null) {
      clearTimeout(this._crossfadeTimeout);
      this._crossfadeTimeout = null;
    }

    if (this._cleanupGestureListeners) {
      this._cleanupGestureListeners();
      this._cleanupGestureListeners = null;
    }

    for (const bed of this._activeBeds.values()) {
      bed.stop();
      bed.disconnect();
    }
    this._activeBeds.clear();

    if (this._ambienceGain) {
      try {
        this._ambienceGain.disconnect();
      } catch {}
      this._ambienceGain = null;
    }

    if (this._sfxGain) {
      try {
        this._sfxGain.disconnect();
      } catch {}
      this._sfxGain = null;
    }

    if (this._masterGain) {
      try {
        this._masterGain.disconnect();
      } catch {}
      this._masterGain = null;
    }

    if (this._ctx && this._ctx.state !== 'closed') {
      try {
        this._ctx.close().catch(() => {});
      } catch {}
      this._ctx = null;
    }
  }
}

export * from './ambience';
export * from './sfx';
