/**
 * Procedural building builder for the City Time Period Timelapse.
 *
 * Generates era-appropriate low-poly building meshes from simple Three.js
 * primitives. Each building is a boxed tower with a facade texture applied,
 * a roof treatment matching the era's `roofline` value, and optional
 * storefronts/ads on the ground floor.
 *
 * Buildings are cached per-era and per-lot-index so the same era always
 * produces the same skyline, which is essential for stable cross-era
 * transitions.
 */

import * as THREE from 'three';
import type { EraSpec, BuildingEraData } from '../eras/types.js';
import {
  cacheKey,
  assetCache,
  createRng,
  eraSeed,
  stdMaterial,
  boxMesh,
  disposeObject3D,
  pickFrom,
} from './util.js';
import { getFacadeTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard storey height in world units (metres). */
const STOREY_HEIGHT = 3.5;

/** Minimum building footprint (metres). */
const MIN_FOOTPRINT = 8;

/** Maximum building footprint (metres). */
const MAX_FOOTPRINT = 16;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters describing a single building lot. */
export interface BuildingLot {
  /** Lot index — used for deterministic RNG seeding. */
  index: number;
  /** Footprint width (X) in metres. */
  width: number;
  /** Footprint depth (Z) in metres. */
  depth: number;
  /** X position of the lot centre. */
  x: number;
  /** Z position of the lot centre. */
  z: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or fetch from cache) a single era-appropriate building.
 *
 * @param era  The era spec.
 * @param lot  The lot the building occupies.
 * @returns A cached `THREE.Group` positioned at the lot centre.
 */
export function getBuilding(era: EraSpec, lot: BuildingLot): THREE.Group {
  const key = cacheKey(era.id, `building:${lot.index}`);
  const cached = assetCache.get(key);
  if (cached) {
    // Return a clone positioned at the lot — the cached version is the template.
    const clone = cached.clone();
    clone.position.set(lot.x, 0, lot.z);
    clone.name = key;
    return clone;
  }

  const rng = createRng(eraSeed(era, `building:${lot.index}`));
  const group = buildBuilding(era, lot, rng);
  group.name = key;
  assetCache.set(key, group);

  // Return a clone positioned at the lot.
  const clone = group.clone();
  clone.position.set(lot.x, 0, lot.z);
  return clone;
}

/**
 * Generate a set of era-appropriate buildings for a list of lots.
 *
 * @param era   The era spec.
 * @param lots  The building lots.
 * @returns An array of positioned building groups.
 */
export function getBuildings(era: EraSpec, lots: readonly BuildingLot[]): THREE.Group[] {
  return lots.map((lot) => getBuilding(era, lot));
}

// ---------------------------------------------------------------------------
// Building construction
// ---------------------------------------------------------------------------

/**
 * Build a single building from primitives.
 *
 * The building consists of:
 * 1. A main tower (boxed) with the era's facade texture.
 * 2. A roof treatment matching `BuildingEraData.roofline`.
 * 3. Optional ground-floor storefront.
 */
function buildBuilding(era: EraSpec, lot: BuildingLot, rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const b = era.buildings;

  // Determine storeys
  const [minS, maxS] = b.storeyRange;
  const isTower = rng() < b.towerProbability;
  const storeys = isTower
    ? Math.floor(minS + rng() * (maxS * 1.5 - minS))
    : Math.floor(minS + rng() * (maxS - minS));
  const height = storeys * STOREY_HEIGHT;

  // Footprint
  const w = THREE.MathUtils.clamp(lot.width, MIN_FOOTPRINT, MAX_FOOTPRINT);
  const d = THREE.MathUtils.clamp(lot.depth, MIN_FOOTPRINT, MAX_FOOTPRINT);

  // Main tower with facade texture
  const facadeTex = getFacadeTexture(era);
  const facadeMat = new THREE.MeshStandardMaterial({
    map: facadeTex.clone(),
    roughness: 0.85,
    metalness: b.style === 'contemporary' || b.style === 'postmodern' ? 0.3 : 0.05,
  });
  // Configure cloned texture repeat for the building face
  const tex = facadeMat.map!;
  tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, storeys));
  tex.needsUpdate = true;

  const tower = boxMesh(w, height, d, facadeMat);
  tower.position.y = height / 2;
  group.add(tower);

  // Roof treatment
  const roof = buildRoof(b, w, d, height, rng);
  if (roof) {
    group.add(roof);
  }

  // Ground-floor storefront (only for low-rises on the street frontage)
  if (storeys <= 8 && rng() > 0.3) {
    const storefront = buildStorefrontFrontage(era, w, rng);
    storefront.position.set(0, 0, d / 2 + 0.05);
    group.add(storefront);
  }

  return group;
}

/**
 * Build a roof treatment matching the era's roofline style.
 */
function buildRoof(
  b: BuildingEraData,
  w: number,
  d: number,
  buildingHeight: number,
  rng: () => number,
): THREE.Object3D | null {
  const roofMat = stdMaterial('#3a3530', { roughness: 0.9, metalness: 0.05 });

  switch (b.roofline) {
    case 'flat-parapet': {
      // Thin parapet wall around the roof edge
      const parapet = boxMesh(w + 0.4, 0.8, d + 0.4, roofMat);
      parapet.position.y = buildingHeight + 0.4;
      return parapet;
    }
    case 'setback-pyramid': {
      // Stepped setback with a small cap
      const group = new THREE.Group();
      const step1 = boxMesh(w * 0.8, STOREY_HEIGHT, d * 0.8, roofMat);
      step1.position.y = buildingHeight + STOREY_HEIGHT / 2;
      group.add(step1);
      const cap = boxMesh(w * 0.4, STOREY_HEIGHT * 0.6, d * 0.4, roofMat);
      cap.position.y = buildingHeight + STOREY_HEIGHT + STOREY_HEIGHT * 0.3;
      group.add(cap);
      return group;
    }
    case 'mansard': {
      // Sloped mansard roof — approximate with a truncated pyramid
      const group = new THREE.Group();
      const mansard = boxMesh(w * 0.9, STOREY_HEIGHT * 0.5, d * 0.9, roofMat);
      mansard.position.y = buildingHeight + STOREY_HEIGHT * 0.25;
      group.add(mansard);
      const cap = boxMesh(w * 0.6, 0.5, d * 0.6, stdMaterial('#2a2520'));
      cap.position.y = buildingHeight + STOREY_HEIGHT * 0.5;
      group.add(cap);
      return group;
    }
    case 'crown': {
      // Decorative crown — a ring of small boxes
      const group = new THREE.Group();
      const crownMat = stdMaterial('#6a7080', { metalness: 0.4, roughness: 0.4 });
      const crownH = 1.5;
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        const cx = Math.cos(angle) * (w / 2);
        const cz = Math.sin(angle) * (d / 2);
        const seg = boxMesh(1.2, crownH, 1.2, crownMat);
        seg.position.set(cx, buildingHeight + crownH / 2, cz);
        group.add(seg);
      }
      return group;
    }
    case 'green-roof': {
      // Green roof — a flat slab with vegetation colour
      const greenMat = stdMaterial('#3a5f3a', { roughness: 0.95 });
      const roof = boxMesh(w, 0.5, d, greenMat);
      roof.position.y = buildingHeight + 0.25;
      // Add some foliage bumps
      const group = new THREE.Group();
      group.add(roof);
      const foliageMat = stdMaterial('#4a7a4a', { roughness: 1 });
      for (let i = 0; i < 6; i++) {
        const bump = boxMesh(1.5, 0.6, 1.5, foliageMat);
        bump.position.set(
          (rng() - 0.5) * w * 0.7,
          buildingHeight + 0.6,
          (rng() - 0.5) * d * 0.7,
        );
        group.add(bump);
      }
      return group;
    }
    default:
      return null;
  }
}

/**
 * Build a simple ground-floor storefront frontage (awning + sign).
 */
function buildStorefrontFrontage(
  era: EraSpec,
  buildingWidth: number,
  rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  const sf = era.storefronts;

  // Awning
  if (rng() < sf.awningProbability) {
    const awningColor = pickFrom(sf.palette, rng);
    const awningMat = stdMaterial(awningColor, { roughness: 0.7 });
    const awning = boxMesh(buildingWidth * 0.9, 0.15, 1.5, awningMat);
    awning.position.set(0, 2.8, 0.75);
    awning.rotation.x = -0.15; // slight tilt
    group.add(awning);
  }

  // Sign band
  const signMat = stdMaterial(pickFrom(sf.palette, rng), {
    emissive: sf.signStyle === 'neon' ? '#ff00ff' : '#000000',
    emissiveIntensity: sf.signStyle === 'neon' ? 0.5 : 0,
  });
  const sign = boxMesh(buildingWidth * 0.7, 0.8, 0.1, signMat);
  sign.position.set(0, 3.5, 0.05);
  group.add(sign);

  return group;
}

/**
 * Dispose all cached building assets for a specific era.
 * @param eraId  The era to clean up.
 */
export function disposeEraBuildings(eraId: string): void {
  const prefix = `${eraId}:building:`;
  for (const [key, group] of assetCache.entries()) {
    if (key.startsWith(prefix)) {
      disposeObject3D(group);
      assetCache.delete(key);
    }
  }
}
