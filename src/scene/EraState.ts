// =============================================================================
// City Timelapse — Era State Controller (singleton)
//
// A tiny, dependency-free pub/sub store that owns the single shared era and a
// normalized `t` position along the timeline (0 = 1945, 1 = 2055). Every
// later subsystem (timeline UI, visuals, SFX, music) subscribes to it so era
// transitions are coordinated and consistent.
//
// `setEraId` animates `t` from its current value to the target era's fixed
// position using a bounded ~1.5s easeInOutCubic ramp. Consecutive calls cancel
// any in-flight tween and restart from the current `t`.
// =============================================================================

import { ERA_IDS, ERA_REGISTRY, type EraId } from '../eras';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A snapshot emitted to subscribers on every animation frame of a tween. */
export interface EraStateUpdate {
  /** The current (target) era id — the most recently requested stop. */
  readonly eraId: EraId;
  /** Normalized position along the timeline, 0 (1945) .. 1 (2055). */
  readonly t: number;
  /** The era id this transition started from. */
  readonly prevEraId: EraId;
}

/** Listener invoked with each {@link EraStateUpdate}. */
export type EraStateListener = (update: EraStateUpdate) => void;

/** Options accepted by {@link EraState.setEraId}. */
export interface SetEraOptions {
  /** Override the default (~1.5s) transition duration, in milliseconds. */
  readonly durationMs?: number;
  /** Invoked once when the tween reaches its target. */
  readonly onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Default transition duration — the "bounded ~1.5s" ramp. */
const DEFAULT_DURATION_MS = 1500;

/** Upper clamp for an explicitly requested duration, in milliseconds. */
const MAX_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

/** Smooth accelerate-decelerate curve. `p` must be clamped to 0..1 by callers. Exported so other subsystems (camera tweens, etc.) stay visually consistent with era morphs. */
export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/** Fixed normalized timeline position for an era (0 = first, 1 = last). */
function eraPosition(id: EraId): number {
  const last = ERA_REGISTRY.length - 1;
  return last > 0 ? ERA_IDS.indexOf(id) / last : 0;
}

// ---------------------------------------------------------------------------
// EraState
// ---------------------------------------------------------------------------

/**
 * Singleton era state controller. Exported as the module-level {@link eraState}
 * instance so every consumer imports the same object — no dependency injection.
 */
export class EraState {
  /** Current (target) era id. */
  private _eraId: EraId;

  /** Era id the current transition started from. */
  private _prevEraId: EraId;

  /** Current normalized timeline position, 0..1. */
  private _t: number;

  /** Registered subscribers. */
  private readonly _listeners = new Set<EraStateListener>();

  /** Active requestAnimationFrame handle, or null when idle. */
  private _rafId: number | null = null;

  /** Generation counter; incrementing invalidates any pending rAF closure. */
  private _runId = 0;

  constructor(initial: EraId = ERA_IDS[0]) {
    this._eraId = initial;
    this._prevEraId = initial;
    this._t = eraPosition(initial);
  }

  /** Returns the current (target) era id. */
  public getEraId(): EraId {
    return this._eraId;
  }

  /** Returns the current normalized timeline position (0..1). */
  public getT(): number {
    return this._t;
  }

  /**
   * Transition to a new era. Animates `t` from its current value to the
   * target era's fixed position with an easeInOutCubic ramp over the given
   * (or default ~1.5s) duration. Consecutive calls cancel any in-flight tween
   * and restart from the current `t`.
   *
   * Subscribers receive a frame for every animation step of the tween (plus a
   * final settled frame). {@link onComplete}, if provided, fires once when the
   * tween finishes or immediately on an instant snap.
   */
  public setEraId(id: EraId, options: SetEraOptions = {}): void {
    const durationMs =
      options.durationMs === undefined
        ? DEFAULT_DURATION_MS
        : Math.max(0, Math.min(options.durationMs, MAX_DURATION_MS));

    // Cancel any in-flight tween first.
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Record the source era, then commit the new target.
    this._prevEraId = this._eraId;
    this._eraId = id;

    const from = this._t;
    const to = eraPosition(id);

    // Instant snap: zero duration or already at the target position.
    if (durationMs <= 0 || from === to) {
      this._t = to;
      this.emit();
      options.onComplete?.();
      return;
    }

    // Start a fresh tween generation from the current `t`.
    const runId = ++this._runId;
    const start = performance.now();

    const tick = (now: number): void => {
      // Superseded by a newer setEraId call — stop silently.
      if (runId !== this._runId) return;

      const p = Math.min((now - start) / durationMs, 1);
      this._t = from + (to - from) * easeInOutCubic(p);
      this.emit();

      if (p < 1) {
        this._rafId = requestAnimationFrame(tick);
      } else {
        // Clamp to the exact target and settle.
        this._t = to;
        this._rafId = null;
        options.onComplete?.();
      }
    };

    this._rafId = requestAnimationFrame(tick);
  }

  /**
   * Register a listener. Returns an unsubscribe function. The listener is NOT
   * auto-fired on subscribe; read {@link getEraId} / {@link getT} for the
   * current state at mount.
   */
  public subscribe(fn: EraStateListener): () => void {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  /** Notify all subscribers with the current state. */
  private emit(): void {
    const update: EraStateUpdate = {
      eraId: this._eraId,
      t: this._t,
      prevEraId: this._prevEraId,
    };
    for (const listener of this._listeners) {
      listener(update);
    }
  }
}

// ---------------------------------------------------------------------------
