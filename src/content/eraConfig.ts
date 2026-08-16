/**
 * Per-era content configuration schema.
 *
 * Every layer module reads from this record to know what geometry,
 * textures, and behavioural knobs to instantiate for the active era.
 */

import type { EraId } from '../eras.js';

// ─── Per-layer data shapes ──────────────────────────────────────────────

export interface BuildingConfig {
  count: number;
  averageHeight: number; // metres
  materials: string[];  // e.g. ["brick", "concrete", "glass"]
  windowDensity: number; // 0-1
}

export interface StorefrontConfig {
  count: number;
  styles: string[];     // e.g. ["neon_sign", "awning", "digital_display"]
  hasSignage: boolean;
}

export interface AdConfig {
  billboardCount: number;
  adTypes: string[];    // e.g. ["print_billboard", "digital_screen", "hand_painted"]
  animationEnabled: boolean;
}

export interface StreetConfig {
  roadWidth: number;    // metres
  sidewalkWidth: number; // metres
  surfaceMaterial: string;
  hasCrosswalks: boolean;
  streetLightType: string;
}

export interface VehicleConfig {
  totalCount: number;
  types: string[];      // e.g. ["sedan", "truck", "bus", "bicycle"]
  movementSpeed: number; // world-units per second
}

export interface PedestrianConfig {
  totalCount: number;
  outfitStyles: string[];
  walkingSpeed: number;
}

// ─── EraContent — one typed shape per era ───────────────────────────────

export interface EraContent {
  id: EraId;
  buildings: BuildingConfig;
  storefronts: StorefrontConfig;
  ads: AdConfig;
  street: StreetConfig;
  vehicles: VehicleConfig;
  pedestrians: PedestrianConfig;
}

// ─── Default record with all five eras present ──────────────────────────

const defaultEras: Record<EraId, EraContent> = {
  '1945': {
    id: '1945',
    buildings: {
      count: 8,
      averageHeight: 12,
      materials: ['brick', 'stone', 'wood'],
      windowDensity: 0.4,
    },
    storefronts: {
      count: 6,
      styles: ['awning', 'hand_painted_sign'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 2,
      adTypes: ['hand_painted', 'newspaper_clipping'],
      animationEnabled: false,
    },
    street: {
      roadWidth: 8,
      sidewalkWidth: 2,
      surfaceMaterial: 'cobblestone',
      hasCrosswalks: false,
      streetLightType: 'gas_lamp',
    },
    vehicles: {
      totalCount: 5,
      types: ['vintage_car', 'truck', 'bicycle'],
      movementSpeed: 1.5,
    },
    pedestrians: {
      totalCount: 12,
      outfitStyles: ['1940s_suit', 'apron_dress', 'fedora'],
      walkingSpeed: 1.0,
    },
  },
  '1965': {
    id: '1965',
    buildings: {
      count: 10,
      averageHeight: 18,
      materials: ['brick', 'concrete', 'glass'],
      windowDensity: 0.55,
    },
    storefronts: {
      count: 8,
      styles: ['neon_sign', 'awning', 'plate_glass'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 3,
      adTypes: ['neon_billboard', 'poster_wall'],
      animationEnabled: false,
    },
    street: {
      roadWidth: 10,
      sidewalkWidth: 2.5,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'fluorescent_tube',
    },
    vehicles: {
      totalCount: 12,
      types: ['classic_sedan', 'convertible', 'delivery_truck', 'bicycle'],
      movementSpeed: 2.5,
    },
    pedestrians: {
      totalCount: 20,
      outfitStyles: ['mod_suit', 'flower_power', 'casual_60s'],
      walkingSpeed: 1.2,
    },
  },
  '1985': {
    id: '1985',
    buildings: {
      count: 12,
      averageHeight: 25,
      materials: ['brick', 'steel', 'glass', 'concrete'],
      windowDensity: 0.65,
    },
    storefronts: {
      count: 10,
      styles: ['neon_sign', 'digital_display', 'graffiti_wall'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 4,
      adTypes: ['neon_billboard', 'graffiti_tag', 'cassette_ad'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 12,
      sidewalkWidth: 3,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'sodium_vapor',
    },
    vehicles: {
      totalCount: 18,
      types: ['sports_car', 'minivan', 'taxi', 'motorcycle', 'bicycle'],
      movementSpeed: 3.0,
    },
    pedestrians: {
      totalCount: 30,
      outfitStyles: ['power_suit', 'punk', 'athleisure'],
      walkingSpeed: 1.4,
    },
  },
  '2005': {
    id: '2005',
    buildings: {
      count: 14,
      averageHeight: 35,
      materials: ['glass', 'steel', 'concrete', 'stone_facade'],
      windowDensity: 0.75,
    },
    storefronts: {
      count: 12,
      styles: ['digital_display', 'glass_front', 'branded_sign'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 5,
      adTypes: ['digital_screen', 'wraparound_banner', 'storefront_branding'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 14,
      sidewalkWidth: 3.5,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'led_panel',
    },
    vehicles: {
      totalCount: 25,
      types: ['sedan', 'suv', 'hybrid', 'taxi', 'bus', 'bicycle'],
      movementSpeed: 3.5,
    },
    pedestrians: {
      totalCount: 40,
      outfitStyles: ['business_casual', 'tech_start-up', 'jeans_and_tee'],
      walkingSpeed: 1.5,
    },
  },
  '2025': {
    id: '2025',
    buildings: {
      count: 16,
      averageHeight: 50,
      materials: ['smart_glass', 'timber', 'recycled_composite', 'steel'],
      windowDensity: 0.85,
    },
    storefronts: {
      count: 14,
      styles: ['augmented_window', 'holographic_sign', 'interactive_display'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 6,
      adTypes: ['holographic_projection', 'dynamic_led_wall', 'ar_overlay'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 16,
      sidewalkWidth: 4,
      surfaceMaterial: 'permeable_paver',
      hasCrosswalks: true,
      streetLightType: 'smart_led_smart_sensor',
    },
    vehicles: {
      totalCount: 20,
      types: ['autonomous_shuttle', 'ev_sedan', 'cargo_bot', 'drone_deliverer'],
      movementSpeed: 2.0,
    },
    pedestrians: {
      totalCount: 35,
      outfitStyles: ['smart_wear', 'sustainable_fashion', 'adaptive_clothing'],
      walkingSpeed: 1.3,
    },
  },
};

export default defaultEras;
