/**
 * Tests for the item system: coins, mushrooms and '?' item blocks.
 *
 * Verifies (integrated with physics and level):
 *  - bumping a block from below releases a coin and empties it,
 *  - bumping a block releases a mushroom and empties it,
 *  - a drained block cannot be bumped again (returns null),
 *  - coins are collected on contact (overlap) and counted,
 *  - the coin pop animation rises, bounces and rests atop the block,
 *  - mushrooms emerge and then move horizontally under physics (gravity,
 *    landing on ground, and bouncing off walls via the tilemap),
 *  - blocks/coins/mushrooms draw via fillRect sprite maps.
 */

import { createLevel } from '../../game/js/level.js';
import { createPhysics } from '../../game/js/physics.js';
import { createItems } from '../../game/js/items.js';
import { TILE_SIZE } from '../../game/js/constants.js';

/** A small open level with a '?' block at (2,1) over ground at row 3. */
const OPEN_ROWS = [
  '..........', // row 0 air
  '..?.......', // row 1 ? block at col 2
  '..........', // row 2 air
  '##########', // row 3 ground
];

/** Same as OPEN_ROWS but with a tall wall at col 5 to bounce mushrooms. */
const WALL_ROWS = [
  '..........',
  '..?..#....', // ? at col 2, wall top at col 5
  '.....#....', // wall body at col 5
  '##########',
];

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

/** Full-open setup: level + items bound to it. */
function makeOpen(content) {
  const level = createLevel(OPEN_ROWS);
  const items = createItems({
    level,
    blocks: [{ col: 2, row: 1, content }],
  });
  return { level, items };
}

describe('bumping a ? block releases its content', () => {
  test('bump releases a coin and empties the block', () => {
    const { level, items } = makeOpen('coin');
    const block = items.blocks[0];
    expect(block.used).toBe(false);
    // Level tile is still a question block before the bump.
    expect(level.getTile(2, 1)).toBe('?');

    const released = items.bump(block);
    expect(released).toBeTruthy();
    expect(released.type).toBe('coin');
    expect(block.used).toBe(true);
    expect(items.coins).toHaveLength(1);
    // Block is drained: tile becomes USED and no longer solid.
    expect(level.getTile(2, 1)).toBe('U');
  });

  test('bump releases a mushroom and empties the block', () => {
    const { level, items } = makeOpen('mushroom');
    const block = items.blocks[0];

    const released = items.bump(block);
    expect(released).toBeTruthy();
    expect(released.type).toBe('mushroom');
    expect(block.used).toBe(true);
    expect(items.mushrooms).toHaveLength(1);
    expect(level.getTile(2, 1)).toBe('U');
  });

  test('bumpAt finds and bumps a block by tile coordinate', () => {
    const { items } = makeOpen('coin');
    const released = items.bumpAt(2, 1);
    expect(released).toBeTruthy();
    expect(released.type).toBe('coin');
  });

  test('a drained block cannot be bumped again (returns null)', () => {
    const { items } = makeOpen('coin');
    const block = items.blocks[0];
    expect(items.bump(block)).toBeTruthy();
    // Second bump: block is empty, nothing released.
    expect(items.bump(block)).toBeNull();
    expect(items.bumpAt(2, 1)).toBeNull();
    expect(items.coins).toHaveLength(1); // only the first coin exists
  });

  test('the block pop animation runs and returns to rest', () => {
    const { items } = makeOpen('coin');
    const block = items.blocks[0];
    items.bump(block);
    expect(block.bumpTimer).toBeGreaterThan(0);
    // After enough frames the bump timer drains to zero.
    for (let i = 0; i < 10; i += 1) items.update(1);
    expect(block.bumpTimer).toBe(0);
  });
});

describe('coin pop and collection', () => {
  test('the coin pops upward then bounces and rests atop the block', () => {
    const { items } = makeOpen('coin');
    items.bump(items.blocks[0]);
    const coin = items.coins[0];
    const startY = coin.y;
    const baseY = coin.baseY;

    // Rising phase: the coin moves up from its start position.
    items.update(1);
    expect(coin.y).toBeLessThan(startY);
    expect(coin.state).toBe('pop');

    // Run long enough for the pop-and-bounce to settle on the block top.
    for (let i = 0; i < 40; i += 1) items.update(1);
    expect(coin.state).toBe('rest');
    expect(coin.y).toBe(baseY);
  });

  test('coins spin through sprite frames over time', () => {
    const { items } = makeOpen('coin');
    items.bump(items.blocks[0]);
    const coin = items.coins[0];
    const startFrame = coin.frame;
    // Advance several frames; the spin animation should advance the frame.
    for (let i = 0; i < 20; i += 1) items.update(1);
    expect(coin.frame).not.toBe(startFrame);
  });

  test('a coin is collected on contact and counted', () => {
    const { level, items } = makeOpen('coin');
    items.bump(items.blocks[0]);
    const coin = items.coins[0];

    let eventCount = 0;
    let eventCountValue = 0;
    items.on('coinCollected', (e) => {
      eventCount += 1;
      eventCountValue = e.count;
    });

    // Player body overlapping the coin's current rect.
    const player = {
      x: coin.x - 4,
      y: coin.y - 4,
      w: TILE_SIZE,
      h: TILE_SIZE,
    };
    const collected = items.collect(player);

    expect(collected).toBe(1);
    expect(items.coinCount()).toBe(1);
    expect(coin.collected).toBe(true);
    expect(eventCount).toBe(1);
    expect(eventCountValue).toBe(1);
    // Collected coin is pruned from the live pool.
    expect(items.coins).toHaveLength(0);
    expect(level).toBeTruthy();
  });

  test('no coins are collected when the player does not overlap', () => {
    const { items } = makeOpen('coin');
    items.bump(items.blocks[0]);
    const player = { x: 200, y: 200, w: 16, h: 16 };
    expect(items.collect(player)).toBe(0);
    expect(items.coinCount()).toBe(0);
  });
});

describe('mushroom emergence and physics movement', () => {
  test('a mushroom emerges from the block and moves horizontally', () => {
    const { items } = makeOpen('mushroom');
    items.bump(items.blocks[0]);
    const mushroom = items.mushrooms[0];
    const startX = mushroom.x;
    const startY = mushroom.y;

    // Emerging: rises out of the block.
    expect(mushroom.emerging).toBe(true);
    items.update(1);
    expect(mushroom.y).toBeLessThan(startY);

    // Run enough frames to fully emerge and start walking.
    for (let i = 0; i < 60; i += 1) items.update(1);
    expect(mushroom.emerging).toBe(false);
    // It walked horizontally under physics.
    expect(mushroom.x).toBeGreaterThan(startX);
    // Gravity pulled it down to rest on the ground (row 3 top = 48).
    expect(mushroom.y + mushroom.h).toBeCloseTo(48);
    expect(mushroom.onGround).toBe(true);
  });

  test('a mushroom bounces off a wall via tilemap collision', () => {
    const level = createLevel(WALL_ROWS);
    const items = createItems({
      level,
      blocks: [{ col: 2, row: 1, content: 'mushroom' }],
    });
    items.bump(items.blocks[0]);
    const mushroom = items.mushrooms[0];

    // Run until the mushroom walks into the wall at col 5.
    for (let i = 0; i < 200; i += 1) items.update(1);
    // The mushroom hit the wall and reversed direction.
    expect(mushroom.vx).toBeLessThan(0);
  });

  test('a mushroom is collected on contact', () => {
    const { items } = makeOpen('mushroom');
    items.bump(items.blocks[0]);
    const mushroom = items.mushrooms[0];

    let eventCount = 0;
    items.on('mushroomCollected', () => {
      eventCount += 1;
    });

    const player = { x: mushroom.x, y: mushroom.y, w: 16, h: 16 };
    const collected = items.collect(player);
    expect(collected).toBe(0); // no coins collected
    expect(mushroom.collected).toBe(true);
    expect(eventCount).toBe(1);
    expect(items.mushrooms).toHaveLength(0);
  });
});

describe('drawing via fillRect sprite maps', () => {
  test('draw renders blocks, coins and mushrooms without throwing', () => {
    const { items } = makeOpen('coin');
    const ctx = makeFakeContext();

    // Draw an unused block.
    items.draw(ctx);
    const rectsBefore = ctx.fillRectCalls.length;
    expect(rectsBefore).toBeGreaterThan(0);

    // Bump and draw again (coin + used block).
    items.bump(items.blocks[0]);
    items.draw(ctx);
    expect(ctx.fillRectCalls.length).toBeGreaterThan(rectsBefore);
  });

  test('draw renders a mushroom sprite', () => {
    const { items } = makeOpen('mushroom');
    items.bump(items.blocks[0]);
    const ctx = makeFakeContext();
    items.draw(ctx);
    expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
  });
});

describe('items lifecycle and events', () => {
  test('block event fires with the released content on bump', () => {
    const { items } = makeOpen('coin');
    let payload = null;
    items.on('block', (e) => {
      payload = e;
    });
    items.bump(items.blocks[0]);
    expect(payload).toBeTruthy();
    expect(payload.content).toBe('coin');
    expect(payload.item.type).toBe('coin');
  });

  test('dispose clears all pools and listeners', () => {
    const { items } = makeOpen('coin');
    items.bump(items.blocks[0]);
    let fired = 0;
    items.on('coinCollected', () => {
      fired += 1;
    });
    items.dispose();
    expect(items.blocks).toHaveLength(0);
    expect(items.coins).toHaveLength(0);
    expect(items.mushrooms).toHaveLength(0);
    // Listener cleared: collecting nothing no-ops.
    items.collect({ x: 0, y: 0, w: 16, h: 16 });
    expect(fired).toBe(0);
  });

  test('createItems default export and physics reuse', () => {
    const physics = createPhysics();
    const level = createLevel(OPEN_ROWS);
    const items = createItems({
      level,
      physics,
      blocks: [{ col: 2, row: 1, content: 'mushroom' }],
    });
    expect(typeof items.update).toBe('function');
    expect(typeof items.draw).toBe('function');
    expect(typeof items.bump).toBe('function');
    expect(typeof items.collect).toBe('function');
    expect(typeof items.dispose).toBe('function');
  });
});