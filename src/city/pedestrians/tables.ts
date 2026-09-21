/**
 * Per-era outfit tables: the data half of the pedestrian layer.
 *
 * Five eras, five looks each, plus the hair, headwear, accessory and carried
 * prop pools those looks draw from. Nothing in this file branches on a year:
 * geometry and animation code only ever read `EraCrowdTable` records, so a new
 * period (or a period-specific celebrity) is a data edit.
 *
 * The tables deliberately mirror the era registry — `density`, `outfitEraTag`
 * and the leading colours of `palette` are the `EraPopulation` values — and the
 * unit suite asserts that they still agree, so the era model stays the single
 * source of truth for population behaviour while this file owns the silhouettes.
 *
 * ## Shape reuse is intentional
 *
 * Garment shapes are shared constants (`TROUSER_THIGH`, `SHOE_LEATHER`, …), not
 * per-outfit literals. Two pieces with the same primitive, size, resolution and
 * taper render as one instanced mesh with two instance colours, which is what
 * keeps a dense crowd inside the draw-call budget while every period keeps its
 * own palette (see `outfits.ts` for the geometry key and the pooling).
 *
 * ## Period vocabulary
 *
 * - **1945** — ration-era tailoring: wool overcoats, house dresses, headscarves,
 *   flat caps, garrison caps, boots and basket-carrying shoppers.
 * - **1965** — the slim sixties: narrow-lapel suits and fedoras, shift dresses
 *   and pencil skirts, turtleneck beatniks, beehives and pillbox hats.
 * - **1985** — denim, tracksuits and power dressing: shoulder pads, neon
 *   palettes, mohawks, boomboxes and brick phones.
 * - **2005** — hoodies, cargo pants and flip phones: business casual, puffer
 *   jackets, school backpacks and barista aprons.
 * - **2025** — athleisure, helmets and mask-optional accessories: mid layers,
 *   delivery couriers, earbuds and phone-in-hand walking.
 */

import { getEra, type EraId } from '../../era'
import type {
  ColourRef,
  EraCrowdTable,
  GaitProfile,
  GarmentPiece,
  GarmentSlot,
  HairStyle,
  OutfitItem,
  OutfitSet,
  PartId,
  PrimitiveShape,
} from './types'
import { box, cylinder, sphere, taperedCylinder, torus } from './bodies'

/* ------------------------------------------------------------------------- *
 * Shape library
 * ------------------------------------------------------------------------- */

/* Torso silhouettes ------------------------------------------------------- */

const TORSO_SHIRT = box(0.4, 0.46, 0.23, [0, -0.01, 0])
const TORSO_COAT = box(0.48, 0.78, 0.3, [0, -0.12, 0.01])
const COAT_COLLAR = box(0.3, 0.09, 0.26, [0, 0.27, 0])
const COAT_LAPEL = box(0.09, 0.3, 0.03, [-0.1, 0.03, 0.15])
const COAT_LAPEL_R = box(0.09, 0.3, 0.03, [0.1, 0.03, 0.15])
const TORSO_JACKET = box(0.44, 0.52, 0.26, [0, -0.02, 0])
const JACKET_COLLAR = box(0.26, 0.07, 0.22, [0, 0.23, 0])
const TORSO_SUIT = box(0.46, 0.58, 0.27, [0, -0.03, 0])
const SUIT_LAPEL_L = box(0.08, 0.3, 0.03, [-0.1, 0.04, 0.15])
const SUIT_LAPEL_R = box(0.08, 0.3, 0.03, [0.1, 0.04, 0.15])
const TORSO_CARDIGAN = box(0.42, 0.5, 0.25, [0, -0.02, 0])
const TORSO_BLOUSE = box(0.42, 0.48, 0.24, [0, -0.01, 0])
const TORSO_TUNIC = box(0.44, 0.6, 0.26, [0, -0.06, 0])
const TORSO_HOODIE = box(0.48, 0.54, 0.3, [0, -0.03, 0])
const HOODIE_HOOD = sphere(0.32, 0.26, 0.3, [0, 0.19, -0.1])
const TORSO_TRACKSUIT = box(0.5, 0.56, 0.3, [0, -0.04, 0])
const TRACKSUIT_COLLAR = cylinder(0.11, 0.1, 8, [0, 0.25, 0])
const TORSO_PUFFER = box(0.54, 0.6, 0.34, [0, -0.06, 0])
const PUFFER_COLLAR = cylinder(0.13, 0.13, 8, [0, 0.27, 0])
const TORSO_ATHLEISURE = box(0.42, 0.46, 0.24, [0, -0.01, 0])
const BLAZER_SHOULDER_PAD = box(0.6, 0.24, 0.31, [0, 0.16, 0])
const SLEEVE_UPPER = cylinder(0.075, 0.3, 6, [0, -0.15, 0])
const SLEEVE_LOWER = cylinder(0.065, 0.26, 6, [0, -0.13, 0])
const TURTLENECK_BODY = cylinder(0.175, 0.46, 8, [0, -0.01, 0])
const TURTLENECK_COLLAR = cylinder(0.085, 0.12, 8, [0, 0.27, 0])
const APRON_FRONT = box(0.36, 0.44, 0.03, [0, -0.06, 0.15])

/* Skirts and dresses ------------------------------------------------------ */

const DRESS_SHIFT = taperedCylinder(0.25, 0.185, 0.66, 10, [0, 0.05, 0])
const DRESS_HOUSE = taperedCylinder(0.26, 0.19, 0.6, 10, [0, 0.03, 0])
const SKIRT_ALINE = taperedCylinder(0.28, 0.19, 0.46, 10, [0, -0.23, 0])
const SKIRT_PENCIL = taperedCylinder(0.21, 0.19, 0.44, 10, [0, -0.22, 0])
const SKIRT_MINI = taperedCylinder(0.24, 0.19, 0.28, 10, [0, -0.14, 0])

/* Trousers and legs ------------------------------------------------------- */

const TROUSER_HIP = box(0.36, 0.28, 0.26, [0, -0.03, 0])
const TROUSER_THIGH = cylinder(0.095, 0.42, 6, [0, -0.2, 0])
const TROUSER_SHIN = cylinder(0.085, 0.4, 6, [0, -0.19, 0])
const JEANS_THIGH = cylinder(0.1, 0.42, 6, [0, -0.2, 0])
const JEANS_SHIN = cylinder(0.092, 0.4, 6, [0, -0.19, 0])
const CARGO_THIGH = cylinder(0.115, 0.42, 6, [0, -0.2, 0])
const CARGO_SHIN = cylinder(0.108, 0.4, 6, [0, -0.19, 0])
const TRACK_THIGH = cylinder(0.115, 0.43, 6, [0, -0.2, 0])
const TRACK_SHIN = cylinder(0.105, 0.4, 6, [0, -0.19, 0])
const LEGGING_THIGH = cylinder(0.068, 0.42, 6, [0, -0.2, 0])
const LEGGING_SHIN = cylinder(0.058, 0.4, 6, [0, -0.19, 0])
const SHOE_LEATHER = box(0.11, 0.09, 0.28, [0, 0.045, 0.06])
const SHOE_HEEL = box(0.1, 0.15, 0.24, [0, 0.075, 0.05])
const SHOE_SNEAKER = box(0.12, 0.11, 0.29, [0, 0.055, 0.06])
const BOOT_WORK = box(0.12, 0.2, 0.3, [0, 0.1, 0.05])
const BOOT_TALL = box(0.11, 0.28, 0.22, [0, 0.14, 0.03])

/* Hair ------------------------------------------------------------------- */

const HAIR_SHORT_BACK = sphere(0.235, 0.18, 0.245, [0, 0.09, 0])
const HAIR_CREW = sphere(0.23, 0.15, 0.24, [0, 0.1, 0])
const HAIR_SIDE_PART = sphere(0.24, 0.17, 0.25, [0.01, 0.1, 0])
const HAIR_PIN_CURLS = sphere(0.25, 0.2, 0.25, [0, 0.06, -0.01])
const HAIR_WAVE_SET = sphere(0.255, 0.21, 0.26, [0, 0.07, -0.01])
const HAIR_BEEHIVE = sphere(0.26, 0.34, 0.26, [0, 0.22, -0.02])
const HAIR_FLIP_BOUFFANT = sphere(0.27, 0.24, 0.26, [0, 0.13, -0.01])
const HAIR_BOUFFANT = sphere(0.265, 0.22, 0.255, [0, 0.11, -0.01])
const HAIR_MOP = sphere(0.28, 0.22, 0.28, [0, 0.07, -0.01])
const HAIR_MULLET = sphere(0.245, 0.18, 0.28, [0, 0.08, -0.03])
const HAIR_JHERI = sphere(0.27, 0.25, 0.3, [0, 0.09, -0.04])
const HAIR_MOHAWK = box(0.06, 0.24, 0.26, [0, 0.2, 0])
const HAIR_POWER_BOB = sphere(0.27, 0.24, 0.26, [0, 0.06, -0.02])
const HAIR_PERM = sphere(0.28, 0.23, 0.28, [0, 0.08, -0.01])
const HAIR_FLAT_TOP = box(0.22, 0.16, 0.23, [0, 0.14, 0])
const HAIR_BUZZ = sphere(0.225, 0.12, 0.235, [0, 0.11, 0])
const HAIR_SPIKY = sphere(0.25, 0.2, 0.26, [0, 0.11, -0.01])
const HAIR_SHORT_CROP = sphere(0.24, 0.18, 0.25, [0, 0.1, -0.01])
const HAIR_PONYTAIL = sphere(0.235, 0.18, 0.245, [0, 0.09, -0.01])
const HAIR_BUN = sphere(0.235, 0.17, 0.25, [0, 0.1, -0.02])
const HAIR_MESSY_BUN = sphere(0.245, 0.19, 0.26, [0, 0.1, -0.03])
const HAIR_SLEEK_BOB = sphere(0.25, 0.23, 0.25, [0, 0.06, -0.01])

/* Headwear ---------------------------------------------------------------- */

const HAT_FEDORA_CROWN = taperedCylinder(0.135, 0.115, 0.14, 8, [0, 0.17, 0])
const HAT_FEDORA_BRIM = torus(0.2, 0.02, 8, [0, 0.1, 0], [Math.PI / 2, 0, 0])
const HAT_FLAT_CAP = sphere(0.25, 0.1, 0.26, [0, 0.12, 0])
const HAT_HEADSCARF = sphere(0.27, 0.24, 0.27, [0, 0.03, -0.01])
const HAT_GARRISON = taperedCylinder(0.125, 0.12, 0.09, 8, [0, 0.14, 0])
const HAT_PILLBOX = cylinder(0.105, 0.09, 8, [0, 0.17, 0])
const HAT_HEADBAND = torus(0.145, 0.022, 8, [0, 0.1, 0], [Math.PI / 2, 0, 0])
const HAT_PEAKED_CROWN = taperedCylinder(0.13, 0.12, 0.1, 8, [0, 0.14, 0])
const HAT_PEAKED_PEAK = box(0.24, 0.03, 0.11, [0, 0.09, 0.16])
const HAT_BASEBALL_CROWN = sphere(0.25, 0.14, 0.27, [0, 0.13, 0.01])
const HAT_BASEBALL_PEAK = box(0.23, 0.03, 0.11, [0, 0.09, 0.16])
const HAT_BEANIE = sphere(0.245, 0.19, 0.25, [0, 0.12, 0])
const HAT_BUCKET_CROWN = taperedCylinder(0.16, 0.13, 0.13, 8, [0, 0.14, 0])
const HAT_BUCKET_BRIM = torus(0.195, 0.022, 8, [0, 0.08, 0], [Math.PI / 2, 0, 0])
const HAT_HELMET_SHELL = sphere(0.27, 0.25, 0.29, [0, 0.1, 0])
const HAT_HELMET_VISOR = box(0.2, 0.03, 0.12, [0, 0.06, 0.17])
const HAT_SUN_VISOR = box(0.22, 0.03, 0.1, [0, 0.12, 0.16])

/* Accessories ------------------------------------------------------------- */

const ACC_GLASSES_FRAME = box(0.16, 0.035, 0.05, [0, 0.02, 0.13])
const ACC_SUNGLASSES_FRAME = box(0.17, 0.07, 0.06, [0, 0.02, 0.13])
const ACC_SCARF_COLLAR = torus(0.115, 0.035, 8, [0, 0.3, 0], [Math.PI / 2, 0, 0])
const ACC_SCARF_TAIL = box(0.11, 0.34, 0.06, [0.07, 0.06, 0.14])
const ACC_BACKPACK = box(0.3, 0.38, 0.16, [0, -0.04, -0.2])
const ACC_HANDBAG = box(0.22, 0.2, 0.1, [0.04, -0.26, 0.02])
const ACC_SATCHEL = box(0.26, 0.22, 0.09, [0.16, -0.1, 0.1])
const ACC_BROOCH = sphere(0.05, 0.05, 0.03, [0.13, 0.1, 0.14])
const ACC_BELT = torus(0.175, 0.02, 8, [0, -0.16, 0], [Math.PI / 2, 0, 0])
const ACC_WATCH = box(0.05, 0.02, 0.05, [0.03, -0.06, 0])
const ACC_HEADPHONES = torus(0.145, 0.025, 8, [0, 0.1, 0])
const ACC_EARBUD_L = sphere(0.05, 0.05, 0.05, [-0.11, 0.0, 0.02])
const ACC_MASK = box(0.14, 0.11, 0.05, [0, -0.02, 0.13])
const ACC_LANYARD = box(0.03, 0.3, 0.02, [0, 0.08, 0.13])

/* Carried props ----------------------------------------------------------- */

const PROP_NEWSPAPER = box(0.22, 0.3, 0.03, [0, -0.18, 0.06], [0.35, 0, 0])
const PROP_UMBRELLA = taperedCylinder(0.06, 0.02, 0.9, 8, [0.02, -0.16, 0.02])
const PROP_BASKET = box(0.24, 0.2, 0.16, [0, -0.24, 0.02])
const PROP_RATION_BOOK = box(0.11, 0.15, 0.02, [0, -0.14, 0.05])
const PROP_BRIEFCASE = box(0.34, 0.26, 0.1, [0, -0.28, 0.02])
const PROP_SATCHEL_BAG = box(0.3, 0.24, 0.12, [0, -0.26, 0.02])
const PROP_SODA_CUP = cylinder(0.04, 0.14, 6, [0, -0.12, 0.12])
const PROP_BOOMBOX = box(0.36, 0.22, 0.14, [0.26, 0.02, 0.08])
const PROP_WALKMAN = box(0.11, 0.15, 0.03, [0, -0.12, 0.06])
const PROP_SKATEBOARD = box(0.2, 0.62, 0.08, [0.06, -0.34, 0.04])
const PROP_BRICK_PHONE = box(0.09, 0.2, 0.05, [0, -0.16, 0.08])
const PROP_FLIP_PHONE = box(0.07, 0.12, 0.02, [0, -0.14, 0.08])
const PROP_PHONE = box(0.075, 0.15, 0.015, [0, -0.16, 0.1])
const PROP_COFFEE_CUP = cylinder(0.035, 0.12, 6, [0, -0.11, 0.13])
const PROP_GROCERY_BAG = box(0.22, 0.28, 0.15, [0, -0.3, 0.02])
const PROP_TEXTBOOK = box(0.2, 0.26, 0.05, [0, -0.2, 0.06])
const PROP_LAPTOP_SLEEVE = box(0.3, 0.24, 0.04, [0, -0.24, 0.04])
const PROP_DELIVERY_BAG = box(0.38, 0.34, 0.24, [0, -0.06, -0.24])

/* ------------------------------------------------------------------------- *
 * Ageing colours
 * ------------------------------------------------------------------------- */

const LEATHER_DARK = '#3b2a1c'
const LEATHER_BROWN = '#6b4a2c'
const BLACK = '#1b1b1f'
const CHARCOAL = '#2b2f36'
const CREAM = '#e9e2d2'
const WHITE = '#f4f4f2'
const SLATE = '#6b7078'
const SILVER = '#c9ccd1'
const DENIM_INDIGO = '#2f4a75'
const DENIM_LIGHT = '#8fa8c8'
const NEON_PINK = '#e8447a'
const NEON_CYAN = '#31e0d8'
const NEON_LIME = '#b6e82a'
const OLIVE = '#4d5a3a'
const STEEL = '#8e8e93'

/* Hair colours ------------------------------------------------------------ */

const HAIR_BLACK = '#181310'
const HAIR_DARK_BROWN = '#392b1f'
const HAIR_BROWN = '#5a4029'
const HAIR_AUBURN = '#7c3f22'
const HAIR_BLOND = '#c6a05c'
const HAIR_PLATINUM = '#e6dcbb'
const HAIR_GREY = '#9c9891'
const HAIR_PUNK = '#e8447a'
const HAIR_DYE_CYAN = '#3fc9d6'
const HAIR_DYE_COPPER = '#b4552a'

/* ------------------------------------------------------------------------- *
 * Shape helpers
 * ------------------------------------------------------------------------- */

function piece(
  id: string,
  slot: GarmentSlot,
  part: PartId,
  shape: PrimitiveShape,
  colour: ColourRef,
): GarmentPiece {
  return { id, slot, part, shape, colour }
}

/** A pair of trouser legs: both thighs and both shins, mirrored parts. */
function trouserLegs(
  prefix: string,
  thighShape: PrimitiveShape,
  shinShape: PrimitiveShape,
  colour: ColourRef,
): GarmentPiece[] {
  return [
    piece(`${prefix}-thigh-l`, 'bottom', 'thighL', thighShape, colour),
    piece(`${prefix}-thigh-r`, 'bottom', 'thighR', thighShape, colour),
    piece(`${prefix}-shin-l`, 'bottom', 'shinL', shinShape, colour),
    piece(`${prefix}-shin-r`, 'bottom', 'shinR', shinShape, colour),
  ]
}

/** A pair of sleeves on both upper arms and both forearms. */
function sleeves(
  prefix: string,
  slot: GarmentSlot,
  upperShape: PrimitiveShape,
  lowerShape: PrimitiveShape,
  colour: ColourRef,
): GarmentPiece[] {
  return [
    piece(`${prefix}-sleeve-u-l`, slot, 'upperArmL', upperShape, colour),
    piece(`${prefix}-sleeve-u-r`, slot, 'upperArmR', upperShape, colour),
    piece(`${prefix}-sleeve-l-l`, slot, 'forearmL', lowerShape, colour),
    piece(`${prefix}-sleeve-l-r`, slot, 'forearmR', lowerShape, colour),
  ]
}

/** A pair of shoes or boots. */
function shoes(
  prefix: string,
  shape: PrimitiveShape,
  colour: ColourRef,
  slot: GarmentSlot = 'footwear',
): GarmentPiece[] {
  return [
    piece(`${prefix}-foot-l`, slot, 'footL', shape, colour),
    piece(`${prefix}-foot-r`, slot, 'footR', shape, colour),
  ]
}

function hair(id: string, label: string, shape: PrimitiveShape, colour: string): HairStyle {
  return { id, label, shape, colour }
}

function item(
  id: string,
  label: string,
  part: PartId,
  shape: PrimitiveShape,
  colour: ColourRef,
): OutfitItem {
  return { id, label, part, shape, colour }
}

function outfit(
  key: string,
  label: string,
  build: OutfitSet['build'],
  layers: readonly GarmentPiece[],
  hairIds: readonly string[],
  headwearIds: readonly string[],
  accessoryIds: readonly string[],
  propIds: readonly string[],
): OutfitSet {
  return { key, label, build, layers, hairIds, headwearIds, accessoryIds, propIds }
}

/* ------------------------------------------------------------------------- *
 * Era 1945 — postwar recovery
 * ------------------------------------------------------------------------- */

const HAIR_1945: readonly HairStyle[] = [
  hair('short-back-and-sides', 'Short back and sides', HAIR_SHORT_BACK, HAIR_DARK_BROWN),
  hair('regulation-crop', 'Regulation crop', HAIR_CREW, HAIR_BLACK),
  hair('pinned-curls', 'Pinned curls', HAIR_PIN_CURLS, HAIR_BROWN),
  hair('wave-set', 'Waved set', HAIR_WAVE_SET, HAIR_AUBURN),
  hair('greying-side-part', 'Greying side part', HAIR_SIDE_PART, HAIR_GREY),
]

const HEADWEAR_1945: readonly OutfitItem[] = [
  item('flat-cap', 'Flat cap', 'head', HAT_FLAT_CAP, 1),
  item('fedora', 'Fedora', 'head', HAT_FEDORA_CROWN, 0),
  item('headscarf', 'Headscarf', 'head', HAT_HEADSCARF, 2),
  item('garrison-cap', 'Garrison cap', 'head', HAT_GARRISON, 3),
]

const ACCESSORIES_1945: readonly OutfitItem[] = [
  item('wool-scarf', 'Wool scarf', 'torso', ACC_SCARF_COLLAR, 4),
  item('satchel', 'Satchel', 'torso', ACC_SATCHEL, LEATHER_BROWN),
  item('brooch', 'Brooch', 'torso', ACC_BROOCH, SILVER),
  item('spectacles', 'Spectacles', 'head', ACC_GLASSES_FRAME, CHARCOAL),
  item('ration-belt', 'Utility belt', 'hips', ACC_BELT, LEATHER_DARK),
]

const PROPS_1945: readonly OutfitItem[] = [
  item('newspaper', 'Folded newspaper', 'handR', PROP_NEWSPAPER, CREAM),
  item('umbrella', 'Furled umbrella', 'handR', PROP_UMBRELLA, BLACK),
  item('shopping-basket', 'Shopping basket', 'handL', PROP_BASKET, LEATHER_BROWN),
  item('ration-book', 'Ration book', 'handL', PROP_RATION_BOOK, CREAM),
  item('briefcase', 'Leather briefcase', 'handR', PROP_BRIEFCASE, LEATHER_BROWN),
]

const OUTFITS_1945: readonly OutfitSet[] = [
  outfit(
    'worker-overcoat',
    'Worker in a wool overcoat',
    'regular',
    [
      piece('shirt-1945', 'underlayer', 'torso', TORSO_SHIRT, 5),
      piece('hip-1945-worker', 'bottom', 'hips', TROUSER_HIP, 0),
      ...trouserLegs('worker-trousers-1945', TROUSER_THIGH, TROUSER_SHIN, 0),
      ...shoes('worker-boots-1945', BOOT_WORK, LEATHER_BROWN),
      piece('overcoat-1945', 'outerwear', 'torso', TORSO_COAT, 1),
      piece('overcoat-collar-1945', 'outerwear', 'torso', COAT_COLLAR, 1),
      piece('overcoat-lapel-l-1945', 'outerwear', 'torso', COAT_LAPEL, 1),
      piece('overcoat-lapel-r-1945', 'outerwear', 'torso', COAT_LAPEL_R, 1),
      ...sleeves('overcoat-1945', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 1),
    ],
    ['short-back-and-sides', 'greying-side-part'],
    ['flat-cap', 'fedora'],
    ['wool-scarf', 'ration-belt'],
    ['newspaper', 'briefcase', 'umbrella'],
  ),
  outfit(
    'ration-shopper',
    'Ration shopper',
    'regular',
    [
      piece('blouse-1945', 'top', 'torso', TORSO_BLOUSE, 5),
      piece('skirt-1945', 'bottom', 'hips', SKIRT_ALINE, 2),
      ...trouserLegs('stockings-1945', LEGGING_THIGH, LEGGING_SHIN, SLATE),
      ...shoes('shopper-shoes-1945', SHOE_HEEL, LEATHER_DARK),
      piece('cardigan-1945', 'outerwear', 'torso', TORSO_CARDIGAN, 2),
      ...sleeves('cardigan-1945', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 2),
    ],
    ['pinned-curls', 'wave-set'],
    ['headscarf', 'flat-cap'],
    ['wool-scarf', 'brooch'],
    ['shopping-basket', 'ration-book'],
  ),
  outfit(
    'newsboy-cap',
    'Boy in a newsboy cap',
    'slim',
    [
      piece('shirt-newsboy-1945', 'underlayer', 'torso', TORSO_SHIRT, 5),
      piece('hip-newsboy-1945', 'bottom', 'hips', TROUSER_HIP, 0),
      ...trouserLegs('newsboy-trousers-1945', TROUSER_THIGH, TROUSER_SHIN, 0),
      ...shoes('newsboy-boots-1945', SHOE_LEATHER, LEATHER_DARK),
      piece('jacket-newsboy-1945', 'outerwear', 'torso', TORSO_JACKET, 2),
      piece('jacket-collar-newsboy-1945', 'outerwear', 'torso', JACKET_COLLAR, 2),
      ...sleeves('jacket-newsboy-1945', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 2),
    ],
    ['regulation-crop', 'short-back-and-sides'],
    ['flat-cap'],
    ['satchel', 'spectacles'],
    ['newspaper'],
  ),
  outfit(
    'homemaker-dress',
    'Homemaker in a housedress',
    'regular',
    [
      piece('housedress-1945', 'dress', 'hips', DRESS_HOUSE, 2),
      piece('housedress-bodice-1945', 'top', 'torso', TORSO_BLOUSE, 5),
      ...trouserLegs('housedress-stockings-1945', LEGGING_THIGH, LEGGING_SHIN, SLATE),
      ...shoes('homemaker-shoes-1945', SHOE_HEEL, LEATHER_DARK),
      piece('apron-1945', 'accessory', 'torso', APRON_FRONT, 5),
      piece('housedress-collar-1945', 'top', 'torso', JACKET_COLLAR, 5),
    ],
    ['pinned-curls', 'wave-set', 'greying-side-part'],
    ['headscarf'],
    ['brooch', 'wool-scarf'],
    ['shopping-basket', 'ration-book'],
  ),
  outfit(
    'returning-soldier',
    'Returning soldier',
    'broad',
    [
      piece('tunic-1945', 'outerwear', 'torso', TORSO_TUNIC, 3),
      piece('hip-1945', 'bottom', 'hips', TROUSER_HIP, 3),
      ...trouserLegs('service-trousers-1945', TROUSER_THIGH, TROUSER_SHIN, 3),
      ...shoes('service-boots-1945', BOOT_WORK, LEATHER_DARK),
      ...sleeves('tunic-1945', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('service-belt-1945', 'accessory', 'hips', ACC_BELT, LEATHER_DARK),
      piece('fedora-crown-1945', 'headwear', 'head', HAT_FEDORA_CROWN, 1),
      piece('fedora-brim-1945', 'headwear', 'head', HAT_FEDORA_BRIM, 1),
    ],
    ['regulation-crop', 'short-back-and-sides'],
    ['garrison-cap', 'fedora'],
    ['ration-belt', 'wool-scarf'],
    ['briefcase', 'newspaper'],
  ),
]

const GAIT_1945: GaitProfile = {
  speedMps: 1.05,
  strideLengthM: 0.62,
  cadenceStepsPerMin: 102,
  armSwingRad: 0.28,
  hipSwayRad: 0.36,
  bobM: 0.028,
  leanRad: 0.03,
  posture: 'upright',
}

/* ------------------------------------------------------------------------- *
 * Era 1965 — the clean-cut sixties
 * ------------------------------------------------------------------------- */

const HAIR_1965: readonly HairStyle[] = [
  hair('side-part-slick', 'Slick side part', HAIR_SIDE_PART, HAIR_BLACK),
  hair('sixties-mop', 'Mop top', HAIR_MOP, HAIR_DARK_BROWN),
  hair('beehive', 'Beehive', HAIR_BEEHIVE, HAIR_BLOND),
  hair('flip-bouffant', 'Bouffant flip', HAIR_FLIP_BOUFFANT, HAIR_AUBURN),
  hair('bouffant', 'Teased bouffant', HAIR_BOUFFANT, HAIR_BROWN),
]

const HEADWEAR_1965: readonly OutfitItem[] = [
  item('fedora-1965', 'Narrow-brim fedora', 'head', HAT_FEDORA_CROWN, CHARCOAL),
  item('pillbox-hat', 'Pillbox hat', 'head', HAT_PILLBOX, 1),
  item('headband-1965', 'Wide headband', 'head', HAT_HEADBAND, 2),
  item('peaked-cap-1965', 'Peaked cap', 'head', HAT_PEAKED_CROWN, 0),
  item('bucket-hat-1965', 'Bucket hat', 'head', HAT_BUCKET_CROWN, 3),
]

const ACCESSORIES_1965: readonly OutfitItem[] = [
  item('necktie', 'Slim necktie', 'torso', ACC_SCARF_TAIL, 1),
  item('handbag-1965', 'Structured handbag', 'handR', ACC_HANDBAG, 0),
  item('wayfarers', 'Dark glasses', 'head', ACC_SUNGLASSES_FRAME, BLACK),
  item('wristwatch', 'Wristwatch', 'handR', ACC_WATCH, SILVER),
  item('silk-scarf', 'Silk scarf', 'torso', ACC_SCARF_COLLAR, 2),
]

const PROPS_1965: readonly OutfitItem[] = [
  item('newspaper-1965', 'Broadsheet', 'handR', PROP_NEWSPAPER, WHITE),
  item('briefcase-1965', 'Attaché case', 'handR', PROP_BRIEFCASE, 5),
  item('umbrella-1965', 'Furled umbrella', 'handR', PROP_UMBRELLA, CHARCOAL),
  item('shopping-basket-1965', 'Wire basket', 'handL', PROP_BASKET, SILVER),
  item('soda-cup', 'Soda fountain cup', 'handR', PROP_SODA_CUP, 4),
  item('satchel-1965', 'Satchel', 'handL', PROP_SATCHEL_BAG, LEATHER_BROWN),
]

const OUTFITS_1965: readonly OutfitSet[] = [
  outfit(
    'suit-and-fedora',
    'Slim suit and fedora',
    'slim',
    [
      piece('shirt-1965', 'underlayer', 'torso', TORSO_SHIRT, 4),
      piece('tie-1965', 'accessory', 'torso', ACC_SCARF_TAIL, 1),
      piece('suit-1965', 'outerwear', 'torso', TORSO_SUIT, 0),
      piece('suit-lapel-l-1965', 'outerwear', 'torso', SUIT_LAPEL_L, 0),
      piece('suit-lapel-r-1965', 'outerwear', 'torso', SUIT_LAPEL_R, 0),
      ...sleeves('suit-1965', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      piece('hip-1965-suit', 'bottom', 'hips', TROUSER_HIP, 5),
      ...trouserLegs('suit-trousers-1965', TROUSER_THIGH, TROUSER_SHIN, 5),
      ...shoes('suit-shoes-1965', SHOE_LEATHER, CHARCOAL),
    ],
    ['side-part-slick', 'bouffant'],
    ['fedora-1965', 'peaked-cap-1965'],
    ['wristwatch', 'wayfarers'],
    ['newspaper-1965', 'briefcase-1965', 'umbrella-1965'],
  ),
  outfit(
    'shift-dress',
    'Shift dress',
    'slim',
    [
      piece('shift-1965', 'dress', 'hips', DRESS_SHIFT, 1),
      piece('shift-collar-1965', 'dress', 'torso', JACKET_COLLAR, 1),
      ...trouserLegs('shift-tights-1965', LEGGING_THIGH, LEGGING_SHIN, 4),
      ...shoes('shift-heels-1965', SHOE_HEEL, 0),
      piece('shift-belt-1965', 'accessory', 'hips', ACC_BELT, 4),
    ],
    ['beehive', 'flip-bouffant', 'bouffant'],
    ['pillbox-hat', 'headband-1965'],
    ['handbag-1965', 'wayfarers'],
    ['shopping-basket-1965', 'soda-cup'],
  ),
  outfit(
    'turtleneck-beatnik',
    'Beatnik in a turtleneck',
    'slim',
    [
      piece('turtleneck-1965', 'top', 'torso', TURTLENECK_BODY, 0),
      piece('turtleneck-collar-1965', 'top', 'torso', TURTLENECK_COLLAR, 0),
      piece('hip-1965-beatnik', 'bottom', 'hips', TROUSER_HIP, 5),
      ...trouserLegs('beatnik-trousers-1965', TROUSER_THIGH, TROUSER_SHIN, 5),
      ...shoes('beatnik-boots-1965', SHOE_LEATHER, CHARCOAL),
      ...sleeves('beatnik-roll-1965', 'top', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      piece('bucket-crown-1965', 'headwear', 'head', HAT_BUCKET_CROWN, 0),
      piece('bucket-brim-1965', 'headwear', 'head', HAT_BUCKET_BRIM, 0),
    ],
    ['sixties-mop', 'side-part-slick'],
    ['bucket-hat-1965'],
    ['wayfarers', 'silk-scarf'],
    ['satchel-1965', 'newspaper-1965'],
  ),
  outfit(
    'student-cardigan',
    'Student in a cardigan',
    'regular',
    [
      piece('shirt-student-1965', 'underlayer', 'torso', TORSO_SHIRT, 4),
      piece('cardigan-1965', 'outerwear', 'torso', TORSO_CARDIGAN, 3),
      ...sleeves('cardigan-1965', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('mini-1965', 'bottom', 'hips', SKIRT_MINI, 0),
      ...trouserLegs('student-tights-1965', LEGGING_THIGH, LEGGING_SHIN, 4),
      ...shoes('student-shoes-1965', SHOE_HEEL, CHARCOAL),
    ],
    ['flip-bouffant', 'bouffant', 'side-part-slick'],
    ['headband-1965', 'pillbox-hat'],
    ['silk-scarf', 'handbag-1965'],
    ['soda-cup', 'satchel-1965'],
  ),
  outfit(
    'bus-driver-uniform',
    'Bus driver in uniform',
    'broad',
    [
      piece('uniform-tunic-1965', 'outerwear', 'torso', TORSO_TUNIC, 0),
      ...sleeves('uniform-1965', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      piece('uniform-belt-1965', 'accessory', 'hips', ACC_BELT, BLACK),
      piece('hip-1965-driver', 'bottom', 'hips', TROUSER_HIP, 5),
      ...trouserLegs('driver-trousers-1965', TROUSER_THIGH, TROUSER_SHIN, 5),
      ...shoes('driver-shoes-1965', SHOE_LEATHER, BLACK),
      piece('peaked-crown-1965', 'headwear', 'head', HAT_PEAKED_CROWN, 0),
      piece('peaked-peak-1965', 'headwear', 'head', HAT_PEAKED_PEAK, BLACK),
    ],
    ['side-part-slick', 'sixties-mop'],
    ['peaked-cap-1965'],
    ['wristwatch', 'wayfarers'],
    ['soda-cup', 'newspaper-1965'],
  ),
]

const GAIT_1965: GaitProfile = {
  speedMps: 1.3,
  strideLengthM: 0.68,
  cadenceStepsPerMin: 115,
  armSwingRad: 0.42,
  hipSwayRad: 0.4,
  bobM: 0.034,
  leanRad: 0.05,
  posture: 'brisk',
}

/* ------------------------------------------------------------------------- *
 * Era 1985 — neon streetwear and power dressing
 * ------------------------------------------------------------------------- */

const HAIR_1985: readonly HairStyle[] = [
  hair('mullet', 'Mullet', HAIR_MULLET, HAIR_BROWN),
  hair('jheri-curl', 'Jheri curl', HAIR_JHERI, HAIR_BLACK),
  hair('power-bob', 'Power bob', HAIR_POWER_BOB, HAIR_BLOND),
  hair('big-perm', 'Big perm', HAIR_PERM, HAIR_AUBURN),
  hair('flat-top', 'Flat top', HAIR_FLAT_TOP, HAIR_DARK_BROWN),
  hair('mohawk', 'Mohawk', HAIR_MOHAWK, HAIR_PUNK),
]

const HEADWEAR_1985: readonly OutfitItem[] = [
  item('baseball-cap-1985', 'Ball cap', 'head', HAT_BASEBALL_CROWN, 0),
  item('sun-visor-1985', 'Sun visor', 'head', HAT_SUN_VISOR, 1),
  item('headband-1985', 'Sweatband', 'head', HAT_HEADBAND, 3),
  item('bucket-hat-1985', 'Bucket hat', 'head', HAT_BUCKET_CROWN, 4),
]

const ACCESSORIES_1985: readonly OutfitItem[] = [
  item('headphones-1985', 'Headphones', 'head', ACC_HEADPHONES, BLACK),
  item('shoulder-pad-flex', 'Padded shoulders', 'torso', BLAZER_SHOULDER_PAD, 3),
  item('studded-belt', 'Studded belt', 'hips', ACC_BELT, BLACK),
  item('designer-shades', 'Designer shades', 'head', ACC_SUNGLASSES_FRAME, 1),
  item('tote-bag', 'Canvas tote', 'handR', ACC_HANDBAG, 2),
]

const PROPS_1985: readonly OutfitItem[] = [
  item('boombox', 'Boombox', 'torso', PROP_BOOMBOX, CHARCOAL),
  item('walkman', 'Walkman', 'handR', PROP_WALKMAN, SILVER),
  item('brick-phone', 'Brick phone', 'handR', PROP_BRICK_PHONE, BLACK),
  item('skateboard', 'Skateboard', 'handR', PROP_SKATEBOARD, 0),
  item('gym-bag', 'Gym bag', 'handL', PROP_SATCHEL_BAG, 3),
]

const OUTFITS_1985: readonly OutfitSet[] = [
  outfit(
    'denim-jacket',
    'Denim jacket and sneakers',
    'regular',
    [
      piece('tee-1985', 'underlayer', 'torso', TORSO_SHIRT, 2),
      piece('denim-1985', 'outerwear', 'torso', TORSO_JACKET, DENIM_LIGHT),
      piece('denim-collar-1985', 'outerwear', 'torso', JACKET_COLLAR, DENIM_LIGHT),
      ...sleeves('denim-1985', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, DENIM_LIGHT),
      piece('hip-1985-denim', 'bottom', 'hips', TROUSER_HIP, DENIM_INDIGO),
      ...trouserLegs('jeans-1985', JEANS_THIGH, JEANS_SHIN, DENIM_INDIGO),
      ...shoes('denim-sneakers-1985', SHOE_SNEAKER, WHITE),
      piece('cap-1985', 'headwear', 'head', HAT_BASEBALL_CROWN, 0),
      piece('cap-peak-1985', 'headwear', 'head', HAT_BASEBALL_PEAK, 0),
    ],
    ['mullet', 'power-bob'],
    ['baseball-cap-1985'],
    ['designer-shades', 'studded-belt'],
    ['boombox', 'skateboard'],
  ),
  outfit(
    'tracksuit',
    'Tracksuit',
    'regular',
    [
      piece('tracksuit-1985', 'outerwear', 'torso', TORSO_TRACKSUIT, 3),
      piece('tracksuit-collar-1985', 'outerwear', 'torso', TRACKSUIT_COLLAR, 0),
      ...sleeves('tracksuit-1985', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      ...trouserLegs('tracksuit-legs-1985', TRACK_THIGH, TRACK_SHIN, 0),
      ...shoes('tracksuit-trainers-1985', SHOE_SNEAKER, WHITE),
      piece('tracksuit-band-1985', 'accessory', 'hips', ACC_BELT, 3),
    ],
    ['flat-top', 'jheri-curl', 'mullet'],
    ['headband-1985', 'baseball-cap-1985'],
    ['headphones-1985', 'studded-belt'],
    ['boombox', 'walkman'],
  ),
  outfit(
    'shoulder-pad-blazer',
    'Shoulder-padded power suit',
    'broad',
    [
      piece('power-blouse-1985', 'underlayer', 'torso', TORSO_SHIRT, 2),
      piece('power-jacket-1985', 'outerwear', 'torso', TORSO_SUIT, 3),
      piece('power-pad-1985', 'outerwear', 'torso', BLAZER_SHOULDER_PAD, 0),
      piece('power-lapel-l-1985', 'outerwear', 'torso', SUIT_LAPEL_L, 3),
      piece('power-lapel-r-1985', 'outerwear', 'torso', SUIT_LAPEL_R, 3),
      ...sleeves('power-1985', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('power-skirt-1985', 'bottom', 'hips', SKIRT_PENCIL, 3),
      ...trouserLegs('power-tights-1985', LEGGING_THIGH, LEGGING_SHIN, 1),
      ...shoes('power-heels-1985', SHOE_HEEL, BLACK),
    ],
    ['big-perm', 'power-bob', 'jheri-curl'],
    ['bucket-hat-1985'],
    ['shoulder-pad-flex', 'designer-shades', 'tote-bag'],
    ['brick-phone', 'gym-bag'],
  ),
  outfit(
    'punk-mohawk',
    'Punk with a mohawk',
    'slim',
    [
      piece('band-tee-1985', 'underlayer', 'torso', TORSO_SHIRT, BLACK),
      piece('leather-1985', 'outerwear', 'torso', TORSO_JACKET, BLACK),
      ...sleeves('leather-1985', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, BLACK),
      piece('hip-1985-punk', 'bottom', 'hips', TROUSER_HIP, BLACK),
      ...trouserLegs('punk-jeans-1985', JEANS_THIGH, JEANS_SHIN, BLACK),
      ...shoes('punk-boots-1985', BOOT_TALL, BLACK),
      piece('punk-belt-1985', 'accessory', 'hips', ACC_BELT, 1),
    ],
    ['mohawk', 'mullet'],
    ['headband-1985'],
    ['studded-belt', 'headphones-1985'],
    ['walkman', 'skateboard'],
  ),
  outfit(
    'boom-box-carrier',
    'Boombox carrier',
    'broad',
    [
      piece('hoodie-1985', 'outerwear', 'torso', TORSO_HOODIE, 3),
      piece('hood-1985', 'outerwear', 'head', HOODIE_HOOD, 3),
      ...sleeves('hoodie-1985', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('hip-1985-carrier', 'bottom', 'hips', TROUSER_HIP, DENIM_INDIGO),
      ...trouserLegs('carrier-jeans-1985', JEANS_THIGH, JEANS_SHIN, DENIM_INDIGO),
      ...shoes('carrier-sneakers-1985', SHOE_SNEAKER, WHITE),
    ],
    ['jheri-curl', 'big-perm', 'flat-top'],
    ['baseball-cap-1985', 'sun-visor-1985'],
    ['headphones-1985', 'tote-bag'],
    ['boombox', 'walkman', 'brick-phone'],
  ),
]

const GAIT_1985: GaitProfile = {
  speedMps: 1.18,
  strideLengthM: 0.66,
  cadenceStepsPerMin: 107,
  armSwingRad: 0.5,
  hipSwayRad: 0.44,
  bobM: 0.04,
  leanRad: 0.04,
  posture: 'relaxed',
}

/* ------------------------------------------------------------------------- *
 * Era 2005 — hoodies, cargo pants and flip phones
 * ------------------------------------------------------------------------- */

const HAIR_2005: readonly HairStyle[] = [
  hair('short-crop-2005', 'Short crop', HAIR_SHORT_CROP, HAIR_DARK_BROWN),
  hair('spiky-2005', 'Spiky crop', HAIR_SPIKY, HAIR_BROWN),
  hair('buzz-2005', 'Buzz cut', HAIR_BUZZ, HAIR_BLACK),
  hair('ponytail-2005', 'Ponytail', HAIR_PONYTAIL, HAIR_BLOND),
  hair('messy-bun-2005', 'Messy bun', HAIR_MESSY_BUN, HAIR_AUBURN),
]

const HEADWEAR_2005: readonly OutfitItem[] = [
  item('baseball-cap-2005', 'Ball cap', 'head', HAT_BASEBALL_CROWN, 0),
  item('beanie-2005', 'Knit beanie', 'head', HAT_BEANIE, 1),
  item('bucket-hat-2005', 'Bucket hat', 'head', HAT_BUCKET_CROWN, 3),
]

const ACCESSORIES_2005: readonly OutfitItem[] = [
  item('backpack-2005', 'Backpack', 'torso', ACC_BACKPACK, 0),
  item('earbuds-2005', 'Earbuds', 'head', ACC_EARBUD_L, WHITE),
  item('wristwatch-2005', 'Wristwatch', 'handR', ACC_WATCH, SILVER),
  item('sunglasses-2005', 'Sunglasses', 'head', ACC_SUNGLASSES_FRAME, BLACK),
  item('apron-2005', 'Work apron', 'torso', APRON_FRONT, 3),
]

const PROPS_2005: readonly OutfitItem[] = [
  item('flip-phone', 'Flip phone', 'handR', PROP_FLIP_PHONE, SILVER),
  item('coffee-cup', 'Coffee cup', 'handR', PROP_COFFEE_CUP, CREAM),
  item('shopping-basket-2005', 'Shopping basket', 'handL', PROP_BASKET, 0),
  item('textbook', 'Textbook', 'handL', PROP_TEXTBOOK, 2),
  item('laptop-sleeve', 'Laptop sleeve', 'handR', PROP_LAPTOP_SLEEVE, CHARCOAL),
]

const OUTFITS_2005: readonly OutfitSet[] = [
  outfit(
    'hoodie-and-jeans',
    'Hoodie and jeans',
    'regular',
    [
      piece('tee-2005', 'underlayer', 'torso', TORSO_SHIRT, 2),
      piece('hoodie-2005', 'outerwear', 'torso', TORSO_HOODIE, 3),
      piece('hood-2005', 'outerwear', 'head', HOODIE_HOOD, 3),
      ...sleeves('hoodie-2005', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('hip-2005-hoodie', 'bottom', 'hips', TROUSER_HIP, 6),
      ...trouserLegs('jeans-2005', JEANS_THIGH, JEANS_SHIN, 6),
      ...shoes('hoodie-sneakers-2005', SHOE_SNEAKER, WHITE),
    ],
    ['short-crop-2005', 'spiky-2005'],
    ['baseball-cap-2005'],
    ['earbuds-2005', 'backpack-2005'],
    ['flip-phone', 'coffee-cup'],
  ),
  outfit(
    'business-casual',
    'Business casual',
    'regular',
    [
      piece('shirt-2005', 'underlayer', 'torso', TORSO_SHIRT, 1),
      piece('jacket-2005', 'outerwear', 'torso', TORSO_JACKET, 0),
      piece('jacket-collar-2005', 'outerwear', 'torso', JACKET_COLLAR, 0),
      ...sleeves('jacket-2005', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      piece('hip-2005', 'bottom', 'hips', TROUSER_HIP, 8),
      ...trouserLegs('office-trousers-2005', TROUSER_THIGH, TROUSER_SHIN, 8),
      ...shoes('office-shoes-2005', SHOE_LEATHER, CHARCOAL),
    ],
    ['short-crop-2005', 'ponytail-2005'],
    ['bucket-hat-2005'],
    ['wristwatch-2005', 'sunglasses-2005'],
    ['laptop-sleeve', 'coffee-cup'],
  ),
  outfit(
    'puffer-jacket',
    'Puffer jacket',
    'broad',
    [
      piece('layer-2005', 'underlayer', 'torso', TORSO_ATHLEISURE, 1),
      piece('puffer-2005', 'outerwear', 'torso', TORSO_PUFFER, 4),
      piece('puffer-collar-2005', 'outerwear', 'torso', PUFFER_COLLAR, 4),
      ...sleeves('puffer-2005', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 4),
      ...trouserLegs('cargo-2005', CARGO_THIGH, CARGO_SHIN, 3),
      ...shoes('puffer-sneakers-2005', SHOE_SNEAKER, CHARCOAL),
    ],
    ['buzz-2005', 'short-crop-2005'],
    ['beanie-2005', 'baseball-cap-2005'],
    ['earbuds-2005', 'wristwatch-2005'],
    ['flip-phone', 'shopping-basket-2005'],
  ),
  outfit(
    'school-backpack',
    'Student with a backpack',
    'slim',
    [
      piece('hoodie-school-2005', 'outerwear', 'torso', TORSO_HOODIE, 2),
      piece('hood-school-2005', 'outerwear', 'head', HOODIE_HOOD, 2),
      ...sleeves('hoodie-school-2005', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 2),
      piece('hip-school-2005', 'bottom', 'hips', TROUSER_HIP, 6),
      ...trouserLegs('school-jeans-2005', JEANS_THIGH, JEANS_SHIN, 6),
      ...shoes('school-sneakers-2005', SHOE_SNEAKER, WHITE),
      piece('backpack-school-2005', 'accessory', 'torso', ACC_BACKPACK, 2),
    ],
    ['ponytail-2005', 'spiky-2005', 'messy-bun-2005'],
    ['baseball-cap-2005'],
    ['backpack-2005', 'earbuds-2005'],
    ['textbook', 'flip-phone'],
  ),
  outfit(
    'barista-apron',
    'Barista in an apron',
    'regular',
    [
      piece('shirt-barista-2005', 'underlayer', 'torso', TORSO_SHIRT, 1),
      piece('apron-barista-2005', 'accessory', 'torso', APRON_FRONT, 3),
      piece('hip-barista-2005', 'bottom', 'hips', TROUSER_HIP, 8),
      ...trouserLegs('barista-trousers-2005', TROUSER_THIGH, TROUSER_SHIN, 8),
      ...shoes('barista-shoes-2005', SHOE_SNEAKER, BLACK),
      ...sleeves('barista-shirt-2005', 'underlayer', SLEEVE_UPPER, SLEEVE_LOWER, 1),
    ],
    ['messy-bun-2005', 'short-crop-2005'],
    ['baseball-cap-2005'],
    ['apron-2005', 'wristwatch-2005'],
    ['coffee-cup', 'shopping-basket-2005'],
  ),
]

const GAIT_2005: GaitProfile = {
  speedMps: 1.32,
  strideLengthM: 0.7,
  cadenceStepsPerMin: 113,
  armSwingRad: 0.4,
  hipSwayRad: 0.42,
  bobM: 0.036,
  leanRad: 0.02,
  posture: 'slouched',
}

/* ------------------------------------------------------------------------- *
 * Era 2025 — athleisure, helmets and masks
 * ------------------------------------------------------------------------- */

const HAIR_2025: readonly HairStyle[] = [
  hair('sleek-bob-2025', 'Sleek bob', HAIR_SLEEK_BOB, HAIR_BLACK),
  hair('short-crop-2025', 'Textured crop', HAIR_SHORT_CROP, HAIR_DARK_BROWN),
  hair('bun-2025', 'Top knot', HAIR_BUN, HAIR_BROWN),
  hair('ponytail-2025', 'High ponytail', HAIR_PONYTAIL, HAIR_PLATINUM),
  hair('dyed-cyan-2025', 'Cyan dye', HAIR_MOP, HAIR_DYE_CYAN),
  hair('copper-crop-2025', 'Copper crop', HAIR_BUZZ, HAIR_DYE_COPPER),
]

const HEADWEAR_2025: readonly OutfitItem[] = [
  item('baseball-cap-2025', 'Tech cap', 'head', HAT_BASEBALL_CROWN, 0),
  item('beanie-2025', 'Ribbed beanie', 'head', HAT_BEANIE, 4),
  item('bike-helmet', 'Bike helmet', 'head', HAT_HELMET_SHELL, CHARCOAL),
  item('bucket-hat-2025', 'Bucket hat', 'head', HAT_BUCKET_CROWN, 1),
]

const ACCESSORIES_2025: readonly OutfitItem[] = [
  item('earbuds-2025', 'Wireless earbuds', 'head', ACC_EARBUD_L, WHITE),
  item('crossbody-bag', 'Crossbody bag', 'torso', ACC_HANDBAG, 0),
  item('smartwatch-2025', 'Smartwatch', 'handR', ACC_WATCH, SILVER),
  item('face-mask', 'Face mask', 'head', ACC_MASK, 1),
  item('lanyard-2025', 'Work lanyard', 'torso', ACC_LANYARD, 2),
]

const PROPS_2025: readonly OutfitItem[] = [
  item('phone-2025', 'Phone in hand', 'handR', PROP_PHONE, CHARCOAL),
  item('coffee-cup-2025', 'Reusable coffee cup', 'handR', PROP_COFFEE_CUP, 4),
  item('delivery-bag', 'Courier delivery bag', 'torso', PROP_DELIVERY_BAG, 0),
  item('grocery-bag', 'Grocery bag', 'handL', PROP_GROCERY_BAG, 1),
  item('laptop-sleeve-2025', 'Laptop sleeve', 'handR', PROP_LAPTOP_SLEEVE, CHARCOAL),
]

const OUTFITS_2025: readonly OutfitSet[] = [
  outfit(
    'puffer-mid-layer',
    'Athleisure mid layer',
    'regular',
    [
      piece('base-layer-2025', 'underlayer', 'torso', TORSO_ATHLEISURE, 1),
      piece('jogger-2025', 'bottom', 'hips', TROUSER_HIP, 0),
      ...trouserLegs('jogger-legs-2025', TRACK_THIGH, TRACK_SHIN, 0),
      ...shoes('mid-sneakers-2025', SHOE_SNEAKER, WHITE),
      piece('mid-layer-2025', 'outerwear', 'torso', TORSO_JACKET, 0),
      piece('mid-collar-2025', 'outerwear', 'torso', JACKET_COLLAR, 0),
      ...sleeves('mid-layer-2025', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
    ],
    ['short-crop-2025', 'bun-2025'],
    ['beanie-2025', 'bucket-hat-2025'],
    ['crossbody-bag', 'smartwatch-2025'],
    ['phone-2025', 'coffee-cup-2025'],
  ),
  outfit(
    'athleisure-set',
    'Athleisure set',
    'slim',
    [
      piece('top-athleisure-2025', 'top', 'torso', TORSO_ATHLEISURE, 2),
      ...sleeves('top-athleisure-2025', 'top', SLEEVE_UPPER, SLEEVE_LOWER, 2),
      ...trouserLegs('leggings-2025', LEGGING_THIGH, LEGGING_SHIN, 0),
      ...shoes('athleisure-trainers-2025', SHOE_SNEAKER, 2),
      piece('hip-athleisure-2025', 'bottom', 'hips', TROUSER_HIP, 0),
    ],
    ['ponytail-2025', 'bun-2025', 'sleek-bob-2025'],
    ['baseball-cap-2025'],
    ['earbuds-2025', 'smartwatch-2025', 'face-mask'],
    ['phone-2025', 'coffee-cup-2025'],
  ),
  outfit(
    'delivery-courier',
    'Delivery courier',
    'broad',
    [
      piece('courier-jacket-2025', 'outerwear', 'torso', TORSO_TUNIC, 4),
      piece('courier-jacket-collar-2025', 'outerwear', 'torso', JACKET_COLLAR, 4),
      ...sleeves('courier-2025', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 4),
      piece('hip-courier-2025', 'bottom', 'hips', TROUSER_HIP, 0),
      ...trouserLegs('courier-cargo-2025', CARGO_THIGH, CARGO_SHIN, 0),
      ...shoes('courier-trainers-2025', SHOE_SNEAKER, CHARCOAL),
      piece('courier-helmet-2025', 'headwear', 'head', HAT_HELMET_SHELL, 0),
      piece('courier-visor-2025', 'headwear', 'head', HAT_HELMET_VISOR, CHARCOAL),
    ],
    ['short-crop-2025', 'copper-crop-2025'],
    ['bike-helmet', 'beanie-2025'],
    ['crossbody-bag', 'smartwatch-2025'],
    ['delivery-bag', 'phone-2025'],
  ),
  outfit(
    'student-hoodie',
    'Student in a hoodie',
    'regular',
    [
      piece('hoodie-2025', 'outerwear', 'torso', TORSO_HOODIE, 3),
      piece('hood-2025', 'outerwear', 'head', HOODIE_HOOD, 3),
      ...sleeves('hoodie-2025', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 3),
      piece('hip-hoodie-2025', 'bottom', 'hips', TROUSER_HIP, 3),
      ...trouserLegs('hoodie-cargo-2025', CARGO_THIGH, CARGO_SHIN, 3),
      ...shoes('hoodie-trainers-2025', SHOE_SNEAKER, WHITE),
    ],
    ['dyed-cyan-2025', 'short-crop-2025', 'bun-2025'],
    ['baseball-cap-2025', 'bucket-hat-2025'],
    ['earbuds-2025', 'lanyard-2025'],
    ['phone-2025', 'coffee-cup-2025'],
  ),
  outfit(
    'smart-casual-office',
    'Smart casual office',
    'regular',
    [
      piece('shirt-office-2025', 'underlayer', 'torso', TORSO_SHIRT, 1),
      piece('blazer-office-2025', 'outerwear', 'torso', TORSO_SUIT, 0),
      piece('blazer-lapel-l-2025', 'outerwear', 'torso', SUIT_LAPEL_L, 0),
      piece('blazer-lapel-r-2025', 'outerwear', 'torso', SUIT_LAPEL_R, 0),
      ...sleeves('blazer-office-2025', 'outerwear', SLEEVE_UPPER, SLEEVE_LOWER, 0),
      piece('hip-office-2025', 'bottom', 'hips', TROUSER_HIP, 0),
      ...trouserLegs('office-trousers-2025', TROUSER_THIGH, TROUSER_SHIN, 0),
      ...shoes('office-loafers-2025', SHOE_LEATHER, CHARCOAL),
    ],
    ['sleek-bob-2025', 'short-crop-2025'],
    ['bucket-hat-2025'],
    ['smartwatch-2025', 'lanyard-2025'],
    ['laptop-sleeve-2025', 'phone-2025', 'coffee-cup-2025'],
  ),
]

const GAIT_2025: GaitProfile = {
  speedMps: 1.42,
  strideLengthM: 0.74,
  cadenceStepsPerMin: 115,
  armSwingRad: 0.46,
  hipSwayRad: 0.38,
  bobM: 0.032,
  leanRad: 0.07,
  posture: 'purposeful',
}

/* ------------------------------------------------------------------------- *
 * Table assembly
 * ------------------------------------------------------------------------- */

/**
 * Builds one era's crowd table.
 *
 * `palette` always *starts* with the era registry's `outfitPalette`, so era
 * colour identity flows from the era model, then adds the period's auxiliary
 * colours (leather, denim, the black of a punk jacket) that garments index.
 */
function crowdTable(
  eraId: EraId,
  gait: GaitProfile,
  extras: readonly string[],
  hair: readonly HairStyle[],
  headwear: readonly OutfitItem[],
  accessories: readonly OutfitItem[],
  props: readonly OutfitItem[],
  outfits: readonly OutfitSet[],
): EraCrowdTable {
  const era = getEra(eraId)
  return {
    eraId,
    outfitEraTag: era.population.outfitEraTag,
    label: era.label,
    density: era.population.pedestrianDensity,
    gait,
    palette: [...era.population.outfitPalette, ...extras],
    hair,
    headwear,
    accessories,
    props,
    outfits,
  }
}

/** Every era's pedestrian table, in timeline order. */
export const ERA_CROWD_TABLES: Readonly<Record<EraId, EraCrowdTable>> = {
  '1945': crowdTable(
    '1945',
    GAIT_1945,
    [CREAM, SLATE, LEATHER_DARK, LEATHER_BROWN],
    HAIR_1945,
    HEADWEAR_1945,
    ACCESSORIES_1945,
    PROPS_1945,
    OUTFITS_1945,
  ),
  '1965': crowdTable(
    '1965',
    GAIT_1965,
    [CHARCOAL, SILVER, LEATHER_BROWN, WHITE, BLACK],
    HAIR_1965,
    HEADWEAR_1965,
    ACCESSORIES_1965,
    PROPS_1965,
    OUTFITS_1965,
  ),
  '1985': crowdTable(
    '1985',
    GAIT_1985,
    [DENIM_INDIGO, DENIM_LIGHT, BLACK, WHITE, NEON_LIME, NEON_PINK],
    HAIR_1985,
    HEADWEAR_1985,
    ACCESSORIES_1985,
    PROPS_1985,
    OUTFITS_1985,
  ),
  '2005': crowdTable(
    '2005',
    GAIT_2005,
    [DENIM_LIGHT, WHITE, STEEL, CHARCOAL, OLIVE],
    HAIR_2005,
    HEADWEAR_2005,
    ACCESSORIES_2005,
    PROPS_2005,
    OUTFITS_2005,
  ),
  '2025': crowdTable(
    '2025',
    GAIT_2025,
    [CHARCOAL, STEEL, NEON_CYAN, WHITE, OLIVE],
    HAIR_2025,
    HEADWEAR_2025,
    ACCESSORIES_2025,
    PROPS_2025,
    OUTFITS_2025,
  ),
}

/** Crowd table of one era. */
export function getCrowdTable(eraId: EraId): EraCrowdTable {
  const table = ERA_CROWD_TABLES[eraId]
  if (table === undefined) {
    throw new RangeError(`No pedestrian table for era ${eraId}`)
  }
  return table
}

/** Look of one outfit key inside an era, or `undefined` when the era lacks it. */
export function findOutfit(table: EraCrowdTable, key: string): OutfitSet | undefined {
  return table.outfits.find((candidate) => candidate.key === key)
}

/** Every hair, headwear, accessory and prop id an era pool offers. */
export function tableItemPools(table: EraCrowdTable): {
  readonly hair: readonly HairStyle[]
  readonly headwear: readonly OutfitItem[]
  readonly accessories: readonly OutfitItem[]
  readonly props: readonly OutfitItem[]
} {
  return {
    hair: table.hair,
    headwear: table.headwear,
    accessories: table.accessories,
    props: table.props,
  }
}
