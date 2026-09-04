/**
 * Shared era types and registry for the City Time Period Timelapse.
 * The timeline slider drives the scene through these eras; every module
 * (buildings, vehicles, pedestrians, storefronts, audio) reads from here.
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

export interface SfxEraData {
  /**
   * Per-era ambient parameters used by the procedural audio generator.
   * All values are plain numbers so they can be tweened by the mixer.
   */
  baseFrequency: number; // Hz of the tonal drone
  droneGain: number; // 0..1 amplitude of the tonal drone
  noiseGain: number; // 0..1 amplitude of the filtered noise bed
  noiseLowpass: number; // Hz lowpass for the noise bed
  trafficDensity: number; // 0..1 amount of vehicle loops in the mix
  windAmount: number; // 0..1 high-frequency airy component
  /** Named one-shot event types ('horn' | 'bell' | 'siren' | 'tick'). */
  events: SfxEventType[];
  /** Dominant period mood used for music synth. */
  musicStyle: 'none' | 'jazz' | 'synthwave' | 'house' | 'chill';
  /** Short human description shown in the help drawer. */
  moodLabel: string;
}

export type SfxEventType = 'horn' | 'bell' | 'siren' | 'tick';

/** Ordered registry of all supported eras, oldest first. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description:
      'Post-war brick city — sepia dusk, gas lamps, vintage automobiles and doo-wop radio.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description:
      'Mid-century pastels — chrome cars, early neon, jazz on the corner and big-finned fins.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description:
      'Concrete and glass — boxy sedans, bright neon, synthwave streets at night.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description:
      'Modern glass towers — SUVs, digital billboards, thumping downtown beats.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description:
      'Contemporary city — EVs, scooters, LED screens and a quiet ambient hum.',
  },
];

/** Read-only list of era ids in slider order. */
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((era) => era.id);

/** Index of an era id, or -1 when unknown. */
export function eraIndexOf(id: EraId): number {
  return ERA_REGISTRY.findIndex((era) => era.id === id);
}

/** Lookup helper for era specs; throws on unknown ids so wiring errors surface fast. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}

/** Lookup that returns a fallback instead of throwing (UI-safe). */
export function getEraSpecOr(id: EraId, fallback: EraSpec = ERA_REGISTRY[0]): EraSpec {
  return ERA_REGISTRY.find((era) => era.id === id) ?? fallback;
}

/**
 * Era-specific sound parameters. These feed the procedural generator and
 * drive the mixer crossfade; every value is distinct per decade so the
 * acoustic landscape changes with the skyline.
 */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    baseFrequency: 55,
    droneGain: 0.4,
    noiseGain: 0.5,
    noiseLowpass: 420,
    trafficDensity: 0.18,
    windAmount: 0.15,
    events: ['bell', 'horn'],
    musicStyle: 'none',
    moodLabel: 'Quiet post-war streets — distant bells, trolley noise, dust.',
  },
  '1965': {
    baseFrequency: 82,
    droneGain: 0.32,
    noiseGain: 0.42,
    noiseLowpass: 900,
    trafficDensity: 0.4,
    windAmount: 0.2,
    events: ['horn', 'bell'],
    musicStyle: 'jazz',
    moodLabel: 'Mid-century hum — car horns, church bells, a corner jazz band.',
  },
  '1985': {
    baseFrequency: 61,
    droneGain: 0.3,
    noiseGain: 0.55,
    noiseLowpass: 1500,
    trafficDensity: 0.6,
    windAmount: 0.3,
    events: ['siren', 'horn'],
    musicStyle: 'synthwave',
    moodLabel: 'Neon night — sirens in the distance, synthwave pulse.',
  },
  '2005': {
    baseFrequency: 98,
    droneGain: 0.28,
    noiseGain: 0.45,
    noiseLowpass: 2200,
    trafficDensity: 0.75,
    windAmount: 0.35,
    events: ['horn', 'bell'],
    musicStyle: 'house',
    moodLabel: 'Busy downtown — crosswalks, horns, electronic beats.',
  },
  '2025': {
    baseFrequency: 132,
    droneGain: 0.25,
    noiseGain: 0.4,
    noiseLowpass: 3200,
    trafficDensity: 0.85,
    windAmount: 0.45,
    events: ['tick', 'horn'],
    musicStyle: 'chill',
    moodLabel: 'Contemporary electric bloc — quiet tick, EV whir, ambient synth.',
  },
};