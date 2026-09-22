/**
 * Deterministic assembly of the canonical city block.
 *
 * `generateBlock(seed)` is a pure function: it forks the scaffold's seeded PRNG
 * per subsystem (parcels, roads, anchors), never reads `Math.random`, `Date` or
 * any environment state, and never depends on the iteration order of a `Map` or
 * plain object — every published list is ordered by construction or sorted by
 * name. The same seed therefore always produces byte-identical serialised
 * output (see `serializeLayout`/`layoutHash` in `index.ts`).
 *
 * Everything the generator publishes is era-agnostic: geometry, capacity,
 * splines and anchors only. No material, colour, text or period-specific prop is
 * created here, so all five era content layers dress the same block.
 */

import { isQualityTierName, type QualityTierName } from '../../lib/quality'
import { createRng, normalizeSeed, type Seed } from '../../lib/rng'
import { buildAnchors } from './anchors'
import { buildParcels } from './parcels'
import { STREETS, buildParcelDeckMeshes, buildRoadMeshes, sortShellMeshes } from './roads'
import { buildSplines } from './splines'
import {
  ANCHOR_KINDS,
  ANCHOR_NAME_PATTERN,
  COORDINATE_SYSTEM,
  DEFAULT_LAYOUT_SEED,
  LAYOUT_VERSION,
  SPLINE_SAMPLE_SPACING,
  clamp,
  defaultDetail,
  layoutTriangleBudget,
  round,
  type AnchorKind,
  type BlockLayout,
  type LayoutOptions,
  type LayoutStats,
  type MeshData,
} from './types'

/** Smallest and largest accepted detail multiplier. */
const DETAIL_RANGE = { min: 0.2, max: 1.5 } as const

/** Resolves the quality tier and the decoration density of a generation run. */
export function resolveLayoutOptions(options: LayoutOptions = {}): {
  readonly tier: QualityTierName
  readonly detail: number
  readonly vehicleSpacing: number
  readonly pedestrianSpacing: number
} {
  const tier = isQualityTierName(options.tier) ? options.tier : 'high'
  const detail = clamp(options.detail ?? defaultDetail(tier), DETAIL_RANGE.min, DETAIL_RANGE.max)
  return {
    tier,
    detail: round(detail, 4),
    vehicleSpacing: options.vehicleSpacing ?? SPLINE_SAMPLE_SPACING.vehicle,
    pedestrianSpacing: options.pedestrianSpacing ?? SPLINE_SAMPLE_SPACING.pedestrian,
  }
}

/** Throws when two entries share a name; names are the public contract. */
function assertUniqueNames(values: readonly { readonly name: string }[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.name)) {
      throw new Error(`Duplicate ${label} name: ${value.name}`)
    }
    seen.add(value.name)
  }
}

/** Throws when an anchor name does not match the documented scheme. */
function assertAnchorNames(anchors: readonly { readonly name: string }[]): void {
  for (const anchor of anchors) {
    if (!ANCHOR_NAME_PATTERN.test(anchor.name)) {
      throw new Error(`Anchor name does not match the documented scheme: ${anchor.name}`)
    }
  }
}

/** Throws when the shell exceeds the shell budget of its quality tier. */
function assertTriangleBudget(meshes: readonly MeshData[], budget: number): number {
  const triangles = meshes.reduce((total, mesh) => total + mesh.triangles, 0)
  if (triangles > budget) {
    throw new RangeError(
      `Block shell uses ${triangles} triangles, above its budget of ${budget}`,
    )
  }
  return triangles
}

function anchorsByKind(anchors: readonly { readonly kind: AnchorKind }[]): Record<AnchorKind, number> {
  const counts = Object.fromEntries(ANCHOR_KINDS.map((kind) => [kind, 0])) as Record<
    AnchorKind,
    number
  >
  for (const anchor of anchors) {
    counts[anchor.kind] += 1
  }
  return counts
}

/**
 * Generates the canonical block.
 *
 * @param seed Integer or string seed; the default reproduces the canonical
 *   block every era layer was authored against.
 * @param options Quality tier, decoration density and spline resolutions.
 */
export function generateBlock(
  seed: Seed = DEFAULT_LAYOUT_SEED,
  options: LayoutOptions = {},
): BlockLayout {
  const resolved = resolveLayoutOptions(options)
  const root = createRng(seed, 'city-block-layout')

  const parcels = buildParcels(root.fork('parcels'))
  const meshes = sortShellMeshes([
    ...buildParcelDeckMeshes(parcels),
    ...buildRoadMeshes(resolved.detail, root.fork('roads')),
  ])
  const splines = buildSplines(resolved.vehicleSpacing, resolved.pedestrianSpacing)
  const { anchors, utilityLines } = buildAnchors(parcels, root.fork('anchors'))

  const budget = layoutTriangleBudget(resolved.tier)
  const triangleCount = assertTriangleBudget(meshes, budget)
  assertUniqueNames(meshes, 'mesh')
  assertUniqueNames(anchors, 'anchor')
  assertUniqueNames([...splines.vehicles, ...splines.pedestrians], 'spline')
  assertAnchorNames(anchors)

  const allSplines = [...splines.vehicles, ...splines.pedestrians]
  const stats: LayoutStats = {
    parcelCount: parcels.length,
    streetFacingParcelCount: parcels.filter((parcel) => parcel.facing.length > 0).length,
    storefrontBayCount: parcels.reduce((total, parcel) => total + parcel.bays.length, 0),
    anchorCount: anchors.length,
    anchorsByKind: anchorsByKind(anchors),
    vehicleSplineCount: splines.vehicles.length,
    pedestrianSplineCount: splines.pedestrians.length,
    crossingCount: splines.crossings.length,
    splineSampleCount: allSplines.reduce((total, spline) => total + spline.sampleCount, 0),
    meshCount: meshes.length,
    triangleCount,
    triangleBudget: budget,
  }

  return {
    version: LAYOUT_VERSION,
    seed: normalizeSeed(seed),
    seedInput: seed,
    tier: resolved.tier,
    detail: resolved.detail,
    coordinateSystem: COORDINATE_SYSTEM,
    streets: STREETS,
    parcels,
    vehicleSplines: splines.vehicles,
    pedestrianSplines: splines.pedestrians,
    crossings: splines.crossings,
    anchors,
    utilityLines,
    meshes,
    stats,
  }
}

/** Description of the block's coordinate system, safe to log or show in UI. */
export function describeCoordinateSystem(): string {
  const c = COORDINATE_SYSTEM
  return [
    `units: ${c.units} (1 unit = ${c.metresPerUnit} m)`,
    `up: ${c.up}, east: ${c.east}, south: ${c.south}, north: ${c.north}, west: ${c.west}`,
    `origin: ${c.origin}`,
    `extent: ${c.blockExtent}; parcels: ${c.parcelExtent}`,
    c.rescaling,
  ].join('; ')
}
