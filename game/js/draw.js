/**
 * Canvas pixel-art draw helpers.
 *
 * All rendering uses native Canvas 2D `fillRect` primitives only — no images,
 * no spritesheets, no external assets. Helpers build small rect-based sprites
 * and convenience functions for the renderer to compose the scene.
 */

/**
 * Fill a single pixel-aligned rectangle.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context to draw on.
 * @param {number} x - Left edge in world/canvas pixels.
 * @param {number} y - Top edge in world/canvas pixels.
 * @param {number} w - Width in pixels.
 * @param {number} h - Height in pixels.
 * @param {string} color - CSS color string.
 */
export function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw a single tile-sized square at a given tile coordinate.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
 * @param {number} tileX - Tile column index.
 * @param {number} tileY - Tile row index.
 * @param {string} color - CSS color string.
 */
export function drawTile(ctx, tileX, tileY, color) {
  fillRect(ctx, tileX * 16, tileY * 16, 16, 16, color);
}

/**
 * Draw a simple blocky "player" sprite built from rectangles.
 * A red cap, tan face, blue overalls and brown shoes — all pure fillRect.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
 * @param {number} x - Left edge of the sprite in pixels.
 * @param {number} y - Top edge of the sprite in pixels.
 */
export function drawPlayer(ctx, x, y) {
  // Hat / cap
  fillRect(ctx, x + 2, y, 12, 4, '#e63946');
  fillRect(ctx, x + 4, y + 4, 8, 1, '#e63946');
  // Face
  fillRect(ctx, x + 4, y + 5, 8, 5, '#f4c28d');
  // Eyes
  fillRect(ctx, x + 5, y + 6, 2, 2, '#1d1d1d');
  fillRect(ctx, x + 9, y + 6, 2, 2, '#1d1d1d');
  // Moustache
  fillRect(ctx, x + 5, y + 9, 6, 1, '#5b3a1e');
  // Overalls (blue)
  fillRect(ctx, x + 2, y + 10, 12, 4, '#2a4bd7');
  fillRect(ctx, x + 4, y + 12, 2, 2, '#1d1d1d');
  fillRect(ctx, x + 10, y + 12, 2, 2, '#1d1d1d');
  // Shoes
  fillRect(ctx, x + 2, y + 14, 5, 2, '#6b3a1f');
  fillRect(ctx, x + 9, y + 14, 5, 2, '#6b3a1f');
}

/**
 * Draw a simple "goomba"-style enemy built from rectangles.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
 * @param {number} x - Left edge of the sprite in pixels.
 * @param {number} y - Top edge of the sprite in pixels.
 */
export function drawGoomba(ctx, x, y) {
  // Body
  fillRect(ctx, x + 2, y + 4, 12, 8, '#a0522d');
  // Head / cap
  fillRect(ctx, x + 3, y + 2, 10, 3, '#7a3b1e');
  // Eyes
  fillRect(ctx, x + 4, y + 5, 3, 3, '#fff');
  fillRect(ctx, x + 9, y + 5, 3, 3, '#fff');
  fillRect(ctx, x + 5, y + 6, 1, 1, '#1d1d1d');
  fillRect(ctx, x + 10, y + 6, 1, 1, '#1d1d1d');
  // Feet
  fillRect(ctx, x + 2, y + 12, 5, 2, '#4a2a12');
  fillRect(ctx, x + 9, y + 12, 5, 2, '#4a2a12');
}

/**
 * Clear the full canvas to a solid background color.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
 * @param {string} [color='#5c94fc'] - Background CSS color (classic sky blue).
 */
export function clearCanvas(ctx, color = '#5c94fc') {
  fillRect(ctx, 0, 0, 256, 224, color);
}