/**
 * Integration coverage: the real block layout, the real era registry and the
 * real props layer.
 *
 * The unit suite proves the catalogue is complete and self-consistent. This spec
 * proves the *integrated* behaviour on the canonical block:
 *
 * - every anchor category an era demands is populated exactly once, and the
 *   anchors that belong to other layers are left alone;
 * - no prop footprint touches the carriageway, the sidewalk walking band or a
 *   building envelope, and no two props overlap — asserted independently from the
 *   published bounds rather than trusting the planner's own audit;
 * - the era censuses differ between adjacent periods, the era-specific props of
 *   the registry's vocabulary are on the block, lamps follow the era lighting
 *   data and the night flag, and the quality tiers stay inside their budgets;
 * - `applyEra` and `applyEraTransition` drive a real runtime, staged for normal
 *   users and instant under reduced motion.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import {
  BLOCK_DECK_HEIGHT,
  BLOCK_HALF,
  BUILD_LINE,
  CANONICAL_LAYOUT_SEED,
  classifyGround,
  createCityLayout,
  type BlockLayout,
} from '../../src/city/layout'
import { ERA_DEFINITIONS, ERA_IDS, getEra, type EraId } from '../../src/era'
import { QUALITY_TIERS } from '../../src/lib/quality'
import { hashValue } from '../support/hash'
import {
  MAX_GROUND_PROP_DEPTH,
  PROP_SLOTS,
  PROPS_DRAW_CALL_BUDGETS,
  PROPS_TRIANGLE_BUDGETS,
  SLOT_FILTERS,
  applyEra,
  applyEraTransition,
  anchorsForSlot,
  buildPropsObject,
  createPropsGeometryCache,
  createPropsRuntime,
  duplicatedAnchors,
  isInWalkingBand,
  missingAnchors,
  partVisibleAtTier,
  planEraProps,
  planTransition,
  propsForSlot,
  propsRetiredByEra,
  reservedAnchorNames,
  type PlacedProp,
  type PropSlot,
  type PropsLayerPlan,
} from '../../src/city/props'

let layout: BlockLayout

beforeAll(() => {
  layout = createCityLayout(CANONICAL_LAYOUT_SEED)
})

function planFor(eraId: EraId, extra: Partial<Parameters<typeof planEraProps>[1]> = {}): PropsLayerPlan {
  return planEraProps(layout, { eraId, ...extra })
}

/** True when two axis-aligned bounds overlap on all three axes. */
function overlaps(
  a: PlacedProp['aabb'],
  b: PlacedProp['aabb'],
  epsilon = 0.02,
): boolean {
  return (
    a.minX < b.maxX - epsilon &&
    b.minX < a.maxX - epsilon &&
    a.minY < b.maxY - epsilon &&
    b.minY < a.maxY - epsilon &&
    a.minZ < b.maxZ - epsilon &&
    b.minZ < a.maxZ - epsilon
  )
}

function describeIssues(plan: PropsLayerPlan): string {
  return plan.issues.map((issue) => `${issue.target} [${issue.code}] ${issue.message}`).join('\n')
}

describe('props placement on the canonical block', () => {
  it('plans a legal layout for every era', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.issues, `${eraId} issues:\n${describeIssues(plan)}`).toEqual([])
      expect(plan.props.length).toBeGreaterThan(40)
      expect(plan.triangles).toBeGreaterThan(0)
    }
  })

  it('populates every anchor category of every era exactly once', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const slot of PROP_SLOTS) {
        const expected = anchorsForSlot(layout, slot).map((anchor) => anchor.name).sort()
        const coverage = plan.coverage[slot]
        expect(expected.length, `${eraId} ${slot} has anchors`).toBeGreaterThan(0)
        expect(coverage.expected, `${eraId} ${slot} expected`).toEqual(expected)
        expect(coverage.placed, `${eraId} ${slot} placed`).toEqual(expected)
      }
      expect(missingAnchors(plan), `${eraId} missing anchors`).toEqual([])
      expect(duplicatedAnchors(plan), `${eraId} duplicate anchors`).toEqual([])
      const anchorNames = plan.props.map((prop) => prop.anchorName)
      expect(new Set(anchorNames).size, `${eraId} anchor uniqueness`).toBe(anchorNames.length)
    }
  })

  it('leaves the anchors of the other layers alone', () => {
    const reserved = new Set(reservedAnchorNames(layout))
    // Storefront bays, sign mounts, parking bays and the parcel inspection focus
    // belong to the storefront, signage, vehicle and QA layers.
    expect(reserved.size).toBeGreaterThan(40)
    for (const anchor of layout.anchors) {
      if (reserved.has(anchor.name)) {
        // Interior parcels publish a second prop point inside their own building,
        // which the layer deliberately leaves unclaimed.
        expect(
          ['storefront-bay', 'sign-mount', 'parking-bay', 'inspection-focus', 'prop-point'],
          anchor.name,
        ).toContain(anchor.kind)
      }
    }
    const unclaimedPropPoints = layout.anchors.filter(
      (anchor) => anchor.kind === 'prop-point' && reserved.has(anchor.name),
    )
    expect(unclaimedPropPoints.length).toBeGreaterThan(0)
    // Every unclaimed prop point is the mid-building service point of an interior
    // parcel, i.e. inside its own building envelope.
    for (const anchor of unclaimedPropPoints) {
      const inside = layout.parcels.some(
        (parcel) =>
          anchor.position.x > parcel.footprint.min.x + 0.01 &&
          anchor.position.x < parcel.footprint.max.x - 0.01 &&
          anchor.position.z > parcel.footprint.min.z + 0.01 &&
          anchor.position.z < parcel.footprint.max.z - 0.01,
      )
      expect(inside, `${anchor.name} is inside a building`).toBe(true)
    }
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const prop of plan.props) {
        expect(reserved.has(prop.anchorName), `${eraId} claims ${prop.anchorName}`).toBe(false)
      }
    }
    const cornerDetail = anchorsForSlot(layout, 'corner-clutter')
    expect(cornerDetail.length).toBe(4)
    for (const anchor of cornerDetail) {
      expect(anchor.owner.kind).toBe('corner')
    }
    expect(SLOT_FILTERS['rooftop-detail'].tag).toBe('rooftop')
    expect(SLOT_FILTERS['street-furniture'].tag).toBe('street-level')
  })

  it('keeps every prop off the carriageway, out of the walking band and clear of buildings', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const prop of plan.props) {
        const { aabb } = prop
        if (prop.mount === 'roof') {
          // A rooftop prop stands on its parcel's roof cap, never inside it.
          const parcel = layout.parcels.find((candidate) => candidate.id === prop.ownerId)
          expect(parcel, `${eraId} ${prop.anchorName} owner parcel`).toBeDefined()
          expect(aabb.minY, `${eraId} ${prop.anchorName} roof base`).toBeGreaterThanOrEqual(
            BLOCK_DECK_HEIGHT + (parcel?.capacity.maxHeight ?? 0) - 0.02,
          )
          continue
        }
        const samples = [
          { x: aabb.minX, z: aabb.minZ },
          { x: aabb.minX, z: aabb.maxZ },
          { x: aabb.maxX, z: aabb.minZ },
          { x: aabb.maxX, z: aabb.maxZ },
          { x: (aabb.minX + aabb.maxX) / 2, z: (aabb.minZ + aabb.maxZ) / 2 },
        ]
        for (const sample of samples) {
          const ground = classifyGround(sample.x, sample.z)
          expect(ground, `${eraId} ${prop.propId} at ${prop.anchorName} sits on ${ground}`).not.toBe('roadway')
          expect(ground, `${eraId} ${prop.propId} at ${prop.anchorName} sits on ${ground}`).not.toBe('outside')
          expect(ground, `${eraId} ${prop.propId} at ${prop.anchorName} sits on ${ground}`).not.toBe('parcel')
          expect(
            isInWalkingBand(sample.x, sample.z),
            `${eraId} ${prop.propId} at ${prop.anchorName} intrudes on the walking band`,
          ).toBe(false)
        }
        if (prop.mount !== 'pole-top') {
          expect(aabb.maxY, `${eraId} ${prop.anchorName} height`).toBeLessThanOrEqual(
            BLOCK_DECK_HEIGHT + 12 + 1e-6,
          )
        }
      }
    }
  })

  it('never overlaps a building envelope', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const prop of plan.props) {
        for (const parcel of layout.parcels) {
          const footprint = parcel.footprint
          const intersectsXZ =
            prop.aabb.minX < footprint.max.x - 0.02 &&
            footprint.min.x < prop.aabb.maxX - 0.02 &&
            prop.aabb.minZ < footprint.max.z - 0.02 &&
            footprint.min.z < prop.aabb.maxZ - 0.02
          if (!intersectsXZ) {
            continue
          }
          const roofTop = BLOCK_DECK_HEIGHT + parcel.capacity.maxHeight
          const intersectsY =
            prop.aabb.minY < roofTop - 0.02 && prop.aabb.maxY > BLOCK_DECK_HEIGHT + 0.02
          expect(
            intersectsY,
            `${eraId} ${prop.propId} at ${prop.anchorName} intersects ${parcel.id}`,
          ).toBe(false)
        }
      }
    }
  })

  it('places no two props on top of each other', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (let left = 0; left < plan.props.length; left += 1) {
        for (let right = left + 1; right < plan.props.length; right += 1) {
          const a = plan.props[left] as PlacedProp
          const b = plan.props[right] as PlacedProp
          expect(
            overlaps(a.aabb, b.aabb),
            `${eraId}: ${a.key} overlaps ${b.key}`,
          ).toBe(false)
        }
      }
    }
  })

  it('respects the sidewalk sub-band and the prop depth limit', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const prop of plan.props) {
        if (prop.mount === 'roof') {
          continue
        }
        expect(prop.footprint.depth, `${eraId} ${prop.propId} depth`).toBeLessThanOrEqual(
          MAX_GROUND_PROP_DEPTH + 1e-6,
        )
        // The contact point sits in the sidewalk ring: nearest-axis distance to the
        // block centre is between the build line and the kerb.
        const contactAcross = Math.max(Math.abs(prop.contact.x), Math.abs(prop.contact.z))
        expect(contactAcross, `${eraId} ${prop.propId} contact`).toBeGreaterThanOrEqual(BUILD_LINE)
        expect(contactAcross, `${eraId} ${prop.propId} contact`).toBeLessThan(BLOCK_HALF)
        expect(prop.band).toMatch(/band$/)
      }
    }
  })

  it('is deterministic from the block seed and moves with the seed', () => {
    for (const eraId of ERA_IDS) {
      const first = planFor(eraId)
      const second = planFor(eraId)
      expect(hashValue(second.props), `${eraId} determinism`).toBe(hashValue(first.props))
      const otherSeed = planFor(eraId, { seed: 'city-block-alternate' })
      expect(hashValue(otherSeed.props), `${eraId} alternate seed`).not.toBe(hashValue(first.props))
      expect(otherSeed.issues, `${eraId} alternate seed issues`).toEqual([])
    }
  })
})

describe('era censuses and props', () => {
  it('differs between adjacent eras and keeps every era vocabulary item', () => {
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previous = ERA_IDS[index - 1] as EraId
      const current = ERA_IDS[index] as EraId
      const before = planFor(previous)
      const after = planFor(current)
      expect(hashValue(after.census.byProp), `${previous} vs ${current} census`).not.toBe(
        hashValue(before.census.byProp),
      )
      for (const propId of Object.keys(before.census.byProp)) {
        expect(before.activeProps, `${previous} lists ${propId}`).toContain(propId)
      }
    }
    for (const era of ERA_DEFINITIONS) {
      const plan = planFor(era.id)
      for (const tag of era.contentTags.props) {
        expect(plan.activeProps, `${era.id} places ${tag}`).toContain(tag)
      }
    }
  })

  it('retires obsolete props strictly across a period change', () => {
    const y2005 = planFor('2005')
    const y2025 = planFor('2025')
    expect(y2005.activeProps).toContain('telephone-booth')
    expect(y2025.activeProps).not.toContain('telephone-booth')
    expect(y2025.activeProps).not.toContain('payphone')
    expect(y2025.activeProps).toContain('smart-pole')
    // The 2025 catalogue drops what the 2005 catalogue placed, and the lifespan
    // rules drop the phone row as well.
    expect(y2025.retiredProps).toContain('telephone-booth')
    expect(y2025.retiredProps).toContain('parking-kiosk')
    expect(propsRetiredByEra('2025')).toContain('payphone')
    const y1945 = planFor('1945')
    expect(y1945.activeProps).toContain('cast-iron-lamp')
    expect(y1945.activeProps).not.toContain('sodium-lamp')
    expect(planFor('1985').activeProps).toContain('payphone')
  })

  it('covers all five prop families in every era', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const category of ['lighting', 'signals', 'furniture', 'utility', 'clutter'] as const) {
        expect(plan.census.byCategory[category], `${eraId} ${category}`).toBeGreaterThan(0)
      }
      for (const slot of PROP_SLOTS) {
        expect(plan.census.bySlot[slot], `${eraId} ${slot}`).toBeGreaterThan(0)
      }
      expect(plan.census.uniqueToEra.length, `${eraId} signature props`).toBeGreaterThan(0)
    }
  })

  it('dresses the small persistent detail of every period', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      const detail = plan.census.detail
      expect(detail['drain'] ?? 0, `${eraId} drains`).toBeGreaterThan(0)
      expect(detail['grate'] ?? 0, `${eraId} grates`).toBeGreaterThan(0)
      expect(detail['vent'] ?? 0, `${eraId} vents`).toBeGreaterThan(0)
      expect(detail['drainpipe'] ?? 0, `${eraId} drainpipes`).toBeGreaterThan(0)
      expect(detail['signage-pole'] ?? 0, `${eraId} signage poles`).toBeGreaterThan(0)
      expect(detail['awning-frame'] ?? 0, `${eraId} awning frames`).toBeGreaterThan(0)
      expect(detail['patch'] ?? 0, `${eraId} pavement patches`).toBeGreaterThan(0)
      expect(detail['pile'] ?? 0, `${eraId} seasonal piles`).toBeGreaterThan(0)
      expect(detail['clutter'] ?? 0, `${eraId} corner clutter`).toBeGreaterThan(0)
    }
    expect(planFor('1985').census.detail['barrier'] ?? 0).toBeGreaterThan(0)
    expect(planFor('1945').census.detail['ac-unit'] ?? 0).toBe(0)
    expect(planFor('1985').census.detail['ac-unit'] ?? 0).toBeGreaterThan(0)
    expect(planFor('2025').census.detail['charger'] ?? 0).toBeGreaterThan(0)
  })

  it('dresses the lamps after the era lighting data and the night flag', () => {
    const y1985 = planFor('1985')
    const y1965 = planFor('1965')
    const y1945 = planFor('1945')
    expect(y1985.night).toBe(true)
    expect(y1965.night).toBe(false)
    expect(y1985.lamp.technology).toBe('mercury-sodium')
    expect(y1965.lamp.technology).toBe('incandescent')
    expect(y1945.lamp.technology).toBe('gas')
    expect(planFor('2005').lamp.technology).toBe('led')
    expect(planFor('2025').lamp.technology).toBe('smart-pole')

    const lightPostProps = (plan: PropsLayerPlan): readonly PlacedProp[] =>
      plan.props.filter((prop) => prop.anchorSlot === 'light-post')
    for (const eraId of ERA_IDS) {
      const lamps = lightPostProps(planFor(eraId))
      expect(lamps.length, `${eraId} lamps`).toBe(16)
      for (const lamp of lamps) {
        expect(lamp.lamp, `${eraId} ${lamp.propId} lamp`).not.toBeNull()
        expect(lamp.lamp?.emissiveIntensity ?? 0).toBeGreaterThan(0)
        expect(lamp.lamp?.technology).toBe(planFor(eraId).lamp.technology)
        expect(lamp.lamp?.colour.toLowerCase()).toBe(
          getEra(eraId).lighting.artificialLightColor.toLowerCase(),
        )
      }
    }
    // Night street lighting contributes real light; a daylight era barely glows.
    expect(y1985.lamp.pointLights).toBeGreaterThan(0)
    expect(y1985.lamp.emissiveIntensity).toBeGreaterThan(y1965.lamp.emissiveIntensity)
    expect(y1965.lamp.pointLights).toBe(0)
    expect(y1985.lamp.pointLightIntensity).toBeGreaterThan(0)

    // The same era relit at night burns brighter and lights more of its lamps.
    const forcedNight = planFor('1965', { night: true })
    expect(forcedNight.night).toBe(true)
    expect(forcedNight.lamp.pointLights).toBeGreaterThan(0)
    expect(forcedNight.lamp.emissiveIntensity).toBeGreaterThan(y1965.lamp.emissiveIntensity)
    const forcedDay = planFor('1985', { night: false })
    expect(forcedDay.lamp.emissiveIntensity).toBeLessThan(y1985.lamp.emissiveIntensity)
  })

  it('advances the lighting technology with the timeline', () => {
    const technologies = ERA_IDS.map((eraId) => planFor(eraId).lamp.technology)
    expect(technologies).toEqual(['gas', 'incandescent', 'mercury-sodium', 'led', 'smart-pole'])
    const emissive = ERA_IDS.map((eraId) => planFor(eraId).lamp.emissiveIntensity)
    expect(emissive[2]).toBeGreaterThan(emissive[1] as number)
  })

  it('scales optional detail with the quality tier without losing coverage', () => {
    const high = planFor('1985', { qualityTier: 'high' })
    const low = planFor('1985', { qualityTier: 'low' })
    expect(low.props.length).toBe(high.props.length)
    expect(missingAnchors(low)).toEqual([])
    expect(low.lamp.pointLights).toBeLessThanOrEqual(high.lamp.pointLights)
    const clutterPart = propsForSlot('street-furniture')
      .flatMap((recipe) => recipe.parts.map((part, index) => ({ recipe, index, part })))
      .find((entry) => entry.part.detail === 'clutter')
    expect(clutterPart, 'the catalogue has a cosmetic part').toBeDefined()
    if (clutterPart !== undefined) {
      expect(partVisibleAtTier(clutterPart.recipe, clutterPart.index, 'high')).toBe(true)
      expect(partVisibleAtTier(clutterPart.recipe, clutterPart.index, 'low')).toBe(false)
    }
  })
})

describe('props runtime', () => {
  it('mounts an era with instanced batches inside the shared budgets', () => {
    const runtime = createPropsRuntime(layout, { qualityTier: 'high' })
    try {
      const plan = runtime.applyEra('1985')
      const built = runtime.built
      expect(built, 'runtime built a layer').not.toBeNull()
      expect(runtime.eraId).toBe('1985')
      expect(runtime.stats?.eraId).toBe('1985')
      expect(runtime.stats?.propCount).toBe(plan.props.length)
      expect(runtime.stats?.drawCalls ?? 0).toBeLessThanOrEqual(PROPS_DRAW_CALL_BUDGETS.high)
      expect(runtime.stats?.triangles ?? 0).toBeLessThanOrEqual(PROPS_TRIANGLE_BUDGETS.high)
      expect(runtime.stats?.coverage.missing).toEqual([])
      expect(runtime.stats?.coverage.anchors).toBe(runtime.stats?.coverage.placed)
      // Instancing: several props share each batch.
      expect(built?.batches.length ?? 0).toBeLessThan(runtime.stats?.instanceCount ?? 0)
      expect(built?.batches.length ?? 0).toBeLessThan(plan.props.length * 2)
      expect(runtime.root.children.length).toBeGreaterThan(0)
      expect(runtime.root.name).toBe('props-layer')
      expect(built?.root.name).toBe('era-props:1985')
      for (const batch of built?.batches ?? []) {
        expect(batch.mesh.count).toBeGreaterThan(0)
        expect(batch.mesh.instanceMatrix.count).toBeGreaterThanOrEqual(batch.mesh.count)
      }
      // Lamp lights are mounted and aimed at their lamp.
      expect(built?.lights.length).toBe(plan.lamp.pointLights)
      for (const light of built?.lights ?? []) {
        expect(light.intensity).toBeGreaterThan(0)
        expect(light.position.y).toBeGreaterThan(BLOCK_DECK_HEIGHT)
      }
    } finally {
      runtime.dispose()
    }
    expect(runtimeDisposed(runtime)).toBe(true)
  })

  it('offers the same numbers through the imperative integration surface', () => {
    const runtime = createPropsRuntime(layout)
    try {
      const plan = applyEra('1945', { runtime })
      expect(plan.eraId).toBe('1945')
      expect(runtime.plan?.eraId).toBe('1945')
      const frame = applyEraTransition({ from: '1945', to: '2025', t: 0.5 }, { runtime })
      expect(frame.from).toBe('1945')
      expect(frame.to).toBe('2025')
      expect(runtime.eraId).toBe('2025')
    } finally {
      runtime.dispose()
    }
  })

  it('keeps every era inside its tier budget when built', () => {
    const cache = createPropsGeometryCache()
    try {
      for (const eraId of ERA_IDS) {
        for (const tier of ['high', 'low'] as const) {
          const plan = planFor(eraId, { qualityTier: tier })
          const built = buildPropsObject(plan, { cache, qualityTier: tier })
          try {
            expect(built.stats.drawCalls, `${eraId} ${tier} draw calls`).toBeLessThanOrEqual(
              PROPS_DRAW_CALL_BUDGETS[tier],
            )
            expect(built.stats.triangles, `${eraId} ${tier} triangles`).toBeLessThanOrEqual(
              PROPS_TRIANGLE_BUDGETS[tier],
            )
            expect(built.stats.coverage.missing, `${eraId} ${tier} coverage`).toEqual([])
            expect(built.batches.length, `${eraId} ${tier} batches`).toBeGreaterThan(0)
          } finally {
            disposeBuiltLeaves(built)
          }
        }
      }
    } finally {
      cache.dispose()
    }
  })

  it('reuses one geometry per part across every era', () => {
    const cache = createPropsGeometryCache()
    try {
      const first = buildPropsObject(planFor('1945'), { cache })
      const second = buildPropsObject(planFor('2025'), { cache })
      const firstGeometries = new Set(first.batches.map((batch) => batch.mesh.geometry.uuid))
      const reused = second.batches.filter((batch) => firstGeometries.has(batch.mesh.geometry.uuid))
      expect(reused.length).toBeGreaterThan(0)
      disposeBuiltLeaves(first)
      disposeBuiltLeaves(second)
    } finally {
      cache.dispose()
    }
  })
})

describe('staged era transitions', () => {
  it('stages the switch and finishes on the destination era', () => {
    const atStart = planTransition(layout, { from: '1945', to: '1985', t: 0 })
    const midway = planTransition(layout, { from: '1945', to: '1985', t: 0.5 })
    const atEnd = planTransition(layout, { from: '1945', to: '1985', t: 1 })

    expect(atStart.staged).toBe(true)
    expect(midway.props.length).toBeGreaterThan(0)
    // Props that both eras own persist at full weight.
    expect(atStart.counts.persistent).toBeGreaterThan(0)
    expect(atStart.counts.replaced).toBeGreaterThan(0)

    const appearingAtStart = atStart.props.filter((staged) => staged.phase === 'appearing')
    expect(appearingAtStart.length).toBeGreaterThan(0)
    for (const staged of appearingAtStart) {
      expect(staged.weight).toBe(0)
    }
    const appearingAtEnd = atEnd.props.filter((staged) => staged.phase === 'appearing')
    for (const staged of appearingAtEnd) {
      expect(staged.weight).toBe(1)
    }
    const retiringAtEnd = atEnd.props.filter((staged) => staged.phase === 'retiring')
    for (const staged of retiringAtEnd) {
      expect(staged.weight).toBe(0)
    }
    // Partway through, at least one prop is mid-apparition.
    const partial = midway.props.filter(
      (staged) => staged.weight > 0 && staged.weight < 1 && staged.source === 'to',
    )
    expect(partial.length).toBeGreaterThan(0)

    // The visible set is exactly the departing era at t = 0 and exactly the
    // arriving era at t = 1.
    const visibleAt = (frame: typeof atStart): string[] =>
      frame.props
        .filter((staged) => staged.weight > 0)
        .map((staged) => staged.prop.key)
        .sort()
    expect(visibleAt(atStart)).toEqual(atStart.fromPlan.props.map((prop) => prop.key).sort())
    expect(visibleAt(atEnd)).toEqual(atEnd.toPlan.props.map((prop) => prop.key).sort())
  })

  it('switches instantly under reduced motion', () => {
    const early = planTransition(layout, { from: '1945', to: '1985', t: 0.4, reducedMotion: true })
    const late = planTransition(layout, { from: '1945', to: '1985', t: 0.6, reducedMotion: true })
    expect(early.reducedMotion).toBe(true)
    expect(early.staged).toBe(false)
    for (const staged of early.props) {
      if (staged.source === 'to') {
        expect(staged.weight).toBe(0)
      }
      if (staged.source === 'from') {
        expect(staged.weight).toBe(1)
      }
    }
    for (const staged of late.props) {
      if (staged.source === 'to') {
        expect(staged.weight).toBe(1)
      }
      if (staged.source === 'from') {
        expect(staged.weight).toBe(0)
      }
    }
  })

  it('drives a real runtime through a staged switch and settles afterwards', () => {
    const runtime = createPropsRuntime(layout, { qualityTier: 'high' })
    try {
      runtime.applyEra('1945')
      const builtBefore = runtime.built
      const frame = runtime.applyEraTransition({ from: '1945', to: '2025', t: 0 })
      expect(frame.toPlan.eraId).toBe('2025')
      expect(frame.fromPlan.eraId).toBe('1945')
      expect(runtime.cachedEras.length).toBeLessThanOrEqual(2)
      expect(runtime.stats?.eraId).toBe('2025')
      // Half-way through both eras are mounted and lit.
      const midway = runtime.applyEraTransition({ from: '1945', to: '2025', t: 0.5 })
      const anyVisible = midway.props.some((staged) => staged.weight > 0)
      expect(anyVisible).toBe(true)
      const settled = runtime.applyEra('2025')
      expect(settled.eraId).toBe('2025')
      expect(runtime.built?.eraId).toBe('2025')
      expect(builtBefore?.eraId).toBe('1945')
    } finally {
      runtime.dispose()
    }
  })
})

/** True when a disposed runtime released its scene graph children. */
function runtimeDisposed(runtime: ReturnType<typeof createPropsRuntime>): boolean {
  return runtime.root.children.length === 0 && runtime.built === null
}

/** Releases the meshes and materials of one built layer (test-local cleanup). */
function disposeBuiltLeaves(built: ReturnType<typeof buildPropsObject>): void {
  for (const batch of built.batches) {
    batch.mesh.removeFromParent()
    batch.mesh.dispose()
  }
  for (const material of built.materials) {
    material.dispose()
  }
  built.root.clear()
}

describe('tier constants', () => {
  it('orders the budgets from the cheapest tier up', () => {
    expect(QUALITY_TIERS.low.density.props).toBeLessThan(QUALITY_TIERS.high.density.props)
    expect(PROPS_TRIANGLE_BUDGETS.low).toBeLessThan(PROPS_TRIANGLE_BUDGETS.medium)
    expect(PROPS_TRIANGLE_BUDGETS.medium).toBeLessThan(PROPS_TRIANGLE_BUDGETS.high)
    expect(PROPS_DRAW_CALL_BUDGETS.low).toBeLessThan(PROPS_DRAW_CALL_BUDGETS.high)
    const slot: PropSlot = 'light-post'
    expect(PROP_SLOTS).toContain(slot)
  })
})
