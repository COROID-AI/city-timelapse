/**
 * Unit tests for the chase-camera damping and wide-angle FOV curves.
 *
 * The three.js binding (`createChaseCamera`) is thin; these tests exercise the
 * pure math that makes it frame-rate independent (damped follow) and sell the
 * cinematic feel (speed + boost FOV), without any WebGL context.
 */
import * as THREE from 'three';

import {
  clamp01,
  computeFov,
  createChaseCamera,
  dampValue,
  type ChaseCameraConfig,
} from '../../src/camera/chaseCamera';

describe('dampValue — frame-rate-independent exponential damping', () => {
  it('reaches the same result across different frame rates (no jitter)', () => {
    // 1 second total, one step of 1s.
    const one = dampValue(0, 10, 4, 1);
    // 1 second total, two steps of 0.5s.
    let two = 0;
    for (let i = 0; i < 2; i++) {
      two = dampValue(two, 10, 4, 0.5);
    }
    // Both converge to nearly identical values => not frame-rate dependent.
    expect(one).toBeCloseTo(two, 6);
    expect(one).toBeGreaterThan(1);
  });

  it('moves toward the target from the current value', () => {
    expect(dampValue(5, 10, 4, 0.5)).toBeGreaterThan(5);
    expect(dampValue(5, 10, 4, 0.5)).toBeLessThan(10);
  });

  it('treats negative dt as a no-op', () => {
    expect(dampValue(7, 3, 4, -1)).toBe(7);
  });

  it('converges into the deadband after enough time', () => {
    expect(dampValue(0, 100, 8, 10)).toBeGreaterThan(99.9);
  });
});

describe('computeFov — wide-angle speed + boost kick', () => {
  const base: Pick<
    ChaseCameraConfig,
    'baseFov' | 'fovSpeedRange' | 'fovSpeedMax' | 'fovBoostRange'
  > = {
    baseFov: 60,
    fovSpeedRange: 14,
    fovSpeedMax: 55,
    fovBoostRange: 11,
  };

  it('equals base FOV at rest with no boost', () => {
    expect(computeFov(0, 0, base)).toBe(60);
  });

  it('widens proportionally with speed toward the speed range', () => {
    expect(computeFov(55 / 2, 0, base)).toBeCloseTo(60 + 7, 6); // 50% of speed max
    expect(computeFov(55, 0, base)).toBeCloseTo(74, 6); // full speed range
  });

  it('saturates beyond the fov speed max', () => {
    expect(computeFov(200, 0, base)).toBeCloseTo(74, 6);
  });

  it('adds an extra kick during boost on top of speed', () => {
    const boosted = computeFov(55, 1, base);
    expect(boosted).toBeCloseTo(74 + 11, 6); // full boost range on full speed
  });

  it('blends the boost kick partially as boost rises', () => {
    expect(computeFov(55, 0.5, base)).toBeCloseTo(60 + 14 + 5.5, 6);
  });
});

describe('clamp01', () => {
  it('clamps into [0,1]', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
  });
});

describe('createChaseCamera — damped third-person follow', () => {
  it('widens FOV over time with speed and boost', () => {
    const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 1000);
    const chase = createChaseCamera(camera, {
      getBoost: () => (framesRan < 20 ? 0 : 1),
    });

    let framesRan = 0;
    // Accelerate to max speed, then release boost.
    for (let i = 0; i < 40; i++) {
      framesRan = i;
      const speed = i < 20 ? 10 + (i / 20) * 45 : 55;
      chase.update({ position: [0, 0, -i], yaw: 0, speed }, 1 / 60);
    }
    // The boost kick should push FOV well above the base value.
    expect(chase.getFov()).toBeGreaterThan(60);
  });

  it('settles into the damped follow pose behind/above the target', () => {
    const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 1000);
    const chase = createChaseCamera(camera, { positionLerp: 4, lookLerp: 8 });
    const target = { position: [0, 0, 20] as const, yaw: 0, speed: 0 };
    chase.reset(target);

    for (let i = 0; i < 120; i++) {
      chase.update(target, 1 / 60);
    }
    // Camera hangs at distance 8.2 behind (z = 20 - 8.2) and height 3.4 above.
    expect(camera.position.z).toBeGreaterThan(11.5);
    expect(camera.position.z).toBeLessThan(20);
    expect(camera.position.y).toBeGreaterThan(3.3);
    expect(camera.position.y).toBeLessThan(3.5);
  });
});