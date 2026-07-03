/**
 * Procedural pedestrian builder for the City Time Period Timelapse.
 *
 * Generates era-appropriate low-poly humanoid figures from simple Three.js
 * primitives (boxes, cylinders, spheres). Each pedestrian is styled
 * according to the era's silhouette vocabulary and clothing palette.
 *
 * Pedestrians are cached per-era and per-variant-index so the same era
 * always produces the same characters.
 */

import * as THREE from 'three';
import type { EraSpec, PedestrianOutfitEraData } from '../eras/types.js';
import {
  cacheKey,
  assetCache,
  createRng,
  eraSeed,
  stdMaterial,
  boxMesh,
  cylMesh,
  pickFrom,
} from './util.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total pedestrian height in metres. */
const PEDESTRIAN_HEIGHT = 1.7;

// Body segment proportions (fractions of total height)
const HEAD_H = 0.12;
const TORSO_H = 0.32;
const LEG_H = 0.46;
const ARM_H = 0.36;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Describes a single pedestrian variant for external reference. */
export interface PedestrianVariant {
  /** The silhouette label from the era's vocabulary. */
  silhouette: string;
  /** Index into the era's clothing palette. */
  colorIndex: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or fetch from cache) an era-appropriate pedestrian.
 *
 * @param era          The era spec.
 * @param variantIndex  Index into the era's silhouettes array.
 * @returns A cached `THREE.Group` representing the pedestrian, feet at y=0.
 */
export function getPedestrian(era: EraSpec, variantIndex = 0): THREE.Group {
  const key = cacheKey(era.id, `pedestrian:${variantIndex}`);
  const cached = assetCache.get(key);
  if (cached) return cached;

  const rng = createRng(eraSeed(era, `pedestrian:${variantIndex}`));
  const group = buildPedestrian(era, variantIndex, rng);
  group.name = key;
  return assetCache.set(key, group);
}

// ---------------------------------------------------------------------------
// Pedestrian construction
// ---------------------------------------------------------------------------

/**
 * Build a complete pedestrian from primitives.
 */
function buildPedestrian(era: EraSpec, variantIndex: number, rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const p = era.pedestrians;

  // Select silhouette
  const silhouette = p.silhouettes[variantIndex % p.silhouettes.length] ?? 'casual-jeans';
  const colorIndex = variantIndex % p.palette.length;
  const clothingColor = p.palette[colorIndex] ?? '#2b2b2b';

  // Skin tone — neutral warm, varied slightly
  const skinTones = ['#d4a373', '#c4956a', '#b8855e', '#e0b894'];
  const skinColor = skinTones[Math.floor(rng() * skinTones.length)] ?? '#d4a373';

  // Build body parts
  const torso = buildTorso(silhouette, clothingColor, p, rng);
  group.add(torso);

  const head = buildHead(skinColor);
  group.add(head);

  const legs = buildLegs(silhouette, clothingColor, p, rng);
  group.add(legs);

  const arms = buildArms(silhouette, clothingColor, rng);
  group.add(arms);

  // Headwear
  const headwearType = pickFrom(p.headwear, rng);
  const headwear = buildHeadwear(headwearType, rng);
  if (headwear) {
    group.add(headwear);
  }

  // Smartphone prop
  if (p.hasPhones && rng() > 0.5) {
    const phone = buildSmartphone();
    group.add(phone);
  }

  return group;
}

/** Build the torso (body) segment, styled by silhouette. */
function buildTorso(
  silhouette: string,
  color: string,
  _p: PedestrianOutfitEraData,
  _rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  const torsoMat = stdMaterial(color, { roughness: 0.8, metalness: 0.05 });
  const torsoH = PEDESTRIAN_HEIGHT * TORSO_H;
  const torsoY = PEDESTRIAN_HEIGHT * (LEG_H + TORSO_H / 2);

  // Default torso dimensions
  let torsoW = 0.42;
  let torsoD = 0.24;

  switch (silhouette) {
    case 'zoot':
    case 'power-suit':
      torsoW = 0.5; // broad shoulders
      break;
    case 'sheath-dress':
      torsoW = 0.34;
      torsoD = 0.2;
      break;
    case 'mod-mini':
      torsoW = 0.36;
      break;
    case 'streetwear':
      torsoW = 0.52; // oversized
      torsoD = 0.28;
      break;
    case 'athleisure':
      torsoW = 0.4;
      torsoD = 0.22;
      break;
  }

  const torso = boxMesh(torsoW, torsoH, torsoD, torsoMat);
  torso.position.y = torsoY;
  group.add(torso);

  // Dress for sheath-dress — extends below torso
  if (silhouette === 'sheath-dress' || silhouette === 'mod-mini') {
    const dressLen = silhouette === 'mod-mini' ? 0.35 : 0.55;
    const dress = boxMesh(torsoW * 1.1, dressLen, torsoD * 1.1, torsoMat);
    dress.position.y = torsoY - torsoH / 2 - dressLen / 2 + 0.05;
    group.add(dress);
  }

  return group;
}

/** Build the head segment. */
function buildHead(skinColor: string): THREE.Group {
  const group = new THREE.Group();
  const skinMat = stdMaterial(skinColor, { roughness: 0.7, metalness: 0.05 });
  const headH = PEDESTRIAN_HEIGHT * HEAD_H;
  const headY = PEDESTRIAN_HEIGHT * (LEG_H + TORSO_H + HEAD_H / 2);

  // Head — slightly rounded box
  const head = boxMesh(0.2, headH, 0.2, skinMat);
  head.position.y = headY;
  group.add(head);

  // Neck
  const neck = cylMesh(0.05, 0.05, 0.06, 6, skinMat);
  neck.position.y = headY - headH / 2 - 0.03;
  group.add(neck);

  return group;
}

/** Build the legs segment, styled by silhouette. */
function buildLegs(
  silhouette: string,
  color: string,
  _p: PedestrianOutfitEraData,
  _rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  const legH = PEDESTRIAN_HEIGHT * LEG_H;
  const legY = legH / 2;

  // Skip visible legs for dress silhouettes (dress covers them)
  if (silhouette === 'sheath-dress') {
    // Bare lower legs below the dress
    const skinMat = stdMaterial('#d4a373', { roughness: 0.7 });
    const lowerLegH = 0.3;
    const leftLeg = boxMesh(0.08, lowerLegH, 0.08, skinMat);
    leftLeg.position.set(-0.06, lowerLegH / 2, 0);
    group.add(leftLeg);
    const rightLeg = boxMesh(0.08, lowerLegH, 0.08, skinMat);
    rightLeg.position.set(0.06, lowerLegH / 2, 0);
    group.add(rightLeg);
    return group;
  }

  // Determine leg color
  let legColor = color; // same as torso by default
  if (silhouette === 'casual-jeans') {
    legColor = '#2a3a5a'; // denim blue
  } else if (silhouette === 'business-suit' || silhouette === 'power-suit') {
    legColor = '#1a1a1a'; // dark trousers
  } else if (silhouette === 'streetwear' || silhouette === 'athleisure') {
    legColor = '#2b2b2b';
  }

  const legMat = stdMaterial(legColor, { roughness: 0.85, metalness: 0.05 });

  const leftLeg = boxMesh(0.1, legH, 0.12, legMat);
  leftLeg.position.set(-0.08, legY, 0);
  group.add(leftLeg);

  const rightLeg = boxMesh(0.1, legH, 0.12, legMat);
  rightLeg.position.set(0.08, legY, 0);
  group.add(rightLeg);

  // Shoes
  const shoeMat = stdMaterial('#1a1a1a', { roughness: 0.6, metalness: 0.1 });
  const leftShoe = boxMesh(0.12, 0.06, 0.2, shoeMat);
  leftShoe.position.set(-0.08, 0.03, 0.04);
  group.add(leftShoe);
  const rightShoe = boxMesh(0.12, 0.06, 0.2, shoeMat);
  rightShoe.position.set(0.08, 0.03, 0.04);
  group.add(rightShoe);

  return group;
}

/** Build the arms segment. */
function buildArms(
  silhouette: string,
  color: string,
  _rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  const armH = PEDESTRIAN_HEIGHT * ARM_H;
  const armMat = stdMaterial(color, { roughness: 0.8, metalness: 0.05 });
  const armY = PEDESTRIAN_HEIGHT * (LEG_H + TORSO_H - ARM_H / 2 + 0.02);

  const armOffset = silhouette === 'zoot' || silhouette === 'power-suit' ? 0.28 : 0.24;

  const leftArm = boxMesh(0.08, armH, 0.08, armMat);
  leftArm.position.set(-armOffset, armY, 0);
  group.add(leftArm);

  const rightArm = boxMesh(0.08, armH, 0.08, armMat);
  rightArm.position.set(armOffset, armY, 0);
  group.add(rightArm);

  return group;
}

/**
 * Build a headwear mesh based on the type string.
 * Returns `null` for 'none'.
 */
function buildHeadwear(type: string, rng: () => number): THREE.Object3D | null {
  const headY = PEDESTRIAN_HEIGHT * (LEG_H + TORSO_H + HEAD_H);

  switch (type) {
    case 'fedora': {
      const mat = stdMaterial('#3a3025', { roughness: 0.8 });
      const group = new THREE.Group();
      // Brim
      const brim = cylMesh(0.18, 0.18, 0.02, 12, mat);
      brim.position.y = headY + 0.01;
      group.add(brim);
      // Crown
      const crown = cylMesh(0.1, 0.1, 0.1, 12, mat);
      crown.position.y = headY + 0.06;
      group.add(crown);
      return group;
    }
    case 'trilby': {
      const mat = stdMaterial('#4a3a2a', { roughness: 0.8 });
      const group = new THREE.Group();
      const brim = cylMesh(0.16, 0.16, 0.02, 12, mat);
      brim.position.y = headY + 0.01;
      group.add(brim);
      const crown = cylMesh(0.09, 0.09, 0.08, 12, mat);
      crown.position.y = headY + 0.05;
      group.add(crown);
      return group;
    }
    case 'beret': {
      const mat = stdMaterial(pickFrom(['#1a1a1a', '#5a2020', '#2a3a5a'], rng), { roughness: 0.9 });
      const beret = cylMesh(0.12, 0.14, 0.04, 12, mat);
      beret.position.y = headY + 0.03;
      beret.rotation.z = 0.1;
      return beret;
    }
    case 'pillbox-hat': {
      const mat = stdMaterial('#7a2020', { roughness: 0.7 });
      const hat = cylMesh(0.1, 0.1, 0.05, 12, mat);
      hat.position.y = headY + 0.03;
      return hat;
    }
    case 'baseball-cap': {
      const mat = stdMaterial(pickFrom(['#1f3a5f', '#2b2b2b', '#7a2020'], rng), { roughness: 0.8 });
      const group = new THREE.Group();
      // Crown (half-sphere approximated by a flattened cylinder)
      const crown = cylMesh(0.1, 0.1, 0.06, 12, mat);
      crown.position.y = headY + 0.03;
      group.add(crown);
      // Brim
      const brim = boxMesh(0.12, 0.02, 0.1, mat);
      brim.position.set(0, headY + 0.01, 0.08);
      group.add(brim);
      return group;
    }
    case 'beanie': {
      const mat = stdMaterial(pickFrom(['#2b2b2b', '#1f3a5f', '#3a5f3a'], rng), { roughness: 0.95 });
      const beanie = cylMesh(0.11, 0.1, 0.08, 12, mat);
      beanie.position.y = headY + 0.04;
      return beanie;
    }
    case 'headband': {
      const mat = stdMaterial(pickFrom(['#c8102e', '#ff00ff', '#ffff00'], rng), { roughness: 0.8 });
      const band = cylMesh(0.11, 0.11, 0.03, 12, mat);
      band.position.y = headY + 0.02;
      return band;
    }
    case 'bike-helmet': {
      const mat = stdMaterial(pickFrom(['#1a1a1a', '#3a5f3a', '#1f3a5f'], rng), { roughness: 0.5, metalness: 0.3 });
      const helmet = cylMesh(0.12, 0.12, 0.07, 12, mat);
      helmet.position.y = headY + 0.04;
      return helmet;
    }
    case 'none':
    default:
      return null;
  }
}

/** Build a small smartphone prop held in the right hand. */
function buildSmartphone(): THREE.Mesh {
  const mat = stdMaterial('#0a0a0a', {
    roughness: 0.2,
    metalness: 0.4,
    emissive: '#1a3a5a',
    emissiveIntensity: 0.3,
  });
  const phone = boxMesh(0.06, 0.1, 0.01, mat);
  // Position at right hand
  const armY = PEDESTRIAN_HEIGHT * (LEG_H + TORSO_H - ARM_H / 2 + 0.02) - PEDESTRIAN_HEIGHT * ARM_H / 2;
  phone.position.set(0.24, armY + 0.02, 0.04);
  phone.rotation.z = -0.3;
  phone.castShadow = true;
  return phone;
}
