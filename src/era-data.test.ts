import { describe, expect, it } from 'vitest'
import { ERA_IDS } from './eras'
import { ERA_DATA, getEraData } from './era-data'

describe('EraData contract completeness', () => {
  it('is populated for every timeline era', () => {
    expect(ERA_IDS.length).toBeGreaterThanOrEqual(5)
    for (const id of ERA_IDS) {
      expect(ERA_DATA[id], `missing EraData for ${id}`).toBeDefined()
    }
  })

  it('covers the five brief eras plus the timeline six', () => {
    for (const id of ['1945', '1965', '1985', '2005', '2025', '2055'] as const) {
      expect(ERA_DATA[id]).toBeDefined()
    }
  })

  it('has no missing fields across every subsystem', () => {
    for (const id of ERA_IDS) {
      const data = ERA_DATA[id]
      expect(data.era).toBe(id)
      expect(data.year).toBeGreaterThan(1900)

      // Architecture
      expect(data.architecture.styleLabel.length).toBeGreaterThan(0)
      expect(data.architecture.material.length).toBeGreaterThan(0)
      expect(data.architecture.facadePalette.length).toBeGreaterThan(0)
      expect(data.architecture.accentPalette.length).toBeGreaterThan(0)
      expect(data.architecture.heightRange[0]).toBeGreaterThan(0)
      expect(data.architecture.heightRange[1]).toBeGreaterThan(
        data.architecture.heightRange[0],
      )
      expect(data.architecture.windowStyle.length).toBeGreaterThan(0)
      expect(data.architecture.windowWarmth).toBeGreaterThanOrEqual(0)
      expect(data.architecture.roofFlavor.length).toBeGreaterThan(0)
      expect(data.architecture.emissiveIntensity).toBeGreaterThanOrEqual(0)
      expect(data.architecture.roughness).toBeGreaterThanOrEqual(0)
      expect(data.architecture.metalness).toBeGreaterThanOrEqual(0)

      // Storefronts
      expect(data.storefronts.awningStyle.length).toBeGreaterThan(0)
      expect(data.storefronts.awningPalette.length).toBeGreaterThan(0)
      expect(data.storefronts.signStyle.length).toBeGreaterThan(0)
      expect(data.storefronts.signColors.length).toBeGreaterThan(0)
      expect(data.storefronts.windowDensity).toBeGreaterThanOrEqual(0)

      // Advertising
      expect(data.advertising.billboardStyle.length).toBeGreaterThan(0)
      expect(data.advertising.headline.length).toBeGreaterThan(0)
      expect(data.advertising.subheadline.length).toBeGreaterThan(0)
      expect(data.advertising.emissiveIntensity).toBeGreaterThanOrEqual(0)

      // Vehicles
      expect(data.vehicles.styleLabel.length).toBeGreaterThan(0)
      expect(data.vehicles.palette.length).toBeGreaterThan(0)
      expect(data.vehicles.types.length).toBeGreaterThan(0)
      expect(data.vehicles.density).toBeGreaterThanOrEqual(0)
      expect(data.vehicles.density).toBeLessThanOrEqual(1)
      expect(data.vehicles.speedRange[1]).toBeGreaterThan(data.vehicles.speedRange[0])

      // Pedestrians
      expect(data.pedestrians.styleLabel.length).toBeGreaterThan(0)
      expect(data.pedestrians.palette.length).toBeGreaterThan(0)
      expect(data.pedestrians.outfit.length).toBeGreaterThan(0)
      expect(data.pedestrians.density).toBeGreaterThanOrEqual(0)
      expect(data.pedestrians.density).toBeLessThanOrEqual(1)

      // Atmosphere
      expect(data.atmosphere.skyTop).toBeGreaterThan(0)
      expect(data.atmosphere.tone.length).toBeGreaterThan(0)
      expect(data.atmosphere.saturation).toBeGreaterThanOrEqual(0)
      expect(data.atmosphere.contrast).toBeGreaterThanOrEqual(0)

      // Lighting
      expect(data.lighting.lampStyle.length).toBeGreaterThan(0)
      expect(data.lighting.lampHeight).toBeGreaterThan(0)
      expect(data.lighting.roadSurfaceColor).toBeGreaterThan(0)
      expect(data.lighting.sidewalkColor).toBeGreaterThan(0)
      expect(data.lighting.curbColor).toBeGreaterThan(0)
      expect(data.lighting.crosswalkColor).toBeGreaterThan(0)

      // Audio mood spine shared from eras.ts
      expect(data.audio.era).toBe(id)
      expect(data.audio.mood.length).toBeGreaterThan(0)
    }
  })

  it('changes the era profile per subsystem (epoch distinctness)', () => {
    // Architecture material differs between 1945 brick and 2025 composite.
    expect(ERA_DATA['1945'].architecture.material).toBe('brick')
    expect(ERA_DATA['2025'].architecture.material).toBe('composite')
    // Lane paint evolves: 1945 white dashes -> 1985 yellow.
    expect(ERA_DATA['1945'].lighting.dashedMarkingColor).not.toBe(
      ERA_DATA['1985'].lighting.dashedMarkingColor,
    )
    // Billboard headline is distinctly era-specific.
    expect(ERA_DATA['1945'].advertising.headline).toBe('WAR BONDS')
    expect(ERA_DATA['2005'].advertising.headline).toBe('Apple')
    expect(ERA_DATA['2055'].advertising.headline).toBe('MARS COLONY')
    // Lamp style progresses through the eras.
    expect(ERA_DATA['1945'].lighting.lampStyle).toBe('gas')
    expect(ERA_DATA['1985'].lighting.lampStyle).toBe('sodium')
    expect(ERA_DATA['2055'].lighting.lampStyle).toBe('hologram')
  })

  it('getEraData returns the canonical record and throws for unknown ids', () => {
    expect(getEraData('1965').year).toBe(1965)
    expect(() => getEraData('1900' as never)).toThrow()
  })
})