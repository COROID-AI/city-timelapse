/**
 * Era type system and registry for the City Time Period Timelapse.
 *
 * Five decades (1945 → 2025) are modelled as a typed, declarative registry.
 * Each era carries metadata (`EraSpec`) plus era-specific sound parameters
 * (`SfxEraData`) consumed by the procedural audio engine in `src/audio/`.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Identifier for one of the five selectable decades. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/**
 * Static metadata describing a single era.
 * Consumed by the timeline HUD, scene composer, and audio mixer.
 */
export interface EraSpec {
  /** Unique string key used across the app (e.g. `'1985'`). */
  readonly id: EraId;
  /** Numeric year for display and sorting. */
  readonly year: number;
  /** Short human label, e.g. `'Mid-Century'`. */
  readonly label: string;
  /** Longer description shown in the UI / tooltip. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// SFX data
// ---------------------------------------------------------------------------

/** A single one-shot street event (horn, bell, siren …). */
export interface SfxEvent {
  /** Broad category selecting the synthesis method. */
  readonly type: 'horn' | 'bell' | 'siren' | 'chime' | 'whistle' | 'engine_burst' | 'beep' | 'klaxon';
  /** Fundamental frequency in Hz. */
  readonly frequency: number;
  /** Duration of the event in seconds. */
  readonly duration: number;
  /** Relative loudness 0–1 of this event inside its era. */
  readonly gain: number;
}

/**
 * Declarative description of the soundscape for a single era.
 * The procedural buffer generator (`sfx.ts`) turns these numbers into
 * `AudioBuffer`s; the mixer (`mixer.ts`) crossfades between them.
 */
export interface SfxEraData {
  // --- Ambient bed ---------------------------------------------------------
  /** Tonal drone frequencies (Hz) layered over the noise bed. */
  readonly ambientTones: readonly number[];
  /** Low-pass cutoff (Hz) applied to the generated noise bed. */
  readonly ambientNoiseCutoff: number;
  /** Overall gain of the ambient layer 0–1. */
  readonly ambientGain: number;

  // --- Traffic loop --------------------------------------------------------
  /** Dominant engine rumble fundamental (Hz). */
  readonly trafficEngineFreq: number;
  /** Band-pass centre frequency (Hz) shaping the engine texture. */
  readonly trafficBandpass: number;
  /** How busy the street sounds — higher = denser pass-bys. */
  readonly trafficDensity: number;
  /** Overall gain of the traffic layer 0–1. */
  readonly trafficGain: number;

  // --- Street events (one-shots) ------------------------------------------
  readonly events: readonly SfxEvent[];
  /** Overall gain of the event layer 0–1. */
  readonly eventGain: number;
  /** Average seconds between randomly scheduled one-shots. */
  readonly eventInterval: number;

  // --- Music ---------------------------------------------------------------
  /** Musical note frequencies (Hz) forming the era's melodic motif. */
  readonly musicNotes: readonly number[];
  /** Tempo in BPM for the melodic motif. */
  readonly musicTempo: number;
  /** Oscillator waveform used for the music layer. */
  readonly musicWave: OscillatorType;
  /** Overall gain of the music layer 0–1. */
  readonly musicGain: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Ordered list of every era id. */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Ordered, immutable registry of era metadata. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War',
    description:
      'Recovering brick-and-mortar streets. Few cars, trolley bells, gas lamps, and the faint hum of industry.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century',
    description:
      'Chrome-and-fins optimism. V8 rumbles, honking horns, and crooner muzak drifting from shop doorways.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Boom',
    description:
      'Dense traffic, synthesised pop, arcade chimes, and the wail of emergency sirens echoing off glass towers.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Digital Dawn',
    description:
      'Cell-phone beeps, ride-share horns, and compressed mp3 muzak. The street is louder and busier than ever.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Eco Future',
    description:
      'Quiet EV whir, pedestrian chimes, and clean ambient pads. A calmer, electric soundscape.',
  },
];

/**
 * Look up the `EraSpec` for a given id.
 * Throws if the id is not in the registry (type-safe exhaustiveness guard).
 */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`[eras] Unknown EraId: ${id}`);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// SFX data per era
// ---------------------------------------------------------------------------

/** Distinct, period-appropriate sound parameters for every era. */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  // --- 1945 ----------------------------------------------------------------
  '1945': {
    ambientTones: [55, 82.4, 110],
    ambientNoiseCutoff: 600,
    ambientGain: 0.35,
    trafficEngineFreq: 42,
    trafficBandpass: 180,
    trafficDensity: 0.25,
    trafficGain: 0.25,
    events: [
      { type: 'bell', frequency: 880, duration: 1.2, gain: 0.5 },
      { type: 'whistle', frequency: 1200, duration: 0.6, gain: 0.4 },
      { type: 'horn', frequency: 280, duration: 0.45, gain: 0.35 },
    ],
    eventGain: 0.4,
    eventInterval: 7,
    musicNotes: [261.63, 329.63, 392.0, 523.25],
    musicTempo: 72,
    musicWave: 'triangle',
    musicGain: 0.12,
  },

  // --- 1965 ----------------------------------------------------------------
  '1965': {
    ambientTones: [49, 73.4, 98],
    ambientNoiseCutoff: 900,
    ambientGain: 0.3,
    trafficEngineFreq: 48,
    trafficBandpass: 220,
    trafficDensity: 0.45,
    trafficGain: 0.35,
    events: [
      { type: 'horn', frequency: 240, duration: 0.5, gain: 0.45 },
      { type: 'horn', frequency: 310, duration: 0.4, gain: 0.4 },
      { type: 'bell', frequency: 660, duration: 1.0, gain: 0.35 },
    ],
    eventGain: 0.45,
    eventInterval: 5,
    musicNotes: [293.66, 369.99, 440.0, 587.33],
    musicTempo: 96,
    musicWave: 'sine',
    musicGain: 0.14,
  },

  // --- 1985 ----------------------------------------------------------------
  '1985': {
    ambientTones: [44, 65.4, 87.3, 130.8],
    ambientNoiseCutoff: 1500,
    ambientGain: 0.28,
    trafficEngineFreq: 55,
    trafficBandpass: 300,
    trafficDensity: 0.7,
    trafficGain: 0.45,
    events: [
      { type: 'siren', frequency: 700, duration: 2.0, gain: 0.4 },
      { type: 'horn', frequency: 350, duration: 0.5, gain: 0.5 },
      { type: 'chime', frequency: 1318.5, duration: 0.3, gain: 0.35 },
      { type: 'engine_burst', frequency: 60, duration: 0.8, gain: 0.3 },
    ],
    eventGain: 0.5,
    eventInterval: 3.5,
    musicNotes: [220.0, 277.18, 329.63, 415.3, 554.37],
    musicTempo: 120,
    musicWave: 'sawtooth',
    musicGain: 0.16,
  },

  // --- 2005 ----------------------------------------------------------------
  '2005': {
    ambientTones: [41.2, 61.7, 92.5],
    ambientNoiseCutoff: 2200,
    ambientGain: 0.25,
    trafficEngineFreq: 52,
    trafficBandpass: 350,
    trafficDensity: 0.85,
    trafficGain: 0.5,
    events: [
      { type: 'beep', frequency: 1760, duration: 0.15, gain: 0.4 },
      { type: 'horn', frequency: 400, duration: 0.45, gain: 0.45 },
      { type: 'siren', frequency: 800, duration: 1.5, gain: 0.35 },
      { type: 'chime', frequency: 1567.98, duration: 0.25, gain: 0.3 },
    ],
    eventGain: 0.55,
    eventInterval: 2.5,
    musicNotes: [261.63, 311.13, 392.0, 466.16, 622.25],
    musicTempo: 100,
    musicWave: 'square',
    musicGain: 0.15,
  },

  // --- 2025 ----------------------------------------------------------------
  '2025': {
    ambientTones: [36.7, 55, 73.4, 110],
    ambientNoiseCutoff: 3200,
    ambientGain: 0.22,
    trafficEngineFreq: 70,
    trafficBandpass: 500,
    trafficDensity: 0.5,
    trafficGain: 0.3,
    events: [
      { type: 'beep', frequency: 2000, duration: 0.12, gain: 0.3 },
      { type: 'chime', frequency: 1760, duration: 0.4, gain: 0.35 },
      { type: 'whistle', frequency: 1500, duration: 0.5, gain: 0.25 },
    ],
    eventGain: 0.4,
    eventInterval: 4,
    musicNotes: [220.0, 277.18, 329.63, 440.0],
    musicTempo: 84,
    musicWave: 'sine',
    musicGain: 0.1,
  },
};
