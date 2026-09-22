/**
 * Atmosphere domain — era-driven sky, sun, key/fill/ambient lighting, fog and
 * haze, window/neon/streetlight emissive glow, weather mood, and restrained
 * post-processing.
 *
 * This module owns the `atmosphere-api` shared interface. It implements
 * `EraTransformable` at the `lights` choreography stage and registers itself
 * into the era registry, so every transition frame it receives the shared
 * era blend value and crossfades:
 *
 * - sky gradient, sun disc, and sun/key-light direction (`src/env/sky.ts`);
 * - key/fill/ambient/hemisphere light colors and intensities;
 * - fog color, near, and far (sooty 1945 -> warm 1965 -> smog-orange 1985 ->
 *   crisp 2005 -> clear green-tinged 2025);
 * - the documented emissive state downstream tasks use to tune window, neon,
 *   and streetlight glow per era (neon color/intensity is sourced from the
 *   real `ProceduralGfxLibrary` era palettes);
 * - era particles (`src/env/weather.ts`) and bloom/vignette/tone-mapping
 *   grades (`src/env/postfx.ts`).
 *
 * Blending is strictly linear in the shared era fraction (and the optional
 * day/night mix), and state never depends on transition progress — two frames
 * at the same blend always show the same look, so crossfades cannot pop.
 * Stage offset/progress are still recorded in `lastDispatch` for choreography
 * diagnostics.
 *
 * All visuals are procedural: no HDRIs, no downloaded textures.
 */

import * as THREE from 'three';
import { ERA_YEARS, clamp01, type EraBlend, type EraYear } from '../era/timeline';
import type { EraMorphStage, EraTransformRegistry, EraTransformable } from '../era/contracts';
import { ProceduralGfxLibrary } from '../gfx/materials';
import {
  SKY_DAY_STATES,
  SKY_NIGHT_STATES,
  createSkyDome,
  createSkyState,
  lerpSkyState,
  sunDirection,
  type SkyDome,
  type SkyState,
} from './sky';
import {
  ERA_WEATHER,
  createWeatherState,
  createWeatherSystem,
  lerpWeatherState,
  type WeatherState,
  type WeatherSystem,
} from './weather';
import {
  POSTFX_DAY_STATES,
  POSTFX_NIGHT_STATES,
  createPostFx,
  createPostFxState,
  lerpPostFxState,
  type AtmosphereQuality,
  type PostFxController,
  type PostFxState,
} from './postfx';

/** Choreography stage for the atmosphere (after crowd, before sound). */
export const ATMOSPHERE_STAGE: EraMorphStage = 'lights';

/** Key light distance from the city origin (fits the shell's shadow camera). */
const KEY_LIGHT_DISTANCE = 140;
/** Fill light distance from the city origin. */
const FILL_LIGHT_DISTANCE = 90;

// ---------------------------------------------------------------------------
// State types (the documented atmosphere state object)
// ---------------------------------------------------------------------------

/** Key/fill/ambient/hemisphere lighting for the current blend. */
export interface AtmosphereLightingState {
  /** Key (sun/moon) light color. */
  keyColor: THREE.Color;
  keyIntensity: number;
  /** Soft opposite-azimuth fill light color (always weaker than the key). */
  fillColor: THREE.Color;
  fillIntensity: number;
  /** Flat ambient lift. */
  ambientColor: THREE.Color;
  ambientIntensity: number;
  /** Hemisphere sky/ground bounce. */
  hemisphereSkyColor: THREE.Color;
  hemisphereGroundColor: THREE.Color;
  hemisphereIntensity: number;
  /** Unit vector from the city toward the key light; matches the sky's sun. */
  keyDirection: THREE.Vector3;
}

/** Linear fog and haze for the current blend (dense and sooty in 1945). */
export interface AtmosphereFogState {
  color: THREE.Color;
  near: number;
  far: number;
}

/**
 * Documented emissive tuning state: downstream city modules read this every
 * era change (or frame) to drive window panes, neon signage, and streetlight
 * lamp materials so their glow tracks the era automatically.
 */
export interface AtmosphereEmissiveState {
  /** Warm interior window glow color (era glass/tungsten tint). */
  windowColor: THREE.Color;
  windowIntensity: number;
  /** Neon/signage glow color — the era palette's emissive swatch. */
  neonColor: THREE.Color;
  neonIntensity: number;
  /** Street lamp glow: weak sodium 1945, clean white 2005, warm LED 2025. */
  streetlightColor: THREE.Color;
  streetlightIntensity: number;
}

/** The complete live atmosphere state (every field blends continuously). */
export interface AtmosphereState {
  /** Shared era blend last applied to this state. */
  eraBlend: EraBlend;
  /** Day (0) to night (1) option mix applied within each era. */
  nightMix: number;
  sky: SkyState;
  lighting: AtmosphereLightingState;
  fog: AtmosphereFogState;
  emissive: AtmosphereEmissiveState;
  weather: WeatherState;
  postFx: PostFxState;
}

/** One recorded `applyEraBlend` dispatch (choreography diagnostics). */
export interface AtmosphereDispatchRecord {
  blend: EraBlend;
  stageOffset: number;
  progress: number;
}

/** References to the lights the atmosphere drives (own or reused from scene). */
export interface AtmosphereLightRig {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  hemisphere: THREE.HemisphereLight;
  /** True when the atmosphere created the key light (vs reusing `sunLight`). */
  ownsKey: boolean;
  /** True when the atmosphere created the hemisphere light. */
  ownsHemisphere: boolean;
}

/**
 * The produced atmosphere module (`AtmosphereModule`). Implements
 * `EraTransformable` and exposes the live `state` object for emissive tuning.
 */
export interface AtmosphereModule extends EraTransformable {
  readonly stage: EraMorphStage;
  readonly name: 'atmosphere';
  /** Live, documented atmosphere state — read this for emissive tuning. */
  readonly state: AtmosphereState;
  readonly sky: SkyDome;
  readonly weather: WeatherSystem;
  readonly postFx: PostFxController;
  readonly lights: AtmosphereLightRig;
  /** Last dispatched frame (shared blend + stage offset/progress). */
  readonly lastDispatch: AtmosphereDispatchRecord | null;
  readonly quality: AtmosphereQuality;
  /** Crossfade day -> night option for the current era (0..1, continuous). */
  setNightMix(nightMix: number): void;
  /** Switch quality tier (particle counts + bloom chain). */
  setQuality(quality: AtmosphereQuality): void;
  /** Register with an era registry; returns the unregister function. */
  register(registry: EraTransformRegistry): () => void;
  /** Advance weather particle simulation. */
  update(deltaSeconds: number, camera?: THREE.Camera | null): void;
  /** Render through the era post chain (bloom on `high`, direct otherwise). */
  renderFrame(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds?: number): void;
  /** Unregister, detach scene objects, and release GPU resources. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Per-era lighting / fog / emissive presets
// ---------------------------------------------------------------------------

/** JSON-ish preset seed (hex strings) before color instantiation. */
interface EraCoreSeed {
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  windowColor: string;
  windowIntensity: number;
  streetlightColor: string;
  streetlightIntensity: number;
  /** Multiplier over the era palette's neon emissive intensity. */
  neonIntensity: number;
}

/**
 * Runtime core preset (colors instantiated). Day and night variants exist per
 * era; the atmosphere crossfades them with `nightMix` before era blending.
 */
export interface AtmosphereCoreState {
  keyColor: THREE.Color;
  keyIntensity: number;
  fillColor: THREE.Color;
  fillIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  hemisphereSkyColor: THREE.Color;
  hemisphereGroundColor: THREE.Color;
  hemisphereIntensity: number;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  windowColor: THREE.Color;
  windowIntensity: number;
  neonColor: THREE.Color;
  neonIntensity: number;
  streetlightColor: THREE.Color;
  streetlightIntensity: number;
}

const DAY_SEEDS: Record<EraYear, EraCoreSeed> = {
  1945: {
    keyColor: '#ffd2a0', keyIntensity: 1.4,
    fillColor: '#b3a794', fillIntensity: 0.4,
    ambientColor: '#a49a86', ambientIntensity: 0.5,
    hemisphereSkyColor: '#a89e8c', hemisphereGroundColor: '#413a2f', hemisphereIntensity: 0.6,
    fogColor: '#ab9d80', fogNear: 25, fogFar: 200,
    windowColor: '#ff9d4e', windowIntensity: 0.5,
    streetlightColor: '#ffb46a', streetlightIntensity: 0.55,
    neonIntensity: 1.0,
  },
  1965: {
    keyColor: '#ffe3bd', keyIntensity: 2.0,
    fillColor: '#c8d8ea', fillIntensity: 0.55,
    ambientColor: '#c3d3e4', ambientIntensity: 0.65,
    hemisphereSkyColor: '#cfe0f2', hemisphereGroundColor: '#6b6353', hemisphereIntensity: 0.75,
    fogColor: '#d8c39a', fogNear: 45, fogFar: 300,
    windowColor: '#ffd2a1', windowIntensity: 0.55,
    streetlightColor: '#ffe6bd', streetlightIntensity: 0.85,
    neonIntensity: 1.0,
  },
  1985: {
    keyColor: '#ffd9ac', keyIntensity: 1.7,
    fillColor: '#c1cede', fillIntensity: 0.5,
    ambientColor: '#b7c2d3', ambientIntensity: 0.6,
    hemisphereSkyColor: '#b9c3d6', hemisphereGroundColor: '#575043', hemisphereIntensity: 0.7,
    fogColor: '#cfa079', fogNear: 38, fogFar: 260,
    windowColor: '#ffd9b0', windowIntensity: 0.6,
    streetlightColor: '#d8ecff', streetlightIntensity: 1.0,
    neonIntensity: 1.0,
  },
  2005: {
    keyColor: '#ffffff', keyIntensity: 2.3,
    fillColor: '#bcd4ee', fillIntensity: 0.6,
    ambientColor: '#d3e4f6', ambientIntensity: 0.75,
    hemisphereSkyColor: '#dcecff', hemisphereGroundColor: '#5f6a63', hemisphereIntensity: 0.9,
    fogColor: '#c6dcef', fogNear: 90, fogFar: 520,
    windowColor: '#cfe4ff', windowIntensity: 0.6,
    streetlightColor: '#f4f8ff', streetlightIntensity: 1.15,
    neonIntensity: 1.0,
  },
  2025: {
    keyColor: '#f6fff9', keyIntensity: 2.4,
    fillColor: '#cdeee0', fillIntensity: 0.65,
    ambientColor: '#d6f2e6', ambientIntensity: 0.8,
    hemisphereSkyColor: '#dcf3ea', hemisphereGroundColor: '#5c6b5f', hemisphereIntensity: 0.95,
    fogColor: '#cdeee4', fogNear: 110, fogFar: 600,
    windowColor: '#ffe9c9', windowIntensity: 0.6,
    streetlightColor: '#ffd9a8', streetlightIntensity: 1.2,
    neonIntensity: 1.0,
  },
};

const NIGHT_SEEDS: Record<EraYear, EraCoreSeed> = {
  1945: {
    keyColor: '#9fb2d8', keyIntensity: 0.35,
    fillColor: '#7d8298', fillIntensity: 0.22,
    ambientColor: '#3c4258', ambientIntensity: 0.3,
    hemisphereSkyColor: '#2f3550', hemisphereGroundColor: '#26201a', hemisphereIntensity: 0.4,
    fogColor: '#4f4433', fogNear: 22, fogFar: 150,
    windowColor: '#ffb46a', windowIntensity: 1.5,
    streetlightColor: '#ffb46a', streetlightIntensity: 1.6,
    neonIntensity: 1.9,
  },
  1965: {
    keyColor: '#a9bce0', keyIntensity: 0.5,
    fillColor: '#8593b0', fillIntensity: 0.26,
    ambientColor: '#454c68', ambientIntensity: 0.32,
    hemisphereSkyColor: '#39425f', hemisphereGroundColor: '#2c2822', hemisphereIntensity: 0.42,
    fogColor: '#5a4a44', fogNear: 40, fogFar: 210,
    windowColor: '#ffd2a1', windowIntensity: 1.7,
    streetlightColor: '#ffe6bd', streetlightIntensity: 1.8,
    neonIntensity: 1.6,
  },
  1985: {
    keyColor: '#8ea4cf', keyIntensity: 0.45,
    fillColor: '#7b839f', fillIntensity: 0.25,
    ambientColor: '#4d4360', ambientIntensity: 0.35,
    hemisphereSkyColor: '#3a3c60', hemisphereGroundColor: '#2c2632', hemisphereIntensity: 0.45,
    fogColor: '#6b4a3c', fogNear: 34, fogFar: 190,
    windowColor: '#ffd9b0', windowIntensity: 1.9,
    streetlightColor: '#d8ecff', streetlightIntensity: 2.0,
    neonIntensity: 2.4,
  },
  2005: {
    keyColor: '#b9cbe8', keyIntensity: 0.6,
    fillColor: '#8fa3bd', fillIntensity: 0.3,
    ambientColor: '#4a5670', ambientIntensity: 0.36,
    hemisphereSkyColor: '#33455f', hemisphereGroundColor: '#242a2e', hemisphereIntensity: 0.45,
    fogColor: '#3c5474', fogNear: 60, fogFar: 340,
    windowColor: '#cfe4ff', windowIntensity: 1.8,
    streetlightColor: '#f4f8ff', streetlightIntensity: 1.9,
    neonIntensity: 1.7,
  },
  2025: {
    keyColor: '#b7cfe6', keyIntensity: 0.6,
    fillColor: '#93b7ab', fillIntensity: 0.32,
    ambientColor: '#456170', ambientIntensity: 0.38,
    hemisphereSkyColor: '#2e4f58', hemisphereGroundColor: '#232c2a', hemisphereIntensity: 0.48,
    fogColor: '#3a6a6d', fogNear: 70, fogFar: 380,
    windowColor: '#ffe9c9', windowIntensity: 1.7,
    streetlightColor: '#ffd9a8', streetlightIntensity: 2.0,
    neonIntensity: 1.8,
  },
};

/**
 * Instantiate day/night cores per era. Neon color and base intensity come
 * from the real shared gfx library (`ProceduralGfxLibrary.getEraPalette`), so
 * signage glow automatically tracks the era material palette contract.
 */
function instantiateCores(seeds: Record<EraYear, EraCoreSeed>): Record<EraYear, AtmosphereCoreState> {
  const cores = {} as Record<EraYear, AtmosphereCoreState>;
  for (const year of ERA_YEARS) {
    const seed = seeds[year];
    const swatch = ProceduralGfxLibrary.getEraPalette(year).materials.neonEmissive;
    cores[year] = {
      keyColor: new THREE.Color(seed.keyColor),
      keyIntensity: seed.keyIntensity,
      fillColor: new THREE.Color(seed.fillColor),
      fillIntensity: seed.fillIntensity,
      ambientColor: new THREE.Color(seed.ambientColor),
      ambientIntensity: seed.ambientIntensity,
      hemisphereSkyColor: new THREE.Color(seed.hemisphereSkyColor),
      hemisphereGroundColor: new THREE.Color(seed.hemisphereGroundColor),
      hemisphereIntensity: seed.hemisphereIntensity,
      fogColor: new THREE.Color(seed.fogColor),
      fogNear: seed.fogNear,
      fogFar: seed.fogFar,
      windowColor: new THREE.Color(seed.windowColor),
      windowIntensity: seed.windowIntensity,
      neonColor: new THREE.Color(swatch.emissive ?? '#ffffff'),
      neonIntensity: (swatch.emissiveIntensity ?? 1) * seed.neonIntensity,
      streetlightColor: new THREE.Color(seed.streetlightColor),
      streetlightIntensity: seed.streetlightIntensity,
    };
  }
  return cores;
}

/** Daylight lighting/fog/emissive preset per era. */
export const ATMOSPHERE_DAY_CORES: Readonly<Record<EraYear, AtmosphereCoreState>> =
  instantiateCores(DAY_SEEDS);

/** Night lighting/fog/emissive preset per era (neon night lives here). */
export const ATMOSPHERE_NIGHT_CORES: Readonly<Record<EraYear, AtmosphereCoreState>> =
  instantiateCores(NIGHT_SEEDS);

function createCoreState(): AtmosphereCoreState {
  return {
    keyColor: new THREE.Color(0, 0, 0),
    keyIntensity: 0,
    fillColor: new THREE.Color(0, 0, 0),
    fillIntensity: 0,
    ambientColor: new THREE.Color(0, 0, 0),
    ambientIntensity: 0,
    hemisphereSkyColor: new THREE.Color(0, 0, 0),
    hemisphereGroundColor: new THREE.Color(0, 0, 0),
    hemisphereIntensity: 0,
    fogColor: new THREE.Color(0, 0, 0),
    fogNear: 0,
    fogFar: 0,
    windowColor: new THREE.Color(0, 0, 0),
    windowIntensity: 0,
    neonColor: new THREE.Color(0, 0, 0),
    neonIntensity: 0,
    streetlightColor: new THREE.Color(0, 0, 0),
    streetlightIntensity: 0,
  };
}

/** Blend two era cores into `target` (linear; no popping at any fraction). */
function blendCore(
  a: AtmosphereCoreState,
  b: AtmosphereCoreState,
  t: number,
  target: AtmosphereCoreState,
): AtmosphereCoreState {
  const k = clamp01(t);
  target.keyColor.lerpColors(a.keyColor, b.keyColor, k);
  target.keyIntensity = a.keyIntensity + (b.keyIntensity - a.keyIntensity) * k;
  target.fillColor.lerpColors(a.fillColor, b.fillColor, k);
  target.fillIntensity = a.fillIntensity + (b.fillIntensity - a.fillIntensity) * k;
  target.ambientColor.lerpColors(a.ambientColor, b.ambientColor, k);
  target.ambientIntensity = a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * k;
  target.hemisphereSkyColor.lerpColors(a.hemisphereSkyColor, b.hemisphereSkyColor, k);
  target.hemisphereGroundColor.lerpColors(a.hemisphereGroundColor, b.hemisphereGroundColor, k);
  target.hemisphereIntensity =
    a.hemisphereIntensity + (b.hemisphereIntensity - a.hemisphereIntensity) * k;
  target.fogColor.lerpColors(a.fogColor, b.fogColor, k);
  target.fogNear = a.fogNear + (b.fogNear - a.fogNear) * k;
  target.fogFar = a.fogFar + (b.fogFar - a.fogFar) * k;
  target.windowColor.lerpColors(a.windowColor, b.windowColor, k);
  target.windowIntensity = a.windowIntensity + (b.windowIntensity - a.windowIntensity) * k;
  target.neonColor.lerpColors(a.neonColor, b.neonColor, k);
  target.neonIntensity = a.neonIntensity + (b.neonIntensity - a.neonIntensity) * k;
  target.streetlightColor.lerpColors(a.streetlightColor, b.streetlightColor, k);
  target.streetlightIntensity =
    a.streetlightIntensity + (b.streetlightIntensity - a.streetlightIntensity) * k;
  return target;
}

// ---------------------------------------------------------------------------
// Module factory
// ---------------------------------------------------------------------------

/** Options for {@link createAtmosphere}. */
export interface CreateAtmosphereOptions {
  /** Scene to attach sky, weather, lights, and fog to. */
  scene: THREE.Scene;
  /** Era registry to auto-register into (registration is a constraint). */
  registry?: EraTransformRegistry | null;
  /** Renderer for tone mapping and the optional bloom chain. */
  renderer?: THREE.WebGLRenderer | null;
  /** Container for the CSS vignette layer (defaults to the canvas parent). */
  container?: HTMLElement | null;
  /** Starting quality tier (default `high`). */
  quality?: AtmosphereQuality;
  /** Starting day/night option mix, 0..1 (default 0 = day). */
  nightMix?: number;
  /** Starting era blend (default fully 1945). */
  initialBlend?: EraBlend;
  /** Optional deterministic particle seed override. */
  seed?: number;
}

function createAtmosphereState(nightMix: number, blend: EraBlend): AtmosphereState {
  return {
    eraBlend: { from: blend.from, to: blend.to, fraction: clamp01(blend.fraction) },
    nightMix: clamp01(nightMix),
    sky: createSkyState(),
    lighting: {
      keyColor: new THREE.Color(0, 0, 0),
      keyIntensity: 0,
      fillColor: new THREE.Color(0, 0, 0),
      fillIntensity: 0,
      ambientColor: new THREE.Color(0, 0, 0),
      ambientIntensity: 0,
      hemisphereSkyColor: new THREE.Color(0, 0, 0),
      hemisphereGroundColor: new THREE.Color(0, 0, 0),
      hemisphereIntensity: 0,
      keyDirection: new THREE.Vector3(0, 1, 0),
    },
    fog: { color: new THREE.Color(0, 0, 0), near: 0, far: 0 },
    emissive: {
      windowColor: new THREE.Color(0, 0, 0),
      windowIntensity: 0,
      neonColor: new THREE.Color(0, 0, 0),
      neonIntensity: 0,
      streetlightColor: new THREE.Color(0, 0, 0),
      streetlightIntensity: 0,
    },
    weather: createWeatherState(),
    postFx: createPostFxState(),
  };
}

/**
 * Build the atmosphere module: attaches the procedural sky dome, era lights,
 * fog, and instanced weather to `options.scene`, auto-registers into
 * `options.registry` when provided, and primes the state to the initial blend.
 */
export function createAtmosphere(options: CreateAtmosphereOptions): AtmosphereModule {
  const { scene } = options;
  const initialBlend: EraBlend = options.initialBlend ?? {
    from: ERA_YEARS[0],
    to: ERA_YEARS[1],
    fraction: 0,
  };
  const state = createAtmosphereState(options.nightMix ?? 0, initialBlend);
  let quality: AtmosphereQuality = options.quality ?? 'high';
  let lastDispatch: AtmosphereDispatchRecord | null = null;
  let autoUnregister: (() => void) | null = null;
  let disposed = false;

  // --- Sky -----------------------------------------------------------------
  const sky = createSkyDome();
  scene.add(sky.mesh);

  // --- Lights: reuse shell lights when present, otherwise create our own ---
  const createdLights: THREE.Object3D[] = [];
  const borrowedLights: Array<{ light: THREE.Light; color: THREE.Color; intensity: number }> = [];

  const existingKey = scene.getObjectByName('sunLight');
  let key: THREE.DirectionalLight;
  let ownsKey: boolean;
  if (existingKey instanceof THREE.DirectionalLight) {
    key = existingKey;
    ownsKey = false;
    borrowedLights.push({ light: key, color: key.color.clone(), intensity: key.intensity });
  } else {
    key = new THREE.DirectionalLight(0xffffff, 2);
    key.name = 'atmosphereKeyLight';
    ownsKey = true;
    createdLights.push(key);
  }

  const existingHemi = scene.getObjectByName('hemisphereLight');
  let hemisphere: THREE.HemisphereLight;
  let ownsHemisphere: boolean;
  if (existingHemi instanceof THREE.HemisphereLight) {
    hemisphere = existingHemi;
    ownsHemisphere = false;
    borrowedLights.push({
      light: hemisphere,
      color: hemisphere.color.clone(),
      intensity: hemisphere.intensity,
    });
  } else {
    hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    hemisphere.name = 'atmosphereHemisphereLight';
    ownsHemisphere = true;
    createdLights.push(hemisphere);
  }

  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.name = 'atmosphereFillLight';
  createdLights.push(fill);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  ambient.name = 'atmosphereAmbientLight';
  createdLights.push(ambient);

  for (const object of createdLights) scene.add(object);

  const lights: AtmosphereLightRig = { key, fill, ambient, hemisphere, ownsKey, ownsHemisphere };

  // --- Fog/background: remember whatever was there before ------------------
  const previousFog = scene.fog;
  const previousBackground = scene.background;
  const fog = new THREE.Fog(0x9ec7e8, 60, 320);
  scene.fog = fog;
  const backgroundColor = new THREE.Color(0x9ec7e8);
  scene.background = backgroundColor;

  // --- Weather + post -------------------------------------------------------
  const weather = createWeatherSystem({ quality, seed: options.seed });
  scene.add(weather.root);
  const postFx = createPostFx({
    renderer: options.renderer ?? null,
    container: options.container ?? null,
    quality,
  });

  // --- Blending scratch (allocated once; recompute never allocates) ---------
  const coreFrom = createCoreState();
  const coreTo = createCoreState();
  const skyFrom = createSkyState();
  const skyTo = createSkyState();
  const postFrom = createPostFxState();
  const postTo = createPostFxState();
  const scratchDirection = new THREE.Vector3();
  const fillDirection = new THREE.Vector3();

  /** Copy the blended core into the public state's sub-objects. */
  const writeCore = (core: AtmosphereCoreState): void => {
    const { lighting, fog: fogState, emissive } = state;
    lighting.keyColor.copy(core.keyColor);
    lighting.keyIntensity = core.keyIntensity;
    lighting.fillColor.copy(core.fillColor);
    lighting.fillIntensity = core.fillIntensity;
    lighting.ambientColor.copy(core.ambientColor);
    lighting.ambientIntensity = core.ambientIntensity;
    lighting.hemisphereSkyColor.copy(core.hemisphereSkyColor);
    lighting.hemisphereGroundColor.copy(core.hemisphereGroundColor);
    lighting.hemisphereIntensity = core.hemisphereIntensity;
    fogState.color.copy(core.fogColor);
    fogState.near = core.fogNear;
    fogState.far = Math.max(core.fogFar, core.fogNear + 1);
    emissive.windowColor.copy(core.windowColor);
    emissive.windowIntensity = core.windowIntensity;
    emissive.neonColor.copy(core.neonColor);
    emissive.neonIntensity = core.neonIntensity;
    emissive.streetlightColor.copy(core.streetlightColor);
    emissive.streetlightIntensity = core.streetlightIntensity;
  };

  /** Push the public state into the scene graph, lights, fog, and post chain. */
  const applyToScene = (): void => {
    const { lighting, fog: fogState } = state;

    sky.apply(state.sky);

    lighting.keyDirection.copy(sunDirection(state.sky, scratchDirection));
    lights.key.position.copy(lighting.keyDirection).multiplyScalar(KEY_LIGHT_DISTANCE);
    lights.key.color.copy(lighting.keyColor);
    lights.key.intensity = lighting.keyIntensity;

    // Fill comes from the opposite azimuth, lower than the key.
    fillDirection.copy(lighting.keyDirection).multiplyScalar(-1);
    fillDirection.y = Math.abs(fillDirection.y) * 0.35 + 0.3;
    fillDirection.normalize();
    lights.fill.position.copy(fillDirection).multiplyScalar(FILL_LIGHT_DISTANCE);
    lights.fill.color.copy(lighting.fillColor);
    lights.fill.intensity = lighting.fillIntensity;

    lights.ambient.color.copy(lighting.ambientColor);
    lights.ambient.intensity = lighting.ambientIntensity;

    lights.hemisphere.color.copy(lighting.hemisphereSkyColor);
    lights.hemisphere.groundColor.copy(lighting.hemisphereGroundColor);
    lights.hemisphere.intensity = lighting.hemisphereIntensity;

    fog.color.copy(fogState.color);
    fog.near = fogState.near;
    fog.far = fogState.far;

    backgroundColor.copy(state.sky.horizon);

    weather.apply(state.weather, quality);
    postFx.apply(state.postFx);
  };

  /** Recompute the full state from night mix + shared era blend, then apply. */
  const recompute = (): void => {
    const { from, to, fraction } = state.eraBlend;
    const eraT = clamp01(fraction);
    const nightT = state.nightMix;

    // Lighting/fog/emissive: night crossfade per era, then the era crossfade.
    blendCore(ATMOSPHERE_DAY_CORES[from], ATMOSPHERE_NIGHT_CORES[from], nightT, coreFrom);
    blendCore(ATMOSPHERE_DAY_CORES[to], ATMOSPHERE_NIGHT_CORES[to], nightT, coreTo);
    blendCore(coreFrom, coreTo, eraT, coreFrom);
    writeCore(coreFrom);

    // Sky/sun: same two-stage blend; keyDirection follows the blended sun.
    lerpSkyState(SKY_DAY_STATES[from], SKY_NIGHT_STATES[from], nightT, skyFrom);
    lerpSkyState(SKY_DAY_STATES[to], SKY_NIGHT_STATES[to], nightT, skyTo);
    lerpSkyState(skyFrom, skyTo, eraT, state.sky);

    // Weather is era-driven only (day/night does not change particle mix).
    lerpWeatherState(ERA_WEATHER[from], ERA_WEATHER[to], eraT, state.weather);

    // Post grade: night crossfade per era, then era crossfade.
    lerpPostFxState(POSTFX_DAY_STATES[from], POSTFX_NIGHT_STATES[from], nightT, postFrom);
    lerpPostFxState(POSTFX_DAY_STATES[to], POSTFX_NIGHT_STATES[to], nightT, postTo);
    lerpPostFxState(postFrom, postTo, eraT, state.postFx);

    applyToScene();
  };

  const module: AtmosphereModule = {
    stage: ATMOSPHERE_STAGE,
    name: 'atmosphere',
    state,
    sky,
    weather,
    postFx,
    lights,
    get lastDispatch(): AtmosphereDispatchRecord | null {
      return lastDispatch;
    },
    get quality(): AtmosphereQuality {
      return quality;
    },

    applyEraBlend(blend: EraBlend, stageOffset: number, progress: number): void {
      lastDispatch = {
        blend: { from: blend.from, to: blend.to, fraction: clamp01(blend.fraction) },
        stageOffset,
        progress,
      };
      state.eraBlend = lastDispatch.blend;
      recompute();
    },

    setNightMix(nightMix: number): void {
      const next = clamp01(nightMix);
      if (next === state.nightMix) return;
      state.nightMix = next;
      recompute();
    },

    setQuality(next: AtmosphereQuality): void {
      if (next === quality) return;
      quality = next;
      postFx.setQuality(next);
      weather.apply(state.weather, quality);
    },

    register(registry: EraTransformRegistry): () => void {
      return registry.register(module);
    },

    update(deltaSeconds: number, camera?: THREE.Camera | null): void {
      if (disposed) return;
      weather.update(deltaSeconds, camera);
    },

    renderFrame(sceneTarget: THREE.Scene, camera: THREE.Camera, deltaSeconds: number = 0): void {
      if (disposed) return;
      postFx.render(sceneTarget, camera, deltaSeconds);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      autoUnregister?.();
      autoUnregister = null;
      sky.dispose();
      weather.dispose();
      postFx.dispose();
      for (const object of createdLights) object.removeFromParent();
      for (const borrowed of borrowedLights) {
        borrowed.light.color.copy(borrowed.color);
        borrowed.light.intensity = borrowed.intensity;
      }
      scene.fog = previousFog;
      scene.background = previousBackground;
    },
  };

  // Registration constraint: auto-register into the shared era registry.
  if (options.registry) autoUnregister = module.register(options.registry);

  recompute();
  return module;
}
