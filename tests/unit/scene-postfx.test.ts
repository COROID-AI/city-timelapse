/**
 * Post-processing chain composition and graceful degradation.
 *
 * The composer itself needs a GPU, so this suite pins down everything that can
 * be decided without one: the canonical pass order, how tiers and parameter
 * switches compose into the chain that will actually render, parameter
 * clamping, the custom colour-grade pass, and — most importantly — that every
 * failure mode (no renderer, a driver that refuses the composer, a disabled
 * chain, the low tier) ends in direct rendering instead of an exception.
 *
 * It closes with a public-surface check of the scene barrel and of the React
 * host's WebGL fallback, which is what consumers actually import.
 */

import { PerspectiveCamera, Scene } from 'three'
import type { WebGLRenderer } from 'three'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ColorGradeEffect,
  DEFAULT_DEPTH_OF_FIELD_PARAMS,
  DEFAULT_POST_PROCESSING_PARAMS,
  POST_EFFECT_ORDER,
  SceneCanvas,
  composeEffectChain,
  createCameraRig,
  createFrameInstrumentation,
  createLightingRig,
  createNavigationControls,
  createPostProcessingChain,
  createPostProcessingParams,
  createRenderPipeline,
  describeEffectChain,
  effectsForTier,
  resolveSceneQuality,
  useScenePipeline,
  type PostEffectName,
  type PostProcessingParamsPatch,
} from '../../src/scene'
import { QUALITY_TIERS } from '../../src/lib/quality'
import { renderWithProviders, screen } from '../support/render'

function sceneAndCamera(): { scene: Scene; camera: PerspectiveCamera } {
  return { scene: new Scene(), camera: new PerspectiveCamera(46, 16 / 9, 0.1, 400) }
}

describe('effect chain composition (src/scene/postprocessing.ts)', () => {
  it('composes the enabled passes in the canonical order', () => {
    const chain = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: DEFAULT_POST_PROCESSING_PARAMS,
    })
    expect(chain).toEqual(['depthOfField', 'bloom', 'colorGrade', 'vignette'])

    // Order is a property of the module, not of the caller's list.
    const shuffled: PostEffectName[] = ['vignette', 'bloom', 'depthOfField', 'colorGrade']
    expect(
      composeEffectChain({ allowedEffects: shuffled, params: DEFAULT_POST_PROCESSING_PARAMS }),
    ).toEqual([...POST_EFFECT_ORDER])
  })

  it('drops effects the tier cannot afford and effects the caller disabled', () => {
    const low = composeEffectChain({
      allowedEffects: effectsForTier(QUALITY_TIERS.low),
      params: DEFAULT_POST_PROCESSING_PARAMS,
    })
    expect(low).toEqual([])

    const medium = composeEffectChain({
      allowedEffects: effectsForTier(QUALITY_TIERS.medium),
      params: DEFAULT_POST_PROCESSING_PARAMS,
    })
    expect(medium).toEqual(['bloom', 'colorGrade', 'vignette'])

    const noBloom = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: createPostProcessingParams({ bloom: { enabled: false } }),
    })
    expect(noBloom).toEqual(['depthOfField', 'colorGrade', 'vignette'])

    const masterOff = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: createPostProcessingParams({ enabled: false }),
    })
    expect(masterOff).toEqual([])

    const gradeOff = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: createPostProcessingParams({ grade: { enabled: false }, vignette: { enabled: false } }),
    })
    expect(gradeOff).toEqual(['depthOfField', 'bloom'])
  })

  it('toggles depth of field independently of the other passes', () => {
    const on = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: createPostProcessingParams({ depthOfField: { enabled: true } }),
    })
    const off = composeEffectChain({
      allowedEffects: POST_EFFECT_ORDER,
      params: createPostProcessingParams({ depthOfField: { enabled: false } }),
    })
    expect(on[0]).toBe('depthOfField')
    expect(off).not.toContain('depthOfField')
    expect(off).toEqual(['bloom', 'colorGrade', 'vignette'])
  })

  it('clamps parameters into valid ranges and keeps the defaults intact', () => {
    const clamped = createPostProcessingParams({
      bloom: { intensity: -3, threshold: 99, smoothing: 4, radius: -1 },
      grade: { exposure: 0, contrast: 100, saturation: -2, temperature: 5, tint: -5 },
      vignette: { offset: 9, darkness: -9 },
      depthOfField: { focusDistance: -10, focusRange: 0, bokehScale: 50 },
    })
    expect(clamped.bloom).toEqual({ enabled: true, intensity: 0, threshold: 4, smoothing: 1, radius: 0 })
    expect(clamped.grade.exposure).toBe(0.05)
    expect(clamped.grade.contrast).toBe(3)
    expect(clamped.grade.saturation).toBe(0)
    expect(clamped.grade.temperature).toBe(1)
    expect(clamped.grade.tint).toBe(-1)
    expect(clamped.vignette).toEqual({ enabled: true, offset: 1, darkness: 0 })
    expect(clamped.depthOfField.focusDistance).toBe(0.1)
    expect(clamped.depthOfField.bokehScale).toBe(12)
    expect(DEFAULT_POST_PROCESSING_PARAMS.bloom.intensity).toBeGreaterThan(0)
    expect(DEFAULT_DEPTH_OF_FIELD_PARAMS.focusRange).toBeGreaterThan(0)

    const patch: PostProcessingParamsPatch = { bloom: { enabled: false } }
    const merged = createPostProcessingParams(patch)
    expect(merged.bloom.enabled).toBe(false)
    expect(merged.bloom.intensity).toBe(DEFAULT_POST_PROCESSING_PARAMS.bloom.intensity)
  })

  it('describes chain entries with their pass index', () => {
    const entries = describeEffectChain(['colorGrade', 'depthOfField'])
    expect(entries.map((entry) => entry.name)).toEqual(['depthOfField', 'colorGrade'])
    expect(entries.map((entry) => entry.order)).toEqual([0, 2])
    expect(entries.every((entry) => entry.enabled)).toBe(true)
  })

  it('grades colour through uniforms without recompiling', () => {
    const effect = new ColorGradeEffect(DEFAULT_POST_PROCESSING_PARAMS.grade)
    expect(effect.uniforms.get('exposure')?.value).toBe(DEFAULT_POST_PROCESSING_PARAMS.grade.exposure)
    effect.setParams(createPostProcessingParams({ grade: { exposure: 2.5, contrast: 0.5 } }).grade)
    expect(effect.uniforms.get('exposure')?.value).toBe(2.5)
    expect(effect.uniforms.get('contrast')?.value).toBe(0.5)
    expect(effect.name).toBe('ColorGradeEffect')
  })
})

describe('graceful degradation', () => {
  it('falls back to direct rendering without a renderer', () => {
    const { scene, camera } = sceneAndCamera()
    const chain = createPostProcessingChain({ renderer: null, scene, camera })
    expect(chain.active).toBe(false)
    expect(chain.passOrder).toEqual([])
    // The requested chain is still reported, so the UI can explain the intent.
    expect(chain.effects.map((entry) => entry.name)).toEqual([...POST_EFFECT_ORDER])
    expect(chain.render(scene, camera, 1 / 60)).toBe(false)
    expect(() => chain.disable()).not.toThrow()
    expect(() => chain.dispose()).not.toThrow()
  })

  it('never renders post-processing on a tier that cannot afford it', () => {
    const { scene, camera } = sceneAndCamera()
    const fakeRenderer = { render: vi.fn() } as unknown as WebGLRenderer
    const chain = createPostProcessingChain({
      renderer: fakeRenderer,
      scene,
      camera,
      allowedEffects: effectsForTier(QUALITY_TIERS.low),
    })
    expect(chain.active).toBe(false)
    expect(chain.effects).toEqual([])
    expect(chain.render(scene, camera, 1 / 60)).toBe(false)
    expect(fakeRenderer.render).toHaveBeenCalledTimes(1)
    expect(fakeRenderer.render).toHaveBeenCalledWith(scene, camera)
  })

  it('survives a driver that refuses the composer and keeps rendering directly', () => {
    const { scene, camera } = sceneAndCamera()
    const fakeRenderer = { render: vi.fn() } as unknown as WebGLRenderer
    const chain = createPostProcessingChain({ renderer: fakeRenderer, scene, camera })
    expect(chain.active).toBe(false)
    expect(chain.failure).not.toBeNull()
    expect(chain.passOrder).toEqual([])

    for (let index = 0; index < 3; index += 1) {
      expect(chain.render(scene, camera, 1 / 60)).toBe(false)
    }
    expect(fakeRenderer.render).toHaveBeenCalledTimes(3)
    // Failing again must not throw either.
    expect(chain.rebuild()).toBe(false)
    expect(chain.failure).not.toBeNull()
  })

  it('reports parameter changes and effect-set changes on a degraded chain', () => {
    const { scene, camera } = sceneAndCamera()
    const chain = createPostProcessingChain({ renderer: null, scene, camera })
    const applied = chain.apply({ bloom: { enabled: false } })
    expect(applied.bloom.enabled).toBe(false)
    expect(chain.effects.map((entry) => entry.name)).toEqual(['depthOfField', 'colorGrade', 'vignette'])

    // Bloom is still switched off by parameters, so it stays out of the
    // composed chain even though the allowance list mentions it.
    expect(chain.setEffects(['vignette', 'bloom'])).toEqual(['vignette'])
    chain.apply({ bloom: { enabled: true } })
    expect(chain.setEffects(['vignette', 'bloom'])).toEqual(['bloom', 'vignette'])
    expect(chain.effects.map((entry) => entry.name)).toEqual(['bloom', 'vignette'])
    expect(chain.setEffects([])).toEqual([])
    expect(chain.effects).toEqual([])
    expect(chain.apply({ enabled: false }).enabled).toBe(false)
    expect(() => chain.setSize(320, 180, 2)).not.toThrow()
  })
})

describe('public surface (src/scene/index.ts)', () => {
  it('exports the pipeline contract consumers are told to use', () => {
    expect(typeof createRenderPipeline).toBe('function')
    expect(typeof SceneCanvas).toBe('function')
    expect(typeof useScenePipeline).toBe('function')
    expect(typeof createCameraRig).toBe('function')
    expect(typeof createNavigationControls).toBe('function')
    expect(typeof createLightingRig).toBe('function')
    expect(typeof createPostProcessingChain).toBe('function')
    expect(typeof resolveSceneQuality).toBe('function')
    expect(typeof createFrameInstrumentation).toBe('function')
    expect([...POST_EFFECT_ORDER]).toHaveLength(4)
    expect(Object.keys(QUALITY_TIERS)).toEqual(['high', 'medium', 'low'])
  })

  it('reports WebGL creation failures instead of crashing the application', () => {
    const canvas = document.createElement('canvas')
    // jsdom has no WebGL implementation, so the host must fail loudly and
    // predictably: the React component turns this into its fallback panel.
    expect(() => createRenderPipeline({ canvas, autoStart: false })).toThrow(/webgl|context/i)
  })

  it('renders the documented fallback when the pipeline cannot start', async () => {
    // `createElement` keeps this suite a `.ts` file, as the plan's test command
    // targets `tests/unit/scene-postfx.test.ts` by name.
    renderWithProviders(createElement(SceneCanvas))
    expect(screen.getByTestId('scene-canvas')).toHaveAttribute('data-webgl', 'false')
    expect(screen.getByTestId('scene-canvas-fallback')).toBeInTheDocument()
    expect(screen.getByTestId('scene-canvas-fallback')).toHaveAttribute('role', 'status')
  })
})
