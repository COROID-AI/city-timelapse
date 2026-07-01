import * as THREE from 'three';
import { EraOutfitStyle } from '../eras/types';

export interface BuiltPedestrian {
  group: THREE.Group;
  /** update walking animation; speed is phase advance per second */
  animate: (dt: number) => void;
  dispose: () => void;
}

/** Pedestrian ~1.92m tall, origin at feet. */
export function makePedestrian(outfit: EraOutfitStyle, seed: number): BuiltPedestrian {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const t = ((seed * 9301 + 49297) % 233280) / 233280;
  const scale = 0.95 + t * 0.12;

  const skinMat = new THREE.MeshStandardMaterial({ color: outfit.skin, roughness: 0.7 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: outfit.torso, roughness: 0.8 });
  const legsMat = new THREE.MeshStandardMaterial({ color: outfit.legs, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: outfit.hair, roughness: 0.9 });
  disposables.push(skinMat, torsoMat, legsMat, hairMat);

  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.9, 8);
  const leftLeg = new THREE.Mesh(legGeo, legsMat);
  const rightLeg = new THREE.Mesh(legGeo, legsMat);
  leftLeg.position.set(-0.13, 0.45, 0);
  rightLeg.position.set(0.13, 0.45, 0);
  group.add(leftLeg, rightLeg);

  const torsoGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8);
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 1.25;
  group.add(torso);

  const headGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.78;
  group.add(head);

  const hairGeo = new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.6);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.y = 1.82;
  group.add(hair);

  // arms
  const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6);
  const leftArm = new THREE.Mesh(armGeo, torsoMat);
  const rightArm = new THREE.Mesh(armGeo, torsoMat);
  leftArm.position.set(-0.32, 1.28, 0);
  rightArm.position.set(0.32, 1.28, 0);
  group.add(leftArm, rightArm);

  group.scale.setScalar(scale);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  let phase = t * Math.PI * 2;
  const animate = (dt: number) => {
    phase += dt * 8;
    const s = Math.sin(phase) * 0.5;
    leftLeg.rotation.x = s;
    rightLeg.rotation.x = -s;
    leftArm.rotation.x = -s * 0.7;
    rightArm.rotation.x = s * 0.7;
  };

  return {
    group,
    animate,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      legGeo.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      hairGeo.dispose();
      armGeo.dispose();
    },
  };
}
