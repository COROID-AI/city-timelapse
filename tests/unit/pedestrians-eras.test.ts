/**
 * Era outfit, body, walk-cycle and budget contracts of the pedestrian layer.
 *
 * The acceptance criteria for this layer are data and animation criteria, so the
 * suite reads it the way the renderer does: it walks the five per-era outfit
 * tables, dresses pedestrians from them, steps their walk cycles, and checks the
 * shared geometry and the per-tier budgets the instanced crowd has to fit.
 *
 * Everything here runs without a renderer — the only upstream import is the
 * canonical block layout the crowd has to be sized against — which is the point
 * of keeping the tables, bodies and crowd simulation pure.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { ERA_ID_ORDER, ERA_YEARS, getEra, type EraId } from '../../src/era'
import { createCityLayout, type CityLayout } from '../../src/city/layout'
import {
  ANIMATION_LOD_DISTANCES,
  BODY_PART_SHAPES,
  ERA_CROWD_TABLES,
  GARMENT_SLOTS,
  MAX_CROWD_COUNT,
  PEDESTRIAN_DRAW_CALL_BUDGETS,
  PEDESTRIAN_GEOMETRY_BUDGETS,
  PEDESTRIAN_TRIANGLE_BUDGETS,
  animationLodFor,
  applyEra,
  applyEraTransition,
  advanceCrowd,
  buildShapeGeometry,
  costumeGeometryLibrary,
  createBodyProfile,
  createGaitProfile,
  createPedestrianCrowd,
  createPedestrianLayer,
  collectInstances,
  createInstancePool,
  crowdStats,
  crowdTargetCount,
  estimateCrowdCost,
  findOutfit,
  getCrowdTable,
  pedestrianOutfit,
  pedestrianRng,
  pedestrianPoseOf,
  posePedestrian,
  resolveOutfit,
  resolveOutfitForEra,
  seekCrowd,
  shapeGeometryKey,
  shapeTriangleCount,
  tableAppearanceDistance,
  tableItemPools,
  crowdTableSignature,
  tierShape,
  tierShapeTriangles,
  walkableSidewalkLength,
  type EraCrowdTable,
  type PrimitiveShape,
} from '../../src/city/pedestrians'
import { createRng } from '../../src/lib/rng'
import { QUALITY_TIER_ORDER, type QualityTierName } from '../../src/lib/quality'

const TIERS: readonly QualityTierName[] = QUALITY_TIER_ORDER
const BLOCK_SEED = 'city-block'

let layout: CityLayout

beforeAll(() => {
  layout = createCityLayout()
})

/** Every garment, hair, headwear, accessory and prop shape an era ships. */
function eraShapes(table: EraCrowdTable): PrimitiveShape[] {
  return [
    ...table.outfits.flatMap((look) => look.layers.map((layer) => layer.shape)),
    ...table.hair.map((style) => style.shape),
    ...table.headwear.map((entry) => entry.shape),
    ...table.accessories.map((entry) => entry.shape),
    ...table.props.map((entry) => entry.shape),
  ]
}

/* ------------------------------------------------------------------------- *
 * Outfit tables
 * ------------------------------------------------------------------------- */

describe('era outfit tables', () => {
  it('covers exactly the era registry, in timeline order', () => {
    expect(Object.keys(ERA_CROWD_TABLES)).toEqual([...ERA_ID_ORDER])
    for (const [index, eraId] of ERA_ID_ORDER.entries()) {
      const table = getCrowdTable(eraId)
      expect(table.eraId).toBe(eraId)
      expect(table.density).toBe(getEra(eraId).population.pedestrianDensity)
      expect(table.outfitEraTag).toBe(getEra(eraId).population.outfitEraTag)
      expect(table.outfits.map((look) => look.key)).toEqual(getEra(eraId).population.modelKeys)
      expect(table.label).toBe(getEra(eraId).label)
      expect(ERA_YEARS[index]).toBe(getEra(eraId).year)
    }
  })

  it('mirrors each era palette and gait so the era model stays authoritative', () => {
    for (const eraId of ERA_ID_ORDER) {
      const era = getEra(eraId)
      const table = getCrowdTable(eraId)
      expect(table.palette.slice(0, era.population.outfitPalette.length)).toEqual([
        ...era.population.outfitPalette,
      ])
      expect(table.palette.length).toBeGreaterThan(era.population.outfitPalette.length)
      expect(new Set(table.palette).size).toBe(table.palette.length)
      expect(table.gait.speedMps).toBe(era.population.averageSpeedMps)
      expect(table.gait.cadenceStepsPerMin).toBeGreaterThan(60)
      expect(table.gait.strideLengthM).toBeGreaterThan(0.4)
      expect(table.gait.hipSwayRad).toBeGreaterThan(0)
      expect(table.gait.armSwingRad).toBeGreaterThan(0)
    }
  })

  it('defines a complete look for every outfit key of every era', () => {
    for (const eraId of ERA_ID_ORDER) {
      const table = getCrowdTable(eraId)
      const hairIds = new Set(table.hair.map((style) => style.id))
      const headwearIds = new Set(table.headwear.map((entry) => entry.id))
      const accessoryIds = new Set(table.accessories.map((entry) => entry.id))
      const propIds = new Set(table.props.map((entry) => entry.id))

      expect(table.hair.length, `${eraId} hairstyles`).toBeGreaterThanOrEqual(4)
      expect(table.headwear.length, `${eraId} headwear`).toBeGreaterThanOrEqual(3)
      expect(table.accessories.length, `${eraId} accessories`).toBeGreaterThanOrEqual(4)
      expect(table.props.length, `${eraId} props`).toBeGreaterThanOrEqual(4)

      for (const look of table.outfits) {
        const slots = new Set(look.layers.map((layer) => layer.slot))
        const parts = new Set(look.layers.map((layer) => layer.part))
        expect(look.layers.length, `${look.key} layers`).toBeGreaterThanOrEqual(4)
        expect(slots.size, `${look.key} garment slots`).toBeGreaterThanOrEqual(3)
        expect(slots.has('footwear'), `${look.key} has footwear`).toBe(true)
        expect(
          slots.has('bottom') || slots.has('dress'),
          `${look.key} has a bottom garment`,
        ).toBe(true)
        expect(parts.size, `${look.key} covers several body parts`).toBeGreaterThanOrEqual(3)
        expect(look.hairIds.length, `${look.key} hairstyles`).toBeGreaterThanOrEqual(1)
        expect(look.propIds.length, `${look.key} props`).toBeGreaterThanOrEqual(1)

        for (const id of look.hairIds) {
          expect(hairIds.has(id), `${look.key} hair ${id} is in the era pool`).toBe(true)
        }
        for (const id of look.headwearIds) {
          expect(headwearIds.has(id), `${look.key} headwear ${id}`).toBe(true)
        }
        for (const id of look.accessoryIds) {
          expect(accessoryIds.has(id), `${look.key} accessory ${id}`).toBe(true)
        }
        for (const id of look.propIds) {
          expect(propIds.has(id), `${look.key} prop ${id}`).toBe(true)
        }
        for (const layer of look.layers) {
          expect(GARMENT_SLOTS).toContain(layer.slot)
          expect(layer.shape.segments).toBeGreaterThanOrEqual(1)
          expect(layer.shape.size.every((value) => value > 0)).toBe(true)
        }
      }
    }
  })

  it('speaks the period vocabulary the brief calls for', () => {
    const idsOf = (eraId: EraId): string =>
      [
        ...getCrowdTable(eraId).outfits.flatMap((look) => look.layers.map((layer) => layer.id)),
        ...getCrowdTable(eraId).outfits.map((look) => look.key),
        ...getCrowdTable(eraId).hair.map((style) => style.id),
        ...getCrowdTable(eraId).headwear.map((entry) => entry.id),
        ...getCrowdTable(eraId).accessories.map((entry) => entry.id),
        ...getCrowdTable(eraId).props.map((entry) => entry.id),
      ].join(' ')

    expect(idsOf('1945')).toMatch(/overcoat/)
    expect(idsOf('1945')).toMatch(/ration/)
    expect(idsOf('1945')).toMatch(/headscarf|garrison/)
    expect(idsOf('1965')).toMatch(/suit/)
    expect(idsOf('1965')).toMatch(/beehive/)
    expect(idsOf('1965')).toMatch(/pillbox/)
    expect(idsOf('1985')).toMatch(/denim/)
    expect(idsOf('1985')).toMatch(/tracksuit/)
    expect(idsOf('1985')).toMatch(/shoulder-pad/)
    expect(idsOf('1985')).toMatch(/mohawk/)
    expect(idsOf('2005')).toMatch(/hoodie/)
    expect(idsOf('2005')).toMatch(/cargo/)
    expect(idsOf('2005')).toMatch(/flip-phone/)
    expect(idsOf('2025')).toMatch(/athleisure/)
    expect(idsOf('2025')).toMatch(/helmet/)
    expect(idsOf('2025')).toMatch(/delivery-bag/)
  })

  it('carries every prop the brief names across the eras', () => {
    const props = ERA_ID_ORDER.flatMap((eraId) =>
      getCrowdTable(eraId).props.map((entry) => entry.id),
    ).join(' ')
    for (const prop of [
      'newspaper',
      'umbrella',
      'shopping-basket',
      'boombox',
      'phone',
      'coffee-cup',
      'delivery-bag',
    ]) {
      expect(props, `prop ${prop} is carried somewhere`).toContain(prop)
    }
  })

  it('looks an outfit up by key and lists the pools it can draw from', () => {
    for (const eraId of ERA_ID_ORDER) {
      const table = getCrowdTable(eraId)
      const look = findOutfit(table, table.outfits[0]?.key ?? '')
      expect(look).toBeDefined()
      expect(look?.layers.length).toBeGreaterThanOrEqual(4)
      expect(findOutfit(table, 'no-such-look')).toBeUndefined()

      const pools = tableItemPools(table)
      expect(pools.hair).toEqual(table.hair)
      expect(pools.headwear).toEqual(table.headwear)
      expect(pools.accessories).toEqual(table.accessories)
      expect(pools.props).toEqual(table.props)
    }
  })

  it('differs measurably between every era, and most between neighbours', () => {
    const signatures = ERA_ID_ORDER.map((eraId) => crowdTableSignature(getCrowdTable(eraId)))
    expect(new Set(signatures).size).toBe(ERA_ID_ORDER.length)

    const palettes = ERA_ID_ORDER.map((eraId) => getCrowdTable(eraId).palette.join(','))
    expect(new Set(palettes).size).toBe(ERA_ID_ORDER.length)

    for (const left of ERA_ID_ORDER) {
      for (const right of ERA_ID_ORDER) {
        if (left === right) {
          continue
        }
        const distance = tableAppearanceDistance(getCrowdTable(left), getCrowdTable(right))
        expect(distance, `${left} vs ${right} appearance distance`).toBeGreaterThan(0.5)
      }
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Outfit resolution
 * ------------------------------------------------------------------------- */

describe('outfit resolution', () => {
  it('resolves a complete, era-owned look deterministically', () => {
    for (const eraId of ERA_ID_ORDER) {
      const table = getCrowdTable(eraId)
      const first = resolveOutfit({ table, rng: createRng(`${eraId}-outfit`, 'unit') })
      const second = resolveOutfit({ table, rng: createRng(`${eraId}-outfit`, 'unit') })

      expect(first.signature).toBe(second.signature)
      expect(first.eraId).toBe(eraId)
      expect(table.outfits.map((look) => look.key)).toContain(first.outfitKey)
      expect(first.garments.length).toBeGreaterThanOrEqual(4)
      expect(first.props.length).toBeGreaterThanOrEqual(1)
      expect(table.hair.map((style) => style.id)).toContain(first.hair.id)
      if (first.headwear !== null) {
        expect(table.headwear.map((entry) => entry.id)).toContain(first.headwear.id)
      }
      for (const garment of first.garments) {
        expect(garment.colour).toMatch(/^#[0-9a-f]{6}$/i)
      }
      for (const prop of first.props) {
        expect(table.props.map((entry) => entry.id)).toContain(prop.id)
        expect(prop.colour).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('dresses the same person differently in different eras', () => {
    const rng = pedestrianRng(BLOCK_SEED, 3)
    const looks = ERA_ID_ORDER.map((eraId) =>
      resolveOutfit({ table: getCrowdTable(eraId), rng: rng.fork(`outfit:${eraId}`) }),
    )
    expect(new Set(looks.map((look) => look.signature)).size).toBe(ERA_ID_ORDER.length)
    expect(new Set(looks.map((look) => look.outfitKey)).size).toBe(ERA_ID_ORDER.length)
  })

  it('can be pinned to one look by key', () => {
    const pinned = resolveOutfitForEra('1985', createRng('pinned', 'unit'), 'tracksuit')
    expect(pinned.eraId).toBe('1985')
    expect(pinned.outfitKey).toBe('tracksuit')
    expect(pinned.garments.every((garment) => garment.colour.match(/^#[0-9a-f]{6}$/i))).toBe(true)
    expect(() => resolveOutfitForEra('1985', createRng('pinned', 'unit'), 'no-such-look')).toThrow(
      /has no outfit/,
    )
  })
})

/* ------------------------------------------------------------------------- *
 * Bodies and gaits
 * ------------------------------------------------------------------------- */

describe('bodies and gaits', () => {
  function sampleBodies(count: number, childRatio: number) {
    return Array.from({ length: count }, (_, index) =>
      createBodyProfile(createRng(BLOCK_SEED, 'bodies').fork(`b${index}`), childRatio),
    )
  }

  it('produces per-person height, build and pace variation', () => {
    const bodies = sampleBodies(60, 0.2)
    const heights = bodies.map((body) => body.heightM)
    expect(Math.min(...heights)).toBeLessThan(1.5)
    expect(Math.max(...heights)).toBeGreaterThan(1.7)
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(1.1)
      expect(height).toBeLessThanOrEqual(1.95)
    }
    const adults = bodies.filter((body) => !body.isChild)
    expect(adults.length).toBeGreaterThan(20)
    expect(bodies.filter((body) => body.isChild).length).toBeGreaterThan(0)
    expect(new Set(bodies.map((body) => body.build)).size).toBeGreaterThan(2)
    for (const body of bodies) {
      expect(body.origins.footL.y).toBeLessThan(body.origins.head.y)
      expect(body.limbs.thigh).toBeGreaterThan(0.2)
      expect(body.limbs.forearm).toBeGreaterThan(0.1)
      expect(Math.abs(body.origins.upperArmL.x)).toBeGreaterThan(0.1)
    }
  })

  it('is deterministic from the block seed and pedestrian generator', () => {
    const era = getCrowdTable('1965').gait
    const body = createBodyProfile(pedestrianRng(BLOCK_SEED, 11).fork('body'), 0.2)
    const first = createGaitProfile(pedestrianRng(BLOCK_SEED, 11).fork('gait'), era, body)
    const second = createGaitProfile(pedestrianRng(BLOCK_SEED, 11).fork('gait'), era, body)
    expect(second).toEqual(first)
    expect(first.speedMps).toBeGreaterThan(0.4)
    expect(first.strideLengthM).toBeGreaterThan(0.3)
    expect(first.cadenceStepsPerMin).toBeCloseTo((first.speedMps / first.strideLengthM) * 60, 6)
    expect(first.posture).toBe(era.posture)
  })

  it('walks a two-step cycle with opposite legs and a bob', () => {
    const body = createBodyProfile(createRng(BLOCK_SEED, 'walk').fork('body'), 0)
    const gait = createGaitProfile(createRng(BLOCK_SEED, 'walk').fork('gait'), getCrowdTable('1985').gait, body)
    const poseAt = (phase: number) =>
      posePedestrian({
        body,
        gait,
        state: 'walking',
        speedMps: gait.speedMps,
        phase,
        seconds: phase * 2,
        idlePhase: 0,
        lookPhase: 0,
        holdLeft: false,
        holdRight: false,
      })

    const forward = poseAt(0.25)
    const back = poseAt(0.75)
    expect(forward.thighL.rotation.x).toBeLessThan(-0.05)
    expect(back.thighL.rotation.x).toBeGreaterThan(0.05)
    // The right leg runs the same cycle half a stride later.
    expect(forward.thighR.rotation.x).toBeCloseTo(back.thighL.rotation.x, 5)
    expect(forward.thighR.rotation.x).toBeCloseTo(-forward.thighL.rotation.x, 5)
    expect(forward.footL.position.z).toBeGreaterThan(back.footL.position.z)

    const kneeFlexOf = (pose: ReturnType<typeof poseAt>, side: 'L' | 'R'): number =>
      (side === 'L' ? pose.shinL.rotation.x - pose.thighL.rotation.x : pose.shinR.rotation.x - pose.thighR.rotation.x)
    expect(kneeFlexOf(poseAt(0), 'L')).toBeGreaterThan(kneeFlexOf(poseAt(0.5), 'L'))
    expect(kneeFlexOf(poseAt(0.5), 'L')).toBeGreaterThan(0)

    expect(poseAt(0.25).torso.position.y).toBeGreaterThan(poseAt(0.5).torso.position.y)
    expect(poseAt(0.25).hips.position.y).toBeGreaterThan(poseAt(0.5).hips.position.y)
  })

  it('stands still with a weighting sway while waiting at a red light', () => {
    const body = createBodyProfile(createRng(BLOCK_SEED, 'idle').fork('body'), 0)
    const gait = createGaitProfile(createRng(BLOCK_SEED, 'idle').fork('gait'), getCrowdTable('2025').gait, body)
    const idle = (seconds: number) =>
      posePedestrian({
        body,
        gait,
        state: 'waiting',
        speedMps: 0,
        phase: 0.2,
        seconds,
        idlePhase: 0.1,
        lookPhase: 0.3,
        holdLeft: false,
        holdRight: true,
      })

    const start = idle(0)
    const quarter = idle(1.4)
    expect(Math.abs(start.thighL.rotation.x)).toBeLessThan(0.1)
    expect(start.torso.rotation.z).not.toBeCloseTo(quarter.torso.rotation.z, 4)
    expect(start.head.rotation.y).not.toBeCloseTo(quarter.head.rotation.y, 4)
    // The hand holding something is raised in front of the body.
    expect(start.forearmR.rotation.x).toBeLessThan(-1)
    expect(start.handR.position.z).toBeGreaterThan(0)
  })

  it('raises the arm of the hand that carries a prop', () => {
    const body = createBodyProfile(createRng(BLOCK_SEED, 'hold').fork('body'), 0)
    const gait = createGaitProfile(createRng(BLOCK_SEED, 'hold').fork('gait'), getCrowdTable('2005').gait, body)
    const pose = (holdRight: boolean) =>
      posePedestrian({
        body,
        gait,
        state: 'walking',
        speedMps: gait.speedMps,
        phase: 0.3,
        seconds: 1,
        idlePhase: 0,
        lookPhase: 0,
        holdLeft: false,
        holdRight,
      })
    const carrying = pose(true)
    const free = pose(false)
    expect(carrying.forearmR.rotation.x).toBeLessThan(free.forearmR.rotation.x - 0.5)
    expect(carrying.forearmL.rotation.x).toBeCloseTo(free.forearmL.rotation.x, 6)
  })
})

/* ------------------------------------------------------------------------- *
 * Shared geometry
 * ------------------------------------------------------------------------- */

describe('shared costume geometry', () => {
  it('shares one geometry between pieces that differ only in placement', () => {
    const left = { kind: 'box' as const, size: [0.1, 0.2, 0.3] as const, segments: 1, taper: 1, offset: [0, 0, 0] as const, rotation: [0, 0, 0] as const }
    const right = { ...left, offset: [0.4, -0.2, 0.1] as const, rotation: [0.2, 0, 0] as const }
    expect(shapeGeometryKey(right)).toBe(shapeGeometryKey(left))

    const coarser = { ...left, segments: 8 }
    expect(shapeGeometryKey(coarser)).not.toBe(shapeGeometryKey(left))
  })

  it('estimates exactly the triangles its geometry submits, on every tier', () => {
    for (const eraId of ERA_ID_ORDER) {
      const shapes = [...eraShapes(ERA_CROWD_TABLES[eraId]), ...Object.values(BODY_PART_SHAPES)]
      const seen = new Set<string>()
      for (const shape of shapes) {
        for (const tier of TIERS) {
          const scaled = tierShape(shape, tier)
          const key = shapeGeometryKey(scaled)
          if (seen.has(key)) {
            continue
          }
          seen.add(key)
          const geometry = buildShapeGeometry(scaled)
          expect(geometry.getIndex()?.count ?? 0, `${key} index`).toBeGreaterThan(0)
          expect((geometry.getIndex()?.count ?? 0) / 3, `${key} triangles`).toBe(
            shapeTriangleCount(scaled),
          )
          expect(tierShapeTriangles(shape, tier), `${key} estimate`).toBe(shapeTriangleCount(scaled))
          geometry.dispose()
        }
      }
      expect(seen.size, `${eraId} geometry keys`).toBeGreaterThan(20)
    }
  })

  it('keeps the resident pool far smaller than the crowd it dresses', () => {
    for (const eraId of ERA_ID_ORDER) {
      for (const tier of TIERS) {
        const library = costumeGeometryLibrary(eraId, tier)
        let triangles = 0
        for (const shape of library.values()) {
          triangles += shapeTriangleCount(shape)
        }
        expect(library.size).toBeLessThanOrEqual(PEDESTRIAN_DRAW_CALL_BUDGETS[tier])
        expect(triangles).toBeLessThanOrEqual(PEDESTRIAN_GEOMETRY_BUDGETS[tier])
      }
    }
    const highKeys = costumeGeometryLibrary('1985', 'high').size
    const lowKeys = costumeGeometryLibrary('1985', 'low').size
    expect(lowKeys).toBeLessThan(highKeys)
  })
})

/* ------------------------------------------------------------------------- *
 * Crowd behaviour
 * ------------------------------------------------------------------------- */

describe('crowd behaviour', () => {
  it('sizes the crowd from the era density against the real sidewalk length', () => {
    const length = walkableSidewalkLength(layout)
    expect(length).toBeGreaterThan(200)

    const counts = ERA_ID_ORDER.map((eraId) => ({
      eraId,
      count: crowdTargetCount(layout, getCrowdTable(eraId).density, 'high'),
      density: getCrowdTable(eraId).density,
    }))
    for (let index = 1; index < counts.length; index += 1) {
      const previous = counts[index - 1]
      const current = counts[index]
      expect(current?.density ?? 0).toBeGreaterThan(previous?.density ?? 0)
      expect(current?.count ?? 0).toBeGreaterThan(previous?.count ?? 0)
    }
    expect(crowdTargetCount(layout, 1, 'high')).toBeLessThanOrEqual(MAX_CROWD_COUNT)
    expect(crowdTargetCount(layout, 0.95, 'high')).toBe(
      Math.round(0.95 * 0.12 * length),
    )
    // Cheaper tiers carry a proportional share of the same density.
    for (const eraId of ERA_ID_ORDER) {
      const density = getCrowdTable(eraId).density
      const high = crowdTargetCount(layout, density, 'high')
      const medium = crowdTargetCount(layout, density, 'medium')
      const low = crowdTargetCount(layout, density, 'low')
      expect(medium).toBeLessThan(high)
      expect(low).toBeLessThan(medium)
    }
  })

  it('steps the clock deterministically, however the time is subdivided', () => {
    const spawn = (): ReturnType<typeof createPedestrianCrowd> =>
      createPedestrianCrowd({ layout, eraId: '2005', seed: BLOCK_SEED, tier: 'high' })

    // 300 frames of 1/60 s is the same five simulated seconds as one seek.
    const framed = spawn()
    for (let frame = 0; frame < 300; frame += 1) {
      advanceCrowd(framed, 1 / 60)
    }
    const oneShot = spawn()
    seekCrowd(oneShot, 5)
    expect(crowdStats(framed).signature).toBe(crowdStats(oneShot).signature)

    // Arriving at the same instant via an earlier instant is the same state.
    const staged = spawn()
    seekCrowd(staged, 2)
    seekCrowd(staged, 5)
    expect(crowdStats(staged).signature).toBe(crowdStats(oneShot).signature)

    // Seeking backwards replays from the spawn, so it is reproducible too.
    seekCrowd(oneShot, 1)
    seekCrowd(oneShot, 5)
    expect(crowdStats(oneShot).signature).toBe(crowdStats(staged).signature)
  })

  it('applies an era instantly and stages a blend pedestal by pedestal', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1945', seed: BLOCK_SEED, tier: 'high' })
    const instant = applyEra('2025', handle)
    expect(instant.eraId).toBe('2025')
    expect(instant.blend).toBeNull()
    expect(instant.activeCount).toBe(crowdTargetCount(layout, getCrowdTable('2025').density, 'high'))
    const dressed = handle.crowd.pedestrians
      .filter((pedestrian) => pedestrian.visible)
      .map((pedestrian) => pedestrianOutfit(handle.crowd, pedestrian))
    expect(new Set(dressed.map((look) => look.stage))).toEqual(new Set(['to']))
    expect(new Set(dressed.map((look) => look.outfit.eraId))).toEqual(new Set(['2025']))

    const staged = applyEraTransition({ from: '1945', to: '2025', t: 0.5 }, handle)
    expect(staged.blend?.t).toBe(0.5)
    const stages = handle.crowd.pedestrians
      .filter((pedestrian) => pedestrian.visible)
      .map((pedestrian) => pedestrianOutfit(handle.crowd, pedestrian).stage)
    expect(stages).toContain('to')
    expect(stages).toContain('props')
    expect(stages).toContain('from')

    const settled = applyEraTransition({ from: '1945', to: '2025', t: 1 }, handle)
    expect(settled.blend).toBeNull()
    expect(settled.activeCount).toBe(crowdTargetCount(layout, getCrowdTable('2025').density, 'high'))
  })

  it('honours the reduced-motion switch', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1945', seed: BLOCK_SEED, tier: 'high' })
    const instant = applyEraTransition(
      { from: '1945', to: '1985', t: 0.25, reducedMotion: true },
      handle,
    )
    expect(instant.eraId).toBe('1985')
    expect(instant.blend).toBeNull()
    expect(instant.activeCount).toBe(crowdTargetCount(layout, getCrowdTable('1985').density, 'high'))
  })

  it('stays inside the shared budgets at every tier', () => {
    for (const eraId of ERA_ID_ORDER) {
      for (const tier of TIERS) {
        const handle = createPedestrianLayer({ layout, eraId, seed: BLOCK_SEED, tier })
        const cost = estimateCrowdCost(handle.crowd)
        expect(cost.tier).toBe(tier)
        expect(cost.pedestrians).toBe(handle.crowd.activeCount)
        expect(cost.triangles).toBeGreaterThan(0)
        expect(cost.drawCalls).toBeGreaterThan(0)
        expect(cost.triangles).toBeLessThanOrEqual(PEDESTRIAN_TRIANGLE_BUDGETS[tier])
        expect(cost.drawCalls).toBeLessThanOrEqual(PEDESTRIAN_DRAW_CALL_BUDGETS[tier])
        expect(cost.poolTriangles).toBeLessThanOrEqual(PEDESTRIAN_GEOMETRY_BUDGETS[tier])
        expect(cost.withinBudget).toBe(true)
        expect(cost.lodCounts.reduce((total, value) => total + value, 0)).toBe(cost.pedestrians)
      }
    }
  })

  it('renders many instances per draw call and animates distant pedestrians more cheaply', () => {
    const handle = createPedestrianLayer({ layout, eraId: '2025', seed: BLOCK_SEED, tier: 'high' })
    const near = estimateCrowdCost(handle.crowd, {
      cameraPosition: { x: 0, y: 2, z: -58 },
    })
    const far = estimateCrowdCost(handle.crowd, {
      cameraPosition: { x: 240, y: 120, z: 240 },
    })
    expect(near.instances).toBeGreaterThan(near.drawCalls * 3)
    expect(near.triangles).toBeGreaterThan(far.triangles)
    expect(far.lodCounts[2]).toBe(far.pedestrians)
    expect(near.triangles).toBeLessThanOrEqual(PEDESTRIAN_TRIANGLE_BUDGETS.high)
  })

  it('reports the same payload whether the instance pool is fresh or reused', () => {
    const handle = createPedestrianLayer({ layout, eraId: '1965', seed: BLOCK_SEED, tier: 'high' })
    seekCrowd(handle.crowd, 24)
    const fresh = estimateCrowdCost(handle.crowd, { cameraPosition: { x: 0, y: 2, z: -58 } })

    // The renderer hands its own pool back every frame: a reused pool must
    // still rebuild the frame's draw list, entry counts and instance totals.
    const pool = createInstancePool()
    const first = collectInstances(handle.crowd, {
      cameraPosition: { x: 0, y: 2, z: -58 },
      pool,
    })
    const second = collectInstances(handle.crowd, {
      cameraPosition: { x: 0, y: 2, z: -58 },
      pool,
    })
    expect(second.drawCalls).toBe(first.drawCalls)
    expect(second.instances).toBe(first.instances)
    expect(second.triangles).toBe(first.triangles)
    expect(second.entries.map((entry) => entry.geometryKey)).toEqual(
      first.entries.map((entry) => entry.geometryKey),
    )
    expect(first.drawCalls).toBe(fresh.drawCalls)
    expect(first.instances).toBe(fresh.instances)
    expect(first.triangles).toBe(fresh.triangles)
    for (const entry of first.entries) {
      expect(entry.count).toBeGreaterThan(0)
      expect(entry.count).toBeLessThanOrEqual(entry.capacity)
    }
  })

  it('resolves the animation level of detail from distance and tier', () => {
    for (const tier of TIERS) {
      const [near, far] = ANIMATION_LOD_DISTANCES[tier]
      expect(animationLodFor(0, tier)).toBe(0)
      expect(animationLodFor(near, tier)).toBe(0)
      expect(animationLodFor(near + 0.001, tier)).toBe(1)
      expect(animationLodFor(far, tier)).toBe(1)
      expect(animationLodFor(far + 0.001, tier)).toBe(2)
      expect(animationLodFor(10_000, tier)).toBe(2)
    }
    expect(ANIMATION_LOD_DISTANCES.high[0]).toBeGreaterThan(ANIMATION_LOD_DISTANCES.medium[0])
    expect(ANIMATION_LOD_DISTANCES.medium[0]).toBeGreaterThan(ANIMATION_LOD_DISTANCES.low[0])
  })

  it('keeps its per-tier constants ordered like the shared quality ladder', () => {
    expect(PEDESTRIAN_TRIANGLE_BUDGETS.high).toBeGreaterThan(PEDESTRIAN_TRIANGLE_BUDGETS.medium)
    expect(PEDESTRIAN_TRIANGLE_BUDGETS.medium).toBeGreaterThan(PEDESTRIAN_TRIANGLE_BUDGETS.low)
    expect(PEDESTRIAN_DRAW_CALL_BUDGETS.high).toBeGreaterThan(PEDESTRIAN_DRAW_CALL_BUDGETS.medium)
    expect(PEDESTRIAN_DRAW_CALL_BUDGETS.medium).toBeGreaterThan(PEDESTRIAN_DRAW_CALL_BUDGETS.low)
    expect(PEDESTRIAN_GEOMETRY_BUDGETS.high).toBeGreaterThan(PEDESTRIAN_GEOMETRY_BUDGETS.medium)
    expect(PEDESTRIAN_GEOMETRY_BUDGETS.medium).toBeGreaterThan(PEDESTRIAN_GEOMETRY_BUDGETS.low)
  })

  it('dresses the whole crowd from its own era table', () => {
    for (const eraId of ERA_ID_ORDER) {
      const crowd = createPedestrianCrowd({ layout, eraId, seed: BLOCK_SEED, tier: 'high' })
      const table = getCrowdTable(eraId)
      const keys = new Set(table.outfits.map((look) => look.key))
      const props = new Set(table.props.map((entry) => entry.id))
      const stats = crowdStats(crowd)
      for (const outfitKey of stats.outfitKeys) {
        expect(keys.has(outfitKey), `${eraId} outfit ${outfitKey}`).toBe(true)
      }
      for (const propId of stats.propIds) {
        expect(props.has(propId), `${eraId} prop ${propId}`).toBe(true)
      }
      expect(stats.outfitKeys.length).toBe(table.outfits.length)
    }
  })

  it('wears every piece on the figure instead of floating beside it', () => {
    for (const eraId of ERA_ID_ORDER) {
      const crowd = createPedestrianCrowd({ layout, eraId, seed: BLOCK_SEED, tier: 'high' })
      seekCrowd(crowd, 6)
      for (const pedestrian of crowd.pedestrians.filter((entry) => entry.visible).slice(0, 5)) {
        const pose = pedestrianPoseOf(crowd, pedestrian)
        const dressed = pedestrianOutfit(crowd, pedestrian)
        const pieces = [
          ...dressed.outfit.garments.map((garment) => ({
            part: garment.part,
            shape: garment.shape,
          })),
          { part: dressed.outfit.hair.part, shape: dressed.outfit.hair.shape },
          ...(dressed.outfit.headwear === null ? [] : [dressed.outfit.headwear]),
          ...dressed.outfit.accessories,
          ...dressed.props,
        ]
        expect(pieces.length).toBeGreaterThan(6)

        let lowest = Number.POSITIVE_INFINITY
        let highest = Number.NEGATIVE_INFINITY
        let widest = 0
        for (const piece of pieces) {
          const transform = pose.parts[piece.part]
          const centreY = transform.position.y + piece.shape.offset[1] * pedestrian.body.heightScale
          const centreX = transform.position.x + piece.shape.offset[0] * pedestrian.body.widthScale
          const centreZ = transform.position.z + piece.shape.offset[2] * pedestrian.body.widthScale
          lowest = Math.min(
            lowest,
            centreY - (piece.shape.size[1] * pedestrian.body.heightScale) / 2,
          )
          highest = Math.max(
            highest,
            centreY + (piece.shape.size[1] * pedestrian.body.heightScale) / 2,
          )
          widest = Math.max(
            widest,
            Math.hypot(centreX, centreZ) +
              (Math.max(piece.shape.size[0], piece.shape.size[2]) * pedestrian.body.widthScale) /
                2,
          )
        }

        // Nothing sinks through the pavement, nothing floats above the head and
        // no garment or prop reaches further than an arm can carry it.
        expect(lowest, `${eraId} piece above the ground`).toBeGreaterThan(-0.05)
        expect(highest, `${eraId} piece below the crown`).toBeLessThan(
          pedestrian.body.heightM + 0.4,
        )
        expect(widest, `${eraId} piece within arm's reach`).toBeLessThan(0.9)
      }
    }
  })

  it('animates the walk as the clock advances and holds a waiter on its waypoint', () => {
    const crowd = createPedestrianCrowd({ layout, eraId: '1965', seed: BLOCK_SEED, tier: 'high' })
    seekCrowd(crowd, 4)

    const walker = crowd.pedestrians.find(
      (pedestrian) => pedestrian.visible && pedestrian.state === 'walking',
    )
    expect(walker).toBeDefined()
    if (walker === undefined) {
      return
    }
    const before = pedestrianPoseOf(crowd, walker)
    seekCrowd(crowd, 4.5)
    const after = pedestrianPoseOf(crowd, walker)
    expect(after.gaitPhase).not.toBe(before.gaitPhase)
    expect(
      Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z),
      'a walker covers ground as the clock advances',
    ).toBeGreaterThan(0.2)
    const swing = Math.abs(after.parts.footL.position.z - before.parts.footL.position.z) +
      Math.abs(after.parts.footR.position.z - before.parts.footR.position.z)
    expect(swing, 'the limbs move with the cycle').toBeGreaterThan(0.001)

    // Walk until someone is held at a red signal, then watch it stand still.
    let waiting = crowd.pedestrians.find(
      (pedestrian) => pedestrian.visible && pedestrian.state === 'waiting',
    )
    let heldAt = 4.5
    for (heldAt = 4.5; heldAt < 90 && waiting === undefined; heldAt += 0.5) {
      seekCrowd(crowd, heldAt)
      waiting = crowd.pedestrians.find(
        (pedestrian) => pedestrian.visible && pedestrian.state === 'waiting',
      )
    }
    expect(waiting, 'the crowd reaches a red signal within 90 s').toBeDefined()
    if (waiting === undefined) {
      return
    }
    const parked = pedestrianPoseOf(crowd, waiting)
    expect(parked.state).toBe('waiting')
    seekCrowd(crowd, heldAt + 0.05)
    if (waiting.state === 'waiting') {
      const stillParked = pedestrianPoseOf(crowd, waiting)
      expect(stillParked.position.x).toBeCloseTo(parked.position.x, 9)
      expect(stillParked.position.z).toBeCloseTo(parked.position.z, 9)
      expect(stillParked.parts.head.rotation.y).not.toBe(parked.parts.head.rotation.y)
    }
  })

  it('is reproducible from the block seed', () => {
    const first = createPedestrianCrowd({ layout, eraId: '1985', seed: BLOCK_SEED, tier: 'high' })
    const second = createPedestrianCrowd({ layout, eraId: '1985', seed: BLOCK_SEED, tier: 'high' })
    const other = createPedestrianCrowd({ layout, eraId: '1985', seed: 'city-block-alt', tier: 'high' })
    expect(crowdStats(second).signature).toBe(crowdStats(first).signature)
    expect(crowdStats(other).signature).not.toBe(crowdStats(first).signature)
  })
})
