// ============================================================================
// ERAS — the single source of truth for the entire city scene.
// Every visual aspect of the city block is derived from this config.
// Six eras: 1945, 1965, 1985, 2005, 2025, 2055 — no more, no less.
// ============================================================================

export type RoofType = 'flat' | 'water' | 'pitched' | 'green' | 'solar' | 'dome';
export type WindowStyle = 'grid' | 'ribbon' | 'curtain' | 'panel' | 'holographic';
export type VehicleShape = 'vintage' | 'classic' | 'boxy' | 'modern' | 'electric' | 'hover';
export type BillboardStyle = 'painted' | 'printed' | 'neon' | 'digital' | 'mono' | 'holographic';

export interface EnvConfig {
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunAzimuth: number; // degrees, 0 = +Z, rotates clockwise
  sunElevation: number; // degrees above horizon
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
  sidewalkColor: string;
  roadColor: string;
  laneColor: string;
  laneGlow: number; // 0..1 emissive strength of lane markings
  exposure: number;
  starIntensity: number; // 0..1 night stars visibility (2055 twilight)
}

export interface BuildingStyle {
  baseColors: string[];
  trimColor: string;
  roofType: RoofType;
  minH: number;
  maxH: number;
  windowStyle: WindowStyle;
  windowColor: string;
  windowEmissive: string;
  windowEmissiveInt: number;
  accent: string;
  setBack: boolean; // stepped/tiered upper floors
  groundFloorColor: string;
}

export interface VehicleStyle {
  bodyColors: string[];
  shape: VehicleShape;
  emissive: string;
  emissiveInt: number;
  count: number;
  speed: number;
}

export interface PedStyle {
  shirtColors: string[];
  pantsColors: string[];
  skinColors: string[];
  coatColors: string[];
  count: number;
  hasHat: boolean;
  hatColor: string;
  hasCoat: boolean;
  accentColor: string; // umbrella / bag / scarf
}

export interface SignConfig {
  billboards: { text: string; sub: string; bg: string; fg: string; font: string }[];
  storefronts: { text: string; bg: string; fg: string; font: string }[];
  neonColor: string;
  neonInt: number;
  billboardStyle: BillboardStyle;
}

export interface EraConfig {
  year: number;
  label: string;
  tagline: string;
  env: EnvConfig;
  building: BuildingStyle;
  vehicle: VehicleStyle;
  pedestrian: PedStyle;
  signage: SignConfig;
}

export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const;
export const ERA_COUNT = ERA_YEARS.length;

export const ERAS: EraConfig[] = [
  // --------------------------------------------------------------------------
  // 1945 — Postwar recovery. Brick tenements, vintage autos, muted palette.
  // --------------------------------------------------------------------------
  {
    year: 1945,
    label: '1945',
    tagline: 'Postwar — brick & resolve',
    env: {
      skyTop: '#a97b5a',
      skyBottom: '#d8b48a',
      fogColor: '#cdb89a',
      fogNear: 45,
      fogFar: 130,
      sunAzimuth: 135,
      sunElevation: 34,
      sunColor: '#ffd9a0',
      sunIntensity: 1.25,
      ambientColor: '#b8a890',
      ambientIntensity: 0.55,
      hemiSky: '#c8a878',
      hemiGround: '#6a5840',
      hemiIntensity: 0.6,
      groundColor: '#7a6a52',
      sidewalkColor: '#9a8e78',
      roadColor: '#3c342a',
      laneColor: '#c8b890',
      laneGlow: 0,
      exposure: 1.05,
      starIntensity: 0,
    },
    building: {
      baseColors: ['#7a4a33', '#8a5a3a', '#6e4428', '#94603e', '#5e3c26'],
      trimColor: '#d8c8a8',
      roofType: 'water',
      minH: 7,
      maxH: 13,
      windowStyle: 'grid',
      windowColor: '#2a2218',
      windowEmissive: '#ffce8a',
      windowEmissiveInt: 0.12,
      accent: '#caa46e',
      setBack: false,
      groundFloorColor: '#4a3422',
    },
    vehicle: {
      bodyColors: ['#1f1a14', '#3a1e16', '#1c2618', '#4a3a2a', '#5a2218'],
      shape: 'vintage',
      emissive: '#ffce6a',
      emissiveInt: 0.4,
      count: 4,
      speed: 5,
    },
    pedestrian: {
      shirtColors: ['#8a7a5a', '#6e5a40', '#9a8868', '#5a4a38', '#7a6a4a'],
      pantsColors: ['#2e2820', '#3a3228', '#4a3e30'],
      skinColors: ['#d8a878', '#c89868', '#e0b890'],
      coatColors: ['#3a3328', '#4a4030'],
      count: 7,
      hasHat: true,
      hatColor: '#3a3328',
      hasCoat: true,
      accentColor: '#8a3a2a',
    },
    signage: {
      billboards: [
        { text: 'VICTORY', sub: 'Buy Bonds', bg: '#2a3a4a', fg: '#e8d8a0', font: 'Georgia' },
        { text: 'CAMEL', sub: 'Cigarettes', bg: '#7a3a1a', fg: '#f0e0b0', font: 'Georgia' },
        { text: 'Coca-Cola', sub: '5¢', bg: '#5a1410', fg: '#e8d8a0', font: 'Georgia' },
      ],
      storefronts: [
        { text: 'GROCERY', bg: '#4a3322', fg: '#d8c8a0', font: 'Georgia' },
        { text: 'BARBER', bg: '#2e3a44', fg: '#c8b890', font: 'Georgia' },
        { text: 'DINER', bg: '#5a1a14', fg: '#e8d0a0', font: 'Georgia' },
        { text: 'TAILOR', bg: '#3a2e22', fg: '#c8b890', font: 'Georgia' },
      ],
      neonColor: '#ff7a3a',
      neonInt: 0,
      billboardStyle: 'painted',
    },
  },

  // --------------------------------------------------------------------------
  // 1965 — Mid-century boom. Pastel modernism, chrome land yachts.
  // --------------------------------------------------------------------------
  {
    year: 1965,
    label: '1965',
    tagline: 'Mid-century — chrome & optimism',
    env: {
      skyTop: '#4a78b0',
      skyBottom: '#bcd8e8',
      fogColor: '#b8d0dc',
      fogNear: 60,
      fogFar: 170,
      sunAzimuth: 110,
      sunElevation: 52,
      sunColor: '#fff0d0',
      sunIntensity: 1.5,
      ambientColor: '#9ab0c4',
      ambientIntensity: 0.6,
      hemiSky: '#6a98c8',
      hemiGround: '#7a6a48',
      hemiIntensity: 0.7,
      groundColor: '#6a7a52',
      sidewalkColor: '#b0b4ac',
      roadColor: '#2e2e2e',
      laneColor: '#e8d890',
      laneGlow: 0,
      exposure: 1.0,
      starIntensity: 0,
    },
    building: {
      baseColors: ['#c8b89a', '#b0c0c8', '#d0a890', '#a8b8a0', '#c0a8b0'],
      trimColor: '#f0ece0',
      roofType: 'flat',
      minH: 9,
      maxH: 18,
      windowStyle: 'ribbon',
      windowColor: '#2a4050',
      windowEmissive: '#ffd07a',
      windowEmissiveInt: 0.18,
      accent: '#d09850',
      setBack: true,
      groundFloorColor: '#5a5a5a',
    },
    vehicle: {
      bodyColors: ['#d8d0c0', '#3a4a6a', '#8a1a1a', '#2a2a2a', '#c8a050', '#4a6a8a'],
      shape: 'classic',
      emissive: '#ffe080',
      emissiveInt: 0.5,
      count: 6,
      speed: 7,
    },
    pedestrian: {
      shirtColors: ['#d8503a', '#3a6ab0', '#e8c050', '#4a8a5a', '#c8a0d0', '#e0e0e0'],
      pantsColors: ['#2a2a3a', '#3a3a3a', '#5a4a3a'],
      skinColors: ['#d8a878', '#c89868', '#e0b890', '#a8784a'],
      coatColors: ['#6a5a4a', '#4a4a5a'],
      count: 9,
      hasHat: false,
      hatColor: '#3a3328',
      hasCoat: false,
      accentColor: '#e8c050',
    },
    signage: {
      billboards: [
        { text: 'MUSTANG', sub: '1965 ½', bg: '#1a1a1a', fg: '#e8403a', font: 'Arial Black' },
        { text: 'KODAK', sub: 'Moment', bg: '#d8a014', fg: '#1a1a1a', font: 'Arial Black' },
        { text: 'TWA', sub: 'Fly the World', bg: '#1a3a6a', fg: '#d8303a', font: 'Arial Black' },
      ],
      storefronts: [
        { text: 'CAFÉ', bg: '#3a4a5a', fg: '#e8d890', font: 'Arial Black' },
        { text: 'DRUGS', bg: '#2a6a3a', fg: '#f0f0e0', font: 'Arial Black' },
        { text: 'DINER', bg: '#c81a1a', fg: '#f0e0a0', font: 'Arial Black' },
        { text: 'SHOES', bg: '#4a3a5a', fg: '#e0d0e0', font: 'Arial Black' },
      ],
      neonColor: '#ff4a4a',
      neonInt: 0.1,
      billboardStyle: 'printed',
    },
  },

  // --------------------------------------------------------------------------
  // 1985 — Glass & excess. Mirrored towers, boxy sedans, neon.
  // --------------------------------------------------------------------------
  {
    year: 1985,
    label: '1985',
    tagline: 'The boom — glass, greed & neon',
    env: {
      skyTop: '#5a8aa8',
      skyBottom: '#d0c0a8',
      fogColor: '#c0b8a8',
      fogNear: 50,
      fogFar: 160,
      sunAzimuth: 80,
      sunElevation: 44,
      sunColor: '#ffe8c0',
      sunIntensity: 1.4,
      ambientColor: '#a8a098',
      ambientIntensity: 0.55,
      hemiSky: '#7090a8',
      hemiGround: '#6a5a4a',
      hemiIntensity: 0.65,
      groundColor: '#5a5a4a',
      sidewalkColor: '#9a9488',
      roadColor: '#262626',
      laneColor: '#e8d878',
      laneGlow: 0.05,
      exposure: 1.0,
      starIntensity: 0,
    },
    building: {
      baseColors: ['#4a7898', '#3a6888', '#5a88a8', '#3a5878', '#6080a0'],
      trimColor: '#2a3848',
      roofType: 'flat',
      minH: 14,
      maxH: 28,
      windowStyle: 'curtain',
      windowColor: '#1a2a3a',
      windowEmissive: '#ff9a3a',
      windowEmissiveInt: 0.35,
      accent: '#3a8a8a',
      setBack: true,
      groundFloorColor: '#3a3a3a',
    },
    vehicle: {
      bodyColors: ['#6a6a6a', '#8a8a8a', '#3a3a4a', '#7a3a3a', '#2a3a2a', '#b0b0a0'],
      shape: 'boxy',
      emissive: '#ffce5a',
      emissiveInt: 0.55,
      count: 7,
      speed: 9,
    },
    pedestrian: {
      shirtColors: ['#e83a6a', '#3aaab0', '#e8a030', '#6a4ab0', '#2a5a8a', '#d0d0d0', '#1a1a2a'],
      pantsColors: ['#2a2a2a', '#3a2a3a', '#4a3a2a', '#1a3a4a'],
      skinColors: ['#d8a878', '#c89868', '#e0b890', '#a8784a', '#8a5a3a'],
      coatColors: ['#2a2a3a', '#4a3a4a'],
      count: 11,
      hasHat: false,
      hatColor: '#2a2a2a',
      hasCoat: false,
      accentColor: '#e83a6a',
    },
    signage: {
      billboards: [
        { text: 'SONY', sub: 'Walkman', bg: '#0a0a0a', fg: '#e83a3a', font: 'Arial Black' },
        { text: 'MTV', sub: 'Music TV', bg: '#0a0a0a', fg: '#3ae8e8', font: 'Arial Black' },
        { text: 'MIAMI', sub: 'Vice', bg: '#3a0a4a', fg: '#ff3ae8', font: 'Arial Black' },
      ],
      storefronts: [
        { text: 'ARCADE', bg: '#0a0a2a', fg: '#3ae8e8', font: 'Courier New' },
        { text: 'VIDEO', bg: '#1a1a1a', fg: '#ff3a3a', font: 'Arial Black' },
        { text: 'PIZZA', bg: '#5a1a0a', fg: '#e8c030', font: 'Arial Black' },
        { text: 'BANK', bg: '#2a4a5a', fg: '#d0d0a0', font: 'Georgia' },
      ],
      neonColor: '#ff3ae8',
      neonInt: 0.7,
      billboardStyle: 'neon',
    },
  },

  // --------------------------------------------------------------------------
  // 2005 — New millenium. Beige glass, SUVs, early digital screens.
  // --------------------------------------------------------------------------
  {
    year: 2005,
    label: '2005',
    tagline: 'New century — beige & SUVs',
    env: {
      skyTop: '#5a90c0',
      skyBottom: '#c8d8e0',
      fogColor: '#c4d0d8',
      fogNear: 70,
      fogFar: 190,
      sunAzimuth: 95,
      sunElevation: 56,
      sunColor: '#fff4dc',
      sunIntensity: 1.55,
      ambientColor: '#9aa8b8',
      ambientIntensity: 0.6,
      hemiSky: '#6aa0c8',
      hemiGround: '#6a6a58',
      hemiIntensity: 0.75,
      groundColor: '#5a6a48',
      sidewalkColor: '#b0b2a8',
      roadColor: '#222222',
      laneColor: '#e8e0a0',
      laneGlow: 0.1,
      exposure: 1.0,
      starIntensity: 0,
    },
    building: {
      baseColors: ['#a8b0b8', '#b8a89a', '#9aa2aa', '#c0b8a8', '#909aa0'],
      trimColor: '#6a7078',
      roofType: 'flat',
      minH: 16,
      maxH: 34,
      windowStyle: 'panel',
      windowColor: '#2a3a44',
      windowEmissive: '#9acaff',
      windowEmissiveInt: 0.4,
      accent: '#5a8aaa',
      setBack: true,
      groundFloorColor: '#4a4a4a',
    },
    vehicle: {
      bodyColors: ['#c8c8c8', '#3a3a3a', '#8a8a8a', '#5a6a7a', '#3a4a5a', '#b0a08a', '#e0e0e0'],
      shape: 'modern',
      emissive: '#ffffff',
      emissiveInt: 0.6,
      count: 8,
      speed: 11,
    },
    pedestrian: {
      shirtColors: ['#3a6ab0', '#b04030', '#4a8a5a', '#d0d0d0', '#2a2a2a', '#a0703a', '#5a4ab0'],
      pantsColors: ['#2a2a3a', '#3a3a3a', '#1a3a2a', '#4a3a2a'],
      skinColors: ['#d8a878', '#c89868', '#e0b890', '#a8784a', '#8a5a3a', '#6a4828'],
      coatColors: ['#2a2a2a', '#3a3a4a'],
      count: 12,
      hasHat: false,
      hatColor: '#2a2a2a',
      hasCoat: false,
      accentColor: '#3a6ab0',
    },
    signage: {
      billboards: [
        { text: 'iPod', sub: 'nano', bg: '#f0f0f0', fg: '#1a1a1a', font: 'Arial' },
        { text: 'GOOGLE', sub: 'Search', bg: '#ffffff', fg: '#3a6ab0', font: 'Arial' },
        { text: 'NOKIA', sub: 'Connecting', bg: '#1a3a6a', fg: '#c0d0e8', font: 'Arial' },
      ],
      storefronts: [
        { text: 'COFFEE', bg: '#2a4a3a', fg: '#e8d8a0', font: 'Arial' },
        { text: 'WIRELESS', bg: '#1a3a5a', fg: '#a0d0e8', font: 'Arial' },
        { text: 'GYM', bg: '#3a3a3a', fg: '#e8e040', font: 'Arial Black' },
        { text: 'PHARMACY', bg: '#2a6a8a', fg: '#e0f0f0', font: 'Arial' },
      ],
      neonColor: '#3a9aff',
      neonInt: 0.35,
      billboardStyle: 'digital',
    },
  },

  // --------------------------------------------------------------------------
  // 2025 — Present. Sleek white towers, EVs, green roofs, clean sky.
  // --------------------------------------------------------------------------
  {
    year: 2025,
    label: '2025',
    tagline: 'Now — clean, green, electric',
    env: {
      skyTop: '#3a78b8',
      skyBottom: '#b8d4e4',
      fogColor: '#bcd0d8',
      fogNear: 80,
      fogFar: 220,
      sunAzimuth: 100,
      sunElevation: 60,
      sunColor: '#fffaf0',
      sunIntensity: 1.6,
      ambientColor: '#9ab4c8',
      ambientIntensity: 0.65,
      hemiSky: '#5aa0d0',
      hemiGround: '#5a6a4a',
      hemiIntensity: 0.85,
      groundColor: '#5a7a4a',
      sidewalkColor: '#c0c2b8',
      roadColor: '#1e1e1e',
      laneColor: '#a8e0ff',
      laneGlow: 0.4,
      exposure: 1.0,
      starIntensity: 0,
    },
    building: {
      baseColors: ['#e8e8e8', '#d8d8d8', '#f0f0f0', '#c8d0d4', '#dce4e8'],
      trimColor: '#9aa6b0',
      roofType: 'green',
      minH: 20,
      maxH: 40,
      windowStyle: 'curtain',
      windowColor: '#2a4a5a',
      windowEmissive: '#8acaff',
      windowEmissiveInt: 0.5,
      accent: '#3acaa0',
      setBack: true,
      groundFloorColor: '#3a3a3a',
    },
    vehicle: {
      bodyColors: ['#ffffff', '#e8e8e8', '#1a1a1a', '#c8c8c8', '#3a5a7a', '#d0d0d0'],
      shape: 'electric',
      emissive: '#8ad0ff',
      emissiveInt: 0.7,
      count: 9,
      speed: 13,
    },
    pedestrian: {
      shirtColors: ['#1a1a1a', '#e8e8e8', '#3a9a6a', '#5a7ab0', '#d05a3a', '#2a2a3a', '#9a8ab0'],
      pantsColors: ['#1a1a1a', '#2a2a3a', '#3a4a3a', '#4a4a4a'],
      skinColors: ['#d8a878', '#c89868', '#e0b890', '#a8784a', '#8a5a3a', '#6a4828', '#4a3018'],
      coatColors: ['#2a2a2a', '#3a4a5a'],
      count: 13,
      hasHat: false,
      hatColor: '#2a2a2a',
      hasCoat: true,
      accentColor: '#3a9a6a',
    },
    signage: {
      billboards: [
        { text: 'TESLA', sub: 'Model 3', bg: '#0a0a0a', fg: '#e8203a', font: 'Arial' },
        { text: 'Spotify', sub: 'Stream', bg: '#1a1a1a', fg: '#3ae85a', font: 'Arial' },
        { text: 'AIRBNB', sub: 'Stay', bg: '#ffffff', fg: '#ff5a8a', font: 'Arial' },
      ],
      storefronts: [
        { text: 'MATCHA', bg: '#3a6a4a', fg: '#e8f0d0', font: 'Arial' },
        { text: 'E-VOLT', bg: '#1a2a3a', fg: '#8ad0ff', font: 'Arial' },
        { text: 'YOGA', bg: '#9a6ab0', fg: '#f0e0f0', font: 'Arial' },
        { text: 'JUICE', bg: '#e8a030', fg: '#3a2a0a', font: 'Arial' },
      ],
      neonColor: '#3ae8a0',
      neonInt: 0.4,
      billboardStyle: 'digital',
    },
  },

  // --------------------------------------------------------------------------
  // 2055 — Future. Holographic towers, hover drones, twilight teal sky.
  // --------------------------------------------------------------------------
  {
    year: 2055,
    label: '2055',
    tagline: 'Tomorrow — holographic & airborne',
    env: {
      skyTop: '#1a2a4a',
      skyBottom: '#2a6a8a',
      fogColor: '#1a3048',
      fogNear: 60,
      fogFar: 200,
      sunAzimuth: 250,
      sunElevation: 18,
      sunColor: '#ff8a5a',
      sunIntensity: 1.1,
      ambientColor: '#3a5a7a',
      ambientIntensity: 0.7,
      hemiSky: '#2a5078',
      hemiGround: '#1a2a3a',
      hemiIntensity: 0.8,
      groundColor: '#2a3a44',
      sidewalkColor: '#4a5a64',
      roadColor: '#0e1218',
      laneColor: '#3affd0',
      laneGlow: 1.0,
      exposure: 1.1,
      starIntensity: 0.6,
    },
    building: {
      baseColors: ['#1a2a3a', '#223040', '#2a3848', '#1e2c3c', '#28384a'],
      roofType: 'dome',
      minH: 26,
      maxH: 52,
      windowStyle: 'holographic',
      windowColor: '#0a1a2a',
      windowEmissive: '#3affd0',
      windowEmissiveInt: 1.2,
      accent: '#3affd0',
      setBack: true,
     trimColor: '#3a5a6a',
      groundFloorColor: '#0a1218',
    },
    vehicle: {
      bodyColors: ['#2a3a4a', '#1a2a3a', '#3a4a5a', '#223040', '#2e3848'],
      shape: 'hover',
      emissive: '#3affd0',
      emissiveInt: 1.5,
      count: 8,
      speed: 15,
    },
    pedestrian: {
      shirtColors: ['#3affd0', '#ff3a8a', '#8a5aff', '#3a8aff', '#3a3a3a', '#e8e8e8', '#ff8a3a'],
      pantsColors: ['#1a1a2a', '#2a2a3a', '#0a0a1a', '#2a3a4a'],
      skinColors: ['#d8a878', '#c89868', '#e0b890', '#a8784a', '#8a5a3a'],
      coatColors: ['#1a2a3a', '#2a3a4a'],
      count: 9,
      hasHat: false,
      hatColor: '#1a2a2a',
      hasCoat: true,
      accentColor: '#3affd0',
    },
    signage: {
      billboards: [
        { text: 'ORBITAL', sub: 'Mars Express', bg: '#0a0a14', fg: '#3affd0', font: 'Courier New' },
        { text: 'GENOMIA', sub: 'Live Longer', bg: '#0a141a', fg: '#8a5aff', font: 'Courier New' },
        { text: 'AETHER', sub: 'Neural Link', bg: '#140a1a', fg: '#ff3a8a', font: 'Courier New' },
      ],
      storefronts: [
        { text: 'SYNTH', bg: '#0a1a1a', fg: '#3affd0', font: 'Courier New' },
        { text: 'DRONE', bg: '#0a1a2a', fg: '#3a8aff', font: 'Courier New' },
        { text: 'IMMORTAL', bg: '#1a0a1a', fg: '#ff3a8a', font: 'Courier New' },
        { text: 'QUANTUM', bg: '#0a0a1a', fg: '#8a5aff', font: 'Courier New' },
      ],
      neonColor: '#3affd0',
      neonInt: 1.0,
      billboardStyle: 'holographic',
    },
  },
];

export function getEra(index: number): EraConfig {
  return ERAS[Math.max(0, Math.min(ERA_COUNT - 1, index))];
}
