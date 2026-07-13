// =============================================================================
// City Timelapse — Shared Era Types & Registry
//
// The single source of truth for the six timeline stops (1945 → 2055). Every
// later subsystem (timeline UI, scene visuals, procedural SFX, music) imports
// its era identity and period character from here, so transitions stay
// coordinated and consistent.
//
// No external files are referenced — all data is descriptive metadata that
// downstream procedural builders interpret.
// =============================================================================

// ---------------------------------------------------------------------------
// Era identity
// ---------------------------------------------------------------------------

/**
 * The six canonical timeline stops, verbatim from the simulation plan.
 * Ordered chronologically: 1945 → 1965 → 1985 → 2005 → 2025 → 2055.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

/**
 * Ordered, readonly list of every EraId, earliest first. Downstream code uses
 * this to map an era to its normalized position on the timeline.
 */
export const ERA_IDS: readonly EraId[] = [
  '1945',
  '1965',
  '1985',
  '2005',
  '2025',
  '2055',
];

// ---------------------------------------------------------------------------
// Era specification
// ---------------------------------------------------------------------------

/**
 * High-level descriptive identity of one timeline stop: its id, calendar
 * year, short label, and a one-sentence description capturing the era's
 * visual and audio character.
 */
export interface EraSpec {
  /** Canonical era id (e.g. `'1985'`). */
  readonly id: EraId;
  /** Calendar year as a number (e.g. `1985`). */
  readonly year: number;
  /** Short, human-readable label (e.g. `'Neon Boom'`). */
  readonly label: string;
  /** One sentence capturing the era's visual + audio character. */
  readonly description: string;
}

/**
 * The full timeline registry, in chronological order (6 entries). Distinct
 * years, labels, and descriptions per era.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Postwar',
    description:
      'A smoggy amber dusk over low brick blocks, scored by clattering trams, brassy swing, and the occasional victory bell.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Space Age',
    description:
      'Pastel neon and glass storefronts hum to the growl of combustion engines and the jangle of rock-and-roll guitars.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Boom',
    description:
      'Mirrored towers and hot-pink neon reflect a denser traffic roar under pulsing synthesizer pop and wailing sirens.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Millennial Grid',
    description:
      'Sleek steel-and-glass canyons channel SUV traffic, ring-tone chirps, and thumping mainstream pop bass.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Smart City',
    description:
      'Glossy eco-towers and LED billboards drift to the whisper of electric motors, soft UI chimes, and streamed ambient pop.',
  },
  {
    id: '2055',
    year: 2055,
    label: 'Skybound',
    description:
      'Soaring vertical gardens and holographic signage hover amid silent mag-lev glide and luminous ambient electronic pads.',
  },
];

/**
 * Look up an {@link EraSpec} by its id. Throws if the id is unknown, which
 * indicates a programming error rather than user input.
 */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((entry) => entry.id === id);
  if (!spec) {
    throw new Error(`[eras] Unknown EraId: "${id}"`);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Procedural sound parameters (consumed by the SFX subsystem)
// ---------------------------------------------------------------------------

/** One-shot sound event types characteristic of particular eras. */
export type SfxEventType =
  | 'horn'
  | 'bell'
  | 'siren'
  | 'whinny'
  | 'chime'
  | 'drone-beep'
  | 'announcement';

/** Spectral character of the procedural noise bed. */
export type SfxNoiseColor = 'brown' | 'pink' | 'white';

/** Broad engine/drive character used to synthesize the traffic loop. */
export type SfxEngineType = 'horse' | 'combustion' | 'electric' | 'hover';

/**
 * Period-appropriate sound parameters for one era. The SFX subsystem
 * (`src/audio`) interprets these to synthesize ambient beds, traffic loops,
 * one-shot events, and a musical motif — entirely procedurally, with no
 * external audio files.
 */
export interface SfxEraData {
  /** Ambient bed: tonal drones layered over filtered noise. */
  readonly ambient: {
    /** Tonal drone frequencies (Hz) mixed into the bed. */
    readonly baseTones: readonly number[];
    /** Spectral color of the underlying noise. */
    readonly noiseColor: SfxNoiseColor;
    /** Relative level of the noise layer, 0..1. */
    readonly noiseLevel: number;
    /** Short description of the bed's mood. */
    readonly description: string;
  };
  /** Traffic loop profile: density, engine character, and tempo. */
  readonly traffic: {
    /** Density feel of the traffic, 0 (empty) .. 1 (gridlock). */
    readonly density: number;
    /** Engine/drive character used for synthesis. */
    readonly engineType: SfxEngineType;
    /** Relative tempo of pass-bys, 0..1. */
    readonly speed: number;
    /** Short description of the traffic texture. */
    readonly description: string;
  };
  /** Discrete one-shot events characteristic of the era. */
  readonly events: readonly SfxEventType[];
  /** Musical motif style for the era. */
  readonly music: {
    /** Human-readable style name. */
    readonly style: string;
    /** Root note of the motif, in Hz. */
    readonly rootNote: number;
    /** Motif tempo in beats-per-minute. */
    readonly tempoBpm: number;
  };
}

/**
 * Period-appropriate sound parameters for every era. Distinct values keep each
 * era audibly identifiable; the SFX subsystem reads this at buffer-generation
 * time.
 */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambient: {
      baseTones: [110, 165],
      noiseColor: 'brown',
      noiseLevel: 0.5,
      description: 'Crackling radio static and a low, warm postwar drone.',
    },
    traffic: {
      density: 0.25,
      engineType: 'horse',
      speed: 0.3,
      description: 'Clopping hooves and the occasional sputtering early auto.',
    },
    events: ['bell', 'whinny'],
    music: { style: 'Brassy swing', rootNote: 220, tempoBpm: 120 },
  },
  '1965': {
    ambient: {
      baseTones: [146.83, 220],
      noiseColor: 'pink',
      noiseLevel: 0.4,
      description: 'Warm tape hiss under a steady mid-century city hum.',
    },
    traffic: {
      density: 0.5,
      engineType: 'combustion',
      speed: 0.5,
      description: 'Throaty V8 rumbles and steady mechanical clatter.',
    },
    events: ['horn'],
    music: { style: 'Rock and roll', rootNote: 261.63, tempoBpm: 140 },
  },
  '1985': {
    ambient: {
      baseTones: [130.81, 196],
      noiseColor: 'pink',
      noiseLevel: 0.45,
      description: 'Bright fluorescent buzz over a dense urban wash.',
    },
    traffic: {
      density: 0.7,
      engineType: 'combustion',
      speed: 0.7,
      description: 'Revving engines and heavy downtown gridlock growl.',
    },
    events: ['horn', 'siren'],
    music: { style: 'Synth pop', rootNote: 220, tempoBpm: 118 },
  },
  '2005': {
    ambient: {
      baseTones: [110, 164.81],
      noiseColor: 'white',
      noiseLevel: 0.4,
      description: 'Crisp digital sheen over a wide, compressed cityscape.',
    },
    traffic: {
      density: 0.85,
      engineType: 'combustion',
      speed: 0.8,
      description: 'Multi-lane SUV drone with frequent honks and alarms.',
    },
    events: ['horn', 'siren', 'chime'],
    music: { style: 'Mainstream pop', rootNote: 220, tempoBpm: 100 },
  },
  '2025': {
    ambient: {
      baseTones: [98, 146.83],
      noiseColor: 'pink',
      noiseLevel: 0.3,
      description: 'Clean, low hush punctuated by soft digital prompts.',
    },
    traffic: {
      density: 0.8,
      engineType: 'electric',
      speed: 0.7,
      description: 'Quiet electric whir and tire hiss with rare engine notes.',
    },
    events: ['chime', 'announcement'],
    music: { style: 'Ambient pop', rootNote: 261.63, tempoBpm: 95 },
  },
  '2055': {
    ambient: {
      baseTones: [65.41, 130.81],
      noiseColor: 'brown',
      noiseLevel: 0.35,
      description: 'Deep sub-bass calm and an airy, weightless stillness.',
    },
    traffic: {
      density: 0.6,
      engineType: 'hover',
      speed: 0.6,
      description: 'Silent mag-lev glide with faint magnetic shimmer.',
    },
    events: ['chime', 'drone-beep'],
    music: { style: 'Ambient electronic', rootNote: 130.81, tempoBpm: 80 },
  },
};
