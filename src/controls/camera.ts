/**
 * Orbit-style camera navigation for the city-block scene.
 *
 * Wraps three.js built-in {@link OrbitControls} around the foundation
 * renderer's viewport and canvas. The factory owns the perspective camera,
 * configures smooth damping inertia plus distance/polar-angle/pan clamps so
 * users can orbit the block from street level or above without clipping
 * through buildings or diving under the ground plane, and exposes a minimal
 * frame-loop-friendly API (`update` / `setEnabled` / `dispose`).
 *
 * All motion comes from OrbitControls itself; this module only configures the
 * controls and clamps the orbit target back into the city-block bounds after
 * each update (no custom camera math).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Closest allowed zoom: tight enough for street-level inspection of facades. */
export const MIN_DISTANCE = 8;

/** Farthest allowed zoom: keeps the whole block framed inside the fog range. */
export const MAX_DISTANCE = 150;

/** Slightly off straight-down so azimuth stays well-defined at top-down views. */
export const MIN_POLAR_ANGLE = 0.08;

/**
 * Keeps the camera strictly above the horizon relative to the orbit target.
 * With `target.y >= TARGET_MIN_Y`, the camera height stays
 * `target.y + distance * cos(maxPolarAngle) > 0`, so it never sinks under the
 * ground plane even at maximum zoom-out.
 */
export const MAX_POLAR_ANGLE = Math.PI * 0.495;

/** Half-extent of the pannable area around the city block (world units). */
export const PAN_LIMIT_X = 80;
export const PAN_LIMIT_Z = 80;

/** Vertical band for the look-at target: above the road, below rooftop lines. */
export const TARGET_MIN_Y = 0.75;
export const TARGET_MAX_Y = 26;

/** Damping inertia factor (per-frame convergence toward user input). */
export const DAMPING_FACTOR = 0.08;

/** Default framing used when neither renderer nor canvas report a size yet. */
const FALLBACK_ASPECT = 16 / 9;

/** Initial camera placement: elevated three-quarter street view of the block. */
const INITIAL_CAMERA_POSITION = Object.freeze(new THREE.Vector3(30, 18, 36));

/** Initial orbit pivot: mid-height over the center of the block. */
const INITIAL_TARGET = Object.freeze(new THREE.Vector3(0, 2, 0));

/** Public handle returned by {@link createOrbitCamera}. */
export interface OrbitCameraHandle {
  /** The configured OrbitControls instance driving the camera. */
  readonly controls: OrbitControls;
  /** The perspective camera created and managed by the factory. */
  readonly camera: THREE.PerspectiveCamera;
  /**
   * Advances damping inertia and re-applies pan limits. Call once per frame;
   * required whenever damping is enabled.
   */
  update(deltaTimeSeconds?: number): void;
  /** Enables or disables all user input handling on the controls. */
  setEnabled(enabled: boolean): void;
  /** Detaches every DOM listener owned by the controls. Idempotent. */
  dispose(): void;
}

function resolveInitialAspect(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
): number {
  const viewport = new THREE.Vector2();
  renderer.getSize(viewport);

  let width = viewport.x;
  let height = viewport.y;
  if (!(width > 0) || !(height > 0)) {
    width = canvas.clientWidth || canvas.width;
    height = canvas.clientHeight || canvas.height;
  }
  if (!(width > 0) || !(height > 0)) {
    return FALLBACK_ASPECT;
  }
  return width / height;
}

/** Keeps the orbit pivot locked onto the city block after any pan gesture. */
function clampPanTarget(controls: OrbitControls): void {
  const target = controls.target;
  target.x = THREE.MathUtils.clamp(target.x, -PAN_LIMIT_X, PAN_LIMIT_X);
  target.z = THREE.MathUtils.clamp(target.z, -PAN_LIMIT_Z, PAN_LIMIT_Z);
  target.y = THREE.MathUtils.clamp(target.y, TARGET_MIN_Y, TARGET_MAX_Y);
}

/**
 * Creates the orbit-camera rig for the scene.
 *
 * @param renderer Foundation renderer; consulted for the initial viewport size.
 * @param canvas Canvas that receives pointer/wheel/context-menu input.
 */
export function createOrbitCamera(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
): OrbitCameraHandle {
  const camera = new THREE.PerspectiveCamera(
    55,
    resolveInitialAspect(renderer, canvas),
    0.1,
    600,
  );
  camera.position.copy(INITIAL_CAMERA_POSITION);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(INITIAL_TARGET);

  // Smooth inertial navigation: every frame eases toward the latest input.
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING_FACTOR;

  // Zoom limits keep users between street-level detail and a full-block view.
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;

  // Polar clamp keeps the viewpoint above the ground plane; the small lower
  // bound avoids gimbal flip at exact top-down angles.
  controls.minPolarAngle = MIN_POLAR_ANGLE;
  controls.maxPolarAngle = MAX_POLAR_ANGLE;

  // Street-grid style navigation: pans glide across the ground plane instead
  // of tilting the world, and stay confined around the city block.
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  clampPanTarget(controls);

  let disposed = false;

  return {
    controls,
    camera,
    update(deltaTimeSeconds?: number) {
      if (disposed) return;
      if (typeof deltaTimeSeconds === 'number') {
        controls.update(deltaTimeSeconds);
      } else {
        controls.update();
      }
      clampPanTarget(controls);
    },
    setEnabled(enabled: boolean) {
      if (disposed) return;
      controls.enabled = enabled;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.dispose();
    },
  };
}
