/**
 * Per-era fog and low-lying haze.
 *
 * Two cooperating pieces:
 *
 * 1. **Distance fog** — an exponential fog density and colour derived from the
 *    era's `atmosphere.hazeDensity`/`hazeColor` and written into the render
 *    pipeline's public lighting surface (`fogColor`/`fogDensity`). The pipeline's
 *    lighting rig owns the actual `FogExp2`; this module only decides the values,
 *    so the layer never touches renderer internals.
 * 2. **Ground haze** — a back-facing cylinder around the block, shaded from an
 *    opaque base to nothing at the top. It gives each period its own street-level
 *    air (coal smoke in 1945, sodium glare in 1985, crisp light in 2025) and it
 *    is where the wet-surface response of rain becomes visible: the haze wall
 *    brightens and thickens as the particle system reports wetness.
 */

import { BackSide, Color, CylinderGeometry, Group, Mesh, ShaderMaterial } from 'three'
import type { EraDefinition } from '../era'
import { clamp } from '../scene'
import { mixHexColors, mixNumber, readColor } from './sky'
import type { FogConfig, HazeLayer, WeatherState, VfxEraTable } from './types'

/* -------------------------------------------------------------------------- */
/* Names + constants                                                           */
/* -------------------------------------------------------------------------- */

/** World-group name of the atmosphere's haze content (asserted by QA). */
export const HAZE_GROUP_NAME = 'vfx-haze'

/** Mesh name of the haze wall. */
export const HAZE_WALL_NAME = 'vfx-haze-wall'

/**
 * Largest fog density the pipeline accepts.
 *
 * Mirrors `createLightingParams`, so the value written into the pipeline is
 * exactly the value the snapshot advertises.
 */
export const MAX_PIPELINE_FOG_DENSITY = 0.25

/** Base height of the haze wall before the era's falloff is applied. */
export const HAZE_HEIGHT_BASE = 18

/** Height of the haze wall geometry the layer creates. */
export const HAZE_GEOMETRY_HEIGHT = 18

/** Fraction of the sky radius the haze wall stands at. */
export const HAZE_RADIUS_FRACTION = 0.62

/** Uniform names of the haze wall, exported for tests. */
export const HAZE_UNIFORM_NAMES = ['uHazeColor', 'uOpacity', 'uWetness', 'uDensity', 'uTime'] as const

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the fog/haze of one era.
 *
 * The pipeline's fog density is the era haze density scaled by the table's
 * `densityScale`: the era value is written for a *height* falloff model, while
 * `FogExp2` is distance based, and the scale is what keeps five eras visibly
 * distinct instead of all of them being a solid wall of haze.
 */
export function resolveFogConfig(era: EraDefinition, table: VfxEraTable): FogConfig {
  const { atmosphere } = era
  const density = clamp(atmosphere.hazeDensity * table.haze.densityScale, 0, MAX_PIPELINE_FOG_DENSITY)
  const heightFalloff = clamp(atmosphere.hazeHeightFalloff, 0, 1)
  return {
    color: atmosphere.hazeColor,
    density,
    heightFalloff,
    groundHazeOpacity: clamp(table.haze.groundHazeOpacity * (0.4 + 1.2 * atmosphere.cloudCover), 0, 0.9),
    groundHazeHeight: clamp(HAZE_HEIGHT_BASE * (1.35 - heightFalloff), 8, 30),
    wetSurfaceLift: clamp(table.haze.wetSurfaceLift, 0, 1),
  }
}

/** Interpolates two resolved fog configurations; drives a staged era change. */
export function blendFogConfig(from: FogConfig, to: FogConfig, t: number): FogConfig {
  if (t <= 0) {
    return from
  }
  if (t >= 1) {
    return to
  }
  return {
    color: mixHexColors(from.color, to.color, t),
    density: mixNumber(from.density, to.density, t),
    heightFalloff: mixNumber(from.heightFalloff, to.heightFalloff, t),
    groundHazeOpacity: mixNumber(from.groundHazeOpacity, to.groundHazeOpacity, t),
    groundHazeHeight: mixNumber(from.groundHazeHeight, to.groundHazeHeight, t),
    wetSurfaceLift: mixNumber(from.wetSurfaceLift, to.wetSurfaceLift, t),
  }
}

/**
 * Applies the accumulated weather response to a fog configuration.
 *
 * Rain wets the air: the low-lying haze grows by the era's `wetSurfaceLift`
 * scaled by wetness, and snow accumulation brightens it the same way. The
 * distance fog is deliberately left alone — rewriting lighting every frame would
 * churn the pipeline for a change the haze layer already shows.
 */
export function applyWeatherToFog(fog: FogConfig, weather: WeatherState): FogConfig {
  const lift = clamp(weather.wetness + weather.snowCover * 0.6, 0, 1) * fog.wetSurfaceLift
  if (lift <= 0) {
    return fog
  }
  return {
    ...fog,
    groundHazeOpacity: clamp(fog.groundHazeOpacity + lift, 0, 0.95),
  }
}

/** Fog patch written into the pipeline's lighting parameters. */
export function fogToLightingPatch(fog: FogConfig): { fogColor: string; fogDensity: number } {
  return { fogColor: fog.color, fogDensity: fog.density }
}

/* -------------------------------------------------------------------------- */
/* Haze wall                                                                   */
/* -------------------------------------------------------------------------- */

/** Options for {@link createHazeLayer}. */
export interface HazeLayerOptions {
  /** Horizontal radius of the wall, metres. */
  readonly radius: number
  /** Height of the wall geometry, metres. */
  readonly height?: number
}

const HAZE_VERTEX_SHADER = `
varying vec2 vHazeUv;

void main() {
  vHazeUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const HAZE_FRAGMENT_SHADER = `
uniform vec3 uHazeColor;
uniform float uOpacity;
uniform float uWetness;
uniform float uDensity;
uniform float uTime;

varying vec2 vHazeUv;

void main() {
  float vertical = 1.0 - smoothstep(0.0, 1.0, vHazeUv.y);
  float band = pow(vertical, 1.6 + uDensity * 18.0);
  float ripple = 0.9 + 0.1 * sin(vHazeUv.x * 26.0 + uTime * 0.3);
  float alpha = uOpacity * band * ripple * (1.0 + uWetness * 0.85);
  vec3 color = uHazeColor * (1.0 + uWetness * 0.25 + uDensity * 0.2);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
}
`

/**
 * Builds the low-lying haze wall.
 *
 * Transparent, depth-write free and drawn after the opaque block, so it reads as
 * air in front of the buildings rather than as geometry inside them.
 */
export function createHazeLayer(options: HazeLayerOptions): HazeLayer {
  const radius = Math.max(4, Number.isFinite(options.radius) ? options.radius : 60)
  const height = Math.max(2, options.height ?? HAZE_GEOMETRY_HEIGHT)
  const geometry = new CylinderGeometry(radius, radius, height, 48, 1, true)
  const material = new ShaderMaterial({
    name: 'vfx-haze-material',
    uniforms: {
      uHazeColor: { value: new Color('#c2b191') },
      uOpacity: { value: 0.4 },
      uWetness: { value: 0 },
      uDensity: { value: 0.02 },
      uTime: { value: 0 },
    },
    vertexShader: HAZE_VERTEX_SHADER,
    fragmentShader: HAZE_FRAGMENT_SHADER,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    // Haze is authored air, not fogged geometry: blending it into the pipeline's
    // distance fog twice would turn the block grey.
    fog: false,
  })

  const mesh = new Mesh(geometry, material)
  mesh.name = HAZE_WALL_NAME
  mesh.position.y = height / 2
  mesh.frustumCulled = false
  mesh.renderOrder = 2

  const object = new Group()
  object.name = HAZE_GROUP_NAME
  object.add(mesh)

  const haze: HazeLayer = {
    object,
    apply(config: FogConfig, weather: WeatherState): void {
      const effective = applyWeatherToFog(config, weather)
      const uniforms = material.uniforms
      uniforms['uHazeColor']?.value.copy(readColor(config.color, '#c2b191'))
      if (uniforms['uOpacity'] !== undefined) {
        uniforms['uOpacity'].value = effective.groundHazeOpacity
      }
      if (uniforms['uWetness'] !== undefined) {
        uniforms['uWetness'].value = clamp(weather.wetness + weather.snowCover, 0, 1)
      }
      if (uniforms['uDensity'] !== undefined) {
        uniforms['uDensity'].value = config.density
      }
      if (uniforms['uTime'] !== undefined) {
        uniforms['uTime'].value = 0
      }
      // The wall keeps a fixed geometry height and scales to the era's falloff.
      mesh.scale.y = config.groundHazeHeight / height
    },
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

  return haze
}
