/**
 * Exhaust, steam, vent smoke and EV-whine glow, plus the era's ambient bird and
 * aircraft accents.
 *
 * ## The `plumeSources` input
 *
 * The layer never imports a vehicle, a storefront or a prop. Live emissions
 * arrive through one documented input:
 *
 * ```ts
 * const sources: PlumeSources = [
 *   { id: 'sedan-3', kind: 'exhaust', position: [4, 0.8, -12], intensity: 0.7 },
 *   { id: 'vent-hvac', kind: 'steam', position: [-18, 6, 9], intensity: 0.4, active: true },
 * ]
 * ```
 *
 * Each event carries a stable `id`, a family (`exhaust`, `steam`, `smoke` or the
 * emissive `evGlow`), a world position and an `intensity` in `0..1`; events with
 * `active: false` are kept but idle. Emitters are pooled, so the vehicle layer
 * can republish the whole list every frame without allocating anything here.
 *
 * With no input at all the era's own baseline vents (stacks, grates, kitchen
 * flues from the per-era table) still emit, so an empty timeline never renders a
 * dead block — and clearing the input returns the scene to exactly that baseline.
 *
 * Ambient accents (birds, aircraft) are *not* emission events: they are era
 * ornaments whose counts come from the era table and whose motion is a pure
 * function of the caller's clock.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import type { BufferGeometry, Material, MeshBasicMaterialParameters } from 'three'
import type { EraDefinition } from '../era'
import { createRng, deriveSeed } from '../lib/rng'
import { clamp } from '../scene'
import { windVector } from './particles'
import { mixHexColors } from './sky'
import { PLUME_KINDS, PLUME_SOURCE_KINDS } from './types'
import type {
  AmbientAccents,
  PlumeKind,
  PlumeKindPlan,
  PlumePlan,
  PlumeSourceEvent,
  PlumeSources,
  PlumeStats,
  PlumeSystem,
  Vec3,
  VfxEraTable,
  WeatherState,
} from './types'

/* -------------------------------------------------------------------------- */
/* Names + constants                                                           */
/* -------------------------------------------------------------------------- */

/** World-group name of the plume content (asserted by QA). */
export const PLUME_GROUP_NAME = 'vfx-plumes'

/** World-group name of the bird/aircraft accents. */
export const AMBIENT_GROUP_NAME = 'vfx-ambient'

/** Instance-mesh name of one plume family. */
export function plumeMeshName(kind: PlumeKind): string {
  return `vfx-plumes-${kind}`
}

/** Mesh name of the bird flock. */
export const BIRD_MESH_NAME = 'vfx-ambient-birds'

/** Mesh name of the aircraft accents. */
export const AIRCRAFT_MESH_NAME = 'vfx-ambient-aircraft'

/** Instance ceiling per plume family. */
export const MAX_PLUME_INSTANCES_PER_KIND = 640

/**
 * Extra live emitters a family's pool is sized for beyond the era baseline.
 *
 * More sources than this still emit: a pool then behaves as a ring and recycles
 * its oldest puffs, so the vehicle layer never has to count them.
 */
export const SOURCE_EMITTER_HEADROOM = 5

/**
 * Emission rate used for a caller-supplied source when the era's own table does
 * not run that family.
 *
 * An era's table decides its ambient accents (an electric fleet has no exhaust
 * of its own), but a caller that explicitly reports a vehicle or vent emitting
 * always gets visible puffs — never a silent no-op.
 */
export const SOURCE_FALLBACK_RATE = 1.2

/* -------------------------------------------------------------------------- */
/* Shared family tuning                                                        */
/* -------------------------------------------------------------------------- */

/** Shared look of each family, before the era's rate and scale factors. */
export const BASE_PLUME_TUNING: Readonly<
  Record<PlumeKind, Omit<PlumeKindPlan, 'kind' | 'color' | 'ratePerSecond'>>
> = Object.freeze({
  exhaust: {
    riseSpeedMps: 1.4,
    driftFactor: 0.5,
    sizeM: 0.5,
    lifetimeSec: 2.6,
    opacity: 0.52,
    emissive: false,
  },
  steam: {
    riseSpeedMps: 2.2,
    driftFactor: 0.4,
    sizeM: 0.75,
    lifetimeSec: 3.6,
    opacity: 0.44,
    emissive: false,
  },
  smoke: {
    riseSpeedMps: 2.8,
    driftFactor: 0.7,
    sizeM: 1.15,
    lifetimeSec: 5.2,
    opacity: 0.5,
    emissive: false,
  },
  evGlow: {
    riseSpeedMps: 1,
    driftFactor: 0.35,
    sizeM: 0.42,
    lifetimeSec: 1.8,
    opacity: 0.42,
    emissive: true,
  },
})

/* -------------------------------------------------------------------------- */
/* Plan resolution                                                             */
/* -------------------------------------------------------------------------- */

/** Puff colour of one family, taken from the era's own palette and light. */
function plumeColor(era: EraDefinition, kind: PlumeKind): string {
  switch (kind) {
    case 'exhaust':
      return mixHexColors(era.palette.streetFurniture, '#20242a', 0.4)
    case 'steam':
      return mixHexColors(era.atmosphere.hazeColor, '#ffffff', 0.6)
    case 'smoke':
      return mixHexColors(era.palette.buildingAccent, '#1a1a1c', 0.5)
    case 'evGlow':
      return era.lighting.artificialLightColor
    default:
      return era.atmosphere.hazeColor
  }
}

function plumeKindPlan(
  kind: PlumeKind,
  ratePerSecond: number,
  era: EraDefinition,
  table: VfxEraTable,
): PlumeKindPlan {
  const base = BASE_PLUME_TUNING[kind]
  return {
    kind,
    color: plumeColor(era, kind),
    ratePerSecond: Math.max(0, ratePerSecond),
    riseSpeedMps: base.riseSpeedMps * clamp(table.plumes.riseScale, 0.2, 3),
    driftFactor: base.driftFactor,
    sizeM: base.sizeM * clamp(table.plumes.sizeScale, 0.2, 3),
    lifetimeSec: base.lifetimeSec * clamp(table.plumes.lifetimeScale, 0.2, 3),
    opacity: base.opacity,
    emissive: base.emissive,
  }
}

/**
 * Resolves the plume plan of one era.
 *
 * The per-era table owns the base rates; the era's own traffic and pedestrian
 * density then scale the *vehicle* families, so a busy block breathes more
 * exhaust than a rationed one, while the EV-glow rate stays whatever the table
 * says — which is how the electric-whine accent appears exactly in the periods
 * that have it.
 */
export function resolvePlumePlan(era: EraDefinition, table: VfxEraTable): PlumePlan {
  const traffic = clamp(era.traffic.trafficDensity, 0, 2)
  const population = clamp(era.population.pedestrianDensity, 0, 2)
  const rates: Record<PlumeKind, number> = {
    exhaust: table.plumes.rates.exhaust * (1 + traffic),
    steam: table.plumes.rates.steam * (1 + population),
    smoke: table.plumes.rates.smoke,
    evGlow: table.plumes.rates.evGlow,
  }
  return {
    kinds: PLUME_KINDS.map((kind) => plumeKindPlan(kind, rates[kind], era, table)),
    baseline: table.plumes.baseline,
    ambient: table.plumes.ambient,
    accentColor: mixHexColors(era.palette.streetFurniture, '#101216', 0.35),
    windSpeedMps: era.atmosphere.windSpeedMps,
    seed: `${era.seed}::plumes`,
  }
}

/**
 * Interpolates two plume plans for a staged era change.
 *
 * Like the weather families, the *emitters* are a discrete choice (a grate
 * cannot be half open), so the nearer era's plan wins while the sun, fog and
 * grade interpolate continuously in their own modules.
 */
export function blendPlumePlans(from: PlumePlan, to: PlumePlan, t: number): PlumePlan {
  return t < 0.5 ? from : to
}

/** Counts the caller's live emitters per family. */
export function summarizeSources(sources: PlumeSources): Readonly<Record<PlumeKind, number>> {
  const counts: Record<PlumeKind, number> = { exhaust: 0, steam: 0, smoke: 0, evGlow: 0 }
  for (const source of sources) {
    if (source.active === false) {
      continue
    }
    counts[source.kind] += 1
  }
  return counts
}

/* -------------------------------------------------------------------------- */
/* Emitters + pools                                                            */
/* -------------------------------------------------------------------------- */

/** One live emitter: an era baseline vent or a caller-supplied source. */
interface Emitter {
  readonly id: string
  readonly kind: PlumeKind
  readonly position: Vec3
  readonly intensity: number
  readonly baseline: boolean
  accumulator: number
}

/** One pooled puff. */
interface Puff {
  x: number
  y: number
  z: number
  age: number
  life: number
  rise: number
  drift: number
  size: number
  active: boolean
}

interface Pool {
  readonly plan: PlumeKindPlan
  readonly geometry: BufferGeometry
  readonly material: Material
  readonly mesh: InstancedMesh
  readonly puffs: Puff[]
  cursor: number
  spawned: number
}

function puffGeometry(kind: PlumeKind): BufferGeometry {
  return kind === 'evGlow' ? new SphereGeometry(1, 6, 5) : new SphereGeometry(1, 5, 4)
}

function puffMaterial(plan: PlumeKindPlan): Material {
  const parameters: MeshBasicMaterialParameters = {
    name: `vfx-plumes-${plan.kind}-material`,
    color: plan.color,
    transparent: true,
    opacity: plan.opacity,
    depthWrite: false,
    side: DoubleSide,
    // Particles are air, not geometry: fogging them twice would grey the block.
    fog: false,
  }
  if (plan.emissive) {
    // Glow accents add light instead of blocking it, so neon reads as neon.
    parameters.blending = AdditiveBlending
  }
  return new MeshBasicMaterial(parameters)
}

/** Options for {@link createPlumeSystem}. */
export interface PlumeSystemOptions {
  readonly plan: PlumePlan
  /** Halves the pool sizes and thins the ambient accents. */
  readonly reducedMotion?: boolean
}

/**
 * Builds the pooled plume system plus the era's ambient accents.
 *
 * Pools are sized from the era's rates, its baseline vents and a headroom of
 * live caller sources; when more sources arrive than the headroom allows, a pool
 * behaves as a ring and recycles its oldest puffs — emission keeps working and
 * memory does not grow.
 */
export function createPlumeSystem(options: PlumeSystemOptions): PlumeSystem {
  const reducedMotion = options.reducedMotion === true
  let plan = options.plan
  let sources: PlumeSources = []
  let pools: Pool[] = []
  let emitters: Emitter[] = []
  const rng = createRng(deriveSeed(plan.seed, 'emitters'), 'vfx-plumes')
  const dummy = new Object3D()

  const object = new Group()
  object.name = PLUME_GROUP_NAME
  const ambientObject = new Group()
  ambientObject.name = AMBIENT_GROUP_NAME
  object.add(ambientObject)

  const capacityFor = (kindPlan: PlumeKindPlan, baselineCount: number): number => {
    const expected = Math.max(1, kindPlan.ratePerSecond) * kindPlan.lifetimeSec
    const raw = Math.ceil(expected * (baselineCount + SOURCE_EMITTER_HEADROOM))
    const scaled = reducedMotion ? Math.ceil(raw * 0.5) : raw
    return Math.min(MAX_PLUME_INSTANCES_PER_KIND, Math.max(16, scaled))
  }

  const buildPool = (kindPlan: PlumeKindPlan, baselineCount: number): Pool => {
    const capacity = capacityFor(kindPlan, baselineCount)
    const geometry = puffGeometry(kindPlan.kind)
    const material = puffMaterial(kindPlan)
    const mesh = new InstancedMesh(geometry, material, capacity)
    mesh.name = plumeMeshName(kindPlan.kind)
    mesh.userData['kind'] = kindPlan.kind
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    const puffs: Puff[] = []
    for (let index = 0; index < capacity; index += 1) {
      puffs.push({ x: 0, y: -1000, z: 0, age: 0, life: 1, rise: 0, drift: 0, size: 1, active: false })
    }
    return { plan: kindPlan, geometry, material, mesh, puffs, cursor: 0, spawned: 0 }
  }

  const writeMatrices = (pool: Pool): void => {
    let index = 0
    for (const puff of pool.puffs) {
      if (!puff.active) {
        // Parked far below the block at zero size: invisible, never fogged.
        dummy.position.set(0, -1000, 0)
        dummy.scale.setScalar(0.0001)
      } else {
        // A puff grows as it mixes with the air and fades out as it dies.
        const growth = 0.55 + 1.25 * (puff.age / puff.life)
        dummy.position.set(puff.x, puff.y, puff.z)
        dummy.scale.setScalar(puff.size * growth)
      }
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      pool.mesh.setMatrixAt(index, dummy.matrix)
      index += 1
    }
    pool.mesh.instanceMatrix.needsUpdate = true
  }

  const buildPools = (): void => {
    for (const pool of pools) {
      object.remove(pool.mesh)
      pool.geometry.dispose()
      pool.material.dispose()
      pool.mesh.dispose()
    }
    pools = plan.kinds
      .filter(
        (kindPlan) =>
          kindPlan.ratePerSecond > 0 ||
          (PLUME_SOURCE_KINDS as readonly PlumeKind[]).includes(kindPlan.kind) ||
          plan.baseline.some((entry) => entry.kind === kindPlan.kind),
      )
      .map((kindPlan) =>
        buildPool(kindPlan, plan.baseline.filter((entry) => entry.kind === kindPlan.kind).length),
      )
    for (const pool of pools) {
      object.add(pool.mesh)
      writeMatrices(pool)
    }
  }

  const rebuildEmitters = (): void => {
    const baseline: Emitter[] = plan.baseline.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      position: entry.position,
      intensity: clamp(entry.intensity, 0, 1),
      baseline: true,
      accumulator: 0,
    }))
    const supplied: Emitter[] = sources
      .filter((source) => source.active !== false && source.intensity > 0)
      .map((source: PlumeSourceEvent) => ({
        id: source.id,
        kind: source.kind,
        position: source.position,
        intensity: clamp(source.intensity, 0, 1),
        baseline: false,
        accumulator: 0,
      }))
    emitters = [...baseline, ...supplied]
  }

  buildPools()
  rebuildEmitters()

  /* Ambient accents (birds, aircraft) -------------------------------------- */

  let accents: AmbientAccents = plan.ambient
  let birdCount = 0
  let aircraftCount = 0
  let birds: InstancedMesh | null = null
  let aircraft: InstancedMesh | null = null
  const accentGeometry = new PlaneGeometry(1.6, 0.5)
  const aircraftGeometry = new BoxGeometry(6, 0.5, 1.5)
  const accentMaterial = new MeshBasicMaterial({
    name: 'vfx-ambient-bird-material',
    color: plan.accentColor,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  })
  const aircraftMaterial = new MeshBasicMaterial({
    name: 'vfx-ambient-aircraft-material',
    color: plan.accentColor,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  })

  /**
   * Builds the bird and aircraft accents from the current plan.
   *
   * Rebuilt on every plan change because an `InstancedMesh` cannot be resized:
   * eras differ in how many birds they have (and in the colour of the
   * silhouettes), and a stale mesh would keep reporting the previous era's
   * counts and positions.
   */
  const buildAmbient = (): void => {
    accents = plan.ambient
    birdCount = reducedMotion ? Math.round(accents.birds * 0.5) : accents.birds
    aircraftCount = accents.aircraft
    accentMaterial.color.set(plan.accentColor)
    aircraftMaterial.color.set(plan.accentColor)
    if (birds !== null) {
      ambientObject.remove(birds)
      birds.dispose()
      birds = null
    }
    if (aircraft !== null) {
      ambientObject.remove(aircraft)
      aircraft.dispose()
      aircraft = null
    }
    if (birdCount > 0) {
      birds = new InstancedMesh(accentGeometry, accentMaterial, birdCount)
      birds.name = BIRD_MESH_NAME
      birds.frustumCulled = false
      birds.instanceMatrix.setUsage(DynamicDrawUsage)
      ambientObject.add(birds)
    }
    if (aircraftCount > 0) {
      aircraft = new InstancedMesh(aircraftGeometry, aircraftMaterial, aircraftCount)
      aircraft.name = AIRCRAFT_MESH_NAME
      aircraft.frustumCulled = false
      aircraft.instanceMatrix.setUsage(DynamicDrawUsage)
      ambientObject.add(aircraft)
    }
    updateAmbient(0)
  }

  const updateAmbient = (seconds: number): void => {
    const time = Number.isFinite(seconds) ? seconds : 0
    if (birds !== null) {
      for (let index = 0; index < birdCount; index += 1) {
        const ring = accents.orbitRadius * (0.72 + 0.28 * ((index % 5) / 5))
        const angle =
          time * 0.055 * (1 + (index % 3) * 0.04) + index * ((Math.PI * 2) / Math.max(1, birdCount))
        dummy.position.set(
          Math.cos(angle) * ring,
          accents.altitude + Math.sin(time * 0.5 + index) * 1.6,
          Math.sin(angle) * ring,
        )
        // Wings flap: the silhouette is a quad, so scaling it is the flap.
        dummy.rotation.set(0, -angle + Math.PI / 2, Math.sin(time * 6 + index) * 0.35)
        dummy.scale.set(1 + 0.22 * Math.sin(time * 9 + index), 1, 1)
        dummy.updateMatrix()
        birds.setMatrixAt(index, dummy.matrix)
      }
      birds.instanceMatrix.needsUpdate = true
    }
    if (aircraft !== null) {
      const span = 260
      for (let index = 0; index < aircraftCount; index += 1) {
        const travelled = (time * 22 + index * 97) % span
        dummy.position.set(travelled - span / 2, accents.altitude * 2.4 + index * 6, -70 + index * 46)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        aircraft.setMatrixAt(index, dummy.matrix)
      }
      aircraft.instanceMatrix.needsUpdate = true
    }
  }

  buildAmbient()

  /* Emission --------------------------------------------------------------- */

  const emit = (pool: Pool, emitter: Emitter, deltaSeconds: number): void => {
    // Baselines follow the era's own rate; explicit caller sources fall back to a
    // modest rate when the era does not run that family at all.
    const rate = emitter.baseline
      ? pool.plan.ratePerSecond
      : Math.max(pool.plan.ratePerSecond, SOURCE_FALLBACK_RATE)
    emitter.accumulator += rate * emitter.intensity * deltaSeconds
    // Cap the per-frame burst so a clock jump cannot spawn a whole pool at once.
    let budget = 48
    while (emitter.accumulator >= 1 && budget > 0) {
      emitter.accumulator -= 1
      budget -= 1
      const puff = pool.puffs[pool.cursor]
      pool.cursor = (pool.cursor + 1) % pool.puffs.length
      if (puff === undefined) {
        continue
      }
      const spread = pool.plan.sizeM * 0.7
      puff.x = emitter.position[0] + rng.float(-spread, spread)
      puff.y = emitter.position[1] + rng.float(-spread * 0.4, spread * 0.4)
      puff.z = emitter.position[2] + rng.float(-spread, spread)
      puff.age = 0
      puff.life = pool.plan.lifetimeSec * rng.float(0.8, 1.2)
      puff.rise = pool.plan.riseSpeedMps * rng.float(0.7, 1.3)
      puff.drift = pool.plan.driftFactor * rng.float(0.6, 1.4)
      puff.size = pool.plan.sizeM * rng.float(0.8, 1.25)
      puff.active = true
      pool.spawned += 1
    }
  }

  const system: PlumeSystem = {
    object,
    ambientObject,
    get plan(): PlumePlan {
      return plan
    },
    get emitterCount(): number {
      return emitters.length
    },
    setPlan(next: PlumePlan): void {
      plan = next
      rebuildEmitters()
      buildPools()
      buildAmbient()
    },
    setSources(next: PlumeSources): void {
      sources = next
      rebuildEmitters()
    },
    step(deltaSeconds: number, seconds: number, weather: WeatherState): void {
      if (!(deltaSeconds > 0)) {
        updateAmbient(seconds)
        return
      }
      const wind = windVector(plan.windSpeedMps, seconds)
      // Wet air holds a plume together and keeps it low.
      const weatherDamping = 1 - clamp(weather.wetness * 0.25 + weather.snowCover * 0.3, 0, 0.6)

      if (emitters.length > 0) {
        for (const pool of pools) {
          for (const emitter of emitters) {
            if (emitter.kind === pool.plan.kind) {
              emit(pool, emitter, deltaSeconds)
            }
          }
        }
      }

      for (const pool of pools) {
        for (const puff of pool.puffs) {
          if (!puff.active) {
            continue
          }
          puff.age += deltaSeconds
          if (puff.age >= puff.life) {
            puff.active = false
            continue
          }
          const buoyancy = puff.rise * (1 - 0.55 * (puff.age / puff.life)) * weatherDamping
          puff.y += buoyancy * deltaSeconds
          puff.x += puff.drift * wind[0] * deltaSeconds
          puff.z += puff.drift * wind[2] * deltaSeconds
        }
        writeMatrices(pool)
      }
      updateAmbient(seconds)
    },
    stats(): PlumeStats {
      let alive = 0
      let spawned = 0
      for (const pool of pools) {
        spawned += pool.spawned
        for (const puff of pool.puffs) {
          if (puff.active) {
            alive += 1
          }
        }
      }
      const emittersByKind: Record<PlumeKind, number> = { exhaust: 0, steam: 0, smoke: 0, evGlow: 0 }
      let baselineSources = 0
      let sourceEmitters = 0
      for (const emitter of emitters) {
        emittersByKind[emitter.kind] += 1
        if (emitter.baseline) {
          baselineSources += 1
        } else {
          sourceEmitters += 1
        }
      }
      return {
        baselineSources,
        sourceEmitters,
        emittersByKind,
        alive,
        spawned,
        ambientBirds: birdCount,
        ambientAircraft: aircraftCount,
      }
    },
    dispose(): void {
      for (const pool of pools) {
        object.remove(pool.mesh)
        pool.geometry.dispose()
        pool.material.dispose()
        pool.mesh.dispose()
      }
      pools = []
      if (birds !== null) {
        ambientObject.remove(birds)
        birds.dispose()
        birds = null
      }
      if (aircraft !== null) {
        ambientObject.remove(aircraft)
        aircraft.dispose()
        aircraft = null
      }
      accentGeometry.dispose()
      aircraftGeometry.dispose()
      accentMaterial.dispose()
      aircraftMaterial.dispose()
      object.removeFromParent()
    },
  }

  return system
}
