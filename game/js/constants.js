/**
 * Shared game constants.
 *
 * Everything later game modules need for world dimensions, physics tuning,
 * and timing lives here so tuning stays centralized. All values are plain
 * numbers suitable for a fixed-timestep simulation.
 */

/** Pixel size of a single world tile. */
export const TILE_SIZE = 16;

/** Internal viewport width in pixels (NES-style resolution). */
export const VIEW_WIDTH = 256;

/** Internal viewport height in pixels. */
export const VIEW_HEIGHT = 224;

/**
 * Gravity applied to actors each physics frame, in px/frame^2.
 * ~0.4 px/frame^2 at 60fps approximates a snappy platformer feel.
 */
export const GRAVITY = 0.4;

/** Initial upward velocity when the player jumps, in px/frame. */
export const JUMP_VELOCITY = -5.5;

/** Maximum horizontal run speed for the player, in px/frame. */
export const MAX_RUN_SPEED = 2.4;

/** Horizontal acceleration while a run key is held, in px/frame^2. */
export const ACCELERATION = 0.3;

/** Horizontal deceleration when no run key is held, in px/frame^2. */
export const FRICTION = 0.35;

/**
 * Fixed simulation timestep in milliseconds. The engine advances the
 * simulation in these discrete steps regardless of display refresh rate.
 */
export const FIXED_TIMESTEP_MS = 1000 / 60;

/**
 * Maximum number of fixed steps processed per animation frame. Guards against
 * the "spiral of death" when a tab is backgrounded or the machine stalls.
 */
export const MAX_FRAME_STEPS = 5;