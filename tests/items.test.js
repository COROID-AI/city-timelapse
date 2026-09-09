/**
 * Tests for items: mushroom and coin pop (tests/items.test.js).
 *
 * Covers:
 *  - createMushroom({x, y}):
 *      - emerges vertically 16px over 0.6s without tile collision
 *      - transitions to a 14x14 physics walker at 45 px/s
 *      - walks right by default
 *      - falls under gravity and lands on solid tilemap ground
 *      - reverses horizontal direction upon hitting walls
 *      - exposes onCollect() returning score/power-up and clearing alive
 *      - renders via drawPixels with SPRITES.items.mushroom
 *  - createCoinPop({x, y}):
 *      - launches with vy = -260 under 1200 px/s² gravity
 *      - cycles through the 4 coin spin frames
 *      - expires when falling back to its start y
 *      - reports +200 score on expiry
 *      - renders via drawPixels with coin frames
 */

import { CONSTANTS } from '../src/core/constants.js';
import { createMushroom, EMERGE_DURATION, EMERGE_DISTANCE, MUSHROOM_SPEED } from '../src/entities/mushroom.js';
import { createCoinPop, COIN_POP_INITIAL_VY, COIN_POP_GRAVITY, COIN_POP_SCORE } from '../src/entities/coinPop.js';
import { createTilemap, TILES } from '../src/world/tilemap.js';
import { LEVEL_ONE } from '../src/levels/level1.js';
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

describe('createMushroom', () => {
  test('instantiates with correct initial properties and state', () => {
    const mushroom = createMushroom({ x: 100, y: 160 });

    expect(mushroom.x).toBe(100);
    expect(mushroom.y).toBe(160);
    expect(mushroom.w).toBe(14);
    expect(mushroom.h).toBe(14);
    expect(mushroom.alive).toBe(true);
    expect(mushroom.state).toBe('emerging');
    expect(mushroom.isEmerging).toBe(true);
    expect(typeof mushroom.update).toBe('function');
    expect(typeof mushroom.draw).toBe('function');
    expect(typeof mushroom.onCollect).toBe('function');
    expect(typeof mushroom.dispose).toBe('function');
  });

  test('emerges vertically 16px over 0.6s without tile collision', () => {
    // Put mushroom inside a solid block to prove collision is ignored during emerge
    const map = createTilemap([
      '######',
      '######',
      '######',
    ]);
    const startY = 32;
    const mushroom = createMushroom({ x: 16, y: startY });

    // Step 0.3s (half of emerge)
    mushroom.update(0.3, map);
    expect(mushroom.state).toBe('emerging');
    expect(mushroom.y).toBeCloseTo(startY - 8, 5);

    // Step another 0.3s (completing 0.6s emerge)
    mushroom.update(0.3, map);
    expect(mushroom.state).toBe('walking');
    expect(mushroom.y).toBeCloseTo(startY - 16, 5);
    expect(mushroom.isEmerging).toBe(false);
  });

  test('becomes a 14x14 walker moving right at 45 px/s after emerging', () => {
    const mushroom = createMushroom({ x: 50, y: 100 });

    // Complete emergence
    mushroom.update(EMERGE_DURATION);
    expect(mushroom.state).toBe('walking');
    expect(mushroom.vx).toBe(MUSHROOM_SPEED);
    expect(mushroom.facing).toBe(1);

    // Step forward 1s without collision obstacles
    const prevX = mushroom.x;
    mushroom.update(1.0);
    expect(mushroom.x).toBeCloseTo(prevX + 45, 1);
  });

  test('lands on solid ground and falls with gravity while walking', () => {
    const map = createTilemap([
      '          ',
      '          ',
      '          ',
      'XXXXXXXXXX',
    ], { tileSize: 16 });

    // Ground is at y = 48. Spawn mushroom emerging from y = 48.
    const mushroom = createMushroom({ x: 32, y: 48 });
    mushroom.update(0.6); // Emerge up to y = 32

    expect(mushroom.y).toBe(32);

    // Update with physics: should fall with gravity and land on row 3 (y = 48)
    for (let i = 0; i < 30; i++) {
      mushroom.update(DT, map);
    }

    // Hitbox is 14 tall, ground is at 48 -> feet at 48, y = 48 - 14 = 34
    expect(mushroom.y).toBe(48 - 14);
    expect(mushroom.body.onGround).toBe(true);
  });

  test('reverses horizontal direction upon hitting walls', () => {
    // Map with walls on left and right:
    // col 0: solid wall, col 1-5: air, col 6: solid wall
    // row 2: solid floor
    const map = createTilemap([
      '#    #',
      '#    #',
      '######',
    ], { tileSize: 16 });

    // Floor top is y = 32. Mushroom is at x = 32 (col 2), y = 32 - 14 = 18.
    const mushroom = createMushroom({ x: 32, y: 32 });
    mushroom.update(0.6); // emerges to y = 16

    // Walks right initially toward right wall at x = 5 * 16 = 80
    let reversedToLeft = false;
    for (let i = 0; i < 100; i++) {
      mushroom.update(DT, map);
      if (mushroom.vx < 0) {
        reversedToLeft = true;
        break;
      }
    }
    expect(reversedToLeft).toBe(true);
    expect(mushroom.vx).toBe(-MUSHROOM_SPEED);
    expect(mushroom.facing).toBe(-1);

    // Continues left toward left wall at x = 16
    let reversedToRight = false;
    for (let i = 0; i < 150; i++) {
      mushroom.update(DT, map);
      if (mushroom.vx > 0) {
        reversedToRight = true;
        break;
      }
    }
    expect(reversedToRight).toBe(true);
    expect(mushroom.vx).toBe(MUSHROOM_SPEED);
    expect(mushroom.facing).toBe(1);
  });

  test('reverses off pipes in real Level 1 layout', () => {
    const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
    // Pipe 1 is at cols 28-29 (x = 448..480), ground at row 13 (y = 208).
    // Spawn mushroom at x = 400, y = 208.
    const mushroom = createMushroom({ x: 400, y: 208 });
    mushroom.update(0.6, map); // emerges

    let hitPipe = false;
    for (let i = 0; i < 120; i++) {
      mushroom.update(DT, map);
      if (mushroom.vx < 0) {
        hitPipe = true;
        break;
      }
    }
    expect(hitPipe).toBe(true);
    expect(mushroom.vx).toBe(-MUSHROOM_SPEED);
  });

  test('onCollect awards 1000 score and marks alive=false', () => {
    const mushroom = createMushroom({ x: 100, y: 100 });
    const reward = mushroom.onCollect();

    expect(reward).toEqual({
      type: 'mushroom',
      score: 1000,
      powerup: 'super',
    });
    expect(mushroom.alive).toBe(false);
  });

  test('dispose sets alive=false', () => {
    const mushroom = createMushroom({ x: 100, y: 100 });
    mushroom.dispose();
    expect(mushroom.alive).toBe(false);
  });

  test('draws using drawPixels and SPRITES.items.mushroom with camera offset', () => {
    const mushroom = createMushroom({ x: 100, y: 150 });
    const { ctx, calls } = createMockContext();

    mushroom.draw(ctx, { worldToScreen: (x, y) => ({ x: x - 20, y: y - 10 }) });

    expect(calls.length).toBeGreaterThan(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();

    // Mushroom sprite is 16x16; drawn around screenX - 1, screenY - 2
    for (const c of calls) {
      expect(c.x).toBeGreaterThanOrEqual(100 - 20 - 2);
      expect(c.y).toBeGreaterThanOrEqual(150 - 10 - 3);
    }
  });
});

describe('createCoinPop', () => {
  test('instantiates with vy = -260, 1200 gravity and alive=true', () => {
    const coin = createCoinPop({ x: 80, y: 120 });

    expect(coin.x).toBe(80);
    expect(coin.y).toBe(120);
    expect(coin.startY).toBe(120);
    expect(coin.w).toBe(16);
    expect(coin.h).toBe(16);
    expect(coin.vy).toBe(COIN_POP_INITIAL_VY);
    expect(coin.gravity).toBe(COIN_POP_GRAVITY);
    expect(coin.score).toBe(COIN_POP_SCORE);
    expect(coin.alive).toBe(true);
    expect(coin.expired).toBe(false);
  });

  test('arcs upward under gravity, reaches apex, and falls back', () => {
    const startY = 100;
    const coin = createCoinPop({ x: 50, y: startY });

    let minPosY = startY;
    let reachedApex = false;

    // Simulate 0.25s (apex is around ~0.217s: 260 / 1200)
    for (let i = 0; i < 15; i++) {
      coin.update(DT);
      if (coin.y < minPosY) {
        minPosY = coin.y;
      }
      if (coin.vy >= 0) {
        reachedApex = true;
      }
    }

    expect(reachedApex).toBe(true);
    // Apex should be around startY - 28px
    expect(minPosY).toBeLessThan(startY - 25);
    expect(minPosY).toBeGreaterThan(startY - 35);
  });

  test('cycles through the 4 coin spin frames during lifetime', () => {
    const coin = createCoinPop({ x: 50, y: 100 });

    const seenFrames = new Set();
    for (let i = 0; i < 30; i++) {
      seenFrames.add(coin.currentFrame);
      coin.update(1 / 60);
    }

    // All 4 frames must be visited
    expect(seenFrames.size).toBe(4);
    expect(seenFrames.has(SPRITES.items.coin.spin1)).toBe(true);
    expect(seenFrames.has(SPRITES.items.coin.spin2)).toBe(true);
    expect(seenFrames.has(SPRITES.items.coin.spin3)).toBe(true);
    expect(seenFrames.has(SPRITES.items.coin.spin4)).toBe(true);
  });

  test('expires when falling back to startY and reports +200 score', () => {
    const startY = 100;
    const coin = createCoinPop({ x: 50, y: startY });

    let expiryReport = null;
    for (let i = 0; i < 60; i++) {
      const result = coin.update(DT);
      if (result && result.expired) {
        expiryReport = result;
        break;
      }
    }

    expect(expiryReport).not.toBeNull();
    expect(expiryReport.expired).toBe(true);
    expect(expiryReport.score).toBe(200);
    expect(coin.alive).toBe(false);
    expect(coin.expired).toBe(true);
    expect(coin.y).toBeCloseTo(startY, 1);
  });

  test('onCollect awards 200 score and clears alive', () => {
    const coin = createCoinPop({ x: 50, y: 100 });
    const res = coin.onCollect();
    expect(res).toEqual({ type: 'coin', score: 200 });
    expect(coin.alive).toBe(false);
  });

  test('draws using drawPixels with current coin frame and camera offset', () => {
    const coin = createCoinPop({ x: 80, y: 120 });
    const { ctx, calls } = createMockContext();

    coin.draw(ctx, { x: 30, y: 20 });

    expect(calls.length).toBeGreaterThan(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    for (const c of calls) {
      expect(c.x).toBeGreaterThanOrEqual(80 - 30);
      expect(c.y).toBeGreaterThanOrEqual(120 - 20);
    }
  });
});
