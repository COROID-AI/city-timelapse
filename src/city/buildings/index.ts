/**
 * Public surface of the era building layer.
 *
 * This barrel is the only module other owners may import: the scene
 * integration, the transition director, the storefront layer and the layer's
 * own harness page all consume it, so the file layout stays free to change.
 *
 * The contract in one place:
 *
 * - `planBuildingSet` / `planPlot` decide massing, facades, roof kits and
 *   vacant/construction states as deterministic data;
 * - `buildBuildingSet` is the three.js bridge, `createBuildingLayer` the live
 *   layer, and `applyEra` / `applyEraTransition` are the two functions the
 *   transition director drives (instant switch and staged cross-fade);
 * - `BuildingsLayer` is the React binding for `<SceneCanvas>` children;
 * - `createBuildingScene` builds the real layout plus a layer for harnesses, so
 *   per-era browser verification never depends on the composed application;
 * - `BUILDING_TABLES` is the five era records, and `createRecordingTextureFactory`
 *   is the injectable texture stub tests use instead of a DOM canvas.
 *
 * Era ids and the layout generator are re-exported here on purpose: a harness
 * page can then mount the layer end to end while importing exactly one module.
 */

export * from './types'
export * from './tables'
export * from './massing'
export * from './facades'
export * from './roofKits'
export * from './textures'
export * from './BuildingsLayer'

/**
 * Era registry surface the layer is authored against.
 *
 * Re-exported so a consumer that already depends on the buildings (including
 * the layer's own harness) can enumerate the timeline without a second import.
 */
export {
  ERA_COUNT,
  ERA_DEFINITIONS,
  ERA_ID_ORDER,
  ERA_IDS,
  ERA_YEAR_BY_ID,
  ERA_YEAR_ORDER,
  ERA_YEARS,
  LATEST_ERA_ID,
  getEra,
  getNextEra,
  getPreviousEra,
} from '../../era'
export type { EraDefinition, EraId, EraYear } from '../../era'

/** Layout surface the layer consumes, re-exported for harnesses. */
export {
  CANONICAL_LAYOUT_SEED,
  buildLayoutObject,
  createCityLayout,
  generateBlock,
  layoutHash,
  footprintsOverlap,
} from '../layout'
export type { Anchor, BlockLayout, CityLayout, Parcel, StreetName } from '../layout'
