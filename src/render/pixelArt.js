/**
 * Pixel-art sprite renderer.
 *
 * The entire game's art is authored as palette string-maps (see
 * src/render/sprites/): each frame is an object of the shape
 *
 *   { palette, width, height, rows }
 *
 * where `rows` is an array of equal-length strings, one screen pixel per
 * character. '.' means transparent; every other character indexes `palette`
 * to a CSS hex color. drawPixels() renders such a frame onto a Canvas 2D
 * context using ONLY fillRect calls — no Image, no drawImage, no external
 * URLs. Cells are square, so drawPixels() works with any frame format.
 *
 * Rendering honors:
 *   - transparency ('.' pixels are skipped entirely),
 *   - palette lookup (each map char emits a fillRect with its color),
 *   - flipX mirroring (the character index is mirrored around the frame's
 *     vertical center line when flipX is set),
 *   - integer/float scale (each source pixel becomes scale x scale device
 *     pixels without leaving seams, because every fillRect edge lines up).
 */

/**
 * @typedef {Object} SpriteFrame
 * @property {Object<string,string>} palette map of art characters to '#rrggbb'
 * @property {number} width  row length in pixels
 * @property {number} height number of rows
 * @property {string[]} rows one string per row, one character per pixel
 */

/**
 * Draw a palette string-map sprite at (x, y) on a Canvas 2D context.
 *
 * The sprite is drawn inside a box of size (width*scale) x (height*scale)
 * whose top-left is (x, y). With flipX the drawn image is mirrored
 * horizontally about the sprite's own vertical center line, so the sprite
 * keeps the same bounding box and anchor while its art faces the other way.
 *
 * Because every source pixel maps to an axis-aligned fillRect of `scale` x
 * `scale` device pixels, adjacent rects share edges exactly — scaling never
 * produces hairline gaps or seams (crisp 3x rendering).
 *
 * @param {CanvasRenderingContext2D} ctx    2D canvas context (method fillRect).
 * @param {SpriteFrame} sprite              frame to draw ('palette' lookup).
 * @param {number} x                        left edge of the drawn box.
 * @param {number} y                        top edge of the drawn box.
 * @param {{scale?: number, flipX?: boolean}} [opts] options.
 * @returns {void}
 */
export function drawPixels(ctx, sprite, x, y, { scale = 1, flipX = false } = {}) {
  const size = Math.max(1, Math.floor(scale));
  const { rows, palette } = sprite;

  ctx.save();
  for (let row = 0; row < rows.length; row += 1) {
    const line = rows[row];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      if (ch === '.') continue; // transparent pixel — nothing to draw
      const color = palette[ch];
      if (color === undefined) continue; // avoid mis-rendering malformed maps

      const sx = flipX ? line.length - 1 - col : col;
      ctx.fillStyle = color;
      ctx.fillRect(x + sx * size, y + row * size, size, size);
    }
  }
  ctx.restore();
}

/**
 * Convenience: measure a sprite frame in logical pixels.
 *
 * @param {SpriteFrame} frame
 * @returns {{width: number, height: number}}
 */
export function spriteSize(frame) {
  return { width: frame.width, height: frame.height };
}

export default drawPixels;