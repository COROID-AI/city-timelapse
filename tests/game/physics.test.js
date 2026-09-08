/**
 * Unit tests for the physics engine module.
 *
 * Verifies:
 *  - gravity fall,
 *  - horizontal run acceleration cap,
 *  - inertia/friction deceleration,
 *  - jump apex (variable jump velocity),
 *  - landing on solid ground,
 *  - side (left/right), top, and bottom collision resolution.
 */

import {
  createPhysics,
  updateBody,
  applyGravity,
  resolveCollisions,
  overlaps,
} from '../../game/js/physics.js';
import {
  GRAVITY,
  JUMP_VELOCITY,
  MAX_RUN_SPEED,
  ACCELERATION,
  FRICTION,
} from '../../game/js/constants.js';

/** Build a fresh body at rest. */
function makeBody(x = 0, y = 0, w = 16, h = 16) {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false };
}

describe('gravity fall', () => {
  test('applyGravity adds GRAVITY to vy each frame', () => {
    const body = makeBody();
    applyGravity(body);
    expect(body.vy).toBeCloseTo(GRAVITY);
    applyGravity(body);
    expect(body.vy).toBeCloseTo(GRAVITY * 2);
  });

  test('updateBody applies gravity and integrates position downward', () => {
    const body = makeBody(0, 0);
    updateBody(body, {});
    // vy = GRAVITY after one frame; y moves down by vy.
    expect(body.vy).toBeCloseTo(GRAVITY);
    expect(body.y).toBeCloseTo(GRAVITY);
  });

  test('dt scales both gravity and integration', () => {
    const body = makeBody(0, 0);
    updateBody(body, {}, 2);
    expect(body.vy).toBeCloseTo(GRAVITY * 2);
    expect(body.y).toBeCloseTo(GRAVITY * 2 * 2);
  });
});

describe('horizontal run acceleration cap', () => {
  test('holding right accelerates toward MAX_RUN_SPEED', () => {
    const body = makeBody();
    updateBody(body, { right: true });
    expect(body.vx).toBeCloseTo(ACCELERATION);
  });

  test('vx never exceeds MAX_RUN_SPEED', () => {
    const body = makeBody();
    body.vx = MAX_RUN_SPEED - 0.1;
    updateBody(body, { right: true });
    expect(body.vx).toBeLessThanOrEqual(MAX_RUN_SPEED);
    expect(body.vx).toBeCloseTo(MAX_RUN_SPEED);

    // Repeated frames keep it capped.
    for (let i = 0; i < 100; i++) {
      updateBody(body, { right: true });
    }
    expect(body.vx).toBeCloseTo(MAX_RUN_SPEED);
  });

  test('holding left accelerates negatively and caps at -MAX_RUN_SPEED', () => {
    const body = makeBody();
    for (let i = 0; i < 100; i++) {
      updateBody(body, { left: true });
    }
    expect(body.vx).toBeCloseTo(-MAX_RUN_SPEED);
  });
});

describe('inertia / friction deceleration', () => {
  test('friction decelerates a moving body toward zero', () => {
    const body = makeBody();
    body.vx = 1.0;
    updateBody(body, {});
    expect(body.vx).toBeCloseTo(Math.max(0, 1.0 - FRICTION));
  });

  test('friction never reverses direction', () => {
    const body = makeBody();
    body.vx = FRICTION * 0.5;
    updateBody(body, {});
    expect(body.vx).toBe(0);

    const neg = makeBody();
    neg.vx = -FRICTION * 0.5;
    updateBody(neg, {});
    expect(neg.vx).toBe(0);
  });

  test('a body at rest stays at rest with no input', () => {
    const body = makeBody();
    updateBody(body, {});
    expect(body.vx).toBe(0);
  });
});

describe('jump apex', () => {
  test('jump launches from the ground with JUMP_VELOCITY', () => {
    const body = makeBody();
    body.onGround = true;
    updateBody(body, { jump: true });
    expect(body.vy).toBeCloseTo(JUMP_VELOCITY);
    expect(body.onGround).toBe(false);
  });

  test('jump is ignored while airborne', () => {
    const body = makeBody();
    body.onGround = false;
    body.vy = 1.0;
    updateBody(body, { jump: true });
    // vy should still only reflect gravity, not a jump reset.
    expect(body.vy).toBeCloseTo(1.0 + GRAVITY);
  });

  test('jump reaches an apex then falls back down', () => {
    const body = makeBody();
    body.onGround = true;
    updateBody(body, { jump: true }); // launch

    let prevY = body.y;
    let reachedApex = false;
    // Simulate many frames with no input; track y movement.
    for (let i = 0; i < 60; i++) {
      updateBody(body, {});
      if (body.vy >= 0) reachedApex = true;
      // Once past apex, y should be increasing (falling).
      if (reachedApex && i > 1) {
        expect(body.y).toBeGreaterThan(prevY);
      }
      prevY = body.y;
    }
    expect(reachedApex).toBe(true);
    // After enough frames gravity should make vy positive (falling).
    expect(body.vy).toBeGreaterThan(0);
  });
});

describe('landing', () => {
  test('falling onto a solid resolves to bottom and sets onGround', () => {
    const body = makeBody(0, 0);
    body.vy = 3.0; // falling
    const solid = { x: 0, y: 16, w: 16, h: 16 };
    body.y = 14; // overlapping the solid top by 2px

    const hits = resolveCollisions(body, [solid]);
    expect(body.y).toBe(solid.y - body.h);
    expect(body.vy).toBe(0);
    expect(body.onGround).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0].side).toBe('bottom');
  });

  test('a grounded body stays grounded on a solid', () => {
    const solid = { x: 0, y: 16, w: 16, h: 16 };
    const body = makeBody(0, 1); // 1px penetration into the solid top
    body.vy = 0;
    body.onGround = true;

    const hits = resolveCollisions(body, [solid]);
    expect(hits).toHaveLength(1);
    expect(hits[0].side).toBe('bottom');
    expect(body.onGround).toBe(true);
    expect(body.y).toBe(solid.y - body.h);
  });
});

describe('side collision resolution', () => {
  test('running right into a solid resolves to right side', () => {
    const body = makeBody(0, 0);
    body.vx = 2.0;
    body.x = 12; // overlapping wall at x=16 by 4px
    const solid = { x: 16, y: 0, w: 16, h: 16 };

    const hits = resolveCollisions(body, [solid]);
    expect(body.x).toBe(solid.x - body.w);
    expect(body.vx).toBe(0);
    expect(hits).toHaveLength(1);
    expect(hits[0].side).toBe('right');
  });

  test('running left into a solid resolves to left side', () => {
    const body = makeBody(32, 0);
    body.vx = -2.0;
    body.x = 12; // overlapping wall ending at x=16 by 4px
    const solid = { x: 0, y: 0, w: 16, h: 16 };

    const hits = resolveCollisions(body, [solid]);
    expect(body.x).toBe(solid.x + solid.w);
    expect(body.vx).toBe(0);
    expect(hits).toHaveLength(1);
    expect(hits[0].side).toBe('left');
  });

  test('hitting a ceiling resolves to top side', () => {
    const body = makeBody(0, 6);
    body.vy = -3.0; // jumping up
    const solid = { x: 0, y: 0, w: 16, h: 8 };

    const hits = resolveCollisions(body, [solid]);
    expect(body.y).toBe(solid.y + solid.h);
    expect(body.vy).toBe(0);
    expect(hits).toHaveLength(1);
    expect(hits[0].side).toBe('top');
  });

  test('no overlap yields no hits and leaves the body untouched', () => {
    const body = makeBody(0, 0);
    const solid = { x: 100, y: 100, w: 16, h: 16 };
    const hits = resolveCollisions(body, [solid]);
    expect(hits).toHaveLength(0);
    expect(body.x).toBe(0);
    expect(body.y).toBe(0);
  });
});

describe('overlaps helper', () => {
  test('detects overlapping and non-overlapping rectangles', () => {
    expect(overlaps({ x: 0, y: 0, w: 16, h: 16 }, { x: 8, y: 8, w: 16, h: 16 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 16, h: 16 }, { x: 100, y: 100, w: 16, h: 16 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 16, h: 16 }, { x: 16, y: 0, w: 16, h: 16 })).toBe(false);
  });
});

describe('createPhysics factory', () => {
  test('exposes the physics API', () => {
    const physics = createPhysics();
    expect(typeof physics.applyGravity).toBe('function');
    expect(typeof physics.updateBody).toBe('function');
    expect(typeof physics.resolveCollisions).toBe('function');
    expect(typeof physics.overlaps).toBe('function');
  });
});