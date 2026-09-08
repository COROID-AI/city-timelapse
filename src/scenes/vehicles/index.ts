import type { EraData } from '../eras/types.js';
import type { CityBlockLayout, Point2 } from '../layout/types.js';
import type { VehicleInstance } from './types.js';
import { spawnFleet } from './fleet.js';
import { parkVehicles, updateTraffic } from './traffic.js';

/**
 * Vehicles scene — era-authentic fleet & traffic (1945–2025).
 *
 * Lifecycle:
 *  - `createVehicles(era, layout, seed?)` instantiates the era's fleet onto
 *    the shared traffic loops (read-only consumption of the layout).
 *  - `attachVehicles` returns the mounted instances (a scene can attach them
 *    to its object graph).
 *  - `updateVehicles(vehicles, era, layout, dt)` advances traffic, idling at
 *    intersections with per-era motion.
 *  - `disposeVehicles` releases the fleet.
 *
 * The fleet's body silhouettes, paint palettes, and material values are driven
 * by the shared era data, so passing an interpolated `EraData` (from
 * `getInterpolatedEra`) yields a fleet whose bodies interpolate across a
 * transition.
 */

/** Mount the era-authentic fleet on the shared traffic loops. */
export function createVehicles(
  era: EraData,
  layout: CityBlockLayout,
  seed = 2025,
): VehicleInstance[] {
  return spawnFleet(era, layout, seed);
}

/** Attach the mounted fleet (returns the instances for the object graph). */
export function attachVehicles(fleet: VehicleInstance[]): VehicleInstance[] {
  return fleet;
}

/** Advance traffic by `dt` seconds using the shared layout. */
export function updateVehicles(
  fleet: VehicleInstance[],
  era: EraData,
  layout: CityBlockLayout,
  dt: number,
): void {
  updateTraffic(fleet, era, layout, dt);
}

/** Release the fleet. */
export function disposeVehicles(fleet: VehicleInstance[]): void {
  fleet.length = 0;
}

/**
 * Full lifecycle convenience: build a mounted fleet for an era and optionally
 * park `parkCount` vehicles along the shared lane.
 */
export function mountVehicles(
  era: EraData,
  layout: CityBlockLayout,
  options?: { seed?: number; parkCount?: number },
): VehicleInstance[] {
  const fleet = createVehicles(era, layout, options?.seed ?? 2025);
  const parkCount = options?.parkCount ?? 0;
  if (parkCount > 0) {
    parkVehicles(fleet, layout, parkCount);
  }
  return fleet;
}

export * from './types.js';
export * from './fleet.js';
export * from './traffic.js';