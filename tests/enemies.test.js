/**
 * Unit and integration tests for Goomba and Koopa enemy entities.
 *
 * Verifies:
 *  - Entity contract conformance {type, x, y, w, h, vx, vy, alive, update, draw, stomp, onBump}
 *  - Goomba creation (14x14 hitbox, 30px/s patrol velocity, facing)
 *  - Koopa creation (14x24 hitbox, 30px/s patrol velocity, facing)
 *  - Kinematic integration with applyGravity + moveAndCollide over real tilemap
 *  - Patrol and wall turnaround on collision
 *  - Walking off ledges (falling under gravity, not floating)
 *  - Goomba stomp() transition to squashed state, removal after 0.5s timer
 *  - Koopa stomp() conversion to 14x14 stationary shell (type: 'shell', vx = 0)
 *  - Shell kick(dir) setting |vx| = 220 in the given direction
 *  - Moving shell wall bounce reversing vx at 220px/s
 *  - Second stomp on a moving shell stopping it (vx = 0)
 *  - Rendering integration with real sprite frames and Canvas drawPixels
 */

import { Entity } from '../src/entities/entity.js';
import { createGoomba, Goomba } from '../src/entities/goomba.js';
import { createKoopa, Koopa } from '../src/entities/koopa.js';
import { createTilemap } from '../src/world/tilemap.js';
import { LEVEL_ONE } from '../src/levels/level1.js';
import { createCamera } from '../src/core/camera.js';

const DT = 1 / 60;

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
      drawImage: jest.fn(),
    },
    calls,
  };
}

describe('Entity contract (src/entities/entity.js)', () => {
  test('base Entity exposes full standard contract', () => {
    const e = new Entity({ type: 'test', x: 10, y: 20, w: 14, h: 14, vx: 30, vy: 0 });
    expect(e.type).toBe('test');
    expect(e.x).toBe(10);
    expect(e.y).toBe(20);
    expect(e.w).toBe(14);
    expect(e.h).toBe(14);
    expect(e.vx).toBe(30);
    expect(e.vy).toBe(0);
    expect(e.alive).toBe(true);
    expect(typeof e.update).toBe('function');
    expect(typeof e.draw).toBe('function');
    expect(typeof e.stomp).toBe('function');
    expect(typeof e.onBump).toBe('function');
  });
});

describe('Goomba mechanics (src/entities/goomba.js)', () => {
  test('createGoomba instantiates 14x14 walker patrolling at 30px/s', () => {
    const gLeft = createGoomba({ x: 100, y: 100, dir: -1 });
    expect(gLeft.type).toBe('goomba');
    expect(gLeft.w).toBe(14);
    expect(gLeft.h).toBe(14);
    expect(gLeft.vx).toBe(-30);
    expect(gLeft.vy).toBe(0);
    expect(gLeft.alive).toBe(true);
    expect(gLeft.squashed).toBe(false);

    const gRight = createGoomba({ x: 100, y: 100, dir: 1 });
    expect(gRight.vx).toBe(30);
  });

  test('patrols and reverses on wall hit with real tilemap', () => {
    // Level with solid wall on the left (col 0) and floor at row 2
    const map = createTilemap([
      'X              X',
      'X              X',
      'XXXXXXXXXXXXXXXX',
    ]);
    // Floor is at row 2 (y=32), left wall at col 0 (x=16)
    // Goomba starts near left wall at x=20, y=18 (sitting on floor: feet at 18+14=32)
    const goomba = createGoomba({ x: 20, y: 18, dir: -1 });
    expect(goomba.vx).toBe(-30);

    // Update several steps until it hits the left wall (x=16)
    for (let i = 0; i < 20; i++) {
      goomba.update(DT, map);
    }

    // Must have reversed to move right at 30px/s
    expect(goomba.vx).toBe(30);
    expect(goomba.facing).toBe(1);
    expect(goomba.x).toBeGreaterThanOrEqual(16);
  });

  test('walks off ledges and falls under gravity', () => {
    // Platform (cols 0-3, x: 0..64) on row 1 (y=16..32), floor on row 4 (y=64..80)
    const ledgeMap = createTilemap([
      '                ',
      'XXXX            ',
      '                ',
      '                ',
      'XXXXXXXXXXXXXXXX',
    ]);
    // Platform top is row 1 (y = 16). Goomba y = 2 (feet at y+14=16).
    // Walking right (dir = 1) from x = 40 towards edge at x = 64
    const goomba = createGoomba({ x: 40, y: 2, dir: 1 });
    expect(goomba.vx).toBe(30);

    // Step across the platform and off the ledge past x=64
    for (let i = 0; i < 60; i++) {
      goomba.update(DT, ledgeMap);
    }

    // Goomba walked completely off the ledge (x >= 64) and vy > 0 (falling)
    expect(goomba.x).toBeGreaterThanOrEqual(64);
    expect(goomba.vy).toBeGreaterThan(0);
    expect(goomba.onGround).toBe(false);

    // Continue updating until it lands on bottom ground (row 4, y=64)
    for (let i = 0; i < 100; i++) {
      goomba.update(DT, ledgeMap);
    }
    expect(goomba.y + goomba.h).toBe(64);
    expect(goomba.onGround).toBe(true);
  });

  test('stomp() squashes goomba and removes it after 0.5s', () => {
    const goomba = createGoomba({ x: 50, y: 50 });
    const res = goomba.stomp();
    expect(res.squashed).toBe(true);
    expect(goomba.squashed).toBe(true);
    expect(goomba.vx).toBe(0);
    expect(goomba.vy).toBe(0);
    expect(goomba.alive).toBe(true);

    // Update for 0.4s: still alive and squashed
    for (let i = 0; i < 24; i++) {
      goomba.update(1 / 60, null);
    }
    expect(goomba.squashed).toBe(true);
    expect(goomba.alive).toBe(true);

    // Update another 0.15s (total > 0.5s): removed (alive = false)
    for (let i = 0; i < 10; i++) {
      goomba.update(1 / 60, null);
    }
    expect(goomba.alive).toBe(false);
  });

  test('draws walking and squashed frames using Canvas drawPixels', () => {
    const goomba = createGoomba({ x: 30, y: 30 });
    const { ctx, calls } = createMockContext();

    // Walking frame
    goomba.draw(ctx);
    expect(calls.length).toBeGreaterThan(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Squashed frame
    goomba.stomp();
    const squashedMock = createMockContext();
    goomba.draw(squashedMock.ctx);
    expect(squashedMock.calls.length).toBeGreaterThan(0);
  });
});

describe('Koopa mechanics (src/entities/koopa.js)', () => {
  test('createKoopa instantiates 14x24 walker patrolling at 30px/s', () => {
    const koopa = createKoopa({ x: 100, y: 100, dir: -1 });
    expect(koopa.type).toBe('koopa');
    expect(koopa.w).toBe(14);
    expect(koopa.h).toBe(24);
    expect(koopa.vx).toBe(-30);
    expect(koopa.isShell).toBe(false);
    expect(koopa.alive).toBe(true);
  });

  test('koopa.stomp() converts to stationary 14x14 shell (type: shell, vx: 0)', () => {
    const koopa = createKoopa({ x: 50, y: 50, dir: -1 });
    const initialFeet = koopa.y + koopa.h; // 50 + 24 = 74

    const res = koopa.stomp();
    expect(res.isShell).toBe(true);
    expect(koopa.isShell).toBe(true);
    expect(koopa.type).toBe('shell');
    expect(koopa.h).toBe(14);
    expect(koopa.w).toBe(14);
    expect(koopa.vx).toBe(0);
    expect(koopa.vy).toBe(0);
    expect(koopa.y + koopa.h).toBe(initialFeet); // feet align with ground
  });

  test('shell.kick(dir) sets |vx| = 220 in the given direction', () => {
    const koopa = createKoopa({ x: 50, y: 50 });
    koopa.stomp(); // now shell

    koopa.kick(1);
    expect(koopa.vx).toBe(220);
    expect(koopa.facing).toBe(1);

    koopa.kick(-1);
    expect(koopa.vx).toBe(-220);
    expect(koopa.facing).toBe(-1);
  });

  test('moving shell bounces off walls at 220px/s', () => {
    const map = createTilemap([
      'X              X',
      'X              X',
      'XXXXXXXXXXXXXXXX',
    ]);
    // Floor is at row 2 (y=32), left wall at col 0 (x=16)
    const koopa = createKoopa({ x: 30, y: 18 });
    koopa.stomp(); // now shell with h=14, feet at 18+14=32
    koopa.kick(-1); // moving left towards x=16 at 220px/s
    expect(koopa.vx).toBe(-220);

    for (let i = 0; i < 15; i++) {
      koopa.update(DT, map);
    }

    // Bounced off left wall, now moving right at 220px/s
    expect(koopa.vx).toBe(220);
    expect(koopa.facing).toBe(1);
    expect(koopa.x).toBeGreaterThanOrEqual(16);
  });

  test('second stomp on a moving shell stops it (vx = 0)', () => {
    const koopa = createKoopa({ x: 50, y: 50 });
    koopa.stomp();
    koopa.kick(1);
    expect(koopa.vx).toBe(220);

    // Second stomp
    const res = koopa.stomp();
    expect(res.isShell).toBe(true);
    expect(koopa.vx).toBe(0);
    expect(koopa.isShell).toBe(true);
  });

  test('patrols and reverses on wall hit as walking koopa', () => {
    const map = createTilemap([
      'X              X',
      'X              X',
      'XXXXXXXXXXXXXXXX',
    ]);
    const koopa = createKoopa({ x: 25, y: 8, dir: -1 }); // h=24, feet at 8+24=32
    expect(koopa.vx).toBe(-30);

    for (let i = 0; i < 20; i++) {
      koopa.update(DT, map);
    }

    expect(koopa.vx).toBe(30);
    expect(koopa.facing).toBe(1);
  });

  test('walks off ledges as walking koopa and falls under gravity', () => {
    const ledgeMap = createTilemap([
      '                ',
      'XXXX            ',
      '                ',
      '                ',
      'XXXXXXXXXXXXXXXX',
    ]);
    // Platform top at y = 16. Koopa h=24, feet at 16 -> y = -8
    const koopa = createKoopa({ x: 40, y: -8, dir: 1 });
    expect(koopa.vx).toBe(30);

    for (let i = 0; i < 60; i++) {
      koopa.update(DT, ledgeMap);
    }

    expect(koopa.x).toBeGreaterThanOrEqual(64);
    expect(koopa.vy).toBeGreaterThan(0);
    expect(koopa.onGround).toBe(false);
  });

  test('draws walking and shell frames with camera', () => {
    const koopa = createKoopa({ x: 50, y: 50, dir: 1 });
    const camera = createCamera();
    const { ctx, calls } = createMockContext();

    koopa.draw(ctx, camera);
    expect(calls.length).toBeGreaterThan(0);

    koopa.stomp();
    const shellMock = createMockContext();
    koopa.draw(shellMock.ctx, camera);
    expect(shellMock.calls.length).toBeGreaterThan(0);
  });
});

describe('Integrated enemy behavior (composition with real LEVEL_ONE)', () => {
  test('Goombas and Koopas patrol, collide and interact over LEVEL_ONE data', () => {
    const map = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
    // Spawn Goomba near first pipe (pipe 1 is around col 28, x=448)
    const goomba = createGoomba({ x: 400, y: 194, dir: 1 }); // ground is row 13 (y=208), 194+14=208
    expect(goomba.vx).toBe(30);

    // Update goomba until it hits the pipe at x=448 (col 28)
    let hitWall = false;
    for (let i = 0; i < 120; i++) {
      goomba.update(DT, map);
      if (goomba.vx < 0) {
        hitWall = true;
        break;
      }
    }
    expect(hitWall).toBe(true);
    expect(goomba.vx).toBe(-30);

    // Spawn Koopa and stomp into shell, then kick against the pipe
    const koopa = createKoopa({ x: 400, y: 184, dir: 1 }); // 184+24=208
    koopa.stomp();
    expect(koopa.type).toBe('shell');
    expect(koopa.h).toBe(14);
    expect(koopa.y).toBe(194); // 184 + 10 = 194, feet at 194+14=208

    koopa.kick(1);
    expect(koopa.vx).toBe(220);

    let bounced = false;
    for (let i = 0; i < 60; i++) {
      koopa.update(DT, map);
      if (koopa.vx < 0) {
        bounced = true;
        break;
      }
    }
    expect(bounced).toBe(true);
    expect(koopa.vx).toBe(-220);
  });
});
