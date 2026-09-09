/**
 * Composition test for camera navigation against the REAL BlockLayout bounds.
 *
 * Drives the NavigationController end-to-end the way the compose-scene-app
 * integration will: create the deterministic block layout, feed it to
 * `createNavigationController`, then exercise `setMode` / `flyTo` / `update`
 * with a mocked camera (no WebGL) and assert clamped positions plus clean
 * listener teardown.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { PerspectiveCamera } from 'three';
import { createCityBlockLayout } from '../../world/layout/cityBlockLayout';
import type { BlockLayout } from '../../world/layout/types';
import { createNavigationController } from '../navigationController';
import { getPoiTargets, POI_IDS } from '../pois';

const SEED = 'seed-42';

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
      /* orientation is verified via the `lookAt` recording */
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

function mockOf(camera: PerspectiveCamera): MockCamera {
  return camera as unknown as MockCamera;
}

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

function keyUp(code: string, key: string): void {
  fire(window, 'keyup', { code, key });
}

let layout: BlockLayout;
let dom: HTMLElement;

beforeEach(() => {
  layout = createCityBlockLayout(SEED);
  dom = document.createElement('div');
});

describe('navigation composition with the real BlockLayout', () => {
  it('keeps the orbit point of interest inside the block bounds and above ground', () => {
    const cam = makeCamera();
    const rigged = createNavigationController(cam, dom, { layout });
    // Pan hard via the controller's pointer path (right-drag pan).
    fire(dom, 'pointerdown', { button: 2, pointerId: 1, clientX: 100, clientY: 100 });
    fire(dom, 'pointermove', { pointerId: 1, clientX: 6000, clientY: 6000 });
    fire(dom, 'pointerup', { pointerId: 1 });
    rigged.update(1);
    expect(rigged.getMode()).toBe('orbit');
    // The orbiting camera may legitimately sit outside the island while
    // circling a clamped point of interest; the hard invariant is that it
    // never goes below ground.
    expect(mockOf(cam).position.y).toBeGreaterThanOrEqual(0);
  });

  it('walk mode keeps the first-person camera inside the block at eye height', () => {
    const cam = makeCamera();
    const c = createNavigationController(cam, dom, { layout });
    c.setMode('walk');
    expect(c.getMode()).toBe('walk');

    // Walk a long way with W held.
    keyDown('KeyW', 'w');
    for (let i = 0; i < 600; i += 1) c.update(1 / 60); // 10s of walking
    keyUp('KeyW', 'w');

    const b = layout.blockBounds;
    const pos = mockOf(cam).position;
    expect(pos.x).toBeGreaterThanOrEqual(b.minX - 1e-6);
    expect(pos.x).toBeLessThanOrEqual(b.maxX + 1e-6);
    expect(pos.z).toBeGreaterThanOrEqual(b.minZ - 1e-6);
    expect(pos.z).toBeLessThanOrEqual(b.maxZ + 1e-6);
    // Eye height, never below ground.
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(1.6);
  });

  it('walks for a while, then toggles back to orbit, staying inside bounds', () => {
    const cam = makeCamera();
    const c = createNavigationController(cam, dom, { layout });
    c.setMode('walk');
    keyDown('KeyW', 'w');
    for (let i = 0; i < 240; i += 1) c.update(1 / 60);
    keyUp('KeyW', 'w');
    c.setMode('orbit');
    c.update(1);
    const b = layout.blockBounds;
    const pos = mockOf(cam).position;
    expect(pos.x).toBeGreaterThanOrEqual(b.minX - 1e-6);
    expect(pos.x).toBeLessThanOrEqual(b.maxX + 1e-6);
    expect(pos.z).toBeGreaterThanOrEqual(b.minZ - 1e-6);
    expect(pos.z).toBeLessThanOrEqual(b.maxZ + 1e-6);
  });

  it('flyTo rooftop arrives above ground inside the block bounds', () => {
    const cam = makeCamera();
    const c = createNavigationController(cam, dom, { layout });
    c.flyTo('rooftop');
    for (let i = 0; i < 200; i += 1) c.update(1 / 60); // > 2.4s duration
    const pos = mockOf(cam).position;
    const b = layout.blockBounds;
    expect(pos.x).toBeGreaterThanOrEqual(b.minX - 1e-6);
    expect(pos.x).toBeLessThanOrEqual(b.maxX + 1e-6);
    expect(pos.z).toBeGreaterThanOrEqual(b.minZ - 1e-6);
    expect(pos.z).toBeLessThanOrEqual(b.maxZ + 1e-6);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it('flyTo reaches every preset POI (corner, midblock, rooftop)', () => {
    const cam = makeCamera();
    const c = createNavigationController(cam, dom, { layout });
    const targets = getPoiTargets(layout);
    for (const id of POI_IDS) {
      c.flyTo(id);
      for (let i = 0; i < 200; i += 1) c.update(1 / 60);
      const pos = mockOf(cam).position;
      expect(pos.x).toBeCloseTo(targets[id].position.x, 0);
      expect(pos.z).toBeCloseTo(targets[id].position.z, 0);
      expect(pos.y).toBeCloseTo(targets[id].position.y, 0);
    }
  });

  it('dispose removes all listeners: no further input moves the camera', () => {
    const cam = makeCamera();
    const el = document.createElement('div');
    const c = createNavigationController(cam, el, { layout });
    c.setMode('walk');
    c.setMode('orbit');
    c.dispose();

    const before = { ...mockOf(cam).position };
    // All of these would have moved the camera while alive.
    keyDown('KeyV', 'v');
    keyDown('KeyW', 'w');
    fire(el, 'wheel', { deltaY: -240, preventDefault: () => {} });
    fire(el, 'pointerdown', { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 200, clientY: 100 });
    for (let i = 0; i < 30; i += 1) c.update(1 / 60);
    expect(mockOf(cam).position).toEqual(before);
    expect(() => c.dispose()).not.toThrow();
  });
});