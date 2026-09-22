/**
 * Per-era sky dome: vertical gradient, sun disc and halo, cloud band and stars.
 *
 * The dome is a back-facing sphere rendered from the era's resolved
 * {@link SkyConfig}: the era record supplies the gradient colours, sun colour and
 * sun position, and the per-era VFX table supplies the disc size, glow, gradient
 * tightness, cloud strength and starfield. Everything the dome draws is a pure
 * function of those values plus the caller's clock, so two runs of the same era
 * look identical and two different eras never do.
 *
 * The module also owns the small colour helpers the rest of the layer blends
 * with ({@link mixHexColors} and friends): they are plain sRGB-to-linear maths
 * over `three`'s `Color`, with no GPU involved.
 *
 * The dome is *content*, not a light: it never touches the lighting rig, the
 * renderer or the post-processing chain. `src/vfx/tables.ts` and
 * `src/vfx/VfxLayer.tsx` are the only modules that decide when it is rebuilt.
 */

import { BackSide, Color, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { EraDefinition, HexColor } from '../era'
import { clamp, degreesToRadians, sunDirectionFromAngles } from '../scene'
import type { SkyConfig, SkyDome, Vec3, VfxEraTable } from './types'

/* -------------------------------------------------------------------------- */
/* Names + constants                                                           */
/* -------------------------------------------------------------------------- */

/** World-group name of the atmosphere's sky content (asserted by QA). */
export const SKY_GROUP_NAME = 'vfx-sky'

/** Mesh name of the gradient dome itself. */
export const SKY_DOME_NAME = 'vfx-sky-dome'

/** Elevation (degrees) at or below which an era counts as a night scene. */
export const NIGHT_ELEVATION_DEG = 0

/** Fraction of the camera's far plane the dome occupies. */
export const SKY_RADIUS_FRACTION = 0.82

/** Smallest dome radius, so a tiny far plane still shows a sky. */
export const MIN_SKY_RADIUS = 40

/** Circle segments of the dome. Kept modest: it is a flat gradient. */
const SKY_WIDTH_SEGMENTS = 32
const SKY_HEIGHT_SEGMENTS = 20

/** Uniform names, exported so tests can assert the era surface reaches the GPU. */
export const SKY_UNIFORM_NAMES = [
  'uTopColor',
  'uHorizonColor',
  'uGroundColor',
  'uSunColor',
  'uSunDirection',
  'uSunDiscCos',
  'uSunGlow',
  'uHorizonSharpness',
  'uCloudOpacity',
  'uStarOpacity',
  'uExposure',
  'uTime',
] as const

/* -------------------------------------------------------------------------- */
/* Colour helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Reads a colour, falling back to `fallback` when the value is unusable. */
export function readColor(value: string | undefined, fallback: string): Color {
  try {
    return new Color(value ?? fallback)
  } catch {
    return new Color(fallback)
  }
}

/** Linear-space mix of two `#rrggbb` colours as a `#rrggbb` string. */
export function mixHexColors(from: HexColor, to: HexColor, amount: number): HexColor {
  const t = clamp(amount, 0, 1)
  const mixed = readColor(from, from).lerp(readColor(to, to), t)
  return `#${mixed.getHexString()}`
}

/** Hex colour to a linear RGB triple. */
export function hexToChannels(value: HexColor): readonly [number, number, number] {
  const color = readColor(value, '#000000')
  return [color.r, color.g, color.b]
}

/** Linear RGB triple back to a `#rrggbb` colour. */
export function channelsToHex(channels: readonly [number, number, number]): HexColor {
  return `#${new Color(channels[0], channels[1], channels[2]).getHexString()}`
}

/** Linear interpolation of two finite numbers. */
export function mixNumber(from: number, to: number, amount: number): number {
  const t = clamp(amount, 0, 1)
  return from + (to - from) * t
}

/** Linear interpolation of a unit direction, re-normalised. */
function mixDirection(from: Vec3, to: Vec3, amount: number): Vec3 {
  const t = clamp(amount, 0, 1)
  const x = mixNumber(from[0], to[0], t)
  const y = mixNumber(from[1], to[1], t)
  const z = mixNumber(from[2], to[2], t)
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/** Dome radius for a camera far plane, clamped to a usable range. */
export function skyRadiusFor(drawDistance: number): number {
  const far = Number.isFinite(drawDistance) && drawDistance > 0 ? drawDistance : 240
  return Math.max(MIN_SKY_RADIUS, far * SKY_RADIUS_FRACTION)
}

/** True when the era's key light sits at or below the horizon. */
export function isNightEra(era: EraDefinition): boolean {
  return era.lighting.sunElevationDeg <= NIGHT_ELEVATION_DEG
}

/**
 * Resolves the sky of one era.
 *
 * The base gradient and sun come from the era record, the shape and glow values
 * from the per-era table, and cloud strength combines the table's band strength
 * with the era's `atmosphere.cloudCover` so overcast periods read overcast.
 */
export function resolveSkyConfig(era: EraDefinition, table: VfxEraTable): SkyConfig {
  const { lighting, atmosphere } = era
  const night = isNightEra(era)
  const azimuth = degreesToRadians(lighting.sunAzimuthDeg)
  const elevation = degreesToRadians(lighting.sunElevationDeg)
  return {
    topColor: lighting.skyTopColor,
    horizonColor: lighting.skyHorizonColor,
    groundColor: table.sky.groundColor,
    sunColor: lighting.sunColor,
    sunDiscSizeRad: degreesToRadians(Math.max(0.05, table.sky.sunDiscSizeDeg)),
    sunGlow: clamp(table.sky.sunGlow, 0, 1),
    horizonSharpness: clamp(table.sky.horizonSharpness, 0.05, 4),
    cloudOpacity: clamp(table.sky.cloudOpacity * (0.4 + 0.9 * atmosphere.cloudCover), 0, 1),
    // Stars only read once the key light is below the horizon.
    starOpacity: clamp(night ? table.sky.starOpacity : 0, 0, 1),
    exposure: clamp(lighting.exposure, 0.05, 4),
    sunDirection: sunDirectionFromAngles(azimuth, elevation),
  }
}

/** Interpolates two resolved skies; drives a staged era change. */
export function blendSkyConfig(from: SkyConfig, to: SkyConfig, t: number): SkyConfig {
  if (t <= 0) {
    return from
  }
  if (t >= 1) {
    return to
  }
  return {
    topColor: mixHexColors(from.topColor, to.topColor, t),
    horizonColor: mixHexColors(from.horizonColor, to.horizonColor, t),
    groundColor: mixHexColors(from.groundColor, to.groundColor, t),
    sunColor: mixHexColors(from.sunColor, to.sunColor, t),
    sunDiscSizeRad: mixNumber(from.sunDiscSizeRad, to.sunDiscSizeRad, t),
    sunGlow: mixNumber(from.sunGlow, to.sunGlow, t),
    horizonSharpness: mixNumber(from.horizonSharpness, to.horizonSharpness, t),
    cloudOpacity: mixNumber(from.cloudOpacity, to.cloudOpacity, t),
    starOpacity: mixNumber(from.starOpacity, to.starOpacity, t),
    exposure: mixNumber(from.exposure, to.exposure, t),
    sunDirection: mixDirection(from.sunDirection, to.sunDirection, t),
  }
}

/* -------------------------------------------------------------------------- */
/* Shaders                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Sky vertex shader.
 *
 * The world-space view direction is interpolated to the fragment stage, so the
 * gradient is a function of direction (not of screen position) and the dome
 * stays seamless however the camera is oriented.
 */
export const SKY_VERTEX_SHADER = `
varying vec3 vSkyDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vSkyDirection = worldPosition.xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Sky fragment shader.
 *
 * Portions: horizon-to-top gradient, below-horizon fallback colour, sun disc
 * plus halo, a drifting cloud band weighted by cloud cover and a hash starfield
 * that only shows once the era sets its star opacity. Every term is uniform
 * driven, so one dome renders all eras.
 */
export const SKY_FRAGMENT_SHADER = `
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundColor;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunDiscCos;
uniform float uSunGlow;
uniform float uHorizonSharpness;
uniform float uCloudOpacity;
uniform float uStarOpacity;
uniform float uExposure;
uniform float uTime;

varying vec3 vSkyDirection;

float skyHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
    mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec3 direction = normalize(vSkyDirection);
  float height = direction.y;

  float up = smoothstep(0.0, max(uHorizonSharpness, 0.001), max(height, 0.0));
  float down = smoothstep(0.0, 0.36, max(-height, 0.0));
  vec3 color = mix(uHorizonColor, uTopColor, up);
  color = mix(color, uGroundColor, down);

  float alignment = max(dot(direction, normalize(uSunDirection)), 0.0);
  float disc = smoothstep(uSunDiscCos, uSunDiscCos + 0.0025, alignment);
  float halo = pow(alignment, 28.0) * uSunGlow;
  color += uSunColor * (disc * 1.8 + halo);

  float band = exp(-pow((height - 0.09) / 0.22, 2.0));
  float clouds = skyNoise(vec2(direction.x, direction.z) * 3.5 + vec2(uTime * 0.012, uTime * 0.004));
  color = mix(color, mix(color, vec3(1.0), 0.4), band * uCloudOpacity * (0.45 + 0.55 * clouds));

  float starField = step(0.9965, skyHash(floor(vec2(direction.x, direction.z) * 320.0) + floor(direction.y * 320.0)));
  color += vec3(starField * uStarOpacity * smoothstep(0.03, 0.5, height));

  gl_FragColor = vec4(max(color, vec3(0.0)) * uExposure, 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Dome                                                                        */
/* -------------------------------------------------------------------------- */

/** Options for {@link createSkyDome}. */
export interface SkyDomeOptions {
  /** Dome radius in metres; use {@link skyRadiusFor} for the pipeline's far plane. */
  readonly radius: number
}

/**
 * Builds the gradient dome.
 *
 * The material is depth-write free and drawn first, so it acts as a background
 * for the block without ever occluding it or fighting the pipeline's fog (the
 * dome deliberately ignores fog: haze is a separate, low-lying layer).
 */
export function createSkyDome(options: SkyDomeOptions): SkyDome {
  const radius = Math.max(MIN_SKY_RADIUS, Number.isFinite(options.radius) ? options.radius : MIN_SKY_RADIUS)
  const geometry = new SphereGeometry(radius, SKY_WIDTH_SEGMENTS, SKY_HEIGHT_SEGMENTS)
  const material = new ShaderMaterial({
    name: 'vfx-sky-material',
    uniforms: {
      uTopColor: { value: new Color('#7b8794') },
      uHorizonColor: { value: new Color('#d9c3a3') },
      uGroundColor: { value: new Color('#4a4034') },
      uSunColor: { value: new Color('#ffc98a') },
      uSunDirection: { value: new Vector3(0, 1, 0) },
      uSunDiscCos: { value: Math.cos(degreesToRadians(1)) },
      uSunGlow: { value: 0.3 },
      uHorizonSharpness: { value: 0.6 },
      uCloudOpacity: { value: 0.4 },
      uStarOpacity: { value: 0 },
      uExposure: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  })

  const mesh = new Mesh(geometry, material)
  mesh.name = SKY_DOME_NAME
  // The dome always surrounds the camera, so culling it can only ever lose it.
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()

  const object = new Group()
  object.name = SKY_GROUP_NAME
  object.add(mesh)

  const applyUniforms = (config: SkyConfig): void => {
    const uniforms = material.uniforms
    uniforms['uTopColor']?.value.copy(readColor(config.topColor, '#7b8794'))
    uniforms['uHorizonColor']?.value.copy(readColor(config.horizonColor, '#d9c3a3'))
    uniforms['uGroundColor']?.value.copy(readColor(config.groundColor, '#4a4034'))
    uniforms['uSunColor']?.value.copy(readColor(config.sunColor, '#ffc98a'))
    const direction = uniforms['uSunDirection']?.value as Vector3
    direction.set(config.sunDirection[0], config.sunDirection[1], config.sunDirection[2])
    if (direction.lengthSq() === 0) {
      direction.set(0, 1, 0)
    }
    direction.normalize()
    const discCos = Math.cos(clamp(config.sunDiscSizeRad, 0.0005, Math.PI / 2))
    if (uniforms['uSunDiscCos'] !== undefined) {
      uniforms['uSunDiscCos'].value = discCos
    }
    if (uniforms['uSunGlow'] !== undefined) {
      uniforms['uSunGlow'].value = config.sunGlow
    }
    if (uniforms['uHorizonSharpness'] !== undefined) {
      uniforms['uHorizonSharpness'].value = config.horizonSharpness
    }
    if (uniforms['uCloudOpacity'] !== undefined) {
      uniforms['uCloudOpacity'].value = config.cloudOpacity
    }
    if (uniforms['uStarOpacity'] !== undefined) {
      uniforms['uStarOpacity'].value = config.starOpacity
    }
    if (uniforms['uExposure'] !== undefined) {
      uniforms['uExposure'].value = config.exposure
    }
  }

  const dome: SkyDome = {
    object,
    radius,
    apply: applyUniforms,
    setTime(seconds: number): void {
      const time = material.uniforms['uTime']
      if (time !== undefined) {
        time.value = Number.isFinite(seconds) ? seconds : 0
      }
    },
    dispose(): void {
      object.remove(mesh)
      geometry.dispose()
      material.dispose()
      object.removeFromParent()
    },
  }

  return dome
}
