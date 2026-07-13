// =============================================================================
// City Timelapse — Procedural Asset Factory
//
// The single source of visual primitives for every era-content task. Buildings,
// vehicles, pedestrians, and storefronts compose era-distinct looks by calling
// these four pure factory functions instead of re-implementing material or
// geometry generation:
//
//   - makeMaterial(eraId, slot)        -> MeshStandardMaterial (era palette)
//   - makeBuildingGeometry(eraId, fp)  -> low-poly BufferGeometry stack
//   - makeStreetFurniture(eraId)       -> THREE.Group (lamp / bench / pillar)
//   - makeSignMaterial(eraId, text)    -> MeshStandardMaterial w/ CanvasTexture
//
// All output is procedural: no fetch(), no external image/model/font files.
// Browser-default font stacks are used for sign typography. Every function is
// pure -- a fresh instance is returned on each call with no shared mutable
// output, so they are safe to reuse across many buildings and props.
//
// No other phase may write to this file; it is the canonical asset API.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EraId } from '../eras';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Material slots consumed by era-content builders. Each slot resolves to a
 * distinct per-era MatSpec (color, roughness, metalness, emissive).
 */
export type MaterialSlot =
  | 'wallBrick'
  | 'wallStucco'
  | 'wallConcrete'
  | 'wallGlass'
  | 'road'
  | 'sidewalk'
  | 'streetlight'
  | 'signNeon'
  | 'signHologram';

/** Ground footprint + height hint describing one building's massing input. */
export interface BuildingFootprint {
  /** Width along the world X axis, in scene units. */
  readonly w: number;
  /** Depth along the world Z axis, in scene units. */
  readonly d: number;
  /** Base height hint (Y); the era scales and offsets this. */
  readonly h: number;
}

/** Visual treatment of a procedurally drawn sign. */
export type SignKind = 'painted' | 'neon' | 'led' | 'hologram';

/** Options accepted by makeSignMaterial. */
export interface SignOptions {
  /** Canvas width in pixels. Defaults to 256. */
  readonly width?: number;
  /** Canvas height in pixels. Defaults to 128. */
  readonly height?: number;
  /** Sign treatment; defaults to the era's characteristic kind. */
  readonly kind?: SignKind;
  /** Background color override (hex). */
  readonly background?: number;
}

// ---------------------------------------------------------------------------
// Internal: material specification tables (distinct per era per slot)
// ---------------------------------------------------------------------------

/** Fully-resolved physical material parameters for one slot of one era. */
interface MatSpec {
  /** Diffuse base color (hex). */
  readonly color: number;
  /** Surface roughness, 0 (mirror) .. 1 (chalk). */
  readonly roughness: number;
  /** Metallic-ness, 0 (dielectric) .. 1 (metal). */
  readonly metalness: number;
  /** Emissive color (hex); non-zero only for glowing sign slots. */
  readonly emissive: number;
  /** Emissive strength; non-zero only for glowing sign slots. */
  readonly emissiveIntensity: number;
}

/**
 * Per-era, per-slot material table. Values are hand-tuned so that every era
 * reads as visually distinct for every slot (e.g. 1945 brick is sooty red-brown
 * while 2055 "brick" is a rare cold graphite). Only the sign slots carry
 * emissive energy; walls, roads, and fixtures stay lit purely by the scene rig.
 */
const ERA_MATERIALS: Record<EraId, Record<MaterialSlot, MatSpec>> = {
  '1945': {
    wallBrick: { color: 0x7a4a3a, roughness: 0.9, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xb0a489, roughness: 0.85, metalness: 0.03, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0x8a8178, roughness: 0.9, metalness: 0.04, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0x6b6055, roughness: 0.5, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x3a332c, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x6e655a, roughness: 0.92, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x4a4036, roughness: 0.8, metalness: 0.6, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x1a1410, roughness: 0.6, metalness: 0.1, emissive: 0xff8c3a, emissiveIntensity: 1.2 },
    signHologram: { color: 0x10100a, roughness: 0.6, metalness: 0.1, emissive: 0x6b5a3a, emissiveIntensity: 0.2 },
  },
  '1965': {
    wallBrick: { color: 0x8a6a5a, roughness: 0.85, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xd9c7a8, roughness: 0.8, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0xb8b0a0, roughness: 0.85, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0xa9c4d8, roughness: 0.25, metalness: 0.5, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x444038, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x8a857a, roughness: 0.9, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x9a9a9a, roughness: 0.35, metalness: 0.7, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x140a12, roughness: 0.5, metalness: 0.1, emissive: 0xff4fa3, emissiveIntensity: 1.5 },
    signHologram: { color: 0x0a1020, roughness: 0.5, metalness: 0.2, emissive: 0x3a6aff, emissiveIntensity: 0.3 },
  },
  '1985': {
    wallBrick: { color: 0x6a5a55, roughness: 0.85, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xc0b8b0, roughness: 0.8, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0x9a958c, roughness: 0.88, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0x4a6a8a, roughness: 0.12, metalness: 0.92, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x33373c, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x7a7d80, roughness: 0.9, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x5a5a5a, roughness: 0.5, metalness: 0.7, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x0a0008, roughness: 0.45, metalness: 0.1, emissive: 0xff2a6d, emissiveIntensity: 1.8 },
    signHologram: { color: 0x08101a, roughness: 0.5, metalness: 0.2, emissive: 0x2a8aff, emissiveIntensity: 0.4 },
  },
  '2005': {
    wallBrick: { color: 0x5a5550, roughness: 0.85, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xb0aca6, roughness: 0.8, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0x86888a, roughness: 0.86, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0x6a9fb0, roughness: 0.18, metalness: 0.85, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x2c2f33, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x8a8d8f, roughness: 0.9, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x3a3a3a, roughness: 0.45, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x061014, roughness: 0.4, metalness: 0.15, emissive: 0x00b3d4, emissiveIntensity: 1.4 },
    signHologram: { color: 0x06101a, roughness: 0.5, metalness: 0.2, emissive: 0x1a6aff, emissiveIntensity: 0.5 },
  },
  '2025': {
    wallBrick: { color: 0x4a4a48, roughness: 0.85, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xc8cdd0, roughness: 0.78, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0x9aa0a3, roughness: 0.84, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0x8fd3c0, roughness: 0.15, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x2a2d30, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x959a9d, roughness: 0.9, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x2a2a2a, roughness: 0.5, metalness: 0.6, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x06120c, roughness: 0.4, metalness: 0.15, emissive: 0x39ff8a, emissiveIntensity: 1.5 },
    signHologram: { color: 0x081020, roughness: 0.5, metalness: 0.2, emissive: 0x4a8aff, emissiveIntensity: 0.7 },
  },
  '2055': {
    wallBrick: { color: 0x3a3a40, roughness: 0.85, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallStucco: { color: 0xdfe6ef, roughness: 0.7, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 },
    wallConcrete: { color: 0xaab4c0, roughness: 0.8, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0 },
    wallGlass: { color: 0xb6c8ff, roughness: 0.08, metalness: 0.9, emissive: 0x000000, emissiveIntensity: 0 },
    road: { color: 0x242629, roughness: 0.95, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 0 },
    sidewalk: { color: 0x9aa2ab, roughness: 0.9, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 },
    streetlight: { color: 0x1a1a22, roughness: 0.4, metalness: 0.85, emissive: 0x000000, emissiveIntensity: 0 },
    signNeon: { color: 0x0a0612, roughness: 0.4, metalness: 0.2, emissive: 0x9b5cff, emissiveIntensity: 1.7 },
    signHologram: { color: 0x04101a, roughness: 0.45, metalness: 0.25, emissive: 0x00e5ff, emissiveIntensity: 1.9 },
  },
};

/** Look up a MatSpec, throwing on unknown combinations. */
function getMatSpec(eraId: EraId, slot: MaterialSlot): MatSpec {
  const era = ERA_MATERIALS[eraId];
  const spec = era?.[slot];
  if (!spec) {
    throw new Error(`[assetFactory] No material spec for era "${eraId}" slot "${slot}"`);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Internal: building massing tables (distinct silhouette per era)
// ---------------------------------------------------------------------------

/** Roof treatments the geometry builder can synthesize. */
type RoofType = 'flat' | 'antenna' | 'spire' | 'eco' | 'pyramid';

/** Per-era massing recipe applied to a BuildingFootprint. */
interface BuildingMassing {
  /** Multiplier applied to the footprint height hint. */
  readonly heightScale: number;
  /** Constant height added on top of the scaled hint. */
  readonly baseOffset: number;
  /** Number of vertically stacked, progressively tapering segments. */
  readonly segments: number;
  /** Fraction each segment shrinks relative to the one below it. */
  readonly taper: number;
  /** Whether a decorative cornice band is added near the top. */
  readonly cornice: boolean;
  /** How much wider than the shaft the cornice projects (fraction). */
  readonly corniceScale: number;
  /** Cornice band height, in scene units. */
  readonly corniceHeight: number;
  /** Roof treatment crowning the stack. */
  readonly roof: RoofType;
}

/** Per-era massing. Each era yields a distinct silhouette and bounding box. */
const ERA_MASSING: Record<EraId, BuildingMassing> = {
  '1945': { heightScale: 0.7, baseOffset: 2, segments: 1, taper: 0.0, cornice: true, corniceScale: 0.08, corniceHeight: 0.7, roof: 'flat' },
  '1965': { heightScale: 1.0, baseOffset: 4, segments: 1, taper: 0.0, cornice: true, corniceScale: 0.05, corniceHeight: 0.5, roof: 'flat' },
  '1985': { heightScale: 1.7, baseOffset: 8, segments: 2, taper: 0.12, cornice: false, corniceScale: 0.0, corniceHeight: 0.0, roof: 'flat' },
  '2005': { heightScale: 2.0, baseOffset: 10, segments: 3, taper: 0.1, cornice: false, corniceScale: 0.0, corniceHeight: 0.0, roof: 'antenna' },
  '2025': { heightScale: 2.3, baseOffset: 12, segments: 3, taper: 0.08, cornice: false, corniceScale: 0.0, corniceHeight: 0.0, roof: 'eco' },
  '2055': { heightScale: 2.8, baseOffset: 14, segments: 4, taper: 0.12, cornice: false, corniceScale: 0.0, corniceHeight: 0.0, roof: 'spire' },
};

// ---------------------------------------------------------------------------
// Internal: sign palette + per-kind rendering parameters
// ---------------------------------------------------------------------------

/** Per-era sign character: default treatment and procedural-draw palette. */
interface SignEraConfig {
  readonly kind: SignKind;
  readonly bg: number;
  readonly ink: number;
  readonly glow: number;
  readonly border: number;
}

/** Per-era sign palette. Ink/glow colors are distinct for every era. */
const SIGN_ERA: Record<EraId, SignEraConfig> = {
  '1945': { kind: 'painted', bg: 0xe8dfc8, ink: 0x3a2a1a, glow: 0xff8c3a, border: 0x8a6a3a },
  '1965': { kind: 'neon', bg: 0x10141c, ink: 0xff7fc0, glow: 0xff4fa3, border: 0xff4fa3 },
  '1985': { kind: 'neon', bg: 0x0a0a12, ink: 0xff5a8a, glow: 0xff2a6d, border: 0xff2a6d },
  '2005': { kind: 'led', bg: 0x0c1418, ink: 0x4fe0ff, glow: 0x00b3d4, border: 0x115a6a },
  '2025': { kind: 'led', bg: 0x08120e, ink: 0x6effb0, glow: 0x39ff8a, border: 0x125a32 },
  '2055': { kind: 'hologram', bg: 0x04101a, ink: 0x9ff7ff, glow: 0x00e5ff, border: 0x0a3a55 },
};

/** Emissive strength per sign treatment. */
const KIND_EMISSIVE: Record<SignKind, number> = {
  painted: 0.08,
  neon: 1.5,
  led: 1.3,
  hologram: 1.7,
};

/** Whether the material bypasses ACES tone mapping (so glows stay vivid). */
const KIND_TONEMAPPED: Record<SignKind, boolean> = {
  painted: true,
  neon: false,
  led: false,
  hologram: false,
};

// ---------------------------------------------------------------------------
// makeMaterial
// ---------------------------------------------------------------------------

/**
 * Build a fresh, era-appropriate THREE.MeshStandardMaterial for a given
 * slot. The material is lit by the scene's lighting rig (PBR roughness /
 * metalness / emissive). Pure: every call returns an independent instance.
 *
 * @param eraId One of the six canonical eras.
 * @param slot  Which surface role the material fills (wall, road, sign, ...).
 */
export function makeMaterial(eraId: EraId, slot: MaterialSlot): THREE.MeshStandardMaterial {
  const spec = getMatSpec(eraId, slot);
  return new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
    emissive: spec.emissive,
    emissiveIntensity: spec.emissiveIntensity,
  });
}

// ---------------------------------------------------------------------------
// makeBuildingGeometry
// ---------------------------------------------------------------------------

/** Add a translated sub-geometry to the parts list. */
function pushBox(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  cy: number,
): void {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, cy, 0);
  parts.push(geo);
}

/**
 * Build a low-poly, era-characteristic building geometry: a stack of one or
 * more tapering shaft segments, an optional cornice band, and a roof cap whose
 * silhouette varies by era (flat / antenna / eco slab / spire / pyramid). The
 * merged THREE.BufferGeometry is rooted at the ground plane (base at
 * y = 0) and carries position + normal + uv attributes for a single material.
 *
 * Pure: each call builds and returns a new geometry.
 *
 * @param eraId     One of the six canonical eras.
 * @param footprint Width (w), depth (d), and height hint (h) of the building.
 */
export function makeBuildingGeometry(
  eraId: EraId,
  footprint: BuildingFootprint,
): THREE.BufferGeometry {
  const m = ERA_MASSING[eraId];
  const w = Math.max(footprint.w, 0.2);
  const d = Math.max(footprint.d, 0.2);
  const hint = Math.max(footprint.h, 0);

  const total = hint * m.heightScale + m.baseOffset;
  const segCount = Math.max(1, Math.floor(m.segments));
  const segHeight = total / segCount;

  const parts: THREE.BufferGeometry[] = [];

  // Shaft: stacked, progressively tapering boxes.
  let cursorY = 0;
  for (let i = 0; i < segCount; i += 1) {
    const shrink = 1 - i * m.taper;
    const sw = Math.max(w * shrink, 0.2);
    const sd = Math.max(d * shrink, 0.2);
    pushBox(parts, sw, segHeight, sd, cursorY + segHeight / 2);
    cursorY += segHeight;
  }

  // Top-of-shaft footprint after tapering (used by roof caps).
  const topShrink = 1 - (segCount - 1) * m.taper;
  const topW = Math.max(w * topShrink, 0.2);
  const topD = Math.max(d * topShrink, 0.2);

  // Optional cornice band straddling the upper shaft.
  if (m.cornice) {
    pushBox(parts, w * (1 + m.corniceScale), m.corniceHeight, d * (1 + m.corniceScale), cursorY - m.corniceHeight / 2);
  }

  // Roof treatment -- distinct silhouette per era.
  switch (m.roof) {
    case 'flat': {
      pushBox(parts, topW, 0.4, topD, cursorY + 0.2);
      break;
    }
    case 'antenna': {
      pushBox(parts, topW, 0.4, topD, cursorY + 0.2);
      const mastH = Math.max(topW, topD) * 1.4;
      const mast = new THREE.CylinderGeometry(0.08, 0.12, mastH, 6);
      mast.translate(0, cursorY + 0.4 + mastH / 2, 0);
      parts.push(mast);
      const tip = new THREE.ConeGeometry(0.16, 0.5, 6);
      tip.translate(0, cursorY + 0.4 + mastH + 0.25, 0);
      parts.push(tip);
      break;
    }
    case 'spire': {
      const spireH = Math.max(topW, topD) * 1.8;
      const spire = new THREE.ConeGeometry(Math.min(topW, topD) * 0.4, spireH, 8);
      spire.translate(0, cursorY + spireH / 2, 0);
      parts.push(spire);
      break;
    }
    case 'eco': {
      // Slightly inset green-roof slab with a low parapet.
      pushBox(parts, topW, 0.3, topD, cursorY + 0.15);
      pushBox(parts, topW * 0.85, 0.55, topD * 0.85, cursorY + 0.45);
      break;
    }
    case 'pyramid': {
      const pyrH = Math.max(topW, topD) * 0.7;
      const pyr = new THREE.ConeGeometry(Math.max(topW, topD) * 0.72, pyrH, 4);
      pyr.rotateY(Math.PI / 4);
      pyr.translate(0, cursorY + pyrH / 2, 0);
      parts.push(pyr);
      break;
    }
    default: {
      // Exhaustive guard; RoofType has no other members.
      const _exhaustive: never = m.roof;
      throw new Error(`[assetFactory] Unknown roof type: ${String(_exhaustive)}`);
    }
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();

  if (!merged) {
    throw new Error(`[assetFactory] mergeGeometries returned nothing for era "${eraId}"`);
  }
  merged.name = `building-${eraId}`;
  return merged;
}

// ---------------------------------------------------------------------------
// makeStreetFurniture
// ---------------------------------------------------------------------------

/** Attach a mesh built from geometry + material to a group at a position. */
function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

/** Golden angle used for deterministic placement variety. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Build a twin-globe cast-iron gaslamp characteristic of 1945. */
function buildGaslamp(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const iron = makeMaterial(eraId, 'streetlight');
  const glow = makeMaterial(eraId, 'signNeon');
  const base = makeMaterial(eraId, 'wallConcrete');
  addMesh(group, new THREE.CylinderGeometry(0.5, 0.6, 0.5, 12), base, 0, 0.25, 0);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.14, 5.2, 10), iron, 0, 3.1, 0);
  const bar = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8);
  bar.rotateZ(Math.PI / 2);
  addMesh(group, bar, iron, 0, 5.7, 0);
  addMesh(group, new THREE.SphereGeometry(0.32, 14, 10), glow, -0.7, 5.7, 0);
  addMesh(group, new THREE.SphereGeometry(0.32, 14, 10), glow, 0.7, 5.7, 0);
  return group;
}

/** Build a cobra-head lamp on a concrete pole (1965). */
function buildCobraHead(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const pole = makeMaterial(eraId, 'wallConcrete');
  const steel = makeMaterial(eraId, 'streetlight');
  const glow = makeMaterial(eraId, 'signNeon');
  addMesh(group, new THREE.CylinderGeometry(0.45, 0.55, 0.5, 12), pole, 0, 0.25, 0);
  addMesh(group, new THREE.CylinderGeometry(0.13, 0.15, 5.0, 10), steel, 0, 3.0, 0);
  const arm = new THREE.BoxGeometry(1.7, 0.12, 0.18);
  arm.translate(0.75, 0, 0);
  addMesh(group, arm, steel, 0, 5.4, 0);
  // Cobra-head luminaire housing.
  addMesh(group, new THREE.BoxGeometry(0.8, 0.24, 0.36), steel, 1.5, 5.34, 0);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.12, 0.3), glow, 1.5, 5.18, 0);
  return group;
}

/** Build a dual-arm sodium lamp of the neon-boom era (1985). */
function buildDualArmLamp(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const steel = makeMaterial(eraId, 'streetlight');
  const glow = makeMaterial(eraId, 'signNeon');
  const base = makeMaterial(eraId, 'sidewalk');
  addMesh(group, new THREE.CylinderGeometry(0.4, 0.5, 0.5, 12), base, 0, 0.25, 0);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 6.0, 10), steel, 0, 3.5, 0);
  for (const dir of [-1, 1]) {
    const arm = new THREE.BoxGeometry(1.5, 0.1, 0.16);
    arm.translate(dir * 0.7, 0, 0);
    addMesh(group, arm, steel, 0, 6.0, 0);
    addMesh(group, new THREE.BoxGeometry(0.7, 0.18, 0.3), glow, dir * 1.4, 5.9, 0);
  }
  return group;
}

/** Build a slender steel lamp with a base utility cabinet (2005). */
function buildSlenderLamp(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const steel = makeMaterial(eraId, 'streetlight');
  const glow = makeMaterial(eraId, 'signNeon');
  addMesh(group, new THREE.BoxGeometry(0.5, 1.2, 0.32), steel, 0.4, 0.6, 0); // traffic cabinet
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 6.4, 10), steel, 0, 3.8, 0);
  const arm = new THREE.BoxGeometry(1.4, 0.08, 0.14);
  arm.translate(0.6, 0, 0);
  addMesh(group, arm, steel, 0, 6.9, 0);
  addMesh(group, new THREE.BoxGeometry(0.75, 0.1, 0.28), glow, 1.3, 6.84, 0);
  return group;
}

/** Build a smart LED pole with sensor node (2025). */
function buildSmartPole(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const matte = makeMaterial(eraId, 'streetlight');
  const glow = makeMaterial(eraId, 'signNeon');
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.24, 0.6, 12), matte, 0, 0.3, 0);
  addMesh(group, new THREE.CylinderGeometry(0.09, 0.11, 6.6, 10), matte, 0, 3.9, 0);
  addMesh(group, new THREE.BoxGeometry(0.6, 1.2, 0.06), glow, 0, 5.6, 0); // LED blade panel
  addMesh(group, new THREE.SphereGeometry(0.12, 10, 8), matte, 0, 7.0, 0); // sensor node
  return group;
}

/** Build a hovering holographic pillar (2055). */
function buildHoverPillar(eraId: EraId): THREE.Group {
  const group = new THREE.Group();
  const tech = makeMaterial(eraId, 'streetlight');
  const holo = makeMaterial(eraId, 'signHologram');
  addMesh(group, new THREE.CylinderGeometry(0.16, 0.22, 0.4, 12), tech, 0, 0.2, 0);
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.09, 6.0, 10), tech, 0, 3.6, 0);
  const ring = new THREE.TorusGeometry(0.55, 0.06, 10, 28);
  ring.rotateX(Math.PI / 2);
  addMesh(group, ring, holo, 0, 6.4, 0);
  const ring2 = new THREE.TorusGeometry(0.4, 0.05, 10, 24);
  ring2.rotateX(Math.PI / 2);
  addMesh(group, ring2, holo, 0, 5.6, 0);
  return group;
}

/**
 * Build an era-characteristic street-furniture prop as a fresh
 * THREE.Group: a gaslamp (1945), cobra-head (1965), dual-arm sodium lamp
 * (1985), slender lamp + cabinet (2005), smart LED pole (2025), or hovering
 * holographic pillar (2055). The group is rooted at the ground plane.
 *
 * Pure: every call returns an independent group with its own geometries and
 * materials. The optional variant rotates the prop deterministically so a
 * block can be populated with varied orientations without breaking purity.
 *
 * @param eraId   One of the six canonical eras.
 * @param variant Optional integer used only for deterministic rotation.
 */
export function makeStreetFurniture(eraId: EraId, variant = 0): THREE.Group {
  let group: THREE.Group;
  switch (eraId) {
    case '1945': group = buildGaslamp(eraId); break;
    case '1965': group = buildCobraHead(eraId); break;
    case '1985': group = buildDualArmLamp(eraId); break;
    case '2005': group = buildSlenderLamp(eraId); break;
    case '2025': group = buildSmartPole(eraId); break;
    case '2055': group = buildHoverPillar(eraId); break;
    default: {
      const _exhaustive: never = eraId;
      throw new Error(`[assetFactory] Unknown era id: ${String(_exhaustive)}`);
    }
  }
  group.name = `furniture-${eraId}`;
  group.rotation.y = variant * GOLDEN_ANGLE;
  return group;
}

// ---------------------------------------------------------------------------
// makeSignMaterial (shared offscreen canvas -> CanvasTexture)
// ---------------------------------------------------------------------------

/**
 * Lazily-created offscreen canvas used as the shared procedural drawing surface
 * for sign artwork. It is fully overwritten on every draw, so it accumulates
 * no state between calls (outputs depend only on the call arguments).
 */
let scratchCanvas: HTMLCanvasElement | null = null;

function getScratchCanvas(): HTMLCanvasElement {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
  }
  return scratchCanvas;
}

/** Convert a hex number to a CSS color string. */
function hexCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * Paint era/treatment-appropriate sign artwork onto a 2D context using only
 * browser-default font stacks (no external fonts).
 */
function drawSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  cfg: SignEraConfig,
  kind: SignKind,
): void {
  const ink = hexCss(cfg.ink);
  const glow = hexCss(cfg.glow);
  const border = hexCss(cfg.border);

  // Background.
  ctx.fillStyle = hexCss(cfg.bg);
  ctx.fillRect(0, 0, w, h);

  // Frame.
  const lw = Math.max(2, h * 0.04);
  ctx.lineWidth = lw;
  ctx.strokeStyle = border;
  ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw);

  // Typography.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.max(10, Math.round(h * 0.42));
  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  const cx = w / 2;
  const cy = h / 2;

  if (kind === 'painted') {
    // Opaque enamel lettering.
    ctx.fillStyle = ink;
    ctx.fillText(text, cx, cy);
  } else if (kind === 'neon') {
    // Glowing tube: thick stroked halo + bright fill.
    ctx.shadowColor = glow;
    ctx.shadowBlur = h * 0.28;
    ctx.lineWidth = Math.max(2, h * 0.05);
    ctx.strokeStyle = glow;
    ctx.strokeText(text, cx, cy);
    ctx.shadowBlur = h * 0.12;
    ctx.fillStyle = ink;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
  } else if (kind === 'led') {
    // Faint pixel grid + crisp luminous text.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = glow;
    const step = Math.max(4, Math.round(h / 10));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
    ctx.shadowColor = glow;
    ctx.shadowBlur = h * 0.18;
    ctx.fillStyle = ink;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
  } else {
    // Hologram: scanlines + vertical gradient glow.
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = glow;
    const scanStep = Math.max(2, Math.round(h / 24));
    for (let y = 0; y < h; y += scanStep) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, ink);
    grad.addColorStop(1, glow);
    ctx.fillStyle = grad;
    ctx.shadowColor = glow;
    ctx.shadowBlur = h * 0.3;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
  }
}

/**
 * Build an era-appropriate sign as a THREE.MeshStandardMaterial whose
 * map and emissiveMap are THREE.CanvasTexture instances. Artwork is
 * painted on a shared offscreen canvas, then snapshotted into a per-texture
 * canvas so every sign owns independent pixels (no GPU aliasing between signs).
 *
 * The default treatment is era-characteristic (enamel paint 1945, neon
 * 1965/1985, LED 2005/2025, hologram 2055) but can be overridden via
 * SignOptions.kind. Pure: each call returns an independent material.
 *
 * @param eraId   One of the six canonical eras.
 * @param text    Sign copy (rendered with a browser-default font stack).
 * @param options Size / kind / background overrides.
 */
export function makeSignMaterial(
  eraId: EraId,
  text: string,
  options: SignOptions = {},
): THREE.MeshStandardMaterial {
  const base = SIGN_ERA[eraId];
  const kind = options.kind ?? base.kind;
  const width = Math.max(8, Math.floor(options.width ?? 256));
  const height = Math.max(8, Math.floor(options.height ?? 128));
  const cfg: SignEraConfig =
    options.background !== undefined ? { ...base, bg: options.background } : base;

  // Draw on the shared offscreen canvas.
  const scratch = getScratchCanvas();
  scratch.width = width;
  scratch.height = height;
  const sctx = scratch.getContext('2d');
  if (!sctx) {
    throw new Error('[assetFactory] Shared sign canvas 2D context unavailable');
  }
  drawSign(sctx, width, height, text, cfg, kind);

  // Snapshot into a per-texture canvas so each sign owns its pixels.
  const frozen = document.createElement('canvas');
  frozen.width = width;
  frozen.height = height;
  const fctx = frozen.getContext('2d');
  if (!fctx) {
    throw new Error('[assetFactory] Snapshot sign canvas 2D context unavailable');
  }
  fctx.drawImage(scratch, 0, 0);

  const texture = new THREE.CanvasTexture(frozen);
  texture.name = `sign-${eraId}-${kind}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return new THREE.MeshStandardMaterial({
    map: texture,
    emissive: cfg.glow,
    emissiveMap: texture,
    emissiveIntensity: KIND_EMISSIVE[kind],
    roughness: kind === 'painted' ? 0.6 : 0.4,
    metalness: kind === 'hologram' ? 0.2 : 0.1,
    toneMapped: KIND_TONEMAPPED[kind],
  });
}
