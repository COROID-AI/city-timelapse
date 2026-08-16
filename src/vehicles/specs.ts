// ─── Era Vehicle Specs & Traffic Rosters ─────────────────────────────
// Defines per-era vehicle types, counts, speeds, and parking behavior.
// Traffic density increases from sparse (1945) to congested (2005),
// then shifts to quieter EV/micromobility streets (2025).

import type { EraId } from '../eras.js';

// ── Vehicle type enum ────────────────────────────────────────────────

export type VehicleType =
  | 'sedan'
  | 'truck'
  | 'trolley'
  | 'suv'
  | 'hatchback'
  | 'taxi'
  | 'minivan'
  | 'escooter'
  | 'ebike';

// ── Traffic lane config ──────────────────────────────────────────────
// Street layout from ground.ts: 80m total, 60m block, 10m streets on each side.
// Each street has two lanes (one each direction), plus parking where applicable.

export interface LaneConfig {
  /** Position of the lane center (z offset from road centerline) */
  zOffset: number;
  /** Direction: +1 = moving toward positive Z, -1 = negative Z */
  direction: number;
  /** Whether this lane allows parking alongside */
  canPark: boolean;
  /** Offset from curb for parked cars */
  parkOffset?: number;
}

// ── Per-vehicle entry in a roster ────────────────────────────────────

export interface VehicleEntry {
  /** Visual type used by the factory */
  type: VehicleType;
  /** How many vehicles of this type appear in the scene */
  count: number;
  /** Speed range in m/s (deterministic random seeded by position) */
  speedRange: [number, number];
}

// ── Parking configuration per era ────────────────────────────────────

export interface ParkingConfig {
  /** Parking style: none, angled, or parallel */
  style: 'none' | 'angled' | 'parallel';
  /** Spacing between parked cars in meters */
  spacing: number;
  /** Angle in radians for angled parking (0 = parallel) */
  angle?: number;
  /** How far from the curb edge */
  curbOffset: number;
}

// ── Street marking evolution per era ─────────────────────────────────

export interface StreetMarkings {
  /** Center line color — null means no markings */
  centerLineColor: number | null;
  /** Dashed or solid */
  centerLinePattern: 'solid' | 'dashed' | 'double';
  /** Bike lane presence */
  bikeLaneWidth: number;
  /** Crosswalk stripes present */
  crosswalks: boolean;
  /** Parking lane markings */
  parkingLines: boolean;
}

// ── Complete era traffic spec ────────────────────────────────────────

export interface EraTrafficSpec {
  era: EraId;
  label: string;
  /** Vehicle roster — determines what appears on screen */
  roster: VehicleEntry[];
  /** Total vehicle count across all types */
  totalVehicles: number;
  /** Average speed across all types (m/s) */
  avgSpeed: number;
  /** Parking behavior at curbs */
  parking: ParkingConfig;
  /** Street marking style */
  markings: StreetMarkings;
  /** Number of active traffic lanes (each side of street) */
  laneCount: number;
  /** Street lane configs */
  lanes: LaneConfig[];
  /** Intersection stop distance (meters from intersection center) */
  stopDistance: number;
}

// ── Per-era specs ────────────────────────────────────────────────────

export const ERA_TRAFFIC_SPECS: Record<EraId, EraTrafficSpec> = {
  '1945': {
    era: '1945',
    label: 'War-Era Sparse Traffic',
    roster: [
      { type: 'sedan', count: 4, speedRange: [4, 7] },       // black-market sedans
      { type: 'truck', count: 3, speedRange: [3, 5] },        // military/delivery trucks
      { type: 'trolley', count: 1, speedRange: [6, 8] },      // public trolley
    ],
    totalVehicles: 8,
    avgSpeed: 5.5,
    parking: {
      style: 'angled',
      spacing: 6.5,
      angle: Math.PI / 6, // ~30° angle
      curbOffset: 1.5,
    },
    markings: {
      centerLineColor: null,     // no painted markings during wartime
      centerLinePattern: 'solid',
      bikeLaneWidth: 0,
      crosswalks: false,
      parkingLines: false,
    },
    laneCount: 1,
    lanes: [
      { zOffset: -1.5, direction: 1, canPark: true, parkOffset: 3.5 },
      { zOffset: 1.5, direction: -1, canPark: true, parkOffset: -3.5 },
    ],
    stopDistance: 3,
  },
  '1965': {
    era: '1965',
    label: 'Mid-Century Cruise Traffic',
    roster: [
      { type: 'sedan', count: 10, speedRange: [6, 10] },     // long chrome boats
      { type: 'truck', count: 2, speedRange: [4, 7] },
    ],
    totalVehicles: 12,
    avgSpeed: 8.0,
    parking: {
      style: 'angled',
      spacing: 5.5,
      angle: Math.PI / 6,
      curbOffset: 1.5,
    },
    markings: {
      centerLineColor: 0xffffff, // white lane paint introduced
      centerLinePattern: 'dashed',
      bikeLaneWidth: 0,
      crosswalks: true,
      parkingLines: false,
    },
    laneCount: 1,
    lanes: [
      { zOffset: -1.5, direction: 1, canPark: true, parkOffset: 3.5 },
      { zOffset: 1.5, direction: -1, canPark: true, parkOffset: -3.5 },
    ],
    stopDistance: 3,
  },
  '1985': {
    era: '1985',
    label: 'Neon-Era Mixed Traffic',
    roster: [
      { type: 'sedan', count: 6, speedRange: [7, 12] },
      { type: 'hatchback', count: 6, speedRange: [6, 11] }, // boxy econoboxes
      { type: 'truck', count: 3, speedRange: [5, 9] },
    ],
    totalVehicles: 15,
    avgSpeed: 9.0,
    parking: {
      style: 'parallel',
      spacing: 5.0,
      curbOffset: 1.2,
    },
    markings: {
      centerLineColor: 0xffcc00, // yellow lane paint
      centerLinePattern: 'dashed',
      bikeLaneWidth: 0,
      crosswalks: true,
      parkingLines: true,
    },
    laneCount: 1,
    lanes: [
      { zOffset: -1.5, direction: 1, canPark: true, parkOffset: 3.5 },
      { zOffset: 1.5, direction: -1, canPark: true, parkOffset: -3.5 },
    ],
    stopDistance: 4,
  },
  '2005': {
    era: '2005',
    label: 'SUV Congestion Era',
    roster: [
      { type: 'sedan', count: 4, speedRange: [8, 14] },
      { type: 'taxi', count: 3, speedRange: [10, 15] },     // yellow cabs
      { type: 'suv', count: 8, speedRange: [6, 12] },       // heavy SUV presence
      { type: 'minivan', count: 3, speedRange: [5, 10] },     // family haulers
    ],
    totalVehicles: 18,
    avgSpeed: 9.5,
    parking: {
      style: 'parallel',
      spacing: 5.0,
      curbOffset: 1.0,
    },
    markings: {
      centerLineColor: 0xffcc00,
      centerLinePattern: 'dashed',
      bikeLaneWidth: 1.2, // bike lanes introduced
      crosswalks: true,
      parkingLines: true,
    },
    laneCount: 2,
    lanes: [
      { zOffset: -2.5, direction: 1, canPark: true, parkOffset: 3.5 },
      { zOffset: -0.5, direction: 1, canPark: false },
      { zOffset: 0.5, direction: -1, canPark: false },
      { zOffset: 2.5, direction: -1, canPark: true, parkOffset: -3.5 },
    ],
    stopDistance: 5,
  },
  '2025': {
    era: '2025',
    label: 'Modern Quiet Streets',
    roster: [
      { type: 'sedan', count: 3, speedRange: [6, 12] },     // mostly EV sedans
      { type: 'suv', count: 2, speedRange: [5, 10] },
      { type: 'escooter', count: 5, speedRange: [4, 8] },   // micromobility
      { type: 'ebike', count: 4, speedRange: [3, 7] },
    ],
    totalVehicles: 14,
    avgSpeed: 7.0,
    parking: {
      style: 'parallel',
      spacing: 5.5,
      curbOffset: 0.8,
    },
    markings: {
      centerLineColor: 0x44aa44, // green-tinted sustainable city markings
      centerLinePattern: 'dashed',
      bikeLaneWidth: 1.5,
      crosswalks: true,
      parkingLines: true,
    },
    laneCount: 2,
    lanes: [
      { zOffset: -2.5, direction: 1, canPark: true, parkOffset: 3.8 },
      { zOffset: -0.5, direction: 1, canPark: false },
      { zOffset: 0.5, direction: -1, canPark: false },
      { zOffset: 2.5, direction: -1, canPark: true, parkOffset: -3.8 },
    ],
    stopDistance: 5,
  },
};

// ── Map vehicle type to factory type string ──────────────────────────

export function resolveFactoryType(type: VehicleType): 'sedan' | 'truck' | 'trolley' | 'suv' | 'hatchback' | 'taxi' | 'minivan' | 'escooter' | 'ebike' {
  return type;
}
