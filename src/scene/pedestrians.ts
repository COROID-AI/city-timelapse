import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getEraConfig, type EraId } from '../eras';
import { getSidewalkAnchors, type SidewalkAnchor } from './blockLayout';

/**
 * Pedestrian subsystem — era-reactive sidewalk traffic.
 *
 * Reads the era config (`PedestriansConfig` from Phase 1) for the clothing
 * palette and accessories of the current era, then instantiates a stylized
 * crowd that walks along the four sidewalk strips around the block.
 *
 * Design:
 *  - One InstancedMesh per era for the body (clothing) and one per era for the
 *    accessory (hats/headwear), plus a single shared head InstancedMesh (skin).
 *    Repeated bodies, heads and accessories are therefore drawn as a handful of
 *    draw calls regardless of crowd size.
 *  - Each era has its own procedurally-built body geometry (1945 overcoats,
 *    1965 suits, 1985 neon casual, 2005 denim/business, 2025 athleisure) so the
 *    silhouette visibly changes with the time period.
 *  - Pedestrians walk along the sidewalk centre lines and recycle at the block
 *    edge by wrapping to the next sidewalk, so they loop around the block.
 *  - Outfit colours and skin tones are interpolated continuously between the
 *    current and target era palettes using the shared transition progress, so
 *    clothing visibly crossfades during an era change.
 *
 * Scene module contract: exposes `group`, `update(dt, state)`, `setEra(era, t)`
 * and `dispose()`. It does not start its own render loop.
 */

/** Total pedestrian capacity (drawn as instanced bodies/heads/accessories). */
const MAX_PEDESTRIANS = 24;

/** Shared state consumed by `update`. */
export interface PedestrianState {
  /** Normalized 0..1 transition progress between current and target era. */
  transitionProgress: number;
  currentEra: EraId;
  targetEra: EraId;
}

/** One active pedestrian on a sidewalk. */
interface Pedestrian {
  sidewalkIndex: number;
  /** 0..1 progress along the current sidewalk strip. */
  offset: number;
  speed: number;
  /** Per-instance size scale (body + head + accessory). */
  scale: number;
  /** Index into the era outfit palette (stable across transitions). */
  paletteIndex: number;
  /** Phase offset used to desynchronize the walk bob. */
  phase: number;
}

/** Smoothstep easing for a natural, non-linear morph. */
function easeInOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Cache parsed hex colors so hot-path lerps never allocate per frame. */
const colorCache = new Map<string, THREE.Color>();
function cachedColor(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

/** Interpolate between two hex colours into `out`. */
function lerpColor(from: string, to: string, t: number, out: THREE.Color): THREE.Color {
  return out.copy(cachedColor(from)).lerp(cachedColor(to), t);
}

/**
 * Skin-tone palettes per era (diverse, period-appropriate). These are not part
 * of the EraConfig contract (which covers outfits/accessories only), so they
 * live here as a local per-era map so skin tones also change with the era.
 */
const SKIN_TONES: Record<EraId, string[]> = {
  '1945': ['#d8b28a', '#c09068', '#a87858', '#8a6040'],
  '1965': ['#d8b28a', '#c89870', '#b08058', '#9a6848'],
  '1985': ['#e0b890', '#c89870', '#a87858', '#e8c0a0'],
  '2005': ['#d8a880', '#c09068', '#a87858', '#f0c8a8'],
  '2025': ['#e8c0a0', '#d0a080', '#b08868', '#f0d0b0'],
};

/** Procedurally build a merged body geometry (torso + legs + arms) for an era. */
function buildBodyGeometry(era: EraId): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, l);
    g.translate(x, y, z);
    parts.push(g);
  };

  // Legs.
  box(0.5, 0.85, 0.34, -0.14, 0.425, 0);
  box(0.5, 0.85, 0.34, 0.14, 0.425, 0);

  // Torso dimensions vary per era (silhouette).
  let torsoW = 0.66;
  let torsoH = 0.72;
  let torsoL = 0.36;
  switch (era) {
    case '1945': // Long, roomy overcoat.
      torsoW = 0.8;
      torsoH = 0.86;
      torsoL = 0.42;
      break;
    case '1965': // Slim mid-century suit.
      torsoW = 0.62;
      torsoH = 0.72;
      torsoL = 0.34;
      break;
    case '1985': // Casual neon windbreaker.
      torsoW = 0.7;
      torsoH = 0.72;
      torsoL = 0.38;
      break;
    case '2005': // Denim jacket / business casual.
      torsoW = 0.7;
      torsoH = 0.72;
      torsoL = 0.38;
      break;
    case '2025': // Athleisure hoodie / techwear.
      torsoW = 0.74;
      torsoH = 0.76;
      torsoL = 0.4;
      break;
  }

  // Torso.
  box(torsoW, torsoH, torsoL, 0, 0.85 + torsoH / 2, 0);
  // Arms.
  box(0.16, 0.62, 0.3, -(torsoW / 2 + 0.14), 1.2, 0);
  box(0.16, 0.62, 0.3, torsoW / 2 + 0.14, 1.2, 0);

  // Era-specific features.
  switch (era) {
    case '1945': {
      // Belt + collar on the overcoat.
      box(0.66, 0.08, 0.4, 0, 0.95, 0);
      box(0.44, 0.14, 0.1, 0, 1.62, -0.2);
      break;
    }
    case '1965': {
      // Thin necktie.
      box(0.12, 0.32, 0.02, 0, 1.12, torsoL / 2 + 0.02);
      break;
    }
    case '1985': {
      // Leg warmers at the ankles + headband.
      box(0.36, 0.2, 0.36, -0.14, 0.2, 0);
      box(0.36, 0.2, 0.36, 0.14, 0.2, 0);
      box(0.34, 0.06, 0.12, 0, 1.8, 0.12);
      break;
    }
    case '2005': {
      // Jacket collar.
      box(0.5, 0.14, 0.1, 0, 1.6, -0.2);
      break;
    }
    case '2025': {
      // Hoodie hood behind the head + shoulder pads.
      box(0.6, 0.3, 0.36, 0, 1.62, -0.16);
      box(0.12, 0.06, 0.3, -(torsoW / 2 + 0.02), 1.35, 0);
      box(0.12, 0.06, 0.3, torsoW / 2 + 0.02, 1.35, 0);
      break;
    }
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) {
    // Fallback: a plain box so the scene never breaks.
    return new THREE.BoxGeometry(0.7, 1.7, 0.4).translate(0, 0.85, 0);
  }
  merged.computeVertexNormals();
  return merged;
}

/** Procedurally build an accessory (hat / headwear) geometry for an era. */
function buildAccessoryGeometry(era: EraId): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, l);
    g.translate(x, y, z);
    parts.push(g);
  };
  const cyl = (rTop: number, rBot: number, h: number, y: number, seg = 10) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    g.translate(0, y, 0);
    parts.push(g);
  };

  switch (era) {
    case '1945': {
      // Fedora: wide brim + crown.
      cyl(0.3, 0.3, 0.03, 1.95, 14);
      cyl(0.16, 0.2, 0.14, 2.03, 12);
      break;
    }
    case '1965': {
      // Beret / pillbox.
      cyl(0.2, 0.22, 0.1, 1.98, 12);
      break;
    }
    case '1985': {
      // Sweatband / visor.
      box(0.34, 0.06, 0.16, 0, 1.96, 0.06);
      box(0.12, 0.05, 0.12, 0, 1.99, -0.1);
      break;
    }
    case '2005': {
      // Baseball cap + brim.
      box(0.32, 0.09, 0.16, 0, 2.0, 0);
      box(0.32, 0.03, 0.2, 0, 1.98, 0.18);
      break;
    }
    case '2025': {
      // Beanie.
      cyl(0.18, 0.22, 0.14, 2.0, 12);
      break;
    }
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) {
    return new THREE.BoxGeometry(0.2, 0.1, 0.2).translate(0, 2.0, 0);
  }
  merged.computeVertexNormals();
  return merged;
}

export class Pedestrians {
  readonly group: THREE.Group;

  private bodyMeshes = new Map<EraId, THREE.InstancedMesh>();
  private accessoryMeshes = new Map<EraId, THREE.InstancedMesh>();
  private headMesh: THREE.InstancedMesh;

  private bodyGeos = new Map<EraId, THREE.BufferGeometry>();
  private accessoryGeos = new Map<EraId, THREE.BufferGeometry>();
  private headGeo: THREE.BufferGeometry;

  private bodyMat: THREE.MeshStandardMaterial;
  private accessoryMat: THREE.MeshStandardMaterial;
  private headMat: THREE.MeshStandardMaterial;

  private activeEra: EraId | null = null;
  private pedestrians: Pedestrian[] = [];
  private sidewalks: SidewalkAnchor[] = [];
  private sidewalkLengths: number[] = [];

  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();
  private readonly tmpColor2 = new THREE.Color();
  private time = 0;
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';

    this.bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.0 });
    this.accessoryMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.05 });
    this.headMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, metalness: 0.0 });

    this.headGeo = new THREE.SphereGeometry(0.2, 10, 8);
    this.headMesh = new THREE.InstancedMesh(this.headGeo, this.headMat, MAX_PEDESTRIANS);
    this.headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.headMesh.castShadow = true;
    this.headMesh.name = 'pedestrians-heads';
    this.group.add(this.headMesh);

    this.sidewalks = getSidewalkAnchors();
    this.sidewalkLengths = this.sidewalks.map((s) => s.start.distanceTo(s.end));

    // Build all era body + accessory geometries up front so era switches are instant.
    for (const era of ['1945', '1965', '1985', '2005', '2025'] as const) {
      this.ensureMeshes(era);
    }

    // Initial era.
    this.setEra('1945', 1);
  }

  private ensureMeshes(era: EraId): void {
    if (this.bodyMeshes.has(era)) return;

    const bodyGeo = buildBodyGeometry(era);
    const accessoryGeo = buildAccessoryGeometry(era);
    this.bodyGeos.set(era, bodyGeo);
    this.accessoryGeos.set(era, accessoryGeo);

    const body = new THREE.InstancedMesh(bodyGeo, this.bodyMat, MAX_PEDESTRIANS);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.castShadow = true;
    body.name = `pedestrians-body-${era}`;
    this.bodyMeshes.set(era, body);
    this.group.add(body);
    body.visible = false;

    const accessory = new THREE.InstancedMesh(accessoryGeo, this.accessoryMat, MAX_PEDESTRIANS);
    accessory.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    accessory.castShadow = true;
    accessory.name = `pedestrians-accessory-${era}`;
    this.accessoryMeshes.set(era, accessory);
    this.group.add(accessory);
    accessory.visible = false;
  }

  /** Apply a fully-resolved era (construction / settle / dominant swap). */
  setEra(era: EraId, _t = 1): void {
    if (this.disposed) return;
    if (this.activeEra === era) return;

    // Hide the previous era's meshes.
    if (this.activeEra) {
      this.bodyMeshes.get(this.activeEra)!.visible = false;
      this.accessoryMeshes.get(this.activeEra)!.visible = false;
    }

    this.activeEra = era;
    this.ensureMeshes(era);
    this.bodyMeshes.get(era)!.visible = true;
    this.accessoryMeshes.get(era)!.visible = true;

    // Spawn pedestrians on first construction.
    if (this.pedestrians.length === 0) {
      const cfg = getEraConfig(era);
      const paletteLen = Math.max(1, cfg.pedestrians.outfitPalettes.length);
      for (let i = 0; i < MAX_PEDESTRIANS; i++) {
        this.pedestrians.push({
          sidewalkIndex: i % this.sidewalks.length,
          offset: Math.random(),
          speed: 0.8 + Math.random() * 0.7,
          scale: 0.82 + Math.random() * 0.2,
          paletteIndex: i % paletteLen,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    this.writeInstances(0);
  }

  /** Advance pedestrians and write instance matrices + colors. */
  private writeInstances(dt: number): void {
    if (!this.activeEra) return;

    // Advance motion + recycle at block edges.
    for (const p of this.pedestrians) {
      const len = this.sidewalkLengths[p.sidewalkIndex] || 1;
      p.offset += (p.speed * dt) / len;
      if (p.offset >= 1) {
        // Wrap around the corner to the next sidewalk (recycle at block edge).
        p.offset = p.offset - 1;
        p.sidewalkIndex = (p.sidewalkIndex + 1) % this.sidewalks.length;
      }
    }

    const body = this.bodyMeshes.get(this.activeEra);
    const accessory = this.accessoryMeshes.get(this.activeEra);
    if (!body || !accessory) return;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const sw = this.sidewalks[p.sidewalkIndex];
      const x = sw.start.x + (sw.end.x - sw.start.x) * p.offset;
      const z = sw.start.z + (sw.end.z - sw.start.z) * p.offset;
      const yaw = Math.atan2(sw.end.x - sw.start.x, sw.end.z - sw.start.z);
      const bob = Math.abs(Math.sin(this.time * p.speed * 3 + p.phase)) * 0.05;

      // Body instance.
      this.dummy.position.set(x, bob, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.setScalar(p.scale);
      this.dummy.updateMatrix();
      body.setMatrixAt(i, this.dummy.matrix);

      // Head instance (shared mesh, same transform, lifted to the head height).
      this.dummy.scale.setScalar(p.scale);
      this.dummy.position.set(x, bob + 1.72 * p.scale, z);
      this.dummy.updateMatrix();
      this.headMesh.setMatrixAt(i, this.dummy.matrix);

      // Accessory instance (sits on the head).
      this.dummy.position.set(x, bob + 1.95 * p.scale, z);
      this.dummy.updateMatrix();
      accessory.setMatrixAt(i, this.dummy.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    accessory.instanceMatrix.needsUpdate = true;
    if (accessory.instanceColor) accessory.instanceColor.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    if (this.headMesh.instanceColor) this.headMesh.instanceColor.needsUpdate = true;

    // Hide unused instances.
    for (let i = this.pedestrians.length; i < MAX_PEDESTRIANS; i++) {
      this.dummy.position.set(0, -1000, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      body.setMatrixAt(i, this.dummy.matrix);
      accessory.setMatrixAt(i, this.dummy.matrix);
      this.headMesh.setMatrixAt(i, this.dummy.matrix);
    }
  }

  /** Called each frame by the composition root. */
  update(dt: number, state: PedestrianState): void {
    if (this.disposed) return;

    this.time += dt;

    // Determine the dominant era; swap the silhouette when it changes.
    const dominant = state.transitionProgress >= 0.5 ? state.targetEra : state.currentEra;
    if (this.activeEra !== dominant) {
      this.setEra(dominant);
    }

    // Guard: activeEra is set by the constructor / setEra above.
    const era = this.activeEra;
    if (!era) return;

    // Interpolate colours continuously from current to target era palettes so
    // clothing + skin tones crossfade with the era transition.
    const t = easeInOut(state.transitionProgress);
    const curCfg = getEraConfig(state.currentEra).pedestrians;
    const tgtCfg = getEraConfig(state.targetEra).pedestrians;
    const curSkin = SKIN_TONES[state.currentEra];
    const tgtSkin = SKIN_TONES[state.targetEra];

    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const idx = p.paletteIndex;
      const from = curCfg.outfitPalettes[idx % curCfg.outfitPalettes.length];
      const to = tgtCfg.outfitPalettes[idx % tgtCfg.outfitPalettes.length];
      const cloth = lerpColor(from, to, t, this.tmpColor);

      // Body + accessory use the interpolated clothing colour.
      this.bodyMeshes.get(era)!.setColorAt(i, cloth);

      const acc = this.tmpColor2.copy(cloth).multiplyScalar(0.8);
      this.accessoryMeshes.get(era)!.setColorAt(i, acc);

      // Head uses the interpolated skin tone.
      const skin = lerpColor(
        curSkin[idx % curSkin.length],
        tgtSkin[idx % tgtSkin.length],
        t,
        this.tmpColor,
      );
      this.headMesh.setColorAt(i, skin);
    }

    this.writeInstances(dt);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.bodyMeshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    for (const mesh of this.accessoryMeshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.headMesh.geometry.dispose();
    this.headMesh.dispose();
    this.bodyMeshes.clear();
    this.accessoryMeshes.clear();
    this.bodyGeos.clear();
    this.accessoryGeos.clear();
    this.headGeo.dispose();
    this.bodyMat.dispose();
    this.accessoryMat.dispose();
    this.headMat.dispose();
  }
}