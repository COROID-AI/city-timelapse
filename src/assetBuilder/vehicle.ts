/**
 * Vehicle factory for the city timelapse.
 *
 * Builds a detailed, low-poly vehicle rig (body + cabin + windows + wheels +
 * lights) as a `THREE.Group`. Two placement modes are supported:
 *
 * - `drive`: wheels are aligned to the lane heading; front wheels yaw by the
 *   steer angle and all wheels are pre-rolled so the animation loop can spin
 *   them around their exposed pivot.
 * - `park`: the rig is rotated to the parking spot angle, wheels are locked
 *   straight, and the driver door is opened by the configured angle.
 *
 * The factory is intentionally self-contained: it depends only on `three` and
 * on a small spec interface (see {@link VehicleSpec}) so it can be unit-tested
 * and composed before the era dataset exists. The spec mirrors the shapes in
 * `src/eras/types.ts` (`VehicleRig`, `DrivePose`, `ParkPose`, `VehicleVariant`).
 */

import * as THREE from 'three';

import type {
  DrivePose,
  ParkPose,
  VehicleVariant,
  WheelPosition,
} from '../eras/types';

/** Placement mode requested by the caller. */
export type VehicleMode = 'drive' | 'park';

/**
 * Minimal spec consumed by {@link createVehicle}. It mirrors the
 * `VehicleRig`/`EraPalette` subset needed to build a single vehicle without
 * pulling in the full `EraContent` tree.
 */
export interface VehicleSpec {
  /** Body shape variant. */
  variant: VehicleVariant;
  /** Base body color (CSS/hex string). */
  color: string;
  /** Glass color for windows/windshield. */
  glassColor?: string;
  /** Drive pose applied in `'drive'` mode. */
  drive: DrivePose;
  /** Park pose applied in `'park'` mode. */
  park: ParkPose;
  /** Heading (yaw, radians) the vehicle faces while driving. */
  heading?: number;
  /** Spot yaw (radians) applied while parked. */
  spotAngle?: number;
}

/** Wheel pivot metadata exposed on the rig's `userData` for the animator. */
export interface WheelPivotMeta {
  /** The named wheel positions, in axle order (FL, FR, RL, RR). */
  positions: WheelPosition[];
  /** Map from position -> pivot object whose `.rotation.z` spins the wheel. */
  pivots: Record<WheelPosition, THREE.Object3D>;
  /** Whether the wheels are locked (park) or free to spin (drive). */
  locked: boolean;
}

/** Per-variant body dimensions, tuned to read well at city scale (~4-8 m). */
interface BodyDimensions {
  /** Body length along the local X (forward) axis, in metres. */
  length: number;
  /** Body width across the local Z axis, in metres. */
  width: number;
  /** Body height of the lower chassis, in metres. */
  height: number;
  /** Cabin height (above the chassis), in metres. */
  cabinHeight: number;
  /** Cabin length along the X axis, in metres. */
  cabinLength: number;
  /** Wheel radius, in metres. */
  wheelRadius: number;
  /** Wheel width, in metres. */
  wheelWidth: number;
}

const VARIANT_DIMENSIONS: Record<VehicleVariant, BodyDimensions> = {
  car: {
    length: 4.2,
    width: 1.8,
    height: 0.7,
    cabinHeight: 0.6,
    cabinLength: 2.0,
    wheelRadius: 0.34,
    wheelWidth: 0.22,
  },
  truck: {
    length: 7.0,
    width: 2.2,
    height: 1.1,
    cabinHeight: 1.1,
    cabinLength: 2.2,
    wheelRadius: 0.5,
    wheelWidth: 0.32,
  },
};

const WHEEL_POSITIONS: WheelPosition[] = [
  'wheel_FL',
  'wheel_FR',
  'wheel_RL',
  'wheel_RR',
];

/**
 * Build a single wheel as a pivot group containing a rim cylinder and a black
 * tyre. The pivot sits at the axle center; the mesh rolls by rotating the
 * pivot around its local Z (axle) axis.
 */
function buildWheel(radius: number, width: number): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = 'wheelPivot';

  const tyreGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  tyreGeo.rotateX(Math.PI / 2); // lay the cylinder so its axis is along Z
  const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
    metalness: 0.1,
  });
  const tyre = new THREE.Mesh(tyreGeo, tyreMat);
  tyre.name = 'tyre';
  pivot.add(tyre);

  const rimRadius = radius * 0.55;
  const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.01, 12);
  rimGeo.rotateX(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xc9ccd1,
    roughness: 0.35,
    metalness: 0.8,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.name = 'rim';
  pivot.add(rim);

  return pivot;
}

/**
 * Assemble all four wheels under a `wheels` group with named children. Returns
 * the group plus a map of named pivot groups so the animator can spin them.
 */
function buildWheels(
  dims: BodyDimensions,
): { group: THREE.Group; pivots: Record<WheelPosition, THREE.Group> } {
  const group = new THREE.Group();
  group.name = 'wheels';

  const halfLen = dims.length * 0.32;
  const halfTrack = dims.width * 0.42;

  const offsets: Record<WheelPosition, [number, number]> = {
    wheel_FL: [halfLen, -halfTrack],
    wheel_FR: [halfLen, halfTrack],
    wheel_RL: [-halfLen, -halfTrack],
    wheel_RR: [-halfLen, halfTrack],
  };

  const pivots = {} as Record<WheelPosition, THREE.Group>;
  for (const pos of WHEEL_POSITIONS) {
    const wheel = buildWheel(dims.wheelRadius, dims.wheelWidth);
    wheel.name = pos;
    const [x, z] = offsets[pos];
    wheel.position.set(x, dims.wheelRadius, z);
    group.add(wheel);
    pivots[pos] = wheel;
  }

  return { group, pivots };
}

/** Build the chassis + cabin body group with windows and lights. */
function buildBody(
  dims: BodyDimensions,
  color: string,
  glassColor: string,
): THREE.Group {
  const body = new THREE.Group();
  body.name = 'chassis';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.45,
    metalness: 0.55,
  });

  // Lower chassis box, centered so its bottom sits at wheel-center height.
  const chassisGeo = new THREE.BoxGeometry(dims.length, dims.height, dims.width);
  const chassisY = dims.wheelRadius + dims.height * 0.5;
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.name = 'body';
  chassis.position.y = chassisY;
  body.add(chassis);

  // Cabin box on top of the chassis. For trucks this is the cab at the front.
  const cabinLen = dims.cabinLength;
  const cabinGeo = new THREE.BoxGeometry(cabinLen, dims.cabinHeight, dims.width * 0.92);
  const cabinY = chassisY + dims.height * 0.5 + dims.cabinHeight * 0.5;
  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.name = 'cabin';
  // Truck cab sits forward; car cabin is centered.
  const cabinX = dims.length > 5 ? dims.length * 0.5 - cabinLen * 0.5 - 0.1 : 0;
  cabin.position.set(cabinX, cabinY, 0);
  body.add(cabin);

  // --- Windows ---
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glassColor),
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.6,
  });
  const glass = new THREE.Group();
  glass.name = 'windows';

  const glassThickness = 0.04;
  const glassW = dims.width * 0.86;

  // Windshield (front face of cabin).
  const windshieldGeo = new THREE.BoxGeometry(glassThickness, dims.cabinHeight * 0.6, glassW);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.name = 'windshield';
  windshield.position.set(cabinX + cabinLen * 0.5, cabinY, 0);
  glass.add(windshield);

  // Rear window.
  const rearGeo = new THREE.BoxGeometry(glassThickness, dims.cabinHeight * 0.55, glassW);
  const rear = new THREE.Mesh(rearGeo, glassMat);
  rear.name = 'rearWindow';
  rear.position.set(cabinX - cabinLen * 0.5, cabinY, 0);
  glass.add(rear);

  // Side windows.
  const sideLen = cabinLen * 0.8;
  const sideGeo = new THREE.BoxGeometry(sideLen, dims.cabinHeight * 0.45, glassThickness);
  const sideL = new THREE.Mesh(sideGeo, glassMat);
  sideL.name = 'sideWindowL';
  sideL.position.set(cabinX, cabinY, dims.width * 0.46);
  glass.add(sideL);
  const sideR = new THREE.Mesh(sideGeo, glassMat);
  sideR.name = 'sideWindowR';
  sideR.position.set(cabinX, cabinY, -dims.width * 0.46);
  glass.add(sideR);

  body.add(glass);

  // --- Lights ---
  const lights = new THREE.Group();
  lights.name = 'lights';

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff4cc,
    emissive: new THREE.Color(0xfff0a8),
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x551111,
    emissive: new THREE.Color(0xff2200),
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });

  const lightRadius = dims.width * 0.09;
  const lightGeo = new THREE.SphereGeometry(lightRadius, 8, 8);

  const headX = dims.length * 0.5;
  const headZ = dims.width * 0.32;
  const headY = chassisY;
  const headL = new THREE.Mesh(lightGeo, headlightMat);
  headL.name = 'headlightL';
  headL.position.set(headX, headY, headZ);
  lights.add(headL);
  const headR = new THREE.Mesh(lightGeo, headlightMat);
  headR.name = 'headlightR';
  headR.position.set(headX, headY, -headZ);
  lights.add(headR);

  const tailX = -dims.length * 0.5;
  const tailL = new THREE.Mesh(lightGeo, taillightMat);
  tailL.name = 'taillightL';
  tailL.position.set(tailX, headY, headZ);
  lights.add(tailL);
  const tailR = new THREE.Mesh(lightGeo, taillightMat);
  tailR.name = 'taillightR';
  tailR.position.set(tailX, headY, -headZ);
  lights.add(tailR);

  body.add(lights);

  return body;
}

/**
 * Build a door mesh attached to a pivot on the cabin's left side so it can open
 * in park mode. Returns the pivot (whose `.rotation.y` opens the door) or null
 * if the variant shouldn't model a door.
 */
function buildDriverDoor(
  dims: BodyDimensions,
  color: string,
): THREE.Group | null {
  const doorLen = dims.cabinLength * 0.45;
  if (doorLen <= 0.3) return null;

  const pivot = new THREE.Group();
  pivot.name = 'doorPivot';

  const doorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.45,
    metalness: 0.55,
  });
  const doorGeo = new THREE.BoxGeometry(doorLen, dims.cabinHeight * 0.7, 0.06);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.name = 'door';
  // Mesh offset so its front edge sits at the pivot (hinge at the front).
  door.position.set(doorLen * 0.5, 0, 0);
  pivot.add(door);

  // Place the hinge at the front edge of the cabin on the left side.
  const cabinCenterX = dims.length > 5 ? dims.length * 0.5 - dims.cabinLength * 0.5 - 0.1 : 0;
  const hingeX = cabinCenterX + dims.cabinLength * 0.45;
  const chassisY = dims.wheelRadius + dims.height * 0.5;
  const doorY = chassisY + dims.height * 0.5 + dims.cabinHeight * 0.35;
  pivot.position.set(hingeX, doorY, dims.width * 0.5);

  return pivot;
}

/** Apply a roll angle to all four wheels, honoring per-wheel overrides. */
function applyWheelRoll(
  pivots: Record<WheelPosition, THREE.Group>,
  roll: number,
  overrides?: Partial<Record<WheelPosition, number>>,
): void {
  for (const pos of WHEEL_POSITIONS) {
    const angle = overrides?.[pos] ?? roll;
    pivots[pos].rotation.z = angle;
  }
}

/**
 * Create a detailed vehicle rig.
 *
 * The returned group has named children so downstream code and QA can assert
 * structure:
 * - `chassis` (body + cabin + windows + lights)
 * - `wheels` (with `wheel_FL/FR/RL/RR` pivot children)
 * - optionally `doorPivot` (driver door, opened in park mode)
 *
 * `group.userData.wheelPivots` exposes a {@link WheelPivotMeta} record for the
 * animation loop. In drive mode the front wheels are steered and the wheels are
 * free to spin; in park mode the wheels are locked straight, the door is opened
 * and the whole rig is yawed to the spot angle.
 */
export function createVehicle(spec: VehicleSpec, mode: VehicleMode): THREE.Group {
  const dims = VARIANT_DIMENSIONS[spec.variant];
  const glassColor = spec.glassColor ?? '#1b2a3a';

  const rig = new THREE.Group();
  rig.name = 'vehicle';

  const body = buildBody(dims, spec.color, glassColor);
  rig.add(body);

  const { group: wheels, pivots } = buildWheels(dims);
  rig.add(wheels);

  const door = buildDriverDoor(dims, spec.color);
  if (door) rig.add(door);

  const meta: WheelPivotMeta = {
    positions: [...WHEEL_POSITIONS],
    pivots: pivots as unknown as Record<WheelPosition, THREE.Object3D>,
    locked: false,
  };
  rig.userData.wheelPivots = meta;
  rig.userData.mode = mode;
  rig.userData.variant = spec.variant;

  if (mode === 'drive') {
    // Align the rig to the lane heading.
    rig.rotation.y = spec.heading ?? 0;

    // Steer the front axle; roll every wheel for motion.
    pivots.wheel_FL.rotation.y = spec.drive.steerYaw;
    pivots.wheel_FR.rotation.y = spec.drive.steerYaw;

    applyWheelRoll(pivots, spec.drive.wheelRoll, spec.drive.wheelRollOverrides);

    // Subtle chassis pitch from acceleration/braking.
    body.rotation.z = spec.drive.chassisPitch;
    meta.locked = false;
  } else {
    // Park: rotate to the spot angle, lock wheels straight, open the door.
    rig.rotation.y = spec.spotAngle ?? 0;

    for (const pos of WHEEL_POSITIONS) pivots[pos].rotation.set(0, spec.park.steerYaw, 0);
    if (door) door.rotation.y = spec.park.doorOpenAngle;

    meta.locked = true;
  }

  return rig;
}

/** Convenience helper to fetch the wheel pivot metadata from a rig. */
export function getWheelPivots(rig: THREE.Object3D): WheelPivotMeta | undefined {
  return rig.userData?.wheelPivots as WheelPivotMeta | undefined;
}
