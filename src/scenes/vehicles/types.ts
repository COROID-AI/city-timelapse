import type { CityBlockLayout, Point2 } from '../layout/types.js';
import type { EraData } from '../eras/types.js';

/**
 * Shared vehicle scene contracts.
 *
 * The vehicles subsystem consumes the era registry (for era-authentic fleet
 * kinds and traffic behaviour) and the city-block layout (for the traffic
 * loops and lanes that vehicles follow) strictly read-only. It owns the
 * visual/behavioural detail of the fleet: per-kind body silhouettes, per-era
 * paint palettes, motion, idling at intersections, and parking.
 */

/**
 * Discrete body families. Giving each era a distinct set of silhouettes is
 * what makes the fleet read as authentically period-specific.
 */
export type VehicleBodyType =
  /** 1945: upright, boxy wartime sedans and trucks. */
  | 'boxy'
  /** 1965: tailfin cruisers with swept fins and chrome. */
  | 'tailfin'
  /** 1985: sharp-cornered angular sedans / taxis. */
  | 'angular'
  /** 1965: wood-panelled station wagon. */
  | 'wagon'
  /** 2005: tall, slab-sided SUV. */
  | 'suv'
  /** 2005: compact hatchback (often hybrid). */
  | 'hatchback'
  /** Delivery / courier truck. */
  | 'truck'
  /** Delivery van. */
  | 'van'
  /** City / trolley bus. */
  | 'bus'
  /** 1965 moped / scooter. */
  | 'scooter'
  /** 2025 electric sedan. */
  | 'ev'
  /** 2025 electric SUV. */
  | 'ev-suv'
  /** 2025 cargo e-bike. */
  | 'e-bike'
  /** 2025 autonomous shuttle. */
  | 'shuttle';

/**
 * Per-vehicle body + material descriptor. Dimensions give each silhouette its
 * era-authentic proportions; the numeric `gloss` / `chromeTrim` fields are
 * driven by the shared era data (and therefore interpolate during a
 * transition); `paint` comes from the era's own palette.
 */
export interface BodySpec {
  bodyType: VehicleBodyType;
  /** Overall length in scene meters. */
  lengthM: number;
  /** Overall width in scene meters. */
  widthM: number;
  /** Overall height in scene meters. */
  heightM: number;
  wheelCount: number;
  /** Whether the vehicle carries a roof rack / carrier. */
  roofRack: boolean;
  /** Chrome / brightwork coverage (0..1). */
  chromeTrim: number;
  headlightCount: number;
  /** Era paint colour (hex). */
  paint: string;
  /** Paintwork reflectivity (0 matt .. 1 gloss). */
  gloss: number;
  /** Whether the drivetrain is electric / quiet. */
  electric: boolean;
}

/** A vehicle's current motion state. */
export type VehicleState = 'driving' | 'idle' | 'parked';

/** A single mounted vehicle in the scene. */
export interface VehicleInstance {
  id: string;
  /** Stable per-vehicle sequence index (used for deterministic behaviour). */
  seq: number;
  /** Fleet kind id from the shared era registry (e.g. `'tailfin-cruiser'`). */
  kindId: string;
  kindLabel: string;
  body: BodySpec;
  state: VehicleState;
  /** Ground-plane position. */
  position: Point2;
  /** Facing in radians (0 = +x). */
  heading: number;
  /** Cruise speed in m/s. */
  speed: number;
  /** The traffic loop this vehicle circulates on. */
  loopId: string;
  /** Progress around the loop in [0, 1). */
  loopProgress: number;
  /** Seconds of idle remaining at an intersection. */
  idleRemaining: number;
}

/** Options for mounting a vehicles scene. */
export interface VehiclesOptions {
  /** The (possibly interpolated) era profile to render. */
  era: EraData;
  /** The shared city-block layout, consumed read-only. */
  layout: CityBlockLayout;
  /** Deterministic spawn seed so tests are stable. */
  seed?: number;
}