/**
 * Central Timeline Controller and Store for City Time Period Timelapse.
 *
 * Types and pure state logic only — no THREE imports and no DOM access.
 *
 * Provides smooth transitions between eras, live scrubbing to arbitrary global t [0..1]
 * or local t [0..1], step navigation (+1 / -1), and subscription callbacks.
 */

import { easeInOut } from '../era/transition';
import type { TimelineChannel } from '../era/types';
import {
  DEFAULT_ERA,
  ERAS,
  type EraId,
  channelToGlobalProgress,
  getEraByIndex,
  getEraIndex,
  globalProgressToChannel,
  isEraId,
} from '../era/years';

export type TimelineSubscriber = (channel: TimelineChannel, state: TimelineState) => void;

export interface TimelineState {
  /** Current channel describing the visual interpolation */
  readonly channel: TimelineChannel;
  /** Active target / discrete era */
  readonly currentEra: EraId;
  /** Whether a tween transition is actively running */
  readonly isTransitioning: boolean;
  /** Whether the user is currently live-scrubbing */
  readonly isScrubbing: boolean;
  /** Continuous progress from 0.0 (1945) to 1.0 (2025) */
  readonly globalProgress: number;
}

export interface TimelineControllerOptions {
  /** Initial era. Defaults to '1945'. */
  initialEra?: EraId;
  /** Default duration in seconds for tween transitions. Defaults to 1.2s. */
  transitionDuration?: number;
  /** Easing function to use during automated tween transitions. Defaults to cubic easeInOut. */
  easing?: (t: number) => number;
}

export interface TimelineController {
  /**
   * Returns the current timeline channel { fromEra, toEra, t }
   */
  getChannel(): TimelineChannel;

  /**
   * Returns the complete current timeline state
   */
  getState(): TimelineState;

  /**
   * Transitions smoothly to a target era.
   * If immediate is true, jumps immediately without tweening.
   * If duration is specified, overrides default transition duration.
   */
  setYear(era: EraId, options?: { immediate?: boolean; duration?: number }): void;

  /**
   * Directly sets the channel to scrub progress without animation.
   * If progress is given as a number (0..1), it represents the global timeline progress (1945 -> 2025).
   * Alternatively, accepts an explicit { fromEra, toEra, t } channel object.
   */
  scrubTo(target: number | { fromEra: EraId; toEra: EraId; t: number }): void;

  /**
   * Starts a scrub session (marks isScrubbing = true, cancels active tweens).
   */
  startScrub(): void;

  /**
   * Finishes a scrub session, optionally snapping to the nearest era or designated era.
   */
  endScrub(snapToNearest?: boolean): void;

  /**
   * Steps forward (+1) or backward (-1) by index in the chronological ERAS tuple.
   * Returns true if step changed era, false if boundary reached or invalid step.
   */
  step(delta: number): boolean;

  /**
   * Advances active tween animations by `deltaSeconds`.
   * Should be called from the shared render loop tick.
   */
  update(deltaSeconds: number): void;

  /**
   * Subscribes a listener to timeline changes. Listener is immediately invoked with the current state.
   * Returns an unsubscribe function.
   */
  subscribe(fn: TimelineSubscriber): () => void;

  /**
   * Cleans up all subscriptions and stops running animations.
   */
  dispose(): void;
}

export function createTimelineController(
  options: TimelineControllerOptions = {},
): TimelineController {
  const defaultDuration = Math.max(0.001, options.transitionDuration ?? 1.2);
  const easeFn = options.easing ?? easeInOut;
  const initialEra: EraId = options.initialEra && isEraId(options.initialEra) ? options.initialEra : DEFAULT_ERA;

  let currentEra: EraId = initialEra;
  let channel: TimelineChannel = {
    fromEra: initialEra,
    toEra: initialEra,
    t: 0,
  };

  let isTransitioning = false;
  let isScrubbing = false;

  // Active tween state
  let tweenFromEra: EraId = initialEra;
  let tweenToEra: EraId = initialEra;
  let tweenElapsed = 0;
  let tweenDuration = defaultDuration;

  const subscribers = new Set<TimelineSubscriber>();
  let disposed = false;

  function buildState(): TimelineState {
    return {
      channel,
      currentEra,
      isTransitioning,
      isScrubbing,
      globalProgress: channelToGlobalProgress(channel),
    };
  }

  function notify(): void {
    if (disposed) return;
    const state = buildState();
    for (const subscriber of subscribers) {
      try {
        subscriber(channel, state);
      } catch (err) {
        // Prevent subscriber errors from breaking the timeline loop
        console.error('Timeline subscriber threw an error:', err);
      }
    }
  }

  return {
    getChannel(): TimelineChannel {
      return channel;
    },

    getState(): TimelineState {
      return buildState();
    },

    setYear(targetEra: EraId, setOptions = {}): void {
      if (disposed) return;
      if (!isEraId(targetEra)) {
        throw new Error(`Invalid era: ${String(targetEra)}`);
      }

      isScrubbing = false;

      if (setOptions.immediate || (targetEra === currentEra && !isTransitioning)) {
        currentEra = targetEra;
        isTransitioning = false;
        channel = {
          fromEra: targetEra,
          toEra: targetEra,
          t: 0,
        };
        notify();
        return;
      }

      // If already transitioning, interpolate smoothly from the current apparent state
      if (isTransitioning) {
        // If heading towards the same target, let it continue
        if (tweenToEra === targetEra) {
          return;
        }
      }

      // Determine starting era for the tween
      // If we are currently mid-tween or scrubbed, take the most relevant anchor
      let startEra = currentEra;
      if (channel.fromEra !== channel.toEra && channel.t > 0.5) {
        startEra = channel.toEra;
      } else if (channel.fromEra !== channel.toEra) {
        startEra = channel.fromEra;
      }

      if (startEra === targetEra) {
        currentEra = targetEra;
        isTransitioning = false;
        channel = { fromEra: targetEra, toEra: targetEra, t: 0 };
        notify();
        return;
      }

      currentEra = targetEra;
      tweenFromEra = startEra;
      tweenToEra = targetEra;
      tweenElapsed = 0;
      tweenDuration = Math.max(0.001, setOptions.duration ?? defaultDuration);

      isTransitioning = true;
      channel = {
        fromEra: tweenFromEra,
        toEra: tweenToEra,
        t: 0,
      };
      notify();
    },

    scrubTo(target: number | { fromEra: EraId; toEra: EraId; t: number }): void {
      if (disposed) return;
      isTransitioning = false;

      if (typeof target === 'number') {
        const chan = globalProgressToChannel(target);
        channel = chan;
        // Current era is set to whichever end the t is closest to
        currentEra = chan.t >= 0.5 ? chan.toEra : chan.fromEra;
      } else {
        if (!isEraId(target.fromEra) || !isEraId(target.toEra)) {
          throw new Error(`Invalid era in scrub target: ${String(target.fromEra)} -> ${String(target.toEra)}`);
        }
        const clampedT = Math.max(0, Math.min(1, Number.isFinite(target.t) ? target.t : 0));
        channel = {
          fromEra: target.fromEra,
          toEra: target.toEra,
          t: clampedT,
        };
        currentEra = clampedT >= 0.5 ? target.toEra : target.fromEra;
      }

      notify();
    },

    startScrub(): void {
      if (disposed) return;
      isScrubbing = true;
      isTransitioning = false;
      notify();
    },

    endScrub(snapToNearest = true): void {
      if (disposed) return;
      isScrubbing = false;
      if (snapToNearest) {
        const nearestEra = channel.t >= 0.5 ? channel.toEra : channel.fromEra;
        currentEra = nearestEra;
        channel = {
          fromEra: nearestEra,
          toEra: nearestEra,
          t: 0,
        };
      }
      notify();
    },

    step(delta: number): boolean {
      if (disposed) return false;
      const currentIdx = getEraIndex(currentEra);
      if (currentIdx < 0) return false;

      const targetIdx = currentIdx + delta;
      if (targetIdx < 0 || targetIdx >= ERAS.length) {
        return false;
      }

      const targetEra = getEraByIndex(targetIdx);
      if (!targetEra) return false;

      this.setYear(targetEra);
      return true;
    },

    update(deltaSeconds: number): void {
      if (disposed || !isTransitioning || isScrubbing) return;
      if (deltaSeconds <= 0) return;

      tweenElapsed += deltaSeconds;
      const linearT = Math.min(1, tweenElapsed / tweenDuration);
      const easedT = easeFn(linearT);

      if (linearT >= 1) {
        isTransitioning = false;
        channel = {
          fromEra: tweenToEra,
          toEra: tweenToEra,
          t: 0,
        };
        currentEra = tweenToEra;
      } else {
        channel = {
          fromEra: tweenFromEra,
          toEra: tweenToEra,
          t: easedT,
        };
      }

      notify();
    },

    subscribe(fn: TimelineSubscriber): () => void {
      if (typeof fn !== 'function') {
        throw new TypeError('subscribe requires a callback function');
      }
      subscribers.add(fn);
      // Immediately invoke with current state safely
      try {
        fn(channel, buildState());
      } catch (err) {
        console.error('Timeline subscriber threw an error on immediate invocation:', err);
      }

      return () => {
        subscribers.delete(fn);
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      isTransitioning = false;
      isScrubbing = false;
      subscribers.clear();
    },
  };
}
