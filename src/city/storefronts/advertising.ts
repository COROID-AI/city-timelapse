/**
 * Street advertising and graffiti: era campaigns on the layout's sign anchors.
 *
 * Both media are placed on anchors the block already published — the projecting
 * `parcel:<id>:sign:<n>` mounts for boards, panels, poster frames and news
 * stands — so the layer never invents geometry. What changes between eras is the
 * mix of media, the campaigns on them and whether the marks are painted onto
 * brick, thrown up in murals or scrubbed back to a ghost.
 *
 * Every placement carries its own {@link SignSurface}: billboard, poster, news
 * board, sandwich board or graffiti decal, with the period letterform and period
 * copy already baked into the descriptor.
 */

import { anchorsOfKind, v2, v3, type Anchor, type BlockLayout, type Vec2, type Vec3 } from '../layout'
import type { QualityTierName } from '../../lib/quality'
import type { Rng } from '../../lib/rng'
import type { EraDefinition, HexColor } from '../../era'
import { createSignSurface, textureSizeFor, type SignSurfaceRequest } from './signage'
import { signageEmissiveIntensity } from './tables'
import type {
  AdCopy,
  AdvertisingKind,
  AdvertisingMount,
  AdvertisingPlacement,
  GraffitiPlacement,
  GraffitiStyle,
  IlluminationKind,
  SignSurface,
  SignTextLine,
  StorefrontEraData,
  StorefrontUnit,
} from './types'
import { ADVERTISING_KINDS } from './types'
import { isIlluminated } from './types'
import { inkOn } from './fronts'

/**
 * Base colour of an artwork that must paint strokes only.
 *
 * Graffiti decals are the one transparent artwork in the layer: the painter
 * skips the background fill, the renderer draws the texture with alpha, and the
 * wall shows through everywhere the spray did not reach. The field still has to
 * hold a `#rrggbb` value for the descriptor to stay uniformly serialisable.
 */
export const TRANSPARENT_DECAL_BASE: HexColor = '#000000'

/** Inputs one advertising/graffiti build needs. */
export interface AdvertisingBuildOptions {
  readonly era: EraDefinition
  readonly data: StorefrontEraData
  readonly layout: BlockLayout
  readonly tier: QualityTierName
  readonly detail: number
  readonly night: boolean
  readonly rng: Rng
  /** Dressed storefronts, used to anchor graffiti to real façades. */
  readonly units: readonly StorefrontUnit[]
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

/** Street tangent of a façade normal: `(-z, x)`, as the layout documents. */
function tangentOf(normal: Vec3): Vec2 {
  return v2(-normal.z, normal.x)
}

function facingRotation(normal: Vec3): number {
  return round(Math.atan2(normal.x, normal.z), 4)
}

/** Placement and texture of each advertising medium. */
interface AdMedium {
  readonly mount: AdvertisingMount
  readonly width: number
  readonly height: number
  /** Height of the artwork's centre above the sidewalk deck, metres. */
  readonly centreHeight: number
  /** Metres out from the façade line (negative turns the board to face it). */
  readonly offsetOut: number
  /** Metres along the façade from the anchor, metres. */
  readonly offsetAlong: number
  readonly illumination: IlluminationKind | 'era' | 'secondary' | 'painted'
  readonly background: (era: EraDefinition) => HexColor
}

const AD_MEDIA: Readonly<Record<AdvertisingKind, AdMedium>> = {
  billboard: {
    mount: 'blade',
    width: 1.5,
    height: 2.3,
    centreHeight: 0,
    offsetOut: 0,
    offsetAlong: 0,
    illumination: 'era',
    background: (era) => era.palette.storefrontSign,
  },
  'painted-wall': {
    mount: 'facade',
    width: 3.6,
    height: 2.4,
    centreHeight: 4.4,
    offsetOut: -1.05,
    offsetAlong: -2.4,
    illumination: 'painted',
    background: (era) => era.palette.buildingBase,
  },
  'poster-panel': {
    mount: 'facade',
    width: 1.15,
    height: 1.7,
    centreHeight: 2.6,
    offsetOut: -1.05,
    offsetAlong: 0.6,
    illumination: 'secondary',
    background: (era) => era.palette.facadeTrim,
  },
  'newspaper-board': {
    mount: 'deck',
    width: 0.75,
    height: 1.05,
    centreHeight: 0.55,
    offsetOut: 0,
    offsetAlong: -0.5,
    illumination: 'painted',
    background: (era) => era.palette.storefrontBody,
  },
  transient: {
    mount: 'deck',
    width: 0.8,
    height: 1.1,
    centreHeight: 0.58,
    offsetOut: 0,
    offsetAlong: 0.7,
    illumination: 'painted',
    background: (era) => era.palette.accent,
  },
}

/** Sign technology and emissive strength of one medium. */
function mediumIllumination(
  era: EraDefinition,
  data: StorefrontEraData,
  medium: AdMedium,
  night: boolean,
): { readonly illumination: IlluminationKind; readonly emissive: number } {
  if (medium.illumination === 'painted') {
    return { illumination: 'painted', emissive: round(signageEmissiveIntensity(era, { night, illumination: 'painted' }), 4) }
  }
  // A painted era advertises with paint: a period with no self-luminous signage
  // has no lit poster frame either, whatever its secondary technology is.
  const illumination = !isIlluminated(data.illumination)
    ? 'painted'
    : medium.illumination === 'secondary'
      ? data.secondaryIllumination
      : data.illumination
  return { illumination, emissive: signageEmissiveIntensity(era, { night, illumination }) }
}

/** Copy lines of one advertisement, set in the period letterform. */
function advertisementLines(
  kind: AdvertisingKind,
  copy: AdCopy,
  ink: HexColor,
  accent: HexColor,
): readonly SignTextLine[] {
  if (kind === 'newspaper-board' || kind === 'transient') {
    return [
      { text: copy.brand, role: 'brand', scale: 0.14, colour: accent, align: 'centre' },
      { text: copy.headline, role: 'headline', scale: 0.24, colour: ink, align: 'centre' },
      { text: copy.body, role: 'detail', scale: 0.1, colour: ink, align: 'centre' },
      { text: copy.price, role: 'price', scale: 0.18, colour: accent, align: 'right' },
    ]
  }
  return [
    { text: copy.brand, role: 'brand', scale: 0.13, colour: accent, align: 'left' },
    { text: copy.headline, role: 'headline', scale: 0.28, colour: ink, align: 'centre' },
    { text: copy.body, role: 'subline', scale: 0.12, colour: ink, align: 'centre' },
    { text: copy.price, role: 'price', scale: 0.2, colour: accent, align: 'right' },
  ]
}

/** Border device of one medium, per period. */
function borderFor(kind: AdvertisingKind, era: EraDefinition): SignSurfaceRequest['border'] {
  if (kind === 'painted-wall') {
    return 'none'
  }
  if (era.year <= 1945) {
    return kind === 'billboard' ? 'enamel' : 'timber'
  }
  if (era.year <= 1965) {
    return kind === 'billboard' ? 'chrome' : 'gilt'
  }
  if (era.year <= 1985) {
    return kind === 'billboard' ? 'neon' : 'chrome'
  }
  return kind === 'billboard' ? 'led' : 'chrome'
}

/**
 * Places the era's street advertising on the block's projecting sign anchors.
 *
 * The mix comes from the period table, so the count of each medium — and the
 * campaigns hanging on them — changes between every adjacent era. Anchors are
 * shuffled with the era-seeded generator, so two periods do not put the same
 * campaign on the same corner.
 */
export function buildAdvertising(options: AdvertisingBuildOptions): readonly AdvertisingPlacement[] {
  const { era, data, layout, tier, night, rng } = options
  const anchors = rng.fork('ad-anchors').shuffle(
    anchorsOfKind(layout, 'sign-mount').filter((anchor) => anchor.tags.includes('projecting')),
  )
  const kinds: AdvertisingKind[] = []
  for (const kind of ADVERTISING_KINDS) {
    for (let index = 0; index < data.advertisingMix[kind]; index += 1) {
      kinds.push(kind)
    }
  }
  const order = rng.fork('ad-order').shuffle(kinds)

  const placements: AdvertisingPlacement[] = []
  order.forEach((kind, index) => {
    const anchor: Anchor | undefined = anchors[index % Math.max(1, anchors.length)]
    if (anchor === undefined) {
      return
    }
    const medium = AD_MEDIA[kind]
    const copies = data.advertising[kind]
    const copy = at(copies, index)
    const { illumination, emissive } = mediumIllumination(era, data, medium, night)
    const background = medium.background(era)
    const ink = inkOn(background, data)
    // Every advertising medium is also a `SignPurpose`, so the texture size
    // table is keyed by the medium name itself.
    const size = textureSizeFor(kind, tier)
    const tangent = tangentOf(anchor.normal)
    const position: Vec3 = v3(
      round(anchor.position.x + anchor.normal.x * medium.offsetOut + tangent.x * medium.offsetAlong, 3),
      round(anchor.position.y + medium.centreHeight, 3),
      round(anchor.position.z + anchor.normal.z * medium.offsetOut + tangent.z * medium.offsetAlong, 3),
    )
    const surface = createSignSurface({
      id: `${data.eraId}:${kind}:${copy.brand}:${copy.headline}`,
      eraId: era.id,
      purpose: kind,
      widthPx: size.widthPx,
      heightPx: size.heightPx,
      background,
      ink,
      accent: era.palette.accent,
      illumination,
      emissive,
      typography: data.typography,
      lines: advertisementLines(kind, copy, ink, era.palette.accent),
      border: borderFor(kind, era),
    })
    placements.push({
      anchor: anchor.name,
      eraId: era.id,
      kind,
      mount: medium.mount,
      copy,
      illumination,
      emissive,
      position,
      rotationY: facingRotation(anchor.normal),
      width: medium.width,
      height: medium.height,
      surface,
    })
  })

  return placements
}

/** Texture and geometry of one graffiti style. */
interface GraffitiMedium {
  readonly width: number
  readonly height: number
  readonly centreHeight: number
  readonly opacity: number
}

const GRAFFITI_MEDIA: Readonly<Record<GraffitiStyle, GraffitiMedium>> = {
  tag: { width: 1.7, height: 0.65, centreHeight: 1.5, opacity: 0.85 },
  'throw-up': { width: 2.4, height: 1.3, centreHeight: 1.7, opacity: 0.9 },
  mural: { width: 3.6, height: 2.1, centreHeight: 2.1, opacity: 0.92 },
  stencil: { width: 1.3, height: 0.9, centreHeight: 1.3, opacity: 0.8 },
  'paste-up': { width: 0.95, height: 1.25, centreHeight: 1.6, opacity: 0.88 },
  remnant: { width: 2.1, height: 1.1, centreHeight: 1.5, opacity: 0.32 },
}

/**
 * Paints the era's graffiti programme onto real shopfront faces.
 *
 * A period whose table disables graffiti (`state === 'none'`, density zero) can
 * never produce a placement, because the function returns before touching a
 * bay. Density is additionally scaled by the quality tier's storefront detail so
 * a phone gets the same marks, spaced out, rather than a different look.
 */
export function buildGraffiti(options: AdvertisingBuildOptions): readonly GraffitiPlacement[] {
  const { era, data, tier, detail, rng, units } = options
  const profile = data.graffiti
  if (profile.state === 'none' || profile.density <= 0) {
    return []
  }
  const effectiveDensity = Math.min(1, profile.density * (0.75 + 0.25 * detail))
  const placements: GraffitiPlacement[] = []

  units.forEach((unit, index) => {
    const markRng = rng.fork(`graffiti:${unit.anchor}`)
    if (markRng.next() >= effectiveDensity) {
      return
    }
    const style: GraffitiStyle =
      profile.state === 'murals' && index % 3 === 0
        ? 'mural'
        : profile.state === 'cleaned'
          ? 'remnant'
          : at(profile.styles, markRng.int(0, profile.styles.length))
    const medium = GRAFFITI_MEDIA[style]
    const colour = at(profile.colours, markRng.int(0, profile.colours.length))
    const message = at(profile.messages, markRng.int(0, profile.messages.length))
    const tangent = tangentOf(unit.normal)
    const along = markRng.float(-unit.width * 0.3, unit.width * 0.3)
    const size = textureSizeFor('graffiti', tier)
    const surface = createSignSurface({
      id: `${data.eraId}:graffiti:${style}:${message}:${unit.anchor}`,
      eraId: era.id,
      purpose: 'graffiti',
      widthPx: size.widthPx,
      heightPx: size.heightPx,
      background: TRANSPARENT_DECAL_BASE,
      ink: colour,
      accent: era.palette.storefrontBody,
      illumination: 'painted',
      emissive: 0,
      typography: data.typography,
      lines: [
        { text: message, role: 'headline', scale: style === 'mural' ? 0.3 : 0.42, colour, align: 'centre' },
        ...(style === 'mural' || style === 'throw-up'
          ? [{ text: unit.shopName, role: 'detail' as const, scale: 0.14, colour, align: 'centre' as const }]
          : []),
      ],
      border: 'none',
    })
    placements.push({
      anchor: unit.anchor,
      eraId: era.id,
      state: profile.state,
      style,
      text: message,
      colour,
      position: v3(
        round(unit.position.x + unit.normal.x * 0.04 + tangent.x * along, 3),
        round(unit.position.y + medium.centreHeight, 3),
        round(unit.position.z + unit.normal.z * 0.04 + tangent.z * along, 3),
      ),
      rotationY: round(Math.atan2(unit.normal.x, unit.normal.z), 4),
      width: medium.width,
      height: medium.height,
      opacity: round(
        Math.min(1, medium.opacity * (profile.state === 'cleaned' ? 0.8 : 1) * (0.75 + 0.25 * detail)),
        3,
      ),
      surface,
    })
  })

  return placements
}

/** Distinct campaigns a placement set draws on, for the plan statistics. */
export function distinctAdCampaigns(
  placements: readonly AdvertisingPlacement[],
): readonly string[] {
  return [...new Set(placements.map((placement) => placement.surface.id))]
}

/** Advertising histogram by medium. */
export function advertisingCounts(
  placements: readonly AdvertisingPlacement[],
): Record<AdvertisingKind, number> {
  const counts = Object.fromEntries(ADVERTISING_KINDS.map((kind) => [kind, 0])) as Record<
    AdvertisingKind,
    number
  >
  for (const placement of placements) {
    counts[placement.kind] += 1
  }
  return counts
}

/** Every artwork an advertising and graffiti build produced. */
export function surfacesOf(
  placements: readonly AdvertisingPlacement[],
  graffiti: readonly GraffitiPlacement[],
): readonly SignSurface[] {
  return [...placements.map((placement) => placement.surface), ...graffiti.map((mark) => mark.surface)]
}
