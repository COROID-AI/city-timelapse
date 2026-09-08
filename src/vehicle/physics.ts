/**
 * Deterministic arcade physics for the player vehicle.
 *
 * This module is the PURE, allocation-free core of the driving model. Every
 * function is a function of its inputs alone (no mutable module state), which
 * keeps the simulation reproducible for jest and lets the integration /
 * AI tasks share the same tuning without copying logic.
 *
 * Coordinate model
 * ---------------
 * The car lives in the XZ plane (Y up, matching `CarState.position` where the
 * Y component is ignored by this module). ``yaw`` is the heading angle around
 * the vertical axis and the forward direction of travel is
 * ``(sin(yaw), cos(yaw))`` in the XZ plane. ``speed`` is signed: positive =
 * forward, negative = reverse, which makes reversing fall out of the same
 * integration step as forward driving.
 *
 * All functions take an encoded `ArcadePhysics` tuning object so tests, AI
 * personalities, and the player car all share one deterministic implementation.
 */

import type { InputState } from '../shared/types';

/** Tuning constants for the arcade handling model. */
export interface ArcadePhysics {
  /** Forward top speed in world units / second. */
  readonly maxSpeed: number;
  /** Reverse top speed magnitude in world units / second. */
  readonly maxReverseSpeed: number;
  /** Forward acceleration in world units / second^2. */
  readonly acceleration: number;
  /** Reverse acceleration in world units / second^2. */
  readonly reverseAcceleration: number;
  /** Straight-line deceleration applied while braking (units / second^2). */
  readonly brakingDeceleration: number;
  /** Fraction of current speed shed per second as natural drag (0..1+). */
  readonly drag: number;
  /**
   * Peak yaw rate in radians / second when steering at a fully responsive
   * speed (>= `steerZeroSpeed` and <= `steerFullSpeed`).
   */
  readonly steerRateMax: number;
  /** Speed at which low-speed steering gain reaches 100%. */
  readonly steerZeroSpeed: number;
  /** Speed at which high-speed steering loss begins to kick in. */
  readonly steerFullSpeed: number;
  /** |steer| beyond which sustained speed is treated as a drift. */
  readonly driftThresholdSteer: number;
  /** Minimum |speed| for a drift state to register (units / second). */
  readonly driftSpeedThreshold: number;
}

/** Default handling profile for the player's neon sports car. */
export const defaultPhysics: Readonly<ArcadePhysics> = {
  maxSpeed: 60,
  maxReverseSpeed: -20,
  acceleration: 40,
  reverseAcceleration: 22,
  brakingDeceleration: 90,
  drag: 0.85,
  steerRateMax: 2.4,
  steerZeroSpeed: 6,
  steerFullSpeed: 55,
  driftThresholdSteer: 0.75,
  driftSpeedThreshold: 8,
};

/** Clamp `value` into the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Move `value` toward `target` by at most `step` (never overshooting).
 * `step` must be >= 0.
 */
export function approach(
  value: number,
  target: number,
  step: number,
): number {
  if (step <= 0) return value;
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return target;
}

/**
 * Compute the new forward speed after one `dt` tick given the throttle input.
 *
 * Logic follows the classic arcade profile:
 *  - throttle > 0 accelerates toward `maxSpeed`;
 *  - throttle < 0 brakes to a stop (if moving forward) then reverses toward
 *    `maxReverseSpeed`;
 *  - `brake` alone (no throttle) brakes to a stop;
 *  - natural drag always pulls whatever is left toward 0.
 */
export function applyThrottle(
  speed: number,
  throttle: number,
  brake: boolean,
  dt: number,
  params: Readonly<ArcadePhysics> = defaultPhysics,
): number {
  let next = speed;

  if (throttle > 0) {
    next = approach(next, params.maxSpeed, params.acceleration * dt);
  } else if (throttle < 0) {
    if (next > 0) {
      next = approach(next, 0, params.brakingDeceleration * dt);
    } else {
      next = approach(
        next,
        params.maxReverseSpeed,
        params.reverseAcceleration * dt,
      );
    }
  } else if (brake && next > 0) {
    next = approach(next, 0, params.brakingDeceleration * dt);
  }

  // Natural drag tapers speed toward zero.
  next = approach(next, 0, Math.abs(next) * params.drag * dt);

  return clamp(next, params.maxReverseSpeed, params.maxSpeed);
}

/**
 * Instantaneous steering (yaw) rate in radians / second for a given
 * `steer` input and signed `speed`. Steering is speed-dependent:
 * low-speed travel steers weakly, peak yaw rate is reached at a cruising
 * speed, and very high speed tapers the yaw rate to encourage drifting.
 */
export function steerRate(
  steer: number,
  speed: number,
  params: Readonly<ArcadePhysics> = defaultPhysics,
): number {
  const abs = Math.abs(speed);
  // Gain rises 0 -> 1 as speed reaches `steerZeroSpeed`.
  const lowGain = clamp(abs / params.steerZeroSpeed, 0, 1);
  // Gain tapers 1 -> 0 beyond `steerFullSpeed`.
  const highGain = clamp(
    1 - Math.max(0, abs - params.steerFullSpeed) / params.steerFullSpeed,
    0,
    1,
  );
  return steer * params.steerRateMax * lowGain * highGain;
}

/** New heading after applying steer input for one `dt` tick. */
export function steerByYaw(
  yaw: number,
  steer: number,
  speed: number,
  dt: number,
  params: Readonly<ArcadePhysics> = defaultPhysics,
): number {
  return yaw + steerRate(steer, speed, params) * dt;
}

/** Result of the grip / drift detector. */
export interface DriftState {
  /** Whether the car is currently in a sustained drift. */
  readonly drifting: boolean;
  /** Normalized 0..1 lateral slip intensity (0 = full grip). */
  readonly slide: number;
}

/**
 * Detect whether the car has broken lateral grip and is drifting.
 *
 * A drift requires both (a) a sharp steer deflection and (b) enough speed for
 * the lateral forces to overwhelm the tires. The `slide` intensity scales with
 * how far past the threshold the steer is and how much speed backs it.
 */
export function detectDrift(
  steer: number,
  speed: number,
  params: Readonly<ArcadePhysics> = defaultPhysics,
): DriftState {
  const absSteer = Math.abs(steer);
  const moving = Math.abs(speed) >= params.driftSpeedThreshold;
  const over = absSteer - params.driftThresholdSteer;
  if (!moving || over <= 0) {
    return { drifting: false, slide: 0 };
  }
  const steerIntensity = clamp(over / (1 - params.driftThresholdSteer), 0, 1);
  const speedIntensity = clamp(
    Math.abs(speed) / params.maxSpeed,
    0,
    1,
  );
  return { drifting: true, slide: clamp(steerIntensity * speedIntensity, 0, 1) };
}

/**
 * Mutable kinematic body for a car. This is the allocation-free state object
 * that a driving simulation mutates in place every frame.
 */
export interface CarBody {
  /** World X position. */
  x: number;
  /** World Z position. */
  z: number;
  /** Heading (yaw) in radians. */
  yaw: number;
  /** Signed forward speed (positive = forward, negative = reverse). */
  speed: number;
  /** Whether the car is currently drifting. */
  drifting: boolean;
  /** Normalized 0..1 lateral slip intensity. */
  slide: number;
}

/**
 * Advance a car body by one `dt` tick given the frame input.
 *
 * Mutates `body` in place (allocation-free) applying throttle -> steering ->
 * drift detection -> position integration. This is the deterministic single
 * integration step shared by the player car (and reusable by AI).
 */
export function stepCar(
  body: CarBody,
  input: Readonly<Pick<InputState, 'throttle' | 'steer' | 'brake'>>,
  dt: number,
  params: Readonly<ArcadePhysics> = defaultPhysics,
): void {
  const speed = applyThrottle(
    body.speed,
    input.throttle,
    input.brake,
    dt,
    params,
  );
  const yaw = steerByYaw(body.yaw, input.steer, speed, dt, params);
  const { drifting, slide } = detectDrift(input.steer, speed, params);

  // Integrate position along the heading (speed sign handles reverse).
  body.x += Math.sin(yaw) * speed * dt;
  body.z += Math.cos(yaw) * speed * dt;

  body.speed = speed;
  body.yaw = yaw;
  body.drifting = drifting;
  body.slide = slide;
}

/** Create a fresh, zeroed car body at an explicit spawn pose. */
export function createBody(x = 0, z = 0, yaw = 0): CarBody {
  return { x, z, yaw, speed: 0, drifting: false, slide: 0 };
}