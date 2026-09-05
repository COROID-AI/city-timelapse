import { describe, expect, it } from 'vitest'
import { getEraData } from '../../era-data'
import { VEHICLE_ERA_IDS } from './lanes'
import {
  LANE_CONSTANTS,
  buildTrafficPlan,
  laneCountsForEra,
  laneForKind,
  vehicleCountForDensity,
} from './traffic-data'

describe('traffic density per era (EraData-driven)', () => {
  it('matches EraData traffic density: higher density → more vehicles', () => {
    const eras = VEHICLE_ERA_IDS
    const counts = eras.map((era) => ({
      era,
      density: getEraData(era).vehicles.density,
      planCount: buildTrafficPlan(era).count,
    }))
    // The fleet count monotonically increases through the five brief eras.
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i].density).toBeGreaterThanOrEqual(counts[i - 1].density)
      if (counts[i].density > counts[i - 1].density) {
        expect(counts[i].planCount).toBeGreaterThanOrEqual(counts[i - 1].planCount)
      }
    }
    // 2025 has visibly more vehicles than 1945.
    expect(buildTrafficPlan('2025').count).toBeGreaterThan(buildTrafficPlan('1945').count)
  })

  it('derives count from density via the shared capacity constant', () => {
    const density = getEraData('1985').vehicles.density
    const expected = Math.floor(density * LANE_CONSTANTS.LANE_METERS_PER_DENSITY / 14)
    const capped = Math.min(LANE_CONSTANTS.MAX_VEHICLES, Math.max(LANE_CONSTANTS.MIN_VEHICLES, expected))
    expect(vehicleCountForDensity(density)).toBe(capped)
    expect(buildTrafficPlan('1985').count).toBe(capped)
  })

  it('keeps every era fleet within the pooled-instance budget', () => {
    for (const era of VEHICLE_ERA_IDS) {
      expect(buildTrafficPlan(era).count).toBeLessThanOrEqual(LANE_CONSTANTS.MAX_VEHICLES)
      expect(buildTrafficPlan(era).count).toBeGreaterThan(0)
    }
  })

  it('assigns vehicles to lanes by kind with stable round-robin', () => {
    const profile = buildTrafficPlan('2025')
    const busLane = profile.lanes.lanes.find((l) => l.kind === 'bus')
    const bikeLane = profile.lanes.lanes.find((l) => l.kind === 'bike')
    expect(busLane).toBeDefined()
    expect(bikeLane).toBeDefined()

    const auto1 = laneForKind(profile.lanes.lanes, 'auto', 0)
    const auto2 = laneForKind(profile.lanes.lanes, 'auto', 1)
    expect(auto1.kind).toBe('auto')
    expect(auto2.kind).toBe('auto')

    const bus1 = laneForKind(profile.lanes.lanes, 'bus', 0)
    const bike1 = laneForKind(profile.lanes.lanes, 'bike', 0)
    expect(bus1.kind).toBe('bus')
    expect(bike1.kind).toBe('bike')
  })
})

describe('lane counts per era', () => {
  it('has no dedicated lanes before 2025', () => {
    for (const era of ['1945', '1965', '1985', '2005'] as const) {
      const counts = laneCountsForEra(era)
      expect(counts.bus).toBe(0)
      expect(counts.bike).toBe(0)
      expect(counts.auto).toBe(8)
    }
  })

  it('has 6 auto + 2 bus + 4 bike in 2025', () => {
    const counts = laneCountsForEra('2025')
    expect(counts.auto).toBe(6)
    expect(counts.bus).toBe(2)
    expect(counts.bike).toBe(4)
  })
})

describe('lane usage shifts per era', () => {
  it('uses only auto lanes except 2025 (bike/bus usage)', () => {
    for (const era of VEHICLE_ERA_IDS) {
      const usage = buildTrafficPlan(era).laneUsage
      if (era === '2025') {
        expect(usage.bike).toBeGreaterThan(0)
        expect(usage.bus).toBeGreaterThan(0)
      } else {
        expect(usage.bike).toBe(0)
        expect(usage.bus).toBe(0)
      }
      expect(usage.auto).toBeGreaterThan(0)
    }
  })
})

describe('per-era style mix is data-driven', () => {
  it('1945 includes the vintage trolley; 2025 includes EV/bike/bus/robot styles', () => {
    const p1945 = buildTrafficPlan('1945')
    expect(p1945.styles).toContain('trolley')
    // The 1945 era data spins a trolley on the auto lane system (no dedicated lane).
    expect(p1945.vehicles.some((v) => v.style === 'trolley')).toBe(true)

    const p2025 = buildTrafficPlan('2025')
    expect(p2025.styles).toContain('evSedan')
    expect(p2025.styles).toContain('scooter')
    // Dedicated lane styles are reserved for their lanes.
    expect(p2025.vehicles.filter((v) => v.style === 'bike').length).toBeGreaterThanOrEqual(1)
    expect(p2025.vehicles.filter((v) => v.style === 'bus').length).toBeGreaterThanOrEqual(1)
  })
})