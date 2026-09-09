/**
 * Fixed-timestep game loop driven by requestAnimationFrame.
 *
 * The simulation is decoupled from rendering: `update` advances the game by
 * exactly SIM_STEP_SECONDS (1/60 s) worth of state, while `render` is invoked
 * once per animation frame at whatever rate the display actually delivers.
 * A time accumulator converts real elapsed wall time (taken from the rAF
 * callback timestamp, not a Date.now clock) into a bounded number of
 * simulation steps, clamped to MAX_CATCH_UP_STEPS per animation frame so a
 * backgrounded tab cannot spiral into an unbounded catch-up loop.
 *
 * The rAF provider is injected so tests can drive the loop with a manual
 * frame pump in Node (no real timers, no DOM). When no provider is passed,
 * the loop falls back to window.requestAnimationFrame /
 * window.cancelAnimationFrame at call time — the same contract the fake
 * pump mimics, so the loop behaves identically in and out of the browser.
 *
 * @module core/loop
 */

/** Length of one fixed simulation step, in seconds (1/60 s). */
export const SIM_STEP_SECONDS = 1 / 60;

/** Maximum number of catch-up steps the accumulator may run per frame. */
export const MAX_CATCH_UP_STEPS = 5;

/**
 * Default frame scheduler: the browser's rAF pair, resolved lazily so this
 * module imports cleanly under Jest (Node) where `window` does not exist.
 */
function defaultRequestFrame(callback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  throw new Error(
    'createGameLoop: requestAnimationFrame is unavailable — inject a ' +
      'requestFrame provider (as tests do) or run inside a browser.',
  );
}

function defaultCancelFrame(handle) {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
  }
}

/**
 * Create a fixed-timestep game loop.
 *
 * @param {object}   options
 * @param {function} options.update     Advance simulation state by exactly
 *                                      SIM_STEP_SECONDS. Called 0..N times
 *                                      per animation frame (catch-up clamped).
 * @param {function} options.render     Present one frame to the display.
 *                                      Called exactly once per animation frame.
 * @param {function} [options.requestFrame] Provider following the
 *                                      window.requestAnimationFrame contract:
 *                                      (callback) => handle, where callback is
 *                                      invoked with a DOMHighResTimeStamp (ms).
 * @param {function} [options.cancelFrame] Provider matching
 *                                      window.cancelAnimationFrame(handle).
 * @returns {{start: function, stop: function, dispose: function}} The loop
 *          handle consumed by the game-states composition.
 */
export function createGameLoop({ update, render, requestFrame, cancelFrame } = {}) {
  if (typeof update !== 'function') {
    throw new TypeError('createGameLoop: update must be a function');
  }
  if (typeof render !== 'function') {
    throw new TypeError('createGameLoop: render must be a function');
  }

  const scheduleFrame = typeof requestFrame === 'function' ? requestFrame : defaultRequestFrame;
  const unscheduleFrame = typeof cancelFrame === 'function' ? cancelFrame : defaultCancelFrame;

  let running = false;
  let pendingHandle = null;
  let lastTimeMs = null; // rAF timestamp (ms) of the previous frame
  let accumulatorSeconds = 0; // unconsumed simulation time, in seconds

  /**
   * rAF callback. Consumes wall-clock time since the previous frame through
   * the accumulator, then hands the display exactly one render call.
   * @param {number} timeMs Monotonic frame timestamp in milliseconds.
   */
  function onFrame(timeMs) {
    if (!running) return;
    pendingHandle = null;

    if (lastTimeMs === null) {
      // First frame only seeds the baseline: never simulate a huge synthetic
      // delta between start() and the very first delivered rAF timestamp.
      lastTimeMs = timeMs;
    } else {
      const elapsedSeconds = Math.max(0, timeMs - lastTimeMs) / 1000;
      lastTimeMs = timeMs;
      accumulatorSeconds += elapsedSeconds;

      let steps = 0;
      while (accumulatorSeconds >= SIM_STEP_SECONDS && steps < MAX_CATCH_UP_STEPS) {
        update();
        accumulatorSeconds -= SIM_STEP_SECONDS;
        steps += 1;
      }
      if (accumulatorSeconds >= SIM_STEP_SECONDS) {
        // Spiral-of-death guard: having already run the catch-up budget,
        // drop the surplus instead of falling further behind the wall clock.
        accumulatorSeconds = 0;
      }
    }

    render();

    if (running) {
      pendingHandle = scheduleFrame(onFrame);
    }
  }

  function start() {
    if (running) return;
    if (pendingHandle !== null) {
      unscheduleFrame(pendingHandle);
      pendingHandle = null;
    }
    running = true;
    lastTimeMs = null;
    accumulatorSeconds = 0;
    pendingHandle = scheduleFrame(onFrame);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (pendingHandle !== null) {
      unscheduleFrame(pendingHandle);
      pendingHandle = null;
    }
  }

  return { start, stop, dispose: stop };
}