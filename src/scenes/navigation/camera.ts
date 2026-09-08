/**
 * Pure camera math for the navigation rig.
 *
 * These functions are side-effect free so they can be unit-tested in isolation
 * and reused by any renderer. Pose construction and orbit updates live here;
 * the `NavigationRig` class in `./rig.ts` wires them to user input and time.
 */

import type { CameraState, NavigationRigOptions, Vec3 } from './types.js';

/** Merge user options over the defaults. */
export function resolveOptions(
  options?: NavigationRigOptions,
): Required<NavigationRigOptions> {
  return {
    damping: options?.damping ?? 6,
    rotateSensitivity: options?.rotateSensitivity ?? 0.01,
    zoomSensitivity: options?.zoomSensitivity ?? 0.5,
    panSensitivity: options?.panSensitivity ?? 0.02,
    pitchMin: options?.pitchMin ?? 0.05,
    pitchMax: options?.pitchMax ?? 1.45,
    distanceMin: options?.distanceMin ?? 4,
    distanceMax: options?.distanceMax ?? 120,
    focusDuration: options?.focusDuration ?? 1.0,
  };
}

/** Clamp `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear interpolation from `a` to `b` by `t` (t clamped to [0,1]). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Build a camera state from orbit parameters. The camera sits at
 * `distance` from `target` on the ground plane, elevated by `pitch`, and
 * positioned at azimuth `yaw` around the target.
 */
export function makeCameraState(
  target: { x: number; z: number },
  yaw: number,
  pitch: number,
  distance: number,
): CameraState {
  const horizontal = distance * Math.cos(pitch);
  const position: Vec3 = {
    x: target.x + horizontal * Math.cos(yaw),
    y: distance * Math.sin(pitch),
    z: target.z + horizontal * Math.sin(yaw),
  };
  return {
    position,
    target: { x: target.x, z: target.z },
    yaw,
    pitch,
    distance,
  };
}

/**
 * Recover orbit parameters from a camera position looking at `target`.
 * Useful to seed the rig from an existing camera (e.g. a renderer) without
 * resetting the user's viewport.
 */
export function poseFromPosition(
  position: Vec3,
  target: { x: number; z: number },
): { target: { x: number; z: number }; yaw: number; pitch: number; distance: number } {
  const dx = position.x - target.x;
  const dz = position.z - target.z;
  const horizontal = Math.hypot(dx, dz);
  const distance = Math.hypot(horizontal, position.y);
  const yaw = Math.atan2(dz, dx);
  const pitch = Math.atan2(position.y, horizontal);
  return { target: { x: target.x, z: target.z }, yaw, pitch, distance };
}

/** The current orbit velocities, in the same units as the orbit parameters. */
export interface OrbitVelocity {
  /** Ground-plane pan velocity (meters/sec). */
  target: { x: number; z: number };
  /** Azimuth velocity (radians/sec). */
  yaw: number;
  /** Elevation velocity (radians/sec). */
  pitch: number;
  /** Radial zoom velocity (meters/sec). */
  distance: number;
}

/** A zero velocity vector. */
export function zeroVelocity(): OrbitVelocity {
  return { target: { x: 0, z: 0 }, yaw: 0, pitch: 0, distance: 0 };
}

/**
 * Advance the camera by `dt` seconds, applying the current velocities and
 * damping them toward zero. Pitch and distance are clamped each frame. Returns
 * the next state and the damped velocity for the following frame. Neither
 * input is mutated.
 */
export function stepCamera(
  state: CameraState,
  velocity: OrbitVelocity,
  dt: number,
  options: Required<NavigationRigOptions>,
): { state: CameraState; velocity: OrbitVelocity } {
  // Cap the frame so a long pause cannot teleport the camera.
  const frame = Math.min(dt, 1 / 30);
  const damp = Math.exp(-options.damping * frame);

  const target = {
    x: state.target.x + velocity.target.x * frame,
    z: state.target.z + velocity.target.z * frame,
  };
  const yaw = state.yaw + velocity.yaw * frame;
  const pitch = clamp(
    state.pitch + velocity.pitch * frame,
    options.pitchMin,
    options.pitchMax,
  );
  const distance = clamp(
    state.distance + velocity.distance * frame,
    options.distanceMin,
    options.distanceMax,
  );

  return {
    state: makeCameraState(target, yaw, pitch, distance),
    velocity: {
      target: { x: velocity.target.x * damp, z: velocity.target.z * damp },
      yaw: velocity.yaw * damp,
      pitch: velocity.pitch * damp,
      distance: velocity.distance * damp,
    },
  };
}