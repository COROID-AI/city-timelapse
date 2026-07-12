/**
 * src/eraController.ts
 * ----------------------------------------------------------------------------
 * Centralized era switching for the "City Timelapse 1945-2055" scene.
 *
 * The EraController is intentionally UI-framework free (plain TypeScript). It
 * owns the single source of truth for *which era the scene is in* and for the
 * animated transition between two eras. Every downstream system — the asset
 * builders, the procedural audio mixer and the particle system — subscribes to
 * this controller once and reacts to era changes, so none of them ever needs to
 * read the HUD directly.
 *
 * Public surface (acceptance criteria):
 *   - setEra(id)        : snap instantly to an era (cancels any in-progress tween)
 *   - tweenToEra(id)    : smoothly crossfade to an era (default 600ms, eased)
 *   - currentEra        : the era a transition originates from (or the settled era)
 *   - targetEra         : the era a transition is heading to (=== currentEra when idle)
 *   - progress          : eased transition progress, 0..1 (1 when idle/settled)
 *   - subscribe(obs)    : register an observer that reacts to change/settle
 *
 * Constraints honored:
 *   - Plain TS, no builder / audio / particle / DOM-framework imports.
 *   - Tween duration is parameterizable; default 600ms.
 * ----------------------------------------------------------------------------
 */

import type { EraId } from './eras';
import { ERA_BY_ID } from './eras';

/** Default crossfade duration in milliseconds. */
export const DEFAULT_TWEEN_DURATION_MS = 600;

/**
 * Canonical ease-in-out cubic curve. Used by default for both the exposed
 * `progress` and the interpolated year so timeline motion feels organic.
 */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Immutable snapshot of the controller's transition state, handed to observers
 * on every animation frame and on settle. Contains everything a builder, the
 * audio mixer, the particle system or the HUD needs to react.
 */
export interface EraTransitionSnapshot {
  /** Era the current transition originated from (=== targetEra when idle). */
  readonly currentEra: EraId;
  /** Era the transition is heading towards. */
  readonly targetEra: EraId;
  /** Eased transition progress, 0..1. Equals 1 when idle/settled. */
  readonly progress: number;
  /** Year interpolated between the from/to eras by eased progress. */
  readonly interpolatedYear: number;
  /** True while a tween is actively animating. */
  readonly active: boolean;
}

/**
 * Observer contract. Both callbacks are optional; implement only what you need.
 *  - onEraChange: fired every animation frame during a tween (and once on
 *    snap/settle) with a fresh {@link EraTransitionSnapshot}.
 *  - onEraSettle: fired once when a transition completes (or immediately on
 *    setEra) with the now-current {@link EraId}.
 */
export interface EraObserver {
  onEraChange?(snapshot: EraTransitionSnapshot): void;
  onEraSettle?(era: EraId): void;
}

/** Construction options for {@link EraController}. */
export interface EraControllerOptions {
  /** Era to start on. Defaults to the earliest era ('1945'). */
  readonly initialEra?: EraId;
  /** Per-transition duration in ms. Defaults to {@link DEFAULT_TWEEN_DURATION_MS}. */
  readonly tweenDurationMs?: number;
  /** Easing function applied to raw linear progress. Defaults to easeInOutCubic. */
  readonly easing?: (t: number) => number;
  /**
   * Frame scheduler injection point (defaults to requestAnimationFrame).
   * Useful for deterministic tests / headless environments.
   */
  readonly requestFrame?: (cb: FrameRequestCallback) => number;
  /** Frame canceller injection point (defaults to cancelAnimationFrame). */
  readonly cancelFrame?: (handle: number) => void;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class EraController {
  private readonly _observers = new Set<EraObserver>();
  private readonly _easing: (t: number) => number;
  private readonly _duration: number;
  private readonly _requestFrame: (cb: FrameRequestCallback) => number;
  private readonly _cancelFrame: (handle: number) => void;

  private _currentEra: EraId;
  private _targetEra: EraId;
  private _progress = 1; // raw linear 0..1; the public `progress` applies easing
  private _fromYear: number;
  private _toYear: number;
  private _active = false;

  private _rafHandle: number | null = null;
  private _startTs: number | null = null;

  constructor(options: EraControllerOptions = {}) {
    const initial: EraId = options.initialEra ?? '1945';
    const initialYear = ERA_BY_ID[initial].year;
    this._currentEra = initial;
    this._targetEra = initial;
    this._fromYear = initialYear;
    this._toYear = initialYear;

    this._duration = Math.max(0, options.tweenDurationMs ?? DEFAULT_TWEEN_DURATION_MS);
    this._easing = options.easing ?? easeInOutCubic;
    this._requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this._cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  }

  // -------------------------------------------------------------------------
  // Read-only state (acceptance criteria surface)
  // -------------------------------------------------------------------------

  /** Era the current transition originates from; the settled era when idle. */
  get currentEra(): EraId {
    return this._currentEra;
  }

  /** Era the current transition is heading to. Equal to currentEra when idle. */
  get targetEra(): EraId {
    return this._targetEra;
  }

  /** Eased transition progress, 0..1 (1 when idle or settled). */
  get progress(): number {
    return this._easing(this._progress);
  }

  /** Year interpolated between the from/to eras using eased progress. */
  get interpolatedYear(): number {
    return lerp(this._fromYear, this._toYear, this.progress);
  }

  /** True while a tween is actively animating. */
  get isAnimating(): boolean {
    return this._active;
  }

  /** Build an immutable snapshot of the full transition state. */
  getSnapshot(): EraTransitionSnapshot {
    return {
      currentEra: this._currentEra,
      targetEra: this._targetEra,
      progress: this.progress,
      interpolatedYear: this.interpolatedYear,
      active: this._active,
    };
  }

  // -------------------------------------------------------------------------
  // Observer wiring
  // -------------------------------------------------------------------------

  /**
   * Register an observer. Returns an unsubscribe function. The observer is not
   * notified of the current state on subscribe — call {@link getSnapshot} if you
   * need to initialize from the present state.
   */
  subscribe(observer: EraObserver): () => void {
    this._observers.add(observer);
    return () => {
      this._observers.delete(observer);
    };
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * Snap instantly to an era, cancelling any in-progress tween. Emits a final
   * change snapshot (progress 1) followed by a settle event.
   */
  setEra(id: EraId): void {
    this.stopAnimation();
    const year = ERA_BY_ID[id].year;
    this._currentEra = id;
    this._targetEra = id;
    this._fromYear = year;
    this._toYear = year;
    this._progress = 1;
    this._active = false;
    this.emitChange();
    this.emitSettle(id);
  }

  /**
   * Smoothly tween to an era using the configured duration and easing. Calling
   * this while a tween is already running retargets mid-flight: the discrete
   * origin becomes the previous destination and the numeric start point is
   * captured from the live interpolated year, so the displayed year never jumps.
   *
   * No-op when already heading to (or settled on) the requested era.
   */
  tweenToEra(id: EraId): void {
    if (id === this._targetEra) return;

    const liveYear = this.interpolatedYear;
    this._currentEra = this._targetEra; // discrete origin = previous destination
    this._targetEra = id;
    this._fromYear = liveYear;
    this._toYear = ERA_BY_ID[id].year;
    this._progress = 0;
    this._startTs = null;

    if (this._duration <= 0) {
      this.settle();
      return;
    }

    this._active = true;
    this.emitChange();
    this.startAnimation();
  }

  // -------------------------------------------------------------------------
  // Internal animation plumbing
  // -------------------------------------------------------------------------

  private startAnimation(): void {
    this.stopAnimation();
    this._rafHandle = this._requestFrame(this.tick);
  }

  private stopAnimation(): void {
    if (this._rafHandle !== null) {
      this._cancelFrame(this._rafHandle);
      this._rafHandle = null;
    }
    this._startTs = null;
  }

  /** rAF callback. Advances raw linear progress and settles when complete. */
  private readonly tick = (ts: number): void => {
    if (this._startTs === null) this._startTs = ts;
    const elapsed = ts - this._startTs;
    const raw = elapsed >= this._duration ? 1 : elapsed / this._duration;
    this._progress = raw;

    if (raw >= 1) {
      this.settle();
      return;
    }

    this.emitChange();
    this._rafHandle = this._requestFrame(this.tick);
  };

  /** Finalize a transition: lock to the target and notify observers. */
  private settle(): void {
    this.stopAnimation();
    const year = ERA_BY_ID[this._targetEra].year;
    this._currentEra = this._targetEra;
    this._fromYear = year;
    this._toYear = year;
    this._progress = 1;
    this._active = false;
    this.emitChange();
    this.emitSettle(this._targetEra);
  }

  private emitChange(): void {
    const snapshot = this.getSnapshot();
    for (const observer of this._observers) {
      observer.onEraChange?.(snapshot);
    }
  }

  private emitSettle(era: EraId): void {
    for (const observer of this._observers) {
      observer.onEraSettle?.(era);
    }
  }

  /** Tear down: cancel any running tween and drop all observers. */
  dispose(): void {
    this.stopAnimation();
    this._observers.clear();
  }
}
