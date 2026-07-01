import {
  EraDefinition,
  EraOutfitStyle,
  EraProp,
  EraStorefront,
  EraVehicleStyle,
  PeriodYear,
  YEARS,
} from './types';

const sharedCivilianOutfits: EraOutfitStyle[] = [
  { torso: '#6b5b4a', legs: '#3b3b3b', hair: '#2a2018', skin: '#d8a878' },
  { torso: '#7a4a3a', legs: '#2a2a2a', hair: '#1a1410', skin: '#c89868' },
  { torso: '#4a5a6a', legs: '#3a3a3a', hair: '#3a2a18', skin: '#e8b890' },
];

export const ERA_DATA: Record<PeriodYear, EraDefinition> = {
  1945: {
    year: 1945,
    label: '1945 · Wartime',
    palette: {
      sky: '#c9b8a0',
      skyTop: '#9a8a72',
      sun: '#f2d9a0',
      ground: '#5a4d3a',
      fog: '#b8a890',
    },
    buildings: {
      residential: { wall: '#6e5b3e', roof: '#3a2c1c', window: '#e8c878', trim: '#4a3a26', facade: 'wood', heightRange: [6, 10] },
      commercial: { wall: '#8a7654', roof: '#4a3420', window: '#f0d088', trim: '#5a4028', facade: 'wood', heightRange: [5, 8] },
      office: { wall: '#7a6a4a', roof: '#3a3024', window: '#e0c070', trim: '#4a4030', facade: 'brick', heightRange: [10, 16] },
    },
    vehicles: [
      { body: '#3a2a20', trim: '#1a1a1a', roof: '#2a2018', shape: 'vintage' },
      { body: '#5a3a2a', trim: '#2a2a2a', roof: '#3a2a1c', shape: 'vintage' },
      { body: '#2a3a4a', trim: '#1a1a1a', roof: '#1a2030', shape: 'vintage' },
      { body: '#4a4a3a', trim: '#2a2a2a', roof: '#3a3a2a', shape: 'vintage' },
    ],
    outfits: [
      ...sharedCivilianOutfits,
      { torso: '#3a4a3a', legs: '#2a2a2a', hair: '#2a2018', skin: '#d8a878' },
    ],
    storefronts: [
      { sign: 'DINER', bg: '#7a4a2a', fg: '#f0e0a0', glow: null },
      { sign: 'GROCERY', bg: '#5a4a2a', fg: '#e8d088', glow: null },
      { sign: 'BAKERY', bg: '#6a5a3a', fg: '#f0dca0', glow: null },
    ],
    props: [
      { kind: 'lamp_wood', color: '#3a2c1c' },
      { kind: 'newsbox', color: '#4a3a2a' },
    ],
    audio: { bpm: 92, scale: [0, 3, 5, 7, 10], lead: 'triangle', bass: 'sine', ambience: 'distant_trains' },
  },

  1965: {
    year: 1965,
    label: '1965 · Midcentury',
    palette: {
      sky: '#a8c0d0',
      skyTop: '#6a8aa0',
      sun: '#fff0d0',
      ground: '#48484a',
      fog: '#9aaab8',
    },
    buildings: {
      residential: { wall: '#8a4a3a', roof: '#3a2820', window: '#d8e0e8', trim: '#5a3a2a', facade: 'brick', heightRange: [8, 14] },
      commercial: { wall: '#b06040', roof: '#4a2a1a', window: '#e0e8f0', trim: '#6a3a2a', facade: 'brick', heightRange: [7, 12] },
      office: { wall: '#6a7078', roof: '#3a3e44', window: '#c8d8e8', trim: '#4a5058', facade: 'concrete', heightRange: [16, 28] },
    },
    vehicles: [
      { body: '#d0d0d0', trim: '#8a8a8a', roof: '#b0b0b0', shape: 'chrome' },
      { body: '#b0303a', trim: '#5a5a5a', roof: '#7a2028', shape: 'chrome' },
      { body: '#3060c0', trim: '#6a6a6a', roof: '#20407a', shape: 'chrome' },
      { body: '#e0c040', trim: '#7a6a3a', roof: '#8a7028', shape: 'chrome' },
    ],
    outfits: [
      { torso: '#c04030', legs: '#2a2a2a', hair: '#2a1a10', skin: '#e0b080' },
      { torso: '#3060a0', legs: '#3a3a3a', hair: '#1a1008', skin: '#d8a878' },
      { torso: '#d0d0d0', legs: '#2a2a2a', hair: '#3a2a18', skin: '#f0c898' },
    ],
    storefronts: [
      { sign: 'GAS STATION', bg: '#d0c040', fg: '#2a2a2a', glow: null },
      { sign: 'DINER', bg: '#b0303a', fg: '#fff0e0', glow: null },
      { sign: 'CINEMA', bg: '#2a2a2a', fg: '#e0e0e0', glow: '#ff8040' },
    ],
    props: [
      { kind: 'lamp_steel', color: '#3a3a3a' },
      { kind: 'newsbox', color: '#3a4a6a' },
    ],
    audio: { bpm: 108, scale: [0, 2, 4, 7, 9], lead: 'sawtooth', bass: 'square', ambience: 'traffic_hum' },
  },

  1985: {
    year: 1985,
    label: '1985 · Neon Boom',
    palette: {
      sky: '#2a1a4a',
      skyTop: '#0a0820',
      sun: '#ff5ab0',
      ground: '#2a2a3a',
      fog: '#3a2a5a',
    },
    buildings: {
      residential: { wall: '#3a3a5a', roof: '#1a1a2a', window: '#ff40a0', trim: '#5a2a6a', facade: 'concrete', heightRange: [12, 22] },
      commercial: { wall: '#2a2a4a', roof: '#1a0a2a', window: '#40d0ff', trim: '#6a2a8a', facade: 'concrete', heightRange: [10, 18] },
      office: { wall: '#1a1a3a', roof: '#0a0a1a', window: '#ff8030', trim: '#4a2a6a', facade: 'glass', heightRange: [24, 44] },
    },
    vehicles: [
      { body: '#8a8a8a', trim: '#2a2a2a', roof: '#5a5a5a', shape: 'boxy' },
      { body: '#c0202a', trim: '#1a1a1a', roof: '#3a1014', shape: 'boxy' },
      { body: '#2a4a8a', trim: '#1a2a3a', roof: '#10203a', shape: 'boxy' },
      { body: '#e0e0e0', trim: '#2a2a2a', roof: '#a0a0a0', shape: 'boxy' },
    ],
    outfits: [
      { torso: '#ff2a8a', legs: '#2a2a2a', hair: '#ff5ab0', skin: '#e0b080' },
      { torso: '#2a8aff', legs: '#1a1a2a', hair: '#4a3a2a', skin: '#d8a878' },
      { torso: '#2a2a3a', legs: '#3a2a5a', hair: '#d0a040', skin: '#f0c898' },
    ],
    storefronts: [
      { sign: 'ARCADE', bg: '#0a0a1a', fg: '#40d0ff', glow: '#40d0ff' },
      { sign: 'VIDEO', bg: '#1a0a2a', fg: '#ff40a0', glow: '#ff40a0' },
      { sign: 'RECORDS', bg: '#0a1a0a', fg: '#40ff80', glow: '#40ff80' },
    ],
    props: [
      { kind: 'neon_sign', color: '#ff40a0' },
      { kind: 'neon_sign', color: '#40d0ff' },
      { kind: 'lamp_steel', color: '#2a2a3a' },
    ],
    audio: { bpm: 124, scale: [0, 3, 5, 7, 10, 12], lead: 'square', bass: 'sawtooth', ambience: 'arcade_blips' },
  },

  2005: {
    year: 2005,
    label: '2005 · Glass Era',
    palette: {
      sky: '#8ab0d0',
      skyTop: '#5a8ab0',
      sun: '#fff8e8',
      ground: '#3a3a3e',
      fog: '#a8c0d8',
    },
    buildings: {
      residential: { wall: '#9aa0a8', roof: '#4a5058', window: '#a0d0f0', trim: '#6a7078', facade: 'glass', heightRange: [16, 30] },
      commercial: { wall: '#8a9098', roof: '#3a4048', window: '#b0e0ff', trim: '#5a6068', facade: 'glass', heightRange: [12, 22] },
      office: { wall: '#7aa0c0', roof: '#3a5060', window: '#c0e8ff', trim: '#4a6a8a', facade: 'glass', heightRange: [30, 60] },
    },
    vehicles: [
      { body: '#c0c0c4', trim: '#4a4a4a', roof: '#8a8a8e', shape: 'hatchback' },
      { body: '#2a3a4a', trim: '#2a2a2a', roof: '#1a2a3a', shape: 'hatchback' },
      { body: '#8a3030', trim: '#3a3a3a', roof: '#5a2020', shape: 'hatchback' },
      { body: '#d0d0d0', trim: '#5a5a5a', roof: '#a0a0a0', shape: 'hatchback' },
    ],
    outfits: [
      { torso: '#4a6a8a', legs: '#3a3a3a', hair: '#3a2a18', skin: '#e0b080' },
      { torso: '#d0d0d0', legs: '#2a3a4a', hair: '#1a1a1a', skin: '#c89868' },
      { torso: '#6a8a6a', legs: '#2a2a2a', hair: '#4a3a2a', skin: '#f0c898' },
    ],
    storefronts: [
      { sign: 'COFFEE', bg: '#3a4a3a', fg: '#e8e0c0', glow: null },
      { sign: 'PHONES', bg: '#2a3a4a', fg: '#a0d0f0', glow: '#a0d0f0' },
      { sign: 'BANK', bg: '#3a3a3a', fg: '#d0d0d0', glow: null },
    ],
    props: [
      { kind: 'phone_kiosk', color: '#5a6a7a' },
      { kind: 'lamp_steel', color: '#4a4a4a' },
      { kind: 'planter', color: '#3a5a3a' },
    ],
    audio: { bpm: 100, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle', bass: 'sine', ambience: 'soft_city' },
  },

  2025: {
    year: 2025,
    label: '2025 · Future',
    palette: {
      sky: '#2a3a5a',
      skyTop: '#0a1a2a',
      sun: '#80f0e0',
      ground: '#2a2a2e',
      fog: '#3a4a6a',
    },
    buildings: {
      residential: { wall: '#3a4a5a', roof: '#1a2a3a', window: '#80f0e0', trim: '#4a6a8a', facade: 'parametric', heightRange: [24, 44] },
      commercial: { wall: '#2a3a4a', roof: '#1a2a30', window: '#a0ffe0', trim: '#3a5a7a', facade: 'parametric', heightRange: [18, 36] },
      office: { wall: '#1a2a3a', roof: '#0a1a28', window: '#c0fff0', trim: '#2a4a6a', facade: 'parametric', heightRange: [40, 90] },
    },
    vehicles: [
      { body: '#e0e0e0', trim: '#80f0e0', roof: '#a0a0a0', shape: 'ev' },
      { body: '#2a2a2e', trim: '#40c0a0', roof: '#1a1a1e', shape: 'ev' },
      { body: '#6a6a7a', trim: '#80d0ff', roof: '#4a4a5a', shape: 'ev' },
      { body: '#f0f0f0', trim: '#80a0ff', roof: '#c0c0c0', shape: 'ev' },
    ],
    outfits: [
      { torso: '#2a2a3a', legs: '#1a1a2a', hair: '#2a2a2a', skin: '#d8a878' },
      { torso: '#5a4a8a', legs: '#2a2a3a', hair: '#4a3a2a', skin: '#e0b080' },
      { torso: '#40a09a', legs: '#2a3a3a', hair: '#1a1a1a', skin: '#c89868' },
    ],
    storefronts: [
      { sign: 'NEURAL', bg: '#0a1a2a', fg: '#80f0e0', glow: '#80f0e0' },
      { sign: 'DRONE DEPOT', bg: '#1a2a3a', fg: '#a0ffe0', glow: '#a0ffe0' },
      { sign: 'QUANTUM', bg: '#0a0a1a', fg: '#80a0ff', glow: '#80a0ff' },
    ],
    props: [
      { kind: 'hologram', color: '#80f0e0' },
      { kind: 'hologram', color: '#ff80c0' },
      { kind: 'planter', color: '#2a5a4a' },
    ],
    audio: { bpm: 88, scale: [0, 2, 5, 7, 10], lead: 'sine', bass: 'sine', ambience: 'quiet_future' },
  },
};

export function getEra(year: PeriodYear): EraDefinition {
  return ERA_DATA[year];
}

export const ERAS: EraDefinition[] = YEARS.map((y) => ERA_DATA[y]);

// Re-export for convenience and to keep the discovered API stable.
export type { EraVehicleStyle, EraStorefront, EraProp } from './types';
