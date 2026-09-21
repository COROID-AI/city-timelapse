/**
 * The five era building tables.
 *
 * Every period difference the building layer renders is a value here — massing
 * ranges, facade proportions, roof kit, add-on vocabulary, vacancy and
 * construction rates, night lighting — so no geometry function ever tests a
 * year. Adding the 2055 period README.md mentions is one more variation record
 * and one more era record, with no code change.
 *
 * Colours are *not* duplicated here: each table reads the era registry
 * (`src/era`) so a palette edit in `eras.ts` reaches both the buildings and the
 * timeline UI at once. `night` is likewise derived from the era's own lighting
 * (`sunElevationDeg < 0`), which is why the window glow switches on exactly
 * when the era says it is dark outside.
 */

import { ERA_DEFINITIONS, getEra, type EraDefinition, type EraId } from '../../era'
import type {
  BuildingEraTable,
  BuildingMaterialPalette,
  FacadeTable,
  MassingTable,
  RoofKitTable,
} from './types'

/** Period-specific building data that is not read from the era registry. */
export interface EraBuildingVariation {
  /** Era tag mixed into the generator seed so era draws never collide. */
  readonly seedTag: string
  /** Name of the procedural surface family the texture factory draws. */
  readonly textureSet: string
  readonly massing: MassingTable
  readonly facade: FacadeTable
  readonly roof: RoofKitTable
  /** Roof surface colour; the one building colour the era palette lacks. */
  readonly roofColor: string
  /** Fraction of parcels that are a vacant lot in this era. */
  readonly vacancy: number
  /** Fraction of parcels under construction in this era. */
  readonly construction: number
  /** Emissive window intensity of the era. */
  readonly windowEmissiveIntensity: number
  /** Fraction of windows the texture paints as lit. */
  readonly litWindowFraction: number
  readonly roofDressing: readonly string[]
}

/**
 * Massing of the five periods.
 *
 * Heights are a multiple of the parcel's own capacity, so the corner parcels
 * keep standing taller than the interior ones in every era, and the absolute
 * clamp keeps each period inside its silhouette family: 1945 low-rise masonry
 * (2–8 storeys), 1965 mid-rise brick and glass, 1985 concrete towers, 2005
 * taller glass mixed-use on retail podiums, 2025 contemporary towers.
 */
const VARIATIONS: Readonly<Record<EraId, EraBuildingVariation>> = {
  '1945': {
    seedTag: 'low-rise-masonry',
    textureSet: 'soot-brick',
    roofColor: '#4d4038',
    vacancy: 0,
    construction: 0,
    windowEmissiveIntensity: 0,
    litWindowFraction: 0,
    roofDressing: ['tar-paper', 'coal-soot-stain', 'roof-hatch'],
    massing: {
      family: 'low-rise-masonry',
      heightScale: 0.62,
      heightRange: { min: 8, max: 26 },
      floorHeight: { min: 3.1, max: 3.3 },
      groundFloorHeight: 4.6,
      floorRange: { min: 2, max: 8 },
      footprintScale: { min: 0.9, max: 1 },
      podiumHeight: null,
      towerInset: { min: 0.3, max: 0.8 },
      setbackCount: { min: 0, max: 1 },
      setbackInset: { min: 0.4, max: 1 },
      crownHeight: 0.9,
      heightJitter: 0.06,
      floorEfficiency: 0.82,
    },
    facade: {
      style: 'masonry-coursed',
      windowWidth: 0.95,
      windowHeight: 1.7,
      sillHeight: 0.9,
      columnPitch: 2.6,
      glazingRatio: 0.24,
      masonryCourseHeight: 0.34,
      spandrelBandHeight: null,
      mullionWidth: null,
      mullionSpacing: null,
      balconyEveryFloors: null,
      balconyDepth: 0,
      exposedFrame: false,
      detailScale: 1,
      sillBandHeight: 0.28,
    },
    roof: {
      kit: 'masonry-watertank',
      label: 'Tar roof, coal chimneys and a wooden water tank',
      parapetHeight: { min: 0.5, max: 0.9 },
      roofDeck: false,
      greenRoofRatio: 0,
      solarCoverage: 0,
      occupancy: 0.42,
      addOns: [
        {
          kind: 'coal-chimney',
          attach: 'roof',
          count: { min: 1, max: 3 },
          size: { width: { min: 0.9, max: 1.4 }, height: { min: 2.2, max: 3.4 }, depth: { min: 0.9, max: 1.4 } },
          edgeMount: false,
        },
        {
          kind: 'water-tank',
          attach: 'roof',
          count: { min: 1, max: 2 },
          size: { width: { min: 2.2, max: 3 }, height: { min: 2.4, max: 3.2 }, depth: { min: 2.2, max: 3 } },
          edgeMount: false,
        },
        {
          kind: 'fire-escape',
          attach: 'facade',
          count: { min: 2, max: 3 },
          size: { width: { min: 2.2, max: 3.4 }, height: { min: 4, max: 9 }, depth: { min: 1.1, max: 1.4 } },
          edgeMount: true,
        },
        {
          kind: 'roof-vent',
          attach: 'roof',
          count: { min: 2, max: 5 },
          size: { width: { min: 0.4, max: 0.7 }, height: { min: 0.5, max: 1.1 }, depth: { min: 0.4, max: 0.7 } },
          edgeMount: false,
        },
      ],
    },
  },
  '1965': {
    seedTag: 'mid-rise-brick-glass',
    textureSet: 'brick-and-glass',
    roofColor: '#5c5b55',
    vacancy: 0.06,
    construction: 0.12,
    windowEmissiveIntensity: 0,
    litWindowFraction: 0,
    roofDressing: ['gravel-ballast', 'painted-sign-frame', 'service-hatch'],
    massing: {
      family: 'mid-rise-brick-glass',
      heightScale: 1,
      heightRange: { min: 14, max: 38 },
      floorHeight: { min: 3.3, max: 3.5 },
      groundFloorHeight: 4.8,
      floorRange: { min: 3, max: 12 },
      footprintScale: { min: 0.82, max: 0.92 },
      podiumHeight: null,
      towerInset: { min: 0.5, max: 1.2 },
      setbackCount: { min: 0, max: 1 },
      setbackInset: { min: 0.5, max: 1.2 },
      crownHeight: 0.7,
      heightJitter: 0.06,
      floorEfficiency: 0.86,
    },
    facade: {
      style: 'brick-and-glass',
      windowWidth: 1.25,
      windowHeight: 1.5,
      sillHeight: 0.85,
      columnPitch: 2.9,
      glazingRatio: 0.41,
      masonryCourseHeight: 0.3,
      spandrelBandHeight: null,
      mullionWidth: 0.14,
      mullionSpacing: 1.45,
      balconyEveryFloors: null,
      balconyDepth: 0,
      exposedFrame: false,
      detailScale: 1.15,
      sillBandHeight: 0.24,
    },
    roof: {
      kit: 'signage-frame',
      label: 'Brick parapet with a steel sign frame and vents',
      parapetHeight: { min: 0.6, max: 1.1 },
      roofDeck: false,
      greenRoofRatio: 0,
      solarCoverage: 0,
      occupancy: 0.38,
      addOns: [
        {
          kind: 'roof-signage',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 4.5, max: 7 }, height: { min: 2.2, max: 3.4 }, depth: { min: 0.4, max: 0.6 } },
          edgeMount: true,
        },
        {
          kind: 'roof-vent',
          attach: 'roof',
          count: { min: 3, max: 6 },
          size: { width: { min: 0.5, max: 0.9 }, height: { min: 0.7, max: 1.4 }, depth: { min: 0.5, max: 0.9 } },
          edgeMount: false,
        },
        {
          kind: 'elevator-bulkhead',
          attach: 'roof',
          count: { min: 0, max: 1 },
          size: { width: { min: 3, max: 4.2 }, height: { min: 2.6, max: 3.2 }, depth: { min: 3, max: 4.2 } },
          edgeMount: false,
        },
      ],
    },
  },
  '1985': {
    seedTag: 'concrete-tower',
    textureSet: 'concrete-band',
    roofColor: '#45474c',
    vacancy: 0.12,
    construction: 0.18,
    windowEmissiveIntensity: 1.15,
    litWindowFraction: 0.72,
    roofDressing: ['tar-ballast', 'painted-number', 'roof-ladder'],
    massing: {
      family: 'concrete-tower',
      heightScale: 1.5,
      heightRange: { min: 20, max: 56 },
      floorHeight: { min: 3.5, max: 3.7 },
      groundFloorHeight: 4.8,
      floorRange: { min: 5, max: 16 },
      footprintScale: { min: 0.72, max: 0.86 },
      podiumHeight: null,
      towerInset: { min: 1, max: 2 },
      setbackCount: { min: 1, max: 2 },
      setbackInset: { min: 0.8, max: 2 },
      crownHeight: 0.5,
      heightJitter: 0.07,
      floorEfficiency: 0.9,
    },
    facade: {
      style: 'concrete-band-and-mullion',
      windowWidth: 1.5,
      windowHeight: 1.8,
      sillHeight: 0.8,
      columnPitch: 3,
      glazingRatio: 0.55,
      masonryCourseHeight: null,
      spandrelBandHeight: 0.9,
      mullionWidth: 0.22,
      mullionSpacing: 1.7,
      balconyEveryFloors: null,
      balconyDepth: 0,
      exposedFrame: false,
      detailScale: 1.3,
      sillBandHeight: 0,
    },
    roof: {
      kit: 'mechanical-clutter',
      label: 'Concrete slab roof crowded with plant, dishes and aerials',
      parapetHeight: { min: 0.8, max: 1.3 },
      roofDeck: false,
      greenRoofRatio: 0,
      solarCoverage: 0,
      occupancy: 0.52,
      addOns: [
        {
          kind: 'window-ac',
          attach: 'facade',
          count: { min: 6, max: 14 },
          size: { width: { min: 0.7, max: 0.9 }, height: { min: 0.5, max: 0.7 }, depth: { min: 0.6, max: 0.8 } },
          edgeMount: true,
        },
        {
          kind: 'roof-ac-unit',
          attach: 'roof',
          count: { min: 2, max: 5 },
          size: { width: { min: 1.4, max: 2.2 }, height: { min: 1, max: 1.6 }, depth: { min: 1.2, max: 1.8 } },
          edgeMount: false,
        },
        {
          kind: 'antenna',
          attach: 'roof',
          count: { min: 1, max: 2 },
          size: { width: { min: 0.25, max: 0.4 }, height: { min: 4, max: 7 }, depth: { min: 0.25, max: 0.4 } },
          edgeMount: true,
        },
        {
          kind: 'satellite-dish',
          attach: 'roof',
          count: { min: 1, max: 2 },
          size: { width: { min: 1.2, max: 1.8 }, height: { min: 1.2, max: 1.8 }, depth: { min: 0.3, max: 0.5 } },
          edgeMount: false,
        },
        {
          kind: 'elevator-bulkhead',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 3.2, max: 4.6 }, height: { min: 2.8, max: 3.6 }, depth: { min: 3.2, max: 4.6 } },
          edgeMount: false,
        },
      ],
    },
  },
  '2005': {
    seedTag: 'glass-mixed-use',
    textureSet: 'curtain-wall',
    roofColor: '#5f656d',
    vacancy: 0.06,
    construction: 0.06,
    windowEmissiveIntensity: 0,
    litWindowFraction: 0,
    roofDressing: ['membrane', 'mechanical-screen', 'roof-ladder'],
    massing: {
      family: 'glass-mixed-use',
      heightScale: 1.9,
      heightRange: { min: 26, max: 66 },
      floorHeight: { min: 3.8, max: 4 },
      groundFloorHeight: 5.4,
      floorRange: { min: 6, max: 18 },
      footprintScale: { min: 0.8, max: 0.9 },
      podiumHeight: 7.6,
      towerInset: { min: 1.5, max: 3 },
      setbackCount: { min: 1, max: 2 },
      setbackInset: { min: 0.8, max: 1.8 },
      crownHeight: 0.6,
      heightJitter: 0.06,
      floorEfficiency: 0.91,
    },
    facade: {
      style: 'curtain-wall-spandrel',
      windowWidth: 1.7,
      windowHeight: 2.3,
      sillHeight: 0.7,
      columnPitch: 2.4,
      glazingRatio: 0.71,
      masonryCourseHeight: null,
      spandrelBandHeight: 1.1,
      mullionWidth: 0.16,
      mullionSpacing: 1.8,
      balconyEveryFloors: null,
      balconyDepth: 0,
      exposedFrame: false,
      detailScale: 1.45,
      sillBandHeight: 0,
    },
    roof: {
      kit: 'penthouse-deck',
      label: 'Membrane roof with a mechanical penthouse and a service deck',
      parapetHeight: { min: 0.9, max: 1.4 },
      roofDeck: true,
      greenRoofRatio: 0,
      solarCoverage: 0,
      occupancy: 0.46,
      addOns: [
        {
          kind: 'mechanical-penthouse',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 6, max: 9 }, height: { min: 3.6, max: 4.6 }, depth: { min: 5, max: 7.5 } },
          edgeMount: true,
        },
        {
          kind: 'roof-deck',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 5, max: 8 }, height: { min: 0.3, max: 0.5 }, depth: { min: 4, max: 6 } },
          edgeMount: false,
        },
        {
          kind: 'roof-vent',
          attach: 'roof',
          count: { min: 3, max: 6 },
          size: { width: { min: 0.5, max: 0.9 }, height: { min: 0.6, max: 1.2 }, depth: { min: 0.5, max: 0.9 } },
          edgeMount: false,
        },
      ],
    },
  },
  '2025': {
    seedTag: 'contemporary-tower',
    textureSet: 'green-glass',
    roofColor: '#3f4a44',
    vacancy: 0,
    construction: 0.19,
    windowEmissiveIntensity: 0,
    litWindowFraction: 0,
    roofDressing: ['green-roof-tray', 'solar-ballast', 'roof-deck-plank'],
    massing: {
      family: 'contemporary-tower',
      heightScale: 2.5,
      heightRange: { min: 32, max: 92 },
      floorHeight: { min: 4.1, max: 4.3 },
      groundFloorHeight: 5.8,
      floorRange: { min: 8, max: 24 },
      footprintScale: { min: 0.66, max: 0.8 },
      podiumHeight: 8.4,
      towerInset: { min: 2, max: 4 },
      setbackCount: { min: 1, max: 2 },
      setbackInset: { min: 1, max: 2.4 },
      crownHeight: 0.45,
      heightJitter: 0.05,
      floorEfficiency: 0.93,
    },
    facade: {
      style: 'exposed-structure-balcony',
      windowWidth: 2,
      windowHeight: 2.4,
      sillHeight: 0.6,
      columnPitch: 2.8,
      glazingRatio: 0.66,
      masonryCourseHeight: null,
      spandrelBandHeight: 0.75,
      mullionWidth: 0.18,
      mullionSpacing: 2.1,
      balconyEveryFloors: 2,
      balconyDepth: 1.6,
      exposedFrame: true,
      detailScale: 1.6,
      sillBandHeight: 0,
    },
    roof: {
      kit: 'green-solar',
      label: 'Green roof, solar array and a planted roof deck',
      parapetHeight: { min: 0.7, max: 1.1 },
      roofDeck: true,
      greenRoofRatio: 0.55,
      solarCoverage: 0.3,
      occupancy: 0.4,
      addOns: [
        {
          kind: 'green-roof',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 6, max: 10 }, height: { min: 0.4, max: 0.7 }, depth: { min: 5, max: 9 } },
          edgeMount: false,
        },
        {
          kind: 'solar-array',
          attach: 'roof',
          count: { min: 1, max: 2 },
          size: { width: { min: 4, max: 7 }, height: { min: 0.4, max: 0.8 }, depth: { min: 2.4, max: 3.6 } },
          edgeMount: true,
        },
        {
          kind: 'roof-deck',
          attach: 'roof',
          count: { min: 1, max: 1 },
          size: { width: { min: 4.5, max: 7 }, height: { min: 0.3, max: 0.5 }, depth: { min: 3.5, max: 5.5 } },
          edgeMount: true,
        },
        {
          kind: 'roof-vent',
          attach: 'roof',
          count: { min: 2, max: 4 },
          size: { width: { min: 0.4, max: 0.8 }, height: { min: 0.5, max: 1 }, depth: { min: 0.4, max: 0.8 } },
          edgeMount: false,
        },
      ],
    },
  },
}

/** Era ids the building layer ships, in timeline order. */
export const BUILDING_ERA_IDS: readonly EraId[] = ERA_DEFINITIONS.map((era) => era.id)

/**
 * True when the era's own lighting says it is night.
 *
 * The window glow is driven from this flag alone, so a day era can never ship
 * lit windows and a night era always does.
 */
export function eraNightFlag(eraId: EraId): boolean {
  return getEra(eraId).lighting.sunElevationDeg < 0
}

/** Building colours of an era, read from the era registry plus the roof colour. */
export function buildingPalette(era: EraDefinition, roofColor: string): BuildingMaterialPalette {
  const { palette, lighting } = era
  return {
    mass: palette.buildingBase,
    accent: palette.buildingAccent,
    trim: palette.facadeTrim,
    glass: palette.windowGlass,
    roof: roofColor,
    detail: palette.storefrontBody,
    glow: lighting.artificialLightColor,
  }
}

/** Composes one era's complete building table from the registry and the variation. */
export function createBuildingEraTable(
  era: EraDefinition,
  variation: EraBuildingVariation,
): BuildingEraTable {
  const night = eraNightFlag(era.id)
  return {
    eraId: era.id,
    year: era.year,
    label: era.label,
    seedTag: variation.seedTag,
    palette: buildingPalette(era, variation.roofColor),
    massing: variation.massing,
    facade: variation.facade,
    roof: variation.roof,
    textureSet: variation.textureSet,
    vacancy: variation.vacancy,
    construction: variation.construction,
    night,
    // Emissive windows are a night-only feature: the flag switches them.
    windowEmissiveIntensity: night ? variation.windowEmissiveIntensity : 0,
    litWindowFraction: night ? variation.litWindowFraction : 0,
    roofDressing: variation.roofDressing,
  }
}

/** The shipped building tables, one complete record per era. */
export const BUILDING_TABLES: Readonly<Record<EraId, BuildingEraTable>> = Object.fromEntries(
  ERA_DEFINITIONS.map((era) => [era.id, createBuildingEraTable(era, VARIATIONS[era.id])]),
) as Readonly<Record<EraId, BuildingEraTable>>

/** Building table of an era id; throws for an unknown id, like the era registry. */
export function getBuildingTable(eraId: EraId): BuildingEraTable {
  const era = getEra(eraId)
  return BUILDING_TABLES[era.id]
}

/** Building table of an era id or definition. */
export function buildingTableFor(era: EraDefinition | EraId): BuildingEraTable {
  return getBuildingTable(typeof era === 'string' ? era : era.id)
}

/** The raw variation record of an era, exposed so tests can diff two eras. */
export function getBuildingVariation(eraId: EraId): EraBuildingVariation {
  return VARIATIONS[eraId]
}

/**
 * Structural checks the tables must satisfy before anything renders.
 *
 * Returns a (possibly empty) list of problems instead of throwing, so the unit
 * suite can report all of them at once.
 */
export function validateBuildingTables(): readonly string[] {
  const problems: string[] = []
  for (const eraId of BUILDING_ERA_IDS) {
    const table = BUILDING_TABLES[eraId]
    const { massing, facade, roof } = table
    if (massing.heightRange.min >= massing.heightRange.max) {
      problems.push(`${eraId}: massing height range is empty`)
    }
    if (massing.floorHeight.min > massing.floorHeight.max) {
      problems.push(`${eraId}: floor height range is inverted`)
    }
    if (massing.groundFloorHeight < 4.6) {
      problems.push(`${eraId}: ground floor is shorter than the layout's storefront bays`)
    }
    if (massing.footprintScale.min <= 0 || massing.footprintScale.max > 1) {
      problems.push(`${eraId}: footprint scale leaves the parcel`)
    }
    if (facade.columnPitch <= 0 || facade.windowWidth <= 0 || facade.windowHeight <= 0) {
      problems.push(`${eraId}: facade proportions are not positive`)
    }
    if (facade.windowWidth + 0.3 > facade.columnPitch) {
      problems.push(`${eraId}: window pitch leaves no pier between windows`)
    }
    if (facade.balconyEveryFloors !== null && facade.balconyDepth <= 0) {
      problems.push(`${eraId}: balconies need a positive projection`)
    }
    if (roof.addOns.length === 0) {
      problems.push(`${eraId}: roof kit places nothing`)
    }
    if (table.night && table.windowEmissiveIntensity <= 0) {
      problems.push(`${eraId}: night era ships unlit windows`)
    }
    if (!table.night && table.windowEmissiveIntensity !== 0) {
      problems.push(`${eraId}: day era ships lit windows`)
    }
    if (table.vacancy < 0 || table.vacancy > 1 || table.construction < 0 || table.construction > 1) {
      problems.push(`${eraId}: state rates are outside 0..1`)
    }
    if (table.vacancy + table.construction > 1) {
      problems.push(`${eraId}: vacancy and construction rates overlap the whole block`)
    }
  }
  return problems
}
