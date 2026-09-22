/**
 * Composition contract: the real block, the real era registry and the real
 * buildings layer, wired together.
 *
 * This is the "buildings-composition" check. Nothing is stubbed: the block comes
 * from `createCityLayout()`, the period data from `src/era`, and the layer's own
 * barrel decides the massing, the facade grid and the roof kit. It asserts the
 * integration the scene phase depends on:
 *
 * - every parcel of the frozen block resolves to exactly one building state, and
 *   a built mass never leaves its own parcel footprint or covers a storefront
 *   bay's frontage band;
 * - adjacent eras produce measurably different height, floor and footprint
 *   distributions;
 * - facade detail and roof kits follow the period tables;
 * - `applyEraTransition` at `t = 1` is exactly `applyEra(to)`, and reduced motion
 *   switches in one step;
 * - the three.js group the composition mounts carries the counts it promises.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, getEra, type EraId } from '../../src/era'
import { createCityLayout, layoutHash } from '../../src/city/layout'
import {
  applyEra,
  applyEraTransition,
  buildingPlanHash,
  createBuildingsGroup,
  disposeBuildingsGroup,
  ERA_BUILDING_TABLES,
  summariseBuildingsGroup,
} from '../../src/city/buildings'
import type { BuildingPlan } from '../../src/city/buildings'

const layout = createCityLayout()
const BLOCK_HASH = layoutHash(layout)

function planFor(eraId: EraId, options: { readonly night?: boolean; readonly qualityTier?: 'high' | 'low' } = {}): BuildingPlan {
  return applyEra(eraId, { layout, ...options })
}

describe('buildings layer over the real block', () => {
  it('resolves every parcel exactly once, inside its own footprint', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.buildings.length, eraId).toBe(layout.parcels.length)
      for (const building of plan.buildings) {
        const parcel = layout.parcels.find((candidate) => candidate.id === building.parcelId)
        expect(parcel, `${eraId} ${building.id}`).toBeDefined()
        if (parcel === undefined) {
          continue
        }
        expect(building.footprint.min.x).toBeGreaterThanOrEqual(parcel.footprint.min.x - 1e-6)
        expect(building.footprint.max.x).toBeLessThanOrEqual(parcel.footprint.max.x + 1e-6)
        expect(building.footprint.min.z).toBeGreaterThanOrEqual(parcel.footprint.min.z - 1e-6)
        expect(building.footprint.max.z).toBeLessThanOrEqual(parcel.footprint.max.z + 1e-6)
        for (const bay of parcel.bays) {
          // The ground floor is left clear: no window pane sits in the bay band.
          expect(building.storefrontClearance, `${eraId} ${bay.name}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps the frozen block identical while the dressing changes', () => {
    for (const eraId of ERA_IDS) {
      expect(layoutHash(layout), eraId).toBe(BLOCK_HASH)
    }
  })

  it('makes every adjacent pair measurably different', () => {
    const plans = ERA_IDS.map((eraId) => planFor(eraId))
    for (let index = 1; index < plans.length; index += 1) {
      const previous = plans[index - 1]
      const current = plans[index]
      expect(previous, `plan ${index}`).toBeDefined()
      expect(current, `plan ${index}`).toBeDefined()
      if (previous === undefined || current === undefined) {
        continue
      }
      const label = `${ERA_IDS[index - 1]} -> ${ERA_IDS[index]}`
      expect(current.stats.totalFloors, label).not.toBe(previous.stats.totalFloors)
      expect(current.stats.maxHeight, label).not.toBe(previous.stats.maxHeight)
      expect(current.stats.footprintArea, label).not.toBe(previous.stats.footprintArea)
      expect(current.stats.windowCount, label).not.toBe(previous.stats.windowCount)
      expect(current.style, label).not.toBe(previous.style)
    }
  })

  it('carries the period facade detail and roof kits', () => {
    const cityHall = planFor('1945')
    expect(cityHall.stats.hasMasonryCoursing).toBe(true)
    expect(cityHall.stats.chimneyCount).toBeGreaterThan(0)
    expect(cityHall.stats.waterTankCount).toBeGreaterThan(0)
    expect(cityHall.stats.fireEscapeCount).toBeGreaterThan(0)

    const eighties = planFor('1985')
    expect(eighties.stats.hasExposedStructure).toBe(true)
    expect(eighties.stats.acBoxCount).toBeGreaterThan(0)

    const noughties = planFor('2005')
    expect(noughties.stats.hasSpandrelBands).toBe(true)
    expect(noughties.stats.penthouseCount).toBeGreaterThan(0)

    expect(planFor('2025').stats.balconyCount).toBeGreaterThan(0)
    expect(ERA_BUILDING_TABLES['2025'].archetypes).toEqual([...getEra('2025').contentTags.buildings])
  })

  it('rebuilds identically and settles exactly on the direct switch', () => {
    for (const eraId of ERA_IDS) {
      expect(buildingPlanHash(planFor(eraId)), eraId).toBe(buildingPlanHash(planFor(eraId)))
    }
    const staged = applyEraTransition({ from: '1945', to: '2025', t: 1 }, { layout })
    expect(buildingPlanHash(staged.plan)).toBe(buildingPlanHash(planFor('2025')))
    const instant = applyEraTransition(
      { from: '1945', to: '2025', t: 0.5 },
      { layout, reducedMotion: true },
    )
    expect(instant.instant).toBe(true)
    expect(instant.mix).toBe(1)
  })

  it('paints one group per parcel with windows and roof instances', () => {
    const plan = planFor('2005')
    const group = createBuildingsGroup(plan)
    const summary = summariseBuildingsGroup(group)
    expect(group.children.length).toBe(layout.parcels.length)
    expect(summary.buildings).toBe(plan.stats.buildingCount)
    expect(summary.vacantLots).toBe(plan.stats.vacantLotCount)
    expect(summary.constructionSites).toBe(plan.stats.constructionSiteCount)
    expect(summary.windowInstances).toBeGreaterThan(0)
    expect(summary.roofInstances).toBeGreaterThan(0)
    disposeBuildingsGroup(group)
  })

  it('lights the windows of a night era and leaves a day era dark', () => {
    const night = applyEra('1985', { layout, night: true })
    expect(night.stats.litWindowCount).toBe(night.stats.windowCount)
    const day = applyEra('1985', { layout, night: false })
    expect(day.stats.litWindowCount).toBe(0)
  })
})
