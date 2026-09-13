import { clamp } from '../lib/math';
import { ERA_YEARS, type EraId } from './types';

/** In-flight era transition state. */
export interface EraTransition {
  /** Era being left. */
  readonly from: EraId;
  /** Era being entered. */
  readonly to: EraId;
  /** 0 at start, 1 when the transition completes. */
  readonly progress: number;
}

/** Immutable view of the store at one point in time. */
export interface EraStoreSnapshot {
  /** Currently selected (target) era. */
  readonly current: EraId;
  /** Active transition, or null when settled. */
  readonly transition: EraTransition | null;
}

/** Listener invoked whenever the store changes. */
export type EraListener = (snapshot: EraStoreSnapshot) => void;

/** Constructor options for `EraStore`. */
export interface EraStoreOptions {
  /** Era the store starts on; defaults to the earliest timeline stop. */
  initialEra?: EraId;
}

/**
 * Reactive store for the current era and its transition.
 *
 * Framework-free pub/sub: UI (timeline slider), the transition controller and
 * audio wiring subscribe once and react to snapshots; the store never touches
 * the DOM or WebGL, so it runs in node/jsdom tests unchanged.
 *
 * - `requestEra(next)` selects a new era and opens a `from -> to` transition
 *   at progress 0; requesting the current era is an idempotent no-op.
 * - `setTransitionProgress(progress)` advances the active transition (clamped
 *   to [0, 1]); progress 1 settles the store and clears the transition.
 * - `subscribe(listener)` returns an unsubscribe function; listeners are
 *   notified only on actual change.
 */
export class EraStore {
  private currentEra: EraId;
  private activeTransition: EraTransition | null = null;
  private readonly listeners = new Set<EraListener>();

  constructor(options: EraStoreOptions = {}) {
    const initial = options.initialEra ?? ERA_YEARS[0];
    if (!ERA_YEARS.includes(initial)) {
      throw new Error(`EraStore: unknown initial era ${String(initial)}`);
    }
    this.currentEra = initial;
  }

  /** Currently selected (target) era. */
  get current(): EraId {
    return this.currentEra;
  }

  /** Active transition, or null when settled. */
  get transition(): EraTransition | null {
    return this.activeTransition;
  }

  /** Immutable snapshot of the store state. */
  getSnapshot(): EraStoreSnapshot {
    return snapshotOf(this.currentEra, this.activeTransition);
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: EraListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Select `next`, opening a `from -> to` transition at progress 0.
   * Requesting the current era is an idempotent no-op (no notification).
   */
  requestEra(next: EraId): EraStoreSnapshot {
    if (!ERA_YEARS.includes(next)) {
      throw new Error(`EraStore: unknown era ${String(next)}`);
    }
    if (next === this.currentEra) {
      return this.getSnapshot();
    }
    this.activeTransition = { from: this.currentEra, to: next, progress: 0 };
    this.currentEra = next;
    this.notify();
    return this.getSnapshot();
  }

  /**
   * Advance the active transition to `progress` (clamped to [0, 1]).
   * Progress 1 settles the store (transition cleared). Silent no-op when no
   * transition is active or when progress would not change.
   */
  setTransitionProgress(progress: number): EraStoreSnapshot {
    const transition = this.activeTransition;
    if (transition === null) {
      return this.getSnapshot();
    }
    const clamped = clamp(progress, 0, 1);
    if (clamped >= 1) {
      this.activeTransition = null;
      this.notify();
    } else if (clamped !== transition.progress) {
      this.activeTransition = {
        from: transition.from,
        to: transition.to,
        progress: clamped,
      };
      this.notify();
    }
    return this.getSnapshot();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    // Copy so listeners may unsubscribe during notification.
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}

function snapshotOf(current: EraId, transition: EraTransition | null): EraStoreSnapshot {
  return {
    current,
    transition: transition ? { ...transition } : null,
  };
}