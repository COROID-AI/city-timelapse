/**
 * Barrel export for the procedural asset-builder subsystem.
 *
 * Every builder accepts an `EraSpec` and returns cached Three.js groups keyed
 * by era + category. Consumers should import from this module rather than
 * reaching into individual builder files.
 */

// Era type system & registry (re-exported for convenience)
export type {
  EraId,
  EraSpec,
  SfxEraData,
  SfxEventSpec,
  SfxAmbientData,
  SfxTrafficData,
  SfxMusicData,
  SfxEventType,
} from '../eras.js';
export {
  ERA_REGISTRY,
  ERA_IDS,
  getEraSpec,
  getEraIndex,
  getPreviousEra,
  getNextEra,
  getSfxEraData,
  SFX_ERA_DATA,
} from '../eras.js';

// Visual asset-set selector
export type {
  AssetSet,
  BuildingAssetData,
  VehicleAssetData,
  OutfitPalette,
  StreetAssetData,
  WindowStyle,
  RoofStyle,
  AdStyle,
  VehicleShape,
  HatStyle,
  LampStyle,
} from './eras.js';
export { getAssetSet, getAssetSetById } from './eras.js';

// Procedural textures
export {
  getFacadeTexture,
  getSignageTexture,
  getAsphaltTexture,
  getSidewalkTexture,
  getSkyTexture,
  disposeAllTextures,
} from './textures.js';

// Building builder
export type { BuiltBuilding } from './buildings.js';
export {
  buildBuilding,
  disposeAllBuildings,
  randomStories,
  randomBays,
} from './buildings.js';

// Vehicle builder
export type { BuiltVehicle } from './vehicles.js';
export { buildVehicle, disposeAllVehicles } from './vehicles.js';

// Street builder
export type { BuiltStreet } from './streets.js';
export { buildStreet, disposeAllStreets } from './streets.js';

// Pedestrian builder
export type { BuiltPedestrian } from './pedestrian.js';
export {
  buildPedestrian,
  disposeAllPedestrians,
  PEDESTRIAN_VARIANTS_PER_ERA,
} from './pedestrian.js';

// Local imports so disposeAllAssets can call them directly.
import { disposeAllTextures } from './textures.js';
import { disposeAllBuildings } from './buildings.js';
import { disposeAllVehicles } from './vehicles.js';
import { disposeAllStreets } from './streets.js';
import { disposeAllPedestrians } from './pedestrian.js';

/** Dispose every cached asset across all builders (full teardown). */
export function disposeAllAssets(): void {
  disposeAllTextures();
  disposeAllBuildings();
  disposeAllVehicles();
  disposeAllStreets();
  disposeAllPedestrians();
}
