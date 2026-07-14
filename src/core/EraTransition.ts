import { ERAS, ERA_COUNT } from '../config/eras';

// A reusable linear-ease toward a target float index across [0, ERA_COUNT-1].
// The scene is built ONCE; this produces a weights vector each frame that
// every scene module interpolates against. Transitions NEVER rebuild geometry.

export type EraWeights = Float32Array;

const tmpA = new Float32Array(ERA_COUNT);

export class EraTransition {
  // Current continuous position across eras, eased toward target.
  private progress = 0;
  private target = 0;
  // Era index that is "settled" (target snapped to it).
  private targetIndex = 0;
  private readonly reduceMotion: boolean;
  // Full-travel seconds for a single era hop under normal motion.
  private readonly normalDuration = 1.4;
  // Reduced motion: snap almost instantly but keep a tiny fade so the
  // "exact final era state" still applies smoothly.
  private readonly reduceDuration = 0.18;
  // True only when progress is within epsilon of an integer era index AND
  // equals target — used to guarantee exact final state application.
  private settled = true;

  constructor(reduceMotion: boolean) {
    this.reduceMotion = reduceMotion;
  }

  /** Snap everything to an era instantly (used during initial build). */
  public setIndexInstant(index: number): void {
    const i = clampIndex(index);
    this.targetIndex = i;
    this.target = i;
    this.progress = i;
    this.settled = true;
  }

  /** Request travel to an era index (slider / keyboard / playback). */
  public requestIndex(index: number): void {
    const i = clampIndex(index);
    if (i === this.targetIndex && this.settled) return;
    this.targetIndex = i;
    this.target = i;
    this.settled = false;
   // Reduced-motion travel time is handled in update() via reduceDuration.
  }

  /** Direct continuous target (for scrubbing the slider smoothly). */
  public requestProgress(p: number): void {
    const clamped = clamp(p, 0, ERA_COUNT - 1);
    this.target = clamped;
    this.targetIndex = Math.round(clamped);
    this.settled = false;
  }

  public getTargetIndex(): number {
    return this.targetIndex;
  }

  public getProgress(): number {
    return this.progress;
  }

  public isReducedMotion(): boolean {
    return this.reduceMotion;
  }

  public isSettled(): boolean {
    return this.settled;
  }

  /** Advance easing by dt seconds. Returns the live weights vector. */
  public update(dt: number): EraWeights {
    const duration = this.reduceMotion ? this.reduceDuration : this.normalDuration;
    if (!this.settled) {
      const rate = 1 / Math.max(0.0001, duration);
      // Frame-rate independent critically-damped-ish ease.
      const t = 1 - Math.exp(-rate * dt * 4.5);
      this.progress += (this.target - this.progress) * t;
      if (Math.abs(this.target - this.progress) < 1e-4) {
        this.progress = this.target;
        this.settled = true;
      }
    }
    return this.getWeights();
  }

  /** Compute the weights vector for the current progress without advancing. */
  public getWeights(): EraWeights {
    const w = tmpA;
    for (let i = 0; i < ERA_COUNT; i++) w[i] = 0;
    const p = this.progress;
    const lo = Math.floor(p);
    const f = p - lo;
    if (lo >= ERA_COUNT - 1) {
      w[ERA_COUNT - 1] = 1;
    } else if (lo < 0) {
      w[0] = 1;
    } else {
      w[lo] = 1 - f;
      w[lo + 1] = f;
    }
    return w;
  }

  /** Number of distinct eras. */
  public count(): number {
    return ERA_COUNT;
  }

  public eraConfig(index: number) {
    return ERAS[clampIndex(index)];
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clampIndex(i: number): number {
  return Math.max(0, Math.min(ERA_COUNT - 1, Math.round(i)));
}

/** Smoothstep for optional easing curves. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
