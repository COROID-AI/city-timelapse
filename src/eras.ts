/**
 * Core era type system and registry for the City Timelapse experience.
 *
 * Five distinct time periods (1945, 1965, 1985, 2005, 2025) each carry
 * complete metadata for visual assets, pedestrian outfits, and procedural SFX.
 * This module is the single source of truth consumed by every asset builder,
 * the audio mixer, the scene composer, and the timeline HUD.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Era identity
// ─────────────────────────────────────────────────────────────────────────────

/** The five selectable years on the timeline slider. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Human-readable specification for a single era. */
export interface EraSpec {
  readonly id: EraId;
  readonly year: number;
  readonly label: string;
  readonly description: string;
}

/** Ordered registry — index 0 is earliest, index 4 is latest. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War',
    description:
      'A city finding its feet after the war. Brick facades, gas lamps, trolleys, and fedoras line quiet streets.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century',
    description:
      'Mid-century optimism. Glass and steel rise beside brick, muscle cars rumble, neon flickers to life.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'The Eighties',
    description:
      'Glass towers, boxy sedans, and neon everywhere. Synth music drifts past shoulder-padded suits.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Early Digital',
    description:
      'The digital dawn. SUVs crowd the asphalt, backlit billboards cycle ads, and flip phones are everywhere.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Near Future',
    description:
      'A smarter, cleaner city. EVs glide silently, LED screens wrap buildings, and streetwear meets smart tech.',
  },
];

/** Convenience list of all era ids in chronological order. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Look up an EraSpec by id. Throws if the id is unknown. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) throw new Error(`[eras] Unknown era id: ${id}`);
  return spec;
}

/** Zero-based chronological index of an era (0 = 1945, 4 = 2025). */
export function getEraIndex(id: EraId): number {
  const idx = ERA_REGISTRY.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error(`[eras] Unknown era id: ${id}`);
  return idx;
}

/** The era immediately before the given one, or the same era if already earliest. */
export function getPreviousEra(id: EraId): EraId {
  const idx = getEraIndex(id);
  return idx > 0 ? ERA_IDS[idx - 1] : id;
}

/** The era immediately after the given one, or the same era if already latest. */
export function getNextEra(id: EraId): EraId {
  const idx = getEraIndex(id);
  return idx < ERA_IDS.length - 1 ? ERA_IDS[idx + 1] : id;
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX data — procedural audio parameters per era
// ─────────────────────────────────────────────────────────────────────────────

/** Types of one-shot sound events that punctuate each era. */
export type SfxEventType =
  | 'horn'
  | 'bell'
  | 'siren'
  | 'whistle'
  | 'beep'
  | 'chime'
  | 'engine-rev'
  | 'notification';

/** Specification for a single recurring sound event. */
export interface SfxEventSpec {
  readonly type: SfxEventType;
  /** Base frequency in Hz. */
  readonly frequency: number;
  /** Duration of the event in seconds. */
  readonly duration: number;
  /** Average seconds between occurrences. */
  readonly interval: number;
  /** Peak gain 0–1. */
  readonly volume: number;
  /** For sirens: upper frequency of the sweep. 0 = no sweep. */
  readonly sweepTo?: number;
}

/** Ambient bed parameters — a tonal drone layered over filtered noise. */
export interface SfxAmbientData {
  readonly droneFreq: number;
  readonly droneHarmonic: number;
  readonly noiseLevel: number;
  readonly filterFreq: number;
  readonly filterQ: number;
}

/** Traffic loop parameters — a modulated engine rumble. */
export interface SfxTrafficData {
  readonly engineBaseFreq: number;
  readonly intensity: number;
  readonly filterFreq: number;
  readonly modulationRate: number;
}

/** Procedural music parameters — a simple loopable melody. */
export interface SfxMusicData {
  readonly rootFreq: number;
  readonly scale: readonly number[];
  readonly tempo: number;
  readonly waveform: OscillatorType;
  readonly style: string;
}

/** Complete SFX specification for a single era. */
export interface SfxEraData {
  readonly ambient: SfxAmbientData;
  readonly traffic: SfxTrafficData;
  readonly events: readonly SfxEventSpec[];
  readonly music: SfxMusicData;
}

/**
 * Era-specific sound parameters. Each entry is tuned to evoke the period:
 * 1945 — sparse, mechanical, jazz-inflected
 * 1965 — warming up, rock/pop energy
 * 1985 — dense, electronic, synth-driven
 * 2005 — heavy, digital, urgent
 * 2025 — clean, minimal, ambient with notification chimes
 */
export const SFX_ERA_DATA: Readonly<Record<EraId, SfxEraData>> = {
  '1945': {
    ambient: {
      droneFreq: 60,
      droneHarmonic: 120,
      noiseLevel: 0.12,
      filterFreq: 800,
      filterQ: 0.7,
    },
    traffic: {
      engineBaseFreq: 40,
      intensity: 0.2,
      filterFreq: 300,
      modulationRate: 6,
    },
    events: [
      { type: 'whistle', frequency: 800, duration: 1.5, interval: 22, volume: 0.18, sweepTo: 1000 },
      { type: 'bell', frequency: 600, duration: 0.4, interval: 16, volume: 0.15 },
      { type: 'horn', frequency: 280, duration: 0.5, interval: 30, volume: 0.12 },
    ],
    music: {
      rootFreq: 130.81, // C3
      scale: [0, 3, 5, 7, 10], // minor pentatonic
      tempo: 90,
      waveform: 'triangle',
      style: 'Jazz-inflected brass',
    },
  },
  '1965': {
    ambient: {
      droneFreq: 80,
      droneHarmonic: 160,
      noiseLevel: 0.18,
      filterFreq: 1000,
      filterQ: 0.8,
    },
    traffic: {
      engineBaseFreq: 50,
      intensity: 0.4,
      filterFreq: 400,
      modulationRate: 8,
    },
    events: [
      { type: 'horn', frequency: 440, duration: 0.4, interval: 9, volume: 0.16 },
      { type: 'whistle', frequency: 700, duration: 1.0, interval: 35, volume: 0.14 },
      { type: 'bell', frequency: 880, duration: 0.3, interval: 20, volume: 0.12 },
    ],
    music: {
      rootFreq: 164.81, // E3
      scale: [0, 2, 4, 7, 9], // major pentatonic
      tempo: 120,
      waveform: 'sawtooth',
      style: 'Rock and roll guitar',
    },
  },
  '1985': {
    ambient: {
      droneFreq: 100,
      droneHarmonic: 200,
      noiseLevel: 0.25,
      filterFreq: 2000,
      filterQ: 1.0,
    },
    traffic: {
      engineBaseFreq: 60,
      intensity: 0.6,
      filterFreq: 500,
      modulationRate: 12,
    },
    events: [
      { type: 'horn', frequency: 350, duration: 0.3, interval: 6, volume: 0.15 },
      { type: 'siren', frequency: 600, duration: 2.0, interval: 28, volume: 0.14, sweepTo: 1200 },
      { type: 'beep', frequency: 1000, duration: 0.1, interval: 4, volume: 0.1 },
    ],
    music: {
      rootFreq: 146.83, // D3
      scale: [0, 2, 3, 5, 7, 8, 10], // natural minor
      tempo: 130,
      waveform: 'square',
      style: 'Synthwave electronic',
    },
  },
  '2005': {
    ambient: {
      droneFreq: 120,
      droneHarmonic: 240,
      noiseLevel: 0.3,
      filterFreq: 3000,
      filterQ: 1.2,
    },
    traffic: {
      engineBaseFreq: 55,
      intensity: 0.75,
      filterFreq: 600,
      modulationRate: 14,
    },
    events: [
      { type: 'horn', frequency: 300, duration: 0.3, interval: 5, volume: 0.14 },
      { type: 'siren', frequency: 700, duration: 1.5, interval: 22, volume: 0.13, sweepTo: 1400 },
      { type: 'beep', frequency: 1200, duration: 0.08, interval: 3, volume: 0.1 },
    ],
    music: {
      rootFreq: 174.61, // F3
      scale: [0, 2, 4, 5, 7, 9, 11], // major
      tempo: 128,
      waveform: 'sawtooth',
      style: 'Electronic dance',
    },
  },
  '2025': {
    ambient: {
      droneFreq: 100,
      droneHarmonic: 150,
      noiseLevel: 0.08,
      filterFreq: 4000,
      filterQ: 0.5,
    },
    traffic: {
      engineBaseFreq: 80,
      intensity: 0.3,
      filterFreq: 1200,
      modulationRate: 20,
    },
    events: [
      { type: 'chime', frequency: 880, duration: 0.2, interval: 12, volume: 0.12, sweepTo: 1320 },
      { type: 'horn', frequency: 500, duration: 0.2, interval: 14, volume: 0.1 },
      { type: 'notification', frequency: 1760, duration: 0.15, interval: 18, volume: 0.08 },
    ],
    music: {
      rootFreq: 110, // A2
      scale: [0, 2, 4, 6, 7, 9, 11], // lydian
      tempo: 100,
      waveform: 'sine',
      style: 'Ambient electronic',
    },
  },
};

/** Look up the SFX parameters for a given era. */
export function getSfxEraData(id: EraId): SfxEraData {
  return SFX_ERA_DATA[id];
}
