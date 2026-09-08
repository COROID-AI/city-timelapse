/**
 * Tests for pixel-art sprite and palette assets.
 *
 * Verifies:
 *  - every sprite map is a rectangular grid (all rows equal length),
 *  - every color key resolves to a palette entry (no unknown keys),
 *  - drawing funnels through `fillRect` primitives only (no image loading),
 *  - transparent '.' keys are skipped and unknown keys throw.
 */

import { palette } from '../../game/js/palette.js';
import { drawSprite, sprites } from '../../game/js/sprites.js';

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

/**
 * Collect every sprite map (array of strings) from the sprites tree.
 * Handles both flat arrays and objects holding multiple frames.
 */
function collectGrids(node, out = []) {
  if (Array.isArray(node) && typeof node[0] === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    // Array of frames (e.g. mario.run) — each element is a grid.
    for (const item of node) {
      collectGrids(item, out);
    }
    return out;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      collectGrids(value, out);
    }
  }
  return out;
}

describe('palette', () => {
  test('defines named colors as CSS strings', () => {
    expect(Object.keys(palette).length).toBeGreaterThan(0);
    for (const color of Object.values(palette)) {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('sprite maps', () => {
  const grids = collectGrids(sprites);
  const keys = Object.keys(palette);

  test('defines all required sprite categories', () => {
    expect(sprites.mario).toBeDefined();
    expect(sprites.mario.idle).toBeDefined();
    expect(sprites.mario.run).toBeDefined();
    expect(sprites.mario.jump).toBeDefined();
    expect(sprites.goomba).toBeDefined();
    expect(sprites.goomba.walk).toBeDefined();
    expect(sprites.goomba.squash).toBeDefined();
    expect(sprites.coin).toBeDefined();
    expect(sprites.coin.spin).toBeDefined();
    expect(sprites.mushroom).toBeDefined();
    expect(sprites.tiles).toBeDefined();
    expect(sprites.tiles.brick).toBeDefined();
    expect(sprites.tiles.question).toBeDefined();
    expect(sprites.tiles.used).toBeDefined();
    expect(sprites.tiles.ground).toBeDefined();
    expect(sprites.tiles.pipe).toBeDefined();
  });

  test('has at least one grid for each entity', () => {
    expect(grids.length).toBeGreaterThanOrEqual(8);
  });

  test('every sprite map is a rectangular grid', () => {
    for (const grid of grids) {
      expect(grid.length).toBeGreaterThan(0);
      const width = grid[0].length;
      expect(width).toBeGreaterThan(0);
      for (const row of grid) {
        expect(row).toHaveLength(width);
      }
    }
  });

  test('every color key resolves to a palette entry', () => {
    for (const grid of grids) {
      for (const row of grid) {
        for (const char of row) {
          expect(char).not.toBe(' ');
          if (char !== '.') {
            expect(keys).toContain(char);
          }
        }
      }
    }
  });
});

describe('drawing through fillRect', () => {
  test('drawSprite draws exactly one fillRect per opaque pixel', () => {
    const ctx = makeFakeContext();
    // 1x3 grid with one transparent and two opaque pixels.
    drawSprite(ctx, ['.RK'], 0, 0);
    expect(ctx.fillRectCalls).toHaveLength(2);
    expect(ctx.fillRectCalls[0]).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(ctx.fillRectCalls[1]).toEqual({ x: 2, y: 0, w: 1, h: 1 });
  });

  test('drawSprite honors the scale multiplier', () => {
    const ctx = makeFakeContext();
    drawSprite(ctx, ['R'], 4, 5, 2);
    expect(ctx.fillRectCalls[0]).toEqual({ x: 4, y: 5, w: 2, h: 2 });
  });

  test('drawSprite throws on an unknown color key', () => {
    const ctx = makeFakeContext();
    expect(() => drawSprite(ctx, ['Z'], 0, 0)).toThrow(/Unknown sprite color key/);
  });

  test('every sprite grid draws with fillRect without throwing', () => {
    for (const [name, grid] of Object.entries(collectGrids(sprites))) {
      const ctx = makeFakeContext();
      drawSprite(ctx, grid, 0, 0);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    }
  });

  test('drawing never loads images (no Image/HTMLImageElement usage)', () => {
    const src = require('fs').readFileSync('game/js/sprites.js', 'utf8');
    expect(src).not.toMatch(/new\s+Image\b/);
    expect(src).not.toMatch(/createElement\(\s*['"]img['"]\s*\)/);
    expect(src).not.toMatch(/\.src\s*=/);
    expect(src).not.toMatch(/drawImage\b/);
  });
});