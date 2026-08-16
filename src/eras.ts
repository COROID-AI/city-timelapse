// ── EraId ────────────────────────────────────────────────────────────
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

// ── EraSpec ──────────────────────────────────────────────────────────
export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SfxEraData — rich per-era audio configuration consumed by generateEraAudioBuffers()
// ═══════════════════════════════════════════════════════════════════════

/** A single one-shot event definition. */
export interface SfxEventDef {
  /** Machine-readable event type */
  type: string;
  /** Display / debug label */
  label?: string;
  /** Duration in seconds (for sustained events) */
  durationSec?: number;
  /** Primary frequency in Hz (for tonal events) */
  freqHz?: number;
  /** Attack time in ms */
  attackMs?: number;
  /** Release time in ms */
  releaseMs?: number;
  /** Low frequency for alternating events (siren) */
  lowHz?: number;
  /** High frequency for alternating events (siren) */
  highHz?: number;
  /** Cycle duration for alternating events */
  cycleSec?: number;
  /** Start frequency for sweeps (bleep) */
  startHz?: number;
  /** End frequency for sweeps (bleep) */
  endHz?: number;
  /** Harmonic series multipliers for engine profiles */
  harmonics?: number[];
  /** Note-duration fraction for arpeggios */
  noteDurFrac?: number;
  /** Interval ratios for synth arpeggio */
  intervals?: number[];
}

/** Per-era sound configuration. */
export interface EraData {
  /** Base frequencies (Hz) for ambient drone tones */
  ambientTones: number[];
  /** Detuning in cents per tone (default 5) */
  detuneCents?: number[];
  /** Amplitude per tone (default 0.3) */
  ambientAmplitudes?: number[];
  /** Traffic density profile: [idle, rush, night] */
  trafficProfile: [number, number, number];
  /** Engine idle RPM (controls fundamental frequency) */
  engineIdleRPM?: number;
  /** Harmonic series for engine sawtooth layer */
  engineHarmonics?: number[];
  /** Noise-to-tone ratio for engine profile */
  engineNoiseMix?: number;
  /** Center frequency of atmospheric noise bed (Hz) */
  noiseCenterHz?: number;
  /** Bandwidth fraction of noise bed */
  noiseBandwidth?: number;
  /** Amplitude of noise bed */
  noiseAmplitude?: number;
  /** Extra engine sound type or null */
  extraEngineSound?: 'ev_whine' | null;
  /** EV whine min/max Hz (when extraEngineSound === 'ev_whine') */
  evMinHz?: number;
  evMaxHz?: number;
  /** Whether to add a wind/atmospheric layer */
  windLayer?: boolean;
  /** Wind center frequency when enabled */
  windCenterHz?: number;
  /** One-shot event definitions */
  events: SfxEventDef[];
  /** Legacy field kept for backwards compatibility */
  eventTypes?: string[];
  /** Legacy music-style parameters */
  musicStyleParams?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════
// ERA_REGISTRY (ordered array)
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// ERA_IDS
// ═══════════════════════════════════════════════════════════════════════

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id);

// ═══════════════════════════════════════════════════════════════════════
// getEraSpec
// ═══════════════════════════════════════════════════════════════════════

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${id}. Expected one of ${ERA_IDS.join(', ')}`);
  }
  return spec;
}

// ═══════════════════════════════════════════════════════════════════════
// SFX_ERA_DATA — FINALIZED per-era parameters
// Each era's sonic character matches its historical brief:
//   1945: sparse engines + tram bell + faint big-band horns + coal hiss
//   1965: brighter carburettor engines + jukebox doo-wop stabs
//   1985: synth arpeggio + arcade bleeps + boombox bass
//   2005: pop beat + ringtone chirps + SUV rumble
//   2025: low electric hum + EV whine + digital pings + wind
// ═══════════════════════════════════════════════════════════════════════

export const SFX_ERA_DATA: Record<EraId, EraData> = {

  // ── 1945: Post-War Dusk ───────────────────────────────────────────
  // Sparse engines + tram bell + faint big-band horns + coal hiss
  '1945': {
    ambientTones: [55, 110],
    detuneCents: [5, 7],
    ambientAmplitudes: [0.3, 0.2],
    trafficProfile: [0.2, 0.8, 0.1],
    engineIdleRPM: 350,
    engineHarmonics: [1, 2],
    engineNoiseMix: 0.2,
    noiseCenterHz: 150,
    noiseBandwidth: 0.2,
    noiseAmplitude: 0.06,
    windLayer: false,
    events: [
      { type: 'bell', label: 'tram_bell', freqHz: 1800, durationSec: 2.5, attackMs: 2, releaseMs: 600 },
      { type: 'big_band_horn', label: 'faint_horns', freqHz: 260, durationSec: 1.2 },
      { type: 'coal_hiss', label: 'coal_hiss', durationSec: 2.0 },
      { type: 'train_whistle', label: 'distant_train', freqHz: 1200, durationSec: 1.5 },
      { type: 'radio_static', label: 'radio_faint', durationSec: 1.0 },
    ],
  },

  // ── 1965: Swinging Sixties ────────────────────────────────────────
  // Brighter carburettor engines + jukebox doo-wop stabs
  '1965': {
    ambientTones: [73.4, 146.8, 220],
    detuneCents: [4, 6, 3],
    ambientAmplitudes: [0.35, 0.25, 0.15],
    trafficProfile: [0.3, 1.2, 0.2],
    engineIdleRPM: 650,
    engineHarmonics: [1, 2, 3, 4, 5, 6],
    engineNoiseMix: 0.35,
    noiseCenterHz: 250,
    noiseBandwidth: 0.3,
    noiseAmplitude: 0.1,
    windLayer: false,
    events: [
      { type: 'doo_wop_stab', label: 'jukebox_stab', freqHz: 220, durationSec: 0.5 },
      { type: 'doo_wop_stab', label: 'jukebox_stab2', freqHz: 262, durationSec: 0.5 },
      { type: 'horn', label: 'car_horn', freqHz: 440, durationSec: 0.6, attackMs: 10, releaseMs: 50 },
      { type: 'siren', label: 'police_siren', lowHz: 600, highHz: 1200, durationSec: 3.0, cycleSec: 1.0 },
    ],
  },

  // ── 1985: Neon Boom ───────────────────────────────────────────────
  // Synth arpeggio + arcade bleeps + boombox bass
  '1985': {
    ambientTones: [82.4, 164.8, 329.6, 659.3],
    detuneCents: [8, -5, 10, -8],
    ambientAmplitudes: [0.3, 0.25, 0.2, 0.1],
    trafficProfile: [0.5, 1.8, 0.4],
    engineIdleRPM: 700,
    engineHarmonics: [1, 2, 3, 4, 5, 6, 7],
    engineNoiseMix: 0.25,
    noiseCenterHz: 350,
    noiseBandwidth: 0.35,
    noiseAmplitude: 0.12,
    windLayer: true,
    windCenterHz: 500,
    events: [
      { type: 'synth_arpeggio', label: 'synth_pad', freqHz: 220, durationSec: 2.0, intervals: [1, 1.25, 1.5, 2, 2.5, 3], noteDurFrac: 0.15 },
      { type: 'bleep', label: 'arcade_1', startHz: 800, endHz: 1600, durationSec: 0.08 },
      { type: 'bleep', label: 'arcade_2', startHz: 400, endHz: 1200, durationSec: 0.1 },
      { type: 'boombox_bass', label: 'sub_drop', freqHz: 55, durationSec: 0.4 },
      { type: 'ringtone_chirp', label: 'retro_tone', durationSec: 0.15 },
    ],
  },

  // ── 2005: Broadband Era ───────────────────────────────────────────
  // Pop beat + ringtone chirps + SUV rumble
  '2005': {
    ambientTones: [65.4, 130.8, 261.6],
    detuneCents: [3, 5, 2],
    ambientAmplitudes: [0.4, 0.3, 0.15],
    trafficProfile: [0.7, 2.2, 0.5],
    engineIdleRPM: 600,
    engineHarmonics: [1, 2, 3, 4, 5, 6, 7, 8],
    engineNoiseMix: 0.2,
    noiseCenterHz: 300,
    noiseBandwidth: 0.4,
    noiseAmplitude: 0.08,
    windLayer: true,
    windCenterHz: 450,
    events: [
      { type: 'kick', label: 'pop_kick', durationSec: 0.15 },
      { type: 'hihat', label: 'pop_hat', durationSec: 0.04 },
      { type: 'ringtone_chirp', label: 'cell_chirp', durationSec: 0.15 },
      { type: 'ping', label: 'notification_ping', freqHz: 1200, durationSec: 0.2 },
      { type: 'siren', label: 'ambulance', lowHz: 700, highHz: 1400, durationSec: 2.5, cycleSec: 0.8 },
    ],
  },

  // ── 2025: Connected Horizon ───────────────────────────────────────
  // Low electric hum + EV whine + digital notification pings + wind
  '2025': {
    ambientTones: [41.2, 82.4, 164.8, 329.6, 659.3],
    detuneCents: [2, 3, -2, 4, -3],
    ambientAmplitudes: [0.35, 0.3, 0.2, 0.15, 0.1],
    trafficProfile: [0.9, 2.5, 0.6],
    engineIdleRPM: 1200,
    engineHarmonics: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    engineNoiseMix: 0.08,
    noiseCenterHz: 200,
    noiseBandwidth: 0.15,
    noiseAmplitude: 0.05,
    extraEngineSound: 'ev_whine',
    evMinHz: 80,
    evMaxHz: 300,
    windLayer: true,
    windCenterHz: 400,
    events: [
      { type: 'ping', label: 'digital_ping', freqHz: 1500, durationSec: 0.15 },
      { type: 'ping', label: 'notification_double', freqHz: 1800, durationSec: 0.15 },
      { type: 'ping', label: 'alert_tone', freqHz: 2000, durationSec: 0.2 },
      { type: 'bleep', label: 'ui_click', startHz: 1000, endHz: 2000, durationSec: 0.05 },
      { type: 'siren', label: 'emergency_vox', lowHz: 500, highHz: 1000, durationSec: 4.0, cycleSec: 1.5 },
    ],
  },
};
