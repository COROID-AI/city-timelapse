/**
 * Shared era contracts for the City Era Timelapse.
 *
 * This module is the single source of truth for era identities and content
 * shapes. Every later module (buildings, vehicles, storefronts, pedestrians,
 * ambience, audio) imports from here instead of redefining era shapes.
 */

/** Ordered timeline stops, oldest to newest. */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Selectable timeline era identifier. */
export type EraId = (typeof ERA_IDS)[number];

/** Number of timeline stops. */
export const ERA_COUNT: number = ERA_IDS.length;

/** Hexadecimal color literal such as `#rrggbb`. */
export type HexColor = string;

/** Rooftop dressing that dates a skyline silhouette. */
export type RoofPropKind =
  | 'water-tower'
  | 'chimney'
  | 'wooden-billboard'
  | 'ac-unit'
  | 'satellite-dish'
  | 'antenna'
  | 'solar-panel'
  | 'roof-garden';

/** Stylized vehicle silhouettes available to era scenes. */
export type VehicleKind =
  | 'vintage-sedan'
  | 'chrome-cruiser'
  | 'boxy-wagon'
  | 'family-suv'
  | 'ev-capsule';

/** Procedural window facade parameters. */
export interface WindowGridSpec {
  readonly columns: number;
  readonly rows: number;
  /** Fraction of windows that appear lit (0..1). */
  readonly litRatio: number;
  readonly emissiveColor: HexColor;
}

/** Building massing and facade rules for one era. */
export interface BuildingSpec {
  readonly facadePalette: readonly HexColor[];
  readonly minHeightMeters: number;
  readonly maxHeightMeters: number;
  readonly windows: WindowGridSpec;
  readonly roofProps: readonly RoofPropKind[];
}

/** Vehicle fleet mix for one era. */
export interface VehicleSpec {
  readonly kinds: readonly VehicleKind[];
  readonly paintPalette: readonly HexColor[];
  /** Multiplier against the baseline number of vehicles per lane. */
  readonly density: number;
  /** Multiplier against the baseline cruise speed. */
  readonly speedScale: number;
}

/** Street-level retail identity for one era. */
export interface StorefrontSpec {
  readonly names: readonly string[];
  readonly awningPalette: readonly HexColor[];
  /** Signage emissive intensity multiplier. */
  readonly signageGlow: number;
}

/** Copy painted onto one billboard or sign. */
export interface BillboardCopy {
  readonly text: string;
  readonly inkColor: HexColor;
  readonly glowColor: HexColor;
  /** Digital signs blink or scroll; painted signs stay static. */
  readonly animated: boolean;
}

/** Advertising layer for one era. */
export interface AdvertisementSpec {
  readonly billboards: readonly BillboardCopy[];
  /** Overall billboard emissive multiplier. */
  readonly glowIntensity: number;
}

/** Pedestrian crowd rules for one era. */
export interface PedestrianSpec {
  readonly outfitPalette: readonly HexColor[];
  /** Multiplier against the baseline sidewalk population. */
  readonly density: number;
  /** Multiplier against the baseline walking speed. */
  readonly walkSpeed: number;
}

/** Atmospheric particle mood rendered over the block. */
export type ParticleMood = 'clear' | 'coal-smoke' | 'dust' | 'smog';

/** Evolution stage for street lamps. */
export type StreetLampStyle =
  | 'gas-lamp'
  | 'cobra-neon'
  | 'sodium-vapor'
  | 'metal-halide'
  | 'led-smart';

/** Sky, sun, fog and street-light character of one era. */
export interface AmbienceSpec {
  readonly skyZenith: HexColor;
  readonly skyHorizon: HexColor;
  readonly sunColor: HexColor;
  readonly sunIntensity: number;
  readonly ambientColor: HexColor;
  readonly ambientIntensity: number;
  readonly fogColor: HexColor;
  readonly fogDensity: number;
  readonly particles: ParticleMood;
  readonly streetLamps: StreetLampStyle;
}

/** Background traffic character fed to the SFX mixer. */
export type TrafficProfile =
  | 'wartime-rationed'
  | 'postwar-boom'
  | 'gridlock'
  | 'commuter-flow'
  | 'electric-hum';

/** One-shot stingers mixed above the traffic bed. */
export type SfxEventKind =
  | 'vintage-horn'
  | 'streetcar-bell'
  | 'car-horn'
  | 'distant-siren'
  | 'ev-chime';

/** Period music flavor played quietly behind the ambience. */
export type MusicStyle =
  | 'radio-jazz'
  | 'surf-rock'
  | 'synth-pop'
  | 'ringtone-pop'
  | 'streaming-lofi';

/** Procedural SFX recipe for one era. */
export interface SfxSpec {
  /** Ambient drone partials in Hz. */
  readonly ambientDroneHz: readonly number[];
  readonly ambientGain: number;
  readonly trafficProfile: TrafficProfile;
  readonly events: readonly SfxEventKind[];
  /** Random delay range in seconds between event one-shots. */
  readonly eventIntervalSeconds: readonly [min: number, max: number];
  readonly musicStyle: MusicStyle;
  readonly masterGain: number;
}

/**
 * Complete content contract for a single timeline era. Every visual and audio
 * module derives its era behavior from these descriptors.
 */
export interface EraContent {
  readonly id: EraId;
  readonly label: string;
  readonly description: string;
  readonly buildings: BuildingSpec;
  readonly vehicles: VehicleSpec;
  readonly storefronts: StorefrontSpec;
  readonly advertisements: AdvertisementSpec;
  readonly pedestrians: PedestrianSpec;
  readonly ambience: AmbienceSpec;
  readonly sfx: SfxSpec;
}

/** Type guard for arbitrary runtime values arriving from UI or storage. */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'string' && (ERA_IDS as readonly string[]).includes(value);
}

/** Zero-based position of an era on the timeline slider. */
export function getEraIndex(id: EraId): number {
  return ERA_IDS.indexOf(id);
}
