/**
 * Orbit navigation rig (default camera mode).
 *
 * Implements the classic inspection controls on top of a THREE-style camera:
 *
 * - drag-rotate (yaw around the up axis, pitch clamped away from the poles),
 *   with damping — the camera eases toward the dragged rotation target so the
 *   orbit keeps a small, smooth lag and coasts to a stop on release,
 * - wheel zoom along the viewing direction, clamped to a near/far radius,
 * - right-drag (or middle-drag) pan across the ground plane,
 * - optional auto-drift yaw (disabled by the navigation controller under
 *   prefers-reduced-motion).
 *
 * The rig never touches the world: its only side effect is mutating the
 * camera transform (`position` + `lookAt`). It owns no event listeners — the
 * navigation controller forwards input and owns teardown.
 */
import type { Euler } from 'three';

const YAW_PER_PIXEL = 0.0044;
const PITCH_PER_PIXEL = 0.0032;
const MIN_PITCH = -0.05;
const MAX_PITCH = Math.PI / 2 - 0.05;
const MIN_RADIUS = 4;
const MAX_RADIUS = 90;
const MOVE_STEP = 0.5; // fractional ease toward target each frame (damping)
const PAN_SENSITIVITY = 0.0026;
const ZOOM_RATE = 0.1;
const PI2 = Math.PI * 2;

/** Pointer-lock style rotation sensitivity in radians per pixel. */
export const ROTATION_PER_UNIT = 0.0022;

/** The camera surface the rigs drive (structural subset of THREE.Camera). */
export interface NavCamera {
  readonly position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  readonly quaternion: import('three').Quaternion;
  readonly rotation: Euler;
  lookAt(x: number, y: number, z: number): void;
}

export interface OrbitRigOptions {
  /** Ground level (Y) the camera may never sink below. */
  groundHeight: number;
  /** Y of the point the orbit circles (default eye height resting pose). */
  targetHeight: number;
  /** Auto-drift yaw in radians per second (0 disables). */
  autoDrift: number;
}

/** Bounds rectangle used to clamp the camera (block island, Y = 0). */
export interface ClampBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Purely functional horizontal bounds clamp. Guarantees the camera never
 * leaves the block island horizontally regardless of drag/pan/walk input.
 * Exported for the unit tests.
 */
export function clampToBlockBounds(
  x: number,
  z: number,
  bounds: ClampBounds,
): { x: number; z: number } {
  return {
    x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
    z: Math.min(Math.max(z, bounds.minZ), bounds.maxZ),
  };
}

function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
}

/**
 * Damped orbit rig over a ground target point. Driven by the navigation
 * controller with `rotateByPixels` / `panByPixels` / `zoomBy` and `update(dt)`
 * each frame. The camera position is always clamped into `bounds` and never
 * set below `groundHeight`.
 */
export class OrbitRig {
  /** Ground-plane point the camera circles (kept inside bounds). */
  readonly target = { x: 0, y: 1.6, z: 0 };

  private radius: number;
  private yaw: number;
  private pitch: number;
  private radiusTarget: number;
  private yawTarget: number;
  private pitchTarget: number;
  private readonly groundHeight: number;
  private readonly autoDrift: number;
  private readonly bounds: ClampBounds;

  constructor(
    private readonly camera: NavCamera,
    bounds: ClampBounds,
    options: OrbitRigOptions,
    initialYaw = -Math.PI / 4,
    initialPitch = 0.48,
  ) {
    this.bounds = bounds;
    this.groundHeight = options.groundHeight;
    this.autoDrift = options.autoDrift;
    this.target.y = options.targetHeight;

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    this.target.x = cx;
    this.target.z = cz;

    // Frame the whole block island with a little margin.
    this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.hypot(spanX, spanZ) * 0.62));
    this.yaw = this.yawTarget = initialYaw;
    this.pitch = this.pitchTarget = initialPitch;
    this.radiusTarget = this.radius;
    this.sync();
  }

  /** Current orbit radius (used by wheel zoom and flight settling). */
  getRadius(): number {
    return this.radius;
  }

  /** Ground-plane yaw heading of the camera (radians, from orbit). */
  getYaw(): number {
    return this.yaw;
  }

  /** Re-center the orbit on a new ground point, keeping it inside bounds. */
  recenterAt(x: number, z: number, snap = false): void {
    const c = clampToBlockBounds(x, z, this.bounds);
    this.target.x = c.x;
    this.target.z = c.z;
    if (snap) {
      this.yawTarget = this.yaw;
      this.pitchTarget = this.pitch;
      this.radiusTarget = this.radius;
    }
    this.sync();
  }

  /** Lay the camera onto the current pose as a hard jump (no easing). */
  snap(): void {
    this.yawTarget = this.yaw;
    this.pitchTarget = this.pitch;
    this.radiusTarget = this.radius;
    this.sync();
  }

  /**
   * Re-derive yaw/pitch/radius from the current camera so future eased frames
   * stay continuous. Call after externally moving the camera (e.g. a fly-to).
   */
  adoptPose(overX: number, overY: number, overZ: number): void {
    const dx = this.camera.position.x - overX;
    const dy = this.camera.position.y - overY;
    const dz = this.camera.position.z - overZ;
    this.radius = this.radiusTarget = Math.max(MIN_RADIUS, Math.hypot(dx, dy, dz));
    this.yaw = this.yawTarget = Math.atan2(dx, dz);
    this.pitch = this.pitchTarget = clampPitch(Math.asin(Math.min(1, Math.max(-1, dy / this.radius))));
    this.target.x = overX;
    this.target.y = overY;
    this.target.z = overZ;
  }

  /** Apply a drag rotation of `dx`/`dy` pixels (left-drag). */
  rotateByPixels(dx: number, dy: number): void {
    this.yawTarget = (this.yawTarget - dx * YAW_PER_PIXEL) % PI2;
    this.pitchTarget = clampPitch(this.pitchTarget - dy * PITCH_PER_PIXEL);
  }

  /** Apply a pan drag of `dx`/`dy` pixels (right/middle-drag). */
  panByPixels(dx: number, dy: number): void {
    const scale = Math.max(0.2, this.radius * PAN_SENSITIVITY);
    this.target.x -= dx * scale;
    this.target.z += dy * scale;
    this.clampTarget();
  }

  /**
   * Wheel zoom. `delta` is the signed scroll amount (±1 per notch); positive
   * zooms out. The radius eases toward its target so bursts stay smooth.
   */
  zoomBy(delta: number): void {
    this.radiusTarget = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, this.radiusTarget + delta * ZOOM_RATE * this.radiusTarget));
  }

  /** Per-frame integration: ease toward the damped drag targets. */
  update(dt: number): void {
    if (dt <= 0) return;
    if (this.autoDrift !== 0) {
      this.yawTarget = (this.yawTarget + this.autoDrift * dt + PI2) % PI2;
    }
    this.yaw += (this.yawTarget - this.yaw) * MOVE_STEP;
    this.pitch += (this.pitchTarget - this.pitch) * MOVE_STEP;
    this.radius += (this.radiusTarget - this.radius) * MOVE_STEP;
    this.clampTarget();
    this.sync();
  }

  /**
   * Lay the camera transform onto the current orbit pose. Both the orbit
   * target AND the camera's horizontal position are clamped into the block
   * bounds, so the camera can never leave the island or sink below ground;
   * near the edges the orbit slides along the boundary instead of clipping
   * through the world.
   */
  sync(): void {
    const horizontal = Math.cos(this.pitch) * this.radius;
    const cameraY = Math.max(this.groundHeight, this.target.y + Math.sin(this.pitch) * this.radius);
    const cx = clampToBlockBounds(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.z + Math.cos(this.yaw) * horizontal,
      this.bounds,
    );
    this.camera.position.set(cx.x, cameraY, cx.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }

  /** Keep the orbit target inside the block bounds. */
  private clampTarget(): void {
    const c = clampToBlockBounds(this.target.x, this.target.z, this.bounds);
    this.target.x = c.x;
    this.target.z = c.z;
  }
}