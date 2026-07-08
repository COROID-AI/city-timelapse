/**
 * Era Types and Registry for City Time Period Timelapse
 * Defines 6 distinct time periods: 1945, 1965, 1985, 2005, 2025, 2055
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

export interface SfxEraData {
  // Ambient sound parameters
  ambientTones: {
    baseFreq: number;
    noiseLevel: number;
    resonance: number;
  };
  // Traffic sound profile
  trafficProfile: {
    carTypes: string[];
    speedRange: [number, number];
    honkProbability: number;
  };
  // Event one-shot sounds
  eventTypes: string[];
  // Music style
  musicStyle: string;
}

/**
 * Ordered registry of all eras
 */
export const ERA_REGISTRY: EraSpec[] = [
  { id: '1945', year: 1945, label: 'Post-War Era', description: 'Art Deco revival, classic architecture' },
  { id: '1965', year: 1965, label: 'Modernist', description: 'Concrete towers, space-age optimism' },
  { id: '1985', year: 1985, label: 'Postmodern', description: 'Glass facades, neon-soaked nights' },
  { id: '2005', year: 2005, label: 'Contemporary', description: 'Steel and glass, early digital' },
  { id: '2025', year: 2025, label: 'Smart City', description: 'Green architecture, autonomous vehicles' },
  { id: '2055', year: 2055, label: 'Future', description: 'Holographic displays, flying vehicles' }
];

/**
 * Readonly list of all era IDs for type safety
 */
export const ERA_IDS: Readonly<EraId[]> = ERA_REGISTRY.map(e => e.id) as Readonly<EraId[]>;

/**
 * Lookup helper for era specification
 */
export function getEraSpec(id: EraId): EraSpec {
  const era = ERA_REGISTRY.find(e => e.id === id);
  if (!era) {
    throw new Error(`Invalid era ID: ${id}`);
  }
  return era;
}

/**
 * Sound effect data for each era
 */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTones: { baseFreq: 110, noiseLevel: 0.3, resonance: 0.7 },
    trafficProfile: { carTypes: ['streetcar', 'truck'], speedRange: [0, 30], honkProbability: 0.2 },
    eventTypes: ['streetcar_bell', 'door_slam', 'crowd_murmur'],
    musicStyle: 'big_band'
  },
  '1965': {
    ambientTones: { baseFreq: 220, noiseLevel: 0.4, resonance: 0.5 },
    trafficProfile: { carTypes: ['sedan', 'van'], speedRange: [15, 45], honkProbability: 0.3 },
    eventTypes: ['car_horn', 'factory_hum', 'office_chatter'],
    musicStyle: 'jazz_fusion'
  },
  '1985': {
    ambientTones: { baseFreq: 330, noiseLevel: 0.6, resonance: 0.3 },
    trafficProfile: { carTypes: ['sedan', 'suv'], speedRange: [25, 55], honkProbability: 0.5 },
    eventTypes: ['neon_hum', 'siren', 'street_crowd'],
    musicStyle: 'synthwave'
  },
  '2005': {
    ambientTones: { baseFreq: 440, noiseLevel: 0.5, resonance: 0.2 },
    trafficProfile: { carTypes: ['compact', 'hybrid'], speedRange: [30, 65], honkProbability: 0.4 },
    eventTypes: ['car_passing', 'digital_beep', 'phone_ring'],
    musicStyle: 'electronic'
  },
  '2025': {
    ambientTones: { baseFreq: 550, noiseLevel: 0.4, resonance: 0.1 },
    trafficProfile: { carTypes: ['electric', 'autonomous'], speedRange: [20, 50], honkProbability: 0.1 },
    eventTypes: ['electric_whirr', 'notification', 'drone_buzz'],
    musicStyle: 'ambient_tech'
  },
  '2055': {
    ambientTones: { baseFreq: 880, noiseLevel: 0.2, resonance: 0.05 },
    trafficProfile: { carTypes: ['flying', 'drone'], speedRange: [50, 100], honkProbability: 0.05 },
    eventTypes: ['antigrav_hum', 'hologram_chime', 'ai_voice'],
    musicStyle: 'spatial_ambient'
  }
};