/**
 * The five per-era prop catalogues.
 *
 * This is where the period lives. Each {@link EraPropTable} names the lamp
 * technology of the era, the condition its street furniture is in, and the
 * *prop pool* of every anchor category the layer populates. `placement.ts`
 * assigns a pool round-robin over the era's anchors, so a pool is both the
 * catalogue and the guarantee: every catalogued prop of a period appears on the
 * block at least once, and no prop appears that the period should not have.
 *
 * ## Retirement rules
 *
 * {@link PROP_LIFESPANS} is the single source of truth for "when does this
 * object exist": the first era it appears in and the last era it survives
 * (`retiredAfter`), or `null` while it is still current. The pools are checked
 * against it, so a phone booth dropped into the 2025 pool is a validation error
 * rather than a silent anachronism.
 *
 * ## Cross-layer vocabulary
 *
 * The era registry publishes a `contentTags.props` vocabulary per period
 * ("boom box", "ev charger", "honey wagon"). Every one of those ids is a recipe
 * id in this layer's catalogue, and {@link validatePropTables} proves it, so the
 * era model and the props layer cannot drift apart.
 */

import { ERA_DEFINITIONS, ERA_IDS, eraIdIndex, type EraId } from '../../era'
import { PROP_RECIPES, getPropRecipe } from './recipes'
import {
  PROP_SLOTS,
  type EraPropTable,
  type PropLifespan,
  type PropSlot,
  type WearProfile,
} from './types'

/* ------------------------------------------------------------------------- *
 * Lifespans: the explicit retirement rules
 * ------------------------------------------------------------------------- */

/**
 * First and last era of every recipe.
 *
 * Read as: *introduced in `introducedIn`, gone from `retiredAfter`'s successor
 * onwards*. `retiredAfter: null` means the object is still current.
 */
export const PROP_LIFESPANS: Readonly<Record<string, PropLifespan>> = {
  /* Lighting --------------------------------------------------------------- */
  'cast-iron-lamp': { introducedIn: '1945', retiredAfter: '1945' },
  'early-electric-lamp': { introducedIn: '1945', retiredAfter: '1945' },
  'incandescent-lamp': { introducedIn: '1965', retiredAfter: '1965' },
  'sodium-lamp': { introducedIn: '1985', retiredAfter: '1985' },
  'led-lamp': { introducedIn: '2005', retiredAfter: null },
  'smart-pole': { introducedIn: '2025', retiredAfter: null },

  /* Signals ---------------------------------------------------------------- */
  'manual-signal-box': { introducedIn: '1945', retiredAfter: '1945' },
  'traffic-light-1960s': { introducedIn: '1965', retiredAfter: '1965' },
  'black-box-signal': { introducedIn: '1985', retiredAfter: '1985' },
  'led-signal': { introducedIn: '2005', retiredAfter: null },
  'smart-signal': { introducedIn: '2025', retiredAfter: null },

  /* Hydrants --------------------------------------------------------------- */
  'fire-hydrant': { introducedIn: '1945', retiredAfter: '1945' },
  'dry-barrel-hydrant': { introducedIn: '1965', retiredAfter: '1965' },
  'painted-hydrant': { introducedIn: '1985', retiredAfter: '1985' },
  'modern-hydrant': { introducedIn: '2005', retiredAfter: null },
  'smart-hydrant': { introducedIn: '2025', retiredAfter: null },

  /* Pole-top utility fittings --------------------------------------------- */
  'utility-transformer': { introducedIn: '1945', retiredAfter: '1965' },
  'utility-cable-arm': { introducedIn: '1945', retiredAfter: '1985' },
  'utility-fuse-panel': { introducedIn: '1985', retiredAfter: '2005' },
  'utility-fibre-box': { introducedIn: '2005', retiredAfter: null },
  'air-quality-sensor': { introducedIn: '2025', retiredAfter: null },

  /* Rooftop detail --------------------------------------------------------- */
  'roof-chimney-stack': { introducedIn: '1945', retiredAfter: '1965' },
  'roof-water-tank': { introducedIn: '1945', retiredAfter: '1985' },
  'roof-ac-bank': { introducedIn: '1985', retiredAfter: '2005' },
  'roof-mech-cluster': { introducedIn: '2005', retiredAfter: null },
  'roof-solar-array': { introducedIn: '2025', retiredAfter: null },

  /* Street furniture: the period vocabulary of the block ------------------- */
  'news-stand': { introducedIn: '1945', retiredAfter: '1965' },
  'milk-crate': { introducedIn: '1945', retiredAfter: '1965' },
  'coal-chute': { introducedIn: '1945', retiredAfter: '1945' },
  pushcart: { introducedIn: '1945', retiredAfter: '1965' },
  'hitching-post': { introducedIn: '1945', retiredAfter: '1945' },
  'mailbox-cast-iron': { introducedIn: '1945', retiredAfter: '1965' },
  'telephone-booth': { introducedIn: '1965', retiredAfter: '2005' },
  'bus-shelter': { introducedIn: '1965', retiredAfter: '2005' },
  'parking-meter': { introducedIn: '1965', retiredAfter: '1985' },
  'neon-arrow-sign': { introducedIn: '1965', retiredAfter: '1985' },
  payphone: { introducedIn: '1985', retiredAfter: '2005' },
  'graffiti-mailbox': { introducedIn: '1985', retiredAfter: '2005' },
  dumpster: { introducedIn: '1985', retiredAfter: '2005' },
  'boom-box': { introducedIn: '1985', retiredAfter: '2005' },
  'bmx-rack': { introducedIn: '1985', retiredAfter: '1985' },
  'neon-palm-sign': { introducedIn: '1985', retiredAfter: '1985' },
  'bus-shelter-ad': { introducedIn: '2005', retiredAfter: null },
  'parking-kiosk': { introducedIn: '2005', retiredAfter: '2005' },
  'security-camera': { introducedIn: '2005', retiredAfter: null },
  'bike-rack': { introducedIn: '2005', retiredAfter: null },
  atm: { introducedIn: '2005', retiredAfter: null },
  'street-bench': { introducedIn: '2005', retiredAfter: null },
  bollard: { introducedIn: '1985', retiredAfter: null },
  'construction-barrier': { introducedIn: '1985', retiredAfter: null },
  'ev-charger': { introducedIn: '2025', retiredAfter: null },
  'e-scooter-rack': { introducedIn: '2025', retiredAfter: null },
  'parklet-bench': { introducedIn: '2025', retiredAfter: null },
  'smart-bus-shelter': { introducedIn: '2025', retiredAfter: null },
  planter: { introducedIn: '2025', retiredAfter: null },

  /* Persistent detail: present in every period, worn by each ----------------- */
  'litter-bin': { introducedIn: '1945', retiredAfter: null },
  'facade-detail-cluster': { introducedIn: '1945', retiredAfter: null },
  'facade-detail-ac-cluster': { introducedIn: '1985', retiredAfter: null },
  'pavement-patch': { introducedIn: '1945', retiredAfter: null },

  /* Corner clutter: the temporary street furniture of each period ----------- */
  'corner-clutter-1945': { introducedIn: '1945', retiredAfter: '1945' },
  'corner-clutter-1965': { introducedIn: '1965', retiredAfter: '1965' },
  'corner-clutter-1985': { introducedIn: '1985', retiredAfter: '1985' },
  'corner-clutter-2005': { introducedIn: '2005', retiredAfter: '2005' },
  'corner-clutter-2025': { introducedIn: '2025', retiredAfter: null },
  'corner-litter-patch': { introducedIn: '1945', retiredAfter: null },
}

/** True when `propId` exists in `eraId` under its lifespan rule. */
export function isPropAvailableInEra(propId: string, eraId: EraId): boolean {
  const lifespan = PROP_LIFESPANS[propId]
  if (lifespan === undefined) {
    return false
  }
  const index = eraIdIndex(eraId)
  const from = eraIdIndex(lifespan.introducedIn)
  const to = lifespan.retiredAfter === null ? ERA_IDS.length - 1 : eraIdIndex(lifespan.retiredAfter)
  return index >= from && index <= to
}

/** The prop ids that exist in one era, sorted. */
export function propsAvailableInEra(eraId: EraId): readonly string[] {
  return Object.keys(PROP_LIFESPANS)
    .filter((propId) => isPropAvailableInEra(propId, eraId))
    .sort()
}

/** Props that existed in an earlier era but no longer exist in `eraId`, sorted. */
export function propsRetiredByEra(eraId: EraId): readonly string[] {
  const index = eraIdIndex(eraId)
  if (index <= 0) {
    return []
  }
  const previous = ERA_IDS[index - 1]
  if (previous === undefined) {
    return []
  }
  const before = propsAvailableInEra(previous)
  const now = new Set(propsAvailableInEra(eraId))
  return before.filter((propId) => !now.has(propId)).sort()
}

/** Props introduced in one era, sorted: the period's new street furniture. */
export function propsIntroducedInEra(eraId: EraId): readonly string[] {
  return Object.keys(PROP_LIFESPANS)
    .filter((propId) => PROP_LIFESPANS[propId]?.introducedIn === eraId)
    .sort()
}

/* ------------------------------------------------------------------------- *
 * Wear profiles: how each period leaves its street furniture
 * ------------------------------------------------------------------------- */

/** Condition of the block in 1945: soot, chipped enamel and little graffiti. */
const WEAR_1945: WearProfile = {
  level: 'weathered',
  grime: 0.62,
  chips: 0.45,
  rust: 0.5,
  fade: 0.3,
  graffiti: 0.04,
}

/** Condition in 1965: cleaner and repainted, but sun-faded. */
const WEAR_1965: WearProfile = {
  level: 'worn',
  grime: 0.45,
  chips: 0.3,
  rust: 0.3,
  fade: 0.35,
  graffiti: 0.06,
}

/** Condition in 1985: the tag-and-rust decade. */
const WEAR_1985: WearProfile = {
  level: 'decrepit',
  grime: 0.78,
  chips: 0.55,
  rust: 0.42,
  fade: 0.4,
  graffiti: 0.62,
}

/** Condition in 2005: cleaned up, still worn at the kerb. */
const WEAR_2005: WearProfile = {
  level: 'worn',
  grime: 0.5,
  chips: 0.28,
  rust: 0.25,
  fade: 0.3,
  graffiti: 0.24,
}

/** Condition in 2025: new kit, low grime, occasional tags. */
const WEAR_2025: WearProfile = {
  level: 'pristine',
  grime: 0.22,
  chips: 0.1,
  rust: 0.1,
  fade: 0.15,
  graffiti: 0.08,
}

/* ------------------------------------------------------------------------- *
 * Era tables
 * ------------------------------------------------------------------------- */

/**
 * The five catalogues.
 *
 * Every era covers all seven anchor categories; the pools are assigned
 * round-robin over that era's anchors, so a pool of *n* props on *m ≥ n* anchors
 * puts each catalogued prop on the block at least once.
 */
export const ERA_PROP_TABLES: Readonly<Record<EraId, EraPropTable>> = {
  '1945': {
    eraId: '1945',
    label: 'Postwar recovery street furniture',
    lamp: {
      technology: 'gas',
      label: 'Gas and early electric',
      followsLighting: true,
      fixedColour: null,
      emissiveScale: 0.85,
      lightIntensityScale: 0.6,
      pointLightLimit: 2,
      glowScale: 1,
    },
    wear: WEAR_1945,
    wearOverrides: {
      'coal-chute': { grime: 0.92, rust: 0.7 },
      'cast-iron-lamp': { grime: 0.75 },
      'pushcart': { grime: 0.8, chips: 0.6 },
      'hitching-post': { rust: 0.75 },
    },
    pools: {
      'light-post': ['cast-iron-lamp', 'early-electric-lamp'],
      'signal-head': ['manual-signal-box'],
      hydrant: ['fire-hydrant'],
      'utility-endpoint': ['utility-transformer', 'utility-cable-arm'],
      'rooftop-detail': ['roof-chimney-stack', 'roof-water-tank'],
      'street-furniture': [
        'news-stand',
        'milk-crate',
        'coal-chute',
        'pushcart',
        'hitching-post',
        'mailbox-cast-iron',
        'litter-bin',
        'facade-detail-cluster',
        'pavement-patch',
      ],
      'corner-clutter': ['corner-clutter-1945', 'corner-litter-patch'],
    },
    notes:
      'Gas and early electric lighting, manual signal boxes, cast-iron hydrants, delivery clutter and coal chutes.',
  },
  '1965': {
    eraId: '1965',
    label: 'Mid-century chrome street furniture',
    lamp: {
      technology: 'incandescent',
      label: 'Incandescent',
      followsLighting: true,
      fixedColour: null,
      emissiveScale: 0.9,
      lightIntensityScale: 0.7,
      pointLightLimit: 2,
      glowScale: 0.95,
    },
    wear: WEAR_1965,
    wearOverrides: {
      'telephone-booth': { graffiti: 0.12 },
      'bus-shelter': { grime: 0.4 },
      'parking-meter': { fade: 0.45 },
    },
    pools: {
      'light-post': ['incandescent-lamp'],
      'signal-head': ['traffic-light-1960s'],
      hydrant: ['dry-barrel-hydrant'],
      'utility-endpoint': ['utility-cable-arm', 'utility-transformer'],
      'rooftop-detail': ['roof-water-tank', 'roof-chimney-stack'],
      'street-furniture': [
        'news-stand',
        'telephone-booth',
        'bus-shelter',
        'parking-meter',
        'neon-arrow-sign',
        'mailbox-cast-iron',
        'milk-crate',
        'pushcart',
        'litter-bin',
        'facade-detail-cluster',
        'pavement-patch',
      ],
      'corner-clutter': ['corner-clutter-1965', 'corner-litter-patch'],
    },
    notes:
      'Incandescent lighting, three-lamp signals, telephone booths, bus shelters, parking meters and neon signage.',
  },
  '1985': {
    eraId: '1985',
    label: 'Sodium-lit tagged street furniture',
    lamp: {
      technology: 'mercury-sodium',
      label: 'Mercury and sodium',
      followsLighting: true,
      fixedColour: null,
      emissiveScale: 1.25,
      lightIntensityScale: 1.2,
      pointLightLimit: 4,
      glowScale: 1.25,
    },
    wear: WEAR_1985,
    wearOverrides: {
      'graffiti-mailbox': { graffiti: 0.95, chips: 0.7 },
      payphone: { graffiti: 0.8 },
      dumpster: { graffiti: 0.75, rust: 0.6 },
      'boom-box': { graffiti: 0.4 },
      'construction-barrier': { grime: 0.85 },
      'facade-detail-ac-cluster': { graffiti: 0.6 },
    },
    pools: {
      'light-post': ['sodium-lamp'],
      'signal-head': ['black-box-signal'],
      hydrant: ['painted-hydrant'],
      'utility-endpoint': ['utility-fuse-panel', 'utility-cable-arm'],
      'rooftop-detail': ['roof-ac-bank', 'roof-water-tank'],
      'street-furniture': [
        'payphone',
        'graffiti-mailbox',
        'dumpster',
        'boom-box',
        'bmx-rack',
        'neon-palm-sign',
        'parking-meter',
        'bollard',
        'construction-barrier',
        'litter-bin',
        'facade-detail-ac-cluster',
        'pavement-patch',
      ],
      'corner-clutter': ['corner-clutter-1985', 'corner-litter-patch'],
    },
    notes:
      'Sodium lighting, black-box signals, painted hydrants, phone rows, tagged mailboxes, dumpsters and works barriers.',
  },
  '2005': {
    eraId: '2005',
    label: 'LED-lit civic street furniture',
    lamp: {
      technology: 'led',
      label: 'Early LED',
      followsLighting: true,
      fixedColour: null,
      emissiveScale: 1,
      lightIntensityScale: 0.9,
      pointLightLimit: 2,
      glowScale: 0.9,
    },
    wear: WEAR_2005,
    wearOverrides: {
      atm: { grime: 0.35 },
      'bus-shelter-ad': { graffiti: 0.35 },
      'parking-kiosk': { graffiti: 0.4 },
    },
    pools: {
      'light-post': ['led-lamp'],
      'signal-head': ['led-signal'],
      hydrant: ['modern-hydrant'],
      'utility-endpoint': ['utility-fibre-box', 'utility-fuse-panel'],
      'rooftop-detail': ['roof-mech-cluster', 'roof-ac-bank'],
      'street-furniture': [
        'bus-shelter-ad',
        'parking-kiosk',
        'security-camera',
        'bike-rack',
        'atm',
        'street-bench',
        'bollard',
        'construction-barrier',
        'telephone-booth',
        'litter-bin',
        'facade-detail-ac-cluster',
        'pavement-patch',
      ],
      'corner-clutter': ['corner-clutter-2005', 'corner-litter-patch'],
    },
    notes:
      'LED lighting, LED mast-arm signals, benches, bike racks, parking kiosks, ATMs, cameras and utility cabinets.',
  },
  '2025': {
    eraId: '2025',
    label: 'Smart-pole street furniture',
    lamp: {
      technology: 'smart-pole',
      label: 'Smart pole',
      followsLighting: true,
      fixedColour: null,
      emissiveScale: 1.05,
      lightIntensityScale: 0.85,
      pointLightLimit: 3,
      glowScale: 0.85,
    },
    wear: WEAR_2025,
    wearOverrides: {
      'e-scooter-rack': { grime: 0.32 },
      'smart-bus-shelter': { graffiti: 0.14 },
      planter: { grime: 0.4, fade: 0.3 },
    },
    pools: {
      'light-post': ['smart-pole', 'led-lamp'],
      'signal-head': ['smart-signal'],
      hydrant: ['smart-hydrant'],
      'utility-endpoint': ['air-quality-sensor', 'utility-fibre-box'],
      'rooftop-detail': ['roof-solar-array', 'roof-mech-cluster'],
      'street-furniture': [
        'ev-charger',
        'e-scooter-rack',
        'parklet-bench',
        'smart-bus-shelter',
        'planter',
        'street-bench',
        'bollard',
        'bike-rack',
        'atm',
        'litter-bin',
        'facade-detail-ac-cluster',
        'pavement-patch',
      ],
      'corner-clutter': ['corner-clutter-2025', 'corner-litter-patch'],
    },
    notes:
      'Smart poles with sensors, EV chargers, e-scooter docks, parklets, planters and micromobility corner clutter.',
  },
}

/** Looks one era's table up, throwing for an unknown id. */
export function getEraPropTable(eraId: EraId): EraPropTable {
  const table = ERA_PROP_TABLES[eraId]
  if (table === undefined) {
    throw new RangeError(`No prop table for era ${eraId}`)
  }
  return table
}

/** The era ids the layer ships tables for, in registry order. */
export const PROP_TABLE_ERA_IDS: readonly EraId[] = ERA_IDS.filter(
  (eraId) => ERA_PROP_TABLES[eraId] !== undefined,
)

/** All prop ids one era's pools can place, sorted and de-duplicated. */
export function eraCatalogue(eraId: EraId): readonly string[] {
  const table = getEraPropTable(eraId)
  const ids = new Set<string>()
  for (const slot of PROP_SLOTS) {
    for (const propId of table.pools[slot]) {
      ids.add(propId)
    }
  }
  return [...ids].sort()
}

/** Props one era has and no other era lists: the era's signature objects. */
export function eraSignatureProps(eraId: EraId): readonly string[] {
  const mine = new Set(eraCatalogue(eraId))
  for (const other of PROP_TABLE_ERA_IDS) {
    if (other === eraId) {
      continue
    }
    for (const propId of eraCatalogue(other)) {
      mine.delete(propId)
    }
  }
  return [...mine].sort()
}

/** Categories one era's catalogue covers. */
export function eraCategories(eraId: EraId): ReadonlySet<string> {
  const table = getEraPropTable(eraId)
  const categories = new Set<string>()
  for (const slot of PROP_SLOTS) {
    for (const propId of table.pools[slot]) {
      categories.add(getPropRecipe(propId).category)
    }
  }
  return categories
}

/* ------------------------------------------------------------------------- *
 * Validation
 * ------------------------------------------------------------------------- */

/** One problem found in the era tables. */
export interface PropTableIssue {
  readonly eraId: EraId | null
  readonly propId: string | null
  readonly code:
    | 'missing-lifespan'
    | 'orphan-lifespan'
    | 'unknown-prop'
    | 'slot-mismatch'
    | 'unavailable-prop'
    | 'empty-pool'
    | 'duplicate-pool'
    | 'missing-category'
    | 'missing-content-tag'
    | 'no-signature-prop'
    | 'lamp-pool-mismatch'
    | 'missing-era'
  readonly message: string
}

/**
 * Checks the whole catalogue: lifespans complete, pools legal for their era,
 * every period covering all five categories, every period owning at least one
 * object no other period has, and every `contentTags.props` id of the era
 * registry present in that era's pool.
 */
export function validatePropTables(): readonly PropTableIssue[] {
  const issues: PropTableIssue[] = []

  for (const propId of Object.keys(PROP_RECIPES)) {
    if (PROP_LIFESPANS[propId] === undefined) {
      issues.push({
        eraId: null,
        propId,
        code: 'missing-lifespan',
        message: `Recipe ${propId} has no lifespan entry`,
      })
    }
  }
  for (const propId of Object.keys(PROP_LIFESPANS)) {
    if (PROP_RECIPES[propId] === undefined) {
      issues.push({
        eraId: null,
        propId,
        code: 'orphan-lifespan',
        message: `Lifespan ${propId} has no recipe`,
      })
    }
  }

  for (const eraId of ERA_IDS) {
    const table = ERA_PROP_TABLES[eraId]
    if (table === undefined) {
      issues.push({
        eraId,
        propId: null,
        code: 'missing-era',
        message: `Era ${eraId} has no prop table`,
      })
      continue
    }

    for (const slot of PROP_SLOTS) {
      const pool = table.pools[slot]
      if (pool.length === 0) {
        issues.push({
          eraId,
          propId: null,
          code: 'empty-pool',
          message: `Era ${eraId} leaves the ${slot} pool empty`,
        })
        continue
      }
      const seen = new Set<string>()
      for (const propId of pool) {
        if (seen.has(propId)) {
          issues.push({
            eraId,
            propId,
            code: 'duplicate-pool',
            message: `Era ${eraId} lists ${propId} twice in the ${slot} pool`,
          })
        }
        seen.add(propId)

        const recipe = PROP_RECIPES[propId]
        if (recipe === undefined) {
          issues.push({
            eraId,
            propId,
            code: 'unknown-prop',
            message: `Era ${eraId} lists unknown prop ${propId}`,
          })
          continue
        }
        if (recipe.slot !== slot) {
          issues.push({
            eraId,
            propId,
            code: 'slot-mismatch',
            message: `Prop ${propId} belongs to ${recipe.slot}, listed under ${slot}`,
          })
        }
        if (!isPropAvailableInEra(propId, eraId)) {
          issues.push({
            eraId,
            propId,
            code: 'unavailable-prop',
            message: `Prop ${propId} is not in service in ${eraId}`,
          })
        }
        if (slot === 'light-post' && (recipe.lamp === null || recipe.category !== 'lighting')) {
          issues.push({
            eraId,
            propId,
            code: 'lamp-pool-mismatch',
            message: `Light post pool of ${eraId} lists ${propId}, which is not a lighting recipe`,
          })
        }
      }
    }

    const categories = eraCategories(eraId)
    for (const category of ['lighting', 'signals', 'furniture', 'utility', 'clutter'] as const) {
      if (!categories.has(category)) {
        issues.push({
          eraId,
          propId: null,
          code: 'missing-category',
          message: `Era ${eraId} has no ${category} prop`,
        })
      }
    }

    if (eraSignatureProps(eraId).length === 0) {
      issues.push({
        eraId,
        propId: null,
        code: 'no-signature-prop',
        message: `Era ${eraId} has no prop that the other eras do not list`,
      })
    }

    const definition = ERA_DEFINITIONS.find((era) => era.id === eraId)
    const catalogue = new Set(eraCatalogue(eraId))
    for (const tag of definition?.contentTags.props ?? []) {
      if (!catalogue.has(tag)) {
        issues.push({
          eraId,
          propId: tag,
          code: 'missing-content-tag',
          message: `Era ${eraId} names prop ${tag} in its content tags, but the layer never places it`,
        })
      }
    }
  }

  return issues
}

/** Convenience: the slot pools of one era as a plain, iterable record. */
export function eraPools(eraId: EraId): Readonly<Record<PropSlot, readonly string[]>> {
  return getEraPropTable(eraId).pools
}
