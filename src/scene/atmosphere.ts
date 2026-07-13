// =============================================================================
// City Timelapse — Era-Aware Atmosphere System
//
// Tweens the scene's atmospheric qualities — skybox gradient, fog color &
// density, ambient light color, directional light intensity, and shadow
// softness — so that era transitions feel total, not just per-object.
//
// Driven by the shared EraState normalized timeline position `t` (0 = 1945,
// 1 = 2055). On every EraState update the system records the latest `t`;
// its `update()` method (called from the main render loop) samples an
// interpolated atmosphere preset and applies it to the scene objects before
// the frame is rendered.
//
// Because the EraState tween already applies easeInOutCubic to `t`, linear
// interpolation between adjacent era presets yields a smooth, click-free
// visual transition that is perfectly synchronised with the content systems
// and whose duration matches the ~1.5 s EraState tween.
//
// NOTE: three.js r0.160 does not yet expose `LightShadow.intensity` (added in
// r163). `LightShadow.radius` — which controls PCF shadow blur — is used as
// the shadow-appearance tween target. Each era has a distinct radius so the
// shadow character evolves alongside the rest of the atmosphere.
//
// No external files or libraries are used.
// =============================================================================

import * as THREE from 'three';
import { ERA_IDS, type EraId } from '../eras';
import type { EraState } from './EraState';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Atmosphere parameters for a single era. */
export interface AtmospherePreset {
  /** Skybox gradient top color (hex). */
  readonly skyTop: number;
  /** Skybox gradient bottom / horizon color (hex). */
  readonly skyBottom: number;
  /** Fog color (hex). */
  readonly fogColor: number;
  /** Fog density (FogExp2). */
  readonly fogDensity: number;
  /** Ambient light color (hex). */
  readonly ambientColor: number;
  /** Directional (sun) light intensity. */
  readonly directionalIntensity: number;
  /** Shadow softness — proxies "shadow intensity" via LightShadow.radius. */
  readonly shadowRadius: number;
}

/** Scene objects the atmosphere system controls. */
export interface AtmosphereTargets {
  /** Skybox ShaderMaterial with `uTopColor` / `uBottomColor` uniforms. */
  readonly skyMaterial: THREE.ShaderMaterial;
  /** Scene exponential fog. */
  readonly fog: THREE.FogExp2;
  /** Ambient light whose color is tweened. */
  readonly ambientLight: THREE.AmbientLight;
  /** Directional light whose intensity is tweened. */
  readonly directionalLight: THREE.DirectionalLight;
}

/** Handle returned by {@link createAtmosphere}. */
export interface AtmosphereSystem {
  /**
   * Apply the latest recorded atmosphere state. Called from the main render
   * loop so visuals are always in sync before `renderer.render()`.
   */
  update(): void;
  /** Unsubscribe from EraState. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Per-era atmosphere presets
// ---------------------------------------------------------------------------

/**
 * Hand-tuned atmosphere for each era. Every era reads as visually distinct in
 * sky hue, fog character, light warmth, and shadow softness.
 */
const ERA_ATMOSPHERE: Record<EraId, AtmospherePreset> = {
  '1945': {
    // Smoggy amber dusk — sooty haze diffuses shadows.
    skyTop: 0x2a3458,
    skyBottom: 0xc9965a,
    fogColor: 0x9a7a52,
    fogDensity: 0.012,
    ambientColor: 0x5a4838,
    directionalIntensity: 1.0,
    shadowRadius: 3.0,
  },
  '1965': {
    // Bright pastel Space Age clarity.
    skyTop: 0x3a6db5,
    skyBottom: 0xc4d8e8,
    fogColor: 0xb8c8d8,
    fogDensity: 0.006,
    ambientColor: 0x606878,
    directionalIntensity: 1.4,
    shadowRadius: 1.8,
  },
  '1985': {
    // Hazy neon-lit dusk with purple haze.
    skyTop: 0x2a2a4a,
    skyBottom: 0x8a5a7a,
    fogColor: 0x6a4a6a,
    fogDensity: 0.010,
    ambientColor: 0x504a5a,
    directionalIntensity: 1.1,
    shadowRadius: 2.8,
  },
  '2005': {
    // Crisp millennial clarity — sharp shadows.
    skyTop: 0x2a5aaa,
    skyBottom: 0xb0d0f0,
    fogColor: 0xa0b8d0,
    fogDensity: 0.004,
    ambientColor: 0x505560,
    directionalIntensity: 1.5,
    shadowRadius: 1.2,
  },
  '2025': {
    // Clean eco-clarity — bright sky, minimal haze.
    skyTop: 0x1a6aaa,
    skyBottom: 0xc8e8f8,
    fogColor: 0xb8d8e8,
    fogDensity: 0.003,
    ambientColor: 0x485868,
    directionalIntensity: 1.6,
    shadowRadius: 1.4,
  },
  '2055': {
    // Luminous futuristic dusk — deep blue, soft diffused shadows.
    skyTop: 0x1a2a4a,
    skyBottom: 0x4a6a9a,
    fogColor: 0x3a4a6a,
    fogDensity: 0.005,
    ambientColor: 0x3a4a6a,
    directionalIntensity: 0.9,
    shadowRadius: 4.0,
  },
};

// ---------------------------------------------------------------------------
// Pre-allocated scratch (avoid per-frame allocation)
// ---------------------------------------------------------------------------

/** Temporary colour reused across linear interpolation calls. */
const _tmpColor = new THREE.Color();

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an era-aware atmosphere system.
 *
 * Subscribes to {@link EraState} for timeline updates and exposes an `update()`
 * method that applies the interpolated atmosphere to the supplied scene
 * objects. The system applies the initial atmosphere immediately on
 * construction so the first frame is correct.
 *
 * @param eraState  Shared era state controller.
 * @param targets   Scene objects to tween.
 * @returns         Atmosphere system handle.
 */
export function createAtmosphere(
  eraState: EraState,
  targets: AtmosphereTargets,
): AtmosphereSystem {
  let currentT = eraState.getT();

  /**
   * Sample and apply the atmosphere at a normalized timeline position.
   * Linearly interpolates between the two nearest era presets — the EraState
   * tween already eases `t`, so linear sampling produces a smooth result.
   */
  function apply(t: number): void {
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    const segments = ERA_IDS.length - 1;
    const pos = clamped * segments;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, segments);
    const frac = hi > lo ? pos - lo : 0;

    const a = ERA_ATMOSPHERE[ERA_IDS[lo]];
    const b = ERA_ATMOSPHERE[ERA_IDS[hi]];

    // --- Skybox gradient ---
    const topColor = targets.skyMaterial.uniforms.uTopColor.value as THREE.Color;
    topColor.set(a.skyTop).lerp(_tmpColor.set(b.skyTop), frac);
    const bottomColor = targets.skyMaterial.uniforms.uBottomColor.value as THREE.Color;
    bottomColor.set(a.skyBottom).lerp(_tmpColor.set(b.skyBottom), frac);

    // --- Fog colour & density ---
    targets.fog.color.set(a.fogColor).lerp(_tmpColor.set(b.fogColor), frac);
    targets.fog.density = a.fogDensity + (b.fogDensity - a.fogDensity) * frac;

    // --- Ambient light colour ---
    targets.ambientLight.color.set(a.ambientColor).lerp(_tmpColor.set(b.ambientColor), frac);

    // --- Directional light intensity ---
    targets.directionalLight.intensity =
      a.directionalIntensity + (b.directionalIntensity - a.directionalIntensity) * frac;

    // --- Shadow softness (proxy for shadow intensity) ---
    if (targets.directionalLight.shadow) {
      targets.directionalLight.shadow.radius =
        a.shadowRadius + (b.shadowRadius - a.shadowRadius) * frac;
    }
  }

  // Apply initial atmosphere so the very first frame is correct.
  apply(currentT);

  // Record the latest timeline position on every EraState update.
  const unsubscribe = eraState.subscribe((update) => {
    currentT = update.t;
  });

  return {
    update: () => apply(currentT),
    dispose: () => {
      unsubscribe();
    },
  };
}
