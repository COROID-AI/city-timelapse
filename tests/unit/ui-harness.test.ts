/**
 * Harness self-tests for the jsdom + React Testing Library setup.
 *
 * Later UI and composition tasks rely on this exact path working: render a
 * component through `tests/support/render.tsx`, drive it with a real user
 * event, and observe both the DOM and the zustand store behind it.
 *
 * The file is intentionally `.ts` (it is the path the plan's verification
 * commands target), so components are built with `createElement` instead of
 * JSX syntax.
 */

import { createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import {
  act,
  renderWithProviders,
  screen,
  useHarnessStore,
  within,
  type ProviderProps,
} from '../support/render'

/** Sample component: reads and mutates the harness store. */
function CounterProbe(): ReactElement {
  const count = useHarnessStore((state) => state.count)
  const increment = useHarnessStore((state) => state.increment)
  return createElement(
    'div',
    null,
    createElement('p', { 'data-testid': 'count' }, `Count: ${count}`),
    createElement('button', { type: 'button', onClick: increment }, 'Add a block'),
  )
}

/** Sample extra provider, standing in for the app providers later tasks add. */
function ExtraProvider({ children }: ProviderProps): ReactElement {
  return createElement(
    'section',
    { 'data-testid': 'extra-provider' },
    createElement('span', null, 'extra layer'),
    children,
  )
}

describe('jsdom render harness', () => {
  it('renders a component, dispatches a user event and observes the DOM update', async () => {
    const { user } = renderWithProviders(createElement(CounterProbe))

    expect(screen.getByTestId('count')).toHaveTextContent('Count: 0')

    await user.click(screen.getByRole('button', { name: /add a block/i }))

    expect(screen.getByTestId('count')).toHaveTextContent('Count: 1')
  })

  it('exposes the zustand store so mutations can be asserted', async () => {
    const { store, user } = renderWithProviders(createElement(CounterProbe), { initialCount: 2 })

    expect(store.getState().count).toBe(2)
    expect(screen.getByTestId('count')).toHaveTextContent('Count: 2')

    await user.click(screen.getByRole('button', { name: /add a block/i }))

    expect(store.getState().count).toBe(3)
    expect(store.getState().lastEvent).toBe('increment')
    expect(screen.getByTestId('count')).toHaveTextContent('Count: 3')
  })

  it('reflects store updates made outside React', () => {
    const { store } = renderWithProviders(createElement(CounterProbe))

    act(() => {
      store.getState().setCount(7)
    })

    expect(screen.getByTestId('count')).toHaveTextContent('Count: 7')
    expect(store.getState().lastEvent).toBe('setCount')
  })

  it('layers caller providers around the harness store', () => {
    renderWithProviders(createElement(CounterProbe), { providers: [ExtraProvider] })

    const extra = screen.getByTestId('extra-provider')
    expect(within(extra).getByText('extra layer')).toBeInTheDocument()
    expect(within(extra).getByRole('button', { name: /add a block/i })).toBeInTheDocument()
  })
})

describe('application shell', () => {
  it('renders the placeholder scene host with its documented fallback in jsdom', () => {
    renderWithProviders(createElement(App))

    const host = screen.getByTestId('scene-host')
    expect(host).toBeInTheDocument()
    expect(host).toHaveAttribute('data-webgl', 'false')
    expect(host).toHaveAttribute('data-quality-tier', 'high')
    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /city time period timelapse/i })).toBeInTheDocument()
    expect(screen.getByTestId('scene-status')).toHaveTextContent(/target 60 fps/i)
    expect(screen.getByTestId('scene-status')).toHaveTextContent(/frame budget/i)
    expect(screen.getByTestId('scene-status')).toHaveTextContent(/0 external assets/i)
  })

  it('honours a requested quality tier', () => {
    renderWithProviders(createElement(App, { qualityTier: 'low' }))

    expect(screen.getByTestId('scene-host')).toHaveAttribute('data-quality-tier', 'low')
    expect(screen.getByTestId('scene-status')).toHaveTextContent(/target 30 fps/i)
  })
})
