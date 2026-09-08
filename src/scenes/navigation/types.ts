/**
 * Camera & navigation rig contracts.
 *
 * The rig owns a single orbit-style camera: the camera circles a ground-plane
 * `target`, at an elevation `pitch` and radial `distance`. User input (rotate /
 * zoom / pan) drives velocity impulses that `update` integrates and damps, so
 * the camera glides to rest instead of snapping. Named focus points (consumed
 * read-only from the layout module) lerp the camera to building vantages and
 * the block overview.
 *
 * Everything here is pure scene math — no rendering dependency — so the rig is
 * trivially testable and can drive any renderer (Three.js, React Three Fiber,
 * or a headless test harness).
 */

import type { CameraFocusPoint } from '../layout/types.js';

/** A point in 3D scene space. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The full observable camera pose. `position` is derived from the orbit
 * parameters and is what a renderer consumes to place/orient the camera.
 */
export interface CameraState {
  /** Camera position in 3D scene space (meters). */
  position: Vec3;
  /** Ground-plane point the camera orbits around / looks at. */
  target: { x: number; z: number };
  /** Azimuth around the target, radians. */
  yaw: number;
  /** Elevation above the ground plane, radians (clamped). */
  pitch: number;
  /** Radial distance from the target to the camera, meters (clamped). */
  distance: number;
}

/** Tunable behaviour of the rig. Every field is optional with a sane default. */
export interface NavigationRigOptions {
  /** Exponential velocity decay per second (higher = quicker rest), default 6. */
  damping?: number;
  /** Radians of yaw/pitch per input unit per second, default 0.01. */
  rotateSensitivity?: number;
  /** Zoom velocity (fraction of distance per second) per wheel tick, default 0.5. */
  zoomSensitivity?: number;
  /** Ground-plane pan (meters per second) per input unit, default 0.02. */
  panSensitivity?: number;
  /** Minimum pitch in radians (never look straight down), default 0.05. */
  pitchMin?: number;
  /** Maximum pitch in radians (avoid grazing the horizon), default 1.45. */
  pitchMax?: number;
  /** Minimum orbit distance in meters, default 4. */
  distanceMin?: number;
  /** Maximum orbit distance in meters, default 120. */
  distanceMax?: number;
  /** Seconds for a focus-point lerp, default 1.0. */
  focusDuration?: number;
}

/**
 * Read-only view of the layout focus points the rig consumes. The rig never
 * mutates these — it only reads `cameraFocusPoints` to resolve named vantages.
 */
export interface FocusPointSource {
  readonly cameraFocusPoints: readonly CameraFocusPoint[];
}