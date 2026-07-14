import * as THREE from 'three';
import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendColors, blendScalar, hash, clamp } from '../core/mathUtils';

// Street lamps (with point lights), trees, and neon signs.
// All built once per era; crossfade opacity by era weight.

interface LampPos { x: number; z: number; }

const LAMP_POSITIONS: LampPos[] = [];
for (let i = 0; i < 6; i++) {
  const x = -22 + i * 8.8;
  LAMP_POSITIONS.push({ x, z: 8 });
  LAMP_POSITIONS.push({ x: x + 4, z: -8 });
}

const TREE_POSITIONS: { x: number; z: number }[] = [];
for (let i = 0; i < 5; i++) {
  TREE_POSITIONS.push({ x: -20 + i * 10, z: 7 });
  TREE_POSITIONS.push({ x: -20 + i * 10 + 5, z: -7 });
}

const SIGN_POSITIONS: { x: number; z: number }[] = [];
for (let i = 0; i < 6; i++) {
  SIGN_POSITIONS.push({ x: -18 + i * 7, z: 5.5 });
}

// Pre-computed per-era arrays — built once.
const LAMP_COLORS = ERAS.map(e => e.props.lamp);
const LAMP_INTS = ERAS.map(e => e.props.lampIntensity);
const SIGN_COLORS = ERAS.map(e => e.props.signColor);
const SIGN_NEONS = ERAS.map(e => e.props.signNeon);
const TREE_AMOUNTS = ERAS.map(e => e.props.treeAmount);

export class StreetProps {
  private scene: THREE.Scene;
  private lampMeshes: THREE.Group[] = [];
  private lampMats: THREE.MeshStandardMaterial[][] = [];
  private lampLights: THREE.PointLight[][] = [];
  private treeMeshes: THREE.Group[] = [];
  private treeMats: THREE.MeshStandardMaterial[][] = [];
  private signMeshes: THREE.Mesh[] = [];
  private signMats: THREE.MeshStandardMaterial[] = [];
  private tmpColor = new THREE.Color();
  private tmpSignColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let e = 0; e < ERA_COUNT; e++) {
      this.buildEra(e);
    }
  }

  private buildEra(e: number): void {
    const era = ERAS[e];
    const isActive = e === 0;

    // --- Lamps ---
    const lampGroup = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const lights: THREE.PointLight[] = [];
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.6, metalness: 0.7,
      transparent: true, opacity: isActive ? 1 : 0,
    });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: era.props.lamp, emissiveIntensity: era.props.lampIntensity,
      transparent: true, opacity: isActive ? 1 : 0, depthWrite: false,
    });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5, 8);
    const armGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);
    const bulbGeo = new THREE.SphereGeometry(0.22, 10, 8);
    for (let i = 0; i < LAMP_POSITIONS.length; i++) {
      const lp = LAMP_POSITIONS[i];
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lp.x, 2.5, lp.z);
      lamp.add(pole);
      const dir = lp.z > 0 ? -1 : 1;
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(lp.x, 4.9, lp.z + dir * 0.7);
      lamp.add(arm);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(lp.x, 4.8, lp.z + dir * 1.3);
      lamp.add(bulb);
      const light = new THREE.PointLight(era.props.lamp, era.props.lampIntensity * 2, 16, 2);
      light.position.set(lp.x, 4.8, lp.z + dir * 1.3);
      lamp.add(light);
      lights.push(light);
      lampGroup.add(lamp);
    }
    lampGroup.visible = isActive;
    lampGroup.frustumCulled = false;
   lampGroup.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.scene.add(lampGroup);
    this.lampMeshes.push(lampGroup);
    this.lampMats.push([poleMat, bulbMat]);
    this.lampLights.push(lights);

    // --- Trees ---
    const treeGroup = new THREE.Group();
    const treeMatList: THREE.MeshStandardMaterial[] = [];
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3a2818, roughness: 0.9, transparent: true, opacity: isActive ? 1 : 0,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2a5a2a, roughness: 0.85, transparent: true, opacity: isActive ? 1 : 0,
    });
    treeMatList.push(trunkMat, leafMat);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.6, 6);
    const leafGeo = new THREE.IcosahedronGeometry(1.0, 0);
    const treeCount = Math.floor(TREE_POSITIONS.length * era.props.treeAmount);
    const used = new Set<number>();
    for (let i = 0; i < treeCount; i++) {
      let idx = Math.floor(hash(i * 41 + e * 13) * TREE_POSITIONS.length);
      while (used.has(idx)) idx = (idx + 1) % TREE_POSITIONS.length;
      used.add(idx);
      const tp = TREE_POSITIONS[idx];
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(tp.x, 0.8, tp.z);
      tree.add(trunk);
      const s = 0.8 + hash(i * 7 + e) * 0.5;
      for (let k = 0; k < 3; k++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(
          tp.x + (hash(i * 3 + k) - 0.5) * 0.6,
          1.8 + k * 0.5,
          tp.z + (hash(i * 5 + k) - 0.5) * 0.6,
        );
        leaf.scale.setScalar(s * (1 - k * 0.2));
        tree.add(leaf);
      }
      treeGroup.add(tree);
    }
   treeGroup.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    treeGroup.visible = isActive;
    treeGroup.frustumCulled = false;
    this.scene.add(treeGroup);
    this.treeMeshes.push(treeGroup);
    this.treeMats.push(treeMatList);

    // --- Neon signs ---
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: era.props.signColor,
      emissiveIntensity: era.props.signNeon * 2,
      transparent: true, opacity: isActive ? 1 : 0, depthWrite: false,
    });
    for (let i = 0; i < SIGN_POSITIONS.length; i++) {
      const sp = SIGN_POSITIONS[i];
      const signGeo = new THREE.BoxGeometry(2.4, 0.7, 0.12);
      const sign = new THREE.Mesh(signGeo, signMat);
      const h = 4 + hash(i * 23 + e) * 3;
      sign.position.set(sp.x, h, sp.z);
      this.signMeshes.push(sign);
      this.scene.add(sign);
    }
    this.signMats.push(signMat);
  }

  update(weights: EraWeights, time: number): void {
    const lampC = blendColors(LAMP_COLORS, weights, 0, this.tmpColor);
    const lampI = blendScalar(LAMP_INTS, weights, 0);
    const signC = blendColors(SIGN_COLORS, weights, 0, this.tmpSignColor);
    const signN = blendScalar(SIGN_NEONS, weights, 0);
    const treeA = blendScalar(TREE_AMOUNTS, weights, 0);

    let signIdx = 0;
    for (let e = 0; e < ERA_COUNT; e++) {
      const w = weights[e];
      // Lamps
      this.lampMeshes[e].visible = w > 0.003;
      for (const mat of this.lampMats[e]) mat.opacity = w;
      this.lampMats[e][1].emissive.copy(lampC);
      this.lampMats[e][1].emissiveIntensity = lampI;
      for (const light of this.lampLights[e]) {
        light.color.copy(lampC);
        light.intensity = lampI * 2 * w;
      }
      // Trees
      const treeOp = clamp(w * (e === 0 ? treeA + 0.6 : 1), 0, w);
      this.treeMeshes[e].visible = w > 0.003;
      for (const mat of this.treeMats[e]) mat.opacity = treeOp;
      // Signs
      this.signMats[e].emissive.copy(signC);
      this.signMats[e].emissiveIntensity = signN * (1.6 + Math.sin(time * 3 + e) * 0.3);
      for (let i = 0; i < SIGN_POSITIONS.length; i++) {
        const sign = this.signMeshes[signIdx++];
        if (sign) sign.visible = w > 0.003;
      }
    }
  }

  dispose(): void {
    for (const g of this.lampMeshes) {
      this.scene.remove(g);
      g.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    }
    for (const g of this.treeMeshes) {
      this.scene.remove(g);
      g.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    }
    for (const s of this.signMeshes) { this.scene.remove(s); s.geometry.dispose(); }
    for (const mats of this.lampMats) for (const m of mats) m.dispose();
    for (const mats of this.treeMats) for (const m of mats) m.dispose();
    for (const m of this.signMats) m.dispose();
    this.lampMeshes = []; this.treeMeshes = []; this.signMeshes = [];
    this.lampMats = []; this.treeMats = []; this.signMats = []; this.lampLights = [];
  }
}
