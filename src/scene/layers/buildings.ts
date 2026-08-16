/**
 * Buildings layer factory.
 *
 * Creates a Three.js Group containing procedural building meshes
 * based on EraContent.buildings configuration.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';

export interface BuildingLayerResult {
  group: THREE.Group;
}

/**
 * Factory function that produces a buildings layer group.
 * @param config — per-era building configuration
 * @returns A THREE.Group with placeholder building boxes
 */
export function createBuildingsLayer(config: EraContent['buildings']): BuildingLayerResult {
  const group = new THREE.Group();
  group.name = 'buildings-layer';

  // Placeholder ground block — simple box geometry
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });

  for (let i = 0; i < config.count; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    const height = config.averageHeight * (0.5 + Math.random() * 1.0);
    mesh.scale.set(2 + Math.random() * 3, height, 2 + Math.random() * 3);
    mesh.position.set(
      (i - config.count / 2) * 4,
      height / 2,
      -20 + Math.random() * 5,
    );
    group.add(mesh);
  }

  return { group };
}
