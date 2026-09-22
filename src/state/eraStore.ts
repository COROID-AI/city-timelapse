/**
 * Zustand era store: which period the city is showing, and how far the scene has
 * morphed towards it.
 *
 * The store owns era selection and transition state only. Camera, quality and
 * audio settings belong to their own owners and must not be added here.
 *
 * State model
 * -----------
 * - `selectedEra`: the era the user picked; always equal to `toEra`.
 * - `fromEra`/`toEra`: the pair currently being blended. `fromEra` is the era
 *   the scene morphs away from, `toEra` the destination.
 * - `progress`: blend weight, 0 = fully `fromEra`, 1 = fully `toEra`, always
 *   clamped into 0..1.
 * - settled state: `fromEra === toEra === selectedEra` and `progress === 0`.
 *
 * The pair is meaningful while it spans two eras, which is exactly what
 * {@link selectIsTransitioning} reports; `completeTransition` settles the pair
 * onto the destination once the transition director has finished animating.
 *
 * The module deliberately imports neither three.js, React nor any layer module,
 * so a content layer can read the selection without creating an import cycle.
 * `zustand` provides the store itself plus the selector-aware subscription
 * middleware the timeline UI and the transition director need for fine-grained
 * re-renders.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import type { Mutate, StateCreator, StoreApi } from 'zustand/vanilla'
import { DEFAULT_ERA_ID, getEra, requireEraId } from '../era'
import type { EraDefinition, EraId, TransitionState } from '../era'

/** Selector-aware store API produced by the era store factory. */
export type EraStore = Mutate<StoreApi<EraStoreState>, [['zustand/subscribeWithSelector', never]]>

/** Creator signature of the era store, including the subscription middleware. */
type EraStoreCreator = StateCreator<EraStoreState, [], [['zustand/subscribeWithSelector', never]]>

/** Reactive state and actions of the era store. */
export interface EraStoreState {
  /** Era the user selected; always equal to `toEra`. */
  readonly selectedEra: EraId
  /** Era the in-flight blend starts from, or `toEra` when settled. */
  readonly fromEra: EraId
  /** Era the in-flight blend moves towards. */
  readonly toEra: EraId
  /** Blend weight in 0..1. */
  readonly progress: number
  /**
   * Starts a transition to `eraId`.
   *
   * The previous selection becomes `fromEra` and the new selection becomes both
   * `selectedEra` and `toEra`, with `progress` reset to 0. Selecting the era
   * that is already selected is a no-op, so re-selecting the destination does
   * not restart an in-flight transition. Unknown ids throw
   * {@link UnknownEraIdError} and leave the state untouched.
   */
  selectEra: (eraId: EraId) => void
  /**
   * Sets the blend weight, clamped into 0..1. Non-finite values throw a
   * `RangeError` because they can only come from a broken animation loop.
   */
  setProgress: (progress: number) => void
  /**
   * Sets the whole transition explicitly, e.g. when restoring a deep link or
   * seeking the timeline. `selectedEra` follows `toEra`; both ids are validated.
   */
  setTransition: (fromEra: EraId, toEra: EraId, progress?: number) => void
  /**
   * Settles the store once the director has finished: the pair collapses onto
   * the destination and `progress` returns to 0.
   */
  completeTransition: () => void
}

/** Clamps an untrusted blend weight into the closed interval 0..1. */
export function clampTransitionProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    throw new RangeError(`Transition progress must be a finite number, received ${String(progress)}.`)
  }
  return Math.min(1, Math.max(0, progress))
}

/** Settled state for one era: no transition in flight. */
function createSettledState(eraId: EraId): Pick<EraStoreState, 'selectedEra' | 'fromEra' | 'toEra' | 'progress'> {
  return { selectedEra: eraId, fromEra: eraId, toEra: eraId, progress: 0 }
}

/** Builds the shared initialiser so every store instance behaves identically. */
function createEraStoreCreator(initialEraId: EraId): EraStoreCreator {
  const initial = createSettledState(requireEraId(initialEraId))

  return (set, get) => ({
    ...initial,
    selectEra: (eraId) => {
      const nextEraId = requireEraId(eraId)
      const { selectedEra } = get()
      if (nextEraId === selectedEra) {
        return
      }
      set({ selectedEra: nextEraId, fromEra: selectedEra, toEra: nextEraId, progress: 0 })
    },
    setProgress: (progress) => {
      set({ progress: clampTransitionProgress(progress) })
    },
    setTransition: (fromEra, toEra, progress = 0) => {
      const nextFrom = requireEraId(fromEra)
      const nextTo = requireEraId(toEra)
      set({
        selectedEra: nextTo,
        fromEra: nextFrom,
        toEra: nextTo,
        progress: clampTransitionProgress(progress),
      })
    },
    completeTransition: () => {
      const { toEra } = get()
      set({ selectedEra: toEra, fromEra: toEra, progress: 0 })
    },
  })
}

/**
 * Creates an isolated era store.
 *
 * Tests, storybook-style sandboxes and embedded timelines use this instead of
 * the application-wide {@link useEraStore} so their state cannot leak.
 */
export function createEraStore(initialEraId: EraId = DEFAULT_ERA_ID): EraStore {
  return createStore<EraStoreState>()(
    subscribeWithSelector(createEraStoreCreator(initialEraId)),
  )
}

/** Application-wide era store the timeline UI and every content layer read. */
export const useEraStore = create<EraStoreState>()(
  subscribeWithSelector(createEraStoreCreator(DEFAULT_ERA_ID)),
)

/** Currently selected era. */
export const selectSelectedEra = (state: EraStoreState): EraId => state.selectedEra

/** Era the in-flight blend starts from. */
export const selectFromEra = (state: EraStoreState): EraId => state.fromEra

/** Era the in-flight blend moves towards; always the selected era. */
export const selectToEra = (state: EraStoreState): EraId => state.toEra

/** Blend weight in 0..1. */
export const selectProgress = (state: EraStoreState): number => state.progress

/** True while the stored pair spans two different eras. */
export const selectIsTransitioning = (state: EraStoreState): boolean => state.fromEra !== state.toEra

/** The stored pair in `[from, to]` order. */
export const selectEraPair = (state: EraStoreState): readonly [EraId, EraId] => [
  state.fromEra,
  state.toEra,
]

/** Complete transition snapshot consumed by the transition director and the UI. */
export function selectTransitionState(state: EraStoreState): TransitionState {
  return {
    selectedEra: state.selectedEra,
    fromEra: state.fromEra,
    toEra: state.toEra,
    progress: state.progress,
    isTransitioning: selectIsTransitioning(state),
  }
}

/** Registry record of the selected era. */
export function selectSelectedEraDefinition(state: EraStoreState): EraDefinition {
  return getEra(state.selectedEra)
}

/** Registry record of the era the blend starts from. */
export function selectFromEraDefinition(state: EraStoreState): EraDefinition {
  return getEra(state.fromEra)
}

/** Registry record of the era the blend moves towards. */
export function selectToEraDefinition(state: EraStoreState): EraDefinition {
  return getEra(state.toEra)
}

/** Subscribes to selection changes only; returns the unsubscribe function. */
export function subscribeToEraSelection(
  store: EraStore,
  listener: (eraId: EraId, previousEraId: EraId) => void,
): () => void {
  return store.subscribe(selectSelectedEra, listener)
}

/** Subscribes to blend-weight changes only; returns the unsubscribe function. */
export function subscribeToTransitionProgress(
  store: EraStore,
  listener: (progress: number, previousProgress: number) => void,
): () => void {
  return store.subscribe(selectProgress, listener)
}

/** React hook: the currently selected era id. */
export function useSelectedEra(): EraId {
  return useEraStore(selectSelectedEra)
}

/** React hook: the current transition snapshot. */
export function useTransitionState(): TransitionState {
  return useEraStore(selectTransitionState)
}
