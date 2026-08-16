// ── EraId ────────────────────────────────────────────────────────────
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

// ── EraSpec ──────────────────────────────────────────────────────────
export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

// ── SfxEraData ───────────────────────────────────────────────────────
export interface SfxEraData {
  /** Array of base frequencies (Hz) for ambient drone tones */
  ambientTones: number[];
  /** Traffic density profile: [idle, rush, night] as relative multipliers */
  trafficProfile: [number, number, number];
  /** Named event types that can fire in this era */
  eventTypes: string[];
  /** Parameters describing the music style for this era */
  musicStyleParams: Record<string, number>;
}

// ── ERA_REGISTRY (ordered array) ─────────────────────────────────────
export const ERA_REGISTRY: EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Dusk',
    description: 'A world emerging from global conflict—rationing, rebuilding, and cautious hope.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Swinging Sixties',
    description: 'Cultural revolution in full bloom: civil rights, space race optimism, and rock & roll.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Boom',
    description: 'The dawn of personal computing, synth-pop culture, and deregulated excess.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Broadband Era',
    description: 'Social networks rise, smartphones emerge, and the internet reshapes daily life.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Connected Horizon',
    description: 'AI-augmented cities, climate urgency, and hyper-connected communities define the present.',
  },
];

// ── ERA_IDS (readonly list) ──────────────────────────────────────────
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id);

// ── getEraSpec ───────────────────────────────────────────────────────
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${id}. Expected one of ${ERA_IDS.join(', ')}`);
  }
  return spec;
}

// ── SFX_ERA_DATA (distinct per era) ──────────────────────────────────
const AMBIENT_1945 = [55, 110]; // deep post-war hum
const AMBIENT_1965 = [73.4, 146.8, 220]; // warm mid-century resonance
const AMBIENT_1985 = [82.4, 164.8, 329.6, 659.3]; // neon-lit layered oscillation
const AMBIENT_2005 = [65.4, 130.8, 261.6]; // broadband digital pulse
const AMBIENT_2025 = [41.2, 82.4, 164.8, 329.6, 659.3]; // hyper-connected spectrum

const TRAFFIC_1945: [number, number, number] = [0.2, 0.8, 0.1];
const TRAFFIC_1965: [number, number, number] = [0.3, 1.2, 0.2];
const TRAFFIC_1985: [number, number, number] = [0.5, 1.8, 0.4];
const TRAFFIC_2005: [number, number, number] = [0.7, 2.2, 0.5];
const TRAFFIC_2025: [number, number, number] = [0.9, 2.5, 0.6];

const EVENTS_1945 = ['siren_distant', 'radio_static', 'train_whistle'];
const EVENTS_1965 = ['siren_close', 'crowd_cheer', 'rock_guitar_riff'];
const EVENTS_1985 = ['synth_arpeggio', 'cash_register', 'neon_flicker'];
const EVENTS_2005 = ['pager_vibrate', 'dial_modem', 'phone_ring'];
const EVENTS_2025 = ['notification_chime', 'drone_passby', 'ai_voice_prompt'];

const MUSIC_1945: Record<string, number> = { tempo: 72, mode: 0, vibrato: 0.3 };
const MUSIC_1965: Record<string, number> = { tempo: 120, mode: 1, vibrato: 0.5 };
const MUSIC_1985: Record<string, number> = { tempo: 128, mode: 6, vibrato: 0.7 };
const MUSIC_2005: Record<string, number> = { tempo: 100, mode: 2, vibrato: 0.4 };
const MUSIC_2025: Record<string, number> = { tempo: 90, mode: 3, vibrato: 0.6 };

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTones: AMBIENT_1945,
    trafficProfile: TRAFFIC_1945,
    eventTypes: EVENTS_1945,
    musicStyleParams: MUSIC_1945,
  },
  '1965': {
    ambientTones: AMBIENT_1965,
    trafficProfile: TRAFFIC_1965,
    eventTypes: EVENTS_1965,
    musicStyleParams: MUSIC_1965,
  },
  '1985': {
    ambientTones: AMBIENT_1985,
    trafficProfile: TRAFFIC_1985,
    eventTypes: EVENTS_1985,
    musicStyleParams: MUSIC_1985,
  },
  '2005': {
    ambientTones: AMBIENT_2005,
    trafficProfile: TRAFFIC_2005,
    eventTypes: EVENTS_2005,
    musicStyleParams: MUSIC_2005,
  },
  '2025': {
    ambientTones: AMBIENT_2025,
    trafficProfile: TRAFFIC_2025,
    eventTypes: EVENTS_2025,
    musicStyleParams: MUSIC_2025,
  },
};
