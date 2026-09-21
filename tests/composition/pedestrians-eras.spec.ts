/**
 * Composition contract: the real block, the real era registry and the real
 * pedestrian layer, wired together.
 *
 * This is the "pedestrians-unit" check. Nothing is stubbed: the block comes from
 * `createCityLayout()`, the outfit data from `src/era`, and the layer's own
 * barrel decides the crowd size, the outfits and the motion. It asserts:
 *
 * - crowd size follows the era density against the real sidewalk length;
 * - every walker stays on the pavement and heads along its spline tangent;
 * - every waiting person stands at a real crosswalk waypoint;
 * - adjacent eras dress measurably differently, and the plans are reproducible;
 * - `applyEraTransition` settles exactly on the direct switch, one step under
 *   reduced motion;
 * - the instanced group the composition mounts carries the counts it promises.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, getEra, type EraId } from '../../src/era'
import { classifyGround, createCityLayout, splinePoseAt } from '../../src/city/layout'
import {
  applyEra,
  applyEraTransition,
  createCrowdSceneObject,
  crowdPlanHash,
  crowdRoutes,
  ERA_OUTFIT_TABLES,
  posePedestrians,
  summariseCrowdGroup,
} from '../../src/city/pedestrians'
import type { PedestrianPlan } from '../../src/city/pedestrians'

const layout = createCityLayout()
const routes = crowdRoutes(layout)

function planFor(eraId: EraId, options: { readonly qualityTier?: 'high' | 'low' } = {}): PedestrianPlan {
  return applyEra(eraId, { layout, ...options })
}

describe('pedestrian layer over the real block', () => {
  it('finds a real sidewalk to size the crowd against', () => {
    expect(routes.loops.length).toBeGreaterThan(0)
    expect(routes.sidewalkLengthM).toBeGreaterThan(0)
    expect(layout.crossings.length).toBeGreaterThan(0)
  })

  it('sizes every era against the real sidewalk and keeps everyone on it', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.stats.pedestrianCount, eraId).toBeGreaterThan(0)
      expect(plan.stats.sidewalkLengthM, eraId).toBe(routes.sidewalkLengthM)
      const waitPoints = layout.crossings.flatMap((crossing) => [...crossing.waitingPoints])
      for (const pose of posePedestrians(plan, layout, 0)) {
        if (pose.waiting) {
          const onPoint = waitPoints.some(
            (point) =>
              Math.abs(point.x - pose.position.x) < 1e-6 &&
              Math.abs(point.z - pose.position.z) < 1e-6,
          )
          expect(onPoint, `${eraId} ${pose.id}`).toBe(true)
        } else {
          expect(classifyGround(pose.position.x, pose.position.z), `${eraId} ${pose.id}`).toBe(
            'sidewalk',
          )
        }
      }
    }
    expect(planFor('2025').stats.pedestrianCount).toBeGreaterThan(planFor('1945').stats.pedestrianCount)
  })

  it('heads every walker along its spline tangent', () => {
    const plan = planFor('2005')
    const poses = posePedestrians(plan, layout, 0)
    for (const person of plan.pedestrians) {
      if (person.waiting) {
        continue
      }
      const spline = layout.pedestrianSplines.find((candidate) => candidate.name === person.splineName)
      expect(spline, person.id).toBeDefined()
      if (spline === undefined) {
        continue
      }
      const pose = poses.find((candidate) => candidate.id === person.id)
      expect(pose, person.id).toBeDefined()
      if (pose === undefined) {
        continue
      }
      const base = splinePoseAt(spline, person.distance)
      const expected = Math.atan2(
        base.tangent.x * person.direction,
        base.tangent.z * person.direction,
      )
      const delta = Math.atan2(Math.sin(pose.heading - expected), Math.cos(pose.heading - expected))
      expect(Math.abs(delta), `${person.id} heading`).toBeLessThan(1e-6)
    }
  })

  it('dresses adjacent eras differently and stays reproducible', () => {
    const fingerprints: string[] = []
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(crowdPlanHash(plan), eraId).toBe(crowdPlanHash(planFor(eraId)))
      expect(ERA_OUTFIT_TABLES[eraId].outfitEraTag).toBe(getEra(eraId).population.outfitEraTag)
      fingerprints.push(
        [
          plan.stats.pedestrianCount,
          plan.stats.walkerCount,
          plan.stats.waiterCount,
          plan.stats.uniqueOutfits,
          plan.stats.averageHeightM.toFixed(3),
        ].join('|'),
      )
    }
    expect(new Set(fingerprints).size).toBe(ERA_IDS.length)
  })

  it('settles exactly on the direct switch and collapses under reduced motion', () => {
    const staged = applyEraTransition({ from: '1945', to: '2025', t: 1 }, { layout })
    expect(crowdPlanHash(staged.plan)).toBe(crowdPlanHash(planFor('2025')))
    const instant = applyEraTransition(
      { from: '1945', to: '2025', t: 0.4 },
      { layout, reducedMotion: true },
    )
    expect(instant.instant).toBe(true)
    expect(instant.mix).toBe(0)
    expect(instant.resolvedEra).toBe('1945')
  })

  it('paints the crowd with instanced figures', () => {
    const plan = planFor('2005')
    const scene = createCrowdSceneObject(plan, { layout })
    expect(scene.counts.pedestrians).toBe(plan.stats.pedestrianCount)
    expect(scene.counts.instancedMeshes).toBeGreaterThan(0)
    expect(scene.counts.instances).toBeGreaterThan(0)
    scene.update(6)
    expect(scene.poses.length).toBe(plan.stats.pedestrianCount)
    expect(summariseCrowdGroup(scene.root).pedestrians).toBe(plan.stats.pedestrianCount)
    scene.dispose()
  })
})
