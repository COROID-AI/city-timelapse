/**
 * Era asset selector — the single entry point for obtaining all procedural
 * assets for a given {@link EraSpec}.
 *
 * This module consumes an `EraSpec` from the typed registry
 * (`getEraSpec` / `ALL_ERA_SPECS`) and exposes a unified `EraAssetSet` that
 * bundles textures, buildings, vehicles, streets, and pedestrians for that
 * era. Every underlying builder caches by `(eraId, category)` so repeated
 * calls for the same era return cached, reused assets.
 *
 * Downstream modules (cityBlock, trafficSystem, pedestrian system, scene
 * bootstrap) import from here rather than reaching into individual builder
 * files, keeping the dependency surface clean.
 */
import type * as THREE from 'three';
import type { EraSpec, EraId } from '../eraRegistry';
import { getEraSpec, ALL_ERA_SPECS } from '../eraRegistry';
import type { EraTextureSet } from './textures';
import {
  getEraTextureSet,
  buildSkyMaterial,
  clearTextureCache,
} from './textures';
import { buildBuilding, type BuildingLot } from './buildings';
import { buildVehicle, clearVehicleCache } from './vehicles';
import {
  buildStreetSegment,
  buildLampPostAsset,
  buildTrafficLightAsset,
  placeLampPosts,
  type StreetDimensions,
  clearStreetCache,
} from './streets';
import { buildPedestrian, clearPedestrianCache } from './pedestrian';

// ---------------------------------------------------------------------------
// Public re-exports (so downstream only needs one import)
// ---------------------------------------------------------------------------

export type { EraSpec, EraId } from '../eraRegistry';
export { getEraSpec, ALL_ERA_SPECS } from '../eraRegistry';
export type { BuildingLot } from './buildings';
export type { StreetDimensions } from './streets';
export type { EraTextureSet } from './textures';

// ---------------------------------------------------------------------------
// EraAssetSet — bundles every asset category for one era
// ---------------------------------------------------------------------------

/**
 * A lazy asset set for a single era.
 *
 * Texture and material accessors are cached on first access; mesh builders
 * are functions that clone cached prototypes so callers can position instances
 * independently.
 */
export interface EraAssetSet {
  readonly spec: EraSpec;
  readonly eraId: EraId;

  /** Cached texture set (facades, asphalt, sidewalk, sky, lane markings). */
  readonly textures: EraTextureSet;

  /** Sky material (BackSide sphere). */
  readonly skyMaterial: THREE.MeshBasicMaterial;

  // --- Builder functions (clone cached prototypes) ---

  /** Build a single building for the given lot. */
  buildBuilding: (lot: BuildingLot) => THREE.Group;

  /** Build a vehicle variant. */
  buildVehicle: (variantSeed: number) => THREE.Group;

  /** Build a pedestrian variant. */
  buildPedestrian: (variantSeed: number) => THREE.Group;

  /** Build a street segment (asphalt + sidewalk + curb + lane markings). */
  buildStreetSegment: (dims: StreetDimensions) => THREE.Group;

  /** Build a lamp post (era-correct style). */
  buildLampPost: () => THREE.Group;

  /** Build a traffic light pole. */
  buildTrafficLight: () => THREE.Group;

  /** Place lamp posts along a street segment group. */
  placeLampPosts: (group: THREE.Group, dims: StreetDimensions, spacing?: number) => void;
}

// ---------------------------------------------------------------------------
// Asset-set cache (one per eraId)
// ---------------------------------------------------------------------------

const assetSetCache = new Map<EraId, EraAssetSet>();

/**
 * Get (or lazily build and cache) the complete asset set for an era.
 *
 * @param eraIdOrSpec  Either an era ID string or a full {@link EraSpec}.
 */
export function getEraAssetSet(eraIdOrSpec: EraId | EraSpec): EraAssetSet {
  const spec: EraSpec =
    typeof eraIdOrSpec === 'string' ? getEraSpec(eraIdOrSpec) : eraIdOrSpec;

  let set = assetSetCache.get(spec.eraId as EraId);
  if (set) return set;

  // Pre-warm the texture set + sky material (cached internally)
  const textures = getEraTextureSet(spec);
  const skyMaterial = buildSkyMaterial(spec);

  set = {
    spec,
    eraId: spec.eraId as EraId,
    textures,
    skyMaterial,
    buildBuilding: (lot: BuildingLot) => buildBuilding(spec, lot),
    buildVehicle: (variantSeed: number) => buildVehicle(spec, variantSeed),
    buildPedestrian: (variantSeed: number) => buildPedestrian(spec, variantSeed),
    buildStreetSegment: (dims: StreetDimensions) => buildStreetSegment(spec, dims),
    buildLampPost: () => buildLampPostAsset(spec),
    buildTrafficLight: () => buildTrafficLightAsset(spec),
    placeLampPosts: (group: THREE.Group, dims: StreetDimensions, spacing = 20) =>
      placeLampPosts(spec, group, dims, spacing),
  };

  assetSetCache.set(spec.eraId as EraId, set);
  return set;
}

/** Pre-warm asset sets for all five eras (call once at startup). */
export function prewarmAllEras(): EraAssetSet[] {
  return ALL_ERA_SPECS.map((spec) => getEraAssetSet(spec));
}

/** Get asset sets for all eras (cached). */
export function getAllEraAssetSets(): EraAssetSet[] {
  return ALL_ERA_SPECS.map((spec) => getEraAssetSet(spec));
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/** Clear every asset cache across all builders and the asset-set map. */
export function clearAllAssetCaches(): void {
  clearTextureCache();
  clearVehicleCache();
  clearStreetCache();
  clearPedestrianCache();
  assetSetCache.clear();
}
