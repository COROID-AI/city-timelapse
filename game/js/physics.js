/**
 * Physics engine: pure vanilla-JS gravity, inertia, run acceleration, friction,
 * jump velocity, and AABB collision resolution.
 *
 * This module has no DOM dependency and no game-engine coupling, so it runs
 * cleanly under the Jest node environment and can be shared by the player,
 * enemies, and item blocks alike.
 *
 * Body model: { x, y, w, h, vx, vy, onGround }
 *   - x, y: top-left position in px
 *   - w, h: body dimensions in px
 *   - vx, vy: velocity in px/frame
 *   - onGround: whether the body is resting on a solid
 *
 * Solid (tile) model: { x, y, w, h }
 *
 * All tuning values (gravity, run speed, friction, jump velocity) come from
 * the shared constants module so tuning stays centralized.
 */

import {
  GRAVITY,
  JUMP_VELOCITY,
  MAX_RUN_SPEED,
  ACCELERATION,
  FRICTION,
} from './constants.js';

/**
 * Apply gravity to a body's vertical velocity.
 *
 * @param {object} body - Body model {x, y, w, h, vx, vy, onGround}.
 * @param {number} [dt=1] - Fixed-timestep multiplier (1 frame).
 * @returns {object} The body, for chaining.
 */
export function applyGravity(body, dt = 1) {
  body.vy += GRAVITY * dt;
  return body;
}

/**
 * Advance a body by one (or `dt`) simulation frames given an input state.
 *
 * Handles, in order:
 *   1. gravity application,
 *   2. horizontal run acceleration with a max speed cap,
 *   3. inertia/friction deceleration when no direction is held,
 *   4. jump launch (only from the ground),
 *   5. position integration.
 *
 * @param {object} body - Body model {x, y, w, h, vx, vy, onGround}.
 * @param {object} [input={}] - Input state { left, right, jump } booleans.
 * @param {number} [dt=1] - Fixed-timestep multiplier (1 frame).
 * @returns {object} The body, for chaining.
 */
export function updateBody(body, input = {}, dt = 1) {
  applyGravity(body, dt);

  // Horizontal run acceleration with a max run speed cap.
  if (input.right && !input.left) {
    body.vx = Math.min(MAX_RUN_SPEED, body.vx + ACCELERATION * dt);
  } else if (input.left && !input.right) {
    body.vx = Math.max(-MAX_RUN_SPEED, body.vx - ACCELERATION * dt);
  } else {
    // Inertia / friction: decelerate toward zero when no direction is held.
    const decel = FRICTION * dt;
    if (body.vx > 0) {
      body.vx = Math.max(0, body.vx - decel);
    } else if (body.vx < 0) {
      body.vx = Math.min(0, body.vx + decel);
    }
  }

  // Jump: launch only from the ground with an initial upward velocity.
  if (input.jump && body.onGround) {
    body.vy = JUMP_VELOCITY;
    body.onGround = false;
  }

  // Integrate position.
  body.x += body.vx * dt;
  body.y += body.vy * dt;

  return body;
}

/**
 * Test whether two AABB rectangles overlap.
 *
 * @param {object} a - Rectangle {x, y, w, h}.
 * @param {object} b - Rectangle {x, y, w, h}.
 * @returns {boolean} True when the rectangles overlap.
 */
export function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Resolve AABB overlaps between a body and solid tiles, pushing the body out of
 * every overlapping solid and reporting the collision side for each.
 *
 * @param {object} body - Body model {x, y, w, h, vx, vy, onGround}.
 * @param {Array<object>} solids - Solid tiles {x, y, w, h}.
 * @returns {Array<{side: string, solid: object}>} Collision hits. `side` is one
 *   of 'left' | 'right' | 'top' | 'bottom' — the side of the body that collided.
 *
 * The resolution axis is chosen from the dominant velocity (a body running into
 * a wall resolves horizontally, a body landing on a platform resolves
 * vertically), falling back to minimum-penetration when the body is static.
 */
export function resolveCollisions(body, solids) {
  const hits = [];
  for (const solid of solids) {
    if (!overlaps(body, solid)) continue;

    const penLeft = body.x + body.w - solid.x;
    const penRight = solid.x + solid.w - body.x;
    const penTop = body.y + body.h - solid.y;
    const penBottom = solid.y + solid.h - body.y;

    const absVx = Math.abs(body.vx);
    const absVy = Math.abs(body.vy);

    // Choose the resolution axis: dominant velocity wins; otherwise the axis
    // with the least penetration.
    const resolveX =
      absVx > absVy
        ? true
        : absVy > absVx
          ? false
          : Math.min(penLeft, penRight) < Math.min(penTop, penBottom);

    if (resolveX) {
      if (body.vx > 0 || (body.vx === 0 && penLeft < penRight)) {
        body.x = solid.x - body.w;
        body.vx = 0;
        hits.push({ side: 'right', solid });
      } else {
        body.x = solid.x + solid.w;
        body.vx = 0;
        hits.push({ side: 'left', solid });
      }
    } else {
      if (body.vy > 0 || (body.vy === 0 && penTop < penBottom)) {
        body.y = solid.y - body.h;
        body.vy = 0;
        body.onGround = true;
        hits.push({ side: 'bottom', solid });
      } else {
        body.y = solid.y + solid.h;
        body.vy = 0;
        hits.push({ side: 'top', solid });
      }
    }
  }
  return hits;
}

/**
 * Factory returning the physics API.
 *
 * @returns {{applyGravity: Function, updateBody: Function,
 *   resolveCollisions: Function, overlaps: Function}} The physics module.
 */
export function createPhysics() {
  return {
    applyGravity,
    updateBody,
    resolveCollisions,
    overlaps,
  };
}

export default createPhysics;