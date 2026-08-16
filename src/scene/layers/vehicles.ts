/**
 * Vehicles layer factory.
 *
 * Creates a Three.js Group containing procedural vehicle meshes
 * placed along the street lanes.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';

export interface VehiclesLayerResult {
  group: THREE.Group;
}

/**
 * Factory function that produces a vehicles layer group.
 * @param config — per-era vehicle configuration
 * @returns A THREE.Group with placeholder vehicle boxes
 */
export function createVehiclesLayer(config: EraContent['vehicles']): VehiclesLayerResult {
  const group = new THREE.Group();
  group.name = 'vehicles-layer';

  const geo = new THREE.BoxGeometry(1.2, 0.6, 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6666cc });

  for (let i = 0; i < config.totalCount; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(
      (Math.random() - 0.5) * 40,
      0.5,
      (Math.random() - 0.5) * 6,
    );
    group.add(mesh);
  }

  return { group };
}
