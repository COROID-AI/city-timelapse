/**
 * Era types and registry for the City Time Period Timelapse
 * Central configuration for all time period data including visual styles, audio, and transitions
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

export interface SfxEraData {
  ambientTones: number[];
  trafficProfile: 'horse' | 'light' | 'moderate' | 'heavy' | 'dense';
  eventTypes: string[];
  musicStyle: string;
}

/**
 * Color palette for an era
 */
export interface ColorPalette {
  primary: number;
  secondary: number;
  accent: number;
  buildingColors: number[];
  skyTint: number;
  fogColor: number;
}

/**
 * Architectural style definition for buildings
 */
export interface ArchitecturalStyle {
  styleName: string;
  description: string;
  heightRange: [number, number];
  facadeMaterials: string[];
  windowStyles: string[];
  ornamentationLevel: number; // 0-1 scale
}

/**
 * Asset variant mappings for era-specific resources
 */
export interface AssetVariants {
  vehicleTypes: string[];
  pedestrianStyles: string[];
  storefrontTypes: string[];
  buildingTypes: string[];
}

/**
 * Transition animation properties
 */
export interface TransitionConfig {
  duration: number; // in milliseconds
  easing: 'easeInOutCubic' | 'easeOutQuad' | 'linear' | 'spring';
  colorBlendDuration: number;
  scaleMorphDuration: number;
}

/**
 * Complete era configuration
 */
export interface EraConfig {
  spec: EraSpec;
  colorPalette: ColorPalette;
  architecture: ArchitecturalStyle;
  assets: AssetVariants;
  transition: TransitionConfig;
}

export const ERA_REGISTRY: EraSpec[] = [
  { id: '1945', year: 1945, label: '1945', description: 'Post-war era with horse-drawn carriages and early automobiles' },
  { id: '1965', year: 1965, label: '1965', description: 'Mid-century with classic cars and early urban development' },
  { id: '1985', year: 1985, label: '1985', description: 'Modern era with glass buildings and increased traffic' },
  { id: '2005', year: 2005, label: '2005', description: 'Digital age with smartphones and modern architecture' },
  { id: '2025', year: 2025, label: '2025', description: 'Future with electric vehicles and smart city features' }
];

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map(e => e.id);

export function getEraSpec(id: EraId): EraSpec | undefined {
  return ERA_REGISTRY.find(e => e.id === id);
}

/**
 * Color palettes for each era
 */
export const ERA_COLOR_PALETTES: Record<EraId, ColorPalette> = {
  '1945': {
    primary: 0x8B4513, // SaddleBrown - earthy tones
    secondary: 0xCD853F, // Peru - warm browns
    accent: 0x8B0000, // DarkRed - vintage accent
    buildingColors: [0x8B4513, 0xCD853F, 0xA0522D, 0x654321],
    skyTint: 0x87ceeb,
    fogColor: 0x87ceeb
  },
  '1965': {
    primary: 0x4169E1, // RoyalBlue - vibrant era colors
    secondary: 0xFF69B4, // HotPink - mid-century modern
    accent: 0x32CD32, // LimeGreen - pop colors
    buildingColors: [0x9370DB, 0x4169E1, 0x8B008B, 0x2F4F4F],
    skyTint: 0x81d4fa,
    fogColor: 0x81d4fa
  },
  '1985': {
    primary: 0x708090, // SlateGray - industrial era
    secondary: 0xC0C0C0, // Silver - modern materials
    accent: 0x000080, // Navy - corporate colors
    buildingColors: [0x2F4F4F, 0x708090, 0x778899, 0x2C3539],
    skyTint: 0x607d8b,
    fogColor: 0x607d8b
  },
  '2005': {
    primary: 0x000000, // Black - digital minimalism
    secondary: 0xFFFFFF, // White - clean aesthetic
    accent: 0x0000FF, // Blue - tech accent
    buildingColors: [0x000080, 0x87CEEB, 0xFFFFFF, 0xC0C0C0],
    skyTint: 0x4fc3f7,
    fogColor: 0x4fc3f7
  },
  '2025': {
    primary: 0x00CED1, // MediumTurquoise - futuristic cyan
    secondary: 0x1E90FF, // DodgerBlue - smart tech
    accent: 0x98FB98, // PaleGreen - eco-tech
    buildingColors: [0x00CED1, 0x1E90FF, 0x87CEFA, 0x98FB98],
    skyTint: 0x00bfa5,
    fogColor: 0x00bfa5
  }
};

/**
 * Architectural styles for each era
 */
export const ERA_ARCHITECTURE: Record<EraId, ArchitecturalStyle> = {
  '1945': {
    styleName: 'Industrial Revival',
    description: 'Brick facades, ornate cornices, fire escapes, awnings',
    heightRange: [4, 8],
    facadeMaterials: ['brick', 'stone', 'wood', 'metal'],
    windowStyles: ['small-pane', 'double-hung', 'bay-window'],
    ornamentationLevel: 0.8
  },
  '1965': {
    styleName: 'Mid-Century Modern',
    description: 'Clean lines, large windows, minimal ornamentation',
    heightRange: [6, 12],
    facadeMaterials: ['brick', 'concrete', 'tile', 'metal'],
    windowStyles: ['large-pane', 'casement', 'picture-window'],
    ornamentationLevel: 0.5
  },
  '1985': {
    styleName: 'International Style',
    description: 'Glass curtain walls, steel frames, geometric patterns',
    heightRange: [10, 20],
    facadeMaterials: ['glass', 'steel', 'concrete'],
    windowStyles: ['glass-curtain', 'reflective-glass', 'strip-windows'],
    ornamentationLevel: 0.3
  },
  '2005': {
    styleName: 'Postmodern',
    description: 'Mixed materials, LED facades, varied forms',
    heightRange: [15, 30],
    facadeMaterials: ['glass', 'steel', 'composite', 'LED-panel'],
    windowStyles: ['floor-to-ceiling', 'energy-efficient', 'smart-glass'],
    ornamentationLevel: 0.6
  },
  '2025': {
    styleName: 'Biophilic Smart',
    description: 'Living walls, smart surfaces, carbon fiber, dynamic facades',
    heightRange: [20, 40],
    facadeMaterials: ['smart-glass', 'carbon-fiber', 'bioluminescent', 'biophilic-panel'],
    windowStyles: ['smart-glass', 'electrochromic', 'transparent-solar'],
    ornamentationLevel: 0.4
  }
};

/**
 * Asset variants for each era
 */
export const ERA_ASSET_VARIANTS: Record<EraId, AssetVariants> = {
  '1945': {
    vehicleTypes: ['car', 'truck', 'bus', 'horse-drawn'],
    pedestrianStyles: ['fedora', 'flat-cap', 'headscarf', 'business', 'casual', 'worker'],
    storefrontTypes: ['general-store', 'clothing', 'restaurant', 'cafe', 'bank'],
    buildingTypes: ['residential', 'commercial', 'industrial']
  },
  '1965': {
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    pedestrianStyles: ['newsboy', 'bandana', 'none', 'hair-bow', 'business', 'casual', 'worker', 'child'],
    storefrontTypes: ['general-store', 'clothing', 'record-shop', 'restaurant', 'cafe', 'bank'],
    buildingTypes: ['residential', 'commercial', 'skyscraper']
  },
  '1985': {
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    pedestrianStyles: ['baseball-cap', 'visor', 'sweatband', 'business', 'casual', 'worker', 'elderly'],
    storefrontTypes: ['electronics', 'clothing', 'restaurant', 'cafe', 'pharmacy', 'grocery'],
    buildingTypes: ['commercial', 'industrial', 'skyscraper']
  },
  '2005': {
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    pedestrianStyles: ['baseball-cap', 'beanie', 'visor', 'business', 'casual', 'worker', 'child', 'elderly'],
    storefrontTypes: ['electronics', 'clothing', 'restaurant', 'cafe', 'pharmacy', 'grocery', 'bank'],
    buildingTypes: ['commercial', 'skyscraper']
  },
  '2025': {
    vehicleTypes: ['electric', 'autonomous', 'motorcycle'],
    pedestrianStyles: ['smart-cap', 'visor', 'none', 'ar-glasses', 'business', 'casual', 'worker', 'elderly'],
    storefrontTypes: ['electronics', 'grocery', 'cafe', 'pharmacy', 'restaurant'],
    buildingTypes: ['skyscraper', 'commercial']
  }
};

/**
 * Transition configurations for each era transition
 */
export const ERA_TRANSITION_CONFIG: Record<EraId, TransitionConfig> = {
  '1945': {
    duration: 2000,
    easing: 'easeInOutCubic',
    colorBlendDuration: 1500,
    scaleMorphDuration: 1800
  },
  '1965': {
    duration: 1800,
    easing: 'easeInOutCubic',
    colorBlendDuration: 1200,
    scaleMorphDuration: 1500
  },
  '1985': {
    duration: 1600,
    easing: 'easeInOutCubic',
    colorBlendDuration: 1000,
    scaleMorphDuration: 1400
  },
  '2005': {
    duration: 1400,
    easing: 'easeInOutCubic',
    colorBlendDuration: 800,
    scaleMorphDuration: 1200
  },
  '2025': {
    duration: 1200,
    easing: 'easeInOutCubic',
    colorBlendDuration: 600,
    scaleMorphDuration: 1000
  }
};

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTones: [110, 220, 330],
    trafficProfile: 'horse',
    eventTypes: ['horse-hooves', 'tram-bell', 'typewriter'],
    musicStyle: 'big-band'
  },
  '1965': {
    ambientTones: [220, 330, 440],
    trafficProfile: 'light',
    eventTypes: ['car-horn', 'radio-music', 'footsteps'],
    musicStyle: 'rock-roll'
  },
  '1985': {
    ambientTones: [165, 330, 660],
    trafficProfile: 'moderate',
    eventTypes: ['synth-music', 'cassette-tape', 'traffic'],
    musicStyle: 'synth-pop'
  },
  '2005': {
    ambientTones: [220, 440, 880],
    trafficProfile: 'heavy',
    eventTypes: ['cellphone', 'car-alarm', 'construction'],
    musicStyle: 'hip-hop'
  },
  '2025': {
    ambientTones: [330, 660, 1320],
    trafficProfile: 'dense',
    eventTypes: ['electric-whir', 'notification', 'drone'],
    musicStyle: 'electronic'
  }
};

/**
 * Gets complete configuration for an era
 */
export function getEraConfig(eraId: EraId): EraConfig {
  return {
    spec: getEraSpec(eraId)!,
    colorPalette: ERA_COLOR_PALETTES[eraId],
    architecture: ERA_ARCHITECTURE[eraId],
    assets: ERA_ASSET_VARIANTS[eraId],
    transition: ERA_TRANSITION_CONFIG[eraId]
  };
}

/**
 * Gets color palette for an era
 */
export function getEraColorPalette(eraId: EraId): ColorPalette {
  return ERA_COLOR_PALETTES[eraId];
}

/**
 * Gets architectural style for an era
 */
export function getEraArchitecture(eraId: EraId): ArchitecturalStyle {
  return ERA_ARCHITECTURE[eraId];
}

/**
 * Gets asset variants for an era
 */
export function getEraAssetVariants(eraId: EraId): AssetVariants {
  return ERA_ASSET_VARIANTS[eraId];
}