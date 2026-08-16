import type { EraId } from '../eras.js';

// ── Core types ────────────────────────────────────────────────────────

/** A single building's footprint on the city block */
export interface BuildingFootprint {
  /** X center position (meters) */
  x: number;
  /** Z center position (meters) */
  z: number;
  /** Width along X axis (meters) */
  width: number;
  /** Depth along Z axis (meters) */
  depth: number;
}

/** Rooftop props that can be attached to a building */
export interface RooftopProps {
  /** Water tower (1945 war-era) */
  waterTower?: boolean;
  /** Chimney stack */
  chimney?: boolean;
  /** TV antenna array (1965) */
  tvAntenna?: boolean;
  /** Satellite dish (1985+) */
  satelliteDish?: boolean;
  /** Single AC unit (1985+) */
  acUnit?: boolean;
  /** AC bank — multiple rooftop units (2005+) */
  acBankCount?: number;
  /** Solar panel array (2025+) */
  solarPanels?: boolean;
  /** Green roof / living roof (2025+) */
  greenRoof?: boolean;
  /** Helipad (modern high-rise) */
  helipad?: boolean;
}

/** Style key determining architectural details */
export type BuildingStyleKey =
  | 'warbrick_corner'     // warm brick corner shop, limestone trim
  | 'midcentury_simple'   // flat-roof pastel box
  | 'artdeco_tower'       // stepped art deco tower
  | 'glass_modern'        // curtain-wall glass tower
  | 'glass_podium'        // glass tower with retail podium base
  | 'retail_strip'        // low commercial strip
  | 'demolished'          // placeholder for demolished lot
  | 'parking_lot'         // empty lot after demolition
  | 'mixed_use'           // mixed-use mid-century
  | 'brutalist_block'     // heavy concrete massing
  | 'steel_glass_highrise'// steel-and-glass skyscraper
  | 'green_tower'         // net-zero glass tower with green roof
  ;

/** Material palette for a building in a specific era */
export interface BuildingMaterials {
  /** Primary facade material key */
  primaryMaterial: string;
  /** Secondary accent material */
  secondaryMaterial?: string;
  /** Window/glass material key */
  windowMaterial?: string;
  /** Roof material key */
  roofMaterial?: string;
  /** Trim/cornice color hex */
  trimColor?: string;
  /** Signage text for storefront buildings */
  signageText?: string;
}

/** Complete specification for one building instance in one era */
export interface BuildingSpec {
  /** Unique identifier for this building slot (persists across eras) */
  id: string;
  /** Physical footprint — identical for persisting buildings across eras */
  footprint: BuildingFootprint;
  /** Number of stories */
  floors: number;
  /** Architectural style key */
  style: BuildingStyleKey;
  /** Era-variant materials */
  materials: BuildingMaterials;
  /** Rooftop props for this era */
  rooftop: RooftopProps;
  /** Optional retrofits visible in this era */
  retrofits?: {
    /** Neon sign / modern signage */
    hasNeonSign?: boolean;
    /** Fire escape added */
    fireEscape?: boolean;
    /** Bay windows added */
    bayWindows?: boolean;
    /** Storefront base replaced with modern retail */
    storeFront?: boolean;
    /** Cladding retrofit (added layer over old facade) */
    claddingRetrofit?: boolean;
    /** LED accent strips */
    ledAccents?: boolean;
    /** Added floor(s) on top */
    addedFloors?: number;
  };
  /** Whether this building still exists in this era */
  active: boolean;
}

// ── City block layout (shared across all eras) ────────────────────────
// The block is ~60×60 m. Buildings are positioned along the perimeter
// facing inward, creating a recognizable street-front feel.
//
// Layout positions (x, z relative to block center):
//   Front row (north side, z ≈ -27):  B1, B2, B3, B4
//   Right column (east side, x ≈ +27): B5, B6
//   Back row (south side, z ≈ +27):   B7, B8
//   Left column (west side, x ≈ -27): B9, B10
//
// This creates an L-shaped frontage with interior courtyard space.

const BLOCK_HALF = 28; // meters from center to building face

// ── Era 1945: War-era buildings ──────────────────────────────────────

export const BUILDINGS_1945: BuildingSpec[] = [
  {
    id: 'corner_shop',
    footprint: { x: -BLOCK_HALF + 4, z: -BLOCK_HALF + 4, width: 8, depth: 8 },
    floors: 3,
    style: 'warbrick_corner',
    materials: {
      primaryMaterial: 'brick_red',
      secondaryMaterial: 'limestone',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#d4c5a0',
      signageText: 'GENERAL STORE',
    },
    rooftop: { waterTower: true, chimney: true },
    active: true,
  },
  {
    id: 'warehouse_e',
    footprint: { x: BLOCK_HALF - 6, z: -BLOCK_HALF + 10, width: 10, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'brick_dark',
      secondaryMaterial: 'wood',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#8B4513',
    },
    rooftop: { chimney: true },
    active: true,
  },
  {
    id: 'apartment_n',
    footprint: { x: -2, z: -BLOCK_HALF + 6, width: 10, depth: 9 },
    floors: 4,
    style: 'brutalist_block',
    materials: {
      primaryMaterial: 'brick_warm',
      secondaryMaterial: 'limestone',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#b0a080',
    },
    rooftop: { waterTower: true },
    active: true,
  },
  {
    id: 'shop_s',
    footprint: { x: 6, z: BLOCK_HALF - 6, width: 8, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'brick_red',
      secondaryMaterial: 'limestone',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#d4c5a0',
      signageText: 'BARBER SHOP',
    },
    rooftop: { chimney: true },
    active: true,
  },
  {
    id: 'building_sw',
    footprint: { x: -BLOCK_HALF + 8, z: BLOCK_HALF - 6, width: 9, depth: 8 },
    floors: 3,
    style: 'warbrick_corner',
    materials: {
      primaryMaterial: 'brick_dark',
      secondaryMaterial: 'limestone',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#c8b89a',
    },
    rooftop: { waterTower: true, chimney: true },
    active: true,
  },
  {
    id: 'empty_ne',
    footprint: { x: BLOCK_HALF - 8, z: BLOCK_HALF - 8, width: 10, depth: 10 },
    floors: 0,
    style: 'demolished',
    materials: { primaryMaterial: 'none' },
    rooftop: {},
    active: false,
  },
];

// ── Era 1965: Mid-century modern ─────────────────────────────────────

export const BUILDINGS_1965: BuildingSpec[] = [
  {
    id: 'corner_shop',
    footprint: { x: -BLOCK_HALF + 4, z: -BLOCK_HALF + 4, width: 8, depth: 8 },
    floors: 3,
    style: 'warbrick_corner',
    materials: {
      primaryMaterial: 'brick_red',
      secondaryMaterial: 'limestone',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#ff6b35',
      signageText: 'NEON MARKET',
    },
    rooftop: { waterTower: true, chimney: true },
    retrofits: { hasNeonSign: true, storeFront: true },
    active: true,
  },
  {
    id: 'warehouse_e',
    footprint: { x: BLOCK_HALF - 6, z: -BLOCK_HALF + 10, width: 10, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'beige_plaster',
      secondaryMaterial: 'turquoise_tile',
      windowMaterial: 'glass_tinted_green',
      roofMaterial: 'flat_roof',
      trimColor: '#40e0d0',
    },
    rooftop: { tvAntenna: true },
    retrofits: { storeFront: true },
    active: true,
  },
  {
    id: 'apartment_n',
    footprint: { x: -2, z: -BLOCK_HALF + 6, width: 10, depth: 9 },
    floors: 4,
    style: 'brutalist_block',
    materials: {
      primaryMaterial: 'concrete',
      secondaryMaterial: 'beige_plaster',
      windowMaterial: 'glass_tinted_blue',
      roofMaterial: 'flat_roof',
      trimColor: '#f5deb3',
    },
    rooftop: { tvAntenna: true },
    retrofits: { claddingRetrofit: true },
    active: true,
  },
  {
    id: 'shop_s',
    footprint: { x: 6, z: BLOCK_HALF - 6, width: 8, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'beige_plaster',
      secondaryMaterial: 'turquoise_tile',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#ff6b35',
      signageText: 'SNACK BAR',
    },
    rooftop: { tvAntenna: true },
    retrofits: { hasNeonSign: true, storeFront: true },
    active: true,
  },
  {
    id: 'building_sw',
    footprint: { x: -BLOCK_HALF + 8, z: BLOCK_HALF - 6, width: 9, depth: 8 },
    floors: 3,
    style: 'midcentury_simple',
    materials: {
      primaryMaterial: 'beige_plaster',
      secondaryMaterial: 'wood',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#40e0d0',
    },
    rooftop: { tvAntenna: true },
    retrofits: { bayWindows: true },
    active: true,
  },
  {
    id: 'empty_ne',
    footprint: { x: BLOCK_HALF - 8, z: BLOCK_HALF - 8, width: 10, depth: 10 },
    floors: 0,
    style: 'demolished',
    materials: { primaryMaterial: 'none' },
    rooftop: {},
    active: false,
  },
];

// ── Era 1985: Dark glass & metal ─────────────────────────────────────

export const BUILDINGS_1985: BuildingSpec[] = [
  {
    id: 'corner_shop',
    footprint: { x: -BLOCK_HALF + 4, z: -BLOCK_HALF + 4, width: 8, depth: 8 },
    floors: 3,
    style: 'warbrick_corner',
    materials: {
      primaryMaterial: 'brick_red',
      secondaryMaterial: 'metal_panel_gray',
      windowMaterial: 'glass_tinted_brown',
      roofMaterial: 'flat_roof',
      trimColor: '#1a0a2e',
      signageText: 'MART 85',
    },
    rooftop: { waterTower: true, chimney: true },
    retrofits: { claddingRetrofit: true, addedFloors: 1, hasNeonSign: true },
    active: true,
  },
  {
    id: 'warehouse_e',
    footprint: { x: BLOCK_HALF - 6, z: -BLOCK_HALF + 10, width: 10, depth: 8 },
    floors: 2,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'metal_panel_dark',
      secondaryMaterial: 'glass_mirror',
      windowMaterial: 'glass_tinted_smoke',
      roofMaterial: 'flat_roof',
      trimColor: '#2a2a2a',
    },
    rooftop: { satelliteDish: true, acUnit: true },
    active: true,
  },
  {
    id: 'apartment_n',
    footprint: { x: -2, z: -BLOCK_HALF + 6, width: 10, depth: 9 },
    floors: 5,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'glass_tinted_blue',
      secondaryMaterial: 'metal_panel_gray',
      windowMaterial: 'glass_mirror',
      roofMaterial: 'flat_roof',
      trimColor: '#4a4a6a',
    },
    rooftop: { satelliteDish: true, acUnit: true },
    retrofits: { claddingRetrofit: true, addedFloors: 1 },
    active: true,
  },
  {
    id: 'shop_s',
    footprint: { x: 6, z: BLOCK_HALF - 6, width: 8, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'metal_panel_beige',
      secondaryMaterial: 'glass_tinted',
      windowMaterial: 'glass_tinted_smoke',
      roofMaterial: 'flat_roof',
      trimColor: '#ccaa77',
      signageText: 'VIDEO RENTALS',
    },
    rooftop: { satelliteDish: true, acUnit: true },
    retrofits: { storeFront: true },
    active: true,
  },
  {
    id: 'building_sw',
    footprint: { x: -BLOCK_HALF + 8, z: BLOCK_HALF - 6, width: 9, depth: 8 },
    floors: 3,
    style: 'midcentury_simple',
    materials: {
      primaryMaterial: 'metal_panel_gray',
      secondaryMaterial: 'glass_tinted_green',
      windowMaterial: 'glass_tinted',
      roofMaterial: 'flat_roof',
      trimColor: '#666688',
    },
    rooftop: { satelliteDish: true, acUnit: true },
    retrofits: { fireEscape: true },
    active: true,
  },
  {
    id: 'empty_ne',
    footprint: { x: BLOCK_HALF - 8, z: BLOCK_HALF - 8, width: 10, depth: 10 },
    floors: 0,
    style: 'demolished',
    materials: { primaryMaterial: 'none' },
    rooftop: {},
    active: false,
  },
];

// ── Era 2005: Gray glass, steel, EIFS ────────────────────────────────

export const BUILDINGS_2005: BuildingSpec[] = [
  {
    id: 'corner_shop',
    footprint: { x: -BLOCK_HALF + 4, z: -BLOCK_HALF + 4, width: 8, depth: 8 },
    floors: 4,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'glass_steel',
      secondaryMaterial: 'EIFS_beige',
      windowMaterial: 'glass_reflective',
      roofMaterial: 'flat_roof',
      trimColor: '#888899',
      signageText: 'RETAIL CORNER',
    },
    rooftop: { acBankCount: 3 },
    retrofits: { addedFloors: 1, storeFront: true, fireEscape: true },
    active: true,
  },
  {
    id: 'warehouse_e',
    footprint: { x: BLOCK_HALF - 6, z: -BLOCK_HALF + 10, width: 10, depth: 8 },
    floors: 2,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'glass_steel',
      secondaryMaterial: 'EIFS_beige',
      windowMaterial: 'glass_reflective',
      roofMaterial: 'flat_roof',
      trimColor: '#999999',
    },
    rooftop: { acBankCount: 2, satelliteDish: true },
    active: true,
  },
  {
    id: 'apartment_n',
    footprint: { x: -2, z: -BLOCK_HALF + 6, width: 10, depth: 9 },
    floors: 6,
    style: 'steel_glass_highrise',
    materials: {
      primaryMaterial: 'glass_steel',
      secondaryMaterial: 'steel_frame',
      windowMaterial: 'glass_reflective',
      roofMaterial: 'flat_roof',
      trimColor: '#777788',
    },
    rooftop: { acBankCount: 4, satelliteDish: true },
    retrofits: { claddingRetrofit: true, addedFloors: 1 },
    active: true,
  },
  {
    id: 'shop_s',
    footprint: { x: 6, z: BLOCK_HALF - 6, width: 8, depth: 8 },
    floors: 2,
    style: 'retail_strip',
    materials: {
      primaryMaterial: 'EIFS_beige',
      secondaryMaterial: 'glass_modern',
      windowMaterial: 'glass_clear',
      roofMaterial: 'flat_roof',
      trimColor: '#c8b89a',
      signageText: 'COFFEE HOUSE',
    },
    rooftop: { acBankCount: 2 },
    retrofits: { storeFront: true },
    active: true,
  },
  {
    id: 'building_sw',
    footprint: { x: -BLOCK_HALF + 8, z: BLOCK_HALF - 6, width: 9, depth: 8 },
    floors: 3,
    style: 'mixed_use',
    materials: {
      primaryMaterial: 'glass_steel',
      secondaryMaterial: 'EIFS_beige',
      windowMaterial: 'glass_tinted',
      roofMaterial: 'flat_roof',
      trimColor: '#aaaaaa',
    },
    rooftop: { acBankCount: 2, satelliteDish: true },
    retrofits: { claddingRetrofit: true, fireEscape: true },
    active: true,
  },
  {
    id: 'empty_ne',
    footprint: { x: BLOCK_HALF - 8, z: BLOCK_HALF - 8, width: 10, depth: 10 },
    floors: 3,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'glass_steel',
      secondaryMaterial: 'steel_frame',
      windowMaterial: 'glass_reflective',
      roofMaterial: 'flat_roof',
      trimColor: '#888899',
    },
    rooftop: { acBankCount: 2 },
    active: true,
  },
];

// ── Era 2025: Glass towers, LED accents, green roofs ─────────────────

export const BUILDINGS_2025: BuildingSpec[] = [
  {
    id: 'corner_shop',
    footprint: { x: -BLOCK_HALF + 4, z: -BLOCK_HALF + 4, width: 8, depth: 8 },
    floors: 5,
    style: 'glass_podium',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'LED_accent',
      windowMaterial: 'smart_glass',
      roofMaterial: 'green_roof',
      trimColor: '#00ff88',
      signageText: 'SMART MART',
    },
    rooftop: { solarPanels: true, greenRoof: true },
    retrofits: { addedFloors: 1, ledAccents: true, storeFront: true },
    active: true,
  },
  {
    id: 'warehouse_e',
    footprint: { x: BLOCK_HALF - 6, z: -BLOCK_HALF + 10, width: 10, depth: 8 },
    floors: 3,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'steel_frame',
      windowMaterial: 'smart_glass',
      roofMaterial: 'green_roof',
      trimColor: '#00ddff',
    },
    rooftop: { solarPanels: true, greenRoof: true },
    retrofits: { claddingRetrofit: true, ledAccents: true },
    active: true,
  },
  {
    id: 'apartment_n',
    footprint: { x: -2, z: -BLOCK_HALF + 6, width: 10, depth: 9 },
    floors: 8,
    style: 'green_tower',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'LED_accent',
      windowMaterial: 'smart_glass',
      roofMaterial: 'green_roof',
      trimColor: '#00ff88',
    },
    rooftop: { solarPanels: true, greenRoof: true, helipad: true },
    retrofits: { claddingRetrofit: true, addedFloors: 2, ledAccents: true },
    active: true,
  },
  {
    id: 'shop_s',
    footprint: { x: 6, z: BLOCK_HALF - 6, width: 8, depth: 8 },
    floors: 3,
    style: 'glass_podium',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'LED_accent',
      windowMaterial: 'smart_glass',
      roofMaterial: 'flat_roof',
      trimColor: '#00ffaa',
      signageText: 'CAFE & BOOKS',
    },
    rooftop: { solarPanels: true, greenRoof: true },
    retrofits: { storeFront: true, ledAccents: true },
    active: true,
  },
  {
    id: 'building_sw',
    footprint: { x: -BLOCK_HALF + 8, z: BLOCK_HALF - 6, width: 9, depth: 8 },
    floors: 4,
    style: 'glass_modern',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'steel_frame',
      windowMaterial: 'smart_glass',
      roofMaterial: 'flat_roof',
      trimColor: '#00bbff',
    },
    rooftop: { solarPanels: true },
    retrofits: { claddingRetrofit: true, ledAccents: true },
    active: true,
  },
  {
    id: 'empty_ne',
    footprint: { x: BLOCK_HALF - 8, z: BLOCK_HALF - 8, width: 10, depth: 10 },
    floors: 5,
    style: 'steel_glass_highrise',
    materials: {
      primaryMaterial: 'floor_to_ceiling_glass',
      secondaryMaterial: 'LED_accent',
      windowMaterial: 'smart_glass',
      roofMaterial: 'green_roof',
      trimColor: '#00ff88',
    },
    rooftop: { solarPanels: true, greenRoof: true, helipad: true },
    active: true,
  },
];

// ── Era registry map ──────────────────────────────────────────────────

export const ERA_BUILDING_MAP: Record<EraId, BuildingSpec[]> = {
  '1945': BUILDINGS_1945,
  '1965': BUILDINGS_1965,
  '1985': BUILDINGS_1985,
  '2005': BUILDINGS_2005,
  '2025': BUILDINGS_2025,
};
