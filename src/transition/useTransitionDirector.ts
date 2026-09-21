/**
 * React binding of the transition director.
 *
 * The director itself is imperative and host-agnostic; this hook is how the
 * composed application mounts it. It owns the instance's lifetime, forwards the
 * frame clock and mirrors the snapshot into React state so an overlay can render
 * progress without polling:
 *
 * ```tsx
 * const { snapshot, selectEra } = useTransitionDirector({ layers, audio, camera })
 * // snapshot.progress, snapshot.active, snapshot.lastCompletion …
 * ```
 *
 * Two details matter:
 *
 * - the director is created inert (`autoStart: false`) during render and started
 *   in an effect, so React's development double-render can never leave two live
 *   directors subscribed to the era store;
 * - ticking is a *tick source*, not a hard-wired `requestAnimationFrame` call:
 *   inside the composed app the source is the render pipeline's `onFrame` hook,
 *   and in tests it is a manual driver, so no test depends on frame timing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EraId } from '../era'
import { useEraStore, type EraStore } from '../state/eraStore'
import { useUIControlsStore, type UIControlsStore } from '../ui/uiStore'
import { createUIControlsMotionPort } from './adapters'
import { createTransitionDirector } from './director'
import type {
  TransitionAudioPort,
  TransitionCameraPort,
  TransitionClock,
  TransitionDirector,
  TransitionDirectorSnapshot,
  TransitionLayerAdapter,
  TransitionScheduleTable,
} from './types'

/** Drives `tick` repeatedly; returns the stop function. */
export interface TransitionTickSource {
  /** Starts ticking; the returned function stops it. */
  start(tick: () => void): () => void
}

/** Tick source backed by the browser's animation frames. */
export const animationFrameTickSource: TransitionTickSource = {
  start(tick: () => void): () => void {
    if (typeof requestAnimationFrame !== 'function') {
      return () => {}
    }
    let handle = 0
    const loop = (): void => {
      tick()
      handle = requestAnimationFrame(loop)
    }
    handle = requestAnimationFrame(loop)
    return () => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(handle)
      }
    }
  },
}

/** Options of {@link useTransitionDirector}. */
export interface UseTransitionDirectorOptions {
  /** Era store; defaults to the application-wide {@link useEraStore}. */
  readonly store?: EraStore
  /** ui-controls store backing the default motion port. */
  readonly uiStore?: UIControlsStore
  /** Layer adapters; wrap in `useMemo` so the director is not rebuilt per render. */
  readonly layers?: readonly TransitionLayerAdapter[]
  /** Audio port; omitted means silent. */
  readonly audio?: TransitionAudioPort | null
  /** Camera port; omitted means "nothing to protect". */
  readonly camera?: TransitionCameraPort | null
  /** Motion port; defaults to the ui-controls store's preference. */
  readonly motion?: { isReducedMotion(): boolean } | null
  /** Tuned schedule; omitted uses the shipped table. */
  readonly schedule?: TransitionScheduleTable
  /** Injectable clock; defaults to the host's monotonic clock. */
  readonly clock?: TransitionClock
  /** Crossfade length handed to the audio port. */
  readonly crossfadeSeconds?: number
  /** How many era cue SFX one switch fires. */
  readonly cueLimit?: number
  /** Tick source; defaults to {@link animationFrameTickSource}. */
  readonly tickSource?: TransitionTickSource
  /** Advance the transition from the tick source; defaults to true. */
  readonly autoTick?: boolean
  /** Called when a transition completes; keep it stable with `useCallback`. */
  readonly onComplete?: (signal: NonNullable<TransitionDirectorSnapshot['lastCompletion']>) => void
}

/** What the hook hands back to the component. */
export interface UseTransitionDirectorResult {
  /** The live director; drive it directly for imperative hosts. */
  readonly director: TransitionDirector
  /** Latest snapshot, re-rendered on every start/progress/retarget/complete. */
  readonly snapshot: TransitionDirectorSnapshot
  /** Selects an era through the store, i.e. the timeline's own path. */
  readonly selectEra: (eraId: EraId) => void
  /** Collapses the running transition onto its target at once. */
  readonly complete: () => void
}

/**
 * Mounts the director over the era store and the ui-controls store.
 *
 * The defaults are the application-wide stores, so a host that only wants the
 * shipped behaviour passes nothing but its layer adapters.
 */
export function useTransitionDirector(
  options: UseTransitionDirectorOptions = {},
): UseTransitionDirectorResult {
  const {
    store = useEraStore,
    uiStore = useUIControlsStore,
    layers,
    audio = null,
    camera = null,
    motion,
    schedule,
    clock,
    crossfadeSeconds,
    cueLimit,
    tickSource = animationFrameTickSource,
    autoTick = true,
    onComplete,
  } = options

  const resolvedMotion = useMemo(
    () => motion ?? createUIControlsMotionPort(uiStore),
    [motion, uiStore],
  )

  const director = useMemo(
    () =>
      createTransitionDirector({
        store,
        layers,
        audio,
        camera,
        motion: resolvedMotion,
        schedule,
        clock,
        crossfadeSeconds,
        cueLimit,
        onComplete: onComplete === undefined ? undefined : (signal) => onComplete(signal),
        autoStart: false,
      }),
    [
      store,
      layers,
      audio,
      camera,
      resolvedMotion,
      schedule,
      clock,
      crossfadeSeconds,
      cueLimit,
      onComplete,
    ],
  )

  const [snapshot, setSnapshot] = useState<TransitionDirectorSnapshot>(() => director.getSnapshot())

  useEffect(() => {
    director.start()
    setSnapshot(director.getSnapshot())
    const unsubscribe = director.subscribe((next) => setSnapshot(next))
    const stopTicking = autoTick ? tickSource.start(() => director.tick()) : () => {}
    return () => {
      stopTicking()
      unsubscribe()
      director.dispose()
    }
  }, [director, autoTick, tickSource])

  const selectEra = useCallback(
    (eraId: EraId) => {
      director.selectEra(eraId)
    },
    [director],
  )

  const complete = useCallback(() => {
    director.complete()
  }, [director])

  return { director, snapshot, selectEra, complete }
}
