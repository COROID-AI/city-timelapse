/**
 * Post-processing chain: bloom, colour grade and vignette, with an optional
 * depth-of-field pass, composed in one canonical pass order.
 *
 * Design rules that make this safe to hand to content layers:
 *
 * 1. **One order.** `POST_EFFECT_ORDER` is the only order this module ever
 *    builds (depth of field → bloom → colour grade → vignette). Tone mapping
 *    sits directly in front of the grade so bloom sees the raw HDR highlights
 *    of neon signage while the grade still works in display space.
 * 2. **Degrade, never throw.** A tier without post-processing, a missing
 *    WebGL extension, a driver that refuses the half-float buffers or a context
 *    loss all end in the same place: `active === false`, `render()` falls back
 *    to `renderer.render(scene, camera)` and `failure` explains why.
 * 3. **Cheap updates.** Changing an intensity updates a uniform; only a change
 *    to the *set* of enabled effects rebuilds the composer.
 */

import { HalfFloatType, Uniform, UnsignedByteType } from 'three'
import type { Camera, PerspectiveCamera, Scene, TextureDataType, WebGLRenderer } from 'three'
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import { clamp } from './controls'
import { describeEffectChain } from './quality'
import {
  POST_EFFECT_ORDER,
  type BloomParams,
  type ColorGradeParams,
  type DepthOfFieldParams,
  type EffectChainEntry,
  type PostEffectName,
  type PostProcessingChain,
  type PostProcessingParams,
  type PostProcessingParamsPatch,
  type SceneQuality,
  type VignetteParams,
} from './types'

/* -------------------------------------------------------------------------- */
/* Parameter defaults + clamping                                               */
/* -------------------------------------------------------------------------- */

/** Default bloom: strong enough for neon, tight enough not to fog the block. */
export const DEFAULT_BLOOM_PARAMS: BloomParams = {
  enabled: true,
  intensity: 1.1,
  threshold: 0.82,
  smoothing: 0.22,
  radius: 0.75,
}

/** Default grade: gentle filmic contrast with a touch of warmth. */
export const DEFAULT_COLOR_GRADE_PARAMS: ColorGradeParams = {
  enabled: true,
  exposure: 1.04,
  contrast: 1.06,
  saturation: 1.08,
  temperature: 0.06,
  tint: 0,
}

/** Default vignette: present but not a black frame. */
export const DEFAULT_VIGNETTE_PARAMS: VignetteParams = {
  enabled: true,
  offset: 0.34,
  darkness: 0.58,
}

/** Default depth of field, focused just past the block's centre. */
export const DEFAULT_DEPTH_OF_FIELD_PARAMS: DepthOfFieldParams = {
  enabled: true,
  focusDistance: 30,
  focusRange: 18,
  bokehScale: 2.2,
}

/** Complete default configuration. */
export const DEFAULT_POST_PROCESSING_PARAMS: PostProcessingParams = {
  enabled: true,
  bloom: DEFAULT_BLOOM_PARAMS,
  grade: DEFAULT_COLOR_GRADE_PARAMS,
  vignette: DEFAULT_VIGNETTE_PARAMS,
  depthOfField: DEFAULT_DEPTH_OF_FIELD_PARAMS,
}

/** Merges a patch onto the defaults and clamps every value into valid range. */
export function createPostProcessingParams(
  patch: PostProcessingParamsPatch = {},
  base: PostProcessingParams = DEFAULT_POST_PROCESSING_PARAMS,
): PostProcessingParams {
  return {
    enabled: patch.enabled ?? base.enabled,
    bloom: {
      enabled: patch.bloom?.enabled ?? base.bloom.enabled,
      intensity: clamp(patch.bloom?.intensity ?? base.bloom.intensity, 0, 8),
      threshold: clamp(patch.bloom?.threshold ?? base.bloom.threshold, 0, 4),
      smoothing: clamp(patch.bloom?.smoothing ?? base.bloom.smoothing, 0, 1),
      radius: clamp(patch.bloom?.radius ?? base.bloom.radius, 0, 4),
    },
    grade: {
      enabled: patch.grade?.enabled ?? base.grade.enabled,
      exposure: clamp(patch.grade?.exposure ?? base.grade.exposure, 0.05, 8),
      contrast: clamp(patch.grade?.contrast ?? base.grade.contrast, 0.2, 3),
      saturation: clamp(patch.grade?.saturation ?? base.grade.saturation, 0, 3),
      temperature: clamp(patch.grade?.temperature ?? base.grade.temperature, -1, 1),
      tint: clamp(patch.grade?.tint ?? base.grade.tint, -1, 1),
    },
    vignette: {
      enabled: patch.vignette?.enabled ?? base.vignette.enabled,
      offset: clamp(patch.vignette?.offset ?? base.vignette.offset, 0, 1),
      darkness: clamp(patch.vignette?.darkness ?? base.vignette.darkness, 0, 1),
    },
    depthOfField: {
      enabled: patch.depthOfField?.enabled ?? base.depthOfField.enabled,
      focusDistance: clamp(patch.depthOfField?.focusDistance ?? base.depthOfField.focusDistance, 0.1, 2000),
      focusRange: clamp(patch.depthOfField?.focusRange ?? base.depthOfField.focusRange, 0.1, 2000),
      bokehScale: clamp(patch.depthOfField?.bokehScale ?? base.depthOfField.bokehScale, 0, 12),
    },
  }
}

/**
 * Composes the effect chain that will actually render.
 *
 * The result is always a subsequence of {@link POST_EFFECT_ORDER}: the tier's
 * allowance (or an explicit allowance list) intersected with the per-effect and
 * master switches. An empty result means "render the scene directly", which is
 * exactly how the low tier behaves.
 */
export function composeEffectChain(input: {
  readonly allowedEffects: readonly PostEffectName[]
  readonly params: PostProcessingParams
}): PostEffectName[] {
  if (!input.params.enabled) {
    return []
  }
  return POST_EFFECT_ORDER.filter((name) => {
    if (!input.allowedEffects.includes(name)) {
      return false
    }
    switch (name) {
      case 'bloom':
        return input.params.bloom.enabled
      case 'depthOfField':
        return input.params.depthOfField.enabled
      case 'colorGrade':
        return input.params.grade.enabled
      case 'vignette':
        return input.params.vignette.enabled
      default:
        return false
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Colour grade effect                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fragment shader of the grade pass.
 *
 * Lowercase-free GLSL so it reads the same wherever it is inspected, and
 * deliberately clamp-free: values are only floored at zero so a later pass (or
 * the tone mapper in front of it) still sees the full range.
 */
const COLOR_GRADE_FRAGMENT_SHADER = `
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float temperature;
uniform float tint;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb * exposure;

  // White balance: warm pushes red and pulls blue, tint pushes green/magenta.
  color.r *= 1.0 + temperature * 0.28 + tint * 0.06;
  color.g *= 1.0 + tint * 0.24;
  color.b *= 1.0 - temperature * 0.28 + tint * 0.06;

  // Contrast around middle grey keeps the mid-tones anchored.
  color = (color - 0.5) * contrast + 0.5;

  // Saturation via luminance mix, using the Rec. 709 weights.
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luminance), color, saturation);

  outputColor = vec4(max(color, vec3(0.0)), inputColor.a);
}
`

/**
 * Exposure, contrast, saturation and white-balance grade.
 *
 * Written as a `postprocessing` effect so it can share the single effect pass
 * with bloom and the vignette instead of costing another full-screen resolve.
 */
export class ColorGradeEffect extends Effect {
  constructor(params: ColorGradeParams = DEFAULT_COLOR_GRADE_PARAMS) {
    super('ColorGradeEffect', COLOR_GRADE_FRAGMENT_SHADER, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['exposure', new Uniform(params.exposure)],
        ['contrast', new Uniform(params.contrast)],
        ['saturation', new Uniform(params.saturation)],
        ['temperature', new Uniform(params.temperature)],
        ['tint', new Uniform(params.tint)],
      ]),
    })
  }

  /** Updates the grade uniforms in place; no shader recompilation needed. */
  setParams(params: ColorGradeParams): void {
    setUniform(this, 'exposure', params.exposure)
    setUniform(this, 'contrast', params.contrast)
    setUniform(this, 'saturation', params.saturation)
    setUniform(this, 'temperature', params.temperature)
    setUniform(this, 'tint', params.tint)
  }
}

function setUniform(effect: Effect, name: string, value: number): void {
  const uniform: Uniform | undefined = effect.uniforms.get(name)
  if (uniform !== undefined) {
    uniform.value = value
  }
}

/* -------------------------------------------------------------------------- */
/* Chain                                                                       */
/* -------------------------------------------------------------------------- */

/** Options for {@link createPostProcessingChain}. */
export interface PostProcessingChainOptions {
  /** Renderer driving the composer; `null` forces the direct-render path. */
  readonly renderer: WebGLRenderer | null
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  /** Quality tier resolving which effects are affordable. */
  readonly quality?: SceneQuality
  /** Explicit allowance list, overriding `quality` when provided. */
  readonly allowedEffects?: readonly PostEffectName[]
  readonly params?: PostProcessingParamsPatch
  /** Initial canvas size in CSS pixels. */
  readonly size?: { readonly width: number; readonly height: number }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

/**
 * Creates the chain.
 *
 * The returned object is stable for the lifetime of the pipeline: its effect
 * instances are created once per active chain and reused until the enabled set
 * changes or the context is lost.
 */
export function createPostProcessingChain(
  options: PostProcessingChainOptions,
): PostProcessingChain {
  const renderer = options.renderer
  const { scene, camera } = options
  let params = createPostProcessingParams(options.params)
  let allowed: readonly PostEffectName[] =
    options.allowedEffects ?? options.quality?.effects ?? POST_EFFECT_ORDER
  let composer: EffectComposer | null = null
  let active = false
  let failure: string | null = null
  let entries: readonly EffectChainEntry[] = describeEffectChain(
    composeEffectChain({ allowedEffects: allowed, params }),
  )
  let bloom: BloomEffect | null = null
  let grade: ColorGradeEffect | null = null
  let vignette: VignetteEffect | null = null
  let depthOfField: DepthOfFieldEffect | null = null
  // CSS pixels of the canvas. The composer derives its own (drawing-buffer)
  // resolution from the renderer's pixel ratio, so passing pre-multiplied
  // pixels here would scale the canvas twice on high-DPI displays.
  const size = {
    cssWidth: options.size?.width ?? 1,
    cssHeight: options.size?.height ?? 1,
    bufferWidth: options.size?.width ?? 1,
    bufferHeight: options.size?.height ?? 1,
  }

  const releaseComposer = (): void => {
    if (composer !== null) {
      composer.dispose()
      composer = null
    }
    bloom = null
    grade = null
    vignette = null
    depthOfField = null
    active = false
  }

  const frameBufferType = (): TextureDataType =>
    renderer !== null && renderer.capabilities.isWebGL2 ? HalfFloatType : UnsignedByteType

  const build = (): boolean => {
    releaseComposer()
    const ids = composeEffectChain({ allowedEffects: allowed, params })
    entries = describeEffectChain(ids)
    if (renderer === null || ids.length === 0) {
      return false
    }
    try {
      const created = new EffectComposer(renderer, { frameBufferType: frameBufferType() })
      created.addPass(new RenderPass(scene, camera))

      const passEffects: Effect[] = []
      if (ids.includes('depthOfField')) {
        depthOfField = new DepthOfFieldEffect(camera, {
          focusDistance: params.depthOfField.focusDistance,
          focusRange: params.depthOfField.focusRange,
          bokehScale: params.depthOfField.bokehScale,
          resolutionScale: 0.6,
        })
        passEffects.push(depthOfField)
      }
      if (ids.includes('bloom')) {
        bloom = new BloomEffect({
          intensity: params.bloom.intensity,
          luminanceThreshold: params.bloom.threshold,
          luminanceSmoothing: params.bloom.smoothing,
          mipmapBlur: true,
          radius: params.bloom.radius,
        })
        passEffects.push(bloom)
      }
      // Tone mapping before the grade: bloom works on HDR highlights and the
      // grade works in display space, which is how the look was authored.
      passEffects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }))
      grade = new ColorGradeEffect(params.grade)
      passEffects.push(grade)
      if (ids.includes('vignette')) {
        vignette = new VignetteEffect({
          blendFunction: BlendFunction.NORMAL,
          offset: params.vignette.offset,
          darkness: params.vignette.darkness,
        })
        passEffects.push(vignette)
      }

      created.addPass(new EffectPass(camera as Camera, ...passEffects))
      created.setSize(size.cssWidth, size.cssHeight, false)
      composer = created
      active = true
      failure = null
    } catch (error) {
      failure = describeError(error)
      releaseComposer()
    }
    return active
  }

  /** Pushes parameter values into existing effects without rebuilding. */
  const syncParams = (): void => {
    if (bloom !== null) {
      bloom.intensity = params.bloom.intensity
      bloom.luminanceMaterial.threshold = params.bloom.threshold
      bloom.luminanceMaterial.smoothing = params.bloom.smoothing
      bloom.mipmapBlurPass.radius = params.bloom.radius
    }
    grade?.setParams(params.grade)
    if (vignette !== null) {
      vignette.offset = params.vignette.offset
      vignette.darkness = params.vignette.darkness
    }
    if (depthOfField !== null) {
      depthOfField.bokehScale = params.depthOfField.bokehScale
      depthOfField.cocMaterial.focusDistance = params.depthOfField.focusDistance
      depthOfField.cocMaterial.focusRange = params.depthOfField.focusRange
    }
  }

  build()

  return {
    get active(): boolean {
      return active
    },
    get effects(): readonly EffectChainEntry[] {
      return entries
    },
    get passOrder(): readonly PostEffectName[] {
      return active ? entries.map((entry) => entry.name) : []
    },
    get params(): PostProcessingParams {
      return params
    },
    get size(): PostProcessingChain['size'] {
      return size
    },
    get failure(): string | null {
      return failure
    },
    apply(patch: PostProcessingParamsPatch): PostProcessingParams {
      const before = composeEffectChain({ allowedEffects: allowed, params }).join('|')
      params = createPostProcessingParams(patch, params)
      const after = composeEffectChain({ allowedEffects: allowed, params }).join('|')
      if (before === after && active) {
        syncParams()
      } else {
        build()
      }
      return params
    },
    setEffects(ids: readonly PostEffectName[]): readonly PostEffectName[] {
      const next = POST_EFFECT_ORDER.filter((name) => ids.includes(name))
      const changed = next.length !== allowed.length || next.some((name, index) => allowed[index] !== name)
      allowed = next
      if (changed) {
        build()
      } else {
        entries = describeEffectChain(composeEffectChain({ allowedEffects: allowed, params }))
      }
      return composeEffectChain({ allowedEffects: allowed, params })
    },
    render(target: Scene, cameraToUse: PerspectiveCamera, deltaSeconds: number): boolean {
      if (composer !== null && active) {
        try {
          composer.render(deltaSeconds)
          return true
        } catch (error) {
          failure = describeError(error)
          releaseComposer()
        }
      }
      renderer?.render(target, cameraToUse)
      return false
    },
    setSize(nextWidth: number, nextHeight: number, pixelRatio: number): void {
      if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
        return
      }
      const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1
      size.cssWidth = Math.max(1, Math.round(nextWidth))
      size.cssHeight = Math.max(1, Math.round(nextHeight))
      size.bufferWidth = Math.max(1, Math.round(size.cssWidth * ratio))
      size.bufferHeight = Math.max(1, Math.round(size.cssHeight * ratio))
      // The composer derives its buffers from the renderer's drawing buffer, so
      // it takes CSS pixels and applies the pixel ratio exactly once.
      composer?.setSize(size.cssWidth, size.cssHeight, false)
    },
    disable(): void {
      releaseComposer()
    },
    rebuild(): boolean {
      return build()
    },
    dispose(): void {
      releaseComposer()
    },
  }
}
