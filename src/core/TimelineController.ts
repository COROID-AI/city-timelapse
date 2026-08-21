import { isEraId } from '../eras/types';
import type { EraId } from '../eras/types';

/** Immutable snapshot describing where the timeline currently points. */
export interface EraTransitionState {
  /** Era the outgoing interpolation starts from. */
  readonly from: EraId;
  /** Era currently selected; the interpolation target. */
  readonly to: EraId;
  /**
   * Normalized (0..1) eased progress of the transition from `from` to `to`.
   * `1` means fully arrived at `to`.
   */
  readonly t: number;
  /** True when no transition is running and `t` is parked at 1. */
  readonly settled: boolean;
}

export type TimelineListener = (state: EraTransitionState) => void;

export interface TimelineControllerOptions {
  readonly initialEra?: EraId;
  /** Full transition length in seconds (default 2). */
  readonly transitionSeconds?: number;
  /** Transition length under prefers-reduced-motion (default 0.35). */
  readonly reducedMotionSeconds?: number;
}

const DEFAULT_TRANSITION_SECONDS = 2;
const DEFAULT_REDUCED_MOTION_SECONDS = 0.35;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (x: number): number => x * x * (3 - 2 * x);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Single source of truth for the timeline. Owns the selected era and the
 * transition clock; scene modules subscribe and interpolate using the
 * normalized `t` value carried by every emitted {@link EraTransitionState}.
 */
export class TimelineController {
  readonly #listeners = new Set<TimelineListener>();
  readonly #transitionSeconds: number;
  readonly #reducedMotionSeconds: number;

  #current: EraId;
  #previous: EraId;
  #elapsed: number;
  #settled: boolean;
  #snapshot: EraTransitionState;

  constructor(options: TimelineControllerOptions = {}) {
    const initial = options.initialEra ?? '1945';
    if (!isEraId(initial)) {
      throw new TypeError(`TimelineController: unknown initial era "${String(initial)}"`);
    }
    this.#transitionSeconds = Math.max(
      options.transitionSeconds ?? DEFAULT_TRANSITION_SECONDS,
      0.05,
    );
    this.#reducedMotionSeconds = Math.max(
      options.reducedMotionSeconds ?? DEFAULT_REDUCED_MOTION_SECONDS,
      0.05,
    );
    this.#current = initial;
    this.#previous = initial;
    this.#elapsed = this.#transitionSeconds;
    this.#settled = true;
    this.#snapshot = this.#createSnapshot();
  }

  get current(): EraId {
    return this.#current;
  }

  get previous(): EraId {
    return this.#previous;
  }

  /** Normalized eased transition progress (0..1). */
  get t(): number {
    return this.#snapshot.t;
  }

  get settled(): boolean {
    return this.#snapshot.settled;
  }

  get isTransitioning(): boolean {
    return !this.#settled;
  }

  get transitionState(): EraTransitionState {
    return this.#snapshot;
  }

  /** Select a new era and start its transition. No-op for the current era. */
  setEra(id: EraId): void {
    if (!isEraId(id)) {
      throw new TypeError(`TimelineController: unknown era "${String(id)}"`);
    }
    if (id === this.#current) {
      return;
    }
    this.#previous = this.#current;
    this.#current = id;
    this.#elapsed = 0;
    this.#settled = false;
    this.#emit();
  }

  /**
   * Advance the transition clock. Call once per frame with the frame delta in
   * seconds; emits an updated state every frame while a transition runs.
   */
  update(deltaSeconds: number): void {
    if (this.#settled) {
      return;
    }
    this.#elapsed += Number.isFinite(deltaSeconds) ? Math.max(deltaSeconds, 0) : 0;
    if (this.#elapsed >= this.#activeDuration()) {
      this.#elapsed = this.#activeDuration();
      this.#settled = true;
    }
    this.#emit();
  }

  /**
   * Subscribe to timeline state. The listener fires immediately with the
   * current state and again on every change (including per-frame ticks).
   * Returns an unsubscribe function.
   */
  subscribe(listener: TimelineListener): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Drop all listeners; the instance is inert afterwards. */
  dispose(): void {
    this.#listeners.clear();
  }

  #activeDuration(): number {
    return prefersReducedMotion() ? this.#reducedMotionSeconds : this.#transitionSeconds;
  }

  #createSnapshot(): EraTransitionState {
    const raw = this.#settled ? 1 : clamp01(this.#elapsed / this.#activeDuration());
    return Object.freeze({
      from: this.#previous,
      to: this.#current,
      t: smoothstep(raw),
      settled: this.#settled,
    });
  }

  #emit(): void {
    this.#snapshot = this.#createSnapshot();
    for (const listener of [...this.#listeners]) {
      listener(this.#snapshot);
    }
  }
}
