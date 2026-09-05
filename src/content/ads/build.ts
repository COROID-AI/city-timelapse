/**
 * src/content/ads/build.ts — per-era ad population builder.
 *
 * Given an era, builds every ad housing + material (painter-assigned map)
 * and registers each mesh as an anchor follower. Also exposes the material
 * map so the module can bind texture swaps: at the transition midpoint the
 * morph engine swaps a 1985 billboard map to a 2005 billboard map, etc.
 *
 * The glue is declarative: all copy comes from AD_SPECS, all pixels from the
 * cached painters, and all positions from the shared facade spans.
 */

import * as THREE from 'three';

import type { EraAnchorRegistration } from '../storefronts/registration';
import {
  isValidFollowerRegistration,
  registerFollower,
} from '../storefronts/registration';
import { paintAdTexture } from './painters';
import { buildAdGeometry } from './geometry';
import type { AdSpec, EraId } from '../../eras';
import { AD_SPECS } from './specs';

export interface AdPopulation {
  group: THREE.Group;
  /** Material map keyed by mesh name + media — swap binds consume this. */
  materials: Map<string, THREE.MeshStandardMaterial>;
  registration: EraAnchorRegistration;
}

export interface AdPopulationOptions {
  /** Build CanvasTexture materials (DOM-bound). Default true for browser. */
  buildMaterials?: boolean;
}

/** Fixed facade Y positions for ads (drawn above the storefront row). */
const AD_Y = 5.6;
const AD_Z = 0.1;
const AD_SPANS: readonly { x: number; width: number }[] = [
  { x: -13.4, width: 4.4 },
  { x: -6.6, width: 4.4 },
  { x: 0.2, width: 4.4 },
  { x: 7.0, width: 4.4 },
  { x: 12.6, width: 4.4 },
];

function adMaterial(media: AdSpec['media'], map: THREE.Texture): THREE.MeshStandardMaterial {
  const isGlow = media === 'neon' || media === 'screen';
  return new THREE.MeshStandardMaterial({
    map,
    roughness: isGlow ? 0.3 : 0.85,
    metalness: isGlow ? 0.2 : 0.05,
    emissive: isGlow ? 0xffffff : 0x000000,
    emissiveMap: isGlow ? map : null,
    emissiveIntensity: isGlow ? 0.55 : 0,
  });
}

/** Build all ads for one era, spacing them across the facade spans. */
export function buildAdPopulation(
  era: EraId,
  options: AdPopulationOptions = {},
): AdPopulation {
  const group = new THREE.Group();
  group.name = `ads-${era}`;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const followers: ReturnType<typeof registerFollower>[] = [];
  const specs: AdSpec[] = AD_SPECS[era] ?? [];
  const buildMaterials = options.buildMaterials ?? true;

  specs.forEach((spec, i) => {
    const span = AD_SPANS[i % AD_SPANS.length];
    const build = buildAdGeometry(spec.id, spec.media, span.x, AD_Y, AD_Z);
    const mat = buildMaterials ? adMaterial(spec.media, paintAdTexture(spec)) : null;
    build.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && mat) {
        mesh.material = mat;
      }
    });
    if (mat) {
      materials.set(spec.id, mat);
    }
    for (const f of build.followers) {
      const follower = registerFollower(f.slot, f.name);
      if (isValidFollowerRegistration(follower)) {
        followers.push(follower);
      }
    }
    group.add(build.group);
  });

  const registration: EraAnchorRegistration = { era, followers };
  return { group, materials, registration };
}