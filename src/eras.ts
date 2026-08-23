/**
 * Shared era contracts for the City Era Timelapse (1945 → 2025).
 *
 * This module is the single source of truth for era identity. Every other
 * system (renderer, audio, UI timeline) consumes these definitions so that
 * era switching stays consistent across the whole application.
 */

/** Discrete timeline stops exposed by the top timeline slider. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Human-facing description of one era stop. */
export interface EraSpec {
  readonly id: EraId;
  readonly year: number;
  readonly label: string;
  readonly description: string;
}

/** Density character of the era's street traffic. */
export type TrafficProfile = 'sparse' | 'moderate' | 'heavy' | 'electric';

/** One-shot street-event sounds available in an era. */
export type EventSoundKind =
  | 'bell'
  | 'tramBell'
  | 'horn'
  | 'siren'
  | 'airHorn'
  | 'digitalChime'
  | 'evChime';

/** Style tag driving the procedurally generated period music bed. */
export type MusicStyle =
  | 'bigbandSwing'
  | 'surfRock'
  | 'synthwave'
  | 'popRock'
  | 'electronicAmbient';

/**
 * Era-specific parameters for the procedural SFX synthesizer
 * (`src/audio/sfx.ts`). Every field is consumed at buffer-generation time;
 * there are no external audio assets anywhere in the pipeline.
 */
export interface SfxEraData {
  readonly id: EraId;
  /** Slowly evolving background bed: tonal drones plus filtered noise wash. */
  readonly ambient: {
    /** Drone partial frequencies in Hz (low → high). */
    readonly droneFrequencies: readonly number[];
    readonly droneLevel: number;
    readonly noiseLevel: number;
    /** Low-pass cutoff for the ambience noise bed in Hz. */
    readonly noiseCutoffHz: number;
  };
  /** Street traffic loop: engines, tires, pass-bys (or EV whine). */
  readonly traffic: {
    readonly profile: TrafficProfile;
    /** Relative vehicle density, 0..1. */
    readonly density: number;
    /** Relative tempo of engine pulses / pass-bys (roughly 0.5..2). */
    readonly pace: number;
    /** True for eras dominated by electric drivetrains (whine, not rumble). */
    readonly electric: boolean;
    readonly level: number;
  };
  /** Randomized one-shot street events (bells, horns, sirens, chimes). */
  readonly events: {
    readonly kinds: readonly EventSoundKind[];
    /** Average spacing between events in seconds. */
    readonly intervalSeconds: number;
    readonly level: number;
  };
  /** Looping period music bed. */
  readonly music: {
    readonly style: MusicStyle;
    readonly tempoBpm: number;
    /** Root frequency in Hz for the progression. */
    readonly rootFrequency: number;
    readonly level: number;
  };
}

/** Ordered registry of every era stop (oldest → newest). */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Rebuild',
    description:
      'Brick rowhouses, victory gardens and gas lamps; sparse vintage traffic and distant church bells.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century Boom',
    description:
      'Pastel storefronts, chrome cruisers and buzzing neon under a booming postwar economy.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Decade',
    description:
      'Concrete towers, boxy sedans and sodium haze washed in bright arcade neon.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Digital Age',
    description:
      'Glass curtain walls, SUV convoys and early LED billboards humming around the clock.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Electric Present',
    description:
      'EV fleets, LED media facades and sensor chimes layered over a calm electric hum.',
  },
];

/** Readonly ordered list of every EraId, derived from the registry. */
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((era) => era.id);

/** Type guard narrowing an arbitrary string to an EraId. */
export function isEraId(value: string): value is EraId {
  return (ERA_IDS as readonly string[]).includes(value);
}

/** Lookup helper for a single era specification. Throws on unknown ids. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}

/**
 * Period-appropriate synthesizer parameters per era:
 * - 1945: sparse combustion traffic, church/tram bells, big-band swing.
 * - 1965: busier mid-century streets, car horns, surf rock.
 * - 1985: heavy gridlock, sirens, bright neon buzz, synthwave.
 * - 2005: dense SUV-era traffic, air horns and digital chimes, pop rock.
 * - 2025: electric drivetrain whine, soft EV/digital chimes, ambient electronica.
 */
export const SFX_ERA_DATA: Readonly<Record<EraId, SfxEraData>> = {
  '1945': {
    id: '1945',
    ambient: {
      droneFrequencies: [58.27, 87.31, 116.54],
      droneLevel: 0.3,
      noiseLevel: 0.22,
      noiseCutoffHz: 420,
    },
    traffic: { profile: 'sparse', density: 0.18, pace: 0.55, electric: false, level: 0.55 },
    events: { kinds: ['bell', 'tramBell'], intervalSeconds: 7.5, level: 0.85 },
    music: { style: 'bigbandSwing', tempoBpm: 132, rootFrequency: 233.08, level: 0.6 },
  },
  '1965': {
    id: '1965',
    ambient: {
      droneFrequencies: [82.41, 123.47, 164.81],
      droneLevel: 0.32,
      noiseLevel: 0.28,
      noiseCutoffHz: 750,
    },
    traffic: { profile: 'moderate', density: 0.5, pace: 0.95, electric: false, level: 0.75 },
    events: { kinds: ['horn', 'tramBell'], intervalSeconds: 5.5, level: 0.9 },
    music: { style: 'surfRock', tempoBpm: 148, rootFrequency: 196.0, level: 0.65 },
  },
  '1985': {
    id: '1985',
    ambient: {
      droneFrequencies: [55, 110, 220, 329.63],
      droneLevel: 0.34,
      noiseLevel: 0.34,
      noiseCutoffHz: 1400,
    },
    traffic: { profile: 'heavy', density: 0.78, pace: 1.25, electric: false, level: 0.95 },
    events: { kinds: ['siren', 'horn'], intervalSeconds: 4.5, level: 1.0 },
    music: { style: 'synthwave', tempoBpm: 112, rootFrequency: 110.0, level: 0.7 },
  },
  '2005': {
    id: '2005',
    ambient: {
      droneFrequencies: [49, 98, 185, 246.94],
      droneLevel: 0.3,
      noiseLevel: 0.36,
      noiseCutoffHz: 1800,
    },
    traffic: { profile: 'heavy', density: 0.85, pace: 1.05, electric: false, level: 1.0 },
    events: { kinds: ['airHorn', 'digitalChime'], intervalSeconds: 3.8, level: 1.0 },
    music: { style: 'popRock', tempoBpm: 120, rootFrequency: 130.81, level: 0.68 },
  },
  '2025': {
    id: '2025',
    ambient: {
      droneFrequencies: [43.65, 87.31, 261.63, 392.0],
      droneLevel: 0.28,
      noiseLevel: 0.24,
      noiseCutoffHz: 2400,
    },
    traffic: { profile: 'electric', density: 0.6, pace: 1.0, electric: true, level: 0.7 },
    events: { kinds: ['evChime', 'digitalChime'], intervalSeconds: 6.0, level: 0.8 },
    music: { style: 'electronicAmbient', tempoBpm: 92, rootFrequency: 174.61, level: 0.62 },
  },
};
