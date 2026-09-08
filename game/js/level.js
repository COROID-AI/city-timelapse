/**
 * Level module: tilemap loading, solidity queries and per-tile rendering.
 *
 * A level is built from a row-major ASCII grid (see game/js/levels/1-1.js for
 * the canonical layout and legend). This module parses the grid into a 2D
 * array of tile identifiers, exposes width/height in tiles, and answers
 * solidity queries that physics, enemies, items and the renderer consume.
 *
 * Rendering reuses the Canvas `drawTile` helper from game/js/draw.js so all
 * tiles are drawn as plain pixel-aligned rectangles — no images.
 */

import { TILE_SIZE } from './constants.js';
import { drawTile } from './draw.js';
import { LEVEL_1_1 } from './levels/1-1.js';

/** Tile identifiers. */
export const TILE = Object.freeze({
  EMPTY: '.',
  GROUND: '#',
  BRICK: 'B',
  QUESTION: '?',
  USED: 'U',
  PIPE_TOP_LEFT: '[',
  PIPE_TOP_RIGHT: ']',
  PIPE_BODY_LEFT: '{',
  PIPE_BODY_RIGHT: '}',
});

/**
 * Tiles considered solid for collision. Terrain, bricks, ? item blocks and all
 * pipe segments are solid; emptied (used) blocks and empty air are not.
 */
const SOLID_TILES = Object.freeze(
  new Set([
    TILE.GROUND,
    TILE.BRICK,
    TILE.QUESTION,
    TILE.PIPE_TOP_LEFT,
    TILE.PIPE_TOP_RIGHT,
    TILE.PIPE_BODY_LEFT,
    TILE.PIPE_BODY_RIGHT,
  ]),
);

/** Colors used to render each tile as a Canvas rectangle. */
const TILE_COLORS = Object.freeze({
  [TILE.GROUND]: '#8a5a2b',
  [TILE.BRICK]: '#b5651d',
  [TILE.QUESTION]: '#d4a017',
  [TILE.USED]: '#7a5a3a',
  [TILE.PIPE_TOP_LEFT]: '#4c9a3d',
  [TILE.PIPE_TOP_RIGHT]: '#4c9a3d',
  [TILE.PIPE_BODY_LEFT]: '#3f7f2f',
  [TILE.PIPE_BODY_RIGHT]: '#3f7f2f',
});

/**
 * Create a level from a row-major ASCII grid.
 *
 * @param {string[]} rows - Each string is one tile row; first is the top row.
 * @returns {object} The parsed level with width/height (in tiles), getTile,
 *   getTileAt, isSolidAt and draw helpers.
 */
export function createLevel(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('createLevel requires a non-empty row-major tile grid.');
  }

  const height = rows.length;
  const width = rows[0].length;
  if (width === 0) {
    throw new Error('createLevel requires rows at least one tile wide.');
  }

  // Normalize every row to the same width; reject ragged grids so tile
  // coordinates stay well-defined.
  const grid = rows.map((rawRow, index) => {
    if (typeof rawRow !== 'string') {
      throw new Error(`Level row ${index} is not a string.`);
    }
    if (rawRow.length !== width) {
      throw new Error(
        `Level row ${index} has width ${rawRow.length}, expected ${width}.`,
      );
    }
    return rawRow.split('');
  });

  /** The canonical tile identifier at a tile coordinate. */
  function getTile(col, row) {
    if (col < 0 || col >= width || row < 0 || row >= height) {
      return TILE.EMPTY;
    }
    return grid[row][col];
  }

  /** Alias matching the "getTileAt" naming in the task brief. */
  function getTileAt(col, row) {
    return getTile(col, row);
  }

  /** Whether the tile at a coordinate is solid for collision. */
  function isSolidAt(col, row) {
    return SOLID_TILES.has(getTile(col, row));
  }

  /** Whether a tile identifier is solid (useful for tile-level checks). */
  function isSolidTile(tile) {
    return SOLID_TILES.has(tile);
  }

  /**
   * Draw the level onto a canvas context. Only in-bounds tiles are drawn;
   * empty air is skipped.
   *
   * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
   * @param {number} [originX=0] - Offset in pixels applied to the tile x.
   * @param {number} [originY=0] - Offset in pixels applied to the tile y.
   */
  function draw(ctx, originX = 0, originY = 0) {
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const tile = grid[row][col];
        if (tile === TILE.EMPTY) continue;
        const color = TILE_COLORS[tile];
        if (!color) continue;
        drawTile(ctx, originX / TILE_SIZE + col, originY / TILE_SIZE + row, color);
      }
    }
  }

  return Object.freeze({
    width,
    height,
    grid,
    getTile,
    getTileAt,
    isSolidAt,
    isSolidTile,
    draw,
  });
}

/** Convenience factory returning the classic 1-1 inspired level. */
export function createLevel1_1() {
  return createLevel(LEVEL_1_1);
}

export default createLevel;