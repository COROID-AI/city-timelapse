/**
 * Night lighting: dark blue-purple sky, matching fog, and the ambient /
 * moonlight rig that keeps the road readable at speed.
 *
 * The sky and fog are tuned together so distant buildings recede into a
 * blue-purple haze while the reflective road stays bright enough to read.
 */

import * as THREE from 'three';

/** Clear-sky color (dark blue-purple night). */
export const NIGHT_SKY = 0x141638;
/** Fog color — slightly warmer than the sky so it reads as city haze. */
export const FOG_COLOR = 0x1c1a3c;
/** Fog start distance (world units). */
export const FOG_NEAR = 60;
/** Fog end distance (world units). */
export const FOG_FAR = 640;

/** Night lighting rig placed in the scene. */
export interface NightLighting {
  /** Ambient fill so silhouettes stay visible. */
  readonly ambient: THREE.AmbientLight;
  /** Cool directional "moonlight" casting subtle shading. */
  readonly moon: THREE.DirectionalLight;
  /** Container holding the light rig (added to the scene). */
  readonly group: THREE.Group;
  /** Release GPU resources owned by the rig. */
  dispose(): void;
}

/**
 * Apply the dark blue-purple night sky and fog to a scene and build the
 * lighting rig. Returns the rig so callers can add it to their group.
 */
export function createNightLighting(scene: THREE.Scene): NightLighting {
  scene.background = new THREE.Color(NIGHT_SKY);
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

  const group = new THREE.Group();

  const ambient = new THREE.AmbientLight(0x6677cc, 0.95);
  group.add(ambient);

  const moon = new THREE.DirectionalLight(0xaac4ff, 1.9);
  moon.position.set(30, 60, 20);
  group.add(moon);

  return {
    ambient,
    moon,
    group,
    dispose() {
      ambient.dispose();
      moon.dispose();
    },
  };
}