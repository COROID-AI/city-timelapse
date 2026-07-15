import * as THREE from "three";
import type { EraVisualConfig } from "../types";
import type { TextureSet } from "../utils/textures";

/**
 * The static ground plane, road, and sidewalks. Materials are updated each
 * frame during a transition (atmosphere interpolation) rather than rebuilt.
 */
export class Ground {
  readonly root: THREE.Group;
  private readonly groundMat: THREE.MeshStandardMaterial;
  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly sidewalkMat: THREE.MeshStandardMaterial;
  private readonly dashMat: THREE.MeshBasicMaterial;
  private readonly centerLine: THREE.Mesh;

  constructor(textures: TextureSet) {
    this.root = new THREE.Group();
    this.root.name = "ground";

    // Block footprint: a 60x60 ground patch.
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x555544,
      roughness: 1,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    ground.name = "ground-plane";
    this.root.add(ground);

    // Two-lane road running along Z through the center.
    const roadGeo = new THREE.PlaneGeometry(11, 120);
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.95,
      metalness: 0,
      map: textures.asphalt,
    });
    const road = new THREE.Mesh(roadGeo, this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    road.name = "road";
    this.root.add(road);

    // Dashed center line.
    this.dashMat = new THREE.MeshBasicMaterial({
      color: 0xf3e9c0,
      map: textures.dashLine,
      transparent: true,
    });
    const lineGeo = new THREE.PlaneGeometry(0.35, 120);
    this.centerLine = new THREE.Mesh(lineGeo, this.dashMat);
    this.centerLine.rotation.x = -Math.PI / 2;
    this.centerLine.position.y = 0.012;
    this.root.add(this.centerLine);

    // Sidewalks on both sides of the road.
    const sidewalkGeo = new THREE.BoxGeometry(4.2, 0.28, 120);
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x9a9a96,
      roughness: 0.9,
      metalness: 0,
      map: textures.concrete,
    });
    for (const sx of [-7.6, 7.6]) {
      const sw = new THREE.Mesh(sidewalkGeo, this.sidewalkMat);
      sw.position.set(sx, 0.14, 0);
      sw.receiveShadow = true;
      sw.castShadow = false;
      sw.name = "sidewalk";
      this.root.add(sw);
    }
  }

  /** Lerp all ground/road materials toward the target era by `t`. */
  applyAtmosphere(
    from: EraVisualConfig,
    to: EraVisualConfig,
    t: number
  ): void {
    const c = _scratch;
    this.groundMat.color.copy(
      c.cA.setHex(from.groundColor, THREE.SRGBColorSpace).lerp(
        c.cB.setHex(to.groundColor, THREE.SRGBColorSpace),
        t
      )
    );
    this.roadMat.color.copy(
      c.cA.setHex(from.roadColor, THREE.SRGBColorSpace).lerp(
        c.cB.setHex(to.roadColor, THREE.SRGBColorSpace),
        t
      )
    );
    this.sidewalkMat.color.copy(
      c.cA.setHex(from.sidewalkColor, THREE.SRGBColorSpace).lerp(
        c.cB.setHex(to.sidewalkColor, THREE.SRGBColorSpace),
        t
      )
    );
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.groundMat.dispose();
    this.roadMat.dispose();
    this.sidewalkMat.dispose();
    this.dashMat.dispose();
  }
}

const _scratch = {
  cA: new THREE.Color(),
  cB: new THREE.Color(),
};
