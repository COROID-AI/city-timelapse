export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

interface SfxEraData {
  ambientTone: { frequency: number; volume: number };
  trafficProfile: { density: number; averageSpeed: number };
  eventTypes: string[];
  musicStyle: string;
}

export const ERA_REGISTRY: EraSpec[] = [
  { id: '1945', year: 1945, label: 'Post-War Era', description: 'Post-World War II era with rebuilding efforts, classic cars, and big band music.' },
  { id: '1965', year: 1965, label: 'Swinging Sixties', description: 'Era of cultural revolution, rock and roll, and distinctive fashion.' },
  { id: '1985', year: 1985, label: 'Neon Eighties', description: 'Era of neon lights, synth-pop, and early personal computing.' },
  { id: '2005', year: 2005, label: 'Digital Dawn', description: 'Early 2000s with rise of internet, mobile phones, and pop-punk.' },
  { id: '2025', year: 2025, label: 'Near Future', description: 'Near-future era with electric vehicles, renewable energy, and smart city initiatives.' }
];

export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find(era => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era ID: ${id}`);
  }
  return spec;
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTone: { frequency: 220, volume: 0.3 }, // A3
    trafficProfile: { density: 0.3, averageSpeed: 30 }, // sparse traffic, slower speeds
    eventTypes: ['car_horn', 'train_whistle', 'church_bell'],
    musicStyle: 'big_band'
  },
  '1965': {
    ambientTone: { frequency: 261.63, volume: 0.35 }, // C4
    trafficProfile: { density: 0.5, averageSpeed: 40 },
    eventTypes: ['car_horn', 'siren', 'bicycle_bell'],
    musicStyle: 'rock_roll'
  },
  '1985': {
    ambientTone: { frequency: 329.63, volume: 0.4 }, // E4
    trafficProfile: { density: 0.7, averageSpeed: 50 },
    eventTypes: ['car_horn', 'siren', 'arcade_beep'],
    musicStyle: 'synth_pop'
  },
  '2005': {
    ambientTone: { frequency: 392.00, volume: 0.4 }, // G4
    trafficProfile: { density: 0.8, averageSpeed: 45 },
    eventTypes: ['car_horn', 'siren', 'phone_ring'],
    musicStyle: 'pop_punk'
  },
  '2025': {
    ambientTone: { frequency: 440.00, volume: 0.35 }, // A4
    trafficProfile: { density: 0.6, averageSpeed: 35 }, // more electric vehicles, calmer traffic
    eventTypes: ['electric_car_hum', 'bike_bell', 'digital_chime'],
    musicStyle: 'ambient_electronic'
  }
}