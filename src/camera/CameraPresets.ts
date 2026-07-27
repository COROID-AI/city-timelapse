/**
 * Camera presets — animated transitions to named viewpoints.
 *
 * Provides three framing presets that smoothly tween the OrbitControls camera
 * (position + target) over a fixed duration with ease-in/ease-out:
 *   - `overview`     — wide aerial shot of the entire block
 *   - `street-level` — low-angle view from the sidewalk
 *   - `rooftop`      — elevated perch above the tallest buildings
 *
 * Presets are clamped to the navigation bounds so the camera never leaves the
 * legal framing volume. During a tween, OrbitControls auto-rotation is disabled
 * and the tweening system owns the camera position/target; user interaction
 * cancels the active tween (so dragging during a preset jump is graceful).
 */

import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NAV_BOUNDS } from '../constants.js';

/** Named camera viewpoint presets selectable from the HUD. */
export type CameraPresetKey = 'overview' | 'street-level' | 'rooftop';

/** Ordered list of preset keys, for UI generation. */
export const CAMERA_PRESET_KEYS: readonly CameraPresetKey[] = [
  'overview',
  'street-level',
  'rooftop',
];

/** Human-readable labels for each preset. */
export const CAMERA_PRESET_LABELS: Record<CameraPresetKey, string> = {
  overview: 'Overview',
  'street-level': 'Street',
  rooftop: 'Rooftop',
};

/** Description shown as a tooltip / aria-label. */
export const CAMERA_PRESET_DESCRIPTIONS: Record<CameraPresetKey, string> = {
  overview: 'Aerial overview of the entire city block',
  'street-level': 'Sidewalk-level view from the street',
  rooftop: 'Elevated perch above the tallest buildings',
};

interface PresetDefinition {
  /** Desired camera world position. */
  position: Vector3;
  /** Desired orbit target (look-at point). */
  target: Vector3;
}

/**
 * The three preset definitions. Positions are tuned to the block footprint
 * (BLOCK_SIZE = 50) and the era-tallest building heights (~110 for 2055).
 */
export const CAMERA_PRESETS: Record<CameraPresetKey, PresetDefinition> = {
  overview: {
    position: new Vector3(60, 52, 70),
    target: new Vector3(0, 6, 0),
  },
  'street-level': {
    position: new Vector3(24, 4, 28),
    target: new Vector3(0, 5, 0),
  },
  rooftop: {
    position: new Vector3(40, 75, 40),
    target: new Vector3(0, 20, 0),
  },
};

/** Default tween duration in milliseconds. */
const DEFAULT_DURATION_MS = 1200;

/** Smoothstep easing: `t*t*(3 - 2t)`. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Clamp a target Vector3 into the navigation bounds. */
function clampTarget(target: Vector3): void {
  target.clamp(NAV_BOUNDS.minTarget, NAV_BOUNDS.maxTarget);
}

/** Clamp the camera distance to [minDistance, maxDistance] from the target. */
function clampDistance(camera: PerspectiveCamera, target: Vector3): void {
  const dist = camera.position.distanceTo(target);
  if (dist < NAV_BOUNDS.minDistance) {
    const dir = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).add(dir.multiplyScalar(NAV_BOUNDS.minDistance));
  } else if (dist > NAV_BOUNDS.maxDistance) {
    const dir = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).add(dir.multiplyScalar(NAV_BOUNDS.maxDistance));
  }
}

export interface CameraPresetControllerOptions {
  /** Tween duration in ms. Defaults to {@link DEFAULT_DURATION_MS}. */
  durationMs?: number;
}

export interface CameraPresetController {
  /** Smoothly move the camera to the named preset. Cancels any active tween. */
  applyPreset: (preset: CameraPresetKey) => void;
  /** Advance the active tween by `deltaMs`. No-op if idle. */
  update: (deltaMs: number) => void;
  /** Whether a preset tween is currently animating. */
  isAnimating: () => boolean;
  /** Cancel the active tween (e.g. when the user grabs the camera). */
  cancel: () => void;
}

/**
 * Create a camera preset controller bound to the given camera + controls.
 *
 * Call `update(deltaMs)` every frame from the render loop (after
 * `controls.update()`). If the user interacts with the controls while a tween
 * is running, call `cancel()` to release control back to the user.
 */
export function createCameraPresetController(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  options: CameraPresetControllerOptions = {},
): CameraPresetController {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;

  let fromPos = new Vector3();
  let fromTarget = new Vector3();
  let toPos = new Vector3();
  let toTarget = new Vector3();
  let progress = 1; // 1 = idle (no active tween)

  function applyPreset(preset: CameraPresetKey): void {
    const def = CAMERA_PRESETS[preset];
    fromPos.copy(camera.position);
    fromTarget.copy(controls.target);
    toPos.copy(def.position);
    toTarget.copy(def.target);
    // Clamp destination to navigation bounds.
    clampTarget(toTarget);
    clampDistance(camera, toTarget);
    progress = 0;
  }

  function update(deltaMs: number): void {
    if (progress >= 1) {
      return;
    }
    progress += deltaMs / durationMs;
    if (progress >= 1) {
      progress = 1;
    }
    const eased = smoothstep(progress);
    camera.position.lerpVectors(fromPos, toPos, eased);
    controls.target.lerpVectors(fromTarget, toTarget, eased);
    // Keep the orbit target in bounds every frame.
    clampTarget(controls.target);
    controls.update();
  }

  function isAnimating(): boolean {
    return progress < 1;
  }

  function cancel(): void {
    progress = 1;
  }

  return { applyPreset, update, isAnimating, cancel };
}
