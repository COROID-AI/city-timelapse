import * as THREE from 'three';
import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendColors, blendScalar } from '../core/mathUtils';

// Ground plane, road, sidewalks, crosswalks, and lane markings.
// All built once; materials blend per-era colors each frame.

const ROAD_HALF = 4.5;
const BLOCK_HALF = 26;

// Pre-computed per-era arrays — built once.
const GROUND_COLORS = ERAS.map(e => e.ground.ground);
const ROAD_COLORS = ERAS.map(e => e.ground.road);
const SW_COLORS = ERAS.map(e => e.ground.sidewalk);
const MARK_COLORS = ERAS.map(e => e.ground.markings);
const NIGHT_WEIGHTS = ERAS.map(e => e.isNight ? 1 : 0);

export class GroundStreet {
  private scene: THREE.Scene;
  private groundMat: THREE.MeshStandardMaterial;
  private roadMat: THREE.MeshStandardMaterial;
  private swNMat: THREE.MeshStandardMaterial;
  private swSMat: THREE.MeshStandardMaterial;
  private markingsMat: THREE.MeshStandardMaterial;
  private markingsMesh: THREE.InstancedMesh;
  private crosswalkMat: THREE.MeshStandardMaterial;
  private crosswalkMesh: THREE.Mesh;
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x6b5a40, roughness: 0.95, metalness: 0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2c, roughness: 0.9, metalness: 0.05,
    });
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(BLOCK_HALF * 2 + 10, ROAD_HALF * 2),
      this.roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    scene.add(road);

    this.swNMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a5c, roughness: 0.92, metalness: 0.03,
    });
    this.swSMat = this.swNMat.clone();
    const swN = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK_HALF * 2 + 10, 6), this.swNMat);
    swN.rotation.x = -Math.PI / 2;
    swN.position.set(0, 0.01, ROAD_HALF + 3);
   swN.receiveShadow = true;
    scene.add(swN);
    const swS = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK_HALF * 2 + 10, 6), this.swSMat);
    swS.rotation.x = -Math.PI / 2;
    swS.position.set(0, 0.01, -(ROAD_HALF + 3));
   swS.receiveShadow = true;
    scene.add(swS);

    // Center lane dashes
    this.markingsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3,
      roughness: 0.6, metalness: 0,
      transparent: true, opacity: 0.85,
    });
    const dashCount = 30;
    this.markingsMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.3, 1.6),
      this.markingsMat,
      dashCount,
    );
    const d = new THREE.Object3D();
    const span = BLOCK_HALF * 2 + 6;
    for (let i = 0; i < dashCount; i++) {
      const x = -span / 2 + (i / (dashCount - 1)) * span;
      d.position.set(x, 0.02, 0);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.markingsMesh.setMatrixAt(i, d.matrix);
    }
    this.markingsMesh.instanceMatrix.needsUpdate = true;
    this.markingsMesh.frustumCulled = false;
    scene.add(this.markingsMesh);

    // Crosswalk at west end
    this.crosswalkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.7, transparent: true, opacity: 0.7,
    });
    const stripeCount = 7;
    const stripeGeo = new THREE.PlaneGeometry(0.5, 2.5);
    const stripes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < stripeCount; i++) {
      const g = stripeGeo.clone();
      g.translate(-(BLOCK_HALF + 1), 0.02, -(ROAD_HALF - 0.4) + i * (ROAD_HALF * 2 - 0.8) / (stripeCount - 1));
      stripes.push(g);
    }
    const mergedGeo = mergeGeometries(stripes);
    this.crosswalkMesh = new THREE.Mesh(mergedGeo, this.crosswalkMat);
    this.crosswalkMesh.rotation.x = -Math.PI / 2;
    this.crosswalkMesh.frustumCulled = false;
    scene.add(this.crosswalkMesh);
  }

  update(weights: EraWeights): void {
    this.groundMat.color.copy(blendColors(GROUND_COLORS, weights, 0, this.tmpColor));
    this.roadMat.color.copy(blendColors(ROAD_COLORS, weights, 0, this.tmpColor));
    const swC = blendColors(SW_COLORS, weights, 0, this.tmpColor);
    this.swNMat.color.copy(swC);
    this.swSMat.color.copy(swC);
    this.markingsMat.color.copy(blendColors(MARK_COLORS, weights, 0, this.tmpColor));
    this.markingsMat.emissive.copy(this.markingsMat.color);
    this.crosswalkMat.color.copy(blendColors(MARK_COLORS, weights, 0, this.tmpColor));

    // Marking opacity brighter in night eras
    const nightWeight = blendScalar(NIGHT_WEIGHTS, weights, 0);
    this.markingsMat.emissiveIntensity = 0.2 + nightWeight * 0.8;
  }

  dispose(): void {
    this.scene.remove(
      ...this.scene.children.filter(c => c.userData.groundStreet === true),
    );
    this.groundMat.dispose();
    this.roadMat.dispose();
    this.swNMat.dispose();
    this.swSMat.dispose();
    this.markingsMat.dispose();
    this.markingsMesh.geometry.dispose();
    this.crosswalkMat.dispose();
    this.crosswalkMesh.geometry.dispose();
  }
}

// Minimal mergeGeometries to avoid importing BufferGeometryUtils.
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let vCount = 0;
  let iCount = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    vCount += pos.count;
    const idx = g.getIndex();
    iCount += idx ? idx.count : pos.count;
  }
  const positions = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const indices = new Uint16Array(iCount);
  let vOff = 0;
  let iOff = 0;
  let vBase = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (uv) {
        uvs[(vOff + i) * 2] = uv.getX(i);
        uvs[(vOff + i) * 2 + 1] = uv.getY(i);
      }
    }
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[iOff + i] = idx.getX(i) + vBase;
      }
      iOff += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[iOff + i] = i + vBase;
      }
      iOff += pos.count;
    }
    vBase += pos.count;
    vOff += pos.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}
