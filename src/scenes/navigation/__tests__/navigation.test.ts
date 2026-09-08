import { describe, expect, it } from 'vitest';
import { CITY_BLOCK_LAYOUT } from '../../layout/index.js';
import { NavigationRig } from '../index.js';
import { clamp, lerp, makeCameraState } from '../camera.js';

describe('navigation rig', () => {
  it('attaches to the default overview without resetting', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT);
    const s0 = rig.attach();
    const s1 = rig.attach({ x: 10, y: 5, z: -8 });
    // Attach adopts the given position; a fresh attach preserves it.
    expect(s1.position.x).toBe(10);
    expect(s1.position.y).toBe(5);
    expect(s1.position.z).toBe(-8);
    expect(s0.position).not.toEqual(s1.position);
  });

  it('rotates with damping and clamped pitch', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT, {
      pitchMin: 0.2,
      pitchMax: 1.2,
    });
    const s0 = rig.attach();
    // Big rotate impulses drive pitch far beyond the clamp.
    for (let i = 0; i < 200; i++) {
      rig.rotate(0.5, 0.5, 0.016);
      rig.update(0.016);
    }
    const s = rig.update(0.016);
    expect(s.pitch).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(s.pitch).toBeLessThanOrEqual(1.2 + 1e-9);
    // Yaw actually changed from the default.
    expect(s.yaw).not.toBeCloseTo(s0.yaw, 3);
  });

  it('zooms with distance clamped', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT, {
      distanceMin: 5,
      distanceMax: 60,
    });
    rig.attach();
    // Zoom in a lot.
    for (let i = 0; i < 100; i++) {
      rig.zoom(2, 0.016);
      rig.update(0.016);
    }
    const s = rig.update(0.016);
    expect(s.distance).toBeGreaterThanOrEqual(5 - 1e-9);
  });

  it('pans the target across the ground plane', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT);
    const s0 = rig.attach();
    for (let i = 0; i < 60; i++) {
      rig.pan(0.3, 0.2, 0.016);
      rig.update(0.016);
    }
    const s = rig.update(0.016);
    expect(s.target.x).not.toBeCloseTo(s0.target.x, 3);
    expect(s.target.z).not.toBeCloseTo(s0.target.z, 3);
  });

  it('lerps the camera to a building focus point', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT, { focusDuration: 1.0 });
    const s0 = rig.attach();
    const focusId = CITY_BLOCK_LAYOUT.cameraFocusPoints.find(
      (f) => f.id !== 'focus-overview',
    )!.id;
    rig.focusOn(focusId);
    expect(rig.isFocused()).toBe(true);
    // Step through the lerp.
    for (let i = 0; i < 120; i++) {
      rig.update(0.016);
    }
    const s = rig.update(0.016);
    expect(rig.isFocused()).toBe(false);
    // The camera moved toward the focus point's target.
    const point = CITY_BLOCK_LAYOUT.cameraFocusPoints.find((f) => f.id === focusId)!;
    expect(s.target.x).toBeCloseTo(point.target.x, 1);
    expect(s.target.z).toBeCloseTo(point.target.z, 1);
    // And the viewport changed from the start.
    expect(s.position).not.toEqual(s0.position);
  });

  it('lerps to the block overview', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT, { focusDuration: 0.5 });
    rig.attach();
    rig.focusOn('focus-overview');
    for (let i = 0; i < 120; i++) {
      rig.update(0.016);
    }
    const s = rig.update(0.016);
    const overview = CITY_BLOCK_LAYOUT.cameraFocusPoints.find(
      (f) => f.id === 'focus-overview',
    )!;
    expect(s.target.x).toBeCloseTo(overview.target.x, 1);
    expect(s.target.z).toBeCloseTo(overview.target.z, 1);
  });

  it('ignores unknown focus ids', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT);
    rig.attach();
    expect(rig.focusOn('missing')).toBeUndefined();
    expect(rig.isFocused()).toBe(false);
  });

  it('exposes focus points from the layout read-only', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT);
    const points = rig.focusPoints();
    expect(points.some((p) => p.id === 'focus-overview')).toBe(true);
    // Every building lot has a focus point.
    for (const lot of CITY_BLOCK_LAYOUT.lots) {
      expect(points.some((p) => p.id === `focus-${lot.id}`)).toBe(true);
    }
  });

  it('stays stable across era transitions (viewport not reset)', () => {
    const rig = new NavigationRig(CITY_BLOCK_LAYOUT);
    const s0 = rig.attach();
    // Simulate era transitions: the rig is never re-attached or reset.
    for (const year of ['1945', '1965', '1985', '2005', '2025']) {
      // Era change is a no-op for the rig — nothing resets the pose.
      const s = rig.update(0.016);
      expect(s.position).toEqual(s0.position);
    }
  });
});

describe('camera math', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerps and clamps t', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 2)).toBe(10);
  });

  it('derives a camera position from orbit parameters', () => {
    const s = makeCameraState({ x: 0, z: 0 }, 0, 0, 10);
    // pitch 0 => camera on the ground plane at +x.
    expect(s.position.x).toBeCloseTo(10, 6);
    expect(s.position.y).toBeCloseTo(0, 6);
    expect(s.position.z).toBeCloseTo(0, 6);
  });
});