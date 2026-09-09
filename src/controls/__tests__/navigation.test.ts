/**
 * Unit tests for camera navigation: mode state machine and bounds clamping,
 * all driven against a mocked camera (no THREE renderer, no WebGL).
 *
 * Covers:
 * - pure `clampToBlockBounds` math,
 * - OrbitRig drag/zoom/pan clamping (horizontal bounds + above-ground),
 * - WalkRig WASD movement clamping at eye height,
 * - the NavigationController mode state machine (setMode + V toggle),
 * - prefers-reduced-motion disabling orbit auto-drift,
 * - fly-to interruptibility,
 * - dispose removing every listener.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { PerspectiveCamera } from 'three';
import { createCityBlockLayout } from '../../world/layout/cityBlockLayout';
import { OrbitRig, clampToBlockBounds } from '../orbitRig';
import { WalkRig, WALK_EYE_HEIGHT } from '../walkRig';
import {
  createNavigationController,
  type NavigationController,
  type NavigationMode,
} from '../navigationController';
import { getPoiTargets } from '../pois';

/* ------------------------------------------------------------------ */
/* Mocked camera                                                        */
/* ------------------------------------------------------------------ */

/**
 * Minimal camera double: structural subset of THREE.PerspectiveCamera that the
 * rigs and the controller actually touch (position/rotation/lookAt). The real
 * `PerspectiveCamera` type is used only as the cast target.
 */
class MockCamera {
  position = {
    x: 0,
    y: 0,
    z: 0,
    set(x: number, y: number, z: number): void {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
  rotation = {
    order: 'YXZ',
    set(): void {
      /* orientation is verified through the `lookAt` recording */
    },
  };
  look = { x: 0, y: 0, z: 0 };
  lookAt(x: number, y: number, z: number): void {
    this.look = { x, y, z };
  }
}

function makeCamera(): PerspectiveCamera {
  return new MockCamera() as unknown as PerspectiveCamera;
}

/** Narrow a MockCamera back to the recording surface (test convenience). */
function mockOf(camera: PerspectiveCamera): MockCamera {
  return camera as unknown as MockCamera;
}

const BOUNDS = { minX: 0, maxX: 30, minZ: 0, maxZ: 18 };
const LAYOUT_SEED = 'seed-42';

let camera: PerspectiveCamera;
let dom: HTMLElement;
let nav: NavigationController;

beforeEach(() => {
  camera = makeCamera();
  dom = document.createElement('div');
  nav = createNavigationController(camera, dom, {
    layout: createCityBlockLayout(LAYOUT_SEED),
  });
});

/** Dispatch a bare Event with custom fields (jsdom lacks PointerEvent). */
function fire(
  target: EventTarget,
  type: string,
  init: Record<string, unknown> = {},
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  target.dispatchEvent(event);
}

function keyDown(code: string, key: string): void {
  fire(window, 'keydown', { code, key });
}

/* ----------------------------------------------------------------- */
/* Pure clamp math                                                    */
/* ----------------------------------------------------------------- */

describe('clampToBlockBounds (pure math)', () => {
  it('keeps interior points unchanged', () => {
    expect(clampToBlockBounds(15, 9, BOUNDS)).toEqual({ x: 15, z: 9 });
  });

  it('clamps x and z outside the block', () => {
    expect(clampToBlockBounds(-12, 40, BOUNDS)).toEqual({ x: 0, z: 18 });
  });

  it('pins partial escapes to the nearest edge', () => {
    expect(clampToBlockBounds(50, -5, BOUNDS)).toEqual({ x: 30, z: 0 });
  });
});

/* ------------------------------------------------------------------ */
/* OrbitRig clamping                                                   */
/* ------------------------------------------------------------------ */

describe('OrbitRig bounds clamping', () => {
  it('places the camera above ground for every pitch', () => {
    for (const pitch of [-1.5, -0.5, 0, 0.5, 1.5]) {
      const cam = makeCamera();
      const rig = new OrbitRig(cam, BOUNDS, {
        groundHeight: 0,
        targetHeight: 1.6,
        autoDrift: 0,
      });
      rig.rotateByPixels(0, pitch / 0.0032);
      rig.update(1);
      expect(mockOf(cam).position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps the orbit target (point of interest) inside the block when panning hard', () => {
    const cam = makeCamera();
    const rig = new OrbitRig(cam, BOUNDS, {
      groundHeight: 0,
      targetHeight: 1.6,
      autoDrift: 0,
    });
    rig.panByPixels(1e6, 1e6);
    rig.update(1);
    for (const value of [rig.target.x, rig.target.z]) {
      expect(value).toBeGreaterThanOrEqual(BOUNDS.minX - 1e-6);
      expect(value).toBeLessThanOrEqual(BOUNDS.maxX + 1e-6);
      expect(value).toBeGreaterThanOrEqual(BOUNDS.minZ - 1e-6);
      expect(value).toBeLessThanOrEqual(BOUNDS.maxZ + 1e-6);
    }
    // The orbiting camera itself never drops below ground.
    expect(mockOf(cam).position.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps wheel zoom to the near/far radius band', () => {
    const rig = new OrbitRig(makeCamera(), BOUNDS, {
      groundHeight: 0,
      targetHeight: 1.6,
      autoDrift: 0,
    });
    rig.zoomBy(1000);
    rig.update(10);
    expect(rig.getRadius()).toBeLessThanOrEqual(90);
    rig.zoomBy(-1000);
    rig.update(10);
    expect(rig.getRadius()).toBeGreaterThanOrEqual(4);
  });
});

/* ------------------------------------------------------------------ */
/* WalkRig clamping                                                   */
/* ------------------------------------------------------------------ */

describe('WalkRig bounds clamping', () => {
  it('walks forward at eye height and stays inside bounds', () => {
    const cam = makeCamera();
    const rig = new WalkRig(cam, BOUNDS, {
      groundHeight: 0,
      eyeHeight: WALK_EYE_HEIGHT,
    });
    rig.setAxes(1, 0);
    for (let i = 0; i < 400; i += 1) rig.update(0.1); // ~40s of walking
    expect(rig.getPositionX()).toBeGreaterThanOrEqual(BOUNDS.minX - 1e-6);
    expect(rig.getPositionX()).toBeLessThanOrEqual(BOUNDS.maxX + 1e-6);
    expect(rig.getPositionZ()).toBeGreaterThanOrEqual(BOUNDS.minZ - 1e-6);
    expect(rig.getPositionZ()).toBeLessThanOrEqual(BOUNDS.maxZ + 1e-6);
    // Eye height maintained and never below ground.
    expect(mockOf(cam).position.y).toBe(WALK_EYE_HEIGHT);
    expect(mockOf(cam).position.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps explicit setPosition calls', () => {
    const rig = new WalkRig(makeCamera(), BOUNDS, {
      groundHeight: 0,
      eyeHeight: WALK_EYE_HEIGHT,
    });
    rig.setPosition(999, -999);
    expect(rig.getPositionX()).toBe(BOUNDS.maxX);
    expect(rig.getPositionZ()).toBe(BOUNDS.minZ);
  });
});

/* ------------------------------------------------------------------ */
/* Mode state machine                                                  */
/* ------------------------------------------------------------------ */

describe('NavigationController mode state machine', () => {
  it('defaults to orbit mode', () => {
    expect(nav.getMode()).toBe('orbit');
  });

  it('switches orbit -> walk -> orbit via setMode', () => {
    nav.setMode('walk');
    expect(nav.getMode()).toBe('walk');
    nav.setMode('orbit');
    expect(nav.getMode()).toBe('orbit');
  });

  it('ignores invalid modes and duplicate modes', () => {
    let fired = 0;
    nav.onModeChange = () => {
      fired += 1;
    };
    nav.setMode('teleport' as never);
    expect(nav.getMode()).toBe('orbit');
    nav.setMode('orbit');
    expect(nav.getMode()).toBe('orbit');
    expect(fired).toBe(0);
  });

  it('toggles with the V key', () => {
    keyDown('KeyV', 'v');
    expect(nav.getMode()).toBe('walk');
    keyDown('KeyV', 'v');
    expect(nav.getMode()).toBe('orbit');
  });

  it('calls onModeChange on real transitions only', () => {
    const seen: NavigationMode[] = [];
    nav.onModeChange = (m) => {
      seen.push(m);
    };
    nav.setMode('walk');
    nav.setMode('walk');
    nav.setMode('orbit');
    expect(seen).toEqual(['walk', 'orbit']);
  });
});

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */

describe('prefers-reduced-motion disables auto-drift', () => {
  it('keeps a static orbit when motion is reduced', () => {
    const cam = makeCamera();
    const reduced = createNavigationController(cam, document.createElement('div'), {
      layout: createCityBlockLayout(LAYOUT_SEED),
      autoDrift: 0.8,
      motionReduced: () => true,
    });
    const before = mockOf(cam).position.x;
    for (let i = 0; i < 30; i += 1) reduced.update(1 / 30);
    expect(mockOf(cam).position.x).toBe(before);
  });

  it('drifts when motion is allowed', () => {
    const cam = makeCamera();
    const drifting = createNavigationController(cam, document.createElement('div'), {
      layout: createCityBlockLayout(LAYOUT_SEED),
      autoDrift: 0.8,
      motionReduced: () => false,
    });
    const before = mockOf(cam).position.x;
    for (let i = 0; i < 30; i += 1) drifting.update(1 / 30);
    expect(mockOf(cam).position.x).not.toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* Interruptible fly-to                                                */
/* ------------------------------------------------------------------ */

describe('fly-to is eased and interruptible', () => {
  it('flies to the rooftop target and ends above ground inside bounds', () => {
    nav.flyTo('rooftop');
    for (let i = 0; i < 120; i += 1) nav.update(1 / 30); // 4s > 2.4s duration
    const pos = mockOf(camera).position;
    expect(pos.x).toBeGreaterThanOrEqual(BOUNDS.minX - 1e-6);
    expect(pos.x).toBeLessThanOrEqual(BOUNDS.maxX + 1e-6);
    expect(pos.z).toBeGreaterThanOrEqual(BOUNDS.minZ - 1e-6);
    expect(pos.z).toBeLessThanOrEqual(BOUNDS.maxZ + 1e-6);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it('a movement key cancels an in-flight fly-to', () => {
    nav.flyTo('rooftop');
    nav.update(0.5);
    fire(window, 'keydown', { code: 'KeyW', key: 'w' });
    for (let i = 0; i < 300; i += 1) nav.update(1 / 30);
    const pos = mockOf(camera).position;
    const rooftopY = getPoiTargets(createCityBlockLayout(LAYOUT_SEED)).rooftop.position.y;
    expect(Math.abs(pos.y - rooftopY)).toBeGreaterThan(1);
  });

  it('is a no-op after dispose', () => {
    nav.dispose();
    const before = { ...mockOf(camera).position };
    nav.flyTo('corner');
    nav.update(10);
    expect(mockOf(camera).position).toEqual(before);
  });
});

/* ------------------------------------------------------------------ */
/* dispose removes listeners                                          */
/* ------------------------------------------------------------------ */

describe('dispose removes all listeners', () => {
  it('stops responding to V, wheel, and pointer input after dispose', () => {
    const cam = makeCamera();
    const el = document.createElement('div');
    const c = createNavigationController(cam, el, {
      layout: createCityBlockLayout(LAYOUT_SEED),
    });

    c.setMode('walk');
    c.setMode('orbit');
    c.dispose();

    // Key shortcut removed -> V no longer toggles.
    keyDown('KeyV', 'v');
    expect(c.getMode()).toBe('orbit');

    // Wheel listener removed: no crash, no zoom (camera unchanged).
    const before = { ...mockOf(cam).position };
    fire(el, 'wheel', { deltaY: -240, preventDefault: () => {} });
    expect(mockOf(cam).position).toEqual(before);

    // Pointer listeners removed: drag does not rotate.
    fire(el, 'pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 200, clientY: 150 });
    expect(mockOf(cam).position).toEqual(before);

    // dispose is idempotent.
    expect(() => c.dispose()).not.toThrow();
  });

  it('stops updating after dispose', () => {
    const cam = makeCamera();
    const el = document.createElement('div');
    const c = createNavigationController(cam, el, {
      layout: createCityBlockLayout(LAYOUT_SEED),
    });
    const before = { ...mockOf(cam).position };
    c.dispose();
    c.update(1);
    expect(mockOf(cam).position).toEqual(before);
  });
});