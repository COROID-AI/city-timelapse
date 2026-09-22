/**
 * Unit contract of the era vehicle layer.
 *
 * The acceptance criteria for this task are data and motion properties, so the
 * tests are too:
 *
 * - every era ships a validated fleet table that agrees with the era registry
 *   (density, cruising speed, lane count, required models, palette colours);
 * - the five censuses, marking signatures and traffic counts are all distinct,
 *   and micro-mobility only appears where the table enables it;
 * - kinematic path following keeps every vehicle on its own spline at the right
 *   heading and spacing across a simulated 30-second loop, with no overlap;
 * - parked vehicles fill real parking anchors at the era's occupancy;
 * - lights follow the era's lighting and night flag;
 * - the SFX stream is a documented, rate-limited set of horn, engine, bell,
 *   whine and squeal triggers;
 * - `applyEraTransition` cross-fades and lands exactly on its destination,
 *   switching instantly under reduced motion.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LAYOUT_SEED,
  MARKING_LIFT,
  classifyGround,
  generateBlock,
  splinePoseAt,
  streetByName,
} from '../../src/city/layout'
import { ERA_IDS, ERA_DEFINITIONS, getEra, type EraId } from '../../src/era'
import {
  ERA_VEHICLE_TABLES,
  ERA_TABLE_IDS,
  VEHICLE_MODELS,
  MIN_GAP_M,
  LONG_VEHICLE_LANE_LIMIT_M,
  MARKING_FEATURE_KINDS,
  applyEra,
  applyEraTransition,
  censusOf,
  createVehicleLayer,
  eraPlan,
  paintedPieceCount,
  planSignature,
  poseVehicles,
  posesLeavingRoadway,
  resolveEraPlan,
  selectParkingBays,
  sfxIntervalFor,
  trafficLanes,
  validateEraVehicleTable,
  vehicleDistance,
  type SfxTrigger,
  type VehicleLayer,
  type VehiclePose,
} from '../../src/city/vehicles'

const LAYOUT = generateBlock(DEFAULT_LAYOUT_SEED)
const SPLINES = trafficLanes(LAYOUT)

/**
 * The four ground corners of a vehicle body, rotated into world space the same
 * way the renderer rotates it (local `+z` along the heading).
 */
function footprintCorners(vehicle: {
  readonly position: { readonly x: number; readonly z: number }
  readonly headingRad: number
  readonly lengthM: number
  readonly widthM: number
  readonly scale: number
}): { x: number; z: number }[] {
  const cos = Math.cos(vehicle.headingRad)
  const sin = Math.sin(vehicle.headingRad)
  const halfWidth = (vehicle.widthM * vehicle.scale) / 2
  const halfLength = (vehicle.lengthM * vehicle.scale) / 2
  return [
    [-halfWidth, -halfLength],
    [halfWidth, -halfLength],
    [halfWidth, halfLength],
    [-halfWidth, halfLength],
  ].map(([x, z]) => ({
    x: vehicle.position.x + (x ?? 0) * cos + (z ?? 0) * sin,
    z: vehicle.position.z - (x ?? 0) * sin + (z ?? 0) * cos,
  }))
}

function layerFor(eraId: EraId, extra: Partial<Parameters<typeof createVehicleLayer>[0]> = {}): VehicleLayer {
  return createVehicleLayer({ layout: LAYOUT, eraId, ...extra })
}

/** Clock readings used by the motion assertions. */
const CLOCK_SWEEP: readonly number[] = Array.from({ length: 31 }, (_, second) => second)

describe('era fleet tables', () => {
  it('ships one validated table per era that agrees with the era registry', () => {
    expect(ERA_TABLE_IDS).toEqual([...ERA_IDS])
    for (const eraId of ERA_IDS) {
      const table = ERA_VEHICLE_TABLES[eraId]
      expect(table, `table for ${eraId}`).toBeDefined()
      expect(validateEraVehicleTable(table), `problems for ${eraId}`).toEqual([])
      const era = getEra(eraId)
      expect(table.label).toBe(era.shortLabel)
      expect(table.laneConfiguration.totalLanes).toBe(era.traffic.laneCount)
      const census = censusOf(table)
      for (const modelKey of era.traffic.modelKeys) {
        expect(census, `${eraId} renders ${modelKey}`).toContain(modelKey)
      }
      for (const modelKey of census) {
        expect(VEHICLE_MODELS[modelKey], `${modelKey} exists in the catalogue`).toBeDefined()
      }
    }
  })

  it('defines an era-plausible census with the period extras the intent names', () => {
    const expectedExtras: Readonly<Record<EraId, readonly string[]>> = {
      '1945': ['sedan-1940s', 'panel-van-1940s', 'tram-car-1930s'],
      '1965': ['muscle-coupe-1965', 'city-bus-1960s', 'station-wagon-1965'],
      '1985': ['hatchback-1980s', 'panel-van-1985', 'checker-taxi-1985'],
      '2005': ['suv-2000s', 'minivan-2005', 'taxi-sedan-2005'],
      '2025': ['electric-crossover', 'electric-city-bus', 'cargo-e-bike', 'e-scooter-2025', 'delivery-robot-2025'],
    }
    const censuses = new Set<string>()
    for (const eraId of ERA_IDS) {
      const census = censusOf(ERA_VEHICLE_TABLES[eraId])
      expect(census.length).toBeGreaterThanOrEqual(5)
      for (const modelKey of expectedExtras[eraId]) {
        expect(census, `${eraId} features ${modelKey}`).toContain(modelKey)
      }
      censuses.add([...census].sort().join(','))
    }
    // Every period fields a different fleet.
    expect(censuses.size).toBe(ERA_IDS.length)
  })

  it('gates micro-mobility on the era table, not on the renderer', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const micro = layer.fleet.filter((instance) => instance.micro)
      if (ERA_VEHICLE_TABLES[eraId].microMobility) {
        expect(micro.length, `${eraId} has micro-mobility`).toBeGreaterThan(0)
      } else {
        expect(micro, `${eraId} has no micro-mobility`).toEqual([])
      }
      const microModels = micro.map((instance) => instance.modelKey)
      for (const instance of micro) {
        expect(instance.model.micro).toBe(true)
        void microModels
      }
    }
    // The 1945 street has no micro-mobility at all, while 2025 hosts all three
    // of its modes: bikes, scooters and delivery robots.
    const fleet1945 = layerFor('1945').fleet.map((instance) => instance.modelKey)
    for (const modelKey of ['e-scooter-2025', 'delivery-robot-2025', 'cargo-e-bike', 'bmx-bike-1985']) {
      expect(fleet1945, `1945 has no ${modelKey}`).not.toContain(modelKey)
    }
    const micro2025 = layerFor('2025')
      .fleet.filter((instance) => instance.micro)
      .map((instance) => instance.modelKey)
    expect(new Set(micro2025).size).toBeGreaterThan(1)
  })

  it('paints every vehicle from the era palette', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const palette = new Set(Object.values(era.palette))
      const layer = layerFor(eraId)
      for (const paint of layer.plan.paints) {
        expect(palette.has(paint), `${eraId} paint ${paint} comes from the palette`).toBe(true)
      }
      for (const instance of layer.fleet) {
        expect(palette.has(instance.paint), `${eraId} ${instance.modelKey} paint`).toBe(true)
      }
      for (const parked of layer.parked) {
        expect(palette.has(parked.paint), `${eraId} parked paint`).toBe(true)
      }
    }
  })

  it('scales the fleet with the shared quality tiers', () => {
    const high = layerFor('2005', { quality: 'high' })
    const low = layerFor('2005', { quality: 'low' })
    expect(low.movingCount).toBeLessThan(high.movingCount)
  })
})

describe('kinematic path following', () => {
  it('keeps every vehicle on its spline, with correct heading, over 30 simulated seconds', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const byId = new Map(layer.fleet.map((instance) => [instance.id, instance]))
      const byName = new Map(SPLINES.map((spline) => [spline.name, spline]))
      let moved = false
      for (const clock of CLOCK_SWEEP) {
        const poses = layer.poseAt(clock)
        expect(poses.length).toBe(layer.movingCount)
        for (const pose of poses) {
          const instance = byId.get(pose.id)
          const spline = byName.get(pose.splineName)
          expect(instance, `${pose.id} exists`).toBeDefined()
          expect(spline, `${pose.splineName} exists`).toBeDefined()
          if (instance === undefined || spline === undefined) {
            continue
          }
          const sample = splinePoseAt(spline, vehicleDistance(instance, clock))
          const lateral = Math.hypot(
            pose.position.x - sample.position.x,
            pose.position.z - sample.position.z,
          )
          expect(lateral).toBeCloseTo(Math.abs(instance.lateralOffset), 2)
          const dot = pose.heading.x * sample.tangent.x + pose.heading.z * sample.tangent.z
          expect(dot, `${eraId} ${pose.id} heading`).toBeGreaterThan(0.999)
          expect(pose.position.y).toBe(0)
          expect(pose.speedMps).toBeGreaterThanOrEqual(layer.plan.speedRangeMps[0])
          expect(pose.speedMps).toBeLessThanOrEqual(layer.plan.speedRangeMps[1])
          expect(posesLeavingRoadway([pose]), `${eraId} ${pose.id} leaves the road`).toEqual([])
          if (clock > 0 && pose.distance !== instance.startDistance) {
            moved = true
          }
        }
      }
      expect(moved, `${eraId} traffic actually moves`).toBe(true)
    }
  })

  it('wraps at the loop end with the spacing of the era intact', () => {
    const lengthByName = new Map(SPLINES.map((spline) => [spline.name, spline.length]))
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      for (const clock of [0, 7.5, 30, 121]) {
        const poses = layer.poseAt(clock)
        const groups = new Map<string, VehiclePose[]>()
        for (const pose of poses) {
          const key = `${pose.splineName}|${pose.model.micro ? 'micro' : 'lane'}`
          const list = groups.get(key)
          if (list === undefined) {
            groups.set(key, [pose])
          } else {
            list.push(pose)
          }
        }
        for (const [key, group] of groups) {
          const ordered = [...group].sort((left, right) => left.distance - right.distance)
          const loopLength = lengthByName.get(ordered[0]?.splineName ?? '') ?? 0
          expect(loopLength).toBeGreaterThan(0)
          for (let index = 0; index < ordered.length; index += 1) {
            const current = ordered[index]
            const next = ordered[(index + 1) % ordered.length]
            if (current === undefined || next === undefined) {
              continue
            }
            const gap =
              index + 1 < ordered.length
                ? next.distance - current.distance
                : loopLength - current.distance + next.distance
            const minimum = (current.lengthM + next.lengthM) / 2 + MIN_GAP_M - 0.05
            expect(gap, `${eraId} ${key} gap`).toBeGreaterThanOrEqual(minimum)
          }
        }
      }
    }
  })

  it('keeps long transit vehicles on the lanes whose corners can carry them', () => {
    const laneOffsetByName = new Map(SPLINES.map((spline) => [spline.name, spline.laneOffset ?? 0]))
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      for (const instance of layer.fleet) {
        if (instance.lengthM > LONG_VEHICLE_LANE_LIMIT_M) {
          expect(
            laneOffsetByName.get(instance.splineName) ?? 0,
            `${eraId} ${instance.modelKey} stays on a block-side lane`,
          ).toBeGreaterThanOrEqual(0)
        }
      }
    }
    // The 1945 streetcar is on the block-side kerb lane, at track gauge.
    const tram = layerFor('1945').fleet.find((instance) => instance.modelKey === 'tram-car-1930s')
    expect(tram).toBeDefined()
    expect(tram?.lateralOffset).toBe(0)
    expect(tram?.lengthM).toBeGreaterThan(LONG_VEHICLE_LANE_LIMIT_M)
  })

  it('is a pure function of the clock and the block seed', () => {
    const first = layerFor('1985')
    const second = layerFor('1985')
    expect(planSignature(first.plan)).toBe(planSignature(second.plan))
    expect(first.poseAt(12.5)).toEqual(second.poseAt(12.5))
    expect(first.markings.pieces).toEqual(second.markings.pieces)

    const otherSeed = layerFor('1985', { seed: 'another-block' })
    const paints = (layer: VehicleLayer): string => layer.fleet.map((instance) => instance.paint).join(',')
    expect(paints(otherSeed)).not.toBe(paints(first))

    // Rewinding the clock reproduces the earlier pose exactly.
    expect(first.poseAt(4)).toEqual(second.poseAt(4))
  })
})

describe('parking', () => {
  it('fills real parking bays at the era occupancy with parking models only', () => {
    const bays = LAYOUT.anchors.filter((anchor) => anchor.kind === 'parking-bay')
    expect(bays.length).toBeGreaterThan(0)
    expect(selectParkingBays(LAYOUT).length).toBe(bays.length)
    const parkedCounts = new Set<number>()
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const available = selectParkingBays(LAYOUT)
      expect(available.length).toBeGreaterThan(0)
      expect(layer.parked.length).toBe(Math.round(available.length * layer.plan.parkedRatio))
      expect(layer.parked.length).toBeGreaterThan(0)
      parkedCounts.add(layer.parked.length)

      const anchorsByName = new Map(bays.map((anchor) => [anchor.name, anchor]))
      const used = new Set<string>()
      for (const parked of layer.parked) {
        const anchor = anchorsByName.get(parked.anchorName)
        expect(anchor, `${parked.anchorName} is a real bay`).toBeDefined()
        expect(parked.position).toEqual(anchor?.position)
        expect(parked.model.parks).toBe(true)
        expect(parked.micro).toBe(false)
        used.add(parked.anchorName)
      }
      expect(used.size).toBe(layer.parked.length)
    }
    // Occupancy differs across the periods, as the era data demands.
    expect(parkedCounts.size).toBe(ERA_IDS.length)
  })

  it('parks parallel to the kerb, with the whole vehicle on the carriageway', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const anchorsByName = new Map(
        LAYOUT.anchors.filter((anchor) => anchor.kind === 'parking-bay').map((anchor) => [anchor.name, anchor]),
      )
      for (const parked of layer.parked) {
        const anchor = anchorsByName.get(parked.anchorName)
        expect(anchor, `${parked.anchorName} is a real bay`).toBeDefined()
        if (anchor === undefined || anchor.facing === null) {
          continue
        }
        const street = streetByName(anchor.facing)
        // Parallel to the kerb, facing the block-side travel direction.
        const along = Math.sin(parked.headingRad) * street.direction.x +
          Math.cos(parked.headingRad) * street.direction.z
        expect(along, `${parked.anchorName} faces the traffic direction`).toBeCloseTo(1, 6)
        // Every corner of the body stays on the road: nothing over the kerb.
        for (const corner of footprintCorners(parked)) {
          expect(
            classifyGround(corner.x, corner.z),
            `${parked.anchorName} corner (${corner.x}, ${corner.z})`,
          ).toBe('roadway')
        }
      }
    }
  })
})

describe('era road markings', () => {
  it('renders a distinct marking set per era, all on the road surface', () => {
    const signatures = new Set<string>()
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const expected = [...ERA_VEHICLE_TABLES[eraId].markings.features].sort()
      expect(Object.keys(layer.markings.groupCounts).sort(), `${eraId} marking groups`).toEqual(expected)
      expect(layer.markings.pieces.length).toBeGreaterThan(0)
      expect(layer.markings.groups.length).toBe(expected.length)
      for (const piece of layer.markings.pieces) {
        expect(classifyGround(piece.position.x, piece.position.z), `${piece.name} on the road`).toBe(
          'roadway',
        )
        expect(piece.lift).toBeGreaterThanOrEqual(MARKING_LIFT)
        expect(MARKING_FEATURE_KINDS).toContain(piece.group)
      }
      for (const group of layer.markings.groups) {
        expect(group.indices.length).toBeGreaterThan(0)
        expect(group.positions.length % 3).toBe(0)
        expect(group.triangles).toBe(group.indices.length / 3)
        expect(group.triangles).toBeGreaterThan(0)
      }
      signatures.add([...Object.keys(layer.markings.groupCounts)].sort().join('+'))
    }
    expect(signatures.size).toBe(ERA_IDS.length)
  })

  it('keeps the period paint story: rails in 1945, cycle and charging paint in 2025', () => {
    const ww2 = layerFor('1945')
    expect(paintedPieceCount(ww2.markings)).toBe(0)
    expect(ww2.markings.groupCounts['streetcar-rail'] ?? 0).toBeGreaterThan(0)
    expect(ww2.plan.markings.paintOpacity).toBe(0)

    const sixties = layerFor('1965')
    expect(sixties.markings.groupCounts['centre-line'] ?? 0).toBeGreaterThan(0)
    expect(sixties.markings.groupCounts['parking-lane'] ?? 0).toBeGreaterThan(0)
    expect(sixties.markings.groupCounts['streetcar-rail']).toBeUndefined()
    expect(sixties.markings.groupCounts['bike-lane']).toBeUndefined()

    const eighties = layerFor('1985')
    expect(eighties.markings.groupCounts['turn-arrow'] ?? 0).toBeGreaterThan(0)
    expect(eighties.markings.groupCounts['lane-division'] ?? 0).toBeGreaterThan(0)
    expect(eighties.plan.laneConfiguration.laneWidthM).toBeGreaterThan(
      sixties.plan.laneConfiguration.laneWidthM,
    )

    const twoThousands = layerFor('2005')
    expect(twoThousands.markings.groupCounts['bike-lane'] ?? 0).toBeGreaterThan(0)
    expect(twoThousands.markings.groupCounts['parking-lane'] ?? 0).toBeGreaterThan(0)
    expect(twoThousands.markings.groupCounts['charging-point']).toBeUndefined()

    const today = layerFor('2025')
    expect(today.markings.groupCounts['bike-lane'] ?? 0).toBeGreaterThan(0)
    expect(today.markings.groupCounts['charging-point'] ?? 0).toBeGreaterThan(0)
    expect(today.markings.groupCounts['pedestrian-priority'] ?? 0).toBeGreaterThan(0)
  })
})

describe('vehicle lights', () => {
  it('follows the era lighting and night flag', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const era = getEra(eraId)
      const night = era.lighting.sunElevationDeg < 0
      expect(layer.plan.lights.night, `${eraId} night`).toBe(night)
      if (night) {
        expect(layer.plan.lights.headlampIntensity).toBeGreaterThan(0)
        expect(layer.plan.lights.taillampIntensity).toBeGreaterThan(0)
      }
    }

    // Daylight periods drive unlit; night and dusk periods light up.
    for (const eraId of ['1945', '1965', '2005'] as const) {
      expect(layerFor(eraId).plan.lights.headlampIntensity, `${eraId} lamps off`).toBe(0)
    }
    const night = layerFor('1985')
    expect(night.plan.lights.night).toBe(true)
    expect(night.plan.lights.headlampIntensity).toBeGreaterThan(0)
    const dusk = layerFor('2025')
    expect(dusk.plan.lights.night).toBe(false)
    expect(dusk.plan.lights.dusk).toBe(true)
    expect(dusk.plan.lights.headlampIntensity).toBeGreaterThan(0)
  })

  it('blinks indicators only while the era runs its lamps', () => {
    const blinkingEras = ['1985', '2025'] as const
    for (const eraId of blinkingEras) {
      const layer = layerFor(eraId)
      const lit = Array.from({ length: 200 }, (_, step) => step * 0.02).some((clock) =>
        layer.poseAt(clock).some((pose) => pose.lamps.indicator),
      )
      expect(lit, `${eraId} indicators blink`).toBe(true)
      const lamps = layer.poseAt(0.4)
      expect(lamps.every((pose) => pose.lamps.headlamp > 0)).toBe(true)
    }
    for (const eraId of ['1945', '1965', '2005'] as const) {
      const layer = layerFor(eraId)
      const lit = Array.from({ length: 200 }, (_, step) => step * 0.02).some((clock) =>
        layer.poseAt(clock).some((pose) => pose.lamps.indicator),
      )
      expect(lit, `${eraId} indicators stay dark`).toBe(false)
    }
  })
})

describe('SFX triggers', () => {
  it('emits documented, rate-limited engine, horn, bell, whine and squeal events', () => {
    const simulationSeconds = 120
    const perEra = new Map<EraId, readonly SfxTrigger[]>()
    for (const eraId of ERA_IDS) {
      const heard: SfxTrigger[] = []
      const layer = layerFor(eraId, { onSfxTrigger: (trigger) => heard.push(trigger) })
      for (let second = 1; second <= simulationSeconds; second += 1) {
        layer.setClock(second)
      }
      expect(heard.length, `${eraId} emitted events`).toBeGreaterThan(0)
      expect(layer.emitted.length).toBe(heard.length)
      expect(layer.emitted).toEqual([...heard])
      perEra.set(eraId, heard)

      // Rate limiting: per vehicle and kind, no two events closer than the floor.
      const floor = layer.plan.sfx.minIntervalSec
      const lastByKey = new Map<string, number>()
      for (const trigger of heard) {
        const key = `${trigger.vehicleId}|${trigger.kind}`
        const previous = lastByKey.get(key)
        if (previous !== undefined) {
          expect(trigger.timeSec - previous, `${eraId} ${key} spacing`).toBeGreaterThanOrEqual(floor)
        }
        lastByKey.set(key, trigger.timeSec)
        expect(trigger.gain).toBeGreaterThan(0)
        expect(trigger.gain).toBeLessThanOrEqual(1)
        expect(trafficLanes(LAYOUT).map((spline) => spline.name)).toContain(trigger.splineName)
        expect(classifyGround(trigger.position.x, trigger.position.z)).toBe('roadway')
      }
    }

    const kindsOf = (eraId: EraId): Set<string> =>
      new Set((perEra.get(eraId) ?? []).map((trigger) => trigger.kind))

    expect(kindsOf('1945').has('horn')).toBe(true)
    expect(kindsOf('1945').has('engine')).toBe(true)
    expect(kindsOf('1945').has('transit-bell')).toBe(true)
    expect(kindsOf('1965').has('transit-bell')).toBe(true)
    expect(kindsOf('1965').has('tire-squeal')).toBe(true)
    expect(kindsOf('1985').has('ev-whine')).toBe(false)
    expect(kindsOf('1985').has('transit-bell')).toBe(false)
    expect(kindsOf('2025').has('ev-whine')).toBe(true)
    expect(kindsOf('2025').has('engine')).toBe(false)
  })

  it('publishes only the kinds the era can produce and stays silent when the clock does not advance', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const snapshotKinds = new Set(layer.snapshot().sfxKinds)
      layer.setClock(120)
      for (const trigger of layer.emitted) {
        expect(snapshotKinds.has(trigger.kind), `${eraId} ${trigger.kind} is published`).toBe(true)
      }
      const before = layer.emitted.length
      expect(layer.setClock(120)).toEqual([])
      expect(layer.setClock(60)).toEqual([])
      expect(layer.emitted.length).toBe(before)
      expect(layer.snapshot().sfxLastStep).toEqual([])
      for (const instance of layer.fleet) {
        for (const entry of instance.schedule) {
          const interval = sfxIntervalFor(entry.kind, layer.plan.sfx)
          expect(interval === null || interval > 0).toBe(true)
        }
      }
    }
  })
})

describe('era transitions', () => {
  it('cross-fades progressively and lands exactly on the destination era', () => {
    for (const from of ERA_IDS) {
      for (const to of ERA_IDS) {
        if (from === to) {
          continue
        }
        const context = { layout: LAYOUT }
        const direct = applyEra(to, context)
        const landed = resolveEraPlan({ from, to, t: 1 })
        expect(planSignature(landed), `${from}->${to} at t=1`).toBe(planSignature(direct))
        const start = resolveEraPlan({ from, to, t: 0 })
        expect(planSignature(start), `${from}->${to} at t=0`).toBe(planSignature(applyEra(from, context)))

        const middle = resolveEraPlan({ from, to, t: 0.5 })
        expect(middle.settled).toBe(false)
        expect(middle.eraId).toBeNull()
        expect(middle.progress).toBe(0.5)
        const density = [getEra(from).traffic.trafficDensity, getEra(to).traffic.trafficDensity]
        expect(middle.density).toBeGreaterThanOrEqual(Math.min(...density))
        expect(middle.density).toBeLessThanOrEqual(Math.max(...density))
        const census = new Set(middle.census)
        for (const modelKey of censusOf(ERA_VEHICLE_TABLES[from])) {
          expect(census.has(modelKey)).toBe(true)
        }
        for (const modelKey of censusOf(ERA_VEHICLE_TABLES[to])) {
          expect(census.has(modelKey)).toBe(true)
        }
        for (const weight of Object.values(middle.markings.featureWeights)) {
          expect(weight).toBeGreaterThan(0)
          expect(weight).toBeLessThanOrEqual(1)
        }
        for (const entry of middle.fleet) {
          expect(entry.share).toBeGreaterThan(0)
        }
        const shareTotal = middle.fleet.reduce((total, entry) => total + entry.share, 0)
        expect(shareTotal).toBeCloseTo(1, 5)
      }
    }
  })

  it('applies era changes to a target and switches instantly under reduced motion', () => {
    const applied: string[] = []
    const target = { applyPlan: (plan: { toEraId: string }) => applied.push(plan.toEraId) }

    applyEra('1965', { layout: LAYOUT, target })
    expect(applied).toEqual(['1965'])

    applyEraTransition({ from: '1965', to: '1985', t: 0.4 }, { layout: LAYOUT, target, reducedMotion: true })
    expect(applied[1]).toBe('1985')

    const layer = layerFor('1945', { reducedMotion: true })
    const plan = layer.setEraTransition({ from: '1945', to: '2025', t: 0.2 })
    expect(plan.settled).toBe(true)
    expect(layer.plan.toEraId).toBe('2025')
    expect(planSignature(layer.plan)).toBe(planSignature(eraPlan('2025')))
    expect(layer.movingCount).toBeGreaterThan(0)
    expect(layer.markings.groupCounts['charging-point'] ?? 0).toBeGreaterThan(0)

    // A blended layer really carries both periods, and settles on the last call.
    const blended = layerFor('1945')
    blended.setEraTransition({ from: '1945', to: '2025', t: 0.5 })
    const blendedModels = new Set(blended.fleet.map((instance) => instance.modelKey))
    expect(blendedModels.has('sedan-1940s')).toBe(true)
    expect(blendedModels.size).toBeGreaterThan(0)
    expect(blended.markings.groupCounts['streetcar-rail'] ?? 0).toBeGreaterThan(0)
    blended.setEraTransition({ from: '1945', to: '2025', t: 1 })
    expect(planSignature(blended.plan)).toBe(planSignature(eraPlan('2025')))
  })

  it('exposes applyEra and applyEraTransition from the layer barrel', () => {
    const calls: string[] = []
    const target = { applyPlan: vi.fn((plan: { fromEraId: string }) => calls.push(plan.fromEraId)) }
    expect(typeof applyEra).toBe('function')
    expect(typeof applyEraTransition).toBe('function')
    applyEra('1985', { layout: LAYOUT, seed: 'barrel', target })
    applyEraTransition({ from: '1985', to: '2005', t: 0.75 }, { layout: LAYOUT, seed: 'barrel', target })
    expect(calls).toEqual(['1985', '1985'])
    expect(target.applyPlan).toHaveBeenCalledTimes(2)
  })

  it('reports the moving, parked, marking and light numbers through one snapshot', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      layer.setClock(3)
      const snapshot = layer.snapshot()
      expect(snapshot.toEraId).toBe(eraId)
      expect(snapshot.settled).toBe(true)
      expect(snapshot.movingCount).toBe(layer.movingCount)
      expect(snapshot.parkedCount).toBe(layer.parkedCount)
      expect(snapshot.microCount).toBe(layer.fleet.filter((instance) => instance.micro).length)
      expect(snapshot.clockSec).toBe(3)
      expect(snapshot.firstPose?.id).toBe(layer.fleet[0]?.id)
      const movingTotal = Object.values(snapshot.movingByModel).reduce((sum, value) => sum + value, 0)
      expect(movingTotal).toBe(snapshot.movingCount)
      const classTotal = Object.values(snapshot.movingByClass).reduce((sum, value) => sum + value, 0)
      expect(classTotal).toBe(snapshot.movingCount)
      expect(snapshot.markingPieceCount).toBe(layer.markings.pieces.length)
      expect(snapshot.markingSignature.length).toBeGreaterThan(0)
    }
  })

  it('counts differ between eras, as the era density demands', () => {
    const counts = ERA_IDS.map((eraId) => layerFor(eraId).movingCount)
    expect(new Set(counts).size).toBe(ERA_IDS.length)
    const byEra = new Map(ERA_IDS.map((eraId, index) => [eraId, counts[index] ?? 0]))
    expect(byEra.get('1945')).toBeLessThan(byEra.get('2005') ?? 0)
    expect(byEra.get('1985')).toBeLessThan(byEra.get('2005') ?? 0)
    expect(byEra.get('2025')).toBeLessThan(byEra.get('2005') ?? 0)
  })

  it('keeps the catalogue intact: every model has geometry and a reason to exist', () => {
    for (const model of Object.values(VEHICLE_MODELS)) {
      expect(model.parts.length, `${model.key} has parts`).toBeGreaterThan(0)
      expect(model.lengthM, `${model.key} length`).toBeGreaterThan(0.5)
      expect(model.widthM, `${model.key} width`).toBeGreaterThan(0.3)
      expect(model.heightM, `${model.key} height`).toBeGreaterThan(0.4)
      expect(model.sfxKinds.length, `${model.key} sound`).toBeGreaterThan(0)
      expect(model.parts.some((part) => part.shape === 'wheel')).toBe(true)
    }
    // Every era definition is covered by a table, and every table by a layer.
    expect(ERA_DEFINITIONS).toHaveLength(ERA_IDS.length)
    expect(poseVehicles([], SPLINES, 0)).toEqual([])
  })
})
