/**
 * CameraRig: smooth, damped navigation camera.
 *
 * Two first-person/orbit modes served by one state machine:
 *
 * - `orbit`: spherical coordinates around an orbit center. Drag rotates
 *   (azimuth + clamped polar angle), wheel/pinch zooms the radius with
 *   min/max limits.
 * - `walk`: free first-person movement (position + yaw/pitch). Movement is
 *   relative to the current heading so WASD + pointer drag "look" feel
 *   natural.
 *
 * Every input mutates *targets*; {@link CameraRig.update} exponentially
 * damps the rendered values toward them, so motion is frame-rate independent
 * and cinematic. The rig is pure math over plain `Vec3` data — no DOM, no
 * WebGL — which keeps it fully unit-testable headlessly.
 */

import type { Vec3 } from './lighting';

/** Result of {@link CameraRig.getView} — the world-space pose to render. */
export interface CameraView {
  /** Eye position in world units. */
  readonly position: Vec3;
  /** Point the camera faces. */
  readonly lookAt: Vec3;
  /** World up vector. */
  readonly up: Vec3;
}

export type CameraMode = 'orbit' | 'walk';

/** Orbit travel limits. Polar angle is the co-latitude from +Y (0..PI). */
export interface OrbitLimits {
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly minPolar: number;
  readonly maxPolar: number;
}

export interface CameraRigOptions {
  mode?: CameraMode;
  /** World point the orbit camera circles. Defaults to the origin. */
  orbitCenter?: Vec3;
  /** Orbit azimuth in radians. Default `PI / 4`. */
  initialAzimuth?: number;
  /** Orbit polar angle (from +Y) in radians. Default `1.02` (~58.5 deg). */
  initialPolar?: number;
  /** Orbit radius in world units. Default `60`. */
  initialDistance?: number;
  /** Overrides for the orbit travel limits. */
  limits?: Partial<OrbitLimits>;
  /** Exponential damping rate (per second). Default `12`. */
  dampingRate?: number;
  /** Walk speed in world units per second. Default `9`. */
  walkSpeed?: number;
  /** Walk eye height above the ground plane. Default `2`. */
  walkEyeHeight?: number;
  /** Maximum look pitch (up/down) in radians. Default `PI/2 - 0.06`. */
  maxLookPitch?: number;
}

/** Default travel limits for the orbit camera. */
export const DEFAULT_ORBIT_LIMITS: OrbitLimits = Object.freeze({
  minDistance: 8,
  maxDistance: 400,
  minPolar: 0.15,
  maxPolar: Math.PI - 0.15,
});

const UP: Vec3 = Object.freeze({ x: 0, y: 1, z: 0 });

/** Lowest allowed walk eye height above the ground plane (world units). */
const WALK_FLOOR = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Frame-rate independent exponential smoothing toward `target`.
 * `rate` is the per-second convergence constant.
 */
function damp(current: number, target: number, dtSeconds: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dtSeconds));
}

function dampVec(current: Vec3, target: Vec3, dtSeconds: number, rate: number): Vec3 {
  return {
    x: damp(current.x, target.x, dtSeconds, rate),
    y: damp(current.y, target.y, dtSeconds, rate),
    z: damp(current.z, target.z, dtSeconds, rate),
  };
}

function normalizeLimits(limits: Partial<OrbitLimits> | undefined): OrbitLimits {
  const base = DEFAULT_ORBIT_LIMITS;
  let minDistance = limits?.minDistance ?? base.minDistance;
  const maxDistance = Math.max(minDistance, limits?.maxDistance ?? base.maxDistance);
  minDistance = Math.max(0.5, Math.min(minDistance, maxDistance));
  let minPolar = Math.max(0.01, limits?.minPolar ?? base.minPolar);
  let maxPolar = Math.min(Math.PI - 0.01, limits?.maxPolar ?? base.maxPolar);
  if (minPolar >= maxPolar) {
    minPolar = 0.05;
    maxPolar = Math.PI - 0.05;
  }
  return { minDistance, maxDistance, minPolar, maxPolar };
}

export class CameraRig {
  private readonly limits: OrbitLimits;
  private readonly dampingRate: number;
  private readonly walkSpeed: number;
  private readonly walkEyeHeight: number;
  private readonly maxLookPitch: number;
  private readonly orbitCenter: Vec3;

  private mode: CameraMode;

  // Damped orbit state (current + target).
  private azimuth: number;
  private polar: number;
  private distance: number;
  private azimuthTarget: number;
  private polarTarget: number;
  private distanceTarget: number;

  // Damped walk state (current + target).
  private position: Vec3;
  private yaw: number;
  private pitch: number;
  private positionTarget: Vec3;
  private yawTarget: number;
  private pitchTarget: number;

  constructor(options: CameraRigOptions = {}) {
    this.limits = normalizeLimits(options.limits);
    this.dampingRate = options.dampingRate ?? 12;
    this.walkSpeed = options.walkSpeed ?? 9;
    this.walkEyeHeight = options.walkEyeHeight ?? 2;
    this.maxLookPitch = clamp(options.maxLookPitch ?? Math.PI / 2 - 0.06, 0.01, Math.PI / 2);

    const center = options.orbitCenter ?? { x: 0, y: 0, z: 0 };
    this.orbitCenter = { x: center.x, y: center.y, z: center.z };

    this.mode = options.mode ?? 'orbit';

    this.azimuth = options.initialAzimuth ?? Math.PI / 4;
    this.polar = clamp(options.initialPolar ?? 1.02, this.limits.minPolar, this.limits.maxPolar);
    this.distance = clamp(
      options.initialDistance ?? 60,
      this.limits.minDistance,
      this.limits.maxDistance,
    );
    this.azimuthTarget = this.azimuth;
    this.polarTarget = this.polar;
    this.distanceTarget = this.distance;

    const eye = this.sphericalPoint(this.azimuth, this.polar, this.distance);
    this.position = { ...eye };
    this.positionTarget = { ...eye };
    const heading = this.headingFromCenter(eye);
    this.yaw = heading.yaw;
    this.pitch = heading.pitch;
    this.yawTarget = this.yaw;
    this.pitchTarget = this.pitch;
  }

  // ------------------------------------------------------------------
  // Mode + state accessors
  // ------------------------------------------------------------------

  getMode(): CameraMode {
    return this.mode;
  }

  getOrbitCenter(): Vec3 {
    return { ...this.orbitCenter };
  }

  getOrbitLimits(): OrbitLimits {
    return { ...this.limits };
  }

  getAzimuth(): number {
    return this.azimuth;
  }

  getPolar(): number {
    return this.polar;
  }

  getDistance(): number {
    return this.distance;
  }

  getPosition(): Vec3 {
    return { ...this.position };
  }

  getYaw(): number {
    return this.yaw;
  }

  getPitch(): number {
    return this.pitch;
  }

  /**
   * Switch camera mode. Switching preserves continuity: entering `walk`
   * starts exactly where the orbit eye currently is (facing the orbit
   * center); entering `orbit` re-derives azimuth/polar/distance from the
   * current walk eye.
   */
  setMode(next: CameraMode): void {
    if (next === this.mode) {
      return;
    }
    this.mode = next;
    if (next === 'walk') {
      const eye = this.sphericalPoint(this.azimuth, this.polar, this.distance);
      // First-person starts at street eye height above the ground plane.
      const walkEye = { x: eye.x, y: Math.max(this.walkEyeHeight, WALK_FLOOR), z: eye.z };
      const heading = this.headingFromCenter(walkEye);
      this.position = { ...walkEye };
      this.positionTarget = { ...walkEye };
      this.yaw = heading.yaw;
      this.yawTarget = heading.yaw;
      this.pitch = heading.pitch;
      this.pitchTarget = heading.pitch;
      return;
    }
    // Entering orbit: derive spherical coordinates from the current eye.
    const d = this.position;
    const ox = d.x - this.orbitCenter.x;
    const oy = d.y - this.orbitCenter.y;
    const oz = d.z - this.orbitCenter.z;
    const radius = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const distance = clamp(radius, this.limits.minDistance, this.limits.maxDistance);
    this.azimuth = Math.atan2(ox, oz);
    this.azimuthTarget = this.azimuth;
    this.polar = radius > 1e-9 ? Math.acos(clamp(oy / radius, -1, 1)) : this.limits.minPolar;
    this.polar = clamp(this.polar, this.limits.minPolar, this.limits.maxPolar);
    this.polarTarget = this.polar;
    this.distance = distance;
    this.distanceTarget = distance;
  }

  /** Instantly place walk mode at an exact pose and clear its targets. */
  setWalkPose(position: Vec3, yaw: number, pitch = 0): void {
    this.position = { ...position };
    this.positionTarget = { ...position };
    this.yaw = yaw;
    this.yawTarget = yaw;
    this.pitch = pitch;
    this.pitchTarget = pitch;
  }

  // ------------------------------------------------------------------
  // Inputs (mutate targets)
  // ------------------------------------------------------------------

  /**
   * Orbit drag input in radians. Positive `dx` spins the camera around the
   * center; positive `dy` lowers the eye toward the horizon (polar clamp
   * applied).
   */
  rotate(deltaAzimuth: number, deltaPolar: number): void {
    this.azimuthTarget += deltaAzimuth;
    this.polarTarget = clamp(this.polarTarget + deltaPolar, this.limits.minPolar, this.limits.maxPolar);
  }

  /**
   * Multiply the orbit distance target by `factor` (e.g. wheel or pinch
   * zoom), clamped to the travel limits. Values <= 0 are ignored.
   */
  zoom(factor: number): void {
    if (!(factor > 0)) {
      return;
    }
    this.distanceTarget = clamp(this.distanceTarget * factor, this.limits.minDistance, this.limits.maxDistance);
  }

  /** Set the orbit distance target directly (clamped). */
  setDistance(distance: number): void {
    this.distanceTarget = clamp(distance, this.limits.minDistance, this.limits.maxDistance);
  }

  /**
   * Walk movement input. `forward` (W/+1 .. S/-1) moves along the heading,
   * `strafe` (D/+1 .. A/-1) along the right vector; the two axes are
   * normalized so diagonal movement is not faster than straight movement.
   * Movement is applied for `deltaSeconds` at `walkSpeed` per second.
   */
  walkMove(forward: number, strafe: number, deltaSeconds: number): void {
    const f = clamp(forward, -1, 1);
    const s = clamp(strafe, -1, 1);
    if (f === 0 && s === 0) {
      return;
    }
    const length = Math.hypot(f, s);
    const fUnit = f / length;
    const sUnit = s / length;

    const forwardVec: Vec3 = { x: Math.sin(this.yaw), y: 0, z: -Math.cos(this.yaw) };
    const rightVec: Vec3 = { x: Math.cos(this.yaw), y: 0, z: Math.sin(this.yaw) };
    const step = this.walkSpeed * Math.max(0, deltaSeconds);

    this.positionTarget = {
      x: this.positionTarget.x + (forwardVec.x * fUnit + rightVec.x * sUnit) * step,
      y: Math.max(WALK_FLOOR, this.positionTarget.y + (forwardVec.y * fUnit + rightVec.y * sUnit) * step),
      z: this.positionTarget.z + (forwardVec.z * fUnit + rightVec.z * sUnit) * step,
    };
  }

  /**
   * Pointer look input in radians. Positive `dx` turns the view right;
   * positive `dy` tilts the view down (pitch clamped to maxLookPitch).
   */
  look(deltaYaw: number, deltaPitch: number): void {
    this.yawTarget += deltaYaw;
    this.pitchTarget = clamp(this.pitchTarget - deltaPitch, -this.maxLookPitch, this.maxLookPitch);
  }

  // ------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------

  /**
   * Advance the damped state toward the input targets by `deltaSeconds`.
   * Safe to call with any step size (including 0 or negative).
   */
  update(deltaSeconds: number): this {
    if (deltaSeconds <= 0) {
      return this;
    }
    if (this.mode === 'orbit') {
      this.azimuth = damp(this.azimuth, this.azimuthTarget, deltaSeconds, this.dampingRate);
      this.polar = clamp(damp(this.polar, this.polarTarget, deltaSeconds, this.dampingRate), this.limits.minPolar, this.limits.maxPolar);
      this.distance = clamp(damp(this.distance, this.distanceTarget, deltaSeconds, this.dampingRate), this.limits.minDistance, this.limits.maxDistance);
      return this;
    }
    this.position = dampVec(this.position, this.positionTarget, deltaSeconds, this.dampingRate);
    this.yaw = damp(this.yaw, this.yawTarget, deltaSeconds, this.dampingRate);
    this.pitch = clamp(damp(this.pitch, this.pitchTarget, deltaSeconds, this.dampingRate), -this.maxLookPitch, this.maxLookPitch);
    return this;
  }

  /** The current world-space camera pose, ready for a renderer. */
  getView(): CameraView {
    if (this.mode === 'orbit') {
      const position = this.sphericalPoint(this.azimuth, this.polar, this.distance);
      return {
        position,
        lookAt: { ...this.orbitCenter },
        up: UP,
      };
    }
    const forward = this.headingVector(this.yaw, this.pitch);
    return {
      position: { ...this.position },
      lookAt: {
        x: this.position.x + forward.x,
        y: this.position.y + forward.y,
        z: this.position.z + forward.z,
      },
      up: UP,
    };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private sphericalPoint(azimuth: number, polar: number, distance: number): Vec3 {
    const sinPolar = Math.sin(polar);
    return {
      x: this.orbitCenter.x + distance * sinPolar * Math.sin(azimuth),
      y: this.orbitCenter.y + distance * Math.cos(polar),
      z: this.orbitCenter.z + distance * sinPolar * Math.cos(azimuth),
    };
  }

  /** Heading (yaw/pitch) from a walk eye position toward the orbit center. */
  private headingFromCenter(eye: Vec3): { yaw: number; pitch: number } {
    const dx = this.orbitCenter.x - eye.x;
    const dy = this.orbitCenter.y - eye.y;
    const dz = this.orbitCenter.z - eye.z;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal <= 1e-9 && Math.abs(dy) <= 1e-9) {
      return { yaw: 0, pitch: 0 };
    }
    return {
      yaw: Math.atan2(dx, -dz),
      pitch: clamp(Math.atan2(dy, horizontal), -this.maxLookPitch, this.maxLookPitch),
    };
  }

  private headingVector(yaw: number, pitch: number): Vec3 {
    const cosPitch = Math.cos(pitch);
    return {
      x: Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };
  }
}