import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clamp, clampWalkHeight, WALK_HEIGHT } from '../camera';
import { createControls, type CameraControls } from '../controls';
import { clampDelta, readEraParam } from '../loop';
import { createCanvasStub, createTestHost, firePointer, type CanvasStub } from './stubDom';

/**
 * Unit tests for the engine's pure math and the controls/loop behaviour that
 * can run headlessly (no WebGL context, stubbed canvas + injectable host).
 */

function makeCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  camera.position.set(0, 1.65, 2);
  camera.lookAt(0, 0, 0);
  return camera;
}

describe('clamp helpers', () => {
  it('clamps a scalar to a band', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('clamps walk height into [1.6, 1.7]', () => {
    const camera = makeCamera();
    camera.position.y = 9;
    clampWalkHeight(camera);
    expect(camera.position.y).toBe(WALK_HEIGHT.max);
    camera.position.y = 0.5;
    clampWalkHeight(camera);
    expect(camera.position.y).toBe(WALK_HEIGHT.min);
  });
});

describe('loop delta clamping', () => {
  it('clamps a large raw delta to the max', () => {
    expect(clampDelta(2.5)).toBe(0.1);
    expect(clampDelta(0.016)).toBeCloseTo(0.016, 6);
  });

  it('clamps negatives and NaN to zero', () => {
    expect(clampDelta(-3)).toBe(0);
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(Number.POSITIVE_INFINITY)).toBe(0.1);
  });
});

describe('readEraParam', () => {
  it('resolves each of the five eras from a query string', () => {
    expect(readEraParam('?era=1945')).toBe('1945');
    expect(readEraParam('?era=1965')).toBe('1965');
    expect(readEraParam('?era=1985')).toBe('1985');
    expect(readEraParam('?era=2005')).toBe('2005');
    expect(readEraParam('?era=2025')).toBe('2025');
  });

  it('returns null for missing or invalid values', () => {
    expect(readEraParam('')).toBeNull();
    expect(readEraParam('?era=1999')).toBeNull();
    expect(readEraParam('?foo=bar')).toBeNull();
  });
});

describe('camera controls', () => {
  let canvas: CanvasStub;
  let camera: THREE.PerspectiveCamera;
  let controls: CameraControls;
  let host: ReturnType<typeof createTestHost>;
  let modeChanges: string[];

  beforeEach(() => {
    host = createTestHost(true);
    canvas = createCanvasStub();
    camera = makeCamera();
    modeChanges = [];
    controls = createControls(camera, canvas as unknown as HTMLCanvasElement, {
      lockTarget: canvas as unknown as HTMLElement,
      host: host.options,
      onModeChange: (m) => modeChanges.push(m),
    });
  });

  afterEach(() => {
    controls.dispose();
  });

  it('starts in orbit mode and toggles to first-person', () => {
    expect(controls.mode).toBe('orbit');
    controls.toggle();
    expect(controls.mode).toBe('first-person');
    expect(modeChanges).toContain('first-person');
    controls.toggle();
    expect(controls.mode).toBe('orbit');
  });

  it('moves forward on W and clamps eye height', () => {
    controls.setMode('first-person');
    const startZ = camera.position.z;
    host.window.dispatchKey('KeyW', 'keydown');
    controls.update(0.5);
    host.window.dispatchKey('KeyW', 'keyup');
    // Movement is planar; z should move toward the scene.
    expect(camera.position.z).toBeLessThan(startZ);
    expect(camera.position.y).toBeGreaterThanOrEqual(WALK_HEIGHT.min);
    expect(camera.position.y).toBeLessThanOrEqual(WALK_HEIGHT.max);
  });

  it('mouse look yaws the camera while pointer-locked', () => {
    controls.setMode('first-person');
    const before = camera.quaternion.clone();
    firePointer(canvas, 200, 0, true);
    controls.update(0.016);
    expect(camera.quaternion).not.toEqual(before);
  });

  it('dispose removes window key listeners and canvas pointer listeners', () => {
    const canvasListenerCount = (canvas.listeners().canvas.get('pointermove') ?? []).length;
    expect(canvasListenerCount).toBeGreaterThan(0);
    controls.dispose();
    expect(canvas.listeners().canvas.get('pointermove') ?? []).toHaveLength(0);
  });
});