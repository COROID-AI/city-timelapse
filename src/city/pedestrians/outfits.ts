/**
 * Outfit resolution and shared geometry for the era crowd.
 *
 * Two jobs, both deterministic and testable without a renderer:
 *
 * 1. **Resolution.** Turn a {@link EraCrowdTable} plus one pedestrian's PRNG into
 *    a {@link ResolvedOutfit}: the era palette applied to every garment, one
 *    hairstyle, optional headwear, accessories and the props that person carries.
 *    Sampling happens once per (person, era) and is cached on the pedestrian, so
 *    an era switch never resamples and cross-dressing keeps identity.
 * 2. **Geometry.** Map every {@link PrimitiveShape} onto a *shared* three.js
 *    geometry through {@link shapeGeometryKey}. Identical garments therefore
 *    render as one instanced mesh whose per-instance colour carries the era
 *    palette, which is what keeps the crowd inside the draw-call budget.
 *
 * The triangle estimate and the built geometry agree by construction: both read
 * the same resolved radii, resolution and scaling, and the unit suite asserts
 * `shapeTriangleCount(shape) === geometry.getIndex().count / 3` for the whole
 * shape library.
 */

import * as THREE from 'three'
import type { QualityTierName } from '../../lib/quality'
import { hashStringToSeed, type Rng } from '../../lib/rng'
import { SKIN_TONES, shapeTriangleCount } from './bodies'
import { getCrowdTable } from './tables'
import type {
  EraCrowdTable,
  HexColor,
  OutfitItem,
  OutfitSet,
  PrimitiveShape,
  ResolvedGarment,
  ResolvedItem,
  ResolvedOutfit,
} from './types'
import type { EraId } from '../../era'

/* ------------------------------------------------------------------------- *
 * Quality tiers
 * ------------------------------------------------------------------------- */

/** How much detail of a look a quality tier renders. */
export interface TierDetail {
  /** Multiplier applied to the resolution of round shapes. */
  readonly segmentScale: number
  readonly hair: boolean
  readonly headwear: boolean
  readonly accessories: boolean
  readonly props: boolean
}

/**
 * Tier detail switches.
 *
 * Lower tiers keep the period silhouette — garments, hair and headwear — and
 * drop the small pieces that cost a draw call each without changing the era
 * read: sunglasses, earbuds and carried props. Every tier also lowers the
 * resolution of round shapes through `segmentScale`.
 */
export const TIER_DETAIL: Readonly<Record<QualityTierName, TierDetail>> = {
  high: { segmentScale: 1, hair: true, headwear: true, accessories: true, props: true },
  medium: { segmentScale: 0.8, hair: true, headwear: true, accessories: false, props: true },
  low: { segmentScale: 0.6, hair: true, headwear: true, accessories: false, props: false },
}

/** Detail switches of a quality tier. */
export function tierDetail(tier: QualityTierName): TierDetail {
  return TIER_DETAIL[tier] ?? TIER_DETAIL.high
}

/**
 * The shape as a tier renders it: identical in size and placement, with the
 * resolution of its round kinds scaled down for cheaper tiers.
 */
export function tierShape(shape: PrimitiveShape, tier: QualityTierName): PrimitiveShape {
  const detail = tierDetail(tier)
  if (shape.kind === 'box' || detail.segmentScale === 1) {
    return shape
  }
  const segments = Math.max(4, Math.round(shape.segments * detail.segmentScale))
  return segments === shape.segments ? shape : { ...shape, segments }
}

/* ------------------------------------------------------------------------- *
 * Geometry keys and estimates
 * ------------------------------------------------------------------------- */

function fixed(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(4)
}

/**
 * Stable key of the shared geometry a shape renders with.
 *
 * Placement (`offset`, `rotation`) is deliberately *not* part of the key: it is
 * applied through the instance matrix, so a left trouser leg and a right one, or
 * two mirror-image lapels, share one geometry and one draw call.
 */
export function shapeGeometryKey(shape: PrimitiveShape): string {
  return [shape.kind, fixed(shape.size[0]), fixed(shape.size[1]), fixed(shape.size[2]), shape.segments, fixed(shape.taper)].join('|')
}

/** Triangles a shape submits per instance on a tier. */
export function tierShapeTriangles(shape: PrimitiveShape, tier: QualityTierName): number {
  return shapeTriangleCount(tierShape(shape, tier))
}

/**
 * Builds the shared geometry of one shape.
 *
 * Every primitive is built at unit size and then scaled to `shape.size`, so the
 * triangle count of the result equals {@link shapeTriangleCount} of the same
 * shape — the property the unit suite asserts and the cost estimate relies on.
 */
export function buildShapeGeometry(shape: PrimitiveShape): THREE.BufferGeometry {
  const [width, height, depth] = shape.size
  switch (shape.kind) {
    case 'box': {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      geometry.scale(width, height, depth)
      return geometry
    }
    case 'cylinder':
    case 'tapered-cylinder':
    case 'cone': {
      const segments = Math.max(3, Math.round(shape.segments))
      const radius = Math.max(width, depth) / 2
      const geometry = new THREE.CylinderGeometry(radius * shape.taper, radius, height, segments, 1, false)
      return geometry
    }
    case 'sphere': {
      const segments = Math.max(3, Math.round(shape.segments))
      const heightSegments = Math.max(3, Math.round(segments / 2))
      const geometry = new THREE.SphereGeometry(1, segments, heightSegments)
      geometry.scale(width / 2, height / 2, depth / 2)
      // Non-uniform scaling needs recomputed normals to shade as an ellipsoid.
      geometry.computeVertexNormals()
      return geometry
    }
    case 'torus': {
      const segments = Math.max(3, Math.round(shape.segments))
      const tubularSegments = Math.max(3, Math.round(segments * 1.5))
      const radius = width / 2
      const tube = height / 2
      const geometry = new THREE.TorusGeometry(radius, tube, segments, tubularSegments)
      return geometry
    }
    default:
      return new THREE.BoxGeometry(width, height, depth)
  }
}

/** Material every costume mesh shares: flat procedural colour, matte cloth. */
export function createCostumeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.02,
    flatShading: false,
  })
}

/* ------------------------------------------------------------------------- *
 * Colours and digests
 * ------------------------------------------------------------------------- */

/** Resolves a palette index (wrapping) or a fixed hex colour. */
export function paletteColour(palette: readonly HexColor[], colour: number | HexColor): HexColor {
  if (typeof colour === 'number') {
    if (palette.length === 0) {
      return '#808080'
    }
    const index = ((Math.trunc(colour) % palette.length) + palette.length) % palette.length
    return palette[index] ?? '#808080'
  }
  return colour
}

const FNV_PRIME = 0x01000193
const FNV_OFFSET = 0x811c9dc5

function fnv1a32(input: string, basis: number): number {
  let hash = basis >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash >>> 0
}

/** Two-lane FNV-1a digest of an ordered token list, as 16 hex characters. */
export function digestTokens(tokens: readonly string[]): string {
  const serialised = tokens.join('\u0001')
  const low = fnv1a32(serialised, FNV_OFFSET)
  const high = fnv1a32(serialised, (hashStringToSeed('pedestrians') ^ serialised.length) >>> 0)
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

/* ------------------------------------------------------------------------- *
 * Outfit resolution
 * ------------------------------------------------------------------------- */

function pickById<T extends { readonly id: string }>(
  pool: readonly T[],
  ids: readonly string[],
  rng: Rng,
): T | null {
  const candidates = ids.length === 0 ? pool : pool.filter((candidate) => ids.includes(candidate.id))
  if (candidates.length === 0) {
    return null
  }
  return rng.pick(candidates)
}

function resolveGarment(
  layer: OutfitSet['layers'][number],
  palette: readonly HexColor[],
): ResolvedGarment {
  return {
    id: layer.id,
    slot: layer.slot,
    part: layer.part,
    shape: layer.shape,
    colour: paletteColour(palette, layer.colour),
  }
}

function resolveItem(item: OutfitItem, palette: readonly HexColor[]): ResolvedItem {
  return {
    id: item.id,
    label: item.label,
    part: item.part,
    shape: item.shape,
    colour: paletteColour(palette, item.colour),
  }
}

/** Options for {@link resolveOutfit}. */
export interface ResolveOutfitOptions {
  readonly table: EraCrowdTable
  /** Generator owned by this pedestrian and this era. */
  readonly rng: Rng
  /** Forces a specific look, used by tests and harness overrides. */
  readonly outfitKey?: string
}

/**
 * Dresses one pedestrian for one era.
 *
 * Everything that varies between two people in the same clothes is drawn here —
 * which of the five looks, which hairstyle, which side of the accessory and prop
 * pools — in a fixed draw order, so the result is reproducible.
 */
export function resolveOutfit(options: ResolveOutfitOptions): ResolvedOutfit {
  const { table, rng } = options
  const chosen =
    options.outfitKey === undefined
      ? rng.pick(table.outfits)
      : table.outfits.find((candidate) => candidate.key === options.outfitKey)
  if (chosen === undefined) {
    throw new RangeError(`Era ${table.eraId} has no outfit ${String(options.outfitKey)}`)
  }

  const palette = table.palette
  const hair = pickById(table.hair, chosen.hairIds, rng) ?? rng.pick(table.hair)
  const headwear = pickById(table.headwear, chosen.headwearIds, rng)
  const accessory = pickById(table.accessories, chosen.accessoryIds, rng)
  const propPool =
    chosen.propIds.length === 0
      ? [...table.props]
      : table.props.filter((item) => chosen.propIds.includes(item.id))
  const propCount = Math.min(Math.max(1, rng.int(1, 3)), Math.max(1, propPool.length))
  const props: OutfitItem[] = []
  for (let draw = 0; draw < propCount && propPool.length > 0; draw += 1) {
    const candidate = propPool[(rng.uint32() + draw) % propPool.length]
    if (candidate !== undefined && !props.some((existing) => existing.id === candidate.id)) {
      props.push(candidate)
    }
  }

  const garments = chosen.layers.map((layer) => resolveGarment(layer, palette))
  const accessories = accessory === null ? [] : [resolveItem(accessory, palette)]
  const resolvedProps = props.map((prop) => resolveItem(prop, palette))
  const signature = digestTokens([
    table.eraId,
    table.outfitEraTag,
    chosen.key,
    ...garments.map((garment) => `${garment.id}:${garment.colour}`),
    `hair:${hair.id}:${hair.colour}`,
    headwear === null ? 'headwear:none' : `headwear:${headwear.id}`,
    ...accessories.map((entry) => `accessory:${entry.id}:${entry.colour}`),
    ...resolvedProps.map((prop) => `prop:${prop.id}:${prop.colour}`),
  ])

  return {
    eraId: table.eraId,
    outfitKey: chosen.key,
    label: chosen.label,
    build: chosen.build,
    palette,
    garments,
    hair: {
      id: hair.id,
      label: hair.label,
      part: 'head',
      shape: hair.shape,
      colour: hair.colour,
    },
    headwear: headwear === null ? null : resolveItem(headwear, palette),
    accessories,
    props: resolvedProps,
    signature,
  }
}

/** Resolves a look for an era id, with a generator the caller owns. */
export function resolveOutfitForEra(eraId: EraId, rng: Rng, outfitKey?: string): ResolvedOutfit {
  return resolveOutfit({ table: getCrowdTable(eraId), rng, outfitKey })
}

/* ------------------------------------------------------------------------- *
 * Cross-era measurement
 * ------------------------------------------------------------------------- */

/**
 * Appearance tokens of a whole era table.
 *
 * A token is one garment, hairstyle, headwear item, accessory or prop at the
 * resolution and colour it renders with. Two eras that share many tokens look
 * alike on screen; the unit suite measures the Jaccard distance between eras
 * with these sets, which is what "adjacent eras differ measurably" means here.
 */
export function tableAppearanceTokens(table: EraCrowdTable): readonly string[] {
  const tokens = new Set<string>()
  for (const look of table.outfits) {
    for (const layer of look.layers) {
      tokens.add(`garment:${shapeGeometryKey(tierShape(layer.shape, 'high'))}:${paletteColour(table.palette, layer.colour)}`)
    }
  }
  for (const style of table.hair) {
    tokens.add(`hair:${shapeGeometryKey(tierShape(style.shape, 'high'))}:${style.colour}`)
  }
  for (const pool of [table.headwear, table.accessories, table.props]) {
    for (const entry of pool) {
      tokens.add(`${entry.label}:${shapeGeometryKey(tierShape(entry.shape, 'high'))}:${paletteColour(table.palette, entry.colour)}`)
    }
  }
  return [...tokens].sort()
}

/** Jaccard distance of two eras' appearance tokens, in `[0, 1]`. */
export function tableAppearanceDistance(left: EraCrowdTable, right: EraCrowdTable): number {
  const a = new Set(tableAppearanceTokens(left))
  const b = new Set(tableAppearanceTokens(right))
  let shared = 0
  for (const token of a) {
    if (b.has(token)) {
      shared += 1
    }
  }
  const union = a.size + b.size - shared
  return union === 0 ? 0 : 1 - shared / union
}

/** Stable digest of one era's whole crowd table, used to prove eras differ. */
export function crowdTableSignature(table: EraCrowdTable): string {
  return digestTokens([
    table.eraId,
    table.outfitEraTag,
    `density:${table.density}`,
    `gait:${table.gait.speedMps}:${table.gait.strideLengthM}:${table.gait.posture}`,
    ...table.palette,
    ...table.outfits.map((look) => `${look.key}:${look.layers.map((layer) => layer.id).join(',')}`),
    ...table.hair.map((style) => style.id),
    ...table.headwear.map((entry) => entry.id),
    ...table.accessories.map((entry) => entry.id),
    ...table.props.map((entry) => entry.id),
  ])
}

/* ------------------------------------------------------------------------- *
 * Costume geometry pool
 * ------------------------------------------------------------------------- */

/** One pooled instanced mesh: shared geometry, per-instance colour. */
export interface CostumeMesh {
  readonly geometryKey: string
  readonly geometry: THREE.BufferGeometry
  readonly material: THREE.Material
  readonly mesh: THREE.InstancedMesh
  readonly instanceMatrices: Float32Array
  readonly instanceColours: Float32Array
  readonly capacity: number
}

/**
 * Creates a pooled instanced mesh for one shared geometry.
 *
 * The instance buffers are owned by the caller's instance collector, so a frame
 * writes matrices and colours in place and only flips the update flags — no
 * per-frame allocation, no per-pedestrian geometry.
 */
export function createCostumeMesh(
  geometryKey: string,
  shape: PrimitiveShape,
  capacity: number,
  material: THREE.Material,
  instanceMatrices?: Float32Array,
  instanceColours?: Float32Array,
): CostumeMesh {
  const geometry = buildShapeGeometry(shape)
  const matrices = instanceMatrices ?? new Float32Array(capacity * 16)
  const colours = instanceColours ?? new Float32Array(capacity * 3)
  const mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.instanceMatrix = new THREE.InstancedBufferAttribute(matrices, 16)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colours, 3)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.count = 0
  mesh.visible = false
  mesh.name = geometryKey
  return {
    geometryKey,
    geometry,
    material,
    mesh,
    instanceMatrices: matrices,
    instanceColours: colours,
    capacity,
  }
}

/** Releases the GPU resources of a costume mesh. */
export function disposeCostumeMesh(costume: CostumeMesh): void {
  costume.mesh.dispose()
  costume.geometry.dispose()
}

/**
 * Every geometry key a tier needs for one era, with the shape to build it from.
 *
 * Used by the renderer to pre-create its pool and by tests to assert that only
 * shared geometry exists: the pool is far smaller than the crowd it dresses.
 */
export function costumeGeometryLibrary(
  eraId: EraId,
  tier: QualityTierName,
): ReadonlyMap<string, PrimitiveShape> {
  const detail = tierDetail(tier)
  const library = new Map<string, PrimitiveShape>()
  const add = (shape: PrimitiveShape): void => {
    const scaled = tierShape(shape, tier)
    library.set(shapeGeometryKey(scaled), scaled)
  }
  const table = getCrowdTable(eraId)
  for (const look of table.outfits) {
    for (const layer of look.layers) {
      add(layer.shape)
    }
  }
  if (detail.hair) {
    for (const style of table.hair) {
      add(style.shape)
    }
  }
  if (detail.headwear) {
    for (const entry of table.headwear) {
      add(entry.shape)
    }
  }
  if (detail.accessories) {
    for (const entry of table.accessories) {
      add(entry.shape)
    }
  }
  if (detail.props) {
    for (const entry of table.props) {
      add(entry.shape)
    }
  }
  return library
}

/** Skin colour of one pedestrian, drawn from the shared palette. */
export function skinToneAt(index: number): HexColor {
  const tone = SKIN_TONES[Math.abs(Math.trunc(index)) % SKIN_TONES.length]
  return tone ?? '#c98f66'
}
