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
  { id: '1945', year: 1945, label: 'Post-War Era', description: 'Post-World War II era with rebuilding efforts, classic cars, and big band music.' },
  { id: '1965', year: 1965, label: 'Swinging Sixties', description: 'Era of cultural revolution, rock and roll, and distinctive fashion.' },
  { id: '1985', year: 1985, label: 'Neon Eighties', description: 'Era of neon lights, synth-pop, and early personal computing.' },
  { id: '2005', year: 2005, label: 'Digital Dawn', description: 'Early 2000s with rise of internet, mobile phones, and pop-punk.' },
  { id: '2025', year: 2025, label: 'Near Future', description: 'Near-future era with electric vehicles, renewable energy, and smart city initiatives.' }
];

// Ordered list of era IDs
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

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