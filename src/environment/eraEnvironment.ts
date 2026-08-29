/**
 * Per-era environment payload lookup for the environment subsystem.
 *
 * The four authored era datasets (1945–2005) carry an `EraEnvironment`
 * payload; 2025 is not yet authored as a full `TimeEra` dataset, so this
 * module supplies a local fallback payload that matches the shared
 * `EraEnvironment` contract (crisp clear sky, LED lighting, clean air).
 * Subsystems consume payloads through `getEnvironmentForEra()` so they never
 * depend on which datasets have been authored.
 */
import type { EraEnvironment, EraId } from '../engine/eras';
import { getEraData } from '../data/eras';

/** Fallback 2025 environment payload (crisp clear, LED, clean air). */
const ERA_2025_ENVIRONMENT: EraEnvironment = {
  timeOfDay: 'day',
  weather: 'crisp clear air with a bright blue sky',
  grading: 'crisp-clear',
  skyColor: { r: 0.3, g: 0.52, b: 0.78 },
  horizonColor: { r: 0.8, g: 0.86, b: 0.9 },
  fogColor: { r: 0.78, g: 0.84, b: 0.88 },
  fogStart: 30,
  fogEnd: 110,
  haze: {
    color: { r: 0.85, g: 0.88, b: 0.9 },
    density: 0.04,
    particleCount: 12,
  },
  streetlights: {
    color: { r: 0.92, g: 0.95, b: 1.0 },
    poolColor: { r: 0.7, g: 0.78, b: 0.95 },
    intensity: 0.7,
  },
  sun: {
    color: { r: 1.0, g: 0.98, b: 0.93 },
    intensity: 1.4,
    elevationDeg: 60,
    azimuthDeg: 140,
  },
  ambientIntensity: 0.72,
};

/** Fallback payloads for eras without an authored dataset yet. */
const FALLBACK_ENVIRONMENTS: Partial<Record<EraId, EraEnvironment>> = {
  '2025': ERA_2025_ENVIRONMENT,
};

/**
 * Returns the environment payload for an era: the authored dataset's payload
 * when available, otherwise the era's local fallback. Throws only when an
 * era has neither an authored dataset nor a fallback.
 */
export function getEnvironmentForEra(era: EraId): EraEnvironment {
  const fromData = getEraData(era)?.environment;
  if (fromData) {
    return fromData;
  }
  const fallback = FALLBACK_ENVIRONMENTS[era];
  if (!fallback) {
    throw new Error(`No environment payload for era ${era}.`);
  }
  return fallback;
}