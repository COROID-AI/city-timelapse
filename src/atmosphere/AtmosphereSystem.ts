/**
 * AtmosphereSystem — per-era sky, fog, sun, ambient, and bloom.
 *
 * Drives every environmental light and skybox parameter from
 * `DEFAULT_ERA_CONFIG[era].atmosphere` and cross-fades them smoothly between
 * eras via the TransitionManager. Each atmosphere field (sky color, fog color,
 * fog density, sun angle/intensity/color, ambient color/intensity, bloom
 * strength/radius/threshold) is linearly interpolated between the source and
 * destination era configs using the shared `t` in [0, 1].
 *
 * The bloom pass (UnrealBloomPass) is modulated here so the 2055 dusk/neon era
 * visibly leverages heavy bloom (strength 1.8, threshold 0.2) for its
 * holographic ambiance, while daytime eras keep bloom subtle.
 */

import {
  Color,
  FogExp2,
  type AmbientLight,
  type DirectionalLight,
  type Scene,
} from 'three';
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  DEFAULT_ERA_CONFIG,
  lerp,
  lerpHex,
  type Atmosphere,
  type EraKey,
} from '../eras/eraConfig.js';

/** Shared horizontal distance for the sun light position (world units). */
const SUN_RADIUS = 120;

export interface AtmosphereSystem {
  /**
   * Per-frame era-application callback. Interpolates every atmosphere field
   * between `fromKey` and `toKey` by the eased progress `t`. Register this with
   * `TransitionManager.registerDomain('atmosphere', applyEra)`.
   */
  applyEra: (toKey: EraKey, t: number, fromKey: EraKey) => void;
}

/**
 * Create the AtmosphereSystem.
 *
 * @param scene     The Three.js scene — its `.background` and `.fog` are driven.
 * @param ambient   The ambient fill light driven per era.
 * @param sun       The directional sun light driven per era.
 * @param bloom     The UnrealBloomPass whose strength/radius/threshold is driven.
 * @returns the `applyEra` callback to register with the TransitionManager.
 */
export function createAtmosphereSystem(
  scene: Scene,
  ambient: AmbientLight,
  sun: DirectionalLight,
  bloom: UnrealBloomPass,
): AtmosphereSystem {
  // Fog is added to the scene here; it persists and is mutated every frame.
  const fog = new FogExp2(0x000000, 0);
  scene.fog = fog;
  const bgColor = new Color();
  const sunColor = new Color();
  const ambientColor = new Color();
  const fogColor = new Color();

  /**
   * Convert a sun elevation angle (radians above horizon) into a normalized
   * light direction, then scale to the sun shadow camera's working distance.
   * Azimuth is fixed south-west for pleasing shadows across the block.
   */
  function setSunPosition(angle: number): void {
    // Clamp the elevation so the sun stays above the horizon plane.
    const elevation = Math.max(angle, 0.05);
    // Fixed azimuth — sun comes from the south-west for consistent shadows.
    const azimuth = -Math.PI * 0.25;
    const x = Math.cos(elevation) * Math.cos(azimuth) * SUN_RADIUS;
    const z = Math.cos(elevation) * Math.sin(azimuth) * SUN_RADIUS;
    const y = Math.sin(elevation) * SUN_RADIUS;
    sun.position.set(x, y, z);
  }

  function applyAtmosphere(from: Atmosphere, to: Atmosphere, t: number): void {
    // ---- Sky background ----
    bgColor.set(lerpHex(from.skyColor, to.skyColor, t));
    scene.background = bgColor;

    // ---- Fog (exponential) ----
    fogColor.set(lerpHex(from.fogColor, to.fogColor, t));
    fog.color.copy(fogColor);
    fog.density = lerp(from.fogDensity, to.fogDensity, t);

    // ---- Sun directional light ----
    sunColor.set(lerpHex(from.sunColor, to.sunColor, t));
    sun.color.copy(sunColor);
    sun.intensity = lerp(from.sunIntensity, to.sunIntensity, t);
    setSunPosition(lerp(from.sunAngle, to.sunAngle, t));

    // ---- Ambient fill light ----
    ambientColor.set(lerpHex(from.ambientColor, to.ambientColor, t));
    ambient.color.copy(ambientColor);
    ambient.intensity = lerp(from.ambientIntensity, to.ambientIntensity, t);

    // ---- Bloom post-processing ----
    bloom.strength = lerp(from.bloomStrength, to.bloomStrength, t);
    bloom.radius = lerp(from.bloomRadius, to.bloomRadius, t);
    bloom.threshold = lerp(from.bloomThreshold, to.bloomThreshold, t);
  }

  function applyEra(toKey: EraKey, t: number, fromKey: EraKey): void {
    applyAtmosphere(
      DEFAULT_ERA_CONFIG[fromKey].atmosphere,
      DEFAULT_ERA_CONFIG[toKey].atmosphere,
      t,
    );
  }

  return { applyEra };
}
