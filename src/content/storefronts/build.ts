/**
 * src/content/storefronts/build.ts — per-era storefront population builder.
 *
 * Given an era, builds the complete storefront row for the facade: one
 * geometry+material unit per spec, all meshes registered as followers of the
 * shared morph anchors. Also produces the material map used for texture
 * swaps during era transitions.
 *
 * The finished group owns the standard scene-module contract and never starts
 * its own renderer/loop.
 */

import * as THREE from 'three';

import type { EraAnchorRegistration } from './registration';
import { isValidFollowerRegistration, registerFollower } from './registration';
import type { StorefrontPart } from './geometry';
import { buildStorefrontGeometry } from './geometry';
import type { StorefrontMaterialSet } from './materials';
import { buildStorefrontMaterials } from './materials';
import { STOREFRONT_SPECS } from './specs';
import { FACADE_SLOTS } from './layout';
import type { EraId } from '../../eras';

export interface StorefrontPopulation {
  group: THREE.Group;
  /** Material map keyed by part name — used for texture-swap binds. */
  materials: Map<string, THREE.MeshStandardMaterial>;
  /** Anchor-follower registration exposed to the morph layer. */
  registration: EraAnchorRegistration;
}

export interface StorefrontPopulationOptions {
  /**
   * Build CanvasTexture materials (DOM-bound, synchronous painters). Default
   * true for the browser scene; tests pass false to exercise the registrations
   * and geometry without a canvas.
   */
  buildMaterials?: boolean;
}

/** Assign a material set onto a unit's parts (by part name). */
function applyMaterials(
  parts: StorefrontPart[],
  mats: StorefrontMaterialSet,
  materials: Map<string, THREE.MeshStandardMaterial>,
): void {
  for (const part of parts) {
    let material: THREE.MeshStandardMaterial | undefined;
    switch (part.name) {
      case 'facade':
        material = mats.facadeMat;
        break;
      case 'sign':
        material = mats.signMat;
        break;
      case 'window':
        material = mats.windowMat;
        break;
      case 'door':
        material = mats.doorMat;
        break;
      case 'awning':
        material = mats.awningMat;
        break;
      default:
        material = mats.trims[0];
    }
    if (material) {
      part.mesh.material = material;
      materials.set(`${part.name}:${part.mesh.name}`, material);
    }
  }
}

/** Build the storefront population for one era. */
export function buildStorefrontPopulation(
  era: EraId,
  options: StorefrontPopulationOptions = {},
): StorefrontPopulation {
  const group = new THREE.Group();
  group.name = `storefronts-${era}`;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const followers: ReturnType<typeof registerFollower>[] = [];
  const specs = STOREFRONT_SPECS[era] ?? [];
  const slots = FACADE_SLOTS.slice(0, Math.max(specs.length, 1));
  const buildMaterials = options.buildMaterials ?? true;

  specs.forEach((spec, i) => {
    const slot = slots[i % slots.length];
    const build = buildStorefrontGeometry(spec, slot.x);
    const mats = buildMaterials ? buildStorefrontMaterials(era, spec) : null;
    if (mats) {
      applyMaterials(build.parts, mats, materials);
    }
    group.add(build.group);

    for (const part of build.parts) {
      if (part.slot) {
        const follower = registerFollower(part.slot, part.mesh.name);
        if (isValidFollowerRegistration(follower)) {
          followers.push(follower);
        }
      }
    }
  });

  const registration: EraAnchorRegistration = {
    era,
    followers,
  };

  return { group, materials, registration };
}