/**
 * Tests for the scrolling camera and Canvas compositor.
 *
 * Verifies:
 *  - the camera follows a target and clamps scrolling to the level bounds,
 *  - the renderer clears the canvas, draws visible level tiles via the level
 *    tile map + drawTile, and draws every registered drawable entity — all
 *    through a mocked 2D context using fillRect primitives only (no images).
 */

import { createCamera } from '../../game/js/camera.js';
import { createRenderer } from '../../game/js/renderer.js';
import { createLevel } from '../../game/js/level.js';
import { TILE_SIZE, VIEW_WIDTH, VIEW_HEIGHT } from '../../game/js/constants.js';

/** Build a fake 2D canvas context that records fillRect/transform calls. */
function makeFakeContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    calls,
    translateCalls: [],
    saveCalls: 0,
    restoreCalls: 0,
    fillRect(x, y, w, h) {
      calls.push({ x, y, w, h });
    },
    translate(x, y) {
      this.translateCalls.push({ x, y });
    },
    save() {
      this.saveCalls += 1;
    },
    restore() {
      this.restoreCalls += 1;
    },
  };
  return ctx;
}

/**
 * Build a level of the given tile dimensions with ground along the bottom row.
 */
function buildLevel(cols, rows, { brickCol = -1, brickRow = -1 } = {}) {
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    grid.push('.'.repeat(cols));
  }
  // Ground along the bottom row.
  grid[rows - 1] = '#'.repeat(cols);
  if (brickCol >= 0 && brickRow >= 0) {
    const row = grid[brickRow].split('');
    row[brickCol] = 'B';
    grid[brickRow] = row.join('');
  }
  return createLevel(grid);
}

/** A small level: 20 tiles wide x 10 tiles tall with ground and a brick. */
function makeLevel() {
  return buildLevel(20, 10, { brickCol: 5, brickRow: 2 });
}

/** A large level (60x30 tiles = 960x480 px) with room to scroll both axes. */
function makeBigLevel() {
  return buildLevel(60, 30, { brickCol: 5, brickRow: 2 });
}

/** A simple drawable entity recording how it was drawn. */
function makeDrawable(label, x, y, w = 16, h = 16) {
  return {
    label,
    x,
    y,
    w,
    h,
    draws: [],
    draw(ctx) {
      this.draws.push({ ctx });
      ctx.fillRect(x, y, w, h);
    },
  };
}

describe('camera follow and clamping', () => {
  const level = makeBigLevel(); // 60 x 30 tiles -> 960 x 480 px world
  const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);

  test('starts at the top-left origin', () => {
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  test('centers on the target when there is room to scroll', () => {
    // Target at world (100, 40). Center of viewport should align.
    camera.follow({ x: 100, y: 40, w: 16, h: 16 });
    expect(camera.x).toBe(100 + 8 - VIEW_WIDTH / 2);
    expect(camera.y).toBe(40 + 8 - VIEW_HEIGHT / 2);
  });

  test('clamps to the level bounds and never scrolls past the edges', () => {
    // Push the target far past the right/bottom edge.
    camera.follow({ x: 10000, y: 10000, w: 16, h: 16 });
    // World width 960 - viewport 256 = max scroll 704.
    expect(camera.x).toBe(level.width * TILE_SIZE - VIEW_WIDTH);
    // World height 480 - viewport 224 = max scroll 256.
    expect(camera.y).toBe(level.height * TILE_SIZE - VIEW_HEIGHT);

    // Push the target before the origin; clamps to 0.
    camera.follow({ x: -1000, y: -1000, w: 16, h: 16 });
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  test('follows the target by centering on its middle', () => {
    const target = { x: 50, y: 50, w: 32, h: 32 };
    camera.follow(target);
    expect(camera.x).toBe(50 + 16 - VIEW_WIDTH / 2);
    expect(camera.y).toBe(50 + 16 - VIEW_HEIGHT / 2);
  });

  test('update(target) is an alias for follow(target)', () => {
    camera.update({ x: 20, y: 20, w: 16, h: 16 });
    expect(camera.x).toBe(20 + 8 - VIEW_WIDTH / 2);
    expect(camera.y).toBe(20 + 8 - VIEW_HEIGHT / 2);
  });
});

describe('renderer composition', () => {
  test('clears the canvas, draws tiles and every drawable in order', () => {
    const level = makeLevel();
    const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);
    const player = makeDrawable('player', 40, 120, 16, 16);
    const enemy = makeDrawable('enemy', 80, 120, 16, 16);

    const renderer = createRenderer({
      level,
      camera,
      drawables: [player, enemy],
    });
    const ctx = makeFakeContext();
    renderer.draw(ctx);

    // 1. Background sky is drawn first as a full-viewport fillRect.
    expect(ctx.calls.length).toBeGreaterThan(0);
    expect(ctx.calls[0]).toEqual({ x: 0, y: 0, w: VIEW_WIDTH, h: VIEW_HEIGHT });

    // 2. Level tiles were drawn (ground/brick) via fillRect.
    const ground = ctx.calls.find((r) => r.x === 0 && r.y === 9 * TILE_SIZE);
    expect(ground).toBeTruthy();
    expect(ground.w).toBe(TILE_SIZE);
    expect(ground.h).toBe(TILE_SIZE);
    const brick = ctx.calls.find((r) => r.x === 5 * TILE_SIZE && r.y === 2 * TILE_SIZE);
    expect(brick).toBeTruthy();

    // 3. Every drawable's draw(ctx) was invoked and drew its own rect.
    expect(player.draws).toHaveLength(1);
    expect(enemy.draws).toHaveLength(1);
    const playerRect = ctx.calls.find((r) => r.x === 40 && r.y === 120);
    expect(playerRect).toBeTruthy();
  });

  test('applies the camera offset to world drawing', () => {
    const level = makeLevel();
    const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);
    // Scroll the camera to world x=64 (a non-zero, in-bounds offset).
    camera.follow({ x: 64, y: 40, w: 16, h: 16 });

    const player = makeDrawable('player', 40, 120, 16, 16);
    const renderer = createRenderer({ level, camera, drawables: [player] });
    const ctx = makeFakeContext();
    renderer.draw(ctx);

    // The camera offset was applied via ctx.translate for entity drawing.
    expect(ctx.translateCalls.some((t) => t.x === -camera.x && t.y === -camera.y)).toBe(true);

    // The level.draw origin shift also uses the camera offset (tiles scroll).
    // The entity's world position minus the camera offset lands on screen.
    const onScreenX = player.x - camera.x;
    expect(ctx.calls.some((r) => r.x === onScreenX && r.y === player.y)).toBe(true);
  });

  test('supports a grouped drawables registry', () => {
    const level = makeLevel();
    const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);
    const coin = makeDrawable('coin', 30, 100, 12, 12);
    const renderer = createRenderer({
      level,
      camera,
      drawables: { players: [], enemies: [], items: [coin], coins: [] },
    });
    const ctx = makeFakeContext();
    renderer.draw(ctx);

    expect(coin.draws).toHaveLength(1);
    expect(ctx.calls.some((r) => r.x === 30 && r.y === 100)).toBe(true);
  });

  test('skips drawables that are not drawable (no draw method)', () => {
    const level = makeLevel();
    const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);
    const renderer = createRenderer({
      level,
      camera,
      drawables: [{ label: 'noop' }],
    });
    const ctx = makeFakeContext();
    expect(() => renderer.draw(ctx)).not.toThrow();
  });
});

describe('renderer never uses images', () => {
  test('uses only fillRect primitives (no drawImage/Image)', () => {
    const src = require('fs').readFileSync('game/js/renderer.js', 'utf8');
    expect(src).not.toMatch(/drawImage\b/);
    expect(src).not.toMatch(/new\s+Image\b/);
    expect(src).not.toMatch(/createElement\(\s*['"]img['"]\s*\)/);
    expect(src).not.toMatch(/\.src\s*=/);
  });
});