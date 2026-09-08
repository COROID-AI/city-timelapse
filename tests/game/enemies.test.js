/**
 * Tests for the Goomba enemies module.
 *
 * Verifies, using real physics + level modules together with enemies:
 *   - horizontal patrol at a fixed speed,
 *   - turning around at walls (via tilemap solidity),
 *   - turning around at ledge edges (no ground ahead),
 *   - stomp detection squashes and removes the Goomba and reports a stomp
 *     event,
 *   - side contact reports a damage event.
 */

import { createEnemies, GOOMBA_SPEED, SQUASH_TIME } from '../../game/js/enemies.js';
import { createPhysics } from '../../game/js/physics.js';
import { createLevel } from '../../game/js/level.js';
import { TILE_SIZE } from '../../game/js/constants.js';

/** Build a fake canvas context that records fillRect calls. */
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
 * A simple flat level: solid ground on the bottom row with open air above.
 * `cols` is the level width; the ground spans the full width.
 */
function flatLevel(cols = 40) {
  const rows = [];
  for (let r = 0; r < 3; r += 1) {
    rows.push('.'.repeat(cols));
  }
  rows.push('#'.repeat(cols));
  return createLevel(rows);
}

/** A player body standing on the ground at the given x. */
function makePlayer(x = 64, y = 0) {
  return { x, y, w: 16, h: 16, vx: 0, vy: 0, onGround: true };
}

describe('Goomba patrol', () => {
  test('walks horizontally at a fixed speed', () => {
    const level = flatLevel();
    const physics = createPhysics();
    // Ground top row is row 3 => ground surface y = 3*16 = 48.
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });

    const before = enemies.getGoombas()[0].x;
    enemies.update(1);
    const after = enemies.getGoombas()[0].x;

    expect(after - before).toBeCloseTo(GOOMBA_SPEED);
    // Still walking and not squashed.
    expect(enemies.getGoombas()[0].state).toBe('walking');
  });

  test('walks left when spawned with dir=-1', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12, dir: -1 }],
    });

    const before = enemies.getGoombas()[0].x;
    enemies.update(1);
    const after = enemies.getGoombas()[0].x;
    expect(before - after).toBeCloseTo(GOOMBA_SPEED);
  });
});

describe('wall turning', () => {
  test('turns around when a solid wall is ahead', () => {
    // Ground row 3; a solid wall column sits just in front of the Goomba.
    const cols = 40;
    const rows = [];
    for (let r = 0; r < 4; r += 1) {
      rows.push('.'.repeat(cols));
    }
    rows.push('#'.repeat(cols));
    // Put a solid brick wall just ahead of the spawn (col 6, body rows).
    const wallCol = 6;
    const wallRow = 3;
    const grid = rows.map((r) => r.split(''));
    grid[wallRow][wallCol] = 'B';
    const level = createLevel(grid.map((r) => r.join('')));

    const physics = createPhysics();
    // Spawn walking right at col 5, just left of the wall at col 6.
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 5 * TILE_SIZE, y: 3 * TILE_SIZE - 12, dir: 1 }],
    });

    enemies.update(1);
    expect(enemies.getGoombas()[0].dir).toBe(-1);
  });
});

describe('ledge edge turning', () => {
  test('turns around when there is no ground ahead (edge)', () => {
    const cols = 40;
    const rows = [];
    for (let r = 0; r < 3; r += 1) {
      rows.push('.'.repeat(cols));
    }
    // Ground only from col 0..9; col 10 onward is a pit (no ground).
    const groundRow = '.'.repeat(10) + '.'.repeat(cols - 10);
    rows.push(groundRow);
    const level = createLevel(rows);

    const physics = createPhysics();
    // Spawn walking right near the edge at col 9 (edge is col 10).
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 9 * TILE_SIZE, y: 3 * TILE_SIZE - 12, dir: 1 }],
    });

    enemies.update(1);
    expect(enemies.getGoombas()[0].dir).toBe(-1);
  });
});

describe('stomp / squash', () => {
  test('stomping from above squashes, scores a stomp and removes the Goomba', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });

    // Player falls onto the Goomba's top with downward velocity. The player's
    // feet (bottom) penetrate the Goomba's top but stay above its mid-height.
    const player = makePlayer(80, 48 - 12 - 16 + 4);
    player.vy = 2;

    enemies.update(1, player);
    expect(enemies.getGoombas()[0].state).toBe('squashed');

    const contacts = enemies.getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].type).toBe('stomp');

    // Player got a bounce.
    expect(player.vy).toBeLessThan(0);

    // Run out the squash timer so the Goomba is removed.
    for (let i = 0; i < SQUASH_TIME + 2; i += 1) {
      enemies.update(1);
    }
    expect(enemies.getGoombas()).toHaveLength(0);
  });

  test('a squashed Goomba no longer reports damage or stomp contacts', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });

    const player = makePlayer(80, 48 - 12 - 16 + 4);
    player.vy = 2;
    enemies.update(1, player);
    expect(enemies.getContacts()).toHaveLength(1);

    // Continue overlapping the squashed Goomba: no new contacts.
    enemies.update(1, player);
    expect(enemies.getContacts()).toHaveLength(0);
  });
});

describe('side collision damage', () => {
  test('side contact reports a damage event and does not squash', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });

    // Player overlaps the Goomba at the same height (side contact), moving
    // sideways (vy <= 0 so it is not a stomp).
    const player = makePlayer(80, 48 - 12);
    player.vx = 1;
    player.vy = 0;

    enemies.update(1, player);
    expect(enemies.getGoombas()[0].state).toBe('walking');

    const contacts = enemies.getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].type).toBe('damage');
  });
});

describe('enemy manager API', () => {
  test('exposes update, draw, getContacts, getGoombas, addGoomba, dispose', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({ level, physics });
    expect(typeof enemies.update).toBe('function');
    expect(typeof enemies.draw).toBe('function');
    expect(typeof enemies.getContacts).toBe('function');
    expect(typeof enemies.getGoombas).toBe('function');
    expect(typeof enemies.addGoomba).toBe('function');
    expect(typeof enemies.dispose).toBe('function');
  });

  test('draw renders walk frames via fillRect without throwing', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });
    const ctx = makeFakeContext();
    enemies.draw(ctx);
    expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
  });

  test('draw renders the squash frame for a squashed Goomba', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });
    const player = makePlayer(80, 48 - 12 - 16 + 4);
    player.vy = 2;
    enemies.update(1, player);

    const ctx = makeFakeContext();
    enemies.draw(ctx);
    expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
  });

  test('addGoomba appends a new Goomba to the live list', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({ level, physics });
    const goomba = enemies.addGoomba({ x: 20, y: 48 - 12 });
    expect(enemies.getGoombas()).toHaveLength(1);
    expect(goomba.state).toBe('walking');
  });

  test('dispose clears Goombas and contacts', () => {
    const level = flatLevel();
    const physics = createPhysics();
    const enemies = createEnemies({
      level,
      physics,
      goombas: [{ x: 80, y: 48 - 12 }],
    });
    const player = makePlayer(80, 48 - 12);
    player.vy = 0;
    enemies.update(1, player);
    expect(enemies.getContacts()).toHaveLength(1);

    enemies.dispose();
    expect(enemies.getGoombas()).toHaveLength(0);
    expect(enemies.getContacts()).toHaveLength(0);
  });
});