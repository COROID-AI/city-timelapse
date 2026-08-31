/**
 * Shared era types and registry.
 *
 * The scene timeline offers five periods: 1945, 1965, 1985, 2005, 2025.
 * Every aspect of the block (facades, vehicles, storefronts, ads, outfits,
 * lights, audio) interpolates between the specs in ERA_REGISTRY.
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  readonly id: EraId;
  /** Display year. */
  readonly year: number;
  /** Short label shown on the timeline. */
  readonly label: string;
  /** One-line description shown in the HUD. */
  readonly description: string;
}

export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick & sepia. Victory gardens, gas lamps, trolleys.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastels, chrome tailfins, coffee-shop neon.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete & glass, boxy sedans, arcade glow and sodium lamps.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Modern glass, SUVs, digital billboards, LED lighting.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'EVs, scooters, smart signage, rooftop greenery and cooler LEDs.',
  },
];

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${id}`);
  }
  return spec;
}

/**
 * Continuous activation weight for an era-tagged object (vehicle, rooftop
 * prop). Returns 1 while `eraIndex` sits inside the object's era window and
 * fades to 0 across a half-index band at each edge, so items never pop in or
 * out while the eased transition is mid-flight.
 */
export function eraRangeWeight(eraIndex: number, eras: readonly EraId[]): number {
  if (eras.length === 0) return 0;
  let minIdx = ERA_IDS.length;
  let maxIdx = -1;
  for (const id of eras) {
    const idx = ERA_IDS.indexOf(id);
    if (idx < 0) continue;
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
  }
  if (maxIdx < minIdx) return 0;
  const inEdge = Math.min(1, Math.max(0, (eraIndex - minIdx + 0.5) * 2));
  const outEdge = Math.min(1, Math.max(0, (maxIdx + 0.5 - eraIndex) * 2));
  return Math.min(inEdge, outEdge);
}

/**
 * Period-appropriate sound parameters used by the procedural SFX generator.
 */
export interface SfxEraData {
  readonly ambient: {
    /** Base noise-bed (wind, city hum) gain. */
    readonly gain: number;
    /** Low cutoff of the filtered noise bed, Hz. */
    readonly lowFreq: number;
    /** High cutoff of the filtered noise bed, Hz. */
    readonly highFreq: number;
    /** Sub-bass rumble gain (engines, industrial background). */
    readonly rumbleGain: number;
  };
  readonly traffic: {
    /** Traffic loop gain. */
    readonly gain: number;
    /** Engine drone fundamental, Hz. */
    readonly engineHz: number;
    /** Higher traffic hum frequency, Hz. */
    readonly humHz: number;
  };
  /** One-shot ambient event types played on a timer. */
  readonly eventTypes: readonly EventTypeId[];
  /** Background music style (optional). */
  readonly music?: readonly MusicStyleId[];
}

export type EventTypeId =
  | 'horn'
  | 'bell'
  | 'siren'
  | 'coin'
  | 'bounce'
  | 'chime'
  | 'message'
  | 'drone'
  | 'tick'
  | 'whoosh';

export type MusicStyleId =
  | 'swing'
  | 'country'
  | 'synth'
  | 'electronica'
  | 'ambient';

export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambient: { gain: 0.55, lowFreq: 180, highFreq: 900, rumbleGain: 0.2 },
    traffic: { gain: 0.4, engineHz: 55, humHz: 180 },
    eventTypes: ['bell', 'horn', 'bounce', 'coin'],
    music: ['swing'],
  },
  '1965': {
    ambient: { gain: 0.5, lowFreq: 220, highFreq: 1400, rumbleGain: 0.22 },
    traffic: { gain: 0.42, engineHz: 65, humHz: 220 },
    eventTypes: ['horn', 'bell', 'coin', 'chime'],
    music: ['country'],
  },
  '1985': {
    ambient: { gain: 0.48, lowFreq: 260, highFreq: 2400, rumbleGain: 0.26 },
    traffic: { gain: 0.46, engineHz: 75, humHz: 300 },
    eventTypes: ['tick', 'drone', 'horn', 'siren'],
    music: ['synth'],
  },
  '2005': {
    ambient: { gain: 0.45, lowFreq: 320, highFreq: 3600, rumbleGain: 0.3 },
    traffic: { gain: 0.5, engineHz: 85, humHz: 420 },
    eventTypes: ['message', 'whoosh', 'horn', 'chime'],
    music: ['electronica'],
  },
  '2025': {
    ambient: { gain: 0.42, lowFreq: 380, highFreq: 4800, rumbleGain: 0.34 },
    traffic: { gain: 0.52, engineHz: 100, humHz: 560 },
    eventTypes: ['whoosh', 'message', 'drone', 'chime'],
    music: ['ambient'],
  },
};