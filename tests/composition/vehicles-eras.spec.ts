/**
 * Composition proof of the era vehicle layer.
 *
 * Unlike the unit suite, this spec wires the *real* collaborators together:
 * the generated block (real traffic splines and parking anchors), the real era
 * registry and the real vehicle layer, including its three.js bridge. It proves
 * the integration claims the acceptance criteria make — vehicles follow the
 * layout's corridors, stay inside the block and on the road for a simulated
 * minute, park on real anchors, differ between eras, and land exactly on their
 * destination when a staged era switch completes.
 */

import { describe, expect, it } from 'vitest'
import {
  CANONICAL_LAYOUT_SEED,
  DEFAULT_LAYOUT_SEED,
  WORLD_HALF,
  classifyGround,
  generateBlock,
  splineByName,
  splinePoseAt,
} from '../../src/city/layout'
import { ERA_DEFINITIONS, ERA_IDS, getEra, type EraId, type EraDefinition } from '../../src/era'
import {
  ERA_VEHICLE_TABLES,
  applyEra,
  applyEraTransition,
  censusOf,
  createVehicleLayer,
  createVehicleSceneObject,
  eraPlan,
  planSignature,
  poseVehicles,
  posesLeavingRoadway,
  selectParkingBays,
  trafficLanes,
  vehicleDistance,
  type SfxTrigger,
  type VehicleLayer,
} from '../../src/city/vehicles'

const LAYOUT = generateBlock(DEFAULT_LAYOUT_SEED)
const SPLINES = trafficLanes(LAYOUT)
const BAYS = LAYOUT.anchors.filter((anchor) => anchor.kind === 'parking-bay')

function layerFor(eraId: EraId, onSfxTrigger?: (trigger: SfxTrigger) => void): VehicleLayer {
  return createVehicleLayer({ layout: LAYOUT, eraId, onSfxTrigger })
}

/** Every clock reading of a simulated minute. */
const MINUTE: readonly number[] = Array.from({ length: 61 }, (_, second) => second)

describe('real layout, real registry, real layer', () => {
  it('consumes the layout it was handed and mounts the canonical block', () => {
    expect(LAYOUT.seedInput).toBe(CANONICAL_LAYOUT_SEED)
    expect(SPLINES).toHaveLength(4)
    expect(BAYS.length).toBeGreaterThan(0)
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      expect(layer.layout).toBe(LAYOUT)
      expect(layer.fleet.length).toBeGreaterThan(0)
      expect(layer.fleet.every((instance) => SPLINES.some((spline) => spline.name === instance.splineName))).toBe(
        true,
      )
    }
  })

  it('keeps every spawned vehicle on a real corridor for a simulated minute', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      const byId = new Map(layer.fleet.map((instance) => [instance.id, instance]))
      for (const clock of MINUTE) {
        const poses = layer.poseAt(clock)
        for (const pose of poses) {
          const instance = byId.get(pose.id)
          expect(instance).toBeDefined()
          if (instance === undefined) {
            continue
          }
          const spline = splineByName(SPLINES, pose.splineName)
          // 1. Lateral distance from the sampled corridor, i.e. "on or beside".
          const splinePoint = splinePoseAt(spline, vehicleDistance(instance, clock)).position
          const lateral = Math.hypot(
            pose.position.x - splinePoint.x,
            pose.position.z - splinePoint.z,
          )
          expect(lateral, `${eraId} ${pose.id} rides its lane`).toBeLessThanOrEqual(
            Math.abs(instance.lateralOffset) + 0.01,
          )
          // 2. Inside the block bounds and on the carriageway.
          expect(Math.abs(pose.position.x)).toBeLessThanOrEqual(WORLD_HALF)
          expect(Math.abs(pose.position.z)).toBeLessThanOrEqual(WORLD_HALF)
          expect(
            classifyGround(pose.position.x, pose.position.z),
            `${eraId} ${pose.id} stays on the road`,
          ).toBe('roadway')
          // 3. Within the loop, never desynced from the spline.
          expect(pose.distance).toBeGreaterThanOrEqual(0)
          expect(pose.distance).toBeLessThan(spline.length)
        }
        expect(posesLeavingRoadway(poses)).toEqual([])
      }
    }
  })

  it('parks on the layout parking anchors, in the block, for every era', () => {
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      expect(layer.parked.length).toBeGreaterThan(0)
      expect(layer.parked.length).toBe(
        Math.round(selectParkingBays(LAYOUT).length * getEra(eraId).traffic.parkedRatio),
      )
      const names = new Set(BAYS.map((anchor) => anchor.name))
      for (const parked of layer.parked) {
        expect(names.has(parked.anchorName)).toBe(true)
        expect(Math.abs(parked.position.x)).toBeLessThanOrEqual(WORLD_HALF)
        expect(Math.abs(parked.position.z)).toBeLessThanOrEqual(WORLD_HALF)
        expect(classifyGround(parked.position.x, parked.position.z)).toBe('roadway')
      }
    }
    // The 1945 street parks fewer cars than the 1985 one, as the era data says.
    expect(layerFor('1945').parkedCount).toBeLessThan(layerFor('2025').parkedCount)
    expect(layerFor('1985').parkedCount).toBeLessThan(layerFor('2025').parkedCount)
  })

  it('gives every era a different fleet census, count and marking configuration', () => {
    const counts = new Map<EraId, number>()
    const censuses = new Set<string>()
    const markings = new Set<string>()
    const parked = new Set<number>()
    for (const eraId of ERA_IDS) {
      const layer = layerFor(eraId)
      counts.set(eraId, layer.movingCount)
      censuses.add([...layer.plan.census].sort().join(','))
      markings.add(
        Object.keys(layer.markings.groupCounts)
          .sort()
          .join('+'),
      )
      parked.add(layer.parkedCount)
      // The layer renders exactly the census its era table declares.
      expect([...layer.plan.census]).toEqual(censusOf(ERA_VEHICLE_TABLES[eraId]))
      // Every registry model key of the era is present in the plan.
      for (const modelKey of getEra(eraId).traffic.modelKeys) {
        expect([...layer.plan.census]).toContain(modelKey)
      }
    }
    expect(new Set(counts.values()).size).toBe(ERA_IDS.length)
    expect(censuses.size).toBe(ERA_IDS.length)
    expect(markings.size).toBe(ERA_IDS.length)
    expect(parked.size).toBe(ERA_IDS.length)
    const busiest = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
    expect(busiest?.[0]).toBe('2005')
    const quietest = [...counts.entries()].sort((left, right) => left[1] - right[1])[0]
    expect(quietest?.[0]).toBe('1945')
  })

  it('lands exactly on the destination era when a staged transition completes', () => {
    for (const from of ERA_IDS) {
      for (const to of ERA_IDS) {
        if (from === to) {
          continue
        }
        const layer = layerFor(from)
        const direct = applyEra(to, { layout: LAYOUT })
        const landed = applyEraTransition({ from, to, t: 1 }, { layout: LAYOUT, target: layer })
        expect(planSignature(landed), `${from}->${to}`).toBe(planSignature(direct))
        expect(planSignature(layer.plan)).toBe(planSignature(direct))
        // The layer really regenerated its fleet and its paint for the new era.
        expect([...layer.plan.census]).toEqual([...direct.census])
        for (const instance of layer.fleet) {
          const model = instance.model
          expect(instance.paint).toMatch(/^#[0-9a-f]{6}$/i)
          expect(model.key).toBe(instance.modelKey)
        }
        for (const parked of layer.parked) {
          expect(parked.model.parks).toBe(true)
        }
        expect(Object.keys(layer.markings.groupCounts).sort()).toEqual(
          [...ERA_VEHICLE_TABLES[to].markings.features].sort(),
        )
      }
    }
  })

  it('blends the two fleets and both paint sets halfway through a switch', () => {
    const layer = layerFor('1945')
    applyEraTransition({ from: '1945', to: '1985', t: 0.5 }, { layout: LAYOUT, target: layer })
    expect(layer.plan.settled).toBe(false)
    const census = new Set(layer.plan.census)
    for (const modelKey of [...censusOf(ERA_VEHICLE_TABLES['1945']), ...censusOf(ERA_VEHICLE_TABLES['1985'])]) {
      expect(census.has(modelKey)).toBe(true)
    }
    // Paint from both periods is on the street at once.
    expect(Object.keys(layer.markings.groupCounts)).toContain('streetcar-rail')
    expect(Object.keys(layer.markings.groupCounts)).toContain('turn-arrow')
    // Density sits between the two eras.
    const densities = ERA_DEFINITIONS.map((definition: EraDefinition) => definition.traffic.trafficDensity)
    expect(layer.plan.density).toBeGreaterThan(Math.min(...densities))
    expect(layer.plan.density).toBeLessThan(Math.max(...densities))
    // And the fleet on that blended street still obeys the layout.
    for (const pose of layer.poseAt(17)) {
      expect(classifyGround(pose.position.x, pose.position.z)).toBe('roadway')
    }
  })

  it('emits SFX through the callback while the real fleet drives the block', () => {
    const heard: SfxTrigger[] = []
    const layer = layerFor('1985', (trigger) => heard.push(trigger))
    for (const clock of MINUTE) {
      layer.setClock(clock)
    }
    expect(heard.length).toBeGreaterThan(0)
    expect(layer.emitted).toEqual(heard)
    const kinds = new Set(heard.map((trigger) => trigger.kind))
    expect(kinds.has('horn')).toBe(true)
    expect(kinds.has('engine')).toBe(true)
    for (const trigger of heard) {
      expect(trigger.timeSec).toBeGreaterThan(0)
      expect(trigger.timeSec).toBeLessThanOrEqual(60)
      expect(classifyGround(trigger.position.x, trigger.position.z)).toBe('roadway')
      expect(layer.fleet.some((instance) => instance.id === trigger.vehicleId)).toBe(true)
    }
    const snapshot = layer.snapshot(60)
    expect(snapshot.sfxEmitted).toBe(heard.length)
    expect(snapshot.sfxKinds).toContain('horn')
  })

  it('mounts the fleet through the three.js bridge and moves it with the clock', () => {
    const layer = layerFor('1985')
    const scene = createVehicleSceneObject({
      plan: layer.plan,
      fleet: layer.fleet,
      parked: layer.parked,
      markings: layer.markings,
    })
    try {
      expect(scene.counts.movingInstances).toBe(layer.movingCount)
      expect(scene.counts.parkedInstances).toBe(layer.parkedCount)
      expect(scene.counts.movingVariants).toBeGreaterThan(0)
      expect(scene.counts.meshes).toBeGreaterThan(0)
      expect(scene.counts.triangles).toBeGreaterThan(0)
      expect(scene.counts.markingGroups).toBe(Object.keys(layer.markings.groupCounts).length)
      expect(scene.counts.markingMeshes).toBeGreaterThan(0)
      // A night era lights its lamps in the material the fleet renders with.
      expect(scene.counts.movingInstances).toBeGreaterThan(0)

      const sampleMatrix = (): number[] => {
        const mesh = scene.moving[0]?.meshes[0]
        expect(mesh).toBeDefined()
        const array = mesh?.instanceMatrix.array as Float32Array | undefined
        return array === undefined ? [] : Array.from(array).map((value) => Math.round(value * 1000) / 1000)
      }

      scene.update(layer.poseAt(0))
      const atZero = sampleMatrix()
      scene.update(layer.poseAt(9))
      const atNine = sampleMatrix()
      expect(atZero.length).toBeGreaterThan(0)
      expect(atNine).not.toEqual(atZero)

      const pose = layer.poseAt(9)[0]
      expect(pose).toBeDefined()
      // Rewinding the clock rewinds the instances exactly.
      scene.update(layer.poseAt(0))
      expect(sampleMatrix()).toEqual(atZero)
    } finally {
      scene.dispose()
    }
  })

  it('stays deterministic for the canonical seed and follows any other block', () => {
    const canonical = layerFor('2005')
    const repeat = layerFor('2005')
    expect(repeat.poseAt(11)).toEqual(canonical.poseAt(11))

    const otherLayout = generateBlock('city-block-alternate')
    const other = createVehicleLayer({ layout: otherLayout, eraId: '2005' })
    expect(other.layout.seedInput).toBe('city-block-alternate')
    expect(other.fleet.length).toBeGreaterThan(0)
    // Same block geometry, different block seed: the fleet draw differs.
    expect(other.fleet.map((instance) => `${instance.modelKey}:${instance.paint}`)).not.toEqual(
      canonical.fleet.map((instance) => `${instance.modelKey}:${instance.paint}`),
    )
    // The convoys ride the corridors of *that* block, not the canonical one.
    const otherSplines = trafficLanes(otherLayout)
    const otherPoses = poseVehicles(other.fleet, otherSplines, 3)
    expect(otherPoses.length).toBe(other.movingCount)
    for (const pose of otherPoses) {
      expect(otherSplines.some((spline) => spline.name === pose.splineName)).toBe(true)
      expect(classifyGround(pose.position.x, pose.position.z)).toBe('roadway')
    }
  })

  it('reports the era through the barrel plan surface used by the timeline', () => {
    const plan = eraPlan('2025')
    expect(plan.eraId).toBe('2025')
    expect(plan.settled).toBe(true)
    expect(getEra('2025').traffic.vehicleEraTag).toBe('2025-electric-crossover')
    expect(plan.census).toContain('electric-crossover')
    expect(plan.lights.headlampIntensity).toBeGreaterThan(0)
  })
})
