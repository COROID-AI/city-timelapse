/**
 * Parametric era-detailed building generator.
 *
 * Builds one parametric building per lot from BlockLayout, with heavy
 * era-driven detail: facade material (brick → concrete/glass → glass/steel →
 * eco-glass), windows (size, grid, lit/unlit, reflective glass evolving by
 * era), entrances (doors, canopies, revolving doors), balconies (where
 * era-appropriate), rooftop details (water tanks, antennas, satellite dishes,
 * AC units, solar panels, green roofs, drone pads, smart antennae), and
 * era-specific fire escapes + storefront framing on the ground floor.
 *
 * Uses InstancedMesh for repeated windows/balconies and shared materials to
 * keep draw calls low. Buildings register with TransitionManager and morph /
 * scale / re-skin per era — never rebuilding the scene graph. A clearly
 * defined ground-floor slot is reserved on each building for storefront
 * signage (delegated to the storefront task).
 */

import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import {
  ERA_KEYS,
  lerp,
  lerpHex,
  type ApplyEraFn,
  type EraKey,
} from '../eras/eraConfig.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A buildable lot produced by BlockLayout. BuildingGenerator places exactly one
 * building per lot, matching its footprint and center. When BlockLayout is not
 * yet available, `createDefaultLots()` supplies a placeholder set.
 */
export interface Lot {
  /** Lot center X (world). */
  cx: number;
  /** Lot center Z (world). */
  cz: number;
  /** Footprint width along X (world units). */
  width: number;
  /** Footprint depth along Z (world units). */
  depth: number;
  /** Optional Y-rotation of the footprint (radians). Usually 0. */
  rotationY?: number;
}

/**
 * A reserved ground-floor slot handed off to the storefront task. The storefront
 * task fills this volume with era-appropriate signage; the building generator
 * only creates the surrounding structural frame.
 */
export interface StorefrontSlot {
  /** World-space center of the slot [x, y, z]. */
  position: [number, number, number];
  /** Interior width along the facade face. */
  width: number;
  /** Interior height from ground. */
  height: number;
  /** Facing direction as a Y rotation (radians). */
  rotationY: number;
  /** Parent building group (storefront elements attach here). */
  buildingGroup: Group;
}

/** Return value of `createBuildings`. */
export interface BuildingSystem {
  /** Root group containing all buildings. Add this to the scene. */
  group: Group;
  /** TransitionManager-compatible era callback. Register with `registerDomain`. */
  applyEra: ApplyEraFn;
  /** One storefront slot per building, for the storefront task to consume. */
  storefrontSlots: StorefrontSlot[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Height of the ground-floor storefront band (world units). Constant across eras. */
export const STOREFRONT_SLOT_HEIGHT = 3.5;

/** Design height for fire-escape geometry (scaled to match each building). */
const FIRE_ESCAPE_DESIGN_HEIGHT = 22;

// ---------------------------------------------------------------------------
// Per-era building style data
// ---------------------------------------------------------------------------

/** Rooftop detail archetype identifiers. */
type RooftopType =
  | 'water_tank'
  | 'antenna'
  | 'satellite'
  | 'ac_unit'
  | 'solar'
  | 'green_roof'
  | 'drone_pad'
  | 'smart_antenna';

/** Facade material descriptor per era. */
interface FacadeStyle {
  primaryColor: string;
  secondaryColor: string;
  roughness: number;
  metalness: number;
}

/** Window/grid descriptor per era. */
interface WindowStyle {
  width: number;
  height: number;
  gap: number;
  litFraction: number;
  glassColor: string;
  litColor: string;
  glassRoughness: number;
  glassMetalness: number;
  litIntensity: number;
}

/** Complete per-era building style — drives all geometry and material choices. */
interface BuildingEraStyle {
  facade: FacadeStyle;
  windows: WindowStyle;
  entrance: { canopy: boolean; revolving: boolean };
  balconies: { enabled: boolean; density: number };
  rooftop: RooftopType[];
  fireEscape: boolean;
  floors: { min: number; max: number };
  floorHeight: number;
}

/** The era → style mapping. This is the architectural source of truth. */
const BUILDING_ERA_STYLES: Record<EraKey, BuildingEraStyle> = {
  '1945': {
    facade: {
      primaryColor: '#8a7a66',
      secondaryColor: '#6e6052',
      roughness: 0.92,
      metalness: 0.0,
    },
    windows: {
      width: 1.1, height: 1.6, gap: 0.7,
      litFraction: 0.3,
      glassColor: '#3a4a52', litColor: '#ffd8a0',
      glassRoughness: 0.35, glassMetalness: 0.5,
      litIntensity: 1.8,
    },
    entrance: { canopy: true, revolving: false },
    balconies: { enabled: false, density: 0 },
    rooftop: ['water_tank'],
    fireEscape: true,
    floors: { min: 2, max: 5 },
    floorHeight: 3.4,
  },
  '1965': {
    facade: {
      primaryColor: '#c9c2b6',
      secondaryColor: '#9aa7b0',
      roughness: 0.7,
      metalness: 0.1,
    },
    windows: {
      width: 1.5, height: 1.8, gap: 0.4,
      litFraction: 0.35,
      glassColor: '#5a7080', litColor: '#ffe8b0',
      glassRoughness: 0.2, glassMetalness: 0.6,
      litIntensity: 2.0,
    },
    entrance: { canopy: true, revolving: false },
    balconies: { enabled: true, density: 0.3 },
    rooftop: ['antenna'],
    fireEscape: true,
    floors: { min: 4, max: 9 },
    floorHeight: 3.3,
  },
  '1985': {
    facade: {
      primaryColor: '#6f7479',
      secondaryColor: '#8a8f96',
      roughness: 0.6,
      metalness: 0.2,
    },
    windows: {
      width: 1.7, height: 2.0, gap: 0.3,
      litFraction: 0.4,
      glassColor: '#4a5a68', litColor: '#ffc890',
      glassRoughness: 0.15, glassMetalness: 0.7,
      litIntensity: 2.2,
    },
    entrance: { canopy: true, revolving: false },
    balconies: { enabled: true, density: 0.4 },
    rooftop: ['antenna', 'satellite', 'ac_unit'],
    fireEscape: true,
    floors: { min: 6, max: 13 },
    floorHeight: 3.2,
  },
  '2005': {
    facade: {
      primaryColor: '#4a6f8a',
      secondaryColor: '#6d92ad',
      roughness: 0.3,
      metalness: 0.5,
    },
    windows: {
      width: 2.0, height: 2.4, gap: 0.2,
      litFraction: 0.45,
      glassColor: '#6d92ad', litColor: '#fff0c8',
      glassRoughness: 0.05, glassMetalness: 0.9,
      litIntensity: 2.0,
    },
    entrance: { canopy: true, revolving: true },
    balconies: { enabled: true, density: 0.5 },
    rooftop: ['satellite', 'ac_unit'],
    fireEscape: false,
    floors: { min: 8, max: 18 },
    floorHeight: 3.2,
  },
  '2025': {
    facade: {
      primaryColor: '#5a8f7a',
      secondaryColor: '#88b0a0',
      roughness: 0.25,
      metalness: 0.4,
    },
    windows: {
      width: 2.2, height: 2.6, gap: 0.15,
      litFraction: 0.4,
      glassColor: '#88b0a0', litColor: '#fff8d0',
      glassRoughness: 0.03, glassMetalness: 0.95,
      litIntensity: 1.8,
    },
    entrance: { canopy: true, revolving: true },
    balconies: { enabled: true, density: 0.4 },
    rooftop: ['solar', 'green_roof', 'ac_unit'],
    fireEscape: false,
    floors: { min: 7, max: 16 },
    floorHeight: 3.2,
  },
  '2055': {
    facade: {
      primaryColor: '#1e3a5f',
      secondaryColor: '#2d6a9f',
      roughness: 0.12,
      metalness: 0.7,
    },
    windows: {
      width: 2.5, height: 3.0, gap: 0.1,
      litFraction: 0.35,
      glassColor: '#2d6a9f', litColor: '#9fffe0',
      glassRoughness: 0.02, glassMetalness: 1.0,
      litIntensity: 2.2,
    },
    entrance: { canopy: true, revolving: true },
    balconies: { enabled: true, density: 0.6 },
    rooftop: ['drone_pad', 'smart_antenna', 'solar', 'green_roof'],
    fireEscape: false,
    floors: { min: 12, max: 30 },
    floorHeight: 3.3,
  },
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Shared materials created once and reused across all buildings. */
interface SharedMaterials {
  windowGlass: MeshStandardMaterial;
  windowLit: MeshStandardMaterial;
  balcony: MeshStandardMaterial;
  entrance: MeshStandardMaterial;
  storefrontFrame: MeshStandardMaterial;
  detailMetal: MeshStandardMaterial;
  detailGlass: MeshStandardMaterial;
  detailGreen: MeshStandardMaterial;
  detailTech: MeshStandardMaterial;
}

/** A single window placement on a facade face. */
interface WindowPlacement {
  x: number;
  y: number;
  z: number;
  rotY: number;
  lit: boolean;
}

/** A single balcony placement. */
interface BalconyPlacement {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/** One rooftop detail instance with its type and local XZ position. */
interface RooftopItem {
  type: RooftopType;
  mesh: Object3D;
  localX: number;
  localZ: number;
}

/** Everything needed to drive era transitions for one building. */
interface BuildingParts {
  group: Group;
  lot: Lot;
  seed: number;
  colorIdx: number;
  w: number;
  d: number;

  shell: Mesh;
  roofSlab: Mesh;
  facadeMat: MeshStandardMaterial;

  windows: InstancedMesh;
  litWindows: InstancedMesh;
  maxWindows: number;

  entrance: Group;
  door: Mesh;
  canopy: Mesh;
  revolving: Mesh;

  balconies: InstancedMesh;
  maxBalconies: number;

  rooftopItems: RooftopItem[];

  fireEscape: Group;

  storefrontSlot: StorefrontSlot;

  eraHeights: Record<EraKey, number>;
}

/** Maps a rooftop detail type to its shared material key. */
const ROOFTOP_MATERIAL_KEY: Record<RooftopType, keyof SharedMaterials> = {
  water_tank: 'detailMetal',
  antenna: 'detailMetal',
  ac_unit: 'detailMetal',
  solar: 'detailGlass',
  green_roof: 'detailGreen',
  satellite: 'detailTech',
  drone_pad: 'detailTech',
  smart_antenna: 'detailTech',
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) so a lot's building is identical every run. */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash lot coordinates + index into a stable seed. */
function hashSeed(cx: number, cz: number, idx: number): number {
  return ((Math.floor(cx * 73856093) ^ Math.floor(cz * 19349663) ^ (idx * 83492791)) >>> 0) || 1;
}

/**
 * Deterministic lit-state hash for a window at a given grid position.
 * Uses integer indices so the lit pattern stays stable as building height
 * interpolates between eras (only the topmost row flickers).
 */
function litHash(seed: number, faceIdx: number, floorIdx: number, colIdx: number): number {
  const h = (seed * 73 + faceIdx * 17 + floorIdx * 31 + colIdx * 13) >>> 0;
  let t = h;
  t = (t ^ 61) ^ (t >>> 16);
  t = t + (t << 3);
  t = t ^ (t >>> 4);
  t = Math.imul(t, 0x27d4eb2d);
  t = t ^ (t >>> 15);
  return (t >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Era height computation
// ---------------------------------------------------------------------------

/**
 * Pre-compute the total height of this building in every era. A single
 * `sizeFactor` (deterministic per lot) ensures relative building sizes stay
 * consistent across eras while the city grows taller over time.
 */
function computeEraHeights(seed: number): Record<EraKey, number> {
  const rng = createRng(seed + 999);
  const sizeFactor = 0.25 + rng() * 0.75;
  const heights = {} as Record<EraKey, number>;
  for (const era of ERA_KEYS) {
    const style = BUILDING_ERA_STYLES[era];
    const floors = Math.round(lerp(style.floors.min, style.floors.max, sizeFactor));
    heights[era] = STOREFRONT_SLOT_HEIGHT + Math.max(1, floors) * style.floorHeight;
  }
  return heights;
}

// ---------------------------------------------------------------------------
// Window grid computation
// ---------------------------------------------------------------------------

/** Compute window placements for a building at the given interpolated height. */
function computeWindowGrid(
  w: number,
  d: number,
  totalHeight: number,
  winW: number,
  winH: number,
  winGap: number,
  litFraction: number,
  seed: number,
): WindowPlacement[] {
  const placements: WindowPlacement[] = [];
  const usableHeight = totalHeight - STOREFRONT_SLOT_HEIGHT;
  if (usableHeight <= 1) return placements;
  const floorH = 3.3;
  const floors = Math.max(1, Math.floor(usableHeight / floorH));

  const faces = [
    { fw: w, cx: 0, cz: d / 2, rotY: 0 },
    { fw: w, cx: 0, cz: -d / 2, rotY: Math.PI },
    { fw: d, cx: w / 2, cz: 0, rotY: Math.PI / 2 },
    { fw: d, cx: -w / 2, cz: 0, rotY: -Math.PI / 2 },
  ];

  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx];
    const margin = Math.max(winGap, 0.5);
    const usable = face.fw - 2 * margin;
    if (usable < winW) continue;
    const cols = Math.max(1, Math.floor(usable / (winW + winGap)));
    const span = cols * winW + (cols - 1) * winGap;
    const startLocal = -span / 2 + winW / 2;

    for (let floorIdx = 0; floorIdx < floors; floorIdx++) {
      const y = STOREFRONT_SLOT_HEIGHT + floorIdx * floorH + floorH * 0.5;
      if (y > totalHeight - winH * 0.6) break;

      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const local = startLocal + colIdx * (winW + winGap);
        let x = face.cx;
        let z = face.cz;
        // For front/back faces, local offset maps to X; for side faces, to Z.
        if (faceIdx < 2) {
          x += local;
        } else {
          z += local;
        }
        placements.push({
          x, y, z, rotY: face.rotY,
          lit: litHash(seed, faceIdx, floorIdx, colIdx) < litFraction,
        });
      }
    }
  }
  return placements;
}

/** Compute balcony placements for a building. */
function computeBalconyGrid(
  w: number,
  d: number,
  totalHeight: number,
  density: number,
  seed: number,
): BalconyPlacement[] {
  const placements: BalconyPlacement[] = [];
  const usableHeight = totalHeight - STOREFRONT_SLOT_HEIGHT;
  if (usableHeight <= 1) return placements;
  const floorH = 3.3;
  const floors = Math.max(1, Math.floor(usableHeight / floorH));

  // Balconies only on front and back faces.
  const faces = [
    { cx: 0, cz: d / 2, rotY: 0 },
    { cx: 0, cz: -d / 2, rotY: Math.PI },
  ];

  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx];
    for (let floorIdx = 1; floorIdx < floors; floorIdx++) {
      // Deterministic per-floor balcony decision.
      const decision = litHash(seed + 500, faceIdx, floorIdx, 0);
      if (decision >= density) continue;
      const y = STOREFRONT_SLOT_HEIGHT + floorIdx * floorH + floorH * 0.1;
      // Span a few balcony segments across the face.
      const segments = Math.max(1, Math.floor(w / 2.5));
      for (let s = 0; s < segments; s++) {
        const x = face.cx + (s - (segments - 1) / 2) * 2.5;
        placements.push({ x, y, z: face.cz, rotY: face.rotY });
      }
    }
  }
  return placements;
}

// ---------------------------------------------------------------------------
// Rooftop detail factories
// ---------------------------------------------------------------------------

/** Wooden water tank with conical top and legs — iconic 1945 rooftop. */
function createWaterTank(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const tank = new Mesh(new CylinderGeometry(0.7, 0.7, 1.0, 8), mat);
  tank.position.y = 0.8;
  tank.castShadow = true;
  g.add(tank);
  const cap = new Mesh(new ConeGeometry(0.75, 0.45, 8), mat);
  cap.position.y = 1.5;
  cap.castShadow = true;
  g.add(cap);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const leg = new Mesh(new BoxGeometry(0.08, 0.4, 0.08), mat);
    leg.position.set(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6);
    g.add(leg);
  }
  return g;
}

/** Tall lattice antenna with crossbars — 1965+ rooftop. */
function createAntenna(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const pole = new Mesh(new CylinderGeometry(0.04, 0.06, 4, 6), mat);
  pole.position.y = 2;
  pole.castShadow = true;
  g.add(pole);
  for (let i = 0; i < 3; i++) {
    const bar = new Mesh(new BoxGeometry(0.7, 0.04, 0.04), mat);
    bar.position.y = 1.2 + i * 1.1;
    g.add(bar);
  }
  return g;
}

/** Tilted satellite dish — 1985+ rooftop. */
function createSatellite(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const arm = new Mesh(new BoxGeometry(0.06, 0.7, 0.06), mat);
  arm.position.y = 0.35;
  g.add(arm);
  const dish = new Mesh(new CircleGeometry(0.75, 12), mat);
  dish.position.y = 0.75;
  dish.rotation.x = -Math.PI / 3;
  dish.castShadow = true;
  g.add(dish);
  return g;
}

/** Squat HVAC unit with fan circle — 1985+ rooftop. */
function createAcUnit(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const box = new Mesh(new BoxGeometry(1.4, 0.5, 0.8), mat);
  box.position.y = 0.25;
  box.castShadow = true;
  g.add(box);
  const fan = new Mesh(new CircleGeometry(0.18, 10), mat);
  fan.position.set(0, 0.25, 0.41);
  g.add(fan);
  return g;
}

/** Tilted solar panel on a stand — 2025+ rooftop. */
function createSolar(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const stand = new Mesh(new BoxGeometry(0.08, 0.4, 0.08), mat);
  stand.position.y = 0.2;
  g.add(stand);
  const panel = new Mesh(new PlaneGeometry(1.8, 1.0), mat);
  panel.position.y = 0.55;
  panel.rotation.x = -Math.PI / 6;
  panel.castShadow = true;
  g.add(panel);
  return g;
}

/** Flat green roof patch — 2025+ rooftop. */
function createGreenRoof(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const patch = new Mesh(new PlaneGeometry(2.5, 2.5), mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.05;
  g.add(patch);
  return g;
}

/** Circular drone landing pad with beacon — 2055 rooftop. */
function createDronePad(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const pad = new Mesh(new CircleGeometry(1.1, 16), mat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.05;
  pad.castShadow = true;
  g.add(pad);
  const beacon = new Mesh(new CylinderGeometry(0.04, 0.04, 0.5, 6), mat);
  beacon.position.y = 0.3;
  g.add(beacon);
  return g;
}

/** Sleek smart antenna with dish array — 2055 rooftop. */
function createSmartAntenna(mat: MeshStandardMaterial): Object3D {
  const g = new Group();
  const pole = new Mesh(new CylinderGeometry(0.05, 0.08, 2.2, 8), mat);
  pole.position.y = 1.1;
  pole.castShadow = true;
  g.add(pole);
  const dish = new Mesh(new SphereGeometry(0.25, 8, 4), mat);
  dish.position.set(0.15, 1.7, 0);
  dish.scale.set(1, 0.3, 1);
  g.add(dish);
  return g;
}

const ROOFTOP_FACTORIES: Record<RooftopType, (mat: MeshStandardMaterial) => Object3D> = {
  water_tank: createWaterTank,
  antenna: createAntenna,
  satellite: createSatellite,
  ac_unit: createAcUnit,
  solar: createSolar,
  green_roof: createGreenRoof,
  drone_pad: createDronePad,
  smart_antenna: createSmartAntenna,
};

// ---------------------------------------------------------------------------
// Entrance + fire escape + storefront frame construction
// ---------------------------------------------------------------------------

function createEntrance(_w: number, d: number, mat: MeshStandardMaterial): {
  group: Group; door: Mesh; canopy: Mesh; revolving: Mesh;
} {
  const group = new Group();
  const frontZ = d / 2;

  const door = new Mesh(new BoxGeometry(1.8, 2.6, 0.1), mat);
  door.position.set(0, 1.3, frontZ + 0.03);
  door.castShadow = true;
  group.add(door);

  const canopy = new Mesh(new BoxGeometry(3.2, 0.15, 1.4), mat);
  canopy.position.set(0, 2.9, frontZ + 0.6);
  canopy.castShadow = true;
  group.add(canopy);

  const revolving = new Mesh(new CylinderGeometry(0.85, 0.85, 2.4, 8), mat);
  revolving.position.set(0, 1.2, frontZ + 0.35);
  revolving.castShadow = true;
  revolving.visible = false;
  group.add(revolving);

  return { group, door, canopy, revolving };
}

function createFireEscape(w: number, mat: MeshStandardMaterial): Group {
  const group = new Group();
  const sideX = -w / 2;
  const platDepth = 1.0;

  for (let i = 0; i < 7; i++) {
    const y = STOREFRONT_SLOT_HEIGHT + 1 + i * 3;
    const platform = new Mesh(new BoxGeometry(platDepth, 0.08, 3), mat);
    platform.position.set(sideX - platDepth / 2 - 0.1, y, 0);
    platform.castShadow = true;
    group.add(platform);

    for (let j = -1; j <= 1; j++) {
      const rail = new Mesh(new BoxGeometry(0.04, 0.9, 0.04), mat);
      rail.position.set(sideX - platDepth - 0.12, y + 0.45, j * 1.2);
      group.add(rail);
    }

    if (i < 6) {
      const stair = new Mesh(new BoxGeometry(0.7, 0.06, 3), mat);
      stair.position.set(sideX - 0.55, y + 1.5, 0);
      stair.rotation.z = Math.PI / 7;
      group.add(stair);
    }
  }

  const pipe = new Mesh(new CylinderGeometry(0.04, 0.04, 22, 6), mat);
  pipe.position.set(sideX - platDepth - 0.12, 12, 1.5);
  group.add(pipe);
  return group;
}

function createStorefrontFrame(
  w: number,
  d: number,
  mat: MeshStandardMaterial,
  group: Group,
): StorefrontSlot {
  const slotW = Math.min(w * 0.72, 5.5);
  const slotH = STOREFRONT_SLOT_HEIGHT * 0.82;

  // Top transom bar above the storefront band.
  const topBar = new Mesh(new BoxGeometry(w + 0.3, 0.25, 0.2), mat);
  topBar.position.set(0, STOREFRONT_SLOT_HEIGHT - 0.05, d / 2 + 0.02);
  topBar.castShadow = true;
  group.add(topBar);

  // Side mullions for wider buildings.
  if (w > 5) {
    for (const side of [-1, 1]) {
      const mullion = new Mesh(new BoxGeometry(0.22, slotH, 0.15), mat);
      mullion.position.set(side * (slotW / 2 + 0.11), slotH / 2, d / 2 + 0.03);
      group.add(mullion);
    }
  }

  // Bottom sill.
  const sill = new Mesh(new BoxGeometry(slotW + 0.4, 0.12, 0.12), mat);
  sill.position.set(0, 0.06, d / 2 + 0.03);
  group.add(sill);

  return {
    position: [0, slotH / 2, d / 2 + 0.06],
    width: slotW,
    height: slotH,
    rotationY: 0,
    buildingGroup: group,
  };
}

// ---------------------------------------------------------------------------
// Shared material creation
// ---------------------------------------------------------------------------

function createSharedMaterials(): SharedMaterials {
  return {
    windowGlass: new MeshStandardMaterial({
      color: '#5a7080', roughness: 0.1, metalness: 0.8,
    }),
    windowLit: new MeshStandardMaterial({
      color: '#000000',
      emissive: '#ffd8a0',
      emissiveIntensity: 2.0,
      roughness: 0.4,
      metalness: 0.0,
    }),
    balcony: new MeshStandardMaterial({
      color: '#8a8f96', roughness: 0.6, metalness: 0.3,
    }),
    entrance: new MeshStandardMaterial({
      color: '#3c3f44', roughness: 0.5, metalness: 0.3,
    }),
    storefrontFrame: new MeshStandardMaterial({
      color: '#4a443c', roughness: 0.7, metalness: 0.2,
    }),
    detailMetal: new MeshStandardMaterial({
      color: '#5a5e62', roughness: 0.55, metalness: 0.6,
    }),
    detailGlass: new MeshStandardMaterial({
      color: '#1a3a6a', roughness: 0.15, metalness: 0.85,
      emissive: '#0a2a5a', emissiveIntensity: 0.4,
    }),
    detailGreen: new MeshStandardMaterial({
      color: '#4a7a4a', roughness: 0.85, metalness: 0.0,
    }),
    detailTech: new MeshStandardMaterial({
      color: '#b0b8c0', roughness: 0.3, metalness: 0.7,
    }),
  };
}

// ---------------------------------------------------------------------------
// Single building construction
// ---------------------------------------------------------------------------

/** Collect every possible rooftop type across all eras (for pre-allocation). */
const ALL_ROOFTOP_TYPES: RooftopType[] = [
  'water_tank', 'antenna', 'satellite', 'ac_unit',
  'solar', 'green_roof', 'drone_pad', 'smart_antenna',
];

/** Build one parametric building at a lot, returning all mutable parts. */
function buildBuilding(lot: Lot, idx: number, shared: SharedMaterials): BuildingParts {
  const w = lot.width;
  const d = lot.depth;
  const seed = hashSeed(lot.cx, lot.cz, idx);
  const rng = createRng(seed);
  const colorIdx = rng() < 0.5 ? 0 : 1;
  const eraHeights = computeEraHeights(seed);

  const group = new Group();
  group.position.set(lot.cx, 0, lot.cz);
  if (lot.rotationY) group.rotation.y = lot.rotationY;
  group.name = `building-${idx}`;

  // --- Facade material (per-building for color variation) ---
  const facadeMat = new MeshStandardMaterial({
    color: '#888888', roughness: 0.5, metalness: 0.2,
  });

  // --- Shell (unit box, scaled per era) ---
  const shell = new Mesh(new BoxGeometry(1, 1, 1), facadeMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // --- Roof slab (parapet cap) ---
  const roofSlab = new Mesh(new BoxGeometry(1, 0.3, 1), facadeMat);
  roofSlab.castShadow = true;
  roofSlab.receiveShadow = true;
  group.add(roofSlab);

  // --- Windows (InstancedMesh, shared glass material) ---
  // Compute max window count across all eras for this building.
  let maxWindows = 1;
  for (const era of ERA_KEYS) {
    const ws = BUILDING_ERA_STYLES[era].windows;
    const grid = computeWindowGrid(w, d, eraHeights[era], ws.width, ws.height, ws.gap, 0, seed);
    maxWindows = Math.max(maxWindows, grid.length);
  }

  const winGeo = new BoxGeometry(1, 1, 1);
  const windows = new InstancedMesh(winGeo, shared.windowGlass, maxWindows);
  windows.castShadow = true;
  windows.frustumCulled = false;
  windows.count = 0;
  group.add(windows);

  const litWindows = new InstancedMesh(winGeo, shared.windowLit, maxWindows);
  litWindows.frustumCulled = false;
  litWindows.count = 0;
  group.add(litWindows);

  // --- Entrance ---
  const entrance = createEntrance(w, d, shared.entrance);
  group.add(entrance.group);

  // --- Balconies ---
  let maxBalconies = 1;
  for (const era of ERA_KEYS) {
    const bs = BUILDING_ERA_STYLES[era].balconies;
    if (bs.enabled) {
      const grid = computeBalconyGrid(w, d, eraHeights[era], bs.density, seed);
      maxBalconies = Math.max(maxBalconies, grid.length);
    }
  }
  const balconies = new InstancedMesh(new BoxGeometry(1, 0.1, 1), shared.balcony, maxBalconies);
  balconies.castShadow = true;
  balconies.frustumCulled = false;
  balconies.count = 0;
  group.add(balconies);

  // --- Rooftop details (pre-create all possible types, toggle per era) ---
  const rooftopItems: RooftopItem[] = [];
  for (const type of ALL_ROOFTOP_TYPES) {
    // 1–3 instances per type, scattered on the roof.
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const detailMesh = ROOFTOP_FACTORIES[type](shared[ROOFTOP_MATERIAL_KEY[type]]);
      const localX = (rng() - 0.5) * (w * 0.7);
      const localZ = (rng() - 0.5) * (d * 0.7);
      detailMesh.position.set(localX, 0, localZ);
      detailMesh.scale.setScalar(0);
      group.add(detailMesh);
      rooftopItems.push({ type, mesh: detailMesh, localX, localZ });
    }
  }

  // --- Fire escape ---
  const fireEscape = createFireEscape(w, shared.detailMetal);
  fireEscape.scale.setScalar(0);
  group.add(fireEscape);

  // --- Storefront frame (structural) + slot for signage ---
  const storefrontSlot = createStorefrontFrame(w, d, shared.storefrontFrame, group);

  return {
    group, lot, seed, colorIdx, w, d,
    shell, roofSlab, facadeMat,
    windows, litWindows, maxWindows,
    entrance: entrance.group, door: entrance.door, canopy: entrance.canopy,
    revolving: entrance.revolving,
    balconies, maxBalconies,
    rooftopItems,
    fireEscape,
    storefrontSlot,
    eraHeights,
  };
}

// ---------------------------------------------------------------------------
// Era transition — per-building application
// ---------------------------------------------------------------------------

/**
 * Build the per-frame `applyEra` callback for all buildings. During a cross-fade
 * it interpolates height, facade color/PBR, window glass appearance, and
 * recomputes window/balcony grids. Rooftop details, fire escapes, and entrance
 * elements cross-fade their visibility by scaling in/out.
 */
function createBuildingsApplyEra(parts: BuildingParts[], shared: SharedMaterials): ApplyEraFn {
  const dummy = new Object3D();

  return (toKey: EraKey, t: number, fromKey: EraKey) => {
    const fromStyle = BUILDING_ERA_STYLES[fromKey];
    const toStyle = BUILDING_ERA_STYLES[toKey];
    const fw = fromStyle.windows;
    const tw = toStyle.windows;

    // --- Shared glass material interpolation ---
    shared.windowGlass.color.set(lerpHex(fw.glassColor, tw.glassColor, t));
    shared.windowGlass.roughness = lerp(fw.glassRoughness, tw.glassRoughness, t);
    shared.windowGlass.metalness = lerp(fw.glassMetalness, tw.glassMetalness, t);

    // --- Shared lit-window emissive interpolation ---
    shared.windowLit.emissive.set(lerpHex(fw.litColor, tw.litColor, t));
    shared.windowLit.emissiveIntensity = lerp(fw.litIntensity, tw.litIntensity, t);

    for (const p of parts) {
      // --- Height interpolation ---
      const height = lerp(p.eraHeights[fromKey], p.eraHeights[toKey], t);

      // --- Shell scale + position ---
      p.shell.scale.set(p.w, height, p.d);
      p.shell.position.y = height / 2;
      p.roofSlab.scale.set(p.w + 0.3, 1, p.d + 0.3);
      p.roofSlab.position.y = height + 0.15;

      // --- Facade material interpolation ---
      const fF = fromStyle.facade;
      const tF = toStyle.facade;
      const fromColor = colorIdx(fF, p.colorIdx);
      const toColor = colorIdx(tF, p.colorIdx);
      p.facadeMat.color.set(lerpHex(fromColor, toColor, t));
      p.facadeMat.roughness = lerp(fF.roughness, tF.roughness, t);
      p.facadeMat.metalness = lerp(fF.metalness, tF.metalness, t);

      // --- Window grid recompute ---
      const winW = lerp(fw.width, tw.width, t);
      const winH = lerp(fw.height, tw.height, t);
      const winGap = lerp(fw.gap, tw.gap, t);
      const litFraction = lerp(fw.litFraction, tw.litFraction, t);

      const grid = computeWindowGrid(p.w, p.d, height, winW, winH, winGap, litFraction, p.seed);

      for (let i = 0; i < grid.length && i < p.maxWindows; i++) {
        const wp = grid[i];
        dummy.position.set(wp.x, wp.y, wp.z);
        dummy.rotation.set(0, wp.rotY, 0);
        dummy.scale.set(winW, winH, 0.15);
        dummy.updateMatrix();
        p.windows.setMatrixAt(i, dummy.matrix);
      }
      p.windows.count = Math.min(grid.length, p.maxWindows);
      p.windows.instanceMatrix.needsUpdate = true;

      // --- Lit window subset ---
      let litIdx = 0;
      for (let i = 0; i < grid.length && i < p.maxWindows; i++) {
        const wp = grid[i];
        if (!wp.lit) continue;
        dummy.position.set(
          wp.x + Math.sin(wp.rotY) * 0.1,
          wp.y,
          wp.z + Math.cos(wp.rotY) * 0.1,
        );
        dummy.rotation.set(0, wp.rotY, 0);
        dummy.scale.set(winW * 0.82, winH * 0.82, 0.05);
        dummy.updateMatrix();
        p.litWindows.setMatrixAt(litIdx, dummy.matrix);
        litIdx++;
      }
      p.litWindows.count = litIdx;
      p.litWindows.instanceMatrix.needsUpdate = true;

      // --- Balcony grid recompute ---
      const fromBalcony = fromStyle.balconies;
      const toBalcony = toStyle.balconies;
      const balconyDensity = lerp(fromBalcony.density, toBalcony.density, t);
      const balconyEnabled = fromBalcony.enabled || toBalcony.enabled;
      if (balconyEnabled) {
        const bGrid = computeBalconyGrid(p.w, p.d, height, balconyDensity, p.seed);
        for (let i = 0; i < bGrid.length && i < p.maxBalconies; i++) {
          const bp = bGrid[i];
          dummy.position.set(
            bp.x + Math.sin(bp.rotY) * 0.35,
            bp.y,
            bp.z + Math.cos(bp.rotY) * 0.35,
          );
          dummy.rotation.set(0, bp.rotY, 0);
          dummy.scale.set(1.8, 1, 0.7);
          dummy.updateMatrix();
          p.balconies.setMatrixAt(i, dummy.matrix);
        }
        p.balconies.count = Math.min(bGrid.length, p.maxBalconies);
      } else {
        p.balconies.count = 0;
      }
      p.balconies.instanceMatrix.needsUpdate = true;

      // --- Entrance elements ---
      const canopyInFrom = fromStyle.entrance.canopy;
      const canopyInTo = toStyle.entrance.canopy;
      p.canopy.visible = canopyInFrom || canopyInTo;
      p.canopy.scale.y = visibilityScale(canopyInFrom, canopyInTo, t);

      const revInFrom = fromStyle.entrance.revolving;
      const revInTo = toStyle.entrance.revolving;
      p.revolving.visible = revInFrom || revInTo;
      p.revolving.scale.setScalar(visibilityScale(revInFrom, revInTo, t));

      // --- Fire escape ---
      const feInFrom = fromStyle.fireEscape;
      const feInTo = toStyle.fireEscape;
      const feScale = visibilityScale(feInFrom, feInTo, t);
      p.fireEscape.visible = feScale > 0.01;
      p.fireEscape.scale.set(1, feScale * (height / FIRE_ESCAPE_DESIGN_HEIGHT), 1);

      // --- Rooftop details ---
      for (const item of p.rooftopItems) {
        const inFrom = fromStyle.rooftop.includes(item.type);
        const inTo = toStyle.rooftop.includes(item.type);
        const s = visibilityScale(inFrom, inTo, t);
        item.mesh.visible = s > 0.01;
        item.mesh.position.set(item.localX, height + 0.15, item.localZ);
        item.mesh.scale.setScalar(s);
      }
    }
  };
}

/** Resolve which facade color (primary/secondary) to use by index. */
function colorIdx(style: FacadeStyle, idx: number): string {
  return idx === 0 ? style.primaryColor : style.secondaryColor;
}

/**
 * Compute a cross-fade visibility scale for an element that may be present in
 * the source era, destination era, both, or neither.
 * - In both: fully visible (1).
 * - Only in destination: grows in (t).
 * - Only in source: shrinks out (1 − t).
 * - In neither: hidden (0).
 */
function visibilityScale(inFrom: boolean, inTo: boolean, t: number): number {
  if (inFrom && inTo) return 1;
  if (!inFrom && inTo) return t;
  if (inFrom && !inTo) return 1 - t;
  return 0;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Create parametric era-detailed buildings on the given lots.
 *
 * Each lot gets one building with era-driven facade, windows, entrance,
 * balconies, rooftop details, fire escape, and a reserved storefront slot.
 * Returns a group to add to the scene, an `applyEra` callback to register with
 * TransitionManager, and the list of storefront slots for the storefront task.
 */
export function createBuildings(lots: Lot[]): BuildingSystem {
  const shared = createSharedMaterials();
  const parts = lots.map((lot, i) => buildBuilding(lot, i, shared));

  const group = new Group();
  group.name = 'buildings';
  for (const p of parts) {
    group.add(p.group);
  }

  const applyEra = createBuildingsApplyEra(parts, shared);
  const storefrontSlots = parts.map((p) => p.storefrontSlot);

  return { group, applyEra, storefrontSlots };
}

// ---------------------------------------------------------------------------
// Default lot layout (placeholder for BlockLayout)
// ---------------------------------------------------------------------------

/**
 * Placeholder lot layout matching the 50×50 block footprint. Eight buildings
 * ring the block perimeter, leaving a cross-shaped street pattern through the
 * center. Each building faces the block interior. When BlockLayout is
 * available, pass its lots to `createBuildings` instead.
 */
export function createDefaultLots(): Lot[] {
  return [
    { cx: -14, cz: -14, width: 9, depth: 9 },
    { cx: 0, cz: -15, width: 10, depth: 8 },
    { cx: 14, cz: -14, width: 9, depth: 9 },
    { cx: -15, cz: 0, width: 8, depth: 10 },
    { cx: 15, cz: 0, width: 8, depth: 10 },
    { cx: -14, cz: 14, width: 9, depth: 9 },
    { cx: 0, cz: 15, width: 10, depth: 8 },
    { cx: 14, cz: 14, width: 9, depth: 9 },
  ];
}
