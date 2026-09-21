/**
 * The five era building tables.
 *
 * One row per period: how tall the block builds, how much of each parcel the
 * mass covers, how the facades are proportioned and what the roofs carry. The
 * numbers are the art direction of the skyline — 1945 low masonry, 1965 mid-rise
 * brick/glass, 1985 concrete towers, 2005 glass mixed-use, 2025 tall
 * contemporary — and every value is read by both the plan generator and the
 * three.js painter, so there is only one place a period's massing is defined.
 *
 * The archetype vocabulary and the colour palette are *not* duplicated here:
 * they are read from the era registry (`contentTags.buildings` and
 * `palette`), which owns everything the rest of the project knows about a
 * period.
 */

import { getEra, type EraId } from '../../era'
import type {
  BuildingEraData,
  BuildingStyleKind,
  FacadeProfile,
  MassingProfile,
  RoofItemSpec,
} from './types'

/** Static half of one era row; archetypes are merged in from the registry. */
interface BuildingTableRow {
  readonly label: string
  readonly style: BuildingStyleKind
  readonly massing: MassingProfile
  readonly facade: FacadeProfile
  readonly roof: readonly RoofItemSpec[]
}

/** Compact roof-item helper. */
function roofItem(
  kind: RoofItemSpec['kind'],
  min: number,
  max: number,
  chance: number,
  height: number,
  width: number,
  depth: number,
): RoofItemSpec {
  return { kind, min, max, chance, height, width, depth }
}

const ROWS: Readonly<Record<EraId, BuildingTableRow>> = {
  '1945': {
    label: 'Low masonry block',
    style: 'masonry',
    massing: {
      minFloors: 2,
      maxFloors: 5,
      floorHeight: 3.4,
      groundFloorHeight: 4.4,
      footprintScale: 0.78,
      towerChance: 0,
      towerBonusFloors: 0,
      vacancyRate: 0.12,
      constructionRate: 0,
      windowEmissive: 0.5,
    },
    facade: {
      style: 'masonry',
      windowWidth: 1,
      windowHeight: 1.5,
      windowSpacingX: 1.4,
      windowSpacingY: 1.9,
      sillHeight: 0.9,
      masonryCoursing: true,
      spandrelBands: false,
      mullions: false,
      exposedStructure: false,
      balconyChance: 0.05,
      storefrontBandHeight: 4.4,
    },
    roof: [
      roofItem('chimney', 1, 3, 0.8, 2.2, 0.9, 0.9),
      roofItem('water-tank', 1, 1, 0.45, 2.4, 1.8, 1.8),
      roofItem('fire-escape', 1, 2, 0.7, 3.4, 2.4, 1.1),
    ],
  },
  '1965': {
    label: 'Mid-rise brick and glass',
    style: 'brick-glass',
    massing: {
      minFloors: 4,
      maxFloors: 9,
      floorHeight: 3.5,
      groundFloorHeight: 4.4,
      footprintScale: 0.82,
      towerChance: 0.1,
      towerBonusFloors: 4,
      vacancyRate: 0,
      constructionRate: 0.12,
      windowEmissive: 0.7,
    },
    facade: {
      style: 'brick-glass',
      windowWidth: 1.3,
      windowHeight: 1.6,
      windowSpacingX: 1.1,
      windowSpacingY: 1.8,
      sillHeight: 0.9,
      masonryCoursing: true,
      spandrelBands: false,
      mullions: true,
      exposedStructure: false,
      balconyChance: 0.15,
      storefrontBandHeight: 4.4,
    },
    roof: [
      roofItem('sign-frame', 1, 2, 0.5, 1.6, 3.2, 0.4),
      roofItem('vent', 1, 3, 0.8, 0.8, 0.6, 0.6),
    ],
  },
  '1985': {
    label: 'Concrete towers',
    style: 'concrete',
    massing: {
      minFloors: 6,
      maxFloors: 15,
      floorHeight: 3.4,
      groundFloorHeight: 4.6,
      footprintScale: 0.72,
      towerChance: 0.35,
      towerBonusFloors: 8,
      vacancyRate: 0.06,
      constructionRate: 0.18,
      windowEmissive: 0.95,
    },
    facade: {
      style: 'concrete',
      windowWidth: 1.5,
      windowHeight: 1.6,
      windowSpacingX: 1,
      windowSpacingY: 1.7,
      sillHeight: 0.8,
      masonryCoursing: false,
      spandrelBands: false,
      mullions: true,
      exposedStructure: true,
      balconyChance: 0.1,
      storefrontBandHeight: 4.6,
    },
    roof: [
      roofItem('ac-box', 2, 6, 0.85, 0.8, 1, 0.8),
      roofItem('antenna', 1, 2, 0.6, 3.5, 0.15, 0.15),
      roofItem('satellite-dish', 1, 2, 0.5, 0.9, 1.1, 0.2),
    ],
  },
  '2005': {
    label: 'Glass mixed-use',
    style: 'glass-mixed',
    massing: {
      minFloors: 5,
      maxFloors: 13,
      floorHeight: 3.6,
      groundFloorHeight: 4.8,
      footprintScale: 0.68,
      towerChance: 0.3,
      towerBonusFloors: 7,
      vacancyRate: 0.12,
      constructionRate: 0.12,
      windowEmissive: 0.85,
    },
    facade: {
      style: 'glass-mixed',
      windowWidth: 1.8,
      windowHeight: 2,
      windowSpacingX: 0.6,
      windowSpacingY: 1.4,
      sillHeight: 0.5,
      masonryCoursing: false,
      spandrelBands: true,
      mullions: true,
      exposedStructure: false,
      balconyChance: 0.2,
      storefrontBandHeight: 4.8,
    },
    roof: [
      roofItem('mechanical-penthouse', 1, 1, 0.6, 3, 5, 4),
      roofItem('vent', 1, 2, 0.6, 0.7, 0.7, 0.7),
      roofItem('ac-box', 1, 2, 0.4, 0.7, 0.9, 0.7),
    ],
  },
  '2025': {
    label: 'Tall contemporary',
    style: 'contemporary',
    massing: {
      minFloors: 8,
      maxFloors: 24,
      floorHeight: 3.7,
      groundFloorHeight: 5,
      footprintScale: 0.6,
      towerChance: 0.5,
      towerBonusFloors: 10,
      vacancyRate: 0.06,
      constructionRate: 0.18,
      windowEmissive: 1,
    },
    facade: {
      style: 'contemporary',
      windowWidth: 2,
      windowHeight: 2.2,
      windowSpacingX: 0.5,
      windowSpacingY: 1.3,
      sillHeight: 0.4,
      masonryCoursing: false,
      spandrelBands: false,
      mullions: true,
      exposedStructure: true,
      balconyChance: 0.3,
      storefrontBandHeight: 5,
    },
    roof: [
      roofItem('solar-array', 1, 2, 0.7, 0.4, 6, 3),
      roofItem('green-roof', 1, 1, 0.5, 0.5, 7, 5),
      roofItem('roof-deck', 1, 1, 0.4, 1.1, 5, 4),
    ],
  },
}

/** Resolves one era's building table, merging in the registry vocabulary. */
export function buildingEraData(eraId: EraId): BuildingEraData {
  const era = getEra(eraId)
  const row = ROWS[era.id]
  return {
    eraId: era.id,
    label: row.label,
    style: row.style,
    archetypes: [...era.contentTags.buildings],
    massing: row.massing,
    facade: row.facade,
    roof: row.roof,
  }
}

/** Every era's building table, keyed by era id, in timeline order. */
export const ERA_BUILDING_TABLES: Readonly<Record<EraId, BuildingEraData>> = Object.freeze({
  '1945': buildingEraData('1945'),
  '1965': buildingEraData('1965'),
  '1985': buildingEraData('1985'),
  '2005': buildingEraData('2005'),
  '2025': buildingEraData('2025'),
})

/** True when an untrusted value is a roof-item kind. */
export function isRoofItemKind(value: unknown): value is RoofItemSpec['kind'] {
  return (
    typeof value === 'string' &&
    (['chimney', 'water-tank', 'fire-escape', 'sign-frame', 'vent', 'ac-box', 'antenna', 'satellite-dish', 'mechanical-penthouse', 'solar-array', 'green-roof', 'roof-deck'] as readonly string[]).includes(
      value,
    )
  )
}
