/**
 * Pooled, instanced weather: rain, snow, drifting leaves and dust motes.
 *
 * Design
 * ------
 * - **Pooled and instanced.** Every family is one `InstancedMesh` whose instance
 *   count is decided up front from the era data and the quality tier, so a frame
 *   never allocates. Families the era does not enable are not built at all.
 * - **Caller-supplied clock.** `step(deltaSeconds, seconds)` is the only way time
 *   enters the simulation: no `Date`, no `performance`, no `Math.random`. The same
 *   seed, era and clock produce the same positions on any machine, so the unit
 *   and composition tests can assert motion without a renderer.
 * - **Bounded volumes.** Particles spawn inside {@link DEFAULT_PARTICLE_BOUNDS}
 *   and respawn as soon as they leave it, which is what keeps a rain layer
 *   infinite without ever growing memory.
 * - **Weather response.** Falling rain and snow accumulate a wetness/snow-cover
 *   response that the haze layer and neighbouring content layers read; the
 *   response rises while the weather is on and dries out afterwards.
 */

import {
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import type { EraDefinition, HexColor } from '../era'
import type { QualityTier } from '../lib/quality'
import { createRng, deriveSeed } from '../lib/rng'
import { clamp } from '../scene'
import { mixHexColors } from './sky'
import { PARTICLE_KINDS } from './types'
import type {
  AmbientParticleKind,
  ParticleKind,
  ParticleKindPlan,
  ParticleKindStats,
  ParticlePlan,
  ParticleSystem,
  ParticleSystemSet,
  ParticleTuning,
  PrecipitationParticleKind,
  Vec3,
  VfxEraTable,
  WeatherState,
} from './types'

/* -------------------------------------------------------------------------- */
/* Names + constants                                                           */
/* -------------------------------------------------------------------------- */

/** World-group name of the atmosphere's weather content (asserted by QA). */
export const PARTICLE_GROUP_NAME = 'vfx-particles'

/** Instance-mesh name of one family; the harness and e2e read these. */
export function particleMeshName(kind: ParticleKind): string {
  return `vfx-particles-${kind}`
}

/** Spawn volume shared by every era: a box over the block, down to the street. */
export const DEFAULT_PARTICLE_BOUNDS = Object.freeze({
  halfExtentX: 46,
  halfExtentZ: 46,
  minY: 0.15,
  maxY: 28,
})

/** Instance ceiling per family, so a data edit can never allocate unbounded VRAM. */
export const MAX_PARTICLES_PER_KIND = 900

/** Count multiplier applied when the caller asks for reduced motion. */
export const REDUCED_MOTION_PARTICLE_SCALE = 0.35

/** Time constants (seconds) of the weather-response approach curves. */
export const WETNESS_RISE_SECONDS = 6
export const SNOW_RISE_SECONDS = 30
export const LEAF_LITTER_SECONDS = 45
export const WEATHER_RELAX_SECONDS = 26

/** Fraction of the era wind speed the particle drift uses. */
export const PARTICLE_WIND_GAIN = 0.35

/** How long a drifting particle lives before it is respawned, seconds. */
export const DRIFT_LIFETIME_SECONDS = 26

/** Era-independent tuning of each family. */
export const BASE_PARTICLE_TUNING: Readonly<Record<ParticleKind, ParticleTuning>> = Object.freeze({
  rain: {
    gate: 'precipitation',
    motion: 'fall',
    baseCount: 480,
    sizeM: 1.05,
    fallSpeedMps: 14,
    driftFactor: 0.35,
    opacity: 0.42,
    surfaceResponse: 1,
  },
  snow: {
    gate: 'precipitation',
    motion: 'fall',
    baseCount: 380,
    sizeM: 0.16,
    fallSpeedMps: 1.15,
    driftFactor: 0.9,
    opacity: 0.72,
    surfaceResponse: 0.8,
  },
  leaves: {
    gate: 'ambient',
    motion: 'drift',
    baseCount: 120,
    sizeM: 0.22,
    fallSpeedMps: 0.75,
    driftFactor: 1.2,
    opacity: 0.85,
    surfaceResponse: 0.25,
  },
  dust: {
    gate: 'ambient',
    motion: 'drift',
    baseCount: 200,
    sizeM: 0.075,
    fallSpeedMps: 0.25,
    driftFactor: 0.6,
    opacity: 0.3,
    surfaceResponse: 0.15,
  },
})

/* -------------------------------------------------------------------------- */
/* Shared generators                                                           */
/* -------------------------------------------------------------------------- */

/** Slow, veering wind for a clock time, in metres per second. */
export function windVector(speedMps: number, seconds: number): Vec3 {
  const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0
  const time = Number.isFinite(seconds) ? seconds : 0
  return [
    Math.cos(time * 0.031) * speed * PARTICLE_WIND_GAIN,
    0,
    Math.sin(time * 0.021) * speed * PARTICLE_WIND_GAIN,
  ]
}

/**
 * Strength in `0..1` of a precipitation family for an era.
 *
 * The era's `atmosphere.precipitation` decides *whether* the family runs and its
 * `precipitationIntensity` decides how hard: a drizzle always keeps a floor so it
 * still reads as drizzle, while rain and snow scale up to a downpour.
 */
export function precipitationStrength(
  era: EraDefinition,
  kind: PrecipitationParticleKind,
): number {
  const precipitation = era.atmosphere.precipitation
  const isRain = kind === 'rain' && (precipitation === 'drizzle' || precipitation === 'rain')
  const isSnow = kind === 'snow' && precipitation === 'snow'
  if (!isRain && !isSnow) {
    return 0
  }
  const intensity = clamp(era.atmosphere.precipitationIntensity, 0, 1)
  const floor = precipitation === 'drizzle' ? 0.45 : 0.6
  return clamp(floor + (1 - floor) * intensity, 0, 1)
}

/** Family colour: rain picks up the era haze, leaves carry the era accent. */
export function particleColor(era: EraDefinition, kind: ParticleKind): HexColor {
  switch (kind) {
    case 'rain':
      return mixHexColors(era.atmosphere.hazeColor, '#dfeaf6', 0.55)
    case 'snow':
      return mixHexColors(era.atmosphere.hazeColor, '#ffffff', 0.8)
    case 'leaves':
      return mixHexColors('#7d5a2b', era.palette.accent, 0.35)
    case 'dust':
      return mixHexColors(era.atmosphere.hazeColor, '#ffffff', 0.25)
    default:
      return era.atmosphere.hazeColor
  }
}

/* -------------------------------------------------------------------------- */
/* Plan resolution                                                             */
/* -------------------------------------------------------------------------- */

/** Inputs of {@link resolveParticlePlan}. */
export interface ParticlePlanInput {
  readonly era: EraDefinition
  readonly table: VfxEraTable
  /** Quality tier supplying the shared particle density multiplier. */
  readonly quality: QualityTier
  /** Lowers the counts; used for the reduced-motion path. */
  readonly reducedMotion?: boolean
}

function resolveKindPlan(
  input: ParticlePlanInput,
  kind: ParticleKind,
): ParticleKindPlan {
  const { era, table, quality } = input
  const tuning = BASE_PARTICLE_TUNING[kind]
  const strength =
    tuning.gate === 'precipitation'
      ? precipitationStrength(era, kind as PrecipitationParticleKind)
      : clamp(table.particles.ambientStrength[kind as AmbientParticleKind], 0, 1)
  const enabled = strength > 0
  const eraScale = tuning.gate === 'ambient' ? clamp(era.atmosphere.particleDensity, 0, 1) : 1
  const motionScale = input.reducedMotion === true ? REDUCED_MOTION_PARTICLE_SCALE : 1
  const raw =
    tuning.baseCount *
    strength *
    clamp(table.particles.countScale, 0, 4) *
    clamp(quality.density.particles, 0, 2) *
    eraScale *
    motionScale
  const count = enabled ? Math.min(MAX_PARTICLES_PER_KIND, Math.max(1, Math.round(raw))) : 0

  return {
    kind,
    enabled,
    count,
    capacity: count,
    strength,
    color: particleColor(era, kind),
    tuning,
    sizeM: tuning.sizeM * clamp(table.particles.sizeScale, 0.1, 3),
    fallSpeedMps: tuning.fallSpeedMps * clamp(table.particles.speedScale, 0.1, 3),
    driftFactor: tuning.driftFactor,
    opacity: tuning.opacity,
    surfaceResponse: tuning.surfaceResponse,
  }
}

/** Resolves the weather plan of one era from its record, table and quality tier. */
export function resolveParticlePlan(input: ParticlePlanInput): ParticlePlan {
  const kinds = PARTICLE_KINDS.map((kind) => resolveKindPlan(input, kind))
  return {
    kinds,
    totalCount: kinds.reduce((total, plan) => total + plan.count, 0),
    seed: `${input.era.seed}::particles`,
    bounds: DEFAULT_PARTICLE_BOUNDS,
    windSpeedMps: input.era.atmosphere.windSpeedMps,
  }
}

/**
 * Interpolates two plans for a staged era change.
 *
 * The *families* are a discrete choice — their pools would have to be
 * reallocated every frame otherwise — so the nearer era's plan wins, while the
 * continuous knobs (sun, fog, grade) interpolate in their own modules.
 */
export function blendParticlePlans(from: ParticlePlan, to: ParticlePlan, t: number): ParticlePlan {
  return t < 0.5 ? from : to
}

/* -------------------------------------------------------------------------- */
/* Weather response                                                            */
/* -------------------------------------------------------------------------- */

const QUIET_WEATHER: WeatherState = Object.freeze({
  wetness: 0,
  snowCover: 0,
  leafLitter: 0,
  precipitating: false,
})

/** Exponential approach of `current` towards `target`. */
function approach(current: number, target: number, deltaSeconds: number, seconds: number): number {
  if (!(deltaSeconds > 0) || !(seconds > 0)) {
    return current
  }
  const factor = 1 - Math.exp(-deltaSeconds / seconds)
  return clamp(current + (target - current) * factor, 0, 1)
}

/** Finds one family's plan, or `undefined` when the era does not run it. */
export function findKindPlan(
  plan: ParticlePlan,
  kind: ParticleKind,
): ParticleKindPlan | undefined {
  return plan.kinds.find((entry) => entry.kind === kind)
}

/**
 * Advances the wet-surface / snow-accumulation / leaf-litter response.
 *
 * Pure: given the same previous response, plan and delta it returns the same
 * next response, so a test can drive sixty seconds of rain and assert the block
 * is wet while a dry era never leaves zero.
 */
export function advanceWeather(
  previous: WeatherState,
  plan: ParticlePlan,
  deltaSeconds: number,
): WeatherState {
  const rain = findKindPlan(plan, 'rain')
  const snow = findKindPlan(plan, 'snow')
  const leaves = findKindPlan(plan, 'leaves')
  const rainStrength = rain?.enabled === true ? rain.strength : 0
  const snowStrength = snow?.enabled === true ? snow.strength : 0
  const leafStrength = leaves?.enabled === true ? leaves.strength : 0

  return {
    wetness: approach(
      previous.wetness,
      rainStrength,
      deltaSeconds,
      rainStrength > previous.wetness ? WETNESS_RISE_SECONDS : WEATHER_RELAX_SECONDS,
    ),
    snowCover: approach(
      previous.snowCover,
      snowStrength,
      deltaSeconds,
      snowStrength > previous.snowCover ? SNOW_RISE_SECONDS : WEATHER_RELAX_SECONDS,
    ),
    leafLitter: approach(previous.leafLitter, leafStrength, deltaSeconds, LEAF_LITTER_SECONDS),
    precipitating: rainStrength > 0 || snowStrength > 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Geometry + materials                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Per-family geometry.
 *
 * Rain is a thin three-sided tube and dust a coarse sphere, so both stay visible
 * from every camera angle; leaves are single rotating quads, which is exactly how
 * they read as flat litter on the wind.
 */
function createGeometry(kind: ParticleKind): BufferGeometry {
  switch (kind) {
    case 'rain':
      return new CylinderGeometry(0.014, 0.014, 1, 3, 1, true)
    case 'snow':
      return new SphereGeometry(1, 5, 4)
    case 'leaves':
      return new PlaneGeometry(1, 0.62)
    case 'dust':
      return new SphereGeometry(1, 4, 3)
    default:
      return new PlaneGeometry(1, 1)
  }
}

function createMaterial(plan: ParticleKindPlan): Material {
  return new MeshBasicMaterial({
    name: `vfx-particles-${plan.kind}-material`,
    color: plan.color,
    transparent: true,
    opacity: plan.opacity,
    depthWrite: false,
    side: DoubleSide,
    // Particles are air, not geometry: fogging them twice would grey the block.
    fog: false,
  })
}

/* -------------------------------------------------------------------------- */
/* One family                                                                  */
/* -------------------------------------------------------------------------- */

/** Mutable per-instance simulation state; kept in objects, never indexed. */
interface ParticleState {
  x: number
  y: number
  z: number
  age: number
  /** Per-instance speed jitter in `0.75..1.25`. */
  speedJitter: number
  /** Per-instance sway phase. */
  phase: number
}

function createParticleSystem(plan: ParticleKindPlan, bounds: ParticlePlan['bounds'], seed: string): ParticleSystem {
  const count = Math.max(1, plan.count)
  const geometry = createGeometry(plan.kind)
  const material = createMaterial(plan)
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.name = particleMeshName(plan.kind)
  mesh.userData['kind'] = plan.kind
  // The volume is authored, not derived from the geometry, so culling can only
  // lose the weather.
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const rng = createRng(deriveSeed(seed, plan.kind), `vfx-${plan.kind}`)
  const positions = new Float32Array(count * 3)
  const states: ParticleState[] = []
  const dummy = new Object3D()
  let spawned = 0
  let respawned = 0

  const spawnInto = (particle: ParticleState, spreadAll: boolean): void => {
    particle.x = rng.float(-bounds.halfExtentX, bounds.halfExtentX)
    particle.z = rng.float(-bounds.halfExtentZ, bounds.halfExtentZ)
    particle.y = spreadAll
      ? rng.float(bounds.minY, bounds.maxY)
      : plan.tuning.motion === 'fall'
        ? bounds.maxY - rng.float(0, 2)
        : rng.float(bounds.minY, bounds.maxY * 0.7)
    particle.age = rng.float(0, 4)
    particle.speedJitter = rng.float(0.75, 1.25)
    particle.phase = rng.float(0, Math.PI * 2)
    spawned += 1
  }

  for (let index = 0; index < count; index += 1) {
    const particle: ParticleState = { x: 0, y: 0, z: 0, age: 0, speedJitter: 1, phase: 0 }
    spawnInto(particle, true)
    states.push(particle)
  }

  const writeMatrices = (): void => {
    let index = 0
    for (const particle of states) {
      dummy.position.set(particle.x, particle.y, particle.z)
      if (plan.kind === 'rain') {
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(plan.sizeM, plan.sizeM, plan.sizeM)
      } else if (plan.kind === 'leaves') {
        dummy.rotation.set(particle.phase * 0.2, particle.age * 1.4 + particle.phase, Math.sin(particle.age * 0.9 + particle.phase) * 0.5)
        dummy.scale.setScalar(plan.sizeM)
      } else {
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(plan.sizeM)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      positions[index * 3] = particle.x
      positions[index * 3 + 1] = particle.y
      positions[index * 3 + 2] = particle.z
      index += 1
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  writeMatrices()

  const drift = (particle: ParticleState, deltaSeconds: number, wind: Vec3): void => {
    const windX = wind[0] * plan.driftFactor
    const windZ = wind[2] * plan.driftFactor
    if (plan.tuning.motion === 'fall') {
      particle.age += deltaSeconds
      particle.y -= plan.fallSpeedMps * particle.speedJitter * deltaSeconds
      particle.x += windX * deltaSeconds
      particle.z += windZ * deltaSeconds
      if (plan.kind === 'snow') {
        particle.x += Math.sin(particle.age * 1.7 + particle.phase) * 0.6 * deltaSeconds
      }
      return
    }
    particle.age += deltaSeconds
    // Leaves and dust ride the wind, bob and slowly settle.
    particle.x += (windX + Math.cos(particle.age * 0.7 + particle.phase) * 0.35) * deltaSeconds
    particle.z += (windZ + Math.sin(particle.age * 0.6 + particle.phase) * 0.35) * deltaSeconds
    particle.y +=
      (Math.sin(particle.age * 1.3 + particle.phase) * 0.35 - plan.fallSpeedMps * 0.35) * deltaSeconds
  }

  const outOfBounds = (particle: ParticleState): boolean =>
    particle.y < bounds.minY ||
    particle.y > bounds.maxY ||
    Math.abs(particle.x) > bounds.halfExtentX ||
    Math.abs(particle.z) > bounds.halfExtentZ ||
    (plan.tuning.motion === 'drift' && particle.age > DRIFT_LIFETIME_SECONDS)

  const system: ParticleSystem = {
    kind: plan.kind,
    object: mesh,
    capacity: count,
    count,
    positions,
    step(deltaSeconds: number, wind: Vec3): void {
      if (!(deltaSeconds > 0)) {
        return
      }
      for (const particle of states) {
        drift(particle, deltaSeconds, wind)
        if (outOfBounds(particle)) {
          spawnInto(particle, false)
          respawned += 1
        }
      }
      writeMatrices()
    },
    stats(): ParticleKindStats {
      return {
        kind: plan.kind,
        enabled: plan.enabled,
        count,
        capacity: count,
        alive: count,
        spawned,
        respawned,
      }
    },
    dispose(): void {
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
      mesh.dispose()
    },
  }

  return system
}

/* -------------------------------------------------------------------------- */
/* The set                                                                     */
/* -------------------------------------------------------------------------- */

/** Options for {@link createParticleSystemSet}. */
export interface ParticleSystemSetOptions {
  readonly plan: ParticlePlan
}

/** Builds every enabled family of a plan and owns the weather response. */
export function createParticleSystemSet(options: ParticleSystemSetOptions): ParticleSystemSet {
  let plan = options.plan
  let systems: ParticleSystem[] = []
  let weather: WeatherState = QUIET_WEATHER

  const object = new Group()
  object.name = PARTICLE_GROUP_NAME

  const build = (): void => {
    for (const system of systems) {
      object.remove(system.object)
      system.dispose()
    }
    systems = plan.kinds
      .filter((entry) => entry.enabled && entry.count > 0)
      .map((entry) => createParticleSystem(entry, plan.bounds, plan.seed))
    for (const system of systems) {
      object.add(system.object)
    }
  }

  build()

  const sameShape = (left: ParticlePlan, right: ParticlePlan): boolean =>
    left.kinds.length === right.kinds.length &&
    left.kinds.every((entry, index) => {
      const other = right.kinds[index]
      return (
        other !== undefined &&
        other.kind === entry.kind &&
        other.enabled === entry.enabled &&
        other.count === entry.count &&
        other.sizeM === entry.sizeM &&
        other.opacity === entry.opacity &&
        other.color === entry.color
      )
    })

  const set: ParticleSystemSet = {
    object,
    get systems(): readonly ParticleSystem[] {
      return systems
    },
    get plan(): ParticlePlan {
      return plan
    },
    get weather(): WeatherState {
      return weather
    },
    step(deltaSeconds: number, seconds: number): WeatherState {
      const wind = windVector(plan.windSpeedMps, seconds)
      for (const system of systems) {
        system.step(deltaSeconds, wind)
      }
      weather = advanceWeather(weather, plan, deltaSeconds)
      return weather
    },
    setPlan(next: ParticlePlan): void {
      // A plan with the same families and counts keeps its live particles, so an
      // era change mid-transition never resets the weather.
      if (sameShape(plan, next)) {
        plan = next
        return
      }
      plan = next
      for (const system of systems) {
        object.remove(system.object)
        system.dispose()
      }
      systems = []
      build()
    },
    stats(): readonly ParticleKindStats[] {
      return systems.map((system) => system.stats())
    },
    dispose(): void {
      for (const system of systems) {
        object.remove(system.object)
        system.dispose()
      }
      systems = []
      object.removeFromParent()
    },
  }

  return set
}
