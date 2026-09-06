import * as THREE from 'three';

import { CAMERA_ANCHORS } from '../layout';
import type { EraId } from '../types';

/**
 * Camera creation and framing. Builds a single perspective camera that is
 * shared by both navigation modes (orbit and first-person) and positioned from
 * the frozen `CAMERA_ANCHORS` for the active era.
 */

/** First-person eye height clamp (meters). */
export const WALK_HEIGHT = Object.freeze({ min: 1.6, max: 1.7 }) as Readonly<{
  min: number;
  max: number;
}>;

/** Vertical field of view in degrees. */
export const CAMERA_FOV = 55;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 2000;

/** Perspective camera shared by orbit and first-person modes. */
export type GameCamera = THREE.PerspectiveCamera;

/**
 * Create the shared perspective camera. Aspect is 1 until the first resize
 * call from the engine loop.
 */
export function createCamera(): GameCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 1.65, 2);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** Maintain a 16:9 default in case the host reports a zero-sized frame. */
const FALLBACK_ASPECT = 16 / 9;

/**
 * Update the camera aspect and projection for a new frame size. Returns the
 * computed aspect ratio (never NaN) so callers can mirror it elsewhere.
 */
export function resizeCamera(camera: GameCamera, width: number, height: number): number {
  const safeHeight = height > 0 ? height : 1;
  const aspect = width > 0 && safeHeight > 0 ? width / safeHeight : FALLBACK_ASPECT;
  if (camera.aspect !== aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  return aspect;
}

/**
 * Apply a camera anchor (position + look-at) for the given era. The anchor is
 * guaranteed to exist because `CAMERA_ANCHORS` is frozen with one entry per
 * era id.
 */
export function frameEra(camera: GameCamera, era: EraId): void {
  const anchor = CAMERA_ANCHORS.find((a) => a.id === era);
  if (!anchor) {
    // Unreachable: anchors are frozen with an entry per era. Guard against
    // future drift without allocating a new vector here.
    camera.position.set(0, 42, 96);
    camera.lookAt(0, 0, 0);
    return;
  }
  camera.position.copy(anchor.position);
  camera.lookAt(anchor.lookAt);
}

/** Clamp a scalar into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp the camera's eye height into the walking band [1.6, 1.7]. Applied each
 * frame after first-person movement so the view never dips below the sidewalk
 * or floats above walking height.
 */
export function clampWalkHeight(camera: GameCamera): void {
  camera.position.y = clamp(camera.position.y, WALK_HEIGHT.min, WALK_HEIGHT.max);
}