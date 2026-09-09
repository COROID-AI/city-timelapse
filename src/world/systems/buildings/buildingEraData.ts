/**
 * Era-scaled building data: `Record<EraId, BuildingsEraSpec>` that the
 * buildings system (and the compose-scene-app era environment) consume.
 *
 * This module imports only the shared era contracts (`EraId`, `BuildingsEraSpec`,
 * `RoofStyle`) and re-declares each era as its own immutable constant so the
 * data is statically inspectable — tests can assert every era is covered with
 * the full 5-era architecture arc (sooty brick -> mid-century curtain wall ->
 * brutalist concrete/mirror -> glass condo -> eco glass tower) without touching
 * THREE or the DOM.
 */

import type { BuildingsEraSpec } from '../../../era/types';
import type { EraId } from '../../../era/years';

/** Roof prop vocabulary (matches the era evolution: water tower -> AC -> antenna -> dish -> solar). */
export type RoofPropKind =
  | 'water_tower'
  | 'ac_units'
  | 'antennas'
  | 'satellite_dishes'
  | 'solar_panels'
  | 'green_roof'
  | 'none';

/**
 * Curated, per-era building directives used by the builder to drive facade
 * detailing beyond the shared `BuildingsEraSpec` (windows, balconies, roof
 * props, curtain styles). Everything stays plain data so the builder stays
 * driven by declarations, not hardcoded per-era branches.
 */
export interface BuildingsEraData {
  readonly spec: BuildingsEraSpec;
  /** Dominant roof prop for the era. */
  readonly roofProp: RoofPropKind;
  /** Window band layout: 'raster' (brick/tenement grid) vs 'curtain' (full bands). */
  readonly windowLayout: 'raster' | 'curtain';
  /** True when every story has a running balcony strip on the frontage. */
  readonly balconies: boolean;
  /** 1945 sooty brick low-rises. */
  readonly weathering: number;
}

export const BUILDINGS_1945: BuildingsEraData = {
  spec: {
    styleName: 'Post-War Brick Tenements & Art Deco Embellishments',
    facadePalette: ['#5c2c16', '#78350f', '#451a03', '#854d0e', '#3f3f46'],
    frameColor: '#1c1917',
    windowEmissiveColor: '#fef08a',
    windowIlluminationRate: 0.5,
    heightScale: 1.0,
    roofStyle: 'mansard',
    fireEscapes: true,
    architecturalDetailLevel: 0.85,
    streetFurniture: ['cast_iron_trash_can', 'newspaper_kiosk', 'fire_hydrant_vintage'],
    weatheringFactor: 0.8,
  },
  roofProp: 'water_tower',
  windowLayout: 'raster',
  balconies: false,
  weathering: 1.65,
};

export const BUILDINGS_1965: BuildingsEraData = {
  spec: {
    styleName: 'Mid-Century Modern & International Style Glass/Steel Panels',
    facadePalette: ['#9ca3af', '#64748b', '#cbd5e1', '#b45309', '#0f766e'],
    frameColor: '#334155',
    windowEmissiveColor: '#fef9c3',
    windowIlluminationRate: 0.6,
    heightScale: 1.25,
    roofStyle: 'flat_water_tower',
    fireEscapes: true,
    architecturalDetailLevel: 0.6,
    streetFurniture: ['concrete_planter', 'midcentury_mailbox', 'fire_hydrant_yellow'],
    weatheringFactor: 0.5,
  },
  roofProp: 'ac_units',
  windowLayout: 'curtain',
  balconies: false,
  weathering: 0.9,
};

export const BUILDINGS_1985: BuildingsEraData = {
  spec: {
    styleName: 'Postmodernist Concrete, Mirrored Glass & Angular Facades',
    facadePalette: ['#64748b', '#475569', '#94a3b8', '#0284c7', '#be185d'],
    frameColor: '#0f172a',
    windowEmissiveColor: '#a5f3fc',
    windowIlluminationRate: 0.75,
    heightScale: 1.55,
    roofStyle: 'flat_ac_units',
    fireEscapes: false,
    architecturalDetailLevel: 0.5,
    streetFurniture: ['concrete_bollard', 'aluminum_bench', 'payphone_booth'],
    weatheringFactor: 0.35,
  },
  roofProp: 'antennas',
  windowLayout: 'curtain',
  balconies: false,
  weathering: 0.55,
};

export const BUILDINGS_2005: BuildingsEraData = {
  spec: {
    styleName: 'High-Tech Modernism, Curtain Walls & Composite Cladding',
    facadePalette: ['#475569', '#334155', '#e2e8f0', '#0369a1', '#15803d'],
    frameColor: '#64748b',
    windowEmissiveColor: '#e0f2fe',
    windowIlluminationRate: 0.85,
    heightScale: 1.85,
    roofStyle: 'green_roof',
    fireEscapes: false,
    architecturalDetailLevel: 0.7,
    streetFurniture: ['stainless_bollard', 'glass_bus_shelter', 'digital_parking_meter'],
    weatheringFactor: 0.15,
  },
  roofProp: 'satellite_dishes',
  windowLayout: 'curtain',
  balconies: true,
  weathering: 0.2,
};

export const BUILDINGS_2025: BuildingsEraData = {
  spec: {
    styleName: 'Eco-Futuristic Vertical Gardens, Smart Glass & Photovoltaic Spreading',
    facadePalette: ['#0f172a', '#1e293b', '#334155', '#10b981', '#06b6d4'],
    frameColor: '#0f172a',
    windowEmissiveColor: '#f0fdf4',
    windowIlluminationRate: 0.9,
    heightScale: 2.2,
    roofStyle: 'solar_spire',
    fireEscapes: false,
    architecturalDetailLevel: 0.9,
    streetFurniture: ['smart_bike_dock', 'ev_charging_hub', 'digital_wayfinding_kiosk'],
    weatheringFactor: 0.05,
  },
  roofProp: 'solar_panels',
  windowLayout: 'curtain',
  balconies: true,
  weathering: 0.08,
};

/**
 * The aggregated buildings-era table. Keys follow the shared `EraId` exactly
 * so compose-scene-app can fold this into `eraEnvironment` without remapping.
 */
export const buildingEraData: Record<EraId, BuildingsEraData> = {
  '1945': BUILDINGS_1945,
  '1965': BUILDINGS_1965,
  '1985': BUILDINGS_1985,
  '2005': BUILDINGS_2005,
  '2025': BUILDINGS_2025,
};

/** Same table typed as the shared `BuildingsEraSpec` contract for external consumers. */
export const buildingEraSpecs: Record<EraId, BuildingsEraSpec> = {
  '1945': BUILDINGS_1945.spec,
  '1965': BUILDINGS_1965.spec,
  '1985': BUILDINGS_1985.spec,
  '2005': BUILDINGS_2005.spec,
  '2025': BUILDINGS_2025.spec,
};

/** All era ids in chronological order for iteration/dropdowns. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** Roof prop labels used for diagnostics/report cards. */
export const ROOF_PROP_LABELS: Record<RoofPropKind, string> = {
  water_tower: 'water tower',
  ac_units: 'AC units',
  antennas: 'antennas',
  satellite_dishes: 'satellite dishes',
  solar_panels: 'solar panels',
  green_roof: 'green roof',
  none: 'none',
};