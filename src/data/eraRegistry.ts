/**
 * Era registry: aggregates all five era definitions keyed by year.
 *
 * Downstream era modules import `eraRegistry` (or `getEra`) to resolve the
 * `EraDefinition` for a given `EraKey`. This is the single aggregation point;
 * later tasks consuming it must not recreate this map.
 */
import type { EraDefinition, EraKey } from './eraDefinition';

/** All supported eras in chronological order. */
export const ERA_KEYS: readonly EraKey[] = [1945, 1965, 1985, 2005, 2025];

/**
 * The complete registry of era definitions keyed by year.
 *
 * These are contract-level definitions only: they describe the *data* for
 * each era (palette, building styles, vehicles, storefronts, ads, street
 * props, lighting, audio cue ids). No Three.js scene content is created here
 * — the downstream era-content tasks implement the visuals from this data.
 */
export const eraRegistry: Record<EraKey, EraDefinition> = {
  1945: {
    year: 1945,
    palette: {
      sky: '#c9c2b0',
      ground: '#8a7f6d',
      buildingBase: '#7a6a55',
      buildingAccent: '#5c4d3d',
      accent: '#3f3a2e',
      nightfall: '#2b2b2b',
    },
    buildingStyles: [
      {
        name: 'prewar-brick',
        heightRange: [8, 18],
        floors: 4,
        palette: ['buildingBase', 'buildingAccent'],
        material: 'brick',
        features: ['cornice', 'fireEscape'],
      },
      {
        name: 'prewar-stone',
        heightRange: [10, 24],
        floors: 6,
        palette: ['buildingBase', 'accent'],
        material: 'stone',
        features: ['cornice'],
      },
    ],
    vehicles: ['sedan', 'truck', 'bus', 'taxi'],
    storefronts: ['butcher', 'bakery', 'hardware', 'barber'],
    ads: ['paintedSign', 'windowSign'],
    streetProps: ['hydrant', 'streetLamp', 'newsstand', 'bench'],
    lighting: {
      ambientIntensity: 0.6,
      directionalIntensity: 1.0,
      warmth: 0.9,
      isNight: false,
      fogColor: '#c9c2b0',
    },
    audioCues: ['ambient', 'sfxBirds', 'sfxTraffic', 'sfxCarHorn'],
  },
  1965: {
    year: 1965,
    palette: {
      sky: '#a9c3d8',
      ground: '#8d8b84',
      buildingBase: '#9a8f80',
      buildingAccent: '#6d6a63',
      accent: '#c05a3c',
      nightfall: '#232323',
    },
    buildingStyles: [
      {
        name: 'midcentury-brick',
        heightRange: [12, 30],
        floors: 8,
        palette: ['buildingBase', 'buildingAccent'],
        material: 'brick',
        features: ['roofDeck'],
      },
      {
        name: 'midcentury-concrete',
        heightRange: [20, 45],
        floors: 12,
        palette: ['buildingAccent', 'accent'],
        material: 'concrete',
        features: ['waterTower'],
      },
    ],
    vehicles: ['sedan', 'truck', 'bus', 'taxi', 'motorcycle'],
    storefronts: ['diner', 'departmentStore', 'gasStation', 'barber'],
    ads: ['neonSign', 'billboard'],
    streetProps: ['streetLamp', 'payphone', 'bench', 'hydrant'],
    lighting: {
      ambientIntensity: 0.55,
      directionalIntensity: 0.95,
      warmth: 0.8,
      isNight: false,
      fogColor: '#a9c3d8',
    },
    audioCues: ['ambient', 'sfxTraffic', 'sfxCarHorn', 'sfxRadio'],
  },
  1985: {
    year: 1985,
    palette: {
      sky: '#7fa8c9',
      ground: '#6f6f6e',
      buildingBase: '#5f6b74',
      buildingAccent: '#8a8f8a',
      accent: '#e0457b',
      nightfall: '#1c1c1e',
    },
    buildingStyles: [
      {
        name: 'latecentury-glass',
        heightRange: [25, 60],
        floors: 18,
        palette: ['buildingBase', 'buildingAccent'],
        material: 'glass',
        features: ['antennas'],
      },
      {
        name: 'latecentury-concrete',
        heightRange: [30, 70],
        floors: 22,
        palette: ['buildingAccent', 'accent'],
        material: 'concrete',
        features: ['roofDeck'],
      },
    ],
    vehicles: ['sedan', 'suv', 'bus', 'truck', 'taxi', 'motorcycle'],
    storefronts: ['videoStore', 'arcade', 'pizza', 'electronics'],
    ads: ['neonSign', 'billboard', 'marquee'],
    streetProps: ['streetLamp', 'payphone', 'busStop', 'newsstand'],
    lighting: {
      ambientIntensity: 0.5,
      directionalIntensity: 0.9,
      warmth: 0.7,
      isNight: false,
      fogColor: '#7fa8c9',
    },
    audioCues: ['ambient', 'sfxTraffic', 'sfxRadio', 'sfxNeon'],
  },
  2005: {
    year: 2005,
    palette: {
      sky: '#6f9ec2',
      ground: '#5f5f5e',
      buildingBase: '#4d5b66',
      buildingAccent: '#7d8b94',
      accent: '#2f86c8',
      nightfall: '#15151a',
    },
    buildingStyles: [
      {
        name: 'modern-glass',
        heightRange: [40, 90],
        floors: 28,
        palette: ['buildingBase', 'buildingAccent'],
        material: 'glass',
        features: ['antennas', 'roofDeck'],
      },
      {
        name: 'modern-steel',
        heightRange: [35, 80],
        floors: 24,
        palette: ['buildingAccent', 'accent'],
        material: 'metal',
        features: ['roofDeck'],
      },
    ],
    vehicles: ['sedan', 'suv', 'truck', 'bus', 'taxi', 'police'],
    storefronts: ['coffee', 'electronics', 'pharmacy', 'fastFood'],
    ads: ['billboard', 'digitalSign', 'marquee'],
    streetProps: ['streetLamp', 'busStop', 'bikeRack', 'newsstand'],
    lighting: {
      ambientIntensity: 0.45,
      directionalIntensity: 0.85,
      warmth: 0.6,
      isNight: false,
      fogColor: '#6f9ec2',
    },
    audioCues: ['ambient', 'sfxTraffic', 'sfxPedestrians', 'sfxConstruction'],
  },
  2025: {
    year: 2025,
    palette: {
      sky: '#5a8bb0',
      ground: '#4f4f4e',
      buildingBase: '#3c4a56',
      buildingAccent: '#6b7d8c',
      accent: '#00d1ff',
      nightfall: '#0e0e12',
    },
    buildingStyles: [
      {
        name: 'contemporary-glass',
        heightRange: [50, 120],
        floors: 36,
        palette: ['buildingBase', 'buildingAccent'],
        material: 'glass',
        features: ['antennas', 'roofDeck', 'verticalGarden'],
      },
      {
        name: 'contemporary-concrete',
        heightRange: [40, 100],
        floors: 30,
        palette: ['buildingAccent', 'accent'],
        material: 'concrete',
        features: ['roofDeck'],
      },
    ],
    vehicles: ['suv', 'sedan', 'bus', 'truck', 'police', 'motorcycle'],
    storefronts: ['coffee', 'grocery', 'gym', 'techShop'],
    ads: ['digitalSign', 'ledBillboard', 'videoWall'],
    streetProps: ['streetLamp', 'busStop', 'bikeRack', 'chargingStation'],
    lighting: {
      ambientIntensity: 0.4,
      directionalIntensity: 0.8,
      warmth: 0.5,
      isNight: false,
      fogColor: '#5a8bb0',
    },
    audioCues: ['ambient', 'sfxTraffic', 'sfxPedestrians', 'sfxNeon'],
  },
};

/** Resolve the definition for a given year. */
export function getEra(year: EraKey): EraDefinition {
  return eraRegistry[year];
}