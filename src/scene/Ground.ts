import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor, makeNoiseTexture } from '../three-helpers';

/**
 * Renders the ground plane, roads with lane markings, sidewalks, and
 * the glowing ground strips that appear strongly in 2055.
 */
export class Ground {
  group = new THREE.Group();

  private roadMat: THREE.MeshStandardMaterial;
  private groundMat: THREE.MeshStandardMaterial;
  private sidewalkMat: THREE.MeshStandardMaterial;
  private glowMat: THREE.MeshBasicMaterial;
  private glowMesh: THREE.Mesh;
  private crosswalkMats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    const half = 42; // half-extent of the block

    // --- Asphalt road surface (single plane with cross layout) ---
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.95,
      metalness: 0.0,
      map: makeNoiseTexture('#232323', '#3a3a3a', 1200),
    });
    this.roadMat.map!.repeat.set(8, 8);

    const roadGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const road = new THREE.Mesh(roadGeo, this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.group.add(road);

    // --- Sidewalk borders (raised slightly around the road grid) ---
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x8a8580,
      roughness: 0.85,
      metalness: 0.0,
    });
    const swH = 0.18;
    const roadHalf = 7; // road extends ±7 from centre
    const swInset = 2.2;
    // Four sidewalk strips forming a square ring offset from road
    const swStrips: [number, number, number, number][] = [
      // along +Z edge of horizontal road
      [half * 2, swH, 2.2, roadHalf + swInset],
    ];
    // Build a proper sidewalk grid: strips bordering both roads
    const stripDefs: { x: number; z: number; w: number; d: number }[] = [];
    const len = half * 2;
    // Horizontal road sidewalks (top & bottom of the E-W road)
    for (const z of [roadHalf + swInset / 2, -(roadHalf + swInset / 2)]) {
      stripDefs.push({ x: 0, z, w: len, d: swInset });
    }
    // Vertical road sidewalks (left & right of the N-S road)
    for (const x of [roadHalf + swInset / 2, -(roadHalf + swInset / 2)]) {
      stripDefs.push({ x, z: 0, w: swInset, d: len });
    }
    void swStrips;
    for (const d of stripDefs) {
      const geo = new THREE.BoxGeometry(d.w, swH, d.d);
      const mesh = new THREE.Mesh(geo, this.sidewalkMat);
      mesh.position.set(d.x, swH / 2, d.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
    }

    // --- Lane markings (dashed centre lines on both roads) ---
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xeee6c8,
      roughness: 0.7,
      emissive: 0x222018,
      emissiveIntensity: 0.2,
    });
    const dashLen = 1.6;
    const dashGap = 1.4;
    const dashW = 0.18;
    for (let i = -half + 2; i < half - 2; i += dashLen + dashGap) {
      // E-W road centre dashes
      const dGeo = new THREE.PlaneGeometry(dashLen, dashW);
      const d1 = new THREE.Mesh(dGeo, markMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(i, 0.03, 0);
      this.group.add(d1);
      // N-S road centre dashes
      const d2 = new THREE.Mesh(dGeo, markMat);
      d2.rotation.x = -Math.PI / 2;
      d2.rotation.z = Math.PI / 2;
      d2.position.set(0, 0.03, i);
      this.group.add(d2);
    }

    // --- Crosswalk stripes at the intersection ---
    const cwMat = new THREE.MeshStandardMaterial({
      color: 0xddd6c0,
      roughness: 0.6,
    });
    this.crosswalkMats.push(cwMat);
    const cwCount = 5;
    const cwW = 0.6;
    for (let i = 0; i < cwCount; i++) {
      const off = (i - (cwCount - 1) / 2) * 1.4;
      // North crosswalk
      const nGeo = new THREE.PlaneGeometry(cwW, 3);
      const n = new THREE.Mesh(nGeo, cwMat);
      n.rotation.x = -Math.PI / 2;
      n.position.set(off, 0.025, roadHalf + 1.5);
      this.group.add(n);
      // South
      const s = new THREE.Mesh(nGeo, cwMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(off, 0.025, -(roadHalf + 1.5));
      this.group.add(s);
      // East
      const e = new THREE.Mesh(nGeo, cwMat);
      e.rotation.x = -Math.PI / 2;
      e.rotation.z = Math.PI / 2;
      e.position.set(roadHalf + 1.5, 0.025, off);
      this.group.add(e);
      // West
      const w = new THREE.Mesh(nGeo, cwMat);
      w.rotation.x = -Math.PI / 2;
      w.rotation.z = Math.PI / 2;
      w.position.set(-(roadHalf + 1.5), 0.025, off);
      this.group.add(w);
    }

    // --- Glowing ground strips (2055) ---
    // Thin emissive lines along road edges and sidewalk borders.
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const glowStrips: { x: number; z: number; w: number; d: number }[] = [];
    for (const z of [roadHalf + 0.1, -(roadHalf + 0.1)]) {
      glowStrips.push({ x: 0, z, w: len, d: 0.12 });
    }
    for (const x of [roadHalf + 0.1, -(roadHalf + 0.1)]) {
      glowStrips.push({ x, z: 0, w: 0.12, d: len });
    }
    // Merge into one geometry for efficiency
    const glowGeos = glowStrips.map((s) => {
      const g = new THREE.PlaneGeometry(s.w, s.d);
      g.rotateX(-Math.PI / 2);
      g.translate(s.x, 0.04, s.z);
      return g;
    });
    const merged = mergePlanes(glowGeos);
    this.glowMesh = new THREE.Mesh(merged, this.glowMat);
    this.group.add(this.glowMesh);

    // --- Outer ground (beyond the block, fades into fog) ---
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 1.0,
      metalness: 0.0,
    });
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  update(cfg: EraConfig): void {
    this.roadMat.color.copy(toColor(cfg.roadColor));
    this.sidewalkMat.color.copy(toColor(cfg.sidewalkColor));
    this.groundMat.color.copy(toColor(cfg.groundColor));

    // Glow strips strongest in 2055 (storefrontHologram + flyingCarAmount)
    const glowStrength = cfg.storefrontHologram * 0.6 + cfg.flyingCarAmount * 0.4;
    this.glowMat.opacity = THREE.MathUtils.clamp(glowStrength, 0, 1);
    // Cyan-ish glow tinted by era
    const gc = toColor(cfg.skyBottom);
    this.glowMat.color.copy(gc).lerp(new THREE.Color(0x00ffff), 0.4);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
    this.roadMat.map?.dispose();
    this.roadMat.dispose();
    this.sidewalkMat.dispose();
    this.groundMat.dispose();
    this.glowMat.dispose();
    for (const m of this.crosswalkMats) m.dispose();
  }
}

/** Merge an array of plane geometries into a single BufferGeometry. */
function mergePlanes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vOffset = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const idx = g.getIndex();
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vOffset);
      }
    }
    vOffset += pos.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}
