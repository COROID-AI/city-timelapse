/// <reference types="node" />
/** 
 * Shared Era Types & Visual Era Data Registry 
 * 
 * This module provides the single source of truth for all era-specific visual data
 * that drives scene transformations in the Café Time Period Timelapse project. 
 * 
 * Constraints:
 * - EraId union type must exactly match: '1945' | '1965' | '1985' | '2005' | '2025'
 * - VisualEraData interface must include all specified visual domain fields
 * - All 5 eras must have complete, historically researched data
 * - Must preserve existing audio-era type definitions from the manual implementation plan
 */

/* (1) EraId union type: exactly 5 values matching the era years */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

// (2) EraSpec interface with id, year, label, description fields
export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

/* (3) ERA_REGISTRY ordered array of EraSpec objects with period-appropriate metadata */
export const ERA_REGISTRY: EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Era',
    description: 'A city recovering from World War II. Rationing is ending, but reconstruction and the rise of new consumer culture define the landscape. Jazz age influences blend with emerging suburban optimism.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Civil Rights Era',
    description: 'A period of social transformation and cultural upheaval. The civil rights movement, counterculture, and anti-war protests reshape society. Music, fashion, and art reflect a generation questioning established norms.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon & Reagan Era',
    description: 'The mid-80s boom with neon aesthetics, yuppie culture, and the rise of personal computing. Wall Street optimism meets arcade culture. Fashion is bold, colors are vibrant, and technology begins entering the mainstream.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Digital Transition Era',
    description: 'The early internet age. Social media emerges, smartphones replace traditional cameras, and coffee culture becomes global. A bridge between analog and digital, with emerging WiFi and the first true broadband era.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Connected Future Era',
    description: 'The mid-2020s with pervasive connectivity, AI-assisted everything, and sustainable design. Coffee culture is hyper-personalized. Augmented reality overlays, ambient IoT, and minimalist aesthetics define the physical and digital landscape.',
  },
];

/* (4) ERA_IDS readonly list of all EraId values */
export const ERA_IDS: ReadonlyArray<EraId> = ['1945', '1965', '1985', '2005', '2025'];

/* (5) getEraSpec(id) lookup helper function */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Invalid EraId: ${id}. Must be one of: ${ERA_IDS.join(', ')}`);
  }
  return spec;
}

/* (6) VisualEraData interface defining per-era scene parameters
 * All fields must be populated with historically accurate period details for all 5 eras */
export interface VisualEraData {
  wallColor: string;
  floorMaterial: string;
  ceilingStyle: string;
  lightingType: string;
  furnitureStyle: string;
  counterDesign: string;
  menuItems: MenuItem[];
  posterAds: PosterAd[];
  patronStyles: PatronStyle[];
  equipmentTypes: EquipmentType;
  tablewareStyle: string;
  signageFont: string;
  ambientLightColor: string;
  fogDensity: number;
  windowTreatments: string;
  outdoorViewStyle: string;
}

export interface MenuItem {
  name: string;
  price: number;
  image?: string;
}

export interface PosterAd {
  text: string;
  imageUrl: string;
  position: 'left' | 'center' | 'right';
}

export interface PatronStyle {
  outfit: string;
  hairstyle: string;
  visibleGadget?: string;
}

export interface EquipmentType {
  coffeeMachine: string;
  tillType: string;
  posSystem: string;
}

/* (7) Historical era-specific visual data for all 5 eras
 * Each era has complete, historically researched data for every VisualEraData field */
export const VISUAL_ERA_DATA: Record<EraId, VisualEraData> = {
  '1945': {
    wallColor: '#8B4513',
    floorMaterial: 'polished_oak',
    ceilingStyle: 'exposed_beam',
    lightingType: 'warm_glow',
    furnitureStyle: 'vintage_wood',
    counterDesign: 'marble_top',
    menuItems: [
      { name: 'Coffee', price: 0.05 },
      { name: 'Tea', price: 0.03 },
      { name: 'Pie Slice', price: 0.10 },
      { name: 'Basic Sandwich', price: 0.15 },
    ],
    posterAds: [
      { text: 'Join the Army', imageUrl: '/posters/army-1945', position: 'left' },
      { text: 'Buy War Bonds', imageUrl: '/posters/bonds-1945', position: 'center' },
      { text: 'Local Diner Specials', imageUrl: '/posters/diner-1945', position: 'right' },
    ],
    patronStyles: [
      { outfit: 'federal_suit', hairstyle: 'short_cut' },
      { outfit: 'dress', hairstyle: 'victory_rolls' },
      { outfit: 'coat_hat', hairstyle: 'pompadour' },
    ],
    equipmentTypes: {
      coffeeMachine: 'manual_espresso',
      tillType: 'cash_register',
      posSystem: 'none',
    },
    tablewareStyle: 'china_plates',
    signageFont: 'serif',
    ambientLightColor: '#ffd700',
    fogDensity: 0.12,
    windowTreatments: 'curtains',
    outdoorViewStyle: 'street_view',
  },

  '1965': {
    wallColor: '#ff44cc',
    floorMaterial: 'shag_carpet',
    ceilingStyle: 'drop_ceiling',
    lightingType: 'neon_tube',
    furnitureStyle: 'mid_century',
    counterDesign: 'formica_counter',
    menuItems: [
      { name: 'Drip Coffee', price: 0.15 },
      { name: 'Club Sandwich', price: 0.65 },
      { name: 'Espresso', price: 0.25 },
      { name: 'Cheesecake', price: 0.35 },
      { name: 'Milkshake', price: 0.40 },
    ],
    posterAds: [
      { text: 'Pepsi Cola', imageUrl: '/posters/pepsi-1965', position: 'left' },
      { text: 'The Beatles', imageUrl: '/posters/beatles-1965', position: 'center' },
      { text: "Floyd's Record Store", imageUrl: '/posters/music-1965', position: 'right' },
    ],
    patronStyles: [
      { outfit: 'mod_dress', hairstyle: 'beehive' },
      { outfit: 'jeans_tshirt', hairstyle: 'long_straight' },
      { outfit: 'psychedelic_shirt', hairstyle: 'afro' },
    ],
    equipmentTypes: {
      coffeeMachine: 'percolator',
      tillType: 'mechanical_register',
      posSystem: 'manual',
    },
    tablewareStyle: 'plastic_colored',
    signageFont: 'psychedelic',
    ambientLightColor: '#fff5e6',
    fogDensity: 0.04,
    windowTreatments: 'venetian_blinds',
    outdoorViewStyle: 'convertible_drive',
  },

  '1985': {
    wallColor: '#00ff00',
    floorMaterial: 'terrazzo',
    ceilingStyle: 'suspended',
    lightingType: 'neon_sign',
    furnitureStyle: 'modular',
    counterDesign: 'chrome_counter',
    menuItems: [
      { name: 'Brewed Coffee', price: 1.25 },
      { name: 'Latte', price: 2.00 },
      { name: 'Croissant', price: 1.50 },
      { name: 'Bagel Sandwich', price: 2.50 },
    ],
    posterAds: [
      { text: 'Arcade Games', imageUrl: '/posters/arcade-1985', position: 'left' },
      { text: 'New Release Movies', imageUrl: '/posters/movies-1985', position: 'center' },
      { text: 'Walkman', imageUrl: '/posters/tech-1985', position: 'right' },
    ],
    patronStyles: [
      { outfit: 'power_suit', hairstyle: 'mullet' },
      { outfit: 'leather_jacket', hairstyle: 'perm' },
      { outfit: 'tracksuit', hairstyle: 'high_top_fade' },
    ],
    equipmentTypes: {
      coffeeMachine: 'super_automatic',
      tillType: 'electronic_register',
      posSystem: 'early_pos',
    },
    tablewareStyle: 'chrome_plate',
    signageFont: 'futura',
    ambientLightColor: '#f0f0ff',
    fogDensity: 0.06,
    windowTreatments: 'mini_blinds',
    outdoorViewStyle: 'sports_car',
  },

  '2005': {
    wallColor: '#e0e0e0',
    floorMaterial: 'polished_concrete',
    ceilingStyle: 'exposed_duct',
    lightingType: 'cfl_spiral',
    furnitureStyle: 'modern',
    counterDesign: 'waterfall_edge',
    menuItems: [
      { name: 'House Blend', price: 2.50 },
      { name: 'Cappuccino', price: 3.25 },
      { name: 'Muffin', price: 2.75 },
      { name: 'Breakfast Wrap', price: 4.50 },
      { name: 'Frappuccino', price: 4.95 },
    ],
    posterAds: [
      { text: 'WiFi Available', imageUrl: '/posters/wifi-2005', position: 'left' },
      { text: 'iTunes Music', imageUrl: '/posters/itunes-2005', position: 'center' },
      { text: 'Blog This', imageUrl: '/posters/web-2005', position: 'right' },
    ],
    patronStyles: [
      { outfit: 'business_casual', hairstyle: 'spiked' },
      { outfit: 'jeans_hoodie', hairstyle: 'long_side_sweep' },
      { outfit: 'summer_casual', hairstyle: 'short_top_long_back' },
    ],
    equipmentTypes: {
      coffeeMachine: 'semiautomatic',
      tillType: 'barcode_scanner',
      posSystem: 'windows_xp',
    },
    tablewareStyle: 'glass_tumbler',
    signageFont: 'helvetica',
    ambientLightColor: '#ffe4b5',
    fogDensity: 0.07,
    windowTreatments: 'sheer_curtains',
    outdoorViewStyle: 'suv',
  },

  '2025': {
    wallColor: '#f0f0f0',
    floorMaterial: 'bamboo',
    ceilingStyle: 'living_wall',
    lightingType: 'adaptive_led',
    furnitureStyle: 'ergonomic',
    counterDesign: 'integrated_sink',
    menuItems: [
      { name: 'Pour-Over', price: 5.00 },
      { name: 'Oat Milk Latte', price: 6.50 },
      { name: 'Avocado Toast', price: 9.00 },
      { name: 'Cold Brew', price: 5.50 },
      { name: 'Matcha Latte', price: 6.00 },
    ],
    posterAds: [
      { text: 'AR Experience', imageUrl: '/posters/ar-2025', position: 'left' },
      { text: 'AI Order', imageUrl: '/posters/ai-2025', position: 'center' },
      { text: 'Carbon Neutral', imageUrl: '/posters/sustainable-2025', position: 'right' },
    ],
    patronStyles: [
      { outfit: 'tech_wear', hairstyle: 'undercut' },
      { outfit: 'sustainable_fashion', hairstyle: 'long_woven' },
      { outfit: 'minimalist', hairstyle: 'buzz_cut' },
    ],
    equipmentTypes: {
      coffeeMachine: 'bean_to_cup',
      tillType: 'touchscreen_pos',
      posSystem: 'cloud_ios',
    },
    tablewareStyle: 'biodegradable',
    signageFont: 'inter',
    ambientLightColor: '#ffffff',
    fogDensity: 0.02,
    windowTreatments: 'smart_glass',
    outdoorViewStyle: 'e_bike',
  },
};