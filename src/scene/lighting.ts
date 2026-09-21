/**
 * Parameter-driven lighting rig.
 *
 * The rig is the *only* place in the project that decides what a sun, a sky or
 * a night looks like. Era content layers, the transition director and the
 * demo harness hand it plain {@link LightingParams} and it rebuilds the whole
 * light/hemisphere/background/fog configuration from them:
 *
 * - `sun` — a shadow-casting directional light placed from azimuth/elevation
 *   and framed so its shadow camera covers the block.
 * - `hemisphere` — sky/ground bounce, driven by the sky and ground tints.
 * - `ambient` — flat fill so shadows never go black, plus a night city-glow
 *   lift.
 * - `scene.background` and `scene.fog` — follow the sky tint unless the caller
 *   overrides them explicitly.
 *
 * Every derived value is computed by pure functions, so the look of a preset
 * can be asserted without a GPU.
 */

import { AmbientLight, Color, DirectionalLight, FogExp2, Group, HemisphereLight } from 'three'
import type { Scene } from 'three'
import { clamp, degreesToRadians } from './controls'
import type { LightingParams, LightingPresetName, LightingRig, Vec3 } from './types'

/* -------------------------------------------------------------------------- */
/* Pure: parameters, presets and the resolved profile                          */
/* -------------------------------------------------------------------------- */

/** Signed multiplier applied to the sun's intensity in night mode. */
export const NIGHT_SUN_FACTOR = 0.22

/** Colour the sun shifts towards after dusk (moonlight). */
export const MOON_COLOR = '#9db8ff'

/** Colour the sky and background collapse towards at night. */
export const NIGHT_SKY_COLOR = '#050a18'

/** Colour the city's own light pollution adds to the night ambient. */
export const NIGHT_GLOW_COLOR = '#2b3d63'

/** Default parameter set: a clear late-morning sun over the block. */
export const DAY_LIGHTING: LightingParams = {
  sunAzimuth: degreesToRadians(135),
  sunElevation: degreesToRadians(52),
  sunColor: '#fff3e0',
  sunIntensity: 2.4,
  ambientIntensity: 0.35,
  skyTint: '#9dc4ff',
  groundTint: '#2c3140',
  night: false,
  fogColor: '#a9c3e4',
  fogDensity: 0.0032,
  backgroundColor: '#8fb1d9',
}

/** Low, warm sun with long shadows. */
export const GOLDEN_HOUR_LIGHTING: LightingParams = {
  sunAzimuth: degreesToRadians(255),
  sunElevation: degreesToRadians(11),
  sunColor: '#ffb066',
  sunIntensity: 3.1,
  ambientIntensity: 0.4,
  skyTint: '#ffc98f',
  groundTint: '#3a2b25',
  night: false,
  fogColor: '#e0a273',
  fogDensity: 0.0055,
  backgroundColor: '#d9955f',
}

/** Blue hour: sun just below the horizon, city lights starting to read. */
export const DUSK_LIGHTING: LightingParams = {
  sunAzimuth: degreesToRadians(285),
  sunElevation: degreesToRadians(-3),
  sunColor: '#ff9d6b',
  sunIntensity: 1.2,
  ambientIntensity: 0.5,
  skyTint: '#5d6fa8',
  groundTint: '#20222e',
  night: true,
  fogColor: '#4a5c86',
  fogDensity: 0.0062,
  backgroundColor: '#3c4a6d',
}

/** Full night: dim cool moon, dark sky, strong city-glow ambient. */
export const NIGHT_LIGHTING: LightingParams = {
  sunAzimuth: degreesToRadians(300),
  sunElevation: degreesToRadians(38),
  sunColor: '#cfe0ff',
  sunIntensity: 2.2,
  ambientIntensity: 0.5,
  skyTint: '#2a3a63',
  groundTint: '#12161f',
  night: true,
  fogColor: '#141c31',
  fogDensity: 0.005,
  backgroundColor: '#0b1220',
}

/** Named presets the overlay, era layers and QA can switch between. */
export const LIGHTING_PRESET_PARAMS: Readonly<Record<LightingPresetName, LightingParams>> = {
  day: DAY_LIGHTING,
  goldenHour: GOLDEN_HOUR_LIGHTING,
  dusk: DUSK_LIGHTING,
  night: NIGHT_LIGHTING,
}

/** Every numeric lighting field, in the order the blend helper walks them. */
const LIGHTING_NUMERIC_KEYS = [
  'sunAzimuth',
  'sunElevation',
  'sunIntensity',
  'ambientIntensity',
  'fogDensity',
] as const satisfies readonly (keyof LightingParams)[]

/** Every colour field, as `[field, fallback when undefined]` pairs. */
const LIGHTING_COLOR_KEYS = [
  ['sunColor', DAY_LIGHTING.sunColor],
  ['skyTint', DAY_LIGHTING.skyTint],
  ['groundTint', DAY_LIGHTING.groundTint],
  ['fogColor', DAY_LIGHTING.fogColor ?? DAY_LIGHTING.skyTint],
  ['backgroundColor', DAY_LIGHTING.backgroundColor ?? DAY_LIGHTING.skyTint],
] as const

/** Resolved look of a parameter set, after the night-mode switch is applied. */
export interface ResolvedLighting {
  readonly sunColor: string
  readonly sunIntensity: number
  readonly skyTint: string
  readonly groundTint: string
  readonly ambientIntensity: number
  readonly backgroundColor: string
  readonly fogColor: string
  readonly fogDensity: number
  /** Unit vector pointing from the block towards the sun/moon. */
  readonly sunDirection: Vec3
  /** True when night mode reshaped the inputs. */
  readonly night: boolean
}

/** Unit direction towards the sun for an azimuth/elevation pair (radians). */
export function sunDirectionFromAngles(azimuth: number, elevation: number): Vec3 {
  const cosElevation = Math.cos(elevation)
  return [
    cosElevation * Math.sin(azimuth),
    Math.sin(elevation),
    cosElevation * Math.cos(azimuth),
  ]
}

/** True when the elevation puts the light source below the horizon. */
export function isSunBelowHorizon(params: LightingParams): boolean {
  return params.sunElevation <= 0
}

function readColor(value: string | undefined, fallback: string): Color {
  try {
    return new Color(value ?? fallback)
  } catch {
    return new Color(fallback)
  }
}

function mixColor(base: string, towards: string, amount: number): string {
  return `#${readColor(base, base).lerp(readColor(towards, towards), clamp(amount, 0, 1)).getHexString()}`
}

/** Merges a patch onto a base parameter set and clamps every value. */
export function createLightingParams(
  patch: Partial<LightingParams> = {},
  base: LightingParams = DAY_LIGHTING,
): LightingParams {
  return {
    sunAzimuth: patch.sunAzimuth ?? base.sunAzimuth,
    sunElevation: clamp(patch.sunElevation ?? base.sunElevation, -Math.PI / 2, Math.PI / 2),
    sunColor: patch.sunColor ?? base.sunColor,
    sunIntensity: clamp(patch.sunIntensity ?? base.sunIntensity, 0, 40),
    ambientIntensity: clamp(patch.ambientIntensity ?? base.ambientIntensity, 0, 10),
    skyTint: patch.skyTint ?? base.skyTint,
    groundTint: patch.groundTint ?? base.groundTint,
    night: patch.night ?? base.night,
    fogColor: patch.fogColor ?? base.fogColor,
    fogDensity: clamp(patch.fogDensity ?? base.fogDensity ?? 0, 0, 0.25),
    backgroundColor: patch.backgroundColor ?? base.backgroundColor,
  }
}

/** Resolves a preset name (or parameter record) into a full parameter set. */
export function resolveLightingPreset(
  preset: LightingPresetName | LightingParams,
  base: LightingParams = DAY_LIGHTING,
): LightingParams {
  return typeof preset === 'string'
    ? createLightingParams(LIGHTING_PRESET_PARAMS[preset], base)
    : createLightingParams(preset, base)
}

/**
 * Applies the night-mode switch and derives the final look.
 *
 * Night mode is a *look*, not a second code path: the caller still supplies the
 * sun angles and palette, and the rig cools the sun towards moonlight, sinks
 * the sky towards {@link NIGHT_SKY_COLOR} and lifts the ambient with a
 * city-glow contribution so the street stays readable.
 */
export function resolveLightingProfile(params: LightingParams): ResolvedLighting {
  const sunDirection = sunDirectionFromAngles(params.sunAzimuth, params.sunElevation)
  if (!params.night) {
    return {
      sunColor: params.sunColor,
      sunIntensity: params.sunIntensity,
      skyTint: params.skyTint,
      groundTint: params.groundTint,
      ambientIntensity: params.ambientIntensity,
      backgroundColor: params.backgroundColor ?? params.skyTint,
      fogColor: params.fogColor ?? params.skyTint,
      fogDensity: params.fogDensity ?? 0,
      sunDirection,
      night: false,
    }
  }
  const skyTint = mixColor(params.skyTint, NIGHT_SKY_COLOR, 0.72)
  return {
    sunColor: mixColor(params.sunColor, MOON_COLOR, 0.7),
    sunIntensity: params.sunIntensity * NIGHT_SUN_FACTOR,
    skyTint,
    groundTint: mixColor(params.groundTint, NIGHT_GLOW_COLOR, 0.45),
    // City glow: part of the input ambient survives, plus a fixed floor.
    ambientIntensity: clamp(params.ambientIntensity * 0.7 + 0.28, 0, 10),
    backgroundColor: mixColor(params.backgroundColor ?? params.skyTint, NIGHT_SKY_COLOR, 0.7),
    fogColor: mixColor(params.fogColor ?? skyTint, NIGHT_SKY_COLOR, 0.6),
    fogDensity: clamp((params.fogDensity ?? 0) * 1.35, 0, 0.25),
    sunDirection,
    night: true,
  }
}

/** Linear blend between two parameter sets; drives era transitions. */
export function blendLightingParams(
  from: LightingParams,
  to: LightingParams,
  alpha: number,
): LightingParams {
  const t = clamp(alpha, 0, 1)
  const blended: Record<string, unknown> = { ...from }
  for (const key of LIGHTING_NUMERIC_KEYS) {
    const start = from[key] ?? 0
    const end = to[key] ?? start
    blended[key] = start + (end - start) * t
  }
  for (const [key, fallback] of LIGHTING_COLOR_KEYS) {
    blended[key] = mixColor(from[key] ?? fallback, to[key] ?? fallback, t)
  }
  blended['night'] = t < 0.5 ? from.night : to.night
  return createLightingParams(blended as Partial<LightingParams>)
}

/* -------------------------------------------------------------------------- */
/* Rig                                                                         */
/* -------------------------------------------------------------------------- */

/** Options for {@link createLightingRig}. */
export interface LightingRigOptions {
  /** Scene the rig writes background and fog into. */
  readonly scene?: Scene
  readonly params?: Partial<LightingParams>
  /** Whether the sun casts shadows; the quality tier drives this. */
  readonly castShadows?: boolean
  /** Shadow map edge length in pixels. */
  readonly shadowMapSize?: number
  /** Half-extent of the shadow-casting area around the origin, world units. */
  readonly shadowExtent?: number
  /** Adds the lights to a parent (usually the scene) when provided. */
  readonly parent?: Group | Scene
}

/**
 * Creates the lighting rig.
 *
 * Lights are created once and mutated in place; only the parameter-driven
 * values change, so switching era lighting never re-allocates GPU resources.
 */
export function createLightingRig(options: LightingRigOptions = {}): LightingRig {
  const params = createLightingParams(options.params, DAY_LIGHTING)
  const group = new Group()
  group.name = 'lighting-rig'

  const sun = new DirectionalLight(params.sunColor, params.sunIntensity)
  sun.name = 'sun-light'
  sun.castShadow = options.castShadows ?? true
  const shadowExtent = options.shadowExtent ?? 62
  sun.shadow.camera.left = -shadowExtent
  sun.shadow.camera.right = shadowExtent
  sun.shadow.camera.top = shadowExtent
  sun.shadow.camera.bottom = -shadowExtent
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = shadowExtent * 6
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.022
  const shadowMapSize = options.shadowMapSize ?? 1024
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)

  const hemisphere = new HemisphereLight(params.skyTint, params.groundTint, 0.6)
  hemisphere.name = 'hemisphere-light'
  const ambient = new AmbientLight(0xffffff, params.ambientIntensity)
  ambient.name = 'ambient-light'

  group.add(sun, sun.target, hemisphere, ambient)
  options.parent?.add(group)

  const background = new Color(params.skyTint)
  const fog = new FogExp2(params.skyTint, params.fogDensity ?? 0)
  let current = params
  let profile = resolveLightingProfile(params)

  const applyProfile = (): void => {
    sun.color.set(profile.sunColor)
    sun.intensity = profile.sunIntensity
    sun.position.set(
      profile.sunDirection[0] * shadowExtent,
      Math.max(profile.sunDirection[1] * shadowExtent, shadowExtent * 0.08),
      profile.sunDirection[2] * shadowExtent,
    )
    sun.target.position.set(0, 0, 0)
    hemisphere.color.set(profile.skyTint)
    hemisphere.groundColor.set(profile.groundTint)
    // The hemisphere is the fill of last resort: it dims with the sun but never
    // reaches zero, so a night block still reads as a block.
    hemisphere.intensity = profile.night ? 0.34 : 0.6
    ambient.color.set(profile.night ? NIGHT_GLOW_COLOR : '#ffffff')
    ambient.intensity = profile.ambientIntensity
    background.set(profile.backgroundColor)
    fog.color.set(profile.fogColor)
    fog.density = profile.fogDensity
    if (options.scene !== undefined) {
      options.scene.background = background
      options.scene.fog = profile.fogDensity > 0 ? fog : null
    }
    sun.shadow.needsUpdate = true
  }

  const rig: LightingRig = {
    group,
    sun,
    hemisphere,
    ambient,
    get params(): LightingParams {
      return current
    },
    get sunDirection(): Vec3 {
      return profile.sunDirection
    },
    apply(patch: Partial<LightingParams>): LightingParams {
      current = createLightingParams(patch, current)
      profile = resolveLightingProfile(current)
      applyProfile()
      return current
    },
    blendTo(patch: Partial<LightingParams>, alpha: number): LightingParams {
      const destination = createLightingParams(patch, current)
      current = blendLightingParams(current, destination, alpha)
      profile = resolveLightingProfile(current)
      applyProfile()
      return current
    },
    configureShadows(settings: { mapSize?: number; castShadows?: boolean; softShadows?: boolean }): void {
      if (settings.castShadows !== undefined) {
        sun.castShadow = settings.castShadows
      }
      if (settings.mapSize !== undefined && Number.isFinite(settings.mapSize)) {
        const size = Math.max(256, Math.round(settings.mapSize))
        if (sun.shadow.mapSize.width !== size || sun.shadow.mapSize.height !== size) {
          sun.shadow.mapSize.set(size, size)
          sun.shadow.map?.dispose()
          sun.shadow.map = null
        }
      }
      if (settings.softShadows !== undefined) {
        sun.shadow.radius = settings.softShadows ? 3 : 1
        sun.shadow.blurSamples = settings.softShadows ? 12 : 4
      }
      sun.shadow.needsUpdate = true
    },
    dispose(): void {
      sun.shadow.map?.dispose()
      sun.shadow.map = null
      group.remove(sun, sun.target, hemisphere, ambient)
      group.removeFromParent()
      if (options.scene !== undefined) {
        options.scene.background = null
        options.scene.fog = null
      }
    },
  }

  applyProfile()
  return rig
}
