/**
 * Era vehicle fleet catalog for the Timelapse City automobile module.
 *
 * Pure data: era-true vehicle kind definitions (silhouette dimensions, wheel
 * layouts, speeds, era paint palettes, chrome/plastic trim styles, lamp
 * anchors), the five per-era fleet rosters (1945 pre-war sedans/tram through
 * 2025 EVs/robotaxis), and the deterministic slot -> kind assignment used by
 * the traffic system. Geometry building lives in `models.ts`; simulation
 * lives in `traffic.ts`.
 *
 * No THREE.js or renderer dependencies: everything here is unit-testable.
 */

import type { EraYear } from '../../era/timeline';

/** Timeline era stops addressed by the fleet roster. */
export type FleetEra = EraYear;

/** All vehicle kinds that can appear across the five eras. */
export type VehicleKindId =
  | 'presedan'
  | 'streetcar'
  | 'deliverytruck'
  | 'chromesedan'
  | 'wagon'
  | 'citybus'
  | 'musclecar'
  | 'boxcoupe'
  | 'hatchback'
  | 'panelvan'
  | 'importcompact'
  | 'suv'
  | 'compact'
  | 'taxi'
  | 'bicycle'
  | 'evsedan'
  | 'scooter'
  | 'ebike'
  | 'robotaxi';

/** Broad body category used for callout facts and layout heuristics. */
export type VehicleCategory = 'car' | 'truck' | 'bus' | 'tram' | 'twoWheel';

/**
 * Trim material language for the era: bright chrome (pre-1970), chrome with
 * black rubber rub strips (1980s), body-colored/black plastic (2000s), and
 * satin black details (2020s EVs).
 */
export type VehicleTrimStyle = 'chrome' | 'chrome-rubber' | 'plastic' | 'satin';

/** Lamp pair anchor on the body: height above ground and center spacing. */
export interface VehicleLampSpec {
  /** Lamp height above the road surface (y, before variant scale). */
  readonly y: number;
  /** Distance between the two lamp centers across the body (x spread). */
  readonly spread: number;
}

/** Bumper anchor; two bumpers are drawn front and rear of every car. */
export interface VehicleBumperSpec {
  /** Bumper height above the road surface. */
  readonly y: number;
  /** Bumper bar height. */
  readonly height: number;
}

/** Optional chrome grille at the nose (pre-1990s kinds). */
export interface VehicleGrilleSpec {
  readonly y: number;
  readonly spread: number;
  readonly height: number;
}

/** Optional chrome/plastic side spear along the bodyside. */
export interface VehicleSideTrimSpec {
  readonly y: number;
  /** Center position along the body (local +Z is forward). */
  readonly z: number;
  readonly length: number;
}

/** One era-true vehicle kind: dimensions, stance, lamps, trim, paint. */
export interface VehicleKindDef {
  readonly id: VehicleKindId;
  /** Single era this kind belongs to (fleet rosters pick it per era). */
  readonly era: FleetEra;
  readonly label: string;
  readonly category: VehicleCategory;
  /** Callout copy describing the era-true details of this vehicle. */
  readonly description: string;
  /** Exposed as a pickable descriptor for navigation callouts. */
  readonly pickable: boolean;

  /** Overall length along travel direction (+Z local is forward). */
  readonly length: number;
  /** Overall width across travel direction. */
  readonly width: number;
  /** Overall height above the road surface. */
  readonly height: number;

  /** Rolling wheel radius; wheel centers sit at this height. */
  readonly wheelRadius: number;
  /** Wheel thickness along the axle. */
  readonly wheelWidth: number;
  /** Track: lateral distance between left and right wheel centers. */
  readonly track: number;
  /** Axle offsets along +Z (front positive, rear negative). */
  readonly axleFront: number;
  readonly axleRear: number;
  /** Whitewall tire ring (1940s/1950s style hub treatment). */
  readonly whitewall: boolean;

  /** Cruise speed in scene units/second (~1 unit = 1 meter). */
  readonly speed: number;
  readonly trim: VehicleTrimStyle;
  /** Era paint palette cycled deterministically across slots. */
  readonly paints: readonly string[];

  readonly headLamp: VehicleLampSpec;
  readonly tailLamp: VehicleLampSpec;
  readonly brakeLamp: VehicleLampSpec;
  /** Undefined for two-wheelers (no bumper bar). */
  readonly bumper?: VehicleBumperSpec;
  readonly grille?: VehicleGrilleSpec;
  readonly sideTrim?: VehicleSideTrimSpec;
}

/** Factory helper keeping the catalog below terse and type-checked. */
function kind(def: VehicleKindDef): VehicleKindDef {
  return def;
}

/**
 * Every vehicle kind, keyed by id. Dimensions are scene units where the
 * driving lane centers sit 3 and 9 units across a 12-unit-wide street.
 */
export const VEHICLE_KINDS: Readonly<Record<VehicleKindId, VehicleKindDef>> = Object.freeze({
  /* ---------------------------------------------------------------- 1945 */
  presedan: kind({
    id: 'presedan',
    era: 1945,
    label: 'Pre-War Sedan',
    category: 'car',
    description:
      'Bulbous pontoon-fendered pre-war sedan with running boards, whitewall tires, a rounded barrel roof and bright chrome bumpers.',
    pickable: true,
    length: 4.7,
    width: 1.85,
    height: 1.82,
    wheelRadius: 0.36,
    wheelWidth: 0.2,
    track: 1.5,
    axleFront: 1.5,
    axleRear: -1.5,
    whitewall: true,
    speed: 9,
    trim: 'chrome',
    paints: ['#7a2f26', '#3f5d4a', '#c8b78e', '#2e3d55', '#6f7378'],
    headLamp: { y: 1.0, spread: 1.1 },
    tailLamp: { y: 1.02, spread: 1.35 },
    brakeLamp: { y: 1.02, spread: 0.85 },
    bumper: { y: 0.5, height: 0.17 },
    grille: { y: 0.86, spread: 0.9, height: 0.22 },
    sideTrim: { y: 1.0, z: -0.3, length: 3.0 },
  }),
  streetcar: kind({
    id: 'streetcar',
    era: 1945,
    label: 'Streamline Streetcar',
    category: 'tram',
    description:
      'Articulated streamline streetcar riding the center rails: cream-and-green livery, rounded noses, a window band and a roof pantograph.',
    pickable: true,
    length: 14,
    width: 2.2,
    height: 3.15,
    wheelRadius: 0.4,
    wheelWidth: 0.18,
    track: 1.4,
    axleFront: 5,
    axleRear: -5,
    whitewall: false,
    speed: 7,
    trim: 'chrome',
    paints: ['#2f5d4a', '#8c3b2c'],
    headLamp: { y: 1.1, spread: 1.0 },
    tailLamp: { y: 1.1, spread: 1.0 },
    brakeLamp: { y: 1.1, spread: 0.6 },
    bumper: { y: 0.42, height: 0.18 },
    sideTrim: { y: 0.9, z: 0, length: 12.5 },
  }),
  deliverytruck: kind({
    id: 'deliverytruck',
    era: 1945,
    label: 'Delivery Truck',
    category: 'truck',
    description:
      'Panel delivery truck with an exposed rounded fendered cab, tall cargo box and split windshield — the workhorse of wartime streets.',
    pickable: false,
    length: 5.2,
    width: 1.9,
    height: 2.45,
    wheelRadius: 0.42,
    wheelWidth: 0.19,
    track: 1.55,
    axleFront: 1.8,
    axleRear: -1.5,
    whitewall: false,
    speed: 8.5,
    trim: 'chrome',
    paints: ['#5b4130', '#3e4b57', '#8a7d5f'],
    headLamp: { y: 1.05, spread: 1.15 },
    tailLamp: { y: 1.0, spread: 1.4 },
    brakeLamp: { y: 0.75, spread: 0.9 },
    bumper: { y: 0.5, height: 0.16 },
    grille: { y: 0.95, spread: 0.8, height: 0.18 },
  }),

  /* ---------------------------------------------------------------- 1965 */
  chromesedan: kind({
    id: 'chromesedan',
    era: 1965,
    label: 'Chrome Sedan',
    category: 'car',
    description:
      'Long, low chrome-heavy sedan with flat roof, tailfins, a full-width grille and thin whitewall tires on steel wheels with caps.',
    pickable: true,
    length: 5.3,
    width: 1.9,
    height: 1.5,
    wheelRadius: 0.35,
    wheelWidth: 0.2,
    track: 1.56,
    axleFront: 1.7,
    axleRear: -1.7,
    whitewall: true,
    speed: 11.5,
    trim: 'chrome',
    paints: ['#2b4f7d', '#8f2f2f', '#d9cfb4', '#2f6b52', '#1d1f22'],
    headLamp: { y: 0.92, spread: 1.3 },
    tailLamp: { y: 1.0, spread: 1.6 },
    brakeLamp: { y: 1.0, spread: 1.0 },
    bumper: { y: 0.48, height: 0.16 },
    grille: { y: 0.8, spread: 1.1, height: 0.16 },
    sideTrim: { y: 0.95, z: -0.2, length: 4.2 },
  }),
  wagon: kind({
    id: 'wagon',
    era: 1965,
    label: 'Station Wagon',
    category: 'car',
    description:
      'Long-roofed station wagon with a D-pillar tailgate, two-tone roof and the same bright chrome spears as its sedan sibling.',
    pickable: false,
    length: 5.5,
    width: 1.88,
    height: 1.55,
    wheelRadius: 0.35,
    wheelWidth: 0.2,
    track: 1.56,
    axleFront: 1.75,
    axleRear: -1.75,
    whitewall: true,
    speed: 11,
    trim: 'chrome',
    paints: ['#7d5a2f', '#31506b', '#9a9385', '#57604a'],
    headLamp: { y: 0.92, spread: 1.3 },
    tailLamp: { y: 1.05, spread: 1.6 },
    brakeLamp: { y: 1.05, spread: 1.0 },
    bumper: { y: 0.48, height: 0.16 },
    grille: { y: 0.8, spread: 1.1, height: 0.16 },
    sideTrim: { y: 0.95, z: -0.4, length: 4.4 },
  }),
  citybus: kind({
    id: 'citybus',
    era: 1965,
    label: 'City Bus',
    category: 'bus',
    description:
      'Transit-authority city bus with a destination sign, long window band, silver bumper and period route livery.',
    pickable: true,
    length: 10.5,
    width: 2.0,
    height: 3.05,
    wheelRadius: 0.45,
    wheelWidth: 0.26,
    track: 1.7,
    axleFront: 3.4,
    axleRear: -3.4,
    whitewall: false,
    speed: 8.5,
    trim: 'chrome',
    paints: ['#b23a2e', '#2e5f8a'],
    headLamp: { y: 1.1, spread: 1.5 },
    tailLamp: { y: 1.4, spread: 1.6 },
    brakeLamp: { y: 1.0, spread: 1.6 },
    bumper: { y: 0.55, height: 0.2 },
    sideTrim: { y: 1.15, z: 0, length: 9.0 },
  }),
  musclecar: kind({
    id: 'musclecar',
    era: 1965,
    label: 'Muscle Car',
    category: 'car',
    description:
      'Fastback muscle car with a hood scoop, raised rear deck, wide chrome bumper and staggered tires.',
    pickable: true,
    length: 5.15,
    width: 1.92,
    height: 1.4,
    wheelRadius: 0.36,
    wheelWidth: 0.22,
    track: 1.6,
    axleFront: 1.65,
    axleRear: -1.65,
    whitewall: false,
    speed: 13,
    trim: 'chrome',
    paints: ['#c94b1e', '#111316', '#e0d8c5', '#7a1f1f', '#2b4f7d'],
    headLamp: { y: 0.85, spread: 1.35 },
    tailLamp: { y: 0.95, spread: 1.7 },
    brakeLamp: { y: 0.95, spread: 1.05 },
    bumper: { y: 0.45, height: 0.15 },
    grille: { y: 0.72, spread: 1.2, height: 0.18 },
  }),

  /* ---------------------------------------------------------------- 1985 */
  boxcoupe: kind({
    id: 'boxcoupe',
    era: 1985,
    label: 'Boxy Coupe',
    category: 'car',
    description:
      'Folded-paper boxy coupe with sharp creases, black rubber rub strips, rectangular sealed-beam headlamps and a formal notchback.',
    pickable: false,
    length: 4.65,
    width: 1.75,
    height: 1.48,
    wheelRadius: 0.33,
    wheelWidth: 0.19,
    track: 1.46,
    axleFront: 1.45,
    axleRear: -1.45,
    whitewall: false,
    speed: 11,
    trim: 'chrome-rubber',
    paints: ['#b8bcbf', '#8c2a24', '#2a2f6b', '#d8d5cb'],
    headLamp: { y: 0.9, spread: 1.25 },
    tailLamp: { y: 1.0, spread: 1.5 },
    brakeLamp: { y: 0.75, spread: 1.0 },
    bumper: { y: 0.45, height: 0.18 },
    sideTrim: { y: 0.8, z: 0, length: 3.6 },
  }),
  hatchback: kind({
    id: 'hatchback',
    era: 1985,
    label: 'Hatchback',
    category: 'car',
    description:
      'Two-box hatchback with an upright rear hatch, black window surrounds and molded plastic bumpers.',
    pickable: false,
    length: 4.15,
    width: 1.7,
    height: 1.5,
    wheelRadius: 0.32,
    wheelWidth: 0.18,
    track: 1.42,
    axleFront: 1.3,
    axleRear: -1.3,
    whitewall: false,
    speed: 10.5,
    trim: 'chrome-rubber',
    paints: ['#c94a3d', '#e2ded4', '#375b7a', '#4f5d3f'],
    headLamp: { y: 0.88, spread: 1.2 },
    tailLamp: { y: 1.05, spread: 1.4 },
    brakeLamp: { y: 0.78, spread: 1.4 },
    bumper: { y: 0.45, height: 0.18 },
    sideTrim: { y: 0.78, z: 0, length: 3.2 },
  }),
  panelvan: kind({
    id: 'panelvan',
    era: 1985,
    label: 'Panel Van',
    category: 'truck',
    description:
      'Slab-sided panel van with a tall box cargo area, black rub strips and a wide rear door band.',
    pickable: true,
    length: 5.35,
    width: 1.95,
    height: 2.35,
    wheelRadius: 0.36,
    wheelWidth: 0.2,
    track: 1.6,
    axleFront: 1.8,
    axleRear: -1.8,
    whitewall: false,
    speed: 9.5,
    trim: 'chrome-rubber',
    paints: ['#e5e2da', '#39525f', '#7d4631'],
    headLamp: { y: 0.95, spread: 1.3 },
    tailLamp: { y: 1.2, spread: 1.5 },
    brakeLamp: { y: 0.85, spread: 1.5 },
    bumper: { y: 0.5, height: 0.18 },
    sideTrim: { y: 0.85, z: -0.6, length: 4.2 },
  }),
  importcompact: kind({
    id: 'importcompact',
    era: 1985,
    label: 'Early Import Compact',
    category: 'car',
    description:
      'Early import compact: short overhangs, thin pillars, round mirrors and a hatch rear — the car that shrank the American street.',
    pickable: false,
    length: 4.05,
    width: 1.66,
    height: 1.42,
    wheelRadius: 0.32,
    wheelWidth: 0.17,
    track: 1.4,
    axleFront: 1.28,
    axleRear: -1.28,
    whitewall: false,
    speed: 10.5,
    trim: 'chrome-rubber',
    paints: ['#2f6b4f', '#d5cfc0', '#a02d2d', '#2b3a7a'],
    headLamp: { y: 0.85, spread: 1.15 },
    tailLamp: { y: 0.95, spread: 1.35 },
    brakeLamp: { y: 0.7, spread: 1.35 },
    bumper: { y: 0.42, height: 0.16 },
    sideTrim: { y: 0.75, z: 0, length: 3.1 },
  }),

  /* ---------------------------------------------------------------- 2005 */
  suv: kind({
    id: 'suv',
    era: 2005,
    label: 'SUV',
    category: 'car',
    description:
      'Tall-riding SUV with a boxy greenhouse, roof rails, plastic lower cladding and big alloy-look wheels.',
    pickable: true,
    length: 4.95,
    width: 1.9,
    height: 1.85,
    wheelRadius: 0.38,
    wheelWidth: 0.21,
    track: 1.58,
    axleFront: 1.6,
    axleRear: -1.6,
    whitewall: false,
    speed: 11,
    trim: 'plastic',
    paints: ['#2b3138', '#7d848c', '#8d1f1f', '#e5e3dd'],
    headLamp: { y: 1.05, spread: 1.35 },
    tailLamp: { y: 1.45, spread: 1.55 },
    brakeLamp: { y: 1.1, spread: 1.55 },
    bumper: { y: 0.55, height: 0.2 },
    sideTrim: { y: 0.62, z: 0, length: 4.0 },
  }),
  compact: kind({
    id: 'compact',
    era: 2005,
    label: 'Compact Car',
    category: 'car',
    description:
      'Jellybean compact car with rounded aero edges, clear-lens lamps and black plastic mirrors.',
    pickable: false,
    length: 4.25,
    width: 1.72,
    height: 1.52,
    wheelRadius: 0.33,
    wheelWidth: 0.18,
    track: 1.44,
    axleFront: 1.35,
    axleRear: -1.35,
    whitewall: false,
    speed: 10.5,
    trim: 'plastic',
    paints: ['#c7ccd1', '#28405c', '#9b1f2b', '#4d5f3f'],
    headLamp: { y: 0.9, spread: 1.2 },
    tailLamp: { y: 1.0, spread: 1.4 },
    brakeLamp: { y: 0.75, spread: 1.4 },
    bumper: { y: 0.45, height: 0.18 },
    sideTrim: { y: 0.72, z: 0, length: 3.3 },
  }),
  taxi: kind({
    id: 'taxi',
    era: 2005,
    label: 'City Taxi',
    category: 'car',
    description:
      'Checker-yellow taxi with a roof sign, door chevron panel and amber roof lamp.',
    pickable: true,
    length: 4.55,
    width: 1.8,
    height: 1.55,
    wheelRadius: 0.33,
    wheelWidth: 0.19,
    track: 1.46,
    axleFront: 1.45,
    axleRear: -1.45,
    whitewall: false,
    speed: 10,
    trim: 'plastic',
    paints: ['#e8b514'],
    headLamp: { y: 0.95, spread: 1.3 },
    tailLamp: { y: 1.05, spread: 1.5 },
    brakeLamp: { y: 0.8, spread: 1.5 },
    bumper: { y: 0.45, height: 0.18 },
    sideTrim: { y: 0.75, z: 0, length: 3.5 },
  }),
  bicycle: kind({
    id: 'bicycle',
    era: 2005,
    label: 'Bicycle',
    category: 'twoWheel',
    description:
      'City bicycle with a step-through frame, fenders and a rear rack, mixing it up with the taxis.',
    pickable: false,
    length: 1.85,
    width: 0.62,
    height: 1.15,
    wheelRadius: 0.34,
    wheelWidth: 0.04,
    track: 0.5,
    axleFront: 0.62,
    axleRear: -0.62,
    whitewall: false,
    speed: 5.5,
    trim: 'plastic',
    paints: ['#2d6b4f', '#a02d2d', '#2b3a7a', '#d8d3c5'],
    headLamp: { y: 0.8, spread: 0.3 },
    tailLamp: { y: 0.7, spread: 0.3 },
    brakeLamp: { y: 0.7, spread: 0.2 },
  }),

  /* ---------------------------------------------------------------- 2025 */
  evsedan: kind({
    id: 'evsedan',
    era: 2025,
    label: 'Electric Sedan',
    category: 'car',
    description:
      'Seamless electric sedan: grille-less nose, full-width LED light bar, flush glass and aero wheel covers.',
    pickable: true,
    length: 4.85,
    width: 1.85,
    height: 1.55,
    wheelRadius: 0.36,
    wheelWidth: 0.2,
    track: 1.54,
    axleFront: 1.55,
    axleRear: -1.55,
    whitewall: false,
    speed: 11.5,
    trim: 'satin',
    paints: ['#e8eaec', '#3a4046', '#2f7a76', '#1d2a44'],
    headLamp: { y: 0.95, spread: 1.6 },
    tailLamp: { y: 1.1, spread: 1.65 },
    brakeLamp: { y: 0.9, spread: 1.65 },
    bumper: { y: 0.5, height: 0.16 },
    sideTrim: { y: 0.85, z: 0, length: 3.6 },
  }),
  scooter: kind({
    id: 'scooter',
    era: 2025,
    label: 'Electric Scooter',
    category: 'twoWheel',
    description:
      'Stand-up electric kick scooter with a stem display, deck battery and tiny solid tires.',
    pickable: false,
    length: 1.65,
    width: 0.62,
    height: 1.2,
    wheelRadius: 0.24,
    wheelWidth: 0.09,
    track: 0.42,
    axleFront: 0.55,
    axleRear: -0.55,
    whitewall: false,
    speed: 6.5,
    trim: 'satin',
    paints: ['#d8dade', '#2b2f33', '#c94a3d'],
    headLamp: { y: 0.95, spread: 0.3 },
    tailLamp: { y: 0.6, spread: 0.28 },
    brakeLamp: { y: 0.6, spread: 0.2 },
  }),
  ebike: kind({
    id: 'ebike',
    era: 2025,
    label: 'E-Bike',
    category: 'twoWheel',
    description:
      'Pedal-assist e-bike with an integrated downtube battery, hub motor and a small day-time running lamp.',
    pickable: false,
    length: 1.9,
    width: 0.64,
    height: 1.2,
    wheelRadius: 0.34,
    wheelWidth: 0.05,
    track: 0.5,
    axleFront: 0.65,
    axleRear: -0.65,
    whitewall: false,
    speed: 6,
    trim: 'satin',
    paints: ['#3f7d5f', '#2b3a7a', '#c94a3d'],
    headLamp: { y: 0.82, spread: 0.32 },
    tailLamp: { y: 0.72, spread: 0.3 },
    brakeLamp: { y: 0.72, spread: 0.2 },
  }),
  robotaxi: kind({
    id: 'robotaxi',
    era: 2025,
    label: 'Robotaxi',
    category: 'car',
    description:
      'Driverless robotaxi with a roof lidar pod, sensor domes and a wrap-around sensor light bar.',
    pickable: true,
    length: 4.95,
    width: 1.9,
    height: 1.68,
    wheelRadius: 0.36,
    wheelWidth: 0.21,
    track: 1.58,
    axleFront: 1.6,
    axleRear: -1.6,
    whitewall: false,
    speed: 10,
    trim: 'satin',
    paints: ['#eceff1', '#cfd4d8'],
    headLamp: { y: 0.98, spread: 1.7 },
    tailLamp: { y: 1.15, spread: 1.7 },
    brakeLamp: { y: 0.95, spread: 1.7 },
    bumper: { y: 0.5, height: 0.16 },
    sideTrim: { y: 0.88, z: 0, length: 3.7 },
  }),
});

/** How a traffic slot participates in the fleet. */
export type FleetSlotRole = 'moving' | 'parked' | 'rail';

/** Roster of kinds present in one era. */
export interface EraFleet {
  /** Kinds cycling through the driving-lane loop slots. */
  readonly moving: readonly VehicleKindId[];
  /** Kinds cycling through the curbside parking slots. */
  readonly parked: readonly VehicleKindId[];
  /** Center-rail streetcar slot, or null when the era has no streetcar. */
  readonly rail: VehicleKindId | null;
}

/**
 * Per-era fleet rosters covering the acceptance criteria: bulbous pre-war
 * sedans + streetcar + delivery truck (1945), chrome sedans/wagons/city bus/
 * muscle cars (1965), boxy coupes/hatchbacks/panel vans/early imports (1985),
 * SUVs/compacts/taxis/bicycles (2005), EVs/scooters/e-bikes/robotaxis (2025).
 */
export const ERA_FLEETS: Readonly<Record<FleetEra, EraFleet>> = Object.freeze({
  1945: Object.freeze({
    moving: Object.freeze(['presedan', 'deliverytruck', 'presedan', 'deliverytruck', 'presedan'] as const),
    parked: Object.freeze(['presedan', 'deliverytruck'] as const),
    rail: 'streetcar' as const,
  }),
  1965: Object.freeze({
    moving: Object.freeze(['chromesedan', 'wagon', 'musclecar', 'citybus', 'chromesedan'] as const),
    parked: Object.freeze(['chromesedan', 'wagon'] as const),
    rail: 'streetcar' as const,
  }),
  1985: Object.freeze({
    moving: Object.freeze(['boxcoupe', 'hatchback', 'importcompact', 'panelvan', 'boxcoupe'] as const),
    parked: Object.freeze(['boxcoupe', 'hatchback'] as const),
    rail: null,
  }),
  2005: Object.freeze({
    moving: Object.freeze(['suv', 'compact', 'taxi', 'bicycle', 'suv'] as const),
    parked: Object.freeze(['compact', 'taxi', 'suv'] as const),
    rail: null,
  }),
  2025: Object.freeze({
    moving: Object.freeze(['evsedan', 'robotaxi', 'scooter', 'ebike', 'evsedan'] as const),
    parked: Object.freeze(['evsedan', 'scooter'] as const),
    rail: null,
  }),
}) as Readonly<Record<FleetEra, EraFleet>>;

/** The era roster for a timeline year (defaults to the nearest known roster). */
export function fleetForEra(era: number): EraFleet {
  const roster = ERA_FLEETS[era as FleetEra];
  if (roster) return roster;
  // Fall back to the nearest of the five stops.
  const stops: readonly FleetEra[] = [1945, 1965, 1985, 2005, 2025];
  let best = stops[0];
  for (const stop of stops) {
    if (Math.abs(stop - era) < Math.abs(best - era)) best = stop;
  }
  return ERA_FLEETS[best];
}

/**
 * Deterministic slot -> kind assignment shared by the traffic system and the
 * pickable descriptor wiring: moving slots cycle the era roster offset by the
 * street's loop index (so the two streets carry different mixes), parked slots
 * cycle the parking roster, and the rail slot takes the era's streetcar (or
 * null when the era retired the tram).
 */
export function fleetKindForSlot(
  role: FleetSlotRole,
  fleetIndex: number,
  loopOffset: number,
  era: FleetEra,
): VehicleKindId | null {
  const fleet = fleetForEra(era);
  if (role === 'rail') return fleet.rail;
  if (role === 'moving') {
    if (fleet.moving.length === 0) return null;
    const index = ((fleetIndex + loopOffset) % fleet.moving.length + fleet.moving.length) % fleet.moving.length;
    return fleet.moving[index];
  }
  if (fleet.parked.length === 0) return null;
  const index = ((fleetIndex % fleet.parked.length) + fleet.parked.length) % fleet.parked.length;
  return fleet.parked[index];
}

/** Deterministic era paint for one slot: cycles the kind's palette. */
export function paintForKind(kindId: VehicleKindId, variantIndex: number, era: FleetEra): string {
  const def = VEHICLE_KINDS[kindId];
  if (def.paints.length === 0) return '#888888';
  const eraStops: readonly FleetEra[] = [1945, 1965, 1985, 2005, 2025];
  const eraIndex = Math.max(0, eraStops.indexOf(era));
  const index = (((variantIndex + eraIndex) % def.paints.length) + def.paints.length) % def.paints.length;
  return def.paints[index];
}

/** RGB trim color for a trim style (chrome vs plastic vs satin black). */
export function trimColor(style: VehicleTrimStyle): string {
  switch (style) {
    case 'chrome':
      return '#e6e9ec';
    case 'chrome-rubber':
      return '#3a3d40';
    case 'plastic':
      return '#26292c';
    case 'satin':
      return '#17191b';
  }
}

/** All kinds flagged as pickable, in stable catalog order. */
export function pickableKindIds(): readonly VehicleKindId[] {
  return (Object.keys(VEHICLE_KINDS) as VehicleKindId[]).filter((id) => VEHICLE_KINDS[id].pickable);
}
