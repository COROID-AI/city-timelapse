/**
 * Unit checks for the era atmosphere layer (`src/vfx`).
 *
 * Everything here runs without a GPU and without a renderer, which is the point
 * of the layer's design: the era data, the pure generators, the pooled weather
 * simulation and the plume emitters are all ordinary values and plain loops, so
 * five decades of atmosphere can be asserted exactly.
 *
 * The suite covers the unit tier of the plan's verification: per-era sky, sun,
 * fog, grade, particle and baseline-plume data; the gating, pooling, quality
 * tiering and bounded respawn behaviour of the weather systems; the documented
 * `plumeSources` input; and the graceful degradation of the post-processing
 * surface.
 */

import { Color, Group } from 'three'
import type { InstancedMesh, Mesh, ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { ERA_IDS, ERA_REGISTRY, createEraRegistry, getEra } from '../../src/era'
import type { EraDefinition, EraId } from '../../src/era'
import { resolveQualityTier } from '../../src/lib/quality'
import { resolveSceneQuality } from '../../src/scene'
import {
  DEFAULT_PARTICLE_BOUNDS,
  BIRD_MESH_NAME,
  AIRCRAFT_MESH_NAME,
  HAZE_GEOMETRY_HEIGHT,
  MAX_PIPELINE_FOG_DENSITY,
  MEASURABLE_ATMOSPHERE_DISTANCE,
  MissingVfxTableError,
  PARTICLE_KINDS,
  PLUME_KINDS,
  VFX_ERA_TABLES,
  advanceWeather,
  applyWeatherToFog,
  applyVfxSnapshot,
  atmosphereDistance,
  atmosphereSnapshotsDiffer,
  blendParticlePlans,
  blendVfxSnapshots,
  createHazeLayer,
  createParticleSystemSet,
  createPlumeSystem,
  createSkyDome,
  findKindPlan,
  gradeToPostProcessingPatch,
  precipitationStrength,
  resolveEmissiveTuning,
  resolveGradeConfig,
  resolveParticlePlan,
  resolvePlumePlan,
  resolveVfxSnapshot,
  summarizeSources,
  vfxTableFor,
  windVector,
} from '../../src/vfx'
import type {
  LightingParams,
  ParticlePlan,
  ParticleSystem,
  SceneQuality,
  VfxSnapshot,
  VfxTarget,
  WeatherState,
} from '../../src/vfx'

const HIGH: SceneQuality = resolveSceneQuality('high')

/** An era id the shipped registry does not know about (used for data mistakes). */
const UNKNOWN_ERA = '2055' as unknown as EraId

function snapshotFor(eraId: EraId, quality: SceneQuality = HIGH): VfxSnapshot {
  return resolveVfxSnapshot({
    era: getEra(eraId),
    table: vfxTableFor(eraId),
    quality,
  })
}

/** Every era snapshot, keyed by id, resolved once for the whole suite. */
const SNAPSHOTS: Readonly<Record<EraId, VfxSnapshot>> = Object.freeze(
  Object.fromEntries(ERA_IDS.map((eraId) => [eraId, snapshotFor(eraId)])) as Record<
    EraId,
    VfxSnapshot
  >,
)

/** An era whose tables enable snow, built from a shipped record. */
function withPrecipitation(
  base: EraId,
  precipitation: EraDefinition['atmosphere']['precipitation'],
  intensity: number,
): EraDefinition {
  const record = getEra(base)
  return {
    ...record,
    id: UNKNOWN_ERA,
    year: 2055,
    seed: `${record.seed}-snow`,
    atmosphere: { ...record.atmosphere, precipitation, precipitationIntensity: intensity },
  }
}

function positionsOf(system: ParticleSystem): Array<[number, number, number]> {
  const values = Array.from(system.positions)
  const result: Array<[number, number, number]> = []
  for (let index = 0; index < values.length; index += 3) {
    result.push([
      values[index] ?? Number.NaN,
      values[index + 1] ?? Number.NaN,
      values[index + 2] ?? Number.NaN,
    ])
  }
  return result
}

function positionChecksum(system: ParticleSystem): number {
  return Array.from(system.positions).reduce((sum, value) => sum + value, 0)
}

/** Steps a particle set across a whole simulated time span. */
function simulate(
  set: ReturnType<typeof createParticleSystemSet>,
  seconds: number,
  stepSeconds = 1 / 60,
): void {
  const steps = Math.round(seconds / stepSeconds)
  for (let step = 0; step < steps; step += 1) {
    set.step(stepSeconds, (step + 1) * stepSeconds)
  }
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

describe('era atmosphere data (src/vfx/tables.ts)', () => {
  it('ships one atmosphere table per registered era', () => {
    for (const eraId of ERA_IDS) {
      const table = vfxTableFor(eraId)
      expect(table.eraId).toBe(eraId)
      expect(table.sky.sunDiscSizeDeg).toBeGreaterThan(0)
      expect(table.haze.densityScale).toBeGreaterThan(0)
      expect(table.grade.bloomScale).toBeGreaterThan(0)
      expect(table.particles.countScale).toBeGreaterThan(0)
      expect(table.plumes.baseline.length).toBeGreaterThan(0)
      expect(Object.keys(table.plumes.rates).sort()).toEqual([...PLUME_KINDS].sort())
      for (const kind of PLUME_KINDS) {
        const rate = table.plumes.rates[kind]
        expect(Number.isFinite(rate)).toBe(true)
        expect(rate).toBeGreaterThanOrEqual(0)
      }
    }
    expect(Object.keys(VFX_ERA_TABLES)).toEqual([...ERA_IDS])
  })

  it('rejects an era that has no table instead of guessing', () => {
    expect(() => vfxTableFor(UNKNOWN_ERA)).toThrow(MissingVfxTableError)
  })

  it('takes sun, fog and colour grade from the era record itself', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const snapshot = SNAPSHOTS[eraId]
      // Sun: position, colour and intensity come straight from the era record.
      expect(snapshot.lighting.sunColor).toBe(era.lighting.sunColor)
      expect(snapshot.lighting.sunIntensity).toBeCloseTo(era.lighting.sunIntensity, 10)
      expect(snapshot.lighting.sunAzimuth).toBeCloseTo(
        (era.lighting.sunAzimuthDeg * Math.PI) / 180,
        10,
      )
      expect(snapshot.lighting.sunElevation).toBeCloseTo(
        (era.lighting.sunElevationDeg * Math.PI) / 180,
        10,
      )
      // Fog: colour from the era, density from the era haze density and table scale.
      expect(snapshot.fog.color).toBe(era.atmosphere.hazeColor)
      expect(snapshot.fog.density).toBeCloseTo(
        era.atmosphere.hazeDensity * vfxTableFor(eraId).haze.densityScale,
        10,
      )
      expect(snapshot.fog.density).toBeLessThanOrEqual(MAX_PIPELINE_FOG_DENSITY)
      expect(snapshot.lighting.fogDensity).toBeCloseTo(snapshot.fog.density, 10)
      expect(snapshot.lighting.fogColor).toBe(era.atmosphere.hazeColor)
      // Grade: the values the pipeline's grade pass executes come from the era.
      expect(snapshot.grade.saturation).toBeCloseTo(era.atmosphere.colourGrade.saturation, 10)
      expect(snapshot.grade.contrast).toBeCloseTo(era.atmosphere.colourGrade.contrast, 10)
      expect(snapshot.grade.temperature).toBeCloseTo(era.atmosphere.colourGrade.temperature, 10)
      expect(snapshot.grade.tint).toBeCloseTo(era.atmosphere.colourGrade.tint, 10)
      expect(snapshot.grade.exposure).toBeCloseTo(era.lighting.exposure, 10)
      expect(snapshot.grade.grain).toBeCloseTo(era.atmosphere.colourGrade.grain, 10)
      // Sky: the gradient is built from the era's own sky colours.
      expect(snapshot.sky.topColor).toBe(era.lighting.skyTopColor)
      expect(snapshot.sky.horizonColor).toBe(era.lighting.skyHorizonColor)
      expect(snapshot.sky.sunColor).toBe(era.lighting.sunColor)
      expect(snapshot.lighting.backgroundColor).toBe(era.lighting.skyHorizonColor)
    }
  })

  it('flags a below-horizon key light as night and shows stars only then', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const snapshot = SNAPSHOTS[eraId]
      const isNight = era.lighting.sunElevationDeg <= 0
      expect(snapshot.night).toBe(isNight)
      if (isNight) {
        expect(snapshot.sky.starOpacity).toBeGreaterThan(0)
      } else {
        expect(snapshot.sky.starOpacity).toBe(0)
      }
    }
  })

  it('gives every era a distinct atmosphere and adjacent eras a measurable distance', () => {
    for (let left = 0; left < ERA_IDS.length; left += 1) {
      for (let right = left + 1; right < ERA_IDS.length; right += 1) {
        const a = ERA_IDS[left] as EraId
        const b = ERA_IDS[right] as EraId
        expect(atmosphereSnapshotsDiffer(SNAPSHOTS[a], SNAPSHOTS[b])).toBe(true)
      }
    }
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previous = ERA_IDS[index - 1] as EraId
      const next = ERA_IDS[index] as EraId
      expect(atmosphereDistance(SNAPSHOTS[previous], SNAPSHOTS[next])).toBeGreaterThanOrEqual(
        MEASURABLE_ATMOSPHERE_DISTANCE,
      )
    }
  })

  it('resolves snapshots as plain, serialisable data', () => {
    const snapshot = SNAPSHOTS['1985']
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as VfxSnapshot
    expect(roundTripped).toEqual(snapshot)
    expect(atmosphereSnapshotsDiffer(snapshot, roundTripped)).toBe(false)
  })

  it('resolves a distinct particle configuration and plume set per era', () => {
    const totals = new Set<number>()
    const birdCounts = new Set<number>()
    const plumeRates = new Set<number>()
    for (const eraId of ERA_IDS) {
      const snapshot = SNAPSHOTS[eraId]
      totals.add(snapshot.particles.totalCount)
      birdCounts.add(snapshot.plumes.ambient.birds)
      for (const kind of snapshot.plumes.kinds) {
        plumeRates.add(Number(kind.ratePerSecond.toFixed(3)))
      }
      expect(snapshot.particles.totalCount).toBeGreaterThan(0)
      expect(snapshot.plumes.ambient.birds).toBeGreaterThan(0)
      expect(snapshot.plumes.baseline.length).toBeGreaterThan(0)
    }
    expect(totals.size).toBe(ERA_IDS.length)
    expect(birdCounts.size).toBe(ERA_IDS.length)
    expect(plumeRates.size).toBeGreaterThan(ERA_IDS.length)
  })
})

/* -------------------------------------------------------------------------- */
/* Weather particles                                                           */
/* -------------------------------------------------------------------------- */

describe('pooled weather particles (src/vfx/particles.ts)', () => {
  it('implements all four families', () => {
    expect([...PARTICLE_KINDS]).toEqual(['rain', 'snow', 'leaves', 'dust'])
  })

  it('gates rain and snow on the era precipitation', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const plan = SNAPSHOTS[eraId].particles
      const expectsRain =
        era.atmosphere.precipitation === 'drizzle' || era.atmosphere.precipitation === 'rain'
      expect(findKindPlan(plan, 'rain')?.enabled).toBe(expectsRain)
      expect(findKindPlan(plan, 'snow')?.enabled).toBe(era.atmosphere.precipitation === 'snow')
      expect(precipitationStrength(era, 'rain') > 0).toBe(expectsRain)
      expect(precipitationStrength(era, 'snow')).toBe(0)
    }
  })

  it('skips families the era never runs and keeps the rest inside their pools', () => {
    const set = createParticleSystemSet({ plan: SNAPSHOTS['1965'].particles })
    const kinds = set.systems.map((system) => system.kind)
    expect(kinds).not.toContain('rain')
    expect(kinds).not.toContain('snow')
    expect(kinds).toContain('leaves')
    expect(kinds).toContain('dust')
    expect(set.systems.every((system) => system.count > 0)).toBe(true)
    set.dispose()
  })

  it('scales counts with the shared quality tiers and honours reduced motion', () => {
    const rainCount = (tier: 'high' | 'medium' | 'low', reducedMotion = false): number => {
      const plan = resolveParticlePlan({
        era: getEra('1985'),
        table: vfxTableFor('1985'),
        quality: resolveQualityTier(tier),
        reducedMotion,
      })
      return findKindPlan(plan, 'rain')?.count ?? 0
    }
    expect(rainCount('high')).toBeGreaterThan(rainCount('medium'))
    expect(rainCount('medium')).toBeGreaterThan(rainCount('low'))
    expect(rainCount('high', true)).toBeLessThan(rainCount('high'))
    expect(rainCount('high', true)).toBeGreaterThan(0)
  })

  it('keeps every particle inside the spawn bounds and respawns leaving particles', () => {
    const plan = SNAPSHOTS['1985'].particles
    const set = createParticleSystemSet({ plan })
    const rain = set.systems.find((system) => system.kind === 'rain')
    expect(rain).toBeDefined()
    const rainSystem = rain as ParticleSystem
    const before = positionChecksum(rainSystem)
    simulate(set, 4)
    expect(positionChecksum(rainSystem)).not.toBe(before)
    expect(rainSystem.stats().respawned).toBeGreaterThan(0)
    expect(rainSystem.stats().alive).toBe(rainSystem.count)
    for (const system of set.systems) {
      for (const [x, y, z] of positionsOf(system)) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
        expect(Number.isFinite(z)).toBe(true)
        expect(Math.abs(x)).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.halfExtentX + 1e-3)
        expect(Math.abs(z)).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.halfExtentZ + 1e-3)
        expect(y).toBeGreaterThanOrEqual(DEFAULT_PARTICLE_BOUNDS.minY - 1e-3)
        expect(y).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.maxY + 1e-3)
      }
    }
    set.dispose()
  })

  it('drops particles when a plan stops running their family', () => {
    const set = createParticleSystemSet({ plan: SNAPSHOTS['1985'].particles })
    expect(set.systems.map((system) => system.kind)).toContain('rain')
    set.setPlan(SNAPSHOTS['1965'].particles)
    expect(set.systems.map((system) => system.kind)).not.toContain('rain')
    // A plan of the same shape keeps its live pools instead of rebuilding them.
    const kept = set.systems[0] as ParticleSystem
    set.setPlan(SNAPSHOTS['1965'].particles)
    expect(set.systems[0]).toBe(kept)
    set.dispose()
  })

  it('accumulates a wet-surface response in rain eras and stays dry elsewhere', () => {
    const wet = createParticleSystemSet({ plan: SNAPSHOTS['1985'].particles })
    simulate(wet, 40)
    expect(wet.weather.wetness).toBeGreaterThan(0.5)
    expect(wet.weather.wetness).toBeLessThanOrEqual(1)
    expect(wet.weather.precipitating).toBe(true)
    wet.dispose()

    const dry = createParticleSystemSet({ plan: SNAPSHOTS['1965'].particles })
    simulate(dry, 40)
    expect(dry.weather.wetness).toBe(0)
    expect(dry.weather.snowCover).toBe(0)
    expect(dry.weather.precipitating).toBe(false)
    dry.dispose()
  })

  it('accumulates snow cover for an era whose record enables snow', () => {
    const snowEra = withPrecipitation('1965', 'snow', 0.5)
    const plan = resolveParticlePlan({
      era: snowEra,
      table: vfxTableFor('1965'),
      quality: resolveQualityTier('high'),
    })
    expect(findKindPlan(plan, 'snow')?.enabled).toBe(true)
    expect(findKindPlan(plan, 'rain')?.enabled).toBe(false)

    const set = createParticleSystemSet({ plan })
    simulate(set, 200)
    expect(set.weather.snowCover).toBeGreaterThan(0.5)
    expect(set.weather.precipitating).toBe(true)
    // Drying out: a plan without snow relaxes the cover back towards zero.
    const relaxing = advanceWeather(set.weather, SNAPSHOTS['1965'].particles, 200)
    expect(relaxing.snowCover).toBeLessThan(set.weather.snowCover)
    set.dispose()
  })

  it('derives the wind from the era speed and the supplied clock', () => {
    expect(windVector(0, 12)).toEqual([0, 0, 0])
    const wind = windVector(6, 12)
    expect(Math.hypot(wind[0], wind[2])).toBeLessThanOrEqual(6)
    expect(wind).toEqual(windVector(6, 12))
    expect(wind).not.toEqual(windVector(6, 13))
  })

  it('blends weather plans discretely and deterministically', () => {
    const from: ParticlePlan = SNAPSHOTS['1945'].particles
    const to: ParticlePlan = SNAPSHOTS['2025'].particles
    expect(blendParticlePlans(from, to, 0)).toBe(from)
    expect(blendParticlePlans(from, to, 1)).toBe(to)
    expect(blendParticlePlans(from, to, 0.49)).toBe(from)
    expect(blendParticlePlans(from, to, 0.5)).toBe(to)
  })
})

/* -------------------------------------------------------------------------- */
/* Plumes                                                                      */
/* -------------------------------------------------------------------------- */

describe('plumes and ambient accents (src/vfx/plumes.ts)', () => {
  const quiet: WeatherState = { wetness: 0, snowCover: 0, leafLitter: 0, precipitating: false }

  function plumeStatsFor(
    eraId: EraId,
    seconds = 4,
    sources: Parameters<typeof summarizeSources>[0] = [],
  ) {
    const system = createPlumeSystem({ plan: SNAPSHOTS[eraId].plumes })
    system.setSources(sources)
    for (let step = 0; step < seconds * 60; step += 1) {
      system.step(1 / 60, (step + 1) / 60, quiet)
    }
    const stats = system.stats()
    system.dispose()
    return stats
  }

  it('resolves era baseline vents and ambient accents', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const plan = resolvePlumePlan(era, vfxTableFor(eraId))
      expect(plan.baseline.length).toBeGreaterThan(0)
      expect(plan.ambient.birds).toBeGreaterThan(0)
      expect(plan.accentColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(plan.kinds).toHaveLength(PLUME_KINDS.length)
      // Exhaust follows traffic and steam follows the crowd.
      expect(plan.kinds.find((kind) => kind.kind === 'exhaust')?.ratePerSecond).toBeCloseTo(
        vfxTableFor(eraId).plumes.rates.exhaust * (1 + era.traffic.trafficDensity),
        6,
      )
      expect(plan.kinds.find((kind) => kind.kind === 'steam')?.ratePerSecond).toBeCloseTo(
        vfxTableFor(eraId).plumes.rates.steam * (1 + era.population.pedestrianDensity),
        6,
      )
    }
  })

  it('emits the era baseline plumes with no caller input', () => {
    const stats = plumeStatsFor('1945')
    expect(stats.sourceEmitters).toBe(0)
    expect(stats.baselineSources).toBe(SNAPSHOTS['1945'].plumes.baseline.length)
    expect(stats.spawned).toBeGreaterThan(0)
    expect(stats.alive).toBeGreaterThan(0)
    expect(stats.emittersByKind.smoke).toBeGreaterThan(0)
    expect(stats.ambientBirds).toBe(SNAPSHOTS['1945'].plumes.ambient.birds)
    expect(stats.ambientAircraft).toBe(0)
  })

  it('activates emitters in proportion to the supplied sources and returns to baseline when emptied', () => {
    const baseline = plumeStatsFor('1985')
    const sources = [
      { id: 'car-a', kind: 'exhaust' as const, position: [4, 0.8, -6] as const, intensity: 1 },
      { id: 'car-b', kind: 'exhaust' as const, position: [8, 0.8, -6] as const, intensity: 1 },
      { id: 'car-c', kind: 'exhaust' as const, position: [12, 0.8, -6] as const, intensity: 1 },
      { id: 'vent-a', kind: 'steam' as const, position: [-6, 3, 9] as const, intensity: 1 },
      { id: 'ev-a', kind: 'evGlow' as const, position: [16, 1, 4] as const, intensity: 1 },
    ]
    const withSources = plumeStatsFor('1985', 4, sources)
    expect(withSources.baselineSources).toBe(baseline.baselineSources)
    expect(withSources.sourceEmitters).toBe(sources.length)
    expect(withSources.emittersByKind.exhaust).toBe(baseline.emittersByKind.exhaust + 3)
    expect(withSources.emittersByKind.steam).toBe(baseline.emittersByKind.steam + 1)
    expect(withSources.emittersByKind.evGlow).toBe(baseline.emittersByKind.evGlow + 1)
    expect(withSources.spawned).toBeGreaterThan(baseline.spawned)

    // Intensity drives the emission rate, not just the emitter count.
    const half = sources.map((source) => ({ ...source, intensity: 0.5 }))
    const withHalfIntensity = plumeStatsFor('1985', 4, half)
    expect(withHalfIntensity.sourceEmitters).toBe(sources.length)
    expect(withSources.spawned).toBeGreaterThan(withHalfIntensity.spawned)

    // Emptying the input returns the scene to exactly the era baseline.
    const emptied = plumeStatsFor('1985', 4, [])
    expect(emptied.sourceEmitters).toBe(0)
    expect(emptied.emittersByKind).toEqual(baseline.emittersByKind)
    expect(emptied.baselineSources).toBe(baseline.baselineSources)
    expect(emptied.spawned).toBeGreaterThan(0)
  })

  it('ignores idle events and counts live sources per family', () => {
    const counts = summarizeSources([
      { id: 'a', kind: 'steam', position: [0, 0, 0], intensity: 1 },
      { id: 'b', kind: 'steam', position: [0, 0, 0], intensity: 1, active: false },
      { id: 'c', kind: 'evGlow', position: [0, 0, 0], intensity: 1 },
    ])
    expect(counts.steam).toBe(1)
    expect(counts.evGlow).toBe(1)
    expect(counts.exhaust).toBe(0)
  })

  it('runs no exhaust of its own in the era whose fleet is electric', () => {
    // The 2025 era record's `traffic.modelKeys` are all electric, so the period
    // has no exhaust plume of its own; its accent is the EV-whine glow.
    expect(SNAPSHOTS['2025'].plumes.kinds.find((kind) => kind.kind === 'exhaust')?.ratePerSecond).toBe(0)
    expect(
      SNAPSHOTS['2025'].plumes.kinds.find((kind) => kind.kind === 'evGlow')?.ratePerSecond ?? 0,
    ).toBeGreaterThan(0)
    for (const eraId of ERA_IDS) {
      if (eraId === '2025') {
        continue
      }
      expect(
        SNAPSHOTS[eraId].plumes.kinds.find((kind) => kind.kind === 'exhaust')?.ratePerSecond ?? 0,
      ).toBeGreaterThan(0)
    }
  })

  it('still emits exhaust for a caller-supplied source in the electric era', () => {
    const withoutSources = plumeStatsFor('2025', 2)
    const withSources = plumeStatsFor('2025', 2, [
      { id: 'legacy-van', kind: 'exhaust', position: [0, 1, 0], intensity: 1 },
    ])
    expect(withSources.sourceEmitters).toBe(1)
    expect(withSources.emittersByKind.exhaust).toBe(1)
    expect(withSources.spawned).toBeGreaterThan(withoutSources.spawned)
  })

  it('rebuilds the ambient accents when the plan moves to another era', () => {
    const system = createPlumeSystem({ plan: SNAPSHOTS['1945'].plumes })
    expect(system.stats().ambientBirds).toBe(SNAPSHOTS['1945'].plumes.ambient.birds)
    expect(system.stats().ambientAircraft).toBe(SNAPSHOTS['1945'].plumes.ambient.aircraft)

    const next = SNAPSHOTS['1985'].plumes
    system.setPlan(next)
    expect(system.stats().ambientBirds).toBe(next.ambient.birds)
    expect(system.stats().ambientAircraft).toBe(next.ambient.aircraft)
    expect(system.stats().ambientBirds).not.toBe(SNAPSHOTS['1945'].plumes.ambient.birds)

    const meshes = system.ambientObject.children.map((child) => child.name)
    expect(meshes).toContain(BIRD_MESH_NAME)
    expect(meshes).toContain(AIRCRAFT_MESH_NAME)
    const birdMesh = system.ambientObject.children.find(
      (child) => child.name === BIRD_MESH_NAME,
    ) as InstancedMesh | undefined
    expect(birdMesh?.count).toBe(next.ambient.birds)
    system.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* Structures                                                                  */
/* -------------------------------------------------------------------------- */

describe('sky dome and haze wall', () => {
  it('writes the resolved sky gradient and sun direction into the dome', () => {
    const dome = createSkyDome({ radius: 220 })
    expect(dome.radius).toBe(220)
    expect(dome.object).toBeInstanceOf(Group)

    dome.apply(SNAPSHOTS['1985'].sky)
    const mesh = dome.object.children[0] as Mesh
    const material = mesh.material as ShaderMaterial
    const top = material.uniforms['uTopColor']?.value as Color
    const horizon = material.uniforms['uHorizonColor']?.value as Color
    const sun = material.uniforms['uSunDirection']?.value as { x: number; y: number; z: number }
    expect(top.getHex()).toBe(new Color(SNAPSHOTS['1985'].sky.topColor).getHex())
    expect(horizon.getHex()).toBe(new Color(SNAPSHOTS['1985'].sky.horizonColor).getHex())
    expect(material.uniforms['uStarOpacity']?.value).toBeCloseTo(SNAPSHOTS['1985'].sky.starOpacity, 6)
    expect(material.uniforms['uExposure']?.value).toBeCloseTo(SNAPSHOTS['1985'].sky.exposure, 6)
    expect(sun.x).toBeCloseTo(SNAPSHOTS['1985'].sky.sunDirection[0], 6)
    expect(sun.y).toBeCloseTo(SNAPSHOTS['1985'].sky.sunDirection[1], 6)
    expect(sun.z).toBeCloseTo(SNAPSHOTS['1985'].sky.sunDirection[2], 6)

    // Another era never leaves the dome on the same gradient.
    dome.apply(SNAPSHOTS['1965'].sky)
    expect((material.uniforms['uTopColor']?.value as Color).getHex()).toBe(
      new Color(SNAPSHOTS['1965'].sky.topColor).getHex(),
    )
    expect((material.uniforms['uTopColor']?.value as Color).getHex()).not.toBe(
      new Color(SNAPSHOTS['1985'].sky.topColor).getHex(),
    )
    dome.dispose()
  })

  it('writes fog into the haze wall and thickens it when the surface is wet', () => {
    const haze = createHazeLayer({ radius: 120 })
    const dry: WeatherState = { wetness: 0, snowCover: 0, leafLitter: 0, precipitating: false }
    const wet: WeatherState = { wetness: 1, snowCover: 0, leafLitter: 0, precipitating: true }
    haze.apply(SNAPSHOTS['1985'].fog, dry)

    const mesh = haze.object.children[0] as Mesh
    const material = mesh.material as ShaderMaterial
    const dryOpacity = material.uniforms['uOpacity']?.value as number
    expect(dryOpacity).toBeCloseTo(SNAPSHOTS['1985'].fog.groundHazeOpacity, 6)
    expect(mesh.scale.y).toBeCloseTo(
      SNAPSHOTS['1985'].fog.groundHazeHeight / HAZE_GEOMETRY_HEIGHT,
      6,
    )

    haze.apply(SNAPSHOTS['1985'].fog, wet)
    expect(material.uniforms['uOpacity']?.value as number).toBeGreaterThan(dryOpacity)
    expect(material.uniforms['uWetness']?.value as number).toBe(1)
    expect(applyWeatherToFog(SNAPSHOTS['1985'].fog, wet).groundHazeOpacity).toBeGreaterThan(
      applyWeatherToFog(SNAPSHOTS['1985'].fog, dry).groundHazeOpacity,
    )

    // A dry era renders a thinner wall than the wet one, from the same code path.
    haze.apply(SNAPSHOTS['1965'].fog, dry)
    expect(material.uniforms['uOpacity']?.value as number).toBeLessThan(dryOpacity)
    haze.dispose()
  })

  it('tunes emissive glow per era', () => {
    const neon = SNAPSHOTS['1985']
    const postwar = SNAPSHOTS['1945']
    const modern = SNAPSHOTS['2025']
    expect(neon.emissive.glowIntensity).toBeGreaterThan(postwar.emissive.glowIntensity)
    expect(modern.emissive.glowIntensity).toBeGreaterThan(postwar.emissive.glowIntensity)
    expect(neon.emissive.neonBoost).toBeGreaterThan(postwar.emissive.neonBoost)
    expect(neon.emissive.headlightScale).toBe(getEra('1985').traffic.headlightIntensity)

    const era = getEra('1985')
    const table = vfxTableFor('1985')
    expect(resolveEmissiveTuning(era, table, resolveGradeConfig(era, table))).toEqual(neon.emissive)
  })
})

/* -------------------------------------------------------------------------- */
/* Degradation                                                                 */
/* -------------------------------------------------------------------------- */

describe('graceful degradation', () => {
  const grade = SNAPSHOTS['1985'].grade
  const emissive = SNAPSHOTS['1985'].emissive

  it('switches off passes the tier cannot afford', () => {
    const full = gradeToPostProcessingPatch(grade, emissive, {
      postprocessing: true,
      bloom: true,
      depthOfField: true,
    })
    expect(full.enabled).toBe(true)
    expect(full.bloom?.enabled).toBe(true)
    expect(full.depthOfField?.enabled).toBe(grade.depthOfField.enabled)

    const noBloom = gradeToPostProcessingPatch(grade, emissive, {
      postprocessing: true,
      bloom: false,
      depthOfField: false,
    })
    expect(noBloom.bloom?.enabled).toBe(false)
    expect(noBloom.depthOfField?.enabled).toBe(false)
    expect(noBloom.grade?.saturation).toBeCloseTo(grade.saturation, 6)

    const plain = gradeToPostProcessingPatch(grade, emissive, {
      postprocessing: false,
      bloom: false,
      depthOfField: false,
    })
    expect(plain.enabled).toBe(false)
  })

  it('falls back to the plain pipeline when the target refuses post-processing', () => {
    const applied: Array<Partial<LightingParams>> = []
    const refusing: VfxTarget = {
      applyLighting: (params) => {
        applied.push(params)
        return params as LightingParams
      },
      applyPostProcessing: () => {
        throw new Error('no composer on this GPU')
      },
    }
    const snapshot = applyVfxSnapshot(SNAPSHOTS['1945'], refusing)
    expect(snapshot.eraId).toBe('1945')
    expect(applied).toHaveLength(1)
    expect(applied[0]?.fogDensity).toBeCloseTo(SNAPSHOTS['1945'].fog.density, 10)

    const lost: VfxTarget = {
      applyLighting: () => {
        throw new Error('context lost')
      },
      applyPostProcessing: () => {
        throw new Error('context lost')
      },
    }
    expect(() => applyVfxSnapshot(SNAPSHOTS['2005'], lost)).not.toThrow()
  })

  it('resolves a snapshot without post-processing for the cheapest tier', () => {
    const low = snapshotFor('1985', resolveSceneQuality('low'))
    expect(low.postProcessing.enabled).toBe(false)
    expect(low.postProcessing.bloom.enabled).toBe(false)
    // Weather still runs: the tier only thins it.
    expect(low.particles.totalCount).toBeLessThan(SNAPSHOTS['1985'].particles.totalCount)
    expect(low.particles.totalCount).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/* Transitions                                                                 */
/* -------------------------------------------------------------------------- */

describe('staged era changes', () => {
  const from = SNAPSHOTS['1945']
  const to = SNAPSHOTS['2025']

  it('returns the ends unchanged and interpolates the middle', () => {
    expect(blendVfxSnapshots(from, to, 0)).toBe(from)
    expect(blendVfxSnapshots(from, to, 1)).toBe(to)

    const middle = blendVfxSnapshots(from, to, 0.5)
    const between = (a: number, b: number, value: number): void => {
      expect(value).toBeGreaterThan(Math.min(a, b))
      expect(value).toBeLessThan(Math.max(a, b))
    }
    between(from.fog.density, to.fog.density, middle.fog.density)
    between(from.lighting.sunElevation, to.lighting.sunElevation, middle.lighting.sunElevation)
    between(from.grade.saturation, to.grade.saturation, middle.grade.saturation)
    between(from.emissive.glowIntensity, to.emissive.glowIntensity, middle.emissive.glowIntensity)
    // The identity of the blended snapshot follows the nearer era: the source
    // below the midpoint, the destination from the midpoint on.
    expect(blendVfxSnapshots(from, to, 0.49).eraId).toBe(from.eraId)
    expect(middle.eraId).toBe(to.eraId)
    expect(blendVfxSnapshots(from, to, 0.75).eraId).toBe(to.eraId)
  })

  it('moves continuously rather than popping between adjacent eras', () => {
    const a = SNAPSHOTS['1985']
    const b = SNAPSHOTS['2005']
    const range = Math.abs(a.fog.density - b.fog.density)
    let previousFog = blendVfxSnapshots(a, b, 0).fog.density
    for (let step = 1; step <= 20; step += 1) {
      const snapshot = blendVfxSnapshots(a, b, step / 20)
      expect(Number.isFinite(snapshot.fog.density)).toBe(true)
      expect(Math.abs(snapshot.fog.density - previousFog)).toBeLessThan(range * 0.5)
      previousFog = snapshot.fog.density
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Registry integration                                                        */
/* -------------------------------------------------------------------------- */

describe('registry integration', () => {
  it('serves an extended registry whose extra era carries its own weather data', () => {
    const snowEra = withPrecipitation('1965', 'snow', 0.4)
    const registry = createEraRegistry([...ERA_REGISTRY.definitions, snowEra])
    expect(registry.count).toBe(ERA_REGISTRY.count + 1)
    expect(registry.last.id).toBe(snowEra.id)
    expect(registry.previous(snowEra.id)?.id).toBe('2025')
  })
})
