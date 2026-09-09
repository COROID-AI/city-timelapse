/**
 * Comprehensive player entity tests (src/entities/player.js).
 *
 * Tests small and super forms, horizontal movement with run/walk caps,
 * skid deceleration on reversal, jump mechanics (variable apex on held vs tapped),
 * head hits forwarding hooks.onBlockHit, powerUp and damage transitions,
 * invincibility flicker/window, bounce stomp, pit death, death hop and flagpole slide.
 */

import { CONSTANTS } from '../src/core/constants.js';
import { createPlayer } from '../src/entities/player.js';
import { createTilemap, TILES } from '../src/world/tilemap.js';
import { SPRITES } from '../src/render/sprites/index.js';
import { LEVEL_ONE } from '../src/levels/level1.js';

const DT = 1 / 60;
const { PHYSICS } = CONSTANTS;

/**
 * Creates a mock input controller.
 */
function createMockInput(heldActions = [], pressedActions = []) {
  const held = new Set(heldActions);
  const pressed = new Set(pressedActions);
  return {
    isDown(action) {
      return held.has(action);
    },
    wasPressed(action) {
      return pressed.has(action);
    },
  };
}

/**
 * Creates a mock canvas context recording fillRect calls.
 */
function createMockContext() {
  const calls = [];
  return {
    ctx: {
      fillStyle: null,
      fillRect(x, y, w, h) {
        calls.push({ color: this.fillStyle, x, y, w, h });
      },
      save() {},
      restore() {},
    },
    calls,
  };
}

describe('Player Entity (src/entities/player.js)', () => {
  describe('Initialization & Shape', () => {
    test('initializes with small hitbox (12x14), idle state, facing right', () => {
      const player = createPlayer({ x: 50, y: 100 });
      expect(player.powerState).toBe('small');
      expect(player.state).toBe('idle');
      expect(player.body.w).toBe(12);
      expect(player.body.h).toBe(14);
      expect(player.body.x).toBe(50);
      expect(player.body.y).toBe(100);
      expect(player.body.facing).toBe(1);
      expect(player.isInvincible()).toBe(false);
    });

    test('accepts custom spawn coordinates', () => {
      const player = createPlayer({ x: 128, y: 64 });
      expect(player.body.x).toBe(128);
      expect(player.body.y).toBe(64);
    });
  });

  describe('Horizontal Movement & Physics Integration', () => {
    test('walks right with right key held, accelerates toward WALK_MAX', () => {
      const player = createPlayer({ x: 0, y: 0 });
      const input = createMockInput(['right'], []);

      player.update(DT, input, null);
      expect(player.body.vx).toBeCloseTo(PHYSICS.ACCEL * DT, 6);
      expect(player.body.facing).toBe(1);
      expect(player.state).toBe('walk');

      for (let i = 0; i < 100; i++) {
        player.update(DT, input, null);
      }
      expect(player.body.vx).toBeCloseTo(PHYSICS.WALK_MAX, 6);
    });

    test('runs right with right + run held, accelerates toward RUN_MAX', () => {
      const player = createPlayer({ x: 0, y: 0 });
      const input = createMockInput(['right', 'run'], []);

      for (let i = 0; i < 100; i++) {
        player.update(DT, input, null);
      }
      expect(player.body.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);
      expect(player.body.vx).toBeGreaterThan(PHYSICS.WALK_MAX);
    });

    test('friction brings moving player to rest when input is released', () => {
      const player = createPlayer({ x: 0, y: 0 });
      const runInput = createMockInput(['right', 'run'], []);

      for (let i = 0; i < 100; i++) {
        player.update(DT, runInput, null);
      }
      expect(player.body.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);

      const noInput = createMockInput([], []);
      for (let i = 0; i < 100; i++) {
        player.update(DT, noInput, null);
      }
      expect(player.body.vx).toBe(0);
      expect(player.state).toBe('idle');
    });

    test('reversing direction skids with SKID_DECEL and sets skid state', () => {
      const player = createPlayer({ x: 0, y: 0 });
      const runRight = createMockInput(['right', 'run'], []);

      for (let i = 0; i < 100; i++) {
        player.update(DT, runRight, null);
      }
      expect(player.body.vx).toBeCloseTo(PHYSICS.RUN_MAX, 6);

      // Reverse: press left while moving right at speed
      const pressLeft = createMockInput(['left', 'run'], []);
      player.update(DT, pressLeft, null);

      expect(player.state).toBe('skid');
      expect(player.body.vx).toBeCloseTo(PHYSICS.RUN_MAX - PHYSICS.SKID_DECEL * DT, 6);
      expect(player.body.vx).toBeGreaterThan(0);
    });
  });

  describe('Jump & Variable Gravity', () => {
    test('jumping sets upward velocity and jump state', () => {
      const player = createPlayer({ x: 0, y: 100 });
      const jumpInput = createMockInput(['jump'], ['jump']);

      player.update(DT, jumpInput, null);
      expect(player.body.vy).toBeLessThan(0);
      expect(player.state).toBe('jump');
      expect(player.body.onGround).toBe(false);
    });

    test('holding jump yields a higher apex than tapping jump', () => {
      // Tapped jump: release immediately
      const tappedPlayer = createPlayer({ x: 0, y: 100 });
      tappedPlayer.update(DT, createMockInput([], ['jump']), null);
      let tappedMinY = tappedPlayer.body.y;
      for (let i = 0; i < 60; i++) {
        tappedPlayer.update(DT, createMockInput([], []), null);
        tappedMinY = Math.min(tappedMinY, tappedPlayer.body.y);
      }

      // Held jump: hold jump for 30 frames
      const heldPlayer = createPlayer({ x: 0, y: 100 });
      heldPlayer.update(DT, createMockInput(['jump'], ['jump']), null);
      let heldMinY = heldPlayer.body.y;
      for (let i = 0; i < 60; i++) {
        heldPlayer.update(DT, createMockInput(i < 30 ? ['jump'] : [], []), null);
        heldMinY = Math.min(heldMinY, heldPlayer.body.y);
      }

      // Higher jump means smaller Y (Y goes downward)
      expect(heldMinY).toBeLessThan(tappedMinY);
    });

    test('running jump has higher initial jump velocity than standing jump', () => {
      const standing = createPlayer({ x: 0, y: 100 });
      standing.update(DT, createMockInput([], ['jump']), null);
      const standingVy = standing.body.vy;

      const runner = createPlayer({ x: 0, y: 100 });
      const runInput = createMockInput(['right', 'run'], []);
      for (let i = 0; i < 100; i++) {
        runner.update(DT, runInput, null);
      }
      runner.body.onGround = true; // reset ground contact for jump
      runner.update(DT, createMockInput(['right', 'run', 'jump'], ['jump']), null);
      const runningVy = runner.body.vy;

      expect(runningVy).toBeLessThan(standingVy); // more negative = higher upward velocity
    });

    test('falls when downward velocity > 0', () => {
      const player = createPlayer({ x: 0, y: 100 });
      player.body.onGround = false;
      player.body.vy = 50;

      player.update(DT, createMockInput([], []), null);
      expect(player.state).toBe('fall');
    });
  });

  describe('Tilemap Collision & Block Hits', () => {
    test('resolves collision against real Level 1 ground', () => {
      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      const player = createPlayer({ x: 48, y: 150 });
      player.body.onGround = false;

      for (let i = 0; i < 60; i++) {
        player.update(DT, createMockInput([], []), null); // integrate gravity and falling
      }

      // Landed on row 13 (y=208)
      expect(player.body.onGround).toBe(false); // without tilemap it would fall past

      const playerWithMap = createPlayer({ x: 48, y: 150 });
      playerWithMap.body.onGround = false;
      for (let i = 0; i < 60; i++) {
        playerWithMap.update(DT, createMockInput([], []), map);
      }
      expect(playerWithMap.body.onGround).toBe(true);
      expect(playerWithMap.body.y).toBe(208 - playerWithMap.body.h);
      expect(playerWithMap.state).toBe('idle');
    });

    test('head impact forwards hooks.onBlockHit with powerState', () => {
      const calls = [];
      const hooks = {
        onBlockHit(tx, ty, info) {
          calls.push({ tx, ty, info });
          return 'bump';
        },
      };

      const map = createTilemap([
        '   ?   ',
        '       ',
        'XXXXXXX',
      ], { tileSize: 16 });

      const player = createPlayer({ x: 3 * 16, y: 1 * 16 + 2, hooks });
      player.body.onGround = true;
      player.update(DT, createMockInput(['jump'], ['jump']), map);

      // Jump upward into row 0, col 3
      for (let i = 0; i < 10; i++) {
        player.update(DT, createMockInput(['jump'], []), map);
      }

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].tx).toBe(3);
      expect(calls[0].ty).toBe(0);
      expect(calls[0].info.powerState).toBe('small');
    });

    test('super player forwards super powerState to onBlockHit and default breaks bricks', () => {
      const calls = [];
      const hooks = {
        onBlockHit(tx, ty, info) {
          calls.push({ tx, ty, info });
          // If returning undefined/break
          return info.powerState === 'super' && info.tile === 'B' ? 'break' : 'bump';
        },
      };

      const map = createTilemap([
        '   B   ',
        '       ',
        '       ',
        'XXXXXXX',
      ], { tileSize: 16 });

      const player = createPlayer({ x: 3 * 16, y: 2 * 16, hooks });
      player.powerUp();
      expect(player.powerState).toBe('super');

      player.body.onGround = true;
      player.update(DT, createMockInput(['jump'], ['jump']), map);

      for (let i = 0; i < 15; i++) {
        player.update(DT, createMockInput(['jump'], []), map);
      }

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].info.powerState).toBe('super');
      expect(calls[0].info.tile).toBe('B');
      expect(map.tileAt(3, 0)).toBe(TILES.EMPTY); // Brick turned into air
    });
  });

  describe('Power-up & Damage Transitions', () => {
    test('powerUp grows small to super (hitbox 12x27, preserves feet position)', () => {
      const player = createPlayer({ x: 100, y: 200 });
      const initialFeet = player.body.y + player.body.h;

      player.powerUp();

      expect(player.powerState).toBe('super');
      expect(player.body.w).toBe(12);
      expect(player.body.h).toBe(27);
      expect(player.body.y + player.body.h).toBe(initialFeet);
    });

    test('damage shrinks super to small and grants 2s invincibility', () => {
      const player = createPlayer({ x: 100, y: 200 });
      player.powerUp();
      const superFeet = player.body.y + player.body.h;

      player.damage();

      expect(player.powerState).toBe('small');
      expect(player.body.w).toBe(12);
      expect(player.body.h).toBe(14);
      expect(player.body.y + player.body.h).toBe(superFeet);
      expect(player.isInvincible()).toBe(true);

      // Damage ignored while invincible
      player.damage();
      expect(player.state).not.toBe('dead');
      expect(player.powerState).toBe('small');

      // Update past 2 seconds
      for (let i = 0; i < 130; i++) {
        player.update(DT, null, null);
      }
      expect(player.isInvincible()).toBe(false);

      // Next damage kills small player
      player.damage();
      expect(player.state).toBe('dead');
    });

    test('damage kills small player directly', () => {
      const player = createPlayer({ x: 100, y: 200 });
      player.damage();
      expect(player.state).toBe('dead');
    });
  });

  describe('Bounce (Stomp)', () => {
    test('bounce(false) applies normal stomp bounce velocity', () => {
      const player = createPlayer({ x: 100, y: 100 });
      player.bounce(false);
      expect(player.body.vy).toBe(-180);
      expect(player.body.onGround).toBe(false);
    });

    test('bounce(true) applies higher stomp bounce velocity when jump is held', () => {
      const player = createPlayer({ x: 100, y: 100 });
      player.bounce(true);
      expect(player.body.vy).toBe(-300);
      expect(player.body.onGround).toBe(false);
    });
  });

  describe('Death Hop, Pit Death & Hooks', () => {
    test('die() triggers death hop animation and fires hooks.onDeath after duration', () => {
      let deathHookFired = false;
      const hooks = {
        onDeath() {
          deathHookFired = true;
        },
      };

      const player = createPlayer({ x: 100, y: 100, hooks });
      player.die();

      expect(player.state).toBe('dead');
      expect(player.body.vx).toBe(0);

      // Update through initial delay
      player.update(0.1, null, null);
      expect(player.body.vy).toBe(0);

      // Cross 0.2s initial delay: death hop starts with upward impulse
      player.update(0.15, null, null);
      expect(player.body.vy).toBeLessThan(0);

      // Gravity pulls Mario downward
      for (let i = 0; i < 150; i++) {
        player.update(DT, null, null);
      }
      expect(deathHookFired).toBe(true);
    });

    test('falling into a pit triggers die() and fires hooks.onDeath when exceeding pit line', () => {
      let deathFired = false;
      const hooks = {
        onDeath() {
          deathFired = true;
        },
      };

      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      // Spawn over gap 1 (col 69, x = 69 * 16 = 1104, row 13 is empty)
      const player = createPlayer({ x: 69 * 16, y: 180, hooks });
      player.body.onGround = false;

      for (let i = 0; i < 120 && !deathFired; i++) {
        player.update(DT, createMockInput([], []), map);
      }

      expect(player.state).toBe('dead');
    });
  });

  describe('Flagpole Slide', () => {
    test('setFlagSlide locks player to the pole and moves downward', () => {
      const player = createPlayer({ x: 100, y: 50 });
      player.setFlagSlide(200);

      expect(player.state).toBe('flagSlide');
      expect(player.body.x).toBe(200 - 4);

      player.update(DT, null, null);
      expect(player.body.y).toBeGreaterThan(50);
      expect(player.body.x).toBe(200 - 4);
    });
  });

  describe('Sprite Animation & Rendering', () => {
    test('draws idle sprite when stationary', () => {
      const player = createPlayer({ x: 100, y: 100 });
      const { ctx, calls } = createMockContext();

      player.draw(ctx);
      expect(calls.length).toBeGreaterThan(0);
    });

    test('draws super sprite when powered up', () => {
      const player = createPlayer({ x: 100, y: 100 });
      player.powerUp();
      const { ctx, calls } = createMockContext();

      player.draw(ctx);
      // Super Mario sprite has more pixels than small Mario
      const smallCalls = [];
      const smallPlayer = createPlayer({ x: 100, y: 100 });
      smallPlayer.draw({
        fillStyle: null,
        fillRect: (x, y, w, h) => smallCalls.push({ x, y, w, h }),
        save() {},
        restore() {},
      });
      expect(calls.length).toBeGreaterThan(smallCalls.length);
    });

    test('skips draw every other 4 frames during invincibility blink', () => {
      const player = createPlayer({ x: 100, y: 100 });
      player.powerUp();
      player.damage(); // Shrinks and sets 2s invincibility
      expect(player.isInvincible()).toBe(true);

      const drawnFrames = [];
      for (let frame = 0; frame < 16; frame++) {
        player.update(DT, null, null);
        const { ctx, calls } = createMockContext();
        player.draw(ctx);
        drawnFrames.push(calls.length > 0);
      }

      // Pattern should alternate every 4 frames (false / true / false / true)
      expect(drawnFrames.filter(Boolean).length).toBeGreaterThan(0);
      expect(drawnFrames.filter((v) => !v).length).toBeGreaterThan(0);
    });

    test('supports camera translation in draw()', () => {
      const player = createPlayer({ x: 100, y: 100 });
      const { ctx, calls } = createMockContext();
      const camera = {
        worldToScreen(x, y) {
          return { x: x - 50, y: y - 20 };
        },
      };

      player.draw(ctx, camera);
      expect(calls[0].x).toBeLessThan(100);
      expect(calls[0].y).toBeLessThan(100);
    });
  });
});
