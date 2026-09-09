/**
 * Procedural building factory: turns one `BuildingPlot` footprint plus the
 * shared `BuildingsEraSpec`/era-data into a single **merged** building mesh
 * (one BoxGeometry, per-face materials) with **instanced** emissive window
 * geometry (one PlaneGeometry unit, many InstancedMesh copies per face) and
 * era roof props (water tower → AC units → antennas → satellite dishes →
 * solar/green).
 *
 * Design notes
 * ------------
 * - **Merged geometry** — the whole building body is ONE `BufferGeometry`
 *   (a `BoxGeometry`). No per-window boxes; no per-face meshes.
 * - **Instanced windows** — each facade's windows are `InstancedMesh` copies
 *   of a single unit quad. Lit windows share an emissive `MeshLambertMaterial`
 *   (bloom-friendly `emissiveIntensity`); unlit windows share a dark glass
 *   material with zero emissive. Instance colors modulate each copy so lit
 *   quads read warm and dim quads read as dark glass.
 * - **Layout-anchored** — sizes come from the plot footprint and seeded
 *   height range; this module never imports signage, vehicle, or pedestrian
 *   code.
 */

import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
} from 'three';
import type { BuildingsEraData, RoofPropKind } from './buildingEraData';
import { buildingEraData } from './buildingEraData';
import type { BuildingsEraSpec } from '../../../era/types';
import { easeInOut, lerpColor, lerpNumber } from '../../../era/transition';
import type { BuildingPlot } from '../../layout/types';
import {
  createFacadeTexture,
  createRoofTexture,
  type ProceduralTexture,
} from './facadeTextures';

/* ------------------------------------------------------------------ */
/* Era look-up                                                         */
/* ------------------------------------------------------------------ */

/** Returns the era-data object for a given era id (throws on unknown ids). */
export function getEraData(eraId: string): BuildingsEraData {
  const data = (buildingEraData as Record<string, BuildingsEraData | undefined>)[eraId];
  if (!data) {
    throw new Error(`buildings: unknown era "${eraId}"`);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Deterministic PRNG (mirrors the layout module's mulberry32)         */
/* ------------------------------------------------------------------ */

/** Deterministic mulberry32 seeded from a string; returns [0,1) per call. */
export function createBuildingRng(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Interpolated era style                                              */
/* ------------------------------------------------------------------ */

export interface InterpolatedBuildingStyle {
  /** Lerped representative facade palette color (tints the facade texture). */
  facadeColor: string;
  frameColor: string;
  emissiveColor: string;
  illuminationRate: number;
  heightScale: number;
  /** True when the segment's target era uses a curtain window layout. */
  curtain: boolean;
}

/** Deterministically picks the idx-th palette color of an era spec. */
function paletteColor(spec: BuildingsEraSpec, idx: number): string {
  const palette = spec.facadePalette;
  return palette[Math.abs(idx) % palette.length];
}

/**
 * Interpolates building-style fields between two era ids at eased `t`.
 * Pure + deterministic — no THREE or DOM — so tests can assert the lerp
 * directly.
 */
export function interpolateBuildingStyle(
  fromEra: string,
  toEra: string,
  t: number,
): InterpolatedBuildingStyle {
  const fromSpec = getEraData(fromEra).spec;
  const toSpec = getEraData(toEra).spec;
  const eased = easeInOut(t);
  const fromColor = paletteColor(fromSpec, Math.floor(eased * 4));
  const toColor = paletteColor(toSpec, Math.floor(eased * 4));

  return {
    facadeColor: lerpColor(fromColor, toColor, eased),
    frameColor: lerpColor(fromSpec.frameColor, toSpec.frameColor, eased),
    emissiveColor: lerpColor(
      fromSpec.windowEmissiveColor,
      toSpec.windowEmissiveColor,
      eased,
    ),
    illuminationRate: lerpNumber(
      fromSpec.windowIlluminationRate,
      toSpec.windowIlluminationRate,
      eased,
    ),
    heightScale: lerpNumber(fromSpec.heightScale, toSpec.heightScale, eased),
    curtain:
      eased >= 0.5 ? toSpec.roofStyle !== 'mansard' : fromSpec.roofStyle !== 'mansard',
  };
}

/**
 * Returns the per-plot building height at a given height scale. Heights stay
 * inside the plot's seeded `heightRange` (the layout's own envelope for the
 * building system) scaled by the era heightScale.
 */
export function buildingHeightFor(
  plot: BuildingPlot,
  heightScale: number,
  seed: string,
): number {
  const rng = createBuildingRng(`${seed}:height:${plot.id}`);
  const base = plot.heightRange.min + rng() * (plot.heightRange.max - plot.heightRange.min);
  return base * heightScale;
}

/* ------------------------------------------------------------------ */
/* Window grid + instance helpers                                      */
/* ------------------------------------------------------------------ */

export interface WindowGrid {
  columns: number;
  rows: number;
  windowWidth: number;
  windowHeight: number;
}

/** Computes a window grid for a face so windows stay comfortably sized. */
export function windowGridFor(
  faceWidth: number,
  faceHeight: number,
): WindowGrid {
  const columns = Math.max(2, Math.round(faceWidth / 2.4));
  const rows = Math.max(2, Math.round(faceHeight / 3.1));
  const cellW = faceWidth / columns;
  const cellH = faceHeight / rows;
  return {
    columns,
    rows,
    windowWidth: cellW * 0.68,
    windowHeight: cellH * 0.7,
  };
}

/** True when a given seeded window index should be lit at `rate`. */
export function windowIsLit(seed: string, index: number, rate: number): boolean {
  const rng = createBuildingRng(`${seed}:lit:${index}`);
  return rng() < rate;
}

interface FaceWindowPlan {
  /** Face outward normal in local (plot-origin) space. */
  normal: Vector3;
  /** Unit axis across the face (local space). */
  across: Vector3;
  /** Anchor point: bottom corner of the face at the plot origin. */
  anchor: Vector3;
  /** Distance across the face (window columns direction). */
  acrossLength: number;
  /** Distance up the face (window rows direction). */
  upLength: number;
}

function localFacePlans(plot: BuildingPlot, height: number): FaceWindowPlan[] {
  const fp = plot.footprint;
  const w = fp.maxX - fp.minX;
  const d = fp.maxZ - fp.minZ;
  const northSouth = plot.frontageStreet === 'streetA'; // street A runs along +x

  const faces: FaceWindowPlan[] = [];
  if (northSouth) {
    faces.push(
      // front (street-facing, -z)
      { normal: new Vector3(0, 0, -1), across: new Vector3(1, 0, 0), anchor: new Vector3(fp.minX, 0, fp.minZ), acrossLength: w, upLength: height },
      // back (+z)
      { normal: new Vector3(0, 0, 1), across: new Vector3(-1, 0, 0), anchor: new Vector3(fp.maxX, 0, fp.maxZ), acrossLength: w, upLength: height },
      // east (+x)
      { normal: new Vector3(1, 0, 0), across: new Vector3(0, 0, 1), anchor: new Vector3(fp.maxX, 0, fp.minZ), acrossLength: d, upLength: height },
      // west (-x)
      { normal: new Vector3(-1, 0, 0), across: new Vector3(0, 0, -1), anchor: new Vector3(fp.minX, 0, fp.maxZ), acrossLength: d, upLength: height },
    );
  } else {
    faces.push(
      // front (street-facing, -x)
      { normal: new Vector3(-1, 0, 0), across: new Vector3(0, 0, 1), anchor: new Vector3(fp.minX, 0, fp.minZ), acrossLength: d, upLength: height },
      // back (+x)
      { normal: new Vector3(1, 0, 0), across: new Vector3(0, 0, -1), anchor: new Vector3(fp.maxX, 0, fp.maxZ), acrossLength: d, upLength: height },
      // south (+z)
      { normal: new Vector3(0, 0, 1), across: new Vector3(-1, 0, 0), anchor: new Vector3(fp.maxX, 0, fp.maxZ), acrossLength: w, upLength: height },
      // north (-z)
      { normal: new Vector3(0, 0, -1), across: new Vector3(1, 0, 0), anchor: new Vector3(fp.minX, 0, fp.minZ), acrossLength: w, upLength: height },
    );
  }
  return faces;
}

/** Rotation around Y that orients a +Z-facing unit plane to `normal`. */
function rotationYForFace(normal: Vector3): number {
  return Math.atan2(normal.x, normal.z);
}

/**
 * Creates one InstancedMesh per face, splitting windows into a lit (emissive)
 * set and an unlit (dark glass) set. Window positions are authored in the
 * building's local frame (X/Z centered on the plot, Y from ground to roof).
 */
export function createWindowInstancesFor(
  plot: BuildingPlot,
  era: BuildingsEraData,
  style: InterpolatedBuildingStyle,
  height: number,
  seed: string,
): { meshes: InstancedMesh[]; materials: Material[]; litMaterial: MeshLambertMaterial } {
  void era; // window layout is driven by style/illumination, not era object
  const meshes: InstancedMesh[] = [];
  const materials: Material[] = [];

  const litMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    emissive: style.emissiveColor,
    emissiveIntensity: 1.6,
  });
  const dimMaterial = new MeshLambertMaterial({
    color: 0x1c2733,
    emissive: 0x000000,
    emissiveIntensity: 1.0,
  });
  materials.push(litMaterial, dimMaterial);

  const fp = plot.footprint;
  const w = fp.maxX - fp.minX;
  const d = fp.maxZ - fp.minZ;
  const faces = localFacePlans(plot, height);
  const litInstances: Vector3[][] = [];
  const dimInstances: Vector3[][] = [];

  for (const face of faces) {
    const grid = windowGridFor(face.acrossLength, face.upLength);
    const litPos: Vector3[] = [];
    const dimPos: Vector3[] = [];
    let index = 0;
    for (let r = 0; r < grid.rows; r += 1) {
      for (let c = 0; c < grid.columns; c += 1) {
        const u = (c + 0.5) * (face.acrossLength / grid.columns);
        const v = (r + 0.5) * (face.upLength / grid.rows);
        const pos = face.anchor
          .clone()
          .addScaledVector(face.across, u)
          .addScaledVector(Vector3_UP, v)
          .addScaledVector(face.normal, 0.045);
        // Recenter to the building-local frame (plot center).
        pos.x -= fp.minX + w / 2;
        pos.z -= fp.minZ + d / 2;
        if (windowIsLit(seed, index, style.illuminationRate)) {
          litPos.push(pos);
        } else {
          dimPos.push(pos);
        }
        index += 1;
      }
    }
    litInstances.push(litPos);
    dimInstances.push(dimPos);
  }

  for (let f = 0; f < faces.length; f += 1) {
    const face = faces[f];
    const rotY = rotationYForFace(face.normal);
    const grid = windowGridFor(face.acrossLength, face.upLength);

    if (litInstances[f].length > 0) {
      const mesh = buildInstanceSet(
        grid.windowWidth,
        grid.windowHeight,
        litMaterial,
        rotY,
        litInstances[f],
        `${seed}:win-lit:${f}`,
        0xfff3c4,
      );
      mesh.name = `building-${plot.id}-windows-lit-${f}`;
      meshes.push(mesh);
    }
    if (dimInstances[f].length > 0) {
      const mesh = buildInstanceSet(
        grid.windowWidth,
        grid.windowHeight,
        dimMaterial,
        rotY,
        dimInstances[f],
        `${seed}:win-dim:${f}`,
        0x2a3442,
      );
      mesh.name = `building-${plot.id}-windows-dim-${f}`;
      meshes.push(mesh);
    }
  }

  return { meshes, materials, litMaterial };
}

const Vector3_UP = new Vector3(0, 1, 0);
const Vector3_ONE = new Vector3(1, 1, 1);

/** Builds an InstancedMesh of `count` unit quads at the given positions. */
function buildInstanceSet(
  windowWidth: number,
  windowHeight: number,
  material: Material,
  rotationY: number,
  positions: Vector3[],
  seed: string,
  instanceColor: number,
): InstancedMesh {
  const unit = new PlaneGeometry(windowWidth, windowHeight);
  const instanced = new InstancedMesh(unit, material, positions.length);
  instanced.name = seed;

  const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotationY);
  const matrix = new Matrix4();
  for (let i = 0; i < positions.length; i += 1) {
    matrix.compose(positions[i], quat, Vector3_ONE);
    instanced.setMatrixAt(i, matrix);
  }
  instanced.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < positions.length; i += 1) {
    instanced.setColorAt(i, new Color(instanceColor));
  }
  instanced.instanceColor!.needsUpdate = true;

  return instanced;
}

/* ------------------------------------------------------------------ */
/* Roof props                                                          */
/* ------------------------------------------------------------------ */

export interface RoofPropPlan {
  propKind: RoofPropKind;
  group: Group;
  materials: Material[];
}

function addRoofBox(
  group: Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: Material,
  name: string,
): Mesh {
  const geometry = new BoxGeometry(w, h, d);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y + h / 2, z);
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

/**
 * Builds the era roof props for a building. `roofY` is the local height of
 * the roof deck (in the building-local frame where X/Z are centered on the
 * plot). Props appear as separate small meshes inside `group` so the system
 * can dissolve them across eras.
 */
export function buildRoofProps(
  group: Group,
  era: BuildingsEraData,
  footprintSize: { width: number; depth: number },
  roofY: number,
  seed: string,
): RoofPropPlan {
  const rng = createBuildingRng(seed);
  const w = footprintSize.width;
  const d = footprintSize.depth;
  const propKind = era.roofProp;
  const materials: Material[] = [];

  const metal = new MeshLambertMaterial({ color: 0x667085, emissive: 0x000000 });
  materials.push(metal);

  if (propKind === 'water_tower') {
    // 1945: elevated wooden/steel tank with four legs.
    const tankW = Math.min(1.8, w * 0.55);
    const tankD = Math.min(1.8, d * 0.6);
    const towerH = 1.7;
    const drum = new Mesh(new BoxGeometry(tankW, 1.4, tankD), metal);
    drum.position.set(0, roofY + towerH + 0.7, 0);
    drum.name = 'roof-prop-water-tower';
    group.add(drum);
    const tankTop = new Mesh(new BoxGeometry(tankW * 0.9, 0.5, tankD * 0.9), metal);
    tankTop.position.set(0, roofY + towerH + 0.7 + 1.4, 0);
    tankTop.name = 'roof-prop-water-tank-lid';
    group.add(tankTop);
    for (let i = 0; i < 4; i += 1) {
      const lx = (i % 2 === 0 ? -1 : 1) * tankW * 0.5;
      const lz = (i < 2 ? -1 : 1) * tankD * 0.5;
      addRoofBox(group, lx, roofY, lz, 0.16, towerH, 0.16, metal, `roof-prop-leg-${i}`);
    }
    return { propKind, group, materials };
  }

  if (propKind === 'ac_units' || (propKind === 'none' && era.spec.roofStyle === 'flat_ac_units')) {
    // 1965: scattered mechanical rooftop boxes.
    const count = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const x = (rng() * 2 - 1) * (w * 0.5 - 0.9);
      const z = (rng() * 2 - 1) * (d * 0.5 - 0.9);
      addRoofBox(group, x, roofY, z, 0.8, 0.5, 0.6, metal, `roof-prop-ac-${i}`);
    }
    return { propKind, group, materials };
  }

  if (propKind === 'antennas') {
    // 1985: thin vertical masts.
    const count = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const x = (rng() * 2 - 1) * (w * 0.5 - 1.0);
      const z = (rng() * 2 - 1) * (d * 0.5 - 1.0);
      addRoofBox(group, x, roofY, z, 0.09, 2.4 + rng() * 1.4, 0.09, metal, `roof-prop-antenna-${i}`);
    }
    return { propKind, group, materials };
  }

  if (propKind === 'satellite_dishes') {
    // 2005: dishes on short stalks.
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const x = (rng() * 2 - 1) * (w * 0.5 - 1.0);
      const z = (rng() * 2 - 1) * (d * 0.5 - 1.0);
      addRoofBox(group, x, roofY, z, 0.05, 0.7, 0.05, metal, `roof-prop-dish-stalk-${i}`);
      const dish = new Mesh(new BoxGeometry(0.72, 0.08, 0.5), metal);
      dish.position.set(x, roofY + 0.75, z);
      dish.rotateX(Math.PI / 3);
      dish.name = `roof-prop-dish-${i}`;
      group.add(dish);
    }
    return { propKind, group, materials };
  }

  if (propKind === 'solar_panels') {
    // 2025: tilted photovoltaic panels in a grid.
    const panelMat = new MeshLambertMaterial({ color: 0x1b3a5c, emissive: 0x0f2a4a });
    materials.push(panelMat);
    const cols = Math.max(2, Math.floor(w / 2.4));
    const rows = Math.max(2, Math.floor(d / 2.0));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = (c + 0.5) * (w / cols) - w / 2;
        const z = (r + 0.5) * (d / rows) - d / 2;
        const panel = new Mesh(new BoxGeometry(1.5, 0.06, 0.85), panelMat);
        panel.position.set(x, roofY + 0.5, z);
        panel.rotateX(-Math.PI / 5);
        panel.name = `roof-prop-solar-${r}-${c}`;
        group.add(panel);
      }
    }
    return { propKind, group, materials };
  }

  if (propKind === 'green_roof') {
    // Green roof bed (2005 fallback / complete coverage in 2025).
    const bedMat = new MeshLambertMaterial({ color: 0x3d5a30, emissive: 0x2f4a26 });
    materials.push(bedMat);
    addRoofBox(group, 0, roofY, 0, w * 0.9, 0.28, d * 0.9, bedMat, 'roof-prop-green-bed');
    return { propKind, group, materials };
  }

  // No dominant prop (mansard 1945 without water tower): keep the group empty.
  return { propKind: 'none', group, materials };
}

/* ------------------------------------------------------------------ */
/* Full building group                                                 */
/* ------------------------------------------------------------------ */

export interface BuildingGroup {
  /** The named root group the system adds to the scene (origin = plot center). */
  group: Group;
  /** Merged building body mesh (BoxGeometry with per-face materials). */
  body: Mesh;
  /** The merged BoxGeometry (also carried by `body`). */
  geometry: BoxGeometry;
  /** Instanced window meshes (lit/dim per face). */
  windows: InstancedMesh[];
  /** Root group holding roof props. */
  roofGroup: Group;
  /** Local height the geometry was authored at (heightScale == 1.0). */
  authoredHeight: number;
  /** Facade material (first material of the merged body). */
  facadeMaterial: MeshLambertMaterial;
  /** Emissive window material for lit windows (null when no windows). */
  windowLitMaterial: MeshLambertMaterial | null;
  /** Every material this group owns (facade, roof, glass, props). */
  materials: Material[];
  /** Every procedural texture this group owns (must be disposed). */
  textures: ProceduralTexture[];
  /** Frees all GPU resources and detaches from parent. Idempotent. */
  dispose(): void;
}

export interface CreateBuildingOptions {
  plot: BuildingPlot;
  era: BuildingsEraData;
  style: InterpolatedBuildingStyle;
  height: number;
  seed: string;
}

/**
 * Builds one complete procedural building as a self-contained group placed at
 * the plot's centroid. The body is a single merged BoxGeometry; the group is
 * authored at `height` so the owner can morph it in place later via
 * `group.scale`.
 */
export function createBuildingGroup(options: CreateBuildingOptions): BuildingGroup {
  const { plot, era, style, height, seed } = options;
  const fp = plot.footprint;
  const w = fp.maxX - fp.minX;
  const d = fp.maxZ - fp.minZ;
  const cx = (fp.minX + fp.maxX) / 2;
  const cz = (fp.minZ + fp.maxZ) / 2;

  const group = new Group();
  group.name = `building-${plot.id}`;
  group.position.set(cx, 0, cz);

  const textures: ProceduralTexture[] = [];
  const materials: Material[] = [];

  // -- merged body ----------------------------------------------------------
  const grid = windowGridFor(w, height);
  const kind =
    era.spec.roofStyle === 'solar_spire'
      ? 'curtain_green'
      : era.windowLayout === 'curtain'
        ? 'curtain'
        : 'brick';
  const facadeTexture = createFacadeTexture({
    era,
    columns: grid.columns,
    rows: grid.rows,
    widthMeters: w,
    heightMeters: height,
    seed: `${seed}:facade`,
    kind,
  });
  textures.push(facadeTexture);
  const facadeMat = new MeshLambertMaterial({
    map: facadeTexture,
    color: style.facadeColor,
    emissive: 0x000000,
  });
  materials.push(facadeMat);

  const roofTexture = createRoofTexture({
    era,
    widthMeters: w,
    depthMeters: d,
    seed: `${seed}:roof`,
  });
  textures.push(roofTexture);
  const roofMat = new MeshLambertMaterial({
    map: roofTexture,
    color: 0xffffff,
  });
  materials.push(roofMat);

  const soffitMat = new MeshLambertMaterial({ color: 0x8a8f98 });
  materials.push(soffitMat);

  // BoxGeometry face order: [+x, -x, +y, -y, +z, -z] with per-face material
  // indices set by the geometry itself (0..5 → material array below).
  const bodyGeom = new BoxGeometry(w, height, d);
  bodyGeom.name = `building-${plot.id}-body`;
  const body = new Mesh(bodyGeom, [
    facadeMat,
    facadeMat,
    roofMat,
    soffitMat,
    facadeMat,
    facadeMat,
  ]);
  body.position.set(0, height / 2, 0);
  body.name = `building-${plot.id}-mesh`;
  group.add(body);

  // -- instanced windows -----------------------------------------------------
  const windowResult = createWindowInstancesFor(plot, era, style, height, seed);
  // Window positions are already in the building-local frame (centered on the
  // plot), so they attach straight to the group alongside the body.
  for (const mesh of windowResult.meshes) {
    group.add(mesh);
  }
  for (const m of windowResult.materials) {
    materials.push(m);
  }

  // -- roof props ------------------------------------------------------------
  const roofGroup = new Group();
  roofGroup.name = `building-${plot.id}-roof`;
  const roofPlan = buildRoofProps(roofGroup, era, { width: w, depth: d }, height, `${seed}:props`);
  materials.push(...roofPlan.materials);
  roofGroup.position.set(0, 0, 0);
  group.add(roofGroup);

  let disposed = false;
  return {
    group,
    body,
    geometry: bodyGeom,
    windows: windowResult.meshes,
    roofGroup,
    authoredHeight: height,
    facadeMaterial: facadeMat,
    windowLitMaterial: windowResult.litMaterial,
    materials,
    textures,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const tex of textures) tex.dispose();
      for (const mat of materials) mat.dispose();
      for (const win of windowResult.meshes) win.dispose();
      bodyGeom.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

/** Sets opacity (and transparent flag) on every material of a mesh group. */
export function setGroupOpacity(group: Group, opacity: number): void {
  const clamped = Math.max(0, Math.min(1, opacity));
  const meshes: Mesh[] = [];
  collectMeshes(group, meshes);
  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.transparent = clamped < 1;
      mat.opacity = clamped;
    }
  }
}

function collectMeshes(object: Group | Mesh, out: Mesh[]): void {
  const children = (object as unknown as { children: Object3DLike[] }).children;
  for (const child of children ?? []) {
    if (child.isMesh === true) {
      out.push(child as Mesh);
    } else {
      collectMeshes(child as Group, out);
    }
  }
}

interface Object3DLike {
  isMesh?: boolean;
  children?: Object3DLike[];
}