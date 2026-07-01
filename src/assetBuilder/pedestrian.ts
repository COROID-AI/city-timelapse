import * as THREE from 'three';
import type { EraId } from '../eras/types';
import { ERAS } from '../eras/data';
import { mulberry32, pick } from '../utils/rng';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

/**
 * Build a pedestrian figure for an era. Origin is at the feet (~y=0) so the
 * figure can be placed directly onto a sidewalk. Height ~1.8-1.92m.
 * Outfit colors come from the era palette so crowds look period-appropriate.
 */
export function makePedestrian(era: EraId, index = 0): THREE.Group {
  const desc = ERAS[era];
  const rng = mulberry32(desc.seed ^ (index * 2654435761));

  const group = new THREE.Group();
  group.name = `pedestrian:${era}:${index}`;

  const shirt = pick(rng, desc.pedestrianColors);
  const pants = pick(rng, desc.pedestrianColors);
  const skin = ['#d8a878', '#c08858', '#8a5a3a', '#e8c098'][index % 4];

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });

  // Head
  const head = new THREE.Mesh(boxGeo, skinMat);
  head.scale.set(0.28, 0.32, 0.28);
  head.position.y = 1.78;
  head.name = 'head';
  group.add(head);

  // Torso
  const torso = new THREE.Mesh(boxGeo, shirtMat);
  torso.scale.set(0.5, 0.62, 0.28);
  torso.position.y = 1.28;
  torso.name = 'torso';
  group.add(torso);

  // Legs (two, so a walk animation can swing them)
  const legL = new THREE.Mesh(boxGeo, pantsMat);
  legL.scale.set(0.2, 0.85, 0.22);
  legL.position.set(-0.13, 0.55, 0);
  legL.name = 'leg_L';
  group.add(legL);

  const legR = new THREE.Mesh(boxGeo, pantsMat);
  legR.scale.set(0.2, 0.85, 0.22);
  legR.position.set(0.13, 0.55, 0);
  legR.name = 'leg_R';
  group.add(legR);

  // Arms
  const armL = new THREE.Mesh(boxGeo, shirtMat);
  armL.scale.set(0.14, 0.56, 0.16);
  armL.position.set(-0.33, 1.3, 0);
  armL.name = 'arm_L';
  group.add(armL);

  const armR = new THREE.Mesh(boxGeo, shirtMat);
  armR.scale.set(0.14, 0.56, 0.16);
  armR.position.set(0.33, 1.3, 0);
  armR.name = 'arm_R';
  group.add(armR);

  group.userData.era = era;
  group.userData.index = index;
  group.userData.height = 1.92;

  return group;
}
