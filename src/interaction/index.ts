/**
 * The interaction layer: viewpoints, inspection, tour, shortcuts, adaptive
 * quality — one controller the four extension modules share.
 *
 * Why a controller and not four independent extensions
 * ---------------------------------------------------
 * The features are not independent. A click must stop the tour *before* it
 * picks; a viewpoint change must not fight a focus tween; adaptive quality must
 * respect the manual tier the overlay buttons set. Those are orderings, and
 * orderings belong in one place. The four modules in `extensions/` are therefore
 * thin: each mounts a DOM surface, registers itself as a feature and calls the
 * controller. {@link getInteractionController} memoises one controller per
 * composition, so mounting four extensions (or remounting them under React's
 * strict mode) creates exactly one frame hook and one debug surface.
 *
 * How motion works
 * ----------------
 * The controller owns one {@link CameraMotionKind} at a time and writes it
 * through the render pipeline's camera API once per frame. A viewpoint change, a
 * focus, a release and the tour's entry/exit all reduce to one monotonic
 * {@link createCameraTween}, so the camera is never simultaneously driven by two
 * authors. Nothing here writes the camera on an era change — the composition's
 * transition director owns that moment and the interaction layer has no era
 * subscription at all, which is what "camera state survives era switches" means
 * in practice.
 *
 * The debug surface
 * -----------------
 * In a development build the controller publishes
 * `window.__cityTimelapseInteraction` with `read()`/`subscribe()`, giving the
 * browser suite a machine-readable view of the features that registered, the
 * resolved viewpoints, the tour, the focused card, the pick probes for each
 * category and the adaptive-quality state. A production bundle never creates the
 * global.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneComposition } from '../app'
import type { SceneExtension } from '../app/extensionSlots'
import type { InspectionCategory, InspectionTarget, InspectionTargets } from '../app/inspectionTargets'
import { getNextEra, getPreviousEra } from '../era'
import type { EraId } from '../era'
import { QUALITY_TIER_NAMES } from '../lib/quality'
import type { QualityTierName } from '../lib/quality'
import type { CameraBounds, CameraMode, CameraState, RenderPipeline } from '../scene'
import type { EraStore } from '../state/eraStore'
import type { UIControlsStore } from '../ui/uiStore'
import { selectQualityManualOverride, selectRequestedQualityTier, subscribeToQualityIntent } from '../ui/uiStore'
import { createInspector, focusableTargets } from './inspector'
import type {
  Inspector,
  InspectorCardModel,
  InspectorFocus,
  PickProbe,
  PickProbeOptions,
  ViewportSize,
} from './inspector'
import { ADAPTIVE_COOLDOWN_FRAMES, createAdaptiveQualityState, stepAdaptiveQuality } from './qualityAuto'
import type {
  AdaptiveQualityNotice,
  AdaptiveQualityReason,
  AdaptiveQualityState,
} from './qualityAuto'
import { INTERACTION_SHORTCUTS, cameraModeForAction, matchShortcut, viewpointForAction } from './shortcuts'
import type { ShortcutEntry, ShortcutKeyEvent } from './shortcuts'
import { buildTourPlan, createCinematicTour } from './tour'
import type { CinematicTour, TourPlan } from './tour'
import {
  VIEWPOINT_DEFINITIONS,
  createCameraTween,
  isViewpointId,
  resolveViewpoint,
  resolveViewpoints,
} from './viewpoints'
import type { ViewpointFraming, ViewpointId } from './viewpoints'

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Shape version of the debug surface, so a stale reader is recognisable. */
export const INTERACTION_SURFACE_VERSION = 1

/** Feature ids the extensions register; the browser suite asserts all four. */
export const INTERACTION_FEATURES = ['viewpoints', 'inspection', 'tour', 'quality'] as const

export type InteractionFeatureId = (typeof INTERACTION_FEATURES)[number]

/** True in a development build; the surface and its global are dev-only. */
export const INTERACTION_DEV_BUILD: boolean = import.meta.env.DEV === true

/** Global a dev build publishes the interaction surface under (empty in prod). */
export const INTERACTION_DEBUG_KEY: string = INTERACTION_DEV_BUILD
  ? '__cityTimelapseInteraction'
  : ''

/** Seconds a viewpoint move takes. */
export const VIEWPOINT_MOTION_SECONDS = 1.1

/** Seconds a focus or release move takes. */
export const FOCUS_MOTION_SECONDS = 0.75

/** Seconds the tour takes to slide in from the viewer's camera and back out. */
export const TOUR_ENTRY_SECONDS = 1.2
export const TOUR_EXIT_SECONDS = 0.9

/** Seconds an adaptive-quality notice stays on screen. */
export const QUALITY_NOTICE_SECONDS = 8

/** Seconds a pointer gesture that dismissed the tour cannot pick. */
export const TOUR_DISMISS_SUPPRESSION_SECONDS = 0.35

/** Who is driving the camera right now. */
export type CameraMotionKind =
  | 'idle'
  | 'viewpoint'
  | 'focus'
  | 'release'
  | 'tour-enter'
  | 'tour-exit'

/* -------------------------------------------------------------------------- */
/* Snapshot vocabulary                                                        */
/* -------------------------------------------------------------------------- */

export interface InteractionTourState {
  readonly active: boolean
  readonly available: boolean
  readonly routeName: string | null
  readonly stationCount: number
  readonly distance: number
  readonly progress: number
  readonly stationId: string | null
  readonly stationLabel: string | null
  readonly stationCategory: InspectionCategory | null
  readonly laps: number
  /** True while the camera is sliding in or out of the tour. */
  readonly transitioning: boolean
  /** Camera the tour restores when it stops. */
  readonly previousCamera: CameraState | null
}

export interface InteractionInspectorState {
  readonly focusedId: string | null
  readonly focusedCategory: InspectionCategory | null
  readonly focusedLayerId: string | null
  readonly focusedLabel: string | null
  readonly card: InspectorCardModel | null
  readonly previousCamera: CameraState | null
}

export interface InteractionQualityState {
  readonly tier: QualityTierName
  readonly manualOverride: boolean
  readonly suspended: boolean
  readonly samples: number
  readonly changes: number
  readonly lastReason: AdaptiveQualityReason
  readonly notices: readonly AdaptiveQualityNotice[]
}

/** The interaction layer's own state, as the UI and the browser suite read it. */
export interface InteractionSnapshot {
  readonly version: number
  readonly features: readonly string[]
  readonly eraId: EraId
  readonly qualityTier: QualityTierName
  readonly camera: CameraState
  readonly bounds: CameraBounds
  readonly cameraMotion: { readonly kind: CameraMotionKind; readonly progress: number } | null
  readonly viewpoints: readonly ViewpointFraming[]
  readonly activeViewpoint: ViewpointId | null
  readonly viewpointCamera: CameraState | null
  readonly tour: InteractionTourState
  readonly inspector: InteractionInspectorState
  readonly quality: InteractionQualityState
  readonly shortcuts: readonly ShortcutEntry[]
}

/** Snapshot extended with the frame counters the browser suite reads. */
export interface InteractionDebugSnapshot extends InteractionSnapshot {
  readonly frame: number
  readonly averageFrameTimeMs: number
  readonly viewport: ViewportSize
}

/**
 * The handle published on `window` by a dev build.
 *
 * Probing every category is far more expensive than reading the state, so the
 * pick probes are a separate call: a poller reads `read()` cheaply and asks for
 * `probes()` only when it is about to click.
 */
export interface InteractionSurfaceHandle {
  readonly version: number
  readonly enabled: boolean
  read(): InteractionDebugSnapshot
  probes(options?: PickProbeOptions): readonly PickProbe[]
  subscribe(listener: (snapshot: InteractionDebugSnapshot) => void): () => void
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                 */
/* -------------------------------------------------------------------------- */

export interface InteractionControllerOptions {
  readonly pipeline: RenderPipeline
  readonly composition: SceneComposition
  readonly uiStore?: UIControlsStore
  readonly eraStore?: EraStore
  readonly maxPickDistance?: number
}

export interface InteractionController {
  readonly pipeline: RenderPipeline
  readonly composition: SceneComposition
  /** Adds one extension's claim on the frame hook and the debug surface. */
  retain(): void
  release(): void
  registerFeature(id: InteractionFeatureId): void
  unregisterFeature(id: InteractionFeatureId): void
  features(): readonly string[]
  subscribe(listener: () => void): () => void
  /** True while at least one consumer wants frame ticks. */
  readonly attached: boolean

  /* Viewpoints */
  viewpointFramings(): readonly ViewpointFraming[]
  cameraBounds(): CameraBounds
  applyViewpoint(id: ViewpointId): ViewpointFraming | null
  activeViewpoint(): ViewpointId | null
  viewpointCamera(): CameraState | null
  setCameraMode(mode: CameraMode): void

  /* Tour */
  startTour(): boolean
  stopTour(reason?: string): void
  tourActive(): boolean
  tourPlan(): TourPlan | null

  /* Inspection */
  focusable(): readonly InspectionTarget[]
  pickAtNdc(ndc: readonly [number, number]): InspectorFocus | null
  pickAtPoint(clientX: number, clientY: number): InspectorFocus | null
  focusTarget(targetId: string): InspectorFocus | null
  releaseFocus(): CameraState | null
  inspectorCard(): InspectorCardModel | null
  probes(options?: PickProbeOptions): readonly PickProbe[]

  /* Input and quality */
  handleKeyEvent(event: ShortcutKeyEvent): boolean
  notifyUserInput(kind: 'pointer' | 'key' | 'wheel'): void
  qualityState(): AdaptiveQualityState
  /** Advances one frame's worth of motion, tour and adaptive quality. */
  tick(deltaSeconds: number): void

  getSnapshot(): InteractionSnapshot
  readDebug(): InteractionDebugSnapshot
  dispose(): void
}

/** How long one kind of motion lasts. */
function motionSeconds(kind: CameraMotionKind): number {
  switch (kind) {
    case 'viewpoint':
      return VIEWPOINT_MOTION_SECONDS
    case 'focus':
    case 'release':
      return FOCUS_MOTION_SECONDS
    case 'tour-enter':
      return TOUR_ENTRY_SECONDS
    case 'tour-exit':
      return TOUR_EXIT_SECONDS
    case 'idle':
      return 0
  }
}

type Notices = readonly { notice: AdaptiveQualityNotice; expiresAtSeconds: number }[]

/** Creates the interaction controller over a live pipeline and composition. */
export function createInteractionController(
  options: InteractionControllerOptions,
): InteractionController {
  const pipeline = options.pipeline
  const composition = options.composition
  const uiStore = options.uiStore ?? composition.uiStore
  const bounds = pipeline.controls.bounds

  let retainCount = 0
  let detachFrame: (() => void) | null = null
  let detachSurface: (() => void) | null = null
  let disposed = false
  let clock = 0

  const listeners = new Set<() => void>()
  const features = new Set<InteractionFeatureId>()

  let surface: InspectionTargets | null = null
  let targets: readonly InspectionTarget[] = []
  let tourPlanCache: TourPlan | null = null
  let tour: CinematicTour | null = null
  let tourRunning = false
  let tourEntryPending = false
  let tourRestore: CameraState | null = null
  let motion: { kind: CameraMotionKind; tween: ReturnType<typeof createCameraTween> } | null = null
  let activeViewpoint: ViewpointId | null = null
  let viewpointCamera: CameraState | null = null
  let suppressPickUntil = 0
  let lastStationId: string | null = null
  let quality: AdaptiveQualityState = createAdaptiveQualityState(
    selectRequestedQualityTier(uiStore.getState()),
  )
  let notices: Notices = []

  /* ------------------------------------------------------------------------ */
  /* Small helpers                                                            */
  /* ------------------------------------------------------------------------ */

  function viewportSize(): ViewportSize {
    const canvas = pipeline.canvas
    const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null
    const width = rect?.width || canvas.clientWidth || canvas.width || 1
    const height = rect?.height || canvas.clientHeight || canvas.height || 1
    return { width, height }
  }

  /** Refreshes the focusable list whenever the composition republishes it. */
  function currentTargets(): readonly InspectionTarget[] {
    const latest = composition.getInspectionTargets()
    if (surface !== latest) {
      surface = latest
      targets = focusableTargets(latest, composition.layout)
      tourPlanCache = null
      tour = null
      tourRunning = false
      tourEntryPending = false
    }
    return targets
  }

  function writeCamera(state: CameraState): void {
    pipeline.setCameraState(state)
  }

  function startMotion(kind: CameraMotionKind, to: CameraState): void {
    const from = pipeline.getCameraState()
    motion = {
      kind,
      tween: createCameraTween(from, to, { durationSeconds: motionSeconds(kind), bounds, kind }),
    }
  }

  function requireTour(): CinematicTour | null {
    if (tour !== null) {
      return tour
    }
    const plan = tourPlanCache ?? buildTourPlan({ layout: composition.layout, targets: currentTargets() })
    if (plan === null) {
      return null
    }
    tourPlanCache = plan
    tour = createCinematicTour(plan, { bounds, current: pipeline.getCameraState() })
    return tour
  }

  function stopTour(_reason = 'stop'): void {
    const wasRunning = tourRunning || tour !== null
    tour?.stop()
    tourRunning = false
    tourEntryPending = false
    if (wasRunning && tourRestore !== null) {
      startMotion('tour-exit', tourRestore)
    }
    emit()
  }

  function startTour(): boolean {
    const running = requireTour()
    if (running === null || tourRunning) {
      return false
    }
    tourRestore = pipeline.getCameraState()
    running.start()
    tourRunning = true
    tourEntryPending = true
    lastStationId = null
    startMotion('tour-enter', running.sampleAt(0).camera)
    emit()
    return true
  }

  function applyViewpoint(id: ViewpointId): ViewpointFraming | null {
    const framing = resolveViewpoint(id, {
      layout: composition.layout,
      targets: currentTargets(),
      bounds,
      current: pipeline.getCameraState(),
    })
    if (framing === null) {
      return null
    }
    if (tourRunning) {
      tour?.stop()
      tourRunning = false
      tourEntryPending = false
      tourRestore = null
    }
    activeViewpoint = id
    viewpointCamera = framing.camera
    startMotion('viewpoint', framing.camera)
    emit()
    return framing
  }

  function releaseFocus(): CameraState | null {
    const restore = inspector.release()
    if (restore === null) {
      return null
    }
    startMotion('release', restore)
    emit()
    return restore
  }

  function enterFocus(focus: InspectorFocus | null): InspectorFocus | null {
    if (focus === null) {
      releaseFocus()
      return null
    }
    activeViewpoint = null
    viewpointCamera = null
    startMotion('focus', focus.camera)
    emit()
    return focus
  }

  function advanceQuality(): void {
    const state = uiStore.getState()
    const requested = selectRequestedQualityTier(state)
    if (requested !== quality.tier) {
      // The viewer (or a deep link) changed the tier: restart the controller's
      // window so it never acts on evidence gathered for another tier.
      quality = {
        ...quality,
        tier: requested,
        framesSinceChange: ADAPTIVE_COOLDOWN_FRAMES,
        overBudgetStreak: 0,
        headroomStreak: 0,
        lastReason: 'holding',
        suspended: false,
      }
    }
    const previousSuspended = quality.suspended
    const step = stepAdaptiveQuality(
      quality,
      {
        frameTimeMs: pipeline.instrumentation.stats.averageFrameTimeMs,
        manualOverride: selectQualityManualOverride(state),
      },
      { noticeId: `adaptive:${quality.changes + 1}:${Math.round(clock * 1000)}` },
    )
    quality = step.state
    if (step.notice !== null) {
      notices = [
        ...notices.slice(-2),
        { notice: step.notice, expiresAtSeconds: clock + QUALITY_NOTICE_SECONDS },
      ]
      // The ui-controls store is the single source of truth for quality: writing
      // the tier there lets the composition's own intent subscription reconfigure
      // the renderer, and it is a no-op if the viewer has since taken over.
      uiStore.getState().applyAdaptiveQualityTier(step.notice.to)
      emit()
    } else if (quality.suspended !== previousSuspended) {
      // Suspending and resuming are discrete state changes a panel must show.
      emit()
    }
    const live = notices.filter((entry) => entry.expiresAtSeconds > clock)
    if (live.length !== notices.length) {
      notices = live
      emit()
    }
  }

  function tick(deltaSeconds: number): void {
    if (disposed) {
      return
    }
    const dt = Math.max(0, Math.min(deltaSeconds, 0.25))
    clock += dt
    advanceQuality()

    if (motion !== null) {
      const sample = motion.tween.advance(dt)
      writeCamera(sample)
      if (motion.tween.done) {
        const finished = motion.kind
        motion = null
        if (finished === 'tour-enter') {
          tourEntryPending = false
        }
        if (finished === 'tour-exit') {
          tourRestore = null
        }
        emit()
      }
      return
    }

    if (tourRunning && !tourEntryPending && tour !== null) {
      const sample = tour.advance(dt)
      writeCamera(sample.camera)
      if (sample.stationId !== lastStationId) {
        lastStationId = sample.stationId
        emit()
      }
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Snapshot pieces                                                          */
  /* ------------------------------------------------------------------------ */

  function featureList(): readonly string[] {
    return [...features].sort()
  }

  function framingList(): readonly ViewpointFraming[] {
    return resolveViewpoints({
      layout: composition.layout,
      targets: currentTargets(),
      bounds,
      current: pipeline.getCameraState(),
    })
  }

  function tourState(): InteractionTourState {
    // Resolving the plan here keeps "is a tour available?" honest before the
    // viewer starts one, and caches it for every later read.
    requireTour()
    const plan = tourPlanCache
    const running = tour
    const sample = running === null ? null : running.sampleAt(running.distance)
    return {
      active: tourRunning,
      available: plan !== null,
      routeName: plan?.pathName ?? null,
      stationCount: plan?.stations.length ?? 0,
      distance: sample?.distance ?? 0,
      progress: sample?.progress ?? 0,
      stationId: sample?.stationId ?? null,
      stationLabel: sample?.stationLabel ?? null,
      stationCategory: sample?.stationCategory ?? null,
      laps: sample?.laps ?? 0,
      transitioning: tourEntryPending,
      previousCamera: tourRestore,
    }
  }

  function inspectorState(): InteractionInspectorState {
    const target = inspector.focused()
    return {
      focusedId: target?.id ?? null,
      focusedCategory: target?.category ?? null,
      focusedLayerId: target?.layerId ?? null,
      focusedLabel: target?.label ?? null,
      card: inspector.card(composition.currentEraId()),
      previousCamera: inspector.previousCamera(),
    }
  }

  function snapshot(): InteractionSnapshot {
    return {
      version: INTERACTION_SURFACE_VERSION,
      features: featureList(),
      eraId: composition.currentEraId(),
      qualityTier: selectRequestedQualityTier(uiStore.getState()),
      camera: pipeline.getCameraState(),
      bounds,
      cameraMotion: motion === null ? null : { kind: motion.kind, progress: motion.tween.progress },
      viewpoints: framingList(),
      activeViewpoint,
      viewpointCamera,
      tour: tourState(),
      inspector: inspectorState(),
      quality: {
        tier: quality.tier,
        manualOverride: selectQualityManualOverride(uiStore.getState()),
        suspended: quality.suspended,
        samples: quality.samples,
        changes: quality.changes,
        lastReason: quality.lastReason,
        notices: notices.map((entry) => entry.notice),
      },
      shortcuts: INTERACTION_SHORTCUTS,
    }
  }

  function debugSnapshot(): InteractionDebugSnapshot {
    const base = snapshot()
    const stats = pipeline.instrumentation.stats
    return {
      ...base,
      frame: stats.frames,
      averageFrameTimeMs: stats.averageFrameTimeMs,
      viewport: viewportSize(),
    }
  }

  function pickNdc(ndc: readonly [number, number]): InspectorFocus | null {
    if (tourRunning) {
      // "Dismissible by any user input": the click stops the tour, it does not
      // also start an inspection.
      stopTour('pointer')
      return null
    }
    if (clock < suppressPickUntil) {
      return null
    }
    return enterFocus(inspector.pick(ndc))
  }

  function emit(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  const inspector: Inspector = createInspector({
    getTargets: () => currentTargets(),
    getCamera: () => pipeline.camera,
    getViewport: () => viewportSize(),
    getCameraState: () => pipeline.getCameraState(),
    bounds,
    ...(options.maxPickDistance === undefined ? {} : { maxPickDistance: options.maxPickDistance }),
  })

  // The viewer can change quality from the overlay (or by clearing the manual
  // override), which is outside this controller: follow the store so the panels
  // and the snapshot never describe a tier the pipeline is no longer using.
  const unsubscribeQualityIntent = subscribeToQualityIntent(uiStore, () => {
    emit()
  })

  function handleKey(action: NonNullable<ReturnType<typeof matchShortcut>>): void {
    if (tourRunning && action !== 'tour.toggle') {
      stopTour('key')
    }
    switch (action) {
      case 'camera.orbit':
      case 'camera.street': {
        const mode = cameraModeForAction(action)
        if (mode !== null) {
          pipeline.setCameraMode(mode)
        }
        break
      }
      case 'tour.toggle':
        if (tourRunning) {
          stopTour('toggle')
        } else {
          startTour()
        }
        break
      case 'inspection.close':
        if (releaseFocus() === null) {
          activeViewpoint = null
          viewpointCamera = null
          emit()
        }
        break
      case 'era.previous': {
        const previous = getPreviousEra(composition.currentEraId())
        if (previous !== undefined) {
          composition.selectEra(previous.id)
        }
        break
      }
      case 'era.next': {
        const next = getNextEra(composition.currentEraId())
        if (next !== undefined) {
          composition.selectEra(next.id)
        }
        break
      }
      case 'quality.cycle': {
        const state = uiStore.getState()
        const current = selectRequestedQualityTier(state)
        const index = QUALITY_TIER_NAMES.indexOf(current)
        const nextTier = QUALITY_TIER_NAMES[(index + 1) % QUALITY_TIER_NAMES.length] ?? current
        state.requestQualityTier(nextTier)
        emit()
        break
      }
      case 'audio.mute':
        uiStore.getState().toggleAudioMute()
        emit()
        break
      default: {
        const id = viewpointForAction(action)
        if (id !== null && isViewpointId(id)) {
          applyViewpoint(id)
        }
        break
      }
    }
  }

  function installSurface(): void {
    if (!INTERACTION_DEV_BUILD || INTERACTION_DEBUG_KEY.length === 0 || typeof window === 'undefined') {
      return
    }
    const surfaceListeners = new Set<(value: InteractionDebugSnapshot) => void>()
    const unsubscribe = subscribe(() => {
      const value = debugSnapshot()
      for (const listener of surfaceListeners) {
        listener(value)
      }
    })
    const handle: InteractionSurfaceHandle = {
      version: INTERACTION_SURFACE_VERSION,
      enabled: true,
      read: debugSnapshot,
      probes: (probeOptions?: PickProbeOptions): readonly PickProbe[] =>
        inspector.probes(probeOptions ?? {}),
      subscribe(listener: (value: InteractionDebugSnapshot) => void): () => void {
        surfaceListeners.add(listener)
        return () => {
          surfaceListeners.delete(listener)
          if (surfaceListeners.size === 0) {
            unsubscribe()
          }
        }
      },
    }
    const host = window as unknown as Record<string, unknown>
    host[INTERACTION_DEBUG_KEY] = handle
    detachSurface = () => {
      if (host[INTERACTION_DEBUG_KEY] === handle) {
        delete host[INTERACTION_DEBUG_KEY]
      }
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const controller: InteractionController = {
    pipeline,
    composition,
    get attached(): boolean {
      return retainCount > 0
    },
    retain(): void {
      if (disposed) {
        return
      }
      retainCount += 1
      if (retainCount === 1) {
        detachFrame = pipeline.onFrame((_stats, delta) => tick(delta))
        installSurface()
      }
    },
    release(): void {
      retainCount = Math.max(0, retainCount - 1)
      if (retainCount === 0) {
        detachFrame?.()
        detachFrame = null
        detachSurface?.()
        detachSurface = null
      }
    },
    registerFeature(id: InteractionFeatureId): void {
      if (!features.has(id)) {
        features.add(id)
        emit()
      }
    },
    unregisterFeature(id: InteractionFeatureId): void {
      if (features.delete(id)) {
        emit()
      }
    },
    features: featureList,
    subscribe,
    viewpointFramings: framingList,
    cameraBounds(): CameraBounds {
      return bounds
    },
    applyViewpoint,
    activeViewpoint(): ViewpointId | null {
      return activeViewpoint
    },
    viewpointCamera(): CameraState | null {
      return viewpointCamera
    },
    setCameraMode(mode: CameraMode): void {
      pipeline.setCameraMode(mode)
      emit()
    },
    startTour,
    stopTour,
    tourActive(): boolean {
      return tourRunning
    },
    tourPlan(): TourPlan | null {
      requireTour()
      return tourPlanCache
    },
    focusable: currentTargets,
    pickAtNdc: pickNdc,
    pickAtPoint(clientX: number, clientY: number): InspectorFocus | null {
      const canvas = pipeline.canvas
      const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null
      const width = rect?.width || canvas.clientWidth || 1
      const height = rect?.height || canvas.clientHeight || 1
      const left = rect?.left ?? 0
      const top = rect?.top ?? 0
      return pickNdc([((clientX - left) / width) * 2 - 1, -(((clientY - top) / height) * 2 - 1)])
    },
    focusTarget(targetId: string): InspectorFocus | null {
      return enterFocus(inspector.focus(targetId))
    },
    releaseFocus,
    inspectorCard(): InspectorCardModel | null {
      return inspector.card(composition.currentEraId())
    },
    probes(probeOptions: PickProbeOptions = {}): readonly PickProbe[] {
      return inspector.probes(probeOptions)
    },
    handleKeyEvent(event: ShortcutKeyEvent): boolean {
      const action = matchShortcut(event)
      if (action === null) {
        return false
      }
      handleKey(action)
      return true
    },
    notifyUserInput(kind: 'pointer' | 'key' | 'wheel'): void {
      const wasTouring = tourRunning || tourEntryPending
      if (kind === 'pointer' && wasTouring) {
        // The press that dismissed the tour must not also start an inspection
        // when the pointer comes back up.
        suppressPickUntil = clock + TOUR_DISMISS_SUPPRESSION_SECONDS
      }
      if (tourRunning) {
        stopTour(kind)
      }
    },
    qualityState(): AdaptiveQualityState {
      return quality
    },
    tick,
    getSnapshot: snapshot,
    readDebug: debugSnapshot,
    dispose(): void {
      if (disposed) {
        return
      }
      disposed = true
      retainCount = 0
      unsubscribeQualityIntent()
      detachFrame?.()
      detachFrame = null
      detachSurface?.()
      detachSurface = null
      listeners.clear()
      controllers.delete(composition)
    },
  }

  return controller
}

/* -------------------------------------------------------------------------- */
/* One controller per composition                                             */
/* -------------------------------------------------------------------------- */

let controllers = new WeakMap<SceneComposition, InteractionController>()

/**
 * The interaction controller of a composition.
 *
 * Memoised per composition so four extension modules mount one frame hook and
 * one debug surface between them; the controller is dropped when its composition
 * is disposed.
 */
export function getInteractionController(options: InteractionControllerOptions): InteractionController {
  const existing = controllers.get(options.composition)
  if (existing !== undefined && !existing.composition.disposed) {
    return existing
  }
  const controller = createInteractionController(options)
  controllers.set(options.composition, controller)
  return controller
}

/** Test hook: forget every memoised controller. */
export function resetInteractionControllers(): void {
  controllers = new WeakMap()
}

/* -------------------------------------------------------------------------- */
/* React bindings                                                             */
/* -------------------------------------------------------------------------- */

/** Props an interaction hook needs: the live pipeline and the composition. */
export interface InteractionHostProps {
  readonly pipeline: RenderPipeline
  readonly composition: SceneComposition
}

/**
 * Controller of the current composition, retained for the calling component's
 * lifetime.
 *
 * `useMemo` keys on the composition so a strict-mode double mount reuses one
 * controller, and the effect's cleanup releases exactly one claim.
 */
export function useInteractionController(props: InteractionHostProps): InteractionController {
  const controller = useMemo(
    () => getInteractionController({ pipeline: props.pipeline, composition: props.composition }),
    [props.pipeline, props.composition],
  )
  useEffect(() => {
    controller.retain()
    return () => {
      controller.release()
    }
  }, [controller])
  return controller
}

/** Subscribes a component to the controller's discrete state changes. */
export function useInteractionSnapshot(controller: InteractionController): InteractionSnapshot {
  const [snapshot, setSnapshot] = useState<InteractionSnapshot>(() => controller.getSnapshot())
  const controllerRef = useRef(controller)
  controllerRef.current = controller
  useEffect(() => {
    setSnapshot(controller.getSnapshot())
    return controller.subscribe(() => {
      setSnapshot(controllerRef.current.getSnapshot())
    })
  }, [controller])
  return snapshot
}

/** Registers a feature id for the lifetime of the calling component. */
export function useInteractionFeature(controller: InteractionController, id: InteractionFeatureId): void {
  useEffect(() => {
    controller.registerFeature(id)
    return () => {
      controller.unregisterFeature(id)
    }
  }, [controller, id])
}

/** Convenience alias for the scene extension signature these modules export. */
export type InteractionExtension = SceneExtension

export { VIEWPOINT_DEFINITIONS }
export type { ViewpointFraming, ViewpointId }
