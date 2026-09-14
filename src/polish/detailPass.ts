/**
 * DetailPass — the additive era-detail enrichment layer.
 *
 * Composed around the scene-integration outputs without editing any producer
 * module. For every era scene it layers:
 *
 *  - **Emissive night window glows**: for each building (read through the
 *    builder's public descriptor on `buildBuildings` output), an additive,
 *    self-lit `InstancedMesh` of facade-aligned glow quads, derived from the
 *    era's real window grid parameters (`resolveEraBuilding(...).windows`)
 *    and the era's interior glow token. Glows live in building-local space as
 *    children of each building group, so they transform (dissolve/build/scale)
 *    together with the buildings during era morphs.
 *  - **Additional small props**: instanced planters beside tree anchors,
 *    newspaper boxes beside lamp posts and pigeons scattered on sidewalk
 *    bands — all placed from `BlockLayout` anchors with a deterministic RNG.
 *  - **Surface wear**: instanced asphalt patches, sidewalk cracks and facade
 *    soot streaks, era-scaled (1945 heavily worn -> 2025 clean).
 *
 * Instancing: every repeated prop is one `InstancedMesh` (many instances, one
 * draw call). The whole layer is a single tagged polish group attached under
 * the buildings layer, so the era morph drives its opacity/scale with the
 * same law as the buildings; `disposePolishDetail` releases the GL resources
 * and re-application on a rebuilt era is idempotent via a scene-level marker.
 *
 * All appearance intent is baked into *color* (not opacity) so the morph's
 * material-opacity pass cannot wash the glow intensity out: at full opacity
 * after a transition the additive glow still reads at its authored strength.
 *
 * Headless-safe: only THREE scene-graph/geometry work, no WebGL calls.
 */

import * as THREE from 'three';
import type { EraId } from '../era/types';
import { createSeededRng, type Rng } from '../lib/rng';
import type { ResolvedEraBuilding } from '../world/buildings/eraBuildingData';
import { resolveEraBuilding } from '../world/buildings/eraBuildingData';
import type { BuildingDescriptor } from '../world/buildings/archetypes';
import { getBuildingDescriptor } from '../world/buildings/buildBuildings';
import type { BlockLayout, FurnitureAnchor, Rect2D } from '../world/layout';
import { clamp } from '../lib/math';
import { POLISH_PRIORITIES, countSceneDrawCalls } from './perfBudget';

/** Marker stored on the scene root when the detail pass has been applied. */
export const DETAIL_PASS_MARKER = 'city-polish-detail-v1';

/** Per-era window-glow profile (opacity is baked into the glow color). */
interface EraGlowProfile {
  /** How much of the full glow color to keep (dim war windows -> bright modern). */
  strength: number;
  /** Multiplier on the producer's `litChance` so era density differs. */
  density: number;
  /** Facade soot streaks per building (0 = none). */
  sootMax: number;
  /** Surface-wear scale applied to patches/cracks. */
  wear: number;
}

const ERA_GLOW_PROFILES: Record<EraId, EraGlowProfile> = {
  1945: { strength: 0.34, density: 0.8, sootMax: 3, wear: 1.0 },
  1965: { strength: 0.45, density: 0.9, sootMax: 2, wear: 0.7 },
  1985: { strength: 0.6, density: 1.0, sootMax: 2, wear: 0.85 },
  2005: { strength: 0.72, density: 1.0, sootMax: 1, wear: 0.4 },
  2025: { strength: 0.82, density: 1.0, sootMax: 0, wear: 0.15 },
};

/** Tunable knobs for one detail application. */
export interface PolishDetailOptions {
  /** 0..1 density multiplier on lit windows (default 1). */
  readonly glowDensity?: number;
  /** Multiplier on the era's glow strength (default 1). */
  readonly glowStrengthScale?: number;
  /** 0..1 density multiplier on street props (default 1). */
  readonly propDensity?: number;
  /** 0..1 density multiplier on surface wear (default 1). */
  readonly wearDensity?: number;
  /** Deterministic seed (defaults to an era-derived constant). */
  readonly seed?: number;
}

/** Machine-readable outcome of one detail application. */
export interface PolishDetailReport {
  readonly era: EraId;
  /** False only when the pass was skipped (already applied to this scene). */
  readonly applied: boolean;
  /** True when this call was an idempotent no-op on an already-polished scene. */
  readonly reapplySkipped: boolean;
  /** Window-glow instance count (sum across buildings). */
  readonly glowInstances: number;
  /** Window-glow draw calls (one InstancedMesh per building). */
  readonly glowDrawCalls: number;
  /** Small-prop instance count (planters + news boxes + pigeons). */
  readonly propInstances: number;
  /** Small-prop draw calls (one InstancedMesh per prop family). */
  readonly propDrawCalls: number;
  /** Wear instance count (patches + cracks + soot streaks). */
  readonly wearPatches: number;
  /** Wear draw calls. */
  readonly wearDrawCalls: number;
  /** Total draw calls of the whole polish layer (glows + props + wear). */
  readonly polishDrawCalls: number;
  /** Total draw calls across the whole era root after applying. */
  readonly totalDrawCalls: number;
  /** The tagged polish group (child of the buildings layer). */
  readonly group: THREE.Group;
}

/** Structural scene surface the detail pass consumes (EraScene satisfies it). */
export interface PolishSceneInput {
  readonly era: EraId;
  readonly root: THREE.Group;
  /** Buildings layer (morph element) — the polish group attaches under it. */
  readonly buildings: THREE.Group;
  /** The shared block layout providing anchors and surface bands. */
  readonly layout: BlockLayout;
}

type GlowCell = readonly [x: number, y: number];

/** Deterministic per-era seed base for the detail pass. */
function seedFor(era: EraId, seed?: number): number {
  return seed ?? (era * 7919 + 13);
}

function skipReport(era: EraId): PolishDetailReport {
  return {
    era,
    applied: false,
    reapplySkipped: true,
    glowInstances: 0,
    glowDrawCalls: 0,
    propInstances: 0,
    propDrawCalls: 0,
    wearPatches: 0,
    wearDrawCalls: 0,
    polishDrawCalls: 0,
    totalDrawCalls: 0,
    group: new THREE.Group(),
  };
}

/**
 * Apply the detail pass to one era scene. Attaches a single tagged polish
 * group under the buildings layer for every era:
 *
 *  - glows (per-building InstancedMesh additive quads on the facade grid),
 *  - instanced street props (planters, news boxes, pigeons) from anchors,
 *  - instanced surface wear (asphalt patches, sidewalk cracks, soot streaks).
 *
 * Idempotent per scene object: the second call on the same scene root is a
 * skip (marker present). Rebuilding an era produces a fresh scene whose
 * marker is absent, so the pass applies cleanly again.
 */
export function applyDetailPass(
  scene: PolishSceneInput,
  options: PolishDetailOptions = {},
): PolishDetailReport {
  if (scene.root.userData?.[DETAIL_PASS_MARKER] === true) {
    return skipReport(scene.era);
  }

  const rng = createSeededRng(seedFor(scene.era, options.seed));
  const resolved = resolveEraBuilding(scene.era);
  const profile = ERA_GLOW_PROFILES[scene.era];

  const group = new THREE.Group();
  group.name = `polish-detail-${scene.era}`;
  group.userData = {
    polishGroup: true,
    polishPriority: POLISH_PRIORITIES.glows,
    polishKind: 'detail',
  };

  const glow = addWindowGlows(scene, resolved, profile, rng, options);
  const props = addSmallProps(group, scene, resolved, rng, options);
  const wear = addSurfaceWear(group, scene, profile, rng, options);

  // Under the buildings layer so the era morph's opacity/scale law drives it.
  scene.buildings.add(group);
  scene.root.userData = { ...(scene.root.userData ?? {}), [DETAIL_PASS_MARKER]: true };

  return {
    era: scene.era,
    applied: true,
    reapplySkipped: false,
    glowInstances: glow.instances,
    glowDrawCalls: glow.drawCalls,
    propInstances: props.instances,
    propDrawCalls: props.drawCalls,
    wearPatches: wear.patches,
    wearDrawCalls: wear.drawCalls,
    polishDrawCalls: glow.drawCalls + props.drawCalls + wear.drawCalls,
    totalDrawCalls: countSceneDrawCalls(scene.root),
    group,
  };
}

/**
 * Release every polish GL resource owned by `group` and detach it. The
 * geometry/material of the polish layer are additionally released by the
 * producer teardown (`buildBuildings` traverses the buildings layer where
 * the group lives), so this focuses on the `InstancedMesh` instance buffers
 * and is idempotent across scene disposal.
 */
export function disposePolishDetail(group: THREE.Group): void {
  const visited = new Set<object>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    if (object instanceof THREE.InstancedMesh) {
      try {
        object.dispose();
      } catch {
        // Instance-buffer teardown must never break an era swap.
      }
    }
    if (!visited.has(object.geometry)) {
      visited.add(object.geometry);
      try {
        object.geometry.dispose();
      } catch {
        // Already-disposed geometry is harmless.
      }
    }
    const raw = object.material;
    const materials = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    for (const material of materials) {
      if (material != null && !visited.has(material)) {
        visited.add(material);
        try {
          material.dispose();
        } catch {
          // Already-disposed material is harmless.
        }
      }
    }
  });
  group.removeFromParent();
}

// ============================================================================
// Night window glows
// ============================================================================

/** All building groups + descriptors from the buildings layer (builder output). */
function buildingEntries(
  scene: PolishSceneInput,
): Array<{ group: THREE.Group; descriptor: BuildingDescriptor }> {
  const entries: Array<{ group: THREE.Group; descriptor: BuildingDescriptor }> = [];
  for (const child of scene.buildings.children) {
    if (!(child instanceof THREE.Group)) {
      continue;
    }
    const descriptor = getBuildingDescriptor(child);
    if (descriptor != null) {
      entries.push({ group: child, descriptor });
    }
  }
  return entries;
}

/** Window-grid cells (local building space) mirroring the archetype grid law. */
function glowCells(
  placement: BuildingDescriptor['placement'],
  windows: ResolvedEraBuilding['detail']['windows'],
  rng: Rng,
  litChance: number,
): GlowCell[] {
  const cells: GlowCell[] = [];
  const xFrom = -placement.width / 2 + 0.6;
  const xTo = placement.width / 2 - 0.6;
  const yFrom = 2.4;
  const yTo = placement.height - 1.6;
  for (
    let cx = xFrom + windows.unitW / 2;
    cx <= xTo - windows.unitW / 2 + 1e-6;
    cx += windows.unitW + windows.gapX
  ) {
    for (
      let cy = yFrom + windows.unitH / 2;
      cy <= yTo - windows.unitH / 2 + 1e-6;
      cy += windows.unitH + windows.gapY
    ) {
      if (rng.chance(litChance)) {
        cells.push([cx, cy]);
      }
    }
  }
  return cells;
}

function addWindowGlows(
  scene: PolishSceneInput,
  resolved: ResolvedEraBuilding,
  profile: EraGlowProfile,
  rng: Rng,
  options: PolishDetailOptions,
): { instances: number; drawCalls: number } {
  const windows = resolved.detail.windows;
  const glowColor = new THREE.Color(resolved.detail.glow.interior);
  // Bake the authored glow strength into the color so the morph's opacity=1
  // completion keeps the designed look (see module doc).
  glowColor.multiplyScalar(
    clamp(profile.strength * (options.glowStrengthScale ?? 1), 0, 1),
  );
  const litChance = clamp(windows.litChance * (options.glowDensity ?? 1) * profile.density, 0, 1);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const dummy = new THREE.Object3D();
  let instances = 0;
  let drawCalls = 0;

  for (const entry of buildingEntries(scene)) {
    const cells = glowCells(entry.descriptor.placement, windows, rng, litChance);
    if (cells.length === 0) {
      continue;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
    mesh.name = `polish-glows-${entry.descriptor.lotId}`;
    mesh.userData = { polish: true, polishKind: 'windowGlow' };
    // Front facade plane: all archetypes place the street facade at local
    // z = depth/2; glows sit a few centimetres proud of the glass.
    const z = entry.descriptor.placement.depth / 2 + 0.09;
    const unitW = windows.unitW * 1.06;
    const unitH = windows.unitH * 1.06;
    cells.forEach(([cx, cy], index) => {
      dummy.position.set(cx, cy, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(unitW, unitH, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    entry.group.add(mesh);
    instances += cells.length;
    drawCalls += 1;
  }

  return { instances, drawCalls };
}

// ============================================================================
// Instanced small props (from BlockLayout anchors + sidewalk bands)
// ============================================================================

/** Perpendicular (right-hand) offset direction for an anchor facing. */
function rightOf(anchor: FurnitureAnchor): { x: number; z: number } {
  return { x: anchor.facingVector.z, z: -anchor.facingVector.x };
}

function anchorOffsetPoint(
  anchor: FurnitureAnchor,
  distance: number,
): { x: number; z: number } {
  const right = rightOf(anchor);
  return {
    x: anchor.position.x + right.x * distance,
    z: anchor.position.z + right.z * distance,
  };
}

interface InstancedCell {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

/** Compose an instance matrix from a cell (flatten + yaw + scale). */
function composeInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  cell: InstancedCell,
  flatten: boolean,
): void {
  const dummy = new THREE.Object3D();
  dummy.position.set(cell.x, cell.y, cell.z);
  dummy.rotation.set(flatten ? -Math.PI / 2 : 0, cell.yaw, 0);
  dummy.scale.set(cell.scaleX, cell.scaleY, cell.scaleZ);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function randomCellInRect(
  rng: Rng,
  rect: Rect2D,
  inset: number,
  y: number,
): InstalledCell | null {
  const minX = rect.minX + inset;
  const maxX = rect.maxX - inset;
  const minZ = rect.minZ + inset;
  const maxZ = rect.maxZ - inset;
  if (maxX <= minX || maxZ <= minZ) {
    return null;
  }
  return {
    x: rng.range(minX, maxX),
    y,
    z: rng.range(minZ, maxZ),
  };
}

interface InstalledCell {
  x: number;
  y: number;
  z: number;
}

function addSmallProps(
  parent: THREE.Group,
  scene: PolishSceneInput,
  resolved: ResolvedEraBuilding,
  rng: Rng,
  options: PolishDetailOptions,
): { instances: number; drawCalls: number } {
  const density = clamp(options.propDensity ?? 1, 0, 1);
  const layout = scene.layout;
  let instances = 0;
  let drawCalls = 0;

  // 1. Planters beside tree anchors.
  const treeAnchors = layout.getAnchorsByKind('tree');
  const planterCells: InstalledCell[] = [];
  for (const anchor of treeAnchors) {
    if (!rng.chance(0.8 * density)) {
      continue;
    }
    const offset = anchorOffsetPoint(anchor, 1.7);
    planterCells.push({ x: offset.x, y: 0.2, z: offset.z });
  }
  if (planterCells.length > 0) {
    const geometry = new THREE.BoxGeometry(0.52, 0.4, 0.52);
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(resolved.detail.palette.accent).multiplyScalar(0.55),
    });
    const mesh = new THREE.InstancedMesh(geometry, material, planterCells.length);
    mesh.name = `polish-planters-${scene.era}`;
    mesh.userData = { polish: true, polishKind: 'planter' };
    planterCells.forEach((cell, index) => {
      composeInstance(mesh, index, { ...cell, yaw: rng.next() * Math.PI, scaleX: 1, scaleY: 1, scaleZ: 1 }, false);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    instances += planterCells.length;
    drawCalls += 1;
  }

  // 2. Newspaper boxes beside lamp posts.
  const lampAnchors = layout.getAnchorsByKind('lamp_post');
  const boxCells: InstalledCell[] = [];
  for (const anchor of lampAnchors) {
    if (!rng.chance(0.7 * density)) {
      continue;
    }
    const offset = anchorOffsetPoint(anchor, 1.25);
    boxCells.push({ x: offset.x, y: 0.26, z: offset.z });
  }
  if (boxCells.length > 0) {
    const geometry = new THREE.BoxGeometry(0.34, 0.52, 0.24);
    const material = new THREE.MeshLambertMaterial({ color: '#2f3742' });
    const mesh = new THREE.InstancedMesh(geometry, material, boxCells.length);
    mesh.name = `polish-newsboxes-${scene.era}`;
    mesh.userData = { polish: true, polishKind: 'newsbox' };
    boxCells.forEach((cell, index) => {
      composeInstance(mesh, index, { ...cell, yaw: rng.next() * Math.PI, scaleX: 1, scaleY: 1, scaleZ: 1 }, false);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    instances += boxCells.length;
    drawCalls += 1;
  }

  // 3. Pigeons scattered on sidewalk bands.
  const pigeonCells: Array<InstalledCell & { yaw: number }> = [];
  for (const band of layout.sidewalkBands) {
    const count = Math.round(rng.range(0, 3) * density);
    for (let i = 0; i < count; i += 1) {
      const cell = randomCellInRect(rng, band.bounds, 0.8, 0.05);
      if (cell == null) {
        continue;
      }
      pigeonCells.push({ ...cell, yaw: rng.next() * Math.PI * 2 });
    }
  }
  if (pigeonCells.length > 0) {
    const geometry = new THREE.BoxGeometry(0.15, 0.11, 0.24);
    const material = new THREE.MeshLambertMaterial({ color: '#6c6a67' });
    const mesh = new THREE.InstancedMesh(geometry, material, pigeonCells.length);
    mesh.name = `polish-pigeons-${scene.era}`;
    mesh.userData = { polish: true, polishKind: 'pigeon' };
    pigeonCells.forEach((cell, index) => {
      composeInstance(mesh, index, { ...cell, scaleX: 1, scaleY: 1, scaleZ: 1 }, false);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    instances += pigeonCells.length;
    drawCalls += 1;
  }

  return { instances, drawCalls };
}

// ============================================================================
// Surface wear (instanced asphalt patches, sidewalk cracks, soot streaks)
// ============================================================================

function addSurfaceWear(
  parent: THREE.Group,
  scene: PolishSceneInput,
  profile: EraGlowProfile,
  rng: Rng,
  options: PolishDetailOptions,
): { patches: number; drawCalls: number } {
  const density = clamp(options.wearDensity ?? 1, 0, 1) * profile.wear;
  const layout = scene.layout;
  let patches = 0;
  let drawCalls = 0;

  // 1. Worn asphalt patches (flat dark quads on roadway rects).
  const patchCells: InstancedCell[] = [];
  for (const area of layout.asphaltAreas) {
    const count = Math.max(1, Math.round(rng.range(3, 7) * density));
    for (let i = 0; i < count; i += 1) {
      const cell = randomCellInRect(rng, area, 0.5, 0.012);
      if (cell == null) {
        continue;
      }
      patchCells.push({
        ...cell,
        yaw: rng.next() * Math.PI,
        scaleX: rng.range(0.8, 2.4),
        scaleY: 1,
        scaleZ: rng.range(0.6, 1.6),
      });
    }
  }
  if (patchCells.length > 0) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#171719').multiplyScalar(clamp(0.14 + density * 0.22, 0.05, 0.4)),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, patchCells.length);
    mesh.name = `polish-asphalt-wear-${scene.era}`;
    mesh.userData = { polish: true, polishKind: 'asphaltWear' };
    patchCells.forEach((cell, index) => {
      composeInstance(mesh, index, cell, true);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    patches += patchCells.length;
    drawCalls += 1;
  }

  // 2. Sidewalk cracks (thin dark lines across sidewalk bands).
  const crackCells: InstancedCell[] = [];
  for (const band of layout.sidewalkBands) {
    const count = Math.max(1, Math.round(rng.range(2, 5) * density));
    for (let i = 0; i < count; i += 1) {
      const cell = randomCellInRect(rng, band.bounds, 0.6, 0.012);
      if (cell == null) {
        continue;
      }
      crackCells.push({
        ...cell,
        yaw: rng.next() * Math.PI,
        scaleX: 1,
        scaleY: 1,
        scaleZ: rng.range(0.5, 1.7),
      });
    }
  }
  if (crackCells.length > 0) {
    const geometry = new THREE.BoxGeometry(0.04, 0.014, 1);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#151518').multiplyScalar(clamp(0.12 + density * 0.2, 0.05, 0.38)),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, crackCells.length);
    mesh.name = `polish-sidewalk-cracks-${scene.era}`;
    mesh.userData = { polish: true, polishKind: 'sidewalkWear' };
    crackCells.forEach((cell, index) => {
      composeInstance(mesh, index, cell, false);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    patches += crackCells.length;
    drawCalls += 1;
  }

  // 3. Facade soot streaks (vertical dark quads near the base, per building).
  if (profile.sootMax > 0) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#141210').multiplyScalar(clamp(0.1 + density * 0.18, 0.06, 0.34)),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const entries = buildingEntries(scene);
    for (const entry of entries) {
      const count = rng.int(0, profile.sootMax);
      if (count === 0) {
        continue;
      }
      const placement = entry.descriptor.placement;
      const cells: InstalledCell[] = [];
      for (let i = 0; i < count; i += 1) {
        cells.push({
          x: rng.range(-placement.width / 2 + 0.5, placement.width / 2 - 0.5),
          y: rng.range(0.8, 2.6),
          z: placement.depth / 2 + 0.035,
        });
      }
      const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
      mesh.name = `polish-soot-${entry.descriptor.lotId}`;
      mesh.userData = { polish: true, polishKind: 'soot' };
      cells.forEach((cell, index) => {
        composeInstance(mesh, index, { ...cell, yaw: 0, scaleX: 0.2, scaleY: rng.range(0.5, 1.5), scaleZ: 1 }, false);
      });
      mesh.instanceMatrix.needsUpdate = true;
      entry.group.add(mesh);
      patches += cells.length;
      drawCalls += 1;
    }
  }

  return { patches, drawCalls };
}