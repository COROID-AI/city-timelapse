/**
 * Shared vocabulary of the era storefront, signage and advertising layer.
 *
 * The layer is split the way the block is: a *plan* (plain, serialisable data)
 * and a *painter* (canvas + three.js). Everything in this file describes the
 * plan and the artwork it points at:
 *
 * - {@link StorefrontEraData} — the period table entry: shop vocabulary,
 *   letterforms, sign technology, advertisement copy and graffiti profile.
 * - {@link StorefrontPlan} — one era's dressed block: one {@link StorefrontUnit}
 *   per layout storefront-bay anchor, plus {@link AdvertisingPlacement}s on the
 *   layout sign anchors and {@link GraffitiPlacement}s on shopfront faces.
 * - {@link SignSurface} — a piece of artwork to be drawn at runtime: pixel
 *   dimensions, period colours, letterform style and the text lines to set.
 *   Nothing here is an image file or a web font; {@link SignCanvasFactory}
 *   produces the pixels and can be swapped for a recording double in tests.
 *
 * Every value is `JSON.stringify`-safe (numbers, strings, arrays and plain
 * objects), so the unit suite can hash a whole era's plan and the browser
 * harness can publish it without a serialiser.
 */

import type { EraId, HexColor, EraLighting, EraPalette } from '../../era'
import type { BlockLayout, StreetName, Vec2, Vec3 } from '../layout'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'

export type {
  EraId,
  EraLighting,
  EraPalette,
  HexColor,
  QualityTierName,
  Seed,
  Vec2,
  Vec3,
}

/* ------------------------------------------------------------------------- *
 * Signage illumination
 * ------------------------------------------------------------------------- */

/**
 * Sign technologies of the five periods, in historical order: hand paint,
 * tungsten, fluorescent tube, neon tube, backlit vinyl and LED.
 */
export const ILLUMINATION_KINDS = [
  'painted',
  'incandescent',
  'fluorescent',
  'neon',
  'backlit-vinyl',
  'led',
] as const

export type IlluminationKind = (typeof ILLUMINATION_KINDS)[number]

/**
 * Emissive yield of one technology relative to a neon tube.
 *
 * A painted board barely glows under street lamps, a tungsten bulb warms, a
 * fluorescent box is even and slightly cold, neon and LED are sources in their
 * own right. The value multiplies the era's `artificialLightIntensity`, which
 * is why the same night scene lights 1985 far harder than 1945.
 */
export const ILLUMINATION_GAIN: Readonly<Record<IlluminationKind, number>> = {
  painted: 0.12,
  incandescent: 0.55,
  fluorescent: 0.7,
  neon: 1,
  'backlit-vinyl': 0.8,
  led: 0.9,
}

/** Technologies that read as self-luminous (gain at or above a half). */
export const ILLUMINATED_KINDS: readonly IlluminationKind[] = ILLUMINATION_KINDS.filter(
  (kind) => ILLUMINATION_GAIN[kind] >= 0.5,
)

/** Narrows an untrusted value to an illumination kind. */
export function isIlluminationKind(value: unknown): value is IlluminationKind {
  return typeof value === 'string' && (ILLUMINATION_KINDS as readonly string[]).includes(value)
}

/** True when a technology emits light of its own rather than reflecting it. */
export function isIlluminated(kind: IlluminationKind): boolean {
  return ILLUMINATION_GAIN[kind] >= 0.5
}

/* ------------------------------------------------------------------------- *
 * Letterforms
 * ------------------------------------------------------------------------- */

/** Geometric families the bundled stroke font can imitate. */
export const LETTERFORM_FAMILIES = [
  'painted-serif',
  'script',
  'extended-sans',
  'grotesque',
  'geometric',
  'condensed',
] as const

export type LetterformFamily = (typeof LETTERFORM_FAMILIES)[number]

/**
 * One era's type personality, expressed as parameters of the stroke font
 * rather than as a font file: weight, slant, tracking, width, serif ticks,
 * outline, drop shadow and baseline ligatures.
 */
export interface LetterformStyle {
  /** Stable id, e.g. `1945-hand-lettered`. */
  readonly id: string
  /** Human label for the harness readout. */
  readonly label: string
  readonly family: LetterformFamily
  /** Stroke thickness as a fraction of cap height (0.08 thin … 0.3 bulbous). */
  readonly weight: number
  /** Italic shear applied to the top of the glyph box, 0 = upright. */
  readonly slant: number
  /** Extra advance between glyphs, as a fraction of the glyph width. */
  readonly tracking: number
  /** Letter width multiplier: below 1 condensed, above 1 extended. */
  readonly xScale: number
  /** Draw slab ticks at stroke terminals (painted signwriter serifs). */
  readonly serifs: boolean
  /** Stroke the glyph outline behind the fill (enamel and chrome lettering). */
  readonly outline: boolean
  /** Offset a dark copy behind the glyph (period signwriting shadow). */
  readonly shadow: boolean
  /** Join glyphs with a baseline swash (neon and script lettering). */
  readonly ligatures: boolean
  /** Era sets its signage in capitals (true) or permits mixed case (false). */
  readonly caps: boolean
}

/* ------------------------------------------------------------------------- *
 * Runtime canvas painting
 * ------------------------------------------------------------------------- */

/** The minimum 2D context surface the painter needs; `CanvasRenderingContext2D` fits. */
export interface SignCanvas2D {
  readonly canvas: SignCanvasHandle
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineCap: 'butt' | 'round' | 'square'
  lineJoin: 'round' | 'bevel' | 'miter'
  globalAlpha: number
  save(): void
  restore(): void
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  stroke(): void
  fill(): void
  fillRect(x: number, y: number, width: number, height: number): void
  strokeRect(x: number, y: number, width: number, height: number): void
  clearRect(x: number, y: number, width: number, height: number): void
}

/** Anything with the pixel dimensions the painter reports. */
export interface SignCanvasHandle {
  readonly width: number
  readonly height: number
}

/** A painted target plus its (possibly unavailable) 2D context. */
export interface SignCanvasSurface<TCanvas = HTMLCanvasElement> {
  readonly canvas: TCanvas
  /**
   * `null` when the host cannot provide a 2D context (headless jsdom, a lost
   * context). The painter still reports its operations, the renderer falls back
   * to flat period colour, and nothing throws.
   */
  readonly context: SignCanvas2D | null
}

/** Injectable source of sign artwork targets; the tests substitute a recorder. */
export type SignCanvasFactory<TCanvas = HTMLCanvasElement> = (
  width: number,
  height: number,
) => SignCanvasSurface<TCanvas>

/**
 * Factory whose canvas type the renderer does not care about: any handle the
 * painter accepts works as a texture source in a browser, and a recording double
 * works everywhere else.
 */
export type AnySignCanvasFactory = SignCanvasFactory<unknown>

/* ------------------------------------------------------------------------- *
 * Sign artwork
 * ------------------------------------------------------------------------- */

/** What a piece of artwork is: a shop sign, street advertising or graffiti. */
export const SIGN_PURPOSES = [
  'shop-sign',
  'blade-sign',
  'billboard',
  'painted-wall',
  'poster-panel',
  'newspaper-board',
  'transient',
  'awning',
  'graffiti',
] as const

export type SignPurpose = (typeof SIGN_PURPOSES)[number]

/** Period framing device drawn around the artwork. */
export const SIGN_BORDERS = ['none', 'enamel', 'timber', 'chrome', 'neon', 'led', 'gilt'] as const

export type SignBorder = (typeof SIGN_BORDERS)[number]

/** Role of one line of copy inside an artwork, which sets its size and colour. */
export const TEXT_ROLES = ['brand', 'headline', 'subline', 'price', 'detail'] as const

export type TextRole = (typeof TEXT_ROLES)[number]

/** Horizontal alignment of a line inside its artwork box. */
export type TextAlign = 'left' | 'centre' | 'right'

/** One line of period copy to be set in the era's letterform. */
export interface SignTextLine {
  readonly text: string
  readonly role: TextRole
  /** Cap height as a fraction of the artwork height. */
  readonly scale: number
  readonly colour: HexColor
  readonly align: TextAlign
}

/**
 * A complete, self-describing artwork request.
 *
 * `id` doubles as the material-cache key, so two shops whose board carries
 * identical copy share one texture (the memory-budget rule) while two eras
 * never do.
 */
export interface SignSurface {
  /** Stable cache key, e.g. `1945:hardware:sign:HARDWARE / NAILS`. */
  readonly id: string
  readonly eraId: EraId
  readonly purpose: SignPurpose
  readonly widthPx: number
  readonly heightPx: number
  readonly background: HexColor
  readonly ink: HexColor
  readonly accent: HexColor
  readonly illumination: IlluminationKind
  /** Emissive strength, already weighted by the era lighting and night flag. */
  readonly emissive: number
  readonly typography: LetterformStyle
  readonly lines: readonly SignTextLine[]
  readonly border: SignBorder
  /** Same value as `id`; kept explicit because renderers cache on it. */
  readonly textureKey: string
  /** Estimated bytes this texture occupies on the GPU (`w * h * 4`). */
  readonly bytes: number
}

/** One drawing operation the painter performed, in order. */
export type PaintOp =
  | { readonly op: 'background'; readonly colour: HexColor }
  | { readonly op: 'border'; readonly kind: SignBorder; readonly colour: HexColor }
  | {
      readonly op: 'style'
      readonly fillStyle: string
      readonly strokeStyle: string
      readonly lineWidth: number
      readonly globalAlpha: number
    }
  | {
      readonly op: 'font'
      readonly styleId: string
      readonly family: LetterformFamily
      readonly weight: number
    }
  | {
      readonly op: 'line'
      readonly role: TextRole
      readonly text: string
      readonly x: number
      readonly y: number
      readonly capHeight: number
      readonly align: TextAlign
    }
  | {
      readonly op: 'glyph'
      readonly char: string
      readonly x: number
      readonly y: number
      readonly capHeight: number
      readonly glyphWidth: number
    }
  | { readonly op: 'detail'; readonly kind: string; readonly colour: HexColor }

/** Result of {@link SignSurface} painting: the target plus the operation log. */
export interface PaintedSign<TCanvas = HTMLCanvasElement> {
  readonly surface: SignSurface
  readonly canvas: TCanvas
  readonly context: SignCanvas2D | null
  readonly ops: readonly PaintOp[]
}

/* ------------------------------------------------------------------------- *
 * Shop types
 * ------------------------------------------------------------------------- */

/** Awning constructions a period shopfront can carry. */
export const AWNING_KINDS = [
  'canvas-stripe',
  'solid-canvas',
  'rigid-canopy',
  'fabric-logo',
  'metal-canopy',
] as const

export type AwningKind = (typeof AWNING_KINDS)[number]

/** Shopfront joinery materials: painted timber, steel, aluminium, brass-trimmed. */
export const JOINERY_KINDS = ['timber', 'painted-steel', 'aluminium', 'brass-trimmed'] as const

export type JoineryKind = (typeof JOINERY_KINDS)[number]

/** How a bay closes at night. */
export const SHUTTER_KINDS = ['open', 'slatted-shutter', 'roller-grille', 'folding-gate'] as const

export type ShutterKind = (typeof SHUTTER_KINDS)[number]

/** One period shop type and everything the layer needs to dress its bay. */
export interface ShopType {
  /** Stable id, e.g. `wartime-grocer`. */
  readonly id: string
  /** Human label for reports and the harness readout. */
  readonly label: string
  readonly category: 'food' | 'services' | 'retail' | 'entertainment' | 'technology' | 'finance'
  /** Trading names this shop type draws from, era-plausible and period-spelled. */
  readonly names: readonly string[]
  /** Copy painted under the name on the fascia board. */
  readonly signLines: readonly string[]
  /** Price/notice strip of the board, in period currency and typography. */
  readonly priceLines: readonly string[]
  readonly awning: AwningKind
  readonly joinery: JoineryKind
  readonly shutter: ShutterKind
}

/* ------------------------------------------------------------------------- *
 * Advertising
 * ------------------------------------------------------------------------- */

/** Street advertising media placed on the layout's sign anchors. */
export const ADVERTISING_KINDS = [
  'billboard',
  'painted-wall',
  'poster-panel',
  'newspaper-board',
  'transient',
] as const

export type AdvertisingKind = (typeof ADVERTISING_KINDS)[number]

/** One period advertisement: brand, slogan, body copy and price styling. */
export interface AdCopy {
  readonly brand: string
  readonly headline: string
  readonly body: string
  readonly price: string
  /** Campaign tag the era model lists in `contentTags.advertisements`. */
  readonly tag: string
}

/** How an advertisement is fixed to its anchor. */
export type AdvertisingMount = 'blade' | 'facade' | 'deck'

/** One advertisement placed on one layout sign anchor. */
export interface AdvertisingPlacement {
  /** Layout sign anchor name the placement is mounted on. */
  readonly anchor: string
  readonly eraId: EraId
  readonly kind: AdvertisingKind
  readonly mount: AdvertisingMount
  readonly copy: AdCopy
  readonly illumination: IlluminationKind
  readonly emissive: number
  /** World position of the artwork's centre. */
  readonly position: Vec3
  /** Y rotation that faces the artwork at the street, radians. */
  readonly rotationY: number
  readonly width: number
  readonly height: number
  readonly surface: SignSurface
}

/* ------------------------------------------------------------------------- *
 * Graffiti
 * ------------------------------------------------------------------------- */

/** Era-driven graffiti states, from a clean wall to a cleaned remnant. */
export const GRAFFITI_STATES = ['none', 'tags', 'murals', 'cleaned'] as const

export type GraffitiState = (typeof GRAFFITI_STATES)[number]

/** Mark kinds a period can lay down. */
export const GRAFFITI_STYLES = ['tag', 'throw-up', 'mural', 'stencil', 'paste-up', 'remnant'] as const

export type GraffitiStyle = (typeof GRAFFITI_STYLES)[number]

/** One era's graffiti programme. `density` 0 disables the layer entirely. */
export interface GraffitiProfile {
  readonly state: GraffitiState
  /** Fraction of shopfront faces that carry a mark, 0..1. */
  readonly density: number
  readonly styles: readonly GraffitiStyle[]
  readonly messages: readonly string[]
  readonly colours: readonly HexColor[]
}

/** One mark painted onto one shopfront face. */
export interface GraffitiPlacement {
  /** Storefront bay anchor the mark is painted onto. */
  readonly anchor: string
  readonly eraId: EraId
  readonly state: GraffitiState
  readonly style: GraffitiStyle
  readonly text: string
  readonly colour: HexColor
  readonly position: Vec3
  readonly rotationY: number
  readonly width: number
  readonly height: number
  /** Faded remnants are drawn translucent; fresh tags are opaque. */
  readonly opacity: number
  readonly surface: SignSurface
}

/* ------------------------------------------------------------------------- *
 * Storefront units
 * ------------------------------------------------------------------------- */

/** Shopfront joinery, sized from the bay anchor's declared width and height. */
export interface StorefrontFrameSpec {
  readonly joinery: JoineryKind
  readonly colour: HexColor
  readonly trimColour: HexColor
  /** Depth the joinery projects from the façade line, metres. */
  readonly depth: number
  readonly pilaster: number
  readonly lintel: number
  readonly stallRiser: number
  readonly sill: number
}

/** Glazing field of one bay, split by mullions. */
export interface StorefrontGlazingSpec {
  readonly colour: HexColor
  /** Inset behind the façade line, metres (negative is proud). */
  readonly inset: number
  readonly sillHeight: number
  readonly headHeight: number
  readonly mullions: number
  /** Window split as a fraction of the glazed width. */
  readonly split: number
  readonly transparency: number
  readonly lit: boolean
}

/** Entrance door of one bay, placed on the left or right of the glazing. */
export interface StorefrontDoorSpec {
  readonly side: -1 | 1
  readonly width: number
  readonly height: number
  readonly colour: HexColor
  readonly glazed: boolean
  readonly trimColour: HexColor
}

/** Canvas awning over the glazing. */
export interface StorefrontAwningSpec {
  readonly kind: AwningKind
  /** Horizontal reach from the façade, metres. */
  readonly projection: number
  /** Vertical drop of the sloped canvas, metres. */
  readonly drop: number
  readonly stripes: number
  readonly colours: readonly [HexColor, HexColor]
  readonly surface: SignSurface
}

/** Fascia board, mounted on the bay's `parcel:<id>:sign:<n>` anchor. */
export interface StorefrontSignSpec {
  /** Layout sign anchor name the board is mounted on. */
  readonly anchor: string
  /** Master sign-mount anchor this bay's fascia hangs from. */
  readonly position: Vec3
  readonly rotationY: number
  readonly width: number
  readonly height: number
  readonly illumination: IlluminationKind
  readonly emissive: number
  readonly colour: HexColor
  readonly frameColour: HexColor
  readonly surface: SignSurface
}

/** Night shutter state of one bay. */
export interface StorefrontShutterSpec {
  readonly kind: ShutterKind
  /** Height of the closed shutter box above the opening, metres. */
  readonly drop: number
  readonly colour: HexColor
}

/** One fully dressed ground-floor storefront. */
export interface StorefrontUnit {
  /** Layout storefront-bay anchor name; the unit is addressed by this. */
  readonly anchor: string
  readonly parcel: string
  readonly bayIndex: number
  readonly street: StreetName
  readonly shopType: string
  readonly shopLabel: string
  readonly shopName: string
  /** Bay anchor position (deck height) the unit is built from. */
  readonly position: Vec3
  readonly normal: Vec3
  readonly rotationY: number
  readonly width: number
  readonly height: number
  readonly frame: StorefrontFrameSpec
  readonly glazing: StorefrontGlazingSpec
  readonly door: StorefrontDoorSpec
  readonly awning: StorefrontAwningSpec
  readonly signBoard: StorefrontSignSpec
  readonly shutter: StorefrontShutterSpec
  /** Every artwork this unit needs, awning and board included. */
  readonly surfaces: readonly SignSurface[]
}

/* ------------------------------------------------------------------------- *
 * Era table
 * ------------------------------------------------------------------------- */

/** How many sign anchors each advertising medium takes in one era. */
export type AdvertisingMix = Readonly<Record<AdvertisingKind, number>>

/** Complete per-era storefront dataset; the only place period copy lives. */
export interface StorefrontEraData {
  readonly eraId: EraId
  readonly label: string
  /** Sign technology the period's block uses. */
  readonly illumination: IlluminationKind
  /** Eras use more than one technology; these are used for the minor media. */
  readonly secondaryIllumination: IlluminationKind
  readonly typography: LetterformStyle
  /** Ink colours printed on light boards and on dark boards of the period. */
  readonly inkOnLight: HexColor
  readonly inkOnDark: HexColor
  /** Signage vocabulary of the period (materials, lettering, sign forms). */
  readonly signage: readonly string[]
  /** Storefront types the block features, in assignment order. */
  readonly shopTypes: readonly ShopType[]
  /** Period advertisement copy per medium. */
  readonly advertising: Readonly<Record<AdvertisingKind, readonly AdCopy[]>>
  /** How many blade sign anchors each medium occupies. */
  readonly advertisingMix: AdvertisingMix
  /** Sandwich-board and banner copy of the period. */
  readonly transientMessages: readonly string[]
  readonly graffiti: GraffitiProfile
  /** Awning geometry of the period. */
  readonly awningStripes: number
  readonly awningProjection: number
}

/* ------------------------------------------------------------------------- *
 * Plan
 * ------------------------------------------------------------------------- */

/** Counters published with every plan, used by the tests and the harness. */
export interface StorefrontStats {
  readonly bayCount: number
  readonly dressedBays: number
  readonly bareBays: number
  readonly shopTypeCounts: Readonly<Record<string, number>>
  readonly advertisingTotal: number
  readonly advertisingByKind: Readonly<Record<AdvertisingKind, number>>
  readonly distinctAdCopy: number
  readonly graffitiCount: number
  readonly graffitiState: GraffitiState
  readonly surfaceCount: number
  readonly uniqueTextures: number
  readonly textureBytes: number
  readonly textureBudgetBytes: number
  readonly withinTextureBudget: boolean
  readonly emissiveIntensity: number
  readonly illuminatedSigns: number
  readonly night: boolean
  readonly signageVocabulary: readonly string[]
  readonly typographyId: string
  readonly illumination: IlluminationKind
}

/** One era's dressed block, ready to be built into three.js objects. */
export interface StorefrontPlan {
  readonly kind: 'storefront-plan'
  readonly eraId: EraId
  readonly year: number
  readonly seed: Seed
  readonly qualityTier: QualityTierName
  readonly detail: number
  readonly night: boolean
  readonly reducedMotion: boolean
  /** Period light the renderer puts on glazing, tubes and LEDs. */
  readonly lighting: StorefrontLighting
  /** Artworks addressed by id; the renderer paints and caches these. */
  readonly surfaces: readonly SignSurface[]
  readonly units: readonly StorefrontUnit[]
  readonly advertising: readonly AdvertisingPlacement[]
  readonly graffiti: readonly GraffitiPlacement[]
  readonly stats: StorefrontStats
}

/**
 * The slice of one era's lighting the renderer needs, copied out of the era
 * registry so a plan can be built (and asserted on) without the registry in
 * scope.
 */
export interface StorefrontLighting {
  /** Colour of street lamps, neon and window glow, `#rrggbb`. */
  readonly artificialLightColor: HexColor
  /** Strength of artificial light: near 0 by day, above 1 for a night city. */
  readonly artificialLightIntensity: number
  /** Window glass tint, used for shop interiors. */
  readonly windowGlass: HexColor
  readonly night: boolean
}

/** A staged era change: `mix` 0 renders `from`, 1 renders `to`. */
export interface StorefrontTransition {
  readonly from: EraId
  readonly to: EraId
  /** Blend weight, clamped to 0..1; snapped to 0/1 under reduced motion. */
  readonly t: number
}

/** Everything a plan needs to know about its host application. */
export interface StorefrontContext {
  /** The real block; the layer never creates or moves an anchor. */
  readonly layout: BlockLayout
  /** Overrides the layout seed for content generation (layout itself is fixed). */
  readonly seed?: Seed
  readonly qualityTier?: QualityTierName
  /** Overrides the night flag derived from the era's lighting. */
  readonly night?: boolean
  /** Reduced motion switches eras instantly instead of blending. */
  readonly reducedMotion?: boolean
}

/** Result of a staged change: the resolved plan plus both staged plans. */
export interface StorefrontTransitionPlan {
  readonly kind: 'storefront-transition'
  readonly from: EraId
  readonly to: EraId
  /** Era whose plan is returned: `to` once the blend passes its midpoint. */
  readonly resolvedEra: EraId
  readonly t: number
  /** Progress towards `to`, 0..1; snapped for reduced motion. */
  readonly mix: number
  /** True when reduced motion switched the block in one step. */
  readonly instant: boolean
  readonly plan: StorefrontPlan
  readonly fromPlan: StorefrontPlan
  readonly toPlan: StorefrontPlan
}

