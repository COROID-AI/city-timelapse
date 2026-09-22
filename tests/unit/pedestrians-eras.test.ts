/**
 * Unit contract for the era pedestrian layer.
 *
 * The crowd is a deterministic generator plus an instanced painter, so the tests
 * lock down both: crowd size follows the era density against the real sidewalk
 * length, every pedestrian stays on the pavement, headings come from the spline
 * tangents, waiting people stand only at crosswalk waypoints, adjacent eras dress
 * differently, and the instanced group the composition mounts carries the counts
 * it promises.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, type EraId } from '../../src/era'
import { classifyGround, createCityLayout, splinePoseAt } from '../../src/city/layout'
import {
  applyEra,
  applyEraTransition,
  crowdPlanHash,
  crowdStatsRecord,
  createCrowdSceneObject,
  ERA_OUTFIT_TABLES,
  outfitEraData,
  posePedestrians,
  summariseCrowdGroup,
} from '../../src/city/pedestrians'
import type { PedestrianPlan } from '../../src/city/pedestrians'

const layout = createCityLayout()

function planFor(eraId: EraId, options: { readonly night?: boolean; readonly seed?: string } = {}): PedestrianPlan {
  return applyEra(eraId, { layout, ...options })
}

/* ------------------------------------------------------------------------- *
 * Tables
 * ------------------------------------------------------------------------- */

describe('outfit era tables', () => {
  it('defines a complete outfit set for every era', () => {
    expect(Object.keys(ERA_OUTFIT_TABLES)).toEqual([...ERA_IDS])
    for (const eraId of ERA_IDS) {
      const data = ERA_OUTFIT_TABLES[eraId]
      expect(data.outfits.length, eraId).toBeGreaterThanOrEqual(4)
      for (const outfit of data.outfits) {
        expect(outfit.id.length, eraId).toBeGreaterThan(0)
        expect(outfit.modelKey.length, eraId).toBeGreaterThan(0)
        expect(outfit.upperColor).toMatch(/^#/)
        expect(outfit.lowerColor).toMatch(/^#/)
        expect(outfit.carried.length, outfit.id).toBeGreaterThan(0)
      }
    }
  })

  it('gives every adjacent pair a different outfit vocabulary', () => {
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previous = outfitEraData(ERA_IDS[index - 1] as EraId)
      const current = outfitEraData(ERA_IDS[index] as EraId)
      const previousIds = new Set(previous.outfits.map((outfit) => outfit.id))
      const overlap = current.outfits.filter((outfit) => previousIds.has(outfit.id))
      expect(overlap, `${ERA_IDS[index - 1]} -> ${ERA_IDS[index]}`).toEqual([])
      expect(current.outfitEraTag).not.toBe(previous.outfitEraTag)
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Crowd composition
 * ------------------------------------------------------------------------- */

describe('crowd composition', () => {
  it('sizes the crowd from the era density against the real sidewalk length', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.stats.pedestrianCount, eraId).toBeGreaterThan(0)
      expect(plan.stats.sidewalkLengthM, eraId).toBeGreaterThan(0)
      expect(plan.stats.walkerCount, eraId).toBeGreaterThan(0)
      expect(plan.stats.waiterCount, eraId).toBeGreaterThan(0)
    }
    expect(planFor('2025').stats.pedestrianCount).toBeGreaterThan(planFor('1945').stats.pedestrianCount)
  })

  it('keeps every walker on the pavement and every waiter at a crosswalk waypoint', () => {
    const splines = new Map(layout.pedestrianSplines.map((spline) => [spline.name, spline]))
    const waitPoints = layout.crossings.flatMap((crossing) => [...crossing.waitingPoints])
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const person of plan.pedestrians) {
        expect(splines.has(person.splineName), `${eraId} ${person.id}`).toBe(true)
      }
      for (const pose of posePedestrians(plan, layout, 0)) {
        if (pose.waiting) {
          const onPoint = waitPoints.some(
            (point) =>
              Math.abs(point.x - pose.position.x) < 1e-6 &&
              Math.abs(point.z - pose.position.z) < 1e-6,
          )
          expect(onPoint, `${eraId} ${pose.id} waits at a waypoint`).toBe(true)
        } else {
          expect(classifyGround(pose.position.x, pose.position.z), `${eraId} ${pose.id}`).toBe(
            'sidewalk',
          )
        }
      }
    }
  })

  it('heads every walker along its own spline tangent', () => {
    const plan = planFor('1985')
    const poses = posePedestrians(plan, layout, 0)
    for (let index = 0; index < plan.pedestrians.length; index += 1) {
      const person = plan.pedestrians[index]
      const pose = poses[index]
      expect(person, `${index}`).toBeDefined()
      expect(pose, `${index}`).toBeDefined()
      if (person === undefined || pose === undefined || person.waiting) {
        continue
      }
      const spline = layout.pedestrianSplines.find((candidate) => candidate.name === person.splineName)
      expect(spline).toBeDefined()
      if (spline === undefined) {
        continue
      }
      const base = splinePoseAt(spline, person.distance)
      const expected = Math.atan2(
        base.tangent.x * person.direction,
        base.tangent.z * person.direction,
      )
      const delta = Math.atan2(Math.sin(pose.heading - expected), Math.cos(pose.heading - expected))
      expect(Math.abs(delta), `${person.id} heading`).toBeLessThan(0.2)
    }
  })

  it('animates the crowd with the supplied clock', () => {
    const plan = planFor('2025')
    const atZero = posePedestrians(plan, layout, 0)
    const later = posePedestrians(plan, layout, 4)
    const moved = atZero.filter((pose, index) => {
      const next = later[index]
      if (next === undefined || pose.waiting) {
        return false
      }
      return Math.abs(next.position.x - pose.position.x) + Math.abs(next.position.z - pose.position.z) > 0.1
    })
    expect(moved.length).toBeGreaterThan(0)
  })

  it('gives every person individual proportions, pace and gait', () => {
    const plan = planFor('1965')
    const heights = new Set(plan.pedestrians.map((person) => person.heightM.toFixed(3)))
    const paces = new Set(plan.pedestrians.map((person) => person.pace.toFixed(3)))
    expect(heights.size).toBeGreaterThan(1)
    expect(paces.size).toBeGreaterThan(1)
    expect(plan.pedestrians.every((person) => person.strideM > 0)).toBe(true)
  })
})

/* ------------------------------------------------------------------------- *
 * Era difference and determinism
 * ------------------------------------------------------------------------- */

describe('era difference and determinism', () => {
  it('produces a distinct census fingerprint for every adjacent pair', () => {
    const fingerprints = ERA_IDS.map((eraId) => {
      const plan = planFor(eraId)
      return [
        plan.stats.pedestrianCount,
        plan.stats.walkerCount,
        plan.stats.waiterCount,
        plan.stats.averageHeightM.toFixed(3),
        plan.stats.uniqueOutfits,
      ].join('|')
    })
    expect(new Set(fingerprints).size).toBe(ERA_IDS.length)
  })

  it('rebuilds byte-identically for the same seed and differs for another', () => {
    for (const eraId of ERA_IDS) {
      expect(crowdPlanHash(planFor(eraId)), eraId).toBe(crowdPlanHash(planFor(eraId)))
      const other = applyEra(eraId, { layout: createCityLayout('another-city-block') })
      expect(crowdPlanHash(other), eraId).not.toBe(crowdPlanHash(planFor(eraId)))
    }
  })

  it('never reads Math.random or the clock', () => {
    const originalRandom = Math.random
    const originalNow = Date.now
    const baseline = crowdPlanHash(planFor('2025'))
    try {
      Math.random = () => 0.9
      Date.now = () => 1
      expect(crowdPlanHash(planFor('2025'))).toBe(baseline)
    } finally {
      Math.random = originalRandom
      Date.now = originalNow
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Transitions
 * ------------------------------------------------------------------------- */

describe('staged crowd changes', () => {
  it('settles exactly on the direct switch at t = 1', () => {
    const staged = applyEraTransition({ from: '1945', to: '2025', t: 1 }, { layout })
    expect(staged.resolvedEra).toBe('2025')
    expect(crowdPlanHash(staged.plan)).toBe(crowdPlanHash(applyEra('2025', { layout })))
  })

  it('collapses to one step under reduced motion', () => {
    const half = applyEraTransition(
      { from: '1945', to: '2025', t: 0.4 },
      { layout, reducedMotion: true },
    )
    expect(half.instant).toBe(true)
    expect(half.mix).toBe(0)
    expect(half.resolvedEra).toBe('1945')
  })
})

/* ------------------------------------------------------------------------- *
 * Painter
 * ------------------------------------------------------------------------- */

describe('crowd painter', () => {
  it('draws the crowd with instanced figures and measures them', () => {
    const plan = planFor('2005')
    const scene = createCrowdSceneObject(plan, { layout })
    expect(scene.root.name).toBe('era-pedestrians')
    expect(scene.counts.pedestrians).toBe(plan.stats.pedestrianCount)
    expect(scene.counts.instancedMeshes).toBeGreaterThan(0)
    expect(scene.counts.instances).toBeGreaterThan(0)
    expect(scene.counts.triangles).toBeGreaterThan(0)
    scene.update(3)
    expect(scene.poses.length).toBe(plan.stats.pedestrianCount)
    const summary = summariseCrowdGroup(scene.root)
    expect(summary.pedestrians).toBe(plan.stats.pedestrianCount)
    scene.dispose()
  })

  it('publishes a numeric statistics record', () => {
    const record = crowdStatsRecord(planFor('2025').stats)
    for (const [key, value] of Object.entries(record)) {
      expect(Number.isFinite(value), key).toBe(true)
    }
  })
})
