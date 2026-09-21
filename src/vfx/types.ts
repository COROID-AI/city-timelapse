/**
 * Shared vocabulary of the atmosphere layer (`src/vfx`).
 *
 * `src/vfx` turns the era model (`src/era`) into the things a renderer can
 * actually show: a sky dome, haze and fog, a colour grade, weather particles
 * and exhaust/steam/ambient accents. It owns no light, no renderer and no
 * post-processing pass: it writes plain parameter values into the render
 * pipeline's public surface and adds its own meshes to the pipeline's `world`
 * group.
 *
 * Conventions
 * -----------
 * - Colours are `#rrggbb` strings (the shared currency of `src/era`); angles are
 *   radians and lengths are metres, matching `src/scene`.
 * - Every resolved atmosphere value is plain and serialisable, so a snapshot can
 *   be hashed, diffed and asserted without a GPU.
 * - Simulation time always arrives from the caller ({@link VfxClock}); the layer
 *   never reads `Date`, `performance` or `Math.random`.
 */

import type { Group, InstancedMesh } from 'three'
import type { ColourChannel, EraId, EraRegistry, HexColor } from '../era'
import type { QualityTier, QualityTierName } from '../lib/quality'
import type { Seed } from '../lib/rng'
import type {
  FrameHook,
  LightingParams,
  PostProcessingParams,
  PostProcessingParamsPatch,
  SceneQuality,
  Vec3,
} from '../scene'

/**
 * Pipeline parameter types re-exported from `src/scene`.
 *
 * The layer's vocabulary refers to the pipeline's own records (the values handed
 * to `applyLighting` / `applyPostProcessing`) and to `Vec3` positions, so a
 * consumer of `src/vfx` can name them without a second import path.
 */
export type {
  FrameHook,
  LightingParams,
  PostProcessingParams,
  PostProcessingParamsPatch,
  SceneQuality,
  Vec3,
} from '../scene'

/* -------------------------------------------------------------------------- */
/* Target + context                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The part of the render pipeline the atmosphere layer drives.
 *
 * `RenderPipeline` satisfies this structurally, so production code passes the
 * pipeline straight in while tests can pass a recording stub and assert exactly
 * which parameters were written — no GPU, no renderer internals.
 */
export interface VfxTarget {
  /** Content root the layer attaches its meshes to. */
  readonly world?: Group
  /** Resolved quality of the running pipeline, when one is available. */
  readonly quality?: SceneQuality
  /** Writes sun/sky/fog/ambient parameters. */
  applyLighting(params: Partial<LightingParams>): LightingParams
  /** Writes bloom, colour grade, vignette and depth-of-field parameters. */
  applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams
  /** Subscribes to frame callbacks so the simulation can follow the pipeline. */
  onFrame?(hook: FrameHook): () => void
}

/** Everything `applyEra` / `applyEraTransition` need to resolve and apply an era. */
export interface VfxContext {
  /** Render pipeline (or structural stand-in) the atmosphere is written into. */
  readonly target: VfxTarget
  /** Era registry supplying the records; defaults to the shipped registry. */
  readonly registry?: EraRegistry
  /** Quality tier name; defaults to the tier the target reports, then `high`. */
  readonly qualityTier?: QualityTierName
  /** Explicit tier record, used when a caller owns the resolved settings. */
  readonly quality?: QualityTier
  /** Seed for the particle/plume distributions. */
  readonly seed?: Seed
  /** Lowers particle counts for callers that ask for reduced motion. */
  readonly reducedMotion?: boolean
}

/** A staged era change handed to {@link applyEraTransition}. */
export interface VfxTransitionRequest {
  /** Era the blend starts from. */
  readonly from: EraId
  /** Era the blend moves towards. */
  readonly to: EraId
  /** Blend weight, `0` = fully `from`, `1` = exactly `to`. */
  readonly t: number
  /**
   * Snaps straight to `to` instead of interpolating (reduced-motion path).
   * Provided so a caller can keep one argument shape for both behaviours.
   */
  readonly instant?: boolean
}

/**
 * Caller-supplied clock.
 *
 * The layer reads `seconds` when it is asked to advance, so particle and plume
 * motion is a pure function of the caller's timeline: deterministic in tests,
 * pausable in a harness and never tied to wall-clock time.
 */
export interface VfxClock {
  readonly seconds: number
}

/* -------------------------------------------------------------------------- */
/* Sky                                                                         */
/* -------------------------------------------------------------------------- */

/** Resolved sky-dome gradient, sun disc and light-scatter look of one era. */
export interface SkyConfig {
  /** Colour at the top of the dome. */
  readonly topColor: HexColor
  /** Colour just above the horizon. */
  readonly horizonColor: HexColor
  /** Colour below the horizon, so the dome never shows a hard edge. */
  readonly groundColor: HexColor
  readonly sunColor: HexColor
  /** Angular radius of the sun disc, radians. */
  readonly sunDiscSizeRad: number
  /** Strength of the halo around the sun, `0..1`. */
  readonly sunGlow: number
  /** Gradient tightness: small values keep the horizon band tall. */
  readonly horizonSharpness: number
  /** Opacity of the cloud band hugging the horizon, `0..1`. */
  readonly cloudOpacity: number
  /** Opacity of the night starfield, `0..1`. */
  readonly starOpacity: number
  /** Linear exposure the dome renders at. */
  readonly exposure: number
  /** Unit vector from the block towards the sun. */
  readonly sunDirection: Vec3
}

/* -------------------------------------------------------------------------- */
/* Fog + haze                                                                  */
/* -------------------------------------------------------------------------- */

/** Resolved distance fog and low-lying haze of one era. */
export interface FogConfig {
  /** Fog/haze colour written into the pipeline's fog. */
  readonly color: HexColor
  /** Exponential fog density written into the pipeline's fog. */
  readonly density: number
  /** Era height falloff of the haze (`0..1`); drives the haze wall height. */
  readonly heightFalloff: number
  /** Opacity of the low-lying haze layer, `0..1`. */
  readonly groundHazeOpacity: number
  /** Height of the haze layer above the street, metres. */
  readonly groundHazeHeight: number
  /** Extra haze opacity contributed at full wet-surface response. */
  readonly wetSurfaceLift: number
}

/* -------------------------------------------------------------------------- */
/* Colour grade + emissive glow                                                */
/* -------------------------------------------------------------------------- */

/** Depth-of-field settings carried by an era (tilt-shift period look). */
export interface GradeDepthOfField {
  readonly enabled: boolean
  readonly focusDistance: number
  readonly focusRange: number
  readonly bokehScale: number
}

/**
 * Resolved colour grade of one era.
 *
 * `lift`/`gamma`/`gain`/`grain` come straight from the era record and travel in
 * the snapshot for neighbouring layers and QA; the values the render pipeline's
 * grade pass can execute (`exposure`, `contrast`, `saturation`, `temperature`,
 * `tint`) plus the bloom and vignette settings are written to the pipeline.
 */
export interface GradeConfig {
  readonly lift: ColourChannel
  readonly gamma: ColourChannel
  readonly gain: ColourChannel
  readonly exposure: number
  readonly contrast: number
  readonly saturation: number
  readonly temperature: number
  readonly tint: number
  /** Vignette darkness, `0..1`. */
  readonly vignette: number
  /** Vignette start radius, `0..1`. */
  readonly vignetteOffset: number
  /** Film grain strength, `0..1` (carried for the composed look). */
  readonly grain: number
  readonly bloomIntensity: number
  readonly bloomThreshold: number
  readonly bloomSmoothing: number
  readonly bloomRadius: number
  readonly depthOfField: GradeDepthOfField
}

/** Emissive/neon tuning so signage, headlights and plumes bloom per era. */
export interface EmissiveTuning {
  /** Colour of the era's artificial light (neon, sodium, LED). */
  readonly color: HexColor
  /** `emissiveIntensity` the layer applies to its own glow material. */
  readonly glowIntensity: number
  /** Multiplier a signage layer applies to its neon emission. */
  readonly neonBoost: number
  /** Multiplier a vehicle layer applies to headlight emission. */
  readonly headlightScale: number
  /** Bloom strength/threshold resolved for the era's grade. */
  readonly bloomIntensity: number
  readonly bloomThreshold: number
}

/* -------------------------------------------------------------------------- */
/* Weather particles                                                           */
/* -------------------------------------------------------------------------- */

/** Particle families the pooled weather system implements. */
export const PARTICLE_KINDS = ['rain', 'snow', 'leaves', 'dust'] as const

export type ParticleKind = (typeof PARTICLE_KINDS)[number]

/** Weather families driven by the era's precipitation. */
export const PRECIPITATION_PARTICLE_KINDS = ['rain', 'snow'] as const

export type PrecipitationParticleKind = (typeof PRECIPITATION_PARTICLE_KINDS)[number]

/** Ambient families always present, at an era-chosen strength. */
export const AMBIENT_PARTICLE_KINDS = ['leaves', 'dust'] as const

export type AmbientParticleKind = (typeof AMBIENT_PARTICLE_KINDS)[number]

/** How a family is gated on: by the era's weather, or by its ambience. */
export type ParticleGate = 'precipitation' | 'ambient'

/** Motion model of one family. */
export type ParticleMotion = 'fall' | 'drift'

/** Shared, era-independent tuning of one particle family. */
export interface ParticleTuning {
  readonly gate: ParticleGate
  readonly motion: ParticleMotion
  /** Instances at strength 1, era scale 1 and quality density 1. */
  readonly baseCount: number
  readonly sizeM: number
  readonly fallSpeedMps: number
  /** How strongly the wind pushes this family sideways. */
  readonly driftFactor: number
  readonly opacity: number
  /** Wetting / accumulation this family contributes at full strength. */
  readonly surfaceResponse: number
}

/** Resolved plan for one particle family in one era. */
export interface ParticleKindPlan {
  readonly kind: ParticleKind
  readonly enabled: boolean
  /** Live instance count, after era strength and the quality tier. */
  readonly count: number
  /** Pool size; equals `count` for a freshly built plan. */
  readonly capacity: number
  /** Strength in `0..1` from the era's weather or ambience. */
  readonly strength: number
  /** Era-derived colour of the family (rain grey-blue, leaf litter, dust motes). */
  readonly color: HexColor
  readonly tuning: ParticleTuning
  readonly sizeM: number
  readonly fallSpeedMps: number
  readonly driftFactor: number
  readonly opacity: number
  readonly surfaceResponse: number
}

/** Everything the weather system needs for one era. */
export interface ParticlePlan {
  readonly kinds: readonly ParticleKindPlan[]
  /** Sum of the enabled families' instance counts. */
  readonly totalCount: number
  /** Seed material, so two runs of the same era lay out identically. */
  readonly seed: string
  readonly bounds: ParticleBounds
  readonly windSpeedMps: number
}

/** Spawn volume of the particle systems, centred on the block. */
export interface ParticleBounds {
  readonly halfExtentX: number
  readonly halfExtentZ: number
  readonly minY: number
  readonly maxY: number
}

/** Accumulated weather response published to neighbouring layers. */
export interface WeatherState {
  /** Wet-surface response in `0..1`, risen by rain and dried afterwards. */
  readonly wetness: number
  /** Snow accumulation in `0..1`. */
  readonly snowCover: number
  /** Leaf-litter response in `0..1`. */
  readonly leafLitter: number
  /** True while a precipitation family is emitting. */
  readonly precipitating: boolean
}

/* -------------------------------------------------------------------------- */
/* Plumes + ambient accents                                                    */
/* -------------------------------------------------------------------------- */

/** Plume families the pooled emitter system implements. */
export const PLUME_KINDS = ['exhaust', 'steam', 'smoke', 'evGlow'] as const

export type PlumeKind = (typeof PLUME_KINDS)[number]

/** Plume families an external caller may attach to a vehicle or vent. */
export const PLUME_SOURCE_KINDS = ['exhaust', 'steam', 'evGlow'] as const

/**
 * One live emission event supplied by the caller.
 *
 * This is the documented `plumeSources` input: the vehicle and prop layers
 * publish positions, never meshes, so the atmosphere stays decoupled from them.
 */
export interface PlumeSourceEvent {
  /** Stable identity of the emitting vehicle/vent. */
  readonly id: string
  readonly kind: PlumeKind
  /** World position of the emitter, metres. */
  readonly position: Vec3
  /** Emission strength in `0..1`. */
  readonly intensity: number
  /** Set `false` to keep a known source in the list while it idles. */
  readonly active?: boolean
}

/** The caller-supplied plume input. An empty list means "era baseline only". */
export type PlumeSources = readonly PlumeSourceEvent[]

/** Resolved plan of one plume family. */
export interface PlumeKindPlan {
  readonly kind: PlumeKind
  /** Era-derived puff colour (exhaust soot, steam white, neon glow). */
  readonly color: HexColor
  /** Particles per second emitted by one source at intensity 1. */
  readonly ratePerSecond: number
  readonly riseSpeedMps: number
  readonly driftFactor: number
  readonly sizeM: number
  readonly lifetimeSec: number
  readonly opacity: number
  /** Glowing families (EV whine, neon haze) render with an emissive material. */
  readonly emissive: boolean
}

/** One era baseline emitter: a vent, stack or grate that always smokes. */
export interface PlumeBaselineSource {
  readonly id: string
  readonly kind: PlumeKind
  readonly position: Vec3
  readonly intensity: number
}

/** Birds and aircraft accents of one era. */
export interface AmbientAccents {
  readonly birds: number
  readonly aircraft: number
  readonly orbitRadius: number
  readonly altitude: number
}

/** Everything the plume system needs for one era. */
export interface PlumePlan {
  readonly kinds: readonly PlumeKindPlan[]
  readonly baseline: readonly PlumeBaselineSource[]
  readonly ambient: AmbientAccents
  /** Colour of the bird/aircraft silhouettes, taken from the era palette. */
  readonly accentColor: HexColor
  readonly windSpeedMps: number
  readonly seed: string
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fully resolved atmosphere of one era, or of one step of a transition.
 *
 * `lighting` and `postProcessing` are the *exact* values written into the
 * pipeline, so a test can assert both the resolved look and the parameters the
 * real pipeline builders received.
 */
export interface VfxSnapshot {
  readonly eraId: EraId
  readonly year: number
  readonly eraLabel: string
  /** True when the era's key light sits at or below the horizon. */
  readonly night: boolean
  readonly qualityTier: QualityTierName
  readonly sky: SkyConfig
  readonly fog: FogConfig
  readonly grade: GradeConfig
  readonly emissive: EmissiveTuning
  readonly particles: ParticlePlan
  readonly plumes: PlumePlan
  readonly lighting: LightingParams
  readonly postProcessing: PostProcessingParams
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                  */
/* -------------------------------------------------------------------------- */

/** Live counters of one particle family. */
export interface ParticleKindStats {
  readonly kind: ParticleKind
  readonly enabled: boolean
  readonly count: number
  readonly capacity: number
  readonly alive: number
  readonly spawned: number
  readonly respawned: number
}

/** Live counters of the plume system. */
export interface PlumeStats {
  readonly baselineSources: number
  /** Emitters driven by the caller's `plumeSources` input. */
  readonly sourceEmitters: number
  readonly emittersByKind: Readonly<Record<PlumeKind, number>>
  readonly alive: number
  readonly spawned: number
  readonly ambientBirds: number
  readonly ambientAircraft: number
}

/** Everything the layer publishes about the frame it just produced. */
export interface VfxStats {
  readonly eraId: EraId
  readonly qualityTier: QualityTierName
  readonly clockSeconds: number
  readonly frames: number
  readonly particles: readonly ParticleKindStats[]
  readonly plumes: PlumeStats
  readonly weather: WeatherState
  /** Object counts per named group, keyed by group name. */
  readonly groups: Readonly<Record<string, number>>
}

/* -------------------------------------------------------------------------- */
/* Structures the layer builds                                                 */
/* -------------------------------------------------------------------------- */

/** Sky dome owned by the atmosphere layer. */
export interface SkyDome {
  readonly object: Group
  readonly radius: number
  /** Writes a resolved era sky into the dome's uniforms. */
  apply(config: SkyConfig): void
  /** Advances the slow cloud drift and the star twinkle. */
  setTime(seconds: number): void
  dispose(): void
}

/** Low-lying haze wall owned by the atmosphere layer. */
export interface HazeLayer {
  readonly object: Group
  /** Writes an era's haze values into the wall, including the weather response. */
  apply(config: FogConfig, weather: WeatherState): void
  /** Advances the wall's slow drift. */
  setTime(seconds: number): void
  dispose(): void
}

/** One pooled, instanced weather family. */
export interface ParticleSystem {
  readonly kind: ParticleKind
  readonly object: InstancedMesh
  readonly capacity: number
  readonly count: number
  /** Flat `xyz` per instance; the authoritative simulation state. */
  readonly positions: Float32Array
  step(deltaSeconds: number, wind: Vec3): void
  stats(): ParticleKindStats
  dispose(): void
}

/** All weather families of one era, plus the accumulated weather response. */
export interface ParticleSystemSet {
  readonly object: Group
  readonly systems: readonly ParticleSystem[]
  readonly plan: ParticlePlan
  readonly weather: WeatherState
  step(deltaSeconds: number, seconds: number): WeatherState
  setPlan(plan: ParticlePlan): void
  stats(): readonly ParticleKindStats[]
  dispose(): void
}

/** Pooled plume emitters plus the era's ambient bird/aircraft accents. */
export interface PlumeSystem {
  readonly object: Group
  /** Separate group holding the bird and aircraft accents. */
  readonly ambientObject: Group
  readonly plan: PlumePlan
  /** Total emitters: era baseline vents plus the caller's live sources. */
  readonly emitterCount: number
  setPlan(plan: PlumePlan): void
  setSources(sources: PlumeSources): void
  step(deltaSeconds: number, seconds: number, weather: WeatherState): void
  stats(): PlumeStats
  dispose(): void
}

/** Inputs of the layer's rule-based (no-React) core. */
export interface VfxLayerOptions {
  readonly target: VfxTarget
  /** Era applied at creation; defaults to the registry's first era. */
  readonly era?: EraId
  readonly registry?: EraRegistry
  readonly qualityTier?: QualityTierName
  readonly seed?: Seed
  /** Caller-supplied clock read on every advancement. */
  readonly clock?: VfxClock
  /** Caller-supplied plume events; empty (or absent) keeps the era baseline. */
  readonly plumeSources?: PlumeSources
  /** Lowers particle counts and skips glow-heavy accents. */
  readonly reducedMotion?: boolean
  /** Called after every simulated frame with the layer's live statistics. */
  readonly onStats?: (stats: VfxStats) => void
}

/** Imperative handle the React component and the harness both drive. */
export interface VfxController {
  readonly target: VfxTarget
  readonly root: Group
  readonly sky: SkyDome
  readonly haze: HazeLayer
  readonly particles: ParticleSystemSet
  readonly plumes: PlumeSystem
  /** Snapshot currently applied to the pipeline. */
  readonly snapshot: VfxSnapshot
  /** Applies an era immediately (the reduced-motion path). */
  applyEra(eraId: EraId): VfxSnapshot
  /** Applies an interpolated or instant transition. */
  applyTransition(request: VfxTransitionRequest): VfxSnapshot
  /** Replaces the `plumeSources` input. */
  setPlumeSources(sources: PlumeSources): void
  /** Replaces the caller-supplied clock. */
  setClock(clock: VfxClock): void
  /** Re-resolves particle tiers for a new quality tier. */
  setQualityTier(name: QualityTierName): VfxSnapshot
  /** Advances the simulation to the clock's `seconds` value. */
  advanceTo(seconds: number): void
  getStats(): VfxStats
  dispose(): void
}

/* -------------------------------------------------------------------------- */
/* Per-era VFX tables                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sky-dome data an era adds on top of its own lighting record.
 *
 * The gradient colours, sun colour and sun angles come from the era record
 * itself (`lighting.skyTopColor`, `skyHorizonColor`, `sunColor`, azimuth and
 * elevation); this table holds the look values the era model does not carry.
 */
export interface VfxEraSkyTable {
  readonly sunDiscSizeDeg: number
  readonly sunGlow: number
  readonly horizonSharpness: number
  /** Colour below the horizon, so the dome never shows a hard cut. */
  readonly groundColor: HexColor
  /** Cloud-band strength at full cloud cover. */
  readonly cloudOpacity: number
  /** Starfield strength when the era's key light is below the horizon. */
  readonly starOpacity: number
}

/** Fog/haze data an era adds on top of `atmosphere.hazeDensity` and colour. */
export interface VfxEraHazeTable {
  /** Multiplier mapping the era's haze density onto pipeline fog density. */
  readonly densityScale: number
  readonly groundHazeOpacity: number
  /** Extra low-lying haze opacity at full wet-surface response. */
  readonly wetSurfaceLift: number
}

/** Bloom and depth-of-field data an era adds on top of its colour grade. */
export interface VfxEraGradeTable {
  /** Multiplier on `atmosphere.colourGrade.bloomIntensity`. */
  readonly bloomScale: number
  readonly bloomSmoothing: number
  readonly bloomRadius: number
  readonly depthOfField: GradeDepthOfField
}

/** Emissive/neon tuning of an era. */
export interface VfxEraEmissiveTable {
  /** Gain on `lighting.artificialLightIntensity` for glow materials. */
  readonly glowScale: number
  /** Extra bloom a signage layer applies to neon. */
  readonly neonBoost: number
}

/** Weather-particle data of an era. */
export interface VfxEraParticleTable {
  readonly countScale: number
  readonly sizeScale: number
  readonly speedScale: number
  /** Strength of the ambient (non-weather) families; `0` disables a family. */
  readonly ambientStrength: Readonly<Record<AmbientParticleKind, number>>
}

/** Plume data of an era. */
export interface VfxEraPlumeTable {
  /** Emissions per second per emitter at intensity 1, per family. */
  readonly rates: Readonly<Record<PlumeKind, number>>
  readonly sizeScale: number
  readonly riseScale: number
  readonly lifetimeScale: number
  /** Vents, stacks and grates that emit in every frame of the era. */
  readonly baseline: readonly PlumeBaselineSource[]
  readonly ambient: AmbientAccents
}

/**
 * Complete per-era atmosphere data.
 *
 * The registry record supplies colours, sun position, haze density and the
 * colour grade; this table adds the values the era model deliberately leaves to
 * the VFX layer (sun disc, gradient shape, bloom scale, particle and plume
 * tuning). Effect code therefore holds no era-specific branches and no year
 * literals: adding a period is one more record in the registry plus one more
 * entry here.
 */
export interface VfxEraTable {
  readonly eraId: EraId
  readonly sky: VfxEraSkyTable
  readonly haze: VfxEraHazeTable
  readonly grade: VfxEraGradeTable
  readonly emissive: VfxEraEmissiveTable
  readonly particles: VfxEraParticleTable
  readonly plumes: VfxEraPlumeTable
}
