import type { EraId } from '../eras.js';

// ── Pedestrian spec per era ───────────────────────────────────────────

/** Density tier relative to other eras */
export type DensityTier = 'modest' | 'busy' | 'dense' | 'moderate';

/** Walking-speed range in meters per second */
export interface SpeedRange { min: number; max: number }

/** Outfit roster entry — one visual variant an individual can pick */
export interface OutfitRosterEntry {
  /** Human-readable label (used for debugging) */
  label: string;
  /** Whether this is a gender-neutral fallback */
  neutral?: boolean;
}

/** Full spec for one era's pedestrian crowd */
export interface PedestrianEraSpec {
  eraId: EraId;
  /** Target crowd count (number of pedestrian instances) */
  count: number;
  density: DensityTier;
  /** Walking speed range in m/s */
  speedRange: SpeedRange;
  /** Whether e-scooter riders appear (2025 only) */
  hasScooterRiders: boolean;
  /** Roster of outfit variants available per individual */
  outfitRoster: OutfitRosterEntry[];
  /** Prop types available for standing / talking clusters */
  clusterProps: string[];
}

// ── Registry ──────────────────────────────────────────────────────────

export const PEDESTRIAN_SPECS: Record<EraId, PedestrianEraSpec> = {
  '1945': {
    eraId: '1945',
    count: 12,
    density: 'modest',
    speedRange: { min: 0.8, max: 1.4 },
    hasScooterRiders: false,
    outfitRoster: [
      { label: 'Man in suit + fedora' },
      { label: 'Man in overcoat + bowler' },
      { label: 'Woman in A-line dress + hat' },
      { label: 'Woman in wool coat + scarf' },
      { label: 'Man in military uniform' },
      { label: 'Woman in apron dress' },
    ],
    clusterProps: ['newspaper', 'briefcase', 'parasol'],
  },
  '1965': {
    eraId: '1965',
    count: 20,
    density: 'busy',
    speedRange: { min: 1.0, max: 1.7 },
    hasScooterRiders: false,
    outfitRoster: [
      { label: 'Man in suit + skinny tie' },
      { label: 'Woman in mod mini-dress' },
      { label: 'Man in turtleneck + slacks' },
      { label: 'Woman in bold-print shift dress' },
      { label: 'Man in blazer + narrow lapels' },
      { label: 'Woman in go-go boots + A-line' },
    ],
    clusterProps: ['flower_power_badge', 'camera', 'vinyl_record'],
  },
  '1985': {
    eraId: '1985',
    count: 28,
    density: 'dense',
    speedRange: { min: 1.1, max: 1.8 },
    hasScooterRiders: false,
    outfitRoster: [
      { label: 'Man in denim jacket + jeans' },
      { label: 'Woman in tracksuit' },
      { label: 'Man in windbreaker + leg warmers' },
      { label: 'Woman in big-hair neon outfit' },
      { label: 'Man in leather jacket + band tee' },
      { label: 'Woman in shoulder-pad blazer' },
    ],
    clusterProps: ['boombox', 'cassette_tape', 'spray_can'],
  },
  '2005': {
    eraId: '2005',
    count: 26,
    density: 'dense',
    speedRange: { min: 1.0, max: 1.6 },
    hasScooterRiders: false,
    outfitRoster: [
      { label: 'Man in low-rise jeans + graphic tee' },
      { label: 'Woman in cargo pants + tank top' },
      { label: 'Man in hoodie + baggy jeans' },
      { label: 'Woman in velour tracksuit' },
      { label: 'Man in flannel + chucks' },
      { label: 'Woman in butterfly clip + jean jacket' },
    ],
    clusterProps: ['flip_phone', 'discman', 'polaroid_camera'],
  },
  '2025': {
    eraId: '2025',
    count: 18,
    density: 'moderate',
    speedRange: { min: 0.9, max: 1.5 },
    hasScooterRiders: true,
    outfitRoster: [
      { label: 'Person in athleisure set' },
      { label: 'Person in down jacket + beanie' },
      { label: 'Delivery worker with backpack' },
      { label: 'Person in oversized hoodie' },
      { label: 'Woman in puffer vest + leggings' },
      { label: 'Man in tech fleece + smartwatch' },
    ],
    clusterProps: ['smartphone_in_hand', 'delivery_backpack', 'laptop_bag'],
  },
} as const;

/** Return spec for a given era ID */
export function getPedestrianSpec(eraId: EraId): PedestrianEraSpec {
  const spec = PEDESTRIAN_SPECS[eraId];
  if (!spec) throw new Error(`Unknown era for pedestrians: ${eraId}`);
  return spec;
}
