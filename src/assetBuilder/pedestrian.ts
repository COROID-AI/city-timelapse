/**
 * Procedural pedestrian generator.
 *
 * Builds an era-styled low-poly pedestrian figure from primitives:
 * torso, head, arms, legs, and optional hat. Outfit colours, skin tones,
 * hair, and accessories are all drawn from the era's {@link PedestrianSpec}
 * palette, picked deterministically from a seed so each pedestrian looks
 * consistent across re-renders.
 *
 * Pedestrians are cached by (eraId, variant) and cloned on demand.
 */
import * as THREE from 'three';
import type { EraSpec, PedestrianSpec } from '../eraRegistry';
import { makeRng, type Rng } from './textures';

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

function mat(color: string, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ---------------------------------------------------------------------------
// Pedestrian body builder
// ---------------------------------------------------------------------------

function buildPedestrianBody(
  pSpec: PedestrianSpec,
  rng: Rng,
): THREE.Group {
  const group = new THREE.Group();
  const scale = pSpec.bodyScale;

  const outfitColor = pick(rng, pSpec.outfitPalette);
  const accentColor = pick(rng, pSpec.accentPalette);
  const skinColor = pick(rng, pSpec.skinPalette);
  const hairColor = pick(rng, pSpec.hairPalette);

  // Era-correct proportions
  const shoulderW = pSpec.shoulderWidth * scale;
  const legLen = pSpec.legLength * scale;
  const torsoH = 0.55 * scale;
  const headR = 0.12 * scale;
  const armLen = 0.45 * scale;
  const armW = 0.08 * scale;
  const legW = 0.09 * scale;

  // Torso (box, slightly tapered feel)
  const torsoMat = mat(outfitColor, 0.85);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(shoulderW, torsoH, 0.22 * scale),
    torsoMat,
  );
  torso.position.y = legLen + torsoH / 2;
  group.add(torso);

  // Accent stripe / belt
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(shoulderW * 1.02, 0.04 * scale, 0.23 * scale),
    mat(accentColor, 0.7),
  );
  belt.position.y = legLen + 0.04 * scale;
  group.add(belt);

  // Head (sphere)
  const headMat = mat(skinColor, 0.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), headMat);
  head.position.y = legLen + torsoH + headR * 0.9;
  group.add(head);

  // Hair (cap on top of head)
  const hairMat = mat(hairColor, 0.9);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.05, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  hair.position.y = head.position.y + headR * 0.1;
  group.add(hair);

  // Arms (two boxes)
  const armMat = mat(outfitColor, 0.85);
  const handMat = mat(skinColor, 0.6);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armW, armLen, armW),
      armMat,
    );
    arm.position.set(sx * (shoulderW / 2 + armW / 2), legLen + torsoH * 0.7, 0);
    arm.rotation.z = sx * 0.08;
    group.add(arm);
    // Hand
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(armW, 0.08 * scale, armW),
      handMat,
    );
    hand.position.set(sx * (shoulderW / 2 + armW / 2), legLen + torsoH * 0.7 - armLen / 2 - 0.05, 0);
    group.add(hand);
  }

  // Legs (two boxes)
  const legMat = mat(shadeHex(outfitColor, -15), 0.85);
  const shoeMat = mat('#1a1a1a', 0.6);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(legW, legLen, legW),
      legMat,
    );
    leg.position.set(sx * shoulderW * 0.22, legLen / 2, 0);
    group.add(leg);
    // Shoe
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(legW * 1.2, 0.06 * scale, legW * 1.6),
      shoeMat,
    );
    shoe.position.set(sx * shoulderW * 0.22, 0.03 * scale, legW * 0.3);
    group.add(shoe);
  }

  // Hat (era-dependent likelihood)
  if (rng() < pSpec.hatLikelihood) {
    const hatMat = mat(pSpec.hatColor, 0.6);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.6, headR * 1.6, 0.02 * scale, 16),
      hatMat,
    );
    brim.position.y = head.position.y + headR * 0.5;
    group.add(brim);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.1, headR * 1.1, headR * 1.2, 16),
      hatMat,
    );
    crown.position.y = head.position.y + headR * 1.1;
    group.add(crown);
  }

  group.userData = { outfitColor, skinColor, hairColor, accentColor };
  return group;
}

// ---------------------------------------------------------------------------
// Cache + public API
// ---------------------------------------------------------------------------

const pedestrianCache = new Map<string, THREE.Group>();

/**
 * Build an era-styled pedestrian.
 *
 * @param spec       Era spec (outfit, skin, hair, hat palettes).
 * @param variantSeed  Stable seed so the same variant always picks the same colours.
 */
export function buildPedestrian(spec: EraSpec, variantSeed: number): THREE.Group {
  const cacheKey = `${spec.eraId}:ped:${variantSeed % 200}`;
  const cached = pedestrianCache.get(cacheKey);
  if (cached) return cached.clone();

  const rng = makeRng(`${spec.eraId}:ped:${variantSeed}`);
  const group = buildPedestrianBody(spec.pedestrians, rng);
  group.userData = { ...group.userData, eraId: spec.eraId, variant: variantSeed };

  pedestrianCache.set(cacheKey, group);
  return group.clone();
}

/** Clear the pedestrian cache. */
export function clearPedestrianCache(): void {
  pedestrianCache.clear();
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function shadeHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round((percent / 100) * 255);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
