/**
 * UI controls store: the one place the viewer's intent lives.
 *
 * The overlay, the audio engine, the render pipeline and the adaptive-quality
 * controller all need to know what the viewer asked for. Keeping that intent in
 * several modules would let them disagree, so it lives here and nowhere else:
 *
 * - `audioMuted` / `audioUnlocked` — the viewer's sound intent. `audioUnlocked`
 *   is the gesture permission the audio engine needs before it may resume its
 *   `AudioContext`; `audioMuted` is the ongoing mute switch. The engine reads
 *   these values, it never owns them.
 * - `requestedQualityTier` / `qualityManualOverride` — the tier the pipeline
 *   should render at, plus whether the viewer picked it by hand.
 *   `qualityManualOverride === true` means the adaptive controller must leave
 *   the tier alone.
 * - `motionPreference` / `motionManualOverride` — whether era changes animate.
 *   `'system'` defers to `prefers-reduced-motion`, `'reduce'` forces instant
 *   swaps, `'no-preference'` forces animation.
 * - `overlayVisible`, `overlayDismissed`, `legendVisible` — which explanatory
 *   surfaces are on screen.
 *
 * The module imports nothing but `zustand` and the shared quality constants: it
 * must never import the audio engine, the render pipeline or a layer module,
 * because those modules consume it.
 */

import { useEffect, useState } from 'react'
import { create, useStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import type { Mutate, StateCreator, StoreApi } from 'zustand/vanilla'
import { DEFAULT_QUALITY_TIER, isQualityTierName } from '../lib/quality'
import type { QualityTierName } from '../lib/quality'

/** Media query reporting the operating-system motion preference. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Motion options the overlay offers. */
export const MOTION_PREFERENCES = ['system', 'reduce', 'no-preference'] as const

/** How the viewer wants era transitions animated. */
export type MotionPreference = (typeof MOTION_PREFERENCES)[number]

/** Selector copy for the motion options, so components hold no prose. */
export const MOTION_PREFERENCE_LABELS: Readonly<Record<MotionPreference, string>> = {
  system: 'Follow system',
  reduce: 'Reduce motion',
  'no-preference': 'Full motion',
}

/** Selector copy for the quality tiers, keyed by the pipeline's own names. */
export const QUALITY_TIER_LABELS: Readonly<Record<QualityTierName, string>> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Descriptions shown next to the quality options in the overlay. */
export const QUALITY_TIER_HINTS: Readonly<Record<QualityTierName, string>> = {
  high: 'Full detail, shadows, bloom',
  medium: 'Balanced detail and effects',
  low: 'Fastest, minimal effects',
}

/** The viewer's sound intent. */
export interface AudioIntent {
  /** True when the viewer wants the scene silent. */
  readonly muted: boolean
  /** True once the viewer has granted a user gesture for audio playback. */
  readonly unlocked: boolean
  /** True when the scene should actually make sound right now. */
  readonly active: boolean
}

/** The viewer's (or the adaptive controller's) rendering-quality intent. */
export interface QualityIntent {
  /** Tier the pipeline should render at. */
  readonly requestedTier: QualityTierName
  /** True when the viewer chose the tier by hand; adaptive changes are then off. */
  readonly manualOverride: boolean
}

/** The viewer's motion intent. */
export interface MotionIntent {
  /** Stored preference, including `'system'`. */
  readonly preference: MotionPreference
  /** True when the viewer overrode the system preference by hand. */
  readonly manualOverride: boolean
}

/** Which explanatory surfaces are on screen. */
export interface OverlayIntent {
  /** True when the first-use/information panel is shown. */
  readonly overlayVisible: boolean
  /** True once the viewer has closed the first-use panel. */
  readonly dismissed: boolean
  /** True when the help legend is expanded. */
  readonly legendVisible: boolean
}

/** Reactive state and actions of the UI controls store. */
export interface UIControlsState {
  /** Viewer wants the scene silent. */
  readonly audioMuted: boolean
  /** Viewer has granted the gesture that lets the audio engine start. */
  readonly audioUnlocked: boolean
  /** Tier the pipeline should render at. */
  readonly requestedQualityTier: QualityTierName
  /** True when the viewer picked the tier by hand. */
  readonly qualityManualOverride: boolean
  /** Stored motion preference. */
  readonly motionPreference: MotionPreference
  /** True when the viewer picked the motion preference by hand. */
  readonly motionManualOverride: boolean
  /** First-use/information panel visible. */
  readonly overlayVisible: boolean
  /** First-use panel has been closed at least once. */
  readonly overlayDismissed: boolean
  /** Help legend expanded. */
  readonly legendVisible: boolean
  setAudioMuted: (muted: boolean) => void
  toggleAudioMute: () => void
  setAudioUnlocked: (unlocked: boolean) => void
  /**
   * Records the viewer's "turn sound on" gesture: unlocks audio and clears the
   * mute flag in one step. The integrator calls the audio engine from this
   * state change, never the other way round.
   */
  requestAudioUnlock: () => void
  /** Viewer picked a tier by hand; sets `qualityManualOverride`. */
  requestQualityTier: (tier: QualityTierName) => void
  /** Adaptive controller proposes a tier; ignored while the viewer overrode it. */
  applyAdaptiveQualityTier: (tier: QualityTierName) => void
  /** Hands quality control back to the adaptive controller. */
  clearQualityOverride: () => void
  /** Viewer picked a motion preference by hand; sets `motionManualOverride`. */
  setMotionPreference: (preference: MotionPreference) => void
  /** Clears the motion override so the system preference applies again. */
  clearMotionOverride: () => void
  setOverlayVisible: (visible: boolean) => void
  toggleOverlay: () => void
  /** Closes the first-use panel and remembers the dismissal. */
  dismissOverlay: () => void
  setLegendVisible: (visible: boolean) => void
  toggleLegend: () => void
  /** Restores every intent to its documented default. */
  reset: () => void
}

/** Selector-aware store API produced by the UI controls factory. */
export type UIControlsStore = Mutate<
  StoreApi<UIControlsState>,
  [['zustand/subscribeWithSelector', never]]
>

/** Creator signature of the UI controls store, including the middleware. */
type UIControlsCreator = StateCreator<
  UIControlsState,
  [],
  [['zustand/subscribeWithSelector', never]]
>

/** Intent fields a caller may seed a store with. */
export type UIControlsSeed = Partial<
  Pick<
    UIControlsState,
    | 'audioMuted'
    | 'audioUnlocked'
    | 'requestedQualityTier'
    | 'qualityManualOverride'
    | 'motionPreference'
    | 'motionManualOverride'
    | 'overlayVisible'
    | 'overlayDismissed'
    | 'legendVisible'
  >
>

/** Documented defaults: silent until unlocked, richest tier, system motion. */
export const UI_CONTROLS_DEFAULTS: Required<UIControlsSeed> = {
  audioMuted: false,
  audioUnlocked: false,
  requestedQualityTier: DEFAULT_QUALITY_TIER,
  qualityManualOverride: false,
  motionPreference: 'system',
  motionManualOverride: false,
  overlayVisible: true,
  overlayDismissed: false,
  legendVisible: true,
}

/** Narrows an untrusted motion value. */
export function isMotionPreference(value: unknown): value is MotionPreference {
  return typeof value === 'string' && (MOTION_PREFERENCES as readonly string[]).includes(value)
}

/** Returns the motion preference unchanged, or throws for unknown input. */
export function requireMotionPreference(value: unknown): MotionPreference {
  if (!isMotionPreference(value)) {
    throw new TypeError(
      `Unknown motion preference ${JSON.stringify(value)}. Known values: ${MOTION_PREFERENCES.join(', ')}.`,
    )
  }
  return value
}

/** Returns the tier unchanged, or throws for unknown input. */
export function requireQualityTierName(value: unknown): QualityTierName {
  if (!isQualityTierName(value)) {
    throw new TypeError(`Unknown quality tier ${JSON.stringify(value)}.`)
  }
  return value
}

/**
 * Resolves the stored motion preference against the system setting.
 *
 * Pure, so the reduced-motion path can be asserted without a browser.
 */
export function resolveReducedMotion(
  preference: MotionPreference,
  systemPrefersReducedMotion: boolean,
): boolean {
  switch (preference) {
    case 'reduce':
      return true
    case 'no-preference':
      return false
    case 'system':
      return systemPrefersReducedMotion
  }
}

/** Reads `prefers-reduced-motion` safely in browsers, jsdom and non-DOM code. */
export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches === true
  } catch {
    return false
  }
}

/** Builds the shared initialiser so every store instance behaves identically. */
function createUIControlsCreator(seed: UIControlsSeed): UIControlsCreator {
  const initial: Required<UIControlsSeed> = { ...UI_CONTROLS_DEFAULTS, ...seed }
  const defaults = UI_CONTROLS_DEFAULTS

  return (set, get) => ({
    ...initial,
    setAudioMuted: (muted) => set({ audioMuted: muted === true }),
    toggleAudioMute: () => set((state) => ({ audioMuted: !state.audioMuted })),
    setAudioUnlocked: (unlocked) => set({ audioUnlocked: unlocked === true }),
    requestAudioUnlock: () => set({ audioUnlocked: true, audioMuted: false }),
    requestQualityTier: (tier) => {
      set({ requestedQualityTier: requireQualityTierName(tier), qualityManualOverride: true })
    },
    applyAdaptiveQualityTier: (tier) => {
      const nextTier = requireQualityTierName(tier)
      if (get().qualityManualOverride) {
        return
      }
      set({ requestedQualityTier: nextTier })
    },
    clearQualityOverride: () => set({ qualityManualOverride: false }),
    setMotionPreference: (preference) =>
      set({ motionPreference: requireMotionPreference(preference), motionManualOverride: true }),
    clearMotionOverride: () => set({ motionPreference: 'system', motionManualOverride: false }),
    setOverlayVisible: (visible) => set({ overlayVisible: visible === true }),
    toggleOverlay: () =>
      set((state) => ({ overlayVisible: !state.overlayVisible, overlayDismissed: true })),
    dismissOverlay: () => set({ overlayVisible: false, overlayDismissed: true }),
    setLegendVisible: (visible) => set({ legendVisible: visible === true }),
    toggleLegend: () => set((state) => ({ legendVisible: !state.legendVisible })),
    reset: () => set({ ...defaults }),
  })
}

/**
 * Creates an isolated UI controls store.
 *
 * Tests and embedded sandboxes use this instead of the application-wide
 * {@link useUIControlsStore} so their intent cannot leak into another test.
 */
export function createUIControlsStore(seed: UIControlsSeed = {}): UIControlsStore {
  return createStore<UIControlsState>()(subscribeWithSelector(createUIControlsCreator(seed)))
}

/** Application-wide UI controls store the overlay and the integrator share. */
export const useUIControlsStore = create<UIControlsState>()(
  subscribeWithSelector(createUIControlsCreator({})),
)

/** True when the viewer wants silence. */
export const selectAudioMuted = (state: UIControlsState): boolean => state.audioMuted

/** True once the viewer granted the audio gesture. */
export const selectAudioUnlocked = (state: UIControlsState): boolean => state.audioUnlocked

/** Complete audio intent; use with `getState`/`subscribe`, not with `useStore`. */
export function selectAudioIntent(state: UIControlsState): AudioIntent {
  return {
    muted: state.audioMuted,
    unlocked: state.audioUnlocked,
    active: state.audioUnlocked && !state.audioMuted,
  }
}

/** Tier the pipeline should render at. */
export const selectRequestedQualityTier = (state: UIControlsState): QualityTierName =>
  state.requestedQualityTier

/** True when the viewer overrode the adaptive quality controller. */
export const selectQualityManualOverride = (state: UIControlsState): boolean =>
  state.qualityManualOverride

/** Complete quality intent; use with `getState`/`subscribe`, not with `useStore`. */
export function selectQualityIntent(state: UIControlsState): QualityIntent {
  return { requestedTier: state.requestedQualityTier, manualOverride: state.qualityManualOverride }
}

/** Stored motion preference. */
export const selectMotionPreference = (state: UIControlsState): MotionPreference =>
  state.motionPreference

/** True when the viewer overrode the system motion preference. */
export const selectMotionManualOverride = (state: UIControlsState): boolean =>
  state.motionManualOverride

/** Complete motion intent; use with `getState`/`subscribe`, not with `useStore`. */
export function selectMotionIntent(state: UIControlsState): MotionIntent {
  return { preference: state.motionPreference, manualOverride: state.motionManualOverride }
}

/** True when the first-use/information panel is shown. */
export const selectOverlayVisible = (state: UIControlsState): boolean => state.overlayVisible

/** True once the viewer closed the first-use panel. */
export const selectOverlayDismissed = (state: UIControlsState): boolean => state.overlayDismissed

/** True when the help legend is expanded. */
export const selectLegendVisible = (state: UIControlsState): boolean => state.legendVisible

/** Complete overlay intent; use with `getState`/`subscribe`, not with `useStore`. */
export function selectOverlayIntent(state: UIControlsState): OverlayIntent {
  return {
    overlayVisible: state.overlayVisible,
    dismissed: state.overlayDismissed,
    legendVisible: state.legendVisible,
  }
}

/** Subscribes to the whole UI controls state; returns the unsubscribe function. */
export function subscribeToUIControls(
  store: UIControlsStore,
  listener: (state: UIControlsState, previousState: UIControlsState) => void,
): () => void {
  return store.subscribe(listener)
}

/** Subscribes to audio intent only; returns the unsubscribe function. */
export function subscribeToAudioIntent(
  store: UIControlsStore,
  listener: (intent: AudioIntent, previous: AudioIntent) => void,
): () => void {
  return store.subscribe(selectAudioIntent, listener, {
    // Intent objects are rebuilt per notification, so compare by value.
    equalityFn: (left, right) =>
      left.muted === right.muted &&
      left.unlocked === right.unlocked &&
      left.active === right.active,
  })
}

/** Subscribes to quality intent only; returns the unsubscribe function. */
export function subscribeToQualityIntent(
  store: UIControlsStore,
  listener: (intent: QualityIntent, previous: QualityIntent) => void,
): () => void {
  return store.subscribe(selectQualityIntent, listener, {
    equalityFn: (left, right) =>
      left.requestedTier === right.requestedTier && left.manualOverride === right.manualOverride,
  })
}

/** Subscribes to motion intent only; returns the unsubscribe function. */
export function subscribeToMotionIntent(
  store: UIControlsStore,
  listener: (intent: MotionIntent, previous: MotionIntent) => void,
): () => void {
  return store.subscribe(selectMotionIntent, listener, {
    equalityFn: (left, right) =>
      left.preference === right.preference && left.manualOverride === right.manualOverride,
  })
}

/** React hook: the UI controls store of the current render (never a new store). */
export function useUIControls<T>(selector: (state: UIControlsState) => T): T {
  return useUIControlsStore(selector)
}

/** Tracks `prefers-reduced-motion` and re-renders when the OS setting changes. */
export function useSystemReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(systemPrefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const handleChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches === true)
    }
    query.addEventListener?.('change', handleChange)
    return () => {
      query.removeEventListener?.('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Resolves the viewer's stored motion preference against the system setting.
 *
 * The UI uses this to drop its own transitions; the transition director uses the
 * same store value to decide whether to animate an era swap at all, so both
 * surfaces obey one decision.
 */
export function useResolvedReducedMotion(store?: UIControlsStore): boolean {
  const preference = useStore(store ?? useUIControlsStore, selectMotionPreference)
  const systemPrefers = useSystemReducedMotion()
  return resolveReducedMotion(preference, systemPrefers)
}
