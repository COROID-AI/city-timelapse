import { PerspectiveCamera, Vector3 } from 'three';
import { BuildingShell } from '../types/buildingShell';
import { CityBlockLayout, createCityBlockLayout, createDefaultBuildingShells } from '../layout/cityBlockLayout';
import {
  PointOfInterest,
  createPoiCatalog,
  findNearestPoi,
  findPoiById,
  findPoiByNumber,
} from './poiCatalog';

/**
 * CameraBounds defining the navigation boundary box in world space.
 */
export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Polished CameraRig interface.
 * Extends the foundation interface while preserving exact backwards compatibility
 * with all overlay chrome and application bootstrap callers.
 */
export interface CameraRig {
  /** Update camera from keyboard, joystick, inertia, orbit and fly-to transitions. Call every frame. */
  update(dt: number): void;
  /** Apply mouse-look / drag delta (in pixels). */
  look(dx: number, dy: number): void;
  /** Set the touch joystick deflection in [-1, 1] for (x, y). */
  setJoystick(x: number, y: number): void;
  /** Enter orbit mode, circling the block center. */
  startOrbit(): void;
  /** Leave orbit mode (returns to free-fly). */
  stopOrbit(): void;
  /** Toggle orbit mode on/off. */
  toggleOrbit(): void;
  /** Whether orbit mode is active. */
  readonly orbiting: boolean;
  /** Current camera position (world space). */
  readonly position: Vector3;
  /** Fly camera to a specific vantage position and look-at target with smooth cubic easing. */
  flyTo(
    targetPos: { x: number; y: number; z: number },
    targetLookAt: { x: number; y: number; z: number },
    duration?: number,
    onComplete?: () => void,
  ): void;
  /** Fly camera to a numbered or identified Point of Interest. Returns true if POI was found. */
  flyToPoi(poiOrIdOrNum: PointOfInterest | string | number, duration?: number): boolean;
  /** Cancel any active fly-to glide. */
  cancelFlyTo(): void;
  /** Whether a smooth fly-to transition is currently in progress. */
  readonly isFlying: boolean;
  /** Adjust orbit altitude. */
  setOrbitHeight(height: number): void;
  /** Adjust orbit circle radius. */
  setOrbitRadius(radius: number): void;
  /** Adjust orbit angular speed (radians/sec). */
  setOrbitSpeed(speed: number): void;
  /** Toggle auto-rotation during orbit mode. */
  setAutoRotate(enabled: boolean): void;
  /** Current orbit height. */
  readonly orbitHeight: number;
  /** Current orbit radius. */
  readonly orbitRadius: number;
  /** Whether orbit auto-rotation is enabled. */
  readonly autoRotate: boolean;
  /** Handle pinch-to-zoom delta. */
  handlePinch(scaleDelta: number): void;
  /** Apply zoom step. */
  zoom(delta: number): void;
  /** Update collision shells sampled against building footprints. */
  setBuildingShells(shells: readonly BuildingShell[]): void;
  /** Active building shells used for collision sampling. */
  readonly buildingShells: readonly BuildingShell[];
  /** Registered Points of Interest. */
  readonly poiCatalog: readonly PointOfInterest[];
  /** Current camera mode. */
  readonly mode: 'free-fly' | 'orbit' | 'fly-to';
  /** Current yaw (horizontal look angle in radians). */
  readonly yaw: number;
  /** Current pitch (vertical look angle in radians). */
  readonly pitch: number;
  /** Dispose: release event listeners and clear inputs. */
  dispose(): void;
}

export interface CameraRigOptions {
  /** Building shells for collision awareness. Defaults to standard layout shells. */
  shells?: readonly BuildingShell[];
  /** POI catalog. Defaults to standard block POIs. */
  poiCatalog?: readonly PointOfInterest[];
  /** City layout for bounds and collision context. */
  layout?: CityBlockLayout;
  /** Enable double-click to fly to nearest POI or building. Default: true. */
  enableDoubleClickFlyTo?: boolean;
  /** Enable keyboard number keys (1..9) to fly to POIs. Default: true. */
  enableKeyboardPoiJump?: boolean;
  /** Enable touch pinch/drag listeners. Default: true. */
  enableTouchControls?: boolean;
  /** Base movement speed (units/sec). Default: 22. */
  moveSpeed?: number;
  /** Base orbit speed (rad/sec). Default: 0.35. */
  orbitSpeed?: number;
  /** Initial orbit height. Default: 26. */
  orbitHeight?: number;
  /** Initial orbit radius. Default: 55. */
  orbitRadius?: number;
  /** Soft bumper margin distance from edge. Default: 6. */
  bumperMargin?: number;
  /** Soft bumper push strength. Default: 35. */
  bumperStrength?: number;
  /** Camera collision sphere radius. Default: 1.2. */
  collisionRadius?: number;
}

// --- Easing Mathematics ---

/** Smooth cubic ease-in-out curve. */
export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/** Smooth quadratic ease-in-out curve. */
export function easeInOutQuad(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

// --- Edge Bumper Calculations ---

/**
 * Calculate soft push-back force when camera approaches or exceeds block bounds.
 * Inside (bounds - margin), push is 0.
 * Within bumper margin, push smoothly increases non-linearly towards the center.
 */
export function calculateBumperPush(
  pos: { x: number; z: number },
  bounds: CameraBounds,
  margin: number = 6,
  strength: number = 35,
): { pushX: number; pushZ: number } {
  let pushX = 0;
  let pushZ = 0;

  // West edge (minX)
  const distMinX = pos.x - bounds.minX;
  if (distMinX < margin) {
    const factor = Math.max(0, (margin - distMinX) / margin);
    pushX += factor * factor * strength;
  }

  // East edge (maxX)
  const distMaxX = bounds.maxX - pos.x;
  if (distMaxX < margin) {
    const factor = Math.max(0, (margin - distMaxX) / margin);
    pushX -= factor * factor * strength;
  }

  // North edge (minZ)
  const distMinZ = pos.z - bounds.minZ;
  if (distMinZ < margin) {
    const factor = Math.max(0, (margin - distMinZ) / margin);
    pushZ += factor * factor * strength;
  }

  // South edge (maxZ)
  const distMaxZ = bounds.maxZ - pos.z;
  if (distMaxZ < margin) {
    const factor = Math.max(0, (margin - distMaxZ) / margin);
    pushZ -= factor * factor * strength;
  }

  return { pushX, pushZ };
}

// --- Collision Awareness & Building Sampling ---

/**
 * Sample building shell bounds from a CityBlockLayout.
 */
export function sampleBuildingShellBounds(layout?: CityBlockLayout): BuildingShell[] {
  const blockLayout = layout ?? createCityBlockLayout();
  return createDefaultBuildingShells(blockLayout, 1945);
}

/**
 * Check whether a 3D position collides with any building footprint shell.
 */
export function checkBuildingCollision(
  pos: { x: number; y: number; z: number },
  shells: readonly BuildingShell[],
  radius: number = 1.2,
): boolean {
  for (const shell of shells) {
    const minX = shell.rect.origin.x - radius;
    const maxX = shell.rect.origin.x + shell.rect.width + radius;
    const minZ = shell.rect.origin.z - radius;
    const maxZ = shell.rect.origin.z + shell.rect.depth + radius;
    const maxY = shell.height + 0.5;

    if (
      pos.y >= 0 &&
      pos.y < maxY &&
      pos.x >= minX &&
      pos.x <= maxX &&
      pos.z >= minZ &&
      pos.z <= maxZ
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve collision against building shells by pushing the camera out to the nearest exterior face.
 */
export function resolveBuildingCollision(
  pos: { x: number; y: number; z: number },
  shells: readonly BuildingShell[],
  radius: number = 1.2,
): { x: number; y: number; z: number } {
  let resolvedX = pos.x;
  let resolvedY = pos.y;
  let resolvedZ = pos.z;

  for (const shell of shells) {
    const minX = shell.rect.origin.x - radius;
    const maxX = shell.rect.origin.x + shell.rect.width + radius;
    const minZ = shell.rect.origin.z - radius;
    const maxZ = shell.rect.origin.z + shell.rect.depth + radius;
    const maxY = shell.height + 0.5;

    if (
      resolvedY >= 0 &&
      resolvedY < maxY &&
      resolvedX > minX &&
      resolvedX < maxX &&
      resolvedZ > minZ &&
      resolvedZ < maxZ
    ) {
      // Find shortest ejection vector among the 4 sides
      const dMinX = resolvedX - minX;
      const dMaxX = maxX - resolvedX;
      const dMinZ = resolvedZ - minZ;
      const dMaxZ = maxZ - resolvedZ;

      const minDist = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);
      if (minDist === dMinX) {
        resolvedX = minX;
      } else if (minDist === dMaxX) {
        resolvedX = maxX;
      } else if (minDist === dMinZ) {
        resolvedZ = minZ;
      } else {
        resolvedZ = maxZ;
      }
    }
  }

  return { x: resolvedX, y: resolvedY, z: resolvedZ };
}

// --- Main Camera Rig Factory ---

const EYE_HEIGHT = 18;
const DEFAULT_MOVE_SPEED = 22;
const DEFAULT_ORBIT_RADIUS = 55;
const DEFAULT_ORBIT_HEIGHT = 26;
const DEFAULT_ORBIT_SPEED = 0.35;
const DEFAULT_BUMPER_MARGIN = 6;
const DEFAULT_BUMPER_STRENGTH = 35;
const DEFAULT_COLLISION_RADIUS = 1.2;
const MIN_ALTITUDE = 3.5;
const MAX_ALTITUDE = 60;
const DRAG_SENSITIVITY = 0.0035;
const INERTIA_DAMPING = 8.0; // deceleration rate per second

export function createCameraRig(
  camera: PerspectiveCamera,
  bounds: CameraBounds,
  options?: CameraRigOptions,
): CameraRig {
  const moveSpeed = options?.moveSpeed ?? DEFAULT_MOVE_SPEED;
  let orbitRadius = options?.orbitRadius ?? DEFAULT_ORBIT_RADIUS;
  let orbitHeight = options?.orbitHeight ?? DEFAULT_ORBIT_HEIGHT;
  let orbitSpeed = options?.orbitSpeed ?? DEFAULT_ORBIT_SPEED;
  let autoRotate = true;
  const bumperMargin = options?.bumperMargin ?? DEFAULT_BUMPER_MARGIN;
  const bumperStrength = options?.bumperStrength ?? DEFAULT_BUMPER_STRENGTH;
  const collisionRadius = options?.collisionRadius ?? DEFAULT_COLLISION_RADIUS;

  let buildingShells: readonly BuildingShell[] =
    options?.shells ?? (options?.layout ? createDefaultBuildingShells(options.layout, 1945) : sampleBuildingShellBounds());
  const poiCatalog: readonly PointOfInterest[] =
    options?.poiCatalog ?? createPoiCatalog(options?.layout);

  // Position and Orientation
  const pos = new Vector3(0, EYE_HEIGHT, 0);
  let yaw = Math.PI * 0.25;
  let pitch = -0.35;

  // Inertial velocities
  let moveVelX = 0;
  let moveVelZ = 0;
  let lookVelYaw = 0;
  let lookVelPitch = 0;

  // Input states
  const joy = { x: 0, y: 0 };
  const keys = new Set<string>();

  // Orbit state
  let orbitAngle = 0;
  let orbiting = false;

  // Fly-to state
  interface FlyToAnimation {
    active: boolean;
    startX: number;
    startY: number;
    startZ: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    startLookAtX: number;
    startLookAtY: number;
    startLookAtZ: number;
    targetLookAtX: number;
    targetLookAtY: number;
    targetLookAtZ: number;
    duration: number;
    elapsed: number;
    onComplete?: () => void;
  }

  const flyState: FlyToAnimation = {
    active: false,
    startX: 0,
    startY: 0,
    startZ: 0,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    startLookAtX: 0,
    startLookAtY: 0,
    startLookAtZ: 0,
    targetLookAtX: 0,
    targetLookAtY: 0,
    targetLookAtZ: 0,
    duration: 1.5,
    elapsed: 0,
  };

  function applyOrientation(): void {
    camera.position.copy(pos);
    camera.lookAt(
      pos.x + Math.sin(yaw) * Math.cos(pitch),
      pos.y + Math.sin(pitch),
      pos.z + Math.cos(yaw) * Math.cos(pitch),
    );
  }

  // Soft bumper and boundary enforcement
  function applyBumpersAndSafetyBounds(dt: number): void {
    const push = calculateBumperPush(
      { x: pos.x, z: pos.z },
      bounds,
      bumperMargin,
      bumperStrength,
    );
    pos.x += push.pushX * dt;
    pos.z += push.pushZ * dt;

    // Hard safety envelope (outer margin prevents clipping out to infinity)
    const safetyMargin = bumperMargin * 1.5;
    pos.x = Math.max(bounds.minX - safetyMargin, Math.min(bounds.maxX + safetyMargin, pos.x));
    pos.z = Math.max(bounds.minZ - safetyMargin, Math.min(bounds.maxZ + safetyMargin, pos.z));
    pos.y = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, pos.y));
  }

  // Collision handling with building shells
  function applyCollisionResolution(): void {
    const resolved = resolveBuildingCollision(
      { x: pos.x, y: pos.y, z: pos.z },
      buildingShells,
      collisionRadius,
    );
    pos.x = resolved.x;
    pos.y = resolved.y;
    pos.z = resolved.z;
  }

  // --- Fly-To Logic ---

  function flyTo(
    targetPos: { x: number; y: number; z: number },
    targetLookAt: { x: number; y: number; z: number },
    duration: number = 1.5,
    onComplete?: () => void,
  ): void {
    orbiting = false;
    flyState.startX = pos.x;
    flyState.startY = pos.y;
    flyState.startZ = pos.z;
    flyState.targetX = targetPos.x;
    flyState.targetY = targetPos.y;
    flyState.targetZ = targetPos.z;

    flyState.startLookAtX = pos.x + Math.sin(yaw) * Math.cos(pitch) * 10;
    flyState.startLookAtY = pos.y + Math.sin(pitch) * 10;
    flyState.startLookAtZ = pos.z + Math.cos(yaw) * Math.cos(pitch) * 10;

    flyState.targetLookAtX = targetLookAt.x;
    flyState.targetLookAtY = targetLookAt.y;
    flyState.targetLookAtZ = targetLookAt.z;

    flyState.duration = Math.max(0.2, duration);
    flyState.elapsed = 0;
    flyState.active = true;
    flyState.onComplete = onComplete;
  }

  function flyToPoi(poiOrIdOrNum: PointOfInterest | string | number, duration?: number): boolean {
    let targetPoi: PointOfInterest | undefined;
    if (typeof poiOrIdOrNum === 'object' && poiOrIdOrNum !== null) {
      targetPoi = poiOrIdOrNum;
    } else if (typeof poiOrIdOrNum === 'number') {
      targetPoi = findPoiByNumber(poiCatalog, poiOrIdOrNum);
    } else if (typeof poiOrIdOrNum === 'string') {
      targetPoi = findPoiById(poiCatalog, poiOrIdOrNum);
    }

    if (!targetPoi) return false;
    flyTo(targetPoi.position, targetPoi.lookAt, duration);
    return true;
  }

  function cancelFlyTo(): void {
    flyState.active = false;
  }

  // --- Orbit Mode Logic ---

  function startOrbit(): void {
    flyState.active = false;
    orbiting = true;
    orbitAngle = Math.atan2(pos.z, pos.x);
  }

  function stopOrbit(): void {
    orbiting = false;
  }

  function toggleOrbit(): void {
    if (orbiting) {
      stopOrbit();
    } else {
      startOrbit();
    }
  }

  function setOrbitHeight(height: number): void {
    orbitHeight = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, height));
  }

  function setOrbitRadius(radius: number): void {
    orbitRadius = Math.max(10, Math.min(120, radius));
  }

  function setOrbitSpeed(speed: number): void {
    orbitSpeed = speed;
  }

  function setAutoRotate(enabled: boolean): void {
    autoRotate = enabled;
  }

  // --- Touch & Zoom Fine-Tuning ---

  function zoom(delta: number): void {
    if (orbiting) {
      setOrbitRadius(orbitRadius + delta * 2.0);
    } else {
      // Move camera forward/backward along viewing ray
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const sinP = Math.sin(pitch);
      const cosP = Math.cos(pitch);

      const fwdX = sin * cosP;
      const fwdY = sinP;
      const fwdZ = cos * cosP;

      pos.x += fwdX * delta * 5.0;
      pos.y += fwdY * delta * 5.0;
      pos.z += fwdZ * delta * 5.0;
      applyBumpersAndSafetyBounds(0.016);
      applyCollisionResolution();
    }
    applyOrientation();
  }

  function handlePinch(scaleDelta: number): void {
    zoom(scaleDelta);
  }

  function look(dx: number, dy: number): void {
    if (flyState.active) {
      cancelFlyTo();
    }
    // Apply drag sensitivity tuning and feed look inertia
    const deltaYaw = -dx * DRAG_SENSITIVITY;
    const deltaPitch = -dy * DRAG_SENSITIVITY;
    yaw += deltaYaw;
    pitch += deltaPitch;
    pitch = Math.max(-1.4, Math.min(1.4, pitch));

    lookVelYaw = deltaYaw * 30;
    lookVelPitch = deltaPitch * 30;
  }

  function setJoystick(x: number, y: number): void {
    joy.x = Math.max(-1, Math.min(1, x));
    joy.y = Math.max(-1, Math.min(1, y));
  }

  function setBuildingShells(shells: readonly BuildingShell[]): void {
    buildingShells = shells;
  }

  // --- Main Update Loop ---

  function update(dt: number): void {
    const clampedDt = Math.max(0, dt);

    // 1. POI Fly-To State
    if (flyState.active) {
      flyState.elapsed += clampedDt;
      const t = Math.min(1, flyState.elapsed / flyState.duration);
      const easeT = easeInOutCubic(t);

      // Interpolate position
      pos.x = flyState.startX + (flyState.targetX - flyState.startX) * easeT;
      pos.y = flyState.startY + (flyState.targetY - flyState.startY) * easeT;
      pos.z = flyState.startZ + (flyState.targetZ - flyState.startZ) * easeT;

      // Interpolate look-at target and compute orientation
      const currentLookAtX =
        flyState.startLookAtX + (flyState.targetLookAtX - flyState.startLookAtX) * easeT;
      const currentLookAtY =
        flyState.startLookAtY + (flyState.targetLookAtY - flyState.startLookAtY) * easeT;
      const currentLookAtZ =
        flyState.startLookAtZ + (flyState.targetLookAtZ - flyState.startLookAtZ) * easeT;

      const dirX = currentLookAtX - pos.x;
      const dirY = currentLookAtY - pos.y;
      const dirZ = currentLookAtZ - pos.z;
      const horizDist = Math.hypot(dirX, dirZ);

      yaw = Math.atan2(dirX, dirZ);
      pitch = Math.atan2(dirY, Math.max(0.001, horizDist));
      pitch = Math.max(-1.4, Math.min(1.4, pitch));

      applyOrientation();

      if (t >= 1) {
        flyState.active = false;
        flyState.onComplete?.();
      }
      return;
    }

    // 2. Orbit Mode
    if (orbiting) {
      if (autoRotate) {
        orbitAngle += orbitSpeed * clampedDt;
      }
      pos.x = Math.cos(orbitAngle) * orbitRadius;
      pos.z = Math.sin(orbitAngle) * orbitRadius;
      pos.y = orbitHeight;

      // Face block center (0, 0, 0)
      yaw = Math.atan2(0 - pos.x, 0 - pos.z);
      pitch = Math.atan2(4 - pos.y, Math.hypot(pos.x, pos.z));
      pitch = Math.max(-1.4, Math.min(1.4, pitch));

      applyBumpersAndSafetyBounds(clampedDt);
      applyOrientation();
      return;
    }

    // 3. Free-Fly Mode: WASD + Joystick + Inertia Damping
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
      // Cancel fly-to on active user key input
      if (flyState.active) cancelFlyTo();

      ix /= len;
      iz /= len;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const targetVelX = (ix * cos - iz * sin) * moveSpeed;
      const targetVelZ = (ix * sin + iz * cos) * moveSpeed;

      // Acceleration towards target input
      moveVelX += (targetVelX - moveVelX) * Math.min(1, 12.0 * clampedDt);
      moveVelZ += (targetVelZ - moveVelZ) * Math.min(1, 12.0 * clampedDt);
    } else {
      // Inertia damping deceleration
      const damp = Math.exp(-INERTIA_DAMPING * clampedDt);
      moveVelX *= damp;
      moveVelZ *= damp;
    }

    // Apply look inertia damping
    if (Math.abs(lookVelYaw) > 0.001 || Math.abs(lookVelPitch) > 0.001) {
      const lookDamp = Math.exp(-INERTIA_DAMPING * clampedDt);
      yaw += lookVelYaw * clampedDt;
      pitch += lookVelPitch * clampedDt;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      lookVelYaw *= lookDamp;
      lookVelPitch *= lookDamp;
    }

    // Apply movement velocity
    pos.x += moveVelX * clampedDt;
    pos.z += moveVelZ * clampedDt;

    // Apply soft bumpers and collision avoidance
    applyBumpersAndSafetyBounds(clampedDt);
    applyCollisionResolution();
    applyOrientation();
  }

  // --- Browser & Window Event Listeners ---

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keys.add(key);

    if (options?.enableKeyboardPoiJump !== false) {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        flyToPoi(num);
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };

  const onDoubleClick = () => {
    if (options?.enableDoubleClickFlyTo === false) return;
    // When double clicking in the viewport, find nearest POI or fly towards click
    const nearest = findNearestPoi(poiCatalog, { x: pos.x, y: pos.y, z: pos.z });
    if (nearest) {
      flyToPoi(nearest);
    }
  };

  // Touch pinch zoom handling
  let touchStartDist = 0;
  const onTouchStart = (e: TouchEvent) => {
    if (options?.enableTouchControls === false) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.hypot(dx, dy);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (options?.enableTouchControls === false) return;
    if (e.touches.length === 2 && touchStartDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (touchStartDist - dist) * 0.05;
      handlePinch(delta);
      touchStartDist = dist;
    }
  };

  const onTouchEnd = () => {
    touchStartDist = 0;
  };

  const onWheel = (e: WheelEvent) => {
    zoom(e.deltaY * 0.01);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
  }

  applyOrientation();

  return {
    update,
    look,
    setJoystick,
    startOrbit,
    stopOrbit,
    toggleOrbit,
    get orbiting() {
      return orbiting;
    },
    get position() {
      return pos;
    },
    flyTo,
    flyToPoi,
    cancelFlyTo,
    get isFlying() {
      return flyState.active;
    },
    setOrbitHeight,
    setOrbitRadius,
    setOrbitSpeed,
    setAutoRotate,
    get orbitHeight() {
      return orbitHeight;
    },
    get orbitRadius() {
      return orbitRadius;
    },
    get autoRotate() {
      return autoRotate;
    },
    handlePinch,
    zoom,
    setBuildingShells,
    get buildingShells() {
      return buildingShells;
    },
    get poiCatalog() {
      return poiCatalog;
    },
    get mode() {
      if (flyState.active) return 'fly-to';
      if (orbiting) return 'orbit';
      return 'free-fly';
    },
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('dblclick', onDoubleClick);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('wheel', onWheel);
      }
      keys.clear();
      joy.x = 0;
      joy.y = 0;
    },
  };
}
