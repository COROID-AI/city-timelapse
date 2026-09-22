/**
 * Shared type vocabulary of the era-agnostic render pipeline.
 *
 * Everything in `src/scene` is a *mechanism*: a renderer host, a camera rig, a
 * navigation controller, a lighting rig, a post-processing chain, quality tiers
 * and frame instrumentation. Nothing here knows about 1945 or 2055 — the era
 * content layers and the transition director hand the pipeline parameters
 * (sun angles, palette, camera presets) and read the pipeline back through
 * this vocabulary.
 *
 * Conventions used throughout the module:
 * - World units are metres, Y is up, and the city block sits around the origin.
 * - Angles are radians. Azimuth is measured clockwise from +Z (so `0` looks
 *   down -Z from the target), polar is the three.js spherical polar angle
 *   measured from +Y, heading is the Y rotation of the camera in `YXZ` order.
 * - Every camera/lighting/post-processing parameter is a plain serialisable
 *   value: no class instances, no functions, so era switches, viewpoint
 *   presets and QA snapshots can store and restore them by value.
 */

import type {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import type { DensitySettings, QualityTier, QualityTierName } from '../lib/quality'

export type { DensitySettings, QualityTier, QualityTierName }

/** Immutable three-component vector. */
export type Vec3 = readonly [number, number, number]

/** Inclusive numeric interval. */
export interface Range {
  readonly min: number
  readonly max: number
}

/* -------------------------------------------------------------------------- */
/* Camera rig                                                                  */
/* -------------------------------------------------------------------------- */

/** Camera behaviours the rig exposes to the rest of the application. */
export const CAMERA_MODES = ['orbit', 'street'] as const

export type CameraMode = (typeof CAMERA_MODES)[number]

/** Orbit ("look at the block") parameters. */
export interface OrbitSettings {
  /** Horizontal angle around the target, radians. */
  readonly azimuth: number
  /** Angle from the target's up axis, radians (clamped away from the poles). */
  readonly polar: number
  /** Distance from the target to the eye, world units. */
  readonly radius: number
}

/** Street-level ("walk the block") parameters. */
export interface StreetSettings {
  /** Eye position in world units. */
  readonly position: Vec3
  /** Direction the camera looks at, radians, `0` facing -Z. */
  readonly heading: number
  /** Vertical look angle, radians, positive looks up. */
  readonly pitch: number
}

/**
 * Complete, serialisable camera state.
 *
 * Both mode sub-states are always present so switching modes never loses the
 * viewer's place and so presets can define a full viewpoint in one value.
 */
export interface CameraState {
  readonly mode: CameraMode
  /** Point the orbit camera looks at and circles. */
  readonly target: Vec3
  readonly orbit: OrbitSettings
  readonly street: StreetSettings
  readonly fov: number
  readonly near: number
  readonly far: number
}

/** Sparse camera state used for presets, patches and prop updates. */
export interface CameraStatePatch {
  readonly mode?: CameraMode
  readonly target?: Vec3
  readonly orbit?: Partial<OrbitSettings>
  readonly street?: Partial<StreetSettings>
  readonly fov?: number
  readonly near?: number
  readonly far?: number
}

/**
 * World-space volume the viewer may occupy.
 *
 * Bounds keep the camera inside the block envelope: the orbit target and the
 * street-level eye are both clamped to a horizontal disc around `center`, a
 * height range, and mode-specific radius/angle limits.
 */
export interface CameraBounds {
  readonly center: Vec3
  /** Horizontal clamp radius around `center`, world units. */
  readonly radius: number
  /** Lowest allowed Y for the orbit target. */
  readonly minY: number
  /** Highest allowed Y for the orbit target. */
  readonly maxY: number
  /** Orbit distance limits. */
  readonly orbitRadius: Range
  /** Orbit polar-angle limits (0 = straight above, PI = straight below). */
  readonly orbitPolar: Range
  /** Allowed street-level eye heights. */
  readonly streetHeight: Range
  /** Street-level pitch limits. */
  readonly streetPitch: Range
}

/** Derived, read-only view of the camera for hit-testing and UI readouts. */
export interface CameraView {
  readonly position: Vec3
  readonly target: Vec3
  /** Unit vector the camera looks along. */
  readonly forward: Vec3
}

/** Pointer sample accepted by the navigation controller (DOM events included). */
export interface PointerSample {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  /** `mouse`, `pen` or `touch`; defaults to `mouse`. */
  readonly pointerType?: string
  /** True for the middle mouse button / two-finger equivalent. */
  readonly secondary?: boolean
}

/** Minimal touch sample; `Touch` objects satisfy this shape. */
export interface TouchSample {
  readonly clientX: number
  readonly clientY: number
}

/** Minimal touch-list shape; `TouchList` satisfies this shape. */
export interface TouchListSample {
  readonly length: number
  readonly [index: number]: TouchSample | undefined
}

/** Keyboard-intent actions the controller understands. */
export const KEYBOARD_ACTIONS = [
  'orbitLeft',
  'orbitRight',
  'orbitUp',
  'orbitDown',
  'panForward',
  'panBack',
  'panLeft',
  'panRight',
  'zoomIn',
  'zoomOut',
  'boost',
  'reset',
  'toggleMode',
] as const

export type KeyboardAction = (typeof KEYBOARD_ACTIONS)[number]

/**
 * Navigation controller: the bounded, damped camera API.
 *
 * The controller owns the authoritative target state (`getState`) and a damped
 * rendered state (`getView`) that trails it. Inputs mutate the target only, so
 * every input path — mouse, touch, keyboard or a programmatic call — is subject
 * to the same clamping and produces the same serialisable result.
 */
export interface NavigationControls {
  readonly mode: CameraMode
  readonly bounds: CameraBounds
  /** Authoritative, serialisable camera state. */
  getState(): CameraState
  /** Damped state currently being rendered, as a serialisable snapshot. */
  getView(): CameraState
  /** Replaces the target state (and snaps the damped state to it). */
  setState(state: CameraStatePatch): void
  /** Applies a patch to the target state without snapping. */
  applyState(patch: CameraStatePatch): void
  setMode(mode: CameraMode): void
  /** Restores the initial state and clears all held input. */
  reset(): void
  /** Rotates the orbit camera / turns the street camera. */
  orbitBy(deltaAzimuth: number, deltaPolar: number): void
  /** Pans the orbit target / walks the street camera. */
  panBy(deltaX: number, deltaY: number): void
  /** Walks the street camera along its facing/right axes. */
  moveBy(forward: number, right: number): void
  /** Changes look direction in street mode (no-op in orbit mode). */
  lookBy(deltaHeading: number, deltaPitch: number): void
  /** Multiplicative zoom step (`factor` > 1 moves closer in). */
  zoomBy(factor: number): void
  /** Absolute orbit-distance change in world units. */
  dollyBy(distance: number): void
  handleWheel(deltaY: number): void
  handlePointerDown(sample: PointerSample): void
  handlePointerMove(sample: PointerSample): void
  handlePointerUp(sample: PointerSample): void
  handleTouchStart(touches: TouchListSample): void
  handleTouchMove(touches: TouchListSample): void
  handleTouchEnd(touches: TouchListSample): void
  handleKeyDown(code: string): boolean
  handleKeyUp(code: string): boolean
  isKeyDown(code: string): boolean
  /** Subscribes to authoritative state changes; returns the unsubscribe. */
  onStateChange(listener: NavigationStateListener): () => void
  /** Advances damping and key-driven motion; returns true when the view moved. */
  update(deltaSeconds: number): boolean
  /** Attaches DOM listeners; returns the detach function. */
  bind(element: HTMLElement): () => void
}

/** Listener notified whenever the authoritative camera state changes. */
export type NavigationStateListener = (state: CameraState, controls: NavigationControls) => void

/** Configurable feel of the navigation controller. */
export interface NavigationSensitivity {
  /** Radians per pixel of drag. */
  readonly orbit: number
  /** World units per pixel of drag (scaled by orbit distance). */
  readonly pan: number
  /** Radius factor per wheel unit. */
  readonly zoom: number
  /** World units per second of walking. */
  readonly move: number
  /** Radians per second of keyboard orbit/turn. */
  readonly turn: number
  /** Multiplier applied while a boost key is held. */
  readonly boost: number
  /** Damping rate per second; higher settles faster. */
  readonly damping: number
}

/** Options accepted by {@link NavigationControls} construction. */
export interface NavigationControlsOptions {
  readonly state?: CameraStatePatch
  readonly bounds?: Partial<CameraBounds>
  readonly sensitivity?: Partial<NavigationSensitivity>
  /** Camera the controller writes to while updating; optional for headless use. */
  readonly camera?: PerspectiveCamera
  /** Notified when the target state changes. */
  readonly onStateChange?: NavigationStateListener
}

/**
 * Rig bundling a three.js camera with its navigation controller.
 *
 * Named `CameraRigApi` so the React controller component can keep the natural
 * `<CameraRig>` name in the public barrel without a name clash.
 */
export interface CameraRigApi {
  readonly camera: PerspectiveCamera
  readonly controls: NavigationControls
  readonly bounds: CameraBounds
  /** True while the damped view still trails the target state. */
  readonly settling: boolean
  setMode(mode: CameraMode): void
  setState(state: CameraStatePatch): void
  getState(): CameraState
  getView(): CameraState
  reset(): void
  /** Advances damping, writes the camera and updates its projection. */
  update(deltaSeconds: number): boolean
  /** Aspect ratio / far plane changes driven by quality and resize. */
  configure(options: { aspect?: number; far?: number }): void
  dispose(): void
}

/* -------------------------------------------------------------------------- */
/* Lighting rig                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Lighting parameters accepted per call.
 *
 * The rig maps this record onto a sun (`DirectionalLight`), a sky/ground
 * hemisphere light and a flat ambient light, plus the scene background and
 * distance fog. `night` is a switch that darkens the sky, cools the sun and
 * lifts the city-glow ambient without the caller having to compute it.
 */
export interface LightingParams {
  /** Sun azimuth in radians, clockwise from +Z. */
  readonly sunAzimuth: number
  /** Sun elevation in radians above the horizon. */
  readonly sunElevation: number
  /** Sun colour as a CSS hex/named value. */
  readonly sunColor: string
  /** Sun intensity in three.js units. */
  readonly sunIntensity: number
  /** Flat ambient light intensity. */
  readonly ambientIntensity: number
  /** Hemisphere sky tint. */
  readonly skyTint: string
  /** Hemisphere ground tint (bounce light). */
  readonly groundTint: string
  /** Night-mode flag: dims the sun, darkens the sky and lifts city glow. */
  readonly night: boolean
  /** Distance fog colour; defaults to the effective sky tint. */
  readonly fogColor?: string
  /** Exponential fog density; `0` disables fog. */
  readonly fogDensity?: number
  /** Scene background colour; defaults to the effective sky tint. */
  readonly backgroundColor?: string
}

/** Named lighting looks used by presets, tests and the demo harness. */
export const LIGHTING_PRESETS = ['day', 'goldenHour', 'dusk', 'night'] as const

export type LightingPresetName = (typeof LIGHTING_PRESETS)[number]

/** Lighting rig consumed by the pipeline and by era content layers. */
export interface LightingRig {
  /** Group holding every light, so content never has to know light names. */
  readonly group: Group
  /** The sun (or moon) light. */
  readonly sun: DirectionalLight
  /** Sky/ground bounce light. */
  readonly hemisphere: HemisphereLight
  /** Flat fill light carrying the ambient level. */
  readonly ambient: AmbientLight
  readonly params: LightingParams
  /** Resolved sun/moon direction (unit vector) for the current parameters. */
  readonly sunDirection: Vec3
  /** Rebuilds colours, intensities, positions, background and fog. */
  apply(params: Partial<LightingParams>): LightingParams
  /** Blends the rig towards another parameter set (era transitions). */
  blendTo(params: Partial<LightingParams>, alpha: number): LightingParams
  /** Shadow resolution/casting switches driven by the quality tier. */
  configureShadows(settings: { mapSize?: number; castShadows?: boolean; softShadows?: boolean }): void
  dispose(): void
}

/* -------------------------------------------------------------------------- */
/* Post-processing                                                             */
/* -------------------------------------------------------------------------- */

/** Post-processing passes, in the single canonical pass order. */
export const POST_EFFECT_ORDER = ['depthOfField', 'bloom', 'colorGrade', 'vignette'] as const

export type PostEffectName = (typeof POST_EFFECT_ORDER)[number]

/** Bloom (neon, signage and window glow). */
export interface BloomParams {
  readonly enabled: boolean
  /** Blend strength of the bloom pass. */
  readonly intensity: number
  /** Luminance above which pixels bloom. */
  readonly threshold: number
  /** Smoothness of the luminance threshold. */
  readonly smoothing: number
  /** Blur radius (mipmap blur). */
  readonly radius: number
}

/** Colour-grade controls applied after bloom. */
export interface ColorGradeParams {
  readonly enabled: boolean
  /** Linear exposure multiplier. */
  readonly exposure: number
  /** Contrast around middle grey; `1` leaves the image untouched. */
  readonly contrast: number
  /** Colour saturation; `1` leaves the image untouched. */
  readonly saturation: number
  /** Warm (+) / cool (-) white-balance shift in the range -1..1. */
  readonly temperature: number
  /** Green (+) / magenta (-) tint in the range -1..1. */
  readonly tint: number
}

/** Lens vignette used to focus attention on the block. */
export interface VignetteParams {
  readonly enabled: boolean
  /** Where the darkening starts, `0` centre .. `1` edge. */
  readonly offset: number
  /** How strongly the corners darken. */
  readonly darkness: number
}

/** Optional depth of field (tilt-shift look, era vignettes). */
export interface DepthOfFieldParams {
  readonly enabled: boolean
  /** Focus distance in world units. */
  readonly focusDistance: number
  /** Distance around the focus plane that stays sharp. */
  readonly focusRange: number
  /** Bokeh blur scale. */
  readonly bokehScale: number
}

/** Complete post-processing configuration. */
export interface PostProcessingParams {
  /** Master switch; `false` renders the scene directly. */
  readonly enabled: boolean
  readonly bloom: BloomParams
  readonly grade: ColorGradeParams
  readonly vignette: VignetteParams
  readonly depthOfField: DepthOfFieldParams
}

/**
 * Sparse post-processing patch.
 *
 * Every nested effect record is optional, so a preset or an era can change one
 * value ("night needs bloom but no depth of field") without restating the rest.
 */
export interface PostProcessingParamsPatch {
  readonly enabled?: boolean
  readonly bloom?: Partial<BloomParams>
  readonly grade?: Partial<ColorGradeParams>
  readonly vignette?: Partial<VignetteParams>
  readonly depthOfField?: Partial<DepthOfFieldParams>
}

/** One resolved entry of the effect chain. */
export interface EffectChainEntry {
  readonly name: PostEffectName
  readonly enabled: boolean
  /** Position in the canonical pass order. */
  readonly order: number
}

/**
 * Post-processing chain.
 *
 * The chain is *additive and degradable*: it composes the effects the current
 * quality tier and parameters allow into one pass order, and falls back to a
 * plain `renderer.render` call whenever the chain is empty, disabled or fails
 * on the running GPU (missing extensions, lost context disabled effects).
 */
export interface PostProcessingChain {
  /** True while the composer is driving the frame; false means direct render. */
  readonly active: boolean
  /** Why the chain fell back to direct rendering, or `null` when healthy. */
  readonly failure: string | null
  readonly effects: readonly EffectChainEntry[]
  /** Effect names that would render right now, in pass order. */
  readonly passOrder: readonly PostEffectName[]
  readonly params: PostProcessingParams
  /**
   * Resolved resolution: the canvas size in CSS pixels and the buffer size the
   * chain renders at (CSS pixels scaled by the renderer's pixel ratio).
   */
  readonly size: {
    readonly cssWidth: number
    readonly cssHeight: number
    readonly bufferWidth: number
    readonly bufferHeight: number
  }
  /** Enables/disables effects without rebuilding the composer. */
  apply(params: PostProcessingParamsPatch): PostProcessingParams
  /** Rebuilds the pass list for a new tier/chain; returns the active order. */
  setEffects(ids: readonly PostEffectName[]): readonly PostEffectName[]
  /** Renders one frame; returns true when the composer handled it. */
  render(scene: Scene, camera: PerspectiveCamera, deltaSeconds: number): boolean
  /** Resizes the internal buffers from a canvas size in CSS pixels. */
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  /** Drops the composer and switches to direct rendering. */
  disable(): void
  /** Rebuilds the composer from the current parameters (context restore). */
  rebuild(): boolean
  dispose(): void
}

/* -------------------------------------------------------------------------- */
/* Quality + instrumentation                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolved quality settings for the render pipeline.
 *
 * `tier` is the shared record from `src/lib/quality.ts`; the extra fields are
 * the pipeline-side resolutions (device pixel ratio, MSAA samples, resolved
 * effect chain) that consumers and tests read back.
 */
export interface SceneQuality {
  readonly tier: QualityTier
  readonly name: QualityTierName
  readonly pixelRatio: number
  readonly shadowMapSize: number
  readonly shadows: boolean
  readonly multisampling: number
  readonly effects: readonly PostEffectName[]
  readonly density: DensitySettings
  readonly frameBudgetMs: number
}

/** Rolling frame statistics. The pipeline reuses one instance (no allocation). */
export interface FrameStats {
  /** Frames recorded since the last reset. Monotonic. */
  readonly frames: number
  /** Milliseconds spent in the frame that was just recorded. */
  readonly frameTimeMs: number
  /** Rolling mean of the frame-time window. */
  readonly averageFrameTimeMs: number
  readonly minFrameTimeMs: number
  readonly maxFrameTimeMs: number
  /** Instantaneous frames per second of the last frame. */
  readonly fps: number
  /** Rolling average frames per second. */
  readonly averageFps: number
  /** Budget the current quality tier targets. */
  readonly budgetMs: number
  /** True while `frameTimeMs` fits the budget. */
  readonly withinBudget: boolean
  /** How many frames since the last reset exceeded the budget. */
  readonly overBudgetFrames: number
  /** Consecutive over-budget frames, used by adaptive degradation. */
  readonly consecutiveOverBudgetFrames: number
}

export type FrameHook = (stats: FrameStats, deltaSeconds: number) => void

/** Cheap frame-time accounting with a fixed-size ring buffer. */
export interface FrameInstrumentation {
  /** Live statistics; the same object is reused every frame. */
  readonly stats: FrameStats
  /** Number of samples the rolling window can hold. */
  readonly windowSize: number
  sample(): FrameStats
  record(deltaSeconds: number): FrameStats
  setBudget(budgetMs: number): void
  onFrame(hook: FrameHook): () => void
  /** Copies the window (oldest first) into `target`, or a new array. */
  history(target?: Float32Array): Float32Array
  reset(): void
}

/** Recommendation produced by the adaptive quality helper. */
export interface QualityRecommendation {
  /** Tier that should be active next frame. */
  readonly tier: QualityTierName
  /** True when the recommendation differs from the requested tier. */
  readonly changed: boolean
  readonly reason: 'steady' | 'over-budget' | 'under-budget' | 'holding'
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                    */
/* -------------------------------------------------------------------------- */

/** Live WebGL capability report, also used by the browser harness. */
export interface RendererContextInfo {
  /** True when a WebGL context is live on the canvas. */
  readonly available: boolean
  /** `webgl2`, `webgl`, or `none` when no context could be created. */
  readonly contextType: 'webgl2' | 'webgl' | 'none'
  readonly isWebGL2: boolean
  /** Unmasked GPU string when the browser exposes it, else the GL version. */
  readonly renderer: string
  readonly pixelRatio: number
  readonly drawingBufferWidth: number
  readonly drawingBufferHeight: number
}

/** Options for {@link RenderPipeline} creation. */
export interface RenderPipelineOptions {
  /** Canvas to render into. The pipeline never creates one implicitly. */
  readonly canvas: HTMLCanvasElement
  readonly qualityTier?: QualityTierName
  readonly lighting?: Partial<LightingParams>
  readonly postProcessing?: PostProcessingParamsPatch
  readonly camera?: CameraStatePatch
  readonly bounds?: Partial<CameraBounds>
  readonly sensitivity?: Partial<NavigationSensitivity>
  /** Degrade the tier automatically when frames miss the budget. */
  readonly adaptiveQuality?: boolean
  /** Start the animation loop immediately; default true. */
  readonly autoStart?: boolean
  /** Largest frame delta fed to camera damping and effects. */
  readonly maxDeltaSeconds?: number
  /** Overrides the device pixel ratio (tests, fixed-resolution captures). */
  readonly pixelRatio?: number
  /** Subscribes to rolling frame statistics. */
  readonly onFrame?: FrameHook
  /** Content attached to the pipeline's world group before the first frame. */
  readonly onWorldReady?: (world: Group, pipeline: RenderPipeline) => void
}

/**
 * The render pipeline contract consumed by era content layers, the transition
 * director and QA.
 *
 * Everything the outside world needs is reachable from this handle: the
 * renderer, the scene graph root content is added to, the camera rig, the
 * lighting rig, the post-processing chain, the quality setting and the frame
 * instrumentation.
 */
export interface RenderPipeline {
  readonly canvas: HTMLCanvasElement
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  /** Root group content layers add their meshes to. */
  readonly world: Group
  readonly camera: PerspectiveCamera
  readonly rig: CameraRigApi
  readonly controls: NavigationControls
  readonly lighting: LightingRig
  readonly postProcessing: PostProcessingChain
  readonly instrumentation: FrameInstrumentation
  readonly quality: SceneQuality
  /** True while the animation loop is running. */
  readonly running: boolean
  /** True between a lost WebGL context and its restore. */
  readonly contextLost: boolean
  readonly contextInfo: RendererContextInfo
  /**
   * Renders exactly one frame without touching the animation loop, and returns
   * the CPU milliseconds that frame cost. The instrumentation records the frame
   * *interval* separately, which is what the frame budget is written against.
   */
  renderFrame(deltaSeconds?: number): number
  start(): void
  stop(): void
  /** Re-reads canvas/container size and applies quality pixel ratio. */
  resize(): boolean
  setQualityTier(name: QualityTierName): SceneQuality
  applyLighting(params: Partial<LightingParams>): LightingParams
  applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams
  getCameraState(): CameraState
  setCameraState(state: CameraStatePatch): void
  setCameraMode(mode: CameraMode): void
  /** Subscribes to frame statistics; returns the unsubscribe function. */
  onFrame(hook: FrameHook): () => void
  dispose(): void
}
