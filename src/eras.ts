/**
 * Era types and registry for the City Time Period Timelapse
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

export interface SfxEraData {
  ambientTones: number[];
  trafficProfile: 'horse' | 'light' | 'moderate' | 'heavy' | 'dense';
  eventTypes: string[];
  musicStyle: string;
}

export const ERA_REGISTRY: EraSpec[] = [
  { id: '1945', year: 1945, label: '1945', description: 'Post-war era with horse-drawn carriages and early automobiles' },
  { id: '1965', year: 1965, label: '1965', description: 'Mid-century with classic cars and early urban development' },
  { id: '1985', year: 1985, label: '1985', description: 'Modern era with glass buildings and increased traffic' },
  { id: '2005', year: 2005, label: '2005', description: 'Digital age with smartphones and modern architecture' },
  { id: '2025', year: 2025, label: '2025', description: 'Future with electric vehicles and smart city features' }
];

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map(e => e.id);

export function getEraSpec(id: EraId): EraSpec | undefined {
  return ERA_REGISTRY.find(e => e.id === id);
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTones: [110, 220, 330],
    trafficProfile: 'horse',
    eventTypes: ['horse-hooves', 'tram-bell', 'typewriter'],
    musicStyle: 'big-band'
  },
  '1965': {
    ambientTones: [220, 330, 440],
    trafficProfile: 'light',
    eventTypes: ['car-horn', 'radio-music', 'footsteps'],
    musicStyle: 'rock-roll'
  },
  '1985': {
    ambientTones: [165, 330, 660],
    trafficProfile: 'moderate',
    eventTypes: ['synth-music', 'cassette-tape', 'traffic'],
    musicStyle: 'synth-pop'
  },
  '2005': {
    ambientTones: [220, 440, 880],
    trafficProfile: 'heavy',
    eventTypes: ['cellphone', 'car-alarm', 'construction'],
    musicStyle: 'hip-hop'
  },
  '2025': {
    ambientTones: [330, 660, 1320],
    trafficProfile: 'dense',
    eventTypes: ['electric-whir', 'notification', 'drone'],
    musicStyle: 'electronic'
  }
};