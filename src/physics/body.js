/**
 * Pure numeric physics integrator for the classic run-jump feel.
 *
 * Horizontal and vertical motion are integrated independently so the
 * tile-collision system can resolve each axis separately:
 *
 *  - updateHorizontal: acceleration toward the walk/run cap, friction with
 *    no input, and skid deceleration when input reverses the current
 *    velocity (inertia + skid).
 *  - applyJump: a one-shot vertical impulse scaled by horizontal speed,
 *    granted only while on the ground.
 *  - applyGravity: variable-height gravity - light while rising with the
 *    jump held, heavy otherwise - clamped at terminal fall speed.
 *
 * This module is pure arithmetic: no DOM, canvas, tilemap, or input state.
 * Every tuning value is read from PHYSICS in src/core/constants.js.
 */

import { CONSTANTS } from '../core/constants.js';

const { PHYSICS } = CONSTANTS;

/**
 * Move `current` toward `target` by at most `maxDelta` without overshooting.
 * Works symmetrically for positive and negative velocities, so the same
 * helper drives acceleration, friction, and skid deceleration.
 */
function stepToward(current, target, maxDelta) {
  if (current < target) {
    return Math.min(target, current + maxDelta);
  }
  return Math.max(target, current - maxDelta);
}

/**
 * Create a body with its full kinematic state.
 *
 * @param {{x: number, y: number, w: number, h: number}} shape
 *   Spawn position and hitbox size in world pixels.
 * @returns {{x: number, y: number, w: number, h: number,
 *   vx: number, vy: number, onGround: boolean, facing: number}}
 *   x/y/w/h as given, zero velocity, standing on the ground (until the
 *   collision system detaches it) and facing right.
 */
export function createBody({ x, y, w, h }) {
  return {
    x,
    y,
    w,
    h,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
  };
}

/**
 * Integrate one physics step of horizontal movement.
 *
 * @param {object} body body produced by createBody
 * @param {{moveDir: -1|0|1, runHeld: boolean}} input
 *   Desired horizontal direction and whether the run key is held.
 * @param {number} dt step duration in seconds (fixed by the game loop).
 */
export function updateHorizontal(body, { moveDir, runHeld }, dt) {
  const maxSpeed = runHeld ? PHYSICS.RUN_MAX : PHYSICS.WALK_MAX;

  let nextVx = body.vx;

  if (moveDir === 0) {
    // No input: friction bleeds speed off while preserving direction.
    nextVx = stepToward(nextVx, 0, PHYSICS.FRICTION * dt);
  } else {
    const target = moveDir * maxSpeed;
    // Reversing (moving against the input) skids hard instead of
    // accelerating: the body keeps its old inertia for a few frames.
    const reversing = nextVx !== 0 && Math.sign(nextVx) !== moveDir;
    const rate = reversing ? PHYSICS.SKID_DECEL : PHYSICS.ACCEL;
    nextVx = stepToward(nextVx, target, rate * dt);
  }

  body.vx = nextVx;

  // Facing follows the velocity sign and is preserved while stopped.
  if (nextVx !== 0) {
    body.facing = Math.sign(nextVx);
  }
}

/**
 * Apply the jump impulse, granted only while on the ground.
 *
 * The impulse carries a speed bonus proportional to horizontal speed
 * (saturated at full run speed), so a running jump arcs higher. Clears
 * `onGround`: the next ground contact is established by the collision
 * system.
 *
 * @param {object} body body produced by createBody
 */
export function applyJump(body) {
  if (!body.onGround) {
    return;
  }
  const speedRatio = Math.min(1, Math.abs(body.vx) / PHYSICS.RUN_MAX);
  body.vy = PHYSICS.JUMP_VELOCITY + PHYSICS.JUMP_SPEED_BONUS * speedRatio;
  body.onGround = false;
}

/**
 * Integrate one physics step of vertical movement (variable-height gravity).
 *
 * While the body is still rising and the jump key is held, gravity is
 * light (GRAVITY_HOLD), extending the apex; releasing early - or falling -
 * switches to the heavy GRAVITY_RELEASE. Downward speed is clamped at
 * TERMINAL_VELOCITY.
 *
 * @param {object} body body produced by createBody
 * @param {boolean} jumpHeld whether the jump key is held this step
 * @param {number} dt step duration in seconds (fixed by the game loop).
 */
export function applyGravity(body, jumpHeld, dt) {
  const rising = body.vy < 0;
  const gravity = jumpHeld && rising
    ? PHYSICS.GRAVITY_HOLD
    : PHYSICS.GRAVITY_RELEASE;
  body.vy = Math.min(body.vy + gravity * dt, PHYSICS.TERMINAL_VELOCITY);
}