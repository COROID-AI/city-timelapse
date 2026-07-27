/**
 * Tests for the CameraPresets module — animated camera viewpoint transitions.
 *
 * Verifies that all three presets (overview, street-level, rooftop) are defined
 * with valid positions, that the controller tweens the camera over time, and
 * that cancel/reset behavior is correct.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  CAMERA_PRESET_KEYS,
  CAMERA_PRESETS,
  CAMERA_PRESET_LABELS,
  createCameraPresetController,
} from '../CameraPresets.js';
import { NAV_BOUNDS } from '../../constants.js';

/** Minimal OrbitControls mock exposing only the fields the controller touches. */
function mockControls(targetX = 0, targetY = 8, targetZ = 0) {
  const target = new Vector3(targetX, targetY, targetZ);
  return {
    target,
    update: () => {},
  };
}

describe('CameraPresets — definitions', () => {
  it('exposes exactly three preset keys', () => {
    expect(CAMERA_PRESET_KEYS).toHaveLength(3);
    expect([...CAMERA_PRESET_KEYS].sort()).toEqual([
      'overview',
      'rooftop',
      'street-level',
    ]);
  });

  it('has labels for every preset', () => {
    for (const key of CAMERA_PRESET_KEYS) {
      expect(CAMERA_PRESET_LABELS[key]).toBeTruthy();
      expect(typeof CAMERA_PRESET_LABELS[key]).toBe('string');
    }
  });

  it('defines a position and target for every preset', () => {
    for (const key of CAMERA_PRESET_KEYS) {
      const def = CAMERA_PRESETS[key];
      expect(def.position).toBeInstanceOf(Vector3);
      expect(def.target).toBeInstanceOf(Vector3);
      // Target must be within navigation bounds.
      expect(def.target.x).toBeGreaterThanOrEqual(NAV_BOUNDS.minTarget.x);
      expect(def.target.x).toBeLessThanOrEqual(NAV_BOUNDS.maxTarget.x);
    }
  });

  it('positions are distinct from each other', () => {
    const positions = CAMERA_PRESET_KEYS.map((k) => CAMERA_PRESETS[k].position);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(positions[i].distanceTo(positions[j])).toBeGreaterThan(5);
      }
    }
  });
});

describe('CameraPresetController — tween behavior', () => {
  function setup() {
    const camera = new PerspectiveCamera(55, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    const controls = mockControls();
    const ctrl = createCameraPresetController(camera, controls as never);
    return { camera, controls, ctrl };
  }

  it('starts idle (not animating)', () => {
    const { ctrl } = setup();
    expect(ctrl.isAnimating()).toBe(false);
  });

  it('begins animating after applyPreset', () => {
    const { ctrl } = setup();
    ctrl.applyPreset('overview');
    expect(ctrl.isAnimating()).toBe(true);
  });

  it('completes the tween after the duration', () => {
    const { camera, ctrl } = setup();
    ctrl.applyPreset('overview');
    // Advance well past the default 1200ms duration.
    ctrl.update(2000);
    expect(ctrl.isAnimating()).toBe(false);
    // Camera should be at or very near the preset position.
    const expected = CAMERA_PRESETS.overview.position;
    expect(camera.position.distanceTo(expected)).toBeLessThan(0.5);
  });

  it('cancel stops the tween immediately', () => {
    const { ctrl } = setup();
    ctrl.applyPreset('street-level');
    expect(ctrl.isAnimating()).toBe(true);
    ctrl.cancel();
    expect(ctrl.isAnimating()).toBe(false);
  });

  it('interpolates the camera position over time', () => {
    const { camera, ctrl } = setup();
    const startPos = camera.position.clone();
    ctrl.applyPreset('rooftop');
    // Advance a fraction of the duration.
    ctrl.update(300);
    // Camera should have moved but not yet arrived.
    expect(ctrl.isAnimating()).toBe(true);
    const movedDist = camera.position.distanceTo(startPos);
    expect(movedDist).toBeGreaterThan(0);
    const remainingDist = camera.position.distanceTo(CAMERA_PRESETS.rooftop.position);
    expect(remainingDist).toBeGreaterThan(0.5);
  });

  it('clamps the orbit target within navigation bounds during tween', () => {
    const { controls, ctrl } = setup();
    ctrl.applyPreset('street-level');
    ctrl.update(600);
    expect(controls.target.x).toBeGreaterThanOrEqual(NAV_BOUNDS.minTarget.x);
    expect(controls.target.x).toBeLessThanOrEqual(NAV_BOUNDS.maxTarget.x);
    expect(controls.target.y).toBeGreaterThanOrEqual(NAV_BOUNDS.minTarget.y);
    expect(controls.target.y).toBeLessThanOrEqual(NAV_BOUNDS.maxTarget.y);
  });
});
