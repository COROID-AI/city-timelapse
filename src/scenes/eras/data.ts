import {
  Advertisements,
  Architecture,
  Atmosphere,
  EraData,
  PedestrianOutfit,
  SfxProfile,
  Storefronts,
  Vehicles,
} from './types';

/**
 * Single canonical restructured era dataset for the City Time Period Timelapse.
 *
 * `ERA_YEARS` is the ONLY era-year list: it is exported here and consumed via
 * `getEra()`/`getEraYears()`. No other source file should hard-code a parallel
 * array of years. All five eras carry distinct, era-authentic (non-placeholder)
 * values for every aspect.
 */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

export type EraYear = (typeof ERA_YEARS)[number];

const architecture1945: Architecture = {
  styleId: 'art-deco',
  facadePalette: ['#7a6a5b', '#6e6258', '#8b7d6c', '#5f544a'],
  roofStyle: 'parapet',
  minHeightM: 6,
  maxHeightM: 45,
  blockDensity: 0.95,
  windowChance: 0.6,
  glassRatio: 0.12,
  roofLighting: 0.4,
  masonry: 0.92,
  setbackStyle: 'wedding-cake',
};

const architecture1965: Architecture = {
  styleId: 'mid-century',
  facadePalette: ['#b6a887', '#c4b391', '#a0906f', '#d0c4a6'],
  roofStyle: 'flat',
  minHeightM: 8,
  maxHeightM: 70,
  blockDensity: 0.88,
  windowChance: 0.55,
  glassRatio: 0.2,
  roofLighting: 0.5,
  masonry: 0.7,
  setbackStyle: 'slab-utopian',
};

const architecture1985: Architecture = {
  styleId: 'postmodern',
  facadePalette: ['#c9c3b8', '#8f8a82', '#ab9e8e', '#dcd5c8'],
  roofStyle: 'parapet',
  minHeightM: 10,
  maxHeightM: 120,
  blockDensity: 0.82,
  windowChance: 0.5,
  glassRatio: 0.35,
  roofLighting: 0.62,
  masonry: 0.45,
  setbackStyle: 'step-terraced',
};

const architecture2005: Architecture = {
  styleId: 'glass-tower',
  facadePalette: ['#b7d0e0', '#a6bdd0', '#cfe0e8', '#8fa9bd'],
  roofStyle: 'equipment-screen',
  minHeightM: 12,
  maxHeightM: 210,
  blockDensity: 0.82,
  windowChance: 0.45,
  glassRatio: 0.7,
  roofLighting: 0.8,
  masonry: 0.18,
  setbackStyle: 'plateau-stack',
};

const architecture2025: Architecture = {
  styleId: 'bioclimatic',
  facadePalette: ['#b9d6b2', '#9cc0a8', '#d0e2c4', '#7fa98a'],
  roofStyle: 'green-roof',
  minHeightM: 14,
  maxHeightM: 300,
  blockDensity: 0.78,
  windowChance: 0.4,
  glassRatio: 0.8,
  roofLighting: 0.95,
  masonry: 0.08,
  setbackStyle: 'terraced-active',
};

const vehicles1945: Vehicles = {
  fleet: [
    { id: 'wartime-sedan', label: '1945 Packard Sedan' },
    { id: 'flatbed-truck', label: 'Flatbed Truck' },
    { id: 'trolley-bus', label: 'Trolley Bus' },
  ],
  trafficDensity: 0.2,
  electricRatio: 0.0,
  bodyGloss: 0.35,
  chrome: 0.7,
  headlightCool: 0.1,
  engineNoise: 0.95,
  hornLevel: 0.7,
};

const vehicles1965: Vehicles = {
  fleet: [
    { id: 'tailfin-cruiser', label: 'Tailfin Cruiser' },
    { id: 'woodie-wagon', label: 'Woodie Wagon' },
    { id: 'scooter', label: 'Vespa Scooter' },
    { id: 'cable-bus', label: 'Cable Bus' },
  ],
  trafficDensity: 0.45,
  electricRatio: 0.0,
  bodyGloss: 0.6,
  chrome: 0.85,
  headlightCool: 0.15,
  engineNoise: 0.72,
  hornLevel: 0.5,
};

const vehicles1985: Vehicles = {
  fleet: [
    { id: 'sedan-1985', label: '1985 Sedan' },
    { id: 'city-car', label: 'Boxy City Car' },
    { id: 'delivery-van', label: 'Delivery Van' },
    { id: 'taxi', label: 'Taxi' },
  ],
  trafficDensity: 0.6,
  electricRatio: 0.0,
  bodyGloss: 0.75,
  chrome: 0.55,
  headlightCool: 0.5,
  engineNoise: 0.65,
  hornLevel: 0.45,
};

const vehicles2005: Vehicles = {
  fleet: [
    { id: 'suv', label: 'Compact SUV' },
    { id: 'hybrid', label: 'Hybrid Hatchback' },
    { id: 'sedan-2005', label: '2005 Sedan' },
    { id: 'bus', label: 'City Bus' },
    { id: 'courier-truck', label: 'Courier Truck' },
  ],
  trafficDensity: 0.7,
  electricRatio: 0.12,
  bodyGloss: 0.85,
  chrome: 0.25,
  headlightCool: 0.75,
  engineNoise: 0.55,
  hornLevel: 0.35,
};

const vehicles2025: Vehicles = {
  fleet: [
    { id: 'ev-sedan', label: 'Electric Sedan' },
    { id: 'ev-suv', label: 'Electric SUV' },
    { id: 'e-bike', label: 'Cargo E-Bike' },
    { id: 'autonomous-shuttle', label: 'Autonomous Shuttle' },
  ],
  trafficDensity: 0.62,
  electricRatio: 0.72,
  bodyGloss: 0.9,
  chrome: 0.12,
  headlightCool: 0.92,
  engineNoise: 0.2,
  hornLevel: 0.12,
};

const storefronts1945: Storefronts = {
  styleId: 'awning-facade',
  awning: 'canvas-stripe',
  signageLighting: 0.3,
  glassFront: 0.4,
  doorClosure: 'panel-wood',
  neonLevel: 0.35,
  windowDressing: 0.7,
};

const storefronts1965: Storefronts = {
  styleId: 'plate-glass',
  awning: 'vintage-butter',
  signageLighting: 0.5,
  glassFront: 0.65,
  doorClosure: 'aluminum',
  neonLevel: 0.6,
  windowDressing: 0.6,
};

const storefronts1985: Storefronts = {
  styleId: 'neon-store',
  awning: 'none',
  signageLighting: 0.8,
  glassFront: 0.7,
  doorClosure: 'sliding-glass',
  neonLevel: 0.9,
  windowDressing: 0.5,
};

const storefronts2005: Storefronts = {
  styleId: 'minimal-glass',
  awning: 'none',
  signageLighting: 0.95,
  glassFront: 0.85,
  doorClosure: 'automatic-slide',
  neonLevel: 0.45,
  windowDressing: 0.4,
};

const storefronts2025: Storefronts = {
  styleId: 'green-glass',
  awning: 'solar-canopy',
  signageLighting: 0.9,
  glassFront: 0.88,
  doorClosure: 'sensor-slide',
  neonLevel: 0.2,
  windowDressing: 0.6,
};

const advertisements1945: Advertisements = {
  medium: 'hand-painted-sign',
  count: 4,
  intensity: 0.2,
  neonToLed: 0.2,
  posterSaturation: 0.5,
  animatedRatio: 0.0,
  panelPalette: ['#e8d9b0', '#c0392b', '#1f2a3a'],
};

const advertisements1965: Advertisements = {
  medium: 'neon-sign',
  count: 6,
  intensity: 0.55,
  neonToLed: 0.35,
  posterSaturation: 0.7,
  animatedRatio: 0.02,
  panelPalette: ['#f2d24a', '#ff5e7a', '#4ac4ff', '#2e4a62'],
};

const advertisements1985: Advertisements = {
  medium: 'fluorescent-printed',
  count: 9,
  intensity: 0.85,
  neonToLed: 0.55,
  posterSaturation: 0.85,
  animatedRatio: 0.08,
  panelPalette: ['#ff4fa0', '#7f3ff2', '#1ad1ff', '#f7df1e'],
};

const advertisements2005: Advertisements = {
  medium: 'led-screen',
  count: 12,
  intensity: 0.95,
  neonToLed: 0.85,
  posterSaturation: 0.92,
  animatedRatio: 0.4,
  panelPalette: ['#18f0ff', '#9b59b6', '#f0f0f0', '#2ecc71'],
};

const advertisements2025: Advertisements = {
  medium: 'digital-kinetic',
  count: 14,
  intensity: 0.98,
  neonToLed: 0.95,
  posterSaturation: 0.9,
  animatedRatio: 0.75,
  panelPalette: ['#00ffad', '#ff2d78', '#0b0b1f', '#3aa0ff'],
};

const pedestrians1945: PedestrianOutfit = {
  styleId: 'post-war-classic',
  variety: 0.4,
  colorfulness: 0.35,
  hatLevel: 0.85,
  formality: 0.9,
  materialShine: 0.15,
  palette: ['#3b2f2b', '#7c5f3a', '#d8d2c4', '#4a3b34'],
};

const pedestrians1965: PedestrianOutfit = {
  styleId: 'mid-century-mod',
  variety: 0.55,
  colorfulness: 0.6,
  hatLevel: 0.4,
  formality: 0.7,
  materialShine: 0.25,
  palette: ['#b6d7a8', '#e6b7c8', '#5b6c5e', '#ede7d4'],
};

const pedestrians1985: PedestrianOutfit = {
  styleId: 'neon-fitness',
  variety: 0.7,
  colorfulness: 0.8,
  hatLevel: 0.25,
  formality: 0.4,
  materialShine: 0.55,
  palette: ['#ff4fb0', '#00b3e3', '#ffe94a', '#2a2a2a'],
};

const pedestrians2005: PedestrianOutfit = {
  styleId: 'street-casual-tech',
  variety: 0.8,
  colorfulness: 0.6,
  hatLevel: 0.2,
  formality: 0.3,
  materialShine: 0.4,
  palette: ['#6b6b6b', '#1e3942', '#dddddd', '#b07b40'],
};

const pedestrians2025: PedestrianOutfit = {
  styleId: 'athleisure-synthetic',
  variety: 0.9,
  colorfulness: 0.7,
  hatLevel: 0.15,
  formality: 0.15,
  materialShine: 0.85,
  palette: ['#4ce0b3', '#7a5cff', '#0f2126', '#ffb6e0'],
};

const atmosphere1945: Atmosphere = {
  profileId: 'golden-age-haze',
  skyTint: { r: 214, g: 196, b: 160 },
  sunGlow: 0.6,
  lightWarmth: 0.55,
  skyExposure: 0.7,
  haze: 0.6,
  dust: 0.5,
  contrast: 0.55,
  saturation: 0.6,
  shadowSoftness: 0.5,
};

const atmosphere1965: Atmosphere = {
  profileId: 'mid-century-pastel',
  skyTint: { r: 190, g: 220, b: 214 },
  sunGlow: 0.72,
  lightWarmth: 0.45,
  skyExposure: 0.82,
  haze: 0.35,
  dust: 0.4,
  contrast: 0.6,
  saturation: 0.75,
  shadowSoftness: 0.4,
};

const atmosphere1985: Atmosphere = {
  profileId: 'electric-dusk',
  skyTint: { r: 140, g: 100, b: 190 },
  sunGlow: 0.5,
  lightWarmth: 0.3,
  skyExposure: 0.6,
  haze: 0.25,
  dust: 0.3,
  contrast: 0.85,
  saturation: 0.9,
  shadowSoftness: 0.25,
};

const atmosphere2005: Atmosphere = {
  profileId: 'crisp-clean',
  skyTint: { r: 118, g: 190, b: 222 },
  sunGlow: 0.85,
  lightWarmth: 0.25,
  skyExposure: 0.9,
  haze: 0.2,
  dust: 0.25,
  contrast: 0.72,
  saturation: 0.8,
  shadowSoftness: 0.32,
};

const atmosphere2025: Atmosphere = {
  profileId: 'led-clean-high',
  skyTint: { r: 120, g: 210, b: 255 },
  sunGlow: 0.95,
  lightWarmth: 0.2,
  skyExposure: 0.95,
  haze: 0.12,
  dust: 0.15,
  contrast: 0.78,
  saturation: 0.85,
  shadowSoftness: 0.4,
};

const sfx1945: SfxProfile = {
  id: 'sfx-1945',
  ambient: 'archive-street',
  ambienceLevel: 0.5,
  traffic: 0.2,
  engineNoise: 0.95,
  electricalHum: 0.12,
  wind: 0.45,
  birds: 0.5,
  dayChime: 0.3,
  glassHum: 0.1,
  digitalLevel: 0.05,
  reelTape: 0.0,
};

const sfx1965: SfxProfile = {
  id: 'sfx-1965',
  ambient: 'midcentury-boulevard',
  ambienceLevel: 0.6,
  traffic: 0.4,
  engineNoise: 0.85,
  electricalHum: 0.2,
  wind: 0.4,
  birds: 0.4,
  dayChime: 0.25,
  glassHum: 0.15,
  digitalLevel: 0.1,
  reelTape: 0.05,
};

const sfx1985: SfxProfile = {
  id: 'sfx-1985',
  ambient: 'synth-city',
  ambienceLevel: 0.72,
  traffic: 0.55,
  engineNoise: 0.7,
  electricalHum: 0.45,
  wind: 0.3,
  birds: 0.2,
  dayChime: 0.18,
  glassHum: 0.3,
  digitalLevel: 0.3,
  reelTape: 0.2,
};

const sfx2005: SfxProfile = {
  id: 'sfx-2005',
  ambient: 'digital-throughput',
  ambienceLevel: 0.8,
  traffic: 0.7,
  engineNoise: 0.5,
  electricalHum: 0.6,
  wind: 0.22,
  birds: 0.1,
  dayChime: 0.1,
  glassHum: 0.5,
  digitalLevel: 0.55,
  reelTape: 0.35,
};

const sfx2025: SfxProfile = {
  id: 'sfx-2025',
  ambient: 'quiet-electric',
  ambienceLevel: 0.75,
  traffic: 0.3,
  engineNoise: 0.15,
  electricalHum: 0.7,
  wind: 0.18,
  birds: 0.15,
  dayChime: 0.05,
  glassHum: 0.75,
  digitalLevel: 0.8,
  reelTape: 0.5,
};

/**
 * The single registry. Keys are the canonical years; values are immutable,
 * era-authentic data. Consumers read through `getEra()`.
 */
const ERA_REGISTRY: Readonly<Record<number, EraData>> = Object.freeze({
  1945: Object.freeze({
    year: 1945,
    architecture: architecture1945,
    vehicles: vehicles1945,
    storefronts: storefronts1945,
    advertisements: advertisements1945,
    pedestrians: pedestrians1945,
    atmosphere: atmosphere1945,
    sfx: sfx1945,
  }),
  1965: Object.freeze({
    year: 1965,
    architecture: architecture1965,
    vehicles: vehicles1965,
    storefronts: storefronts1965,
    advertisements: advertisements1965,
    pedestrians: pedestrians1965,
    atmosphere: atmosphere1965,
    sfx: sfx1965,
  }),
  1985: Object.freeze({
    year: 1985,
    architecture: architecture1985,
    vehicles: vehicles1985,
    storefronts: storefronts1985,
    advertisements: advertisements1985,
    pedestrians: pedestrians1985,
    atmosphere: atmosphere1985,
    sfx: sfx1985,
  }),
  2005: Object.freeze({
    year: 2005,
    architecture: architecture2005,
    vehicles: vehicles2005,
    storefronts: storefronts2005,
    advertisements: advertisements2005,
    pedestrians: pedestrians2005,
    atmosphere: atmosphere2005,
    sfx: sfx2005,
  }),
  2025: Object.freeze({
    year: 2025,
    architecture: architecture2025,
    vehicles: vehicles2025,
    storefronts: storefronts2025,
    advertisements: advertisements2025,
    pedestrians: pedestrians2025,
    atmosphere: atmosphere2025,
    sfx: sfx2025,
  }),
});

/** The canonical, ordered list of era years. */
export function getEraYears(): readonly number[] {
  return ERA_YEARS.slice();
}

/**
 * Return the compiled, typed era data for an exact supported year.
 * @throws if the year is not one of the five registered eras.
 */
export function getEra(year: number): EraData {
  const era = ERA_REGISTRY[year];
  if (era === undefined) {
    throw new Error(
      `Unknown era year ${year}; expected one of ${ERA_YEARS.join(', ')}`,
    );
  }
  return era;
}