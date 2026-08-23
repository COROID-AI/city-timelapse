/**
 * Unit tests for the orbit-camera factory with a stubbed renderer and a
 * minimal DOM-like canvas. The fakes implement exactly the surface OrbitControls
 * touches at construction/disposal time (event listeners, style, getRootNode,
 * ownerDocument), keeping the suite deterministic in the node test environment.
 *
 * Covers: API shape (update/setEnabled/dispose + controls/camera exposure),
 * damping configuration, zoom-distance and polar-angle clamping behavior,
 * pan-target confinement around the city block, enable toggling, and idempotent
 * listener teardown on dispose.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';
import {
  DAMPING_FACTOR,
  MAX_DISTANCE,
  MAX_POLAR_ANGLE,
  MIN_DISTANCE,
  PAN_LIMIT_X,
  PAN_LIMIT_Z,
  TARGET_MAX_Y,
  TARGET_MIN_Y,
  createOrbitCamera,
} from '../src/controls/camera';

type Listener = (...args: unknown[]) => void;

/** Records event listeners per type, mirroring the EventTarget contract. */
class FakeEventSurface {
  readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  }

  count(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }
}

/**
 * Minimal canvas stand-in exposing every member OrbitControls accesses:
 * add/removeEventListener, `style.touchAction`/`style.cursor`,
 * `getRootNode()` for the capture-phase keydown hook and `ownerDocument`
 * for pointermove/pointerup tracking during drags.
 */
class FakeCanvas {
  readonly style: Record<string, string> = {};
  readonly surface = new FakeEventSurface();
  readonly rootSurface = new FakeEventSurface();
  readonly ownerDocument = new FakeEventSurface();

  clientWidth = 1600;
  clientHeight = 900;
  width = 1600;
  height = 900;

  addEventListener(type: string, listener: Listener): void {
    this.surface.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.surface.removeEventListener(type, listener);
  }

  getRootNode(): FakeEventSurface {
    return this.rootSurface;
  }
}

/** Renderer stand-in reporting a fixed viewport via getSize(). */
class FakeRenderer {
  zeroViewport = false;

  getSize(target: { x: number; y: number }): { x: number; y: number } {
    if (this.zeroViewport) {
      target.x = 0;
      target.y = 0;
    } else {
      target.x = 1600;
      target.y = 900;
    }
    return target;
  }
}

function asCanvas(fake: FakeCanvas): HTMLCanvasElement {
  return fake as unknown as HTMLCanvasElement;
}

function asRenderer(fake: FakeRenderer): THREE.WebGLRenderer {
  return fake as unknown as THREE.WebGLRenderer;
}

function makeRig() {
  const fakeCanvas = new FakeCanvas();
  const fakeRenderer = new FakeRenderer();
  const handle = createOrbitCamera(asRenderer(fakeRenderer), asCanvas(fakeCanvas));
  return { handle, fakeCanvas, fakeRenderer };
}

describe('createOrbitCamera', () => {
  it('returns the expected API shape wrapping an OrbitControls instance', () => {
    const { handle } = makeRig();

    expect(typeof handle.update).toBe('function');
    expect(typeof handle.setEnabled).toBe('function');
    expect(typeof handle.dispose).toBe('function');
    expect(handle.controls).toBeInstanceOf(OrbitControls);
    expect(handle.camera).toBeInstanceOf(THREE.PerspectiveCamera);

    handle.dispose();
  });

  it('seeds the camera aspect from the renderer viewport', () => {
    const { handle } = makeRig();
    expect(handle.camera.aspect).toBeCloseTo(1600 / 900, 6);
    handle.dispose();
  });

  it('enables damping inertia for smooth navigation', () => {
    const { handle } = makeRig();

    expect(handle.controls.enableDamping).toBe(true);
    expect(handle.controls.dampingFactor).toBe(DAMPING_FACTOR);
    expect(handle.controls.dampingFactor).toBeGreaterThan(0);
    expect(handle.controls.dampingFactor).toBeLessThan(1);

    handle.dispose();
  });

  it('configures ordered distance clamps that keep zoom inside the block scale', () => {
    const { handle } = makeRig();

    expect(handle.controls.minDistance).toBe(MIN_DISTANCE);
    expect(handle.controls.maxDistance).toBe(MAX_DISTANCE);
    expect(handle.controls.minDistance).toBeGreaterThan(0);
    expect(handle.controls.maxDistance).toBeGreaterThan(handle.controls.minDistance);

    handle.dispose();
  });

  it('clamps the polar angle so the camera can never dive under the ground', () => {
    const { handle } = makeRig();

    expect(handle.controls.minPolarAngle).toBeGreaterThanOrEqual(0);
    expect(handle.controls.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(handle.controls.maxPolarAngle).toBe(MAX_POLAR_ANGLE);

    // A camera parked below the ground plane is pulled back above the horizon
    // by the polar clamp on the next update.
    handle.camera.position.set(0, -40, 12);
    handle.update();

    expect(handle.camera.position.y).toBeGreaterThan(0);

    handle.dispose();
  });

  it('enforces the distance limits during update()', () => {
    const { handle } = makeRig();

    handle.camera.position.set(400, 300, 500); // far beyond MAX_DISTANCE
    handle.update();
    let distance = handle.camera.position.distanceTo(handle.controls.target);
    expect(distance).toBeLessThanOrEqual(MAX_DISTANCE + 1e-6);

    handle.camera.position.copy(handle.controls.target).x += 1; // inside MIN_DISTANCE
    handle.update();
    distance = handle.camera.position.distanceTo(handle.controls.target);
    expect(distance).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-6);

    handle.dispose();
  });

  it('keeps the pan target focused on the city block', () => {
    const { handle } = makeRig();

    expect(handle.controls.enablePan).toBe(true);
    expect(handle.controls.screenSpacePanning).toBe(false);

    handle.controls.target.set(PAN_LIMIT_X * 10, -50, -PAN_LIMIT_Z * 10);
    handle.update();

    expect(Math.abs(handle.controls.target.x)).toBeLessThanOrEqual(PAN_LIMIT_X);
    expect(Math.abs(handle.controls.target.z)).toBeLessThanOrEqual(PAN_LIMIT_Z);
    expect(handle.controls.target.y).toBeGreaterThanOrEqual(TARGET_MIN_Y);
    expect(handle.controls.target.y).toBeLessThanOrEqual(TARGET_MAX_Y);

    handle.dispose();
  });

  it('setEnabled toggles user input handling', () => {
    const { handle } = makeRig();

    expect(handle.controls.enabled).toBe(true);
    handle.setEnabled(false);
    expect(handle.controls.enabled).toBe(false);
    handle.setEnabled(true);
    expect(handle.controls.enabled).toBe(true);

    handle.dispose();
  });

  it('dispose detaches every DOM listener and stays idempotent', () => {
    const { handle, fakeCanvas } = makeRig();

    // Construction wired input listeners onto the canvas and its root node.
    expect(fakeCanvas.surface.count('pointerdown')).toBe(1);
    expect(fakeCanvas.surface.count('pointercancel')).toBe(1);
    expect(fakeCanvas.surface.count('contextmenu')).toBe(1);
    expect(fakeCanvas.surface.count('wheel')).toBe(1);
    expect(fakeCanvas.rootSurface.count('keydown')).toBe(1);
    expect(fakeCanvas.style.touchAction).toBe('none');

    handle.dispose();

    expect(fakeCanvas.surface.count('pointerdown')).toBe(0);
    expect(fakeCanvas.surface.count('pointercancel')).toBe(0);
    expect(fakeCanvas.surface.count('contextmenu')).toBe(0);
    expect(fakeCanvas.surface.count('wheel')).toBe(0);
    expect(fakeCanvas.rootSurface.count('keydown')).toBe(0);
    expect(fakeCanvas.style.touchAction).toBe('');

    // Post-dispose calls are safe no-ops; a second dispose must not throw.
    expect(() => {
      handle.update();
      handle.setEnabled(false);
      handle.dispose();
    }).not.toThrow();
  });
});
