// Era types and registry
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

export interface SfxEraData {
  ambientTone: number; // frequency in Hz
  trafficProfile: 'light' | 'moderate' | 'heavy' | 'dense';
  eventTypes: ('horn' | 'siren' | 'bell' | 'whistle' | 'chime')[];
  musicStyle: 'swing' | 'rock' | 'pop' | 'electronic' | 'ambient';
}

// Era registry
export const ERA_REGISTRY: EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war era with classic automobiles and early jet aircraft.'
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Space race era with muscle cars and cultural revolution.'
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'MTV era with synthesizers, arcade games, and rising environmental awareness.'
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Digital age with smartphones, hybrid vehicles, and social media emergence.'
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'Near future with electric vehicles, renewable energy, and augmented reality.'
  }
];

// Ordered list of era IDs
export const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

// Helper to get era spec by ID
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find(era => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era ID: ${id}`);
  }
  return spec;
}

// SFX data for each era
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTone: 220, // A3
    trafficProfile: 'light',
    eventTypes: ['horn', 'bell'],
    musicStyle: 'swing'
  },
  '1965': {
    ambientTone: 330, // E4
    trafficProfile: 'moderate',
    eventTypes: ['horn', 'siren', 'bell'],
    musicStyle: 'rock'
  },
  '1985': {
    ambientTone: 440, // A4
    trafficProfile: 'heavy',
    eventTypes: ['horn', 'siren', 'whistle'],
    musicStyle: 'electronic'
  },
  '2005': {
    ambientTone: 523, // C5
    trafficProfile: 'dense',
    eventTypes: ['horn', 'siren', 'chime'],
    musicStyle: 'pop'
  },
  '2025': {
    ambientTone: 659, // E5
    trafficProfile: 'moderate', // Electric vehicles are quieter
    eventTypes: ['chime', 'whistle'],
    musicStyle: 'ambient'
  }
};