/**
 * Per-era atmosphere data for the City Time Period Timelapse.
 *
 * This module is the authoritative atmosphere dataset aggregated by
 * compose-scene-app's `eraEnvironment`. It mirrors the canonical
 * `AtmosphereEraSpec` values held in the era registry (so there is a single
 * source of truth for sky/sun/fog/lamp numbers) and adds the extended
 * atmosphere-only fields the atmosphere system needs:
 *
 * - ambient particle styles (soot/smog motes vs clear-air sparkle),
 * - the 2025 festive string lights between lamp anchors,
 * - directional shadow tuning for the key light,
 * - an emissive bloom factor that keeps lamps/windows/signs bloom-friendly,
 * - an air-quality (poll) index for era tells.
 *
 * Era moods follow the user requirement:
 * 1945 coal haze + warm gas lanterns, 1965 sodium-orange motor city,
 * 1985 photochemical smog with CRT-era glow, 2005 white LED crispness,
 * 2025 clean bright air with cool LED plus string lights — all under ONE
 * consistent golden-hour grade (see `GOLDEN_HOUR_GRADE`).
 *
 * Pure data + pure math only — no THREE imports and no DOM access.
 */

import type { AtmosphereEraSpec } from '../../../era/types';
import { ERAS, type EraId } from '../../../era/years';
import { eraRegistry } from '../../../era/registry';

// ---------------------------------------------------------------------------
// Extended spec types
// ---------------------------------------------------------------------------

/** Kind of ambient particle cloud for an era. */
export type ParticleKind = 'soot_smoke' | 'smog_haze' | 'clear_air';

export interface ParticleStyleSpec {
  /** Visual archetype: dark coal motes, grey photochemical smog, clean sparkle. */
  readonly kind: ParticleKind;
  /** Particle tint (hex). */
  readonly color: string;
  /** Bounded active particle count for this era. */
  readonly count: number;
  /** Particle mesh size in world units. */
  readonly size: number;
  /** Drift speed factor (world units per second). */
  readonly speed: number;
}

/** The 2025 festive string lights strung between lamp anchors. */
export interface StringLightSpec {
  /** Cool LED fairy-light color (hex). */
  readonly color: string;
  /** Glow intensity 0..1. */
  readonly intensity: number;
  /** How far the catenary sags below the lamp heads (world units). */
  readonly sag: number;
  /** Distance between successive string bulbs (world units). */
  readonly spacing: number;
}

/** Directional shadow tuning matched to the golden-hour key light. */
export interface ShadowSpec {
  /** Shadow edge softness: 0 = razor sharp, 1 = diffused (haze raises this). */
  readonly softness: number;
  /** Shadow density/fill level: 0 = faint, 1 = black. */
  readonly density: number;
}

/**
 * Cinematic color grade applied by the renderer's exposure/tonemapping.
 * One consistent golden-hour grade is shared by every era — the era mood
 * comes from haze, lamp tech, and particles, not from changing the grade.
 */
export interface GradeSpec {
  /** Warm-tint shift of midtones/highlights, 0..1 (0 = neutral). */
  readonly temperature: number;
  /** Saturation multiplier (1.0 = neutral). */
  readonly saturation: number;
  /** Contrast multiplier (1.0 = neutral). */
  readonly contrast: number;
  /** Exposure offset in stops applied by the renderer (ACES-friendly). */
  readonly exposure: number;
  /** Highlight roll-off (shoulder) 0..1 — keeps emissive bloom smooth. */
  readonly highlightRolloff: number;
  /** Renderer tonemapping profile to use. */
  readonly toneMapping: 'aces_filmic';
}

/** Extra atmosphere-only fields layered on top of the canonical spec. */
export interface AtmosphereEraDetails {
  /** Ambient particle cloud style (soot/smog/clean). */
  readonly particles: ParticleStyleSpec;
  /** String lights between lamp heads; null except in 2025. */
  readonly stringLights: StringLightSpec | null;
  /** Directional shadow tuning for the key light. */
  readonly shadow: ShadowSpec;
  /** Soft bloom headroom for emissive materials (0..1, 1 = full). */
  readonly emissiveBloomFactor: number;
  /** Street lamp flicker (Hz) — vintage gas flicker down to steady LED. */
  readonly lampFlickerHz: number;
  /** Air-quality index 0..100 (100 = heaviest pollution). */
  readonly poll: number;
  /** Shared golden-hour color grade. */
  readonly grade: GradeSpec;
}

/** The complete per-era atmosphere dataset consumed by the system. */
export type AtmosphereEraDetailedSpec = AtmosphereEraSpec & AtmosphereEraDetails;

// ---------------------------------------------------------------------------
// The single shared golden-hour grade
// ---------------------------------------------------------------------------

/**
 * The one consistent golden-hour grade across all five eras. Slight warm
 * temperature, gentle contrast, restrained saturation lift, and ACES-style
 * highlight roll-off so emissive windows, signs, and lamps stay bloom-friendly
 * (never clipped into hard digital blowouts).
 */
export const GOLDEN_HOUR_GRADE: GradeSpec = Object.freeze({
  temperature: 0.14,
  saturation: 1.06,
  contrast: 1.04,
  exposure: 0.0,
  highlightRolloff: 0.4,
  toneMapping: 'aces_filmic',
});

// ---------------------------------------------------------------------------
// Extended per-era detail
// ---------------------------------------------------------------------------

const PARTICLES_1945: ParticleStyleSpec = Object.freeze({
  kind: 'soot_smoke',
  color: '#2b2118',
  count: 110,
  size: 0.045,
  speed: 0.9,
});

const PARTICLES_1965: ParticleStyleSpec = Object.freeze({
  kind: 'soot_smoke',
  color: '#40372c',
  count: 80,
  size: 0.05,
  speed: 1.0,
});

const PARTICLES_1985: ParticleStyleSpec = Object.freeze({
  kind: 'smog_haze',
  color: '#8f97a8',
  count: 150,
  size: 0.07,
  speed: 1.1,
});

const PARTICLES_2005: ParticleStyleSpec = Object.freeze({
  kind: 'clear_air',
  color: '#dbe5ec',
  count: 40,
  size: 0.035,
  speed: 1.4,
});

const PARTICLES_2025: ParticleStyleSpec = Object.freeze({
  kind: 'clear_air',
  color: '#e9f2f7',
  count: 18,
  size: 0.03,
  speed: 1.6,
});

const STRING_LIGHTS_2025: StringLightSpec = Object.freeze({
  color: '#dbeafe',
  intensity: 0.85,
  sag: 1.1,
  spacing: 0.85,
});

/**
 * The 1945-2025 era detail rows, keyed by EraId. Canonical
 * `AtmosphereEraSpec` values (sky, sun, fog, lamp base values) are pulled
 * from the shared era registry at module load so the dataset never drifts
 * from the authoritative spec.
 */
const ERA_DETAILS: Record<EraId, Omit<AtmosphereEraDetails, 'grade'>> = {
  '1945': Object.freeze({
    particles: PARTICLES_1945,
    stringLights: null,
    shadow: Object.freeze({ softness: 0.62, density: 0.55 }),
    emissiveBloomFactor: 0.78,
    lampFlickerHz: 1.6,
    poll: 68,
  }),
  '1965': Object.freeze({
    particles: PARTICLES_1965,
    stringLights: null,
    shadow: Object.freeze({ softness: 0.58, density: 0.6 }),
    emissiveBloomFactor: 0.84,
    lampFlickerHz: 0.4,
    poll: 46,
  }),
  '1985': Object.freeze({
    particles: PARTICLES_1985,
    stringLights: null,
    shadow: Object.freeze({ softness: 0.54, density: 0.62 }),
    emissiveBloomFactor: 0.9,
    lampFlickerHz: 0.15,
    poll: 58,
  }),
  '2005': Object.freeze({
    particles: PARTICLES_2005,
    stringLights: null,
    shadow: Object.freeze({ softness: 0.4, density: 0.72 }),
    emissiveBloomFactor: 0.95,
    lampFlickerHz: 0.0,
    poll: 22,
  }),
  '2025': Object.freeze({
    particles: PARTICLES_2025,
    stringLights: STRING_LIGHTS_2025,
    shadow: Object.freeze({ softness: 0.32, density: 0.8 }),
    emissiveBloomFactor: 1.0,
    lampFlickerHz: 0.0,
    poll: 9,
  }),
};

function buildEraData(): Record<EraId, AtmosphereEraDetailedSpec> {
  const result = {} as Record<EraId, AtmosphereEraDetailedSpec>;
  for (const id of ERAS) {
    const canonical = eraRegistry.getEra(id).atmosphere;
    result[id] = Object.freeze({
      ...canonical,
      ...ERA_DETAILS[id],
      grade: GOLDEN_HOUR_GRADE,
    });
  }
  return Object.freeze(result);
}

/**
 * Complete per-era atmosphere dataset: canonical spec values from the era
 * registry merged with the extended atmosphere details, plus the shared
 * golden-hour grade. `Record<EraId, AtmosphereEraDetailedSpec>`.
 */
export const atmosphereEraData: Record<EraId, AtmosphereEraDetailedSpec> = buildEraData();
