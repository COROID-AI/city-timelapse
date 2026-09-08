/**
 * Night lighting: dark blue-purple sky, matching fog, and the ambient /
 * moonlight rig that keeps the road, buildings, and cars readable at speed.
 *
 * Tuning notes (lane review): the original rig was so dim that distant PBR
 * building silhouettes fell to near-black. The ambient / hemisphere fill is
 * now strong enough that facades and the wet road stay visible, while the
 * moon still casts directional shading so the night mood is preserved.
 */

import * as THREE from 'three';

/** Clear-sky color (dark blue-purple night). */
export const NIGHT_SKY = 0x171a3a;
/** Fog color — a slightly warmer blue-purple that reads as city haze. */
export const FOG_COLOR = 0x2a2a52;
/** Fog start distance (world units). */
export const FOG_NEAR = 60;
/** Fog end distance (world units) — pushed out so near-horizon buildings stay
 *  visible instead of disappearing into black. */
export const FOG_FAR = 820;

/** Night lighting rig placed in the scene. */
export interface NightLighting {
  /** Ambient fill so silhouettes stay visible. */
  readonly ambient: THREE.AmbientLight;
  /** Warm-ish hemisphere fill from the sky so PBR facades read clearly. */
  readonly hemisphere: THREE.HemisphereLight;
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

  // Strong ambient + hemisphere so every PBR surface (road, steel buildings,
  // cars) has a baseline to reflect even in the deepest shadow. Without this
  // the standard materials render nearly black.
  const ambient = new THREE.AmbientLight(0x93a4ff, 1.35);
  group.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xbcd0ff, 0x3a3a5c, 0.9);
  group.add(hemisphere);

  // Cool moonlight still casts directional shading for depth and mood.
  const moon = new THREE.DirectionalLight(0xc4d4ff, 2.6);
  moon.position.set(30, 60, 20);
  group.add(moon);

  return {
    ambient,
    hemisphere,
    moon,
    group,
    dispose() {
      ambient.dispose();
      hemisphere.dispose();
      moon.dispose();
    },
  };
}