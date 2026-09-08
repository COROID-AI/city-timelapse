/**
 * Scrolling camera.
 *
 * The camera defines the visible viewport into the level's world. It follows a
 * target (usually the player) by centering the viewport on that target and then
 * clamping the scroll offset so the camera never reveals space outside the
 * level bounds. This is the classic side-scroller behaviour — the world scrolls
 * horizontally as the player moves right, but stops at the level edges.
 *
 * The camera is a plain object with an `x`/`y` top-left pixel position in world
 * coordinates. The renderer consumes this offset to shift tiles and drawables
 * into view.
 */

import { TILE_SIZE } from './constants.js';

/**
 * Create a scrolling camera for a level.
 *
 * @param {object} level - A level created by createLevel (exposes width/height
 *   in tiles). Used to derive the world bounds in pixels.
 * @param {number} viewWidth - Viewport width in pixels.
 * @param {number} viewHeight - Viewport height in pixels.
 * @returns {object} A camera with x/y world offset and a follow(target) method.
 */
export function createCamera(level, viewWidth, viewHeight) {
  const levelWidthPx = level.width * TILE_SIZE;
  const levelHeightPx = level.height * TILE_SIZE;

  /**
   * Clamp a horizontal offset so the viewport stays inside the level.
   * When the level is narrower than the viewport, the offset is pinned to 0.
   */
  function clampX(value) {
    if (levelWidthPx <= viewWidth) return 0;
    return Math.max(0, Math.min(value, levelWidthPx - viewWidth));
  }

  /**
   * Clamp a vertical offset so the viewport stays inside the level.
   * When the level is shorter than the viewport, the offset is pinned to 0.
   */
  function clampY(value) {
    if (levelHeightPx <= viewHeight) return 0;
    return Math.max(0, Math.min(value, levelHeightPx - viewHeight));
  }

  /** @type {object} The camera state shared with the renderer. */
  const camera = {
    /** Top-left world x of the visible viewport, in pixels. */
    x: 0,
    /** Top-left world y of the visible viewport, in pixels. */
    y: 0,
    level,
    viewWidth,
    viewHeight,

    /**
     * Center the camera on a target and clamp to level bounds.
     *
     * @param {object} target - The entity to follow, with x/y (top-left) and
     *   optionally w/h so the viewport centers on the entity's middle.
     * @returns {object} This camera, for chaining.
     */
    follow(target) {
      const w = target.w || 0;
      const h = target.h || 0;
      camera.x = clampX(target.x + w / 2 - viewWidth / 2);
      camera.y = clampY(target.y + h / 2 - viewHeight / 2);
      return camera;
    },

    /** Alias for follow(target) matching the update lifecycle contract. */
    update(target) {
      return camera.follow(target);
    },
  };

  return camera;
}

export default createCamera;