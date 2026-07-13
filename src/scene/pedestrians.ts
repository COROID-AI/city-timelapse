// =============================================================================
// City Timelapse — Era-Distinct Pedestrian System (instanced + animated)
//
// Maintains a fixed population of pedestrians walking a closed-loop sidewalk
// spline. Every body part is rendered with THREE.InstancedMesh — one instanced
// mesh per body part per era — so there is never a per-pedestrian Object3D or
// Mesh allocation. Each of the six eras owns a visually distinct pedestrian
// layer (silhouette, clothing palette, and period accessory), and EraState
// transitions crossfade the outgoing layer into the incoming layer over ~1.2s.
//
// Design notes
//   * Allocation-free per frame: all scratch vectors / matrices / quaternions
//     are pre-allocated once and reused. The only "new" calls happen at build
//     time (materials, geometries, the curve) or disposal time.
//   * Simple biped animation: legs and arms swing via sine-driven rotation
//     around the hip / shoulder pivot. The body bobs slightly with the cycle.
//     No rigging or skinning — just per-instance matrix transforms.
//   * Sidewalk spline: a closed Catmull-Rom curve inside the road loop.
//     Pedestrians advance at constant arc-length speed; heading follows the
//     curve tangent, producing smooth turns at corners.
//   * Per-era outfits: each era defines distinct body-part proportions (torso
//     width, leg width, hair size), color palettes cycled across instances,
//     and a unique accessory geometry (fedora, tie, neon strip, hood, smart
//     glasses, AR visor + glow strips).
//
// No external model/texture/audio assets are created here.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ERA_IDS, type EraId } from '../eras';
import type { EraState } from './EraState';
import type { MaterialSlot } from './assetFactory';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The subset of the procedural asset factory consumed by pedestrians. */
export interface PedestrianAssetFactory {
  makeMaterial(eraId: EraId, slot: MaterialSlot): THREE.MeshStandardMaterial;
}

/** Handle returned by createPedestrianSystem. */
export interface PedestrianSystem {
  /** Root group to add to the scene. Contains every era's instanced meshes. */
  readonly group: THREE.Group;
  /** Advance the simulation by dt seconds (clamped internally). */
  update(dt: number): void;
  /** Tear down geometries/materials and unsubscribe from EraState. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Number of pedestrians on the sidewalk (12-20 range). */
const PEDESTRIAN_COUNT = 16;

/** Constant world-space walking speed, in scene units per second. */
const WALK_SPEED = 1.4;

/** Angular frequency of the walk cycle, in radians per second (~0.8 Hz). */
const WALK_FREQ = 5.0;

/** Amplitude of the leg/arm swing, in radians (~20°). */
const SWING_AMPLITUDE = 0.35;

/** Amplitude of the vertical body bob, in scene units. */
const BOB_AMPLITUDE = 0.04;

/** Duration of the crossfade between two era layers, in seconds. */
const FADE_SECONDS = 1.2;

// ---------------------------------------------------------------------------
// Pre-allocated constants (never mutated)
// ---------------------------------------------------------------------------

/** Forward axis of the authored pedestrian geometry (faces +Z). */
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Unit scale reused when composing per-instance matrices. */
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/** Axis around which limbs swing (forward/backward = X rotation). */
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Body-local pivot points for limbs (same across all eras). */
const HIP_L = new THREE.Vector3(-0.1, 0.95, 0);
const HIP_R = new THREE.Vector3(0.1, 0.95, 0);
const SHOULDER_L = new THREE.Vector3(-0.26, 1.42, 0);
const SHOULDER_R = new THREE.Vector3(0.26, 1.42, 0);

/**
 * Bounding sphere covering the full sidewalk loop. Assigned to every
 * InstancedMesh geometry so frustum culling only culls the crowd when the
 * entire block is off-screen — not when individual instances leave view.
 */
const SIDEWALK_BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 32);

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Identifies one of the eight body parts. */
type PartId = 'head' | 'hair' | 'torso' | 'legL' | 'legR' | 'armL' | 'armR' | 'accessory';

/** Ordered list of all body part ids. */
const PART_IDS: readonly PartId[] = [
  'head', 'hair', 'torso', 'legL', 'legR', 'armL', 'armR', 'accessory',
];

/** Body part ids whose instances share the body matrix (no limb swing). */
const BODY_PART_IDS: readonly PartId[] = ['head', 'hair', 'torso', 'accessory'];

/** A single body part: geometry paired with material. */
interface PedestrianPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
}

/** Per-era set of instanced meshes + unique materials. */
interface EraLayer {
  /** One InstancedMesh per body part id. */
  readonly meshes: Record<PartId, THREE.InstancedMesh>;
  /** All unique materials in the layer (for opacity crossfade + disposal). */
  readonly materials: THREE.MeshStandardMaterial[];
}

// ---------------------------------------------------------------------------
// Internal: geometry helpers
// ---------------------------------------------------------------------------

/** Create a translated axis-aligned box centered at (x, cy, z). */
function box(
  w: number, h: number, d: number,
  x: number, cy: number, z: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  g.translate(x, cy, z);
  return g;
}

/** Create a box that hangs downward from y = 0 (pivot at top). */
function hangingBox(
  w: number, h: number, d: number,
  x: number, z: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  g.translate(x, -h / 2, z);
  return g;
}

/** Create a full sphere centered at (0, cy, 0). */
function sphereGeo(radius: number, cy: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 8, 6);
  g.translate(0, cy, 0);
  return g;
}

/** Create an upper hemisphere (dome) centered at (0, cy, 0). */
function domeGeo(radius: number, cy: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.translate(0, cy, 0);
  return g;
}

/** Create a cylinder centered at (x, cy, z). */
function cylGeo(
  rTop: number, rBottom: number, h: number,
  x: number, cy: number, z: number,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8);
  g.translate(x, cy, z);
  return g;
}

/** Create a cone centered at (x, cy, z). */
function coneGeo(
  radius: number, h: number,
  x: number, cy: number, z: number,
): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(radius, h, 8);
  g.translate(x, cy, z);
  return g;
}

/** Merge geometries into one, disposing the sources. Throws on failure. */
function mergeAndDispose(parts: THREE.BufferGeometry[], label: string): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) {
    throw new Error(`[pedestrians] mergeGeometries returned nothing for ${label}`);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Internal: material helpers
// ---------------------------------------------------------------------------

/** Create a transparent-ready, white-base material for per-instance coloring. */
function whiteMat(roughness: number, metalness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    transparent: true,
    opacity: 1,
  });
}

/** Per-era clothing PBR finish (applied to torso, legs, and arms). */
const ERA_CLOTHING_FINISH: Record<EraId, { readonly rough: number; readonly metal: number }> = {
  '1945': { rough: 0.85, metal: 0.05 },
  '1965': { rough: 0.70, metal: 0.10 },
  '1985': { rough: 0.65, metal: 0.15 },
  '2005': { rough: 0.80, metal: 0.08 },
  '2025': { rough: 0.60, metal: 0.20 },
  '2055': { rough: 0.50, metal: 0.30 },
};

/** Asset-factory slot used for each era's accessory material. */
const ACCESSORY_SLOT: Record<EraId, MaterialSlot> = {
  '1945': 'streetlight',
  '1965': 'streetlight',
  '1985': 'signNeon',
  '2005': 'streetlight',
  '2025': 'streetlight',
  '2055': 'signHologram',
};

/**
 * Build the accessory material from the asset factory, then prepare it for
 * per-instance coloring (white base) and crossfade (transparent). Emissive
 * accessories bypass tone mapping so glows stay vivid.
 */
function prepareAccessoryMat(era: EraId, af: PedestrianAssetFactory): THREE.MeshStandardMaterial {
  const m = af.makeMaterial(era, ACCESSORY_SLOT[era]);
  m.color.setHex(0xffffff);
  m.transparent = true;
  m.opacity = 1;
  if (m.emissiveIntensity > 0) {
    m.toneMapped = false;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Internal: per-era color palettes (cycled across instances for variety)
// ---------------------------------------------------------------------------

/** Shared skin-tone palette — consistent across eras. */
const SKIN_TONES: readonly number[] = [0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d];

interface EraPalette {
  readonly skin: readonly number[];
  readonly torso: readonly number[];
  readonly legs: readonly number[];
  readonly arms: readonly number[];
  readonly hair: readonly number[];
  readonly accessory: readonly number[];
}

/**
 * Per-era color palettes. Each era uses a distinct family of clothing colours
 * so silhouettes read as period-appropriate at a glance.
 */
const ERA_PALETTE: Record<EraId, EraPalette> = {
  '1945': {
    skin: SKIN_TONES,
    torso: [0x3a3a4a, 0x4a3a2a, 0x2a2a3a, 0x3a4a3a],
    legs: [0x2a2a3a, 0x3a3a2a, 0x1a1a2a, 0x3a4a4a],
    arms: [0x3a3a4a, 0x4a3a2a, 0x2a2a3a, 0x3a4a3a],
    hair: [0x3a2a1a, 0x2a1a0a, 0x4a3a2a, 0x1a1a1a],
    accessory: [0x3a2a1a, 0x2a1a0a, 0x4a3a2a],
  },
  '1965': {
    skin: SKIN_TONES,
    torso: [0x6fc7c0, 0xe87fa8, 0xeae0c8, 0x6fa8dc, 0xf0d050],
    legs: [0xf0f0f0, 0xffffff, 0xf0e8e0],
    arms: [0x6fc7c0, 0xe87fa8, 0xeae0c8, 0x6fa8dc, 0xf0d050],
    hair: [0xc8a050, 0x8a6a3a, 0xd4a060, 0x6a4a2a],
    accessory: [0x1a1a2a, 0x2a1a3a, 0x1a2a2a],
  },
  '1985': {
    skin: SKIN_TONES,
    torso: [0xb02a2a, 0x2a2a8a, 0x8a2a8a, 0x2a8a8a, 0x4a4a4a],
    legs: [0x2a3a6a, 0x2a4a8a, 0x3a4a7a],
    arms: [0xb02a2a, 0x2a2a8a, 0x8a2a8a, 0x2a8a8a, 0x4a4a4a],
    hair: [0x1a1a1a, 0x4a2a1a, 0x8a4a2a, 0xc8c8c8],
    accessory: [0x0a0a12, 0x120a14, 0x0a0a0a],
  },
  '2005': {
    skin: SKIN_TONES,
    torso: [0x4a5a6a, 0x3a3a3a, 0x5a6a3a, 0x6a5a3a],
    legs: [0x2a3a5a, 0x3a3a4a, 0x5a4a3a],
    arms: [0x4a5a6a, 0x3a3a3a, 0x5a6a3a, 0x6a5a3a],
    hair: [0x3a2a1a, 0x2a1a0a, 0x5a4a3a, 0x4a4a4a],
    accessory: [0x3a3a3a, 0x2a2a2a, 0x4a4a4a],
  },
  '2025': {
    skin: SKIN_TONES,
    torso: [0xe8e8e8, 0xa0a0a0, 0x383838, 0xc8c8c0, 0xd0c8c0],
    legs: [0x2a2a2a, 0x383838, 0x4a4a4a],
    arms: [0xe8e8e8, 0xa0a0a0, 0x383838, 0xc8c8c0, 0xd0c8c0],
    hair: [0x2a1a0a, 0x4a3a2a, 0x6a6a6a, 0x8a8a8a],
    accessory: [0x1a1a1a, 0x2a2a2a, 0x1a1a2a],
  },
  '2055': {
    skin: SKIN_TONES,
    torso: [0x1a1a22, 0x2a2a3a, 0x1a2a2a, 0x222232],
    legs: [0x1a1a1a, 0x2a2a2a, 0x1a2a2a],
    arms: [0x1a1a22, 0x2a2a3a, 0x1a2a2a, 0x222232],
    hair: [0x1a1a1a, 0x2a2a2a, 0x1a1a2a],
    accessory: [0x0a0a14, 0x0a1018, 0x0a0a18],
  },
};

// ---------------------------------------------------------------------------
// Internal: per-era silhouette builders (distinct shape + accessory)
// ---------------------------------------------------------------------------

/**
 * Each builder returns the eight body parts for one era. Geometries encode
 * era-specific proportions (torso width, leg width, hair volume); the
 * accessory geometry is unique per era. All materials use a white base colour
 * so per-instance colours (from ERA_PALETTE) are the final visible colour.
 *
 * Body coordinate system: origin at ground level, +Y up, facing +Z.
 * Limb geometries use a pivot-at-top convention (hangingBox) so the instance
 * matrix can translate to the hip/shoulder and rotate freely.
 */

/** 1945 — Postwar: mid-length coats/skirts, suit jackets, fedora hats. */
function build1945(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['1945'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('1945', af);

  // Fedora: tapered crown + flat brim.
  const crown = coneGeo(0.13, 0.12, 0, 1.68, 0);
  const brim = cylGeo(0.2, 0.22, 0.025, 0, 1.63, 0);
  const accGeo = mergeAndDispose([crown, brim], '1945 accessory');

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.14, 1.58), material: hairMat },
    torso: { geometry: box(0.42, 1.0, 0.26, 0, 0.95, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.14, 0.85, 0.16, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.14, 0.85, 0.16, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.11, 0.50, 0.13, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.11, 0.50, 0.13, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** 1965 — Space Age: mod dresses, go-go boots, bouffant hair. */
function build1965(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['1965'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('1965', af);

  // Narrow tie on the torso front.
  const accGeo = box(0.04, 0.25, 0.02, 0, 1.15, 0.13);

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.16, 1.60), material: hairMat },
    torso: { geometry: box(0.36, 0.65, 0.22, 0, 1.15, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.14, 0.80, 0.16, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.14, 0.80, 0.16, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.10, 0.45, 0.12, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.10, 0.45, 0.12, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** 1985 — Neon Boom: power suits (broad shoulders), big hair, denim, neon. */
function build1985(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['1985'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('1985', af);

  // Neon accent strip on the chest (emissive via signNeon material).
  const accGeo = box(0.32, 0.04, 0.02, 0, 1.28, 0.14);

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.20, 1.62), material: hairMat },
    torso: { geometry: box(0.48, 0.55, 0.26, 0, 1.20, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.18, 0.90, 0.20, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.18, 0.90, 0.20, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.13, 0.52, 0.14, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.13, 0.52, 0.14, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** 2005 — Millennial Grid: hoodies, baggy jeans, business casual. */
function build2005(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['2005'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('2005', af);

  // Hood sitting behind / above the head.
  const accGeo = box(0.26, 0.20, 0.12, 0, 1.55, -0.10);

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.15, 1.58), material: hairMat },
    torso: { geometry: box(0.44, 0.60, 0.28, 0, 1.18, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.22, 0.90, 0.22, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.22, 0.90, 0.22, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.15, 0.55, 0.15, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.15, 0.55, 0.15, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** 2025 — Smart City: athleisure, smart glasses, neutral palette. */
function build2025(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['2025'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('2025', af);

  // Smart glasses — thin bar across the face at eye level.
  const accGeo = box(0.18, 0.05, 0.04, 0, 1.57, 0.12);

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.13, 1.57), material: hairMat },
    torso: { geometry: box(0.38, 0.50, 0.22, 0, 1.22, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.14, 0.90, 0.14, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.14, 0.90, 0.14, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.11, 0.50, 0.12, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.11, 0.50, 0.12, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** 2055 — Skybound: flowing techwear, glow strips, AR visors. */
function build2055(af: PedestrianAssetFactory): Record<PartId, PedestrianPart> {
  const f = ERA_CLOTHING_FINISH['2055'];
  const skinMat = whiteMat(0.7, 0.0);
  const hairMat = whiteMat(0.8, 0.0);
  const torsoMat = whiteMat(f.rough, f.metal);
  const legMat = whiteMat(f.rough, f.metal);
  const armMat = whiteMat(f.rough, f.metal);
  const accMat = prepareAccessoryMat('2055', af);

  // AR visor across the eyes + two glow strips on the torso.
  const visor = box(0.22, 0.07, 0.04, 0, 1.57, 0.12);
  const strip1 = box(0.34, 0.02, 0.02, 0, 1.30, 0.12);
  const strip2 = box(0.34, 0.02, 0.02, 0, 1.05, 0.12);
  const accGeo = mergeAndDispose([visor, strip1, strip2], '2055 accessory');

  return {
    head: { geometry: sphereGeo(0.12, 1.55), material: skinMat },
    hair: { geometry: domeGeo(0.11, 1.56), material: hairMat },
    torso: { geometry: box(0.40, 0.62, 0.22, 0, 1.20, 0), material: torsoMat },
    legL: { geometry: hangingBox(0.15, 0.92, 0.16, 0, 0), material: legMat },
    legR: { geometry: hangingBox(0.15, 0.92, 0.16, 0, 0), material: legMat },
    armL: { geometry: hangingBox(0.12, 0.52, 0.13, 0, 0), material: armMat },
    armR: { geometry: hangingBox(0.12, 0.52, 0.13, 0, 0), material: armMat },
    accessory: { geometry: accGeo, material: accMat },
  };
}

/** Dispatch table from EraId to its body-part builder. */
const ERA_BUILDERS: Record<EraId, (af: PedestrianAssetFactory) => Record<PartId, PedestrianPart>> = {
  '1945': build1945,
  '1965': build1965,
  '1985': build1985,
  '2005': build2005,
  '2025': build2025,
  '2055': build2055,
};

// ---------------------------------------------------------------------------
// Internal: build one era's instanced-mesh layer
// ---------------------------------------------------------------------------

/** Create a configured InstancedMesh for one body part. */
function makeInstancedMesh(part: PedestrianPart): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(part.geometry, part.material, PEDESTRIAN_COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = true;
  mesh.geometry.boundingSphere = SIDEWALK_BOUNDS;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Build the eight instanced meshes for one era and tint per-instance colours. */
function buildEraLayer(era: EraId, af: PedestrianAssetFactory): EraLayer {
  const parts = ERA_BUILDERS[era](af);
  const palette = ERA_PALETTE[era];

  const meshes: Record<PartId, THREE.InstancedMesh> = {
    head: makeInstancedMesh(parts.head),
    hair: makeInstancedMesh(parts.hair),
    torso: makeInstancedMesh(parts.torso),
    legL: makeInstancedMesh(parts.legL),
    legR: makeInstancedMesh(parts.legR),
    armL: makeInstancedMesh(parts.armL),
    armR: makeInstancedMesh(parts.armR),
    accessory: makeInstancedMesh(parts.accessory),
  };

  // Per-instance colours: cycle each palette across the population.
  const c = new THREE.Color();
  for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
    c.setHex(palette.skin[i % palette.skin.length]);
    meshes.head.setColorAt(i, c);

    c.setHex(palette.hair[i % palette.hair.length]);
    meshes.hair.setColorAt(i, c);

    c.setHex(palette.torso[i % palette.torso.length]);
    meshes.torso.setColorAt(i, c);

    c.setHex(palette.legs[i % palette.legs.length]);
    meshes.legL.setColorAt(i, c);
    meshes.legR.setColorAt(i, c);

    c.setHex(palette.arms[i % palette.arms.length]);
    meshes.armL.setColorAt(i, c);
    meshes.armR.setColorAt(i, c);

    c.setHex(palette.accessory[i % palette.accessory.length]);
    meshes.accessory.setColorAt(i, c);
  }

  // Flush instance-colour buffers.
  for (const partId of PART_IDS) {
    const mesh = meshes[partId];
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  // Collect unique materials for opacity crossfade + disposal.
  const matSet = new Set<THREE.MeshStandardMaterial>();
  for (const partId of PART_IDS) {
    matSet.add(parts[partId].material);
  }

  return { meshes, materials: Array.from(matSet) };
}

// ---------------------------------------------------------------------------
// Internal: closed-loop sidewalk spline
// ---------------------------------------------------------------------------

/**
 * Build the closed stadium-shaped sidewalk loop the pedestrians walk. Sits
 * inside the road loop so pedestrians appear on the pavement between the
 * street and the buildings.
 */
function buildSidewalkCurve(): THREE.CatmullRomCurve3 {
  const points = [
    new THREE.Vector3(-22, 0, -13),
    new THREE.Vector3(0, 0, -16),
    new THREE.Vector3(22, 0, -13),
    new THREE.Vector3(25, 0, 0),
    new THREE.Vector3(22, 0, 13),
    new THREE.Vector3(0, 0, 16),
    new THREE.Vector3(-22, 0, 13),
    new THREE.Vector3(-25, 0, 0),
  ];
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
}

// ---------------------------------------------------------------------------
// createPedestrianSystem
// ---------------------------------------------------------------------------

/**
 * Create the era-distinct pedestrian system.
 *
 * @param eraState     Shared era controller. Era transitions trigger a ~1.2s
 *                     crossfade between the outgoing and incoming era layers.
 * @param assetFactory Procedural asset factory (only makeMaterial is used).
 */
export function createPedestrianSystem(
  eraState: EraState,
  assetFactory: PedestrianAssetFactory,
): PedestrianSystem {
  const group = new THREE.Group();
  group.name = 'pedestrians';

  // Build one layer per era and parent every instanced mesh to the group.
  const layers: Record<EraId, EraLayer> = {} as Record<EraId, EraLayer>;
  for (const id of ERA_IDS) {
    const layer = buildEraLayer(id, assetFactory);
    layers[id] = layer;
    for (const partId of PART_IDS) {
      group.add(layer.meshes[partId]);
    }
  }

  // Sidewalk path + cached length for constant-speed arc-length travel.
  const curve = buildSidewalkCurve();
  const totalLength = curve.getLength();
  const spacing = totalLength / PEDESTRIAN_COUNT;

  // Per-pedestrian arc-length distance along the loop + walk-cycle phase.
  const distances = new Float64Array(PEDESTRIAN_COUNT);
  const phases = new Float32Array(PEDESTRIAN_COUNT);
  for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
    distances[i] = i * spacing;
    phases[i] = (i / PEDESTRIAN_COUNT) * Math.PI * 2;
  }

  // Pre-allocated per-frame scratch (never re-created in update).
  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpHeading = new THREE.Quaternion();
  const tmpSwing = new THREE.Quaternion();
  const tmpLimbLocal = new THREE.Matrix4();

  // Per-pedestrian computed matrices (written to every visible layer).
  const bodyMats: THREE.Matrix4[] = [];
  const legLMats: THREE.Matrix4[] = [];
  const legRMats: THREE.Matrix4[] = [];
  const armLMats: THREE.Matrix4[] = [];
  const armRMats: THREE.Matrix4[] = [];
  for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
    bodyMats.push(new THREE.Matrix4());
    legLMats.push(new THREE.Matrix4());
    legRMats.push(new THREE.Matrix4());
    armLMats.push(new THREE.Matrix4());
    armRMats.push(new THREE.Matrix4());
  }

  // Crossfade state.
  let activeEra: EraId = eraState.getEraId();
  let prevEra: EraId = activeEra;
  let transitioning = false;
  let transitionT = 0;
  let elapsed = 0;

  // Initial visibility: only the starting era is shown.
  for (const id of ERA_IDS) {
    const isActive = id === activeEra;
    const layer = layers[id];
    for (const partId of PART_IDS) {
      layer.meshes[partId].visible = isActive;
    }
    for (const mat of layer.materials) {
      mat.opacity = isActive ? 1 : 0;
    }
  }

  // React to era changes by kicking off a fresh crossfade.
  const unsubscribe = eraState.subscribe((update) => {
    if (update.eraId !== activeEra) {
      prevEra = activeEra;
      activeEra = update.eraId;
      transitioning = true;
      transitionT = 0;
    }
  });

  /** Advance positions and compute all per-pedestrian matrices (allocation-free). */
  function computeMatrices(step: number): void {
    for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
      distances[i] += WALK_SPEED * step;
      let u = distances[i] / totalLength;
      u -= Math.floor(u); // wrap into [0, 1)

      curve.getPointAt(u, tmpPos);
      curve.getTangentAt(u, tmpTan);
      tmpTan.normalize();

      // Heading: align +Z to the path tangent (smooth turn at corners).
      tmpHeading.setFromUnitVectors(FORWARD, tmpTan);

      // Walk cycle: sine-driven limb swing + body bob.
      const walkT = elapsed * WALK_FREQ + phases[i];
      const swing = Math.sin(walkT) * SWING_AMPLITUDE;
      const bob = Math.abs(Math.sin(walkT)) * BOB_AMPLITUDE;

      // Body matrix (position + heading + bob).
      tmpPos.y += bob;
      bodyMats[i].compose(tmpPos, tmpHeading, UNIT_SCALE);

      // Left leg: swing forward.
      tmpSwing.setFromAxisAngle(X_AXIS, swing);
      tmpLimbLocal.compose(HIP_L, tmpSwing, UNIT_SCALE);
      legLMats[i].copy(bodyMats[i]).multiply(tmpLimbLocal);

      // Right leg: swing backward (opposite phase).
      tmpSwing.setFromAxisAngle(X_AXIS, -swing);
      tmpLimbLocal.compose(HIP_R, tmpSwing, UNIT_SCALE);
      legRMats[i].copy(bodyMats[i]).multiply(tmpLimbLocal);

      // Left arm: opposite to left leg.
      tmpSwing.setFromAxisAngle(X_AXIS, -swing);
      tmpLimbLocal.compose(SHOULDER_L, tmpSwing, UNIT_SCALE);
      armLMats[i].copy(bodyMats[i]).multiply(tmpLimbLocal);

      // Right arm: opposite to right leg.
      tmpSwing.setFromAxisAngle(X_AXIS, swing);
      tmpLimbLocal.compose(SHOULDER_R, tmpSwing, UNIT_SCALE);
      armRMats[i].copy(bodyMats[i]).multiply(tmpLimbLocal);
    }
  }

  /** Write the cached matrices into a layer's eight instanced meshes. */
  function writeToLayer(layer: EraLayer): void {
    for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
      const bm = bodyMats[i];
      for (const partId of BODY_PART_IDS) {
        layer.meshes[partId].setMatrixAt(i, bm);
      }
      layer.meshes.legL.setMatrixAt(i, legLMats[i]);
      layer.meshes.legR.setMatrixAt(i, legRMats[i]);
      layer.meshes.armL.setMatrixAt(i, armLMats[i]);
      layer.meshes.armR.setMatrixAt(i, armRMats[i]);
    }
    for (const partId of PART_IDS) {
      layer.meshes[partId].instanceMatrix.needsUpdate = true;
    }
  }

  function update(dt: number): void {
    const step = Math.min(Math.max(dt, 0), 0.1);
    elapsed += step;

    // Compute per-pedestrian matrices once.
    computeMatrices(step);

    // Advance the crossfade timer and update only the relevant layers.
    if (transitioning) {
      transitionT += step / FADE_SECONDS;
      const finished = transitionT >= 1;
      if (finished) {
        transitionT = 1;
        transitioning = false;
      }

      // Crossfade: update only the two participating layers.
      const prevLayer = layers[prevEra];
      const prevOpacity = 1 - transitionT;
      for (const partId of PART_IDS) prevLayer.meshes[partId].visible = prevOpacity > 0;
      for (const mat of prevLayer.materials) mat.opacity = prevOpacity;
      writeToLayer(prevLayer);

      const activeLayer = layers[activeEra];
      for (const partId of PART_IDS) activeLayer.meshes[partId].visible = true;
      for (const mat of activeLayer.materials) mat.opacity = transitionT;
      writeToLayer(activeLayer);

      if (finished) {
        for (const partId of PART_IDS) prevLayer.meshes[partId].visible = false;
      }
    } else {
      // Steady state: only update the active era layer.
      // Inactive era layers are already invisible and skipped entirely.
      writeToLayer(layers[activeEra]);
    }
  }

  function dispose(): void {
    unsubscribe();
    for (const id of ERA_IDS) {
      const layer = layers[id];
      for (const partId of PART_IDS) {
        const mesh = layer.meshes[partId];
        group.remove(mesh);
        mesh.geometry.dispose();
      }
      for (const mat of layer.materials) {
        mat.dispose();
      }
    }
  }

  return { group, update, dispose };
}
