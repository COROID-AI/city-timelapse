/**
 * Composition contract: the real layout, the real era registry and the real
 * storefront layer, wired together.
 *
 * Nothing here is stubbed. The block comes from `createCityLayout()`, the
 * period data from `src/era`, and the layer's own barrel decides what to dress,
 * where to hang it, and how it glows. The suite asserts the integration the
 * scene phase depends on:
 *
 * - every storefront-bay anchor is dressed exactly once, at its declared size,
 *   with its fascia board on the bay's own sign anchor;
 * - street advertising lands on the block's projecting sign anchors and its
 *   count and campaigns change between every adjacent era;
 * - sign palettes come from the registry palette and emissive strength from the
 *   registry lighting;
 * - `applyEraTransition` at `t = 1` is exactly `applyEra(to)`, and reduced
 *   motion switches in one step;
 * - the three.js group the React layer mounts carries the counts it promises.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, getEra, type EraId } from '../../src/era'
import {
  anchorByName,
  anchorsOfKind,
  createCityLayout,
  layoutHash,
  type Anchor,
} from '../../src/city/layout'
import {
  StorefrontLayer,
  applyEra,
  applyEraTransition,
  applyProgressiveSwap,
  createStorefrontGroup,
  disposeStorefrontGroup,
  storefrontEraData,
  storefrontPlanHash,
  summariseStorefrontGroup,
} from '../../src/city/storefronts'
import type {
  SignCanvas2D,
  SignCanvasFactory,
  StorefrontPlan,
} from '../../src/city/storefronts'

/* ------------------------------------------------------------------------- *
 * Fixtures
 * ------------------------------------------------------------------------- */

const layout = createCityLayout()
const bayAnchors = anchorsOfKind(layout, 'storefront-bay')
const projectingAnchors = anchorsOfKind(layout, 'sign-mount').filter((anchor) =>
  anchor.tags.includes('projecting'),
)
const BLOCK_HASH = layoutHash(layout)

function planFor(eraId: EraId, options: { readonly night?: boolean; readonly qualityTier?: 'high' | 'low' } = {}) {
  return applyEra(eraId, { layout, ...options })
}

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined`)
  }
  return value
}

/** Canvas double good enough for three.js to accept it as a texture source. */
interface FakeCanvas {
  readonly width: number
  readonly height: number
  getContext(id: string): SignCanvas2D
}

function createStubFactory(): { readonly factory: SignCanvasFactory<FakeCanvas>; readonly count: () => number } {
  let created = 0
  const context: SignCanvas2D = {
    canvas: { width: 0, height: 0 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'round',
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
  }
  const factory: SignCanvasFactory<FakeCanvas> = (width, height) => {
    created += 1
    const canvas: FakeCanvas = { width, height, getContext: () => context }
    return { canvas, context }
  }
  return { factory, count: () => created }
}

interface EraCounts {
  readonly total: number
  readonly byKind: Readonly<Record<string, number>>
  readonly campaigns: readonly string[]
}

const ADVERTISING_COUNTS: Readonly<Record<string, EraCounts>> = Object.fromEntries(
  ERA_IDS.map((eraId) => {
    const plan = planFor(eraId)
    return [
      eraId,
      {
        total: plan.stats.advertisingTotal,
        byKind: plan.stats.advertisingByKind,
        campaigns: plan.advertising.map((placement) => placement.copy.tag).sort(),
      },
    ]
  }),
)

/* ------------------------------------------------------------------------- *
 * Bay dressing
 * ------------------------------------------------------------------------- */

describe('storefronts across the real block', () => {
  it('dresses every storefront bay exactly once, from the anchor itself', () => {
    expect(bayAnchors.length).toBeGreaterThan(20)
    expect(BLOCK_HASH.length).toBe(16)

    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      const dressed = plan.units.map((unit) => unit.anchor)
      expect(new Set(dressed).size, `${eraId} unique bays`).toBe(bayAnchors.length)
      expect(dressed.length).toBe(bayAnchors.length)
      expect(plan.stats.bareBays).toBe(0)

      for (const unit of plan.units) {
        const anchor: Anchor = anchorByName(layout, unit.anchor)
        expect(anchor.kind).toBe('storefront-bay')
        expect(unit.width, `${eraId} ${unit.anchor} width`).toBe(anchor.size?.width)
        expect(unit.height).toBe(anchor.size?.height)
        expect(unit.position).toEqual(anchor.position)
        expect(unit.normal).toEqual(anchor.normal)
        expect(unit.street).toBe(anchor.facing)
        expect(unit.parcel).toBe(anchor.owner.id)
        expect(unit.bayIndex).toBe(Number.parseInt(unit.anchor.split(':').at(-1) ?? '0', 10))
        // The fascia board hangs on the bay's own layout sign anchor, never on
        // an invented position.
        const fascia = anchorByName(layout, unit.signBoard.anchor)
        expect(fascia.kind).toBe('sign-mount')
        expect(fascia.tags).toContain('fascia')
        expect(fascia.owner.id).toBe(anchor.owner.id)
        expect(unit.signBoard.width).toBeCloseTo(fascia.size?.width ?? 0, 6)
        expect(unit.signBoard.position).toEqual(fascia.position)
      }
    }
  })

  it('keeps every period front inside its bay envelope', () => {
    for (const eraId of ERA_IDS) {
      for (const unit of planFor(eraId).units) {
        expect(unit.frame.pilaster * 2, `${eraId} ${unit.anchor} joinery`).toBeLessThan(unit.width)
        expect(unit.door.width).toBeLessThan(unit.width)
        expect(unit.door.height).toBeLessThan(unit.height)
        expect(unit.glazing.headHeight).toBeLessThan(unit.height)
        expect(unit.awning.projection).toBeGreaterThan(0.5)
        expect(unit.awning.drop).toBeGreaterThan(0.3)
        expect(unit.signBoard.width).toBeLessThan(unit.width)
        expect(unit.awning.kind).not.toBe('none' as never)
      }
    }
  })

  it('takes sign and trim colours from the era registry palette', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const palette = new Set(Object.values(era.palette))
      const plan = planFor(eraId)
      for (const unit of plan.units) {
        expect(unit.signBoard.colour).toBe(era.palette.storefrontSign)
        expect(unit.signBoard.surface.background).toBe(era.palette.storefrontSign)
        expect(unit.signBoard.surface.accent).toBe(era.palette.accent)
        expect(unit.frame.colour).toBe(era.palette.storefrontBody)
        expect(unit.shutter.colour).toBe(era.palette.buildingAccent)
        expect(unit.glazing.colour).toBe(era.palette.windowGlass)
      }
      for (const placement of plan.advertising) {
        expect(palette.has(placement.surface.background), `${eraId} ${placement.kind} base`).toBe(true)
        expect(palette.has(placement.surface.accent)).toBe(true)
      }
      for (const mark of plan.graffiti) {
        expect(storefrontEraData(eraId).graffiti.colours).toContain(mark.colour)
      }
    }
  })

  it('uses the shop vocabulary of the era table on every bay', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      const plan = planFor(eraId)
      for (const unit of plan.units) {
        const shop = requireDefined(
          data.shopTypes.find((candidate) => candidate.id === unit.shopType),
          `${eraId} shop ${unit.shopType}`,
        )
        expect(shop.names).toContain(unit.shopName)
        expect(unit.shopLabel).toBe(shop.label)
        expect(unit.frame.joinery).toBe(shop.joinery)
        expect(unit.awning.kind).toBe(shop.awning)
        expect(unit.shutter.kind).toBe(shop.shutter)
        expect(unit.awning.stripes).toBe(data.awningStripes)
      }
      expect(plan.stats.signageVocabulary).toEqual(data.signage)
      expect(plan.stats.typographyId).toBe(data.typography.id)
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Advertising and graffiti on the block
 * ------------------------------------------------------------------------- */

describe('street advertising on the block', () => {
  it('mounts every campaign on a real projecting sign anchor', () => {
    expect(projectingAnchors.length).toBeGreaterThan(8)
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      const used = new Set<string>()
      for (const placement of plan.advertising) {
        const anchor = anchorByName(layout, placement.anchor)
        expect(anchor.kind).toBe('sign-mount')
        expect(anchor.tags).toContain('projecting')
        expect(used.has(placement.anchor), `${eraId} ${placement.anchor} used twice`).toBe(false)
        used.add(placement.anchor)
      }
      expect(plan.advertising.length).toBeLessThanOrEqual(projectingAnchors.length)
      expect(plan.advertising.length).toBe(plan.stats.advertisingTotal)
    }
  })

  it('changes the count and the campaigns between every adjacent era', () => {
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previousId = ERA_IDS[index - 1] as EraId
      const currentId = ERA_IDS[index] as EraId
      const previous = requireDefined(ADVERTISING_COUNTS[previousId], `${previousId} counts`)
      const current = requireDefined(ADVERTISING_COUNTS[currentId], `${currentId} counts`)
      expect(current.total, `${previousId} → ${currentId} total`).not.toBe(previous.total)
      expect(current.byKind, `${previousId} → ${currentId} mix`).not.toEqual(previous.byKind)
      expect(current.campaigns, `${previousId} → ${currentId} campaigns`).not.toEqual(
        previous.campaigns,
      )
    }
  })

  it('states its advertising copy in the period vocabulary and prices', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const plan = planFor(eraId)
      const tags = new Set(plan.advertising.map((placement) => placement.copy.tag))
      expect([...tags].sort()).toEqual([...era.contentTags.advertisements].sort())
      for (const placement of plan.advertising) {
        const lines = placement.surface.lines
        expect(lines[0]?.text).toBe(placement.copy.brand)
        expect(lines.some((line) => line.text === placement.copy.headline)).toBe(true)
        expect(lines.some((line) => line.text === placement.copy.price)).toBe(true)
        expect(placement.surface.purpose).toBe(placement.kind)
        expect(placement.surface.eraId).toBe(eraId)
      }
    }
  })

  it('paints graffiti only where the era allows it, on real shopfront bays', () => {
    const bayNames = new Set(bayAnchors.map((anchor) => anchor.name))
    for (const eraId of ERA_IDS) {
      const profile = storefrontEraData(eraId).graffiti
      const plan = planFor(eraId)
      if (profile.state === 'none') {
        expect(plan.graffiti, `${eraId} is clean`).toHaveLength(0)
        continue
      }
      expect(plan.graffiti.length, `${eraId} marks`).toBeGreaterThan(0)
      for (const mark of plan.graffiti) {
        expect(bayNames.has(mark.anchor), `${eraId} ${mark.anchor} is a bay`).toBe(true)
        expect(mark.surface.purpose).toBe('graffiti')
        expect(profile.styles).toContain(mark.style)
        expect(profile.messages).toContain(mark.text)
      }
      if (profile.state === 'murals') {
        expect(plan.graffiti.some((mark) => mark.style === 'mural')).toBe(true)
      }
      if (profile.state === 'cleaned') {
        expect(plan.graffiti.every((mark) => mark.style === 'remnant')).toBe(true)
      }
    }
  })

  it('reports counts that match the objects it actually places', () => {
    for (const eraId of ERA_IDS) {
      const plan: StorefrontPlan = planFor(eraId)
      expect(plan.stats.bayCount).toBe(plan.units.length)
      expect(plan.stats.dressedBays).toBe(plan.units.length)
      expect(plan.stats.graffitiCount).toBe(plan.graffiti.length)
      expect(plan.stats.advertisingTotal).toBe(plan.advertising.length)
      expect(plan.stats.graffitiState).toBe(storefrontEraData(eraId).graffiti.state)
      expect(plan.stats.withinTextureBudget).toBe(true)
      expect(plan.stats.textureBytes).toBeLessThan(plan.stats.textureBudgetBytes)
      expect(plan.lighting.artificialLightColor).toBe(getEra(eraId).lighting.artificialLightColor)
      expect(plan.lighting.artificialLightIntensity).toBe(
        getEra(eraId).lighting.artificialLightIntensity,
      )
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Staged change
 * ------------------------------------------------------------------------- */

describe('staged era change', () => {
  it('resolves to the direct plan at the ends of the blend', () => {
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const from = ERA_IDS[index - 1] as EraId
      const to = ERA_IDS[index] as EraId
      const start = applyEraTransition({ from, to, t: 0 }, { layout })
      const end = applyEraTransition({ from, to, t: 1 }, { layout })
      expect(start.plan).toEqual(applyEra(from, { layout }))
      expect(end.plan).toEqual(applyEra(to, { layout }))
      expect(start.mix).toBe(0)
      expect(end.mix).toBe(1)
      expect(end.resolvedEra).toBe(to)
      expect(start.fromPlan).toEqual(applyEra(from, { layout }))
      expect(end.toPlan).toEqual(applyEra(to, { layout }))
    }
  })

  it('carries both eras while a blend is in flight', () => {
    const staged = applyEraTransition({ from: '1985', to: '2005', t: 0.35 }, { layout })
    expect(staged.mix).toBe(0.35)
    expect(staged.resolvedEra).toBe('1985')
    expect(staged.instant).toBe(false)
    expect(staged.plan).toEqual(staged.fromPlan)
    const halfway = applyEraTransition({ from: '1985', to: '2005', t: 0.5 }, { layout })
    expect(halfway.resolvedEra).toBe('2005')
    expect(halfway.plan).toEqual(halfway.toPlan)
    // Both periods are genuinely different blocks, so a blend has something to do.
    expect(staged.fromPlan.stats.shopTypeCounts).not.toEqual(staged.toPlan.stats.shopTypeCounts)
    expect(staged.fromPlan.stats.advertisingTotal).not.toBe(staged.toPlan.stats.advertisingTotal)
    expect(staged.fromPlan.stats.emissiveIntensity).not.toBe(staged.toPlan.stats.emissiveIntensity)
  })

  it('switches in one step under reduced motion', () => {
    const early = applyEraTransition(
      { from: '1985', to: '2005', t: 0.2 },
      { layout, reducedMotion: true },
    )
    expect(early.instant).toBe(true)
    expect(early.mix).toBe(0)
    expect(early.resolvedEra).toBe('1985')
    expect(early.plan).toEqual(applyEra('1985', { layout, reducedMotion: true }))

    const late = applyEraTransition(
      { from: '1985', to: '2005', t: 0.8 },
      { layout, reducedMotion: true },
    )
    expect(late.instant).toBe(true)
    expect(late.mix).toBe(1)
    expect(late.resolvedEra).toBe('2005')
    expect(late.plan).toEqual(applyEra('2005', { layout, reducedMotion: true }))
    expect(late.plan.reducedMotion).toBe(true)
  })

  it('settles when both ends of the blend are the same era', () => {
    const settled = applyEraTransition({ from: '1965', to: '1965', t: 0.4 }, { layout })
    expect(settled.mix).toBe(0)
    expect(settled.resolvedEra).toBe('1965')
    expect(settled.instant).toBe(false)
    expect(settled.plan).toEqual(applyEra('1965', { layout }))
    expect(storefrontPlanHash(settled.plan)).toBe(storefrontPlanHash(planFor('1965')))
  })
})

/* ------------------------------------------------------------------------- *
 * Mounted scene graph
 * ------------------------------------------------------------------------- */

describe('mounted layer', () => {
  it('builds one bay group per anchor with sign, awning and shutter objects', () => {
    const plan = planFor('1985')
    const { factory, count } = createStubFactory()
    const group = createStorefrontGroup(plan, { canvasFactory: factory })
    const summary = summariseStorefrontGroup(group)

    expect(group.name).toBe('storefronts:1985')
    expect(group.children).toHaveLength(
      plan.units.length + plan.advertising.length + plan.graffiti.length,
    )
    expect(summary.unitGroups).toBe(plan.units.length)
    expect(summary.signMeshes).toBe(plan.units.length)
    expect(summary.awningMeshes).toBeGreaterThanOrEqual(plan.units.length)
    expect(summary.advertisingMeshes).toBe(plan.advertising.length)
    expect(summary.graffitiMeshes).toBe(plan.graffiti.length)
    expect(summary.byKind['frame']).toBe(plan.units.length)
    expect(summary.byKind['glazing']).toBe(plan.units.length)
    expect(summary.byKind['door']).toBe(plan.units.length)
    expect(summary.textureCount).toBe(plan.surfaces.length)
    expect(count()).toBe(plan.surfaces.length)

    const named = group.children.map((child) => child.name)
    for (const unit of plan.units) {
      expect(named).toContain(`unit:${unit.anchor}`)
    }
    for (const placement of plan.advertising) {
      expect(named.some((name) => name.startsWith(`ad:${placement.kind}:${placement.anchor}`))).toBe(true)
    }
    disposeStorefrontGroup(group)
  })

  it('reads an era-correct emissive state off the sign materials', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      const era = getEra(eraId)
      const { factory } = createStubFactory()
      const group = createStorefrontGroup(plan, { canvasFactory: factory })
      const summary = summariseStorefrontGroup(group)
      expect(summary.eraId).toBe(eraId)
      expect(summary.year).toBe(era.year)
      expect(summary.night).toBe(plan.stats.night)

      if (eraId === '1945') {
        // A hand-painted block: no board emits light of its own in daylight.
        expect(summary.emissiveSigns, '1945 lit signs').toBe(0)
        expect(summary.litMeshes).toBe(0)
        expect(summary.maxEmissiveIntensity).toBe(0)
      } else {
        expect(summary.emissiveSigns).toBeGreaterThan(0)
        expect(summary.meanEmissiveIntensity).toBeGreaterThan(0)
        expect(summary.maxEmissiveIntensity).toBeGreaterThanOrEqual(plan.stats.emissiveIntensity)
      }
      if (eraId !== '1945') {
        expect(summary.emissiveSigns).toBe(plan.units.length)
        // Every lit board — fluorescent tube, neon, backlit vinyl or LED — glows
        // with the period's own artificial light colour, taken straight from the
        // era registry.
        expect(summary.emissiveSignColour.toLowerCase()).toBe(
          era.lighting.artificialLightColor.toLowerCase(),
        )
      }
      // At night the same block lights its shop interiors from the era's own
      // artificial light, painted era included.
      const nightGroup = createStorefrontGroup(planFor(eraId, { night: true }), {
        canvasFactory: factory,
      })
      const nightSummary = summariseStorefrontGroup(nightGroup)
      expect(nightSummary.night).toBe(true)
      expect(nightSummary.litMeshes, `${eraId} night lit meshes`).toBeGreaterThan(0)
      if (eraId === '1945') {
        // Even after dark a painted board stays painted: only the shop interiors
        // behind the glass glow.
        expect(nightSummary.emissiveSigns, '1945 night lit boards').toBe(0)
      } else {
        expect(nightSummary.emissiveSigns).toBe(plan.units.length)
        expect(nightSummary.emissiveSignColour.toLowerCase()).toBe(
          era.lighting.artificialLightColor.toLowerCase(),
        )
      }
      disposeStorefrontGroup(nightGroup)
      if (eraId === '1985') {
        expect(summary.maxEmissiveIntensity).toBeGreaterThan(1)
        expect(summary.night).toBe(true)
      }
      disposeStorefrontGroup(group)
    }
  })

  it('switches the block over progressively and disposes cleanly', () => {
    const from = createStorefrontGroup(planFor('1965'), { canvasFactory: createStubFactory().factory })
    const to = createStorefrontGroup(planFor('2025'), { canvasFactory: createStubFactory().factory })

    const switchedAtStart = applyProgressiveSwap(from, to, 0)
    expect(switchedAtStart).toBe(0)
    expect(to.children.every((child) => child.visible === false)).toBe(true)
    expect(from.children.every((child) => child.visible)).toBe(true)

    const half = Math.round(to.children.length / 2)
    expect(applyProgressiveSwap(from, to, 0.5)).toBe(half)
    expect(to.children.filter((child) => child.visible)).toHaveLength(half)
    expect(from.children.filter((child) => child.visible)).toHaveLength(
      from.children.length - Math.round(from.children.length / 2),
    )

    expect(applyProgressiveSwap(from, to, 1)).toBe(to.children.length)
    expect(to.children.every((child) => child.visible)).toBe(true)

    expect(() => {
      disposeStorefrontGroup(from)
      disposeStorefrontGroup(to)
    }).not.toThrow()
    expect(typeof StorefrontLayer).toBe('function')
  })
})
