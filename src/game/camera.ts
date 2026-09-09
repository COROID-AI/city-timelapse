import * as THREE from 'three';

import type { CameraRig, CarState } from './contracts';

/**
 * Third-person chase camera rig.
 *
 * The rig binds a THREE.PerspectiveCamera behind and above the player's car,
 * then per `update(dt, carState)`:
 *
 *  - damped/lerped follow position toward the ideal seat (behind the car,
 *    pulled back by the speed-scaled follow distance),
 *  - look-ahead toward the car heading (a gaze point ahead of the car),
 *  - a mild baseline FOV widen as speed rises,
 *  - a subtle camera roll proportional to `driftFactor`, applied around the
 *    view axis after the camera has been aimed.
 *
 * The smoothing is frame-rate independent exponential damping
 * (`k = 1 - exp(-rate * dt)`), so every component converges monotonically:
 * no overshoot, and a fixed car speed produces a fixed camera offset — no
 * jitter at constant speed.
 *
 * The handle implements the shared `CameraRig` contract (mode/distance/
 * height/pitch, all current live values) and additionally exposes the
 * underlying THREE camera plus the current baseline `fov`, so the effects
 * pipeline can apply the nitrous wide-angle boost by writing
 * `rig.camera.fov` on top of `rig.fov` each frame (the next `update` resets
 * the baseline).
 */

/** Tuning knobs for the chase-camera framing. */
export interface ChaseCameraOptions {
  /** Follow distance at standstill (meters). Default 7.5. */
  minDistance?: number;
  /** Follow distance at `maxSpeed` (meters). Default 13. */
  maxDistance?: number;
  /** Camera height above the car (meters). Default 3.2. */
  height?: number;
  /** Speed at which distance/FOV scaling saturates (m/s). Default 60. */
  maxSpeed?: number;
  /** Baseline vertical FOV at standstill (degrees). Default 62. */
  minFov?: number;
  /** Baseline vertical FOV at `maxSpeed` (degrees). Default 74. */
  maxFov?: number;
  /** Look-ahead distance along the car heading (meters). Default 4. */
  lookAhead?: number;
  /** Height of the gaze point above the ground (meters). Default 0.9. */
  lookHeight?: number;
  /** Follow-position / gaze smoothing rate (1/s). Default 5. */
  followRate?: number;
  /** Baseline FOV smoothing rate (1/s). Default 4. */
  fovRate?: number;
  /** Roll smoothing rate (1/s). Default 6. */
  rollRate?: number;
  /** Camera roll at driftFactor = 1 (radians). Default 0.05. */
  maxRoll?: number;
}

/** Handle produced by `createChaseCamera` — a follow-mode `CameraRig`. */
export interface ChaseCameraHandle extends CameraRig {
  /** The underlying Three.js perspective camera (modulate `fov` on top). */
  readonly camera: THREE.PerspectiveCamera;
  /** Current baseline vertical FOV in degrees (speed-scaled). */
  readonly fov: number;
  /** Current smoothed roll in radians, applied to the underlying camera. */
  readonly roll: number;
  /** Advance the rig one step toward `carState`. */
  update: (deltaSeconds: number, carState: CarState) => void;
  /** Detach the rig: makes `update` a no-op; callable repeatedly. */
  dispose: () => void;
}

/** Factory defaults; every field is overridable per-rig. */
const DEFAULT_OPTIONS: Readonly<Required<ChaseCameraOptions>> = {
  minDistance: 7.5,
  maxDistance: 13,
  height: 3.2,
  maxSpeed: 60,
  minFov: 62,
  maxFov: 74,
  lookAhead: 4,
  lookHeight: 0.9,
  followRate: 5,
  fovRate: 4,
  rollRate: 6,
  maxRoll: 0.05,
};

/** Upper clamp for a single update delta, in seconds. */
const MAX_DT_SECONDS = 0.25;

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Create the third-person chase camera rig.
 *
 * The returned handle is a `CameraRig` in `mode === 'follow'` whose
 * `distance`/`height`/`pitch` fields describe the live framing. The first
 * `update` seats the camera immediately at the ideal follow pose (no
 * startup swing); later updates damp the follow with exponential smoothing.
 *
 * @param options  Framing tuning; defaults apply for any omitted field.
 */
export function createChaseCamera(
  options: ChaseCameraOptions = {},
): ChaseCameraHandle {
  const opts: Required<ChaseCameraOptions> = {
    minDistance: options.minDistance ?? DEFAULT_OPTIONS.minDistance,
    maxDistance: options.maxDistance ?? DEFAULT_OPTIONS.maxDistance,
    height: options.height ?? DEFAULT_OPTIONS.height,
    maxSpeed: options.maxSpeed ?? DEFAULT_OPTIONS.maxSpeed,
    minFov: options.minFov ?? DEFAULT_OPTIONS.minFov,
    maxFov: options.maxFov ?? DEFAULT_OPTIONS.maxFov,
    lookAhead: options.lookAhead ?? DEFAULT_OPTIONS.lookAhead,
    lookHeight: options.lookHeight ?? DEFAULT_OPTIONS.lookHeight,
    followRate: options.followRate ?? DEFAULT_OPTIONS.followRate,
    fovRate: options.fovRate ?? DEFAULT_OPTIONS.fovRate,
    rollRate: options.rollRate ?? DEFAULT_OPTIONS.rollRate,
    maxRoll: options.maxRoll ?? DEFAULT_OPTIONS.maxRoll,
  };

  if (!Number.isFinite(opts.maxSpeed) || opts.maxSpeed <= 0) {
    throw new Error(
      `createChaseCamera: maxSpeed must be finite and > 0, got ${opts.maxSpeed}`,
    );
  }
  if (!Number.isFinite(opts.maxRoll) || opts.maxRoll < 0) {
    throw new Error(
      `createChaseCamera: maxRoll must be finite and >= 0, got ${opts.maxRoll}`,
    );
  }

  const camera = new THREE.PerspectiveCamera(opts.minFov, 1, 0.1, 500);
  const gazeTarget = new THREE.Vector3();

  let disposed = false;
  let placed = false;
  // Smoothed state, kept as plain numbers so the rig only touches the THREE
  // camera through position/fov/rotateZ — easy to unit test and cheap.
  let camX = 0;
  let camY = 0;
  let camZ = 0;
  let gazeX = 0;
  let gazeY = 0;
  let gazeZ = 0;
  let lastCarX = 0;
  let lastCarZ = 0;
  let fov = opts.minFov;
  let roll = 0;

  const update = (deltaSeconds: number, carState: CarState): void => {
    if (disposed) return;

    const dt = Math.min(Math.max(deltaSeconds, 0), MAX_DT_SECONDS);
    const speedT = clamp01(carState.speed / opts.maxSpeed);
    // Car heading 0 points along +x; forward is the horizontal plane vector.
    const forwardX = Math.cos(carState.heading);
    const forwardZ = Math.sin(carState.heading);

    // Speed-scaled framing targets.
    const followDistance = lerp(opts.minDistance, opts.maxDistance, speedT);
    const targetFov = lerp(opts.minFov, opts.maxFov, speedT);
    const targetRoll = carState.driftFactor * opts.maxRoll;

    // Ideal camera seat: behind the car, pulled back by the follow distance.
    const seatX = carState.position.x - forwardX * followDistance;
    const seatY = opts.height;
    const seatZ = carState.position.z - forwardZ * followDistance;

    // Ideal gaze: a little above the ground, ahead of the car's heading.
    const desiredGazeX = carState.position.x + forwardX * opts.lookAhead;
    const desiredGazeY = opts.lookHeight;
    const desiredGazeZ = carState.position.z + forwardZ * opts.lookAhead;

    if (!placed) {
      // First update: seat the camera immediately to avoid a startup swing.
      camX = seatX;
      camY = seatY;
      camZ = seatZ;
      gazeX = desiredGazeX;
      gazeY = desiredGazeY;
      gazeZ = desiredGazeZ;
      fov = targetFov;
      roll = targetRoll;
      placed = true;
    } else {
      // Frame-rate independent exponential damping. Each component moves a
      // fraction `k` of the remaining error, so convergence is monotonic
      // (never overshoots) and a constant car speed yields a constant
      // camera offset (no jitter).
      const k = 1 - Math.exp(-opts.followRate * dt);
      camX += (seatX - camX) * k;
      camY += (seatY - camY) * k;
      camZ += (seatZ - camZ) * k;
      gazeX += (desiredGazeX - gazeX) * k;
      gazeY += (desiredGazeY - gazeY) * k;
      gazeZ += (desiredGazeZ - gazeZ) * k;

      const fovK = 1 - Math.exp(-opts.fovRate * dt);
      fov += (targetFov - fov) * fovK;

      const rollK = 1 - Math.exp(-opts.rollRate * dt);
      roll += (targetRoll - roll) * rollK;
    }

    lastCarX = carState.position.x;
    lastCarZ = carState.position.z;

    // Apply the smoothed state to the underlying THREE camera.
    camera.position.set(camX, camY, camZ);
    gazeTarget.set(gazeX, gazeY, gazeZ);
    camera.lookAt(gazeTarget);
    // Roll around the view axis *after* aiming: bounded in [0, maxRoll] and
    // proportional to driftFactor (the smoother preserves the bounds).
    camera.rotateZ(roll);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };

  const dispose = (): void => {
    disposed = true;
  };

  return {
    mode: 'follow',
    get distance() {
      return Math.hypot(camX - lastCarX, camZ - lastCarZ);
    },
    get height() {
      return opts.height;
    },
    get pitch() {
      return -Math.atan2(
        camY - gazeY,
        Math.hypot(camX - gazeX, camZ - gazeZ),
      );
    },
    get fov() {
      return fov;
    },
    get roll() {
      return roll;
    },
    camera,
    update,
    dispose,
  };
}