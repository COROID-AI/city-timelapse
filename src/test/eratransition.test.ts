import { describe, it, expect } from 'vitest'
import { ERA_CONFIGS, ERA_YEARS } from '../types/era'
import { renderHook } from '@testing-library/react'
import { useEraTransition } from '../hooks/useEraTransition'

describe('Era Transition Hook', () => {
  it('returns correct configuration for each era', () => {
    const { result } = renderHook(() => 
      useEraTransition({ year: 1945, progress: 0 })
    )
    expect(result.current.architecture).toBe('art-deco')
  })

  it('returns brutalist for 1965', () => {
    const { result } = renderHook(() => 
      useEraTransition({ year: 1965, progress: 0 })
    )
    expect(result.current.architecture).toBe('brutalist')
  })

  it('returns eco-futuristic for 2055', () => {
    const { result } = renderHook(() => 
      useEraTransition({ year: 2055, progress: 0 })
    )
    expect(result.current.architecture).toBe('eco-futuristic')
  })

  it('returns correct vehicle type for each era', () => {
    const { result } = renderHook(() => 
      useEraTransition({ year: 2025, progress: 0 })
    )
    expect(result.current.vehicle).toBe('ev')
  })

  it('returns correct pedestrian style for each era', () => {
    const { result } = renderHook(() => 
      useEraTransition({ year: 1985, progress: 0 })
    )
    expect(result.current.pedestrian).toBe('80s')
  })
})

describe('Era Configs', () => {
  it('has all required eras defined', () => {
    ERA_YEARS.forEach(year => {
      expect(ERA_CONFIGS[year]).toBeDefined()
    })
  })

  it('has bloom strength values', () => {
    Object.values(ERA_CONFIGS).forEach(config => {
      expect(config.bloomStrength).toBeGreaterThan(0)
    })
  })

  it('has color temperature values', () => {
    Object.values(ERA_CONFIGS).forEach(config => {
      expect(config.colorTemp).toBeGreaterThan(0)
    })
  })
})