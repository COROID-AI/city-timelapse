/**
 * Data contract of the era street-furniture layer.
 *
 * The layer dresses the *frozen* block layout with the small objects that carry
 * a period's identity: lamps, signals, hydrants, kiosks, benches, bins,
 * bollards, chargers, facade detail and temporary clutter. Nothing here creates
 * geometry anchors, moves buildings or invents positions: every prop is attached
 * to a named layout anchor from `src/city/layout`, and the era tables decide
 * *which* object stands on that anchor in *which* period.
 *
 * Conventions used throughout the module:
 *
 * - Everything is a plain, serialisable value (numbers, strings, arrays and
 *   nested plain objects), so a plan can be snapshotted, diffed and hashed.
 * - World units are metres, `+y` is up, `x`/`z` are the ground plane axes of the
 *   layout's frozen coordinate system.
 * - Geometry recipes are data: a recipe is a list of parts drawn from a shared
 *   part catalogue, so the same primitive geometry is reused by every prop that
 *   needs it and the mesh builder can instance repeats.
 * - Per-era variation lives in `tables.ts`; geometry code owns no year literal.
 *
 * ## Anchor slots
 *
 * A {@link PropSlot} is one *anchor category* of the layout, and each slot maps
 * onto exactly one anchor kind (plus, for the parcel prop points, one tag):
 *
 * | slot               | layout anchors                                  |
 * | ------------------ | ----------------------------------------------- |
 * | `light-post`       | `street:*:light:*`                              |
 * | `signal-head`      | `corner:*:signal:*`                             |
 * | `hydrant`          | `street:*:hydrant:*`                            |
 * | `utility-endpoint` | `street:*:utility:*`                            |
 * | `rooftop-detail`   | `parcel:*:prop:*` tagged `rooftop`              |
 * | `street-furniture` | `parcel:*:prop:*` tagged `street-level`         |
 * | `corner-clutter`   | `corner:*:inspect:*` (corner-owned only)        |
 *
 * Parcel-owned `inspection-focus` anchors are deliberately *not* used: they
 * point into the middle of the building volume. Storefront bay, sign mount and
 * parking bay anchors belong to the storefront, signage and vehicle layers and
 * are left untouched by this layer.
 */

import type { EraId, EraPalette } from '../../era'
import type { AnchorKind, BlockLayout, Vec3 } from '../layout'

/* ------------------------------------------------------------------------- *
 * Budgets and shared numbers
 * ------------------------------------------------------------------------- */

/**
 * Depth of each usable sub-band of the four-metre sidewalk, measured from the
 * building line and from the kerb respectively.
 *
 * The layout walks pedestrians along `SIDEWALK_WALK_LINE` (58 m), so a 4 m
 * sidewalk is one clear walking band in the middle plus one sub-band against the
 * facade and one against the kerb. Street furniture lives in those sub-bands.
 */
export const SIDEWALK_SUB_BAND_DEPTH = 1.1

/** Half width of the sidewalk walking band kept clear of props, in metres. */
export const WALKING_BAND_HALF_WIDTH = 0.9

/** Gap kept between a prop footprint and the band edge, in metres. */
export const PROP_CLEARANCE = 0.05

/** Deepest footprint a ground prop may declare and still fit its sub-band. */
export const MAX_GROUND_PROP_DEPTH = SIDEWALK_SUB_BAND_DEPTH - 2 * PROP_CLEARANCE

/** Widest ground prop footprint accepted anywhere on the block, in metres. */
export const MAX_GROUND_PROP_WIDTH = 4

/** Tallest prop the layer places, in metres (keeps the layer's scale sane). */
export const MAX_PROP_HEIGHT = 12

/** Triangle ceiling for one era's props, per shared quality tier. */
export const PROPS_TRIANGLE_BUDGETS = { high: 45_000, medium: 34_000, low: 22_000 } as const

/**
 * Draw-call ceiling for one era's props, per shared quality tier.
 *
 * One batch is one instanced draw call per (recipe, part) pair in use, so the
 * ceiling is a function of catalogue size rather than of prop count: the block
 * carries the same ~95 props per era at every tier.
 */
export const PROPS_DRAW_CALL_BUDGETS = { high: 220, medium: 190, low: 160 } as const

/** Emissive multiplier applied to a lamp in daylight. */
export const LAMP_DAY_EMISSIVE_SCALE = 0.22

/** Emissive multiplier applied to a lamp at night. */
export const LAMP_NIGHT_EMISSIVE_SCALE = 1

/** Base point-light intensity (candela) of one lit lamp at full night strength. */
export const LAMP_BASE_LIGHT_INTENSITY = 26

/* ------------------------------------------------------------------------- *
 * Categories, slots and mounts
 * ------------------------------------------------------------------------- */

/** The five prop families every era must cover. */
export const PROP_CATEGORIES = ['lighting', 'signals', 'furniture', 'utility', 'clutter'] as const

export type PropCategory = (typeof PROP_CATEGORIES)[number]

/** Anchor categories the layer populates; see the module comment. */
export const PROP_SLOTS = [
  'light-post',
  'signal-head',
  'hydrant',
  'utility-endpoint',
  'rooftop-detail',
  'street-furniture',
  'corner-clutter',
] as const

export type PropSlot = (typeof PROP_SLOTS)[number]

/** How one slot selects its anchors out of the layout catalogue. */
export interface SlotAnchorFilter {
  /** Layout anchor kind this slot claims. */
  readonly kind: AnchorKind
  /** Required anchor tag, or `null` when the kind alone is enough. */
  readonly tag: string | null
  /** Required anchor owner kind, or `null` when any owner qualifies. */
  readonly ownerKind: 'parcel' | 'street' | 'corner' | null
  /**
   * When true the anchor is only claimed where its ground position is public
   * sidewalk. Interior parcels publish a second `prop-point` in the middle of
   * their own building, which no street prop may occupy.
   */
  readonly sidewalkOnly: boolean
}

/** Anchor filter of every slot; also the documentation of what each claims. */
export const SLOT_FILTERS: Readonly<Record<PropSlot, SlotAnchorFilter>> = {
  'light-post': { kind: 'light-post', tag: null, ownerKind: 'street', sidewalkOnly: true },
  'signal-head': { kind: 'signal-head', tag: null, ownerKind: 'corner', sidewalkOnly: true },
  hydrant: { kind: 'hydrant', tag: null, ownerKind: 'street', sidewalkOnly: true },
  'utility-endpoint': {
    kind: 'utility-endpoint',
    tag: null,
    ownerKind: 'street',
    sidewalkOnly: true,
  },
  'rooftop-detail': { kind: 'prop-point', tag: 'rooftop', ownerKind: 'parcel', sidewalkOnly: false },
  'street-furniture': {
    kind: 'prop-point',
    tag: 'street-level',
    ownerKind: 'parcel',
    sidewalkOnly: true,
  },
  'corner-clutter': {
    kind: 'inspection-focus',
    tag: null,
    ownerKind: 'corner',
    sidewalkOnly: false,
  },
}

/** One anchor category claimed by one layer: the shape of the plan's coverage. */
export interface SlotCoverage {
  readonly slot: PropSlot
  readonly expected: readonly string[]
  readonly placed: readonly string[]
  readonly missing: readonly string[]
  readonly duplicated: readonly string[]
}

/** How a prop is carried by its anchor. */
export const PROP_MOUNTS = ['ground', 'pole-top', 'facade', 'roof', 'kerb'] as const

export type PropMount = (typeof PROP_MOUNTS)[number]

/** Which way a recipe is rotated away from the street axis. */
export const PROP_FACINGS = ['outward', 'inward', 'along-street', 'anchor-normal'] as const

export type PropFacing = (typeof PROP_FACINGS)[number]

/* ------------------------------------------------------------------------- *
 * Materials
 * ------------------------------------------------------------------------- */

/** Every material family the catalogue paints its parts with. */
export const MATERIAL_KEYS = [
  'cast-iron',
  'painted-steel',
  'galvanised-steel',
  'chrome',
  'aluminium',
  'enamel',
  'copper',
  'glass',
  'lamp-glass',
  'led-diffuser',
  'signal-lens-red',
  'signal-lens-amber',
  'signal-lens-green',
  'screen-glass',
  'neon-tube',
  'concrete',
  'granite',
  'timber',
  'rubber',
  'plastic',
  'canvas',
  'paper',
  'paint-marking',
  'asphalt-patch',
  'graffiti-paint',
  'reflective-film',
  'leaf-litter',
  'snow',
] as const

export type MaterialKey = (typeof MATERIAL_KEYS)[number]

/**
 * Era influence on a material, so the props follow the era palette without the
 * geometry code knowing anything about a period.
 */
export interface MaterialEraTint {
  /** Palette channel mixed into the base colour. */
  readonly channel: Exclude<keyof EraPalette, never>
  /** Mix weight, 0 = pure base colour, 1 = pure palette colour. */
  readonly amount: number
}

/** Declarative appearance of one material family. */
export interface MaterialSpec {
  readonly key: MaterialKey
  readonly label: string
  /** Base colour, `#rrggbb`. */
  readonly colour: string
  readonly roughness: number
  readonly metalness: number
  /** Self-emission of the material at full lamp strength, 0 = none. */
  readonly emissive: number
  /** Emissive colour override; lamps default to the era's artificial light. */
  readonly emissiveColour: string | null
  readonly opacity: number
  /** Era palette channel mixed into {@link colour}. */
  readonly eraTint: MaterialEraTint | null
  /** How strongly surface grime darkens this material, 0..1. */
  readonly grimeSensitivity: number
}

/** A material after era palette and wear resolution. */
export interface ResolvedPropMaterial {
  readonly key: MaterialKey
  readonly colour: string
  readonly roughness: number
  readonly metalness: number
  readonly emissive: number
  readonly emissiveColour: string
  readonly opacity: number
}

/* ------------------------------------------------------------------------- *
 * Condition and wear
 * ------------------------------------------------------------------------- */

/** Ordered condition of a prop's surface. */
export const WEAR_LEVELS = ['pristine', 'weathered', 'worn', 'decrepit'] as const

export type WearLevel = (typeof WEAR_LEVELS)[number]

/** How a period leaves its street furniture. All values are 0..1. */
export interface WearProfile {
  readonly level: WearLevel
  /** Soot, dust and grime: darkens and roughens every material. */
  readonly grime: number
  /** Chipped paint and cracked enamel. */
  readonly chips: number
  /** Rust bloom on ferrous parts. */
  readonly rust: number
  /** Sun-faded paint and bleached concrete. */
  readonly fade: number
  /** Tagged surfaces; the layer paints graffiti onto flagged props. */
  readonly graffiti: number
}

/* ------------------------------------------------------------------------- *
 * Geometry recipes
 * ------------------------------------------------------------------------- */

/** Primitive shapes the shared mesh builders know how to construct. */
export type PartShape =
  | { readonly kind: 'box'; readonly size: readonly [number, number, number] }
  | { readonly kind: 'cylinder'; readonly radius: number; readonly height: number; readonly segments?: number }
  | { readonly kind: 'cone'; readonly radius: number; readonly height: number; readonly segments?: number }
  | { readonly kind: 'sphere'; readonly radius: number; readonly segments?: number }
  | { readonly kind: 'torus'; readonly radius: number; readonly tube: number; readonly segments?: number }

/** Small-object taxonomy used by the detail census of a plan. */
export const DETAIL_KINDS = [
  'lamp-post',
  'lamp-head',
  'lamp-glass',
  'signal-pole',
  'signal-head',
  'signal-lens',
  'signal-cabinet',
  'hydrant-body',
  'drain',
  'grate',
  'vent',
  'drainpipe',
  'ac-unit',
  'signage-pole',
  'sign-face',
  'awning-frame',
  'seating',
  'bin',
  'bollard',
  'kiosk',
  'booth',
  'stand',
  'meter',
  'rack',
  'planter',
  'charger',
  'cabinet',
  'utility-fitting',
  'roof-detail',
  'barrier',
  'pile',
  'patch',
  'clutter',
  'crate',
  'cart',
  'shelter',
  'screen',
  'camera',
  'platform',
] as const

export type DetailKind = (typeof DETAIL_KINDS)[number]

/** One reusable primitive of the shared part catalogue. */
export interface PartDefinition {
  readonly id: string
  readonly label: string
  readonly shape: PartShape
  /** Detail census bucket this part counts into by default. */
  readonly detail: DetailKind
}

/** One part instance inside a prop recipe. */
export interface PropPart {
  readonly part: string
  readonly material: MaterialKey
  /**
   * Centre of the part in the recipe's local frame, in metres. `y = 0` is the
   * contact plane of the prop, so parts stack upwards from the ground.
   */
  readonly at: readonly [number, number, number]
  /** Euler rotation in radians, applied before {@link at}. */
  readonly rotate?: readonly [number, number, number]
  readonly scale?: readonly [number, number, number]
  /** Overrides the part's default detail bucket. */
  readonly detail?: DetailKind
}

/** Axis-aligned bounds of a recipe's geometry in its local frame. */
export interface PropBounds {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}

/** Lamp behaviour of a lighting recipe. */
export interface LampSpec {
  /** Technology the recipe is authored for; the era table states the period's. */
  readonly technology: LampTechnology
  /** Material of the emissive glass or diffuser. */
  readonly glassMaterial: MaterialKey
  /** Emission of the glass at full period strength. */
  readonly baseEmissive: number
  /** Radius of the emissive halo mesh in metres. */
  readonly glowRadius: number
  /** Point-light offset in the recipe's local frame. */
  readonly lightOffset: readonly [number, number, number]
}

/** A prop prototype: a list of shared parts plus its placement envelope. */
export interface PropRecipe {
  readonly id: string
  readonly label: string
  readonly category: PropCategory
  readonly slot: PropSlot
  readonly mount: PropMount
  readonly facing: PropFacing
  readonly parts: readonly PropPart[]
  /** Materials used, sorted, for palette inspection and cache keys. */
  readonly materials: readonly MaterialKey[]
  readonly bounds: PropBounds
  /**
   * Local point of the recipe that is pinned to the legal placement station.
   *
   * It defaults to the footprint centre, which is what a free-standing prop
   * wants; a prop that hangs off its post (a mast-arm signal) declares an offset
   * contact so the post still lands on its anchor.
   */
  readonly contact: readonly [number, number, number]
  /** Scale range the per-anchor jitter draws from. */
  readonly scaleRange: readonly [number, number]
  readonly footprint: { readonly width: number; readonly depth: number }
  readonly height: number
  /** Estimated triangles of one instance, from the shared part sizes. */
  readonly triangles: number
  readonly lamp: LampSpec | null
  /** How strongly the era's grime profile shows on this prop, 0..1. */
  readonly wearSensitivity: number
  readonly tags: readonly string[]
  readonly notes: string
}

/* ------------------------------------------------------------------------- *
 * Era tables
 * ------------------------------------------------------------------------- */

/** Lamp technologies in period order, oldest first. */
export const LAMP_TECHNOLOGIES = ['gas', 'incandescent', 'mercury-sodium', 'led', 'smart-pole'] as const

export type LampTechnology = (typeof LAMP_TECHNOLOGIES)[number]

/** How one era lights its streets. */
export interface EraLampTable {
  readonly technology: LampTechnology
  readonly label: string
  /** `true` takes the colour from the era's lighting data, `false` a fixed one. */
  readonly followsLighting: boolean
  /** Colour used when {@link followsLighting} is `false`. */
  readonly fixedColour: string | null
  /** Multiplier on the recipe's base emission. */
  readonly emissiveScale: number
  /** Multiplier on the lamp's point-light intensity. */
  readonly lightIntensityScale: number
  /** Highest number of lamps of one era that get a real point light. */
  readonly pointLightLimit: number
  /** Halo radius multiplier. */
  readonly glowScale: number
}

/** One period's prop catalogue: pools, lamp technology and wear. */
export interface EraPropTable {
  readonly eraId: EraId
  readonly label: string
  readonly lamp: EraLampTable
  /** Default condition of the period's street furniture. */
  readonly wear: WearProfile
  /** Per-prop condition overrides, e.g. a tagged mailbox in a tagged period. */
  readonly wearOverrides: Readonly<Record<string, Partial<WearProfile>>>
  /** Prop pool per anchor category; assign round-robin over the era's anchors. */
  readonly pools: Readonly<Record<PropSlot, readonly string[]>>
  /** Which slot each pool is required to fill, used by the coverage check. */
  readonly notes: string
}

/** First and last era a prop exists in; the layer's explicit retirement rule. */
export interface PropLifespan {
  readonly introducedIn: EraId
  /** Era after which the prop is retired, or `null` while it is still current. */
  readonly retiredAfter: EraId | null
}

/* ------------------------------------------------------------------------- *
 * Placement
 * ------------------------------------------------------------------------- */

/** Which legal sub-band of the sidewalk a prop was placed in. */
export type PropBand = 'facade-band' | 'kerb-band' | 'roof'

/** Lamp state of a placed prop, resolved from the era's lighting data. */
export interface PlacedLamp {
  readonly technology: LampTechnology
  readonly colour: string
  readonly emissiveIntensity: number
  readonly glowRadius: number
  /** True when this lamp also carries a real point light. */
  readonly light: boolean
  readonly lightIntensity: number
  readonly lightPosition: Vec3
}

/** One prop standing on one named layout anchor. */
export interface PlacedProp {
  /** Unique inside a plan: `anchor#slot#propId`. */
  readonly key: string
  readonly anchorName: string
  readonly anchorSlot: PropSlot
  readonly anchorKind: AnchorKind
  readonly ownerKind: 'parcel' | 'street' | 'corner'
  readonly ownerId: string
  readonly eraId: EraId
  readonly propId: string
  readonly category: PropCategory
  readonly mount: PropMount
  readonly label: string
  /** World position of the prop's local origin, metres. */
  readonly position: Vec3
  /** Y rotation in radians, snapped to the street grid. */
  readonly rotationY: number
  readonly scale: number
  /**
   * Placed footprint in the street's own frame, after {@link scale}: `width`
   * runs along the street, `depth` is the reach into the sidewalk band.
   */
  readonly footprint: { readonly width: number; readonly depth: number }
  readonly height: number
  /** World axis-aligned bounds of the placed geometry, for legality assertions. */
  readonly aabb: {
    readonly minX: number
    readonly maxX: number
    readonly minY: number
    readonly maxY: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly wear: WearProfile
  readonly materialPalette: readonly MaterialKey[]
  readonly lamp: PlacedLamp | null
  readonly detail: Readonly<Record<string, number>>
  readonly triangles: number
  /** Ground the prop stands on, or `roof` when it sits on a roof cap. */
  readonly band: PropBand
  /** Contact point of the footprint centre, for legality assertions. */
  readonly contact: { readonly x: number; readonly z: number }
  /** Deterministic per-prop stagger used by the staged era transition. */
  readonly stagger: number
  /** Weight inside the current plan; 1 for a settled era. */
  readonly weight: number
}

/** Why a plan is not legal; empty for every shipped era. */
export interface PropPlanIssue {
  readonly code:
    | 'unknown-anchor'
    | 'anchor-missing'
    | 'anchor-duplicated'
    | 'pool-empty'
    | 'pool-too-long'
    | 'unknown-prop'
    | 'unavailable-prop'
    | 'slot-mismatch'
    | 'off-sidewalk'
    | 'road-corridor'
    | 'building-overlap'
    | 'walking-band'
    | 'prop-overlap'
    | 'depth-over-band'
    | 'height-over-limit'
    | 'budget'
  readonly target: string
  readonly message: string
}

/** Censuses of one era's props. */
export interface PropsCensus {
  readonly byCategory: Readonly<Record<PropCategory, number>>
  readonly bySlot: Readonly<Record<PropSlot, number>>
  readonly byProp: Readonly<Record<string, number>>
  /** Props this era has that no neighbouring era has. */
  readonly uniqueToEra: readonly string[]
  readonly detail: Readonly<Record<string, number>>
}

/** Everything one era's placement produces. */
export interface PropsLayerPlan {
  readonly eraId: EraId
  readonly seed: number
  readonly seedInput: string | number
  readonly night: boolean
  readonly props: readonly PlacedProp[]
  readonly coverage: Readonly<Record<PropSlot, SlotCoverage>>
  readonly census: PropsCensus
  readonly issues: readonly PropPlanIssue[]
  readonly triangles: number
  readonly lamp: {
    readonly technology: LampTechnology
    readonly label: string
    readonly colour: string
    readonly emissiveIntensity: number
    readonly pointLights: number
    readonly pointLightIntensity: number
  }
  readonly wear: WearProfile
  readonly activeProps: readonly string[]
  readonly retiredProps: readonly string[]
}

/** Options shared by the planner, the runtime and the harness. */
export interface PropsPlanOptions {
  /** Era whose table places the props. */
  readonly eraId: EraId
  /** Block seed; the era id is folded in, so eras never share a placement. */
  readonly seed?: string | number
  /** Shared quality tier; scales optional detail, never anchor coverage. */
  readonly qualityTier?: 'high' | 'medium' | 'low'
  /** Explicit night state; defaults to the era's own sun elevation. */
  readonly night?: boolean
}

/* ------------------------------------------------------------------------- *
 * Staged transitions
 * ------------------------------------------------------------------------- */

/** Progress of one prop through a staged era switch. */
export type PropTransitionPhase = 'held' | 'persistent' | 'appearing' | 'retiring' | 'replaced'

/** One prop of a transition frame. */
export interface StagedProp {
  readonly prop: PlacedProp
  readonly phase: PropTransitionPhase
  /** 0 = fully retired, 1 = fully present. */
  readonly weight: number
  /** Which prop of which era this instance shows. */
  readonly source: 'from' | 'to' | 'both'
  readonly fromPropId: string | null
  readonly toPropId: string | null
  /** Blend factor of a transform between the two eras' placements. */
  readonly blend: number
}

/** A staged era switch, ready to be handed to the runtime. */
export interface PropsTransitionPlan {
  readonly from: EraId
  readonly to: EraId
  readonly t: number
  readonly reducedMotion: boolean
  readonly staged: boolean
  readonly props: readonly StagedProp[]
  readonly counts: {
    readonly held: number
    readonly persistent: number
    readonly appearing: number
    readonly retiring: number
    readonly replaced: number
    readonly hidden: number
  }
  readonly fromPlan: PropsLayerPlan
  readonly toPlan: PropsLayerPlan
}

/** Input of {@link import('./placement').planTransition}. */
export interface PropsTransitionInput {
  readonly from: EraId
  readonly to: EraId
  /** Blend progress in 0..1. */
  readonly t: number
  readonly reducedMotion?: boolean
}

/* ------------------------------------------------------------------------- *
 * Integration surface
 * ------------------------------------------------------------------------- */

/** What the layer reports back to the scene integration and the harness. */
export interface PropsLayerStats {
  readonly eraId: EraId
  readonly propCount: number
  readonly instanceCount: number
  readonly triangles: number
  readonly drawCalls: number
  readonly recipesUsed: number
  readonly byCategory: Readonly<Record<PropCategory, number>>
  readonly bySlot: Readonly<Record<PropSlot, number>>
  readonly detail: Readonly<Record<string, number>>
  readonly lamp: {
    readonly technology: LampTechnology
    readonly label: string
    readonly colour: string
    readonly emissiveIntensity: number
    readonly emissiveVisible: boolean
    readonly pointLights: number
    readonly pointLightIntensity: number
  }
  readonly coverage: {
    readonly anchors: number
    readonly placed: number
    readonly missing: readonly string[]
    readonly duplicated: readonly string[]
  }
  readonly issues: readonly PropPlanIssue[]
}

/**
 * Three.js-free re-export of the layout the layer is authored against.
 *
 * The runtime-facing integration types (`PropsApplyContext`, `PropsRuntimeOptions`,
 * `PropsRuntime`) live in `PropsLayer.tsx` with the runtime itself and are
 * re-exported by the layer barrel, so this contract file stays free of any
 * back-reference to the renderer bridge.
 */
export type PropsLayout = BlockLayout
