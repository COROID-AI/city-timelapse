import { describe, it, expect } from 'vitest'
import { getEraConfig } from '../../app/eras.config'
import { interpolateEraConfig } from '../eraInterpolation'

describe('interpolateEraConfig', () => {
  it('returns the start config at t=0', () => {
    const from = getEraConfig(0)
    const to = getEraConfig(5)
    const result = interpolateEraConfig(from, to, 0)
    expect(result.year).toBe(1945)
    expect(result.palette.skyTop).toBe(from.palette.skyTop)
  })

  it('returns the end config at t=1', () => {
    const from = getEraConfig(0)
    const to = getEraConfig(5)
    const result = interpolateEraConfig(from, to, 1)
    expect(result.year).toBe(2055)
    expect(result.palette.skyTop).toBe(to.palette.skyTop)
  })

  it('clamps out-of-range t values', () => {
    const from = getEraConfig(0)
    const to = getEraConfig(5)
    const result = interpolateEraConfig(from, to, 5)
    expect(result.year).toBe(2055)
  })

  it('produces intermediate numeric values', () => {
    const from = getEraConfig(1)
    const to = getEraConfig(4)
    const result = interpolateEraConfig(from, to, 0.5)
    expect(result.vehicleSpeed).toBeCloseTo((from.vehicleSpeed + to.vehicleSpeed) / 2, 3)
    expect(result.buildingScale).toBeCloseTo((from.buildingScale + to.buildingScale) / 2, 3)
  })
})
