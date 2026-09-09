/**
 * Tile collision resolver tests (src/collision/tileCollision.js).
 *
 * Proves the full integrated chain the player-entity composes:
 *   createBody -> physics velocities -> moveAndCollide(body, tilemap, dt,
 *   hooks) against a real createTilemap(...) instance.
 *
 * Coverage:
 *  - Floor landing on real Level 1 ground (onGround, landed, snap).
 *  - Wall stops in both directions against real pipes.
 *  - Ceiling stop with an exactly-once head-bump event at the correct tile.
 *  - Single nearest overlapped tile is chosen when the head straddles two
 *    blocks.
 *  - bump / break / ignore actions applied to real tilemap state (brick
 *    break -> air + bump animation, ? -> U, ignore leaves the tile alone).
 *  - No tunneling while dropping at TERMINAL_VELOCITY onto a 1-tile
 *    platform, sub-stepped at max 8px.
 */

import { CONSTANTS } from '../src/core/constants.js';
import { createBody } from '../src/physics/body.js';
import { createTilemap, TILES } from '../src/world/tilemap.js';
import { LEVEL_ONE } from '../src/levels/level1.js';
import { moveAndCollide, MAX_SUBSTEP_PX } from '../src/collision/tileCollision.js';

const { PHYSICS } = CONSTANTS;
const DT = 1 / 60;

/** Records every onBlockHit call; returns a configurable action. */
function recordingHooks(action = undefined) {
  const calls = [];
  const hooks = {
    calls,
    onBlockHit(tx, ty, info) {
      calls.push({ tx, ty, info });
      return action;
    },
  };
  return hooks;
}

describe('tile collision resolver (src/collision/tileCollision.js)', () => {
  test('sub-step cap is 8px (half a tile, proof against tunneling)', () => {
    // 8px sub-steps cannot cross a 16px tile in one step, so a body at
    // TERMINAL_VELOCITY can never skip a solid tile.
    expect(MAX_SUBSTEP_PX).toBe(8);
  });

  test('dt <= 0 yields empty flags and leaves the body untouched', () => {
    const map = createTilemap(['XXXXXX']);
    const body = createBody({ x: 10, y: 10, w: 12, h: 16 });
    body.vx = 100;
    body.vy = 270;
    const before = JSON.parse(JSON.stringify(body));

    const result = moveAndCollide(body, map, 0, {});

    expect(result).toEqual({ hitWall: false, hitHead: false, landed: false });
    expect(body).toEqual(before);
  });

  test('lands on real Level 1 ground at TERMINAL_VELOCITY', () => {
    const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
    const body = createBody({ x: 48, y: 160, w: 12, h: 16 });
    body.onGround = false;
    body.vy = PHYSICS.TERMINAL_VELOCITY;

    let result = null;
    for (let i = 0; i < 60 && !(result && result.landed); i++) {
      result = moveAndCollide(body, map, DT);
    }

    expect(result.landed).toBe(true);
    expect(result.hitWall).toBe(false);
    expect(result.hitHead).toBe(false);
    // Ground top is row 13 (y = 208); feet snap flush onto it.
    expect(body.y).toBe(208 - body.h);
    expect(body.y + body.h).toBe(208);
    expect(body.vy).toBe(0);
    expect(body.onGround).toBe(true);
  });

  describe('wall stops (real Level 1 pipes)', () => {
    // Pipe 2: cols 38-39, rows 10-12 -> left edge x=608, right edge x=640.
    const bodyY = 176; // rows 11..12, vertically overlapping the pipe body.

    test('moving left stops flush on the pipe right edge', () => {
      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      const body = createBody({ x: 648, y: bodyY, w: 12, h: 16 });
      body.onGround = false;
      body.vx = -120;

      let sawWall = false;
      for (let i = 0; i < 10; i++) {
        const result = moveAndCollide(body, map, DT);
        sawWall = sawWall || result.hitWall;
      }

      expect(sawWall).toBe(true);
      expect(body.x).toBe(40 * 16); // left edge flush right of col 39 ('}')
      expect(body.vx).toBe(0);
    });

    test('moving right stops flush on the pipe left edge', () => {
      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      const body = createBody({ x: 596, y: bodyY, w: 12, h: 16 });
      body.onGround = false;
      body.vx = 120;

      const result = moveAndCollide(body, map, DT);

      expect(result.hitWall).toBe(true);
      expect(result.hitHead).toBe(false);
      expect(result.landed).toBe(false);
      expect(body.x).toBe(38 * 16 - body.w); // flush left of col 38 ('{')
      expect(body.vx).toBe(0);
    });
  });

  describe('head impacts (ceiling + block hits)', () => {
    test('bumps the real ?-block exactly once with correct tile coords', () => {
      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      const body = createBody({ x: 258, y: 161, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300; // rising like a jump
      const hooks = recordingHooks();

      // dt large enough to span multiple sub-steps -> the hit must still
      // fire exactly once (on the first sub-step, then vy is zeroed).
      const result = moveAndCollide(body, map, 0.05, hooks);

      expect(result.hitHead).toBe(true);
      expect(result.landed).toBe(false);
      expect(result.hitWall).toBe(false);
      expect(body.y).toBe(9 * 16 + 16); // flush under row 9
      expect(body.vy).toBe(0);

      // Exactly one event, with the real block's coordinates.
      expect(hooks.calls).toHaveLength(1);
      expect(hooks.calls[0].tx).toBe(16);
      expect(hooks.calls[0].ty).toBe(9);
      expect(hooks.calls[0].info.tile).toBe('?');
      expect(hooks.calls[0].info.type).toBe('coin');

      // Default 'bump': ???-block transitioned to a used block with a bump
      // animation started in the real tilemap.
      expect(map.tileAt(16, 9)).toBe(TILES.USED);
      const anim = map.activeBumpAnimations().find((a) => a.tx === 16 && a.ty === 9);
      expect(anim).toBeTruthy();
      expect(map.getBlockContents(16, 9).depleted).toBe(true);
    });

    test('defaults to bump even when hooks return undefined', () => {
      const map = createTilemap(['  ?   ', '      ', 'XXXXXX']);
      const body = createBody({ x: 34, y: 17, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300;
      const hooks = recordingHooks(undefined);

      const result = moveAndCollide(body, map, 0.01, hooks);

      expect(result.hitHead).toBe(true);
      expect(hooks.calls).toHaveLength(1);
      expect(map.tileAt(2, 0)).toBe(TILES.USED);
    });

    test('bumps by default when no hooks are provided', () => {
      const map = createTilemap(['  ?   ', '      ', 'XXXXXX']);
      const body = createBody({ x: 34, y: 17, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300;

      const result = moveAndCollide(body, map, 0.01, {});

      expect(result.hitHead).toBe(true);
      expect(map.tileAt(2, 0)).toBe(TILES.USED);
      expect(map.activeBumpAnimations()).toHaveLength(1);
    });

    test('picks the single nearest overlapped tile when straddling two', () => {
      const map = createTilemap([
        '       ',
        '  ??   ',
        '       ',
        '       ',
        'XXXXXXX',
      ]);
      // Body spans x 44..56: tile (2,1) overlap = 4px, tile (3,1) = 8px.
      const body = createBody({ x: 44, y: 33, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300;
      const hooks = recordingHooks();

      const result = moveAndCollide(body, map, 0.01, hooks);

      expect(result.hitHead).toBe(true);
      expect(body.y).toBe(1 * 16 + 16); // flush under row 1
      expect(hooks.calls).toHaveLength(1);
      expect(hooks.calls[0].tx).toBe(3);
      expect(hooks.calls[0].ty).toBe(1);
      // Only the chosen tile was bumped; the neighbour is untouched.
      expect(map.tileAt(3, 1)).toBe(TILES.USED);
      expect(map.tileAt(2, 1)).toBe(TILES.QUESTION_COIN);
    });

    test("'break' turns a real Level 1 brick into air with a bump animation", () => {
      const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      // Bricks row at grid[9][20] = 'B' (x 320..336).
      const body = createBody({ x: 322, y: 161, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300;
      const hooks = recordingHooks('break');

      const result = moveAndCollide(body, map, 0.05, hooks);

      expect(result.hitHead).toBe(true);
      expect(hooks.calls).toHaveLength(1);
      expect(hooks.calls[0].tx).toBe(20);
      expect(hooks.calls[0].ty).toBe(9);
      expect(hooks.calls[0].info.type).toBe('brick');
      // Brick -> air, with the bump bounce still playing.
      expect(map.tileAt(20, 9)).toBe(TILES.EMPTY);
      const anim = map.activeBumpAnimations().find((a) => a.tx === 20 && a.ty === 9);
      expect(anim).toBeTruthy();
      expect(map.getBlockContents(20, 9).depleted).toBe(true);
      expect(body.y).toBe(9 * 16 + 16);
      expect(body.vy).toBe(0);
    });

    test("'ignore' leaves the tile completely unchanged", () => {
      const map = createTilemap([
        '  B   ',
        '      ',
        '      ',
        'XXXXXX',
      ]);
      const body = createBody({ x: 34, y: 17, w: 12, h: 16 });
      body.onGround = false;
      body.vy = -300;
      const hooks = recordingHooks('ignore');

      const result = moveAndCollide(body, map, 0.01, hooks);

      expect(result.hitHead).toBe(true);
      expect(hooks.calls).toHaveLength(1);
      expect(hooks.calls[0].tx).toBe(2);
      expect(hooks.calls[0].ty).toBe(0);
      expect(map.tileAt(2, 0)).toBe(TILES.BRICK);
      expect(map.activeBumpAnimations()).toHaveLength(0);
      expect(map.getBlockContents(2, 0).depleted).toBe(false);
      expect(body.y).toBe(16); // ceiling still stops the body
      expect(body.vy).toBe(0);
    });

    test('wall and floor contacts never fire onBlockHit', () => {
      const map = createTilemap(['XXXXXX']);
      const body = createBody({ x: 10, y: 10, w: 12, h: 16 });
      body.onGround = false;
      body.vx = 120;
      body.vy = 270;
      const hooks = recordingHooks();

      let result = moveAndCollide(body, map, 0.05, hooks);

      expect(result.hitWall).toBe(true);
      expect(result.hitHead).toBe(false);
      expect(hooks.calls).toHaveLength(0);
    });
  });

  describe('ground support refresh (walk off a ledge)', () => {
    test('a resting body stays grounded; walking off detaches', () => {
      const map = createTilemap([
        '           ',
        '  XX       ',
        '  XX       ',
      ]);
      // Feet park on top of the platform (row 1 top at y=16).
      const body = createBody({ x: 34, y: 0, w: 12, h: 16 });
      body.onGround = false;
      body.vx = 120;

      // First frame: still over the platform -> lands and stays grounded.
      moveAndCollide(body, map, DT);
      expect(body.onGround).toBe(true);
      expect(body.y + body.h).toBe(16);

      // Run 40 frames -> the body walks off the platform's right edge
      // (x=64) and no longer has support.
      for (let i = 0; i < 40; i++) {
        moveAndCollide(body, map, DT);
      }
      expect(body.x).toBeGreaterThan(64);
      expect(body.onGround).toBe(false);
    });
  });

  describe('no tunneling at TERMINAL_VELOCITY onto a 1-tile platform', () => {
    const platformMap = () => createTilemap([
      '           ',
      '     X     ',
      '           ',
    ]);

    test('frame-by-frame drop lands exactly on top of the platform', () => {
      const map = platformMap();
      const body = createBody({ x: 84, y: -84, w: 12, h: 16 });
      body.onGround = false;
      body.vy = PHYSICS.TERMINAL_VELOCITY;

      let result = null;
      let maxFeet = -Infinity;
      for (let i = 0; i < 60; i++) {
        result = moveAndCollide(body, map, DT);
        maxFeet = Math.max(maxFeet, body.y + body.h);
        if (result.landed) {
          break;
        }
      }

      // Feet never pass the platform top (y=16): no tunneling.
      expect(maxFeet).toBeLessThanOrEqual(16 + 1e-9);
      expect(result.landed).toBe(true);
      expect(body.y).toBe(16 - body.h);
      expect(body.y + body.h).toBe(16);
      expect(body.vy).toBe(0);
      expect(body.onGround).toBe(true);
    });

    test('a single frame spanning 135px still lands sub-stepped', () => {
      const map = platformMap();
      const body = createBody({ x: 84, y: -84, w: 12, h: 16 });
      body.onGround = false;
      body.vy = PHYSICS.TERMINAL_VELOCITY;

      // One call with dt=0.5 -> 135px of travel (> 8 full tiles). Without
      // sub-stepping the sweep alone would be correct here, but this bounds
      // every per-step move at MAX_SUBSTEP_PX, keeping the feet flush.
      const result = moveAndCollide(body, map, 0.5, {});

      expect(result.landed).toBe(true);
      expect(body.y).toBe(16 - body.h);
      expect(body.y + body.h).toBe(16);
      expect(body.vy).toBe(0);
      expect(body.onGround).toBe(true);
    });
  });
});