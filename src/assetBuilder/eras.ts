/**
 * Era asset-set aggregator for the City Time Period Timelapse.
 *
 * This module is the **single entry point** the scene-composition layer uses
 * to obtain all procedural assets for a given era. It delegates to the
 * individual builders (buildings, vehicles, streets, pedestrians, textures)
 * and returns a bundled {@link EraAssetSet} so callers never need to know
 * the internal cache keys or builder APIs.
 *
 * Every builder caches its output keyed by `"${eraId}:${category}"`, so
 * calling {@link getEraAssets} repeatedly for the same era is cheap — the
 * first call generates everything, subsequent calls return the same
 * references.
 */

import * as THREE from 'three';
import type { EraSpec, EraId } from '../eras/types.js';
import { getEraTextures, type EraTextures } from './textures.js';
import { getBuilding, getBuildings, type BuildingLot } from './buildings.js';
import { getVehicle } from './vehicles.js';
import { getPedestrian } from './pedestrian.js';
import { getStreets } from './streets.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A complete bundle of generated assets for a single era.
 *
 * Returned by {@link getEraAssets}. The `buildings` field is empty until
 * lots are provided via {@link populateBuildings}.
 */
export interface EraAssetSet {
  /** The era spec these assets were generated for. */
  era: EraSpec;
  /** All procedural textures for the era. */
  textures: EraTextures;
  /** The street furniture group (road, sidewalks, curbs, lamp posts). */
  streets: THREE.Group;
  /** A representative set of vehicle variants (one per body style). */
  vehicles: THREE.Group[];
  /** A representative set of pedestrian variants (one per silhouette). */
  pedestrians: THREE.Group[];
  /** Building groups, populated after {@link populateBuildings}. */
  buildings: THREE.Group[];
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

/**
 * Per-era asset-set cache. Stores the fully-assembled {@link EraAssetSet}
 * so that switching back to a previously visited era is instant.
 */
const eraAssetCache = new Map<EraId, EraAssetSet>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get (or generate) the complete set of procedural assets for an era.
 *
 * This is the primary entry point used by the scene bootstrap. It assembles
 * textures, streets, representative vehicles, and representative pedestrians
 * into a single bundle. Buildings are **not** generated here — they require
 * lot information from the city-block layout, so call
 * {@link populateBuildings} after the block layout is known.
 *
 * @param era  The era spec.
 * @returns A cached {@link EraAssetSet} for the era.
 */
export function getEraAssets(era: EraSpec): EraAssetSet {
  const cached = eraAssetCache.get(era.id);
  if (cached) return cached;

  const textures = getEraTextures(era);
  const streets = getStreets(era);

  // Generate one vehicle per body style (representative variants)
  const vehicles: THREE.Group[] = [];
  for (let i = 0; i < era.vehicles.bodyStyles.length; i++) {
    vehicles.push(getVehicle(era, i));
  }

  // Generate one pedestrian per silhouette (representative variants)
  const pedestrians: THREE.Group[] = [];
  for (let i = 0; i < era.pedestrians.silhouettes.length; i++) {
    pedestrians.push(getPedestrian(era, i));
  }

  const assetSet: EraAssetSet = {
    era,
    textures,
    streets,
    vehicles,
    pedestrians,
    buildings: [],
  };

  eraAssetCache.set(era.id, assetSet);
  return assetSet;
}

/**
 * Generate buildings for an era's asset set, given the lot layout.
 *
 * This is called after the city-block layout has been computed, since the
 * lots depend on the block geometry. The generated buildings are stored in
 * the {@link EraAssetSet.buildings} array and also returned for convenience.
 *
 * @param era   The era spec.
 * @param lots  The building lots from the city-block layout.
 * @returns The array of generated building groups.
 */
export function populateBuildings(era: EraSpec, lots: readonly BuildingLot[]): THREE.Group[] {
  const assetSet = getEraAssets(era);
  const buildings = getBuildings(era, lots);
  assetSet.buildings = buildings;
  return buildings;
}

/**
 * Get a single building for an era and lot (convenience wrapper).
 *
 * @param era  The era spec.
 * @param lot  The building lot.
 * @returns A positioned building group.
 */
export function getEraBuilding(era: EraSpec, lot: BuildingLot): THREE.Group {
  return getBuilding(era, lot);
}

/**
 * Check whether assets for an era have already been generated and cached.
 * @param eraId  The era id to check.
 */
export function hasEraAssets(eraId: EraId): boolean {
  return eraAssetCache.has(eraId);
}

/**
 * Pre-generate assets for all eras at load time.
 *
 * Useful to avoid frame hitches when the user first switches to each era.
 *
 * @param eras  The full era registry (from `getAllEras()`).
 */
export function pregenerateAllEraAssets(eras: readonly EraSpec[]): void {
  for (const era of eras) {
    getEraAssets(era);
  }
}

/**
 * Clear the cached asset set for a single era (does not dispose GPU resources).
 * Use {@link disposeEraAssets} for full cleanup.
 * @param eraId  The era to evict from the cache.
 */
export function clearEraAssets(eraId: EraId): void {
  eraAssetCache.delete(eraId);
}

/**
 * The number of cached era asset sets.
 */
export function cachedEraCount(): number {
  return eraAssetCache.size;
}
