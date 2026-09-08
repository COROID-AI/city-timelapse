import type { InputState } from './contracts';

/** Callbacks wired into the game loop. */
export interface GameLoopCallbacks {
  /**
   * Executed once per fixed timestep (possibly several times per frame when
   * the renderer falls behind). Always receives the fixed delta, never the
   * real frame duration.
   */
  update: (deltaSeconds: number, input: InputState) => void;
  /** Executed once per animation frame at the display cadence. */
  render: () => void;
}

/** Handle controlling a fixed-timestep game loop. */
export interface GameLoopHandle {
  /** True while the loop schedules frames on its own. */
  readonly running: boolean;
  /** True after dispose() was called; the loop is then inert. */
  readonly disposed: boolean;
  /** The fixed update interval in seconds. */
  readonly fixedStepSeconds: number;
  /** Begin scheduling animation frames. No-op if already running. */
  start: () => void;
  /** Stop scheduling frames. No-op if not running. */
  stop: () => void;
  /**
   * Stop the loop and relinquish every reference it holds: the callbacks
   * are dropped, any pending frame is cancelled and the loop becomes inert.
   */
  dispose: () => void;
  /**
   * Advance the loop by a single frame using an explicit timestamp.
   * Intentionally independent of start()/stop() so tests (and tooling) can
   * drive the fixed-timestep simulation deterministically. No-op when
   * disposed.
   */
  stepFrame: (nowMilliseconds: number) => void;
}

/** Conventional fixed physics rate (60 Hz). */
export const DEFAULT_FIXED_STEP_SECONDS = 1 / 60;

/** Upper clamp for a single frame, in seconds, to avoid a death spiral. */
const MAX_FRAME_SECONDS = 0.25;

/** Browser scheduling baseline used when requestAnimationFrame is absent. */
const FALLBACK_FRAME_MILLISECONDS = 16;

/** Frozen fallback input handed to `update` when no live state is shared. */
const EMPTY_INPUT: InputState = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  nitrous: false,
});

/**
 * Create the game's fixed-timestep loop.
 *
 * A single `frame` pumps the loop: real elapsed time is folded into an
 * accumulator and the `update` callback runs as many times as whole fixed
 * steps are available, always receiving the exact `fixedStepSeconds`. The
 * `render` callback runs once per frame so visuals stay smooth when the
 * update rate is lower than the display rate.
 *
 * @param fixedStepSeconds  Fixed update interval; must be finite and > 0.
 * @param callbacks         update + render callbacks.
 * @param inputState        Shared InputState snapshot handed to `update`.
 *                          Defaults to an inert frozen empty state.
 */
export function createGameLoop(
  fixedStepSeconds: number = DEFAULT_FIXED_STEP_SECONDS,
  callbacks: GameLoopCallbacks,
  inputState: InputState = EMPTY_INPUT,
): GameLoopHandle {
  if (!Number.isFinite(fixedStepSeconds) || fixedStepSeconds <= 0) {
    throw new Error(
      `createGameLoop: fixedStepSeconds must be finite and > 0, got ${fixedStepSeconds}`,
    );
  }

  let accumulatorSeconds = 0;
  let lastFrameSeconds: number | null = null;
  let running = false;
  let disposed = false;
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** One simulation + render pass at the given frame timestamp. */
  const stepFrame = (nowMilliseconds: number): void => {
    if (disposed) return;

    const nowSeconds = nowMilliseconds / 1000;
    if (lastFrameSeconds === null) {
      // First frame after (re)start: seed the clock and run one update
      // pass immediately so the simulation is live without waiting a frame.
      lastFrameSeconds = nowSeconds;
      callbacks.update(fixedStepSeconds, inputState);
    } else {
      let elapsed = nowSeconds - lastFrameSeconds;
      lastFrameSeconds = nowSeconds;
      if (elapsed < 0) elapsed = 0;
      if (elapsed > MAX_FRAME_SECONDS) elapsed = MAX_FRAME_SECONDS;
      accumulatorSeconds += elapsed;

      while (accumulatorSeconds >= fixedStepSeconds) {
        accumulatorSeconds -= fixedStepSeconds;
        callbacks.update(fixedStepSeconds, inputState);
      }
    }

    callbacks.render();
  };

  const cancelPending = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const scheduleFrame = () => {
    if (!running || disposed) return;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame((nowMs) => {
        rafId = null;
        stepFrame(nowMs);
        scheduleFrame();
      });
    } else {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        stepFrame(Date.now());
        scheduleFrame();
      }, FALLBACK_FRAME_MILLISECONDS);
    }
  };

  const start = (): void => {
    if (running || disposed) return;
    running = true;
    accumulatorSeconds = 0;
    lastFrameSeconds = null;
    scheduleFrame();
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    cancelPending();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    running = false;
    cancelPending();
    accumulatorSeconds = 0;
    lastFrameSeconds = null;
  };

  return {
    get running() {
      return running;
    },
    get disposed() {
      return disposed;
    },
    get fixedStepSeconds() {
      return fixedStepSeconds;
    },
    start,
    stop,
    dispose,
    stepFrame,
  };
}