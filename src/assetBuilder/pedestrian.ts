/**
 * Procedural pedestrian builder.
 *
 * Builds a low-poly humanoid mesh dressed in era-appropriate clothing.
 * The figure is assembled from simple primitives (capsule torso, cylinder
 * limbs, sphere head) and tinted with the era's outfit palette. A few
 * variants are cached per era so the sidewalk population looks varied.
 */

import * as THREE from 'three';

import type { EraSpec } from '../eras.js';
import { getAssetSet } from './eras.js';
import type { AssetSet, HatStyle, OutfitPalette } from './eras.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

/** A built pedestrian figure. */
export interface BuiltPedestrian {
  readonly group: THREE.Group;
  readonly height: number;
}

const pedestrianCache = new Map<string, BuiltPedestrian>();

/** Total number of outfit variants cached per era. */
export const PEDESTRIAN_VARIANTS_PER_ERA = 6;

/**
 * Build (or fetch a cached) pedestrian for the given era and variant.
 *
 * Each variant picks a different outfit combo + skin tone from the palette,
 * giving the sidewalk a varied population.
 *
 * @param spec    The era specification.
 * @param variant Outfit/skin index (0..PEDESTRIAN_VARIANTS_PER_ERA-1).
 */
export function buildPedestrian(spec: EraSpec, variant: number = 0): BuiltPedestrian {
  const cacheKey = `${spec.id}:ped:${variant % PEDESTRIAN_VARIANTS_PER_ERA}`;
  const existing = pedestrianCache.get(cacheKey);
  if (existing) return existing;

  const set = getAssetSet(spec);
  const palette = set.pedestrian;
  const comboIdx = variant % palette.combos.length;
  const skinIdx = variant % palette.skinTones.length;

  const group = new THREE.Group();
  group.name = `pedestrian:${spec.id}:${variant}`;

  const [shirt, pants, accessory] = palette.combos[comboIdx];
  const skin = palette.skinTones[skinIdx];

  const totalHeight = buildFigure(group, palette, shirt, pants, accessory, skin);

  const built: BuiltPedestrian = { group, height: totalHeight };
  pedestrianCache.set(cacheKey, built);
  return built;
}

// ─────────────────────────────────────────────────────────────────────────────
// Figure assembly
// ─────────────────────────────────────────────────────────────────────────────

function buildFigure(
  group: THREE.Group,
  palette: OutfitPalette,
  shirt: string,
  pants: string,
  accessory: string,
  skin: string,
): number {
  // Body part dimensions
  const legLen = 0.85;
  const torsoLen = 0.7;
  const headRadius = 0.16;
  const armLen = 0.65;
  const limbRadius = 0.08;

  let y = 0;

  // ── Legs ────────────────────────────────────────────────────────────────
  const legGeo = new THREE.CapsuleGeometry(limbRadius, legLen, 4, 8);
  const pantsMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pants),
    roughness: 0.85,
  });
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.set(x, y + legLen / 2 + limbRadius, 0);
    leg.castShadow = true;
    group.add(leg);
  }
  y += legLen + limbRadius * 2;

  // ── Torso ───────────────────────────────────────────────────────────────
  const torsoGeo = new THREE.CapsuleGeometry(0.2, torsoLen, 6, 12);
  const shirtMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(shirt),
    roughness: 0.8,
  });
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, y + torsoLen / 2 + 0.2, 0);
  torso.castShadow = true;
  group.add(torso);

  // ── Arms ────────────────────────────────────────────────────────────────
  const armGeo = new THREE.CapsuleGeometry(limbRadius * 0.9, armLen, 4, 8);
  for (const x of [-0.28, 0.28]) {
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.set(x, y + armLen / 2 + 0.3, 0);
    arm.castShadow = true;
    group.add(arm);
    // Hands (skin)
    const handGeo = new THREE.SphereGeometry(limbRadius * 0.85, 8, 6);
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin),
      roughness: 0.7,
    });
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(x, y - armLen / 2 + 0.25, 0);
    group.add(hand);
  }

  y += torsoLen + 0.4;

  // ── Neck ─────────────────────────────────────────────────────────────────
  const neckGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8);
  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin),
    roughness: 0.7,
  });
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, y + 0.05, 0);
  group.add(neck);

  // ── Head ────────────────────────────────────────────────────────────────
  const headGeo = new THREE.SphereGeometry(headRadius, 12, 10);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, y + headRadius + 0.05, 0);
  head.castShadow = true;
  group.add(head);

  // ── Hat ──────────────────────────────────────────────────────────────────
  buildHat(group, palette.hatStyle, accessory, y + headRadius + 0.05, headRadius);

  // ── Bag / briefcase prop ─────────────────────────────────────────────────
  if (Math.random() < palette.bagChance) {
    buildBag(group, accessory, y);
  }

  const totalHeight = y + headRadius * 2 + 0.1;
  return totalHeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hats
// ─────────────────────────────────────────────────────────────────────────────

function buildHat(
  group: THREE.Group,
  style: HatStyle,
  color: string,
  headY: number,
  headRadius: number,
): void {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.8,
  });

  switch (style) {
    case 'fedora': {
      const brimGeo = new THREE.CylinderGeometry(headRadius * 1.5, headRadius * 1.5, 0.04, 12);
      const brim = new THREE.Mesh(brimGeo, mat);
      brim.position.set(0, headY + headRadius * 0.7, 0);
      group.add(brim);
      const crownGeo = new THREE.CylinderGeometry(headRadius * 0.9, headRadius * 1.0, headRadius * 1.2, 12);
      const crown = new THREE.Mesh(crownGeo, mat);
      crown.position.set(0, headY + headRadius * 1.3, 0);
      group.add(crown);
      break;
    }
    case 'cap': {
      const capGeo = new THREE.SphereGeometry(headRadius * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, mat);
      cap.position.set(0, headY + headRadius * 0.6, 0);
      group.add(cap);
      // Visor
      const visorGeo = new THREE.BoxGeometry(headRadius * 1.4, 0.04, headRadius * 0.6);
      const visor = new THREE.Mesh(visorGeo, mat);
      visor.position.set(0, headY + headRadius * 0.5, headRadius * 0.7);
      group.add(visor);
      break;
    }
    case 'beanie': {
      const beanieGeo = new THREE.SphereGeometry(headRadius * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.65);
      const beanie = new THREE.Mesh(beanieGeo, mat);
      beanie.position.set(0, headY + headRadius * 0.3, 0);
      group.add(beanie);
      break;
    }
    case 'hood': {
      const hoodGeo = new THREE.SphereGeometry(headRadius * 1.25, 12, 10);
      const hoodMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.9,
        side: THREE.BackSide,
      });
      const hood = new THREE.Mesh(hoodGeo, hoodMat);
      hood.position.set(0, headY, 0);
      group.add(hood);
      break;
    }
    case 'cap-smart': {
      // Smart cap with a small LED node
      const capGeo = new THREE.SphereGeometry(headRadius * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, mat);
      cap.position.set(0, headY + headRadius * 0.6, 0);
      group.add(cap);
      const nodeGeo = new THREE.SphereGeometry(0.03, 6, 6);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: '#3acaff',
        emissive: new THREE.Color('#3acaff'),
        emissiveIntensity: 1.5,
      });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(0, headY + headRadius * 1.1, 0);
      group.add(node);
      break;
    }
    case 'none':
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bag prop
// ─────────────────────────────────────────────────────────────────────────────

function buildBag(group: THREE.Group, color: string, torsoY: number): void {
  const bagMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
  });
  const bagGeo = new THREE.BoxGeometry(0.22, 0.3, 0.12);
  const bag = new THREE.Mesh(bagGeo, bagMat);
  bag.position.set(0.28, torsoY - 0.1, 0.08);
  bag.castShadow = true;
  group.add(bag);

  // Strap
  const strapGeo = new THREE.TorusGeometry(0.18, 0.015, 6, 12, Math.PI);
  const strapMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.9 });
  const strap = new THREE.Mesh(strapGeo, strapMat);
  strap.position.set(0.15, torsoY + 0.2, 0.05);
  strap.rotation.x = Math.PI / 2;
  strap.rotation.z = 0.4;
  group.add(strap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposal
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose all cached pedestrian groups and their geometry/materials. */
export function disposeAllPedestrians(): void {
  for (const built of pedestrianCache.values()) {
    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }
  pedestrianCache.clear();
}
