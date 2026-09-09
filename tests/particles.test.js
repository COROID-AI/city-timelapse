/**
 * Tests for particles and fx (tests/particles.test.js).
 *
 * Covers:
 *  - spawnBrickFragments(x, y):
 *      - spawns 4 quarter-brick fragments on brick break
 *      - speeds: vx ±30/±60, vy -200/-260
 *      - falls with gravity (1200 px/s²)
 *      - 1.2s lifespan
 *      - renders 8x8 quarter brick via drawPixels
 *  - spawnScorePopup(text, x, y):
 *      - floats text 24px up over 0.8s
 *      - renders via drawText (5x7 pixel font)
 *      - expires after 0.8s
 *  - Integrated composition test of items + fx stack
 */

import {
  spawnBrickFragments,
  spawnScorePopup,
  createBrickFragment,
  BRICK_FRAGMENT_SPRITE,
  BRICK_FRAGMENT_GRAVITY,
  BRICK_FRAGMENT_LIFE,
  SCORE_POPUP_DURATION,
  SCORE_POPUP_FLOAT_DISTANCE,
} from '../src/fx/particles.js';
import { createMushroom } from '../src/entities/mushroom.js';
import { createCoinPop } from '../src/entities/coinPop.js';
import { createTilemap } from '../src/world/tilemap.js';
import { SPRITES } from '../src/render/sprites/index.js';

const DT = 1 / 60;

function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    drawImage: jest.fn(),
    fillText: jest.fn(),
  };
  return { ctx, calls };
}

describe('spawnBrickFragments', () => {
  test('spawns exactly 4 quarter-brick fragments', () => {
    const frags = spawnBrickFragments(64, 128);

    expect(Array.isArray(frags)).toBe(true);
    expect(frags).toHaveLength(4);
    for (const f of frags) {
      expect(f.type).toBe('brickFragment');
      expect(f.w).toBe(8);
      expect(f.h).toBe(8);
      expect(f.alive).toBe(true);
      expect(f.life).toBe(1.2);
    }
  });

  test('fragments have velocities matching vx ±30/±60 and vy -200/-260', () => {
    const frags = spawnBrickFragments({ x: 100, y: 100 });

    const vxSet = new Set(frags.map((f) => f.vx));
    const vySet = new Set(frags.map((f) => f.vy));

    // Horizontal speeds must include ±30 and ±60
    expect(vxSet.has(-60)).toBe(true);
    expect(vxSet.has(60)).toBe(true);
    expect(vxSet.has(-30)).toBe(true);
    expect(vxSet.has(30)).toBe(true);

    // Vertical speeds must include -200 and -260
    expect(vySet.has(-260)).toBe(true);
    expect(vySet.has(-200)).toBe(true);
  });

  test('fragments follow gravity arcs over their 1.2s lifespan', () => {
    const frags = spawnBrickFragments(100, 100);

    // After 0.6s, all fragments should have moved horizontally and vertically
    for (let i = 0; i < 36; i++) {
      for (const f of frags) {
        f.update(DT);
      }
    }

    for (const f of frags) {
      expect(f.alive).toBe(true);
      expect(f.x).not.toBe(100);
      expect(f.vy).toBeGreaterThan(-260); // gravity pulled vy downward
    }

    // Step until 1.25s total elapsed time -> all should be dead
    for (let i = 0; i < 40; i++) {
      for (const f of frags) {
        f.update(DT);
      }
    }

    for (const f of frags) {
      expect(f.alive).toBe(false);
    }
  });

  test('renders 8x8 quarter brick using drawPixels and brick palette', () => {
    const frags = spawnBrickFragments(50, 50);
    const { ctx, calls } = createMockContext();

    frags[0].draw(ctx, { worldToScreen: (x, y) => ({ x: x - 10, y: y - 5 }) });

    expect(calls.length).toBeGreaterThan(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();

    // Palette colors should match brick sprite palette
    const brickPalette = new Set(Object.values(SPRITES.tiles.brick.palette));
    for (const c of calls) {
      expect(brickPalette.has(c.color)).toBe(true);
    }
  });
});

describe('spawnScorePopup', () => {
  test('spawns with given text at (x, y) and alive=true', () => {
    const popup = spawnScorePopup('1000', 80, 120);

    expect(popup.type).toBe('scorePopup');
    expect(popup.text).toBe('1000');
    expect(popup.x).toBe(80);
    expect(popup.y).toBe(120);
    expect(popup.startY).toBe(120);
    expect(popup.duration).toBe(0.8);
    expect(popup.floatDistance).toBe(24);
    expect(popup.alive).toBe(true);
  });

  test('floats text 24px up over 0.8s and expires at 0.8s', () => {
    const startY = 100;
    const popup = spawnScorePopup('200', { x: 50, y: startY });

    // Step 0.4s (half duration) -> should float 12px up (y = 88)
    popup.update(0.4);
    expect(popup.alive).toBe(true);
    expect(popup.y).toBeCloseTo(startY - 12, 4);

    // Step another 0.4s -> floats 24px up (y = 76) and expires
    popup.update(0.4);
    expect(popup.alive).toBe(false);
    expect(popup.y).toBeCloseTo(startY - 24, 4);
  });

  test('draws text using drawText with fillRect only', () => {
    const popup = spawnScorePopup('200', 40, 60);
    const { ctx, calls } = createMockContext();

    popup.draw(ctx, { x: 10, y: 5 });

    expect(calls.length).toBeGreaterThan(0);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // White text by default (#ffffff)
    for (const c of calls) {
      expect(c.color).toBe('#ffffff');
      expect(c.x).toBeGreaterThanOrEqual(40 - 10);
      expect(c.y).toBeGreaterThanOrEqual(60 - 5);
    }
  });

  test('dispose marks popup as dead immediately', () => {
    const popup = spawnScorePopup('100', 0, 0);
    popup.dispose();
    expect(popup.alive).toBe(false);
  });
});

describe('Integrated Item + FX Composition', () => {
  test('mushroom emerges, walks, and wall-bounces on tilemap; coin pops and particles arc', () => {
    // Build a room with a floor and two walls
    const tilemap = createTilemap([
      '#        #',
      '#        #',
      '#        #',
      '##########',
    ], { tileSize: 16 });

    // 1. Mushroom emerges from block at (32, 48), emerges up to y=32, then walks
    const mushroom = createMushroom({ x: 32, y: 48 });
    for (let i = 0; i < 36; i++) {
      mushroom.update(DT, tilemap);
    }
    expect(mushroom.state).toBe('walking');

    // Walk toward right wall and bounce
    let hitRightWall = false;
    for (let i = 0; i < 200; i++) {
      mushroom.update(DT, tilemap);
      if (mushroom.vx < 0) {
        hitRightWall = true;
        break;
      }
    }
    expect(hitRightWall).toBe(true);

    // 2. Coin pop launches, spins and expires
    const coin = createCoinPop({ x: 48, y: 48 });
    let coinScore = 0;
    while (coin.alive) {
      const res = coin.update(DT);
      if (res && res.score) {
        coinScore = res.score;
      }
    }
    expect(coinScore).toBe(200);

    // 3. Brick fragments spawn and arc under gravity
    const fragments = spawnBrickFragments(64, 48);
    expect(fragments).toHaveLength(4);
    for (let i = 0; i < 75; i++) {
      for (const f of fragments) f.update(DT);
    }
    expect(fragments.every((f) => !f.alive)).toBe(true);

    // 4. Score popup floats 24px up and expires
    const popup = spawnScorePopup('+200', 48, 48);
    for (let i = 0; i < 50; i++) {
      popup.update(DT);
    }
    expect(popup.alive).toBe(false);
    expect(popup.y).toBeCloseTo(48 - 24, 2);

    // 5. Renders cleanly through canvas pipeline with mock context
    const { ctx, calls } = createMockContext();
    const liveMushroom = createMushroom({ x: 50, y: 50 });
    const liveCoin = createCoinPop({ x: 50, y: 50 });
    const livePopup = spawnScorePopup('1000', 50, 50);
    const liveFrags = spawnBrickFragments(50, 50);

    liveMushroom.draw(ctx);
    liveCoin.draw(ctx);
    livePopup.draw(ctx);
    for (const f of liveFrags) f.draw(ctx);

    expect(calls.length).toBeGreaterThan(100);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
