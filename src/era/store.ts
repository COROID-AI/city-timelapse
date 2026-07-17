/**
 * Global UI state store (Zustand).
 *
 * Design rules enforced by the remediation delta:
 *  - `eraProgress` (0..5 era-index space) is advanced by a single frame driver
 *    via refs, and only *mirrored* into the store for display (timeline fill,
 *    HUD). This keeps React re-renders cheap and avoids per-frame store churn.
 *  - `selectedEra` is the target the driver chases. Selecting an era never
 *    hard-cuts the scene; the driver glides `eraProgress` toward it.
 *  - `reducedMotion` makes the driver *snap* to the exact requested era
 *    (deterministic endpoint), never skip.
 */

import { create } from 'zustand'
import { ERA_COUNT, ERA_YEARS, getEra } from './config'

export interface CityState {
  /** Which era index the user selected (the target). 0..5. */
  selectedEra: number
  /**
   * Continuous, frame-mirrored progress (0..5). The timeline fill + HUD read
   * this. Mutated in bulk by the frame driver via `setEraProgress`.
   */
  eraProgress: number
  /** True while the driver is actively morphing between eras. */
  transitioning: boolean
  /** Audio master mute. Resumes the AudioContext on first enable. */
  audioEnabled: boolean
  /** Reduced-motion preference (snaps transitions). */
  reducedMotion: boolean
  /** WebGL not supported / failed; UI shows a fallback. */
  webglError: boolean
  /** Asset/scene initialised and ready; UI hides the loader. */
  ready: boolean
  /** The reset/focus control was triggered (increment to nudge controls). */
  resetNonce: number
  /** Quality preset for detail/shadow toggling. */
  quality: 'high' | 'low'

  /** Set the target era (clamped). */
  selectEra: (era: number) => void
  /** Mirror the current continuous progress for display. */
  setEraProgress: (p: number, transitioning: boolean) => void
  /** Toggle audio (respects autoplay: enabling is a user gesture). */
  toggleAudio: () => void
  setAudioEnabled: (enabled: boolean) => void
  setReducedMotion: (rm: boolean) => void
  setWebglError: (e: boolean) => void
  setReady: (r: boolean) => void
  /** Increment to request a deterministic camera reset/focus. */
  requestReset: () => void
  cycleQuality: () => void
}

export const useCityStore = create<CityState>((set) => ({
  selectedEra: 0,
  eraProgress: 0,
  transitioning: false,
  audioEnabled: false,
  reducedMotion: false,
  webglError: false,
  ready: false,
  resetNonce: 0,
  quality: 'high',

  selectEra: (era) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(ERA_COUNT - 1, Math.round(era)))
      if (clamped === s.selectedEra) {
        // Re-selecting the same era still nudges progress toward it exactly.
        return { selectedEra: clamped }
      }
      return { selectedEra: clamped }
    }),

  setEraProgress: (p, transitioning) =>
    set(() => ({
      eraProgress: Math.max(0, Math.min(ERA_COUNT - 1, p)),
      transitioning,
    })),

  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  setAudioEnabled: (enabled) => set(() => ({ audioEnabled: enabled })),
  setReducedMotion: (rm) => set(() => ({ reducedMotion: rm })),
  setWebglError: (e) => set(() => ({ webglError: e })),
  setReady: (r) => set(() => ({ ready: r })),
  requestReset: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
  cycleQuality: () =>
    set((s) => ({ quality: s.quality === 'high' ? 'low' : 'high' })),
}))

/** Non-reactive helper: era descriptor for the currently selected era. */
export function selectCurrentEra(state: CityState) {
  return getEra(state.selectedEra)
}

/** Non-reactive helper: the label for an era index (used by tests + UI). */
export function eraLabel(index: number): string {
  const e = getEra(index)
  return `${e.year} · ${e.name}`
}

/** Non-reactive helper: ordered year labels for the timeline. */
export const ERA_LABELS: string[] = ERA_YEARS.map((y) => String(y))
