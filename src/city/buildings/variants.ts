/**
 * Era-evolving building variants: canonical block alignment constants, the
 * corner lot definitions, per-era facade/roof treatment tables, and the shared
 * per-module build context (materials, memoized geometry, seeded jitter).
 *
 * Everything here is pinned to the block-assembly contract so this module stays
 * parallel-safe with the other city phases:
 * - road surface at y=0, each street 12 units wide,
 * - curb height 0.15, sidewalk width 3 with its top at y=0.15,
 * - storefront bay slots every 6 units along each ground floor with a 5-unit
 *   clear bay width and a base at y=0.15.
 *
 * The two crossing streets occupy `|x| < 6` and `|z| < 6`, so every building
 * frontage line sits exactly `6 + 3 = 9` units from a street centerline —
 * flush against the sidewalk, never over the road or sidewalk itself.
 */

import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../../gfx/materials';

// ---------------------------------------------------------------------------
// Canonical block alignment (do not move without the assembly contract)
// ---------------------------------------------------------------------------

export const BLOCK_ALIGNMENT = {
  /** Road surface height. */
  roadY: 0,
  /** Each street is this many units wide. */
  streetWidth: 12,
  /** Curb height above the road surface. */
  curbHeight: 0.15,
  /** Sidewalk band width between curb and building frontage. */
  sidewalkWidth: 3,
  /** Sidewalk walking surface height (also the building base level). */
  sidewalkTopY: 0.15,
  /** Storefront bay slot pitch along every ground floor. */
  baySlotPitch: 6,
  /** Clear opening width of one storefront bay. */
  bayClearWidth: 5,
  /** Base height of every storefront bay opening. */
  bayBaseY: 0.15,
} as const;

/** Half street width: the road edge distance from a street centerline. */
export const STREET_HALF_WIDTH = BLOCK_ALIGNMENT.streetWidth / 2;

/** Distance from a street centerline to the building frontage line (6 + 3). */
export const FRONTAGE_LINE = STREET_HALF_WIDTH + BLOCK_ALIGNMENT.sidewalkWidth;

// ---------------------------------------------------------------------------
// Era year vocabulary (structural mirror of the era-transform contract)
// ---------------------------------------------------------------------------

/** The five timeline years this domain morphs across. */
export const BUILDING_ERAS = [1945, 1965, 1985, 2005, 2025] as const;

/** One timeline year addressable by the buildings module. */
export type BuildingEraYear = (typeof BUILDING_ERAS)[number];

/**
 * Adjacent-era crossfade frame. Structurally identical to the era contract's
 * `EraBlend` so building transformables compose with the real registry.
 * `fraction` is the weight of `to`; `from` carries `1 - fraction`.
 */
export interface BuildingEraBlend {
  readonly from: BuildingEraYear;
  readonly to: BuildingEraYear;
  readonly fraction: number;
}

/** Index of an era year in chronological order (unknown years fall back to 0). */
export function eraIndexOf(year: BuildingEraYear): number {
  const index = BUILDING_ERAS.indexOf(year);
  return index === -1 ? 0 : index;
}

/** Clamp to 0..1 with a NaN-safe fallback of 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Linear interpolation between two numbers. */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Per-era weights for one blend frame: `from` carries `1 - fraction`, `to`
 * carries `fraction`; at an interior rest stop the current era carries 1.
 */
export function eraWeightMap(blend: BuildingEraBlend): Map<BuildingEraYear, number> {
  const weights = new Map<BuildingEraYear, number>(BUILDING_ERAS.map((year) => [year, 0]));
  const fraction = clamp01(blend.fraction);
  weights.set(blend.from, (weights.get(blend.from) ?? 0) + (1 - fraction));
  weights.set(blend.to, (weights.get(blend.to) ?? 0) + fraction);
  return weights;
}

/**
 * Stage-local refinement weight for detail elements (awnings, roof props).
 *
 * Opacity crossfades always use the raw era weight so nothing pops at rest;
 * this helper lets secondary detail lag the facade surfaces within the same
 * choreography stage while remaining exactly equal to the raw weight whenever
 * the frame is settled (`progress === 1`) or fully on one era end (`w` 0 or 1).
 */
export function detailWeight(weight: number, progress: number): number {
  const w = clamp01(weight);
  const p = clamp01(progress);
  return w * (p + (1 - p) * w);
}

// ---------------------------------------------------------------------------
// Vertical rhythm shared by every building
// ---------------------------------------------------------------------------

/** Floor-to-floor story height for upper stories. */
export const STORY_HEIGHT = 3.2;
/** Center height of the first upper-story window row. */
export const FIRST_WINDOW_Y = 4.9;
/** Clear zone reserved between the last window row and the roofline. */
export const ROOF_ZONE = 1.4;
/** Height of the ground-floor storefront opening (base 0.15 -> head 3.45). */
export const STOREFRONT_OPENING_HEIGHT = 3.3;
/** Parapet/crown height used by every era roofline. */
export const PARAPET_HEIGHT = 0.75;
/** Shared facade texture repeat for masonry/concrete skins. */
export const WALL_TEXTURE_REPEAT: readonly [number, number] = [4, 3];

/** How many window rows fit below a given massing height. */
export function windowRowsFor(height: number, windowHalfHeight: number): number {
  const usable = height - FIRST_WINDOW_Y - windowHalfHeight - ROOF_ZONE;
  return Math.max(1, Math.floor(usable / STORY_HEIGHT) + 1);
}

// ---------------------------------------------------------------------------
// Frontage geometry helpers
// ---------------------------------------------------------------------------

export type FrontFacing = 'north' | 'south' | 'east' | 'west';

/** One street-facing ground-floor frontage of a lot. */
export interface LotFrontage {
  /** Outward direction the frontage faces. */
  facing: FrontFacing;
  /** World coordinate where bay slots start along the frontage axis. */
  slotStart: number;
  /** Number of 6-unit bay slots on this frontage (span = bays * 6). */
  bays: number;
}

/** Resolved frontage placement in building-local coordinates. */
export interface FrontGeometry {
  facing: FrontFacing;
  /** Local axis the bay slots run along. */
  axis: 'x' | 'z';
  /** Local plane coordinate of the facade face (z for N/S, x for E/W). */
  plane: number;
  /** Index into a position tuple for the plane axis (2 for z, 0 for x). */
  planeIndex: 0 | 2;
  /** Outward unit normal. */
  normal: readonly [number, number, number];
  /** Y rotation that maps a +Z-facing element outward along the normal. */
  rotationY: number;
  /** Local span start/end along the slot axis. */
  spanStart: number;
  spanEnd: number;
}

/** One lot: an era-stable footprint that lines the block corner. */
export interface BuildingLot {
  id: string;
  name: string;
  /** World-space footprint bounds; footprints never morph across eras. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Street-facing frontages carrying storefront bays. */
  fronts: readonly LotFrontage[];
  /** Main entrance: index into `fronts` plus the bay slot on that front. */
  entrance: { front: number; slot: number };
  /** Total height above y=0 per era year — the era-varying massing. */
  massing: Record<BuildingEraYear, number>;
  /** Whether the 1945 skin carries a faded ghost-sign remnant. */
  ghostSign: boolean;
}

/** Lot footprint width along x. */
export function lotWidth(lot: BuildingLot): number {
  return lot.x1 - lot.x0;
}

/** Lot footprint depth along z. */
export function lotDepth(lot: BuildingLot): number {
  return lot.z1 - lot.z0;
}

/** Local center of a lot footprint along x. */
export function lotCenterX(lot: BuildingLot): number {
  return (lot.x0 + lot.x1) / 2;
}

/** Local center of a lot footprint along z. */
export function lotCenterZ(lot: BuildingLot): number {
  return (lot.z0 + lot.z1) / 2;
}

/** Resolve a frontage into building-local placement data. */
export function frontGeometryFor(lot: BuildingLot, front: LotFrontage): FrontGeometry {
  const cx = lotCenterX(lot);
  const cz = lotCenterZ(lot);
  switch (front.facing) {
    case 'south':
      return {
        facing: 'south',
        axis: 'x',
        plane: lot.z0 - cz,
        planeIndex: 2,
        normal: [0, 0, -1],
        rotationY: Math.PI,
        spanStart: lot.x0 - cx,
        spanEnd: lot.x1 - cx,
      };
    case 'north':
      return {
        facing: 'north',
        axis: 'x',
        plane: lot.z1 - cz,
        planeIndex: 2,
        normal: [0, 0, 1],
        rotationY: 0,
        spanStart: lot.x0 - cx,
        spanEnd: lot.x1 - cx,
      };
    case 'west':
      return {
        facing: 'west',
        axis: 'z',
        plane: lot.x0 - cx,
        planeIndex: 0,
        normal: [-1, 0, 0],
        rotationY: -Math.PI / 2,
        spanStart: lot.z0 - cz,
        spanEnd: lot.z1 - cz,
      };
    case 'east':
    default:
      return {
        facing: 'east',
        axis: 'z',
        plane: lot.x1 - cx,
        planeIndex: 0,
        normal: [1, 0, 0],
        rotationY: Math.PI / 2,
        spanStart: lot.z0 - cz,
        spanEnd: lot.z1 - cz,
      };
  }
}

/** World-space start coordinate of bay slot `index` on a frontage. */
export function slotCenterWorld(front: LotFrontage, index: number): number {
  return front.slotStart + index * BLOCK_ALIGNMENT.baySlotPitch + BLOCK_ALIGNMENT.baySlotPitch / 2;
}

/** Building-local coordinate of bay slot `index` along the frontage axis. */
export function slotCenterLocal(
  front: LotFrontage,
  index: number,
  lot: BuildingLot,
): number {
  const world = slotCenterWorld(front, index);
  return front.facing === 'south' || front.facing === 'north'
    ? world - lotCenterX(lot)
    : world - lotCenterZ(lot);
}

/** Smallest massing height of a lot — the common base volume. */
export function baseHeightFor(lot: BuildingLot): number {
  let min = Infinity;
  for (const era of BUILDING_ERAS) min = Math.min(min, lot.massing[era]);
  return Number.isFinite(min) ? min : 10;
}

/** Top section height (above the common base) for one era. */
export function topHeightFor(lot: BuildingLot, era: BuildingEraYear): number {
  return Math.max(0, lot.massing[era] - baseHeightFor(lot));
}

// ---------------------------------------------------------------------------
// Corner lot registry — six to eight buildings lining the block corner
// ---------------------------------------------------------------------------

/**
 * Seven lots arranged as an L around the street intersection: three along the
 * east-west street, three along the north-south street, plus one across the
 * street so the corner reads from every approach. Every frontage line sits on
 * the sidewalk edge (|9| units from its street centerline).
 */
export const BUILDING_LOTS: readonly BuildingLot[] = [
  {
    id: 'meridian-corner',
    name: 'Meridian Corner Block',
    x0: FRONTAGE_LINE,
    x1: FRONTAGE_LINE + 18,
    z0: FRONTAGE_LINE,
    z1: FRONTAGE_LINE + 12,
    fronts: [
      { facing: 'south', slotStart: FRONTAGE_LINE, bays: 3 },
      { facing: 'west', slotStart: FRONTAGE_LINE, bays: 2 },
    ],
    entrance: { front: 0, slot: 1 },
    massing: { 1945: 15, 1965: 17, 1985: 19, 2005: 24, 2025: 26 },
    ghostSign: true,
  },
  {
    id: 'foundry-loft',
    name: 'Foundry Loft',
    x0: FRONTAGE_LINE + 18,
    x1: FRONTAGE_LINE + 36,
    z0: FRONTAGE_LINE,
    z1: FRONTAGE_LINE + 15,
    fronts: [{ facing: 'south', slotStart: FRONTAGE_LINE + 18, bays: 3 }],
    entrance: { front: 0, slot: 0 },
    massing: { 1945: 12, 1965: 14, 1985: 16, 2005: 18, 2025: 21 },
    ghostSign: true,
  },
  {
    id: 'harbor-works',
    name: 'Harbor Works Hall',
    x0: FRONTAGE_LINE + 36,
    x1: FRONTAGE_LINE + 54,
    z0: FRONTAGE_LINE,
    z1: FRONTAGE_LINE + 15,
    fronts: [{ facing: 'south', slotStart: FRONTAGE_LINE + 36, bays: 3 }],
    entrance: { front: 0, slot: 1 },
    massing: { 1945: 18, 1965: 18, 1985: 20, 2005: 20, 2025: 24 },
    ghostSign: true,
  },
  {
    id: 'canal-house',
    name: 'Canal House',
    x0: FRONTAGE_LINE,
    x1: FRONTAGE_LINE + 18,
    z0: FRONTAGE_LINE + 12,
    z1: FRONTAGE_LINE + 30,
    fronts: [{ facing: 'west', slotStart: FRONTAGE_LINE + 12, bays: 3 }],
    entrance: { front: 0, slot: 1 },
    massing: { 1945: 14, 1965: 16, 1985: 15, 2005: 19, 2025: 22 },
    ghostSign: false,
  },
  {
    id: 'eastline-tower',
    name: 'Eastline Tower',
    x0: FRONTAGE_LINE,
    x1: FRONTAGE_LINE + 15,
    z0: FRONTAGE_LINE + 30,
    z1: FRONTAGE_LINE + 48,
    fronts: [{ facing: 'west', slotStart: FRONTAGE_LINE + 30, bays: 3 }],
    entrance: { front: 0, slot: 0 },
    massing: { 1945: 10, 1965: 18, 1985: 22, 2005: 26, 2025: 30 },
    ghostSign: false,
  },
  {
    id: 'lantern-corner',
    name: 'Lantern Corner',
    x0: -(FRONTAGE_LINE + 18),
    x1: -FRONTAGE_LINE,
    z0: FRONTAGE_LINE,
    z1: FRONTAGE_LINE + 12,
    fronts: [
      { facing: 'south', slotStart: -(FRONTAGE_LINE + 18), bays: 3 },
      { facing: 'east', slotStart: FRONTAGE_LINE, bays: 2 },
    ],
    entrance: { front: 1, slot: 0 },
    massing: { 1945: 16, 1965: 16, 1985: 18, 2005: 22, 2025: 25 },
    ghostSign: true,
  },
  {
    id: 'northgate-block',
    name: 'Northgate Block',
    x0: -(FRONTAGE_LINE + 36),
    x1: -(FRONTAGE_LINE + 18),
    z0: FRONTAGE_LINE,
    z1: FRONTAGE_LINE + 15,
    fronts: [{ facing: 'south', slotStart: -(FRONTAGE_LINE + 36), bays: 3 }],
    entrance: { front: 0, slot: 2 },
    massing: { 1945: 11, 1965: 13, 1985: 17, 2005: 19, 2025: 23 },
    ghostSign: true,
  },
];

/** Pastel panel tints handed out to the 1965 cleaned-masonry treatment. */
export const PASTEL_TINTS: readonly string[] = [
  '#b9d8c8',
  '#f0cfae',
  '#cfd9ea',
  '#efd6dd',
  '#d8e2c2',
  '#cfe0e8',
  '#e8dcc2',
];

// ---------------------------------------------------------------------------
// Per-era treatment tables
// ---------------------------------------------------------------------------

export type AwningStyle = 'iron-hood' | 'fabric-slope' | 'glass-canopy';
export type WindowAcMode = 'none' | 'some' | 'few';

export interface EraWindowStyle {
  /** Opening width of one window (uniform instanced repetition). */
  width: number;
  /** Opening height of one window. */
  height: number;
  /** Panes tall / wide — multi-pane sashes in early eras, sealed panes later. */
  rows: number;
  columns: number;
  frameThickness: number;
  mullionThickness: number;
  /** Frame material category: painted wood early, aluminum/steel later. */
  frameCategory: BuildingMaterialCategory;
}

export interface EraCorniceStyle {
  height: number;
  depth: number;
  tiers: number;
  dentils: boolean;
  category: BuildingMaterialCategory;
}

/** The rooftop world one era leaves on every building. */
export interface EraRoofWorld {
  waterTanks: number;
  chimneys: number;
  vents: number;
  hvacUnits: number;
  satelliteDishes: number;
  cellGear: number;
  antennas: number;
  billboard: boolean;
  solarArrays: boolean;
  greenTerrace: boolean;
  skylights: number;
}

export interface EraTreatment {
  year: BuildingEraYear;
  /** Wall skin category; the gfx palette shifts it per era. */
  wallCategory: BuildingMaterialCategory;
  /** Optional multiply tint (1965 pastel panels). */
  wallTint?: string;
  /** Upper-volume skin: masonry early, curtain-wall glass from 2005. */
  topCategory: BuildingMaterialCategory;
  parapetCategory: BuildingMaterialCategory;
  window: EraWindowStyle;
  /** Decorative lintels above windows (close-up masonry detail). */
  windowLintels: boolean;
  cornice: EraCorniceStyle;
  storefrontCategory: BuildingMaterialCategory;
  doorCategory: BuildingMaterialCategory;
  doorPanels: number;
  doorTransom: boolean;
  doorDouble: boolean;
  awning: AwningStyle;
  /** Window air-conditioner prevalence before central HVAC takes over. */
  windowAc: WindowAcMode;
  /** Iron fire escapes exist through 1965, then phase out. */
  fireEscape: boolean;
  roof: EraRoofWorld;
}

/** Material categories are the shared gfx palette vocabulary. */
export type BuildingMaterialCategory =
  | 'masonryConcrete'
  | 'metal'
  | 'glass'
  | 'wood'
  | 'fabric'
  | 'paintSignage'
  | 'neonEmissive'
  | 'asphaltStone'
  | 'grimeSoil';

/**
 * Authoritative era treatments:
 * - 1945 sooty brick, ornate dentil cornices, multi-pane sashes, ghost signs,
 *   iron fire escapes, wooden water tanks and brick chimneys,
 * - 1965 cleaned masonry with pastel panels, simpler coping, window ACs,
 * - 1985 concrete with tinted sealed glazing, roof HVAC, dishes, billboards,
 * - 2005 blue glass curtain wall with steel, central HVAC, cell gear, antennas,
 * - 2025 green terraces with photovoltaic roofs and low-iron glass.
 */
export const ERA_TREATMENTS: Readonly<Record<BuildingEraYear, EraTreatment>> = Object.freeze({
  1945: {
    year: 1945,
    wallCategory: 'masonryConcrete',
    topCategory: 'masonryConcrete',
    parapetCategory: 'masonryConcrete',
    window: {
      width: 1.8,
      height: 2.2,
      rows: 3,
      columns: 2,
      frameThickness: 0.09,
      mullionThickness: 0.035,
      frameCategory: 'wood',
    },
    windowLintels: true,
    cornice: { height: 0.85, depth: 0.55, tiers: 3, dentils: true, category: 'masonryConcrete' },
    storefrontCategory: 'wood',
    doorCategory: 'wood',
    doorPanels: 4,
    doorTransom: true,
    doorDouble: false,
    awning: 'iron-hood',
    windowAc: 'none',
    fireEscape: true,
    roof: {
      waterTanks: 1,
      chimneys: 2,
      vents: 2,
      hvacUnits: 0,
      satelliteDishes: 0,
      cellGear: 0,
      antennas: 1,
      billboard: false,
      solarArrays: false,
      greenTerrace: false,
      skylights: 0,
    },
  },
  1965: {
    year: 1965,
    wallCategory: 'masonryConcrete',
    wallTint: undefined, // resolved per building from PASTEL_TINTS
    topCategory: 'masonryConcrete',
    parapetCategory: 'masonryConcrete',
    window: {
      width: 2.0,
      height: 2.3,
      rows: 2,
      columns: 2,
      frameThickness: 0.07,
      mullionThickness: 0.03,
      frameCategory: 'metal',
    },
    windowLintels: true,
    cornice: { height: 0.5, depth: 0.4, tiers: 2, dentils: false, category: 'masonryConcrete' },
    storefrontCategory: 'wood',
    doorCategory: 'wood',
    doorPanels: 2,
    doorTransom: true,
    doorDouble: false,
    awning: 'fabric-slope',
    windowAc: 'some',
    fireEscape: true,
    roof: {
      waterTanks: 1,
      chimneys: 1,
      vents: 2,
      hvacUnits: 1,
      satelliteDishes: 0,
      cellGear: 0,
      antennas: 1,
      billboard: false,
      solarArrays: false,
      greenTerrace: false,
      skylights: 0,
    },
  },
  1985: {
    year: 1985,
    wallCategory: 'masonryConcrete',
    topCategory: 'masonryConcrete',
    parapetCategory: 'masonryConcrete',
    window: {
      width: 3.0,
      height: 2.4,
      rows: 1,
      columns: 2,
      frameThickness: 0.06,
      mullionThickness: 0.035,
      frameCategory: 'metal',
    },
    windowLintels: false,
    cornice: { height: 0.6, depth: 0.35, tiers: 2, dentils: false, category: 'masonryConcrete' },
    storefrontCategory: 'masonryConcrete',
    doorCategory: 'metal',
    doorPanels: 2,
    doorTransom: false,
    doorDouble: false,
    awning: 'fabric-slope',
    windowAc: 'few',
    fireEscape: false,
    roof: {
      waterTanks: 0,
      chimneys: 1,
      vents: 2,
      hvacUnits: 3,
      satelliteDishes: 2,
      cellGear: 0,
      antennas: 1,
      billboard: true,
      solarArrays: false,
      greenTerrace: false,
      skylights: 1,
    },
  },
  2005: {
    year: 2005,
    wallCategory: 'masonryConcrete',
    topCategory: 'glass',
    parapetCategory: 'metal',
    window: {
      width: 4.4,
      height: 2.9,
      rows: 1,
      columns: 1,
      frameThickness: 0.05,
      mullionThickness: 0.04,
      frameCategory: 'metal',
    },
    windowLintels: false,
    cornice: { height: 0.35, depth: 0.3, tiers: 1, dentils: false, category: 'metal' },
    storefrontCategory: 'metal',
    doorCategory: 'glass',
    doorPanels: 0,
    doorTransom: false,
    doorDouble: true,
    awning: 'glass-canopy',
    windowAc: 'none',
    fireEscape: false,
    roof: {
      waterTanks: 0,
      chimneys: 0,
      vents: 2,
      hvacUnits: 3,
      satelliteDishes: 1,
      cellGear: 1,
      antennas: 2,
      billboard: true,
      solarArrays: false,
      greenTerrace: false,
      skylights: 1,
    },
  },
  2025: {
    year: 2025,
    wallCategory: 'masonryConcrete',
    topCategory: 'glass',
    parapetCategory: 'masonryConcrete',
    window: {
      width: 4.6,
      height: 3.0,
      rows: 1,
      columns: 1,
      frameThickness: 0.04,
      mullionThickness: 0.035,
      frameCategory: 'metal',
    },
    windowLintels: false,
    cornice: { height: 0.5, depth: 0.4, tiers: 1, dentils: false, category: 'masonryConcrete' },
    storefrontCategory: 'metal',
    doorCategory: 'glass',
    doorPanels: 0,
    doorTransom: false,
    doorDouble: true,
    awning: 'glass-canopy',
    windowAc: 'none',
    fireEscape: false,
    roof: {
      waterTanks: 0,
      chimneys: 0,
      vents: 1,
      hvacUnits: 1,
      satelliteDishes: 0,
      cellGear: 0,
      antennas: 1,
      billboard: false,
      solarArrays: true,
      greenTerrace: true,
      skylights: 1,
    },
  },
});

/** Resolve the wall tint a lot uses for the 1965 pastel-panel treatment. */
export function pastelTintFor(lotIndex: number): string {
  return PASTEL_TINTS[((lotIndex % PASTEL_TINTS.length) + PASTEL_TINTS.length) % PASTEL_TINTS.length];
}

// ---------------------------------------------------------------------------
// Shared era layer bookkeeping
// ---------------------------------------------------------------------------

/** One era-owned visual layer (a group plus every material it animates). */
export interface EraLayerView {
  readonly era: BuildingEraYear;
  readonly group: THREE.Group;
  readonly materials: readonly THREE.MeshStandardMaterial[];
}

/** Below this weight a layer is fully hidden (never pops, never z-fights). */
export const LAYER_EPSILON = 0.004;

/**
 * Apply an era weight to a layer: hide it entirely below the epsilon and
 * scale every material's rest opacity by the weight for a smooth crossfade.
 */
export function applyLayerWeight(layer: EraLayerView, weight: number): void {
  const w = clamp01(weight);
  layer.group.visible = w > LAYER_EPSILON;
  for (const material of layer.materials) {
    const base = typeof material.userData.baseOpacity === 'number' ? material.userData.baseOpacity : 1;
    material.opacity = base * w;
  }
}

// ---------------------------------------------------------------------------
// Material cache — real gfx library materials, era-keyed, shared module-wide
// ---------------------------------------------------------------------------

export interface BuildingMaterialOptions {
  /** Multiply tint applied to the palette swatch color. */
  tint?: string;
  seed?: number;
  repeatX?: number;
  repeatY?: number;
  roughness?: number;
  metalness?: number;
  /** Rest-state opacity (defaults to 0.85 for glass, 1 otherwise). */
  baseOpacity?: number;
}

/**
 * The subset of the procedural gfx library this module composes with. Typed
 * off the real library object so tests can pass a spied wrapper of the real
 * functions and prove composition.
 */
export type BuildingsGfxLibrary = Pick<
  typeof ProceduralGfxLibrary,
  | 'createEraMaterial'
  | 'createWindowGridGeometry'
  | 'createCorniceGeometry'
  | 'createLintelGeometry'
  | 'createDoorGeometry'
  | 'createFireEscapeGeometry'
  | 'createRoofAccessoryGeometry'
  | 'createBeveledBoxGeometry'
  | 'mergeBufferGeometries'
  | 'createInstancedMesh'
  | 'setInstanceTransform'
  | 'setInstanceColor'
  | 'createPRNG'
>;

export interface BuildingMaterialCache {
  get(
    era: BuildingEraYear,
    category: BuildingMaterialCategory,
    options?: BuildingMaterialOptions,
  ): THREE.MeshStandardMaterial;
  readonly all: readonly THREE.MeshStandardMaterial[];
  dispose(): void;
}

/**
 * Create the era-keyed material cache.
 *
 * Every material is transparent up front so opacity crossfades never trigger a
 * shader recompile (no popping), and carries an era-indexed polygon offset so
 * coincident skins from different eras never z-fight while both are visible
 * during a crossfade.
 */
export function createBuildingMaterialCache(
  library: BuildingsGfxLibrary,
): BuildingMaterialCache {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const all: THREE.MeshStandardMaterial[] = [];

  const get = (
    era: BuildingEraYear,
    category: BuildingMaterialCategory,
    options: BuildingMaterialOptions = {},
  ): THREE.MeshStandardMaterial => {
    const baseOpacity =
      options.baseOpacity ?? (category === 'glass' ? 0.85 : 1);
    const key = [
      era,
      category,
      options.tint ?? '',
      options.seed ?? '',
      options.repeatX ?? '',
      options.repeatY ?? '',
      options.roughness ?? '',
      options.metalness ?? '',
      baseOpacity,
    ].join('|');
    const existing = cache.get(key);
    if (existing) return existing;

    const material = library.createEraMaterial(category, era, {
      seed: options.seed ?? era,
      repeatX: options.repeatX ?? 1,
      repeatY: options.repeatY ?? 1,
      roughness: options.roughness,
      metalness: options.metalness,
      transparent: true,
      opacity: baseOpacity,
    });
    if (options.tint) {
      material.color.multiply(new THREE.Color(options.tint));
    }
    const eraIndex = eraIndexOf(era);
    material.transparent = true;
    material.userData.baseOpacity = baseOpacity;
    material.userData.era = era;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -(1 + eraIndex);
    material.polygonOffsetUnits = -(1 + eraIndex) * 2;
    // Translucent glazing must not occlude the frames drawn behind it; opaque
    // "glass" uses (solar panels) keep writing depth.
    material.depthWrite = baseOpacity >= 1;

    cache.set(key, material);
    all.push(material);
    return material;
  };

  return {
    get,
    all,
    dispose(): void {
      for (const material of all) material.dispose();
      all.length = 0;
      cache.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Per-module build context
// ---------------------------------------------------------------------------

export interface BuildingBuildContext {
  readonly library: BuildingsGfxLibrary;
  readonly materials: BuildingMaterialCache;
  /** Memoized geometry shared across buildings of this module. */
  geometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry;
  /** Track a one-off geometry so `dispose` releases it. */
  remember(geometry: THREE.BufferGeometry): THREE.BufferGeometry;
  /** Deterministic jitter in [0, 1) for rooftop prop placement. */
  random(): number;
  dispose(): void;
}

/**
 * Build context for one buildings module: the real gfx library, an era-keyed
 * material cache, memoized procedural geometry, and a seeded PRNG for
 * deterministic rooftop clutter. Disposing the context releases everything the
 * module created.
 */
export function createBuildingBuildContext(
  library: BuildingsGfxLibrary = ProceduralGfxLibrary,
  seed = 1945,
): BuildingBuildContext {
  const materials = createBuildingMaterialCache(library);
  const geometries = new Map<string, THREE.BufferGeometry>();
  const loose: THREE.BufferGeometry[] = [];
  const prng = library.createPRNG(seed);

  const geometry = (
    key: string,
    create: () => THREE.BufferGeometry,
  ): THREE.BufferGeometry => {
    const existing = geometries.get(key);
    if (existing) return existing;
    const created = create();
    geometries.set(key, created);
    return created;
  };

  const remember = (geom: THREE.BufferGeometry): THREE.BufferGeometry => {
    loose.push(geom);
    return geom;
  };

  return {
    library,
    materials,
    geometry,
    remember,
    random: () => prng.next(),
    dispose(): void {
      for (const geom of geometries.values()) geom.dispose();
      geometries.clear();
      for (const geom of loose) geom.dispose();
      loose.length = 0;
      materials.dispose();
    },
  };
}
