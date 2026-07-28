/**
 * Shared era types and registry for the city timelapse.
 * Six eras: 1945, 1965, 1985, 2005, 2025, 2055.
 */
import * as THREE from 'three';

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
  /** Index in the ordered era array (0..5) */
  index: number;
}

export const ERA_REGISTRY: readonly EraSpec[] = [
  { id: '1945', year: 1945, label: '1945', description: 'Post-war brick, sepia, vintage cars, gas lamps', index: 0 },
  { id: '1965', year: 1965, label: '1965', description: 'Mid-century pastel, chrome cars, neon', index: 1 },
  { id: '1985', year: 1985, label: '1985', description: 'Concrete/glass, boxy cars, bright neon, sodium lamps', index: 2 },
  { id: '2005', year: 2005, label: '2005', description: 'Modern glass, SUVs, digital billboards, LED', index: 3 },
  { id: '2025', year: 2025, label: '2025', description: 'Contemporary, EVs/scooters, LED screens', index: 4 },
  { id: '2055', year: 2055, label: '2055', description: 'Futuristic, drones, holographic ads, glowing architecture', index: 5 },
] as const;

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map(e => e.id);

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find(e => e.id === id);
  if (!spec) throw new Error(`Unknown era: ${id}`);
  return spec;
}

export function getEraIndex(id: EraId): number {
  return getEraSpec(id).index;
}

/**
 * Era-specific SFX parameters for the procedural audio generator.
 * Each era has a distinct ambient tone, traffic profile, event types, and music style.
 */
export interface SfxEraData {
  /** Ambient drone frequency (Hz) */
  ambientFreq: number;
  /** Ambient detune spread (cents) */
  ambientDetune: number;
  /** Traffic engine fundamental frequency (Hz) */
  trafficFreq: number;
  /** Traffic rhythm (beats per second) */
  trafficRate: number;
  /** Event one-shot types for this era */
  events: readonly string[];
  /** Music chord root frequency (Hz) */
  musicFreq: number;
  /** Overall ambient volume (0..1) */
  ambientVolume: number;
  /** Overall traffic volume (0..1) */
  trafficVolume: number;
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientFreq: 110,
    ambientDetune: 5,
    trafficFreq: 98,
    trafficRate: 0.6,
    events: ['horn', 'church_bell', 'steam_whistle'],
    musicFreq: 220,
    ambientVolume: 0.35,
    trafficVolume: 0.3,
  },
  '1965': {
    ambientFreq: 220,
    ambientDetune: 3,
    trafficFreq: 110,
    trafficRate: 0.8,
    events: ['car_horn', 'jukebox', 'scooter'],
    musicFreq: 330,
    ambientVolume: 0.4,
    trafficVolume: 0.35,
  },
  '1985': {
    ambientFreq: 330,
    ambientDetune: 4,
    trafficFreq: 130,
    trafficRate: 1.0,
    events: ['car_horn', 'arcade_beep', 'siren'],
    musicFreq: 440,
    ambientVolume: 0.45,
    trafficVolume: 0.4,
  },
  '2005': {
    ambientFreq: 440,
    ambientDetune: 2,
    trafficFreq: 146,
    trafficRate: 1.2,
    events: ['car_horn', 'cell_ring', 'siren'],
    musicFreq: 523,
    ambientVolume: 0.4,
    trafficVolume: 0.35,
  },
  '2025': {
    ambientFreq: 523,
    ambientDetune: 3,
    trafficFreq: 165,
    trafficRate: 1.3,
    events: ['car_horn', 'scooter', 'siren'],
    musicFreq: 659,
    ambientVolume: 0.35,
    trafficVolume: 0.3,
  },
  '2055': {
    ambientFreq: 660,
    ambientDetune: 6,
    trafficFreq: 196,
    trafficRate: 1.5,
    events: ['ufo_landing', 'holo_beep', 'drone'],
    musicFreq: 784,
    ambientVolume: 0.5,
    trafficVolume: 0.4,
  },
};

/**
 * Era-specific sky and atmosphere configuration.
 * Centralized here so all scene modules import from a single source of truth.
 */
export interface SkySpec {
  /** Sky color at zenith */
  skyTop: THREE.Color;
  /** Sky color at horizon */
  skyBottom: THREE.Color;
  /** Sun color */
  sunColor: THREE.Color;
  /** Sun intensity */
  sunIntensity: number;
  /** Fog color */
  fogColor: THREE.Color;
  /** Fog density */
  fogDensity: number;
  /** Particle color */
  particleColor: THREE.Color;
  /** Particle density (0..1) */
  particleDensity: number;
  /** Particle size */
  particleSize: number;
}

export const SKY_SPECS: Record<EraId, SkySpec> = {
  '1945': {
    skyTop: new THREE.Color(0x87ceeb),
    skyBottom: new THREE.Color(0xf0e6d2),
    sunColor: new THREE.Color(0xffddaa),
    sunIntensity: 0.8,
    fogColor: new THREE.Color(0xd2b48c),
    fogDensity: 0.001,
    particleColor: new THREE.Color(0xc2b280),
    particleDensity: 0.3,
    particleSize: 0.5,
  },
  '1965': {
    skyTop: new THREE.Color(0x87ceeb),
    skyBottom: new THREE.Color(0xf0e6d2),
    sunColor: new THREE.Color(0xffeecc),
    sunIntensity: 0.9,
    fogColor: new THREE.Color(0xe0d0b0),
    fogDensity: 0.0008,
    particleColor: new THREE.Color(0xffd700),
    particleDensity: 0.2,
    particleSize: 0.4,
  },
  '1985': {
    skyTop: new THREE.Color(0x4a4a6a),
    skyBottom: new THREE.Color(0x8a6a4a),
    sunColor: new THREE.Color(0xffaa33),
    sunIntensity: 0.7,
    fogColor: new THREE.Color(0x5a4a3a),
    fogDensity: 0.002,
    particleColor: new THREE.Color(0xff0066),
    particleDensity: 0.4,
    particleSize: 0.3,
  },
  '2005': {
    skyTop: new THREE.Color(0x4a6a8a),
    skyBottom: new THREE.Color(0x8a8a6a),
    sunColor: new THREE.Color(0xffeeaa),
    sunIntensity: 0.9,
    fogColor: new THREE.Color(0x6a6a6a),
    fogDensity: 0.0015,
    particleColor: new THREE.Color(0x00aaff),
    particleDensity: 0.3,
    particleSize: 0.3,
  },
  '2025': {
    skyTop: new THREE.Color(0x3a5a7a),
    skyBottom: new THREE.Color(0x8a8a8a),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.0,
    fogColor: new THREE.Color(0x7a7a7a),
    fogDensity: 0.0012,
    particleColor: new THREE.Color(0x00ffaa),
    particleDensity: 0.2,
    particleSize: 0.25,
  },
  '2055': {
    skyTop: new THREE.Color(0x0a1a2a),
    skyBottom: new THREE.Color(0x1a2a4a),
    sunColor: new THREE.Color(0x00ffff),
    sunIntensity: 1.2,
    fogColor: new THREE.Color(0x001a33),
    fogDensity: 0.003,
    particleColor: new THREE.Color(0x00ffff),
    particleDensity: 0.6,
    particleSize: 0.4,
  },
};

/**
 * Era-specific building configuration.
 * Centralized here so all scene modules import from a single source of truth.
 */
export interface BuildingSpec {
  /** Facade color */
  color: THREE.Color;
  /** Window emissive color */
  windowEmissive: THREE.Color;
  /** Window emissive intensity */
  windowIntensity: number;
  /** Base building height */
  height: number;
  /** Height variation */
  heightVariation: number;
  /** Rooftop prop type */
  roofProp: 'water_tower' | 'ac_units' | 'antennas' | 'sat_dishes' | 'led_signs' | 'greenery' | 'solar';
  /** Material roughness */
  roughness: number;
  /** Material metalness */
  metalness: number;
}

export const BUILDING_SPECS: Record<EraId, BuildingSpec> = {
  '1945': {
    color: new THREE.Color(0x8b5a2b),
    windowEmissive: new THREE.Color(0xffdd88),
    windowIntensity: 0.3,
    height: 12,
    heightVariation: 4,
    roofProp: 'water_tower',
    roughness: 0.85,
    metalness: 0.1,
  },
  '1965': {
    color: new THREE.Color(0xd4a574),
    windowEmissive: new THREE.Color(0xffffaa),
    windowIntensity: 0.4,
    height: 16,
    heightVariation: 6,
    roofProp: 'ac_units',
    roughness: 0.75,
    metalness: 0.2,
  },
  '1985': {
    color: new THREE.Color(0x5a5a6a),
    windowEmissive: new THREE.Color(0xff0066),
    windowIntensity: 0.6,
    height: 20,
    heightVariation: 8,
    roofProp: 'antennas',
    roughness: 0.6,
    metalness: 0.4,
  },
  '2005': {
    color: new THREE.Color(0x3a5a7a),
    windowEmissive: new THREE.Color(0x00aaff),
    windowIntensity: 0.7,
    height: 24,
    heightVariation: 10,
    roofProp: 'sat_dishes',
    roughness: 0.3,
    metalness: 0.7,
  },
  '2025': {
    color: new THREE.Color(0x4a4a4a),
    windowEmissive: new THREE.Color(0x00ffaa),
    windowIntensity: 0.8,
    height: 26,
    heightVariation: 10,
    roofProp: 'led_signs',
    roughness: 0.2,
    metalness: 0.8,
  },
  '2055': {
    color: new THREE.Color(0x0a2a3a),
    windowEmissive: new THREE.Color(0x00ffff),
    windowIntensity: 1.0,
    height: 30,
    heightVariation: 12,
    roofProp: 'greenery',
    roughness: 0.1,
    metalness: 0.9,
  },
};
