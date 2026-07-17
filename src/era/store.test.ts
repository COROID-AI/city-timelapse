import { describe, it, expect, beforeEach } from 'vitest'
import { useCityStore, eraLabel } from '../era/store'
import { ERA_COUNT, getEra } from '../era/config'

describe('store: era selection', () => {
  beforeEach(() => {
    useCityStore.setState({
      selectedEra: 0,
      eraProgress: 0,
      transitioning: false,
      audioEnabled: false,
      reducedMotion: false,
      webglError: false,
      ready: false,
      resetNonce: 0,
      quality: 'high',
    })
  })

  it('starts at era 0 with no progress', () => {
    const s = useCityStore.getState()
    expect(s.selectedEra).toBe(0)
    expect(s.eraProgress).toBe(0)
    expect(s.transitioning).toBe(false)
  })

  it('selectEra sets the target era', () => {
    useCityStore.getState().selectEra(3)
    expect(useCityStore.getState().selectedEra).toBe(3)
  })

  it('selectEra rounds fractional input', () => {
    useCityStore.getState().selectEra(2.4)
    expect(useCityStore.getState().selectedEra).toBe(2)
    useCityStore.getState().selectEra(2.6)
    expect(useCityStore.getState().selectedEra).toBe(3)
  })

  it('selectEra clamps above the max era', () => {
    useCityStore.getState().selectEra(999)
    expect(useCityStore.getState().selectedEra).toBe(ERA_COUNT - 1)
  })

  it('selectEra clamps below 0', () => {
    useCityStore.getState().selectEra(-5)
    expect(useCityStore.getState().selectedEra).toBe(0)
  })

  it('setEraProgress mirrors continuous progress and clamps it', () => {
    useCityStore.getState().setEraProgress(2.314, true)
    const s = useCityStore.getState()
    expect(s.eraProgress).toBeCloseTo(2.314)
    expect(s.transitioning).toBe(true)
  })

  it('setEraProgress clamps progress to valid range', () => {
    useCityStore.getState().setEraProgress(-10, true)
    expect(useCityStore.getState().eraProgress).toBe(0)
    useCityStore.getState().setEraProgress(999, true)
    expect(useCityStore.getState().eraProgress).toBe(ERA_COUNT - 1)
  })
})

describe('store: toggles', () => {
  beforeEach(() => {
    useCityStore.setState({ audioEnabled: false, reducedMotion: false })
  })

  it('toggleAudio flips the enabled flag', () => {
    expect(useCityStore.getState().audioEnabled).toBe(false)
    useCityStore.getState().toggleAudio()
    expect(useCityStore.getState().audioEnabled).toBe(true)
    useCityStore.getState().toggleAudio()
    expect(useCityStore.getState().audioEnabled).toBe(false)
  })

  it('setAudioEnabled sets explicitly', () => {
    useCityStore.getState().setAudioEnabled(true)
    expect(useCityStore.getState().audioEnabled).toBe(true)
  })

  it('setReducedMotion sets the flag', () => {
    useCityStore.getState().setReducedMotion(true)
    expect(useCityStore.getState().reducedMotion).toBe(true)
  })
})

describe('store: controls', () => {
  beforeEach(() => {
    useCityStore.setState({ resetNonce: 0, quality: 'high' })
  })

  it('requestReset increments the nonce', () => {
    useCityStore.getState().requestReset()
    expect(useCityStore.getState().resetNonce).toBe(1)
    useCityStore.getState().requestReset()
    expect(useCityStore.getState().resetNonce).toBe(2)
  })

  it('cycleQuality toggles high<->low', () => {
    expect(useCityStore.getState().quality).toBe('high')
    useCityStore.getState().cycleQuality()
    expect(useCityStore.getState().quality).toBe('low')
    useCityStore.getState().cycleQuality()
    expect(useCityStore.getState().quality).toBe('high')
  })
})

describe('store: eraLabel', () => {
  it('formats year and name', () => {
    expect(eraLabel(0)).toBe('1945 · Postwar')
    expect(eraLabel(5)).toBe('2055 · Eco Future')
  })
  it('matches the descriptor for each era', () => {
    for (let i = 0; i < ERA_COUNT; i++) {
      const e = getEra(i)
      expect(eraLabel(i)).toBe(`${e.year} · ${e.name}`)
    }
  })
})
