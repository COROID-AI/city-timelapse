import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { ERA_1965_PALETTE } from './palette';
import { createBox } from './textures';

/**
 * 1965 Period Vehicles Module:
 * 1. Wide-Finned 1960s Sedan (dual headlights, chrome grille, prominent pointed tailfins)
 * 2. 1960s Convertible (open cabin, steering wheel, bench seat, sleek fins)
 * 3. VW Beetle-Style Compact Car (rounded dome shell, curved front hood, split rear window)
 * 4. 1960s Delivery Van (boxy step-van, ribbed side panels, step bumper)
 *
 * Includes traffic loop simulation with realistic speeds and turning around the block perimeter.
 */

export interface VehicleInstance {
  readonly id: string;
  readonly type: 'finned_sedan' | 'convertible' | 'compact_beetle' | 'delivery_van';
  readonly name: string;
  readonly root: Object3D;
  speed: number;
  progress: number;
  segmentIndex: number;
}

export interface VehicleSystem {
  readonly root: Object3D;
  readonly vehicles: readonly VehicleInstance[];
  update(dt: number): void;
}

/**
 * Helper to build 4 wheels with chrome hubcaps and rubber tires.
 */
function addWheels(
  root: Object3D,
  trackWidth: number,
  wheelbase: number,
  wheelRadius = 0.35,
  wheelThickness = 0.22,
): void {
  const xs = [-trackWidth / 2, trackWidth / 2];
  const zs = [-wheelbase / 2, wheelbase / 2];

  for (const x of xs) {
    for (const z of zs) {
      // Rubber tire
      const tire = createBox(
        wheelThickness,
        wheelRadius * 2,
        wheelRadius * 2,
        ERA_1965_PALETTE.vehicles.tireRubber,
        x,
        wheelRadius,
        z,
      );
      // Chrome hubcap
      const hubcap = createBox(
        wheelThickness + 0.04,
        wheelRadius * 1.1,
        wheelRadius * 1.1,
        ERA_1965_PALETTE.vehicles.chromeBumper,
        x,
        wheelRadius,
        z,
      );
      root.add(tire, hubcap);
    }
  }
}

/**
 * 1. Wide-Finned 1960s Sedan
 */
export function createFinnedSedan(bodyColorHex: number): Object3D {
  const root = new Object3D();

  // Lower chassis and main body
  const body = createBox(2.2, 0.65, 5.4, bodyColorHex, 0, 0.65, 0);
  root.add(body);

  // Chrome bumpers (front and rear)
  const frontBumper = createBox(
    2.3,
    0.25,
    0.3,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.45,
    2.8,
  );
  const rearBumper = createBox(
    2.3,
    0.25,
    0.3,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.45,
    -2.8,
  );
  root.add(frontBumper, rearBumper);

  // Dual headlights + horizontal chrome grille
  const grille = createBox(
    1.9,
    0.3,
    0.1,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.65,
    2.72,
  );
  const headlightL = createBox(0.4, 0.2, 0.12, 0xffffff, -0.75, 0.65, 2.72);
  const headlightR = createBox(0.4, 0.2, 0.12, 0xffffff, 0.75, 0.65, 2.72);
  root.add(grille, headlightL, headlightR);

  // Greenhouse cabin with wraparound windshield and rear window
  const cabin = createBox(1.9, 0.65, 2.6, 0x111111, 0, 1.25, -0.2);
  const roof = createBox(1.95, 0.08, 2.7, 0xffffff, 0, 1.6, -0.2); // two-tone roof
  const windshield = createBox(1.8, 0.55, 0.05, 0x70d6ff, 0, 1.25, 1.12);
  const rearWindow = createBox(1.8, 0.55, 0.05, 0x70d6ff, 0, 1.25, -1.52);
  root.add(cabin, roof, windshield, rearWindow);

  // Prominent angled tailfins with bullet taillights
  const finL = createBox(0.12, 0.45, 1.6, bodyColorHex, -1.05, 1.1, -1.9);
  const finR = createBox(0.12, 0.45, 1.6, bodyColorHex, 1.05, 1.1, -1.9);
  const tailLightL = createBox(0.14, 0.14, 0.1, 0xff0000, -1.05, 1.25, -2.72);
  const tailLightR = createBox(0.14, 0.14, 0.1, 0xff0000, 1.05, 1.25, -2.72);
  root.add(finL, finR, tailLightL, tailLightR);

  addWheels(root, 2.1, 3.2);

  return root;
}

/**
 * 2. 1960s Convertible (open-top cruiser)
 */
export function createConvertible(bodyColorHex: number): Object3D {
  const root = new Object3D();

  // Long sleek body
  const body = createBox(2.2, 0.6, 5.2, bodyColorHex, 0, 0.6, 0);
  root.add(body);

  // Chrome bumpers
  const frontBumper = createBox(
    2.25,
    0.22,
    0.25,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.42,
    2.7,
  );
  const rearBumper = createBox(
    2.25,
    0.22,
    0.25,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.42,
    -2.7,
  );
  root.add(frontBumper, rearBumper);

  // Open cabin interior (red/cream vinyl bench)
  const cabinWell = createBox(1.8, 0.4, 2.2, 0x111111, 0, 0.75, -0.1);
  const benchSeat = createBox(1.6, 0.4, 0.6, 0x8b0000, 0, 0.8, -0.6);
  const steeringWheel = createBox(
    0.4,
    0.4,
    0.05,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    -0.45,
    1.05,
    0.4,
  );
  root.add(cabinWell, benchSeat, steeringWheel);

  // Slanted chrome-framed windshield
  const windshield = createBox(1.9, 0.5, 0.08, 0x70d6ff, 0, 1.15, 0.85);
  windshield.rotation.x = 0.35;
  root.add(windshield);

  // Sleek rear fins
  const finL = createBox(0.1, 0.35, 1.4, bodyColorHex, -1.05, 1.0, -1.9);
  const finR = createBox(0.1, 0.35, 1.4, bodyColorHex, 1.05, 1.0, -1.9);
  const tailLightL = createBox(0.12, 0.12, 0.1, 0xff0000, -1.05, 1.1, -2.62);
  const tailLightR = createBox(0.12, 0.12, 0.1, 0xff0000, 1.05, 1.1, -2.62);
  root.add(finL, finR, tailLightL, tailLightR);

  addWheels(root, 2.0, 3.0);

  return root;
}

/**
 * 3. VW Beetle-Style Compact Car
 */
export function createCompactBeetle(bodyColorHex: number): Object3D {
  const root = new Object3D();

  // Lower chassis
  const chassis = createBox(1.7, 0.45, 3.8, bodyColorHex, 0, 0.5, 0);
  root.add(chassis);

  // Rounded dome cabin (stepped boxes creating beetle curved profile)
  const domeMid = createBox(1.5, 0.7, 2.2, bodyColorHex, 0, 1.0, -0.2);
  const domeTop = createBox(1.3, 0.4, 1.4, bodyColorHex, 0, 1.45, -0.3);
  root.add(domeMid, domeTop);

  // Sloping front hood
  const frontHood = createBox(1.4, 0.35, 1.1, bodyColorHex, 0, 0.75, 1.25);
  frontHood.rotation.x = -0.2;
  root.add(frontHood);

  // Curved front & rear chrome tubular bumpers
  const frontBumper = createBox(
    1.75,
    0.15,
    0.15,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.35,
    2.0,
  );
  const rearBumper = createBox(
    1.75,
    0.15,
    0.15,
    ERA_1965_PALETTE.vehicles.chromeBumper,
    0,
    0.35,
    -2.0,
  );
  root.add(frontBumper, rearBumper);

  // Round headlights on front fenders
  const headL = createBox(0.25, 0.25, 0.12, 0xffffff, -0.6, 0.65, 1.8);
  const headR = createBox(0.25, 0.25, 0.12, 0xffffff, 0.6, 0.65, 1.8);
  root.add(headL, headR);

  // Windows
  const frontGlass = createBox(1.2, 0.4, 0.05, 0x70d6ff, 0, 1.15, 0.92);
  const rearGlass = createBox(1.1, 0.35, 0.05, 0x70d6ff, 0, 1.15, -1.32);
  root.add(frontGlass, rearGlass);

  addWheels(root, 1.6, 2.3, 0.3, 0.18);

  return root;
}

/**
 * 4. 1960s Delivery Van (Step-van)
 */
export function createDeliveryVan(bodyColorHex: number): Object3D {
  const root = new Object3D();

  // Boxy tall van body
  const body = createBox(2.2, 2.2, 4.8, bodyColorHex, 0, 1.5, 0);
  root.add(body);

  // Commercial side branding band (e.g. "DAILY FRESH BAKERY")
  const signBandL = createBox(
    0.05,
    0.8,
    3.6,
    ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    -1.12,
    1.6,
    0,
  );
  const signBandR = createBox(
    0.05,
    0.8,
    3.6,
    ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    1.12,
    1.6,
    0,
  );
  root.add(signBandL, signBandR);

  // Split front windshield
  const windshieldL = createBox(0.85, 0.65, 0.05, 0x70d6ff, -0.5, 1.85, 2.42);
  const windshieldR = createBox(0.85, 0.65, 0.05, 0x70d6ff, 0.5, 1.85, 2.42);
  root.add(windshieldL, windshieldR);

  // Heavy steel bumper and radiator grille
  const frontBumper = createBox(2.3, 0.3, 0.25, 0x333333, 0, 0.45, 2.5);
  const rearStep = createBox(2.3, 0.15, 0.4, 0x333333, 0, 0.4, -2.55);
  const grille = createBox(1.4, 0.5, 0.08, 0x222222, 0, 0.9, 2.42);
  const headL = createBox(0.25, 0.25, 0.08, 0xffffff, -0.85, 0.9, 2.42);
  const headR = createBox(0.25, 0.25, 0.08, 0xffffff, 0.85, 0.9, 2.42);
  root.add(frontBumper, rearStep, grille, headL, headR);

  addWheels(root, 2.1, 2.8, 0.38, 0.24);

  return root;
}

/**
 * Builds the complete 1965 Vehicle fleet and traffic loop.
 */
export function create1965Vehicles(layout: CityBlockLayout): VehicleSystem {
  const root = new Object3D();
  const vehicles: VehicleInstance[] = [];

  // Define perimeter loop waypoints around the street ring
  const pad = 4;
  const minX = layout.bounds.minX + pad;
  const maxX = layout.bounds.maxX - pad;
  const minZ = layout.bounds.minZ + pad;
  const maxZ = layout.bounds.maxZ - pad;

  const loopWaypoints = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];

  // 1. Turquoise Finned Sedan
  const sedan1 = createFinnedSedan(ERA_1965_PALETTE.vehicles.finnedSedanTurquoise);
  root.add(sedan1);
  vehicles.push({
    id: 'veh-finned-sedan-1',
    type: 'finned_sedan',
    name: '1962 Horizon V8 Sedan',
    root: sedan1,
    speed: 12.0,
    progress: 0.0,
    segmentIndex: 0,
  });

  // 2. Cherry Red Finned Sedan
  const sedan2 = createFinnedSedan(ERA_1965_PALETTE.vehicles.finnedSedanCherryRed);
  root.add(sedan2);
  vehicles.push({
    id: 'veh-finned-sedan-2',
    type: 'finned_sedan',
    name: '1960 Crimson Cruiser Sedan',
    root: sedan2,
    speed: 11.0,
    progress: 0.5,
    segmentIndex: 1,
  });

  // 3. Canary Yellow Convertible
  const convertible = createConvertible(ERA_1965_PALETTE.vehicles.convertibleCanaryYellow);
  root.add(convertible);
  vehicles.push({
    id: 'veh-convertible',
    type: 'convertible',
    name: '1964 Sunfire V8 Convertible',
    root: convertible,
    speed: 14.0,
    progress: 0.25,
    segmentIndex: 2,
  });

  // 4. Pastel Blue VW Beetle Compact
  const beetle = createCompactBeetle(ERA_1965_PALETTE.vehicles.beetlePastelBlue);
  root.add(beetle);
  vehicles.push({
    id: 'veh-compact-beetle',
    type: 'compact_beetle',
    name: '1965 Compact De Luxe',
    root: beetle,
    speed: 9.5,
    progress: 0.75,
    segmentIndex: 3,
  });

  // 5. Cream Step Delivery Van
  const van = createDeliveryVan(ERA_1965_PALETTE.vehicles.deliveryVanCream);
  root.add(van);
  vehicles.push({
    id: 'veh-delivery-van',
    type: 'delivery_van',
    name: '1963 Metro Step Delivery Van',
    root: van,
    speed: 8.5,
    progress: 0.85,
    segmentIndex: 0,
  });

  function segmentLength(seg: number): number {
    const a = loopWaypoints[seg];
    const b = loopWaypoints[(seg + 1) % loopWaypoints.length];
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  function updateVehicles(dt: number): void {
    for (const v of vehicles) {
      let remaining = v.speed * dt;
      while (remaining > 0) {
        const len = segmentLength(v.segmentIndex);
        const dist = remaining;
        remaining = 0;
        const frac = dist / len;
        if (v.progress + frac >= 1) {
          remaining = (v.progress + frac - 1) * len;
          v.progress = 0;
          v.segmentIndex = (v.segmentIndex + 1) % loopWaypoints.length;
        } else {
          v.progress += frac;
        }
      }

      const a = loopWaypoints[v.segmentIndex];
      const b = loopWaypoints[(v.segmentIndex + 1) % loopWaypoints.length];
      const x = a.x + (b.x - a.x) * v.progress;
      const z = a.z + (b.z - a.z) * v.progress;

      v.root.position.set(x, 0, z);
      const angle = Math.atan2(b.x - a.x, b.z - a.z);
      v.root.rotation.y = angle;
    }
  }

  // Initial placement
  updateVehicles(0.001);

  return {
    root,
    vehicles,
    update(dt: number) {
      updateVehicles(dt);
    },
  };
}
