/**
 * RenderLoop: fixed-timestep-friendly frame driver.
 *
 * The loop decouples simulation updates from wall-clock frames. External
 * code feeds it frame deltas (either manually via {@link RenderLoop.step} or
 * in real time via {@link RenderLoop.start}); the loop accumulates the delta
 * and dispatches update callbacks in whole fixed steps (default 1/60 s), so
 * physics/behavior is deterministic and step-count independent. One render
 * pass (the `render` callback) fires after the fixed steps of each frame.
 */

export type FrameUpdateCallback = (deltaSeconds: number) => void;

export interface RenderLoopOptions {
  /** Fixed simulation step in seconds. Default `1/60`. */
  fixedStepSeconds?: number;
  /**
   * Largest frame delta accepted, in seconds. Larger gaps (tab switches,
   * pauses) are clamped so the loop never bursts a huge number of steps.
   * Default `0.25`.
   */
  maxStepSeconds?: number;
  /**
   * Monotonic clock in milliseconds. Defaults to `performance.now`.
   * Injectable so real-time start() is deterministic in tests.
   */
  clock?: () => number;
}

const MAX_UPDATES_PER_STEP = 256;

export class RenderLoop {
  readonly fixedStepSeconds: number;
  private readonly maxStepSeconds: number;
  private readonly clock: () => number;
  private readonly frameIntervalMs: number;

  private readonly updates = new Set<FrameUpdateCallback>();
  private renderCallback: (() => void) | null = null;

  private accumulatorSeconds = 0;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(options: RenderLoopOptions = {}) {
    const fixedStepSeconds = options.fixedStepSeconds ?? 1 / 60;
    if (!(fixedStepSeconds > 0)) {
      throw new Error('RenderLoop fixedStepSeconds must be a positive number');
    }
    this.fixedStepSeconds = fixedStepSeconds;
    this.maxStepSeconds = Math.max(fixedStepSeconds, options.maxStepSeconds ?? 0.25);
    this.clock = options.clock ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.frameIntervalMs = Math.max(1, Math.round(fixedStepSeconds * 1000));
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Register an update callback; returns an unsubscribe function.
   * Callbacks receive the fixed step delta in seconds.
   */
  addUpdate(callback: FrameUpdateCallback): () => void {
    this.updates.add(callback);
    return () => {
      this.updates.delete(callback);
    };
  }

  clearUpdates(): void {
    this.updates.clear();
  }

  /**
   * Set the per-frame render callback (runs once per {@link step} call,
   * after any fixed-step updates).
   */
  onRender(callback: () => void): () => void {
    this.renderCallback = callback;
    return () => {
      if (this.renderCallback === callback) {
        this.renderCallback = null;
      }
    };
  }

  /**
   * Accumulate a frame delta (seconds) and run whole fixed steps of update
   * callbacks, followed by one render pass. Negative/zero deltas are
   * ignored (after disposing, calls are inert).
   */
  step(frameDeltaSeconds: number): void {
    if (this.disposed || frameDeltaSeconds <= 0) {
      return;
    }
    this.accumulatorSeconds += Math.min(frameDeltaSeconds, this.maxStepSeconds);
    const epsilon = this.fixedStepSeconds * 1e-9;
    let steps = 0;
    while (this.accumulatorSeconds >= this.fixedStepSeconds - epsilon && steps < MAX_UPDATES_PER_STEP) {
      this.dispatchUpdate();
      this.accumulatorSeconds -= this.fixedStepSeconds;
      steps += 1;
    }
    // Sweep FP residue so accumulated sub-steps (e.g. 0.05 + 0.05) always
    // produce their whole step instead of decaying below the threshold.
    if (this.accumulatorSeconds < epsilon) {
      this.accumulatorSeconds = 0;
    }
    this.renderCallback?.();
  }

  /** Start the real-time driver (schedules frames on the injected clock). */
  start(): void {
    if (this.running || this.disposed) {
      return;
    }
    this.running = true;
    let last = this.clock();
    const frame = () => {
      if (!this.running || this.disposed) {
        return;
      }
      const now = this.clock();
      const delta = now - last;
      last = now;
      this.step(delta > 0 ? delta / 1000 : 0);
      this.timer = setTimeout(frame, this.frameIntervalMs);
    };
    this.timer = setTimeout(frame, 0);
  }

  /** Stop the real-time driver (frames already dispatched finish first). */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Stop, drop every callback and mark the loop unusable. */
  dispose(): void {
    this.stop();
    this.disposed = true;
    this.updates.clear();
    this.renderCallback = null;
    this.accumulatorSeconds = 0;
  }

  private dispatchUpdate(): void {
    const delta = this.fixedStepSeconds;
    for (const callback of this.updates) {
      callback(delta);
    }
  }
}