/**
 * The camera & navigation rig.
 *
 * `NavigationRig` owns an orbit camera and wires user input (rotate / zoom /
 * pan) plus named layout focus points into a single integrated pose. It is a
 * plain class: it exposes `attach`/`update`/`dispose` lifecycle hooks for the
 * scene composition layer and needs no renderer, so it can be driven headless
 * in tests and mounted by React Three Fiber in production.
 *
 * The rig consumes focus points **read-only** from the layout module: it reads
 * `cameraFocusPoints` to resolve named vantages but never mutates them. It also
 * never resets the user's viewport: `attach` preserves the current camera, and
 * era transitions (which never touch the rig) leave the pose untouched.
 */

import { resolveOptions, stepCamera, zeroVelocity } from './camera.js';
import type {
  CameraState,
  FocusPointSource,
  NavigationRigOptions,
  Vec3,
} from './types.js';
import type { OrbitVelocity } from './camera.js';

/** A focus-point lerp in progress. */
interface FocusLerp {
  start: CameraState;
  end: CameraState;
  elapsed: number;
  duration: number;
}

/** The default orbit the rig starts from when no camera is attached. */
const DEFAULT_TARGET = { x: 0, z: 0 };
const DEFAULT_YAW = Math.PI / 4;
const DEFAULT_PITCH = 0.6;
const DEFAULT_DISTANCE = 40;

export class NavigationRig {
  private readonly options: Required<NavigationRigOptions>;
  private readonly focusSource: FocusPointSource;
  private state: CameraState | null = null;
  private velocity: OrbitVelocity = zeroVelocity();
  private focus: FocusLerp | null = null;

  /** Create a rig that reads focus points from `focusSource` (read-only). */
  constructor(focusSource: FocusPointSource, options?: NavigationRigOptions) {
    this.focusSource = focusSource;
    this.options = resolveOptions(options);
  }

  /**
   * Attach the rig to an existing camera pose. If `position` is provided the
   * rig adopts it (preserving the user's viewport); otherwise it falls back to
   * the default overview orbit. Safe to call again to re-target without
   * resetting the pose.
   */
  attach(position?: Vec3): CameraState {
    if (position) {
      const pose = this.poseFromExisting(position);
      this.state = {
        position: { ...position },
        target: pose.target,
        yaw: pose.yaw,
        pitch: pose.pitch,
        distance: pose.distance,
      };
    } else {
      this.state = {
        position: this.positionFor(DEFAULT_TARGET, DEFAULT_YAW, DEFAULT_PITCH, DEFAULT_DISTANCE),
        target: { x: DEFAULT_TARGET.x, z: DEFAULT_TARGET.z },
        yaw: DEFAULT_YAW,
        pitch: DEFAULT_PITCH,
        distance: DEFAULT_DISTANCE,
      };
    }
    this.velocity = zeroVelocity();
    this.focus = null;
    return this.state;
  }

  /** Advance the rig by `dt` seconds and return the current camera state. */
  update(dt: number): CameraState {
    if (!this.state) {
      return this.attach();
    }
    if (this.focus) {
      this.state = this.advanceFocus(this.focus, dt);
    } else {
      const next = stepCamera(this.state, this.velocity, dt, this.options);
      this.state = next.state;
      this.velocity = next.velocity;
    }
    return this.state;
  }

  /** Release internal references. Safe to call multiple times. */
  dispose(): void {
    this.state = null;
    this.velocity = zeroVelocity();
    this.focus = null;
  }

  // ---- Input -------------------------------------------------------------

  /** Impart a rotate impulse (radians per second) for `dt` seconds. */
  rotate(dYaw: number, dPitch: number, dt: number): void {
    this.cancelFocus();
    this.velocity.yaw += dYaw * this.options.rotateSensitivity * dt;
    this.velocity.pitch += dPitch * this.options.rotateSensitivity * dt;
  }

  /** Impart a zoom impulse. `ticks` is wheel steps (positive = zoom in). */
  zoom(ticks: number, dt: number): void {
    this.cancelFocus();
    this.velocity.distance += -ticks * this.options.zoomSensitivity * this.options.distanceMax * dt;
  }

  /** Impart a ground-plane pan impulse (meters per second) for `dt` seconds. */
  pan(dX: number, dZ: number, dt: number): void {
    this.cancelFocus();
    this.velocity.target.x += dX * this.options.panSensitivity * dt;
    this.velocity.target.z += dZ * this.options.panSensitivity * dt;
  }

  // ---- Focus points ------------------------------------------------------

  /** All named focus points from the layout module (read-only). */
  focusPoints(): ReadonlyArray<{ id: string; label: string }> {
    return this.focusSource.cameraFocusPoints.map((f) => ({ id: f.id, label: f.label }));
  }

  /**
   * Smoothly lerp the camera to the named focus point over the configured
   * duration. Unknown ids are ignored. Returns the resolved focus point, or
   * `undefined` if the id does not exist.
   */
  focusOn(id: string): { id: string; label: string } | undefined {
    const point = this.focusSource.cameraFocusPoints.find((f) => f.id === id);
    if (!point) {
      return undefined;
    }
    if (!this.state) {
      this.attach();
    }
    const current = this.state!;
    const end = this.buildFocusState(point.position, point.target, point.height);
    this.focus = {
      start: current,
      end,
      elapsed: 0,
      duration: this.options.focusDuration,
    };
    this.velocity = zeroVelocity();
    return { id: point.id, label: point.label };
  }

  /** True while a focus-point lerp is in progress. */
  isFocused(): boolean {
    return this.focus !== null;
  }

  // ---- Internals ---------------------------------------------------------

  private positionFor(
    target: { x: number; z: number },
    yaw: number,
    pitch: number,
    distance: number,
  ): Vec3 {
    const horizontal = distance * Math.cos(pitch);
    return {
      x: target.x + horizontal * Math.cos(yaw),
      y: distance * Math.sin(pitch),
      z: target.z + horizontal * Math.sin(yaw),
    };
  }

  private poseFromExisting(position: Vec3): { target: { x: number; z: number }; yaw: number; pitch: number; distance: number } {
    const dx = position.x - DEFAULT_TARGET.x;
    const dz = position.z - DEFAULT_TARGET.z;
    const horizontal = Math.hypot(dx, dz);
    const distance = Math.hypot(horizontal, position.y);
    return {
      target: { x: DEFAULT_TARGET.x, z: DEFAULT_TARGET.z },
      yaw: Math.atan2(dz, dx),
      pitch: Math.atan2(position.y, horizontal),
      distance,
    };
  }

  private buildFocusState(
    position: { x: number; z: number },
    target: { x: number; z: number },
    height: number,
  ): CameraState {
    const dx = position.x - target.x;
    const dz = position.z - target.z;
    const horizontal = Math.hypot(dx, dz);
    const distance = Math.hypot(horizontal, height);
    const yaw = Math.atan2(dz, dx);
    const pitch = Math.atan2(height, horizontal);
    return {
      position: this.positionFor(target, yaw, pitch, distance),
      target: { x: target.x, z: target.z },
      yaw,
      pitch: Math.max(this.options.pitchMin, Math.min(this.options.pitchMax, pitch)),
      distance: Math.max(this.options.distanceMin, Math.min(this.options.distanceMax, distance)),
    };
  }

  private advanceFocus(lerp: FocusLerp, dt: number): CameraState {
    lerp.elapsed += dt;
    const t = Math.min(1, lerp.elapsed / lerp.duration);
    const eased = t * t * (3 - 2 * t); // smoothstep
    const target = {
      x: lerp.start.target.x + (lerp.end.target.x - lerp.start.target.x) * eased,
      z: lerp.start.target.z + (lerp.end.target.z - lerp.start.target.z) * eased,
    };
    const yaw = lerp.start.yaw + (lerp.end.yaw - lerp.start.yaw) * eased;
    const pitch = lerp.start.pitch + (lerp.end.pitch - lerp.start.pitch) * eased;
    const distance = lerp.start.distance + (lerp.end.distance - lerp.start.distance) * eased;
    if (t >= 1) {
      this.focus = null;
    }
    return {
      position: this.positionFor(target, yaw, pitch, distance),
      target,
      yaw,
      pitch,
      distance,
    };
  }

  private cancelFocus(): void {
    this.focus = null;
  }
}