import { describe, expect, it } from 'vitest'
import {
  ERA_IDS,
  ERA_REGISTRY,
  eraIndex,
  getEraSpec,
  isEraId,
  type EraId,
} from './eras'
import { EraStateStore } from './state'

describe('era registry', () => {
  it('contains the six timeline eras in order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025', '2055'])
    expect(ERA_REGISTRY.map((spec) => spec.id)).toEqual([
      '1945',
      '1965',
      '1985',
      '2005',
      '2025',
      '2055',
    ])
  })

  it('includes 2055 per the README timeline', () => {
    expect(ERA_IDS).toContain('2055')
    expect(isEraId('2055')).toBe(true)
    expect(isEraId('1900')).toBe(false)
  })

  it('looks up specs and indexes', () => {
    expect(getEraSpec('1985').year).toBe(1985)
    expect(eraIndex('2025')).toBe(4)
    expect(eraIndex('2055')).toBe(5)
    expect(() => getEraSpec('1900' as EraId)).toThrow()
  })
})

describe('EraStateStore', () => {
  it('starts at 1945 with no transition', () => {
    const target = new EventTarget()
    const store = new EraStateStore(target, document)
    expect(store.state.era).toBe('1945')
    expect(store.state.index).toBe(0)
    expect(store.state.transitioning).toBe(false)
    store.dispose()
  })

  it('emits era-state-change with era, indices, source and transitioning', () => {
    const target = new EventTarget()
    const store = new EraStateStore(target, document)
    const events: Array<Record<string, unknown>> = []
    target.addEventListener('era-state-change', (event) => {
      events.push((event as CustomEvent).detail as Record<string, unknown>)
    })
    store.setEra('2005')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      era: '2005',
      prev: '1945',
      index: 3,
      prevIndex: 0,
      source: 'store',
      transitioning: true,
    })
    expect(store.state.era).toBe('2005')
    store.dispose()
  })

  it('listens for era-change events and validates the era', () => {
    const target = new EventTarget()
    const store = new EraStateStore(target, document)
    target.dispatchEvent(
      new CustomEvent('era-change', { detail: { era: '1965' } }),
    )
    expect(store.state.era).toBe('1965')

    // Invalid eras are ignored.
    target.dispatchEvent(
      new CustomEvent('era-change', { detail: { era: '1900' } }),
    )
    expect(store.state.era).toBe('1965')

    // Same-era events are ignored.
    target.dispatchEvent(
      new CustomEvent('era-change', { detail: { era: '1965' } }),
    )
    expect(store.state.era).toBe('1965')
    store.dispose()
  })

  it('endTransition clears the flag and emits a final event', () => {
    const target = new EventTarget()
    const store = new EraStateStore(target, document)
    const events: Array<Record<string, unknown>> = []
    target.addEventListener('era-state-change', (event) => {
      events.push((event as CustomEvent).detail as Record<string, unknown>)
    })
    store.setEra('2025')
    expect(store.state.transitioning).toBe(true)
    store.endTransition()
    expect(store.state.transitioning).toBe(false)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ transitioning: false, era: '2025' })
    store.dispose()
  })

  it('stops listening after dispose', () => {
    const target = new EventTarget()
    const store = new EraStateStore(target, document)
    store.dispose()
    target.dispatchEvent(
      new CustomEvent('era-change', { detail: { era: '1985' } }),
    )
    expect(store.state.era).toBe('1945')
  })
})