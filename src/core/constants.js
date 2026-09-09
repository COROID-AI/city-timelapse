/**
 * Single source of truth for shared game constants.
 *
 * Consumed by every later gameplay task (world, entities, render, collision)
 * and by tests, which import this module headlessly under Node.
 */

const TILE_SIZE = 16;

const VIEWPORT_WIDTH = 256;
const VIEWPORT_HEIGHT = 240;
const SCALE = 3;

/**
 * Physics tuning.
 * Units: linear velocities in px/s, accelerations in px/s^2.
 */
const PHYSICS = {
  // Horizontal movement (px/s).
  WALK_MAX: 90,
  RUN_MAX: 160,

  // Horizontal acceleration / deceleration (px/s^2).
  ACCEL: 450,
  FRICTION: 550,
  SKID_DECEL: 1000,

  // Vertical impulse on jump (px/s, negative = upward).
  JUMP_VELOCITY: -300,
  // Extra upward speed granted when jumping while running.
  JUMP_SPEED_BONUS: -40,

  // Gravity while holding jump (px/s^2) vs. released (release falls faster).
  GRAVITY_HOLD: 700,
  GRAVITY_RELEASE: 1600,

  // Maximum downward fall speed (px/s).
  TERMINAL_VELOCITY: 270,
};

export const COLORS = {
  sky: '#5c94fc',
};

export const CONSTANTS = {
  TILE_SIZE,
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  SCALE,
  COLORS,
  PHYSICS,
};

export default CONSTANTS;
