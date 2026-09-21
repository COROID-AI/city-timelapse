/**
 * The five era outfit tables.
 *
 * One row per period: a complete outfit set — garment shape, hair, headwear,
 * accessories and carried props — plus the crowd's density and walking pace
 * multipliers. Colours are lifted from the era's own
 * `population.outfitPalette`, and the model keys come from
 * `population.modelKeys`, so the registry stays the single source of truth for
 * what a period looks like and this file only decides how the figures are cut.
 *
 * Adjacent periods share no outfit id, no garment sequence and no palette
 * order, which is what makes the crowd visibly cross-dress during a switch.
 */

import { getEra, type EraId } from '../../era'
import type {
  GarmentShape,
  HairStyle,
  HeadwearKind,
  OutfitSet,
  PedestrianEraData,
} from './types'

/** Static half of one outfit; colours and model key are merged in per era. */
interface OutfitRow {
  readonly id: string
  readonly label: string
  readonly garment: GarmentShape
  readonly hair: HairStyle
  readonly headwear: HeadwearKind
  readonly accessories: readonly string[]
  readonly carried: readonly string[]
  readonly hairColor: string
  readonly skinColor: string
  readonly heightScale: number
  readonly build: number
}

interface CrowdRow {
  readonly label: string
  readonly outfits: readonly OutfitRow[]
  readonly densityScale: number
  readonly walkSpeedScale: number
}

const CROWD_ROWS: Readonly<Record<EraId, CrowdRow>> = {
  '1945': {
    label: 'Home-front crowd',
    densityScale: 0.95,
    walkSpeedScale: 0.95,
    outfits: [
      {
        id: '1945-wool-overcoat',
        label: 'Wool overcoat',
        garment: 'overcoat',
        hair: 'short',
        headwear: 'newsboy-cap',
        accessories: ['leather-gloves'],
        carried: ['ration-bag'],
        hairColor: '#3a2c22',
        skinColor: '#e0b090',
        heightScale: 1,
        build: 1.05,
      },
      {
        id: '1945-homemaker-dress',
        label: 'Homemaker dress',
        garment: 'dress',
        hair: 'bun',
        headwear: 'none',
        accessories: ['pearl-brooch'],
        carried: ['shopping-basket'],
        hairColor: '#5a3b28',
        skinColor: '#e6b997',
        heightScale: 0.96,
        build: 0.9,
      },
      {
        id: '1945-returning-soldier',
        label: 'Returning soldier',
        garment: 'uniform',
        hair: 'short',
        headwear: 'flat-cap',
        accessories: ['canvas-satchel'],
        carried: ['duffel-bag'],
        hairColor: '#2f241c',
        skinColor: '#d8a880',
        heightScale: 1.04,
        build: 1.1,
      },
      {
        id: '1945-loss-boy',
        label: 'Ration shopper',
        garment: 'jacket',
        hair: 'pompadour',
        headwear: 'newsboy-cap',
        accessories: ['trouser-clips'],
        carried: ['ration-book'],
        hairColor: '#4a3524',
        skinColor: '#e2b28c',
        heightScale: 0.94,
        build: 0.86,
      },
    ],
  },
  '1965': {
    label: 'Mid-century crowd',
    densityScale: 1,
    walkSpeedScale: 1,
    outfits: [
      {
        id: '1965-clean-suit',
        label: 'Clean-cut suit',
        garment: 'suit',
        hair: 'short',
        headwear: 'fedora',
        accessories: ['cigarette-case'],
        carried: ['briefcase'],
        hairColor: '#2b211a',
        skinColor: '#e3b791',
        heightScale: 1.02,
        build: 0.98,
      },
      {
        id: '1965-shift-dress',
        label: 'Shift dress',
        garment: 'dress',
        hair: 'bun',
        headwear: 'sunhat',
        accessories: ['cat-eye-glasses'],
        carried: ['hand-bag'],
        hairColor: '#6a442c',
        skinColor: '#e8bd97',
        heightScale: 0.96,
        build: 0.88,
      },
      {
        id: '1965-turtleneck-beatnik',
        label: 'Turtleneck beatnik',
        garment: 'jacket',
        hair: 'long',
        headwear: 'beanie',
        accessories: ['round-glasses'],
        carried: ['guitar-case'],
        hairColor: '#241a14',
        skinColor: '#dcac84',
        heightScale: 1.03,
        build: 0.96,
      },
      {
        id: '1965-student-cardigan',
        label: 'Student cardigan',
        garment: 'jacket',
        hair: 'ponytail',
        headwear: 'none',
        accessories: ['book-strap'],
        carried: ['text-book'],
        hairColor: '#5c3d26',
        skinColor: '#e6bb95',
        heightScale: 0.95,
        build: 0.9,
      },
      {
        id: '1965-driver-uniform',
        label: 'Transit uniform',
        garment: 'uniform',
        hair: 'short',
        headwear: 'flat-cap',
        accessories: ['ticket-punch'],
        carried: ['satchel'],
        hairColor: '#33261d',
        skinColor: '#d9a67c',
        heightScale: 1.04,
        build: 1.06,
      },
    ],
  },
  '1985': {
    label: 'Neon streetwear crowd',
    densityScale: 1.05,
    walkSpeedScale: 1.05,
    outfits: [
      {
        id: '1985-neon-jacket',
        label: 'Neon windbreaker',
        garment: 'jacket',
        hair: 'curly',
        headwear: 'cap',
        accessories: ['boombox-strap'],
        carried: ['boombox'],
        hairColor: '#1d1712',
        skinColor: '#e0b089',
        heightScale: 1.01,
        build: 1,
      },
      {
        id: '1985-denim-trench',
        label: 'Denim trench',
        garment: 'trench',
        hair: 'ponytail',
        headwear: 'none',
        accessories: ['shoulder-pads'],
        carried: ['walkman'],
        hairColor: '#4d3320',
        skinColor: '#e7bc95',
        heightScale: 0.98,
        build: 0.95,
      },
      {
        id: '1985-synth-suit',
        label: 'Synth suit',
        garment: 'suit',
        hair: 'pompadour',
        headwear: 'none',
        accessories: ['pocket-phone'],
        carried: ['brick-phone'],
        hairColor: '#2a1f18',
        skinColor: '#d9a97f',
        heightScale: 1.03,
        build: 0.99,
      },
      {
        id: '1985-arcade-hoodie',
        label: 'Arcade hoodie',
        garment: 'hoodie',
        hair: 'short',
        headwear: 'hood',
        accessories: ['token-roll'],
        carried: ['arcade-stick'],
        hairColor: '#241b15',
        skinColor: '#c9986f',
        heightScale: 0.97,
        build: 1.02,
      },
      {
        id: '1985-aerobics-kit',
        label: 'Aerobics kit',
        garment: 'jacket',
        hair: 'long',
        headwear: 'beanie',
        accessories: ['leg-warmers'],
        carried: ['gym-bag'],
        hairColor: '#6b4527',
        skinColor: '#eabd96',
        heightScale: 0.95,
        build: 0.88,
      },
      {
        id: '1985-courier-jacket',
        label: 'Courier jacket',
        garment: 'uniform',
        hair: 'short',
        headwear: 'helmet',
        accessories: ['radio-pack'],
        carried: ['dispatch-case'],
        hairColor: '#31241b',
        skinColor: '#d6a479',
        heightScale: 1.02,
        build: 1.04,
      },
    ],
  },
  '2005': {
    label: 'Denim and commuter crowd',
    densityScale: 1.05,
    walkSpeedScale: 1.05,
    outfits: [
      {
        id: '2005-low-rise-denim',
        label: 'Low-rise denim',
        garment: 'jacket',
        hair: 'long',
        headwear: 'none',
        accessories: ['flip-phone'],
        carried: ['shopping-bag'],
        hairColor: '#3a2a1e',
        skinColor: '#e2b48e',
        heightScale: 1,
        build: 0.94,
      },
      {
        id: '2005-commuter-coat',
        label: 'Commuter coat',
        garment: 'overcoat',
        hair: 'bun',
        headwear: 'beanie',
        accessories: ['mp3-player'],
        carried: ['laptop-bag'],
        hairColor: '#4b3222',
        skinColor: '#dfae86',
        heightScale: 1.02,
        build: 1,
      },
      {
        id: '2005-hoodie-youth',
        label: 'Hoodie youth',
        garment: 'hoodie',
        hair: 'curly',
        headwear: 'hood',
        accessories: ['lanyard'],
        carried: ['skateboard'],
        hairColor: '#1f1813',
        skinColor: '#c8946b',
        heightScale: 0.97,
        build: 1.03,
      },
      {
        id: '2005-office-suit',
        label: 'Office suit',
        garment: 'suit',
        hair: 'short',
        headwear: 'none',
        accessories: ['bluetooth-headset'],
        carried: ['roll-aboard'],
        hairColor: '#2c2119',
        skinColor: '#e5b891',
        heightScale: 1.04,
        build: 0.97,
      },
      {
        id: '2005-tourist-parka',
        label: 'Tourist parka',
        garment: 'puffer',
        hair: 'ponytail',
        headwear: 'sunhat',
        accessories: ['camera-strap'],
        carried: ['map-folder'],
        hairColor: '#5f4028',
        skinColor: '#eabf98',
        heightScale: 0.99,
        build: 1.05,
      },
    ],
  },
  '2025': {
    label: 'Layered streetwear crowd',
    densityScale: 1,
    walkSpeedScale: 1.1,
    outfits: [
      {
        id: '2025-layered-puffer',
        label: 'Layered puffer',
        garment: 'puffer',
        hair: 'short',
        headwear: 'beanie',
        accessories: ['wireless-buds'],
        carried: ['delivery-crate'],
        hairColor: '#2a2018',
        skinColor: '#e3b58e',
        heightScale: 1.01,
        build: 1.04,
      },
      {
        id: '2025-tech-trench',
        label: 'Technical trench',
        garment: 'trench',
        hair: 'long',
        headwear: 'none',
        accessories: ['smart-watch'],
        carried: ['coffee-cup'],
        hairColor: '#3d2b1e',
        skinColor: '#dfae85',
        heightScale: 1.02,
        build: 0.96,
      },
      {
        id: '2025-courier-hoodie',
        label: 'Courier hoodie',
        garment: 'hoodie',
        hair: 'curly',
        headwear: 'hood',
        accessories: ['delivery-scanner'],
        carried: ['parcel-tote'],
        hairColor: '#241b15',
        skinColor: '#c9966e',
        heightScale: 1,
        build: 1.02,
      },
      {
        id: '2025-tailored-coat',
        label: 'Tailored coat',
        garment: 'overcoat',
        hair: 'bun',
        headwear: 'none',
        accessories: ['tablet-sleeve'],
        carried: ['commuter-pack'],
        hairColor: '#4a3120',
        skinColor: '#e7bc95',
        heightScale: 1.03,
        build: 0.95,
      },
      {
        id: '2025-active-shell',
        label: 'Active shell',
        garment: 'jacket',
        hair: 'ponytail',
        headwear: 'cap',
        accessories: ['fitness-band'],
        carried: ['water-bottle'],
        hairColor: '#5b3c25',
        skinColor: '#eabd97',
        heightScale: 0.98,
        build: 0.93,
      },
      {
        id: '2025-micro-mobility',
        label: 'Micro-mobility rider',
        garment: 'uniform',
        hair: 'short',
        headwear: 'helmet',
        accessories: ['reflective-vest'],
        carried: ['scooter-fold'],
        hairColor: '#2f231a',
        skinColor: '#d4a176',
        heightScale: 1.02,
        build: 0.99,
      },
    ],
  },
}

/** Resolves one era's crowd table, merging in the registry palette and keys. */
export function outfitEraData(eraId: EraId): PedestrianEraData {
  const era = getEra(eraId)
  const row = CROWD_ROWS[era.id]
  const palette = [...era.population.outfitPalette]
  const pick = (index: number): string => palette[index % palette.length] ?? era.palette.accent

  const outfits: OutfitSet[] = row.outfits.map((outfit, index) => ({
    id: outfit.id,
    label: outfit.label,
    modelKey: era.population.modelKeys[index % era.population.modelKeys.length] ?? outfit.id,
    garment: outfit.garment,
    hair: outfit.hair,
    headwear: outfit.headwear,
    accessories: [...outfit.accessories],
    carried: [...outfit.carried],
    upperColor: pick(index),
    lowerColor: pick(index + 2),
    hairColor: outfit.hairColor,
    skinColor: outfit.skinColor,
    accessoryColor: pick(index + 1),
    heightScale: outfit.heightScale,
    build: outfit.build,
  }))

  return {
    eraId: era.id,
    label: row.label,
    outfitEraTag: era.population.outfitEraTag,
    modelKeys: [...era.population.modelKeys],
    outfits,
    densityScale: row.densityScale,
    walkSpeedScale: row.walkSpeedScale,
    childRatio: era.population.childRatio,
    groupSizeRange: [...era.population.groupSizeRange] as [number, number],
    palette,
  }
}

/** Every era's crowd table, keyed by era id, in timeline order. */
export const ERA_OUTFIT_TABLES: Readonly<Record<EraId, PedestrianEraData>> = Object.freeze({
  '1945': outfitEraData('1945'),
  '1965': outfitEraData('1965'),
  '1985': outfitEraData('1985'),
  '2005': outfitEraData('2005'),
  '2025': outfitEraData('2025'),
})

/** True when an untrusted value is an outfit id of any era. */
export function isOutfitId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  return Object.values(ERA_OUTFIT_TABLES).some((table) =>
    table.outfits.some((outfit) => outfit.id === value),
  )
}
