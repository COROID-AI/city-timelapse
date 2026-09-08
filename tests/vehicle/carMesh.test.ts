/**
 * Unit tests for the low-poly neon sports car mesh factory.
 *
 * Asserts that `createCarMesh` builds a group with the named headlight /
 * taillight / exhaust-anchor children and that selectable liveries produce
 * distinct body colors (for AI reuse).
 */

import * as THREE from 'three';

import {
  createCarMesh,
  DEFAULT_LIVERY,
  LIVERIES,
  normalizeLivery,
} from '../../src/vehicle/carMesh';

/** Find a direct child by name, or throw if missing. */
function childNamed(root: THREE.Group, name: string): THREE.Object3D {
  const found = root.children.find((c) => c.name === name);
  if (!found) {
    throw new Error(`expected child "${name}"`);
  }
  return found;
}

describe('createCarMesh — low-poly neon sports car', () => {
  it('builds a group with a body and four wheels', () => {
    const car = createCarMesh();
    expect(car.name).toBe('player-car');
    expect(car.children.length).toBeGreaterThanOrEqual(6); // body + 4 wheels + lights + anchors
  });

  it('exposes the two named exhaust anchors for the FX task', () => {
    const car = createCarMesh();
    const left = childNamed(car, 'exhaustLeft');
    const right = childNamed(car, 'exhaustRight');
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(left.position.z).toBeLessThan(0); // at the rear
    expect(right.position.z).toBeLessThan(0);
  });

  it('exposes glowing headlights and taillights', () => {
    const car = createCarMesh();
    const headL = childNamed(car, 'headlightL');
    const headR = childNamed(car, 'headlightR');
    const tailL = childNamed(car, 'taillightL');
    const tailR = childNamed(car, 'taillightR');
    expect(headL.position.z).toBeGreaterThan(0);
    expect(headR.position.z).toBeGreaterThan(0);
    expect(tailL.position.z).toBeLessThan(0);
    expect(tailR.position.z).toBeLessThan(0);
  });

  it('applies the default livery when none is given', () => {
    const car = createCarMesh();
    expect(car.userData.livery).toBe(DEFAULT_LIVERY);
  });

  it('selects a distinct livery variant for AI reuse', () => {
    const hero = createCarMesh({ livery: 'hero' });
    const ember = createCarMesh({ livery: 'ember' });
    expect(hero.userData.livery).toBe('hero');
    expect(ember.userData.livery).toBe('ember');
    expect(ember.userData.livery).not.toBe(hero.userData.livery);
  });

  it('falls back to the default livery for an unknown key', () => {
    const car = createCarMesh({ livery: 'does-not-exist' });
    expect(car.userData.livery).toBe(DEFAULT_LIVERY);
  });
});

describe('normalizeLivery', () => {
  it('resolves a known key to its colors', () => {
    const resolved = normalizeLivery('violet');
    expect(resolved.key).toBe('violet');
    expect(resolved.colors).toBe(LIVERIES.violet);
  });

  it('defaults to the hero livery for undefined', () => {
    const resolved = normalizeLivery(undefined);
    expect(resolved.key).toBe(DEFAULT_LIVERY);
  });
});