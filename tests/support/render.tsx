/**
 * Shared jsdom render harness for UI and composition tests.
 *
 * `renderWithProviders` wraps React Testing Library's `render` with the app
 * providers used across the project, hands back a real zustand store and a
 * configured `user-event` instance, and re-exports everything from RTL so a
 * test file needs a single import. Later tasks add their own providers through
 * the `providers` option without touching this file's defaults.
 */

import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

/** Minimal store shape used by the harness and by harness self-tests. */
export interface HarnessStoreState {
  readonly count: number
  readonly lastEvent: string | null
  increment: () => void
  setCount: (count: number) => void
  record: (label: string) => void
}

export type HarnessStore = StoreApi<HarnessStoreState>

/** Creates an isolated zustand store for one test (or one provider tree). */
export function createHarnessStore(initialCount = 0): HarnessStore {
  return createStore<HarnessStoreState>()((set) => ({
    count: initialCount,
    lastEvent: null,
    increment: () => set((state) => ({ count: state.count + 1, lastEvent: 'increment' })),
    setCount: (count: number) => set({ count, lastEvent: 'setCount' }),
    record: (label: string) => set({ lastEvent: label }),
  }))
}

const HarnessStoreContext = createContext<HarnessStore | null>(null)

export interface HarnessStoreProviderProps {
  readonly store: HarnessStore
  /** Optional so the provider can be built with `createElement` in `.ts` tests. */
  readonly children?: ReactNode
}

export function HarnessStoreProvider({ store, children }: HarnessStoreProviderProps): ReactElement {
  return <HarnessStoreContext.Provider value={store}>{children}</HarnessStoreContext.Provider>
}

/** Access to the store API (for assertions and imperative updates). */
export function useHarnessStoreApi(): HarnessStore {
  const store = useContext(HarnessStoreContext)
  if (store === null) {
    throw new Error('useHarnessStoreApi must be used inside <HarnessStoreProvider>.')
  }
  return store
}

/** Selector hook mirroring the app's zustand usage. */
export function useHarnessStore<T>(selector: (state: HarnessStoreState) => T): T {
  return useStore(useHarnessStoreApi(), selector)
}

export interface ProviderProps {
  readonly children: ReactNode
}

export type HarnessProvider = (props: ProviderProps) => ReactElement

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Reuse an existing store instead of creating one. */
  readonly store?: HarnessStore
  /** Initial value for the harness store's counter. */
  readonly initialCount?: number
  /** Extra providers applied inside the harness store provider, outermost first. */
  readonly providers?: readonly HarnessProvider[]
}

export interface RenderWithProvidersResult extends RenderResult {
  readonly store: HarnessStore
  readonly user: UserEvent
}

/**
 * Renders `ui` inside the standard provider tree.
 *
 * The returned object adds `store` (a real zustand store) and a `user-event`
 * instance, so a test can assert DOM output, store state and interaction
 * side-effects in one place.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { store: providedStore, initialCount = 0, providers = [], ...renderOptions } = options
  const store = providedStore ?? createHarnessStore(initialCount)
  const user = userEvent.setup()

  const Wrapper = ({ children }: ProviderProps): ReactElement => {
    const tree = createElement(HarnessStoreProvider, { store }, children)
    return providers.reduceRight<ReactElement>(
      (current, Provider) => createElement(Provider, null, current),
      tree,
    )
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions })
  return { ...result, store, user }
}

export * from '@testing-library/react'
