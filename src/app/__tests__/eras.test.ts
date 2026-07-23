import { describe, it, expect } from 'vitest'
import { getEraConfig, ERA_OPTIONS } from '../eras.config'
import { interpolateEraConfig } from '../../lib/eraInterpolation'

describe('eras config', () => {
  it('exposes all six required eras', () => {
    const years = ERA_OPTIONS.map((e) => e.year)
    expect(years).toEqual([1945, 1965, 1985, 2005, 2025, 2055])
  })

  it('returns a config for each era id', () => {
    for (const o of ERA_OPTIONS) {
      const cfg = getEraConfig(o.id)
      expect(cfg.id).toBe(o.id)
      expect(cfg.year).toBe(o.year)
      expect(cfg.label).toBe(o.label)
      expect(cfg.palette).toBeDefined()
      expect(cfg.sfxProfile).toBeDefined()
    }
  })

  it('has distinct palettes per era', () => {
    const configs = ERA_OPTIONS.map((o) => getEraConfig(o.id))
    const palettes = configs.map((c) => c.palette.skyTop)
    expect(new Set(palettes).size).toBeGreaterThan(1)
  })

  it('interpolates between eras', () => {
    const from = getEraConfig(0)
    const to = getEraConfig(5)
    const mid = interpolateEraConfig(from, to, 0.5)

    expect(mid.year).toBeCloseTo((1945 + 2055) / 2, 0)
    // mid colors should be between endpoints
    expect(mid.palette.skyTop).not.toBe(from.palette.skyTop)
    expect(mid.palette.skyTop).not.toBe(to.palette.skyTop)
  })
})
