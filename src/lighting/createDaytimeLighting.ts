import * as THREE from 'three';
import { createSkyDome, type SkyDomeOptions } from './sky';
import { createSunLight, type SunLightOptions } from './sun';

export interface DaytimeLightingOptions {
  /** Sky dome options (radius, gradient colors, sun disc). */
  sky?: SkyDomeOptions;
  /** Directional sun light options (intensity, shadow map/camera). */
  sun?: SunLightOptions;
  /** Intensity of the uniform ambient fill. Default 0.3. */
  ambientIntensity?: number;
  /** Intensity of the sky/ground hemisphere fill. Default 1.0. */
  hemisphereIntensity?: number;
  /** Hemisphere sky color. */
  skyColor?: THREE.Color;
  /** Hemisphere ground color. */
  groundColor?: THREE.Color;
}

export interface DaytimeLighting {
  /** Gradient sky dome mesh (added to the scene). */
  sky: THREE.Mesh;
  /** Directional sun light with shadow casting (added to the scene). */
  sun: THREE.DirectionalLight;
  /** Uniform ambient fill (added to the scene). */
  ambient: THREE.AmbientLight;
  /** Sky/ground hemisphere fill (added to the scene). */
  hemisphere: THREE.HemisphereLight;
}

/**
 * Wire a complete daytime atmosphere into the scene: a gradient sky dome with
 * a visible sun disc, a directional sun light that casts shadows, and
 * ambient/hemisphere fill bright enough to read street-level detail in shade.
 */
export function createDaytimeLighting(
  scene: THREE.Scene,
  options: DaytimeLightingOptions = {},
): DaytimeLighting {
  const sky = createSkyDome(options.sky);
  scene.add(sky);

  const ambient = new THREE.AmbientLight(0xffffff, options.ambientIntensity ?? 0.3);
  ambient.name = 'ambientLight';
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(
    options.skyColor ?? 0xcfe4ff,
    options.groundColor ?? 0x8d8271,
    options.hemisphereIntensity ?? 1.0,
  );
  hemisphere.name = 'hemisphereLight';
  scene.add(hemisphere);

  const sun = createSunLight(options.sun);
  scene.add(sun);
  // The light target must be in the scene graph for its matrix to update.
  scene.add(sun.target);

  return { sky, sun, ambient, hemisphere };
}
