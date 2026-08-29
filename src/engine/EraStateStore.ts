/**
 * Central reactive era state store.
 *
 * Every scene subsystem (transformation engine, vehicles, paths, storefronts,
 * SFX, UI timeline) subscribes to this store to learn which era is active and
 * how far a transition has progressed. The module is intentionally free of DOM
 * and three.js imports: it is a pure TypeScript state module so both the UI
 * and the WebGL side can consume it without circular dependencies.
 *
 * The store API is synchronous for subscribers. Visual transition animation is
 * the TransformationEngine's job, not this store's — the store only records
 * the current era, the previous era, and a 0..1 progress value updated by the
 * engine (or by the built-in auto-advance play mode).
 */

import { ERA_IDS } from './eras';
import type { EraId } from './eras';

/** Number of representable eras. */
export const ERA_COUNT = ERA_IDS.length;

/** Minimum transition progress (start of a transition). */
export const TRANSITION_START = 0;
/** Maximum transition progress (transition fully applied). */
export const TRANSITION_END = 1;

/**
 * The canonical duration of one auto-play era step, in seconds. The play mode
 * walks the five eras in ascending order: 1945 → 1965 → 1985 → 2005 → 2025.
 */
export const DEFAULT_PLAY_STEP_SECONDS = 5;

/**
 * Immutable snapshot of the store. Subscribers receive a fresh snapshot on
 * every notification so callers can never accidentally mutate live state.
 */
export interface EraState {
  /** Currently selected era id, restricted to the five supported years. */
  readonly selectedYear: EraId;
  /** Era selected immediately before the current one (same as selectedYear for the initial state). */
  readonly previousYear: EraId;
  /** Transition progress 0..1 (see {@link TRANSITION_START} / {@link TRANSITION_END}). */
  readonly transitionProgress: number;
  /** True while auto-advance play mode is active. */
  readonly isPlaying: boolean;
  /** Index of the era the play mode is advancing toward (0-based). */
  readonly playingYearIndex: number;
}

/**
 * Public store API returned by `createEraStateStore()` and shared as the
 * module-level singleton `eraStateStore`. Do not change this surface: it is
 * consumed by every later subsystem task.
 */
export interface EraStateStore {
  /** Returns the current immutable state snapshot without subscribing. */
  getSnapshot(): EraState;
  /**
   * Sets the active era. Only the five valid era ids are accepted; anything
   * else throws a TypeError. All registered subscribers are notified
   * synchronously with the new era state; duplicate targets are ignored.
   */
  setYear(year: EraId): void;
  /**
   * Registers a subscriber and returns an unsubscribe function. Calling it
   * removes the listener without leaking; a second call is a no-op.
   */
  subscribe(listener: (state: EraState) => void): () => void;
  /**
   * Begins auto-advance play mode: walks the five eras in ascending order,
   * calling setYear after each {@link DEFAULT_PLAY_STEP_SECONDS} interval,
   * and stops automatically after the final (2025) era. No-op when already
   * playing. Returns a stop function that freezes play in place mid-transition
   * without throwing.
   */
  play(): () => void;
  /** Stops auto-advance play mode in place (safe no-op when not playing). */
  stop(): void;
  /** Releases every subscriber and cancels play mode (used by tests/HMR). */
  clear(): void;
}

/**
 * Creates an independent era state store. The default starting era is 1945
 * (the earliest era), matching the eras module's canonical registry order.
 */
export function createEraStateStore(): EraStateStore {
  const initialYear: EraId = ERA_IDS[0];
  let selectedYear: EraId = initialYear;
  let previousYear: EraId = initialYear;
  let transitionProgress = TRANSITION_START;
  let isPlaying = false;
  let playingYearIndex = 0;
  let playTimer: ReturnType<typeof setTimeout> | null = null;

  const listeners = new Set<(state: EraState) => void>();

  function getSnapshot(): EraState {
    return {
      selectedYear,
      previousYear,
      transitionProgress,
      isPlaying,
      playingYearIndex,
    };
  }

  function notify(): void {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function setYear(year: EraId): void {
    if (!ERA_IDS.includes(year)) {
      throw new TypeError(`setYear only accepts one of ${ERA_IDS.join(' | ')}; got ${String(year)}`);
    }
    if (year === selectedYear) {
      return;
    }
    previousYear = selectedYear;
    selectedYear = year;
    transitionProgress = TRANSITION_START;
    notify();
  }

  function unsubscribe(listener: (state: EraState) => void): void {
    listeners.delete(listener);
  }

  function subscribe(listener: (state: EraState) => void): () => void {
    listeners.add(listener);
    return () => unsubscribe(listener);
  }

  function stop(): void {
    playingYearIndex = 0;
    isPlaying = false;
    if (playTimer !== null) {
      clearTimeout(playTimer);
      playTimer = null;
    }
  }

  function play(): () => void {
    if (isPlaying) {
      return stop;
    }
    isPlaying = true;
    playingYearIndex = 1;
    const tick = (): void => {
      if (!isPlaying) {
        return;
      }
      if (playingYearIndex >= ERA_COUNT) {
        stop();
        return;
      }
      const nextYear = ERA_IDS[playingYearIndex];
      setYear(nextYear);
      playingYearIndex += 1;
      playTimer = setTimeout(tick, DEFAULT_PLAY_STEP_SECONDS * 1000);
    };
    playTimer = setTimeout(tick, DEFAULT_PLAY_STEP_SECONDS * 1000);
    return stop;
  }

  function clear(): void {
    stop();
    listeners.clear();
  }

  return { getSnapshot, setYear, subscribe, play, stop, clear };
}

/**
 * Module-level shared store. All subsystems consume this singleton so they all
 * observe the same era state. `createEraStateStore()` is exported for tests and
 * multi-store scenarios.
 */
export const eraStateStore: EraStateStore = createEraStateStore();