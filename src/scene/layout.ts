import { STORY_HEIGHT } from '../lib/era-data';

/**
 * Static city block layout.
 *
 * A cross intersection sits at the origin: a N-S road along x≈0 and an E-W
 * road along z≈0. Buildings occupy the four corner lots. Vehicles travel the
 * two roads; pedestrians walk the sidewalks.
 */

export const ROAD_HALF = 4.0; // half-width of each road carriageway
export const SIDEWALK_HALF = ROAD_HALF + 2.4; // outer edge of sidewalk
export const BLOCK_SIZE = 120; // ground plane half-extent-ish

export interface BuildingSpec {
  /** Grid position (lot center). */
  x: number;
  z: number;
  /** Footprint dimensions. */
  w: number;
  d: number;
  /** Base number of stories at era 0; multiplies by era growth. */
  baseStories: number;
  /** Window columns per face. */
  cols: number;
  /** Per-building seed for window randomness. */
  seed: number;
}

// Four corner lots, each holding a cluster of buildings. Coordinates place
// buildings beyond the sidewalk so they flank the intersection.
export const BUILDINGS: BuildingSpec[] = [
  // NE lot
  { x: 13, z: 13, w: 11, d: 11, baseStories: 3, cols: 5, seed: 1.2 },
  { x: 13, z: 26, w: 9, d: 8, baseStories: 2, cols: 4, seed: 3.7 },
  { x: 26, z: 16, w: 8, d: 12, baseStories: 4, cols: 4, seed: 5.5 },
  { x: 27, z: 30, w: 10, d: 9, baseStories: 3, cols: 5, seed: 8.1 },
  // NW lot
  { x: -13, z: 13, w: 11, d: 11, baseStories: 4, cols: 5, seed: 2.1 },
  { x: -13, z: 26, w: 9, d: 8, baseStories: 3, cols: 4, seed: 4.4 },
  { x: -26, z: 16, w: 8, d: 12, baseStories: 2, cols: 4, seed: 6.6 },
  { x: -27, z: 30, w: 10, d: 9, baseStories: 4, cols: 5, seed: 9.3 },
  // SE lot
  { x: 13, z: -13, w: 11, d: 11, baseStories: 2, cols: 5, seed: 7.2 },
  { x: 13, z: -26, w: 9, d: 8, baseStories: 4, cols: 4, seed: 11.4 },
  { x: 26, z: -16, w: 8, d: 12, baseStories: 3, cols: 4, seed: 13.6 },
  { x: 27, z: -30, w: 10, d: 9, baseStories: 2, cols: 5, seed: 15.1 },
  // SW lot
  { x: -13, z: -13, w: 11, d: 11, baseStories: 4, cols: 5, seed: 10.2 },
  { x: -13, z: -26, w: 9, d: 8, baseStories: 3, cols: 4, seed: 12.4 },
  { x: -26, z: -16, w: 8, d: 12, baseStories: 2, cols: 4, seed: 14.6 },
  { x: -27, z: -30, w: 10, d: 9, baseStories: 4, cols: 5, seed: 16.3 },
];

export interface LampSpec {
  x: number;
  z: number;
  rot: number; // rotation around Y (which way the arm points)
}

// Street lamps along the four sidewalk approaches.
export const LAMPS: LampSpec[] = [
  { x: 6, z: 7, rot: Math.PI },
  { x: -6, z: 7, rot: 0 },
  { x: 6, z: -7, rot: Math.PI },
  { x: -6, z: -7, rot: 0 },
  { x: 7, z: 18, rot: -Math.PI / 2 },
  { x: -7, z: 18, rot: Math.PI / 2 },
  { x: 7, z: -18, rot: -Math.PI / 2 },
  { x: -7, z: -18, rot: Math.PI / 2 },
  { x: 18, z: 7, rot: Math.PI },
  { x: 18, z: -7, rot: Math.PI },
  { x: -18, z: 7, rot: 0 },
  { x: -18, z: -7, rot: 0 },
];

/** Traffic lights at the four corners of the intersection. */
export const TRAFFIC_LIGHTS: LampSpec[] = [
  { x: 5, z: 5, rot: Math.PI * 1.25 },
  { x: -5, z: 5, rot: Math.PI * 1.75 },
  { x: 5, z: -5, rot: Math.PI * 0.75 },
  { x: -5, z: -5, rot: Math.PI * 0.25 },
];

// --- Vehicle paths ---------------------------------------------------------
// N-S road (along z) uses x = ±lane; E-W road (along x) uses z = ±lane.

export interface VehicleSpec {
  axis: 'ns' | 'ew';
  lane: number; // signed offset from center line
  speed: number; // units/sec (sign = direction)
  phase: number; // starting offset along path [0,1)
  length: number;
  width: number;
}

export const VEHICLES: VehicleSpec[] = [
  { axis: 'ns', lane: -1.3, speed: 3.2, phase: 0.0, length: 3.4, width: 1.4 },
  { axis: 'ns', lane: 1.3, speed: -2.7, phase: 0.35, length: 3.4, width: 1.4 },
  { axis: 'ew', lane: 1.3, speed: 2.4, phase: 0.6, length: 3.4, width: 1.4 },
  { axis: 'ew', lane: -1.3, speed: -3.0, phase: 0.15, length: 3.4, width: 1.4 },
  { axis: 'ns', lane: -1.3, speed: 3.8, phase: 0.7, length: 3.4, width: 1.4 },
];

export const VEHICLE_PATH_EXTENT = 42; // how far vehicles travel before wrapping

export interface PedSpec {
  axis: 'ns' | 'ew';
  lane: number;
  speed: number;
  phase: number;
  side: number; // which sidewalk
}

export const PEDESTRIANS: PedSpec[] = [
  { axis: 'ns', lane: 6.4, speed: 0.7, phase: 0.1, side: 1 },
  { axis: 'ns', lane: -6.4, speed: -0.6, phase: 0.5, side: -1 },
  { axis: 'ew', lane: 6.4, speed: 0.65, phase: 0.25, side: 1 },
  { axis: 'ew', lane: -6.4, speed: -0.55, phase: 0.75, side: -1 },
  { axis: 'ns', lane: 6.6, speed: -0.5, phase: 0.9, side: 1 },
  { axis: 'ew', lane: -6.6, speed: 0.6, phase: 0.4, side: -1 },
];

export const PED_PATH_EXTENT = 40;

/** Convert an interpolated era's story count to a world-space height. */
export function storiesToHeight(stories: number): number {
  return Math.max(STORY_HEIGHT, stories * STORY_HEIGHT);
}
