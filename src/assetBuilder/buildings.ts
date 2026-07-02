/**
 * Procedural building builder.
 *
 * Generates a boxed building mesh whose facade, windows, signage, and roof
 * detailing are all era-appropriate. Buildings are cached per (eraId + variant)
 * so the same geometry/materials are reused across the block.
 */

import * as THREE from 'three';

import type { EraSpec } from '../eras.js';
import { getAssetSet } from './eras.js';
import type { AssetSet } from './eras.js';
import { getFacadeTexture, getSignageTexture } from './textures.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

/** A built building asset: the group plus its dimensions. */
export interface BuiltBuilding {
  readonly group: THREE.Group;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

const buildingCache = new Map<string, BuiltBuilding>();

const STORY_HEIGHT = 3.2;

/**
 * Build (or fetch a cached) building for the given era and variant.
 *
 * @param spec    The era specification.
 * @param variant Palette / signage index — buildings with the same variant
 *                 share geometry and textures.
 * @param stories Number of stories (determines height).
 * @param bays    Number of window bays along the front face.
 * @param width   Building footprint width (X).
 * @param depth   Building footprint depth (Z).
 */
export function buildBuilding(
  spec: EraSpec,
  variant: number,
  stories: number,
  bays: number,
  width: number,
  depth: number,
): BuiltBuilding {
  const set = getAssetSet(spec);
  const cacheKey = `${spec.id}:bld:${variant}:${stories}:${bays}:${width.toFixed(2)}:${depth.toFixed(2)}`;
  const existing = buildingCache.get(cacheKey);
  if (existing) return existing;

  const group = new THREE.Group();
  group.name = `building:${spec.id}:${variant}`;

  const height = stories * STORY_HEIGHT;

  // ── Facade materials (one per side so textures look right) ──────────────
  const facadeTex = getFacadeTexture(set, variant, stories, bays);
  const sideTex = facadeTex.clone();
  sideTex.needsUpdate = true;

  const facadeMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: set.building.masonry === 'brick' ? 0.85 : 0.6,
    metalness: set.building.masonry === 'composite' ? 0.4 : 0.1,
  });

  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: facadeMat.roughness,
    metalness: facadeMat.metalness,
  });

  // Simple flat-color material for top and bottom
  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(set.building.facadePalette[variant % set.building.facadePalette.length]),
    roughness: 0.9,
    metalness: 0.05,
  });

  // Box geometry — material order: +X, -X, +Y, -Y, +Z, -Z
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, [sideMat, sideMat, capMat, capMat, facadeMat, facadeMat]);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // ── Roof detailing ───────────────────────────────────────────────────────
  addRoofDetail(group, set, width, depth, height);

  // ── Storefront signage on the front face (+Z) ───────────────────────────
  if (Math.random() < set.building.storefrontDensity || variant % 2 === 0) {
    addStorefront(group, set, variant, width, height, depth);
  }

  const built: BuiltBuilding = { group, width, depth, height };
  buildingCache.set(cacheKey, built);
  return built;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roof detailing
// ─────────────────────────────────────────────────────────────────────────────

function addRoofDetail(
  group: THREE.Group,
  set: AssetSet,
  width: number,
  depth: number,
  height: number,
): void {
  const roofStyle = set.building.roofStyle;
  const accent = new THREE.Color(set.building.accentColor);

  // Parapet cap around the top edge
  const parapetGeo = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
  const parapetMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
  const parapet = new THREE.Mesh(parapetGeo, parapetMat);
  parapet.position.y = height + 0.2;
  parapet.castShadow = true;
  group.add(parapet);

  switch (roofStyle) {
    case 'water-tank': {
      // Cylindrical wooden water tank
      const tankGeo = new THREE.CylinderGeometry(width * 0.12, width * 0.12, height * 0.1, 12);
      const tankMat = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.9 });
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(width * 0.2, height + 0.4 + height * 0.05, -depth * 0.2);
      tank.castShadow = true;
      group.add(tank);
      // Stand legs
      const legGeo = new THREE.BoxGeometry(0.15, height * 0.08, 0.15);
      const legMat = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 0.9 });
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(width * 0.2 + lx * width * 0.08, height + 0.4 + height * 0.02, -depth * 0.2 + lz * width * 0.08);
        group.add(leg);
      }
      break;
    }
    case 'antenna': {
      // TV antenna mast
      const mastGeo = new THREE.CylinderGeometry(0.06, 0.06, height * 0.3, 6);
      const mastMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.6, metalness: 0.6 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.set(0, height + 0.4 + height * 0.15, 0);
      group.add(mast);
      // Cross arms
      for (let i = 0; i < 2; i++) {
        const armGeo = new THREE.BoxGeometry(width * 0.15, 0.05, 0.05);
        const arm = new THREE.Mesh(armGeo, mastMat);
        arm.position.set(0, height + 0.4 + height * (0.05 + i * 0.08), 0);
        group.add(arm);
      }
      break;
    }
    case 'ac-units': {
      // Cluster of rooftop AC units
      const acMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', roughness: 0.7, metalness: 0.3 });
      const count = 3;
      for (let i = 0; i < count; i++) {
        const acGeo = new THREE.BoxGeometry(width * 0.15, 0.6, depth * 0.15);
        const ac = new THREE.Mesh(acGeo, acMat);
        ac.position.set(
          (i - 1) * width * 0.25,
          height + 0.7,
          (i % 2 === 0 ? 1 : -1) * depth * 0.2,
        );
        ac.castShadow = true;
        group.add(ac);
      }
      break;
    }
    case 'solar': {
      // Solar panel array
      const panelMat = new THREE.MeshStandardMaterial({
        color: '#1a2a4a',
        roughness: 0.3,
        metalness: 0.7,
        emissive: new THREE.Color('#0a1a2a'),
      });
      const rows = 2;
      const cols = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const panelGeo = new THREE.BoxGeometry(width * 0.25, 0.08, depth * 0.3);
          const panel = new THREE.Mesh(panelGeo, panelMat);
          panel.position.set(
            (c - 1) * width * 0.28,
            height + 0.5,
            (r - 0.5) * depth * 0.35,
          );
          panel.rotation.x = -0.2;
          panel.castShadow = true;
          group.add(panel);
        }
      }
      break;
    }
    case 'flat':
    default:
      // Just the parapet
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storefront / signage
// ─────────────────────────────────────────────────────────────────────────────

function addStorefront(
  group: THREE.Group,
  set: AssetSet,
  variant: number,
  width: number,
  height: number,
  depth: number,
): void {
  // Awning over the ground floor
  const awningMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(set.building.accentColor),
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const awningGeo = new THREE.PlaneGeometry(width * 0.9, 1.2);
  const awning = new THREE.Mesh(awningGeo, awningMat);
  awning.position.set(0, STORY_HEIGHT * 0.9, depth / 2 + 0.05);
  awning.rotation.x = -0.4;
  group.add(awning);

  // Signage panel below the awning
  const signTex = getSignageTexture(set, variant % set.building.signageWords.length, variant);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: new THREE.Color(
      set.building.adStyle === 'neon' || set.building.adStyle === 'led-screen' || set.building.adStyle === 'holographic'
        ? '#ffffff'
        : '#000000',
    ),
    emissiveMap: signTex,
    emissiveIntensity:
      set.building.adStyle === 'neon' ? 0.6 :
      set.building.adStyle === 'led-screen' ? 0.8 :
      set.building.adStyle === 'holographic' ? 1.0 :
      0.0,
    roughness: 0.5,
  });
  const signGeo = new THREE.PlaneGeometry(width * 0.7, STORY_HEIGHT * 0.4);
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, STORY_HEIGHT * 0.45, depth / 2 + 0.06);
  group.add(sign);

  // Ground-floor window (glass storefront)
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#2a3a3a',
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7,
  });
  const glassGeo = new THREE.PlaneGeometry(width * 0.85, STORY_HEIGHT * 0.7);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, STORY_HEIGHT * 0.4, depth / 2 + 0.04);
  group.add(glass);
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposal
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose all cached building groups and their geometry/materials. */
export function disposeAllBuildings(): void {
  for (const built of buildingCache.values()) {
    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }
  buildingCache.clear();
}

/** Get a random story count within the era's height range. */
export function randomStories(spec: EraSpec, rng: () => number = Math.random): number {
  const set = getAssetSet(spec);
  const [min, max] = set.building.heightRange;
  return Math.floor(min + rng() * (max - min + 1));
}

/** Get a random bay count (windows across the front). */
export function randomBays(rng: () => number = Math.random): number {
  return 3 + Math.floor(rng() * 4); // 3–6 bays
}
