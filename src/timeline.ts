import { ERA_IDS, clampTweenDuration, assertValidEraIndex } from './eras/constants';
import { ERA_LIST } from './eras/data';
import type { EraDescriptor, EraId } from './eras/types';

export interface TimelineState {
  /** Currently selected era index (0..4). */
  current: number;
  /** Era we are tweening toward, or null when idle. */
  pending: number | null;
}

export type TimelineListener = (state: TimelineState) => void;

/**
 * Timeline state machine. Holds the current era, validates transitions, clamps
 * tween durations, and notifies listeners on change. Invalid indices are
 * rejected (per the test plan).
 */
export class Timeline {
  private state: TimelineState = { current: 0, pending: null };
  private listeners = new Set<TimelineListener>();
  private tweenTimer: number | null = null;

  /** Register a listener; returns an unsubscribe fn. */
  subscribe(listener: TimelineListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): TimelineState {
    return { ...this.state };
  }

  get currentIndex(): number {
    return this.state.current;
  }

  get currentEra(): EraDescriptor {
    return ERA_LIST[this.state.current];
  }

  get currentId(): EraId {
    return ERA_IDS[this.state.current];
  }

  /**
   * Request a transition to `index`. Validates the index, clamps the tween
   * duration, sets `pending`, and fires listeners. Resolves the actual current
   * era once the tween completes.
   */
  select(index: number, durationMs = 800): number {
    assertValidEraIndex(index);
    const duration = clampTweenDuration(durationMs);
    if (index === this.state.current) {
      return this.state.current;
    }

    // Cancel any in-flight tween before starting a new one.
    this.clearTimer();
    this.state = { current: this.state.current, pending: index };
    this.emit();

    if (duration <= 0) {
      this.commit(index);
    } else {
      this.tweenTimer = window.setTimeout(() => {
        this.commit(index);
      }, duration);
    }
    return index;
  }

  /** Immediately cancel an in-flight tween without committing the target. */
  cancel(): void {
    this.clearTimer();
    if (this.state.pending !== null) {
      this.state = { current: this.state.current, pending: null };
      this.emit();
    }
  }

  /** Jump directly with no tween (used for programmatic resets / tests). */
  setImmediate(index: number): void {
    assertValidEraIndex(index);
    this.clearTimer();
    this.state = { current: index, pending: null };
    this.emit();
  }

  private commit(index: number): void {
    this.clearTimer();
    this.state = { current: index, pending: null };
    this.emit();
  }

  private clearTimer(): void {
    if (this.tweenTimer !== null) {
      clearTimeout(this.tweenTimer);
      this.tweenTimer = null;
    }
  }

  private emit(): void {
    const snapshot = { ...this.state };
    for (const l of this.listeners) l(snapshot);
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }
}
