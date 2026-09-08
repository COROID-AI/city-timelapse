/**
 * Per-era vehicle fleet & traffic: traffic behaviour helpers.
 *
 * Pure functions that derive era-scaled traffic behaviour (density, electric
 * share, headlamp colour, audible engine level) from the shared era registry.
 * The composition layer calls these to drive the fleet and the audio traffic
 * bed coherently during era transitions.
 */

import type { EraData } from '../eras/index.js';

/** Average traffic density on the block (0..1). */
export function eraTrafficDensity(era: EraData): number {
  return era.vehicles.trafficDensity;
}

/** Share of the fleet that is electric / quiet (0..1). */
export function eraElectricRatio(era: EraData): number {
  return era.vehicles.electricRatio;
}

/** Headlamp colour: 0 warm tungsten .. 1 cool white/LED. */
export function eraHeadlightCool(era: EraData): number {
  return era.vehicles.headlightCool;
}

/** Audible engine / exhaust level (0..1). */
export function eraEngineNoise(era: EraData): number {
  return era.vehicles.engineNoise;
}