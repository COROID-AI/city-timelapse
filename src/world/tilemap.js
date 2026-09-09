/**
 * Tilemap engine for 2D platformer grid.
 *
 * Parses ASCII string rows according to the documented legend, manages
 * solidity queries, block contents, state transitions (e.g. ? -> U, m -> U),
 * and block bump animations for rendering.
 */

import { CONSTANTS } from '../core/constants.js';

/**
 * Tile legend codes:
 * X: Ground (solid)
 * #: Solid stone / Indestructible block (solid)
 * B: Breakable brick block (solid)
 * ?: Coin question block (solid)
 * M: Mushroom question block (solid)
 * m: Multi-coin brick block (solid)
 * U: Used / Empty block (solid)
 * [: Pipe top-left (solid)
 * ]: Pipe top-right (solid)
 * {: Pipe body-left (solid)
 * }: Pipe body-right (solid)
 * F: Flagpole segment (non-solid trigger geometry)
 * C: Castle anchor / decor (non-solid)
 * ' ': Empty air space (non-solid)
 */
export const TILES = Object.freeze({
  EMPTY: ' ',
  GROUND: 'X',
  STONE: '#',
  BRICK: 'B',
  QUESTION_COIN: '?',
  QUESTION_MUSHROOM: 'M',
  MULTI_COIN: 'm',
  USED: 'U',
  PIPE_TOP_LEFT: '[',
  PIPE_TOP_RIGHT: ']',
  PIPE_BODY_LEFT: '{',
  PIPE_BODY_RIGHT: '}',
  FLAGPOLE: 'F',
  CASTLE: 'C',
});

export const SOLID_TILES = new Set([
  TILES.GROUND,
  TILES.STONE,
  TILES.BRICK,
  TILES.QUESTION_COIN,
  TILES.QUESTION_MUSHROOM,
  TILES.MULTI_COIN,
  TILES.USED,
  TILES.PIPE_TOP_LEFT,
  TILES.PIPE_TOP_RIGHT,
  TILES.PIPE_BODY_LEFT,
  TILES.PIPE_BODY_RIGHT,
]);

/**
 * Determines whether a given tile character code is solid.
 * @param {string|null|undefined} code - The tile character code.
 * @returns {boolean} True if solid, false otherwise.
 */
export function isSolidTile(code) {
  if (!code || typeof code !== 'string') return false;
  return SOLID_TILES.has(code);
}

/**
 * Creates and initializes a tilemap instance from ASCII grid rows.
 *
 * @param {string[]} gridRows - Array of strings representing level rows.
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.tileSize=16] - Size of each tile in pixels.
 * @param {number} [options.multiCoinHits=5] - Number of hits before a multi-coin brick is depleted.
 * @param {number} [options.bumpDuration=0.15] - Duration of block bump animation in seconds.
 * @param {number} [options.bumpHeight=6] - Maximum vertical displacement for bump animation in pixels.
 * @param {Object|Map} [options.blockContents] - Optional custom initial block contents map.
 * @returns {Tilemap} The tilemap instance.
 */
export function createTilemap(gridRows = [], options = {}) {
  const tileSize = options.tileSize ?? CONSTANTS.TILE_SIZE ?? 16;
  const multiCoinHits = options.multiCoinHits ?? 5;
  const bumpDuration = options.bumpDuration ?? 0.15;
  const bumpHeight = options.bumpHeight ?? 6;

  const height = gridRows.length;
  const width = height > 0 ? Math.max(...gridRows.map((r) => r.length), 0) : 0;
  const pixelWidth = width * tileSize;
  const pixelHeight = height * tileSize;

  // Build 2D grid array (rows x cols)
  const grid = [];
  const blockContents = new Map();

  for (let y = 0; y < height; y++) {
    const rowStr = gridRows[y] || '';
    const row = [];
    for (let x = 0; x < width; x++) {
      const code = x < rowStr.length ? rowStr[x] : TILES.EMPTY;
      row.push(code);

      const key = `${x},${y}`;
      if (code === TILES.QUESTION_COIN) {
        blockContents.set(key, {
          tx: x,
          ty: y,
          type: 'coin',
          hitsRemaining: 1,
          maxHits: 1,
          depleted: false,
        });
      } else if (code === TILES.QUESTION_MUSHROOM) {
        blockContents.set(key, {
          tx: x,
          ty: y,
          type: 'mushroom',
          hitsRemaining: 1,
          maxHits: 1,
          depleted: false,
        });
      } else if (code === TILES.MULTI_COIN) {
        blockContents.set(key, {
          tx: x,
          ty: y,
          type: 'multi',
          hitsRemaining: multiCoinHits,
          maxHits: multiCoinHits,
          depleted: false,
        });
      } else if (code === TILES.BRICK) {
        blockContents.set(key, {
          tx: x,
          ty: y,
          type: 'brick',
          hitsRemaining: 1,
          maxHits: 1,
          depleted: false,
        });
      }
    }
    grid.push(row);
  }

  // Allow custom overrides from options.blockContents
  if (options.blockContents) {
    if (options.blockContents instanceof Map) {
      for (const [k, v] of options.blockContents.entries()) {
        blockContents.set(k, { ...v });
      }
    } else if (typeof options.blockContents === 'object') {
      for (const [k, v] of Object.entries(options.blockContents)) {
        blockContents.set(k, { ...v });
      }
    }
  }

  // Active bump animations keyed by "tx,ty"
  const bumpAnimations = new Map();

  const tilemap = {
    width,
    height,
    tileSize,
    pixelWidth,
    pixelHeight,
    grid,
    blockContents,
    options: {
      tileSize,
      multiCoinHits,
      bumpDuration,
      bumpHeight,
      ...options,
    },

    /**
     * Returns the tile code at tile coordinate (tx, ty).
     * Returns null if out of grid bounds.
     */
    tileAt(tx, ty) {
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        return null;
      }
      return grid[ty][tx];
    },

    /**
     * Checks if a tile code is solid.
     */
    isSolidTile(code) {
      return isSolidTile(code);
    },

    /**
     * Checks if the world pixel position (px, py) falls on a solid tile.
     * @param {number} px - X position in world pixels.
     * @param {number} py - Y position in world pixels.
     * @returns {boolean} True if solid, false if air or out of bounds.
     */
    isSolidAt(px, py) {
      const tx = Math.floor(px / tileSize);
      const ty = Math.floor(py / tileSize);
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        return false;
      }
      return isSolidTile(grid[ty][tx]);
    },

    /**
     * Sets the tile code at (tx, ty).
     * @param {number} tx - Tile column.
     * @param {number} ty - Tile row.
     * @param {string} code - Tile character code.
     * @returns {boolean} True if in bounds and set successfully.
     */
    setTile(tx, ty, code) {
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        return false;
      }
      grid[ty][tx] = code;
      return true;
    },

    /**
     * Gets block contents metadata for (tx, ty).
     */
    getBlockContents(tx, ty) {
      return blockContents.get(`${tx},${ty}`) || null;
    },

    /**
     * Starts or resets a bump animation for tile (tx, ty).
     */
    startBumpAnimation(tx, ty, duration = bumpDuration, maxOffset = bumpHeight) {
      const key = `${tx},${ty}`;
      bumpAnimations.set(key, {
        tx,
        ty,
        t: 0,
        offsetY: 0,
        duration,
        elapsed: 0,
        maxOffset,
      });
    },

    /**
     * Bumps a block at (tx, ty).
     *
     * Transitions ? -> U, M -> U, m -> U (after N hits), returns hit result
     * and triggers bump animation.
     *
     * @param {number} tx - Tile column.
     * @param {number} ty - Tile row.
     * @returns {Object|null} BlockHitResult { type: 'coin'|'mushroom'|'brick'|'multi', ... } or null.
     */
    bumpBlock(tx, ty) {
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        return null;
      }
      const tile = grid[ty][tx];
      const key = `${tx},${ty}`;

      if (tile === TILES.QUESTION_COIN || tile === TILES.QUESTION_MUSHROOM) {
        const type = tile === TILES.QUESTION_COIN ? 'coin' : 'mushroom';
        this.setTile(tx, ty, TILES.USED);
        this.startBumpAnimation(tx, ty);

        const entry = blockContents.get(key) || { tx, ty, type };
        entry.depleted = true;
        entry.hitsRemaining = 0;
        blockContents.set(key, entry);

        return {
          type,
          depleted: true,
          tile: TILES.USED,
          tx,
          ty,
        };
      }

      if (tile === TILES.MULTI_COIN) {
        let entry = blockContents.get(key);
        if (!entry) {
          entry = {
            tx,
            ty,
            type: 'multi',
            hitsRemaining: multiCoinHits,
            maxHits: multiCoinHits,
            depleted: false,
          };
          blockContents.set(key, entry);
        }

        entry.hitsRemaining -= 1;
        this.startBumpAnimation(tx, ty);

        if (entry.hitsRemaining <= 0) {
          entry.depleted = true;
          this.setTile(tx, ty, TILES.USED);
          return {
            type: 'multi',
            depleted: true,
            tile: TILES.USED,
            tx,
            ty,
            remaining: 0,
          };
        } else {
          return {
            type: 'multi',
            depleted: false,
            tile: TILES.MULTI_COIN,
            tx,
            ty,
            remaining: entry.hitsRemaining,
          };
        }
      }

      if (tile === TILES.BRICK) {
        this.startBumpAnimation(tx, ty);
        const entry = blockContents.get(key) || { tx, ty, type: 'brick', depleted: false };
        return {
          type: 'brick',
          depleted: false,
          tile: TILES.BRICK,
          tx,
          ty,
        };
      }

      return null;
    },

    /**
     * Updates active bump animations by delta time dt (seconds).
     * @param {number} dt - Elapsed seconds since last frame.
     */
    update(dt = 0) {
      if (dt <= 0) return;
      for (const [key, anim] of bumpAnimations.entries()) {
        anim.elapsed += dt;
        if (anim.elapsed >= anim.duration) {
          bumpAnimations.delete(key);
        } else {
          anim.t = Math.min(1, anim.elapsed / anim.duration);
          anim.offsetY = -Math.sin(anim.t * Math.PI) * anim.maxOffset;
        }
      }
    },

    /**
     * Alias for update(dt) for explicit bump animation tick.
     */
    updateBumpAnimations(dt = 0) {
      this.update(dt);
    },

    /**
     * Returns an array of currently active bump animations with their render offsets.
     * @returns {Array<{tx: number, ty: number, t: number, offsetY: number, duration: number, elapsed: number}>}
     */
    activeBumpAnimations() {
      const active = [];
      for (const anim of bumpAnimations.values()) {
        active.push({
          tx: anim.tx,
          ty: anim.ty,
          t: anim.t,
          offsetY: anim.offsetY,
          duration: anim.duration,
          elapsed: anim.elapsed,
        });
      }
      return active;
    },

    /**
     * Returns the vertical visual pixel offset for a tile undergoing a bump animation, or 0.
     * @param {number} tx - Tile column.
     * @param {number} ty - Tile row.
     * @returns {number} Pixel Y offset (negative = upward displacement).
     */
    getBumpOffset(tx, ty) {
      const anim = bumpAnimations.get(`${tx},${ty}`);
      return anim ? anim.offsetY : 0;
    },

    /**
     * Finds all tile coordinates matching a given code.
     * @param {string} code - Tile code to find.
     * @returns {Array<{tx: number, ty: number}>}
     */
    findTiles(code) {
      const matches = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === code) {
            matches.push({ tx: x, ty: y });
          }
        }
      }
      return matches;
    },

    /**
     * Exports grid back to array of ASCII string rows.
     * @returns {string[]}
     */
    toGridRows() {
      return grid.map((row) => row.join(''));
    },
  };

  return tilemap;
}

export default createTilemap;
