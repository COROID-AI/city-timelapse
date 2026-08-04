import { describe, expect, it } from 'vitest';
import type { CollisionBox } from '../city/types';
import {
  circleOverlapsBox,
  integrateVertical,
  overlapsAnyBox,
  resolveStep,
} from './movement';

const BOX: CollisionBox = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxZ: 10, maxY: 20 };

describe('circleOverlapsBox', () => {
  it('detects overlap inside, on the edge and near a corner', () => {
    expect(circleOverlapsBox(5, 5, BOX, 0.5)).toBe(true);
    expect(circleOverlapsBox(10, 5, BOX, 0.5)).toBe(true);
    expect(circleOverlapsBox(10.4, 5, BOX, 0.5)).toBe(true);
    expect(circleOverlapsBox(11, 5, BOX, 0.5)).toBe(false);
    // (10.3, 10.3) is 0.424 from the corner, inside radius 0.5.
    expect(circleOverlapsBox(10.3, 10.3, BOX, 0.5)).toBe(true);
    expect(circleOverlapsBox(10.5, 10.5, BOX, 0.5)).toBe(false);
  });
});

describe('overlapsAnyBox', () => {
  it('detects a hit in any box and a clear spot', () => {
    const boxes = [BOX];
    expect(overlapsAnyBox(9.8, 9.8, boxes, 0.5)).toBe(true);
    expect(overlapsAnyBox(20, 20, boxes, 0.5)).toBe(false);
  });
});

describe('resolveStep', () => {
  it('moves freely in open space', () => {
    const next = resolveStep(50, 50, 2, -1, [BOX], 0.5);
    expect(next.x).toBeCloseTo(52, 10);
    expect(next.z).toBeCloseTo(49, 10);
  });

  it('stops the player from walking into a building', () => {
    // Heading straight toward the box from outside.
    const next = resolveStep(-5, 5, 10, 0, [BOX], 0.5);
    // Collision radius 0.5 keeps the player 0.5 outside the wall.
    expect(next.x).toBeCloseTo(-0.5, 5);
    expect(next.z).toBeCloseTo(5, 10);
  });

  it('slides along a wall instead of clipping through', () => {
    // Pushing diagonally into the box: the X move is blocked but Z slides.
    const next = resolveStep(-5, 5, 10, 3, [BOX], 0.5);
    // The player stops at the last non-overlapping position, which is at most
    // one sub-step (radius) away from the wall.
    expect(next.x).toBeLessThanOrEqual(-0.5 + 1e-9);
    expect(next.x).toBeGreaterThanOrEqual(-0.5 - 0.5);
    expect(next.z).toBeCloseTo(8, 5);
  });

  it('lets a player already inside a building walk out', () => {
    const next = resolveStep(5, 5, 10, 0, [BOX], 0.5);
    expect(next.x).toBeCloseTo(15, 10);
    expect(next.z).toBeCloseTo(5, 10);
  });

  it('respects optional city bounds', () => {
    const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
    const next = resolveStep(95, 5, 10, 0, [], 0.5, bounds);
    expect(next.x).toBeCloseTo(100, 10);
  });
});

describe('integrateVertical', () => {
  const options = { groundY: 0, eyeHeight: 1.6, gravity: 14, jumpSpeed: 4.4 };

  it('stays on the ground when standing', () => {
    const next = integrateVertical(
      { y: 1.6, verticalVelocity: 0, onGround: true },
      0.016,
      options,
    );
    expect(next.y).toBe(1.6);
    expect(next.onGround).toBe(true);
  });

  it('jumps, rises, then lands back on the ground plane', () => {
    const jump = integrateVertical(
      { y: 1.6, verticalVelocity: 0, onGround: true },
      0.016,
      options,
      true,
    );
    expect(jump.verticalVelocity).toBeGreaterThan(0);
    expect(jump.onGround).toBe(false);
    expect(jump.y).toBeGreaterThan(1.6);

    // Integrate until the jump resolves back to the floor.
    let state = jump;
    for (let i = 0; i < 60 && !state.onGround; i++) {
      state = integrateVertical(state, 0.016, options);
    }
    expect(state.onGround).toBe(true);
    expect(state.y).toBe(1.6);
  });

  it('clamps the camera above the ground plane', () => {
    const next = integrateVertical(
      { y: 1.0, verticalVelocity: -5, onGround: false },
      0.016,
      options,
    );
    expect(next.y).toBe(1.6);
    expect(next.verticalVelocity).toBe(0);
    expect(next.onGround).toBe(true);
  });
});
