/**
 * Canonical city-block coordinate system and the layout data contract.
 *
 * ## Coordinate system (frozen — never rescaled after this task)
 *
 * - One world unit is exactly one metre ({@link METRES_PER_UNIT}). Every
 *   content layer (buildings, storefronts, vehicles, pedestrians, props) sizes
 *   its geometry against these numbers, so the scale is a contract, not a knob.
 * - `+Y` is up. The block is authored on the `y = 0` ground plane; the road
 *   surface sits at `y = 0` and the sidewalk/curb deck at `y = CURB_HEIGHT`.
 * - `+X` points east and `+Z` points south (three.js right-handed frame), so
 *   north is `-Z` and west is `-X`.
 * - The origin is the centre of the block. The sidewalk/curb square spans
 *   `-60 … +60` on both horizontal axes, and the four carriageways around it
 *   reach out to `-80 … +80`.
 *
 * ```
 *                north street (z = -70 centre line, block-side lanes travel east)
 *        ┌──────────────────────────────────────────────────────────┐
 *        │  carriageway 20 m wide: 2.5 parking | 2×3.5 lanes | 2.5    │
 *        └──────────────────────────────────────────────────────────┘
 *   -80         -60        -56                       +56       +60   +80
 *        kerb ── 4 m sidewalk ── ┤  112 × 112 m parcel zone  ├── 4 m sidewalk ── kerb
 *        └──────────────────────────────────────────────────────────┘
 *        ┌──────────────────────────────────────────────────────────┐
 *                south street (z = +70 centre line, block-side lanes travel west)
 * ```
 *
 * ## Naming scheme (stable — names are never renumbered)
 *
 * Anchors (`parcel:<column><row>:<role>:<index>`, `street:<street>:<role>:<index>`,
 * `corner:<corner>:<role>:<index>`) and meshes are addressed by string, so
 * content layers can attach to `parcel:B2:storefront:1` or `street:north:light:3`
 * without knowing anything about generation order. See {@link ANCHOR_NAME_PATTERN}
 * and the `NAMING_SCHEME` comment inside {@link MeshData}.
 */

import { QUALITY_TIERS, type QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'

/* ------------------------------------------------------------------------- *
 * Identity and units
 * ------------------------------------------------------------------------- */

/** Schema version of the serialised layout payload. */
export const LAYOUT_VERSION = 1

/** One world unit is one metre. Never rescale. */
export const METRES_PER_UNIT = 1

/** Seed used when a caller does not supply one. */
export const DEFAULT_LAYOUT_SEED: Seed = 'city-block'

/** Machine-readable description of the frozen coordinate convention. */
export interface CoordinateSystemDoc {
  readonly units: 'metres'
  readonly metresPerUnit: number
  readonly up: '+y'
  readonly east: '+x'
  readonly south: '+z'
  readonly north: '−z'
  readonly west: '−x'
  readonly origin: 'block centre on the y = 0 ground plane'
  readonly blockExtent: '±60 m kerb square, ±80 m world extent'
  readonly parcelExtent: '±56 m build line square'
  readonly cardinality: 'north/east/south/west, listed clockwise'
  readonly rescaling: 'frozen: layout, props and figures all author in metres'
}

/** The frozen coordinate convention, exposed as data for content layers. */
export const COORDINATE_SYSTEM: CoordinateSystemDoc = {
  units: 'metres',
  metresPerUnit: METRES_PER_UNIT,
  up: '+y',
  east: '+x',
  south: '+z',
  north: '−z',
  west: '−x',
  origin: 'block centre on the y = 0 ground plane',
  blockExtent: '±60 m kerb square, ±80 m world extent',
  parcelExtent: '±56 m build line square',
  cardinality: 'north/east/south/west, listed clockwise',
  rescaling: 'frozen: layout, props and figures all author in metres',
}

/* ------------------------------------------------------------------------- *
 * Block dimensions
 * ------------------------------------------------------------------------- */

/** Side length of the kerb-to-kerb block square (metres). */
export const BLOCK_SIZE = 120

/** Half of {@link BLOCK_SIZE}: the kerb line of every street is here. */
export const BLOCK_HALF = BLOCK_SIZE / 2

/** Uniform sidewalk width between the build line and the kerb. */
export const SIDEWALK_WIDTH = 4

/**
 * Kerb corner fillet radius. Equal to the sidewalk width so the fillet arc is
 * tangent to both kerbs and centred exactly on the matching build-line corner.
 */
export const CORNER_RADIUS = SIDEWALK_WIDTH

/** Distance from the block centre to the build line (parcel zone edge). */
export const BUILD_LINE = BLOCK_HALF - SIDEWALK_WIDTH

/** Carriageway width from kerb to kerb. */
export const ROAD_WIDTH = 20

/** Half carriageway width. */
export const ROAD_HALF = ROAD_WIDTH / 2

/** Width of one travel lane. */
export const LANE_WIDTH = 3.5

/** Width of one curbside parking strip. */
export const PARKING_WIDTH = 2.5

/** Lane offsets from the street centre line: block side is positive. */
export const LANE_OFFSETS = {
  /** Centre of the curbside (slow) lane. */
  kerb: ROAD_HALF - PARKING_WIDTH - LANE_WIDTH / 2,
  /** Centre of the inner (fast) lane. */
  inner: ROAD_HALF - PARKING_WIDTH - LANE_WIDTH - LANE_WIDTH / 2,
  /** Centre of the parking strip. */
  parking: ROAD_HALF - PARKING_WIDTH / 2,
} as const

/** Lane boundary line offset between the two block-side lanes. */
export const LANE_BOUNDARY_OFFSET = LANE_OFFSETS.kerb - LANE_WIDTH / 2

/** Coordinate of every street centre line (absolute value). */
export const STREET_CENTRE = BLOCK_HALF + ROAD_HALF

/** Half extent of the generated world along each horizontal axis. */
export const WORLD_HALF = BLOCK_HALF + ROAD_WIDTH

/** Height of the sidewalk deck above the carriageway. */
export const CURB_HEIGHT = 0.15

/**
 * Height of the raised block deck the parcels and sidewalks sit on. The parcels
 * and the sidewalk ring are one continuous platform one kerb height above the
 * carriageway, so buildings, props and figures all stand on `y = CURB_HEIGHT`.
 */
export const BLOCK_DECK_HEIGHT = CURB_HEIGHT

/** How far inside the kerb pedestrians walk along the sidewalk. */
export const SIDEWALK_WALK_LINE = BLOCK_HALF - SIDEWALK_WIDTH / 2

/** Vertical offset used for flat surface detail, so it never z-fights the road. */
export const MARKING_LIFT = 0.012

/** Columns of the parcel grid, west to east. */
export const PARCEL_COLUMNS = ['A', 'B', 'C', 'D'] as const

/** Rows of the parcel grid, north to south. */
export const PARCEL_ROWS = [1, 2, 3, 4] as const

/** Edge length of one square parcel cell. */
export const PARCEL_SIZE = (BUILD_LINE * 2) / PARCEL_COLUMNS.length

/** Storey height of the upper floors of a parcel building. */
export const FLOOR_HEIGHT = 3.6

/** Storey height of the ground floor, where the storefront bays live. */
export const GROUND_FLOOR_HEIGHT = 4.6

/** Target width of a storefront bay; bays subdivide a facade edge evenly. */
export const STOREFRONT_BAY_WIDTH = 4.5

/** Absolute along-street coordinate that still carries lane markings. */
export const MARKING_CLEAR_ZONE = 52

/** Uniform sampling resolution of the exported path splines, in metres. */
export const SPLINE_SAMPLE_SPACING = {
  vehicle: 3,
  pedestrian: 1.5,
} as const

/* ------------------------------------------------------------------------- *
 * Triangle budget (layout share of the shared quality tiers)
 * ------------------------------------------------------------------------- */

/**
 * Static-geometry budget for the block shell, keyed by the shared quality tier
 * names from `src/lib/quality.ts`. The layout is only the ground plane, its
 * surfaces and street furniture marks; everything else in the scene is era
 * content, so the shell must stay cheap at every tier.
 */
export const LAYOUT_TRIANGLE_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 4_000,
  medium: 3_200,
  low: 2_400,
}

/** Resolves the shell triangle budget for a quality tier. */
export function layoutTriangleBudget(tier: QualityTierName): number {
  return LAYOUT_TRIANGLE_BUDGETS[tier]
}

/** Density multiplier used when no explicit `detail` option is supplied. */
export function defaultDetail(tier: QualityTierName): number {
  return QUALITY_TIERS[tier].density.props
}

/* ------------------------------------------------------------------------- *
 * Vector helpers
 * ------------------------------------------------------------------------- */

/** Ground-plane position: `x` is east, `z` is south. */
export interface Vec2 {
  readonly x: number
  readonly z: number
}

/** Full position: `x` east, `y` up, `z` south, in metres. */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Creates a ground-plane vector. */
export function v2(x: number, z: number): Vec2 {
  return { x, z }
}

/** Creates a world vector. */
export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

/** Clamps `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Rounds to `digits` decimals. Every coordinate the layout publishes goes
 * through this, which keeps serialised output byte-identical across runs and
 * hides sub-micrometre floating point noise.
 */
export function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Rounds every component of a world vector. */
export function roundVec3(value: Vec3, digits = 3): Vec3 {
  return v3(round(value.x, digits), round(value.y, digits), round(value.z, digits))
}

/** Euclidean length of a world vector. */
export function vec3Length(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z)
}

/** Unit vector in the direction of `value`; zero vectors stay zero. */
export function normalizeVec3(value: Vec3): Vec3 {
  const length = vec3Length(value)
  if (length === 0) {
    return v3(0, 0, 0)
  }
  return v3(value.x / length, value.y / length, value.z / length)
}

/** Dot product of two world vectors. */
export function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Cross product of two world vectors. */
export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

/* ------------------------------------------------------------------------- *
 * Streets, corners and parcels
 * ------------------------------------------------------------------------- */

/** The four streets around the block, in clockwise order. */
export const STREET_NAMES = ['north', 'east', 'south', 'west'] as const

export type StreetName = (typeof STREET_NAMES)[number]

/** The four block corners, in clockwise order. */
export const CORNER_NAMES = ['north-east', 'south-east', 'south-west', 'north-west'] as const

export type CornerName = (typeof CORNER_NAMES)[number]

/** One street of the canonical block. */
export interface StreetDescriptor {
  readonly name: StreetName
  /** Axis the carriageway runs along. */
  readonly axis: 'x' | 'z'
  /** Axis the street is measured across (the other horizontal axis). */
  readonly acrossAxis: 'x' | 'z'
  /** Signed coordinate of the street centre line on {@link acrossAxis}. */
  readonly centre: number
  /** Sign that turns a positive lane offset (toward the block) into {@link acrossAxis} motion. */
  readonly acrossSign: 1 | -1
  /** Unit direction of the block-side lanes (block-clockwise circulation). */
  readonly direction: Vec3
  /** Unit normal pointing away from the block, across the carriageway. */
  readonly outward: Vec3
  /** Kerb line coordinate (absolute) on {@link acrossAxis}. */
  readonly kerb: number
  /** The two corners at the ends of the street, ordered by increasing along-axis coordinate. */
  readonly corners: readonly [CornerName, CornerName]
}

/** Position on a street: `along` is the world coordinate on the street axis. */
export function streetPoint(street: StreetDescriptor, along: number, offset: number): Vec3 {
  const across = street.centre + offset * street.acrossSign
  return street.axis === 'x' ? v3(along, 0, across) : v3(across, 0, along)
}

/** Ground surface a world position belongs to. */
export type GroundClass = 'parcel' | 'sidewalk' | 'roadway' | 'outside'

/**
 * Classifies a ground position. The kerb line itself belongs to the carriageway
 * (`roadway`), so the strips and crosswalk marks that end exactly on it are all
 * on the road. `roadway` also covers the four intersection squares and the
 * radiused corner aprons where the kerb cuts the block corner; `sidewalk` is the
 * 4 m ring inside the kerbs, including its corner quarter discs.
 */
export function classifyGround(x: number, z: number): GroundClass {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax > WORLD_HALF || az > WORLD_HALF) {
    return 'outside'
  }
  if (ax < BUILD_LINE && az < BUILD_LINE) {
    return 'parcel'
  }
  if (ax >= BLOCK_HALF || az >= BLOCK_HALF) {
    return 'roadway'
  }
  if (ax > BUILD_LINE && az > BUILD_LINE) {
    // Corner square: the kerb fillet disc is sidewalk, the outside is the apron.
    return Math.hypot(ax - BUILD_LINE, az - BUILD_LINE) <= CORNER_RADIUS ? 'sidewalk' : 'roadway'
  }
  return 'sidewalk'
}

/* ------------------------------------------------------------------------- *
 * Parcels
 * ------------------------------------------------------------------------- */

/** Axis-aligned rectangle on the ground plane, plus its size. */
export interface FootprintRect {
  readonly min: Vec2
  readonly max: Vec2
  readonly width: number
  readonly depth: number
  readonly area: number
}

/** Building-line insets (metres) applied to each edge of a parcel cell. */
export interface ParcelSetbacks {
  readonly north: number
  readonly east: number
  readonly south: number
  readonly west: number
}

/** How much building a parcel can carry; era layers decide the actual massing. */
export interface ParcelCapacity {
  readonly footprintArea: number
  readonly maxHeight: number
  readonly floors: number
  readonly groundFloorHeight: number
  readonly upperFloorHeight: number
  readonly buildableVolume: number
  readonly use: 'commercial' | 'mixed' | 'residential' | 'civic'
}

/** One ground-floor retail bay on a street-facing facade edge. */
export interface StorefrontBay {
  /** Stable anchor name, e.g. `parcel:B2:storefront:3`. */
  readonly name: string
  /** 1-based index within the parcel, numbered along the canonical edge order. */
  readonly index: number
  readonly street: StreetName
  /** Facade line the bay sits on, in metres. */
  readonly from: Vec2
  readonly to: Vec2
  readonly centre: Vec2
  readonly width: number
  readonly height: number
  /** Outward-facing unit normal (toward the street). */
  readonly normal: Vec3
  readonly area: number
}

/** A parcel cell of the block grid plus its building envelope. */
export interface Parcel {
  /** Stable id such as `A1` (column letter + row number). */
  readonly id: string
  readonly column: (typeof PARCEL_COLUMNS)[number]
  readonly row: (typeof PARCEL_ROWS)[number]
  /** Full 28 × 28 m grid cell; the grid tiles the parcel zone exactly. */
  readonly cell: FootprintRect
  readonly setbacks: ParcelSetbacks
  readonly footprint: FootprintRect
  readonly capacity: ParcelCapacity
  /** Streets this parcel fronts, in canonical street order. */
  readonly facing: readonly StreetName[]
  readonly corner: CornerName | null
  readonly bays: readonly StorefrontBay[]
}

/* ------------------------------------------------------------------------- *
 * Path splines
 * ------------------------------------------------------------------------- */

/** What a spline is for; content layers animate the matching agent kind. */
export type SplineRole = 'traffic-lane' | 'parking-lane' | 'sidewalk-loop' | 'crossing'

/** Direction of circulation around the block. */
export type Circulation = 'block-clockwise' | 'counter-clockwise'

/**
 * Closed, uniformly sampled path. Positions and tangents are flat `x, y, z`
 * triplets so any animator (three.js or not) can consume them: sample `i` is at
 * `positions[i * 3 … i * 3 + 2]` with tangent `tangents[i * 3 …]`, and
 * `distances[i]` is its arc length from the loop start.
 */
export interface PathSpline {
  readonly name: string
  readonly kind: 'vehicle' | 'pedestrian'
  readonly role: SplineRole
  readonly closed: true
  /** Arc length between consecutive samples; the same for every sample. */
  readonly sampleSpacing: number
  /** Number of samples; the loop wraps from the last sample back to the first. */
  readonly sampleCount: number
  /** Total loop length in metres (`sampleCount * sampleSpacing`). */
  readonly length: number
  readonly positions: readonly number[]
  readonly tangents: readonly number[]
  readonly distances: readonly number[]
  /** Lane offset from the street centre line for lane paths, else `null`. */
  readonly laneOffset: number | null
  readonly laneWidth: number | null
  readonly circulation: Circulation | null
  /** Streets the loop traverses, in traversal order and without repetition. */
  readonly streets: readonly StreetName[]
}

/** A pedestrian crossing loop and the waypoints its owners pause at. */
export interface CrossingPath {
  readonly name: string
  readonly corner: CornerName
  readonly street: StreetName
  /** Name of the sampled {@link PathSpline} that walks this crossing. */
  readonly spline: string
  /** Crossing band width across the carriageway. */
  readonly width: number
  /** Clear crossing span from kerb to kerb (the carriageway width). */
  readonly span: number
  /** Where the loop enters and leaves the carriageway, at the kerb line. */
  readonly crossingPoints: readonly Vec3[]
  /** Pause positions at the block kerb and at the far kerb. */
  readonly waitingPoints: readonly Vec3[]
}

/* ------------------------------------------------------------------------- *
 * Mesh data
 * ------------------------------------------------------------------------- */

/** Named mesh groups a renderer or content layer can address individually. */
export const MESH_GROUPS = [
  'parcels',
  'roads',
  'lane-strips',
  'parking-strips',
  'sidewalks',
  'curbs',
  'crosswalks',
  'drainage',
] as const

export type MeshGroup = (typeof MESH_GROUPS)[number]

/** Era-neutral surface keys; content layers own the actual period materials. */
export const MATERIAL_KEYS = [
  'ground',
  'asphalt',
  'lane-surface',
  'parking-surface',
  'marking',
  'sidewalk',
  'curb',
  'crosswalk',
  'metal',
] as const

export type MaterialKey = (typeof MATERIAL_KEYS)[number]

/**
 * Flat, engine-agnostic mesh data.
 *
 * Mesh names follow `surface:parcel:<id>`, `surface:road:<street>`,
 * `surface:road:intersection:<corner>`, `surface:road:apron:<corner>`,
 * `surface:sidewalk:<street>`, `surface:sidewalk:corner:<corner>`,
 * `curb:<street>`, `crosswalk:<corner>:<street>`,
 * `street:<street>:lane:<index>`, `street:<street>:parking:<index>`,
 * `street:<street>:divider:<index>`, `street:<street>:parking-tick:<index>`,
 * `manhole:<street>:<index>` and `drain:<street>:<index>`.
 */
export interface MeshData {
  readonly name: string
  readonly group: MeshGroup
  readonly materialKey: MaterialKey
  /** Triangles: `indices.length / 3`. */
  readonly triangles: number
  readonly positions: readonly number[]
  readonly indices: readonly number[]
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 }
  /** True when the surface is a raised strip rather than a ground plane. */
  readonly raised: boolean
}

/* ------------------------------------------------------------------------- *
 * Anchors
 * ------------------------------------------------------------------------- */

/** Anchor roles content layers attach to by name. */
export const ANCHOR_KINDS = [
  'storefront-bay',
  'sign-mount',
  'prop-point',
  'light-post',
  'signal-head',
  'hydrant',
  'utility-endpoint',
  'parking-bay',
  'inspection-focus',
] as const

export type AnchorKind = (typeof ANCHOR_KINDS)[number]

/** Who owns an anchor, so layers can filter without parsing names. */
export interface AnchorOwner {
  readonly kind: 'parcel' | 'street' | 'corner'
  /** Parcel id, street name or corner name. */
  readonly id: string
}

/** One entry of the flat anchor catalogue. */
export interface Anchor {
  /** Stable, unique, never renumbered. */
  readonly name: string
  readonly kind: AnchorKind
  readonly owner: AnchorOwner
  readonly position: Vec3
  /** Unit outward normal (the direction the anchor faces), or zero when free. */
  readonly normal: Vec3
  /** Optional footprint hint in metres. */
  readonly size: { readonly width: number; readonly height: number } | null
  /** Street the anchor faces, when that is meaningful. */
  readonly facing: StreetName | null
  /** Free-form role hints, era-independent. */
  readonly tags: readonly string[]
}

/** Overhead utility run between two utility endpoints. */
export interface UtilityLine {
  readonly name: string
  readonly street: StreetName
  /** Anchor name of the start utility endpoint. */
  readonly from: string
  /** Anchor name of the end utility endpoint. */
  readonly to: string
  readonly height: number
  readonly sag: number
}

/** Every anchor name matches this scheme. */
export const ANCHOR_NAME_PATTERN =
  /^(?:parcel:[A-D][1-4]:[a-z-]+:\d+|street:(?:north|east|south|west):[a-z-]+:\d+|corner:(?:north|south)-(?:east|west):[a-z-]+:\d+)$/

/* ------------------------------------------------------------------------- *
 * The layout record
 * ------------------------------------------------------------------------- */

/** Counters published with every generated block. */
export interface LayoutStats {
  readonly parcelCount: number
  readonly streetFacingParcelCount: number
  readonly storefrontBayCount: number
  readonly anchorCount: number
  readonly anchorsByKind: Readonly<Record<AnchorKind, number>>
  readonly vehicleSplineCount: number
  readonly pedestrianSplineCount: number
  readonly crossingCount: number
  readonly splineSampleCount: number
  readonly meshCount: number
  readonly triangleCount: number
  readonly triangleBudget: number
}

/** The complete, serialisable canonical block. */
export interface BlockLayout {
  readonly version: number
  readonly seed: number
  readonly seedInput: Seed
  readonly tier: QualityTierName
  readonly detail: number
  readonly coordinateSystem: CoordinateSystemDoc
  readonly streets: readonly StreetDescriptor[]
  readonly parcels: readonly Parcel[]
  readonly vehicleSplines: readonly PathSpline[]
  readonly pedestrianSplines: readonly PathSpline[]
  readonly crossings: readonly CrossingPath[]
  readonly anchors: readonly Anchor[]
  readonly utilityLines: readonly UtilityLine[]
  readonly meshes: readonly MeshData[]
  readonly stats: LayoutStats
}

/** Options accepted by the generator; defaults reproduce the canonical block. */
export interface LayoutOptions {
  /** Quality tier that selects the shell triangle budget and default detail. */
  readonly tier?: QualityTierName
  /** Decoration density multiplier (0.2 … 1.5). Defaults to the tier's prop density. */
  readonly detail?: number
  /** Vehicle spline sampling resolution in metres. */
  readonly vehicleSpacing?: number
  /** Pedestrian spline sampling resolution in metres. */
  readonly pedestrianSpacing?: number
}
