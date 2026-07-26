import { Era, ERAS, getEraIndex, lerpEras } from '../eras';

/**
 * EraTransitionManager — smooth, debounced era transitions.
 *
 * Addresses finding: "Era transition animation jank with rapid slider changes"
 * Strategy:
 *  - Debounce rapid slider changes: only start a new transition after
 *    the user stops sliding for a short period.
 *  - Throttle: if a transition is in progress, queue the target era
 *    and animate to it smoothly after the current transition completes.
 *  - Use a smooth easing function (cosine interpolation) for natural motion.
 *  - Provide progress callbacks for all animated properties.
 */
export type TransitionCallback = (era: Era, progress: number) => void;

export class EraTransitionManager {
  private targetEraIndex: number = 0;
  private currentEraIndex: number = 0;
  private progress: number = 0;
  private transitionDuration: number = 2000; // ms
  private startTime: number = 0;
  private isTransitioning: boolean = false;
  private pendingTargetIndex: number | null = null;
  private callbacks: TransitionCallback[] = [];
  private debounceTimer: number | null = null;
  private debounceDelay: number = 150; // ms
  private lastEra: Era = ERAS[0];
  private nextEra: Era = ERAS[0];
  private currentEra: Era = ERAS[0];

  constructor(initialEraIndex: number = 0) {
    this.currentEraIndex = initialEraIndex;
    this.targetEraIndex = initialEraIndex;
    this.currentEra = ERAS[initialEraIndex];
    this.lastEra = ERAS[initialEraIndex];
    this.nextEra = ERAS[initialEraIndex];
  }

  /**
   * Called when the user selects a new era via the slider.
   * Debounces rapid changes and queues transitions smoothly.
   */
  setTargetEra(year: number): void {
    const newIndex = getEraIndex(year);
    if (newIndex === this.currentEraIndex && !this.isTransitioning) {
      this.progress = 1;
      this.notifyCallbacks();
      return;
    }

    // If already transitioning, queue the new target
    if (this.isTransitioning) {
      this.pendingTargetIndex = newIndex;
      // Extend the transition time to allow smooth handoff
      return;
    }

    // Debounce: wait for user to stop sliding
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.startTransition(newIndex);
    }, this.debounceDelay) as unknown as number;
  }

  private startTransition(targetIndex: number): void {
    if (targetIndex === this.currentEraIndex) {
      this.progress = 1;
      this.notifyCallbacks();
      return;
    }

    this.targetEraIndex = targetIndex;
    this.isTransitioning = true;
    this.progress = 0;
    this.startTime = performance.now();
    this.lastEra = ERAS[this.currentEraIndex];
    this.nextEra = ERAS[targetIndex];

    this.animate();
  }

  private animate = (): void => {
    if (!this.isTransitioning) return;

    const elapsed = performance.now() - this.startTime;
    const rawProgress = Math.min(elapsed / this.transitionDuration, 1);

    // Cosine easing for smooth acceleration/deceleration
    this.progress = 1 - Math.cos(rawProgress * Math.PI) / 2;

    this.notifyCallbacks();

    if (rawProgress >= 1) {
      this.completeTransition();
    } else {
      requestAnimationFrame(this.animate);
    }
  };

  private completeTransition(): void {
    this.isTransitioning = false;
    this.currentEraIndex = this.targetEraIndex;
    this.currentEra = ERAS[this.currentEraIndex];
    this.progress = 1;
    this.notifyCallbacks();

    // Check if a new target was queued during transition
    if (this.pendingTargetIndex !== null && this.pendingTargetIndex !== this.currentEraIndex) {
      const queuedTarget = this.pendingTargetIndex;
      this.pendingTargetIndex = null;
      // Start next transition immediately
      this.startTransition(queuedTarget);
    }
  }

  private notifyCallbacks(): void {
    const interpolatedEra = lerpEras(this.lastEra, this.nextEra, this.progress);
    this.callbacks.forEach((cb) => cb(interpolatedEra, this.progress));
  }

  /**
   * Register a callback to receive era updates during transitions.
   */
  subscribe(callback: TransitionCallback): () => void {
    this.callbacks.push(callback);
    // Immediately notify with current state
    callback(this.currentEra, 1);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  getCurrentEra(): Era {
    return this.currentEra;
  }

  getCurrentEraIndex(): number {
    return this.currentEraIndex;
  }

  getProgress(): number {
    return this.progress;
  }

  isCurrentlyTransitioning(): boolean {
    return this.isTransitioning;
  }

  setTransitionDuration(duration: number): void {
    this.transitionDuration = Math.max(500, Math.min(5000, duration));
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.isTransitioning = false;
    this.callbacks = [];
  }
}
