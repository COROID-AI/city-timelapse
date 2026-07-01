export const YEARS = [1945, 1965, 1985, 2005, 2025] as const;
export type PeriodYear = (typeof YEARS)[number];
export type Era = PeriodYear;

export type BuildingType = 'residential' | 'commercial' | 'office';
export type VehicleVariant = 'car' | 'truck';
export type OutfitStyle = 'civilian40s' | 'midcentury' | 'neon80s' | 'glass2000s' | 'smartFuture';

export interface EraPalette {
  sky: string;
  skyTop: string;
  sun: string;
  ground: string;
  fog: string;
}

export interface EraBuildingStyle {
  /** wall base color */
  wall: string;
  /** roof color */
  roof: string;
  /** window pane color (lit) */
  window: string;
  /** trim / mullion color */
  trim: string;
  /** facade pattern identifier consumed by the texture builder */
  facade: 'wood' | 'brick' | 'concrete' | 'glass' | 'parametric';
  heightRange: [number, number];
}

export interface EraVehicleStyle {
  body: string;
  trim: string;
  roof: string;
  shape: 'vintage' | 'chrome' | 'boxy' | 'hatchback' | 'ev';
}

export interface EraOutfitStyle {
  torso: string;
  legs: string;
  hair: string;
  skin: string;
}

export interface EraStorefront {
  sign: string;
  bg: string;
  fg: string;
  /** neon glow color, or null when not lit */
  glow: string | null;
}

export interface EraProp {
  kind: 'lamp_wood' | 'lamp_steel' | 'neon_sign' | 'phone_kiosk' | 'hologram' | 'newsbox' | 'planter';
  color: string;
}

export interface EraAudioProfile {
  /** base tempo (BPM) of the procedural music loop */
  bpm: number;
  /** root scale degrees (semitone offsets from a base note) */
  scale: number[];
  /** synth waveform for the lead */
  lead: OscillatorType;
  /** bass waveform */
  bass: OscillatorType;
  /** ambient soundscape descriptor */
  ambience: 'distant_trains' | 'traffic_hum' | 'arcade_blips' | 'soft_city' | 'quiet_future';
}

export interface EraDefinition {
  year: PeriodYear;
  label: string;
  palette: EraPalette;
  buildings: Record<BuildingType, EraBuildingStyle>;
  vehicles: EraVehicleStyle[];
  outfits: EraOutfitStyle[];
  storefronts: EraStorefront[];
  props: EraProp[];
  audio: EraAudioProfile;
}

export function eraIndex(year: PeriodYear): number {
  return YEARS.indexOf(year);
}

export function nextYear(year: PeriodYear): PeriodYear {
  const i = eraIndex(year);
  return YEARS[Math.min(i + 1, YEARS.length - 1)] ?? year;
}

export function prevYear(year: PeriodYear): PeriodYear {
  const i = eraIndex(year);
  return YEARS[Math.max(i - 1, 0)] ?? year;
}
