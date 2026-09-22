/**
 * Storefront fronts: one complete shop assembly per layout bay anchor.
 *
 * The layer never creates or moves an anchor. Every unit here is built *from*
 * the bay anchor's declared width, height, position, normal and street, and its
 * fascia board is mounted on the matching `parcel:<id>:sign:<n>` anchor, so a
 * bay can never be left bare and a board can never float: the layout's geometry
 * is authoritative and this module only dresses it.
 *
 * Proportion, material and signage vocabulary all come from the era:
 * {@link buildStorefrontUnits} reads the period table for the shop list, the
 * awning construction, the letterform and the sign technology, the era registry
 * for palette and lighting, and the quality tier for how much detail (mullions,
 * stripes) the bay can afford.
 */

import { anchorsOfKind, v3, type Anchor, type BlockLayout, type Vec3 } from '../layout'
import type { QualityTierName } from '../../lib/quality'
import type { Rng } from '../../lib/rng'
import type { EraDefinition, HexColor } from '../../era'
import { createSignSurface, textureSizeFor, type SignSurfaceRequest } from './signage'
import { signageEmissiveIntensity } from './tables'
import type {
  IlluminationKind,
  ShopType,
  SignSurface,
  StorefrontEraData,
  SignTextLine,
  StorefrontUnit,
} from './types'
import { isIlluminated } from './types'

/** Inputs one front build needs; assembled by the layer barrel. */
export interface FrontBuildOptions {
  readonly era: EraDefinition
  readonly data: StorefrontEraData
  readonly layout: BlockLayout
  readonly tier: QualityTierName
  /** Decoration multiplier from the quality tier (0.45 … 1). */
  readonly detail: number
  readonly night: boolean
  /** Per-era generator, already forked off the layout seed. */
  readonly rng: Rng
}

function at<T>(items: readonly T[], index: number): T {
  const value = items[index % items.length]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Perceived brightness of a `#rrggbb` colour, 0 (black) … 1 (white). */
export function luminance(hex: HexColor): number {
  const normalised = hex.replace('#', '')
  if (normalised.length !== 6) {
    return 0.5
  }
  const red = Number.parseInt(normalised.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalised.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalised.slice(4, 6), 16) / 255
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** Ink of the period that reads on a board of this colour. */
export function inkOn(background: HexColor, data: StorefrontEraData): HexColor {
  return luminance(background) > 0.5 ? data.inkOnLight : data.inkOnDark
}

/** Angle that turns a `+z` facing plane towards the bay's outward normal. */
export function facingRotation(normal: Vec3): number {
  return Math.atan2(normal.x, normal.z)
}

/**
 * Master fascia sign anchor of a bay, when the layout published one.
 *
 * The bay name is `parcel:<id>:storefront:<n>` and its fascia mount is
 * `parcel:<id>:sign:<n>`; the fallback searches the same parcel's fascia mounts
 * by declared width so a renamed scheme still resolves.
 */
export function findFasciaAnchor(
  layout: BlockLayout,
  bayName: string,
  bayWidth: number,
): Anchor | undefined {
  const expected = bayName.replace(':storefront:', ':sign:')
  const direct = layout.anchors.find((anchor) => anchor.name === expected)
  if (direct !== undefined) {
    return direct
  }
  const parcelId = bayName.split(':')[1] ?? ''
  // Fallback: the first ground-floor fascia mount owned by the same parcel.
  return anchorsOfKind(layout, 'sign-mount').find(
    (anchor) =>
      anchor.owner.id === parcelId &&
      anchor.tags.includes('fascia') &&
      anchor.size !== null &&
      Math.abs(anchor.size.width - bayWidth * 0.8) < 0.35,
  )
}

/**
 * Sign technology a bay uses: the era's main one, with period-typical variety.
 *
 * Every fourth shop of a lit era keeps the previous generation's technology — a
 * 1985 block still runs a backlit plastic box on one corner beside its neon, and
 * a 1965 block a few tungsten boxes beside its tubes. Each bay's emissive
 * strength is computed from *its own* technology and the era's lighting, so the
 * mixed-generation shops glow exactly as much as their own hardware and the
 * period's daylight or darkness allow.
 */
function bayIllumination(
  era: EraDefinition,
  data: StorefrontEraData,
  index: number,
  night: boolean,
): { readonly illumination: IlluminationKind; readonly emissive: number } {
  // A period whose signage is painted draws painted boards on every bay: its
  // `secondaryIllumination` describes the interior bulbs behind the glass, not
  // a luminous board, so nothing on a 1945 shopfront emits light of its own.
  if (index % 4 === 3 && isIlluminated(data.illumination)) {
    return {
      illumination: data.secondaryIllumination,
      emissive: signageEmissiveIntensity(era, { night, illumination: data.secondaryIllumination }),
    }
  }
  return {
    illumination: data.illumination,
    emissive: signageEmissiveIntensity(era, { night, illumination: data.illumination }),
  }
}

/** Mullion count a tier can afford: the glazing split is the first detail to go. */
function mullionCount(detail: number, width: number): number {
  if (detail >= 0.7) {
    return clamp(Math.round(width / 2.4), 1, 3)
  }
  if (detail >= 0.4) {
    return 1
  }
  return 0
}

/** Copy set of one bay's fascia board. */
export function shopSignLines(
  shopName: string,
  shop: ShopType,
  ink: HexColor,
  accent: HexColor,
  rng: Rng,
): readonly SignTextLine[] {
  const subline = at(shop.signLines, rng.int(0, shop.signLines.length))
  const price = at(shop.priceLines, rng.int(0, shop.priceLines.length))
  return [
    { text: shopName, role: 'brand', scale: 0.4, colour: ink, align: 'centre' },
    { text: subline, role: 'subline', scale: 0.19, colour: ink, align: 'centre' },
    { text: price, role: 'price', scale: 0.2, colour: accent, align: 'right' },
  ]
}

/** Everything one bay's fascia board needs, drawn from the era palette. */
function buildSignSurface(
  era: EraDefinition,
  data: StorefrontEraData,
  tier: QualityTierName,
  illumination: IlluminationKind,
  emissive: number,
  lines: readonly SignTextLine[],
): SignSurface {
  const size = textureSizeFor('shop-sign', tier)
  const background = era.palette.storefrontSign
  const ink = inkOn(background, data)
  const request: SignSurfaceRequest = {
    id: `${data.eraId}:shop-sign:${lines[0]?.text ?? 'sign'}:${lines[1]?.text ?? ''}:${lines[2]?.text ?? ''}`,
    eraId: era.id,
    purpose: 'shop-sign',
    widthPx: size.widthPx,
    heightPx: size.heightPx,
    background,
    ink,
    accent: era.palette.accent,
    illumination,
    emissive,
    typography: data.typography,
    lines,
    border: era.year <= 1945 ? 'enamel' : era.year <= 1965 ? 'chrome' : era.year <= 1985 ? 'neon' : era.year <= 2005 ? 'chrome' : 'led',
  }
  return createSignSurface(request)
}

/** Awning valance artwork: stripes plus the shop name. */
function buildAwningSurface(
  era: EraDefinition,
  data: StorefrontEraData,
  tier: QualityTierName,
  shopName: string,
  illumination: IlluminationKind,
  emissive: number,
): SignSurface {
  const size = textureSizeFor('awning', tier)
  const background = era.palette.storefrontBody
  const request: SignSurfaceRequest = {
    id: `${data.eraId}:awning:${shopName}`,
    eraId: era.id,
    purpose: 'awning',
    widthPx: size.widthPx,
    heightPx: size.heightPx,
    background,
    ink: inkOn(background, data),
    accent: era.palette.storefrontSign,
    illumination,
    emissive,
    typography: data.typography,
    lines: [{ text: shopName, role: 'brand', scale: 0.34, colour: inkOn(background, data), align: 'centre' }],
    border: 'none',
  }
  return createSignSurface(request)
}

/**
 * Dresses every storefront bay anchor of the block for one era.
 *
 * Determinism: the shop order is a shuffle of the era's shop list drawn from the
 * era-seeded generator, the bay's shop is chosen by bay index, and every bay's
 * optional variation (door side, subline, price) comes from a generator forked
 * on the anchor name — so a bay dresses identically no matter what else is
 * generated around it.
 */
export function buildStorefrontUnits(options: FrontBuildOptions): readonly StorefrontUnit[] {
  const { era, data, layout, tier, detail, night, rng } = options
  const bays = anchorsOfKind(layout, 'storefront-bay')
  const shopOrder = rng.fork('shop-order').shuffle([...data.shopTypes])

  return bays.map((anchor, index) => {
    const bayRng = rng.fork(`bay:${anchor.name}`)
    const shop = at(shopOrder, index)
    const shopName = at(shop.names, Math.floor(index / shopOrder.length))
    const parcelId = anchor.owner.id
    const bayIndex = Number.parseInt(anchor.name.slice(anchor.name.lastIndexOf(':') + 1), 10)
    const facing = anchor.facing ?? 'north'
    const width = anchor.size?.width ?? 4.5
    const height = anchor.size?.height ?? 4.6
    const position = anchor.position
    const normal = anchor.normal

    const { illumination, emissive } = bayIllumination(era, data, index, night)
    const background = era.palette.storefrontSign
    const ink = inkOn(background, data)
    const lines = shopSignLines(shopName, shop, ink, era.palette.accent, bayRng)
    const signSurface = buildSignSurface(era, data, tier, illumination, emissive, lines)
    const awningSurface = buildAwningSurface(
      era,
      data,
      tier,
      shopName,
      illumination,
      round(emissive * 0.5, 4),
    )

    const fascia = findFasciaAnchor(layout, anchor.name, width)
    const boardWidth = fascia?.size?.width ?? round(width * 0.8, 3)
    const boardHeight = fascia?.size?.height ?? 0.9
    const boardPosition: Vec3 =
      fascia?.position ??
      v3(
        round(position.x + normal.x * 0.25, 3),
        round(position.y + 5.2, 3),
        round(position.z + normal.z * 0.25, 3),
      )

    const pilaster = round(clamp(width * 0.05, 0.16, 0.3), 3)
    const lintel = round(clamp(height * 0.09, 0.34, 0.5), 3)
    const stallRiser = round(clamp(height * 0.11, 0.4, 0.55), 3)
    const doorWidth = round(clamp(width * 0.24, 0.9, 1.15), 3)
    const doorHeight = round(clamp(height * 0.49, 2.05, 2.4), 3)
    const doorSide: -1 | 1 = bayRng.bool(0.5) ? 1 : -1
    const awningDrop = round(clamp(height * 0.2, 0.7, 0.95), 3)

    const unit: StorefrontUnit = {
      anchor: anchor.name,
      parcel: parcelId,
      bayIndex: Number.isFinite(bayIndex) ? bayIndex : index + 1,
      street: facing,
      shopType: shop.id,
      shopLabel: shop.label,
      shopName,
      position,
      normal,
      rotationY: round(facingRotation(normal), 4),
      width,
      height,
      frame: {
        joinery: shop.joinery,
        colour: era.palette.storefrontBody,
        trimColour: era.palette.facadeTrim,
        depth: 0.22,
        pilaster,
        lintel,
        stallRiser,
        sill: 0.12,
      },
      glazing: {
        colour: era.palette.windowGlass,
        inset: 0.06,
        sillHeight: stallRiser,
        headHeight: round(height - lintel, 3),
        mullions: mullionCount(detail, width),
        split: 0.34,
        transparency: era.year >= 2005 ? 0.3 : 0.38,
        lit: night,
      },
      door: {
        side: doorSide,
        width: doorWidth,
        height: doorHeight,
        colour: era.palette.storefrontBody,
        glazed: era.year >= 1985,
        trimColour: era.palette.facadeTrim,
      },
      awning: {
        kind: shop.awning,
        projection: data.awningProjection,
        drop: awningDrop,
        stripes: data.awningStripes,
        colours: [era.palette.storefrontBody, era.palette.storefrontSign],
        surface: awningSurface,
      },
      signBoard: {
        anchor: fascia?.name ?? `${anchor.name.replace(':storefront:', ':sign:')}`,
        position: boardPosition,
        rotationY: round(facingRotation(normal), 4),
        width: boardWidth,
        height: boardHeight,
        illumination,
        emissive,
        colour: background,
        frameColour: era.palette.facadeTrim,
        surface: signSurface,
      },
      shutter: {
        kind: shop.shutter,
        drop: shop.shutter === 'open' ? 0 : 0.35,
        colour: era.palette.buildingAccent,
      },
      surfaces: [signSurface, awningSurface],
    }
    return unit
  })
}

/** Shop-type histogram of a dressed block, for the plan statistics. */
export function shopTypeCounts(units: readonly StorefrontUnit[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const unit of units) {
    counts[unit.shopType] = (counts[unit.shopType] ?? 0) + 1
  }
  return counts
}
