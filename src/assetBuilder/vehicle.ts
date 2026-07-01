import * as THREE from 'three';
import { type Era, paletteFor } from './eras';

/** Coarse vehicle body shape; `truck` adds a taller cargo section. */
export type VehicleVariant = 'car' | 'truck';

/**
 * Parametric vehicle dimensions (metres), all derived from the era so the
 * silhouette evolves across time (long high fenders in 1945, low muscle in
 * 1965, boxy in 1985, taller SUV in 2005, sleek EV in 2025).
 */
export interface VehicleSpec {
  /** Bumper-to-bumper length. */
readonly length: number;
  /** Track width. */
  readonly width: number;
  /** Overall height (body + cabin). */
  readonly height: number;
  /** Greenhouse / cabin height. */
  readonly cabinHeight: number;
  /** Ground clearance. */
  readonly rideHeight: number;
  /** Wheel radius. */
  readonly wheelRadius: number;
}

const SPECS: Readonly<Record<Era, VehicleSpec>> = {
  1945: { length: 4.3, width: 1.8, height: 1.5, cabinHeight: 0.7, rideHeight: 0.35, wheelRadius: 0.42 },
  1965: { length: 5.1, width: 1.95, height: 1.3, cabinHeight: 0.6, rideHeight: 0.28, wheelRadius: 0.4 },
  1985: { length: 4.5, width: 1.72, height: 1.42, cabinHeight: 0.72, rideHeight: 0.3, wheelRadius: 0.36 },
  2005: { length: 4.7, width: 1.9, height: 1.62, cabinHeight: 0.85, rideHeight: 0.34, wheelRadius: 0.4 },
  2025: { length: 4.9, width: 1.98, height: 1.46, cabinHeight: 0.62, rideHeight: 0.26, wheelRadius: 0.38 },
};

/** Stretch a base car spec into a longer/taller truck variant. */
function truckSpec(base: VehicleSpec): VehicleSpec {
  return {
    ...base,
    length: base.length * 1.25,
    height: base.height * 1.1,
  };
}

/**
 * Builds a parametric vehicle as a Group. The returned group always contains a
 * child named `chassis` (body / cabin / trim) and a child group named `wheels`
 * (with individually named wheel meshes `wheel_FL`, `wheel_FR`, `wheel_RL`,
 * `wheel_RR`) so downstream animation hooks can spin the wheels and steer.
 *
 * Origin sits on the ground plane (y = 0) centred between the axles.
 */
export function makeVehicle(
  era: Era,
  variant: VehicleVariant = 'car',
): THREE.Group {
  const spec = variant === 'truck' ? truckSpec(SPECS[era]) : SPECS[era];
  const palette = paletteFor(era);

  const vehicle = new THREE.Group();
  vehicle.name = 'Vehicle';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.vehicleBody,
    metalness: 0.3,
    roughness: 0.6,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x223044,
    metalness: 0.4,
    roughness: 0.25,
    transparent: true,
    opacity: 0.8,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.vehicleTrim,
    metalness: 0.7,
    roughness: 0.35,
  });

  // ---- Chassis (body + cabin + trim) ----
  const chassis = new THREE.Group();
  chassis.name = 'chassis';

  const bodyHeight = Math.max(0.4, spec.height - spec.cabinHeight);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(spec.length, bodyHeight, spec.width),
    bodyMat,
  );
  body.position.y = spec.rideHeight + bodyHeight / 2;
  body.castShadow = true;
  body.name = 'body';
  chassis.add(body);

  const cabinLen = spec.length * (variant === 'truck' ? 0.28 : 0.42);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(cabinLen, spec.cabinHeight, spec.width * 0.9),
    glassMat,
  );
  cabin.position.set(
    -spec.length * 0.06,
    spec.rideHeight + bodyHeight + spec.cabinHeight / 2,
    0,
  );
  cabin.castShadow = true;
  cabin.name = 'cabin';
  chassis.add(cabin);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.length * 0.12, 0.18, spec.width * 1.02),
    trimMat,
  );
  bumper.position.set(spec.length * 0.46, spec.rideHeight + 0.2, 0);
  bumper.name = 'bumper';
  chassis.add(bumper);

  if (variant === 'truck') {
    const cargoH = spec.height * 0.95;
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(spec.length * 0.55, cargoH, spec.width * 0.98),
      bodyMat,
    );
    cargo.position.set(-spec.length * 0.18, spec.rideHeight + cargoH / 2, 0);
    cargo.castShadow = true;
    cargo.name = 'cargo';
    chassis.add(cargo);
  }

  vehicle.add(chassis);

  // ---- Wheels (named group + individually named meshes) ----
  const wheels = new THREE.Group();
  wheels.name = 'wheels';

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
  });
  const wheelGeo = new THREE.CylinderGeometry(
    spec.wheelRadius,
    spec.wheelRadius,
    0.28,
    16,
  );
  // Default cylinder axis is Y; rotate so the axle runs along X.
  wheelGeo.rotateZ(Math.PI / 2);

  const wx = spec.length * 0.34;
  const wz = spec.width / 2;
  const wy = spec.wheelRadius;
  const positions: ReadonlyArray<readonly [string, number, number]> = [
    ['wheel_FL', wx, wz],
    ['wheel_FR', wx, -wz],
    ['wheel_RL', -wx, wz],
    ['wheel_RR', -wx, -wz],
  ];
  for (const [name, x, z] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, wy, z);
    wheel.castShadow = true;
    wheel.name = name;
    wheels.add(wheel);
  }

  vehicle.add(wheels);
  return vehicle;
}
