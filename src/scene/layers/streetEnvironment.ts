/**
 * Street environment layer factory.
 *
 * Creates a Three.js Group containing road surface, sidewalk,
 * crosswalk markings, and street lamps.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';

export interface StreetEnvironmentResult {
  group: THREE.Group;
}

/**
 * Factory function that produces the street environment group.
 * @param config — per-era street configuration
 * @returns A THREE.Group with road, sidewalk, and lamp post placeholders
 */
export function createStreetEnvironment(config: EraContent['street']): StreetEnvironmentResult {
  const group = new THREE.Group();
  group.name = 'street-environment';

  // Road surface
  const roadGeo = new THREE.PlaneGeometry(60, config.roadWidth);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);

  // Sidewalks
  const swGeo = new THREE.PlaneGeometry(60, config.sidewalkWidth);
  const swMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });

  const leftSw = new THREE.Mesh(swGeo, swMat.clone());
  leftSw.rotation.x = -Math.PI / 2;
  leftSw.position.set(0, 0.02, config.roadWidth / 2 + config.sidewalkWidth / 2);
  group.add(leftSw);

  const rightSw = new THREE.Mesh(swGeo, swMat.clone());
  rightSw.rotation.x = -Math.PI / 2;
  rightSw.position.set(0, 0.02, -(config.roadWidth / 2 + config.sidewalkWidth / 2));
  group.add(rightSw);

  // Street lamp posts (placeholder cylinders)
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

  for (let i = -5; i <= 5; i++) {
    const pole = new THREE.Mesh(poleGeo, poleMat.clone());
    pole.position.set(i * 5, 2.5, config.roadWidth / 2 + 0.5);
    group.add(pole);
  }

  return { group };
}
