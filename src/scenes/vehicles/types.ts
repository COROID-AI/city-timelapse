/**
 * Per-era vehicle fleet & traffic subsystem: typed contracts.
 *
 * These types describe one era-derived vehicle instance (its fleet kind,
 * lane placement, heading and paintwork) plus the merged, instanced geometry
 * buffers a renderer consumes for performance. Nothing here redefines era or
 * layout data — those are consumed read-only from `src/scenes/eras/` and
 * `src/scenes/layout/`.
 */

import type { Point2 } from '../layout/types.js';

/** One placed vehicle in the scene (an instance on a layout lane). */
export interface VehicleInstance {
  /** Stable instance id. */
  id: string;
  /** Fleet kind id from the era registry (e.g. `'wartime-sedan'`). */
  kindId: string;
  /** Human-readable fleet label. */
  label: string;
  /** Owning layout lane id. */
  laneId: string;
  /** Ground-plane position of the vehicle. */
  position: Point2;
  /** Heading in radians (travel direction along the lane). */
  heading: number;
  /** Paintwork colour (hex). */
  color: string;
  /** Vehicle length in meters. */
  length: number;
  /** Vehicle width in meters. */
  width: number;
  /** True when the vehicle is electric / quiet for the era. */
  electric: boolean;
  /** Paintwork reflectivity (0 matt .. 1 gloss). */
  bodyGloss: number;
  /** Chrome / brightwork coverage (0..1). */
  chrome: number;
  /** Headlamp colour: 0 warm tungsten .. 1 cool white/LED. */
  headlightCool: number;
  /** Engine / exhaust audible level (0..1). */
  engineNoise: number;
}

/**
 * Merged, instanced geometry buffers for the whole fleet. Every vehicle across
 * every lane is merged into a single array so a renderer can upload them as a
 * few static buffers (instancing for performance) rather than issuing a draw
 * call per vehicle.
 */
export interface VehicleBuffers {
  /** All placed vehicle instances. */
  vehicles: VehicleInstance[];
  /** Number of vehicle instances merged into the buffers. */
  instanceCount: number;
  /** Average traffic density on the block (0..1), from the era registry. */
  trafficDensity: number;
  /** Share of the fleet that is electric / quiet (0..1). */
  electricRatio: number;
  /** Engine / exhaust audible level (0..1). */
  engineNoise: number;
  /** Headlamp colour (0 warm .. 1 cool). */
  headlightCool: number;
  /** Paintwork reflectivity (0..1). */
  bodyGloss: number;
  /** Chrome / brightwork coverage (0..1). */
  chrome: number;
}

/** Mutable render state held by a live `Vehicles` instance. */
export interface VehiclesState {
  /** The era year currently resolved and rendered. */
  year: number;
  /** The last merged, instanced vehicle buffers. */
  geometry: VehicleBuffers;
  /** Whether the instance has been attached (mounted). */
  attached: boolean;
}

/** Lifecycle component surface: instantiate -> attach -> update -> dispose. */
export interface VehiclesComponent {
  instantiate(year: number): VehiclesState;
  attach(state: VehiclesState): VehicleBuffers;
  update(state: VehiclesState, year: number): VehicleBuffers;
  dispose(state: VehiclesState): void;
}