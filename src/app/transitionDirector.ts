/**
 * Transition Director for City Time Period Timelapse.
 *
 * Choreographs synchronized era transitions across all six world subsystems
 * (buildings, signage, vehicles, pedestrians, atmosphere, audio).
 *
 * Guarantees that every subsystem receives the exact same TimelineChannel
 * instance per frame, ensuring synchronized visual morphing and audio crossfades.
 *
 * Consumed by sceneApp and polish-performance-docs for quality and
 * reduced-motion integration.
 */

import type { AudioEngine } from '../audio/audioEngine';
import type { EraSystem, TimelineChannel } from '../era/types';
import { ERAS, type EraId, isEraId } from '../era/years';
import type { TimelineController } from '../state/timelineStore';

/**
 * Collection of world systems managed by the director.
 */
export interface WorldSystems {
  readonly buildings: EraSystem<unknown>;
  readonly signage: EraSystem<unknown>;
  readonly vehicles: EraSystem<unknown>;
  readonly pedestrians: EraSystem<unknown>;
  readonly atmosphere: EraSystem<unknown>;
}

export interface TransitionDirectorOptions {
  /**
   * Default duration in seconds for tween transitions.
   * Standard era transition is ~1.4s.
   */
  duration?: number;
  /**
   * Easing function for transitions (defaults to cubic easeInOut).
   */
  easing?: (t: number) => number;
  /**
   * Static flag or probe function indicating if reduced motion is requested.
   * When true, era transitions snap immediately with zero duration.
   */
  reducedMotion?: boolean | (() => boolean);
  /**
   * Callback invoked when an era transition begins.
   */
  onTransitionStart?: (fromEra: EraId, toEra: EraId) => void;
  /**
   * Callback invoked when an era transition arrives at the target era.
   */
  onTransitionEnd?: (era: EraId) => void;
}

export interface TransitionDirector {
  /** Underlying timeline controller store. */
  readonly controller: TimelineController;
  /** 3D world systems being synchronized. */
  readonly systems: WorldSystems;
  /** Audio engine receiving synchronized timeline updates. */
  readonly audio: AudioEngine | null;

  /** Returns the current active timeline channel { fromEra, toEra, t }. */
  getChannel(): TimelineChannel;

  /** Returns the current target / discrete EraId. */
  getCurrentEra(): EraId;

  /** Returns whether a transition tween is actively progressing. */
  isTransitioning(): boolean;

  /** Returns whether the user is currently live-scrubbing. */
  isScrubbing(): boolean;

  /** Returns the continuous global progress [0.0..1.0] from 1945 to 2025. */
  getGlobalProgress(): number;

  /**
   * Transitions smoothly to a target era.
   * Respects reduced-motion preference (snapping immediately if enabled).
   */
  transitionTo(era: EraId, options?: { immediate?: boolean; duration?: number }): void;

  /**
   * Directly sets the channel to a scrub target without animating.
   */
  scrubTo(target: number | { fromEra: EraId; toEra: EraId; t: number }): void;

  /**
   * Steps forward (+1) or backward (-1) chronologically through ERAS.
   */
  step(delta: number): boolean;

  /** Gets the active transition duration in seconds. */
  getDuration(): number;

  /** Sets the transition duration in seconds. */
  setDuration(seconds: number): void;

  /** Checks if reduced motion is currently active. */
  isReducedMotion(): boolean;

  /** Explicitly overrides the reduced motion setting. */
  setReducedMotion(reduced: boolean): void;

  /**
   * Advances the transition clock and pushes the exact same TimelineChannel
   * to all world systems and the audio engine.
   * Call once per frame from the master render loop.
   */
  update(deltaSeconds: number): void;

  /**
   * Cleans up subscriptions and internal state. Safe to call repeatedly.
   */
  dispose(): void;
}

const DEFAULT_TRANSITION_DURATION = 1.4;

/**
 * Creates and initializes the TransitionDirector.
 */
export function createTransitionDirector(
  controller: TimelineController,
  systems: WorldSystems,
  audio: AudioEngine | null = null,
  options: TransitionDirectorOptions = {},
): TransitionDirector {
  if (!controller || typeof controller.getChannel !== 'function') {
    throw new TypeError('createTransitionDirector requires a valid TimelineController');
  }

  let duration = Math.max(0.001, options.duration ?? DEFAULT_TRANSITION_DURATION);
  let reducedMotionOverride: boolean | null =
    typeof options.reducedMotion === 'boolean' ? options.reducedMotion : null;
  const reducedMotionProbe: (() => boolean) | null =
    typeof options.reducedMotion === 'function' ? options.reducedMotion : null;

  let disposed = false;
  let wasTransitioning = false;

  function checkReducedMotion(): boolean {
    if (reducedMotionOverride !== null) {
      return reducedMotionOverride;
    }
    if (reducedMotionProbe) {
      return reducedMotionProbe();
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    }
    return false;
  }

  return {
    controller,
    systems,
    audio,

    getChannel(): TimelineChannel {
      return controller.getChannel();
    },

    getCurrentEra(): EraId {
      return controller.getState().currentEra;
    },

    isTransitioning(): boolean {
      return controller.getState().isTransitioning;
    },

    isScrubbing(): boolean {
      return controller.getState().isScrubbing;
    },

    getGlobalProgress(): number {
      return controller.getState().globalProgress;
    },

    transitionTo(targetEra: EraId, setOptions = {}): void {
      if (disposed) return;
      if (!isEraId(targetEra)) {
        throw new Error(`Invalid target era: ${String(targetEra)}`);
      }

      const isReduced = checkReducedMotion();
      const immediate = setOptions.immediate || isReduced;
      const tweenDuration = immediate ? 0 : (setOptions.duration ?? duration);

      const fromEra = controller.getState().currentEra;

      if (fromEra !== targetEra && !immediate) {
        options.onTransitionStart?.(fromEra, targetEra);
      }

      controller.setYear(targetEra, {
        immediate,
        duration: tweenDuration,
      });

      if (immediate && fromEra !== targetEra) {
        options.onTransitionEnd?.(targetEra);
      }
    },

    scrubTo(target: number | { fromEra: EraId; toEra: EraId; t: number }): void {
      if (disposed) return;
      controller.scrubTo(target);
    },

    step(delta: number): boolean {
      if (disposed) return false;
      const currentEra = controller.getState().currentEra;
      const idx = ERAS.indexOf(currentEra);
      if (idx < 0) return false;

      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= ERAS.length) {
        return false;
      }

      const targetEra = ERAS[targetIdx];
      this.transitionTo(targetEra);
      return true;
    },

    getDuration(): number {
      return duration;
    },

    setDuration(seconds: number): void {
      duration = Math.max(0.001, seconds);
    },

    isReducedMotion(): boolean {
      return checkReducedMotion();
    },

    setReducedMotion(reduced: boolean): void {
      reducedMotionOverride = reduced;
    },

    update(deltaSeconds: number): void {
      if (disposed) return;

      // 1. Advance timeline tween
      controller.update(deltaSeconds);

      // 2. Fetch the current unified channel and state
      const channel = controller.getChannel();
      const state = controller.getState();

      // Check transition lifecycle events
      if (state.isTransitioning && !wasTransitioning) {
        wasTransitioning = true;
        options.onTransitionStart?.(channel.fromEra, channel.toEra);
      } else if (!state.isTransitioning && wasTransitioning) {
        wasTransitioning = false;
        options.onTransitionEnd?.(state.currentEra);
      }

      // 3. Dispatch the exact same channel instance to all five world systems
      systems.buildings.update(channel, deltaSeconds);
      systems.signage.update(channel, deltaSeconds);
      systems.vehicles.update(channel, deltaSeconds);
      systems.pedestrians.update(channel, deltaSeconds);
      systems.atmosphere.update(channel, deltaSeconds);

      // 4. Dispatch to audio engine if available
      if (audio) {
        audio.update(channel, deltaSeconds, {
          isTransitioning: state.isTransitioning,
          isScrubbing: state.isScrubbing,
        });
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      wasTransitioning = false;
    },
  };
}
