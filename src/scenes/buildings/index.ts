/**
 * Per-era buildings & architecture systems (1945–2025).
 *
 * Owns `src/scenes/buildings/` and renders the block's architecture for all
 * five eras from the shared era registry, positioned on the layout lot bounds.
 *
 * Exported surface:
 *   - `Buildings` — lifecycle object with `instantiate`, `attach`, `update`,
 *     `dispose` (the produced contract).
 *   - `eraDataForYear`, `resolveBuilding`, `resolveDetails`, `mergeGeometry`,
 *     `buildBuildings` — pure computation helpers used by the lifecycle and
 *     by the co-located component test.
 *   - Re-exported types.
 *
 * Era data and lot geometry are consumed read-only from `src/scenes/eras/`
 * and `src/scenes/layout/`; nothing here redefines them.
 *
 * @packageDocumentation
 */

import { CITY_BLOCK_LAYOUT } from '../layout/index.js';
import { buildBuildings } from './buildings.js';
import type { MergedGeometry } from './types.js';

export * from './types.js';
export * from './buildings.js';

/** Mutable render state held by a live `Buildings` instance. */
interface BuildingsState {
  /** The era year currently resolved and rendered. */
  year: number;
  /** The last merged, instanced geometry buffers. */
  geometry: MergedGeometry;
  /** Whether the instance has been attached (mounted). */
  attached: boolean;
}

/**
 * The `Buildings` scene subsystem. Lifecycle: `instantiate` -> `attach` ->
 * `update` -> `dispose`.
 */
export const Buildings = {
  /**
   * Create a new buildings instance for the given era year. Does not mount
   * anything yet — call `attach` to add the geometry to the scene.
   */
  instantiate(year: number): BuildingsState {
    const geometry = buildBuildings(year);
    return { year, geometry, attached: false };
  },

  /**
   * Mount the instance. Marks it attached and returns the merged geometry so
   * the integration owner can push the static buffers to a renderer.
   */
  attach(state: BuildingsState): MergedGeometry {
    state.attached = true;
    return state.geometry;
  },

  /**
   * Update the instance to a new era year, recomputing and merging all
   * geometry. Returns the new merged buffers. Facade height/material/signage
   * interpolate smoothly because numeric aspects follow `interpolateEra`.
   */
  update(state: BuildingsState, year: number): MergedGeometry {
    state.year = year;
    state.geometry = buildBuildings(year);
    return state.geometry;
  },

  /**
   * Dispose the instance. Marks it detached. The clean-up of any renderer
   * buffers is the integration owner's responsibility; this module only owns
   * the plain-data geometry.
   */
  dispose(state: BuildingsState): void {
    state.attached = false;
  },
};

/** Convenience: current number of building lots / instances in the block. */
export function buildingInstanceCount(): number {
  return CITY_BLOCK_LAYOUT.lots.length;
}