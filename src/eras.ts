/**
 * Shared era types and registry for the city timelapse.
 * Six eras: 1945, 1965, 1985, 2005, 2025, 2055.
 */

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
