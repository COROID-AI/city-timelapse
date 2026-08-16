/**
 * Shared era types and registry for the city timelapse application.
 *
 * Every era-aware module imports from this file so that type contracts,
 * era ordering, and SFX parameters stay in sync across the codebase.
 */

// ─── EraId union ────────────────────────────────────────────────────────
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

// ─── EraSpec ────────────────────────────────────────────────────────────
export interface EraSpec {
  /** Stable identifier used throughout the app (stringified year). */
  id: EraId;
  /** Numeric year value. */
  year: number;
  /** Human-readable label shown in the timeline. */
  label: string;
  /** Longer description rendered in the info panel. */
  description: string;
}

// ─── SfxEraData ─────────────────────────────────────────────────────────
export interface SfxEraData {
  /** Ambient tone frequency in Hz (e.g. distant machinery hum). */
  ambientToneHz: number;
  /** Base traffic profile intensity: 0-1 scale. */
  trafficProfile: number;
  /** Array of distinct sound event types unique to this era. */
  eventTypes: string[];
  /** General music style descriptor (e.g. "swing", "synthwave"). */
  musicStyle: string;
}

// ─── ERA_REGISTRY — ordered array of EraSpec (oldest → newest) ─────────
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945 — Post-War Dawn',
    description:
      'A city emerging from wartime austerity. Modest buildings, pre-war storefronts, horse-drawn carts giving way to early automobiles.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965 — Suburban Boom',
    description:
      'Mid-century modernism on every corner. Neon signs, classic American sedans, and a thriving downtown retail scene.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985 — Graffiti & Neon',
    description:
      'The gritty urban renaissance. Brick facades, graffiti art, synth-pop energy, and the rise of electronic culture.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005 — Dot-Com Revival',
    description:
      'A revitalized downtown with glass towers, digital billboards, hybrid vehicles, and the dawn of smartphone culture.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025 — Smart City',
    description:
      'Sustainable architecture, autonomous shuttles, augmented reality signage, and a fully connected urban ecosystem.',
  },
] as const;

// ─── ERA_IDS — readonly list of all EraId values (ordered) ─────────────
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id);

// ─── getEraSpec(id) — lookup helper ─────────────────────────────────────
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`Unknown EraId: ${id}`);
  }
  return spec;
}

// ─── SFX_ERA_DATA — period-appropriate audio parameters ─────────────────
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientToneHz: 80,
    trafficProfile: 0.3,
    eventTypes: ['horse_clopping', 'train_whistle', 'streetcar_bell'],
    musicStyle: 'big_band',
  },
  '1965': {
    ambientToneHz: 120,
    trafficProfile: 0.6,
    eventTypes: ['car_horn', 'diner_jingle', 'rock_n_roll_guitar'],
    musicStyle: 'rock_n_roll',
  },
  '1985': {
    ambientToneHz: 200,
    trafficProfile: 0.7,
    eventTypes: ['siren', 'spray_can_rattle', 'synth_arpeggio'],
    musicStyle: 'synthpop',
  },
  '2005': {
    ambientToneHz: 160,
    trafficProfile: 0.8,
    eventTypes: ['cellular_ring', 'construction_drill', 'electronic_beat'],
    musicStyle: 'electronic',
  },
  '2025': {
    ambientToneHz: 100,
    trafficProfile: 0.5,
    eventTypes: ['autonomous_chime', 'drone_overhead', 'ambient_pad'],
    musicStyle: 'ambient_electronic',
  },
};
