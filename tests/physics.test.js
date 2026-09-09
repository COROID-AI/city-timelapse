/**
 * Deterministic step-simulation tests for the physics integrator.
 *
 * Every test drives the pure numeric functions through the same 1/60s steps
 * the game loop uses (dt = 1/60), so the assertions document the exact
 * acceleration, friction, skid, and variable-height jump behavior that
 * player-entity composes. All expectations are derived from the pinned
 * PHYSICS constants - no hardcoded tuning values live in src/physics/body.js.
 */
import { CONSTANTS } from '../src/core/constants.js';
import {
  createBody,
  updateHorizontal,
  applyJump,
  applyGravity,
} from '../src/physics/body.js';

const { PHYSICS } = CONSTANTS;
const DT = 1 / 60;
const STEPS = 200; // Ample time to fully settle toward any target speed.

describe('createBody', () => {
  test('returns the full body shape with resting kinematics', () => {
    const body = createBody({ x: 10, y: 20, w: 16, h: 24 });

    expect(body).toEqual({
      x: 10,
      y: 20,
      w: 16,
      h: 24,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
    });
  });
});

describe('updateHorizontal', () => {
  test('accelerates from rest toward the run cap at ACCEL', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });

    updateHorizontal(body, { moveDir: 1, runHeld: true }, DT);

    expect(body.vx).toBeCloseTo(PHYSICS.ACCEL * DT, 12);
    expect(body.facing).toBe(1);
  });

  test('run top speed exceeds walk top speed (caps enforced)', () => {
    let runner = createBody({ x: 0, y: 0, w: 16, h: 24 });
    let walker = createBody({ x: 0, y: 0, w: 16, h: 24 });

    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(runner, { moveDir: 1, runHeld: true }, DT);
      updateHorizontal(walker, { moveDir: 1, runHeld: false }, DT);
    }

    expect(runner.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);
    expect(walker.vx).toBeCloseTo(PHYSICS.WALK_MAX, 6);
    expect(runner.vx).toBeGreaterThan(walker.vx);
  });

  test('friction stops a moving body when there is no input', () => {
    const frictionPerStep = PHYSICS.FRICTION * DT; // max per-step friction delta
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: 1, runHeld: true }, DT);
    }
    expect(body.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);

    // One step of friction at full run speed removes the full per-step delta.
    updateHorizontal(body, { moveDir: 0, runHeld: false }, DT);
    expect(body.vx).toBeCloseTo(PHYSICS.RUN_MAX - frictionPerStep, 6);

    // Keep releasing until the body is fully stopped, then verify it stops
    // dead instead of drifting off in the opposite direction.
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: 0, runHeld: false }, DT);
    }
    expect(body.vx).toBe(0);
    expect(body.facing).toBe(1);
  });

  test('reversing at speed skids (SKID_DECEL, not ACCEL) then re-accelerates', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: 1, runHeld: true }, DT);
    }
    expect(body.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);

    // First reversing step bleeds the skid amount - strictly more than a
    // single ACCEL step would remove, and the velocity sign is preserved
    // (inertia is kept: the body does not snap to 0).
    updateHorizontal(body, { moveDir: -1, runHeld: true }, DT);
    expect(body.vx).toBeCloseTo(PHYSICS.RUN_MAX - PHYSICS.SKID_DECEL * DT, 6);
    expect(body.vx).toBeGreaterThan(0);

    // Continuing against the input bleeds through zero, then flips facing.
    let crossedZero = false;
    for (let i = 0; i < 200; i += 1) {
      updateHorizontal(body, { moveDir: -1, runHeld: true }, DT);
      if (body.vx < 0) {
        crossedZero = true;
        break;
      }
    }
    expect(crossedZero).toBe(true);
    expect(body.facing).toBe(-1);

    // From here the body accelerates back toward the run cap.
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: -1, runHeld: true }, DT);
    }
    expect(body.vx).toBeCloseTo(-PHYSICS.RUN_MAX, 6);
    expect(body.facing).toBe(-1);
  });

  test('updates facing from the velocity sign on every step', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    updateHorizontal(body, { moveDir: -1, runHeld: false }, DT);
    expect(body.facing).toBe(-1);
    updateHorizontal(body, { moveDir: 1, runHeld: false }, DT);
    expect(body.facing).toBe(1);
  });

  test('moveDir 0 pauses the body at rest', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    updateHorizontal(body, { moveDir: 0, runHeld: true }, DT);
    expect(body.vx).toBe(0);
    expect(body.facing).toBe(1);
  });
});

describe('applyJump', () => {
  test('applies the base impulse and clears onGround when standing', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    expect(body.onGround).toBe(true);

    applyJump(body);

    expect(body.vy).toBe(PHYSICS.JUMP_VELOCITY);
    expect(body.onGround).toBe(false);
  });

  test('scales the impulse with speed up to the full run bonus', () => {
    const standing = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const walking = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const running = createBody({ x: 0, y: 0, w: 16, h: 24 });

    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(walking, { moveDir: 1, runHeld: false }, DT);
      updateHorizontal(running, { moveDir: 1, runHeld: true }, DT);
    }

    applyJump(standing);
    applyJump(walking);
    applyJump(running);

    // Standing: no bonus. Walking: bonus scaled by |vx|/RUN_MAX.
    expect(standing.vy).toBe(PHYSICS.JUMP_VELOCITY);
    expect(walking.vy).toBeCloseTo(
      PHYSICS.JUMP_VELOCITY
        + PHYSICS.JUMP_SPEED_BONUS * (PHYSICS.WALK_MAX / PHYSICS.RUN_MAX),
      6,
    );
    // Running: bonus saturated at 100% of |vx|/RUN_MAX = 1.
    expect(running.vy).toBe(PHYSICS.JUMP_VELOCITY + PHYSICS.JUMP_SPEED_BONUS);
    // The bonus pushes the impulse further upward (more negative).
    expect(walking.vy).toBeLessThan(standing.vy);
    expect(running.vy).toBeLessThan(walking.vy);
  });

  test('does nothing while airborne', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    applyJump(body);
    const vyAfterFirstJump = body.vy;

    applyJump(body);

    expect(body.vy).toBe(vyAfterFirstJump);
    expect(body.onGround).toBe(false);
  });
});

describe('applyGravity', () => {
  test('accumulates downward velocity each step', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    applyJump(body); // now airborne with upward (negative) velocity

    expect(body.vy).toBeLessThan(0);
    applyGravity(body, false, DT);

    expect(body.vy).toBeCloseTo(
      PHYSICS.JUMP_VELOCITY + PHYSICS.GRAVITY_RELEASE * DT,
      6,
    );
  });

  test('uses GRAVITY_HOLD while rising with the jump held', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    applyJump(body);

    applyGravity(body, true, DT);
    expect(body.vy).toBeCloseTo(
      PHYSICS.JUMP_VELOCITY + PHYSICS.GRAVITY_HOLD * DT,
      6,
    );
  });

  test('uses GRAVITY_RELEASE while rising with the jump released', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    applyJump(body);

    applyGravity(body, false, DT);
    expect(body.vy).toBeCloseTo(
      PHYSICS.JUMP_VELOCITY + PHYSICS.GRAVITY_RELEASE * DT,
      6,
    );
  });

  test('clamps falling speed at TERMINAL_VELOCITY', () => {
    const body = createBody({ x: 0, y: 0, w: 16, h: 24 });
    for (let i = 0; i < STEPS; i += 1) {
      applyGravity(body, false, DT);
    }

    // Buried far past the terminal clamp: verify the cap directly.
    body.vy = PHYSICS.TERMINAL_VELOCITY + 500;
    applyGravity(body, false, DT);
    expect(body.vy).toBe(PHYSICS.TERMINAL_VELOCITY);

    // And a full fall from rest converges to, never exceeds, the cap.
    const dropped = createBody({ x: 0, y: 0, w: 16, h: 24 });
    for (let i = 0; i < STEPS; i += 1) {
      applyGravity(dropped, false, DT);
    }
    expect(dropped.vy).toBeLessThanOrEqual(PHYSICS.TERMINAL_VELOCITY);
  });
});

describe('integrated run-jump arcs (updateHorizontal + applyJump + applyGravity)', () => {
  /**
   * Drive a body through a complete jump the way player-entity composes the
   * chain: run up, jump, then per-step Euler-integrate the velocities into
   * position (the module updates velocities; the caller owns the position
   * step). Returns the highest point reached (y grows downward, so the
   * apex is the minimum offset) and the final horizontal position.
   */
  function jumpArc(body, { runHeld, holdJumpSeconds }) {
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: 1, runHeld }, DT);
    }

    applyJump(body);
    expect(body.onGround).toBe(false);

    let apex = 0;
    let holdStepsLeft = Math.round(holdJumpSeconds / DT);
    for (let i = 0; i < STEPS; i += 1) {
      updateHorizontal(body, { moveDir: runHeld ? 1 : 0, runHeld }, DT);
      applyGravity(body, holdStepsLeft > 0, DT);
      holdStepsLeft -= 1;
      body.y += body.vy * DT;
      body.x += body.vx * DT;
      apex = Math.min(apex, body.y);
    }

    return { apex, x: body.x, vy: body.vy };
  }

  test('tapping jump then releasing yields a lower apex than holding', () => {
    // Tapped: release gravity applies from the very first frame.
    const tapped = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const tappedArc = jumpArc(tapped, { runHeld: false, holdJumpSeconds: 0 });
    expect(tappedArc.apex).toBeLessThan(0);
    expect(tappedArc.vy).toBeGreaterThanOrEqual(0);

    // Held: light gravity while rising extends the arc upward.
    const held = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const heldArc = jumpArc(held, { runHeld: false, holdJumpSeconds: 3 });
    expect(heldArc.apex).toBeLessThan(tappedArc.apex);
    expect(heldArc.vy).toBeGreaterThanOrEqual(0);
  });

  test('a run jump reaches a higher apex than a walk jump', () => {
    const walker = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const walkArc = jumpArc(walker, { runHeld: false, holdJumpSeconds: 3 });
    expect(walkArc.apex).toBeLessThan(0);

    const runner = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const runArc = jumpArc(runner, { runHeld: true, holdJumpSeconds: 3 });
    expect(runArc.apex).toBeLessThan(walkArc.apex);
  });

  test('a run jump also travels farther horizontally than a walk jump', () => {
    const walker = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const walkArc = jumpArc(walker, { runHeld: false, holdJumpSeconds: 3 });
    expect(walkArc.x).toBeGreaterThan(0);

    const runner = createBody({ x: 0, y: 0, w: 16, h: 24 });
    const runArc = jumpArc(runner, { runHeld: true, holdJumpSeconds: 3 });

    expect(runArc.x).toBeGreaterThan(walkArc.x);
  });
});