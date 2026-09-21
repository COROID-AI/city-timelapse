/**
 * Composition suite: the real block layout, the real era registry and the real
 * pedestrian layer, wired together exactly as the composed scene wires them.
 *
 * This is where the geometric acceptance criteria live, because they are
 * *integration* criteria: the layout is the only thing that knows where the
 * pavement is, the crossings are the only legal places to wait, and the era
 * registry is the only thing that knows how many people a period puts on the
 * street. Nothing is stubbed and nothing is regenerated: the crowd walks the
 * splines the layout publishes, one fixed simulation step at a time.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { ERA_ID_ORDER, getEra } from '../../src/era'
import {
  BUILD_LINE,
  BLOCK_HALF,
  SIDEWALK_WIDTH,
  classifyGround,
  createCityLayout,
  splinePoseAt,
  type CityLayout,
  type Vec3,
} from '../../src/city/layout'
import {
  CROSSING_SIGNAL,
  PEDESTRIAN_DRAW_CALL_BUDGETS,
  PEDESTRIAN_GEOMETRY_BUDGETS,
  PEDESTRIAN_TRIANGLE_BUDGETS,
  applyEra,
  applyEraTransition,
  createPedestrianLayer,
  crossingSignalAt,
  crowdStats,
  crowdTargetCount,
  estimateCrowdCost,
  getCrowdTable,
  pedestrianOutfit,
  pedestrianPlacement,
  resetCrowd,
  seekCrowd,
  walkableSidewalkLength,
  type Crowd,
  type Pedestrian,
  type PedestrianLayerHandle,
} from '../../src/city/pedestrians'
import { QUALITY_TIER_ORDER, type QualityTierName } from '../../src/lib/quality'

const SEED = 'city-block'
const TIERS: readonly QualityTierName[] = QUALITY_TIER_ORDER
/** Sample instants of the long integration sweeps, in simulated seconds. */
const SAMPLE_TIMES = [3, 12, 27, 45, 63, 81, 99, 117, 141, 168] as const

let layout: CityLayout
let sidewalkLength: number

beforeAll(() => {
  layout = createCityLayout()
  sidewalkLength = walkableSidewalkLength(layout)
})

interface Sample {
  readonly time: number
  readonly eraId: string
  readonly pedestrian: Pedestrian
  readonly position: Vec3
  readonly heading: Vec3
  readonly state: Pedestrian['state']
  /** Spline the pedestrian walked at sample time. */
  readonly splineIndex: number
  readonly splineName: string
  /** Crossing the pedestrian was using at sample time, or `-1`. */
  readonly crossingIndex: number
  /** Arc distance along the walked spline, captured at sample time. */
  readonly distance: number
  /** Tangent of the walked spline, captured at sample time. */
  readonly tangent: Vec3
  readonly crossingName: string | null
  readonly outfitKey: string
  readonly outfitEraId: string
  readonly stage: string
  readonly props: readonly string[]
}

/**
 * Walks a crowd forward through several instants and samples every visible
 * pedestrian, which is how the invariants below are checked *while* the crowd
 * moves rather than only at its spawn.
 */
function sampleCrowd(crowd: Crowd, times: readonly number[] = SAMPLE_TIMES): Sample[] {
  const samples: Sample[] = []
  for (const time of times) {
    seekCrowd(crowd, time)
    const stats = crowdStats(crowd)
    for (const pedestrian of crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      const placement = pedestrianPlacement(crowd, pedestrian)
      const dressed = pedestrianOutfit(crowd, pedestrian)
      const spline = layout.pedestrianSplines[pedestrian.splineIndex]
      const pose = spline === undefined ? null : splinePoseAt(spline, pedestrian.distance)
      samples.push({
        time,
        eraId: stats.eraId,
        pedestrian,
        position: placement.position,
        heading: placement.heading,
        state: placement.state,
        splineIndex: pedestrian.splineIndex,
        splineName: spline?.name ?? 'none',
        crossingIndex: pedestrian.crossingIndex,
        distance: pedestrian.distance,
        tangent: pose?.tangent ?? { x: 1, y: 0, z: 0 },
        crossingName:
          pedestrian.crossingIndex >= 0
            ? layout.crossings[pedestrian.crossingIndex]?.name ?? null
            : null,
        outfitKey: dressed.outfit.outfitKey,
        outfitEraId: dressed.outfit.eraId,
        stage: dressed.stage,
        props: dressed.props.map((prop) => prop.id),
      })
    }
  }
  return samples
}

function distanceToSpline(splineName: string, point: Vec3): number {
  const spline = layout.pedestrianSplines.find((candidate) => candidate.name === splineName)
  if (spline === undefined) {
    throw new RangeError(`Unknown spline ${splineName}`)
  }
  // Distance to the sampled *polyline*, not to the nearest sample, so a point
  // exactly on the spline measures ~0 however coarse the sampling is.
  let best = Number.POSITIVE_INFINITY
  for (let sample = 0; sample < spline.sampleCount; sample += 1) {
    const next = (sample + 1) % spline.sampleCount
    const ax = spline.positions[sample * 3] ?? 0
    const az = spline.positions[sample * 3 + 2] ?? 0
    const bx = spline.positions[next * 3] ?? 0
    const bz = spline.positions[next * 3 + 2] ?? 0
    const vx = bx - ax
    const vz = bz - az
    const lengthSquared = vx * vx + vz * vz
    const t =
      lengthSquared > 0
        ? Math.min(1, Math.max(0, ((point.x - ax) * vx + (point.z - az) * vz) / lengthSquared))
        : 0
    best = Math.min(best, Math.hypot(point.x - (ax + vx * t), point.z - (az + vz * t)))
  }
  return best
}

/** Distance from a point to the sidewalk walk line, in metres. */
function distanceToWalkLine(point: Vec3): number {
  const ax = Math.abs(point.x)
  const az = Math.abs(point.z)
  if (ax > BUILD_LINE && az > BUILD_LINE) {
    // Corner quarter disc: the walk line is the fillet arc two metres in.
    const radius = Math.hypot(ax - BUILD_LINE, az - BUILD_LINE)
    return Math.abs(radius - (BLOCK_HALF - SIDEWALK_WIDTH / 2 - BUILD_LINE))
  }
  return Math.abs(Math.max(ax, az) - (BLOCK_HALF - SIDEWALK_WIDTH / 2))
}

describe('pedestrian crowd against the real layout', () => {
  it('sizes each era crowd from its density against the real sidewalk length', () => {
    expect(layout.pedestrianSplines.filter((spline) => spline.role === 'sidewalk-loop')).toHaveLength(1)
    expect(layout.pedestrianSplines.filter((spline) => spline.role === 'crossing')).toHaveLength(8)
    expect(layout.crossings).toHaveLength(8)
    expect(sidewalkLength).toBeGreaterThan(400)

    const previous = { density: 0, count: 0 }
    for (const eraId of ERA_ID_ORDER) {
      const density = getEra(eraId).population.pedestrianDensity
      const handle = createPedestrianLayer({ layout, eraId, seed: SEED, tier: 'high' })
      const expected = Math.round(density * 0.12 * sidewalkLength)
      expect(handle.crowd.activeCount, `${eraId} crowd size`).toBe(expected)
      expect(handle.crowd.sidewalkLength).toBeCloseTo(sidewalkLength, 6)
      expect(handle.crowd.sidewalkSplineIndex).toBe(0)
      expect(handle.crowd.pedestrians).toHaveLength(crowdTargetCount(layout, 1, 'high'))
      expect(density).toBeGreaterThan(previous.density)
      expect(handle.crowd.activeCount).toBeGreaterThan(previous.count)
      previous.density = density
      previous.count = handle.crowd.activeCount

      // Cheaper tiers carry a proportional share of the same density.
      const low = createPedestrianLayer({ layout, eraId, seed: SEED, tier: 'low' })
      expect(low.crowd.activeCount).toBeLessThan(handle.crowd.activeCount)
    }
  })

  it('keeps every pedestrian on the sidewalk, facing along a real spline tangent', () => {
    const samples = ERA_ID_ORDER.flatMap((eraId) =>
      sampleCrowd(createPedestrianLayer({ layout, eraId, seed: SEED, tier: 'high' }).crowd),
    )
    expect(samples.length).toBeGreaterThan(500)

    for (const sample of samples) {
      const ground = classifyGround(sample.position.x, sample.position.z)
      if (sample.state === 'walking') {
        expect(
          ground,
          `${sample.eraId} walker at ${sample.position.x},${sample.position.z}`,
        ).toBe('sidewalk')
        expect(distanceToWalkLine(sample.position)).toBeLessThanOrEqual(1)
        expect(distanceToSpline(sample.splineName, sample.position)).toBeLessThan(1.6)
        expect(sample.splineName).toBe('pedestrian:sidewalk:loop')
      }
      expect(ground, 'no pedestrian stands on a parcel or off the block').not.toBe('parcel')
      expect(ground).not.toBe('outside')
    }
  })

  it('heads along the tangent of the spline it is walking and waits only at crossing waypoints', () => {
    const handle = createPedestrianLayer({ layout, eraId: '2005', seed: SEED, tier: 'high' })
    const samples = sampleCrowd(handle.crowd)
    const waitingPoints = layout.crossings.flatMap((crossing) => crossing.waitingPoints)

    let sawWalking = 0
    let sawWaiting = 0
    let sawCrossing = 0

    for (const sample of samples) {
      const spline = layout.pedestrianSplines[sample.splineIndex]
      expect(spline, 'every pedestrian walks a layout spline').toBeDefined()
      if (spline === undefined) {
        continue
      }
      const tangentDot = (target: Vec3): number =>
        sample.heading.x * target.x + sample.heading.z * target.z

      if (sample.state === 'walking') {
        sawWalking += 1
        expect(spline.role, 'walkers use the sidewalk loop').toBe('sidewalk-loop')
        expect(tangentDot(sample.tangent), 'walker heading vs spline tangent').toBeGreaterThan(0.9)
        const walkLine = distanceToWalkLine(sample.position)
        expect(walkLine).toBeLessThanOrEqual(1)
        continue
      }

      // Waiting and crossing are the only other states, and both belong to a
      // crossing the layout publishes.
      const crossingIndex = sample.crossingIndex
      expect(crossingIndex).toBeGreaterThanOrEqual(0)
      const crossing = layout.crossings[crossingIndex]
      expect(crossing, 'the crossing is one of the layout crossings').toBeDefined()
      const crossingSpline = layout.pedestrianSplines.find(
        (candidate) => candidate.name === crossing?.spline,
      )
      expect(crossingSpline, 'the crossing loop exists').toBeDefined()

      if (sample.state === 'waiting') {
        sawWaiting += 1
        const onWaitingPoint = waitingPoints.some(
          (point) =>
            Math.hypot(point.x - sample.position.x, point.z - sample.position.z) < 1e-6 &&
            Math.abs(point.y - sample.position.y) < 1e-6,
        )
        expect(onWaitingPoint, 'a waiter stands exactly on a layout waiting point').toBe(true)
        // Facing: a waiter has stepped to the kerb and faces across the
        // carriageway, along the crossing it is about to walk.
        const approach = crossingSpline === undefined ? null : splinePoseAt(crossingSpline, 0)
        expect(approach).not.toBeNull()
        if (approach !== null) {
          expect(tangentDot(approach.tangent), 'waiter faces the crossing').toBeGreaterThan(0.9)
        }
        expect(distanceToSpline(crossing?.spline ?? '', sample.position)).toBeLessThan(2.5)
        continue
      }

      sawCrossing += 1
      expect(spline.role, 'a crosser walks a crossing loop').toBe('crossing')
      expect(spline.name).toBe(crossing?.spline)
      expect(sample.crossingName).toBe(crossing?.name ?? null)
      expect(tangentDot(sample.tangent), 'crosser heading vs spline tangent').toBeGreaterThan(0.9)
      expect(distanceToSpline(spline.name, sample.position)).toBeLessThan(0.5)
    }

    expect(sawWalking).toBeGreaterThan(0)
    expect(sawWaiting).toBeGreaterThan(0)
    expect(sawCrossing).toBeGreaterThan(0)
  })

  it('steps off the kerb only while the crossing signal is green', () => {
    const crowd = createPedestrianLayer({ layout, eraId: '1985', seed: SEED, tier: 'high' }).crowd
    const starts: Array<{ crossingIndex: number; time: number; duration: number }> = []
    const previousState = new Map<number, string>()

    for (let step = 0; step < 3600; step += 1) {
      seekCrowd(crowd, step / 30)
      for (const pedestrian of crowd.pedestrians) {
        if (!pedestrian.visible) {
          continue
        }
        const before = previousState.get(pedestrian.index)
        if (before !== 'crossing' && pedestrian.state === 'crossing') {
          starts.push({ crossingIndex: pedestrian.crossingIndex, time: step / 30, duration: 0 })
        }
        previousState.set(pedestrian.index, pedestrian.state)
      }
    }

    expect(starts.length).toBeGreaterThan(2)
    for (const start of starts) {
      expect(crossingSignalAt(start.crossingIndex, start.time)).toBe('green')
    }
    expect(CROSSING_SIGNAL.greenSeconds).toBeLessThan(CROSSING_SIGNAL.periodSeconds)
  })

  it('dresses the crowd, and its carried props, from its own era table', () => {
    for (const eraId of ERA_ID_ORDER) {
      const table = getCrowdTable(eraId)
      const keys = new Set(table.outfits.map((look) => look.key))
      const propIds = new Set(table.props.map((entry) => entry.id))
      const handle = createPedestrianLayer({ layout, eraId, seed: SEED, tier: 'high' })
      const samples = sampleCrowd(handle.crowd, [7, 31, 74])

      expect(samples.length).toBeGreaterThan(50)
      for (const sample of samples) {
        expect(keys.has(sample.outfitKey), `${eraId}: ${sample.outfitKey}`).toBe(true)
        expect(sample.outfitEraId).toBe(eraId)
        expect(sample.stage).toBe('to')
        expect(sample.props.length).toBeGreaterThan(0)
        for (const prop of sample.props) {
          expect(propIds.has(prop), `${eraId}: ${prop}`).toBe(true)
        }
      }

      // The crowd measures as visibly different from every other era.
      const stats = crowdStats(handle.crowd)
      for (const other of ERA_ID_ORDER) {
        if (other === eraId) {
          continue
        }
        expect(stats.outfitKeys.some((key) => getCrowdTable(other).outfits.some((look) => look.key === key))).toBe(
          false,
        )
      }
    }
  })

  it('cross-dresses garments and re-dresses props progressively during a staged switch', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1945', seed: SEED, tier: 'high' })

    // A blend at t = 0 is the untouched `from` era: every pedestrian is
    // still dressed, densified and propped as 1945.
    const atStart = applyEraTransition({ from: '1945', to: '2025', t: 0 }, handle)
    expect(atStart.blend?.t).toBe(0)
    for (const pedestrian of handle.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      const dressed = pedestrianOutfit(handle.crowd, pedestrian)
      expect(dressed.stage).toBe('from')
      expect(dressed.outfit.eraId).toBe('1945')
    }

    const mid = applyEraTransition({ from: '1945', to: '2025', t: 0.5 }, handle)
    expect(mid.blend?.from).toBe('1945')
    expect(mid.blend?.to).toBe('2025')
    expect(handle.crowd.eraId).toBe('2025')

    const stages = new Map<string, number>()
    const propsByStage = new Map<string, Set<string>>()
    for (const pedestrian of handle.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      const dressed = pedestrianOutfit(handle.crowd, pedestrian)
      stages.set(dressed.stage, (stages.get(dressed.stage) ?? 0) + 1)
      const pool = propsByStage.get(dressed.stage) ?? new Set<string>()
      for (const prop of dressed.props) {
        pool.add(prop.id)
      }
      propsByStage.set(dressed.stage, pool)
      if (dressed.stage === 'props') {
        // Old garments, new era's props: the props lead the clothes.
        expect(dressed.outfit.eraId).toBe('1945')
        expect(dressed.props.every((prop) => getCrowdTable('2025').props.some((entry) => entry.id === prop.id))).toBe(
          true,
        )
      }
      if (dressed.stage === 'to') {
        expect(dressed.outfit.eraId).toBe('2025')
        expect(dressed.props.every((prop) => getCrowdTable('2025').props.some((entry) => entry.id === prop.id))).toBe(
          true,
        )
      }
      if (dressed.stage === 'from') {
        expect(dressed.outfit.eraId).toBe('1945')
        expect(dressed.props.every((prop) => getCrowdTable('1945').props.some((entry) => entry.id === prop.id))).toBe(
          true,
        )
      }
    }

    expect(stages.get('from')).toBeGreaterThan(0)
    expect(stages.get('props')).toBeGreaterThan(0)
    expect(stages.get('to')).toBeGreaterThan(0)
    expect((stages.get('from') ?? 0) + (stages.get('props') ?? 0) + (stages.get('to') ?? 0)).toBe(
      handle.crowd.activeCount,
    )

    // Density interpolates between the two eras' targets.
    const fromTarget = crowdTargetCount(layout, getCrowdTable('1945').density, 'high')
    const toTarget = crowdTargetCount(layout, getCrowdTable('2025').density, 'high')
    expect(handle.crowd.activeCount).toBe(Math.round(fromTarget + (toTarget - fromTarget) * 0.5))

    const settled = applyEraTransition({ from: '1945', to: '2025', t: 1 }, handle)
    expect(settled.blend).toBeNull()
    expect(settled.activeCount).toBe(toTarget)
    for (const pedestrian of handle.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      expect(pedestrianOutfit(handle.crowd, pedestrian).stage).toBe('to')
    }
  })

  it('interpolates an adjacent-era blend monotonically towards the target era', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1965', seed: SEED, tier: 'high' })
    const fromCount = crowdTargetCount(layout, getCrowdTable('1965').density, 'high')
    const toCount = crowdTargetCount(layout, getCrowdTable('1985').density, 'high')
    expect(toCount).toBeGreaterThan(fromCount)

    const counts: number[] = []
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const stats = applyEraTransition({ from: '1965', to: '1985', t }, handle)
      counts.push(stats.activeCount)
      expect(stats.activeCount).toBe(Math.round(fromCount + (toCount - fromCount) * t))
      for (const pedestrian of handle.crowd.pedestrians) {
        if (!pedestrian.visible) {
          continue
        }
        const dressed = pedestrianOutfit(handle.crowd, pedestrian)
        // Garments change last: only a settled pedestrian wears the target era,
        // while carried props change as soon as the blend opens the lead window.
        expect(dressed.outfit.eraId).toBe(dressed.stage === 'to' ? '1985' : '1965')
        const propEra = dressed.stage === 'from' ? '1965' : '1985'
        for (const prop of dressed.props) {
          expect(
            getCrowdTable(propEra).props.some((entry) => entry.id === prop.id),
            `${dressed.stage} prop ${prop.id} belongs to ${propEra}`,
          ).toBe(true)
        }
      }
    }
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index] ?? 0).toBeGreaterThanOrEqual(counts[index - 1] ?? 0)
    }

    const settled = applyEraTransition({ from: '1965', to: '1985', t: 1 }, handle)
    expect(settled.blend).toBeNull()
    expect(settled.activeCount).toBe(toCount)
    const keys1985 = new Set(getCrowdTable('1985').outfits.map((look) => look.key))
    for (const pedestrian of handle.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      const dressed = pedestrianOutfit(handle.crowd, pedestrian)
      expect(keys1985.has(dressed.outfit.outfitKey)).toBe(true)
      expect(dressed.props.every((prop) => getCrowdTable('1985').props.some((e) => e.id === prop.id))).toBe(
        true,
      )
    }
  })

  it('switches eras instantly through the barrel, for reduced motion too', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1945', seed: SEED, tier: 'high' })
    applyEra('1985', handle)
    const afterEra: PedestrianLayerHandle = handle
    const keys1985 = new Set(getCrowdTable('1985').outfits.map((look) => look.key))
    for (const pedestrian of afterEra.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      expect(keys1985.has(pedestrianOutfit(afterEra.crowd, pedestrian).outfit.outfitKey)).toBe(true)
    }
    expect(afterEra.crowd.activeCount).toBe(
      crowdTargetCount(layout, getCrowdTable('1985').density, 'high'),
    )
    expect(afterEra.table.eraId).toBe('1985')

    const reduced = applyEraTransition(
      { from: '1985', to: '1965', t: 0.3, reducedMotion: true },
      afterEra,
    )
    expect(reduced.blend).toBeNull()
    expect(reduced.eraId).toBe('1965')
    const keys1965 = new Set(getCrowdTable('1965').outfits.map((look) => look.key))
    for (const pedestrian of afterEra.crowd.pedestrians) {
      if (!pedestrian.visible) {
        continue
      }
      expect(keys1965.has(pedestrianOutfit(afterEra.crowd, pedestrian).outfit.outfitKey)).toBe(true)
    }
  })

  it('replays identically from the same block seed, and differently from another', () => {
    const first = createPedestrianLayer({ layout, eraId: '2025', seed: SEED, tier: 'high' })
    const second = createPedestrianLayer({ layout, eraId: '2025', seed: SEED, tier: 'high' })
    const other = createPedestrianLayer({ layout, eraId: '2025', seed: 'city-block-alt', tier: 'high' })

    seekCrowd(first.crowd, 96)
    seekCrowd(second.crowd, 96)
    seekCrowd(other.crowd, 96)
    expect(crowdStats(second.crowd).signature).toBe(crowdStats(first.crowd).signature)
    expect(crowdStats(other.crowd).signature).not.toBe(crowdStats(first.crowd).signature)

    // Resetting replays the same spawn, so a reset crowd matches a fresh one.
    resetCrowd(first.crowd)
    expect(crowdStats(first.crowd).signature).toBe(
      crowdStats(createPedestrianLayer({ layout, eraId: '2025', seed: SEED, tier: 'high' }).crowd).signature,
    )
  })

  it('stays inside the shared per-tier budgets on the real block', () => {
    for (const eraId of ERA_ID_ORDER) {
      for (const tier of TIERS) {
        const handle = createPedestrianLayer({ layout, eraId, seed: SEED, tier })
        if (tier === 'high') {
          seekCrowd(handle.crowd, 52)
        }
        const cost = estimateCrowdCost(handle.crowd, { cameraPosition: { x: 0, y: 2, z: -58 } })
        expect(cost.tier).toBe(tier)
        expect(cost.triangles).toBeLessThanOrEqual(PEDESTRIAN_TRIANGLE_BUDGETS[tier])
        expect(cost.drawCalls).toBeLessThanOrEqual(PEDESTRIAN_DRAW_CALL_BUDGETS[tier])
        expect(cost.poolTriangles).toBeLessThanOrEqual(PEDESTRIAN_GEOMETRY_BUDGETS[tier])
        expect(cost.withinBudget).toBe(true)
        expect(cost.instances).toBeGreaterThan(cost.drawCalls)
      }
    }
  })
})
