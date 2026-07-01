// Streetlight module: a pole + arm + glowing lamp head with a point light.

import * as THREE from 'three';
import { EraConfig } from './eras';

export class Streetlight {
  readonly group = new THREE.Group();
  private readonly bulbMat: THREE.MeshStandardMaterial;
  private readonly light: THREE.PointLight;

  constructor(pos: THREE.Vector3, armDir: 1 | -1) {
    this.group.position.copy(pos);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.7, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 10), poleMat);
    pole.position.y = 3;
    pole.castShadow = true;
    this.group.add(pole);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(armDir * 0.8, 5.9, 0);
    this.group.add(arm);

    this.bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffd9a0,
      emissive: new THREE.Color(0xffd9a0),
      emissiveIntensity: 2,
      roughness: 0.4,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), this.bulbMat);
    bulb.position.set(armDir * 1.5, 5.8, 0);
    this.group.add(bulb);

    // Limited-range point light. Kept modest for performance.
    this.light = new THREE.PointLight(0xffd9a0, 6, 26, 2);
    this.light.position.set(armDir * 1.5, 5.6, 0);
    this.group.add(this.light);
  }

  applyEra(state: EraConfig): void {
    this.bulbMat.emissive.set(state.lampColor);
    this.bulbMat.emissiveIntensity = 1.6 + state.lampIntensity;
    this.light.color.set(state.lampColor);
    this.light.intensity = state.lampIntensity * 7;
  }

  dispose(): void {
    this.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
    });
  }
}
