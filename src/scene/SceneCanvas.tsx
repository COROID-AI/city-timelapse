/**
 * Canvas host and the render pipeline itself.
 *
 * {@link createRenderPipeline} is the imperative core: it owns the WebGL
 * renderer, the scene graph root content is added to, the camera rig, the
 * lighting rig, the post-processing chain, the quality setting and the frame
 * instrumentation. {@link SceneCanvas} is the React host that mounts that
 * pipeline into a canvas element, keeps it alive across resizes and context
 * losses, and exposes it to children through {@link useScenePipeline}.
 *
 * The host is deliberately thin and framework-agnostic underneath: the demo
 * harness page mounts `createRenderPipeline` directly with no React at runtime,
 * which is what makes the browser checks able to drive the exact same code the
 * application uses.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Group, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three'
import { DEFAULT_QUALITY_TIER, type QualityTierName } from '../lib/quality'
import { createCameraRig } from './CameraRig'
import { clamp, DEFAULT_CAMERA_FOV, DEFAULT_CAMERA_NEAR } from './controls'
import { createFrameInstrumentation } from './instrumentation'
import { createLightingRig } from './lighting'
import { createPostProcessingChain } from './postprocessing'
import { applyQualityToRenderer, recommendQualityTier, resolveSceneQuality } from './quality'
import type {
  CameraBounds,
  CameraMode,
  CameraState,
  CameraStatePatch,
  CameraRigApi,
  FrameHook,
  FrameInstrumentation,
  LightingParams,
  LightingRig,
  NavigationControls,
  NavigationSensitivity,
  PostProcessingChain,
  PostProcessingParams,
  PostProcessingParamsPatch,
  RenderPipeline,
  RenderPipelineOptions,
  RendererContextInfo,
  SceneQuality,
} from './types'

/** Largest frame delta handed to damping and effects by default. */
export const DEFAULT_MAX_DELTA_SECONDS = 0.1

/** Frame delta used for manual single-frame steps (60 fps). */
export const STEP_DELTA_SECONDS = 1 / 60

function currentDevicePixelRatio(): number {
  if (typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)) {
    return window.devicePixelRatio
  }
  return 1
}

function nowMilliseconds(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

/**
 * Creates the render pipeline for a canvas.
 *
 * Throws when the browser cannot give the canvas a WebGL context; the React
 * host turns that into its documented fallback instead of an application crash.
 */
export function createRenderPipeline(options: RenderPipelineOptions): RenderPipeline {
  const canvas = options.canvas
  const maxDeltaSeconds = options.maxDeltaSeconds ?? DEFAULT_MAX_DELTA_SECONDS
  const adaptiveQuality = options.adaptiveQuality ?? false
  const requestedPixelRatio = options.pixelRatio
  const frameHooks = new Set<FrameHook>()

  let quality: SceneQuality = resolveSceneQuality(options.qualityTier ?? DEFAULT_QUALITY_TIER, {
    devicePixelRatio: requestedPixelRatio ?? currentDevicePixelRatio(),
  })

  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.multisampling > 0,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  })
  applyQualityToRenderer(renderer, quality)

  const scene = new Scene()
  scene.name = 'city-scene'
  const world = new Group()
  world.name = 'world'
  scene.add(world)

  const rig: CameraRigApi = createCameraRig({
    camera: new PerspectiveCamera(DEFAULT_CAMERA_FOV, 1, DEFAULT_CAMERA_NEAR, quality.density.drawDistance),
    state: options.camera,
    bounds: options.bounds,
    sensitivity: options.sensitivity,
  })
  const camera = rig.camera
  const controls: NavigationControls = rig.controls

  const lighting: LightingRig = createLightingRig({
    scene,
    params: options.lighting,
    castShadows: quality.shadows,
    shadowMapSize: quality.shadowMapSize,
    parent: scene,
  })

  const postProcessing: PostProcessingChain = createPostProcessingChain({
    renderer,
    scene,
    camera,
    quality,
    params: options.postProcessing,
    size: {
      width: Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1)),
      height: Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1)),
    },
  })

  const instrumentation: FrameInstrumentation = createFrameInstrumentation({
    budgetMs: quality.frameBudgetMs,
  })

  let lastWidth = 0
  let lastHeight = 0
  let lastPixelRatio = 0
  let running = false
  let contextLost = false
  let frameHandle = 0
  let lastTimestamp = 0
  let lastDelta = STEP_DELTA_SECONDS
  let disposed = false

  const resize = (): boolean => {
    const measuredWidth = Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1))
    const measuredHeight = Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1))
    const ratio = quality.pixelRatio
    const changed = measuredWidth !== lastWidth || measuredHeight !== lastHeight || ratio !== lastPixelRatio
    renderer.setSize(measuredWidth, measuredHeight, false)
    rig.configure({ aspect: measuredWidth / measuredHeight, far: quality.density.drawDistance })
    postProcessing.setSize(measuredWidth, measuredHeight, ratio)
    lastWidth = measuredWidth
    lastHeight = measuredHeight
    lastPixelRatio = ratio
    return changed
  }

  resize()

  const setQualityTier = (name: QualityTierName): SceneQuality => {
    quality = resolveSceneQuality(name, {
      devicePixelRatio: requestedPixelRatio ?? currentDevicePixelRatio(),
    })
    applyQualityToRenderer(renderer, quality)
    instrumentation.setBudget(quality.frameBudgetMs)
    lighting.configureShadows({
      mapSize: quality.shadowMapSize,
      castShadows: quality.shadows,
      softShadows: quality.tier.effects.softShadows,
    })
    postProcessing.setEffects(quality.effects)
    resize()
    return quality
  }

  /**
   * Renders one frame.
   *
   * Returns the CPU milliseconds the frame cost (useful for stepper-style QA),
   * while the instrumentation records the frame *interval*, which is what the
   * frame budget is written against.
   */
  const renderFrame = (deltaSeconds?: number): number => {
    const delta = clamp(deltaSeconds ?? lastDelta, 0, maxDeltaSeconds)
    lastDelta = delta
    const started = nowMilliseconds()
    rig.update(delta)
    postProcessing.render(scene, camera, delta)
    const stats = instrumentation.record(delta)
    if (adaptiveQuality) {
      const recommendation = recommendQualityTier({
        current: quality.name,
        averageFrameTimeMs: stats.averageFrameTimeMs,
        consecutiveOverBudgetFrames: stats.consecutiveOverBudgetFrames,
        samples: stats.frames,
      })
      if (recommendation.changed) {
        setQualityTier(recommendation.tier)
      }
    }
    for (const hook of frameHooks) {
      hook(stats, delta)
    }
    return nowMilliseconds() - started
  }

  const loop = (timestamp: number): void => {
    frameHandle = requestAnimationFrame(loop)
    const delta = lastTimestamp === 0 ? STEP_DELTA_SECONDS : (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp
    renderFrame(delta)
  }

  const start = (): void => {
    if (running || disposed || typeof requestAnimationFrame !== 'function') {
      return
    }
    running = true
    lastTimestamp = 0
    frameHandle = requestAnimationFrame(loop)
  }

  const stop = (): void => {
    running = false
    if (frameHandle !== 0 && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameHandle)
    }
    frameHandle = 0
  }

  const onContextLost = (event: Event): void => {
    // Preventing the default keeps the canvas restorable instead of dropping it.
    event.preventDefault()
    contextLost = true
  }

  const onContextRestored = (): void => {
    contextLost = false
    applyQualityToRenderer(renderer, quality)
    postProcessing.rebuild()
    lighting.configureShadows({
      mapSize: quality.shadowMapSize,
      castShadows: quality.shadows,
      softShadows: quality.tier.effects.softShadows,
    })
    renderer.shadowMap.needsUpdate = true
    lastTimestamp = 0
    resize()
  }

  const unbindInput = controls.bind(canvas)
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  let resizeObserver: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      resize()
    })
    resizeObserver.observe(canvas.parentElement ?? canvas)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize)
  }

  const pipeline: RenderPipeline = {
    canvas,
    renderer,
    scene,
    world,
    camera,
    rig,
    controls,
    lighting,
    postProcessing,
    instrumentation,
    get quality(): SceneQuality {
      return quality
    },
    get running(): boolean {
      return running
    },
    get contextLost(): boolean {
      return contextLost
    },
    get contextInfo(): RendererContextInfo {
      const gl = renderer.getContext()
      const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
      let name = 'unknown'
      try {
        const debug = gl.getExtension('WEBGL_debug_renderer_info') as {
          UNMASKED_RENDERER_WEBGL: number
        } | null
        name = String(debug !== null ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.VERSION))
      } catch {
        name = 'unavailable'
      }
      const size = renderer.getDrawingBufferSize(new Vector2())
      return {
        available: gl != null,
        contextType: isWebGL2 ? 'webgl2' : 'webgl',
        isWebGL2,
        renderer: name,
        pixelRatio: renderer.getPixelRatio(),
        drawingBufferWidth: size.width,
        drawingBufferHeight: size.height,
      }
    },
    renderFrame,
    start,
    stop,
    resize,
    setQualityTier,
    applyLighting(params: Partial<LightingParams>): LightingParams {
      return lighting.apply(params)
    },
    applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams {
      return postProcessing.apply(params)
    },
    getCameraState(): CameraState {
      return rig.getState()
    },
    setCameraState(state: CameraStatePatch): void {
      rig.setState(state)
    },
    setCameraMode(mode: CameraMode): void {
      rig.setMode(mode)
    },
    onFrame(hook: FrameHook): () => void {
      frameHooks.add(hook)
      return () => {
        frameHooks.delete(hook)
      }
    },
    dispose(): void {
      if (disposed) {
        return
      }
      disposed = true
      stop()
      unbindInput()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      resizeObserver?.disconnect()
      resizeObserver = null
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', resize)
      }
      postProcessing.dispose()
      lighting.dispose()
      rig.dispose()
      scene.remove(world)
      world.clear()
      frameHooks.clear()
      renderer.dispose()
    },
  }

  if (options.onFrame !== undefined) {
    frameHooks.add(options.onFrame)
  }
  options.onWorldReady?.(world, pipeline)
  if (options.autoStart ?? true) {
    start()
  }

  return pipeline
}

/* -------------------------------------------------------------------------- */
/* React host                                                                  */
/* -------------------------------------------------------------------------- */

/** Context value carrying the live pipeline to scene children. */
export const ScenePipelineContext = createContext<RenderPipeline | null>(null)

/** Access the live pipeline from inside a {@link SceneCanvas}. */
export function useScenePipeline(): RenderPipeline {
  const pipeline = useContext(ScenePipelineContext)
  if (pipeline === null) {
    throw new Error('useScenePipeline must be used inside a <SceneCanvas> that mounted successfully.')
  }
  return pipeline
}

/** Props of the {@link SceneCanvas} host. */
export interface SceneCanvasProps {
  /** Quality tier; changing it re-applies renderer/shadow/effect settings. */
  readonly qualityTier?: QualityTierName
  /** Lighting parameters applied whenever this prop changes (memoise it). */
  readonly lighting?: Partial<LightingParams>
  /** Post-processing parameters applied whenever this prop changes. */
  readonly postProcessing?: PostProcessingParamsPatch
  /** Camera preset applied whenever this prop's identity changes. */
  readonly camera?: CameraStatePatch
  readonly bounds?: Partial<CameraBounds>
  readonly sensitivity?: Partial<NavigationSensitivity>
  readonly adaptiveQuality?: boolean
  /** Overrides the device pixel ratio (fixed-resolution captures, tests). */
  readonly pixelRatio?: number
  readonly autoStart?: boolean
  readonly className?: string
  readonly style?: CSSProperties
  /** Rendered instead of the default message when WebGL is unavailable. */
  readonly fallback?: ReactNode
  /** Called once the pipeline is live. */
  readonly onReady?: (pipeline: RenderPipeline) => void
  readonly onError?: (reason: string) => void
  readonly children?: ReactNode
}

const CANVAS_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  touchAction: 'none',
}

const HOST_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
}

/**
 * Mounts the render pipeline into a canvas.
 *
 * The pipeline is created once per mount from the props present at that moment;
 * later prop changes are applied through the pipeline's own setters so a tier
 * change never rebuilds the WebGL context.
 */
export function SceneCanvas(props: SceneCanvasProps): ReactElement {
  const {
    qualityTier = DEFAULT_QUALITY_TIER,
    lighting,
    postProcessing,
    camera,
    bounds,
    sensitivity,
    adaptiveQuality,
    pixelRatio,
    autoStart = true,
    className,
    style,
    fallback,
    onReady,
    onError,
    children,
  } = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pipeline, setPipeline] = useState<RenderPipeline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  onReadyRef.current = onReady
  onErrorRef.current = onError

  const initial = useRef({
    qualityTier,
    lighting,
    postProcessing,
    camera,
    bounds,
    sensitivity,
    adaptiveQuality,
    pixelRatio,
    autoStart,
  })

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return undefined
    }
    let created: RenderPipeline
    try {
      created = createRenderPipeline({
        canvas,
        qualityTier: initial.current.qualityTier,
        lighting: initial.current.lighting,
        postProcessing: initial.current.postProcessing,
        camera: initial.current.camera,
        bounds: initial.current.bounds,
        sensitivity: initial.current.sensitivity,
        adaptiveQuality: initial.current.adaptiveQuality,
        pixelRatio: initial.current.pixelRatio,
        autoStart: initial.current.autoStart,
      })
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      setError(reason)
      onErrorRef.current?.(reason)
      return undefined
    }
    setPipeline(created)
    setError(null)
    onReadyRef.current?.(created)
    return () => {
      setPipeline(null)
      created.dispose()
    }
  }, [])

  const applyQuality = useCallback(
    (name: QualityTierName): void => {
      pipeline?.setQualityTier(name)
    },
    [pipeline],
  )

  useEffect(() => {
    applyQuality(qualityTier)
  }, [applyQuality, qualityTier])

  useEffect(() => {
    if (pipeline !== null && lighting !== undefined) {
      pipeline.applyLighting(lighting)
    }
  }, [pipeline, lighting])

  useEffect(() => {
    if (pipeline !== null && postProcessing !== undefined) {
      pipeline.applyPostProcessing(postProcessing)
    }
  }, [pipeline, postProcessing])

  useEffect(() => {
    if (pipeline !== null && camera !== undefined) {
      pipeline.setCameraState(camera)
    }
  }, [pipeline, camera])

  return (
    <div
      className={className ?? 'scene-canvas'}
      style={style ?? HOST_STYLE}
      data-testid="scene-canvas"
      data-webgl={error === null ? 'true' : 'false'}
      data-quality-tier={qualityTier}
    >
      <canvas ref={canvasRef} style={CANVAS_STYLE} data-testid="scene-canvas-surface" />
      {error !== null ? (
        fallback ?? (
          <div className="scene-canvas-fallback" data-testid="scene-canvas-fallback" role="status">
            {`WebGL is unavailable, so the 3D city block cannot be rendered (${error}).`}
          </div>
        )
      ) : null}
      {pipeline !== null ? (
        <ScenePipelineContext.Provider value={pipeline}>{children}</ScenePipelineContext.Provider>
      ) : null}
    </div>
  )
}
