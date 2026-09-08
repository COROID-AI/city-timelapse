/**
 * Damped third-person chase camera.
 *
 * Owns the cinematic framing for the player car: the camera hangs behind and
 * above the target and eases toward that pose with frame-rate-independent
 * exponential damping, so it never jitters regardless of the rAF delta.
 *
 * Field of view follows the racing feel requested for the milestone:
 *   - a *speed* term widens the FOV as the car accelerates, selling velocity;
 *   - an extra *boost kick* (fed by the nitrous `getBoost()` callback) is
 *     interpolated in / out on top of the speed curve for the wide-angle
 *     speed-boost feel.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate(camera, config)` -> build the controller
 *   `update(target, dt)`          -> follow `target` by `dt` seconds
 *   `dispose()`                   -> release listeners / resources
 *
 * The pure math (FOV curve, damping step) is exported for direct jest testing;
 * this module is the thin three.js binding layer on top of it.
 */
import * as THREE from 'three';

import type { CarState } from '../shared/types';

/** Lookup target consumed by `update`; follows the read-only CarState shape. */
export type ChaseTarget = Pick<CarState, 'position' | 'yaw' | 'speed'>;

/** Tuning for the chase camera's pose and FOV. */
export interface ChaseCameraConfig {
  /** Damped follow distance behind the car, in world units. */
  readonly distance: number;
  /** Camera height above the track, in world units. */
  readonly height: number;
  /** Look-ahead distance along the car's heading (keeps the road in frame). */
  readonly lookAhead: number;
  /** Position follow smoothing rate in 1/seconds (higher = stiffer). */
  readonly positionLerp: number;
  /** Look-at smoothing rate in 1/seconds. */
  readonly lookLerp: number;
  /** Base field of view in degrees. */
  readonly baseFov: number;
  /** Range of FOV (degrees) added at `fovSpeedMax`. */
  readonly fovSpeedRange: number;
  /** Speed (units/s) at which the speed FOV term saturates. */
  readonly fovSpeedMax: number;
  /** Range of extra FOV (degrees) added during a full boost. */
  readonly fovBoostRange: number;
  /** FOV smoothing rate in 1/seconds (frame-rate-independent). */
  readonly fovLerp: number;
  /** Returns current nitrous boost intensity in [0, 1] (0 = no boost). */
  readonly getBoost: () => number;
}

/** Default chase camera/profile tuned to the player car's feel. */
export const defaultChaseCameraConfig: Readonly<ChaseCameraConfig> = {
  distance: 8.2,
  height: 3.4,
  lookAhead: 3.4,
  positionLerp: 4.5,
  lookLerp: 9.0,
  baseFov: 60,
  fovSpeedRange: 14,
  fovSpeedMax: 55,
  fovBoostRange: 11,
  fovLerp: 10,
  getBoost: () => 0,
};

/** Clamp `value` into the inclusive range `[min, max]`. */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Frame-rate-independent exponential damping step toward `target`.
 *
 * `rate` is in 1/seconds and the response `alpha = 1 - exp(-rate * dt)`
 * converges to the same trajectory regardless of the frame's `dt`, so the
 * damped values are stable across frame rates (no jitter / no slow-motion
 * dependence on the refresh rate).
 */
export function dampValue(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  const alpha = 1 - Math.exp(-rate * Math.max(0, dt));
  return current + (target - current) * alpha;
}

/**
 * Pure FOV target for a given speed and boost intensity.
 *
 * `speedT` is the fraction toward `fovSpeedMax`; `boostT` is a normalized
 * [0, 1] boost intensity. Two stacked sigmoid-free ramps give the racing
 * wide-angle: base + speed ramp + boost kick.
 */
export function computeFov(
  speed: number,
  boostIntensity: number,
  config: Readonly<Pick<
    ChaseCameraConfig,
    'baseFov' | 'fovSpeedRange' | 'fovSpeedMax' | 'fovBoostRange'
  >>,
): number {
  const speedT = clamp01(config.fovSpeedMax > 0 ? speed / config.fovSpeedMax : 0);
  const boostT = clamp01(boostIntensity);
  return config.baseFov + config.fovSpeedRange * speedT + config.fovBoostRange * boostT;
}

/** A live chase camera controller bound to a PerspectiveCamera. */
export interface ChaseCamera {
  /** The camera this controller drives (the caller's camera). */
  readonly camera: THREE.PerspectiveCamera;
  /** Follow `target` by `dt` seconds (damped pose + FOV update). */
  update(target: ChaseTarget, dt: number): void;
  /** Snap instantly to the target's current pose/FOV (spawn / reset). */
  reset(target?: ChaseTarget): void;
  /** Current smoothed field of view in degrees. */
  getFov(): number;
  /** Current smoothed desired (boost-inclusive) FOV target in degrees. */
  getTargetFov(): number;
  /** Release owned resources. */
  dispose(): void;
}

/** Build a damped chase camera bound to `camera`. */
export function createChaseCamera(
  camera: THREE.PerspectiveCamera,
  config: Partial<ChaseCameraConfig> = {},
): ChaseCamera {
  const cfg: Readonly<ChaseCameraConfig> = {
    ...defaultChaseCameraConfig,
    ...config,
  };

  // Smoothed controller state.
  let posX = camera.position.x;
  let posY = camera.position.y;
  let posZ = camera.position.z;
  let lookX = 0;
  let lookY = 1;
  let lookZ = 0;
  let fov = cfg.baseFov;
  // Interpolated boost kick: rises/falls smoothly so the wide-angle punch
  // feels like a boost surge and not a hard FOV pop.
  let boost = 0;

  const reset = (target?: ChaseTarget): void => {
    if (target) {
      const fx = Math.sin(target.yaw);
      const fz = Math.cos(target.yaw);
      posX = target.position[0] - fx * cfg.distance;
      posY = target.position[1] + cfg.height;
      posZ = target.position[2] - fz * cfg.distance;
      lookX = target.position[0] + fx * cfg.lookAhead;
      lookY = target.position[1] + 1;
      lookZ = target.position[2] + fz * cfg.lookAhead;
      boost = clamp01(cfg.getBoost());
      const targetFov = computeFov(target.speed, boost, cfg);
      fov = targetFov;
      camera.position.set(posX, posY, posZ);
      camera.fov = fov;
      camera.lookAt(lookX, lookY, lookZ);
      camera.updateProjectionMatrix();
      return;
    }
    // No target: just re-target the current fov and look dir.
    camera.fov = fov;
    camera.lookAt(lookX, lookY, lookZ);
    camera.updateProjectionMatrix();
  };

  const update = (target: ChaseTarget, dt: number): void => {
    // 1) Interpolate the boost kick so FOV ramps in/out smoothly.
    const desiredBoost = clamp01(cfg.getBoost());
    boost = dampValue(boost, desiredBoost, cfg.fovLerp, dt);

    // 2) Smoke-tested FOV from pure curve (boost included), then smooth.
    const desiredFov = computeFov(target.speed, boost, cfg);
    fov = dampValue(fov, desiredFov, cfg.fovLerp, dt);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // 3) Desired follow pose: behind & above the car, facing up-track.
    const fx = Math.sin(target.yaw);
    const fz = Math.cos(target.yaw);
    const dx = target.position[0] - fx * cfg.distance;
    const dy = target.position[1] + cfg.height;
    const dz = target.position[2] - fz * cfg.distance;

    // 4) Damped position follow (frame-rate independent).
    posX = dampValue(posX, dx, cfg.positionLerp, dt);
    posY = dampValue(posY, dy, cfg.positionLerp, dt);
    posZ = dampValue(posZ, dz, cfg.positionLerp, dt);
    camera.position.set(posX, posY, posZ);

    // 5) Damped look-at ahead of the car.
    const ax = target.position[0] + fx * cfg.lookAhead;
    const ay = target.position[1] + 1;
    const az = target.position[2] + fz * cfg.lookAhead;
    lookX = dampValue(lookX, ax, cfg.lookLerp, dt);
    lookY = dampValue(lookY, ay, cfg.lookLerp, dt);
    lookZ = dampValue(lookZ, az, cfg.lookLerp, dt);
    camera.lookAt(lookX, lookY, lookZ);
  };

  const dispose = (): void => {
    // The controller owns no GPU resources or listeners; nothing to release.
  };

  return {
    camera,
    update,
    reset,
    getFov: () => fov,
    getTargetFov: () => computeFov(0, boost, cfg),
    dispose,
  };
}