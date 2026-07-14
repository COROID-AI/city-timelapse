import * as THREE from 'three';
import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { hash, lerp, clamp } from '../core/mathUtils';

// City-block building plots on both sides of the street.
interface Plot { x: number; z: number; w: number; d: number; }

const PLOTS: Plot[] = [
  // North side (z > 0)
  { x: -20, z: 11, w: 5, d: 5 },
  { x: -12, z: 13, w: 6, d: 6 },
  { x: -3, z: 11, w: 5, d: 5 },
  { x: 5, z: 13, w: 7, d: 6 },
  { x: 14, z: 11, w: 5, d: 5 },
  { x: 21, z: 13, w: 4, d: 6 },
  // South side (z < 0)
  { x: -20, z: -11, w: 5, d: 5 },
  { x: -12, z: -13, w: 6, d: 6 },
  { x: -3, z: -11, w: 5, d: 5 },
  { x: 5, z: -13, w: 7, d: 6 },
  { x: 14, z: -11, w: 5, d: 5 },
  { x: 21, z: -13, w: 4, d: 6 },
];

interface WindowStyle {
  sizeW: number; sizeH: number;
  rowS: number; colS: number;
  mY: number; mX: number;
}

const WINDOW_STYLES: WindowStyle[] = [
  { sizeW: 0.8, sizeH: 1.0, rowS: 2.2, colS: 2.0, mY: 1.5, mX: 0.8 }, // 1945
  { sizeW: 1.0, sizeH: 1.2, rowS: 2.2, colS: 2.0, mY: 1.5, mX: 0.8 }, // 1960
  { sizeW: 0.9, sizeH: 0.9, rowS: 1.8, colS: 1.6, mY: 1.2, mX: 0.6 }, // 1980
  { sizeW: 1.4, sizeH: 1.8, rowS: 2.4, colS: 2.2, mY: 1.5, mX: 0.8 }, // 2000
  { sizeW: 1.4, sizeH: 1.8, rowS: 2.4, colS: 2.2, mY: 1.5, mX: 0.8 }, // 2020
  { sizeW: 1.2, sizeH: 1.4, rowS: 2.0, colS: 1.8, mY: 1.3, mX: 0.7 }, // 2040
  { sizeW: 1.0, sizeH: 1.2, rowS: 1.6, colS: 1.5, mY: 1.2, mX: 0.6 }, // 2055
];

const MAX_ROWS = 22;
const HALF_PI = Math.PI * 0.5;

/**
 * Buildings are built ONCE as 7 per-era InstancedMesh sets (walls, windows,
 * roofs). Transitions crossfade opacity — no geometry is rebuilt on slider input.
 */
export class Buildings {
  private scene: THREE.Scene;
  private wallMeshes: THREE.InstancedMesh[] = [];
  private windowMeshes: THREE.InstancedMesh[] = [];
  private roofMeshes: THREE.InstancedMesh[] = [];
  private accentMeshes: THREE.InstancedMesh[] = [];
  private wallMats: THREE.MeshStandardMaterial[] = [];
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private roofMats: THREE.MeshStandardMaterial[] = [];
  private accentMats: THREE.MeshStandardMaterial[] = [];
  private heights: Float32Array;
  private transform = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.heights = new Float32Array(PLOTS.length * ERA_COUNT);
    for (let i = 0; i < PLOTS.length; i++) {
      for (let e = 0; e < ERA_COUNT; e++) {
        const era = ERAS[e];
        const t = hash(i * 37 + e * 101 + 3);
        this.heights[i * ERA_COUNT + e] = lerp(era.buildings.heightMin, era.buildings.heightMax, t);
      }
    }
    for (let e = 0; e < ERA_COUNT; e++) {
      this.buildEra(e);
    }
  }

  private buildEra(e: number): void {
    const era = ERAS[e];
    const style = WINDOW_STYLES[e];
    const isActive = e === 0;

    // --- Walls ---
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: clamp(0.92 - era.buildings.glassiness * 0.7, 0.08, 0.95),
      metalness: clamp(era.buildings.glassiness * 0.85, 0, 0.9),
      transparent: true,
      opacity: isActive ? 1 : 0,
    });
    const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, PLOTS.length);
    for (let i = 0; i < PLOTS.length; i++) {
      const p = PLOTS[i];
      const h = this.heights[i * ERA_COUNT + e];
      this.transform.position.set(p.x, h * 0.5, p.z);
      this.transform.scale.set(p.w, h, p.d);
      this.transform.rotation.set(0, 0, 0);
      this.transform.updateMatrix();
      wallMesh.setMatrixAt(i, this.transform.matrix);
      const colorIdx = i % era.buildings.wall.length;
      const v = 0.72 + hash(i * 13 + e * 7) * 0.56;
      this.tmpColor.setHex(era.buildings.wall[colorIdx]).multiplyScalar(v);
      wallMesh.setColorAt(i, this.tmpColor);
    }
    wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
    wallMesh.visible = isActive;
    wallMesh.frustumCulled = false;
    this.scene.add(wallMesh);
    this.wallMeshes.push(wallMesh);
    this.wallMats.push(wallMat);

    // --- Windows ---
    let winCount = 0;
    for (let i = 0; i < PLOTS.length; i++) {
      winCount += this.countWindowsFor(i, e, style);
    }
    const winGeo = new THREE.PlaneGeometry(style.sizeW, style.sizeH);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      emissive: era.buildings.window,
      emissiveIntensity: era.buildings.windowIntensity,
      roughness: 0.25,
      metalness: 0.7,
      transparent: true,
      opacity: isActive ? 1 : 0,
      depthWrite: false,
    });
    const winMesh = new THREE.InstancedMesh(winGeo, winMat, Math.max(1, winCount));
    let idx = 0;
    for (let i = 0; i < PLOTS.length; i++) {
      idx = this.fillWindowsFor(i, e, style, winMesh, idx);
    }
    winMesh.instanceMatrix.needsUpdate = true;
    winMesh.visible = isActive;
    winMesh.frustumCulled = false;
    this.scene.add(winMesh);
    this.windowMeshes.push(winMesh);
    this.windowMats.push(winMat);

    // --- Roof caps ---
    const roofGeo = new THREE.BoxGeometry(1, 0.5, 1);
    const roofMat = new THREE.MeshStandardMaterial({
      color: era.buildings.roof,
      roughness: 0.88,
      metalness: 0.25,
      transparent: true,
      opacity: isActive ? 1 : 0,
    });
    const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, PLOTS.length);
    for (let i = 0; i < PLOTS.length; i++) {
      const p = PLOTS[i];
      const h = this.heights[i * ERA_COUNT + e];
      this.transform.position.set(p.x, h + 0.25, p.z);
      this.transform.scale.set(p.w + 0.35, 1, p.d + 0.35);
      this.transform.rotation.set(0, 0, 0);
      this.transform.updateMatrix();
      roofMesh.setMatrixAt(i, this.transform.matrix);
    }
    roofMesh.instanceMatrix.needsUpdate = true;
    roofMesh.visible = isActive;
    roofMesh.frustumCulled = false;
    this.scene.add(roofMesh);
    this.roofMeshes.push(roofMesh);
    this.roofMats.push(roofMat);

    // --- Accent trim (neon / futuristic edge glow) ---
    const accentGeo = new THREE.BoxGeometry(1, 0.12, 0.12);
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: era.buildings.accent,
      emissiveIntensity: era.buildings.accentIntensity,
      transparent: true,
      opacity: isActive ? 1 : 0,
      depthWrite: false,
    });
    // 4 edge strips per building (top perimeter) = 4 * PLOTS
    const accentMesh = new THREE.InstancedMesh(accentGeo, accentMat, PLOTS.length * 4);
    for (let i = 0; i < PLOTS.length; i++) {
      const p = PLOTS[i];
      const h = this.heights[i * ERA_COUNT + e];
      const base = i * 4;
      // 4 top edges
      const edges: [number, number, number, number, number][] = [
        [p.x, h + 0.1, p.z + p.d * 0.5, p.w + 0.2, 0],           // front
        [p.x, h + 0.1, p.z - p.d * 0.5, p.w + 0.2, 0],           // back
        [p.x + p.w * 0.5, h + 0.1, p.z, p.d + 0.2, HALF_PI],     // right
        [p.x - p.w * 0.5, h + 0.1, p.z, p.d + 0.2, HALF_PI],     // left
      ];
      for (let k = 0; k < 4; k++) {
        const [ex, ey, ez, elen, erot] = edges[k];
        this.transform.position.set(ex, ey, ez);
        this.transform.scale.set(elen, 1, 1);
        this.transform.rotation.set(0, erot, 0);
        this.transform.updateMatrix();
        accentMesh.setMatrixAt(base + k, this.transform.matrix);
      }
    }
    accentMesh.instanceMatrix.needsUpdate = true;
    accentMesh.visible = isActive;
    accentMesh.frustumCulled = false;
    this.scene.add(accentMesh);
    this.accentMeshes.push(accentMesh);
    this.accentMats.push(accentMat);
  }

  private countWindowsFor(plotIdx: number, e: number, s: WindowStyle): number {
    const p = PLOTS[plotIdx];
    const h = this.heights[plotIdx * ERA_COUNT + e];
    const rows = Math.min(MAX_ROWS, Math.max(2, Math.floor((h - 2 * s.mY) / s.rowS)));
    const colsZ = Math.max(1, Math.floor((p.w - 2 * s.mX) / s.colS));
    const colsX = Math.max(1, Math.floor((p.d - 2 * s.mX) / s.colS));
    return rows * colsZ * 2 + rows * colsX * 2;
  }

  private fillWindowsFor(
    plotIdx: number, e: number, s: WindowStyle,
    mesh: THREE.InstancedMesh, startIdx: number,
  ): number {
    const p = PLOTS[plotIdx];
    const h = this.heights[plotIdx * ERA_COUNT + e];
    const rows = Math.min(MAX_ROWS, Math.max(2, Math.floor((h - 2 * s.mY) / s.rowS)));
    const colsZ = Math.max(1, Math.floor((p.w - 2 * s.mX) / s.colS));
    const colsX = Math.max(1, Math.floor((p.d - 2 * s.mX) / s.colS));
    let idx = startIdx;
    const rowStep = (h - 2 * s.mY) / Math.max(1, rows - 1);
    const colStepZ = (p.w - 2 * s.mX) / Math.max(1, colsZ);
    const colStepX = (p.d - 2 * s.mX) / Math.max(1, colsX);

    for (let r = 0; r < rows; r++) {
      const y = s.mY + r * rowStep;
      for (let c = 0; c < colsZ; c++) {
        const x = p.x - p.w * 0.5 + s.mX + c * colStepZ + colStepZ * 0.5;
        this.transform.position.set(x, y, p.z + p.d * 0.5 + 0.06);
        this.transform.rotation.set(0, 0, 0);
        this.transform.scale.set(1, 1, 1);
        this.transform.updateMatrix();
        mesh.setMatrixAt(idx++, this.transform.matrix);
        this.transform.position.set(x, y, p.z - p.d * 0.5 - 0.06);
        this.transform.rotation.set(0, Math.PI, 0);
        this.transform.updateMatrix();
        mesh.setMatrixAt(idx++, this.transform.matrix);
      }
      for (let c = 0; c < colsX; c++) {
        const z = p.z - p.d * 0.5 + s.mX + c * colStepX + colStepX * 0.5;
        this.transform.position.set(p.x + p.w * 0.5 + 0.06, y, z);
        this.transform.rotation.set(0, HALF_PI, 0);
        this.transform.updateMatrix();
        mesh.setMatrixAt(idx++, this.transform.matrix);
        this.transform.position.set(p.x - p.w * 0.5 - 0.06, y, z);
        this.transform.rotation.set(0, -HALF_PI, 0);
        this.transform.updateMatrix();
        mesh.setMatrixAt(idx++, this.transform.matrix);
      }
    }
    return idx;
  }

  update(weights: EraWeights): void {
    for (let e = 0; e < ERA_COUNT; e++) {
      const w = weights[e];
      const vis = w > 0.003;
      this.wallMeshes[e].visible = vis;
      this.windowMeshes[e].visible = vis;
      this.roofMeshes[e].visible = vis;
      this.accentMeshes[e].visible = vis;
      this.wallMats[e].opacity = w;
      this.windowMats[e].opacity = w;
      this.roofMats[e].opacity = w;
      this.accentMats[e].opacity = w;
    }
  }

  dispose(): void {
    const all = [...this.wallMeshes, ...this.windowMeshes, ...this.roofMeshes, ...this.accentMeshes];
    const mats = [...this.wallMats, ...this.windowMats, ...this.roofMats, ...this.accentMats];
    for (const mesh of all) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of mats) mat.dispose();
    this.wallMeshes = []; this.windowMeshes = []; this.roofMeshes = []; this.accentMeshes = [];
    this.wallMats = []; this.windowMats = []; this.roofMats = []; this.accentMats = [];
  }
}
