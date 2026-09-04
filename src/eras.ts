/**
 * Shared era types & registry for the City Time Period Timelapse.
 *
 * The timeline exposes five eras (1945 → 2025). Every scene module and the
 * audio system derive their behaviour from this single source of truth.
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  /** Numeric year used for display and derived math. */
  year: number;
  /** Short label shown on the timeline. */
  label: string;
  /** One-line flavour text shown in the HUD. */
  description: string;
}

/** Ordered registry — index equals the continuous `eraFloat` coordinate. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick & sepia — gas lamps, trolleys and victory gardens.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastels — chrome fins, neon and optimistic glass.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete & sodium haze — arcades, boxy cars and big shoulders.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Modern glass & SUVs — digital billboards and LED streets.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'Contemporary & electric — EV hum, LED screens, green roofs.',
  },
] as const;

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id);

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) throw new Error(`Unknown era id: ${id}`);
  return spec;
}

export function getEraIndex(id: EraId): number {
  return ERA_IDS.indexOf(id);
}

/* ------------------------------------------------------------------ */
/* Audio (SFX) parameters per era                                      */
/* ------------------------------------------------------------------ */

export type SfxEventType =
  | 'horn'
  | 'bell'
  | 'siren'
  | 'chirp'
  | 'engine'
  | 'train'
  | 'shutter'
  | 'drone';

export interface SfxEraData {
  /** Looping ambient bed: filtered noise + tonal drone. */
  ambient: {
    /** Noise low-pass cutoff in Hz (0 opens the filter fully). */
    noiseCutoff: number;
    /** Drone fundamental in Hz. */
    droneBase: number;
    /** Secondary drone detune in cents. */
    droneDetune: number;
    /** Overall ambient gain (0..1). */
    gain: number;
  };
  /** Looping traffic bed: engine rumble + density of passing vehicles. */
  traffic: {
    /** Rumble fundamental in Hz. */
    rumbleFreq: number;
    /** How often a vehicle "passes" (per second) — modulates the bed. */
    density: number;
    /** Traffic bed gain (0..1). */
    gain: number;
  };
  /** One-shot ambience events. */
  events: {
    types: SfxEventType[];
    /** Relative weights, parallel to `types`. */
    weights: number[];
    /** Average seconds between spontaneous events. */
    interval: number;
    /** Master gain for events (0..1). */
    gain: number;
  };
  /** Simple procedurally generated music loop. */
  music: {
    /** Oscillator waveforms for lead / bass / pad. */
    leadWave: OscillatorType;
    bassWave: OscillatorType;
    padWave: OscillatorType;
    /** Pentatonic-ish scale as semitone offsets from the root. */
    scale: number[];
    /** Beats per minute. */
    tempo: number;
    /** Root MIDI note (e.g. 45 = A2). */
    root: number;
    /** Music layer gain (0..1). */
    gain: number;
  };
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambient: { noiseCutoff: 420, droneBase: 55, droneDetune: 6, gain: 0.16 },
    traffic: { rumbleFreq: 46, density: 0.08, gain: 0.1 },
    events: {
      types: ['horn', 'bell', 'train', 'chirp'],
      weights: [0.3, 0.35, 0.2, 0.15],
      interval: 7,
      gain: 0.5,
    },
    music: {
      leadWave: 'sine',
      bassWave: 'triangle',
      padWave: 'sine',
      scale: [0, 3, 5, 7, 10, 12],
      tempo: 104,
      root: 45,
      gain: 0.13,
    },
  },
  '1965': {
    ambient: { noiseCutoff: 700, droneBase: 62, droneDetune: 8, gain: 0.15 },
    traffic: { rumbleFreq: 58, density: 0.12, gain: 0.12 },
    events: {
      types: ['horn', 'bell', 'engine', 'chirp'],
      weights: [0.3, 0.25, 0.3, 0.15],
      interval: 6,
      gain: 0.5,
    },
    music: {
      leadWave: 'triangle',
      bassWave: 'triangle',
      padWave: 'sine',
      scale: [0, 2, 4, 7, 9, 12],
      tempo: 118,
      root: 43,
      gain: 0.14,
    },
  },
  '1985': {
    ambient: { noiseCutoff: 1100, droneBase: 70, droneDetune: 12, gain: 0.16 },
    traffic: { rumbleFreq: 72, density: 0.2, gain: 0.16 },
    events: {
      types: ['horn', 'siren', 'engine', 'shutter'],
      weights: [0.25, 0.2, 0.4, 0.15],
      interval: 4.5,
      gain: 0.55,
    },
    music: {
      leadWave: 'square',
      bassWave: 'sawtooth',
      padWave: 'sawtooth',
      scale: [0, 3, 5, 7, 10, 12, 15],
      tempo: 122,
      root: 38,
      gain: 0.12,
    },
  },
  '2005': {
    ambient: { noiseCutoff: 1500, droneBase: 78, droneDetune: 10, gain: 0.14 },
    traffic: { rumbleFreq: 82, density: 0.26, gain: 0.18 },
    events: {
      types: ['horn', 'siren', 'engine', 'drone'],
      weights: [0.2, 0.15, 0.5, 0.15],
      interval: 4,
      gain: 0.5,
    },
    music: {
      leadWave: 'sine',
      bassWave: 'sine',
      padWave: 'triangle',
      scale: [0, 2, 4, 7, 9, 12, 14],
      tempo: 126,
      root: 41,
      gain: 0.12,
    },
  },
  '2025': {
    ambient: { noiseCutoff: 1900, droneBase: 84, droneDetune: 14, gain: 0.15 },
    traffic: { rumbleFreq: 90, density: 0.3, gain: 0.14 },
    events: {
      types: ['horn', 'engine', 'drone', 'chirp'],
      weights: [0.2, 0.45, 0.2, 0.15],
      interval: 3.5,
      gain: 0.5,
    },
    music: {
      leadWave: 'sine',
      bassWave: 'sine',
      padWave: 'sine',
      scale: [0, 2, 3, 7, 9, 12, 14],
      tempo: 128,
      root: 40,
      gain: 0.12,
    },
  },
};