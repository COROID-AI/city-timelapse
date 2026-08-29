/**
 * TransformationEngine: drives era morphing across every registered scene
 * subsystem.
 *
 * The engine is a pure blend driver. It never owns era datasets — each
 * subsystem supplies them through `SceneRegistry.register()` / `build(era)`
 * — and it never swaps the scene instantly. On `setYear()` it starts a
 * transition and, on every rendered frame, calls each registered subsystem's
 * `applyEraBlend(fromEra, toEra, t)` with `t` eased 0→1 via smoothstep over a
 * configurable duration (default 1.5s).
 *
 * Re-targeting: the scene always renders from a continuous era position
 * (`eraFloat`, an index over `ERA_IDS`). When `setYear()` is called mid-blend
 * the engine re-anchors the transition on the *current* blended position —
 * the new `fromEra` is the era at that position and the eased clock starts at
 * exactly the progress that reproduces the current frame — so the morph
 * smoothly re-routes to the new era without popping back to the old one.
 */
import { ERA_IDS, type EraId } from './eras';
import { listSubsystems } from './SceneRegistry';
import type { EraScopedSubsystem } from './SceneRegistry';

/** Number of eras in the shared registry (0..n-1 continuous era range). */
const ERA_FLOAT_MAX = Math.max(0, ERA_IDS.length - 1);

const DEFAULT_DURATION_SEC = 1.5;

/** Tolerance used to detect the end of a transition despite float drift. */
const LINEAR_EPSILON = 1e-9;

/** Options accepted by the TransformationEngine constructor. */
export interface TransformationEngineOptions {
  /** Full blend duration in seconds (default 1.5s). */
  readonly durationSec?: number;
}

/** How smoothstep easing maps a linear progress value. */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Inverse of `smoothstep` on [0,1]; used to resume a blend mid-curve. */
export function inverseSmoothstep(y: number): number {
  const x = Math.min(1, Math.max(0, y));
  return 0.5 + Math.sin(Math.asin(2 * x - 1) / 3);
}

/**
 * Drives era morphing for every subsystem registered in the SceneRegistry.
 *
 * The composition root owns the animation loop and calls `tick(dtSec)` every
 * frame (or `updateFrame(timeMs)` when its loop reports absolute time). During
 * a transition the engine calls each subsystem's
 * `applyEraBlend(fromEra, toEra, t)` once per frame for every registered
 * subsystem (which applies the blend to all of its groups in that same pass),
 * with `t` eased 0→1 via smoothstep over `durationSec`.
 */
export class TransformationEngine {
  /** Full duration of an era transition, in seconds. */
  readonly durationSec: number;
  /** Linear progress of the active transition (0..1). */
  private linearProgress = 0;
  /** Eased progress of the active transition (0 = at fromEra, 1 = at toEra). */
  private easedProgress = 0;
  /** Milliseconds of the previous updateFrame() call (wall-clock delta). */
  private lastFrameMs: number | undefined;
  /** Continuous era position the whole scene currently renders at. */
  private eraFloat: number;
  /** Active transition start/end era ids (undefined when idle). */
  private fromEra: EraId | undefined;
  private toEra: EraId | undefined;
  private readonly subsystems = new Map<string, EraScopedSubsystem>();

  constructor(options: TransformationEngineOptions = {}, subsystems: readonly EraScopedSubsystem[] = []) {
    this.durationSec = options.durationSec ?? DEFAULT_DURATION_SEC;
    this.eraFloat = 0;
    for (const subsystem of subsystems) this.addSubsystem(subsystem);
  }

  /** Registers a subsystem (plus all of its groups) as a blend listener. */
  addSubsystem(subsystem: EraScopedSubsystem): void {
    this.subsystems.set(subsystem.groupId, subsystem);
  }

  /** Removes a subsystem by group id. Returns true when it was present. */
  removeSubsystem(groupId: string): boolean {
    return this.subsystems.delete(groupId);
  }

  /**
   * Re-targets the scene to the given era. If a transition is already running
   * this re-anchors from the current blended position, so the morph continues
   * from where it visually is instead of popping back to the source era.
   */
  setYear(eraId: EraId): void {
    const targetIndex = ERA_IDS.indexOf(eraId);
    if (targetIndex < 0) throw new Error(`Unknown era id: ${String(eraId)}`);

    const display = this.eraFloat;
    if (targetIndex === display) {
      // Already exactly at this era — nothing to blend.
      this.fromEra = undefined;
      this.toEra = undefined;
      return;
    }

    let fromIndex: number;
    if (targetIndex > display) {
      // Moving forward: the current frame lives between floor(display) and
      // floor(display)+1, or exactly on floor(display).
      fromIndex = Math.floor(display);
    } else {
      // Moving backward: the current frame lives between ceil(display)-1 and
      // ceil(display), or exactly on ceil(display).
      fromIndex = Math.ceil(display);
    }

    // Progress within the new from→to segment that reproduces the current
    // blended frame (0 = from, 1 = to). Works for both directions.
    const span = targetIndex - fromIndex;
    if (span === 0) {
      this.fromEra = undefined;
      this.toEra = undefined;
      return;
    }
    const p0 = Math.min(1, Math.max(0, (display - fromIndex) / span));

    this.fromEra = indexToEra(fromIndex);
    this.toEra = eraId;
    this.linearProgress = inverseSmoothstep(p0);
    this.easedProgress = p0;
  }

  /**
   * Advances the blend by delta seconds and applies it to every registered
   * subsystem. The current eased state is applied first (so the first frame
   * after `setYear()` reports t=0 and re-targeting resumes at the exact
   * blended progress), then the clock advances and the final frame settles on
   * exactly t=1.
   */
  tick(dtSec: number): void {
    const from = this.fromEra;
    const to = this.toEra;
    if (from === undefined || to === undefined || from === to) return;

    // 1. Render the current blended state (t=0 on the first frame of a fresh
    //    transition; the exact resumption point after re-targeting).
    this.applyBlend(from, to, this.easedProgress);
    if (this.linearProgress >= 1) {
      this.finishTransition();
      return;
    }

    // 2. Advance the eased clock.
    const next = this.linearProgress + Math.max(0, dtSec) / this.durationSec;
    if (next >= 1 - LINEAR_EPSILON) {
      // The transition has reached its end (within float tolerance): settle
      // exactly on the target so applyEraBlend is always called with t=1 on
      // the final rendered frame.
      this.applyBlend(from, to, 1);
      this.finishTransition();
      return;
    }

    this.linearProgress = next;
    this.easedProgress = smoothstep(next);
  }

  /**
   * Convenience for the composition root's `setAnimationLoop((timeMs) => …)`:
   * advances the engine by the wall-clock delta between sequential calls.
   */
  updateFrame(timeMs: number): void {
    const t = Math.max(0, timeMs);
    if (this.lastFrameMs !== undefined) this.tick((t - this.lastFrameMs) / 1000);
    this.lastFrameMs = t;
  }

  /** Stops any running transition, leaving every subsystem at its target. */
  finishTransition(): void {
    this.toEra = undefined;
    this.fromEra = undefined;
    this.linearProgress = 1;
    this.easedProgress = 1;
  }

  /** True while a transition is running. */
  isTransitioning(): boolean {
    return this.toEra !== undefined;
  }

  /** Current era id (rounded from the continuous blended era position). */
  getYear(): EraId {
    return indexToEra(Math.round(this.eraFloat));
  }

  /** Continuous era position (fractional index over ERA_IDS). */
  getEraFloat(): number {
    return this.eraFloat;
  }

  /** Clears every registered subsystem (tests / hot module disposal). */
  clear(): void {
    this.subsystems.clear();
  }

  /** Builds an engine populated from the global SceneRegistry. */
  static fromRegistry(options: TransformationEngineOptions = {}): TransformationEngine {
    return new TransformationEngine(options, listSubsystems());
  }

  private applyBlend(from: EraId, to: EraId, t: number): void {
    this.eraFloat = lerp(eraIndex(from), eraIndex(to), t);
    for (const subsystem of this.subsystems.values()) {
      subsystem.applyEraBlend(from, to, t);
    }
  }
}

/** Converts an era id to its registry index. */
function eraIndex(era: EraId): number {
  return ERA_IDS.indexOf(era);
}

/** Converts a registry index to an era id, clamped to valid range. */
function indexToEra(index: number): EraId {
  return ERA_IDS[Math.min(Math.max(0, index), ERA_FLOAT_MAX)];
}

/** Linear interpolation helper. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}