/**
 * Per-era visual palettes and constants shared by the scene modules.
 * Every property is a plain value so the scene can tween between eras
 * without allocating per-frame.
 */
import { EraId } from './eras';

export interface EraPalette {
  /** Dominant sky gradient colors (top, horizon). */
  skyTop: string;
  skyHorizon: string;
  /** Sun / moon disc color. */
  sun: string;
  /** Fog / haze color. */
  fog: string;
  /** Building facade base color. */
  building: string;
  /** Building facade accent (trim / cornices). */
  buildingAccent: string;
  /** Window glass emissive color. */
  window: string;
  /** Window emissive intensity (0..1). */
  windowIntensity: number;
  /** Road / asphalt color. */
  road: string;
  /** Sidewalk color. */
  sidewalk: string;
  /** Street lamp glow color. */
  lamp: string;
  /** Billboard / storefront text color. */
  signage: string;
  /** Vehicle body color. */
  vehicle: string;
  /** Pedestrian outfit color. */
  pedestrian: string;
  /** Roof prop color (water tower / AC / solar). */
  roofProp: string;
  /** Particle (dust / smog / neon flake) color. */
  particle: string;
  /** Building height scale multiplier. */
  buildingScale: number;
  /** Street lamp height. */
  lampHeight: number;
  /** Particle density (0..1). */
  particleDensity: number;
  /** Billboard text. */
  billboard: string;
  /** Storefront text. */
  storefront: string;
}

export const ERA_PALETTES: Record<EraId, EraPalette> = {
  '1945': {
    skyTop: '#3a3a46',
    skyHorizon: '#b07a4a',
    sun: '#d8a26a',
    fog: '#c8b090',
    building: '#8a5a4a',
    buildingAccent: '#6e4a3a',
    window: '#d8a26a',
    windowIntensity: 0.35,
    road: '#3a3a3a',
    sidewalk: '#6b6b6b',
    lamp: '#d8a26a',
    signage: '#c8a020',
    vehicle: '#5a4a3a',
    pedestrian: '#4a5a3a',
    roofProp: '#5a4a3a',
    particle: '#c8b090',
    buildingScale: 0.7,
    lampHeight: 3.2,
    particleDensity: 0.25,
    billboard: 'WAR BONDS',
    storefront: '5¢ Diner',
  },
  '1965': {
    skyTop: '#2a3a4a',
    skyHorizon: '#c8a878',
    sun: '#e8c878',
    fog: '#d8c8a8',
    building: '#7a8a9a',
    buildingAccent: '#5a6a7a',
    window: '#e8c878',
    windowIntensity: 0.5,
    road: '#3a3a3a',
    sidewalk: '#7a7a7a',
    lamp: '#e8c878',
    signage: '#e04040',
    vehicle: '#6a8a9a',
    pedestrian: '#8a6a5a',
    roofProp: '#6a6a6a',
    particle: '#d8c8a8',
    buildingScale: 0.85,
    lampHeight: 3.6,
    particleDensity: 0.2,
    billboard: 'COCA-COLA',
    storefront: 'Diner',
  },
  '1985': {
    skyTop: '#1a1a2a',
    skyHorizon: '#6a4a8a',
    sun: '#e0a0a0',
    fog: '#8a6a8a',
    building: '#5a6a7a',
    buildingAccent: '#3a4a5a',
    window: '#e0a0a0',
    windowIntensity: 0.7,
    road: '#3a3a3a',
    sidewalk: '#6a6a6a',
    lamp: '#e0a0a0',
    signage: '#e040a0',
    vehicle: '#8a4a5a',
    pedestrian: '#6a8a9a',
    roofProp: '#5a6a7a',
    particle: '#e0a0a0',
    buildingScale: 1.0,
    lampHeight: 4.0,
    particleDensity: 0.3,
    billboard: 'NEON NIGHTS',
    storefront: 'Arcade',
  },
  '2005': {
    skyTop: '#1a2a3a',
    skyHorizon: '#4a5a6a',
    sun: '#c8c8d8',
    fog: '#5a6a7a',
    building: '#4a5a6a',
    buildingAccent: '#2a3a4a',
    window: '#c8d8e8',
    windowIntensity: 0.85,
    road: '#2a2a2a',
    sidewalk: '#5a5a5a',
    lamp: '#d8e8f8',
    signage: '#20c0e0',
    vehicle: '#3a4a5a',
    pedestrian: '#4a5a6a',
    roofProp: '#5a6a7a',
    particle: '#c8d8e8',
    buildingScale: 1.15,
    lampHeight: 4.4,
    particleDensity: 0.2,
    billboard: 'APPLE',
    storefront: 'Cafe',
  },
  '2025': {
    skyTop: '#0a1a2a',
    skyHorizon: '#3a4a5a',
    sun: '#d8e8f8',
    fog: '#4a5a6a',
    building: '#3a4a5a',
    buildingAccent: '#1a2a3a',
    window: '#e8f8ff',
    windowIntensity: 1.0,
    road: '#2a2a2a',
    sidewalk: '#4a4a4a',
    lamp: '#c8f0ff',
    signage: '#00e0e0',
    vehicle: '#2a3a4a',
    pedestrian: '#3a4a5a',
    roofProp: '#4a6a5a',
    particle: '#c8f0ff',
    buildingScale: 1.3,
    lampHeight: 4.8,
    particleDensity: 0.35,
    billboard: 'NEXUS AI',
    storefront: 'EV Cafe',
  },
};

export function getPalette(era: EraId): EraPalette {
  return ERA_PALETTES[era];
}