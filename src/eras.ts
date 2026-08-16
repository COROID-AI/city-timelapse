// ─── Era Contract (audio-implementation-plan) ────────────────────────

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Specification for a single city era */
export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

/** Audio / SFX parameters tied to one era */
export interface SfxEraData {
  /** Filtered-noise bed frequency range (Hz) */
  ambientFreqRange: [number, number];
  /** Noise-bed volume 0→1 */
  ambientVolume: number;
  /** Traffic profile: density 0→1 */
  trafficDensity: number;
  /** One-shot event types unique to this era */
  events: string[];
  /** Music style tag */
  musicStyle: string;
}

// ── Registry data ────────────────────────────────────────────────────

export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'World War II Era',
    description: 'Blackout curtains, war-time rationing, and military vehicles dominate the streets.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century Modern',
    description: 'Post-war prosperity brings neon signs, classic cars, and suburban expansion.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon & New Wave',
    description: 'Arcade culture, boomboxes, and the dawn of digital technology reshape the skyline.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Y2K / Dot-com Bust',
    description: 'Cell phones, SUVs, and strip-mall development fill every corner.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Modern Smart City',
    description: 'EVs, glass towers, solar panels, and autonomous delivery bots define the urban landscape.',
  },
] as const;

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id);

/** Lookup helper — returns spec or undefined for unknown ids */
export function getEraSpec(id: EraId): EraSpec | undefined {
  return ERA_REGISTRY.find((e) => e.id === id);
}

// ── Per-era SFX data ─────────────────────────────────────────────────

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientFreqRange: [120, 350],
    ambientVolume: 0.3,
    trafficDensity: 0.25,
    events: ['airraid_siren', 'marching_boots', 'war_bonds_speaker'],
    musicStyle: 'big_band',
  },
  '1965': {
    ambientFreqRange: [200, 800],
    ambientVolume: 0.4,
    trafficDensity: 0.55,
    events: ['doo_wop_harmony', 'drive_in_jingle', 'rock_n_roll_riff'],
    musicStyle: 'surf_rock',
  },
  '1985': {
    ambientFreqRange: [400, 2000],
    ambientVolume: 0.5,
    trafficDensity: 0.7,
    events: ['arcade_coin_drop', 'cassette_eject', 'synth_stab'],
    musicStyle: 'synthwave',
  },
  '2005': {
    ambientFreqRange: [300, 1500],
    ambientVolume: 0.45,
    trafficDensity: 0.8,
    events: ['cell_phone_ring', 'gps_voice', 'flip_open_click'],
    musicStyle: 'pop_punk',
  },
  '2025': {
    ambientFreqRange: [100, 4000],
    ambientVolume: 0.35,
    trafficDensity: 0.65,
    events: ['autonomous_drone_beep', 'ev_chirp', 'smartwatch_haptic'],
    musicStyle: 'ambient_electronic',
  },
};
