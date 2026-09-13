/**
 * Procedural building archetypes for the era building sets.
 *
 * Five parameterized archetypes — rowhouse (1945), mid-century slab (1965),
 * concrete/glass block (1985), glass-and-steel mid-rise (2005) and green
 * tower (2025) — are assembled from WebGL-free `BufferGeometry` primitives
 * (shared `BoxGeometry`/`CylinderGeometry` instances plus merged quad and
 * box `BufferGeometry` for windows, rails, fins, solar arrays, ...). Every
 * building is built in a local frame with the street-facing facade on the
 * local +Z side; `buildBuildings` rotates the whole building group by the
 * lot's frontage angle so the +Z face points at the street.
 *
 * Detail counts are accumulated per building and surfaced in the descriptor
 * so headless composition tests can assert per-era markers (fire escapes in
 * 1945, solar + wind in 2025, ...), lot containment, determinism and
 * theme-input sensitivity without a renderer.
 */

import * as THREE from 'three';
import { clamp } from '../../lib/math';
import { type Rng } from '../../lib/rng';
import type { BuildingLot } from '../layout';
import type { EraId } from '../../era/types';
import type { EraBuildingDetail, ResolvedEraBuilding } from './eraBuildingData';
import type { EraMaterials } from './materials';

// ============================================================================
// Shared geometry & descriptor types
// ============================================================================

/** An axis-aligned box, center-based, in building-local coordinates. */
export interface BoxSpec {
  cx: number;
  cy: number;
  cz: number;
  w: number;
  h: number;
  d: number;
}

/** A flat quad (12 vertex coordinates), wound CCW seen from the outside. */
export interface FlatQuad {
  verts: readonly number[];
  nx: number;
  ny: number;
  nz: number;
}

/** How a building sits on its lot (world space, computed by buildBuildings). */
export interface Placement {
  width: number;
  depth: number;
  height: number;
  baseY: number;
  /** Unit street-facing direction in the XZ plane. */
  facing: { x: number; z: number };
  yaw: number;
  /** World-space axis-aligned bounding box of the building footprint. */
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
  center: { x: number; y: number; z: number };
}

/** Per-building detail tallies used by the tests and the scene registry. */
export interface BuildingDetailCounts {
  windows: number;
  windowPanes: number;
  floors: number;
  fireEscapes: number;
  cornices: number;
  chimneys: number;
  waterTowers: number;
  acUnits: number;
  antennas: number;
  solarPanels: number;
  windTurbines: number;
  planters: number;
  setbackLevels: number;
  awnings: number;
  stoops: number;
  mullions: number;
  wearPatches: number;
  sootBands: number;
  rustStreaks: number;
  roofStructures: number;
}

/** Machine-readable description of one built building. */
export interface BuildingDescriptor {
  eraId: EraId;
  lotId: string;
  archetype: string;
  style: string;
  windowStyle: string;
  roofStyle: string;
  facadeMaterial: string;
  /** Palette facade tokens actually used (theme sensitivity). */
  facadeHex: string[];
  /** Night emissive token derived from the theme glow. */
  emissiveHex: string;
  placement: Placement;
  details: BuildingDetailCounts;
  wearLevel: number;
  meshCount: number;
  materialCount: number;
}

/** A building group plus its descriptor, as returned by an archetype builder. */
export interface BuiltBuilding {
  group: THREE.Group;
  descriptor: BuildingDescriptor;
}

/** Per-build graph stats (mesh & shared-material budget). */
export interface PassStats {
  meshes: number;
  materials: number;
}

/** Everything an archetype builder needs to assemble one building. */
export interface BuildContext {
  eraId: EraId;
  spec: ResolvedEraBuilding;
  detail: EraBuildingDetail;
  materials: EraMaterials;
  rng: Rng;
  lot: BuildingLot;
  placement: Placement;
  geometry: GeometryCache;
  stats: PassStats;
}

/** Internal mutable tally for one building. */
interface MutableCounts {
  windows: number;
  windowPanes: number;
  floors: number;
  fireEscapes: number;
  cornices: number;
  chimneys: number;
  waterTowers: number;
  acUnits: number;
  antennas: number;
  solarPanels: number;
  windTurbines: number;
  planters: number;
  setbackLevels: number;
  awnings: number;
  stoops: number;
  mullions: number;
  wearPatches: number;
  sootBands: number;
  rustStreaks: number;
  roofStructures: number;
}

function emptyCounts(): MutableCounts {
  return {
    windows: 0,
    windowPanes: 0,
    floors: 0,
    fireEscapes: 0,
    cornices: 0,
    chimneys: 0,
    waterTowers: 0,
    acUnits: 0,
    antennas: 0,
    solarPanels: 0,
    windTurbines: 0,
    planters: 0,
    setbackLevels: 0,
    awnings: 0,
    stoops: 0,
    mullions: 0,
    wearPatches: 0,
    sootBands: 0,
    rustStreaks: 0,
    roofStructures: 0,
  };
}

// ============================================================================
// Geometry cache (shared primitives → bounded geometry count)
// ============================================================================

/** Caches exact-shape primitives so identical boxes share one BufferGeometry. */
export class GeometryCache {
  private readonly boxes = new Map<string, THREE.BoxGeometry>();
  private readonly cylinders = new Map<string, THREE.CylinderGeometry>();

  box(width: number, height: number, depth: number): THREE.BoxGeometry {
    const w = round3(width);
    const h = round3(height);
    const d = round3(depth);
    const key = `${w}x${h}x${d}`;
    let geometry = this.boxes.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(w, h, d);
      this.boxes.set(key, geometry);
    }
    return geometry;
  }

  cylinder(radiusTop: number, radiusBottom: number, height: number, segments = 8): THREE.CylinderGeometry {
    const key = `${round3(radiusTop)}:${round3(radiusBottom)}:${round3(height)}:${segments}`;
    let geometry = this.cylinders.get(key);
    if (!geometry) {
      geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
      this.cylinders.set(key, geometry);
    }
    return geometry;
  }

  dispose(): void {
    for (const geometry of this.boxes.values()) {
      geometry.dispose();
    }
    for (const geometry of this.cylinders.values()) {
      geometry.dispose();
    }
    this.boxes.clear();
    this.cylinders.clear();
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ============================================================================
// Merged BufferGeometry builders
// ============================================================================

/** Push one box (24 verts, 36 indices, correct outward normals) into arrays. */
function pushBoxFaces(positions: number[], normals: number[], indices: number[], box: BoxSpec): void {
  const x0 = box.cx - box.w / 2;
  const x1 = box.cx + box.w / 2;
  const y0 = box.cy - box.h / 2;
  const y1 = box.cy + box.h / 2;
  const z0 = box.cz - box.d / 2;
  const z1 = box.cz + box.d / 2;
  const faces: Array<{ n: readonly [number, number, number]; v: readonly number[] }> = [
    { n: [0, 0, 1], v: [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1] },
    { n: [0, 0, -1], v: [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0] },
    { n: [1, 0, 0], v: [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1] },
    { n: [-1, 0, 0], v: [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0] },
    { n: [0, 1, 0], v: [x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0] },
    { n: [0, -1, 0], v: [x1, y0, z1, x0, y0, z1, x0, y0, z0, x1, y0, z0] },
  ];
  const start = positions.length / 3;
  for (const face of faces) {
    positions.push(...face.v);
    const [nx, ny, nz] = face.n;
    for (let k = 0; k < 4; k += 1) {
      normals.push(nx, ny, nz);
    }
  }
  for (let f = 0; f < 6; f += 1) {
    const base = start + f * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/** Merge many axis-aligned boxes into a single BufferGeometry. */
function buildBoxesGeometry(boxes: readonly BoxSpec[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const box of boxes) {
    pushBoxFaces(positions, normals, indices, box);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

/** Merge many flat quads into a single BufferGeometry. */
function buildPlaneGeometry(quads: readonly FlatQuad[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const quad of quads) {
    const start = positions.length / 3;
    positions.push(...quad.verts);
    for (let k = 0; k < 4; k += 1) {
      normals.push(quad.nx, quad.ny, quad.nz);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

/** A flat rect in an XY plane at `z`; `facing` 1 = +Z face, -1 = -Z face. */
function frontQuad(cx: number, cy: number, w: number, h: number, z: number, facing: 1 | -1): FlatQuad {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  if (facing > 0) {
    return { verts: [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z], nx: 0, ny: 0, nz: 1 };
  }
  return { verts: [x1, y0, z, x0, y0, z, x0, y1, z, x1, y1, z], nx: 0, ny: 0, nz: -1 };
}

// ============================================================================
// Building assembler
// ============================================================================

/**
 * Accumulates meshes for one building, tracks geometry/detail counters and
 * reports the per-building material usage set (each material carries its
 * spec id as `name`). All meshes are added to `this.group` in local coords.
 */
export class BuildingAssembler {
  readonly group = new THREE.Group();
  readonly counts: MutableCounts = emptyCounts();
  readonly usedMaterials = new Set<string>();
  private readonly prefix: string;

  constructor(
    readonly ctx: BuildContext,
    lotLabel: string,
  ) {
    this.prefix = `${lotLabel}`;
    this.group.name = lotLabel;
  }

  addMesh(mesh: THREE.Mesh): void {
    mesh.name = `${this.prefix}-m${this.ctx.stats.meshes}`;
    this.ctx.stats.meshes += 1;
    const materialName = (mesh.material as THREE.MeshLambertMaterial | undefined)?.name;
    if (materialName) {
      this.usedMaterials.add(materialName);
    }
    this.group.add(mesh);
  }

  addBox(material: THREE.MeshLambertMaterial, box: BoxSpec): void {
    const mesh = new THREE.Mesh(this.ctx.geometry.box(box.w, box.h, box.d), material);
    mesh.position.set(box.cx, box.cy, box.cz);
    this.addMesh(mesh);
  }

  addMergedBoxes(material: THREE.MeshLambertMaterial, boxes: readonly BoxSpec[]): void {
    if (boxes.length === 0) {
      return;
    }
    this.addMesh(new THREE.Mesh(buildBoxesGeometry(boxes), material));
  }

  addPlaneQuads(material: THREE.MeshLambertMaterial, quads: readonly FlatQuad[]): void {
    if (quads.length === 0) {
      return;
    }
    this.addMesh(new THREE.Mesh(buildPlaneGeometry(quads), material));
  }

  addCylinder(material: THREE.MeshLambertMaterial, radius: number, height: number, segments = 8): void {
    const mesh = new THREE.Mesh(this.ctx.geometry.cylinder(radius, radius, height, segments), material);
    this.addMesh(mesh);
  }
}

// ============================================================================
// Shared detail helpers
// ============================================================================

/** Front-facade window grid; returns lit/unlit quads and tallies counts. */
interface WindowGridOptions {
  z: number;
  facing: 1 | -1;
  xFrom: number;
  xTo: number;
  yFrom: number;
  yTo: number;
  unitW: number;
  unitH: number;
  gapX: number;
  gapY: number;
  paneCols: number;
  paneRows: number;
  litChance: number;
  skipChance: number;
  paneGap?: number;
  protrude?: number;
}

function windowGrid(b: BuildingAssembler, opts: WindowGridOptions, lit: FlatQuad[], unlit: FlatQuad[]): void {
  const paneGap = opts.paneGap ?? 0.06;
  const protrude = opts.protrude ?? 0.03;
  const z = opts.z + (opts.facing > 0 ? protrude : -protrude);
  const paneW = (opts.unitW - (opts.paneCols + 1) * paneGap) / opts.paneCols;
  const paneH = (opts.unitH - (opts.paneRows + 1) * paneGap) / opts.paneRows;
  for (let cx = opts.xFrom + opts.unitW / 2; cx <= opts.xTo - opts.unitW / 2 + 1e-6; cx += opts.unitW + opts.gapX) {
    for (let cy = opts.yFrom + opts.unitH / 2; cy <= opts.yTo - opts.unitH / 2 + 1e-6; cy += opts.unitH + opts.gapY) {
      if (opts.skipChance > 0 && b.ctx.rng.chance(opts.skipChance)) {
        continue;
      }
      const target = b.ctx.rng.chance(opts.litChance) ? lit : unlit;
      b.counts.windows += 1;
      for (let pr = 0; pr < opts.paneRows; pr += 1) {
        const py = cy + (pr - (opts.paneRows - 1) / 2) * (paneH + paneGap);
        for (let pc = 0; pc < opts.paneCols; pc += 1) {
          const px = cx + (pc - (opts.paneCols - 1) / 2) * (paneW + paneGap);
          target.push(frontQuad(px, py, paneW, paneH, z, opts.facing));
          b.counts.windowPanes += 1;
        }
      }
    }
  }
}

/** Fire-escape zigzag along the +Z facade (1945; occasional 1965). */
function addFrontFireEscape(
  b: BuildingAssembler,
  x0: number,
  width: number,
  wallZ: number,
  yStart: number,
  topY: number,
  floorStep: number,
): void {
  b.counts.fireEscapes += 1;
  const platformW = width * 0.6;
  const depth = 1.5;
  const structure: BoxSpec[] = [];
  const rails: BoxSpec[] = [];
  let platformY = yStart;
  const maxY = topY - 0.5;
  let index = 0;
  const alt = (index: number) => (index % 2 === 0 ? 0 : platformW * 0.55);
  while (platformY < maxY && index < 9) {
    const ax = x0 + alt(index);
    structure.push({ cx: ax, cy: platformY, cz: wallZ + depth / 2, w: platformW, h: 0.12, d: depth });
    // side rails + front rail + vertical posts
    rails.push({ cx: ax - platformW / 2, cy: platformY + 0.35, cz: wallZ + depth / 2, w: 0.07, h: 0.7, d: depth });
    rails.push({ cx: ax + platformW / 2, cy: platformY + 0.35, cz: wallZ + depth / 2, w: 0.07, h: 0.7, d: depth });
    rails.push({ cx: ax, cy: platformY + 0.35, cz: wallZ + depth - 0.04, w: platformW, h: 0.07, d: 0.08 });
    // stair run down to the next platform
    const nextAlt = alt(index + 1);
    if (platformY + floorStep < maxY && index + 1 < 9) {
      for (let s = 1; s <= 3; s += 1) {
        const t = s / 4;
        const sx = x0 + alt(index) + (nextAlt - alt(index)) * t;
        structure.push({
          cx: sx,
          cy: platformY - floorStep * t + 0.15,
          cz: wallZ + depth / 2,
          w: 0.7,
          h: 0.14,
          d: depth * 0.9,
        });
      }
      // handrails along the stair axis
      for (let s = 1; s <= 3; s += 1) {
        const t = s / 4;
        const sx = x0 + alt(index) + (nextAlt - alt(index)) * t;
        rails.push({ cx: sx - 0.36, cy: platformY - floorStep * t + 0.55, cz: wallZ + depth / 2, w: 0.06, h: 0.06, d: depth });
        rails.push({ cx: sx + 0.36, cy: platformY - floorStep * t + 0.55, cz: wallZ + depth / 2, w: 0.06, h: 0.06, d: depth });
      }
    }
    platformY += floorStep;
    index += 1;
  }
  b.addMergedBoxes(b.ctx.materials.iron, structure);
  b.addMergedBoxes(b.ctx.materials.iron, rails);
}

/** War-era stoop: steps + handrail posts at the front wall. */
function addStoop(b: BuildingAssembler, cx: number, z: number, width: number): void {
  b.counts.stoops += 1;
  const steps: BoxSpec[] = [];
  for (let s = 0; s < 3; s += 1) {
    const w = width - s * 0.28;
    const d = 0.42 + s * 0.28;
    steps.push({ cx, cy: 0.11 + s * 0.16, cz: z - 0.05 + d / 2, w, h: 0.22, d });
  }
  steps.push({ cx, cy: 0.28, cz: z - 0.05, w: width + 0.2, h: 0.24, d: 0.5 });
  b.addMergedBoxes(b.ctx.materials.facadeC, steps);
  const rails: BoxSpec[] = [];
  for (const side of [-1, 1]) {
    for (let s = 0; s < 3; s += 1) {
      rails.push({ cx: cx + side * (width / 2 - 0.12), cy: 0.5 + s * 0.28, cz: z - 0.05 + 0.3, w: 0.07, h: 0.55 + s * 0.2, d: 0.07 });
    }
  }
  b.addMergedBoxes(b.ctx.materials.iron, rails);
}

/** Striped awning over a storefront: stepped slats, accent striped. */
function addAwning(b: BuildingAssembler, cx: number, wallZ: number, width: number, baseY: number): void {
  b.counts.awnings += 1;
  const slats: BoxSpec[] = [];
  const stripes: BoxSpec[] = [];
  for (let s = 0; s < 3; s += 1) {
    const d = 0.55 + s * 0.5;
    slats.push({ cx, cy: baseY + 0.5 - s * 0.22, cz: wallZ + d / 2 - 0.08, w: width * 0.86, h: 0.1, d: 0.5 });
  }
  const stripeCount = Math.max(3, Math.floor(width / 0.7));
  for (let i = 0; i < stripeCount; i += 1) {
    const stripeX = cx - width * 0.43 + i * (width * 0.86 / stripeCount);
    stripes.push({ cx: stripeX, cy: baseY + 0.5 - 0.22, cz: wallZ + 0.32, w: width * 0.86 / stripeCount * 0.75, h: 0.12, d: 0.72 });
  }
  b.addMergedBoxes(b.ctx.materials.awning, slats);
  b.addMergedBoxes(b.ctx.materials.awningDark, stripes);
}

/** Water tower: legs, tank drum and cone roof. */
function addWaterTower(b: BuildingAssembler, cx: number, cz: number, topY: number, scale = 1): void {
  b.counts.waterTowers += 1;
  const legs: BoxSpec[] = [];
  const half = 1.4 * scale;
  for (const sx of [-half, half]) {
    for (const sz of [-half, half]) {
      legs.push({ cx: cx + sx, cy: topY - 2.0 * scale, cz: cz + sz, w: 0.22, h: 2.2 * scale, d: 0.22 });
    }
  }
  b.addMergedBoxes(b.ctx.materials.iron, legs);
  b.addBox(b.ctx.materials.facadeC, { cx, cy: topY - 1.5 * scale, cz, w: 3.4 * scale, h: 2.4 * scale, d: 3.4 * scale });
  b.addBox(b.ctx.materials.roof, { cx, cy: topY - 0.25 * scale, cz, w: 2.5 * scale, h: 0.9 * scale, d: 2.5 * scale });
  b.addBox(b.ctx.materials.trimDark, { cx, cy: topY + 0.15 * scale, cz, w: 1.3 * scale, h: 0.6 * scale, d: 1.3 * scale });
}

/** Rooftop HVAC cluster: merged steel boxes. */
function addAcUnits(b: BuildingAssembler, count: number, cx: number, cz: number, topY: number): void {
  b.counts.acUnits += count;
  const boxes: BoxSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    boxes.push({
      cx: cx + (i % 3 - 1) * 1.6,
      cy: topY + 0.45,
      cz: cz + Math.floor(i / 3) * -1.6,
      w: 1.3,
      h: 0.9,
      d: 1.3,
    });
  }
  b.addMergedBoxes(b.ctx.materials.steelDark, boxes);
  const vents: BoxSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    vents.push({
      cx: cx + (i % 3 - 1) * 1.6,
      cy: topY + 0.85,
      cz: cz + Math.floor(i / 3) * -1.6,
      w: 0.35,
      h: 0.12,
      d: 1.0,
    });
  }
  b.addMergedBoxes(b.ctx.materials.turbine, vents);
}

/** Chimney stack + cap. */
function addChimney(b: BuildingAssembler, cx: number, cz: number, topY: number): void {
  b.counts.chimneys += 1;
  b.addBox(b.ctx.materials.facadeC, { cx, cy: topY + 0.9, cz, w: 0.9, h: 1.8, d: 0.9 });
  b.addBox(b.ctx.materials.trimDark, { cx, cy: topY + 1.85, cz, w: 1.15, h: 0.25, d: 1.15 });
}

/** Thin antenna mast. */
function addAntenna(b: BuildingAssembler, cx: number, cz: number, topY: number, height: number): void {
  b.counts.antennas += 1;
  const parts: BoxSpec[] = [
    { cx, cy: topY + height / 2, cz, w: 0.08, h: height, d: 0.08 },
    { cx, cy: topY + height * 0.72, cz, w: 0.7, h: 0.07, d: 0.07 },
    { cx, cy: topY + height * 0.9, cz, w: 0.45, h: 0.07, d: 0.07 },
  ];
  b.addMergedBoxes(b.ctx.materials.steel, parts);
}

/** Wind turbine: pole, nacelle and three rotating blades. */
function addWindTurbine(b: BuildingAssembler, cx: number, cz: number, baseY: number, hubHeight: number): void {
  b.counts.windTurbines += 1;
  const pole = new THREE.Mesh(b.ctx.geometry.cylinder(0.055, 0.055, hubHeight, 6), b.ctx.materials.turbine);
  pole.position.set(cx, baseY + hubHeight / 2, cz);
  b.addMesh(pole);
  b.addBox(b.ctx.materials.turbineDark, { cx, cy: baseY + hubHeight, cz, w: 0.48, h: 0.34, d: 0.4 });
  const bladeLen = 1.55;
  const hubY = baseY + hubHeight + 0.26;
  for (let i = 0; i < 3; i += 1) {
    const yaw = (i * Math.PI * 2) / 3;
    const blade = new THREE.Mesh(
      b.ctx.geometry.box(bladeLen, 0.12, 0.42),
      b.ctx.materials.turbine,
    );
    blade.position.set(cx + Math.cos(yaw) * bladeLen * 0.55, hubY + Math.sin(yaw) * bladeLen * 0.55, cz);
    blade.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw);
    b.addMesh(blade);
  }
  b.addBox(b.ctx.materials.turbineDark, { cx, cy: hubY, cz, w: 0.3, h: 0.18, d: 0.3 });
}

/** Solar array (rows x cols thin panels + frames) on a flat roof area. */
function addSolarArray(
  b: BuildingAssembler,
  rows: number,
  cols: number,
  cx: number,
  cz: number,
  topY: number,
  span: number,
): void {
  if (rows <= 0 || cols <= 0) {
    return;
  }
  const panelW = span / cols;
  const panelD = 1.1;
  const panels: BoxSpec[] = [];
  const frames: BoxSpec[] = [];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const px = cx - span / 2 + panelW * (c + 0.5);
      const pz = cz - ((rows - 1) * (panelD + 0.35)) / 2 + r * (panelD + 0.35);
      panels.push({ cx: px, cy: topY + 0.09, cz: pz, w: panelW * 0.88, h: 0.07, d: panelD * 0.9 });
      frames.push({ cx: px, cy: topY + 0.045, cz: pz, w: panelW, h: 0.04, d: panelD });
    }
  }
  b.addMergedBoxes(b.ctx.materials.solar, panels);
  b.addMergedBoxes(b.ctx.materials.solarFrame, frames);
  b.counts.solarPanels += rows * cols;
  b.counts.roofStructures += 1;
}

/** Per-era rooftop detail pass. */
function addRoofDetails(b: BuildingAssembler): void {
  const detail = b.ctx.detail;
  const roof = detail.roof;
  const H = b.ctx.placement.height;
  const D = b.ctx.placement.depth;
  const W = b.ctx.placement.width;
  const bodyD = D * detail.placement.bodyDepth;
  const cz = D / 2 - bodyD / 2;
  const rng = b.ctx.rng;

  if (roof.parapet) {
    b.addBox(b.ctx.materials.trim, { cx: 0, cy: H + 0.4, cz, w: W - 0.2, h: 0.8, d: bodyD - 0.2 });
  }
  if (roof.cornice) {
    b.addBox(b.ctx.materials.trimDark, { cx: 0, cy: H - 0.35, cz, w: W + 0.14, h: 0.7, d: bodyD + 0.14 });
    b.counts.cornices += 1;
  }
  for (let i = 0; i < roof.chimneys; i += 1) {
    if (rng.chance(0.6)) {
      addChimney(b, (rng.next() - 0.5) * W * 0.6, cz + (rng.next() - 0.5) * bodyD * 0.5, H - 0.2);
    }
  }
  for (let i = 0; i < roof.waterTowers; i += 1) {
    if (rng.chance(0.45)) {
      addWaterTower(b, (rng.next() - 0.5) * W * 0.6, cz + (rng.next() - 0.5) * bodyD * 0.5, H - 0.2, 0.9 + rng.next() * 0.3);
    }
  }
  if (roof.acUnits > 0) {
    addAcUnits(b, roof.acUnits, 0, cz - bodyD * 0.15, H - 0.4);
  }
  for (let i = 0; i < roof.antennas; i += 1) {
    addAntenna(b, (rng.next() - 0.5) * W * 0.7, cz - bodyD * 0.2 - (i % 2) * 1.2, H - 0.4, 4 + rng.next() * 3);
  }
  if (roof.greenRoof) {
    b.addBox(b.ctx.materials.roofGreen, { cx: 0, cy: H - 0.12, cz: cz - bodyD * 0.05, w: W * 0.72, h: 0.3, d: bodyD * 0.6 });
  }
  if (roof.solarRows > 0 && roof.solarCols > 0) {
    addSolarArray(b, roof.solarRows, Math.max(1, Math.floor(W / 1.6)), 0, cz - bodyD * 0.12, H - 0.35, Math.min(W * 0.6, 16));
  }
  for (let i = 0; i < roof.windTurbines; i += 1) {
    if (rng.chance(0.85)) {
      addWindTurbine(b, (i % 2 === 0 ? -1 : 1) * W * 0.28, cz - bodyD * 0.3 - i * 1.6, H - 0.3, 5.2 + i * 0.8);
    }
  }
  if (roof.spire) {
    b.counts.roofStructures += 1;
    const tip = new THREE.Mesh(b.ctx.geometry.box(0.1, 3.2, 0.1), b.ctx.materials.mullion);
    tip.position.set(W * 0.3, H + 1.9, cz - bodyD * 0.25);
    b.addMesh(tip);
    const led = new THREE.Mesh(b.ctx.geometry.box(0.22, 0.4, 0.22), b.ctx.materials.glassLit);
    led.position.set(W * 0.3, H + 3.5, cz - bodyD * 0.25);
    b.addMesh(led);
  }
}

/** Wear pass: soot bands, rust streaks and aged patches from shared materials. */
function addWear(b: BuildingAssembler): void {
  const detail = b.ctx.detail;
  const wear = detail.wear;
  const H = b.ctx.placement.height;
  const D = b.ctx.placement.depth;
  const W = b.ctx.placement.width;
  const wallZ = D / 2;
  const rng = b.ctx.rng;
  const sootQuads: FlatQuad[] = [];
  const patchQuads: FlatQuad[] = [];
  const rustBoxes: BoxSpec[] = [];

  const sootCount = rng.int(wear.sootBands[0], wear.sootBands[1]);
  for (let i = 0; i < sootCount; i += 1) {
    b.counts.sootBands += 1;
    const bandH = 0.32 + rng.next() * 0.3;
    const y = (i % 2 === 0 ? H - 1.4 : 0.5) + rng.next() * 0.3;
    sootQuads.push(frontQuad((rng.next() - 0.5) * W * 0.6, y, W * (0.35 + rng.next() * 0.4), bandH, wallZ, 1));
  }
  const patchCount = rng.int(wear.patches[0], wear.patches[1]);
  for (let i = 0; i < patchCount; i += 1) {
    b.counts.wearPatches += 1;
    patchQuads.push(
      frontQuad((rng.next() - 0.5) * W * 0.7, rng.range(1.2, H - 2.2), 1.1 + rng.next() * 1.4, 0.9 + rng.next() * 0.9, wallZ, 1),
    );
  }
  const rustCount = rng.int(wear.rustStreaks[0], wear.rustStreaks[1]);
  for (let i = 0; i < rustCount; i += 1) {
    b.counts.rustStreaks += 1;
    rustBoxes.push({
      cx: (rng.next() - 0.5) * W * 0.8,
      cy: rng.range(1.0, H - 3.0),
      cz: wallZ + 0.05,
      w: 0.12,
      h: rng.range(1.8, 4.2),
      d: 0.1,
    });
  }
  b.addPlaneQuads(b.ctx.materials.soot, sootQuads);
  b.addPlaneQuads(b.ctx.materials.facadeDark, patchQuads);
  b.addMergedBoxes(b.ctx.materials.rust, rustBoxes);
}

/** Ground-floor storefront treatment (historic only awnings/glass-block are era-flags). */
function addStorefront(b: BuildingAssembler, xFrom: number, xTo: number, wallZ: number, glassBlock: boolean, awnings: number): void {
  const z = wallZ + 0.03;
  const yBase = 0;
  const yTop = 3.1;
  const quads: FlatQuad[] = [];
  const door: FlatQuad[] = [];
  if (glassBlock) {
    const cell = 0.34;
    for (let x = xFrom + cell / 2; x <= xTo - cell / 2; x += cell) {
      for (let y = yBase + cell / 2; y <= yTop - cell / 2; y += cell) {
        quads.push(frontQuad(x, y, cell * 0.92, cell * 0.92, z, 1));
        b.counts.windowPanes += 1;
      }
    }
    b.counts.windows += Math.max(1, Math.floor((xTo - xFrom) / 3));
  } else {
    const unitW = 3.2;
    let unitIndex = 0;
    for (let cx = xFrom + unitW / 2; cx <= xTo - unitW / 2 + 1e-6; cx += unitW) {
      const isDoor = unitIndex % 3 === 1;
      if (isDoor) {
        door.push(frontQuad(cx, 1.55, 1.3, 2.5, z, 1));
        door.push(frontQuad(cx + 0.75, 1.55, 0.95, 2.5, z, 1));
        // door frame
        b.addBox(b.ctx.materials.steelDark, { cx, cy: 3.05, cz: wallZ + 0.05, w: 3.0, h: 0.18, d: 0.2 });
      } else {
        quads.push(frontQuad(cx - 0.85, 1.6, 1.6, 2.4, z, 1));
        quads.push(frontQuad(cx + 0.85, 1.6, 1.6, 2.4, z, 1));
        b.counts.windows += 2;
        b.counts.windowPanes += 2;
        // transom
        quads.push(frontQuad(cx, 2.95, 3.0, 0.45, z, 1));
        b.counts.windowPanes += 1;
      }
      unitIndex += 1;
    }
  }
  b.addPlaneQuads(b.ctx.materials.glassStorefront, quads);
  b.addPlaneQuads(b.ctx.materials.glassStorefront, door);
  for (let i = 0; i < awnings; i += 1) {
    const cx = xFrom + (i + 0.5) * ((xTo - xFrom) / Math.max(awnings, 1));
    addAwning(b, cx, wallZ, 3.1, yTop - 0.15);
  }
}

/** Living-wall planter bands (2025) plus ivy panels. */
function addLivingWall(b: BuildingAssembler, bands: number): void {
  if (bands <= 0) {
    return;
  }
  const H = b.ctx.placement.height;
  const W = b.ctx.placement.width;
  const D = b.ctx.placement.depth;
  const wallZ = D / 2;
  const boxes: BoxSpec[] = [];
  const ivy: FlatQuad[] = [];
  const bandGap = H / (bands + 1);
  for (let i = 1; i <= bands; i += 1) {
    const y = bandGap * i;
    boxes.push({ cx: 0, cy: y, cz: wallZ + 0.12, w: W + 0.5, h: 0.55, d: 0.6 });
    ivy.push(frontQuad(0, y - 0.62, W * 0.9, 0.5, wallZ + 0.02, 1));
    b.counts.planters += 1;
  }
  b.addMergedBoxes(b.ctx.materials.planter, boxes);
  b.addPlaneQuads(b.ctx.materials.planterDark, ivy);
}

// ============================================================================
// Archetype builders
// ============================================================================

function floorCount(height: number, floorH: number): number {
  return Math.max(1, Math.floor(height / floorH));
}

// ----------------------------------------------------------------------------
// 1945 — rowhouse / war-era facade
// ----------------------------------------------------------------------------
function buildRowhouse(b: BuildingAssembler): void {
  const { ctx } = b;
  const detail = ctx.detail;
  const p = ctx.placement;
  const D = p.depth;
  const W = p.width;
  const H = p.height;
  const bodyD = D * detail.placement.bodyDepth;
  const cz = D / 2 - bodyD / 2;
  const wallZ = D / 2;
  const rng = ctx.rng;
  const floors = floorCount(H, 3.1);
  b.counts.floors = floors;
  const residential = ctx.lot.zoning === 'residential';

  // Main brick body.
  b.addBox(ctx.materials.facadeA, { cx: 0, cy: H / 2, cz, w: W, h: H, d: bodyD });

  // Baseline cornice & parapet (detail.roof drives specifics).
  b.addBox(ctx.materials.trimDark, { cx: 0, cy: H - 0.35, cz, w: W + 0.14, h: 0.72, d: bodyD + 0.14 });
  b.counts.cornices += 1;
  b.addBox(ctx.materials.trim, { cx: 0, cy: H + 0.36, cz, w: W - 0.2, h: 0.72, d: bodyD - 0.2 });

  // Sandstone quoins at the building corners.
  const quoins: BoxSpec[] = [];
  for (const sx of [-1, 1]) {
    quoins.push({ cx: sx * W / 2, cy: H / 2, cz: wallZ - 0.05, w: 0.38, h: H, d: 0.38 });
  }
  b.addMergedBoxes(ctx.materials.trim, quoins);

  // Units split the frontage.
  const units = p.width < 18 ? 3 : p.width < 26 ? 4 : 5;
  const unitW = W / units;

  // Windows: double-hung above the storefront band.
  const lit: FlatQuad[] = [];
  const unlit: FlatQuad[] = [];
  const yFrom = residential ? 2.4 : 3.6;
  windowGrid(b, {
    z: wallZ,
    facing: 1,
    xFrom: -W / 2 + 0.5,
    xTo: W / 2 - 0.5,
    yFrom,
    yTo: H - 1.8,
    ...detail.windows,
    paneCols: 2,
    paneRows: 2,
    paneGap: 0.09,
    skipChance: 0.15,
  }, lit, unlit);
  b.addPlaneQuads(ctx.materials.glassLit, lit);
  b.addPlaneQuads(ctx.materials.glassDay, unlit);

  // Sills & lintels under each window unit (merged).
  const sills: BoxSpec[] = [];
  for (let cx = -W / 2 + 1.0; cx <= W / 2 - 1.0; cx += detail.windows.unitW + detail.windows.gapX) {
    for (let cy = yFrom + detail.windows.unitH / 2 + 1e-6; cy <= H - 1.8 - detail.windows.unitH / 2; cy += detail.windows.unitH + detail.windows.gapY) {
      if (rng.chance(0.15)) continue;
      sills.push({ cx, cy: cy - detail.windows.unitH / 2 - 0.1, cz: wallZ, w: detail.windows.unitW + 0.22, h: 0.2, d: 0.34 });
      sills.push({ cx, cy: cy + detail.windows.unitH / 2 + 0.1, cz: wallZ, w: detail.windows.unitW + 0.22, h: 0.14, d: 0.3 });
    }
  }
  b.addMergedBoxes(ctx.materials.trim, sills);

  // Storefront (commercial / mixed-use) or stooped residential front.
  if (!residential && detail.storefronts.enabled) {
    addStorefront(b, -W / 2 + 0.6, W / 2 - 0.6, wallZ, false, Math.min(detail.storefronts.awnings, units - 1));
    // Painted sign band under the cornice.
    const signs: FlatQuad[] = [];
    for (let u = 0; u < units; u += 1) {
      const cx = -W / 2 + (u + 0.5) * unitW;
      signs.push(frontQuad(cx, H - 1.6, unitW * 0.82, 0.8, wallZ + 0.02, 1));
    }
    b.addPlaneQuads(ctx.materials.glassLit, signs);
    b.counts.windows += units;
    b.counts.windowPanes += units;
  } else {
    for (let u = 0; u < units; u += 1) {
      addStoop(b, -W / 2 + (u + 0.5) * unitW, wallZ - 0.05, Math.min(unitW * 0.62, 1.9));
    }
  }

  // Fire escapes on the front of residential units.
  if (detail.fireEscapes.enabled && (residential || rng.chance(0.4))) {
    for (let u = 0; u < units; u += 1) {
      if (rng.chance(detail.fireEscapes.density)) {
        addFrontFireEscape(b, -W / 2 + (u + 0.25) * unitW, unitW * 0.5, wallZ, 2.8, H - 1.0, 3.1);
        break; // one escape per rowhouse row reads cleanest
      }
    }
  }

  addRoofDetails(b);
  addWear(b);
}

// ----------------------------------------------------------------------------
// 1965 — mid-century modern slab
// ----------------------------------------------------------------------------
function buildMidCentury(b: BuildingAssembler): void {
  const { ctx } = b;
  const detail = ctx.detail;
  const p = ctx.placement;
  const D = p.depth;
  const W = p.width;
  const H = p.height;
  const bodyD = D * detail.placement.bodyDepth;
  const cz = D / 2 - bodyD / 2;
  const wallZ = D / 2;
  const rng = ctx.rng;
  const floors = floorCount(H, 3.3);
  b.counts.floors = floors;
  const floorH = H / floors;

  b.addBox(ctx.materials.facadeB, { cx: 0, cy: H / 2, cz, w: W, h: H, d: bodyD });

  // Horizontal ribbon windows with spandrel bands.
  const lit: FlatQuad[] = [];
  const unlit: FlatQuad[] = [];
  windowGrid(b, {
    z: wallZ,
    facing: 1,
    xFrom: -W / 2 + 0.4,
    xTo: W / 2 - 0.4,
    yFrom: 2.2,
    yTo: H - 1.6,
    ...detail.windows,
    paneCols: 1,
    paneRows: 1,
    skipChance: 0.06,
  }, lit, unlit);
  b.addPlaneQuads(ctx.materials.glassLit, lit);
  b.addPlaneQuads(ctx.materials.glassDay, unlit);

  // Dark spandrel bands under each ribbon.
  const spandrels: BoxSpec[] = [];
  for (let y = 2.2 + detail.windows.unitH / 2; y <= H - 1.6; y += detail.windows.unitH + detail.windows.gapY) {
    spandrels.push({ cx: 0, cy: y - detail.windows.unitH / 2 - 0.28, cz: wallZ - 0.02, w: W * 0.9, h: 0.5, d: 0.22 });
  }
  b.addMergedBoxes(ctx.materials.spandrel, spandrels);

  // Accent banding strips between floors.
  const bands: BoxSpec[] = [];
  for (let f = 1; f < floors; f += 1) {
    bands.push({ cx: 0, cy: f * floorH - 0.28, cz, w: W - 0.4, h: 0.2, d: bodyD + 0.3 });
  }
  b.addMergedBoxes(ctx.materials.trim, bands);

  // Vertical fins on the facade.
  const fins: BoxSpec[] = [];
  const finSpacing = 3.4;
  for (let x = -W / 2 + finSpacing / 2; x <= W / 2 - finSpacing / 2; x += finSpacing) {
    fins.push({ cx: x, cy: H / 2, cz: wallZ - 0.3, w: 0.2, h: H, d: 0.34 });
  }
  b.addMergedBoxes(ctx.materials.facadeC, fins);

  // Pilotis entry canopy with lobby glass.
  const canopyW = Math.min(9, W * 0.36);
  b.addBox(ctx.materials.trim, { cx: 0, cy: 3.2, cz: wallZ + 1.1, w: canopyW, h: 0.32, d: 2.4 });
  const pilotis: BoxSpec[] = [];
  for (const sx of [-canopyW / 2 + 0.5, canopyW / 2 - 0.5]) {
    pilotis.push({ cx: sx, cy: 1.5, cz: wallZ + 0.9, w: 0.34, h: 3.1, d: 0.34 });
  }
  b.addMergedBoxes(ctx.materials.facadeC, pilotis);
  const lobby: FlatQuad[] = [];
  lobby.push(frontQuad(0, 1.6, canopyW * 0.7, 3.0, wallZ + 0.05, 1));
  b.addPlaneQuads(ctx.materials.glassStorefront, lobby);
  b.counts.windows += 4;
  b.counts.windowPanes += 4;

  // Occasional side fire escape balconies.
  if (detail.fireEscapes.enabled && rng.chance(detail.fireEscapes.density * 0.6) && !detail.storefronts.enabled) {
    addFrontFireEscape(b, W * 0.32, W * 0.24, wallZ, 2.8, H - 1.2, 3.2);
  }

  addRoofDetails(b);
  addWear(b);
}

// ----------------------------------------------------------------------------
// 1985 — concrete / glass block
// ----------------------------------------------------------------------------
function buildConcreteGlass(b: BuildingAssembler): void {
  const { ctx } = b;
  const detail = ctx.detail;
  const p = ctx.placement;
  const D = p.depth;
  const W = p.width;
  const H = p.height;
  const floors = floorCount(H, 3.4);
  b.counts.floors = floors;

  // Setback stacks.
  const levels = computeSetbacks(b);
  const baseH = levels > 0 ? H - levels * 3.4 : H;
  const bodyD = D * detail.placement.bodyDepth;
  b.addBox(ctx.materials.concrete, { cx: 0, cy: baseH / 2, cz: D / 2 - bodyD / 2, w: W, h: baseH, d: bodyD });

  let tierH = baseH;
  let tierW = W;
  for (let level = 1; level <= levels; level += 1) {
    const inset = level * detail.setbacks.stepIn;
    const h = 3.4;
    b.addBox(ctx.materials.concrete, {
      cx: 0,
      cy: tierH + h / 2,
      cz: D / 2 - bodyD / 2 + inset * 0.4,
      w: Math.max(6, tierW - inset * 2),
      h,
      d: Math.max(6, bodyD - inset),
    });
    tierW = Math.max(6, tierW - inset * 2);
    tierH += h;
  }

  const wallZ = D / 2;
  // Tinted glass with brise-soleil fins.
  const lit: FlatQuad[] = [];
  const unlit: FlatQuad[] = [];
  windowGrid(b, {
    z: wallZ,
    facing: 1,
    xFrom: -W / 2 + 0.8,
    xTo: W / 2 - 0.8,
    yFrom: 3.4,
    yTo: H - 2.0,
    ...detail.windows,
    paneCols: 1,
    paneRows: 2,
    skipChance: 0.1,
  }, lit, unlit);
  b.addPlaneQuads(ctx.materials.glassLit, lit);
  b.addPlaneQuads(ctx.materials.glassDay, unlit);

  // Concrete spandrel bands between floors.
  const spandrels: BoxSpec[] = [];
  for (let y = 3.4 + detail.windows.unitH / 2; y <= H - 2.0; y += detail.windows.unitH + detail.windows.gapY) {
    spandrels.push({ cx: 0, cy: y - detail.windows.unitH / 2 - 0.35, cz: wallZ - 0.02, w: W * 0.9, h: 0.55, d: 0.24 });
  }
  b.addMergedBoxes(ctx.materials.concrete, spandrels);

  // Brise-soleil horizontal fins in front of the glass.
  if (detail.facade.briseSoleil) {
    const fins: BoxSpec[] = [];
    for (let y = 3.4 + detail.windows.unitH / 2; y <= H - 2.0; y += detail.windows.unitH + detail.windows.gapY) {
      for (let x = -W / 2 + 1.6; x <= W / 2 - 1.6; x += 3.2) {
        fins.push({ cx: x, cy: y, cz: wallZ + 0.42, w: 2.9, h: 0.14, d: 0.55 });
      }
    }
    b.addMergedBoxes(ctx.materials.facadeC, fins);
  }

  // Glass-block ground band.
  if (detail.storefronts.glassBlock) {
    addStorefront(b, -W / 2 + 0.8, W / 2 - 0.8, wallZ, true, 0);
  }

  addRoofDetails(b);
  addWear(b);
}

// ----------------------------------------------------------------------------
// 2005 — glass-and-steel mid-rise
// ----------------------------------------------------------------------------
function buildGlassSteel(b: BuildingAssembler): void {
  const { ctx } = b;
  const detail = ctx.detail;
  const p = ctx.placement;
  const D = p.depth;
  const W = p.width;
  const H = p.height;
  const floors = floorCount(H, 3.6);
  b.counts.floors = floors;

  const levels = computeSetbacks(b);
  const baseH = levels > 0 ? H - levels * 3.6 : H;
  const bodyD = D * detail.placement.bodyDepth;
  b.addBox(ctx.materials.facadeB, { cx: 0, cy: baseH / 2, cz: D / 2 - bodyD / 2, w: W, h: baseH, d: bodyD });

  let tierH = baseH;
  let tierW = W;
  for (let level = 1; level <= levels; level += 1) {
    const inset = level * detail.setbacks.stepIn;
    const h = 3.6;
    b.addBox(ctx.materials.facadeB, {
      cx: 0,
      cy: tierH + h / 2,
      cz: D / 2 - bodyD / 2 + inset * 0.4,
      w: Math.max(6, tierW - inset * 2),
      h,
      d: Math.max(6, bodyD - inset),
    });
    tierW = Math.max(6, tierW - inset * 2);
    tierH += h;
  }

  const wallZ = D / 2;
  // Curtain wall.
  const lit: FlatQuad[] = [];
  const unlit: FlatQuad[] = [];
  windowGrid(b, {
    z: wallZ,
    facing: 1,
    xFrom: -W / 2 + 0.4,
    xTo: W / 2 - 0.4,
    yFrom: 2.2,
    yTo: H - 1.4,
    ...detail.windows,
    paneCols: 1,
    paneRows: 1,
    skipChance: 0.02,
  }, lit, unlit);
  b.addPlaneQuads(ctx.materials.glassLit, lit);
  b.addPlaneQuads(ctx.materials.glassDay, unlit);

  // Steel mullion grid.
  if (detail.windows.mullions) {
    const mullions: BoxSpec[] = [];
    for (let x = -W / 2 + 1.6; x <= W / 2 - 1.6; x += detail.windows.unitW + detail.windows.gapX) {
      mullions.push({ cx: x, cy: H / 2, cz: wallZ + 0.08, w: 0.09, h: H, d: 0.12 });
      b.counts.mullions += 1;
    }
    for (let y = 2.2 + detail.windows.unitH / 2; y <= H - 1.4; y += detail.windows.unitH + detail.windows.gapY) {
      mullions.push({ cx: 0, cy: y, cz: wallZ + 0.08, w: W, h: 0.09, d: 0.12 });
    }
    b.addMergedBoxes(ctx.materials.mullion, mullions);
  }

  // Spandrel bands.
  const spandrels: FlatQuad[] = [];
  for (let y = 2.2 + detail.windows.unitH / 2; y <= H - 1.4; y += detail.windows.unitH + detail.windows.gapY) {
    spandrels.push(frontQuad(0, y - detail.windows.unitH / 2 - 0.2, W * 0.94, 0.34, wallZ + 0.01, 1));
  }
  b.addPlaneQuads(ctx.materials.spandrel, spandrels);

  // Steel base + glass lobby.
  b.addBox(ctx.materials.steel, { cx: 0, cy: 0.75, cz: D / 2 - bodyD / 2, w: W + 0.3, h: 1.5, d: bodyD + 0.3 });
  addStorefront(b, -W / 2 + 0.8, W / 2 - 0.8, wallZ, false, 0);

  addRoofDetails(b);
  addWear(b);
}

// ----------------------------------------------------------------------------
// 2025 — green tower
// ----------------------------------------------------------------------------
function buildGreenTower(b: BuildingAssembler): void {
  const { ctx } = b;
  const detail = ctx.detail;
  const p = ctx.placement;
  const D = p.depth;
  const W = p.width;
  const H = p.height;
  const floors = floorCount(H, 3.8);
  b.counts.floors = floors;

  const levels = computeSetbacks(b);
  const baseH = levels > 0 ? H - levels * 3.8 : H;
  const bodyD = D * detail.placement.bodyDepth;
  b.addBox(ctx.materials.facadeA, { cx: 0, cy: baseH / 2, cz: D / 2 - bodyD / 2, w: W, h: baseH, d: bodyD });

  let tierH = baseH;
  let tierW = W;
  for (let level = 1; level <= levels; level += 1) {
    const inset = level * detail.setbacks.stepIn;
    const h = 3.8;
    b.addBox(ctx.materials.facadeA, {
      cx: 0,
      cy: tierH + h / 2,
      cz: D / 2 - bodyD / 2 + inset * 0.4,
      w: Math.max(7, tierW - inset * 2),
      h,
      d: Math.max(7, bodyD - inset),
    });
    tierW = Math.max(7, tierW - inset * 2);
    tierH += h;
  }

  const wallZ = D / 2;
  // Triple-glazed green curtain wall.
  const lit: FlatQuad[] = [];
  const unlit: FlatQuad[] = [];
  windowGrid(b, {
    z: wallZ,
    facing: 1,
    xFrom: -W / 2 + 0.3,
    xTo: W / 2 - 0.3,
    yFrom: 2.2,
    yTo: H - 1.4,
    ...detail.windows,
    paneCols: 1,
    paneRows: 1,
    skipChance: 0.01,
  }, lit, unlit);
  b.addPlaneQuads(ctx.materials.glassLit, lit);
  b.addPlaneQuads(ctx.materials.glassDay, unlit);

  // Green vertical fins.
  if (detail.facade.verticalFins) {
    const fins: BoxSpec[] = [];
    for (let x = -W / 2 + 2.0; x <= W / 2 - 2.0; x += 2.9) {
      fins.push({ cx: x, cy: H / 2, cz: wallZ - 0.25, w: 0.34, h: H, d: 0.4 });
    }
    b.addMergedBoxes(ctx.materials.planter, fins);
  }

  // Mullion grid.
  if (detail.windows.mullions) {
    const mullions: BoxSpec[] = [];
    for (let x = -W / 2 + 1.7; x <= W / 2 - 1.7; x += detail.windows.unitW + detail.windows.gapX) {
      mullions.push({ cx: x, cy: H / 2, cz: wallZ + 0.08, w: 0.08, h: H, d: 0.1 });
      b.counts.mullions += 1;
    }
    for (let y = 2.2 + detail.windows.unitH / 2; y <= H - 1.4; y += detail.windows.unitH + detail.windows.gapY) {
      mullions.push({ cx: 0, cy: y, cz: wallZ + 0.08, w: W, h: 0.08, d: 0.1 });
    }
    b.addMergedBoxes(ctx.materials.mullion, mullions);
  }

  // Living walls.
  addLivingWall(b, Math.min(detail.roof.planterBands, Math.max(0, floors - 3)));

  // Green storefront.
  addStorefront(b, -W / 2 + 0.8, W / 2 - 0.8, wallZ, false, 0);

  addRoofDetails(b);
  addWear(b);
}

/** Compute and tally setback levels for tall-era buildings. */
function computeSetbacks(b: BuildingAssembler): number {
  const detail = b.ctx.detail;
  const H = b.ctx.placement.height;
  if (!detail.setbacks.enabled || H < detail.setbacks.minHeight) {
    return 0;
  }
  const levels = Math.min(
    detail.setbacks.maxLevels,
    Math.max(1, Math.floor((H - detail.setbacks.minHeight) / 14) + 1),
  );
  b.counts.setbackLevels = levels;
  return levels;
}

// ============================================================================
// Dispatch
// ============================================================================

const ARCHETYPE_BUILDERS: Record<string, (b: BuildingAssembler) => void> = {
  rowhouse: buildRowhouse,
  'mid-century-slab': buildMidCentury,
  'concrete-glass-block': buildConcreteGlass,
  'glass-steel-midrise': buildGlassSteel,
  'green-tower': buildGreenTower,
};

/**
 * Build one lot's building using the context's archetype. Returns the group
 * (local frame — street facade on local +Z) and a full descriptor.
 */
export function buildBuildingForLot(ctx: BuildContext): BuiltBuilding {
  const builder = ARCHETYPE_BUILDERS[ctx.detail.archetype];
  if (!builder) {
    throw new Error(`buildBuildingForLot: unknown archetype "${ctx.detail.archetype}"`);
  }
  const label = `${ctx.lot.id}-${ctx.detail.style}`;
  const b = new BuildingAssembler(ctx, label);
  const meshesBefore = ctx.stats.meshes;
  b.counts.floors = 1;
  builder(b);

  const details: BuildingDetailCounts = {
    windows: b.counts.windows,
    windowPanes: b.counts.windowPanes,
    floors: b.counts.floors,
    fireEscapes: b.counts.fireEscapes,
    cornices: b.counts.cornices,
    chimneys: b.counts.chimneys,
    waterTowers: b.counts.waterTowers,
    acUnits: b.counts.acUnits,
    antennas: b.counts.antennas,
    solarPanels: b.counts.solarPanels,
    windTurbines: b.counts.windTurbines,
    planters: b.counts.planters,
    setbackLevels: b.counts.setbackLevels,
    awnings: b.counts.awnings,
    stoops: b.counts.stoops,
    mullions: b.counts.mullions,
    wearPatches: b.counts.wearPatches,
    sootBands: b.counts.sootBands,
    rustStreaks: b.counts.rustStreaks,
    roofStructures:
      b.counts.chimneys +
      b.counts.waterTowers +
      b.counts.acUnits +
      b.counts.antennas +
      b.counts.windTurbines +
      (ctx.detail.roof.greenRoof ? 1 : 0) +
      (ctx.detail.roof.spire ? 1 : 0) +
      (b.counts.solarPanels > 0 ? 1 : 0),
  };

  const descriptor: BuildingDescriptor = {
    eraId: ctx.eraId,
    lotId: ctx.lot.id,
    archetype: ctx.detail.archetype,
    style: ctx.detail.style,
    windowStyle: ctx.spec.buildings.windowStyle,
    roofStyle: ctx.spec.buildings.roofStyle,
    facadeMaterial: ctx.spec.buildings.facadeMaterial,
    facadeHex: [...ctx.spec.palette.facadeMaterials],
    emissiveHex: ctx.detail.glow.interior,
    placement: ctx.placement,
    details,
    wearLevel: round3(clamp(ctx.rng.range(ctx.detail.wear.levelBand[0], ctx.detail.wear.levelBand[1]), 0, 1)),
    meshCount: ctx.stats.meshes - meshesBefore,
    materialCount: b.usedMaterials.size,
  };

  b.group.userData = { kind: 'building', descriptor };
  return { group: b.group, descriptor };
}