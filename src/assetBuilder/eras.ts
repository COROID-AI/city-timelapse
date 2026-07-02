/**
 * Asset set definitions and selector for the procedural asset builders.
 *
 * Where `src/eras.ts` holds the abstract era identity & SFX metadata, this
 * module holds the *visual* asset parameters: building facades, vehicle
 * silhouettes, signage, pedestrian outfits, and street furniture. Every mesh
 * builder in `src/assetBuilder/` consumes an `AssetSet` produced here.
 */

import type { EraId, EraSpec } from '../eras.js';

// ─────────────────────────────────────────────────────────────────────────────
// Building / facade data
// ─────────────────────────────────────────────────────────────────────────────

export type WindowStyle =
  | 'small-grid'
  | 'double-hung'
  | 'ribbon'
  | 'curtain-wall'
  | 'glass-tower'
  | 'smart-glass';

export type RoofStyle =
  | 'flat'
  | 'water-tank'
  | 'antenna'
  | 'ac-units'
  | 'solar';

export type AdStyle =
  | 'painted'
  | 'neon'
  | 'backlit'
  | 'led-screen'
  | 'holographic';

export interface BuildingAssetData {
  /** Wall / facade base colors (hex). */
  readonly facadePalette: readonly string[];
  /** Trim & accent color. */
  readonly accentColor: string;
  /** Window frame color. */
  readonly windowFrameColor: string;
  readonly windowStyle: WindowStyle;
  readonly roofStyle: RoofStyle;
  /** Min/max stories for generated buildings. */
  readonly heightRange: readonly [number, number];
  /** 0–1 likelihood a building carries a storefront at street level. */
  readonly storefrontDensity: number;
  readonly adStyle: AdStyle;
  /** Signage text snippets appropriate to the era. */
  readonly signageWords: readonly string[];
  /** Masonry detail: brick courses, panel lines, etc. */
  readonly masonry: 'brick' | 'concrete' | 'steel-glass' | 'curtain' | 'composite';
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle data
// ─────────────────────────────────────────────────────────────────────────────

export type VehicleShape =
  | 'rounded-sedan'
  | 'muscle'
  | 'boxy-sedan'
  | 'suv'
  | 'ev'
  | 'trolley';

export interface VehicleAssetData {
  readonly shapes: readonly VehicleShape[];
  /** Paint colors (hex). */
  readonly palette: readonly string[];
  readonly wheelColor: string;
  readonly headlightColor: string;
  readonly taillightColor: string;
  /** 0–1 chance of a roof accent (rack, antenna, light bar). */
  readonly roofAccentChance: number;
  /** Body length range in world units. */
  readonly lengthRange: readonly [number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedestrian / outfit data
// ─────────────────────────────────────────────────────────────────────────────

export type HatStyle =
  | 'fedora'
  | 'cap'
  | 'none'
  | 'beanie'
  | 'hood'
  | 'cap-smart';

export interface OutfitPalette {
  /** [shirt, pants, accessory] color triples. */
  readonly combos: readonly (readonly [string, string, string])[];
  readonly hatStyle: HatStyle;
  readonly skinTones: readonly string[];
  /** 0–1 chance of a bag/briefcase prop. */
  readonly bagChance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Street furniture data
// ─────────────────────────────────────────────────────────────────────────────

export type LampStyle =
  | 'gas'
  | 'cobra'
  | 'high-pressure-sodium'
  | 'led'
  | 'smart';

export interface StreetAssetData {
  readonly lampStyle: LampStyle;
  readonly lampColor: string;
  /** Light intensity emitted by a lamp (candela-ish). */
  readonly lampIntensity: number;
  readonly roadColor: string;
  readonly sidewalkColor: string;
  readonly curbColor: string;
  readonly hasTrolleyTracks: boolean;
  readonly hasCrosswalkStripes: boolean;
  /** Tree foliage color. */
  readonly foliageColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate asset set
// ─────────────────────────────────────────────────────────────────────────────

/** Complete visual asset specification for a single era. */
export interface AssetSet {
  readonly eraId: EraId;
  readonly building: BuildingAssetData;
  readonly vehicle: VehicleAssetData;
  readonly pedestrian: OutfitPalette;
  readonly street: StreetAssetData;
  /** Sky gradient top/bottom colors. */
  readonly skyTop: string;
  readonly skyBottom: string;
  /** Fog color matched to the era atmosphere. */
  readonly fogColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-era asset sets
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_SETS: Readonly<Record<EraId, AssetSet>> = {
  '1945': {
    eraId: '1945',
    building: {
      facadePalette: ['#8a4b3a', '#7a6a5a', '#9c8b6f', '#6b5d4f', '#b0a088'],
      accentColor: '#d8c8a8',
      windowFrameColor: '#3a3530',
      windowStyle: 'double-hung',
      roofStyle: 'water-tank',
      heightRange: [4, 9],
      storefrontDensity: 0.7,
      adStyle: 'painted',
      signageWords: ['DINER', 'HOTEL', 'TAILOR', 'APOTHECARY', 'BAKERY', 'BARBER', 'GARAGE', 'CAFÉ'],
      masonry: 'brick',
    },
    vehicle: {
      shapes: ['rounded-sedan', 'trolley'],
      palette: ['#2b2b2b', '#5a2a2a', '#1a3a5a', '#4a4a3a', '#6b6b6b'],
      wheelColor: '#1a1a1a',
      headlightColor: '#fff2cc',
      taillightColor: '#8b2020',
      roofAccentChance: 0.1,
      lengthRange: [3.6, 4.4],
    },
    pedestrian: {
      combos: [
        ['#3a4a6a', '#2a2a3a', '#8a7a5a'],
        ['#6a4a3a', '#3a3a2a', '#7a6a4a'],
        ['#4a4a4a', '#5a4a3a', '#9a8a6a'],
        ['#5a3a3a', '#2a2a2a', '#8a7a5a'],
        ['#3a5a4a', '#4a3a2a', '#7a6a4a'],
      ],
      hatStyle: 'fedora',
      skinTones: ['#e0b08a', '#c89060', '#a06040', '#7a4a2a'],
      bagChance: 0.35,
    },
    street: {
      lampStyle: 'gas',
      lampColor: '#ffb060',
      lampIntensity: 6,
      roadColor: '#3a3530',
      sidewalkColor: '#8a8478',
      curbColor: '#6a655a',
      hasTrolleyTracks: true,
      hasCrosswalkStripes: false,
      foliageColor: '#3a5a3a',
    },
    skyTop: '#6a7a9a',
    skyBottom: '#c8b8a0',
    fogColor: '#b0a898',
  },

  '1965': {
    eraId: '1965',
    building: {
      facadePalette: ['#9a9a8a', '#7a8a9a', '#b0a890', '#8a7a6a', '#c0b8a0'],
      accentColor: '#e8d8b8',
      windowFrameColor: '#2a2a2a',
      windowStyle: 'ribbon',
      roofStyle: 'antenna',
      heightRange: [6, 16],
      storefrontDensity: 0.75,
      adStyle: 'neon',
      signageWords: ['MOTEL', 'GASOLINE', 'DINER', 'CINEMA', 'LIQUOR', 'GARAGE', 'CAFÉ', 'DRUGS'],
      masonry: 'concrete',
    },
    vehicle: {
      shapes: ['muscle', 'rounded-sedan'],
      palette: ['#8b1a1a', '#1a3a8a', '#d8b020', '#2a2a2a', '#3a6a3a', '#c8c8c8'],
      wheelColor: '#1a1a1a',
      headlightColor: '#fff8e0',
      taillightColor: '#a02020',
      roofAccentChance: 0.15,
      lengthRange: [4.6, 5.4],
    },
    pedestrian: {
      combos: [
        ['#8a1a1a', '#1a1a2a', '#c0b090'],
        ['#1a3a6a', '#2a2a3a', '#d0c0a0'],
        ['#c0c0c0', '#3a3a4a', '#b0a080'],
        ['#3a6a3a', '#4a3a2a', '#c8b890'],
        ['#d8b020', '#5a4a2a', '#b8a878'],
      ],
      hatStyle: 'cap',
      skinTones: ['#e0b08a', '#c89060', '#a06040', '#7a4a2a'],
      bagChance: 0.3,
    },
    street: {
      lampStyle: 'cobra',
      lampColor: '#ffe0a0',
      lampIntensity: 10,
      roadColor: '#2a2a2a',
      sidewalkColor: '#9a9488',
      curbColor: '#5a5550',
      hasTrolleyTracks: false,
      hasCrosswalkStripes: true,
      foliageColor: '#4a6a3a',
    },
    skyTop: '#5a8aba',
    skyBottom: '#d8c8a0',
    fogColor: '#c8c0a8',
  },

  '1985': {
    eraId: '1985',
    building: {
      facadePalette: ['#4a5a6a', '#6a5a4a', '#8a8a9a', '#5a4a5a', '#3a4a5a'],
      accentColor: '#e8e0d0',
      windowFrameColor: '#1a1a1a',
      windowStyle: 'curtain-wall',
      roofStyle: 'ac-units',
      heightRange: [10, 30],
      storefrontDensity: 0.8,
      adStyle: 'backlit',
      signageWords: ['VIDEO', 'ARCADE', 'PIZZA', 'BANK', 'ELECTRONICS', 'TOWER', 'CLUB', 'TECH'],
      masonry: 'steel-glass',
    },
    vehicle: {
      shapes: ['boxy-sedan', 'muscle'],
      palette: ['#8a8a8a', '#2a2a3a', '#6a2a2a', '#3a4a6a', '#c8c8c8', '#8a6a2a'],
      wheelColor: '#1a1a1a',
      headlightColor: '#fffce8',
      taillightColor: '#c02020',
      roofAccentChance: 0.2,
      lengthRange: [4.4, 5.2],
    },
    pedestrian: {
      combos: [
        ['#c83a6a', '#2a2a4a', '#e8d8a0'],
        ['#2a8a8a', '#4a4a5a', '#d8c890'],
        ['#8a3a8a', '#3a3a3a', '#c0b080'],
        ['#3a6ac8', '#5a5a6a', '#e0d0a8'],
        ['#c8c81a', '#3a3a4a', '#b8a878'],
      ],
      hatStyle: 'none',
      skinTones: ['#e0b08a', '#c89060', '#a06040', '#7a4a2a', '#5a3818'],
      bagChance: 0.45,
    },
    street: {
      lampStyle: 'high-pressure-sodium',
      lampColor: '#ffa030',
      lampIntensity: 18,
      roadColor: '#262626',
      sidewalkColor: '#8a8478',
      curbColor: '#4a4540',
      hasTrolleyTracks: false,
      hasCrosswalkStripes: true,
      foliageColor: '#3a5a2a',
    },
    skyTop: '#4a6a8a',
    skyBottom: '#c89878',
    fogColor: '#b89880',
  },

  '2005': {
    eraId: '2005',
    building: {
      facadePalette: ['#6a7a8a', '#8a8a8a', '#5a6a7a', '#9a9a8a', '#7a8a7a'],
      accentColor: '#f0f0e8',
      windowFrameColor: '#2a2a2a',
      windowStyle: 'glass-tower',
      roofStyle: 'ac-units',
      heightRange: [14, 42],
      storefrontDensity: 0.85,
      adStyle: 'led-screen',
      signageWords: ['WIFI', 'COFFEE', 'GYM', 'BANK', 'MOBILE', 'PLAZA', 'TECH', 'MART'],
      masonry: 'curtain',
    },
    vehicle: {
      shapes: ['suv', 'boxy-sedan'],
      palette: ['#2a2a2a', '#9a9a9a', '#3a4a5a', '#6a6a6a', '#c8c8c8', '#5a3a2a'],
      wheelColor: '#1a1a1a',
      headlightColor: '#ffffff',
      taillightColor: '#d02020',
      roofAccentChance: 0.3,
      lengthRange: [4.6, 5.6],
    },
    pedestrian: {
      combos: [
        ['#4a8a4a', '#3a3a3a', '#d0c8a0'],
        ['#8a6a4a', '#4a4a5a', '#c0b890'],
        ['#3a6ac8', '#2a2a3a', '#e0d8b0'],
        ['#c8c8c8', '#3a3a4a', '#b8b080'],
        ['#8a3a3a', '#4a4a4a', '#d8d0a8'],
      ],
      hatStyle: 'beanie',
      skinTones: ['#e0b08a', '#c89060', '#a06040', '#7a4a2a', '#5a3818'],
      bagChance: 0.5,
    },
    street: {
      lampStyle: 'high-pressure-sodium',
      lampColor: '#ffb850',
      lampIntensity: 22,
      roadColor: '#222222',
      sidewalkColor: '#868078',
      curbColor: '#404040',
      hasTrolleyTracks: false,
      hasCrosswalkStripes: true,
      foliageColor: '#3a5a2a',
    },
    skyTop: '#5a8aaa',
    skyBottom: '#c8b8a8',
    fogColor: '#b0a8a0',
  },

  '2025': {
    eraId: '2025',
    building: {
      facadePalette: ['#5a7a8a', '#8a9a9a', '#4a6a7a', '#a0b0b0', '#6a8a8a'],
      accentColor: '#f8f8f0',
      windowFrameColor: '#3a3a3a',
      windowStyle: 'smart-glass',
      roofStyle: 'solar',
      heightRange: [18, 55],
      storefrontDensity: 0.9,
      adStyle: 'holographic',
      signageWords: ['NEXUS', 'HUB', 'EATS', 'FIT', 'PAY', 'AI', 'CLOUD', 'GO'],
      masonry: 'composite',
    },
    vehicle: {
      shapes: ['ev', 'suv'],
      palette: ['#e8e8e8', '#2a2a2a', '#4a8a8a', '#8a8a8a', '#c8d8e8', '#3a5a6a'],
      wheelColor: '#1a1a1a',
      headlightColor: '#e8f0ff',
      taillightColor: '#e02040',
      roofAccentChance: 0.25,
      lengthRange: [4.4, 5.4],
    },
    pedestrian: {
      combos: [
        ['#3a8a8a', '#2a2a3a', '#e0e0d0'],
        ['#8a8a8a', '#3a3a4a', '#d8d8c8'],
        ['#2a6a8a', '#4a4a5a', '#e8e8d8'],
        ['#6a8a3a', '#3a3a3a', '#d0d0c0'],
        ['#c86a8a', '#4a4a5a', '#e8e0d0'],
      ],
      hatStyle: 'cap-smart',
      skinTones: ['#e0b08a', '#c89060', '#a06040', '#7a4a2a', '#5a3818'],
      bagChance: 0.4,
    },
    street: {
      lampStyle: 'led',
      lampColor: '#e8f0ff',
      lampIntensity: 28,
      roadColor: '#1e1e1e',
      sidewalkColor: '#928c82',
      curbColor: '#383838',
      hasTrolleyTracks: false,
      hasCrosswalkStripes: true,
      foliageColor: '#4a7a3a',
    },
    skyTop: '#3a6a9a',
    skyBottom: '#b8d0d8',
    fogColor: '#a8c0c8',
  },
};

/**
 * Select the complete visual asset set for an era.
 * This is the single entry point every mesh builder uses.
 */
export function getAssetSet(spec: EraSpec): AssetSet {
  return ASSET_SETS[spec.id];
}

/** Select the asset set directly by era id. */
export function getAssetSetById(id: EraId): AssetSet {
  return ASSET_SETS[id];
}
