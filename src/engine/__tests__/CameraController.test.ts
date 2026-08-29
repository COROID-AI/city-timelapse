import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';

import {
  BLOCK_MAX_X,
  BLOCK_MAX_Z,
  BLOCK_MIN_X,
  BLOCK_MIN_Z,
} from '../../config/paths';
import { CameraController, DEFAULT_ERA_VANTAGES } from '../CameraController';

/** Creates a controller with a canvas stub (no DOM needed). */
function makeController(options: ConstructorParameters<typeof CameraController>[2] = {}) {
  const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setPointerCapture: () => undefined,
  } as unknown as HTMLCanvasElement;
  const controller = new CameraController(camera, canvas, options);
  return { camera, canvas, controller };
}

/** Runs enough update frames to let damping converge. */
function settle(controller: CameraController, frames = 600, dt = 1 / 60): void {
  for (let i = 0; i < frames; i += 1) {
    controller.update(dt);
  }
}

describe('CameraController — bounds clamping math', () => {
  it('clamps the orbit target to the shared block extents', () => {
    const { camera, controller } = makeController();
    // Pan far outside the block on every axis.
    controller.panBy(10_000, 10_000);
    settle(controller);

    expect(controller.target.x).toBeGreaterThanOrEqual(BLOCK_MIN_X);
    expect(controller.target.x).toBeLessThanOrEqual(BLOCK_MAX_X);
    expect(controller.target.z).toBeGreaterThanOrEqual(BLOCK_MIN_Z);
    expect(controller.target.z).toBeLessThanOrEqual(BLOCK_MAX_Z);
    expect(controller.target.y).toBeGreaterThanOrEqual(0);
    expect(controller.target.y).toBeLessThanOrEqual(10);

    // The camera must also stay inside the block footprint.
    expect(camera.position.x).toBeGreaterThanOrEqual(BLOCK_MIN_X);
    expect(camera.position.x).toBeLessThanOrEqual(BLOCK_MAX_X);
    expect(camera.position.z).toBeGreaterThanOrEqual(BLOCK_MIN_Z);
    expect(camera.position.z).toBeLessThanOrEqual(BLOCK_MAX_Z);
  });

  it('never lets the camera go below street level', () => {
    const { camera, controller } = makeController({ polar: Math.PI / 2 - 0.001 });
    // Push the polar angle to its extreme (near-horizontal orbit).
    controller.orbitDelta(0, Math.PI / 2 - 0.01);
    settle(controller);
    expect(camera.position.y).toBeGreaterThanOrEqual(0.5 - 1e-6);
  });

  it('flyTo clamps the target and camera to the block bounds', () => {
    const { camera, controller } = makeController();
    controller.flyTo('1985');
    settle(controller);

    expect(controller.target.x).toBeGreaterThanOrEqual(BLOCK_MIN_X);
    expect(controller.target.x).toBeLessThanOrEqual(BLOCK_MAX_X);
    expect(controller.target.z).toBeGreaterThanOrEqual(BLOCK_MIN_Z);
    expect(controller.target.z).toBeLessThanOrEqual(BLOCK_MAX_Z);
    expect(camera.position.x).toBeGreaterThanOrEqual(BLOCK_MIN_X);
    expect(camera.position.x).toBeLessThanOrEqual(BLOCK_MAX_X);
    expect(camera.position.z).toBeGreaterThanOrEqual(BLOCK_MIN_Z);
    expect(camera.position.z).toBeLessThanOrEqual(BLOCK_MAX_Z);
  });

  it('every default era vantage point lies inside the block', () => {
    for (const era of ['1945', '1965', '1985', '2005', '2025'] as const) {
      const v = DEFAULT_ERA_VANTAGES[era];
      expect(v.target.x).toBeGreaterThanOrEqual(BLOCK_MIN_X);
      expect(v.target.x).toBeLessThanOrEqual(BLOCK_MAX_X);
      expect(v.target.z).toBeGreaterThanOrEqual(BLOCK_MIN_Z);
      expect(v.target.z).toBeLessThanOrEqual(BLOCK_MAX_Z);
      expect(v.radius).toBeGreaterThan(0);
      expect(v.polar).toBeGreaterThan(0);
      expect(v.polar).toBeLessThan(Math.PI / 2);
    }
  });
});

describe('CameraController — damping convergence', () => {
  it('converges to the desired orbit pose after enough frames', () => {
    const { camera, controller } = makeController({
      autoRotate: false,
      azimuth: 0.2,
      polar: 0.6,
      radius: 6,
    });
    controller.orbitDelta(1.2, 0.3);
    controller.zoomBy(-1);
    settle(controller);

    // Desired azimuth ≈ 0.2 + 1.2, desired polar ≈ 0.6 + 0.3 (clamped < π/2).
    // The current values should have converged to the desired ones.
    const result = controller.update(1 / 60);
    expect(result.isAnimating).toBe(false);
    // The camera is no longer moving: consecutive frames produce the same pose.
    const posA = camera.position.clone();
    controller.update(1 / 60);
    expect(camera.position.distanceTo(posA)).toBeLessThan(1e-6);
  });

  it('damps toward the flyTo vantage point (converges)', () => {
    const { camera, controller } = makeController({ autoRotate: false });
    controller.flyTo('2025');
    settle(controller);

    const result = controller.update(1 / 60);
    expect(result.isAnimating).toBe(false);
    // The camera should be near the 2025 vantage.
    const v = DEFAULT_ERA_VANTAGES['2025'];
    expect(controller.target.distanceTo(v.target)).toBeLessThan(0.1);
    expect(camera.position.distanceTo(v.target)).toBeGreaterThan(1);
    expect(camera.position.distanceTo(v.target)).toBeLessThan(v.radius + 1);
  });

  it('flyTo completes and stops animating', () => {
    const { controller } = makeController({ autoRotate: false });
    controller.flyTo('1965');
    // After a long settle the fly-to should be finished.
    settle(controller, 1200);
    const result = controller.update(1 / 60);
    expect(result.isAnimating).toBe(false);
  });

  it('pan velocity decays to zero', () => {
    const { controller } = makeController({ autoRotate: false });
    controller.panBy(50, 50);
    // After enough frames the velocity should be gone.
    settle(controller, 400);
    const result = controller.update(1 / 60);
    expect(result.didPan).toBe(false);
  });
});

describe('CameraController — auto-rotate idle mode', () => {
  it('rotates when idle and pauses on user input', () => {
    const { camera, controller } = makeController({ autoRotate: true, autoRotateIdleDelaySec: 0.1 });
    // Let the idle delay elapse, then rotate for a while.
    for (let i = 0; i < 30; i += 1) controller.update(1 / 60);
    const posBefore = camera.position.clone();
    for (let i = 0; i < 60; i += 1) controller.update(1 / 60);
    const posAfter = camera.position.clone();
    // The camera azimuth changes while idle (position moves around the target).
    expect(posAfter.distanceTo(posBefore)).toBeGreaterThan(0.01);

    // User input pauses rotation.
    controller.orbitDelta(0.1, 0);
    const posPaused = camera.position.clone();
    for (let i = 0; i < 60; i += 1) controller.update(1 / 60);
    // After the orbitDelta, damping moves the camera toward the new desired
    // pose, but auto-rotate itself must not add rotation: the azimuth should
    // settle (not keep drifting). Check the camera is not continuously
    // rotating by verifying it converges.
    const result = controller.update(1 / 60);
    expect(result.isAnimating).toBe(false);
    void posPaused;
  });
});