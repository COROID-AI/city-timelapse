/**
 * Fixed-timestep game loop tests.
 *
 * The real createGameLoop is exercised against a fake rAF provider: a
 * manual frame pump that stores the scheduled callback and lets the test
 * advance a monotonic clock frame by frame. No real timers, no DOM — the
 * loop runs entirely on injected callbacks under Node.
 *
 * The final test composes loop + input on a shared fake event target to
 * prove the deterministic heartbeat drives input-aware update logic exactly
 * as the game-states composition will consume it.
 */
import { createGameLoop, SIM_STEP_SECONDS, MAX_CATCH_UP_STEPS } from '../src/core/loop.js';
import { createInput } from '../src/core/input.js';

/** Fake rAF provider modeled on window.requestAnimationFrame. */
class FakeRAF {
  constructor() {
    this.callback = null;
    this.timeMs = 1000; // monotonic clock owned by the test, advanced manually
    this.frames = 0;
  }

  /** window.requestAnimationFrame(callback) => handle */
  request(callback) {
    this.callback = callback;
    return this.callback;
  }

  /** window.cancelAnimationFrame(handle) */
  cancel(handle) {
    if (this.callback === handle) this.callback = null;
  }

  /**
   * Deliver one animation frame whose wall-clock timestamp is
   * `deltaMs` after the previous frame. Returns false when no frame is
   * pending (loop stopped or not started). The frame's callback observes
   * the same monotonic clock the browser would supply.
   */
  tick(deltaMs) {
    if (this.callback === null) return false;
    const cb = this.callback;
    this.callback = null;
    this.timeMs += deltaMs;
    this.frames += 1;
    cb(this.timeMs);
    return true;
  }
}

/** Minimal event target accepting addEventListener/removeEventListener. */
class FakeEventTarget {
  constructor() {
    this.handlers = new Map();
  }
  addEventListener(type, handler) {
    this.handlers.set(type, handler);
  }
  removeEventListener(type, handler) {
    this.handlers.delete(type);
  }
  fire(type, event) {
    const handler = this.handlers.get(type);
    if (handler) handler(event);
  }
}

/** Synthetic KeyboardEvent carrying only what the module needs. */
function keyEvent(code, key) {
  let prevented = false;
  return {
    code,
    key,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
}

function makeLoop(rAF, update, render) {
  return createGameLoop({
    update,
    render,
    requestFrame: (cb) => rAF.request(cb),
    cancelFrame: (h) => rAF.cancel(h),
  });
}

describe('createGameLoop', () => {
  test('steps the simulation at a fixed 1/60 s cadence', () => {
    const rAF = new FakeRAF();
    const updates = [];
    const renders = [];
    const loop = makeLoop(
      rAF,
      () => updates.push(updates.length),
      () => renders.push(renders.length),
    );

    loop.start();
    rAF.tick(0); // first frame seeds the baseline clock, no simulation
    rAF.tick(33.3334); // 0.0333 s -> exactly two 1/60 steps
    rAF.tick(16.6667); // -> one more step
    loop.stop();

    expect(updates).toEqual([0, 1, 2]);
    // render runs exactly once per animation frame, decoupled from steps.
    expect(renders).toEqual([0, 1, 2]);
  });

  test('accumulates sub-step time across frames', () => {
    const rAF = new FakeRAF();
    let steps = 0;
    const loop = makeLoop(rAF, () => (steps += 1), () => {});

    loop.start();
    rAF.tick(0); // baseline
    rAF.tick(20); // one step, ~3.33 ms carried over
    rAF.tick(20); // 3.33 + 20 ms -> one step, ~6.66 ms carried over
    rAF.tick(9); // 6.66 + 9 ms < 1/60 s -> zero steps, remainder kept
    loop.stop();

    expect(steps).toBe(2);
  });

  test('clamps catch-up to MAX_CATCH_UP_STEPS per frame', () => {
    const rAF = new FakeRAF();
    let steps = 0;
    const loop = makeLoop(rAF, () => (steps += 1), () => {});

    loop.start();
    rAF.tick(0); // baseline
    rAF.tick(10_000); // 10 s behind -> would need 600 steps, clamped to 5
    loop.stop();

    expect(steps).toBe(MAX_CATCH_UP_STEPS);
    expect(MAX_CATCH_UP_STEPS).toBe(5);
    expect(SIM_STEP_SECONDS).toBeCloseTo(1 / 60, 12);
  });

  test('start is idempotent and stop cancels pending frames', () => {
    const rAF = new FakeRAF();
    let steps = 0;
    const loop = makeLoop(rAF, () => (steps += 1), () => {});

    loop.start();
    loop.start(); // second start must not schedule a parallel frame chain
    rAF.tick(0);
    rAF.tick(16.6667);
    expect(rAF.callback).not.toBeNull();

    loop.stop();
    loop.stop(); // idempotent
    expect(rAF.callback).toBeNull();

    rAF.tick(1000);
    expect(rAF.frames).toBe(2); // no frame was delivered after stop
    expect(steps).toBe(1);
  });

  test('dispose stops the loop', () => {
    const rAF = new FakeRAF();
    let steps = 0;
    const loop = makeLoop(rAF, () => (steps += 1), () => {});
    loop.start();
    rAF.tick(0);
    loop.dispose();
    expect(rAF.callback).toBeNull();
    rAF.tick(1000);
    expect(steps).toBe(0);
  });

  test('integrated: loop heartbeat drives input-aware update across frames', () => {
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    const frames = [];
    // update reads the semantic input state the same way player physics will.
    const update = () =>
      frames.push({
        right: input.isDown('right'),
        jump: input.isDown('jump'),
        jumpPressed: input.wasPressed('jump'),
      });
    const loop = makeLoop(rAF, update, () => {});

    loop.start();
    rAF.tick(0); // first frame only seeds the timestamp baseline (no update)
    target.fire('keydown', keyEvent('KeyD', 'd')); // hold right
    rAF.tick(16.6667); // frame N: right down, jump untouched
    expect(frames).toHaveLength(1);
    expect(frames[0].right).toBe(true);
    expect(frames[0].jump).toBe(false);
    expect(frames[0].jumpPressed).toBe(false);

    target.fire('keydown', keyEvent('Space', ' ')); // press jump
    rAF.tick(16.6667); // frame N+1: fresh jump edge visible to update
    expect(frames[1].jumpPressed).toBe(true);
    expect(frames[1].jump).toBe(true);

    input.endFrame(); // game-states calls this once per input frame
    rAF.tick(16.6667); // frame N+2: edge cleared, hold state persists
    expect(frames[2].jumpPressed).toBe(false);
    expect(frames[2].jump).toBe(true);
    expect(frames[2].right).toBe(true);

    target.fire('keyup', keyEvent('KeyD', 'd'));
    rAF.tick(16.6667); // frame N+3: released right
    expect(frames[3].right).toBe(false);
    expect(frames[3].jump).toBe(true);

    loop.stop();
    input.detach();
  });
});