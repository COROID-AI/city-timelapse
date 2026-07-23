import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store'

describe('app store', () => {
  beforeEach(() => {
    useAppStore.setState({
      targetEraId: 0,
      sfxEnabled: true,
      reduceMotion: false,
    })
  })

  it('defaults to era 0', () => {
    expect(useAppStore.getState().targetEraId).toBe(0)
  })

  it('setTargetEraId updates the era', () => {
    useAppStore.getState().setTargetEraId(4)
    expect(useAppStore.getState().targetEraId).toBe(4)
  })

  it('setSfxEnabled toggles SFX', () => {
    useAppStore.getState().setSfxEnabled(false)
    expect(useAppStore.getState().sfxEnabled).toBe(false)
  })

  it('setReduceMotion toggles motion', () => {
    useAppStore.getState().setReduceMotion(true)
    expect(useAppStore.getState().reduceMotion).toBe(true)
  })
})
