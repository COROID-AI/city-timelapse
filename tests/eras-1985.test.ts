import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { buildEra1985, update as updateEra1985 } from '../src/eras/1985';
import type { Era1985AnimatedObjects } from '../src/eras/1985';

function animatedOf(group: THREE.Group): Era1985AnimatedObjects {
  return group.userData.animatedObjects as Era1985AnimatedObjects;
}

describe('era 1985 update contract (regression)', () => {
  it('drives vehicle/pedestrian meshes from group.userData.animatedObjects', () => {
    const group = buildEra1985();
    const animated = animatedOf(group);
    const before = {
      sedan: animated.sedan1.position.x,
      van: animated.van.position.x,
      pedestrian: animated.pedestrian1.position.x,
    };

    updateEra1985(0.1, group);

    expect(animated.sedan1.position.x).not.toBe(before.sedan);
    expect(animated.van.position.x).not.toBe(before.van);
    expect(animated.pedestrian1.position.x).not.toBe(before.pedestrian);
  });

  it('produces the documented sinusoidal positions after one tick', () => {
    const group = buildEra1985();

    // Sub-clamp delta so this checks the raw animation math (clamping has
    // its own dedicated assertion below).
    updateEra1985(0.02, group);

    const t = 0.02;
    const animated = animatedOf(group);
    expect(animated.sedan1.position.x).toBeCloseTo(10 + Math.sin(t * 0.5) * 8, 12);
    expect(animated.van.position.x).toBeCloseTo(15 + Math.sin(t * 0.3) * 5, 12);
    expect(animated.pedestrian1.position.x).toBeCloseTo(-5 + Math.sin(t * 1.2) * 2, 12);
    expect(animated.elapsed).toBeCloseTo(t, 12);
  });

  it('keeps time per instance so separately built groups animate independently', () => {
    const a = buildEra1985();
    const b = buildEra1985();
    const initialSedanX = animatedOf(a).sedan1.position.x;
    expect(animatedOf(b).sedan1.position.x).toBe(initialSedanX);

    updateEra1985(0.25, a); // only instance a ticks

    expect(animatedOf(a).sedan1.position.x).not.toBe(initialSedanX);
    // Untouched instance keeps its original pose and zero clock.
    expect(animatedOf(b).sedan1.position.x).toBe(initialSedanX);
    expect(animatedOf(b).elapsed).toBe(0);
  });

  it('ignores non-finite, negative, and zero deltas', () => {
    const group = buildEra1985();
    const animated = animatedOf(group);
    const initialSedanX = animated.sedan1.position.x;

    updateEra1985(Number.NaN, group);
    updateEra1985(Number.POSITIVE_INFINITY, group);
    updateEra1985(-1, group);
    updateEra1985(0, group);

    expect(animated.sedan1.position.x).toBe(initialSedanX);
    expect(animated.elapsed).toBe(0);
  });

  it('clamps oversized frame deltas like the sibling eras', () => {
    const group = buildEra1985();

    updateEra1985(1, group);

    expect(animatedOf(group).elapsed).toBeCloseTo(0.05, 12);
  });

  it('is a no-op for groups without 1985 animation state', () => {
    const bare = new THREE.Group();
    expect(() => updateEra1985(0.1, bare)).not.toThrow();
  });
});
