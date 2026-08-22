/**
 * Per-era environment profiles: sky, fog, lighting and weather mood.
 *
 * Each {@link EnvironmentProfile} captures the full atmospheric identity of
 * one timeline stop so era changes feel visually complete beyond buildings and
 * vehicles:
 *
 *   1945  hazy sepia-blue post-war afternoon, low warm sun, gas-lamp ambience
 *   1965  bright mid-century blue, crisp high sun, optimistic clarity
 *   1985  smoggy orange-grey sodium haze pressing down on neon
 *   2005  flat overcast blue-grey diffusion over glass curtain walls
 *   2025  crisp, clear contemporary blue with clean high-intensity daylight
 *
 * Mutation contract (hard requirement): {@link applyEnvironmentProfile} only
 * writes colors, fog parameters and light properties. It never removes,
 * disposes or rebuilds any scene child, geometry, material or texture, so era
 * switches are cheap and preserve every GPU resource already uploaded.
 */

import * as THREE from 'three';

import type { EraId } from '../eras';

/** Qualitative weather character driving the era's atmosphere. */
export type WeatherMood = 'clear' | 'haze' | 'smog' | 'overcast';

/** Every weather mood value a profile may declare. */
export const WEATHER_MOODS: readonly WeatherMood[] = ['clear', 'haze', 'smog', 'overcast'];

/** Sky-dome/background description for one era. */
export interface SkySpec {
  /** Background clear color as a numeric hex triple (e.g. 0x87b7e8). */
  readonly color: number;
}

/** Exponential fog description for one era. */
export interface FogSpec {
  /** Fog color as a numeric hex triple; usually close to the sky color. */
  readonly color: number;
  /**
   * FogExp2 density. Larger values hug the camera (thick smog), smaller
   * values reveal distant blocks through clearer air.
   */
  readonly density: number;
}

/** Directional sun description for one era. */
export interface SunSpec {
  /** Sun direction expressed as a world-space position target. */
  readonly position: readonly [number, number, number];
  /** DirectionalLight intensity (physically plausible range roughly 0.5..3). */
  readonly intensity: number;
  /** Blackbody color temperature in Kelvin (1500..12000 typical daylight). */
  readonly colorTemperatureKelvin: number;
}

/** Fill-light rig description: hemisphere bounce plus constant ambient. */
export interface LightRigSpec {
  readonly hemisphere: {
    /** HemisphereLight intensity for sky-bounce fill. */
    readonly intensity: number;
    /** Tint arriving from the sky dome. */
    readonly skyTint: number;
    /** Tint bouncing back up from streets and rooftops. */
    readonly groundTint: number;
  };
  readonly ambient: {
    /** AmbientLight intensity lifting shadow floors. */
    readonly intensity: number;
    /** Constant ambient tint. */
    readonly tint: number;
  };
}

/** Optional weather mood descriptor for one era. */
export interface WeatherSpec {
  readonly mood: WeatherMood;
}

/** Complete per-era atmosphere definition. */
export interface EnvironmentProfile {
  /** The era this profile belongs to; mirrors its registry key. */
  readonly id: EraId;
  /** Short human-facing label (HUD/debug). */
  readonly label: string;
  readonly sky: SkySpec;
  readonly fog: FogSpec;
  readonly sun: SunSpec;
  readonly lights: LightRigSpec;
  readonly weather: WeatherSpec;
}

/**
 * Environment profiles keyed by EraId — the single registration point the
 * scene manager consults when restyling the world for a timeline stop.
 */
export const ENVIRONMENT_PROFILES: Readonly<Record<EraId, EnvironmentProfile>> = {
  '1945': {
    id: '1945',
    label: 'Post-war haze',
    sky: { color: 0xaebccd },
    fog: { color: 0xc4b295, density: 0.0085 },
    sun: { position: [-38, 24, -18], intensity: 1.15, colorTemperatureKelvin: 3400 },
    lights: {
      hemisphere: { intensity: 0.55, skyTint: 0xccd6e6, groundTint: 0x5c4832 },
      ambient: { intensity: 0.38, tint: 0x8a7d6a },
    },
    weather: { mood: 'haze' },
  },
  '1965': {
    id: '1965',
    label: 'Mid-century clarity',
    sky: { color: 0x82b4e6 },
    fog: { color: 0xc2dbee, density: 0.004 },
    sun: { position: [42, 56, 24], intensity: 1.5, colorTemperatureKelvin: 5600 },
    lights: {
      hemisphere: { intensity: 0.75, skyTint: 0xe2f0ff, groundTint: 0x6f6656 },
      ambient: { intensity: 0.3, tint: 0xfff2dc },
    },
    weather: { mood: 'clear' },
  },
  '1985': {
    id: '1985',
    label: 'Smog & sodium glow',
    sky: { color: 0xbf8f5e },
    fog: { color: 0xb98a5a, density: 0.0125 },
    sun: { position: [-52, 17, 12], intensity: 1.05, colorTemperatureKelvin: 2500 },
    lights: {
      hemisphere: { intensity: 0.5, skyTint: 0xdbb68c, groundTint: 0x403a33 },
      ambient: { intensity: 0.44, tint: 0x8f7d64 },
    },
    weather: { mood: 'smog' },
  },
  '2005': {
    id: '2005',
    label: 'Overcast digital age',
    sky: { color: 0x93a6b9 },
    fog: { color: 0xa3b3c1, density: 0.009 },
    sun: { position: [22, 62, -32], intensity: 0.9, colorTemperatureKelvin: 6100 },
    lights: {
      hemisphere: { intensity: 0.82, skyTint: 0xcbd8e4, groundTint: 0x4d5259 },
      ambient: { intensity: 0.46, tint: 0xbec9d4 },
    },
    weather: { mood: 'overcast' },
  },
  '2025': {
    id: '2025',
    label: 'Crisp electric present',
    sky: { color: 0x6fabea },
    fog: { color: 0xd3e6f6, density: 0.0028 },
    sun: { position: [36, 72, 42], intensity: 1.65, colorTemperatureKelvin: 6500 },
    lights: {
      hemisphere: { intensity: 0.92, skyTint: 0xecf5ff, groundTint: 0x76736c },
      ambient: { intensity: 0.32, tint: 0xf5f9ff },
    },
    weather: { mood: 'clear' },
  },
};

/** Lookup helper for a single environment profile. Throws on unknown ids. */
export function getEnvironmentProfile(id: EraId): EnvironmentProfile {
  const profile = ENVIRONMENT_PROFILES[id];
  if (!profile) {
    throw new Error(`Unknown environment profile for era id: ${String(id)}`);
  }
  return profile;
}

/**
 * Approximate blackbody color temperature (Kelvin) as an sRGB color using the
 * widely used Tanner Helland curve. Keeps profiles declarative ("sodium
 * 2500 K") instead of hardcoding RGB triples, and doubles as a shared utility
 * for lamp materials in other modules.
 *
 * @param kelvin Color temperature in Kelvin; clamped to 1000..40000.
 * @param target Optional color to write into (mutation-friendly reuse).
 */
export function colorTemperatureToColor(kelvin: number, target?: THREE.Color): THREE.Color {
  const temp = Math.min(Math.max(kelvin, 1000), 40000) / 100;
  let red: number;
  let green: number;
  let blue: number;

  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  const out = target ?? new THREE.Color();
  return out.setRGB(
    Math.min(Math.max(red, 0), 255) / 255,
    Math.min(Math.max(green, 0), 255) / 255,
    Math.min(Math.max(blue, 0), 255) / 255,
  );
}

/**
 * Structural handles for the three rig lights an environment restyles.
 * All fields optional so partial rigs are supported.
 */
export interface EnvironmentLights {
  readonly sun?: THREE.DirectionalLight;
  readonly hemisphere?: THREE.HemisphereLight;
  readonly ambient?: THREE.AmbientLight;
}

/** Options accepted by {@link applyEnvironmentProfile}. */
export interface ApplyEnvironmentOptions {
  /**
   * Explicit light rig to mutate. Omit to have the helper discover the first
   * DirectionalLight, HemisphereLight and AmbientLight inside the scene.
   */
  readonly lights?: EnvironmentLights;
}

/**
 * Finds the default rig lights inside a scene: the first light of each class
 * encountered in traversal order. Scenes needing several directional lights
 * should pass an explicit {@link EnvironmentLights} rig instead.
 */
export function findSceneEnvironmentLights(scene: THREE.Scene): EnvironmentLights {
  const found: { sun?: THREE.DirectionalLight; hemisphere?: THREE.HemisphereLight; ambient?: THREE.AmbientLight } = {};
  scene.traverse((obj) => {
    if (!found.sun && obj instanceof THREE.DirectionalLight) found.sun = obj;
    else if (!found.hemisphere && obj instanceof THREE.HemisphereLight) found.hemisphere = obj;
    else if (!found.ambient && obj instanceof THREE.AmbientLight) found.ambient = obj;
  });
  return found;
}

/**
 * Applies an environment profile to a live scene **in place**.
 *
 * Mutates only:
 * - `scene.background` (Color copied into an existing Color, or assigned once)
 * - `scene.fog` (existing FogExp2 mutated; otherwise a FogExp2 is assigned)
 * - the rig lights' colors, tints, intensities and the sun's position
 *
 * Never disposes or rebuilds geometry, materials, textures or scene children.
 */
export function applyEnvironmentProfile(
  scene: THREE.Scene,
  profile: EnvironmentProfile,
  options: ApplyEnvironmentOptions = {},
): void {
  // --- Background -----------------------------------------------------------
  if (scene.background instanceof THREE.Color) {
    scene.background.setHex(profile.sky.color);
  } else {
    scene.background = new THREE.Color(profile.sky.color);
  }

  // --- Fog ------------------------------------------------------------------
  const fog = scene.fog;
  if (fog instanceof THREE.FogExp2) {
    fog.color.setHex(profile.fog.color);
    fog.density = profile.fog.density;
  } else {
    scene.fog = new THREE.FogExp2(profile.fog.color, profile.fog.density);
  }

  // --- Lights ---------------------------------------------------------------
  const rig = options.lights ?? findSceneEnvironmentLights(scene);

  if (rig.sun) {
    rig.sun.position.set(...profile.sun.position);
    rig.sun.intensity = profile.sun.intensity;
    rig.sun.color.copy(colorTemperatureToColor(profile.sun.colorTemperatureKelvin));
  }

  if (rig.hemisphere) {
    rig.hemisphere.intensity = profile.lights.hemisphere.intensity;
    rig.hemisphere.color.setHex(profile.lights.hemisphere.skyTint);
    rig.hemisphere.groundColor.setHex(profile.lights.hemisphere.groundTint);
  }

  if (rig.ambient) {
    rig.ambient.intensity = profile.lights.ambient.intensity;
    rig.ambient.color.setHex(profile.lights.ambient.tint);
  }
}
