/**
 * Chase camera unit tests: damped follow convergence, speed-scaled
 * distance/FOV framing, bounded drift roll, rig exposure and dispose.
 */
import * as THREE from 'three';

import type { CarState } from '../src/game/contracts';
import { createChaseCamera, type ChaseCameraHandle } from '../src/game/camera';

// The `three` package ships ESM (three.module.js) that Jest's CJS runtime
// cannot require on Node 22. The chase rig only touches PerspectiveCamera
// and Vector3, so provide a tiny hermetic shim whose semantics follow
// Three's: lookAt() aims the camera (clearing any previous roll) and
// rotateZ() rolls it around the view axis. Realistic module behavior stays
// covered by the Vite/THREE runtime in the browser.
jest.mock('three', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number): this {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    clone(): Vector3 {
      return new Vector3(this.x, this.y, this.z);
    }
  }
  class PerspectiveCamera {
    fov: number;
    aspect: number;
    near: number;
    far: number;
    position = new Vector3();
    rotation = { x: 0, y: 0, z: 0, order: 'XYZ' };
    constructor(fov = 60, aspect = 1, near = 0.1, far = 1000) {
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
    }
    lookAt(_target: unknown): this {
      // Aiming the camera resets any previous view-axis roll; rotateZ then
      // layers the rig's roll on top, mirroring Three's Object3D behavior.
      this.rotation.z = 0;
      return this;
    }
    rotateZ(angle: number): this {
      this.rotation.z += angle;
      return this;
    }
    updateProjectionMatrix(): this {
      return this;
    }
  }
  return { Vector3, PerspectiveCamera };
});

const STEP = 1 / 60;

/** Build a full CarState with overrides (position from the mock Vector3). */
function makeCar(overrides: Partial<CarState> = {}): CarState {
  return {
    position: new THREE.Vector3(0, 0, 0),
    heading: 0,
    speed: 0,
    driftFactor: 0,
    nitrousCharge: 1,
    boostActive: false,
    lap: 1,
    trackProgress: 0,
    ...overrides,
  };
}

/** Run enough fixed steps for the damped rig to settle at its targets. */
function settle(rig: ChaseCameraHandle, car: CarState, steps = 300): void {
  for (let i = 0; i < steps; i += 1) {
    rig.update(STEP, car);
  }
}

describe('createChaseCamera', () => {
  it('seats the camera behind and above the car on the first update', () => {
    const rig = createChaseCamera();
    const car = makeCar({
      position: new THREE.Vector3(10, 0, 4),
      speed: 0,
      heading: 0, // forward = +x
    });

    rig.update(STEP, car);

    // Behind +x by minDistance, up by height. minDistance = 10 - 7.5 = 2.5.
    expect(rig.camera.position.x).toBeCloseTo(2.5, 5);
    expect(rig.camera.position.y).toBeCloseTo(3.2, 5);
    expect(rig.camera.position.z).toBeCloseTo(4, 5);
    expect(rig.mode).toBe('follow');
  });

  it('converges smoothly to the follow position without overshoot', () => {
    const rig = createChaseCamera({
      minDistance: 8,
      maxDistance: 14,
      height: 3,
      maxSpeed: 100,
      minFov: 60,
      maxFov: 75,
      followRate: 5,
    });
    const car = makeCar({
      position: new THREE.Vector3(0, 0, 0),
      speed: 50, // speedT = 0.5 → follow distance = 11
    });

    rig.update(STEP, car); // seat at (0, 0, 0) → camera at (-11, 3, 0)
    car.position.set(20, 0, 8); // teleport the car away and hold it there

    const ideal = { x: 20 - 11, y: 3, z: 8 };
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < 240; i += 1) {
      rig.update(STEP, car);
      xs.push(rig.camera.position.x);
      zs.push(rig.camera.position.z);
    }

    // Exponential damping is monotonic per axis: never overshoots the target
    // and never reverses direction while the car is stationary.
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
      expect(zs[i]).toBeGreaterThanOrEqual(zs[i - 1] - 1e-9);
    }
    expect(xs[xs.length - 1]).toBeLessThanOrEqual(ideal.x + 1e-6);
    expect(zs[zs.length - 1]).toBeLessThanOrEqual(ideal.z + 1e-6);

    // Converged after a few seconds of simulated time.
    expect(rig.camera.position.x).toBeCloseTo(ideal.x, 2);
    expect(rig.camera.position.y).toBeCloseTo(ideal.y, 2);
    expect(rig.camera.position.z).toBeCloseTo(ideal.z, 2);
  });

  it('tracks at constant speed with no jitter', () => {
    const rig = createChaseCamera({ followRate: 5 });
    const car = makeCar({
      position: new THREE.Vector3(0, 0, 0),
      speed: 40,
      heading: 0,
    });

    // Let the camera settle while the car drives straight at 40 m/s.
    // The move-then-update phase matches the measurement loop below so the
    // camera is already in its steady-state tracking offset when we sample.
    for (let i = 0; i < 300; i += 1) {
      car.position.x += 40 * STEP;
      rig.update(STEP, car);
    }

    // Once settled the camera holds a rigid offset while the car drives on:
    // per-frame displacement is exactly the car's displacement and the
    // distance to the car stays constant — that is "no jitter".
    const perFrame: number[] = [];
    const distances: number[] = [];
    let previous = rig.camera.position.clone();

    for (let i = 0; i < 120; i += 1) {
      car.position.x += 40 * STEP;
      rig.update(STEP, car);
      const current = rig.camera.position;
      perFrame.push(Math.hypot(current.x - previous.x, current.z - previous.z));
      distances.push(rig.distance);
      previous = current.clone();
    }

    const meanFrame = perFrame.reduce((a, b) => a + b, 0) / perFrame.length;
    const meanDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    for (let i = 0; i < perFrame.length; i += 1) {
      expect(perFrame[i]).toBeCloseTo(meanFrame, 6);
      expect(perFrame[i]).toBeCloseTo(40 * STEP, 4); // matches car speed
      expect(distances[i]).toBeCloseTo(meanDistance, 6);
    }
  });

  it('widens follow distance and FOV as speed increases', () => {
    const rig = createChaseCamera({
      minDistance: 8,
      maxDistance: 14,
      height: 3,
      maxSpeed: 100,
      minFov: 60,
      maxFov: 75,
    });
    const car = makeCar({ position: new THREE.Vector3(0, 0, 0), heading: 0 });

    const measure = (speed: number) => {
      car.speed = speed;
      settle(rig, car);
      return { distance: rig.distance, fov: rig.fov, cameraFov: rig.camera.fov };
    };

    const slow = measure(0);
    const mid = measure(50);
    const fast = measure(100);

    // Distance: 8 → 11 → 14 (speedT = 0 → 0.5 → 1).
    expect(slow.distance).toBeCloseTo(8, 2);
    expect(mid.distance).toBeCloseTo(11, 2);
    expect(fast.distance).toBeCloseTo(14, 2);

    // FOV hardens proportionally and is applied to the underlying camera.
    expect(slow.fov).toBeCloseTo(60, 2);
    expect(mid.fov).toBeCloseTo(67.5, 2);
    expect(fast.fov).toBeCloseTo(75, 2);
    expect(slow.cameraFov).toBeCloseTo(slow.fov, 6);
    expect(mid.cameraFov).toBeCloseTo(mid.fov, 6);
    expect(fast.cameraFov).toBeCloseTo(fast.fov, 6);

    // Scaling is bounded: it saturates past maxSpeed instead of running away.
    car.speed = 500;
    settle(rig, car);
    expect(rig.distance).toBeCloseTo(14, 2);
    expect(rig.fov).toBeCloseTo(75, 2);
  });

  it('rolls proportionally to driftFactor and stays bounded', () => {
    const rig = createChaseCamera({ maxRoll: 0.05 });
    const car = makeCar({
      position: new THREE.Vector3(0, 0, 0),
      speed: 30,
      driftFactor: 0,
    });

    const settleDrift = (driftFactor: number) => {
      car.driftFactor = driftFactor;
      settle(rig, car);
      return { roll: rig.roll, cameraRoll: rig.camera.rotation.z };
    };

    const none = settleDrift(0);
    expect(none.roll).toBeCloseTo(0, 6);
    expect(none.cameraRoll).toBeCloseTo(0, 6);

    const half = settleDrift(0.5);
    const full = settleDrift(1);

    // Proportional to driftFactor at steady state…
    expect(half.roll).toBeCloseTo(0.025, 6);
    expect(full.roll).toBeCloseTo(0.05, 6);
    // …applied to the underlying camera…
    expect(half.cameraRoll).toBeCloseTo(half.roll, 6);
    expect(full.cameraRoll).toBeCloseTo(full.roll, 6);
    // …and never exceeds maxRoll even during the transient.
    let maxObserved = 0;
    car.driftFactor = 1;
    for (let i = 0; i < 120; i += 1) {
      rig.update(STEP, car);
      maxObserved = Math.max(maxObserved, Math.abs(rig.roll));
    }
    expect(maxObserved).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(Math.abs(rig.roll)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('exposes the underlying camera and live rig state', () => {
    const rig = createChaseCamera();
    const car = makeCar({
      position: new THREE.Vector3(0, 0, 0),
      speed: 30,
      heading: 0.7,
    });
    settle(rig, car);

    expect(rig.camera).toBeDefined();
    expect(rig.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(rig.mode).toBe('follow');
    expect(rig.fov).toBeCloseTo(rig.camera.fov, 6);
    expect(rig.height).toBeGreaterThan(0);
    expect(rig.pitch).toBeLessThan(0); // looking down at the car
    expect(rig.distance).toBeGreaterThan(0);

    // Effects pipeline contract: read the baseline, then modulate the
    // underlying camera FOV (wide-angle nitrous boost) — persisted per frame.
    rig.camera.fov = rig.fov * 1.3;
    expect(rig.camera.fov).toBeCloseTo(rig.fov * 1.3, 6);

    // A later update restores the speed-scaled baseline.
    rig.update(STEP, car);
    expect(rig.camera.fov).toBeCloseTo(rig.fov, 6);
  });

  it('dispose detaches cleanly: update becomes a no-op and is idempotent', () => {
    const rig = createChaseCamera();
    const car = makeCar({ position: new THREE.Vector3(0, 0, 0), speed: 30 });
    settle(rig, car);

    const snapshot = {
      x: rig.camera.position.x,
      y: rig.camera.position.y,
      z: rig.camera.position.z,
      fov: rig.camera.fov,
    };

    rig.dispose();
    rig.dispose(); // idempotent

    car.position.set(100, 0, 100);
    car.speed = 90;
    rig.update(STEP, car);

    expect(rig.camera.position.x).toBe(snapshot.x);
    expect(rig.camera.position.y).toBe(snapshot.y);
    expect(rig.camera.position.z).toBe(snapshot.z);
    expect(rig.camera.fov).toBe(snapshot.fov);
  });

  it('rejects an invalid speed ceiling', () => {
    expect(() => createChaseCamera({ maxSpeed: 0 })).toThrow(/maxSpeed/);
    expect(() => createChaseCamera({ maxRoll: -1 })).toThrow(/maxRoll/);
  });
});