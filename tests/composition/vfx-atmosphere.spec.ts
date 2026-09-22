/**
 * Composition checks for the atmosphere layer.
 *
 * The unit suite pins the layer's own data and maths down; this suite drives the
 * *real* pieces together: the shipped era registry, the render pipeline's real
 * parameter builders (`createLightingParams`, `createPostProcessingParams`) and
 * the real `VfxLayer` / `createVfxController` pair.
 *
 * The pipeline's canvas host cannot run in jsdom (no WebGL), so the composition
 * target is a structural stand-in for the pipeline's public surface: it satisfies
 * `VfxTarget` and applies every patch through the pipeline's own builders, which
 * is exactly the part of the real pipeline the atmosphere talks to.
 */

import { Group, InstancedMesh } from 'three'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ERA_REGISTRY, getEra } from '../../src/era'
import type { EraId } from '../../src/era'
import { resolveQualityTier } from '../../src/lib/quality'
import type { QualityTierName } from '../../src/lib/quality'
import {
  createLightingParams,
  createPostProcessingParams,
  resolveSceneQuality,
} from '../../src/scene'
import type {
  FrameHook,
  FrameStats,
  LightingParams,
  PostProcessingParams,
  PostProcessingParamsPatch,
  SceneQuality,
} from '../../src/scene'
import {
  AMBIENT_GROUP_NAME,
  BIRD_MESH_NAME,
  DEFAULT_PARTICLE_BOUNDS,
  HAZE_GROUP_NAME,
  PARTICLE_GROUP_NAME,
  PLUME_GROUP_NAME,
  SKY_GROUP_NAME,
  VFX_ROOT_NAME,
  VfxLayer,
  applyEra,
  applyEraTransition,
  createVfxController,
  vfxTableFor,
} from '../../src/vfx'
import type { PlumeSources, VfxContext, VfxTarget } from '../../src/vfx'
import { renderWithProviders } from '../support/render'

/* -------------------------------------------------------------------------- */
/* Recording pipeline stand-in                                                 */
/* -------------------------------------------------------------------------- */

/** A frame-stats record good enough for a frame hook. */
function frameStats(frames: number): FrameStats {
  return {
    frames,
    frameTimeMs: 16.6,
    averageFrameTimeMs: 16.6,
    minFrameTimeMs: 12,
    maxFrameTimeMs: 21,
    fps: 60,
    averageFps: 60,
    budgetMs: 16.6,
    withinBudget: true,
    overBudgetFrames: 0,
    consecutiveOverBudgetFrames: 0,
  }
}

interface RecordingTarget extends VfxTarget {
  readonly world: Group
  readonly quality: SceneQuality
  readonly lightingCalls: Array<Partial<LightingParams>>
  readonly postProcessingCalls: PostProcessingParamsPatch[]
  /** Parameter record the "rig" currently holds, merged by the real builder. */
  lighting: LightingParams
  postProcessing: PostProcessingParams
  frames: number
  /** Runs every registered frame hook, like the pipeline's animation loop. */
  tick(deltaSeconds: number): void
}

function createRecordingTarget(
  options: { tier?: QualityTierName; failPostProcessing?: boolean } = {},
): RecordingTarget {
  const quality = resolveSceneQuality(options.tier ?? 'high')
  const world = new Group()
  world.name = 'world'
  const hooks = new Set<FrameHook>()
  const lightingCalls: Array<Partial<LightingParams>> = []
  const postProcessingCalls: PostProcessingParamsPatch[] = []

  const target: RecordingTarget = {
    world,
    quality,
    lightingCalls,
    postProcessingCalls,
    lighting: createLightingParams({}, createLightingParams()),
    postProcessing: createPostProcessingParams(),
    frames: 0,
    applyLighting(params: Partial<LightingParams>): LightingParams {
      lightingCalls.push(params)
      // The real builder is what makes the value the pipeline actually holds.
      target.lighting = createLightingParams(params, target.lighting)
      return target.lighting
    },
    applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams {
      postProcessingCalls.push(params)
      if (options.failPostProcessing === true) {
        throw new Error('composer unavailable on this GPU')
      }
      target.postProcessing = createPostProcessingParams(params, target.postProcessing)
      return target.postProcessing
    },
    onFrame(hook: FrameHook): () => void {
      hooks.add(hook)
      return () => hooks.delete(hook)
    },
    tick(deltaSeconds: number): void {
      target.frames += 1
      for (const hook of hooks) {
        hook(frameStats(target.frames), deltaSeconds)
      }
    },
  }

  return target
}

const POSITION_BOUNDS = DEFAULT_PARTICLE_BOUNDS

function particleMeshes(root: Group): InstancedMesh[] {
  const group = root.children.find((child) => child.name === PARTICLE_GROUP_NAME)
  if (group === undefined) {
    return []
  }
  return group.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh)
}

function plumeMeshes(root: Group): InstancedMesh[] {
  const group = root.children.find((child) => child.name === PLUME_GROUP_NAME)
  if (group === undefined) {
    return []
  }
  return group.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh)
}

/** Finds a named group anywhere under `root` (the ambience sits inside plumes). */
function findGroup(root: Group, name: string): Group | undefined {
  let found: Group | undefined
  root.traverse((child) => {
    if (found === undefined && child instanceof Group && child.name === name) {
      found = child
    }
  })
  return found
}

/* -------------------------------------------------------------------------- */
/* Era values reaching the pipeline                                            */
/* -------------------------------------------------------------------------- */

describe('era atmosphere in the real pipeline surface', () => {
  it('writes every era\'s sun, fog and grade through the pipeline parameter builders', () => {
    for (const eraId of ERA_REGISTRY.ids) {
      const target = createRecordingTarget()
      const controller = createVfxController({ target, era: eraId, clock: { seconds: 0 } })
      const era = getEra(eraId)
      const snapshot = controller.snapshot

      expect(target.lightingCalls).toHaveLength(1)
      const patch = target.lightingCalls[0] as Partial<LightingParams>

      // Sun: elevation, azimuth and colour survive the real builder's clamping.
      const resolved = createLightingParams(patch)
      expect(resolved.sunElevation).toBeCloseTo((era.lighting.sunElevationDeg * Math.PI) / 180, 10)
      expect(resolved.sunAzimuth).toBeCloseTo((era.lighting.sunAzimuthDeg * Math.PI) / 180, 10)
      expect(resolved.sunColor).toBe(era.lighting.sunColor)
      expect(resolved.sunIntensity).toBeCloseTo(era.lighting.sunIntensity, 10)

      // Fog: the era's haze colour and scaled density reach the pipeline's fog.
      expect(target.lighting.fogColor).toBe(era.atmosphere.hazeColor)
      expect(target.lighting.fogDensity).toBeCloseTo(
        era.atmosphere.hazeDensity * vfxTableFor(eraId).haze.densityScale,
        10,
      )
      expect(target.lighting.fogDensity).toBeCloseTo(snapshot.fog.density, 10)

      // Grade: the era's colour grade reaches the post-processing chain.
      expect(target.postProcessingCalls).toHaveLength(1)
      const post = createPostProcessingParams(target.postProcessingCalls[0] ?? {})
      expect(post.grade.saturation).toBeCloseTo(era.atmosphere.colourGrade.saturation, 6)
      expect(post.grade.contrast).toBeCloseTo(era.atmosphere.colourGrade.contrast, 6)
      expect(post.grade.temperature).toBeCloseTo(era.atmosphere.colourGrade.temperature, 6)
      expect(post.grade.tint).toBeCloseTo(era.atmosphere.colourGrade.tint, 6)
      expect(target.postProcessing.grade.saturation).toBeCloseTo(
        era.atmosphere.colourGrade.saturation,
        6,
      )
      expect(target.postProcessing.bloom.intensity).toBeCloseTo(snapshot.grade.bloomIntensity, 6)
      expect(target.postProcessing.vignette.darkness).toBeCloseTo(era.atmosphere.colourGrade.vignette, 6)

      controller.dispose()
    }
  })

  it('mounts one root group with the era structures and removes it on dispose', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '1985', clock: { seconds: 0 } })

    expect(target.world.children).toHaveLength(1)
    const root = target.world.children[0] as Group
    expect(root.name).toBe(VFX_ROOT_NAME)
    expect(root.children.map((child) => child.name)).toEqual([
      SKY_GROUP_NAME,
      HAZE_GROUP_NAME,
      PARTICLE_GROUP_NAME,
      PLUME_GROUP_NAME,
    ])

    // The weather pools match the era's own plan: 1985 is a wet, hazy era.
    const expectedParticleNames = controller.snapshot.particles.kinds
      .filter((kind) => kind.enabled && kind.count > 0)
      .map((kind) => `vfx-particles-${kind.kind}`)
    expect(particleMeshes(root).map((mesh) => mesh.name)).toEqual(expectedParticleNames)
    for (const mesh of particleMeshes(root)) {
      const plan = controller.snapshot.particles.kinds.find(
        (kind) => `vfx-particles-${kind.kind}` === mesh.name,
      )
      expect(mesh.count).toBe(plan?.count)
    }

    // Ambience and plume pools are present, and the stats report the same counts.
    const stats = controller.getStats()
    expect(stats.groups[SKY_GROUP_NAME]).toBe(1)
    expect(stats.groups[HAZE_GROUP_NAME]).toBe(1)
    expect(stats.groups[PARTICLE_GROUP_NAME]).toBe(expectedParticleNames.length)
    expect(stats.groups[AMBIENT_GROUP_NAME]).toBeGreaterThan(0)
    expect(plumeMeshes(root).length).toBeGreaterThan(0)

    controller.dispose()
    expect(target.world.children).toHaveLength(0)
  })

  it('rejects an unknown era deterministically without touching the pipeline', () => {
    const target = createRecordingTarget()
    const ctx: VfxContext = { target, qualityTier: 'high' }
    const before = target.lighting

    expect(() => applyEra('1990' as unknown as EraId, ctx)).toThrow()
    expect(() => applyEra(undefined as unknown as EraId, ctx)).toThrow()
    expect(() =>
      applyEraTransition({ from: '1945', to: '1990' as unknown as EraId, t: 0.5 }, ctx),
    ).toThrow()

    // A rejected call is a no-op: no parameter reached the pipeline.
    expect(target.lightingCalls).toHaveLength(0)
    expect(target.postProcessingCalls).toHaveLength(0)
    expect(target.lighting).toBe(before)
    expect(target.world.children).toHaveLength(0)
  })

  it('gives different eras different structure counts', () => {
    const quiet = createRecordingTarget()
    const wet = createRecordingTarget()
    const quietController = createVfxController({ target: quiet, era: '1965', clock: { seconds: 0 } })
    const wetController = createVfxController({ target: wet, era: '1945', clock: { seconds: 0 } })
    const quietKinds = quietController.snapshot.particles.kinds.map((kind) => `${kind.kind}:${kind.count}`)
    const wetKinds = wetController.snapshot.particles.kinds.map((kind) => `${kind.kind}:${kind.count}`)
    expect(quietKinds).not.toEqual(wetKinds)
    expect(wetController.snapshot.particles.totalCount).toBeGreaterThan(
      quietController.snapshot.particles.totalCount,
    )
    quietController.dispose()
    wetController.dispose()
  })

  it('follows the era ambient accents when the era changes', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '1945', clock: { seconds: 0 } })
    const initial = controller.getStats().plumes.ambientBirds
    expect(initial).toBe(controller.snapshot.plumes.ambient.birds)

    controller.applyEra('1985')
    const changed = controller.getStats().plumes
    expect(changed.ambientBirds).toBe(controller.snapshot.plumes.ambient.birds)
    expect(changed.ambientAircraft).toBe(controller.snapshot.plumes.ambient.aircraft)
    expect(changed.ambientBirds).not.toBe(initial)

    // The scene graph reflects the new count too, not just the statistics.
    const root = target.world.children[0] as Group
    const birdMesh = findGroup(root, AMBIENT_GROUP_NAME)?.children.find(
      (child) => child.name === BIRD_MESH_NAME,
    ) as InstancedMesh | undefined
    expect(birdMesh?.count).toBe(changed.ambientBirds)
    controller.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* Clock-driven simulation                                                     */
/* -------------------------------------------------------------------------- */

describe('simulation driven by the supplied clock', () => {
  function advance(target: RecordingTarget, clock: { seconds: number }, seconds: number): void {
    const step = 1 / 60
    for (let index = 0; index < Math.round(seconds / step); index += 1) {
      clock.seconds = Number((clock.seconds + step).toFixed(6))
      target.tick(step)
    }
  }

  it('advances particles with the caller clock and keeps them inside their bounds', () => {
    const target = createRecordingTarget()
    const clock = { seconds: 0 }
    const controller = createVfxController({ target, era: '1985', clock })
    const root = target.world.children[0] as Group
    const rain = particleMeshes(root).find((mesh) => mesh.name === 'vfx-particles-rain')
    expect(rain).toBeDefined()

    const framesBefore = controller.getStats().frames
    advance(target, clock, 2)
    expect(controller.getStats().frames).toBeGreaterThan(framesBefore)
    expect(controller.getStats().clockSeconds).toBeCloseTo(2, 1)

    // Rain respawns as it leaves the volume, and the wet-surface response rises.
    const stats = controller.getStats()
    const rainStats = stats.particles.find((kind) => kind.kind === 'rain')
    expect(rainStats?.respawned).toBeGreaterThan(0)
    expect(stats.weather.wetness).toBeGreaterThan(0)
    expect(stats.weather.precipitating).toBe(true)

    // Every particle of every family stays inside the spawn volume.
    for (const mesh of particleMeshes(root)) {
      const matrix = mesh.instanceMatrix
      expect(matrix.count).toBeGreaterThan(0)
      for (let index = 0; index < matrix.count; index += 1) {
        const x = matrix.array[index * 16 + 12]
        const y = matrix.array[index * 16 + 13]
        const z = matrix.array[index * 16 + 14]
        expect(Math.abs(x as number)).toBeLessThanOrEqual(POSITION_BOUNDS.halfExtentX + 1e-3)
        expect(Math.abs(z as number)).toBeLessThanOrEqual(POSITION_BOUNDS.halfExtentZ + 1e-3)
        expect(y as number).toBeGreaterThanOrEqual(POSITION_BOUNDS.minY - 1e-3)
        expect(y as number).toBeLessThanOrEqual(POSITION_BOUNDS.maxY + 1e-3)
      }
    }
    controller.dispose()
  })

  it('is deterministic for the same era, clock and seed', () => {
    const sample = (): number[] => {
      const target = createRecordingTarget()
      const clock = { seconds: 0 }
      const controller = createVfxController({ target, era: '1985', clock, seed: 'vfx-spec' })
      advance(target, clock, 1.5)
      const root = target.world.children[0] as Group
      const values = particleMeshes(root).flatMap((mesh) => Array.from(mesh.instanceMatrix.array))
      controller.dispose()
      return values
    }
    expect(sample()).toEqual(sample())
  })

  it('publishes statistics to an onStats callback', () => {
    const target = createRecordingTarget()
    const clock = { seconds: 0 }
    const seen: number[] = []
    const controller = createVfxController({
      target,
      era: '2005',
      clock,
      onStats: (stats) => seen.push(stats.frames),
    })
    advance(target, clock, 0.5)
    expect(seen.length).toBeGreaterThan(20)
    expect(seen[seen.length - 1]).toBe(controller.getStats().frames)
    controller.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* Transitions                                                                 */
/* -------------------------------------------------------------------------- */

describe('staged era changes reaching the pipeline', () => {
  it('lands exactly on the destination era at t = 1 and restores the source at t = 0', () => {
    const target = createRecordingTarget()
    const ctx: VfxContext = { target, qualityTier: 'high' }
    const destination = applyEraTransition({ from: '1945', to: '2005', t: 1 }, ctx)
    const direct = applyEra('2005', ctx)
    expect(destination).toEqual(direct)

    const source = applyEraTransition({ from: '1945', to: '2005', t: 0 }, ctx)
    expect(source).toEqual(applyEra('1945', ctx))

    // An instant switch (the reduced-motion path) is the destination era exactly.
    const instant = applyEraTransition({ from: '1945', to: '2005', t: 0.35, instant: true }, ctx)
    expect(instant).toEqual(direct)
  })

  it('moves the pipeline\'s own values gradually towards the destination', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '1945', clock: { seconds: 0 } })
    const finalFog = controller.applyTransition({ from: '1945', to: '2025', t: 1 }).fog.density
    const quarter = controller.applyTransition({ from: '1945', to: '2025', t: 0.25 })
    const midway = controller.applyTransition({ from: '1945', to: '2025', t: 0.5 })
    const threeQuarters = controller.applyTransition({ from: '1945', to: '2025', t: 0.75 })

    expect(Math.abs(quarter.fog.density - finalFog)).toBeGreaterThan(
      Math.abs(midway.fog.density - finalFog),
    )
    expect(Math.abs(midway.fog.density - finalFog)).toBeGreaterThan(
      Math.abs(threeQuarters.fog.density - finalFog),
    )
    // The pipeline holds the blended value at every step, not a hard switch.
    expect(target.lighting.fogDensity).toBeCloseTo(threeQuarters.fog.density, 10)
    expect(controller.snapshot.fog.density).toBeCloseTo(threeQuarters.fog.density, 10)
    // ... and the last step lands exactly on the destination era.
    const landed = controller.applyTransition({ from: '1945', to: '2025', t: 1 })
    expect(landed.fog.density).toBeCloseTo(finalFog, 10)
    expect(target.lighting.fogDensity).toBeCloseTo(finalFog, 10)
    controller.dispose()
  })

  it('switches quality tiers with the atmosphere still applied', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '1985', clock: { seconds: 0 } })
    const highCount = controller.snapshot.particles.totalCount
    const low = controller.setQualityTier('low')
    expect(low.qualityTier).toBe('low')
    expect(low.postProcessing.enabled).toBe(false)
    expect(low.particles.totalCount).toBeLessThan(highCount)
    expect(target.lighting.fogColor).toBe(getEra('1985').atmosphere.hazeColor)
    expect(target.postProcessing.enabled).toBe(false)
    controller.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* plumeSources                                                                */
/* -------------------------------------------------------------------------- */

describe('caller-supplied plumeSources', () => {
  function advance(target: RecordingTarget, clock: { seconds: number }, seconds: number): void {
    const step = 1 / 60
    for (let index = 0; index < Math.round(seconds / step); index += 1) {
      clock.seconds = Number((clock.seconds + step).toFixed(6))
      target.tick(step)
    }
  }

  function sources(count: number, intensity: number): PlumeSources {
    return Array.from({ length: count }, (_unused, index) => ({
      id: `car-${index}`,
      kind: 'exhaust' as const,
      position: [-10 + index * 4, 0.8, -6] as const,
      intensity,
    }))
  }

  it('activates emitters from the supplied events and returns to the era baseline when emptied', () => {
    const target = createRecordingTarget()
    const clock = { seconds: 0 }
    const controller = createVfxController({ target, era: '1985', clock })
    advance(target, clock, 3)
    const baseline = controller.getStats().plumes
    expect(baseline.sourceEmitters).toBe(0)
    expect(baseline.spawned).toBeGreaterThan(0)
    expect(baseline.emittersByKind).toEqual(
      expect.objectContaining({ steam: expect.any(Number) }),
    )

    controller.setPlumeSources(sources(5, 1))
    advance(target, clock, 3)
    const fed = controller.getStats().plumes
    expect(fed.sourceEmitters).toBe(5)
    expect(fed.emittersByKind.exhaust).toBe(baseline.emittersByKind.exhaust + 5)
    expect(fed.spawned).toBeGreaterThan(baseline.spawned)

    controller.setPlumeSources([])
    advance(target, clock, 3)
    const emptied = controller.getStats().plumes
    expect(emptied.sourceEmitters).toBe(0)
    expect(emptied.emittersByKind).toEqual(baseline.emittersByKind)
    expect(emptied.baselineSources).toBe(baseline.baselineSources)

    controller.dispose()
  })

  it('emits more the more events it is given', () => {
    const small = createRecordingTarget()
    const many = createRecordingTarget()
    const smallClock = { seconds: 0 }
    const manyClock = { seconds: 0 }
    const smallController = createVfxController({ target: small, era: '1985', clock: smallClock })
    const manyController = createVfxController({ target: many, era: '1985', clock: manyClock })
    smallController.setPlumeSources(sources(2, 1))
    manyController.setPlumeSources(sources(6, 1))
    advance(small, smallClock, 4)
    advance(many, manyClock, 4)
    expect(manyController.getStats().plumes.spawned).toBeGreaterThan(
      smallController.getStats().plumes.spawned,
    )
    smallController.dispose()
    manyController.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* Degradation                                                                 */
/* -------------------------------------------------------------------------- */

describe('degradation', () => {
  it('keeps working when the pipeline refuses the post-processing chain', () => {
    const target = createRecordingTarget({ failPostProcessing: true })
    expect(() =>
      createVfxController({ target, era: '1985', clock: { seconds: 0 } }),
    ).not.toThrow()
    expect(target.lighting.fogColor).toBe(getEra('1985').atmosphere.hazeColor)
    expect(target.postProcessingCalls.length).toBeGreaterThan(0)
  })

  it('resolves the cheapest tier without post-processing but with weather', () => {
    const target = createRecordingTarget({ tier: 'low' })
    const controller = createVfxController({ target, era: '1985', clock: { seconds: 0 } })
    expect(target.postProcessing.enabled).toBe(false)
    expect(controller.snapshot.particles.totalCount).toBeGreaterThan(0)
    expect(controller.getStats().particles.length).toBeGreaterThan(0)
    controller.dispose()
  })

  it('honours reduced motion by thinning the effects', () => {
    const full = createRecordingTarget()
    const reduced = createRecordingTarget()
    const fullController = createVfxController({ target: full, era: '1985', clock: { seconds: 0 } })
    const reducedController = createVfxController({
      target: reduced,
      era: '1985',
      clock: { seconds: 0 },
      reducedMotion: true,
    })
    expect(reducedController.snapshot.particles.totalCount).toBeLessThan(
      fullController.snapshot.particles.totalCount,
    )
    expect(reducedController.getStats().plumes.ambientBirds).toBeLessThanOrEqual(
      fullController.getStats().plumes.ambientBirds,
    )
    fullController.dispose()
    reducedController.dispose()
  })
})

/* -------------------------------------------------------------------------- */
/* React component                                                             */
/* -------------------------------------------------------------------------- */

describe('<VfxLayer> mounted against a pipeline', () => {
  it('drives the pipeline from props and switches era on re-render', () => {
    const target = createRecordingTarget()
    const clock = { seconds: 0 }
    const ready: string[] = []
    const stats: number[] = []
    const { rerender, unmount } = renderWithProviders(
      createElement(VfxLayer, {
        pipeline: target,
        era: '1945' as EraId,
        clock,
        plumeSources: [],
        qualityTier: resolveQualityTier('high').name,
        onReady: (controller) => ready.push(controller.snapshot.eraId),
        onStats: (value) => stats.push(value.frames),
      }),
    )

    expect(ready).toEqual(['1945'])
    expect(target.lighting.fogColor).toBe(getEra('1945').atmosphere.hazeColor)
    const root = target.world.children[0] as Group
    expect(root.name).toBe(VFX_ROOT_NAME)

    // The pipeline drives frames; the layer follows the caller's clock.
    clock.seconds = 1
    target.tick(1 / 60)
    expect(stats.length).toBeGreaterThan(0)

    rerender(
      createElement(VfxLayer, {
        pipeline: target,
        era: '1985' as EraId,
        clock,
        plumeSources: [{ id: 'lamp-vent', kind: 'steam', position: [2, 1, -6], intensity: 0.8 }],
        onStats: (value) => stats.push(value.frames),
      }),
    )
    expect(target.lighting.fogColor).toBe(getEra('1985').atmosphere.hazeColor)
    expect(target.lighting.fogDensity).toBeCloseTo(
      getEra('1985').atmosphere.hazeDensity * vfxTableFor('1985').haze.densityScale,
      10,
    )
    expect(target.postProcessing.grade.saturation).toBeCloseTo(
      getEra('1985').atmosphere.colourGrade.saturation,
      6,
    )

    unmount()
    expect(target.world.children).toHaveLength(0)
  })

  it('renders nothing and does nothing without a pipeline', () => {
    const { container, unmount } = renderWithProviders(
      createElement(VfxLayer, { era: '1985' as EraId, clock: { seconds: 0 } }),
    )
    expect(container).toBeEmptyDOMElement()
    unmount()
  })
})

/* -------------------------------------------------------------------------- */
/* Helpers exercised by the harness                                            */
/* -------------------------------------------------------------------------- */

describe('layer helpers', () => {
  it('exposes the root and ambient group names the harness asserts on', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '2025', clock: { seconds: 0 } })
    const root = target.world.children[0] as Group
    expect(root.name).toBe(VFX_ROOT_NAME)
    expect(findGroup(root, SKY_GROUP_NAME)).toBeDefined()
    expect(findGroup(root, HAZE_GROUP_NAME)).toBeDefined()
    expect(findGroup(root, PLUME_GROUP_NAME)).toBeDefined()
    expect(findGroup(root, AMBIENT_GROUP_NAME)).toBeDefined()
    // Ambience belongs to the plume system, not to the layer root.
    expect(findGroup(root, PLUME_GROUP_NAME)?.children.map((child) => child.name)).toContain(
      AMBIENT_GROUP_NAME,
    )
    controller.dispose()
  })

  it('reports particle positions as a flat, bounded buffer', () => {
    const target = createRecordingTarget()
    const controller = createVfxController({ target, era: '2005', clock: { seconds: 0 } })
    expect(controller.particles.systems.length).toBeGreaterThan(0)
    for (const system of controller.particles.systems) {
      expect(system.positions).toBeInstanceOf(Float32Array)
      expect(system.positions.length).toBe(system.count * 3)
      expect(Array.from(system.positions).every((value) => Number.isFinite(value))).toBe(true)
    }
    controller.dispose()
  })
})
