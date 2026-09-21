/**
 * Era store contract tests.
 *
 * They cover the state the timeline UI, the transition director and every
 * content layer read: selection, the from/to pair, progress clamped into 0..1,
 * rejection of unknown ids, selector-subscription behaviour and store
 * isolation.
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ERA_ID, ERA_IDS, getEra, type EraId, type TransitionState } from '../../src/era'
import {
  clampTransitionProgress,
  createEraStore,
  selectEraPair,
  selectFromEra,
  selectFromEraDefinition,
  selectIsTransitioning,
  selectProgress,
  selectSelectedEra,
  selectSelectedEraDefinition,
  selectToEra,
  selectToEraDefinition,
  selectTransitionState,
  subscribeToEraSelection,
  subscribeToTransitionProgress,
  useEraStore,
  useSelectedEra,
  useTransitionState,
  type EraStore,
} from '../../src/state/eraStore'

/** Settles the application-wide store back to its initial state. */
function resetApplicationStore(): void {
  useEraStore.setState({
    selectedEra: DEFAULT_ERA_ID,
    fromEra: DEFAULT_ERA_ID,
    toEra: DEFAULT_ERA_ID,
    progress: 0,
  })
}

/** Reads the four stored transition fields, ignoring the action functions. */
function readTransition(store: EraStore): TransitionState {
  const state = store.getState()
  return selectTransitionState(state)
}

describe('era store contract', () => {
  let store: EraStore

  beforeEach(() => {
    store = createEraStore()
  })

  it('starts settled on the default era with no transition in flight', () => {
    const state = store.getState()

    expect(state.selectedEra).toBe(DEFAULT_ERA_ID)
    expect(state.fromEra).toBe(DEFAULT_ERA_ID)
    expect(state.toEra).toBe(DEFAULT_ERA_ID)
    expect(state.progress).toBe(0)
    expect(selectIsTransitioning(state)).toBe(false)
    expect(readTransition(store)).toEqual({
      selectedEra: DEFAULT_ERA_ID,
      fromEra: DEFAULT_ERA_ID,
      toEra: DEFAULT_ERA_ID,
      progress: 0,
      isTransitioning: false,
    })
  })

  it('starts a blend from the previous selection when an era is selected', () => {
    store.getState().selectEra('1985')

    expect(readTransition(store)).toEqual({
      selectedEra: '1985',
      fromEra: '1945',
      toEra: '1985',
      progress: 0,
      isTransitioning: true,
    })

    store.getState().setProgress(0.4)
    expect(store.getState().progress).toBe(0.4)
    expect(readTransition(store).isTransitioning).toBe(true)
  })

  it('keeps an in-flight transition when the current target is re-selected', () => {
    const { selectEra, setProgress } = store.getState()
    selectEra('2025')
    setProgress(0.65)

    store.getState().selectEra('2025')

    const state = store.getState()
    expect(state.selectedEra).toBe('2025')
    expect(state.fromEra).toBe('1945')
    expect(state.progress).toBe(0.65)
  })

  it('re-targets from the destination when another era is selected mid-blend', () => {
    const { selectEra, setProgress } = store.getState()
    selectEra('1985')
    setProgress(0.5)

    store.getState().selectEra('2005')

    expect(readTransition(store)).toEqual({
      selectedEra: '2005',
      fromEra: '1985',
      toEra: '2005',
      progress: 0,
      isTransitioning: true,
    })
  })

  it('walks the whole timeline and pairs each selection with the previous one', () => {
    const { selectEra } = store.getState()
    const visited: EraId[] = []

    for (const id of ERA_IDS) {
      const previous = store.getState().selectedEra
      selectEra(id)

      const state = store.getState()
      expect(state.selectedEra).toBe(id)
      expect(state.toEra).toBe(id)
      expect(selectToEra(state)).toBe(id)
      expect(state.fromEra).toBe(previous)
      expect(state.progress).toBe(0)
      visited.push(id)
    }

    expect(visited).toEqual([...ERA_IDS])
    expect(store.getState().fromEra).toBe('2005')
  })

  it('clamps progress into 0..1', () => {
    const { setProgress } = store.getState()

    setProgress(-3)
    expect(store.getState().progress).toBe(0)

    setProgress(0.42)
    expect(store.getState().progress).toBe(0.42)

    setProgress(2)
    expect(store.getState().progress).toBe(1)

    setProgress(1)
    expect(store.getState().progress).toBe(1)

    expect(clampTransitionProgress(-1)).toBe(0)
    expect(clampTransitionProgress(0.5)).toBe(0.5)
    expect(clampTransitionProgress(7)).toBe(1)
    expect(() => clampTransitionProgress(Number.NaN)).toThrow(RangeError)
    expect(() => clampTransitionProgress(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => store.getState().setProgress(Number.NaN)).toThrow(RangeError)
    expect(store.getState().progress).toBe(1)
  })

  it('seeks an explicit transition, validating both ids and the progress value', () => {
    store.getState().setTransition('1945', '2025', 0.25)

    expect(selectEraPair(store.getState())).toEqual(['1945', '2025'])
    expect(store.getState().progress).toBe(0.25)

    store.getState().setTransition('1965', '1985')
    expect(selectFromEra(store.getState())).toBe('1965')
    expect(selectToEra(store.getState())).toBe('1985')
    expect(selectSelectedEra(store.getState())).toBe('1985')
    expect(store.getState().progress).toBe(0)

    store.getState().setTransition('1945', '2005', 9)
    expect(store.getState().progress).toBe(1)
  })

  it('rejects unknown era ids without mutating state', () => {
    store.getState().selectEra('1985')
    store.getState().setProgress(0.3)
    const before = store.getState()

    expect(() => store.getState().selectEra('1995' as EraId)).toThrow(/Unknown era id/)
    expect(() => store.getState().selectEra('' as EraId)).toThrow(/Unknown era id/)
    expect(() => store.getState().setTransition('1945', '2055' as EraId)).toThrow(/Unknown era id/)
    expect(() => store.getState().setTransition('2055' as EraId, '2025')).toThrow(/Unknown era id/)

    const after = store.getState()
    expect(after.selectedEra).toBe(before.selectedEra)
    expect(after.fromEra).toBe(before.fromEra)
    expect(after.toEra).toBe(before.toEra)
    expect(after.progress).toBe(before.progress)
  })

  it('rejects an unknown initial era instead of silently falling back', () => {
    expect(() => createEraStore('1899' as EraId)).toThrow(/Unknown era id/)
  })

  it('settles the pair once the transition completes', () => {
    const { selectEra, setProgress } = store.getState()
    selectEra('2025')
    setProgress(1)
    expect(selectIsTransitioning(store.getState())).toBe(true)

    store.getState().completeTransition()

    expect(readTransition(store)).toEqual({
      selectedEra: '2025',
      fromEra: '2025',
      toEra: '2025',
      progress: 0,
      isTransitioning: false,
    })

    // A settled store can start a fresh transition from its current era.
    store.getState().selectEra('1945')
    expect(selectEraPair(store.getState())).toEqual(['2025', '1945'])
  })

  it('derives era definitions from the registry', () => {
    store.getState().selectEra('1985')
    const state = store.getState()

    expect(selectSelectedEraDefinition(state)).toBe(getEra('1985'))
    expect(selectFromEraDefinition(state)).toBe(getEra('1945'))
    expect(selectToEraDefinition(state)).toBe(getEra('1985'))
    expect(selectSelectedEraDefinition(state).traffic.vehicleEraTag).toBe('1985-boxy-hatchback')
  })

  it('produces consistent transition snapshots', () => {
    store.getState().selectEra('2005')
    store.getState().setProgress(0.5)

    const first = readTransition(store)
    const second = selectTransitionState(store.getState())

    expect(second).toEqual(first)
    expect(second.progress).toBeGreaterThanOrEqual(0)
    expect(second.progress).toBeLessThanOrEqual(1)
    expect(second.selectedEra).toBe(second.toEra)
  })

  it('notifies selector subscribers only when their slice changes', () => {
    const selections: Array<readonly [EraId, EraId]> = []
    const unsubscribe = store.subscribe(selectSelectedEra, (next, previous) => {
      selections.push([next, previous])
    })

    store.getState().selectEra('1985')
    expect(selections).toEqual([['1985', '1945']])

    store.getState().setProgress(0.5)
    store.getState().setProgress(0.75)
    expect(selections).toHaveLength(1)

    store.getState().setTransition('1965', '2005', 0.25)
    expect(selections).toEqual([
      ['1985', '1945'],
      ['2005', '1985'],
    ])

    store.getState().selectEra('2005')
    expect(selections).toHaveLength(2)

    unsubscribe()
    store.getState().selectEra('1945')
    expect(selections).toHaveLength(2)
  })

  it('notifies progress subscribers through the helper and stops after unsubscribe', () => {
    const progressEvents: Array<readonly [number, number]> = []
    const stateEvents: number[] = []

    const stopProgress = subscribeToTransitionProgress(store, (next, previous) => {
      progressEvents.push([next, previous])
    })
    const stopState = store.subscribe((state) => {
      stateEvents.push(state.progress)
    })

    store.getState().selectEra('1985')
    store.getState().setProgress(0.2)
    store.getState().setProgress(0.2)
    store.getState().setProgress(0.8)

    expect(progressEvents).toEqual([
      [0.2, 0],
      [0.8, 0.2],
    ])
    expect(stateEvents).toEqual([0, 0.2, 0.2, 0.8])

    stopProgress()
    stopState()
    store.getState().setProgress(0.1)
    expect(progressEvents).toHaveLength(2)
    expect(stateEvents).toHaveLength(4)
  })

  it('notifies selection subscribers through the helper', () => {
    const selections: EraId[] = []
    const stop = subscribeToEraSelection(store, (eraId) => {
      selections.push(eraId)
    })

    store.getState().selectEra('1965')
    store.getState().setProgress(0.5)
    store.getState().selectEra('2025')

    expect(selections).toEqual(['1965', '2025'])
    stop()
  })

  it('keeps isolated stores independent', () => {
    const other = createEraStore('2005')

    expect(other.getState().selectedEra).toBe('2005')
    expect(selectIsTransitioning(other.getState())).toBe(false)

    store.getState().selectEra('2025')
    other.getState().selectEra('1945')

    expect(store.getState().toEra).toBe('2025')
    expect(other.getState().toEra).toBe('1945')
    expect(selectProgress(other.getState())).toBe(0)
  })
})

describe('application era store', () => {
  // The application store is a module singleton, so each test starts from the
  // documented initial state. React Testing Library unmounts its components in
  // its own afterEach, which keeps these resets free of act() warnings.
  beforeEach(resetApplicationStore)

  it('exposes the same contract as a freshly created store', () => {
    expect(useEraStore.getState().selectedEra).toBe(DEFAULT_ERA_ID)
    expect(readTransition(useEraStore).isTransitioning).toBe(false)

    useEraStore.getState().selectEra('1985')

    expect(useEraStore.getState().selectedEra).toBe('1985')
    expect(readTransition(useEraStore)).toEqual({
      selectedEra: '1985',
      fromEra: '1945',
      toEra: '1985',
      progress: 0,
      isTransitioning: true,
    })
  })

  it('drives React hooks from the store selection and transition state', async () => {
    const selected = renderHook(() => useSelectedEra())
    const transition = renderHook(() => useTransitionState())

    expect(selected.result.current).toBe(DEFAULT_ERA_ID)
    expect(transition.result.current.isTransitioning).toBe(false)

    await act(async () => {
      useEraStore.getState().selectEra('1985')
    })

    expect(selected.result.current).toBe('1985')
    expect(transition.result.current).toMatchObject({
      selectedEra: '1985',
      fromEra: '1945',
      toEra: '1985',
      progress: 0,
      isTransitioning: true,
    })

    await act(async () => {
      useEraStore.getState().setProgress(0.5)
    })

    expect(transition.result.current.progress).toBe(0.5)
    expect(transition.result.current.isTransitioning).toBe(true)

    await act(async () => {
      useEraStore.getState().completeTransition()
    })

    expect(transition.result.current.isTransitioning).toBe(false)
    expect(transition.result.current.progress).toBe(0)
    expect(selected.result.current).toBe('1985')
  })
})
