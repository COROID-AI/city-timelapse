/**
 * Tests for the level tilemap: layout parsing, solidity queries for
 * terrain/bricks/items/pipes, and non-solid empties (including used blocks).
 */

import { createLevel, createLevel1_1, TILE } from '../../game/js/level.js';
import { LEVEL_1_1 } from '../../game/js/levels/1-1.js';

/** Build a fake 2D canvas context that records fillRect calls. */
function makeFakeContext() {
  return {
    fillStyle: null,
    fillRectCalls: [],
    fillRect(x, y, w, h) {
      this.fillRectCalls.push({ x, y, w, h });
    },
  };
}

describe('level layout parse', () => {
  test('loads the 1-1 inspired level with expected dimensions', () => {
    const level = createLevel1_1();
    expect(level.width).toBe(100);
    expect(level.height).toBe(15);
    expect(level.grid.length).toBe(15);
    expect(level.grid.every((r) => r.length === 100)).toBe(true);
  });

  test('parses terrain, bricks, ? blocks, used blocks and pipes', () => {
    const level = createLevel1_1();
    // Ground terrain.
    expect(level.getTile(5, 13)).toBe(TILE.GROUND);
    expect(level.getTileAt(99, 14)).toBe(TILE.GROUND);
    // Brick blocks.
    expect(level.getTile(12, 8)).toBe(TILE.BRICK);
    expect(level.getTile(46, 9)).toBe(TILE.BRICK);
    // ? item blocks.
    expect(level.getTile(17, 8)).toBe(TILE.QUESTION);
    expect(level.getTile(59, 9)).toBe(TILE.QUESTION);
    // Used (emptied) block.
    expect(level.getTile(68, 8)).toBe(TILE.USED);
    // Pipe top and body segments.
    expect(level.getTile(30, 10)).toBe(TILE.PIPE_TOP_LEFT);
    expect(level.getTile(31, 10)).toBe(TILE.PIPE_TOP_RIGHT);
    expect(level.getTile(30, 11)).toBe(TILE.PIPE_BODY_LEFT);
    expect(level.getTile(31, 11)).toBe(TILE.PIPE_BODY_RIGHT);
    // Empty air.
    expect(level.getTile(0, 0)).toBe(TILE.EMPTY);
  });

  test('getTile and getTileAt agree and stay safe out of bounds', () => {
    const level = createLevel1_1();
    expect(level.getTile(5, 13)).toBe(level.getTileAt(5, 13));
    // Out-of-bounds reads return EMPTY rather than throwing.
    expect(level.getTile(-1, 0)).toBe(TILE.EMPTY);
    expect(level.getTile(100, 0)).toBe(TILE.EMPTY);
    expect(level.getTile(0, 15)).toBe(TILE.EMPTY);
  });

  test('rejects ragged grids', () => {
    expect(() => createLevel(['###', '##'])).toThrow(/width/);
    expect(() => createLevel([])).toThrow(/non-empty/);
  });
});

describe('level solidity', () => {
  test('ground terrain is solid', () => {
    const level = createLevel1_1();
    expect(level.isSolidAt(5, 13)).toBe(true);
    expect(level.isSolidAt(99, 14)).toBe(true);
  });

  test('brick blocks are solid', () => {
    const level = createLevel1_1();
    expect(level.isSolidAt(12, 8)).toBe(true);
    expect(level.isSolidAt(46, 9)).toBe(true);
  });

  test('? item blocks are solid', () => {
    const level = createLevel1_1();
    expect(level.isSolidAt(17, 8)).toBe(true);
    expect(level.isSolidAt(59, 9)).toBe(true);
  });

  test('pipe segments are solid', () => {
    const level = createLevel1_1();
    expect(level.isSolidAt(30, 10)).toBe(true); // top-left
    expect(level.isSolidAt(31, 10)).toBe(true); // top-right
    expect(level.isSolidAt(30, 11)).toBe(true); // body-left
    expect(level.isSolidAt(31, 12)).toBe(true); // body-right
  });

  test('emptied (used) blocks and empty cells are not solid', () => {
    const level = createLevel1_1();
    // Used block is drained and must not block collision.
    expect(level.isSolidAt(68, 8)).toBe(false);
    // Open air.
    expect(level.isSolidAt(0, 0)).toBe(false);
    // The pit gap is not solid.
    expect(level.isSolidAt(70, 13)).toBe(false);
    expect(level.isSolidAt(71, 14)).toBe(false);
  });
});

describe('level drawing', () => {
  test('draw renders solid tiles as Canvas rects and skips empty air', () => {
    const level = createLevel1_1();
    const ctx = makeFakeContext();
    level.draw(ctx);
    // Every drawn tile is a 16x16 rect at the tile's pixel coordinate.
    expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    const ground = ctx.fillRectCalls.find(
      (r) => r.x === 5 * 16 && r.y === 13 * 16,
    );
    expect(ground).toBeTruthy();
    expect(ground.w).toBe(16);
    expect(ground.h).toBe(16);
    const empty = ctx.fillRectCalls.find(
      (r) => r.x === 0 * 16 && r.y === 0 * 16,
    );
    expect(empty).toBeUndefined();
  });
});