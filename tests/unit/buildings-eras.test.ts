/**
 * Unit contract for the era buildings layer.
 *
 * The layer is a deterministic generator plus a small painter, so the tests lock
 * down both halves: every parcel resolves to exactly one state, the era tables
 * make the five skylines measurably different, facade and roof detail follow the
 * period tables, and the three.js group the composition mounts carries the
 * counts it promises.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, type EraId } from '../../src/era'
import { createCityLayout } from '../../src/city/layout'
import {
  applyEra,
  applyEraTransition,
  applyProgressiveSwap,
  buildingPlanHash,
  buildingStatsRecord,
  createBuildingsGroup,
  disposeBuildingsGroup,
  ERA_BUILDING_TABLES,
  summariseBuildingsGroup,
} from '../../src/city/buildings'
import type { BuildingPlan } from '../../src/city/buildings'

const layout = createCityLayout()

function planFor(eraId: EraId, options: { readonly night?: boolean; readonly seed?: string } = {}): BuildingPlan {
  return applyEra(eraId, { layout, ...options })
}

/* ------------------------------------------------------------------------- *
 * Tables
 * ------------------------------------------------------------------------- */

describe('building era tables', () => {
  it('defines one row per era, in timeline order, with distinct massing', () => {
    expect(Object.keys(ERA_BUILDING_TABLES)).toEqual([...ERA_IDS])
    const styles = new Set(ERA_IDS.map((eraId) => ERA_BUILDING_TABLES[eraId].style))
    expect(styles.size).toBeGreaterThanOrEqual(4)
    for (const eraId of ERA_IDS) {
      const data = ERA_BUILDING_TABLES[eraId]
      expect(data.archetypes.length, eraId).toBeGreaterThan(0)
      expect(data.massing.maxFloors, eraId).toBeGreaterThan(data.massing.minFloors)
      expect(data.roof.length, eraId).toBeGreaterThan(0)
    }
  })

  it('gives every adjacent pair a different skyline', () => {
    const maxFloors = ERA_IDS.map((eraId) => ERA_BUILDING_TABLES[eraId].massing.maxFloors)
    for (let index = 1; index < maxFloors.length; index += 1) {
      expect(maxFloors[index], `era ${ERA_IDS[index]}`).not.toBe(maxFloors[index - 1])
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Parcel resolution
 * ------------------------------------------------------------------------- */

describe('parcel resolution', () => {
  it('resolves every parcel to exactly one state, with no gaps and no overlaps', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.buildings.length, eraId).toBe(layout.parcels.length)
      expect(plan.buildings.map((building) => building.id).sort()).toEqual(
        layout.parcels.map((parcel) => parcel.id).sort(),
      )
      expect(new Set(plan.buildings.map((building) => building.id)).size, eraId).toBe(
        layout.parcels.length,
      )
      for (const building of plan.buildings) {
        expect(['building', 'vacant-lot', 'construction'], building.id).toContain(building.state)
        // A built mass is strictly inside its own parcel footprint.
        const parcel = layout.parcels.find((candidate) => candidate.id === building.parcelId)
        expect(parcel, building.id).toBeDefined()
        if (parcel === undefined) {
          continue
        }
        expect(building.footprint.min.x).toBeGreaterThanOrEqual(parcel.footprint.min.x - 1e-6)
        expect(building.footprint.max.x).toBeLessThanOrEqual(parcel.footprint.max.x + 1e-6)
        expect(building.footprint.min.z).toBeGreaterThanOrEqual(parcel.footprint.min.z - 1e-6)
        expect(building.footprint.max.z).toBeLessThanOrEqual(parcel.footprint.max.z + 1e-6)
      }
      const counts =
        plan.stats.buildingCount + plan.stats.vacantLotCount + plan.stats.constructionSiteCount
      expect(counts, eraId).toBe(layout.parcels.length)
      expect(plan.stats.buildingCount, eraId).toBeGreaterThan(0)
    }
  })

  it('leaves the storefront band clear on every street-facing parcel', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      const facing = plan.buildings.filter((building) => building.facing.length > 0)
      expect(facing.length, eraId).toBeGreaterThan(0)
      for (const building of facing) {
        if (building.state !== 'building') {
          continue
        }
        expect(building.storefrontClearance, building.id).toBeGreaterThanOrEqual(
          building.groundFloorHeight,
        )
      }
    }
  })

  it('shows the vacancy and construction states the era tables request', () => {
    const cityHall = planFor('1945')
    expect(cityHall.stats.vacantLotCount).toBeGreaterThan(0)
    expect(cityHall.stats.constructionSiteCount).toBe(0)
    expect(planFor('1965').stats.constructionSiteCount).toBeGreaterThan(0)
    expect(planFor('2025').stats.constructionSiteCount).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------------- *
 * Determinism
 * ------------------------------------------------------------------------- */

describe('determinism', () => {
  it('rebuilds byte-identically for the same seed and differs for another', () => {
    for (const eraId of ERA_IDS) {
      const first = planFor(eraId)
      const second = planFor(eraId)
      expect(buildingPlanHash(first), eraId).toBe(buildingPlanHash(second))
      const other = applyEra(eraId, { layout: createCityLayout('another-city-block') })
      expect(buildingPlanHash(other), eraId).not.toBe(buildingPlanHash(first))
    }
  })

  it('never reads Math.random or the clock', () => {
    const originalRandom = Math.random
    const originalNow = Date.now
    const baseline = buildingPlanHash(planFor('1985'))
    try {
      Math.random = () => 0.123
      Date.now = () => 1
      expect(buildingPlanHash(planFor('1985'))).toBe(baseline)
    } finally {
      Math.random = originalRandom
      Date.now = originalNow
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Era difference
 * ------------------------------------------------------------------------- */

describe('era massing', () => {
  it('produces different height and floor distributions for every adjacent pair', () => {
    const plans = ERA_IDS.map((eraId) => planFor(eraId))
    for (let index = 1; index < plans.length; index += 1) {
      const previous = plans[index - 1]
      const current = plans[index]
      expect(previous, `plan ${index}`).toBeDefined()
      expect(current, `plan ${index}`).toBeDefined()
      if (previous === undefined || current === undefined) {
        continue
      }
      expect(current.stats.totalFloors, `${ERA_IDS[index - 1]} -> ${ERA_IDS[index]}`).not.toBe(
        previous.stats.totalFloors,
      )
      expect(current.stats.maxHeight).not.toBe(previous.stats.maxHeight)
      expect(current.stats.footprintArea).not.toBe(previous.stats.footprintArea)
    }
  })

  it('carries era facade detail: coursing, spandrel, structure and balconies', () => {
    const cityHall = planFor('1945')
    expect(cityHall.stats.hasMasonryCoursing).toBe(true)
    expect(cityHall.stats.masonryCourses).toBeGreaterThan(0)

    expect(planFor('1965').stats.hasMasonryCoursing).toBe(true)

    const eighties = planFor('1985')
    expect(eighties.stats.hasExposedStructure).toBe(true)

    const noughties = planFor('2005')
    expect(noughties.stats.hasSpandrelBands).toBe(true)

    const now = planFor('2025')
    expect(now.stats.balconyCount).toBeGreaterThan(0)
    expect(now.stats.windowCount).toBeGreaterThan(0)
  })

  it('renders the era roof kits', () => {
    const cityHall = planFor('1945')
    expect(cityHall.stats.chimneyCount).toBeGreaterThan(0)
    expect(cityHall.stats.waterTankCount).toBeGreaterThan(0)
    expect(cityHall.stats.fireEscapeCount).toBeGreaterThan(0)

    expect(planFor('1965').stats.signFrameCount).toBeGreaterThan(0)
    expect(planFor('1965').stats.ventCount).toBeGreaterThan(0)

    const eighties = planFor('1985')
    expect(eighties.stats.acBoxCount).toBeGreaterThan(0)
    expect(eighties.stats.satelliteDishCount).toBeGreaterThan(0)

    expect(planFor('2005').stats.penthouseCount).toBeGreaterThan(0)

    const now = planFor('2025')
    expect(now.stats.solarArrayCount + now.stats.greenRoofCount + now.stats.roofDeckCount).toBeGreaterThan(0)
  })

  it('lights windows only when the era is a night scene', () => {
    const day = applyEra('1985', { layout, night: false })
    expect(day.stats.litWindowCount).toBe(0)
    expect(day.buildings.every((building) => building.windowEmissive === 0)).toBe(true)
    const night = applyEra('1985', { layout, night: true })
    expect(night.stats.litWindowCount).toBeGreaterThan(0)
    expect(night.buildings.some((building) => building.windowEmissive > 0)).toBe(true)
  })
})

/* ------------------------------------------------------------------------- *
 * Transitions
 * ------------------------------------------------------------------------- */

describe('staged building changes', () => {
  it('settles exactly on the direct switch at t = 1', () => {
    const staged = applyEraTransition({ from: '1945', to: '2025', t: 1 }, { layout })
    expect(staged.resolvedEra).toBe('2025')
    expect(buildingPlanHash(staged.plan)).toBe(buildingPlanHash(applyEra('2025', { layout })))
  })

  it('collapses to one step under reduced motion', () => {
    const half = applyEraTransition(
      { from: '1945', to: '2025', t: 0.4 },
      { layout, reducedMotion: true },
    )
    expect(half.instant).toBe(true)
    expect(half.mix).toBe(0)
    const settled = applyEraTransition(
      { from: '1945', to: '2025', t: 0.6 },
      { layout, reducedMotion: true },
    )
    expect(settled.mix).toBe(1)
    expect(settled.resolvedEra).toBe('2025')
  })
})

/* ------------------------------------------------------------------------- *
 * Painter
 * ------------------------------------------------------------------------- */

describe('scene painter', () => {
  it('builds one group per parcel with windows and roof instances', () => {
    const plan = planFor('2005')
    const group = createBuildingsGroup(plan)
    expect(group.name).toBe('era-buildings')
    expect(group.children.length).toBe(layout.parcels.length)
    const summary = summariseBuildingsGroup(group)
    expect(summary.buildings).toBe(plan.stats.buildingCount)
    expect(summary.windowInstances).toBeGreaterThan(0)
    expect(summary.roofInstances).toBeGreaterThan(0)
    expect(summary.meshes).toBeGreaterThan(0)
    expect(summary.triangles).toBeGreaterThan(0)
    disposeBuildingsGroup(group)
  })

  it('grows and shrinks the two eras during a staged swap', () => {
    const from = createBuildingsGroup(planFor('1945'))
    const to = createBuildingsGroup(planFor('2025'))
    applyProgressiveSwap(from, to, 0.5)
    expect(from.children.every((child) => Math.abs(child.scale.y - 0.5) < 1e-6)).toBe(true)
    expect(to.children.every((child) => Math.abs(child.scale.y - 0.5) < 1e-6)).toBe(true)
    applyProgressiveSwap(from, to, 1)
    expect(from.visible).toBe(false)
    expect(to.visible).toBe(true)
    disposeBuildingsGroup(from)
    disposeBuildingsGroup(to)
  })

  it('publishes a numeric statistics record', () => {
    const record = buildingStatsRecord(planFor('2025').stats)
    for (const [key, value] of Object.entries(record)) {
      expect(Number.isFinite(value), key).toBe(true)
    }
    expect(record['parcelCount']).toBe(layout.parcels.length)
  })
})
