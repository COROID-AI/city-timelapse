/**
 * The inspection-targets surface published by the composed scene graph.
 *
 * Navigation and inspection features need to answer "what can the viewer look
 * at, and where is it?" without importing a single layer module. This module is
 * that answer: it combines
 *
 * - **layout anchors** — the frozen, deterministic anchor catalogue of the block
 *   (`storefront-bay`, `sign-mount`, `parking-bay`, `light-post`, …), each with
 *   its position, footprint hint and owning layer, and
 * - **mounted layer objects** — the root groups and child objects each content
 *   layer actually added to the render pipeline's world, measured with a
 *   world-space bounding box,
 *
 * into one flat, serialisable list of {@link InspectionTarget}s carrying id,
 * category, label, era metadata, world bounds and owning layer id. The
 * composition rebuilds it whenever the selected era changes, so metadata never
 * describes a period that is no longer on screen.
 *
 * Bounds are measured, not guessed: an object-derived target's bounds come from
 * `Box3.setFromObject` on the live three.js object, so a click-to-focus feature
 * gets the real extent of whatever the current era built.
 */

import { Box3, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { Anchor, AnchorKind, BlockLayout } from '../city/layout'
import { getEra } from '../era'
import type { EraId } from '../era'

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/** What kind of thing a target is, from the viewer's point of view. */
export const INSPECTION_CATEGORIES = [
  'building',
  'storefront',
  'signage',
  'advertising',
  'graffiti',
  'vehicle',
  'pedestrian',
  'prop',
  'street-furniture',
  'atmosphere',
  'surface',
  'anchor',
] as const

export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number]

/** Whether a target came from the layout catalogue or from a mounted object. */
export const INSPECTION_ORIGINS = ['anchor', 'layer-object'] as const

export type InspectionOrigin = (typeof INSPECTION_ORIGINS)[number]

/** World-space bounds of one target, in metres. */
export interface InspectionBounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
  readonly center: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  /** Radius of the bounding sphere around `center`; handy for framing a camera. */
  readonly radius: number
}

/** One focusable thing in the composed block. */
export interface InspectionTarget {
  /** Stable, unique id; the anchor name for anchors, the object name otherwise. */
  readonly id: string
  readonly category: InspectionCategory
  /** Human-readable label for a focus overlay or a screen-reader list. */
  readonly label: string
  /** Era the target was resolved in. */
  readonly eraId: EraId
  readonly year: number
  readonly origin: InspectionOrigin
  /** Layer slot that owns the target (`storefronts`, `props`, `layout`, …). */
  readonly layerId: string
  /** Anchor name or scene-graph node name the target was derived from. */
  readonly source: string
  readonly bounds: InspectionBounds
}

/** Everything {@link buildInspectionTargets} needs. */
export interface InspectionObjectInput {
  readonly id: string
  readonly category: InspectionCategory
  readonly label?: string
  readonly source?: string
  /** Live object; its world bounds are measured when present. */
  readonly object?: Object3D | null
  /** Pre-measured bounds, used when there is no single object to measure. */
  readonly bounds?: InspectionBounds | null
  /** Overrides the input's era, e.g. for a remnant of the outgoing era. */
  readonly eraId?: EraId | null
}

/** One mounted layer's contribution to the surface. */
export interface InspectionLayerInput {
  readonly layerId: string
  readonly objects: readonly InspectionObjectInput[]
}

/** Inputs of the target builder. */
export interface InspectionTargetsInput {
  readonly layout: BlockLayout
  readonly eraId: EraId
  /** Anchors to publish; defaults to every anchor of the block. */
  readonly anchors?: readonly Anchor[]
  /** Layer contributions, in mount order. */
  readonly layers?: readonly InspectionLayerInput[]
  /** Cap of object-derived targets per layer; defaults to {@link DEFAULT_LAYER_TARGET_LIMIT}. */
  readonly limitPerLayer?: number
  /** Cap of the whole surface; defaults to {@link DEFAULT_TARGET_LIMIT}. */
  readonly limit?: number
  /** Optional timestamp, for reports. */
  readonly generatedAtSeconds?: number
}

/** The published surface, with a summary an assertion can read at a glance. */
export interface InspectionTargets {
  readonly eraId: EraId
  readonly year: number
  readonly count: number
  readonly anchorCount: number
  readonly objectCount: number
  /** True when a cap dropped entries; the counts still describe what is kept. */
  readonly truncated: boolean
  readonly byCategory: Readonly<Record<string, number>>
  readonly byOrigin: Readonly<Record<string, number>>
  readonly byLayer: Readonly<Record<string, number>>
  readonly targets: readonly InspectionTarget[]
  readonly generatedAtSeconds: number
}

/** Object-derived targets kept per layer, so the surface stays cheap. */
export const DEFAULT_LAYER_TARGET_LIMIT = 64

/** Hard ceiling of the whole surface. */
export const DEFAULT_TARGET_LIMIT = 512

/** Human label per anchor kind, used for target labels and reports. */
export const ANCHOR_KIND_LABELS: Readonly<Record<AnchorKind, string>> = Object.freeze({
  'storefront-bay': 'Storefront bay',
  'sign-mount': 'Sign mount',
  'prop-point': 'Prop point',
  'light-post': 'Light post',
  'signal-head': 'Signal head',
  hydrant: 'Hydrant',
  'utility-endpoint': 'Utility endpoint',
  'parking-bay': 'Parking bay',
  'inspection-focus': 'Viewpoint',
})

/** Target category each anchor kind belongs to. */
export const ANCHOR_KIND_CATEGORIES: Readonly<Record<AnchorKind, InspectionCategory>> =
  Object.freeze({
    'storefront-bay': 'storefront',
    'sign-mount': 'signage',
    'prop-point': 'prop',
    'light-post': 'street-furniture',
    'signal-head': 'street-furniture',
    hydrant: 'street-furniture',
    'utility-endpoint': 'prop',
    'parking-bay': 'vehicle',
    'inspection-focus': 'anchor',
  })

/** Layer slot that owns an anchor kind. */
export const ANCHOR_KIND_LAYERS: Readonly<Record<AnchorKind, string>> = Object.freeze({
  'storefront-bay': 'storefronts',
  'sign-mount': 'storefronts',
  'prop-point': 'props',
  'light-post': 'props',
  'signal-head': 'props',
  hydrant: 'props',
  'utility-endpoint': 'props',
  'parking-bay': 'vehicles',
  'inspection-focus': 'layout',
})

/* -------------------------------------------------------------------------- */
/* Bounds helpers                                                             */
/* -------------------------------------------------------------------------- */

function triple(values: readonly [number, number, number]): readonly [number, number, number] {
  return [values[0], values[1], values[2]]
}

/** Builds bounds from an axis-aligned box, giving zero-size boxes a radius. */
export function boundsFromBox(box: Box3): InspectionBounds {
  const min = triple([box.min.x, box.min.y, box.min.z])
  const max = triple([box.max.x, box.max.y, box.max.z])
  const size = triple([max[0] - min[0], max[1] - min[1], max[2] - min[2]])
  const center = triple([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2])
  const radius = Math.max(
    Math.hypot(size[0], size[1], size[2]) / 2,
    Number.EPSILON,
  )
  return { min, max, center, size, radius }
}

/**
 * Measures an object in world space.
 *
 * Returns null for an empty object (a group with no renderable descendant), so
 * the surface never publishes a target with a degenerate box.
 */
export function boundsOfObject(object: Object3D): InspectionBounds | null {
  const box = new Box3().setFromObject(object)
  if (box.isEmpty()) {
    return null
  }
  return boundsFromBox(box)
}

/** Bounds around a single point, optionally sized by a footprint hint. */
export function boundsOfPoint(
  position: readonly [number, number, number],
  size?: { readonly width: number; readonly height: number } | null,
): InspectionBounds {
  const halfWidth = Math.max(0.05, (size?.width ?? 0.8) / 2)
  const halfHeight = Math.max(0.05, (size?.height ?? 1.6) / 2)
  const box = new Box3(
    new Vector3(position[0] - halfWidth, position[1] - halfHeight, position[2] - halfWidth),
    new Vector3(position[0] + halfWidth, position[1] + halfHeight, position[2] + halfWidth),
  )
  return boundsFromBox(box)
}

/** Bounds from an axis-aligned box record (`minX`…`maxZ`), as plans publish them. */
export function boundsFromAabb(aabb: {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}): InspectionBounds {
  return boundsFromBox(
    new Box3(
      new Vector3(aabb.minX, aabb.minY, aabb.minZ),
      new Vector3(aabb.maxX, aabb.maxY, aabb.maxZ),
    ),
  )
}

/** Point a camera should frame when the target is focused. */
export function focusPoint(target: InspectionTarget): readonly [number, number, number] {
  return target.bounds.center
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

function tally(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1
}

/** Category of one anchor, published so callers need no second table. */
export function anchorCategory(kind: AnchorKind): InspectionCategory {
  return ANCHOR_KIND_CATEGORIES[kind]
}

/** Owning layer slot of one anchor kind. */
export function anchorLayerId(kind: AnchorKind): string {
  return ANCHOR_KIND_LAYERS[kind]
}

/** Label shown for one anchor-derived target. */
export function anchorLabel(anchor: Anchor): string {
  const label = ANCHOR_KIND_LABELS[anchor.kind] ?? anchor.kind
  return `${label} · ${anchor.owner.id}`
}

/**
 * Builds the inspection-targets surface for one era.
 *
 * Anchor-derived targets come first (they are the stable, era-independent
 * catalogue) and layer-object-derived targets follow in mount order, so the
 * surface reads like the scene graph it was published from.
 */
export function buildInspectionTargets(input: InspectionTargetsInput): InspectionTargets {
  const { layout, eraId } = input
  const era = getEra(eraId)
  const anchors = input.anchors ?? layout.anchors
  const limitPerLayer = Math.max(1, input.limitPerLayer ?? DEFAULT_LAYER_TARGET_LIMIT)
  const limit = Math.max(1, input.limit ?? DEFAULT_TARGET_LIMIT)
  const byCategory: Record<string, number> = {}
  const byOrigin: Record<string, number> = { anchor: 0, 'layer-object': 0 }
  const byLayer: Record<string, number> = {}
  const targets: InspectionTarget[] = []
  let truncated = false

  for (const anchor of anchors) {
    if (targets.length >= limit) {
      truncated = true
      break
    }
    const category = anchorCategory(anchor.kind)
    const layerId = anchorLayerId(anchor.kind)
    targets.push({
      id: anchor.name,
      category,
      label: anchorLabel(anchor),
      eraId: era.id,
      year: era.year,
      origin: 'anchor',
      layerId,
      source: anchor.name,
      bounds: boundsOfPoint(
        [anchor.position.x, anchor.position.y, anchor.position.z],
        anchor.size,
      ),
    })
    tally(byCategory, category)
    byOrigin['anchor'] = (byOrigin['anchor'] ?? 0) + 1
    tally(byLayer, layerId)
  }

  const anchorCount = targets.length

  for (const layer of input.layers ?? []) {
    let kept = 0
    for (const entry of layer.objects) {
      if (kept >= limitPerLayer || targets.length >= limit) {
        truncated = true
        break
      }
      const bounds = entry.object != null ? boundsOfObject(entry.object) : (entry.bounds ?? null)
      if (bounds === null) {
        continue
      }
      const targetEraId = entry.eraId ?? era.id
      const targetEra = targetEraId === era.id ? era : getEra(targetEraId)
      const category = entry.category
      targets.push({
        id: entry.id,
        category,
        label: entry.label ?? entry.id,
        eraId: targetEraId,
        year: targetEra.year,
        origin: 'layer-object',
        layerId: layer.layerId,
        source: entry.source ?? entry.id,
        bounds,
      })
      kept += 1
      tally(byCategory, category)
      byOrigin['layer-object'] = (byOrigin['layer-object'] ?? 0) + 1
      tally(byLayer, layer.layerId)
    }
  }

  return {
    eraId: era.id,
    year: era.year,
    count: targets.length,
    anchorCount,
    objectCount: targets.length - anchorCount,
    truncated,
    byCategory,
    byOrigin,
    byLayer,
    targets,
    generatedAtSeconds: input.generatedAtSeconds ?? 0,
  }
}

/** An empty surface, used before the first build and after disposal. */
export function emptyInspectionTargets(eraId: EraId): InspectionTargets {
  const era = getEra(eraId)
  return {
    eraId: era.id,
    year: era.year,
    count: 0,
    anchorCount: 0,
    objectCount: 0,
    truncated: false,
    byCategory: {},
    byOrigin: { anchor: 0, 'layer-object': 0 },
    byLayer: {},
    targets: [],
    generatedAtSeconds: 0,
  }
}

/** Shape the debug surface and the browser assertions read. */
export function summariseInspectionTargets(targets: InspectionTargets): {
  readonly count: number
  readonly anchorCount: number
  readonly objectCount: number
  readonly categories: readonly string[]
  readonly layers: readonly string[]
  readonly eraId: EraId
  readonly year: number
} {
  return {
    count: targets.count,
    anchorCount: targets.anchorCount,
    objectCount: targets.objectCount,
    categories: Object.keys(targets.byCategory).sort(),
    layers: Object.keys(targets.byLayer).sort(),
    eraId: targets.eraId,
    year: targets.year,
  }
}
