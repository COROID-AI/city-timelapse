/**
 * Unit contract of the era building tables and generators.
 *
 * Everything here is pure data plus the real block layout: no three.js, no DOM,
 * no browser. The suite pins down the properties the acceptance criteria name —
 * one state per parcel with no gaps or overlaps, five measurably different
 * massing distributions, era facade detail, era roof kits, requested
 * vacancy/construction states, night-only window glow, and determinism from the
 * block seed plus the era id.
 */

import { describe, expect, it } from 'vitest'
import { ERA_DEFINITIONS, ERA_IDS, getEra, type EraId } from '../../src/era'
import { createRng } from '../../src/lib/rng'
import {
  ADD_ON_KINDS,
  BUILDING_ERA_IDS,
  BUILDING_MATERIAL_KEYS,
  BUILDING_STATES,
  BUILDING_TABLES,
  FACADE_STYLES,
  assignParcelStates,
  blendBuildingStats,
  buildingSetFingerprint,
  buildingTriangleBudget,
  createCityLayout,
  eraNightFlag,
  getBuildingTable,
  materialSpecsFor,
  planBuildingSet,
  plotRect,
  plotRectContains,
  plotRectsOverlap,
  stateQuota,
  validateBuildingTables,
} from '../../src/city/buildings'

const LAYOUT = createCityLayout()

/** Add-ons each era's kit must contain, straight from the acceptance criteria. */
const ROOF_KIT_VOCABULARY: Readonly<Record<EraId, readonly string[]>> = {
  '1945': ['coal-chimney', 'water-tank', 'fire-escape'],
  '1965': ['roof-signage', 'roof-vent'],
  '1985': ['window-ac', 'antenna', 'satellite-dish', 'roof-ac-unit'],
  '2005': ['mechanical-penthouse', 'roof-deck'],
  '2025': ['solar-array', 'green-roof', 'roof-deck'],
}

const MASONRY_ERAS: readonly EraId[] = ['1945', '1965']
const BANDED_ERAS: readonly EraId[] = ['1985', '2005']

const PLANS: Readonly<Record<EraId, ReturnType<typeof planBuildingSet>>> = Object.fromEntries(
  BUILDING_ERA_IDS.map((eraId) => [eraId, planBuildingSet({ layout: LAYOUT, eraId })]),
) as Readonly<Record<EraId, ReturnType<typeof planBuildingSet>>>

function planFor(eraId: EraId): ReturnType<typeof planBuildingSet> {
  const plan = PLANS[eraId]
  if (plan === undefined) {
    throw new Error(`No plan for ${eraId}`)
  }
  return plan
}

function cellRect(parcelId: string): ReturnType<typeof plotRect> {
  const parcel = LAYOUT.parcels.find((candidate) => candidate.id === parcelId)
  if (parcel === undefined) {
    throw new Error(`Unknown parcel ${parcelId}`)
  }
  return plotRect(parcel.cell.min.x, parcel.cell.min.z, parcel.cell.max.x, parcel.cell.max.z)
}

describe('era building tables', () => {
  it('ships exactly one table per era, in timeline order', () => {
    expect(BUILDING_ERA_IDS).toEqual([...ERA_IDS])
    expect(Object.keys(BUILDING_TABLES)).toHaveLength(ERA_DEFINITIONS.length)
    for (const eraId of BUILDING_ERA_IDS) {
      const table = getBuildingTable(eraId)
      expect(table.eraId).toBe(eraId)
      expect(table.year).toBe(getEra(eraId).year)
      expect(table.roof.addOns.length).toBeGreaterThan(0)
    }
  })

  it('passes its own structural validation', () => {
    expect(validateBuildingTables()).toEqual([])
  })

  it('gives every era a distinct massing family and facade language', () => {
    const families = BUILDING_ERA_IDS.map((eraId) => BUILDING_TABLES[eraId].massing.family)
    const styles = BUILDING_ERA_IDS.map((eraId) => BUILDING_TABLES[eraId].facade.style)
    expect(new Set(families).size).toBe(families.length)
    expect(new Set(styles).size).toBe(styles.length)
    expect(styles.every((style) => FACADE_STYLES.includes(style))).toBe(true)
  })

  it('never shares a building palette between two eras', () => {
    const palettes = BUILDING_ERA_IDS.map((eraId) => JSON.stringify(BUILDING_TABLES[eraId].palette))
    expect(new Set(palettes).size).toBe(palettes.length)
    // The palette is read from the era registry, not copied.
    for (const eraId of BUILDING_ERA_IDS) {
      expect(BUILDING_TABLES[eraId].palette.mass).toBe(getEra(eraId).palette.buildingBase)
      expect(BUILDING_TABLES[eraId].palette.glow).toBe(getEra(eraId).lighting.artificialLightColor)
    }
  })

  it('switches window glow on exactly when the era says it is night', () => {
    const nightEras = BUILDING_ERA_IDS.filter((eraId) => eraNightFlag(eraId))
    expect(nightEras).toEqual(['1985'])
    expect(eraNightFlag('2025')).toBe(false)
    expect(eraNightFlag('1945')).toBe(false)
    for (const eraId of BUILDING_ERA_IDS) {
      const table = BUILDING_TABLES[eraId]
      const specs = materialSpecsFor(table)
      expect(table.night).toBe(eraNightFlag(eraId))
      if (table.night) {
        expect(specs.glass.emissiveIntensity).toBeGreaterThan(0)
        expect(table.litWindowFraction).toBeGreaterThan(0)
      } else {
        expect(specs.glass.emissiveIntensity).toBe(0)
        expect(table.litWindowFraction).toBe(0)
      }
      expect(specs.mass.emissiveIntensity).toBe(0)
    }
  })

  it('declares the era roof kit vocabulary the acceptance criteria name', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const kinds = BUILDING_TABLES[eraId].roof.addOns.map((spec) => spec.kind)
      for (const expected of ROOF_KIT_VOCABULARY[eraId]) {
        expect(kinds, `${eraId} places ${expected}`).toContain(expected)
      }
      expect(kinds.every((kind) => ADD_ON_KINDS.includes(kind))).toBe(true)
    }
  })

  it('requests vacancy and construction only where the tables ask for it', () => {
    expect(BUILDING_TABLES['1945'].vacancy).toBe(0)
    expect(BUILDING_TABLES['1945'].construction).toBe(0)
    for (const eraId of ['1965', '1985', '2005', '2025'] as const) {
      expect(BUILDING_TABLES[eraId].construction).toBeGreaterThan(0)
    }
    expect(BUILDING_TABLES['1985'].vacancy).toBeGreaterThan(0)
    expect(stateQuota(0, 16)).toBe(0)
    expect(stateQuota(0.02, 16)).toBe(1)
    expect(stateQuota(1, 16)).toBe(16)
    expect(stateQuota(0.5, 16)).toBe(8)
  })
})

describe('one state per parcel', () => {
  it('resolves every parcel exactly once for every era', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.plots).toHaveLength(LAYOUT.parcels.length)
      const ids = plan.plots.map((plot) => plot.parcelId)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(LAYOUT.parcels.map((parcel) => parcel.id).sort())
      for (const plot of plan.plots) {
        expect(BUILDING_STATES).toContain(plot.state)
        expect(plot.eraId).toBe(eraId)
      }
      const counted =
        plan.stats.buildingCount + plan.stats.vacantLotCount + plan.stats.constructionCount
      expect(counted).toBe(LAYOUT.parcels.length)
      expect(plan.stats.parcelCount).toBe(LAYOUT.parcels.length)
    }
  })

  it('keeps every footprint inside its own parcel, with no overlaps', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const plan = planFor(eraId)
      for (const plot of plan.plots) {
        expect(
          plotRectContains(cellRect(plot.parcelId), plot.footprint),
          `${plot.parcelId} footprint inside its cell`,
        ).toBe(true)
        if (plot.state === 'building') {
          expect(plot.height).toBeGreaterThan(0)
          expect(plot.floors).toBeGreaterThanOrEqual(1)
          expect(plot.masses.length).toBeGreaterThan(0)
          for (const mass of plot.masses) {
            expect(mass.size.width).toBeGreaterThan(0)
            expect(mass.size.height).toBeGreaterThan(0)
            expect(mass.size.depth).toBeGreaterThan(0)
          }
        } else {
          expect(plot.masses).toHaveLength(0)
          expect(plot.stateDetail.primitives.length).toBeGreaterThan(0)
          expect(plot.stateDetail.state).toBe(plot.state)
        }
      }
      for (let i = 0; i < plan.plots.length; i += 1) {
        for (let j = i + 1; j < plan.plots.length; j += 1) {
          const a = plan.plots[i]
          const b = plan.plots[j]
          if (a === undefined || b === undefined) continue
          expect(plotRectsOverlap(a.footprint, b.footprint), `${a.parcelId}/${b.parcelId}`).toBe(false)
        }
      }
    }
  })

  it('honours the eras that ask for vacant lots and construction sites', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const table = BUILDING_TABLES[eraId]
      const stats = planFor(eraId).stats
      const construction = stateQuota(table.construction, LAYOUT.parcels.length)
      const vacancy = Math.min(
        stateQuota(table.vacancy, LAYOUT.parcels.length),
        LAYOUT.parcels.length - construction,
      )
      if (table.vacancy > 0) {
        expect(stats.vacantLotCount, `${eraId} shows a vacant lot`).toBeGreaterThan(0)
      } else {
        expect(stats.vacantLotCount).toBe(0)
      }
      if (table.construction > 0) {
        expect(stats.constructionCount, `${eraId} shows a construction site`).toBeGreaterThan(0)
      } else {
        expect(stats.constructionCount).toBe(0)
      }
      // The quota is exact, not merely non-zero.
      expect(stats.constructionCount).toBe(construction)
      expect(stats.vacantLotCount).toBe(vacancy)
      expect(stats.roofKitCount).toBe(stats.buildingCount)
    }
  })

  it('assigns the same states for the same seed and different states for another', () => {
    const table = getBuildingTable('1985')
    const first = assignParcelStates(LAYOUT.parcels, table, createRng('city-block:states'))
    const second = assignParcelStates(LAYOUT.parcels, table, createRng('city-block:states'))
    const other = assignParcelStates(LAYOUT.parcels, table, createRng('another-block:states'))
    expect([...first.entries()]).toEqual([...second.entries()])
    expect(first.size).toBe(LAYOUT.parcels.length)
    expect([...other.values()]).toHaveLength(LAYOUT.parcels.length)
    expect([...other.values()].filter((state) => state === 'construction').length).toBe(
      stateQuota(table.construction, LAYOUT.parcels.length),
    )
  })
})

describe('era massing', () => {
  it('produces measurably different height, floor and footprint distributions', () => {
    const heights = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.heightMean)
    const floors = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.floorsMean)
    const footprints = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.footprintAreaMean)

    for (let index = 1; index < BUILDING_ERA_IDS.length; index += 1) {
      const previous = BUILDING_ERA_IDS[index - 1]
      const current = BUILDING_ERA_IDS[index]
      expect(
        (heights[index] ?? 0) - (heights[index - 1] ?? 0),
        `${previous} -> ${current} height`,
      ).toBeGreaterThan(1)
      expect(
        (floors[index] ?? 0) - (floors[index - 1] ?? 0),
        `${previous} -> ${current} floors`,
      ).toBeGreaterThan(0.5)
      expect(
        Math.abs((footprints[index] ?? 0) - (footprints[index - 1] ?? 0)),
        `${previous} -> ${current} footprint`,
      ).toBeGreaterThan(5)
    }
  })

  it('grows monotonically from low-rise masonry to contemporary towers', () => {
    const heights = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.heightMean)
    const floors = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.floorsMean)
    expect(heights).toEqual([...heights].sort((left, right) => left - right))
    expect(floors).toEqual([...floors].sort((left, right) => left - right))
    expect(planFor('1945').stats.heightMax).toBeLessThan(planFor('2025').stats.heightMin)
    expect(planFor('2025').stats.heightMax).toBeGreaterThan(60)
    expect(planFor('1945').stats.floorsMax).toBeLessThanOrEqual(8)
    expect(planFor('2025').stats.floorsMax).toBeGreaterThanOrEqual(15)
  })

  it('keeps every era inside the shared triangle and draw-call budget', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const stats = planFor(eraId).stats
      expect(stats.triangleEstimate, `${eraId} triangles`).toBeLessThanOrEqual(
        buildingTriangleBudget('high'),
      )
      expect(stats.drawCallEstimate, `${eraId} draw calls`).toBeLessThanOrEqual(200)
      expect(stats.triangleEstimate).toBeGreaterThan(1000)
      expect(stats.meshCount).toBeGreaterThan(0)
    }
    expect(planFor('2025').stats.triangleEstimate).toBeGreaterThan(
      planFor('1945').stats.triangleEstimate * 2,
    )
  })
})

describe('era facade detail', () => {
  it('carries the window grid, coursing and band language of each period', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const stats = planFor(eraId).stats
      const facade = BUILDING_TABLES[eraId].facade
      expect(stats.windowCount, `${eraId} windows`).toBeGreaterThan(500)
      if (MASONRY_ERAS.includes(eraId)) {
        expect(stats.masonryCourseCount, `${eraId} coursing`).toBeGreaterThan(0)
        expect(stats.spandrelBandCount).toBe(0)
      }
      if (BANDED_ERAS.includes(eraId)) {
        expect(stats.spandrelBandCount, `${eraId} spandrels`).toBeGreaterThan(0)
        expect(stats.mullionCount, `${eraId} mullions`).toBeGreaterThan(0)
        expect(stats.masonryCourseCount).toBe(0)
      }
      expect(facade.windowWidth).toBeGreaterThan(0.5)
      expect(facade.windowHeight).toBeGreaterThan(1)
    }
    expect(planFor('2025').stats.balconyCount).toBeGreaterThan(0)
    for (const plot of planFor('2025').plots) {
      if (plot.state === 'building') {
        expect(plot.facade.exposedFrame).toBe(true)
      }
    }
    for (const plot of planFor('1945').plots) {
      if (plot.state === 'building') {
        expect(plot.facade.exposedFrame).toBe(false)
        expect(plot.facade.grid.rows).toBeGreaterThan(0)
      }
    }
  })

  it('sizes the window grid to the era proportions', () => {
    const widths = BUILDING_ERA_IDS.map((eraId) => BUILDING_TABLES[eraId].facade.windowWidth)
    const heights = BUILDING_ERA_IDS.map((eraId) => BUILDING_TABLES[eraId].facade.windowHeight)
    expect(widths).toEqual([...widths].sort((left, right) => left - right))
    expect(heights[heights.length - 1]).toBeGreaterThan(heights[0] ?? 0)
    const windowCounts = BUILDING_ERA_IDS.map((eraId) => planFor(eraId).stats.windowCount)
    expect(new Set(windowCounts).size).toBe(windowCounts.length)
  })

  it('leaves the ground-floor frontage clear for the storefront layer', () => {
    const anchors = new Set(LAYOUT.anchors.map((anchor) => anchor.name))
    const baysByParcel = new Map(LAYOUT.parcels.map((parcel) => [parcel.id, parcel.bays]))
    let checked = 0
    for (const eraId of BUILDING_ERA_IDS) {
      for (const plot of planFor(eraId).plots) {
        if (plot.state !== 'building') {
          expect(plot.frontage).toHaveLength(0)
          continue
        }
        expect(plot.facade.groundFloorClear).toBe(true)
        expect(plot.frontage.length).toBeGreaterThanOrEqual(
          (baysByParcel.get(plot.parcelId) ?? []).length,
        )
        for (const clearance of plot.frontage) {
          expect(anchors.has(clearance.anchor), `${clearance.anchor} exists`).toBe(true)
          expect(clearance.setback).toBeGreaterThanOrEqual(0)
          expect(clearance.height).toBeGreaterThanOrEqual(4.6)
          expect(clearance.width).toBeGreaterThan(0)
          checked += 1
        }
        for (const anchorName of plot.anchorNames) {
          expect(anchors.has(anchorName), `${anchorName} exists in the layout`).toBe(true)
        }
      }
      expect(planFor(eraId).anchorsUsed.every((name) => anchors.has(name))).toBe(true)
    }
    expect(checked).toBeGreaterThan(200)
  })

  it('attaches era add-ons only where the era vocabulary allows them', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const stats = planFor(eraId).stats
      for (const kind of [
        'coal-chimney',
        'water-tank',
        'fire-escape',
        'window-ac',
        'solar-array',
        'green-roof',
      ] as const) {
        if (!ROOF_KIT_VOCABULARY[eraId].includes(kind)) {
          expect(stats.addOnsByKind[kind], `${eraId} has no ${kind}`).toBe(0)
        }
      }
      const placed = planFor(eraId).plots.flatMap((plot) => plot.addOns)
      expect(placed.length).toBe(stats.addOnCount)
      for (const addOn of placed) {
        expect(addOn.size.width).toBeGreaterThan(0)
        expect(addOn.size.height).toBeGreaterThan(0)
        expect(addOn.centre.y).toBeGreaterThan(0)
        expect(addOn.attach === 'roof' || addOn.attach === 'facade').toBe(true)
      }
    }
    expect(planFor('2025').stats.roofKitsByKit['green-solar']).toBe(
      planFor('2025').stats.buildingCount,
    )
    expect(planFor('1945').stats.roofKitsByKit['masonry-watertank']).toBe(
      planFor('1945').stats.buildingCount,
    )
  })
})

describe('determinism and ergonomics', () => {
  it('is reproducible from the block seed plus the era id', () => {
    for (const eraId of BUILDING_ERA_IDS) {
      const first = planBuildingSet({ layout: LAYOUT, eraId })
      const second = planBuildingSet({ layout: LAYOUT, eraId })
      expect(buildingSetFingerprint(first)).toBe(buildingSetFingerprint(second))
      expect(first.stats).toEqual(second.stats)
    }
    const otherSeed = planBuildingSet({ layout: LAYOUT, eraId: '1985', seed: 'another-block' })
    expect(buildingSetFingerprint(otherSeed)).not.toBe(buildingSetFingerprint(planFor('1985')))
    expect(buildingSetFingerprint(planBuildingSet({ layout: LAYOUT, eraId: '2005' }))).not.toBe(
      buildingSetFingerprint(planFor('1965')),
    )
  })

  it('accepts an era definition as well as an era id', () => {
    const fromDefinition = planBuildingSet({ layout: LAYOUT, eraId: getEra('2025') })
    expect(buildingSetFingerprint(fromDefinition)).toBe(buildingSetFingerprint(planFor('2025')))
    expect(fromDefinition.year).toBe(2025)
    expect(fromDefinition.night).toBe(false)
  })

  it('blends era statistics to the from, middle and to targets', () => {
    const from = planFor('1945').stats
    const to = planFor('2025').stats
    const atZero = blendBuildingStats(from, to, 0)
    const atHalf = blendBuildingStats(from, to, 0.5)
    const atOne = blendBuildingStats(from, to, 1)
    expect(atZero.heightMean).toBe(from.heightMean)
    expect(atZero.windowCount).toBe(from.windowCount)
    expect(atOne.heightMean).toBe(to.heightMean)
    expect(atOne.windowCount).toBe(to.windowCount)
    expect(atHalf.heightMean).toBeGreaterThan(from.heightMean)
    expect(atHalf.heightMean).toBeLessThan(to.heightMean)
    expect(atHalf.windowCount).toBeGreaterThan(from.windowCount)
    expect(atHalf.windowCount).toBeLessThan(to.windowCount)
    // Out-of-range weights clamp rather than extrapolate.
    expect(blendBuildingStats(from, to, -1).heightMean).toBe(from.heightMean)
    expect(blendBuildingStats(from, to, 2).heightMean).toBe(to.heightMean)
    expect(atHalf.roofKitsByKit['green-solar']).toBe(
      (from.roofKitsByKit['green-solar'] + to.roofKitsByKit['green-solar']) / 2,
    )
    expect(atZero.eraId).toBe('1945')
    expect(atOne.eraId).toBe('2025')
  })

  it('exposes the material keys and parameter sets the layer mounts with', () => {
    expect(BUILDING_MATERIAL_KEYS).toHaveLength(8)
    const specs = materialSpecsFor(getBuildingTable('1985'))
    expect(specs.mass.roughness).toBeGreaterThan(0)
    expect(specs.glass.metalness).toBeGreaterThan(specs.mass.metalness)
    expect(materialSpecsFor(getBuildingTable('2005')).glass.emissiveIntensity).toBe(0)
    expect(materialSpecsFor(getBuildingTable('1985')).glass.emissiveIntensity).toBeGreaterThan(0)
  })
})
