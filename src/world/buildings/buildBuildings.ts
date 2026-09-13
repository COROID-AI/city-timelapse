/**
 * buildBuildings(eraId, layout) — per-era building sets on BlockLayout lots.
 *
 * This is the buildings entry point of City Time Period Timelapse, consumed
 * by the scene-integration era registry. Given one of the five era ids and a
 * shared `BlockLayout`, it deterministically builds the era's whole building
 * set as a THREE.Group where every lot carries one archetype building:
 *
 *   - 1945 brick rowhouses / war-era facades (cornices, fire escapes, stoops)
 *   - 1965 mid-century modern slabs (ribbon windows, fins, pilotis canopy)
 *   - 1985 concrete / glass blocks (brise-soleil, glass block, rooftop HVAC)
 *   - 2005 glass-and-steel mid-rises (curtain walls, steel mullions, masts)
 *   - 2025 green towers (green glass, living walls, solar + wind, green roof)
 *
 * Placement contract: each building's footprint is inset inside its lot's
 * parcel bounds, its base sits at street level (y = 0) and the group rotates
 * by the lot's frontage angle so the street-facing facade points at the
 * street — buildings never overlap the roadway or sidewalk bands.
 *
 * Everything is built from procedural WebGL-free `BufferGeometry` and lazy
 * canvas textures (shared materials, merged quad/box geometries), so the
 * whole set constructs headlessly in Node tests and stays within a bounded
 * draw-call budget. Theme inputs (`options.theme`) deterministically alter
 * the output (palette, material keywords, height range).
 */

import * as THREE from 'three';
import type { EraId } from '../../era/types';
import { createSeededRng, type Rng } from '../../lib/rng';
import { clamp } from '../../lib/math';
import type { BlockLayout, BuildingLot, Rect2D } from '../layout';
import {
  resolveEraBuilding,
  type BuildingThemeOverride,
  type ResolvedEraBuilding,
} from './eraBuildingData';
import { MaterialCache, createEraMaterials, type FacadeTextureKind } from './materials';
import {
  buildBuildingForLot,
  GeometryCache,
  type BuildingDescriptor,
  type PassStats,
  type Placement,
} from './archetypes';

/** Optional runtime overrides consumed by the builder (theme-input sensitivity). */
export interface BuildBuildingsOptions {
  /** Override one or both schema sections (buildings / palette). */
  theme?: BuildingThemeOverride;
}

/** Aggregate descriptor attached to the era group (scene-registry handoff). */
export interface BuildingsDescriptor {
  eraId: EraId;
  label: string;
  archetype: string;
  windowStyle: string;
  roofStyle: string;
  facadeMaterial: string;
  paletteHex: string[];
  emissiveHex: string;
  buildings: BuildingDescriptor[];
  stats: {
    buildingCount: number;
    totalWindows: number;
    totalFireEscapes: number;
    totalSolarPanels: number;
    totalWindTurbines: number;
    totalMeshCount: number;
    totalMaterials: number;
    heightMin: number;
    heightMax: number;
    heightMean: number;
  };
  /** Canonical signature for determinism / pairwise-distinctness checks. */
  signature: string;
}

/** Read the descriptor attached by `buildBuildings` (name + userData). */
export function getBuildingsDescriptor(group: THREE.Group): BuildingsDescriptor | undefined {
  const descriptor = group.userData?.descriptor;
  return descriptor && typeof descriptor.eraId === 'number' ? descriptor : undefined;
}

/** Read the per-building descriptor of one building group. */
export function getBuildingDescriptor(group: THREE.Group): BuildingDescriptor | undefined {
  const descriptor = group.userData?.descriptor;
  return descriptor && typeof descriptor.eraId === 'number' ? descriptor : undefined;
}

/**
 * Deterministically seed an era's building pass from the shared layout seed
 * and the era id (FNV-1a over "layoutSeed:eraId").
 */
function eraSeed(layoutSeed: number, eraId: EraId): number {
  let hash = 2166136261;
  const text = `${layoutSeed}:${eraId}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 16777619) & 0xffffffff;
  }
  return hash & 0xffffffff;
}

/** Which canvas facade tile an era's primary material tries to paint. */
function textureKindFor(detailArchetype: string): FacadeTextureKind {
  switch (detailArchetype) {
    case 'rowhouse':
      return 'brick';
    case 'concrete-glass-block':
      return 'concrete';
    case 'glass-steel-midrise':
    case 'green-tower':
      return 'curtain';
    default:
      return 'none';
  }
}

/**
 * Compute how a building sits on its lot. The footprint is inset from the
 * parcel edges using the era's placement factors, pressed toward the street
 * so the front face looks at the street. All fields are materialized in
 * world space (meters, Y-up) for the descriptor and tests.
 */
export function computePlacement(
  lot: BuildingLot,
  era: ResolvedEraBuilding,
  rng: Rng,
): Placement {
  const factors = era.detail.placement;
  const sideSetback = factors.side * rng.range(0.6, 1.4);
  const streetSetback = factors.street * rng.range(0.7, 1.4);
  const backSetback = factors.back * rng.range(0.8, 1.4);

  const fx = Math.round(lot.frontage.normal.x);
  const fz = Math.round(lot.frontage.normal.z);
  const widthAxisIsX = Math.abs(fz) > 0.5;
  const lotW = widthAxisIsX ? lot.bounds.maxX - lot.bounds.minX : lot.bounds.maxZ - lot.bounds.minZ;
  const lotD = widthAxisIsX ? lot.bounds.maxZ - lot.bounds.minZ : lot.bounds.maxX - lot.bounds.minX;
  const width = round1(clamp(lotW - 2 * sideSetback, 6, 62));
  const depth = round1(clamp(lotD - streetSetback - backSetback, 6, 46));

  // Building height blends the era height range with the lot's zoning limits.
  const zoneScale = { commercial: 1.12, mixed_use: 1.0, residential: 0.85, civic: 0.9 }[lot.zoning];
  const eraHeight = rng.range(era.buildings.heightRange[0], era.buildings.heightRange[1]);
  const height = round1(
    clamp(eraHeight * zoneScale, lot.heightLimits.min * 0.6, lot.heightLimits.max),
  );

  // Street-facing edge midpoint of the parcel.
  const cx0 = (lot.bounds.minX + lot.bounds.maxX) / 2;
  const cz0 = (lot.bounds.minZ + lot.bounds.maxZ) / 2;
  const streetEdgeP = fx > 0.5 ? lot.bounds.maxX : fx < -0.5 ? lot.bounds.minX : fz > 0.5 ? lot.bounds.maxZ : lot.bounds.minZ;
  const streetPoint = {
    x: Math.abs(fx) > 0.5 ? streetEdgeP : cx0,
    z: Math.abs(fz) > 0.5 ? streetEdgeP : cz0,
  };
  const center = {
    x: round1(streetPoint.x - fx * (streetSetback + depth / 2)),
    y: lot.center.y,
    z: round1(streetPoint.z - fz * (streetSetback + depth / 2)),
  };

  // World corners: local (+x along perp (fz,-fx), +z along facing).
  const corners = [
    localToWorld(center, fx, fz, -width / 2, -depth / 2),
    localToWorld(center, fx, fz, width / 2, -depth / 2),
    localToWorld(center, fx, fz, -width / 2, depth / 2),
    localToWorld(center, fx, fz, width / 2, depth / 2),
  ];
  const footprint = {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minZ: Math.min(...corners.map((c) => c.z)),
    maxZ: Math.max(...corners.map((c) => c.z)),
  };

  return {
    width,
    depth,
    height,
    baseY: lot.center.y,
    facing: { x: fx, z: fz },
    yaw: lot.frontage.angle,
    footprint,
    center,
  };
}

function localToWorld(center: { x: number; z: number }, fx: number, fz: number, lx: number, lz: number): { x: number; z: number } {
  return {
    x: center.x + lx * fz + lz * fx,
    z: center.z - lx * fx + lz * fz,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Serialize every group/mesh identity + transform for determinism checks. */
export function serializeBuildings(group: THREE.Group): string {
  const parts: string[] = [];
  const walk = (object: THREE.Object3D, depth: number) => {
    const position = object.position;
    const quaternion = object.quaternion;
    const materialName = object instanceof THREE.Mesh
      ? `mesh:${(object.material as THREE.MeshLambertMaterial | undefined)?.name ?? ''}`
      : object.constructor.name;
    parts.push(
      `${' '.repeat(depth)}${materialName}|${object.name ?? ''}|${fmt3(position.x, position.y, position.z)}|${fmt4(
        quaternion.w,
        quaternion.x,
        quaternion.y,
        quaternion.z,
      )}`,
    );
  };
  const visit = (parent: THREE.Group, depth: number): void => {
    for (const child of parent.children) {
      walk(child, depth);
      if (child instanceof THREE.Group) {
        visit(child, depth + 1);
      }
    }
  };
  visit(group, 0);
  return parts.join('\n');
}

function fmt3(a: number, b: number, c: number): string {
  return `${round3(a)},${round3(b)},${round3(c)}`;
}
function fmt4(a: number, b: number, c: number, d: number): string {
  return `${round3(a)},${round3(b)},${round3(c)},${round3(d)}`;
}
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Build the complete building set for `eraId` on the shared `layout`.
 *
 * Deterministic: identical (eraId, layout, options) always yields an
 * identical set (seeded per era+layout). Theme overrides deterministically
 * change palette/material/height fields of the output.
 */
export function buildBuildings(
  eraId: EraId,
  layout: BlockLayout,
  options: BuildBuildingsOptions = {},
): THREE.Group {
  const resolved = resolveEraBuilding(eraId, options.theme);
  const materialsCache = new MaterialCache();
  const geometry = new GeometryCache();
  const rng = createSeededRng(eraSeed(layout.seed, eraId));
  const stats: PassStats = { meshes: 0, materials: 0 };
  const materials = createEraMaterials(
    materialsCache,
    resolved.palette,
    resolved.detail.glow,
    textureKindFor(resolved.detail.archetype),
  );

  const root = new THREE.Group();
  root.name = `buildings-${eraId}`;
  const descriptors: BuildingDescriptor[] = [];

  for (const lot of layout.lots) {
    const placement = computePlacement(lot, resolved, rng);
    const built = buildBuildingForLot({
      eraId,
      spec: resolved,
      detail: resolved.detail,
      materials,
      rng,
      lot,
      placement,
      geometry,
      stats,
    });
    const group = built.group;
    group.position.set(placement.center.x, placement.center.y, placement.center.z);
    group.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yaw);
    root.add(group);
    descriptors.push(built.descriptor);
  }

  stats.materials = materialsCache.size;
  const heights = descriptors.map((d) => d.placement.height);
  const theDescriptor: BuildingsDescriptor = {
    eraId,
    label: `${eraId} buildings`,
    archetype: resolved.detail.archetype,
    windowStyle: resolved.buildings.windowStyle,
    roofStyle: resolved.buildings.roofStyle,
    facadeMaterial: resolved.buildings.facadeMaterial,
    paletteHex: [...resolved.palette.facadeMaterials],
    emissiveHex: resolved.detail.glow.interior,
    buildings: descriptors,
    stats: {
      buildingCount: descriptors.length,
      totalWindows: descriptors.reduce((sum, d) => sum + d.details.windows, 0),
      totalFireEscapes: descriptors.reduce((sum, d) => sum + d.details.fireEscapes, 0),
      totalSolarPanels: descriptors.reduce((sum, d) => sum + d.details.solarPanels, 0),
      totalWindTurbines: descriptors.reduce((sum, d) => sum + d.details.windTurbines, 0),
      totalMeshCount: stats.meshes,
      totalMaterials: stats.materials,
      heightMin: Math.min(...heights),
      heightMax: Math.max(...heights),
      heightMean: heights.reduce((sum, h) => sum + h, 0) / Math.max(1, heights.length),
    },
    signature: buildSignature(descriptors, resolved),
  };
  root.userData = { kind: 'buildings', descriptor: theDescriptor };

  // Keep geometry/material references reachable via userData so callers can
  // dispose them through the group's traverse (see disposeBuildings).
  root.userData.teardown = { geometry, materialsCache };
  return root;
}

/** Canonical fingerprint of one era's building set. */
function buildSignature(
  descriptors: BuildingDescriptor[],
  resolved: ResolvedEraBuilding,
): string {
  const totals = descriptors.reduce(
    (acc, d) => {
      const det = d.details;
      acc.windows += det.windows;
      acc.panes += det.windowPanes;
      acc.fireEscapes += det.fireEscapes;
      acc.cornices += det.cornices;
      acc.chimneys += det.chimneys;
      acc.waterTowers += det.waterTowers;
      acc.acUnits += det.acUnits;
      acc.antennas += det.antennas;
      acc.solar += det.solarPanels;
      acc.wind += det.windTurbines;
      acc.planters += det.planters;
      acc.setbacks += det.setbackLevels;
      acc.awnings += det.awnings;
      acc.stoops += det.stoops;
      acc.mullions += det.mullions;
      acc.roof += det.roofStructures;
      acc.wearPatches += det.wearPatches;
      acc.soot += det.sootBands;
      acc.rust += det.rustStreaks;
      acc.meshes += d.meshCount;
      acc.materials += d.materialCount;
      return acc;
    },
    {
      windows: 0, panes: 0, fireEscapes: 0, cornices: 0, chimneys: 0, waterTowers: 0,
      acUnits: 0, antennas: 0, solar: 0, wind: 0, planters: 0, setbacks: 0, awnings: 0,
      stoops: 0, mullions: 0, roof: 0, wearPatches: 0, soot: 0, rust: 0, meshes: 0, materials: 0,
    },
  );
  const heights = descriptors.map((d) => d.placement.height);
  const mean = heights.reduce((sum, h) => sum + h, 0) / Math.max(1, heights.length);
  return JSON.stringify({
    era: resolved.eraId,
    archetype: resolved.detail.archetype,
    windowStyle: resolved.buildings.windowStyle,
    roofStyle: resolved.buildings.roofStyle,
    facadeMaterial: resolved.buildings.facadeMaterial,
    palette: resolved.palette.facadeMaterials,
    emissive: resolved.detail.glow.interior,
    heights: { min: Math.min(...heights), max: Math.max(...heights), mean: round3(mean) },
    totals,
  });
}

/**
 * Dispose every geometry and material reachable from the returned group
 * (scene transitions / teardown). Safe to call more than once; afterwards
 * the group still holds the objects but their GL buffers are released.
 */
export function disposeBuildings(group: THREE.Group): void {
  const visited = new Set<object>();
  const disposeMaterial = (material: unknown) => {
    if (material && typeof material === 'object' && !visited.has(material)) {
      visited.add(material);
      (material as { dispose?: () => void }).dispose?.();
    }
  };
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const mesh = object;
      if (mesh.geometry && !visited.has(mesh.geometry)) {
        visited.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      disposeMaterial(mesh.material);
    }
  });
  const teardown = group.userData?.teardown as { geometry?: GeometryCache; materialsCache?: MaterialCache } | undefined;
  teardown?.geometry?.dispose();
  teardown?.materialsCache?.dispose();
}

/**
 * Whether a descriptor's footprint overlaps any roadway or sidewalk band.
 * Buildings are placed inside lot parcels (which never overlap the bands),
 * so this stays false for every well-formed lot; exposed for tests.
 */
export function footprintOverlapsPublicBand(
  footprint: Rect2D,
  layout: BlockLayout,
): boolean {
  for (const band of layout.sidewalkBands) {
    if (rectsOverlap(footprint, band.bounds)) {
      return true;
    }
  }
  for (const band of layout.asphaltAreas) {
    if (rectsOverlap(footprint, band)) {
      return true;
    }
  }
  return false;
}

/** Local rect-overlap (no dependency on the layout module's private helpers). */
function rectsOverlap(a: Rect2D, b: Rect2D): boolean {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ);
}