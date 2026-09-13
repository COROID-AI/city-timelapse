/**
 * Per-era building data for the City Time Period Timelapse.
 *
 * This module owns the five requested timeline stops (1945, 1965, 1985,
 * 2005, 2025 — no 2055, per the user request) and ships one rich building
 * recipe per era that *conforms to the EraTheme schema*: the `buildings`
 * section is a schema-typed `EraBuildings` and the `palette` section is a
 * schema-typed `EraPalette` taken from the shared `ERA_PALETTES` contract in
 * `src/era/palette.ts`. Everything else is local builder detail that drives
 * the archetype geometry (windows, roofs, fire escapes, setbacks, wear) and
 * is deliberately data, not code: scene-integration and polish tuning can
 * re-theme an era by editing these fields (or by passing `theme` overrides to
 * `buildBuildings`) without touching geometry code.
 *
 * The extra fields below are *not* edits to `src/era/*`; they are local
 * facade/roof/detail flags that the builders in `archetypes.ts` interpret.
 */

import type { ColorHex, EraBuildings, EraId, EraPalette } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';

/** The five procedural building archetypes, one per era. */
export type ArchetypeId =
  | 'rowhouse' // 1945 brick rowhouses / war-era facades
  | 'mid-century-slab' // 1965 mid-century modern
  | 'concrete-glass-block' // 1985 concrete/glass
  | 'glass-steel-midrise' // 2005 glass-and-steel mid-rise
  | 'green-tower'; // 2025 green towers with solar/wind details

/** Window treatment parameters interpreted by the archetype builders. */
export interface EraWindowParams {
  doubleHung: boolean;
  ribbon: boolean;
  curtain: boolean;
  tinted: boolean;
  green: boolean;
  /** Glass pane quads per window unit (double-hung sashes, twin lights...). */
  panesPerWindow: number;
  /** Base window unit width in meters. */
  unitW: number;
  /** Base window unit height in meters. */
  unitH: number;
  /** Horizontal gap between units in meters. */
  gapX: number;
  /** Vertical gap between floor bands in meters. */
  gapY: number;
  /** Sill/lintel boxes under window units. */
  sill: boolean;
  /** Steel mullion grid over the glass (curtain wall). */
  mullions: boolean;
  /** Probability a window reads as interior-lit at night. */
  litChance: number;
}

/** Roof & rooftop detail parameters. */
export interface EraRoofParams {
  cornice: boolean;
  parapet: boolean;
  /** Number of chimney stacks to try placing on qualifying lots. */
  chimneys: number;
  /** Number of water towers to try placing on qualifying lots. */
  waterTowers: number;
  /** Number of rooftop HVAC units per qualified building. */
  acUnits: number;
  /** Number of rooftop antenna/masts per qualified building. */
  antennas: number;
  greenRoof: boolean;
  solarRows: number;
  solarCols: number;
  windTurbines: number;
  spire: boolean;
  /** Number of living-wall planter bands on tall buildings. */
  planterBands: number;
}

/** Setback (upper-floor step-backs) parameters for taller eras. */
export interface EraSetbackParams {
  enabled: boolean;
  maxLevels: number;
  /** Only buildings taller than this get setbacks, meters. */
  minHeight: number;
  /** Lateral inset per setback level, meters. */
  stepIn: number;
}

/** Weathering / wear parameters. Higher = older & grubbier. */
export interface EraWearParams {
  levelBand: readonly [number, number];
  sootBands: [number, number];
  rustStreaks: [number, number];
  patches: [number, number];
}

/** Facade feature flags (banding, fins, brise-soleil, pilotis, living walls). */
export interface EraFacadeParams {
  banding: boolean;
  verticalFins: boolean;
  briseSoleil: boolean;
  pilotis: boolean;
  livingWall: boolean;
  quoins: boolean;
}

/** Storefront / ground-level parameters. */
export interface EraStorefrontParams {
  enabled: boolean;
  /** Number of units that receive a striped awning (1945). */
  awnings: number;
  glassBlock: boolean;
}

/** Placement tuning: how the building sits on its lot. */
export interface EraPlacementParams {
  /** Inset from the side parcel edges, meters. */
  side: number;
  /** Inset from the street-facing parcel edge, meters. */
  street: number;
  /** Inset from the back parcel edge, meters. */
  back: number;
  /** Building body depth as a fraction of the footprint depth. */
  bodyDepth: number;
}

/** Complete local per-era building recipe. */
export interface EraBuildingDetail {
  archetype: ArchetypeId;
  /** Human style label surfaced in the descriptor (e.g. 'war-era-commercial-front'). */
  style: string;
  /** Schema-conforming buildings section (EraTheme.buildings). */
  buildings: EraBuildings;
  /** Schema-conforming palette (EraTheme.palette) from the shared contract. */
  palette: EraPalette;
  windows: EraWindowParams;
  roof: EraRoofParams;
  fireEscapes: { enabled: boolean; density: number };
  setbacks: EraSetbackParams;
  wear: EraWearParams;
  /** Night emissive painting: window interiors, storefronts, signage. */
  glow: { interior: ColorHex; storefront: ColorHex; signage: ColorHex };
  facade: EraFacadeParams;
  storefronts: EraStorefrontParams;
  placement: EraPlacementParams;
}

/**
 * The five era recipes, keyed by the exact requested years. The buildings
 * aspect of each entry is `EraBuildings`-typed, so a schema change is a
 * compile error here; the palette is the shared `ERA_PALETTES` contract.
 */
export const ERA_BUILDING_DATA: Record<EraId, EraBuildingDetail> = {
  // --------------------------------------------------------------------------
  // 1945 — Brick rowhouses / war-era facades. Tight street wall, cornices,
  // double-hung windows with sills, stoops, fire escapes, rust and soot.
  // --------------------------------------------------------------------------
  1945: {
    archetype: 'rowhouse',
    style: 'brick-rowhouse',
    buildings: {
      heightRange: [10, 22],
      windowStyle: 'small-paned-double-hung',
      roofStyle: 'cornice-and-parapet',
      facadeMaterial: 'brick-and-sandstone',
      storefrontFrontage: 0.5,
    },
    palette: ERA_PALETTES[1945]!,
    windows: {
      doubleHung: true,
      ribbon: false,
      curtain: false,
      tinted: false,
      green: false,
      panesPerWindow: 4,
      unitW: 1.6,
      unitH: 2.1,
      gapX: 0.4,
      gapY: 0.9,
      sill: true,
      mullions: false,
      litChance: 0.5,
    },
    roof: {
      cornice: true,
      parapet: true,
      chimneys: 2,
      waterTowers: 2,
      acUnits: 0,
      antennas: 0,
      greenRoof: false,
      solarRows: 0,
      solarCols: 0,
      windTurbines: 0,
      spire: false,
      planterBands: 0,
    },
    fireEscapes: { enabled: true, density: 0.85 },
    setbacks: { enabled: false, maxLevels: 0, minHeight: 1e9, stepIn: 0 },
    wear: { levelBand: [0.55, 0.8], sootBands: [2, 4], rustStreaks: [3, 7], patches: [2, 5] },
    glow: {
      interior: '#ffc987',
      storefront: '#ffd9a0',
      signage: '#f2a03c',
    },
    facade: { banding: false, verticalFins: false, briseSoleil: false, pilotis: false, livingWall: false, quoins: true },
    storefronts: { enabled: true, awnings: 3, glassBlock: false },
    placement: { side: 0.4, street: 0.9, back: 3.0, bodyDepth: 0.55 },
  },

  // --------------------------------------------------------------------------
  // 1965 — Mid-century modern. Horizontal ribbon windows, flat parapet,
  // accent spandrel bands, vertical fins, pilotis entry canopy.
  // --------------------------------------------------------------------------
  1965: {
    archetype: 'mid-century-slab',
    style: 'mid-century-slab',
    buildings: {
      heightRange: [14, 30],
      windowStyle: 'horizontal-ribbon-window',
      roofStyle: 'flat-parapet',
      facadeMaterial: 'pastel-panel-and-glass',
      storefrontFrontage: 0.45,
    },
    palette: ERA_PALETTES[1965]!,
    windows: {
      doubleHung: false,
      ribbon: true,
      curtain: false,
      tinted: false,
      green: false,
      panesPerWindow: 1,
      unitW: 2.6,
      unitH: 1.15,
      gapX: 0.15,
      gapY: 1.15,
      sill: false,
      mullions: false,
      litChance: 0.45,
    },
    roof: {
      cornice: false,
      parapet: true,
      chimneys: 1,
      waterTowers: 1,
      acUnits: 1,
      antennas: 0,
      greenRoof: false,
      solarRows: 0,
      solarCols: 0,
      windTurbines: 0,
      spire: false,
      planterBands: 0,
    },
    fireEscapes: { enabled: true, density: 0.25 },
    setbacks: { enabled: true, maxLevels: 1, minHeight: 26, stepIn: 1.2 },
    wear: { levelBand: [0.3, 0.5], sootBands: [1, 2], rustStreaks: [1, 3], patches: [1, 3] },
    glow: {
      interior: '#ffd9a8',
      storefront: '#ffe9c0',
      signage: '#ff6f91',
    },
    facade: { banding: true, verticalFins: true, briseSoleil: false, pilotis: true, livingWall: false, quoins: false },
    storefronts: { enabled: true, awnings: 0, glassBlock: false },
    placement: { side: 1.2, street: 1.6, back: 2.2, bodyDepth: 0.62 },
  },

  // --------------------------------------------------------------------------
  // 1985 — Concrete / glass. Reinforced-concrete frame, tinted glass,
  // brise-soleil shading fins, glass-block accents, rooftop HVAC & water tank.
  // --------------------------------------------------------------------------
  1985: {
    archetype: 'concrete-glass-block',
    style: 'concrete-glass-block',
    buildings: {
      heightRange: [22, 48],
      windowStyle: 'tinted-glass-with-brise-soleil',
      roofStyle: 'flat-roof-with-ac',
      facadeMaterial: 'concrete-and-glass-block',
      storefrontFrontage: 0.55,
    },
    palette: ERA_PALETTES[1985]!,
    windows: {
      doubleHung: false,
      ribbon: false,
      curtain: false,
      tinted: true,
      green: false,
      panesPerWindow: 2,
      unitW: 3.0,
      unitH: 1.7,
      gapX: 0.4,
      gapY: 1.0,
      sill: false,
      mullions: false,
      litChance: 0.4,
    },
    roof: {
      cornice: false,
      parapet: true,
      chimneys: 0,
      waterTowers: 2,
      acUnits: 3,
      antennas: 1,
      greenRoof: false,
      solarRows: 0,
      solarCols: 0,
      windTurbines: 0,
      spire: false,
      planterBands: 0,
    },
    fireEscapes: { enabled: false, density: 0 },
    setbacks: { enabled: true, maxLevels: 2, minHeight: 30, stepIn: 1.4 },
    wear: { levelBand: [0.22, 0.4], sootBands: [1, 2], rustStreaks: [2, 4], patches: [2, 4] },
    glow: {
      interior: '#ffe29e',
      storefront: '#fff2cc',
      signage: '#00e5ff',
    },
    facade: { banding: true, verticalFins: false, briseSoleil: true, pilotis: false, livingWall: false, quoins: false },
    storefronts: { enabled: true, awnings: 0, glassBlock: true },
    placement: { side: 1.6, street: 2.2, back: 2.6, bodyDepth: 0.62 },
  },

  // --------------------------------------------------------------------------
  // 2005 — Glass-and-steel mid-rise. Curtain wall with steel mullions,
  // glass spandrel bands, stepped setbacks, rooftop HVAC + cell mast.
  // --------------------------------------------------------------------------
  2005: {
    archetype: 'glass-steel-midrise',
    style: 'glass-steel-midrise',
    buildings: {
      heightRange: [32, 62],
      windowStyle: 'glass-curtain-with-steel-mullions',
      roofStyle: 'flat-roof-with-ac-and-mast',
      facadeMaterial: 'glass-and-steel',
      storefrontFrontage: 0.65,
    },
    palette: ERA_PALETTES[2005]!,
    windows: {
      doubleHung: false,
      ribbon: false,
      curtain: true,
      tinted: false,
      green: false,
      panesPerWindow: 1,
      unitW: 3.2,
      unitH: 2.2,
      gapX: 0.12,
      gapY: 0.35,
      sill: false,
      mullions: true,
      litChance: 0.35,
    },
    roof: {
      cornice: false,
      parapet: true,
      chimneys: 0,
      waterTowers: 0,
      acUnits: 4,
      antennas: 2,
      greenRoof: false,
      solarRows: 0,
      solarCols: 0,
      windTurbines: 0,
      spire: false,
      planterBands: 0,
    },
    fireEscapes: { enabled: false, density: 0 },
    setbacks: { enabled: true, maxLevels: 2, minHeight: 40, stepIn: 1.6 },
    wear: { levelBand: [0.1, 0.18], sootBands: [0, 1], rustStreaks: [0, 1], patches: [1, 2] },
    glow: {
      interior: '#e2f4ff',
      storefront: '#f4fbff',
      signage: '#bfe3ff',
    },
    facade: { banding: true, verticalFins: false, briseSoleil: false, pilotis: false, livingWall: false, quoins: false },
    storefronts: { enabled: true, awnings: 0, glassBlock: false },
    placement: { side: 1.8, street: 2.6, back: 3.0, bodyDepth: 0.66 },
  },

  // --------------------------------------------------------------------------
  // 2025 — Green towers. Stepped green-glass towers with living-wall planter
  // bands, a green roof, rooftop solar arrays and wind turbines, green LED spire.
  // --------------------------------------------------------------------------
  2025: {
    archetype: 'green-tower',
    style: 'green-tower',
    buildings: {
      heightRange: [42, 88],
      windowStyle: 'triple-glazed-green-glass',
      roofStyle: 'green-roof-with-solar-and-wind',
      facadeMaterial: 'green-glass-and-living-wall',
      storefrontFrontage: 0.7,
    },
    palette: ERA_PALETTES[2025]!,
    windows: {
      doubleHung: false,
      ribbon: false,
      curtain: true,
      tinted: false,
      green: true,
      panesPerWindow: 1,
      unitW: 3.4,
      unitH: 2.4,
      gapX: 0.08,
      gapY: 0.28,
      sill: false,
      mullions: true,
      litChance: 0.3,
    },
    roof: {
      cornice: false,
      parapet: false,
      chimneys: 0,
      waterTowers: 0,
      acUnits: 1,
      antennas: 1,
      greenRoof: true,
      solarRows: 4,
      solarCols: 6,
      windTurbines: 2,
      spire: true,
      planterBands: 3,
    },
    fireEscapes: { enabled: false, density: 0 },
    setbacks: { enabled: true, maxLevels: 3, minHeight: 48, stepIn: 1.8 },
    wear: { levelBand: [0.02, 0.08], sootBands: [0, 0], rustStreaks: [0, 0], patches: [0, 1] },
    glow: {
      interior: '#d9fff2',
      storefront: '#eaffff',
      signage: '#9dffd0',
    },
    facade: { banding: false, verticalFins: true, briseSoleil: false, pilotis: false, livingWall: true, quoins: false },
    storefronts: { enabled: true, awnings: 0, glassBlock: false },
    placement: { side: 2.4, street: 3.2, back: 3.6, bodyDepth: 0.6 },
  },
};

/** Optional runtime theme overrides accepted by `buildBuildings`. */
export interface BuildingThemeOverride {
  buildings?: Partial<EraBuildings>;
  palette?: Partial<EraPalette>;
}

/** Fully resolved recipe after merging optional overrides over the shipped data. */
export interface ResolvedEraBuilding {
  eraId: EraId;
  detail: EraBuildingDetail;
  buildings: EraBuildings;
  palette: EraPalette;
}

/**
 * Resolve one era's building recipe, layering optional `theme` overrides (the
 * `buildings` and `palette` schema sections) over the shipped per-era data.
 * Deterministic for identical inputs; used directly by `buildBuildings` so
 * theme-input changes deterministically change the produced building set.
 */
export function resolveEraBuilding(
  eraId: EraId,
  theme?: BuildingThemeOverride,
): ResolvedEraBuilding {
  const detail = ERA_BUILDING_DATA[eraId];
  if (!detail) {
    throw new Error(`buildBuildings: unknown era ${String(eraId)}`);
  }
  const palette = { ...detail.palette };
  if (theme?.palette) {
    Object.assign(palette, theme.palette);
  }
  return {
    eraId,
    detail,
    buildings: { ...detail.buildings, ...(theme?.buildings ?? {}) },
    palette,
  };
}