import { PerspectiveCamera, Vector3 } from 'three';

/**
 * CameraRig: WASD + mouse-look free-fly, an orbit preset that circles the
 * block, and a pinned on-screen touch joystick. The camera stays clamped
 * within the block bounds (plus a small margin).
 */

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraRig {
  /** Update camera from keyboard + joystick inputs. Call every frame. */
  update(dt: number): void;
  /** Apply mouse-look delta (pixels). */
  look(dx: number, dy: number): void;
  /** Set the joystick deflection in [-1, 1] for (x, y). */
  setJoystick(x: number, y: number): void;
  /** Enter orbit mode, circling the block center. */
  startOrbit(): void;
  /** Leave orbit mode (returns to free-fly). */
  stopOrbit(): void;
  /** Whether orbit mode is active. */
  readonly orbiting: boolean;
  /** Current camera position (world space). */
  readonly position: Vector3;
  /** Dispose: release listeners. */
  dispose(): void;
}

const EYE_HEIGHT = 18;
const MOVE_SPEED = 22; // world units per second
const ORBIT_RADIUS = 55;
const ORBIT_HEIGHT = 26;
const ORBIT_SPEED = 0.35; // radians per second

export function createCameraRig(
  camera: PerspectiveCamera,
  bounds: CameraBounds,
): CameraRig {
  // Free-fly state.
  let yaw = Math.PI * 0.25;
  let pitch = -0.35;
  const pos = new Vector3(0, EYE_HEIGHT, 0);

  // Joystick state.
  const joy = { x: 0, y: 0 };

  // Orbit state.
  let orbitAngle = 0;
  let orbiting = false;

  // Keyboard state.
  const keys = new Set<string>();

  function clampPos(p: Vector3): void {
    p.x = Math.max(bounds.minX, Math.min(bounds.maxX, p.x));
    p.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, p.z));
    p.y = Math.max(4, Math.min(60, p.y));
  }

  function applyOrientation(): void {
    camera.position.copy(pos);
    camera.lookAt(
      pos.x + Math.sin(yaw) * Math.cos(pitch),
      pos.y + Math.sin(pitch),
      pos.z + Math.cos(yaw) * Math.cos(pitch),
    );
  }

  function update(dt: number): void {
    if (orbiting) {
      orbitAngle += ORBIT_SPEED * dt;
      pos.x = Math.cos(orbitAngle) * ORBIT_RADIUS;
      pos.z = Math.sin(orbitAngle) * ORBIT_RADIUS;
      pos.y = ORBIT_HEIGHT;
      // Face the block center (origin).
      yaw = Math.atan2(0 - pos.x, 0 - pos.z);
      pitch = -0.25;
      clampPos(pos);
      applyOrientation();
      return;
    }

    // Input vector from WASD + joystick.
    let ix = 0;
    let iz = 0;
    if (keys.has('w')) iz -= 1;
    if (keys.has('s')) iz += 1;
    if (keys.has('a')) ix -= 1;
    if (keys.has('d')) ix += 1;
    ix += joy.x;
    iz -= joy.y;

    const len = Math.hypot(ix, iz);
    if (len > 0) {
      ix /= len;
      iz /= len;
      // Rotate input by yaw so forward = camera facing.
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const wx = ix * cos - iz * sin;
      const wz = ix * sin + iz * cos;
      pos.x += wx * MOVE_SPEED * dt;
      pos.z += wz * MOVE_SPEED * dt;
    }

    clampPos(pos);
    applyOrientation();
  }

  function look(dx: number, dy: number): void {
    yaw -= dx * 0.004;
    pitch -= dy * 0.004;
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
  }

  function setJoystick(x: number, y: number): void {
    joy.x = Math.max(-1, Math.min(1, x));
    joy.y = Math.max(-1, Math.min(1, y));
  }

  function startOrbit(): void {
    orbiting = true;
    orbitAngle = Math.atan2(pos.z, pos.x);
  }

  function stopOrbit(): void {
    orbiting = false;
  }

  // Keyboard listeners.
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  applyOrientation();

  return {
    update,
    look,
    setJoystick,
    startOrbit,
    stopOrbit,
    get orbiting() {
      return orbiting;
    },
    get position() {
      return pos;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keys.clear();
      joy.x = 0;
      joy.y = 0;
    },
  };
}