/**
 * Per-era vehicle fleet & traffic (1945–2025).
 *
 * Owns `src/scenes/vehicles/` and renders the block's traffic for all five
 * eras from the shared era registry, positioned on the layout traffic lanes.
 *
 * Exported surface:
 *   - `Vehicles` — lifecycle object with `instantiate`, `attach`, `update`,
 *     `dispose` (the produced contract).
 *   - `buildFleet`, `eraDataForYear`, `vehicleInstanceCount` — pure
 *     computation helpers used by the lifecycle and by the co-located test.
 *   - Re-exported types.
 *
 * Era data and lane geometry are consumed read-only from `src/scenes/eras/`
 * and `src/scenes/layout/`; nothing here redefines them.
 *
 * @packageDocumentation
 */

import { buildFleet } from './fleet.js';
import type { VehicleBuffers, VehiclesState } from './types.js';

export * from './types.js';
export * from './fleet.js';
export * from './traffic.js';

/**
 * The `Vehicles` scene subsystem. Lifecycle: `instantiate` -> `attach` ->
 * `update` -> `dispose`.
 */
export const Vehicles: {
  instantiate(year: number): VehiclesState;
  attach(state: VehiclesState): VehicleBuffers;
  update(state: VehiclesState, year: number): VehicleBuffers;
  dispose(state: VehiclesState): void;
} = {
  /**
   * Create a new vehicles instance for the given era year. Does not mount
   * anything yet — call `attach` to add the fleet to the scene.
   */
  instantiate(year: number): VehiclesState {
    const geometry = buildFleet(year);
    return { year, geometry, attached: false };
  },

  /**
   * Mount the instance. Marks it attached and returns the merged buffers so
   * the integration owner can push the static fleet to a renderer.
   */
  attach(state: VehiclesState): VehicleBuffers {
    state.attached = true;
    return state.geometry;
  },

  /**
   * Update the instance to a new era year, recomputing and merging all fleet
   * buffers. Traffic behaviour interpolates smoothly because numeric aspects
   * follow `interpolateEra`.
   */
  update(state: VehiclesState, year: number): VehicleBuffers {
    state.year = year;
    state.geometry = buildFleet(year);
    return state.geometry;
  },

  /**
   * Dispose the instance. Marks it detached. The clean-up of any renderer
   * buffers is the integration owner's responsibility; this module only owns
   * the plain-data fleet.
   */
  dispose(state: VehiclesState): void {
    state.attached = false;
  },
};