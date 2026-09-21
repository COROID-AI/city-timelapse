/**
 * Catalogue, table, wear and placement-maths coverage for the props layer.
 *
 * The suite deliberately stays engine-free: it reads the recipe catalogue, the
 * five era tables and the pure placement maths, so a catalogue mistake (a prop
 * that cannot fit a sidewalk sub-band, a phone booth left in 2025, two eras that
 * list the same objects) fails here in milliseconds instead of surfacing as a
 * broken render. Integrated placement against the real block layout lives in
 * `tests/composition/props-eras.spec.ts`.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_ERA_ID, ERA_DEFINITIONS, ERA_IDS, getEra, type EraId } from '../../src/era'
import { DEFAULT_QUALITY_TIER, QUALITY_TIERS } from '../../src/lib/quality'
import { createRng } from '../../src/lib/rng'
import {
  PALETTE_MATERIAL_KEYS as MATERIAL_KEY_LIST,
  MATERIAL_SPECS,
  PARTS,
  PART_IDS,
  PROP_IDS,
  PROP_RECIPES,
  RECIPE_ISSUES,
  assertRecipesValid,
  getPropRecipe,
  mergeWear,
  parseHexColour,
  propsForCategory,
  propsForSlot,
  recipeDetail,
  resolveMaterial,
  resolveMaterialPalette,
  shapeExtent,
  shapeTriangles,
  toHexColour,
} from '../../src/city/props/recipes'
import {
  ERA_PROP_TABLES,
  PROP_LIFESPANS,
  PROP_TABLE_ERA_IDS,
  eraCatalogue,
  eraCategories,
  eraSignatureProps,
  isPropAvailableInEra,
  propsAvailableInEra,
  propsIntroducedInEra,
  propsRetiredByEra,
  validatePropTables,
} from '../../src/city/props/tables'
import {
  ALONG_JITTER,
  PLACEMENT_EPSILON,
  assignPool,
  contactExtents,
  cornerAlongLimit,
  isInWalkingBand,
  propYaw,
  resolveLamp,
  resolveNight,
} from '../../src/city/props/placement'
import {
  LAMP_TECHNOLOGIES,
  MAX_GROUND_PROP_DEPTH,
  MAX_GROUND_PROP_WIDTH,
  MAX_PROP_HEIGHT,
  PROP_CATEGORIES,
  PROP_SLOTS,
  SIDEWALK_SUB_BAND_DEPTH,
  SLOT_FILTERS,
  WALKING_BAND_HALF_WIDTH,
  WEAR_LEVELS,
  type PropSlot,
} from '../../src/city/props/types'
import { streetByName, type Anchor } from '../../src/city/layout'

const PALETTE_KEYS = [
  'buildingBase',
  'buildingAccent',
  'facadeTrim',
  'windowGlass',
  'roadSurface',
  'roadMarking',
  'sidewalk',
  'storefrontBody',
  'storefrontSign',
  'streetFurniture',
  'accent',
] as const

function paletteOf(eraId: EraId): Record<(typeof PALETTE_KEYS)[number], string> {
  const palette = getEra(eraId).palette
  return Object.fromEntries(PALETTE_KEYS.map((key) => [key, palette[key]])) as Record<
    (typeof PALETTE_KEYS)[number],
    string
  >
}

function luminance(hex: string): number {
  const { r, g, b } = parseHexColour(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Minimal anchor stub: the maths under test never reads the layout. */
function stubAnchor(overrides: Partial<Anchor> = {}): Anchor {
  return {
    name: 'street:north:light:1',
    kind: 'light-post',
    owner: { kind: 'street', id: 'north' },
    position: { x: 0, y: 0.15, z: -59.25 },
    normal: { x: 0, y: 1, z: 0 },
    size: { width: 0.4, height: 8.5 },
    facing: 'north',
    tags: ['street-light', 'base'],
    ...overrides,
  }
}

describe('prop recipe catalogue', () => {
  it('has no recipe that could not be placed legally', () => {
    expect(
      RECIPE_ISSUES.map((issue) => `${issue.recipeId} [${issue.code}] ${issue.message}`),
      'recipe data problems',
    ).toEqual([])
    expect(() => assertRecipesValid()).not.toThrow()
  })

  it('exposes a unique, sorted id per recipe', () => {
    expect(PROP_IDS.length).toBeGreaterThan(20)
    expect(new Set(PROP_IDS).size).toBe(PROP_IDS.length)
    expect([...PROP_IDS].sort()).toEqual(PROP_IDS)
    for (const id of PROP_IDS) {
      expect(PROP_RECIPES[id]?.id).toBe(id)
      expect(() => getPropRecipe(id)).not.toThrow()
    }
  })

  it('builds every recipe out of known parts with a material from the palette', () => {
    for (const id of PROP_IDS) {
      const recipe = getPropRecipe(id)
      expect(recipe.parts.length, `${id} parts`).toBeGreaterThan(0)
      expect(PART_IDS, `${id} part ids`).toEqual(expect.arrayContaining(recipe.parts.map((p) => p.part)))
      expect(recipe.triangles, `${id} triangles`).toBeGreaterThan(0)
      expect(recipe.height, `${id} height`).toBeLessThanOrEqual(MAX_PROP_HEIGHT)
      for (const material of recipe.materials) {
        expect(MATERIAL_KEY_LIST, `${id} material ${material}`).toContain(material)
      }
      expect(recipe.notes.length, `${id} notes`).toBeGreaterThan(20)
    }
  })

  it('keeps every ground prop inside one sidewalk sub-band', () => {
    for (const id of PROP_IDS) {
      const recipe = getPropRecipe(id)
      if (recipe.mount === 'roof' || recipe.mount === 'pole-top') {
        continue
      }
      expect(recipe.footprint.depth, `${id} depth`).toBeLessThanOrEqual(MAX_GROUND_PROP_DEPTH + 1e-6)
      expect(recipe.footprint.width, `${id} width`).toBeLessThanOrEqual(MAX_GROUND_PROP_WIDTH + 1e-6)
      expect(recipe.bounds.minY, `${id} contact plane`).toBeGreaterThanOrEqual(-0.02)
    }
  })

  it('declares a contact point inside the recipe bounds', () => {
    for (const id of PROP_IDS) {
      const recipe = getPropRecipe(id)
      const [x, y, z] = recipe.contact
      expect(x, `${id} contact x`).toBeGreaterThanOrEqual(recipe.bounds.minX - PLACEMENT_EPSILON)
      expect(x, `${id} contact x`).toBeLessThanOrEqual(recipe.bounds.maxX + PLACEMENT_EPSILON)
      expect(z, `${id} contact z`).toBeGreaterThanOrEqual(recipe.bounds.minZ - PLACEMENT_EPSILON)
      expect(z, `${id} contact z`).toBeLessThanOrEqual(recipe.bounds.maxZ + PLACEMENT_EPSILON)
      expect(y, `${id} contact y`).toBe(0)
      expect(recipe.scaleRange[0]).toBeLessThanOrEqual(recipe.scaleRange[1])
    }
  })

  it('counts triangles the way the shared part shapes are built', () => {
    expect(shapeTriangles({ kind: 'box', size: [1, 1, 1] })).toBe(12)
    expect(shapeTriangles({ kind: 'cylinder', radius: 0.1, height: 1, segments: 8 })).toBe(32)
    expect(shapeTriangles({ kind: 'cone', radius: 0.2, height: 1, segments: 8 })).toBe(24)
    const sphere = shapeTriangles({ kind: 'sphere', radius: 0.3, segments: 8 })
    const torus = shapeTriangles({ kind: 'torus', radius: 0.4, tube: 0.04, segments: 12 })
    expect(sphere).toBeGreaterThan(0)
    expect(torus).toBe(144)
    for (const id of PROP_IDS) {
      const recipe = getPropRecipe(id)
      const summed = recipe.parts.reduce((total, part) => {
        const definition = PARTS.find((candidate) => candidate.id === part.part)
        const scaled = part.scale ?? [1, 1, 1]
        const factor = Math.abs(scaled[0] ?? 1) * Math.abs(scaled[1] ?? 1) * Math.abs(scaled[2] ?? 1)
        return total + (definition === undefined ? 0 : Math.round(shapeTriangles(definition.shape) * factor))
      }, 0)
      expect(recipe.triangles, `${id} triangle sum`).toBe(summed)
    }
  })

  it('reports the detail census of a recipe from its own parts', () => {
    const cluster = getPropRecipe('facade-detail-cluster')
    const detail = recipeDetail(cluster)
    expect(detail['drainpipe']).toBeGreaterThan(0)
    expect(detail['vent']).toBeGreaterThan(0)
    expect(detail['signage-pole']).toBeGreaterThan(0)
    expect(detail['awning-frame']).toBeGreaterThan(0)
    expect(detail['patch']).toBeGreaterThan(0)
    const barrier = recipeDetail(getPropRecipe('construction-barrier'))
    expect(barrier['barrier']).toBeGreaterThan(0)
    expect(recipeDetail(getPropRecipe('corner-clutter-1985'))['pile']).toBeGreaterThan(0)
  })

  it('covers every category with recipes of the right slot', () => {
    for (const category of PROP_CATEGORIES) {
      expect(propsForCategory(category).length, `category ${category}`).toBeGreaterThan(0)
    }
    for (const slot of PROP_SLOTS) {
      const recipes = propsForSlot(slot)
      expect(recipes.length, `slot ${slot}`).toBeGreaterThan(0)
      for (const recipe of recipes) {
        expect(recipe.slot).toBe(slot)
      }
    }
  })

  it('fits every part shape into a finite, positive extent', () => {
    for (const definition of PARTS) {
      const extent = shapeExtent(definition.shape)
      expect(extent.max.x, `${definition.id} x`).toBeGreaterThan(extent.min.x)
      expect(extent.max.y, `${definition.id} y`).toBeGreaterThan(extent.min.y)
      expect(Number.isFinite(extent.min.z), `${definition.id} z`).toBe(true)
    }
  })

  it('keeps every recipe inside a sidewalk sub-band on every street orientation', () => {
    const anchor = stubAnchor()
    for (const id of PROP_IDS) {
      const recipe = getPropRecipe(id)
      if (recipe.mount === 'roof') {
        continue
      }
      for (const street of [streetByName('north'), streetByName('east')]) {
        const extents = contactExtents(recipe, propYaw(recipe, anchor, street))
        const across = street.acrossAxis === 'z' ? extents.depth : extents.width
        const along = street.acrossAxis === 'z' ? extents.width : extents.depth
        expect(across, `${id} across on ${street.name}`).toBeLessThanOrEqual(MAX_GROUND_PROP_DEPTH + 1e-6)
        if (recipe.mount !== 'pole-top') {
          expect(along, `${id} along on ${street.name}`).toBeLessThanOrEqual(MAX_GROUND_PROP_WIDTH + 1e-6)
        }
      }
    }
  })
})

describe('era prop tables', () => {
  it('validates every era against the lifespans and the era vocabulary', () => {
    expect(
      validatePropTables().map((issue) => `${issue.eraId ?? 'all'} [${issue.code}] ${issue.message}`),
      'table problems',
    ).toEqual([])
  })

  it('ships one catalogue per era, in registry order', () => {
    expect(PROP_TABLE_ERA_IDS).toEqual([...ERA_IDS])
    for (const eraId of ERA_IDS) {
      expect(ERA_PROP_TABLES[eraId]?.eraId, eraId).toBe(eraId)
    }
    expect(ERA_PROP_TABLES[DEFAULT_ERA_ID]).toBeDefined()
  })

  it('covers all five categories and all seven anchor slots in every era', () => {
    for (const eraId of ERA_IDS) {
      const categories = eraCategories(eraId)
      for (const category of PROP_CATEGORIES) {
        expect([...categories], `${eraId} ${category}`).toContain(category)
      }
      for (const slot of PROP_SLOTS) {
        expect(ERA_PROP_TABLES[eraId].pools[slot].length, `${eraId} ${slot} pool`).toBeGreaterThan(0)
      }
    }
  })

  it('gives every era props no other era lists', () => {
    for (const eraId of ERA_IDS) {
      expect(eraSignatureProps(eraId).length, `${eraId} signature props`).toBeGreaterThan(0)
    }
    const era1945 = eraCatalogue('1945')
    expect(era1945).toContain('cast-iron-lamp')
    expect(era1945).toContain('coal-chute')
    expect(era1945).not.toContain('smart-pole')
    const era2025 = eraCatalogue('2025')
    expect(era2025).toContain('smart-pole')
    expect(era2025).toContain('ev-charger')
    expect(era2025).not.toContain('coal-chute')
  })

  it('lists at least eight catalogued props per era, two or more unique to it', () => {
    for (const eraId of ERA_IDS) {
      const catalogue = eraCatalogue(eraId)
      expect(catalogue.length, `${eraId} catalogue size`).toBeGreaterThanOrEqual(8)
      expect(eraSignatureProps(eraId).length, `${eraId} props unique to it`).toBeGreaterThanOrEqual(2)
      for (const propId of catalogue) {
        const recipe = getPropRecipe(propId)
        expect(recipe.category, `${eraId} ${propId} anchor category`).toBeTruthy()
        expect(recipe.materials.length, `${eraId} ${propId} material palette`).toBeGreaterThan(0)
        expect(PROP_CATEGORIES, `${eraId} ${propId} category`).toContain(recipe.category)
      }
    }
  })

  it('carries the drainage, wall-mounted, signage and clutter detail families', () => {
    const details = new Set<string>()
    for (const id of PROP_IDS) {
      for (const kind of Object.keys(recipeDetail(getPropRecipe(id)))) {
        details.add(kind)
      }
    }
    for (const kind of [
      'drain',
      'grate',
      'vent',
      'drainpipe',
      'ac-unit',
      'signage-pole',
      'awning-frame',
      'barrier',
      'pile',
      'patch',
      'clutter',
      'bollard',
      'bin',
      'seating',
      'planter',
      'charger',
      'camera',
      'kiosk',
      'booth',
      'meter',
      'rack',
      'cabinet',
      'utility-fitting',
      'roof-detail',
      'lamp-post',
      'lamp-head',
      'lamp-glass',
      'signal-pole',
      'signal-head',
      'signal-lens',
      'signal-cabinet',
      'hydrant-body',
      'shelter',
      'screen',
      'crate',
      'cart',
      'stand',
      'platform',
    ]) {
      expect([...details], `detail family ${kind}`).toContain(kind)
    }
  })

  it('defines era wear parameters inside 0..1', () => {
    for (const eraId of ERA_IDS) {
      const wear = ERA_PROP_TABLES[eraId].wear
      expect([...WEAR_LEVELS], `${eraId} wear level`).toContain(wear.level)
      for (const value of [wear.grime, wear.chips, wear.rust, wear.fade, wear.graffiti]) {
        expect(value, `${eraId} wear value`).toBeGreaterThanOrEqual(0)
        expect(value, `${eraId} wear value`).toBeLessThanOrEqual(1)
      }
      for (const override of Object.values(ERA_PROP_TABLES[eraId].wearOverrides)) {
        for (const value of Object.values(override)) {
          if (value !== undefined && typeof value === 'number') {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('retires obsolete props strictly by lifespan', () => {
    expect(isPropAvailableInEra('telephone-booth', '1965')).toBe(true)
    expect(isPropAvailableInEra('telephone-booth', '1985')).toBe(true)
    expect(isPropAvailableInEra('telephone-booth', '2005')).toBe(true)
    expect(isPropAvailableInEra('telephone-booth', '2025')).toBe(false)
    expect(isPropAvailableInEra('payphone', '1985')).toBe(true)
    expect(isPropAvailableInEra('payphone', '2025')).toBe(false)
    expect(isPropAvailableInEra('cast-iron-lamp', '1945')).toBe(true)
    expect(isPropAvailableInEra('cast-iron-lamp', '1965')).toBe(false)
    expect(isPropAvailableInEra('ev-charger', '2025')).toBe(true)
    expect(isPropAvailableInEra('ev-charger', '2005')).toBe(false)
    expect(isPropAvailableInEra('litter-bin', '1945')).toBe(true)
    expect(isPropAvailableInEra('litter-bin', '2025')).toBe(true)
    for (const eraId of ERA_IDS) {
      for (const propId of eraCatalogue(eraId)) {
        expect(isPropAvailableInEra(propId, eraId), `${propId} in ${eraId}`).toBe(true)
        expect(PROP_LIFESPANS[propId], `${propId} lifespan`).toBeDefined()
      }
    }
  })

  it('reports retirements in the order the timeline retires them', () => {
    expect(propsRetiredByEra('1945')).toEqual([])
    expect(propsRetiredByEra('1965')).toContain('cast-iron-lamp')
    expect(propsRetiredByEra('1965')).toContain('coal-chute')
    expect(propsRetiredByEra('1985')).toContain('news-stand')
    expect(propsRetiredByEra('2025')).toContain('payphone')
    expect(propsRetiredByEra('2025')).not.toContain('litter-bin')
    expect(propsIntroducedInEra('2025')).toEqual(
      expect.arrayContaining(['smart-pole', 'ev-charger', 'e-scooter-rack']),
    )
    expect(propsAvailableInEra('1945').length).toBeLessThan(propsAvailableInEra('2025').length)
  })

  it('uses one lamp technology per era, in period order', () => {
    const technologies = ERA_IDS.map((eraId) => ERA_PROP_TABLES[eraId].lamp.technology)
    expect(technologies).toEqual([...LAMP_TECHNOLOGIES])
    for (const eraId of ERA_IDS) {
      for (const propId of ERA_PROP_TABLES[eraId].pools['light-post']) {
        const recipe = getPropRecipe(propId)
        expect(recipe.lamp, `${eraId} ${propId} lamp`).not.toBeNull()
        expect(recipe.category).toBe('lighting')
      }
    }
  })

  it('wears its street furniture by period', () => {
    const levels = ERA_IDS.map((eraId) => ERA_PROP_TABLES[eraId].wear.level)
    for (const level of levels) {
      expect([...WEAR_LEVELS]).toContain(level)
    }
    const grime = ERA_IDS.map((eraId) => ERA_PROP_TABLES[eraId].wear.grime)
    const worst = Math.max(...grime)
    expect(ERA_PROP_TABLES['1985'].wear.grime).toBe(worst)
    expect(ERA_PROP_TABLES['1985'].wear.graffiti).toBeGreaterThan(ERA_PROP_TABLES['1945'].wear.graffiti)
    expect(ERA_PROP_TABLES['2025'].wear.grime).toBeLessThan(ERA_PROP_TABLES['2005'].wear.grime)
    expect(ERA_PROP_TABLES['1985'].wearOverrides['graffiti-mailbox']?.graffiti).toBeGreaterThan(0.8)
  })

  it('keeps the era registry prop vocabulary inside the layer catalogue', () => {
    for (const era of ERA_DEFINITIONS) {
      const catalogue = new Set(eraCatalogue(era.id))
      for (const tag of era.contentTags.props) {
        expect(catalogue.has(tag), `${era.id} content tag ${tag}`).toBe(true)
        expect(PROP_RECIPES[tag], `${tag} recipe`).toBeDefined()
      }
    }
  })
})

describe('material palette and wear resolution', () => {
  it('darkens and roughens a surface as grime rises', () => {
    const clean = resolveMaterial(MATERIAL_SPECS['galvanised-steel'], paletteOf('2025'), {
      level: 'pristine',
      grime: 0,
      chips: 0,
      rust: 0,
      fade: 0,
      graffiti: 0,
    }, getEra('2025').lighting.artificialLightColor)
    const filthy = resolveMaterial(MATERIAL_SPECS['galvanised-steel'], paletteOf('1985'), {
      level: 'decrepit',
      grime: 1,
      chips: 1,
      rust: 0.6,
      fade: 0,
      graffiti: 1,
    }, getEra('1985').lighting.artificialLightColor)
    expect(luminance(filthy.colour)).toBeLessThan(luminance(clean.colour))
    expect(filthy.roughness).toBeGreaterThan(clean.roughness)
  })

  it('follows the era palette and the era artificial-light colour', () => {
    const palette1945 = resolveMaterialPalette(paletteOf('1945'), ERA_PROP_TABLES['1945'].wear, '#ffb469')
    const palette2025 = resolveMaterialPalette(paletteOf('2025'), ERA_PROP_TABLES['2025'].wear, '#d8f0ff')
    expect(palette1945['cast-iron'].colour).not.toBe(palette2025['cast-iron'].colour)
    expect(palette1945['lamp-glass'].emissiveColour).toBe('#ffb469')
    expect(palette2025['lamp-glass'].emissiveColour).toBe('#d8f0ff')
    expect(palette1945['signal-lens-red'].emissiveColour).toBe('#ff3b2f')
    expect(palette2025['glass'].opacity).toBeLessThan(1)
  })

  it('merges per-prop wear overrides over the era profile', () => {
    const base = ERA_PROP_TABLES['1985'].wear
    const merged = mergeWear(base, ERA_PROP_TABLES['1985'].wearOverrides['graffiti-mailbox'])
    expect(merged.graffiti).toBeGreaterThan(base.graffiti)
    expect(merged.grime).toBe(base.grime)
    expect(mergeWear(base, undefined)).toBe(base)
  })

  it('resolves every material key for every era', () => {
    for (const eraId of ERA_IDS) {
      const palette = resolveMaterialPalette(paletteOf(eraId), ERA_PROP_TABLES[eraId].wear, '#ffffff')
      for (const key of MATERIAL_KEY_LIST) {
        expect(palette[key]?.key, `${eraId} ${key}`).toBe(key)
        expect(palette[key]?.colour).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette[key]?.opacity).toBeGreaterThan(0)
      }
    }
  })
})

describe('placement maths', () => {
  it('knows where the sidewalk walking band is', () => {
    expect(isInWalkingBand(0, 58)).toBe(true)
    expect(isInWalkingBand(0, 58 + WALKING_BAND_HALF_WIDTH - 0.01)).toBe(true)
    expect(isInWalkingBand(0, 58 + WALKING_BAND_HALF_WIDTH + 0.05)).toBe(false)
    expect(isInWalkingBand(0, 56.5)).toBe(false)
    expect(isInWalkingBand(0, 59.5)).toBe(false)
    // Corner fillet: the walking band is the annulus two metres off the build line.
    expect(isInWalkingBand(56 + Math.SQRT2, 56 + Math.SQRT2)).toBe(true)
    expect(isInWalkingBand(56 + 3.5, 56 + 3.5)).toBe(false)
  })

  it('bounds the along coordinate by the corner fillet', () => {
    expect(cornerAlongLimit(60)).toBeCloseTo(56, 3)
    expect(cornerAlongLimit(58)).toBeCloseTo(56 + Math.sqrt(12), 3)
    expect(cornerAlongLimit(56)).toBeCloseTo(60, 3)
    expect(cornerAlongLimit(59.5)).toBeLessThan(59)
  })

  it('measures a rotated footprint about its contact point', () => {
    const rack = getPropRecipe('bike-rack')
    const facingOut = contactExtents(rack, 0)
    expect(facingOut.depth).toBeLessThanOrEqual(MAX_GROUND_PROP_DEPTH + 1e-6)
    // Crossing a quarter turn swaps which world axis carries the long side.
    const facingQuarter = contactExtents(rack, Math.PI / 2)
    expect(facingQuarter.width).toBeCloseTo(facingOut.depth, 3)
    expect(facingQuarter.depth).toBeCloseTo(facingOut.width, 3)
    const lamp = contactExtents(getPropRecipe('cast-iron-lamp'), 0)
    expect(lamp.height).toBeCloseTo(getPropRecipe('cast-iron-lamp').height, 3)
    // The gutter grate sits a couple of centimetres above the deck.
    expect(lamp.minY).toBeGreaterThanOrEqual(0)
    expect(lamp.minY).toBeLessThan(0.05)
    expect(lamp.maxY).toBeCloseTo(lamp.height, 3)
  })

  it('orients a prop to the street grid', () => {
    const anchor = stubAnchor()
    const north = streetByName('north')
    // An outward-facing prop turns its local +z to the kerb (world -z here).
    const lampYaw = propYaw(getPropRecipe('cast-iron-lamp'), anchor, north)
    expect(Math.abs(Math.sin(lampYaw))).toBeCloseTo(0, 6)
    expect(Math.abs(Math.cos(lampYaw))).toBeCloseTo(1, 6)
    // An along-street prop runs its local +x down the street.
    const signalYaw = propYaw(getPropRecipe('smart-signal'), anchor, north)
    expect(Math.abs(Math.sin(signalYaw))).toBeCloseTo(0, 6)
    expect(Math.abs(Math.cos(signalYaw))).toBeCloseTo(1, 6)
    const gasYaw = propYaw(getPropRecipe('cast-iron-lamp'), anchor, streetByName('east'))
    expect(Math.abs(Math.cos(gasYaw))).toBeCloseTo(0, 6)
  })

  it('assigns a pool round-robin so every catalogued prop appears', () => {
    const pool = ['a', 'b', 'c', 'd']
    const assignment = assignPool(pool, 11, createRng('pool-test', 'pool'))
    expect(assignment).toHaveLength(11)
    for (const propId of pool) {
      expect(assignment.filter((entry) => entry === propId).length, propId).toBeGreaterThanOrEqual(2)
    }
    const repeat = assignPool(pool, 11, createRng('pool-test', 'pool'))
    expect(repeat).toEqual(assignment)
    expect(assignPool([], 3, createRng('pool-test', 'pool'))).toEqual([])
    expect(assignPool(['only'], 2, createRng('pool-test', 'pool'))).toEqual(['only', 'only'])
  })

  it('resolves lamp emission from the era lighting data and the night flag', () => {
    const lamp = getPropRecipe('sodium-lamp')
    const era1985 = getEra('1985')
    const night = resolveLamp(lamp, era1985, true, true, { x: 0, y: 0.15, z: -59.4 })
    const day = resolveLamp(lamp, era1985, false, true, { x: 0, y: 0.15, z: -59.4 })
    expect(night).not.toBeNull()
    expect(day).not.toBeNull()
    expect(night?.emissiveIntensity ?? 0).toBeGreaterThan(day?.emissiveIntensity ?? 0)
    expect(night?.lightIntensity ?? 0).toBeGreaterThan(day?.lightIntensity ?? 0)
    expect(night?.technology).toBe('mercury-sodium')
    expect(night?.colour).toBe(era1985.lighting.artificialLightColor)
    const unlit = resolveLamp(lamp, era1985, true, false, { x: 0, y: 0.15, z: -59.4 })
    expect(unlit?.light).toBe(false)
    expect(unlit?.lightIntensity).toBe(0)

    const gas = resolveLamp(getPropRecipe('cast-iron-lamp'), getEra('1945'), false, false, {
      x: 0,
      y: 0.15,
      z: -59.4,
    })
    expect(gas?.technology).toBe('gas')
    expect(gas?.emissiveIntensity ?? 0).toBeGreaterThan(0)
    expect(resolveLamp(getPropRecipe('news-stand'), era1985, true, false, { x: 0, y: 0, z: 0 })).toBeNull()
  })

  it('derives the night flag from the era sun elevation unless overridden', () => {
    expect(resolveNight(getEra('1985'))).toBe(true)
    expect(resolveNight(getEra('1965'))).toBe(false)
    expect(resolveNight(getEra('1965'), true)).toBe(true)
    expect(resolveNight(getEra('1985'), false)).toBe(false)
  })

  it('keeps its tuning constants inside the layout geometry', () => {
    expect(SIDEWALK_SUB_BAND_DEPTH).toBeGreaterThan(MAX_GROUND_PROP_DEPTH)
    expect(WALKING_BAND_HALF_WIDTH).toBeGreaterThan(0)
    expect(ALONG_JITTER).toBeLessThan(SIDEWALK_SUB_BAND_DEPTH)
    expect(SLOT_FILTERS['corner-clutter'].ownerKind).toBe('corner')
    expect(SLOT_FILTERS['rooftop-detail'].tag).toBe('rooftop')
    expect(SLOT_FILTERS['street-furniture'].tag).toBe('street-level')
    expect(QUALITY_TIERS[DEFAULT_QUALITY_TIER].density.props).toBe(1)
  })

  it('normalises colours round-trip through hex', () => {
    expect(toHexColour(parseHexColour('#3b8c2a'))).toBe('#3b8c2a')
    expect(toHexColour(parseHexColour('#fff'))).toBe('#ffffff')
    expect(toHexColour(parseHexColour('nonsense'))).toBe('#808080')
  })

  it('exposes a slot type for every anchor category it claims', () => {
    const slots = PROP_SLOTS.map((slot: PropSlot) => slot)
    expect(slots).toHaveLength(7)
    expect(new Set(slots).size).toBe(7)
  })
})
