/**
 * Era registry contract tests.
 *
 * These lock down the shared contract every content layer, the timeline UI and
 * the transition director read: exactly five ordered eras, stable ids and
 * years, complete and pairwise distinct detail data, strict lookup, neighbour
 * helpers, plain serialisability and a digest that pins the shipped table.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ERA_ID,
  ERA_COUNT,
  ERA_DEFINITIONS,
  ERA_IDS,
  ERA_ID_ORDER,
  ERA_RECORDS,
  ERA_REGISTRY,
  ERA_SOUNDSCAPES,
  ERA_YEARS,
  ERA_YEAR_BY_ID,
  ERA_YEAR_ORDER,
  LATEST_ERA_ID,
  UnknownEraIdError,
  createEraRegistry,
  eraIdAt,
  eraIdIndex,
  findEra,
  findEraByYear,
  getEra,
  getEraAtOffset,
  getEraIndex,
  getNeighbouringEras,
  getNextEra,
  getPreviousEra,
  getSoundscape,
  isEraId,
  isFirstEra,
  isKnownEraId,
  isLastEra,
  offsetEraId,
  requireEraId,
  resolveEraId,
  type EraDefinition,
  type EraId,
  type EraPalette,
} from '../../src/era'
import { hashValue, stableStringify } from '../support/hash'

const EXPECTED_ID_ORDER: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025']
const EXPECTED_YEAR_ORDER: readonly number[] = [1945, 1965, 1985, 2005, 2025]

const DETAIL_GROUPS = [
  'palette',
  'lighting',
  'atmosphere',
  'soundscape',
  'traffic',
  'population',
  'contentTags',
] as const satisfies readonly (keyof EraDefinition)[]

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
] as const satisfies readonly (keyof EraPalette)[]

/** Fields the acceptance criteria require to be distinct between the eras. */
const BRANCH_FIELDS: ReadonlyArray<readonly [string, (definition: EraDefinition) => unknown]> = [
  ['palette', (definition) => definition.palette],
  ['lighting', (definition) => definition.lighting],
  ['sky gradient', (definition) => [definition.lighting.skyTopColor, definition.lighting.skyHorizonColor]],
  ['haze', (definition) => [definition.atmosphere.hazeColor, definition.atmosphere.hazeDensity]],
  ['colour grade', (definition) => definition.atmosphere.colourGrade],
  ['soundscape descriptor', (definition) => definition.soundscape.descriptor],
  ['soundscape cue set', (definition) => definition.soundscape.cues],
  ['traffic density', (definition) => definition.traffic.trafficDensity],
  ['pedestrian density', (definition) => definition.population.pedestrianDensity],
  ['vehicle era tag', (definition) => definition.traffic.vehicleEraTag],
  ['outfit era tag', (definition) => definition.population.outfitEraTag],
  ['signage vocabulary', (definition) => definition.contentTags.signage],
  ['advertisement vocabulary', (definition) => definition.contentTags.advertisements],
  ['storefront vocabulary', (definition) => definition.contentTags.storefronts],
  ['building vocabulary', (definition) => definition.contentTags.buildings],
  ['prop vocabulary', (definition) => definition.contentTags.props],
  ['vehicle models', (definition) => definition.traffic.modelKeys],
  ['pedestrian models', (definition) => definition.population.modelKeys],
  ['outfit palette', (definition) => definition.population.outfitPalette],
]

/** Digest per shipped era; pins the whole table against accidental edits. */
const ERA_DIGESTS: Readonly<Record<EraId, string>> = {
  '1945': '23608ff66e688b2b',
  '1965': 'b975ea936dc1c9b9',
  '1985': '17da222a6be395ee',
  '2005': '4b88ca4f939fdab5',
  '2025': '27a9fba6a8ac4c30',
}

/** Digest over every shipped era, in timeline order. */
const REGISTRY_DIGEST = 'd56a37be58abd1a3'

const HEX_COLOUR = /^#[0-9a-f]{6}$/

/** Number of distinct canonical forms in a list of values. */
function distinctCount(values: readonly unknown[]): number {
  return new Set(values.map((value) => stableStringify(value))).size
}

/** Visits every nested value of a plain structure, with a dotted path for messages. */
function walk(value: unknown, visit: (value: unknown, path: string) => void, path = 'root'): void {
  visit(value, path)
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      walk(item, visit, `${path}.${key}`)
    }
  }
}

describe('era registry contract', () => {
  it('exposes exactly the five planned eras in ascending order', () => {
    expect(ERA_COUNT).toBe(5)
    expect(ERA_IDS).toEqual(EXPECTED_ID_ORDER)
    expect(ERA_YEARS).toEqual(EXPECTED_YEAR_ORDER)
    expect(ERA_ID_ORDER).toEqual(EXPECTED_ID_ORDER)
    expect(ERA_YEAR_ORDER).toEqual(EXPECTED_YEAR_ORDER)
    expect(ERA_REGISTRY.count).toBe(5)
    expect(ERA_DEFINITIONS).toHaveLength(5)
    expect(ERA_DEFINITIONS.map((definition) => definition.id)).toEqual(EXPECTED_ID_ORDER)
    expect(ERA_DEFINITIONS.map((definition) => definition.year)).toEqual(EXPECTED_YEAR_ORDER)
    expect(ERA_DEFINITIONS.map((definition) => definition.shortLabel)).toEqual(
      EXPECTED_ID_ORDER.map((id) => String(id)),
    )

    const years = ERA_DEFINITIONS.map((definition) => definition.year)
    expect([...years].sort((left, right) => left - right)).toEqual(years)
    expect(DEFAULT_ERA_ID).toBe('1945')
    expect(LATEST_ERA_ID).toBe('2025')
    expect(ERA_REGISTRY.first.id).toBe(DEFAULT_ERA_ID)
    expect(ERA_REGISTRY.last.id).toBe(LATEST_ERA_ID)
  })

  it('keeps ids stable, unique and keyed to their year', () => {
    for (const id of ERA_IDS) {
      const definition = getEra(id)
      expect(definition.id).toBe(id)
      expect(ERA_RECORDS[id]).toBe(definition)
      expect(ERA_YEAR_BY_ID[id]).toBe(Number(id))
      expect(definition.year).toBe(ERA_YEAR_BY_ID[id])
      expect(findEraByYear(definition.year)).toBe(definition)
      expect(definition.seed).toContain(id)
    }
    expect(new Set(ERA_IDS).size).toBe(ERA_IDS.length)
    expect(new Set(ERA_DEFINITIONS.map((definition) => definition.seed)).size).toBe(5)
    expect(findEraByYear(1900)).toBeUndefined()
  })

  it('gives every era a display label, a summary and a reproducible seed', () => {
    for (const definition of ERA_DEFINITIONS) {
      expect(definition.label.length).toBeGreaterThan(3)
      expect(definition.summary.length).toBeGreaterThan(30)
      expect(definition.seed.length).toBeGreaterThan(3)
      expect(new Set(ERA_DEFINITIONS.map((entry) => entry.label)).size).toBe(5)
      expect(new Set(ERA_DEFINITIONS.map((entry) => entry.summary)).size).toBe(5)
    }
  })

  it('defines every required detail group for every era', () => {
    for (const definition of ERA_DEFINITIONS) {
      for (const group of DETAIL_GROUPS) {
        expect(definition[group], `${definition.id} is missing ${group}`).toBeDefined()
        expect(Object.keys(definition[group]).length, `${definition.id}.${group} is empty`).toBeGreaterThan(0)
      }

      for (const key of PALETTE_KEYS) {
        expect(definition.palette[key], `${definition.id}.palette.${key}`).toMatch(HEX_COLOUR)
      }

      const { lighting, atmosphere, traffic, population, soundscape, contentTags } = definition
      expect(lighting.sunElevationDeg).toBeGreaterThanOrEqual(-90)
      expect(lighting.sunElevationDeg).toBeLessThanOrEqual(90)
      expect(lighting.sunAzimuthDeg).toBeGreaterThanOrEqual(0)
      expect(lighting.sunAzimuthDeg).toBeLessThan(360)
      expect(lighting.timeOfDayHours).toBeGreaterThanOrEqual(0)
      expect(lighting.timeOfDayHours).toBeLessThan(24)
      expect(lighting.sunIntensity).toBeGreaterThan(0)
      expect(lighting.exposure).toBeGreaterThan(0)
      expect(atmosphere.hazeDensity).toBeGreaterThan(0)
      expect(atmosphere.cloudCover).toBeGreaterThanOrEqual(0)
      expect(atmosphere.cloudCover).toBeLessThanOrEqual(1)
      expect(atmosphere.precipitationIntensity).toBeGreaterThanOrEqual(0)
      expect(atmosphere.precipitationIntensity).toBeLessThanOrEqual(1)
      expect(Object.values(atmosphere.colourGrade).length).toBeGreaterThanOrEqual(11)
      expect(traffic.trafficDensity).toBeGreaterThan(0)
      expect(traffic.trafficDensity).toBeLessThanOrEqual(1)
      expect(traffic.averageSpeedMps).toBeGreaterThan(0)
      expect(traffic.laneCount).toBeGreaterThanOrEqual(2)
      expect(traffic.modelKeys.length).toBeGreaterThanOrEqual(4)
      expect(traffic.vehicleEraTag).toContain(definition.id)
      expect(population.pedestrianDensity).toBeGreaterThan(0)
      expect(population.pedestrianDensity).toBeLessThanOrEqual(1)
      expect(population.outfitEraTag).toContain(definition.id)
      expect(population.modelKeys.length).toBeGreaterThanOrEqual(4)
      expect(population.outfitPalette.length).toBeGreaterThanOrEqual(4)
      expect(population.groupSizeRange[0]).toBeLessThanOrEqual(population.groupSizeRange[1])
      expect(soundscape.cues.length).toBeGreaterThanOrEqual(4)
      expect(soundscape.descriptor).toContain(definition.id)
      for (const cue of soundscape.cues) {
        expect(cue.id.length).toBeGreaterThan(2)
        expect(cue.label.length).toBeGreaterThan(2)
        expect(cue.gain).toBeGreaterThan(0)
        expect(cue.gain).toBeLessThanOrEqual(1)
        expect(cue.minIntervalSec).toBeLessThanOrEqual(cue.maxIntervalSec)
      }
      for (const group of ['signage', 'advertisements', 'storefronts', 'buildings', 'props'] as const) {
        expect(contentTags[group].length, `${definition.id}.contentTags.${group}`).toBeGreaterThanOrEqual(3)
      }
      expect(new Set(contentTags.signage).size).toBe(contentTags.signage.length)
    }
  })

  it('uses distinct values for every detail group across the five eras', () => {
    for (const group of DETAIL_GROUPS) {
      const values = ERA_DEFINITIONS.map((definition) => definition[group])
      expect(
        distinctCount(values),
        `${group} is shared between eras: ${stableStringify(values)}`,
      ).toBe(ERA_COUNT)
    }
  })

  it('gives every era its own entry for each palette slot', () => {
    for (const key of PALETTE_KEYS) {
      const values = ERA_DEFINITIONS.map((definition) => definition.palette[key])
      expect(distinctCount(values), `palette.${key} repeats: ${values.join(', ')}`).toBe(ERA_COUNT)
      for (const value of values) {
        expect(value).toMatch(HEX_COLOUR)
      }
    }
  })

  for (const [label, extract] of BRANCH_FIELDS) {
    it(`differs on ${label} between all five eras`, () => {
      expect(distinctCount(ERA_DEFINITIONS.map(extract))).toBe(ERA_COUNT)
    })
  }

  it('keeps every era record plain, finite and JSON-serialisable', () => {
    const problems: string[] = []
    for (const definition of ERA_DEFINITIONS) {
      walk(definition, (value, path) => {
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
          problems.push(`${definition.id}.${path} is a ${typeof value}`)
        }
        if (typeof value === 'number' && !Number.isFinite(value)) {
          problems.push(`${definition.id}.${path} is ${String(value)}`)
        }
        if (value === undefined) {
          problems.push(`${definition.id}.${path} is undefined`)
        }
        if (typeof value === 'string' && value.startsWith('#') && !HEX_COLOUR.test(value)) {
          problems.push(`${definition.id}.${path} is not a #rrggbb colour: ${value}`)
        }
      })
    }
    expect(problems).toEqual([])

    const serialised = JSON.stringify(ERA_DEFINITIONS)
    expect(JSON.parse(serialised)).toEqual(ERA_DEFINITIONS)
    expect(stableStringify(JSON.parse(serialised))).toBe(stableStringify(ERA_DEFINITIONS))
  })

  it('pins every era, and the registry as a whole, with a stable digest', () => {
    for (const definition of ERA_DEFINITIONS) {
      expect(hashValue(definition), `digest of era ${definition.id}`).toBe(ERA_DIGESTS[definition.id])
    }
    expect(hashValue(ERA_DEFINITIONS)).toBe(REGISTRY_DIGEST)
  })

  it('looks eras up by id and rejects unknown ids', () => {
    expect(getEra('1985')).toBe(ERA_RECORDS['1985'])
    expect(findEra('1985')).toBe(ERA_RECORDS['1985'])
    expect(findEra('1995')).toBeUndefined()
    expect(ERA_REGISTRY.find('1995')).toBeUndefined()
    expect(ERA_REGISTRY.isKnown('2025')).toBe(true)
    expect(ERA_REGISTRY.isKnown(2025)).toBe(false)
    expect(isKnownEraId('1965')).toBe(true)
    expect(isKnownEraId('2055')).toBe(false)
    expect(getEraIndex('1945')).toBe(0)
    expect(getEraIndex('2025')).toBe(4)
    expect(getEraIndex('1995')).toBe(-1)

    for (const unknown of ['1995', '', '1945s', 1945, null, undefined, {}]) {
      expect(() => getEra(unknown)).toThrow(UnknownEraIdError)
      expect(() => ERA_REGISTRY.get(unknown)).toThrow(UnknownEraIdError)
    }
    expect(() => getEra('1995')).toThrow(/Known era ids: 1945, 1965, 1985, 2005, 2025/)
  })

  it('walks the timeline with the neighbour helpers', () => {
    expect(getPreviousEra('1945')).toBeUndefined()
    expect(getPreviousEra('1965')).toBe(ERA_RECORDS['1945'])
    expect(getNextEra('2025')).toBeUndefined()
    expect(getNextEra('2005')).toBe(ERA_RECORDS['2025'])
    expect(getNeighbouringEras('1945').map((definition) => definition.id)).toEqual(['1965'])
    expect(getNeighbouringEras('1985').map((definition) => definition.id)).toEqual(['1965', '2005'])
    expect(getNeighbouringEras('2025').map((definition) => definition.id)).toEqual(['2005'])

    expect(getEraAtOffset('1945', 2).id).toBe('1985')
    expect(getEraAtOffset('1985', -1).id).toBe('1965')
    expect(getEraAtOffset('2025', 10).id).toBe('2025')
    expect(getEraAtOffset('1945', -10).id).toBe('1945')

    expect(isFirstEra('1945')).toBe(true)
    expect(isFirstEra('1965')).toBe(false)
    expect(isLastEra('2025')).toBe(true)
    expect(isLastEra('2005')).toBe(false)
    expect(() => getNeighbouringEras('2055')).toThrow(UnknownEraIdError)
    expect(() => getNextEra('2055')).toThrow(UnknownEraIdError)
  })

  it('guards untrusted id input', () => {
    expect(isEraId('1985')).toBe(true)
    expect(isEraId(' 1985')).toBe(false)
    expect(isEraId(1985)).toBe(false)
    expect(requireEraId('2005')).toBe('2005')
    expect(() => requireEraId('1899')).toThrow(UnknownEraIdError)
    expect(resolveEraId('2025')).toBe('2025')
    expect(resolveEraId('1899')).toBe(DEFAULT_ERA_ID)
    expect(resolveEraId(null, '1985')).toBe('1985')

    expect(eraIdIndex('1965')).toBe(1)
    expect(eraIdIndex('nope')).toBe(-1)
    expect(eraIdAt(0)).toBe('1945')
    expect(eraIdAt(4)).toBe('2025')
    expect(eraIdAt(9)).toBe('2025')
    expect(eraIdAt(-3)).toBe('1945')
    expect(eraIdAt(Number.NaN)).toBe('1945')
    expect(offsetEraId('1985', 1)).toBe('2005')
    expect(offsetEraId('1985', -1)).toBe('1965')
    expect(offsetEraId('2025', 4)).toBe('2025')
    expect(() => offsetEraId('nope', 1)).toThrow(UnknownEraIdError)
  })

  it('exposes the soundscape of every era by id', () => {
    for (const definition of ERA_DEFINITIONS) {
      expect(getSoundscape(definition.id)).toBe(definition.soundscape)
      expect(ERA_SOUNDSCAPES[definition.id]).toBe(definition.soundscape)
    }
    expect(() => getSoundscape('2055')).toThrow(UnknownEraIdError)
  })

  it('builds registries from a data table so a future era needs no code change', () => {
    const futureEra: EraDefinition = {
      ...ERA_RECORDS['2025'],
      id: '2055' as EraId,
      year: 2055,
      shortLabel: '2055',
      label: 'Speculative Future',
      summary: 'A hypothetical sixth period used to prove the registry is data-driven.',
      seed: 'city-era-2055',
    }
    const extended = createEraRegistry([...ERA_DEFINITIONS, futureEra])

    expect(extended.count).toBe(6)
    expect(extended.ids).toEqual(['1945', '1965', '1985', '2005', '2025', '2055'])
    expect(extended.last.id).toBe('2055')
    expect(extended.next('2025')?.id).toBe('2055')
    expect(extended.previous('2055')?.id).toBe('2025')
    expect(extended.findByYear(2055)?.label).toBe('Speculative Future')

    // The shipped registry is untouched by the extension.
    expect(ERA_REGISTRY.count).toBe(5)
    expect(ERA_IDS).toHaveLength(5)
  })

  it('rejects incomplete, duplicate or contradictory era records', () => {
    expect(() => createEraRegistry([])).toThrow(/at least one era/)
    expect(() => createEraRegistry([ERA_RECORDS['1985'], ERA_RECORDS['1985']])).toThrow(
      /Duplicate era id/,
    )
    expect(() =>
      createEraRegistry([ERA_RECORDS['1985'], { ...ERA_RECORDS['2005'], year: 1985 }]),
    ).toThrow(/Duplicate era year/)
    expect(() => createEraRegistry([{ ...ERA_RECORDS['1985'], year: 1986 }])).toThrow(
      /id maps to 1985/,
    )
  })
})
