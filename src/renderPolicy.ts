/**
 * Adaptive render policy for the City Time Period Timelapse.
 *
 * Caps the cost of continuous animation by throttling the render frequency.
 * The policy measures actual GPU frame times and, when rendering is over
 * budget, adaptively skips render frames to maintain a stable experience
 * without spiralling into unbounded frame times.
 *
 * **Design:**
 * - Simulation updates (traffic, pedestrians, camera, audio) always run every
 *   animation frame — only the expensive GPU draw call (`renderer.render`)
 *   is gated by {@link RenderPolicy.shouldRender}.
 * - A rolling average of render times drives adaptive throttling: if frames
 *   are consistently slower than the budget, the effective FPS is reduced
 *   down to a configurable floor; when performance recovers, the rate
 *   climbs back toward the target.
 * - The accumulator subtracts (rather than resets) the consumed interval to
 *   avoid drift, and is clamped after long stalls to prevent the
 *   spiral-of-death.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration for {@link RenderPolicy}. */
export interface RenderPolicyOptions {
  /** Target frame rate in FPS. Default: 60. */
  targetFps?: number;
  /** Minimum frame rate the policy will throttle down to. Default: 24. */
  minFps?: number;
  /** Number of frames to average for adaptive decisions. Default: 30. */
  sampleWindow?: number;
  /** Factor (1+) above budget that triggers throttling. Default: 1.15. */
  throttleThreshold?: number;
  /** Factor (0–1) below budget that triggers recovery. Default: 0.85. */
  recoveryThreshold?: number;
}

// ---------------------------------------------------------------------------
// RenderPolicy class
// ---------------------------------------------------------------------------

/**
 * An adaptive frame-rate cap for the continuous animation render loop.
 *
 * Usage:
 * ```ts
 * const policy = new RenderPolicy({ targetFps: 60 });
 * let last = performance.now();
 * const loop = () => {
 *   requestAnimationFrame(loop);
 *   const now = performance.now();
 *   const dt = now - last;
 *   last = now;
 *   composer.update();            // always advance the simulation
 *   if (policy.shouldRender(dt)) {
 *     const t0 = performance.now();
 *     composer.render();
 *     policy.recordFrameTime(performance.now() - t0);
 *   }
 * };
 * ```
 */
export class RenderPolicy {
  private readonly targetInterval: number;
  private readonly minInterval: number;
  private readonly sampleWindow: number;
  private readonly throttleThreshold: number;
  private readonly recoveryThreshold: number;

  /** Accumulated time since the last rendered frame (ms). */
  private accumulator = 0;
  /** Current minimum interval between renders (ms). */
  private currentInterval: number;
  /** Rolling window of frame render times (ms). */
  private readonly frameTimes: number[] = [];
  /** Total number of frames the policy has skipped. */
  private skippedFrames = 0;

  constructor(options: RenderPolicyOptions = {}) {
    const targetFps = options.targetFps ?? 60;
    const minFps = options.minFps ?? 24;
    this.sampleWindow = options.sampleWindow ?? 30;
    this.throttleThreshold = options.throttleThreshold ?? 1.15;
    this.recoveryThreshold = options.recoveryThreshold ?? 0.85;

    this.targetInterval = 1000 / targetFps;
    this.minInterval = 1000 / minFps;
    this.currentInterval = this.targetInterval;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Determine whether the current frame should be rendered.
   *
   * Accumulates elapsed time and returns `true` when enough has passed for a
   * new render frame. The simulation should always update regardless of this
   * result — only the GPU draw call is gated.
   *
   * @param deltaMs  Elapsed milliseconds since the last animation frame.
   * @returns `true` if the frame should be rendered, `false` to skip.
   */
  shouldRender(deltaMs: number): boolean {
    this.accumulator += deltaMs;
    if (this.accumulator < this.currentInterval) {
      this.skippedFrames++;
      return false;
    }
    // Subtract rather than reset to avoid drift / double-speed after a skip.
    this.accumulator -= this.currentInterval;
    // Clamp to prevent spiral-of-death after long stalls (e.g. tab switch).
    if (this.accumulator > this.currentInterval) {
      this.accumulator = this.currentInterval;
    }
    return true;
  }

  /**
   * Record the wall-clock time taken by a single render call.
   *
   * The policy uses a rolling average of these measurements to adaptively
   * throttle or recover the render frequency.
   *
   * @param renderMs  Milliseconds spent inside `renderer.render()`.
   */
  recordFrameTime(renderMs: number): void {
    this.frameTimes.push(renderMs);
    if (this.frameTimes.length > this.sampleWindow) {
      this.frameTimes.shift();
    }
    this.adapt();
  }

  /** Reset the policy to its initial state (e.g. after a tab regains focus). */
  reset(): void {
    this.accumulator = 0;
    this.frameTimes.length = 0;
    this.currentInterval = this.targetInterval;
    this.skippedFrames = 0;
  }

  /** The current effective frame rate in FPS. */
  get effectiveFps(): number {
    return 1000 / this.currentInterval;
  }

  /** The target frame rate in FPS. */
  get targetFps(): number {
    return 1000 / this.targetInterval;
  }

  /** Total frames skipped since construction (or last {@link reset}). */
  get totalSkipped(): number {
    return this.skippedFrames;
  }

  /** Whether the policy is currently throttled below the target rate. */
  get isThrottled(): boolean {
    return this.currentInterval > this.targetInterval + 0.01;
  }

  // -------------------------------------------------------------------------
  // Private: adaptive throttling
  // -------------------------------------------------------------------------

  /**
   * Examine the rolling average frame time and adjust the render interval.
   *
   * If frames are consistently slower than the budget (target interval ×
   * throttle threshold), the policy increases the interval (lowers FPS) down
   * to the minimum. If frames are consistently faster than the recovery
   * threshold, the policy decreases the interval back toward the target.
   */
  private adapt(): void {
    if (this.frameTimes.length < this.sampleWindow) return;

    let sum = 0;
    for (const t of this.frameTimes) sum += t;
    const avg = sum / this.frameTimes.length;
    const budget = this.targetInterval;

    if (avg > budget * this.throttleThreshold) {
      // Over budget — throttle down (increase interval, lower FPS).
      const next = this.currentInterval * 1.1;
      this.currentInterval = Math.min(this.minInterval, next);
    } else if (avg < budget * this.recoveryThreshold && this.isThrottled) {
      // Under budget — recover toward target (decrease interval, raise FPS).
      const next = this.currentInterval * 0.95;
      this.currentInterval = Math.max(this.targetInterval, next);
    }
  }
}
