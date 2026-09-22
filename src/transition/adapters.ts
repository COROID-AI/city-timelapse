/**
 * Adapters: the only place the director meets the rest of the application.
 *
 * The director deliberately knows nothing about three.js, the audio graph or the
 * UI store. This module translates those real contracts into the director's
 * ports, and it is the file the scene integration (and the composition suite)
 * imports:
 *
 * | factory                        | binds                                             |
 * | ------------------------------ | ------------------------------------------------- |
 * | `createSceneLayerAdapters`     | every shipped scene layer barrel through          |
 * |                                | `applyEra` / `applyEraTransition`                 |
 * | `createAudioEnginePort`        | `AudioEngine.crossfadeBeds` + `playOneShot`       |
 * | `createNavigationCameraPort`   | the pipeline's `NavigationControls`               |
 * | `createUIControlsMotionPort`   | the reduced-motion preference in `ui/uiStore`     |
 * | `bindLayerAdapter`             | any layer that follows the shared layer contract  |
 * | `createStubLayerAdapter`       | a deterministic stand-in (harness + unit tests)   |
 *
 * Layer barrels are imported *lazily* by `createSceneLayerAdapters`, so a host
 * that only uses the director's schedule (the harness page) never pulls three.js
 * or React into its bundle, and a barrel that is not shipped yet (see
 * {@link PENDING_LAYER_STAGES}) is simply absent from the result instead of
 * breaking the module graph.
 */

import type { EraId, EraSoundscape, EraSoundscapeCue } from '../era'
import { resolveOneShotId } from '../audio'
import type {
  AudioEngine,
  AmbienceLayerDescriptor,
  OneShotId,
  OneShotOptions,
  SoundscapeDescriptor,
} from '../audio'
import type { BlockLayout } from '../city/layout'
import type { BuildingPlan, BuildingTransitionPlan } from '../city/buildings'
import type { PedestrianPlan, PedestrianTransitionPlan } from '../city/pedestrians'
import type { EraVehiclePlan } from '../city/vehicles'
import type { PropsLayerPlan, PropsRuntime } from '../city/props'
import type { StorefrontPlan } from '../city/storefronts'
import type { CameraState, NavigationControls, QualityTierName } from '../scene'
import { resolveReducedMotion, selectMotionPreference, systemPrefersReducedMotion } from '../ui/uiStore'
import type { UIControlsStore } from '../ui/uiStore'
import type { VfxSnapshot, VfxTarget } from '../vfx'
import { clamp01 } from './easing'
import {
  STAGE_LABELS,
  type LayerApplication,
  type LayerEraRequest,
  type LayerTransitionRequest,
  type TransitionAudioPort,
  type TransitionCameraPort,
  type TransitionCrossfadeRequest,
  type TransitionCueRequest,
  type TransitionLayerAdapter,
  type TransitionMotionPort,
  type TransitionStageId,
} from './types'

/* -------------------------------------------------------------------------- */
/* Barrel wiring map                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Barrel that implements each stage.
 *
 * The soundscape has no layer: it is driven through {@link TransitionAudioPort}.
 */
export const SCENE_LAYER_BARRELS: Readonly<Record<TransitionStageId, string>> = Object.freeze({
  atmosphere: 'src/vfx',
  buildings: 'src/city/buildings',
  storefronts: 'src/city/storefronts',
  props: 'src/city/props',
  vehicles: 'src/city/vehicles',
  pedestrians: 'src/city/pedestrians',
  soundscape: 'src/audio (through the audio port, not a layer adapter)',
})

/**
 * Scheduled stages whose layer barrel is not shipped in this revision.
 *
 * The schedule reserves their windows and the director reports them as pending;
 * when the barrel lands, wiring it is two lines in
 * {@link createSceneLayerAdapters} (`bindLayerAdapter` with the layer's own
 * context) and this list shrinks. Nothing else changes: the stage ids, the
 * schedule rows and the store bookkeeping are already in place.
 */
export const PENDING_LAYER_STAGES: readonly TransitionStageId[] = Object.freeze([])

/* -------------------------------------------------------------------------- */
/* Generic layer binding                                                      */
/* -------------------------------------------------------------------------- */

/** Everything {@link bindLayerAdapter} needs to drive one real layer. */
export interface LayerAdapterBinding<Context, EraResult, TransitionResult> {
  /** Stage this layer belongs to; must be scheduled by the table. */
  readonly id: TransitionStageId
  /** Display name; defaults to the schedule's own label. */
  readonly label?: string
  /** Builds the layer's own context for one request. */
  readonly contextFor: (request: { readonly reducedMotion: boolean }) => Context
  /** The layer's own `applyEra`. */
  readonly applyEra: (eraId: EraId, context: Context) => EraResult
  /** The layer's own `applyEraTransition`. */
  readonly applyEraTransition: (
    request: LayerTransitionRequest,
    context: Context,
  ) => TransitionResult
  /** Reads the era the layer holds after an instant application. */
  readonly readEra: (result: EraResult, eraId: EraId) => EraId | null
  /** Reads the era the layer resolved to after a staged frame. */
  readonly readTransitionEra: (result: TransitionResult, request: LayerTransitionRequest) => EraId | null
}

/**
 * Binds a real layer's two entry points to the director's adapter contract.
 *
 * The layer stays a black box: the director only ever sees these two calls, and
 * the returned `result` is kept opaque for tests and the harness.
 */
export function bindLayerAdapter<Context, EraResult, TransitionResult>(
  binding: LayerAdapterBinding<Context, EraResult, TransitionResult>,
): TransitionLayerAdapter {
  return {
    id: binding.id,
    label: binding.label ?? STAGE_LABELS[binding.id],
    applyEra(request: LayerEraRequest): LayerApplication {
      const result = binding.applyEra(request.eraId, binding.contextFor(request))
      return { eraId: binding.readEra(result, request.eraId), result }
    },
    applyEraTransition(request: LayerTransitionRequest): LayerApplication {
      const result = binding.applyEraTransition(request, binding.contextFor(request))
      return { eraId: binding.readTransitionEra(result, request), result }
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Stub and recording adapters                                                */
/* -------------------------------------------------------------------------- */

/** One application a stub adapter recorded. */
export interface StubLayerApplication {
  readonly id: TransitionStageId
  readonly kind: 'era' | 'transition'
  readonly from: EraId
  readonly to: EraId
  /** Blend weight of the request, `1` for an instant application. */
  readonly t: number
  readonly reducedMotion: boolean
}

/** Options of {@link createStubLayerAdapter}. */
export interface StubLayerAdapterOptions {
  readonly id: TransitionStageId
  readonly label?: string
  /**
   * Called after every application.
   *
   * The harness uses it to prove camera continuity: one stub layer deliberately
   * nudges the camera while the director is applying a frame, and the viewer's
   * framing must still be identical afterwards.
   */
  readonly onApply?: (application: StubLayerApplication) => void
}

/** A stub adapter plus everything it recorded, for assertions. */
export interface StubLayerAdapter extends TransitionLayerAdapter {
  /** Every application, in order. */
  readonly applications: readonly StubLayerApplication[]
  /** Era the stub currently reports. */
  readonly eraId: EraId | null
  /** Last blend weight it was handed. */
  readonly progress: number
  /** Clears the record without changing the current era. */
  reset(): void
}

/**
 * Creates a deterministic layer stand-in.
 *
 * It applies exactly what the shared layer contract says — `applyEra` for a
 * single step, `applyEraTransition` for a frame — and reports the era it holds
 * the way a real layer does: the exact era once it has landed, `null` while two
 * eras are blended.
 */
export function createStubLayerAdapter(options: StubLayerAdapterOptions): StubLayerAdapter {
  const applications: StubLayerApplication[] = []
  let eraId: EraId | null = null
  let progress = 0

  function record(application: StubLayerApplication): LayerApplication {
    applications.push(application)
    eraId = application.kind === 'era' ? application.to : application.t >= 1 ? application.to : null
    progress = application.t
    options.onApply?.(application)
    return { eraId, result: application }
  }

  return {
    id: options.id,
    label: options.label ?? STAGE_LABELS[options.id],
    applyEra(request: LayerEraRequest): LayerApplication {
      return record({
        id: options.id,
        kind: 'era',
        from: request.eraId,
        to: request.eraId,
        t: 1,
        reducedMotion: request.reducedMotion,
      })
    },
    applyEraTransition(request: LayerTransitionRequest): LayerApplication {
      return record({
        id: options.id,
        kind: 'transition',
        from: request.from,
        to: request.to,
        t: request.t,
        reducedMotion: request.reducedMotion,
      })
    },
    get applications(): readonly StubLayerApplication[] {
      return applications
    },
    get eraId(): EraId | null {
      return eraId
    },
    get progress(): number {
      return progress
    },
    reset(): void {
      applications.length = 0
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Audio port                                                                 */
/* -------------------------------------------------------------------------- */

/** The slice of the audio engine the director needs. */
export type AudioEnginePortTarget = Pick<AudioEngine, 'crossfadeBeds' | 'playOneShot'>

/**
 * One-shot id used when an era cue id is not in the audio library's catalogue.
 *
 * Era registries name their cues after the period ("tram-bell", "diner jukebox"),
 * while the library ships a fixed set of synthesised patches. Cues whose id the
 * catalogue already knows are played as written; the rest fall back to the patch
 * that matches the cue's own layer, and cues of a purely bed-like layer (music,
 * weather) are left to the crossfade.
 */
export const CUE_LAYER_FALLBACK: Readonly<Partial<Record<string, OneShotId>>> = Object.freeze({
  ambience: 'birds',
  engine: 'engine',
  human: 'crowd-cheer',
  machine: 'jackhammer',
  signature: 'horn',
})

/** Resolves the one-shot patch an era cue plays through, or null for none. */
export function resolveCueOneShotId(cue: EraSoundscapeCue): OneShotId | null {
  return resolveOneShotId(cue.id) ?? CUE_LAYER_FALLBACK[cue.layer] ?? null
}

/**
 * Translates an era soundscape into the ambience-bed descriptor the audio engine
 * renders.
 *
 * The bed keeps the era's identity in its `id` (the registry's soundscape
 * descriptor, so the engine's `currentBed` reads `1945-home-front`), its level in
 * the ambience gain, and its character in one layer per looping cue: weather and
 * ambience cues become filtered noise, machinery and traffic become low
 * oscillators, and music and human beds become softer mid oscillators. The
 * mapping is data-driven and deterministic — every field comes from the era
 * record plus its tempo, so two runs and two machines build the same bed, and the
 * result passes the audio module's own descriptor validation.
 */
export function soundscapeToBedDescriptor(soundscape: EraSoundscape): SoundscapeDescriptor {
  const tempo = Number.isFinite(soundscape.tempoBpm) ? soundscape.tempoBpm : 80
  const layers: AmbienceLayerDescriptor[] = [
    {
      type: 'noise',
      color: 'brown',
      level: clamp01(soundscape.ambienceGain || 0.5) * 1.2,
      filter: { type: 'lowpass', frequency: 180 + clamp01(soundscape.ambienceGain) * 640, q: 0.7 },
    },
  ]

  for (const cue of soundscape.cues) {
    if (!cue.loop) {
      continue
    }
    const level = clamp01(cue.gain) * 1.4
    switch (cue.layer) {
      case 'weather':
        layers.push({
          type: 'noise',
          color: 'white',
          level: level * 0.6,
          filter: { type: 'bandpass', frequency: 1200 + tempo * 12, q: 0.8 },
        })
        break
      case 'ambience':
        layers.push({
          type: 'noise',
          color: 'pink',
          level,
          filter: { type: 'lowpass', frequency: 420 + tempo * 8, q: 0.6 },
        })
        break
      case 'engine':
      case 'machine':
        layers.push({
          type: 'oscillator',
          waveform: 'sawtooth',
          frequency: 36 + tempo * 0.5,
          detune: cue.layer === 'machine' ? -18 : 12,
          level: level * 0.5,
          vibrato: { rate: Math.max(0.05, tempo / 240), depth: 14 },
        })
        break
      case 'music':
      case 'human':
      case 'signature':
      default:
        layers.push({
          type: 'oscillator',
          waveform: cue.layer === 'music' ? 'triangle' : 'sine',
          frequency: 132 + tempo * 2,
          level: level * 0.4,
          vibrato: { rate: Math.max(0.05, tempo / 180), depth: cue.layer === 'music' ? 8 : 4 },
        })
        break
    }
  }

  return {
    id: soundscape.descriptor,
    name: soundscape.label,
    gain: 1,
    layers,
    filter: { type: 'lowpass', frequency: 6000 + tempo * 20, q: 0.5 },
  }
}

/** Options of {@link createAudioEnginePort}. */
export interface AudioEnginePortOptions {
  /** Pan/rate shaping applied to every cue; defaults to a centred, natural rate. */
  readonly cueOptions?: OneShotOptions
  /** Set false to fire cue ids exactly as the registry spells them. */
  readonly resolveCueIds?: boolean
}

/**
 * Binds the real audio engine to the director's audio port.
 *
 * One call per switch reaches `crossfadeBeds` (with the era's translated
 * descriptor) and one per era cue reaches `playOneShot`; the director never sees
 * a WebAudio node.
 */
export function createAudioEnginePort(
  engine: AudioEnginePortTarget,
  options: AudioEnginePortOptions = {},
): TransitionAudioPort {
  const resolveCueIds = options.resolveCueIds ?? true
  return {
    crossfadeToSoundscape(request: TransitionCrossfadeRequest): void {
      engine.crossfadeBeds(soundscapeToBedDescriptor(request.soundscape), request.seconds)
    },
    playCue(request: TransitionCueRequest): void {
      const id = resolveCueIds ? resolveCueOneShotId(request.cue) : request.cue.id
      if (id === null) {
        return
      }
      engine.playOneShot(id, {
        ...options.cueOptions,
        gain: request.gain,
        delaySeconds: request.delaySeconds,
      })
    },
  }
}

/** An audio port that records what the director asked for. */
export interface RecordingAudioPort extends TransitionAudioPort {
  readonly crossfades: readonly TransitionCrossfadeRequest[]
  readonly cues: readonly TransitionCueRequest[]
  /** Bed ids handed to the engine, in order. */
  readonly bedIds: readonly string[]
  /** Cue ids handed to the engine, in order. */
  readonly cueIds: readonly string[]
  reset(): void
}

/**
 * Creates a recording audio port.
 *
 * Used by the harness (which must not mount a real `AudioContext`) and by tests
 * that assert "one crossfade plus era cue SFX per switch" without a browser
 * audio stack.
 */
export function createRecordingAudioPort(): RecordingAudioPort {
  const crossfades: TransitionCrossfadeRequest[] = []
  const cues: TransitionCueRequest[] = []
  const bedIds: string[] = []
  const cueIds: string[] = []
  return {
    crossfadeToSoundscape(request: TransitionCrossfadeRequest): void {
      crossfades.push(request)
      bedIds.push(request.soundscape.descriptor)
    },
    playCue(request: TransitionCueRequest): void {
      cues.push(request)
      cueIds.push(request.cue.id)
    },
    get crossfades(): readonly TransitionCrossfadeRequest[] {
      return crossfades
    },
    get cues(): readonly TransitionCueRequest[] {
      return cues
    },
    get bedIds(): readonly string[] {
      return bedIds
    },
    get cueIds(): readonly string[] {
      return cueIds
    },
    reset(): void {
      crossfades.length = 0
      cues.length = 0
      bedIds.length = 0
      cueIds.length = 0
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Camera port                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Opening viewpoint of the harness's camera stand-in.
 *
 * Declared here as plain data so this module never imports the pipeline's
 * three.js-backed controls just to build a stub; the real port binds whatever
 * camera the pipeline owns.
 */
export const STUB_CAMERA_STATE: CameraState = {
  mode: 'orbit',
  target: [0, 4, 0],
  orbit: { azimuth: Math.PI * 0.25, polar: 1.05, radius: 46 },
  street: { position: [0, 1.75, 26], heading: 0, pitch: 0 },
  fov: 46,
  near: 0.1,
  far: 400,
}

/** Binds the pipeline's navigation controls to the director's camera port. */
export function createNavigationCameraPort(controls: NavigationControls): TransitionCameraPort {
  return {
    capture(): CameraState {
      return controls.getState()
    },
    restore(state: CameraState): void {
      controls.setState(state)
    },
  }
}

/** A camera port a harness can read, trample and inspect. */
export interface RecordingCameraPort extends TransitionCameraPort {
  /** Live state the port reports. */
  readonly state: CameraState
  /** Replaces the live state wholesale (a layer moving the camera). */
  set(state: CameraState): void
  /** Nudges azimuth/polar by a small amount; returns the new live state. */
  nudge(amount?: number): CameraState
  /** How many times the director read the state. */
  readonly captures: number
  /** How many times the director wrote a state back. */
  readonly restores: number
  /** How many times anything moved the camera. */
  readonly mutations: number
  reset(): void
}

/**
 * Creates a recording camera stand-in.
 *
 * `nudge` is what a misbehaving layer calls: the director must undo it and count
 * the rescue, which is how the browser proof shows the viewer's framing is
 * preserved across a switch.
 */
export function createRecordingCameraPort(
  initial: CameraState = STUB_CAMERA_STATE,
): RecordingCameraPort {
  let state: CameraState = cloneCameraState(initial)
  let captures = 0
  let restores = 0
  let mutations = 0
  return {
    capture(): CameraState {
      captures += 1
      return cloneCameraState(state)
    },
    restore(next: CameraState): void {
      restores += 1
      state = cloneCameraState(next)
    },
    get state(): CameraState {
      return state
    },
    set(next: CameraState): void {
      mutations += 1
      state = cloneCameraState(next)
    },
    nudge(amount = 0.15): CameraState {
      mutations += 1
      state = {
        ...state,
        orbit: { ...state.orbit, azimuth: state.orbit.azimuth + amount },
      }
      return state
    },
    get captures(): number {
      return captures
    },
    get restores(): number {
      return restores
    },
    get mutations(): number {
      return mutations
    },
    reset(): void {
      captures = 0
      restores = 0
      mutations = 0
      state = cloneCameraState(initial)
    },
  }
}

function cloneCameraState(state: CameraState): CameraState {
  return {
    mode: state.mode,
    target: [state.target[0], state.target[1], state.target[2]],
    orbit: { azimuth: state.orbit.azimuth, polar: state.orbit.polar, radius: state.orbit.radius },
    street: {
      position: [state.street.position[0], state.street.position[1], state.street.position[2]],
      heading: state.street.heading,
      pitch: state.street.pitch,
    },
    fov: state.fov,
    near: state.near,
    far: state.far,
  }
}

/* -------------------------------------------------------------------------- */
/* Motion port                                                                */
/* -------------------------------------------------------------------------- */

/** A motion port a harness can flip while the page is running. */
export interface MutableMotionPort extends TransitionMotionPort {
  /** Sets the preference for the next switch. */
  set(reducedMotion: boolean): void
  /** Current value. */
  readonly reducedMotion: boolean
}

/** Creates a fixed motion port; the harness flips it to prove the instant path. */
export function createFixedMotionPort(reducedMotion = false): MutableMotionPort {
  let value = reducedMotion === true
  return {
    isReducedMotion(): boolean {
      return value
    },
    set(next: boolean): void {
      value = next === true
    },
    get reducedMotion(): boolean {
      return value
    },
  }
}

/**
 * Reads the viewer's reduced-motion preference from the ui-controls store.
 *
 * The store owns the intent (`'system' | 'reduce' | 'no-preference'`); the
 * system query is resolved here, so the director only ever asks "should this
 * switch be instant?".
 */
export function createUIControlsMotionPort(store: UIControlsStore): TransitionMotionPort {
  return {
    isReducedMotion(): boolean {
      return resolveReducedMotion(selectMotionPreference(store.getState()), systemPrefersReducedMotion())
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Scene layer adapters                                                       */
/* -------------------------------------------------------------------------- */

/** What the director read back from each shipped layer, for assertions. */
export interface SceneLayerReadings {
  atmosphere: VfxSnapshot | null
  buildings: BuildingPlan | null
  storefronts: StorefrontPlan | null
  props: PropsLayerPlan | null
  vehicles: EraVehiclePlan | null
  pedestrians: PedestrianPlan | null
}

/** Options of {@link createSceneLayerAdapters}. */
export interface SceneLayerAdaptersOptions {
  /** The real block every content layer generates against. */
  readonly layout: BlockLayout
  /** The atmosphere target: the render pipeline, or a structural stand-in. */
  readonly atmosphere: VfxTarget
  /** Shared quality tier; the layers scale their detail with it. */
  readonly qualityTier?: QualityTierName
  /** Overrides the era's own night state. */
  readonly night?: boolean
  /** Overrides the block seed for content generation. */
  readonly seed?: string | number
  /** Adapters for stages shipped outside this wiring (e.g. later barrels). */
  readonly extraLayers?: readonly TransitionLayerAdapter[]
}

/** The wired layer set plus everything the host needs to inspect and dispose it. */
export interface SceneLayerAdapters {
  /** Adapters in documented stage order. */
  readonly adapters: readonly TransitionLayerAdapter[]
  /** Stages with an adapter. */
  readonly wired: readonly TransitionStageId[]
  /** Scheduled stages still waiting for a shipped barrel. */
  readonly pending: readonly TransitionStageId[]
  /** Live results of each layer, updated as the director drives them. */
  readonly readings: SceneLayerReadings
  /** The props runtime the adapter drives; the host adds its root to the world. */
  readonly propsRuntime: PropsRuntime
  /** Releases the props runtime's geometry and meshes. */
  dispose(): void
}

/**
 * Wires the shipped scene layers to the director.
 *
 * The barrels are imported dynamically so the director's lean consumers (the
 * harness page, the unit suite) never load three.js. Each layer keeps its own
 * contract: the atmosphere is written through the pipeline's public parameter
 * surface, the storefronts, props and vehicles layers are generated against the
 * real block, and the props layer is driven through the runtime the barrel
 * exports.
 */
export async function createSceneLayerAdapters(
  options: SceneLayerAdaptersOptions,
): Promise<SceneLayerAdapters> {
  const [atmosphere, buildings, storefronts, props, vehicles, pedestrians] = await Promise.all([
    import('../vfx'),
    import('../city/buildings'),
    import('../city/storefronts'),
    import('../city/props'),
    import('../city/vehicles'),
    import('../city/pedestrians'),
  ])

  const { layout, qualityTier, night, seed } = options
  const readings: SceneLayerReadings = {
    atmosphere: null,
    buildings: null,
    storefronts: null,
    props: null,
    vehicles: null,
    pedestrians: null,
  }

  const propsRuntime = props.createPropsRuntime(layout, { qualityTier, night, seed })
  const vehicleTarget = {
    applyPlan(plan: EraVehiclePlan): void {
      readings.vehicles = plan
    },
  }

  const adapters: TransitionLayerAdapter[] = [
    bindLayerAdapter({
      id: 'atmosphere',
      contextFor: ({ reducedMotion }) => ({
        target: options.atmosphere,
        qualityTier,
        seed,
        reducedMotion,
      }),
      applyEra: (eraId, context) => atmosphere.applyEra(eraId, context),
      applyEraTransition: (request, context) => atmosphere.applyEraTransition(request, context),
      readEra: (snapshot: VfxSnapshot) => {
        readings.atmosphere = snapshot
        return snapshot.eraId
      },
      readTransitionEra: (snapshot: VfxSnapshot) => {
        readings.atmosphere = snapshot
        return snapshot.eraId
      },
    }),
    bindLayerAdapter({
      id: 'buildings',
      contextFor: ({ reducedMotion }) => ({ layout, qualityTier, night, seed, reducedMotion }),
      applyEra: (eraId, context) => buildings.applyEra(eraId, context),
      applyEraTransition: (request, context) => buildings.applyEraTransition(request, context),
      readEra: (plan: BuildingPlan) => {
        readings.buildings = plan
        return plan.eraId
      },
      readTransitionEra: (frame: BuildingTransitionPlan) => {
        readings.buildings = frame.plan
        return frame.resolvedEra
      },
    }),
    bindLayerAdapter({
      id: 'storefronts',
      contextFor: ({ reducedMotion }) => ({ layout, qualityTier, night, seed, reducedMotion }),
      applyEra: (eraId, context) => storefronts.applyEra(eraId, context),
      applyEraTransition: (request, context) => storefronts.applyEraTransition(request, context),
      readEra: (plan: StorefrontPlan) => {
        readings.storefronts = plan
        return plan.eraId
      },
      readTransitionEra: (transitionPlan) => {
        readings.storefronts = transitionPlan.plan
        return transitionPlan.resolvedEra
      },
    }),
    bindLayerAdapter({
      id: 'props',
      contextFor: ({ reducedMotion }) => ({ runtime: propsRuntime, night, reducedMotion }),
      applyEra: (eraId, context) => props.applyEra(eraId, context),
      applyEraTransition: (request, context) => props.applyEraTransition(request, context),
      readEra: (plan: PropsLayerPlan) => {
        readings.props = plan
        return plan.eraId
      },
      readTransitionEra: (frame) => {
        readings.props = frame.toPlan
        return propsRuntime.eraId
      },
    }),
    bindLayerAdapter({
      id: 'vehicles',
      contextFor: ({ reducedMotion }) => ({
        layout,
        quality: qualityTier,
        seed,
        reducedMotion,
        target: vehicleTarget,
      }),
      applyEra: (eraId, context) => vehicles.applyEra(eraId, context),
      applyEraTransition: (request, context) => vehicles.applyEraTransition(request, context),
      readEra: (plan: EraVehiclePlan) => plan.eraId,
      readTransitionEra: (plan: EraVehiclePlan) => plan.eraId,
    }),
    bindLayerAdapter({
      id: 'pedestrians',
      contextFor: ({ reducedMotion }) => ({ layout, qualityTier, night, seed, reducedMotion }),
      applyEra: (eraId, context) => pedestrians.applyEra(eraId, context),
      applyEraTransition: (request, context) => pedestrians.applyEraTransition(request, context),
      readEra: (plan: PedestrianPlan) => {
        readings.pedestrians = plan
        return plan.eraId
      },
      readTransitionEra: (frame: PedestrianTransitionPlan) => {
        readings.pedestrians = frame.plan
        return frame.resolvedEra
      },
    }),
    ...(options.extraLayers ?? []),
  ]

  const wired = adapters.map((adapter) => adapter.id)
  const pending = PENDING_LAYER_STAGES.filter((id) => !wired.includes(id))

  return {
    adapters,
    wired,
    pending,
    readings,
    propsRuntime,
    dispose(): void {
      propsRuntime.dispose()
    },
  }
}
