/**
 * Canvas compositor.
 *
 * The renderer draws the whole scene in a single pass each frame:
 *   1. the background sky,
 *   2. the visible level tiles (reusing the level's tile map + drawTile),
 *   3. every registered drawable entity via its draw(ctx) contract.
 *
 * All rendering funnels through the fillRect primitives in game/js/draw.js —
 * no images, no spritesheets. The camera offset is applied to world drawing so
 * tiles and entities appear correctly scrolled into the viewport.
 */

import { clearCanvas } from './draw.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from './constants.js';

/** Default sky-blue background (matches the classic NES sky). */
const SKY_COLOR = '#5c94fc';

/**
 * Flatten a drawables registry into a plain array of entities that each expose
 * a draw(ctx) method. Accepts either a plain array of drawables or a grouped
 * object (e.g. { players, enemies, items, coins }) whose values are arrays.
 *
 * @param {Array|object} registry - The drawables registry.
 * @returns {Array<object>} Flat list of drawables.
 */
function collectDrawables(registry) {
  if (Array.isArray(registry)) return registry;
  const out = [];
  for (const value of Object.values(registry)) {
    if (Array.isArray(value)) {
      out.push(...value);
    } else if (value && typeof value.draw === 'function') {
      out.push(value);
    }
  }
  return out;
}

/**
 * Create the scene renderer.
 *
 * @param {object} options - Renderer dependencies.
 * @param {object} options.level - A level created by createLevel. Its draw()
 *   renders the tile map via drawTile fillRect primitives.
 * @param {object} options.camera - A camera created by createCamera. Its x/y
 *   offset positions the visible viewport.
 * @param {Array|object} options.drawables - Registry of drawable entities, each
 *   exposing draw(ctx). May be a flat array or grouped by category.
 * @param {string} [options.background=SKY_COLOR] - Sky color for the backdrop.
 * @returns {object} A renderer with a draw(ctx) method.
 */
export function createRenderer({ level, camera, drawables, background = SKY_COLOR }) {
  const list = collectDrawables(drawables);
  const viewWidth = camera.viewWidth || VIEW_WIDTH;
  const viewHeight = camera.viewHeight || VIEW_HEIGHT;

  return {
    level,
    camera,
    drawables: list,
    viewWidth,
    viewHeight,

    /**
     * Compose the full frame onto a 2D canvas context.
     *
     * Order: sky backdrop, level tiles, then every drawable (translated by the
     * camera offset so entities draw in world coordinates).
     *
     * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
     */
    draw(ctx) {
      // 1. Background sky — full-screen fillRect in canvas space.
      clearCanvas(ctx, background);

      // 2. Visible level tiles. level.draw applies the camera offset internally
      //    (via drawTile fillRect primitives) so tiles scroll with the view.
      level.draw(ctx, -camera.x, -camera.y);

      // 3. Drawable entities. The context is translated by the camera offset so
      //    each entity draws at its world position and lands on screen.
      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      for (const drawable of list) {
        if (drawable && typeof drawable.draw === 'function') {
          drawable.draw(ctx);
        }
      }
      ctx.restore();
    },
  };
}

export default createRenderer;