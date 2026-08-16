/**
 * Pedestrians layer factory.
 *
 * Creates a Three.js Group containing procedural pedestrian figures
 * scattered along sidewalks.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';

export interface PedestriansLayerResult {
  group: THREE.Group;
}

/**
 * Factory function that produces a pedestrians layer group.
 * @param config — per-era pedestrian configuration
 * @returns A THREE.Group with placeholder pedestrian capsules
 */
export function createPedestriansLayer(config: EraContent['pedestrians']): PedestriansLayerResult {
  const group = new THREE.Group();
  group.name = 'pedestrians-layer';

  const geo = new THREE.CapsuleGeometry(0.15, 0.7, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcc9966 });

  for (let i = 0; i < config.totalCount; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(
      (Math.random() - 0.5) * 40,
      0.55,
      10 + Math.random() * 5,
    );
    group.add(mesh);
  }

  return { group };
}
