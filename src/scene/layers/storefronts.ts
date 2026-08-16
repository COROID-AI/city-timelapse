/**
 * Storefronts layer factory.
 *
 * Creates a Three.js Group containing procedural storefront elements
 * positioned at the base of each building.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';

export interface StorefrontLayerResult {
  group: THREE.Group;
}

/**
 * Factory function that produces a storefronts layer group.
 * @param config — per-era storefront configuration
 * @returns A THREE.Group with placeholder storefront planes
 */
export function createStorefrontsLayer(config: EraContent['storefronts']): StorefrontLayerResult {
  const group = new THREE.Group();
  group.name = 'storefronts-layer';

  const geo = new THREE.PlaneGeometry(1.5, 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < config.count; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(
      (i - config.count / 2) * 4,
      1,
      -18,
    );
    group.add(mesh);
  }

  return { group };
}
