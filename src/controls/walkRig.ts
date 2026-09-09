/**
 * First-person walk navigation rig.
 *
 * Pointer-lock first-person controls at eye height: WASD/arrow keys strafe
 * across the ground plane, pointer-lock mouse motion turns the view (yaw +
 * pitch). The rig degrades gracefully when pointer lock is denied — the walk
 * toggle still moves with the keys and the left/right arrow keys rotate, so
 * walk mode never leaves the user stuck.
 *
 * The rig never touches the world: its only side effect is mutating the
 * camera transform (`position` + `rotation`). It owns no event listeners —
 * the navigation controller forwards input and owns teardown.
 */
import { clampToBlockBounds, ROTATION_PER_UNIT, type ClampBounds, type NavCamera } from './orbitRig';

/** Eye height used when entering walk mode (world units). */
export const WALK_EYE_HEIGHT = 1.7;
/** Walk speed in world units per second. */
const WALK_SPEED = 2.5;
const MIN_PITCH = -Math.PI / 2 + 0.05;
const MAX_PITCH = Math.PI / 2 - 0.05;

function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
}

export interface WalkRigOptions {
  /** Ground level (Y) the camera may never sink below, even when lifting. */
  groundHeight: number;
  /** Eye height above the ground while walking. */
  eyeHeight: number;
}

/**
 * First-person walk rig held at eye height. `update(dt)` integrates the
 * currently held WASD/arrow axes, clamps horizontal position to the block
 * bounds and height to ground, then places the camera.
 */
export class WalkRig {
  /** Horizontal ground-plane position (Y is derived from `eyeHeight`). */
  readonly position = { x: 0, z: 0 };

  private yaw = 0;
  private pitch = 0;
  private forward = 0; // -1 .. 1 (W/S)
  private strafe = 0; // -1 .. 1 (A/D)
  private readonly groundHeight: number;
  private readonly eyeHeight: number;
  private readonly bounds: ClampBounds;

  constructor(
    private readonly camera: NavCamera,
    bounds: ClampBounds,
    options: WalkRigOptions,
    initialPosition = { x: 0, z: 0 },
    initialYaw = Math.PI / 4,
  ) {
    this.bounds = bounds;
    this.groundHeight = options.groundHeight;
    this.eyeHeight = options.eyeHeight;
    const c = clampToBlockBounds(initialPosition.x, initialPosition.z, bounds);
    this.position.x = c.x;
    this.position.z = c.z;
    this.yaw = initialYaw;
    this.pitch = 0;
    // NOTE: no sync() here — the rig only takes over the camera when the
    // controller switches to walk mode (setPosition / update).
  }

  /** Yaw in radians (camera's horizontal heading). */
  getYaw(): number {
    return this.yaw;
  }
  getPitch(): number {
    return this.pitch;
  }
  /** Current horizontal position (used by the HUD and the tests). */
  getPositionX(): number {
    return this.position.x;
  }
  getPositionZ(): number {
    return this.position.z;
  }

  /** Set the walk position inside the block bounds; height snaps to eye. */
  setPosition(x: number, z: number): void {
    const c = clampToBlockBounds(x, z, this.bounds);
    this.position.x = c.x;
    this.position.z = c.z;
    this.sync();
  }

  /** Set the view orientation directly (used when a fly-to hands back). */
  setOrientation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clampPitch(pitch);
    this.sync();
  }

  /** Key state for walk axes. `forward` > 0 moves along the facing direction. */
  setAxes(forward: number, strafe: number): void {
    this.forward = Math.min(1, Math.max(-1, forward));
    this.strafe = Math.min(1, Math.max(-1, strafe));
  }

  /** Pointer-lock mouse motion in pixels since the last sample. */
  lookBy(movementX: number, movementY: number): void {
    this.yaw -= movementX * ROTATION_PER_UNIT;
    this.pitch = clampPitch(this.pitch - movementY * ROTATION_PER_UNIT);
    this.sync();
  }

  /** Per-frame integration: step along the held axes, then place the camera. */
  update(dt: number): void {
    if (dt <= 0) return;
    if (this.forward !== 0 || this.strafe !== 0) {
      // Walk in the yaw plane (pitch only aims the view up/down). Diagonal
      // moves are normalized to the walk speed.
      const yaw = this.yaw;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const scale = Math.hypot(this.strafe, this.forward) || 1;
      const step = (WALK_SPEED * dt) / scale;
      const c = clampToBlockBounds(
        this.position.x + (rx * this.strafe + fx * this.forward) * step,
        this.position.z + (rz * this.strafe + fz * this.forward) * step,
        this.bounds,
      );
      this.position.x = c.x;
      this.position.z = c.z;
    }
    this.sync();
  }

  /** Place the camera at eye height looking along yaw/pitch. */
  sync(): void {
    this.camera.position.set(
      this.position.x,
      Math.max(this.groundHeight, this.eyeHeight),
      this.position.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}