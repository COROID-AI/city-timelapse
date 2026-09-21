/**
 * Quality tiers, adaptive degradation and frame instrumentation.
 *
 * `src/lib/quality.ts` (owned by the scaffold task) holds the shared numbers;
 * this suite proves that the scene side resolves them into an ordered, complete
 * settings record, that the cheap tiers really do drop cost, that the adaptive
 * helper only reacts to sustained over-budget frames, and that the frame-time
 * ring buffer accounts for every frame without allocating in the hot path.
 */

import { ACESFilmicToneMapping, NoToneMapping, PCFShadowMap, PCFSoftShadowMap } from 'three'
import type { ShadowMapType, ToneMapping } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FRAME_WINDOW,
  MIN_ADAPTIVE_SAMPLES,
  OVER_BUDGET_STREAK,
  POST_EFFECT_ORDER,
  QUALITY_TIERS,
  QUALITY_TIER_NAMES,
  TARGET_FPS,
  applyQualityToRenderer,
  clampPixelRatio,
  createFrameInstrumentation,
  densityFor,
  describeEffectChain,
  effectsForTier,
  recommendQualityTier,
  resolveSceneQuality,
  scaleDensity,
  tierSupportsEffect,
  type PostEffectName,
  type RendererQualityTarget,
  type SceneQuality,
} from '../../src/scene'

/** Structural stand-in for the renderer fields the quality applier touches. */
interface StubRenderer extends RendererQualityTarget {
  pixelRatio: number
}

function createStubRenderer(): StubRenderer {
  const stub: StubRenderer = {
    pixelRatio: 1,
    setPixelRatio(value: number): void {
      stub.pixelRatio = value
    },
    shadowMap: { enabled: false, type: PCFShadowMap as ShadowMapType, needsUpdate: false },
    toneMapping: NoToneMapping as ToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: 'srgb',
  }
  return stub
}

describe('scene quality resolution (src/scene/quality.ts)', () => {
  it('resolves every tier into an ordered, complete settings record', () => {
    for (const name of QUALITY_TIER_NAMES) {
      const quality = resolveSceneQuality(name, { devicePixelRatio: 1 })
      const tier = QUALITY_TIERS[name]
      expect(quality.name).toBe(name)
      expect(quality.tier).toBe(tier)
      expect(quality.shadowMapSize).toBe(tier.effects.shadowMapSize)
      expect(quality.shadows).toBe(tier.effects.shadows)
      expect(quality.frameBudgetMs).toBe(tier.frameBudgetMs)
      expect(quality.density).toBe(tier.density)
      expect(quality.pixelRatio).toBeGreaterThanOrEqual(tier.pixelRatio.min)
      expect(quality.pixelRatio).toBeLessThanOrEqual(tier.pixelRatio.max)
      expect(Array.isArray(quality.effects)).toBe(true)
      // Effect chains are always a subsequence of the canonical pass order.
      const canonical = POST_EFFECT_ORDER.filter((effect) => quality.effects.includes(effect))
      expect([...quality.effects]).toEqual([...canonical])
    }
  })

  it('scales effect cost down the tiers', () => {
    const high = resolveSceneQuality('high')
    const medium = resolveSceneQuality('medium')
    const low = resolveSceneQuality('low')
    expect(high.effects).toEqual([...POST_EFFECT_ORDER])
    expect(effectsForTier(QUALITY_TIERS.high)).toEqual(high.effects)
    expect(effectsForTier(QUALITY_TIERS.low)).toEqual([])
    expect(medium.effects).toContain('bloom')
    expect(medium.effects).not.toContain('depthOfField')
    expect(low.effects).toEqual([])
    expect(high.multisampling).toBeGreaterThan(medium.multisampling)
    expect(medium.multisampling).toBeGreaterThan(low.multisampling)
    expect(high.shadowMapSize).toBeGreaterThan(medium.shadowMapSize)
    expect(medium.shadowMapSize).toBeGreaterThan(low.shadowMapSize)
    expect(tierSupportsEffect(QUALITY_TIERS.high, 'depthOfField')).toBe(true)
    expect(tierSupportsEffect(QUALITY_TIERS.low, 'bloom')).toBe(false)
    expect(describeEffectChain(['vignette', 'bloom']).map((entry) => entry.name)).toEqual([
      'bloom',
      'vignette',
    ])
  })

  it('clamps the device pixel ratio into the tier range', () => {
    expect(clampPixelRatio(QUALITY_TIERS.high, 3)).toBe(2)
    expect(clampPixelRatio(QUALITY_TIERS.high, 1)).toBe(1)
    expect(clampPixelRatio(QUALITY_TIERS.low, 0.5)).toBe(0.75)
    expect(clampPixelRatio(QUALITY_TIERS.low, Number.NaN)).toBe(1)
    expect(resolveSceneQuality('medium', { devicePixelRatio: 5 }).pixelRatio).toBe(1.5)
    expect(resolveSceneQuality('low', { devicePixelRatio: 4 }).pixelRatio).toBe(1)
  })

  it('scales every population by the tier density without emptying it', () => {
    const counts = [1, 7, 64, 200]
    for (const count of counts) {
      const high = scaleDensity(count, 'pedestrians', QUALITY_TIERS.high)
      const medium = scaleDensity(count, 'pedestrians', QUALITY_TIERS.medium)
      const low = scaleDensity(count, 'pedestrians', QUALITY_TIERS.low)
      expect(high).toBe(count)
      expect(medium).toBeLessThanOrEqual(high)
      expect(low).toBeLessThanOrEqual(medium)
      expect(low).toBeGreaterThanOrEqual(1)
    }
    expect(scaleDensity(0, 'vehicles', QUALITY_TIERS.high)).toBe(0)
    expect(scaleDensity(-5, 'props', QUALITY_TIERS.low)).toBe(0)
    expect(densityFor(QUALITY_TIERS.low, 'particles')).toBe(QUALITY_TIERS.low.density.particles)
    expect(densityFor(QUALITY_TIERS.low, 'drawDistance')).toBeLessThan(
      densityFor(QUALITY_TIERS.high, 'drawDistance'),
    )
    expect(TARGET_FPS).toBe(60)
    expect(DEFAULT_FRAME_WINDOW).toBeGreaterThan(QUALITY_TIER_NAMES.length)
  })

  it('applies pixel ratio, shadows and tone mapping to a renderer', () => {
    const renderer = createStubRenderer()
    const high: SceneQuality = resolveSceneQuality('high', { devicePixelRatio: 2 })
    applyQualityToRenderer(renderer, high)
    expect(renderer.pixelRatio).toBe(2)
    expect(renderer.shadowMap.enabled).toBe(true)
    expect(renderer.shadowMap.type).toBe(PCFSoftShadowMap)
    // With a post-processing chain the composer tone-maps, so the renderer must not.
    expect(renderer.toneMapping).toBe(NoToneMapping)
    expect(renderer.outputColorSpace).toBe('srgb')

    const low = resolveSceneQuality('low', { devicePixelRatio: 1 })
    applyQualityToRenderer(renderer, low)
    expect(renderer.pixelRatio).toBe(1)
    expect(renderer.shadowMap.type).toBe(PCFShadowMap)
    // Without a chain the renderer keeps the same filmic response itself.
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping)
  })
})

describe('adaptive quality recommendation', () => {
  it('holds until it has a usable sample', () => {
    const result = recommendQualityTier({
      current: 'high',
      averageFrameTimeMs: 40,
      consecutiveOverBudgetFrames: 500,
      samples: MIN_ADAPTIVE_SAMPLES - 1,
    })
    expect(result.changed).toBe(false)
    expect(result.reason).toBe('holding')
  })

  it('downgrades only after sustained over-budget frames and clamps at low', () => {
    const singleSpike = recommendQualityTier({
      current: 'high',
      averageFrameTimeMs: 40,
      consecutiveOverBudgetFrames: 3,
      samples: 200,
    })
    expect(singleSpike.changed).toBe(false)

    const sustained = recommendQualityTier({
      current: 'high',
      averageFrameTimeMs: 40,
      consecutiveOverBudgetFrames: OVER_BUDGET_STREAK,
      samples: 200,
    })
    expect(sustained).toEqual({ tier: 'medium', changed: true, reason: 'over-budget' })

    const floor = recommendQualityTier({
      current: 'low',
      averageFrameTimeMs: 400,
      consecutiveOverBudgetFrames: 500,
      samples: 900,
    })
    expect(floor.changed).toBe(false)
    expect(floor.reason).toBe('holding')

    const nonsense = recommendQualityTier({
      current: 'high',
      averageFrameTimeMs: Number.NaN,
      consecutiveOverBudgetFrames: 0,
      samples: 900,
    })
    expect(nonsense.changed).toBe(false)
  })

  it('climbs back a tier when there is real head-room', () => {
    const upgrade = recommendQualityTier({
      current: 'low',
      averageFrameTimeMs: 6,
      consecutiveOverBudgetFrames: 0,
      samples: 300,
    })
    expect(upgrade).toEqual({ tier: 'medium', changed: true, reason: 'under-budget' })

    const steady = recommendQualityTier({
      current: 'medium',
      averageFrameTimeMs: 14,
      consecutiveOverBudgetFrames: 0,
      samples: 300,
    })
    expect(steady.changed).toBe(false)
    expect(steady.reason).toBe('steady')
  })
})

describe('frame instrumentation (src/scene/instrumentation.ts)', () => {
  it('reports a monotonic frame count and a finite rolling average', () => {
    const instrumentation = createFrameInstrumentation({ windowSize: 8 })
    let previous = 0
    for (let index = 0; index < 50; index += 1) {
      const stats = instrumentation.record(1 / 60)
      expect(stats.frames).toBe(previous + 1)
      previous = stats.frames
      expect(Number.isFinite(stats.averageFrameTimeMs)).toBe(true)
      expect(stats.averageFrameTimeMs).toBeGreaterThan(0)
      expect(Number.isFinite(stats.averageFps)).toBe(true)
      expect(stats.averageFps).toBeGreaterThan(0)
    }
    const stats = instrumentation.sample()
    expect(stats.frames).toBe(50)
    expect(stats.averageFrameTimeMs).toBeCloseTo(1000 / 60, 3)
    expect(stats.fps).toBeCloseTo(60, 1)
    expect(stats.withinBudget).toBe(true)
  })

  it('keeps only the newest window of samples', () => {
    const instrumentation = createFrameInstrumentation({ windowSize: 4 })
    for (const seconds of [0.01, 0.02, 0.03, 0.04]) {
      instrumentation.record(seconds)
    }
    expect(instrumentation.sample().averageFrameTimeMs).toBeCloseTo(25, 6)
    instrumentation.record(0.1)
    const stats = instrumentation.sample()
    expect(stats.averageFrameTimeMs).toBeCloseTo((20 + 30 + 40 + 100) / 4, 6)
    expect(stats.minFrameTimeMs).toBeCloseTo(20, 6)
    expect(stats.maxFrameTimeMs).toBeCloseTo(100, 6)
    const history = instrumentation.history()
    expect(history.length).toBe(4)
    expect(history[3]).toBeCloseTo(100, 6)
  })

  it('tracks the budget without allocating per frame', () => {
    const instrumentation = createFrameInstrumentation({ budgetMs: 16 })
    const first = instrumentation.record(0.01)
    const second = instrumentation.record(0.05)
    // The same object is reused every frame: the measurement path allocates nothing.
    expect(second).toBe(first)
    expect(second.frameTimeMs).toBeCloseTo(50, 6)
    expect(second.withinBudget).toBe(false)
    expect(second.overBudgetFrames).toBe(1)
    expect(second.consecutiveOverBudgetFrames).toBe(1)
    instrumentation.record(0.005)
    expect(instrumentation.sample().overBudgetFrames).toBe(1)
    expect(instrumentation.sample().consecutiveOverBudgetFrames).toBe(0)
    instrumentation.setBudget(100)
    expect(instrumentation.sample().budgetMs).toBe(100)
    expect(instrumentation.sample().withinBudget).toBe(true)
  })

  it('clamps runaway deltas instead of poisoning the average', () => {
    const instrumentation = createFrameInstrumentation({ windowSize: 4, maxFrameTimeMs: 100 })
    instrumentation.record(30)
    const stats = instrumentation.sample()
    expect(stats.frameTimeMs).toBe(100)
    expect(stats.averageFrameTimeMs).toBeLessThanOrEqual(100)
    expect(stats.withinBudget).toBe(false)
    instrumentation.record(Number.NaN)
    expect(instrumentation.sample().frameTimeMs).toBe(0)
  })

  it('notifies hooks with the same statistics object and unsubscribes', () => {
    const instrumentation = createFrameInstrumentation({ windowSize: 4 })
    const hook = vi.fn()
    const unsubscribe = instrumentation.onFrame(hook)
    const stats = instrumentation.record(1 / 60)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook.mock.calls[0]?.[0]).toBe(stats)
    expect(hook.mock.calls[0]?.[1]).toBeCloseTo(1 / 60, 9)
    unsubscribe()
    instrumentation.record(1 / 60)
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('resets cleanly', () => {
    const instrumentation = createFrameInstrumentation({ windowSize: 4 })
    instrumentation.record(0.02)
    instrumentation.reset()
    const stats = instrumentation.sample()
    expect(stats.frames).toBe(0)
    expect(stats.averageFrameTimeMs).toBe(0)
    expect(stats.averageFps).toBe(0)
    expect(stats.overBudgetFrames).toBe(0)
    expect(stats.withinBudget).toBe(true)
    expect(instrumentation.history().length).toBe(0)
  })

  it('documents the effect order it composes', () => {
    const order: readonly PostEffectName[] = POST_EFFECT_ORDER
    expect([...order]).toEqual(['depthOfField', 'bloom', 'colorGrade', 'vignette'])
  })
})
