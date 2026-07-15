import { easeInOutCubic } from "../utils/math";
import type { EraIndex } from "../types";

/**
 * Deterministic era-transition state machine.
 *
 * - `progress` is always in [0,1]: 0 means fully at `from`, 1 means fully at `to`.
 * - When not transitioning, `from === to` and progress is 1, so the scene
 *   always reflects a single stable era.
 * - Interruptions (a new target chosen mid-transition) restart deterministically
 *   from the *current* blended state, guaranteeing a well-defined final state.
 * - With reduced motion the duration collapses to ~0, so the final era is
 *   applied essentially instantly while still hitting the exact endpoint.
 */
export class Transitioner {
  from: EraIndex;
  to: EraIndex;
  progress = 1; // start settled at the initial era
  private elapsed = 0;
  private duration: number;
  private readonly reducedMotion: boolean;
  private readonly baseDuration: number;

  constructor(initial: EraIndex, reducedMotion: boolean, baseDuration = 1.4) {
    this.from = initial;
    this.to = initial;
    this.reducedMotion = reducedMotion;
    this.baseDuration = baseDuration;
    this.duration = reducedMotion ? 0.001 : baseDuration;
  }

  /** Whether a transition is currently in flight. */
  get isActive(): boolean {
    return this.progress < 1;
  }

  /** Eased progress in [0,1]. */
  get eased(): number {
    return easeInOutCubic(this.progress);
  }

  /**
   * Begin (or re-target) a transition toward `target`.
   * The current blended state becomes the new `from`, so interruptions are
   * seamless and always converge on the requested final era.
   */
  setTarget(target: EraIndex): void {
    if (target === this.to && this.progress >= 1) return;
    // Snapshot the current blended era as the new origin.
    if (this.progress < 1) {
      this.from = this.currentEraIndex();
    } else {
      this.from = this.to;
    }
    this.to = target;
    this.elapsed = 0;
    this.progress = 0;
    this.duration = this.reducedMotion ? 0.001 : this.baseDuration;
  }

  /** Advance the transition by dt seconds (clamped for stability). */
  update(dt: number): void {
    if (this.progress >= 1) return;
    this.elapsed += dt > 0.1 ? 0.1 : dt; // guard against tab-suspension jumps
    this.progress = this.elapsed / this.duration;
    if (this.progress >= 1) {
      this.progress = 1;
      this.from = this.to; // collapse to a single settled era
    }
  }

  /**
   * The effective era index for the *current* blended state. Used to decide
   * which adjacent era set to keep resident while crossfading.
   */
  currentEraIndex(): EraIndex {
    return this.eased < 0.5 ? this.from : this.to;
  }

  /** Force an immediate snap to an era (reduced-motion / fallback). */
  snapTo(era: EraIndex): void {
    this.from = era;
    this.to = era;
    this.progress = 1;
    this.elapsed = this.duration;
  }
}
