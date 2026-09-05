/**
 * Shared era types, registry, and the audio mood registry.
 *
 * This module is the single source of truth for era identities:
 * - the README timeline runs six eras 1945–2055, so the registry below
 *   includes `'2055'` and both the scene/a11y timeline and the audio manager
 *   get a channel for every timeline position;
 * - the era-audio tasks wire the mood descriptors here to actual sound
 *   sources; the procedural generators in `src/audio/sfx.ts` turn the numeric
 *   profiles into AudioBuffers, and `src/audio/mixer.ts` crossfades the
 *   per-era channels.
 *
 * The branch helpers (`isEraId`, `eraIndex`) are used for runtime validation
 * of untrusted era values on the `era-change` event channel.
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export const ERA_IDS = [
  '1945',
  '1965',
  '1985',
  '2005',
  '2025',
  '2055',
] as const satisfies readonly EraId[]

export interface EraSpec {
  id: EraId
  year: number
  label: string
  description: string
}

export const ERA_REGISTRY = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Brick streets and sepia light; gas lamps, trolleys and victory-garden quiet.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Pastel storefronts, chrome classics, neon tubes and transistor radios.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Glass towers, sodium lamps, boxy traffic and boomboxes on the sidewalk.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'LED billboards and SUVs; ring tones and congestion build.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'EVs, e-scooters, LED screens, cell chatter and delivery drones.',
  },
  {
    id: '2055',
    year: 2055,
    label: '2055',
    description: 'Holographic ads, flying drone traffic, glowing architecture in teal and cyan.',
  },
] as const satisfies readonly EraSpec[]

const ERA_INDEX: ReadonlyMap<EraId, number> = new Map(
  ERA_IDS.map((id, index) => [id, index]),
)

const ERA_BY_ID: ReadonlyMap<EraId, EraSpec> = new Map(
  ERA_REGISTRY.map((spec) => [spec.id, spec]),
)

/** Type guard for runtime validation of unknown era values. */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'string' && ERA_IDS.some((id) => id === value)
}

/** Look up the spec for an era id. Throws for unknown ids. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_BY_ID.get(id)
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`)
  }
  return spec
}

/** 0-based position of an era within the ordered registry. Throws for unknown ids. */
export function eraIndex(id: EraId): number {
  const index = ERA_INDEX.get(id)
  if (index === undefined) {
    throw new Error(`Unknown era id: ${String(id)}`)
  }
  return index
}

export type NoiseColor = 'brown' | 'pink' | 'white'

export type SfxEventKind =
  | 'horn'
  | 'siren'
  | 'bell'
  | 'chatter'
  | 'crowd'
  | 'horse'
  | 'scooter'
  | 'drone'

export interface SfxEventSpec {
  kind: SfxEventKind
  /** expected occurrences per minute used by the event scheduler */
  ratePerMinute: number
  /** peak one-shot gain, 0..1 */
  gain: number
}

/**
 * Period-specific profile used to synthesize one era's ambience channel.
 * All gains are 0..1 and feed linear/exponential ramps only — the audio
 * manager never applies abrupt level jumps to these values.
 */
export interface SfxEraData {
  era: EraId
  year: number
  /** human-readable mood descriptors, e.g. "distant steam hiss", "dense traffic" */
  mood: string[]
  ambient: {
    /** filtered noise bed level, 0..1 */
    gain: number
    /** noise colour for the filtered bed */
    noiseColor: NoiseColor
    /** low tonal drone frequency (Hz); harmonics are derived from it */
    droneHz: number
    /** tonal drone level, 0..1 */
    droneGain: number
  }
  traffic: {
    /** 0..1 density; raises engine brightness and event weight */
    density: number
    /** traffic loop level, 0..1 */
    gain: number
    /** engine rumble band, low/high (Hz) */
    engineHz: [number, number]
  }
  events: SfxEventSpec[]
  music: {
    /** descriptor only; downstream era-audio tasks wire actual music sources */
    style: string
    /** music routing level, 0..1 */
    gain: number
  }
}

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    era: '1945',
    year: 1945,
    mood: ['distant steam hiss', 'sparse traffic', 'clopping hooves', 'tinny radio jazz'],
    ambient: { gain: 0.5, noiseColor: 'brown', droneHz: 62, droneGain: 0.14 },
    traffic: { density: 0.15, gain: 0.3, engineHz: [48, 110] },
    events: [
      { kind: 'horn', ratePerMinute: 0.5, gain: 0.3 },
      { kind: 'horse', ratePerMinute: 0.9, gain: 0.4 },
      { kind: 'bell', ratePerMinute: 0.5, gain: 0.25 },
      { kind: 'crowd', ratePerMinute: 0.4, gain: 0.18 },
    ],
    music: { style: '1940s swing / radio jazz', gain: 0.22 },
  },
  '1965': {
    era: '1965',
    year: 1965,
    mood: ['neon tube hum', 'lazy mid-day traffic', 'transistor radio pop', 'ice cream truck bell'],
    ambient: { gain: 0.55, noiseColor: 'pink', droneHz: 100, droneGain: 0.16 },
    traffic: { density: 0.35, gain: 0.35, engineHz: [55, 130] },
    events: [
      { kind: 'horn', ratePerMinute: 0.7, gain: 0.32 },
      { kind: 'bell', ratePerMinute: 0.7, gain: 0.3 },
      { kind: 'chatter', ratePerMinute: 0.5, gain: 0.22 },
      { kind: 'crowd', ratePerMinute: 0.5, gain: 0.2 },
    ],
    music: { style: 'mid-century pop / surf rock', gain: 0.22 },
  },
  '1985': {
    era: '1985',
    year: 1985,
    mood: ['sodium lamp buzz', 'dense traffic', 'boombox hip-hop', 'distant sirens'],
    ambient: { gain: 0.6, noiseColor: 'pink', droneHz: 120, droneGain: 0.17 },
    traffic: { density: 0.62, gain: 0.42, engineHz: [60, 150] },
    events: [
      { kind: 'horn', ratePerMinute: 1.2, gain: 0.36 },
      { kind: 'siren', ratePerMinute: 0.5, gain: 0.3 },
      { kind: 'chatter', ratePerMinute: 1.0, gain: 0.26 },
      { kind: 'crowd', ratePerMinute: 0.7, gain: 0.24 },
    ],
    music: { style: 'synth-pop / boombox hip-hop', gain: 0.2 },
  },
  '2005': {
    era: '2005',
    year: 2005,
    mood: ['congested traffic', 'ring tones', 'digital billboard hum', 'café chatter'],
    ambient: { gain: 0.62, noiseColor: 'white', droneHz: 90, droneGain: 0.1 },
    traffic: { density: 0.8, gain: 0.5, engineHz: [65, 170] },
    events: [
      { kind: 'horn', ratePerMinute: 1.6, gain: 0.38 },
      { kind: 'siren', ratePerMinute: 0.6, gain: 0.32 },
      { kind: 'chatter', ratePerMinute: 1.4, gain: 0.3 },
      { kind: 'crowd', ratePerMinute: 0.9, gain: 0.26 },
    ],
    music: { style: '00s pop / ring tone accents', gain: 0.16 },
  },
  '2025': {
    era: '2025',
    year: 2025,
    mood: ['dense traffic', 'cell chatter', 'e-scooter buzz', 'delivery drone overpass'],
    ambient: { gain: 0.6, noiseColor: 'white', droneHz: 45, droneGain: 0.12 },
    traffic: { density: 0.95, gain: 0.52, engineHz: [70, 190] },
    events: [
      { kind: 'chatter', ratePerMinute: 2.0, gain: 0.32 },
      { kind: 'scooter', ratePerMinute: 1.2, gain: 0.34 },
      { kind: 'drone', ratePerMinute: 0.9, gain: 0.3 },
      { kind: 'horn', ratePerMinute: 0.8, gain: 0.3 },
    ],
    music: { style: 'contemporary pop / street beats', gain: 0.14 },
  },
  '2055': {
    era: '2055',
    year: 2055,
    mood: ['hologram hum', 'drone traffic overhead', 'electric glide traffic', 'ambient cityscape synth'],
    ambient: { gain: 0.58, noiseColor: 'pink', droneHz: 55, droneGain: 0.18 },
    traffic: { density: 0.7, gain: 0.4, engineHz: [80, 220] },
    events: [
      { kind: 'drone', ratePerMinute: 1.6, gain: 0.34 },
      { kind: 'chatter', ratePerMinute: 1.2, gain: 0.28 },
      { kind: 'siren', ratePerMinute: 0.3, gain: 0.28 },
      { kind: 'horn', ratePerMinute: 0.4, gain: 0.26 },
    ],
    music: { style: 'ambient synthwave / holographic ads', gain: 0.18 },
  },
}