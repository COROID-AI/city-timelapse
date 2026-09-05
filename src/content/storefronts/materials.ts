/**
 * src/content/storefronts/materials.ts — per-part CanvasTexture materials.
 *
 * Every storefront visual is a THREE.MeshStandardMaterial whose `map` comes
 * from the synchronous, cacheable painters in signage.ts. Because the painters
 * are keyed by spec and cached, building all five eras' materials up-front is
 * a one-time cost; era transitions only swap `material.map` pointers.
 *
 * The era's textures (sign band, window display, door, awning, decal) are all
 * period-correct: hand-painted serif in 1945, scalloped chrome in 1965,
 * neon-lit in 1985, corporate decal in 2005, matte in 2025.
 */

import * as THREE from 'three';

import type { EraId, StorefrontSpec } from '../../eras';
import {
  paintAwningStripeTexture,
  paintDoorTexture,
  paintStreetSign,
  paintWindowDisplayTexture,
} from './signage';

export interface StorefrontMaterialSet {
  facadeMat: THREE.MeshStandardMaterial;
  signMat: THREE.MeshStandardMaterial;
  windowMat: THREE.MeshStandardMaterial;
  doorMat: THREE.MeshStandardMaterial;
  awningMat: THREE.MeshStandardMaterial;
  trims: THREE.MeshStandardMaterial[];
}

function standard(opts: {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  rough?: number;
  metal?: number;
}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0.1,
  });
}

/** Base awning striping per era family. */
function awningColors(era: EraId): string[] {
  switch (era) {
    case '1945':
      return ['#c9a227', '#b03a2e'];
    case '1965':
      return ['#e8e2d4', '#9c2f3d'];
    case '1985':
      return ['#10101c', '#ff2fd6'];
    case '2005':
      return ['#dfe7ee', '#155bd4'];
    case '2025':
      return ['#e6e4dc', '#1c2026'];
  }
}

function awningSegments(era: EraId): number {
  switch (era) {
    case '1945':
      return 14;
    case '1965':
      return 10;
    case '1985':
      return 8;
    case '2005':
      return 6;
    case '2025':
      return 4;
  }
}

/** Material palette for one storefront unit. `era` picks the painter. */
export function buildStorefrontMaterials(
  era: EraId,
  spec: StorefrontSpec,
): StorefrontMaterialSet {
  const signage = spec.signage;

  const streetSign = paintStreetSign({
    background: signage.background,
    borderColor: signage.accent,
    borderWidth: 4,
    lines: [
      {
        text: spec.name.toUpperCase(),
        size: 42,
        color: signage.ink,
        family: signage.fontFamily,
        weight: signage.fontWeight,
        tracking: signage.tracking,
      },
      {
        text: spec.tagline,
        size: 18,
        color: signage.accent,
        tracking: 1,
      },
    ],
    familyDefault: signage.fontFamily,
    stacked: {
      glow: signage.glow || undefined,
      handPainted: era === '1945',
      handSeed: spec.id,
    },
  });

  const windowTex = paintWindowDisplayTexture({
    era,
    headline: spec.windowHeadline,
    sub: spec.windowSub,
    background: '#2a2a34',
    accent: signage.accent,
    ink: '#f5e6c8',
  });

  const doorTex = paintDoorTexture({ era });

  const facadeMat = standard({
    color: new THREE.Color(spec.facadeColor),
    rough: 0.95,
    metal: 0.05,
  });
  const signMat = standard({ map: streetSign, rough: 0.9 });
  const windowMat = standard({ map: windowTex, rough: 0.35, metal: 0.3 });
  const doorMat = standard({ map: doorTex, rough: 0.7, metal: 0.4 });
  const awningMat = standard({
    map: paintAwningStripeTexture(
      awningColors(era),
      awningSegments(era),
      'vertical',
    ),
    rough: 0.95,
  });

  const trimMat = standard({
    color: new THREE.Color(spec.trimColor),
    rough: 0.4,
    metal: 0.6,
  });

  return {
    facadeMat,
    signMat,
    windowMat,
    doorMat,
    awningMat,
    trims: [trimMat],
  };
}