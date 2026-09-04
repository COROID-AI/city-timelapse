// Shared era types and registry for the City Time Period Timelapse.
// Five eras are supported (matching the timeline slider requirements):
// 1945, 1965, 1985, 2005 and 2025.

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  /** Numeric year, also used as the slider label ordering. */
  year: number;
  /** Short label shown on the timeline controls. */
  label: string;
  /** One-line flavor text shown in the HUD for the selected era. */
  description: string;
}

/** Era-specific parameters used by the procedural Web Audio SFX generator. */
export interface SfxEraData {
  /** Base pitch for the ambient drone bed (Hz). */
  ambienceFreq: number;
  /** Harmonic overtone ratio for the drone (1 => pure sine, 2 => octave). */
  droneRatio: number;
  /** Ambient noise color: 0 = brown (warm, mechanical), 0.5 = pink, 1 = white. */
  noiseColor: number;
  /** Master gain of the ambient bed (0..1). */
  ambientGain: number;
  /** Traffic density 0..1: drives number of cruising vehicle voices. */
  trafficDensity: number;
  /** Mean cruising speed of traffic (Hz sweep extent) — faster in modern eras. */
  trafficSpeed: number;
  /** Engine tone rumbling depth (lower = deeper, more combustion-like). */
  engineRumble: number;
  /** One-shot event types that can fire (horn / bell / siren / chime). */
  events: SfxEventKind[];
  /** Probability per second of firing a one-shot event (0..1). */
  eventRate: number;
  /** Style key used by the mixer to build the subtle era music bed. */
  musicStyle: MusicStyle;
  /** Master gain for the music bed (0..1). */
  musicGain: number;
  /** Whether a distant siren can be heard (modern eras). */
  hasSiren: boolean;
}

export type SfxEventKind = 'horn' | 'bell' | 'siren' | 'chime';

export type MusicStyle = 'swing' | 'rock' | 'synth' | 'hiphop' | 'ambient';

export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick & mortar. Gas lamps, streetcars, victory gardens.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastels, chrome fins and the first neon signs.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete, glass towers, bright neon and boxy sedans.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Digital billboards, SUVs and LED streetscapes.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'EVs, scooters and glowing LED storefronts.',
  },
];

export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

const ERA_MAP: ReadonlyMap<EraId, EraSpec> = new Map(
  ERA_REGISTRY.map((spec) => [spec.id, spec]),
);

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_MAP.get(id);
  if (!spec) {
    // Registry is static; this is a programming error.
    throw new Error(`Unknown era id: ${id}`);
  }
  return spec;
}

/** Index of an era in the registry; 0 = 1945, 4 = 2025. */
export function eraIndex(id: EraId): number {
  return ERA_REGISTRY.findIndex((spec) => spec.id === id);
}

/** Era id nearest to a continuous float timeline position (0..4). */
export function eraAtFloat(t: number): EraId {
  const clamped = Math.min(ERA_REGISTRY.length - 1, Math.max(0, t));
  return ERA_REGISTRY[Math.round(clamped)].id;
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambienceFreq: 62,
    droneRatio: 2,
    noiseColor: 0.18,
    ambientGain: 0.55,
    trafficDensity: 0.4,
    trafficSpeed: 0.85,
    engineRumble: 0.72,
    events: ['bell', 'horn'],
    eventRate: 0.16,
    musicStyle: 'swing',
    musicGain: 0.28,
    hasSiren: false,
  },
  '1965': {
    ambienceFreq: 75,
    droneRatio: 1.5,
    noiseColor: 0.32,
    ambientGain: 0.5,
    trafficDensity: 0.6,
    trafficSpeed: 1.0,
    engineRumble: 0.6,
    events: ['horn', 'bell'],
    eventRate: 0.2,
    musicStyle: 'rock',
    musicGain: 0.3,
    hasSiren: false,
  },
  '1985': {
    ambienceFreq: 88,
    droneRatio: 1.25,
    noiseColor: 0.5,
    ambientGain: 0.6,
    trafficDensity: 0.75,
    trafficSpeed: 1.2,
    engineRumble: 0.5,
    events: ['horn', 'siren'],
    eventRate: 0.24,
    musicStyle: 'synth',
    musicGain: 0.3,
    hasSiren: true,
  },
  '2005': {
    ambienceFreq: 116,
    droneRatio: 1.4,
    noiseColor: 0.72,
    ambientGain: 0.65,
    trafficDensity: 0.9,
    trafficSpeed: 1.6,
    engineRumble: 0.38,
    events: ['horn', 'siren', 'chime'],
    eventRate: 0.26,
    musicStyle: 'hiphop',
    musicGain: 0.32,
    hasSiren: true,
  },
  '2025': {
    ambienceFreq: 132,
    droneRatio: 1.6,
    noiseColor: 0.85,
    ambientGain: 0.6,
    trafficDensity: 0.95,
    trafficSpeed: 2.0,
    engineRumble: 0.22,
    events: ['horn', 'siren', 'chime'],
    eventRate: 0.3,
    musicStyle: 'ambient',
    musicGain: 0.3,
    hasSiren: true,
  },
};