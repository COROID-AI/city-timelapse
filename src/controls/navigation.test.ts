import { describe, expect, it } from 'vitest';
import { CameraRig, DEFAULT_ORBIT_LIMITS } from '../core/cameraRig';
import { createNavigationController, pinchZoomFactor, wheelZoomFactor } from './navigation';

/** Converge the rig's damped state onto its targets. */
function converge(rig: CameraRig, steps = 400, dt = 0.05): void {
  for (let i = 0; i < steps; i += 1) {
    rig.update(dt);
  }
}

describe('wheelZoomFactor', () => {
  it('zooms in on scroll up (negative deltaY) and out on scroll down', () => {
    expect(wheelZoomFactor(-100, 0.0016)).toBeLessThan(1);
    expect(wheelZoomFactor(100, 0.0016)).toBeGreaterThan(1);
    expect(wheelZoomFactor(0, 0.0016)).toBe(1);
  });

  it('is invertible around the neutral point', () => {
    const s = 0.002;
    expect(wheelZoomFactor(50, s)).toBeCloseTo(1 / wheelZoomFactor(-50, s), 9);
  });
});

describe('pinchZoomFactor', () => {
  it('zooms in when fingers spread and out when they pinch', () => {
    expect(pinchZoomFactor(100, 200)).toBeLessThan(1);
    expect(pinchZoomFactor(200, 100)).toBeGreaterThan(1);
    expect(pinchZoomFactor(120, 120)).toBe(1);
  });

  it('is neutral for degenerate separations', () => {
    expect(pinchZoomFactor(0, 100)).toBe(1);
    expect(pinchZoomFactor(100, 0)).toBe(1);
  });
});

describe('CameraRig orbit mode', () => {
  it('boots within the travel limits with sensible defaults', () => {
    const rig = new CameraRig();
    expect(rig.getMode()).toBe('orbit');
    expect(rig.getDistance()).toBeGreaterThanOrEqual(DEFAULT_ORBIT_LIMITS.minDistance);
    expect(rig.getDistance()).toBeLessThanOrEqual(DEFAULT_ORBIT_LIMITS.maxDistance);
    expect(rig.getPolar()).toBeGreaterThanOrEqual(DEFAULT_ORBIT_LIMITS.minPolar);
    expect(rig.getPolar()).toBeLessThanOrEqual(DEFAULT_ORBIT_LIMITS.maxPolar);
  });

  it('clamps the polar angle while dragging', () => {
    const rig = new CameraRig({ limits: { minPolar: 0.2, maxPolar: 2.6 } });
    rig.rotate(0, 100);
    converge(rig);
    expect(rig.getPolar()).toBeGreaterThanOrEqual(0.2);
    expect(rig.getPolar()).toBeLessThanOrEqual(2.6);

    rig.rotate(0, -100);
    converge(rig);
    expect(rig.getPolar()).toBeGreaterThanOrEqual(0.2);
    expect(rig.getPolar()).toBeLessThanOrEqual(2.6);
  });

  it('applies azimuth drag input once converged', () => {
    const rig = new CameraRig();
    const initial = rig.getAzimuth();
    rig.rotate(0.5, 0);
    converge(rig);
    expect(rig.getAzimuth()).toBeCloseTo(initial + 0.5, 9);
  });

  it('respects min/max zoom distance limits', () => {
    const rig = new CameraRig({ initialDistance: 30, limits: { minDistance: 10, maxDistance: 50 } });
    rig.zoom(0.01);
    converge(rig);
    expect(rig.getDistance()).toBeCloseTo(10, 6);

    rig.zoom(10000);
    converge(rig);
    expect(rig.getDistance()).toBeCloseTo(50, 6);

    rig.zoom(0); // degenerate factors are ignored
    expect(rig.getDistance()).toBeCloseTo(50, 6);
  });

  it('smoothly damps toward the target exponentially', () => {
    const rig = new CameraRig({ dampingRate: 10 });
    rig.rotate(1, 0);
    // Single step from the initial azimuth (PI/4):
    // current + (target - current) * (1 - e^(-10*0.1)).
    rig.update(0.1);
    expect(rig.getAzimuth()).toBeCloseTo(Math.PI / 4 + (1 - Math.exp(-1)), 9);
    converge(rig);
    expect(rig.getAzimuth()).toBeCloseTo(Math.PI / 4 + 1, 6);
  });
});

describe('CameraRig walk mode', () => {
  it('enters walk mode at the configured eye height facing the orbit center', () => {
    const rig = new CameraRig({ initialDistance: 60, walkEyeHeight: 2 });
    rig.setMode('walk');
    const view = rig.getView();
    expect(rig.getMode()).toBe('walk');
    expect(view.position.y).toBe(2);
    // Facing the orbit center: looking at the origin from a distance.
    expect(Math.hypot(view.lookAt.x, view.lookAt.z)).toBeLessThan(Math.hypot(view.position.x, view.position.z));
  });

  it('moves forward along -Z at yaw 0 and strafes along +X', () => {
    const rig = new CameraRig({ mode: 'walk', walkSpeed: 9 });
    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);

    rig.walkMove(1, 0, 1);
    converge(rig);
    const forward = rig.getPosition();
    expect(forward.x).toBeCloseTo(0, 6);
    expect(forward.z).toBeCloseTo(-9, 6); // yaw 0 faces -Z

    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);
    rig.walkMove(0, 1, 1);
    converge(rig);
    const strafe = rig.getPosition();
    expect(strafe.x).toBeCloseTo(9, 6); // strafing right moves along +X
    expect(strafe.z).toBeCloseTo(0, 6);
  });

  it('normalizes diagonal movement so it is not faster than straight movement', () => {
    const rig = new CameraRig({ mode: 'walk', walkSpeed: 10 });
    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);

    rig.walkMove(1, 1, 1);
    converge(rig);
    const position = rig.getPosition();
    const traveled = Math.hypot(position.x, position.z);
    expect(traveled).toBeCloseTo(10, 6);
    expect(position.x).toBeCloseTo(position.z * -1, 6); // diagonal split
  });

  it('clamps look pitch to maxLookPitch', () => {
    const rig = new CameraRig({ mode: 'walk', maxLookPitch: 1.2 });
    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);

    rig.look(0, 100); // positive dy tilts the view down
    converge(rig);
    expect(rig.getPitch()).toBeCloseTo(-1.2, 6);

    rig.look(0, -100); // negative dy tilts the view up
    converge(rig);
    expect(rig.getPitch()).toBeCloseTo(1.2, 6);
  });

  it('round-trips through walk mode preserving the view geometry', () => {
    const rig = new CameraRig({ initialDistance: 45, initialAzimuth: 0.6, initialPolar: 1.1 });
    const orbitView = rig.getView();

    rig.setMode('walk');
    // Restore the exact orbit eye for a lossless spherical round trip.
    rig.setWalkPose(orbitView.position, rig.getYaw(), rig.getPitch());
    rig.setMode('orbit');

    const view = rig.getView();
    expect(view.lookAt).toEqual({ x: 0, y: 0, z: 0 });
    expect(rig.getDistance()).toBeCloseTo(45, 6);
    expect(rig.getAzimuth()).toBeCloseTo(0.6, 6);
    expect(rig.getPolar()).toBeCloseTo(1.1, 6);
    expect(view.position.x).toBeCloseTo(orbitView.position.x, 6);
    expect(view.position.y).toBeCloseTo(orbitView.position.y, 6);
    expect(view.position.z).toBeCloseTo(orbitView.position.z, 6);
  });
});

describe('createNavigationController (mouse/keyboard backend)', () => {
  function setup(rig: CameraRig): { target: HTMLElement; controller: ReturnType<typeof createNavigationController> } {
    const target = document.createElement('div');
    const controller = createNavigationController({ rig, pointerTarget: target });
    return { target, controller };
  }

  function mouseEvent(type: string, x: number, y: number, button = 0): MouseEvent {
    return new MouseEvent(type, { bubbles: true, button, clientX: x, clientY: y });
  }

  function keyEvent(type: string, code: string): KeyboardEvent {
    return new KeyboardEvent(type, { bubbles: true, code });
  }

  it('drag rotates the orbit camera and the view follows', () => {
    const rig = new CameraRig();
    const initialAzimuth = rig.getAzimuth();
    const initialPolar = rig.getPolar();
    const { target, controller } = setup(rig);

    target.dispatchEvent(mouseEvent('mousedown', 10, 10));
    target.dispatchEvent(mouseEvent('mousemove', 40, 25));
    converge(rig);
    expect(rig.getAzimuth()).toBeGreaterThan(initialAzimuth);
    expect(rig.getPolar()).toBeGreaterThan(initialPolar);

    controller.dispose();
  });

  it('drag looks around in walk mode', () => {
    const rig = new CameraRig({ mode: 'walk' });
    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);
    const { target, controller } = setup(rig);

    target.dispatchEvent(mouseEvent('mousedown', 0, 0));
    target.dispatchEvent(mouseEvent('mousemove', 50, 25)); // right + down
    converge(rig);
    expect(rig.getYaw()).toBeGreaterThan(0); // turned right
    expect(rig.getPitch()).toBeLessThan(0); // looks down

    controller.dispose();
  });

  it('WASD keyboard input walks the camera once the loop steps', () => {
    const rig = new CameraRig({ mode: 'walk', walkSpeed: 8 });
    rig.setWalkPose({ x: 0, y: 2, z: 0 }, 0, 0);
    const { target, controller } = setup(rig);

    target.dispatchEvent(keyEvent('keydown', 'KeyW'));
    controller.update(1);
    converge(rig);
    expect(rig.getPosition().z).toBeCloseTo(-8, 6);

    // Releasing the key stops further movement.
    target.dispatchEvent(keyEvent('keyup', 'KeyW'));
    const settled = rig.getPosition();
    controller.update(1);
    converge(rig);
    expect(rig.getPosition().z).toBeCloseTo(settled.z, 6);

    controller.dispose();
  });

  it('wheel event zooms within limits', () => {
    const rig = new CameraRig({ initialDistance: 60, limits: { minDistance: 20, maxDistance: 100 } });
    const { target, controller } = setup(rig);

    const wheel = new Event('wheel');
    Object.defineProperty(wheel, 'deltaY', { value: -120 });
    target.dispatchEvent(wheel);
    converge(rig);
    expect(rig.getDistance()).toBeLessThan(60);
    expect(rig.getDistance()).toBeGreaterThanOrEqual(20);

    controller.dispose();
  });

  it('dispose detaches every listener', () => {
    const rig = new CameraRig();
    const { target, controller } = setup(rig);
    controller.dispose();
    expect(controller.disposed).toBe(true);

    const initialAzimuth = rig.getAzimuth();
    target.dispatchEvent(mouseEvent('mousedown', 10, 10));
    target.dispatchEvent(mouseEvent('mousemove', 100, 100));
    target.dispatchEvent(keyEvent('keydown', 'KeyW'));
    controller.update(10);
    expect(rig.getAzimuth()).toBe(initialAzimuth);

    const initialPolar = rig.getPolar();
    target.dispatchEvent(mouseEvent('mousemove', 200, 200));
    expect(rig.getPolar()).toBe(initialPolar);
  });
});