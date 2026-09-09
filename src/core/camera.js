/**
 * Classic forward-scrolling camera (Super Mario Bros. style).
 *
 * The camera follows a target (the player) horizontally with a dead-zone
 * threshold: follow() does nothing until the target crosses the vertical
 * line at the horizontal center of the viewport, and while scrolling it
 * keeps the target pinned to that midpoint. Scrolling is strictly
 * forward-only — the camera remembers the furthest x it has ever reached
 * (a single monotonic variable) and never retreats, so a player walking
 * back left sees already-explored level stay put on screen.
 *
 * Movement is clamped to the playfield: camX always stays inside
 * [0, levelWidth - viewportWidth]. Vertical tracking is not performed —
 * like the original NES SMB, the viewport is fixed to the top of the level
 * (camY = 0, which is inside [0, max(0, levelHeight - viewportHeight)]).
 *
 * This module is pure arithmetic: no DOM, canvas, or input state. It reads
 * default viewport dimensions from CONSTANTS in src/core/constants.js but
 * takes explicit dimensions per level.
 */

import { CONSTANTS } from './constants.js';

/** Follow threshold as a fraction of the viewport width (dead zone). */
const MIDPOINT_RATIO = 0.5;

/**
 * @typedef {Object} CameraHandle
 * @property {number} x - current camera x offset in world pixels.
 * @property {number} y - current camera y offset; fixed to the level top (0).
 * @property {(targetX: number) => CameraHandle} follow - advance the camera
 *   toward the target, subject to the midpoint threshold, right-edge clamp
 *   and forward-only lock.
 * @property {(x: number, y: number) => {x: number, y: number}} worldToScreen
 *   - map a world-space point to viewport (screen) space by subtracting the
 *   camera offset.
 */

/**
 * Create a classic forward-scrolling camera.
 *
 * @param {Object} config
 * @param {number} [config.viewportWidth=CONSTANTS.VIEWPORT_WIDTH]
 *   visible width in pixels.
 * @param {number} [config.viewportHeight=CONSTANTS.VIEWPORT_HEIGHT]
 *   visible height in pixels.
 * @param {number} [config.levelWidth]
 *   level pixel width (defaults to the viewport width: no horizontal scroll).
 * @param {number} [config.levelHeight]
 *   level pixel height (defaults to the viewport height).
 * @returns {CameraHandle}
 */
export function createCamera({
  viewportWidth = CONSTANTS.VIEWPORT_WIDTH,
  viewportHeight = CONSTANTS.VIEWPORT_HEIGHT,
  levelWidth = viewportWidth,
  levelHeight = viewportHeight,
} = {}) {
  // Hard scroll limits. A level no larger than the viewport simply never
  // scrolls (max 0), which also keeps the clamped range non-negative.
  const maxX = Math.max(0, levelWidth - viewportWidth);
  const maxY = Math.max(0, levelHeight - viewportHeight);

  // Vertical: classic SMB pins the viewport to the top of the level. camY
  // is fixed at 0, which is always inside the legal vertical range.
  const camY = 0;

  let camX = 0;
  // Monotonic memory of the furthest x the camera has ever reached. The
  // camera never scrolls left of this value: the forward-only lock.
  let furthestX = 0;

  const midX = viewportWidth * MIDPOINT_RATIO;

  const camera = {
    get x() {
      return camX;
    },

    get y() {
      return camY;
    },

    /**
     * Follow a horizontal target.
     *
     * Applies the midpoint dead-zone threshold: the camera only advances
     * once `targetX` passes the vertical line at viewport center
     * (targetX > camX + viewportWidth / 2). When it does, the camera moves
     * so the target sits at that midpoint again, clamped to the level's
     * right edge and to the furthest x ever reached — never scrolling left.
     *
     * @param {number} targetX world-space x of the followed entity.
     * @returns {CameraHandle} this, for chaining.
     */
    follow(targetX) {
      if (targetX <= camX + midX) {
        // Target still in the left buffer: dead zone, no movement.
        return camera;
      }

      // Target crossed the midpoint: center the camera on it, hard-clamped
      // to the level's right edge, then apply the forward-only lock.
      const nextX = Math.min(targetX - midX, maxX);
      if (nextX > furthestX) {
        furthestX = nextX;
      }
      // camX == furthestX is the invariant that makes the lock work: it can
      // only ever grow, so walking back left can never move the viewport.
      camX = furthestX;
      return camera;
    },

    /**
     * Map a world-space point to viewport (screen) space.
     *
     * The render pipeline draws entities at the returned {x, y}, which is
     * what game-states-composition consumes for culling and rendering.
     *
     * @param {number} x world-space x (pixels, level origin at top-left).
     * @param {number} y world-space y (pixels, level origin at top-left).
     * @returns {{x: number, y: number}} viewport-space coordinates.
     */
    worldToScreen(x, y) {
      return { x: x - camX, y: y - camY };
    },
  };

  return camera;
}

export default createCamera;