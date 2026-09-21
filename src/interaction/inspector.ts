/**
 * Click-to-focus inspection: picking, framing and the era-aware info card.
 *
 * The inspector answers one question — "what did the viewer just click, and what
 * is it?" — and answers it from the composition's published inspection-targets
 * surface. It never imports a content layer and never traverses the scene graph:
 * a target carries the id, category, label, era metadata, owning layer and
 * *measured* world bounds, and that is everything the picker, the framing maths
 * and the card need.
 *
 * Picking
 * -------
 * A click becomes a ray; every target's bounds box is intersected with it; among
 * the boxes on that ray the one whose *centre* projects closest to the cursor
 * wins, with a small category bias so a storefront beats the ground plane it
 * stands on. A click that hits nothing — or only a huge block-wide surface box
 * whose centre is far from the cursor — releases the focus, which is what makes
 * "click empty space to close" honest rather than a special case.
 *
 * Card content
 * ------------
 * {@link buildInspectorCard} takes its wording from the era registry, not from
 * this file: the period's own vocabulary for the category (`contentTags`,
 * traffic or population model keys) is read out of the selected
 * {@link EraDefinition}, so a 1945 storefront and a 2025 storefront describe
 * themselves in their own terms.
 *
 * Two categories the composition does not publish yet — buildings (its parcel
 * layer is pending) — are derived here from the layout's own `inspection-focus`
 * anchors, one per parcel, so the viewer can still click a building and be told
 * what they are looking at. Nothing is invented: the derived target points at a
 * real anchor of the frozen layout and carries the surface's era metadata.
 */

import { Box3, Raycaster, Vector2, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import type { Anchor, BlockLayout } from '../city/layout'
import { anchorsOfKind } from '../city/layout'
import type {
  InspectionBounds,
  InspectionCategory,
  InspectionOrigin,
  InspectionTarget,
  InspectionTargets,
} from '../app/inspectionTargets'
import { boundsOfPoint, focusPoint } from '../app/inspectionTargets'
import { getEra } from '../era'
import type { EraDefinition, EraId } from '../era'
import type { CameraBounds, CameraState, Vec3 } from '../scene'
import { cameraStateView, clampToRange } from '../scene'
import { framingForSubject } from './viewpoints'

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/** Human name of every inspection category, used on the card and in the UI. */
export const INSPECTION_CATEGORY_LABELS: Readonly<Record<InspectionCategory, string>> = {
  building: 'Building',
  storefront: 'Storefront',
  signage: 'Signage',
  advertising: 'Advertising',
  graffiti: 'Graffiti',
  vehicle: 'Vehicle',
  pedestrian: 'Pedestrian',
  prop: 'Prop',
  'street-furniture': 'Street furniture',
  atmosphere: 'Atmosphere',
  surface: 'Ground surface',
  anchor: 'Viewpoint',
}

/**
 * Interest order used to break near-ties when two boxes sit under the cursor.
 *
 * Objects come before the air and the ground, so a storefront is never hidden by
 * the deck it stands on — but the bias is a fraction of a pixel-to-NDC unit, so
 * a genuinely nearer centre always wins.
 */
export const INSPECTION_CATEGORY_ORDER: readonly InspectionCategory[] = [
  'building',
  'storefront',
  'vehicle',
  'pedestrian',
  'prop',
  'street-furniture',
  'signage',
  'advertising',
  'graffiti',
  'anchor',
  'atmosphere',
  'surface',
]

/** Human name of a layer slot, without importing the composition's own table. */
export const INTERACTION_LAYER_LABELS: Readonly<Record<string, string>> = {
  layout: 'Block layout',
  atmosphere: 'Atmosphere',
  buildings: 'Buildings',
  storefronts: 'Storefronts',
  props: 'Street props',
  vehicles: 'Traffic',
  pedestrians: 'Crowds',
}

/** Fallback footprint of a derived building target, in metres. */
const BUILDING_FOCUS_SIZE = { width: 8, height: 12 } as const

/** NDC radius around the cursor in which a target's centre still counts. */
export const DEFAULT_MAX_PICK_DISTANCE = 0.12

/** How many candidates per category a probe search looks at. */
export const DEFAULT_PROBES_PER_CATEGORY = 8

/** Targets wider than this are never picked as a "probe" for a category. */
export const DEFAULT_PROBE_MAX_RADIUS = 30

/* -------------------------------------------------------------------------- */
/* Focusable targets                                                         */
/* -------------------------------------------------------------------------- */

/** Display label of a layer id. */
export function layerLabel(layerId: string): string {
  return INTERACTION_LAYER_LABELS[layerId] ?? layerId
}

/** Display label of a category. */
export function categoryLabel(category: InspectionCategory): string {
  return INSPECTION_CATEGORY_LABELS[category] ?? category
}

/**
 * One focusable target per parcel, derived from the layout's own focus anchor.
 *
 * The buildings layer has not shipped in this revision, so the composition
 * publishes no `building` target. Rather than leave the viewer unable to
 * identify a building, the interaction layer projects the parcel focus anchors
 * the layout already places onto `building` targets — the same anchor the
 * surface publishes, given the category the viewer would expect.
 */
export function derivedBuildingTargets(layout: BlockLayout, surface: InspectionTargets): readonly InspectionTarget[] {
  const existing = new Set(surface.targets.filter((target) => target.category === 'building').map((target) => target.id))
  const targets: InspectionTarget[] = []
  for (const anchor of anchorsOfKind(layout, 'inspection-focus')) {
    if (anchor.owner.kind !== 'parcel') {
      continue
    }
    const id = `building:${anchor.name}`
    if (existing.has(id)) {
      continue
    }
    targets.push({
      id,
      category: 'building',
      label: `Building · ${anchor.owner.id}`,
      eraId: surface.eraId,
      year: surface.year,
      origin: 'anchor',
      layerId: 'layout',
      source: anchor.name,
      bounds: boundsOfPoint(anchorPosition(anchor), BUILDING_FOCUS_SIZE),
    })
  }
  return targets
}

function anchorPosition(anchor: Anchor): Vec3 {
  return [anchor.position.x, anchor.position.y, anchor.position.z]
}

/**
 * Every target the viewer can focus, primary source first.
 *
 * The composition's surface leads, so a shipped `building` layer would shadow
 * the derived parcel anchors automatically when it lands.
 */
export function focusableTargets(
  surface: InspectionTargets,
  layout: BlockLayout,
): readonly InspectionTarget[] {
  return [...surface.targets, ...derivedBuildingTargets(layout, surface)]
}

/* -------------------------------------------------------------------------- */
/* Info card                                                                  */
/* -------------------------------------------------------------------------- */

/** Everything the info card shows about one focused target. */
export interface InspectorCardModel {
  readonly targetId: string
  readonly category: InspectionCategory
  readonly categoryLabel: string
  readonly title: string
  readonly layerId: string
  readonly layerLabel: string
  readonly eraId: EraId
  readonly eraLabel: string
  readonly eraShortLabel: string
  readonly eraYear: number
  /** Sentence describing the object in the selected era's own terms. */
  readonly description: string
  /** Era vocabulary for this category, as a comma-separated line. */
  readonly periodDetail: string
  readonly tags: readonly string[]
  readonly origin: InspectionOrigin
  readonly anchorName: string
  readonly boundsRadius: number
  /** True when the target's own era differs from the era being shown. */
  readonly carriedOver: boolean
}

/**
 * Era vocabulary for one category.
 *
 * Every entry comes out of the era registry's own tables, so the copy follows
 * the period data and never a year branch in this file.
 */
export function eraDetailFor(category: InspectionCategory, era: EraDefinition): readonly string[] {
  switch (category) {
    case 'building':
      return era.contentTags.buildings
    case 'storefront':
      return era.contentTags.storefronts
    case 'signage':
      return era.contentTags.signage
    case 'advertising':
    case 'graffiti':
      return era.contentTags.advertisements
    case 'vehicle':
      return era.traffic.modelKeys
    case 'pedestrian':
      return era.population.modelKeys
    case 'prop':
    case 'street-furniture':
      return era.contentTags.props
    case 'atmosphere':
      return [era.atmosphere.precipitation, era.soundscape.label, era.soundscape.key]
    case 'anchor':
    case 'surface':
      return []
  }
}

/** Builds the info card for a target against one era definition. */
export function buildInspectorCard(target: InspectionTarget, era: EraDefinition): InspectorCardModel {
  const tags = eraDetailFor(target.category, era)
  const shown = tags.slice(0, 4)
  const periodDetail = shown.join(', ')
  return {
    targetId: target.id,
    category: target.category,
    categoryLabel: categoryLabel(target.category),
    title: target.label,
    layerId: target.layerId,
    layerLabel: layerLabel(target.layerId),
    eraId: era.id,
    eraLabel: era.label,
    eraShortLabel: era.shortLabel,
    eraYear: era.year,
    description: `${era.label} (${era.year}): ${periodDetail.length > 0 ? periodDetail : era.summary}`,
    periodDetail,
    tags,
    origin: target.origin,
    anchorName: target.source,
    boundsRadius: target.bounds.radius,
    carriedOver: target.eraId !== era.id,
  }
}

/** Builds the card for an era id, defaulting to the target's own era. */
export function buildInspectorCardForEra(
  target: InspectionTarget,
  eraId: EraId = target.eraId,
): InspectorCardModel {
  return buildInspectorCard(target, getEra(eraId))
}

/* -------------------------------------------------------------------------- */
/* Picking                                                                    */
/* -------------------------------------------------------------------------- */

/** Viewport size in CSS pixels. */
export interface ViewportSize {
  readonly width: number
  readonly height: number
}

/** A target projected to screen space. */
export interface ProjectedTarget {
  /** CSS pixels from the viewport's top-left corner. */
  readonly x: number
  readonly y: number
  readonly ndcX: number
  readonly ndcY: number
  /** False when the centre is behind the camera or outside the frustum. */
  readonly onScreen: boolean
  /** Distance from the camera to the centre, world units. */
  readonly distance: number
}

/** A ray/target intersection candidate. */
export interface InspectionPick {
  readonly target: InspectionTarget
  /** NDC distance between the cursor and the target centre. */
  readonly centreDistance: number
  /** Distance along the ray to the near face of the target's box. */
  readonly rayDistance: number
  readonly screen: ProjectedTarget
}

export interface InspectionPickRequest {
  readonly camera: PerspectiveCamera
  readonly viewport: ViewportSize
  /** Pen/touch position in NDC, each component in `-1..1`. */
  readonly ndc: readonly [number, number]
  readonly targets: readonly InspectionTarget[]
  readonly maxCentreDistance?: number
}

const scratchBox = new Box3()
const scratchVector = new Vector3()
const scratchCentre = new Vector3()
const scratchDirection = new Vector3()
const scratchCursor = new Vector2()

/** Bounds as an axis-aligned box, reusing one scratch box per call site. */
export function boxOfBounds(bounds: InspectionBounds): Box3 {
  scratchBox.min.set(bounds.min[0], bounds.min[1], bounds.min[2])
  scratchBox.max.set(bounds.max[0], bounds.max[1], bounds.max[2])
  return scratchBox
}

/** Projects a target's centre into the viewport. */
export function projectInspectionTarget(
  target: InspectionTarget,
  camera: PerspectiveCamera,
  viewport: ViewportSize,
): ProjectedTarget {
  camera.updateMatrixWorld()
  const centre = target.bounds.center
  scratchCentre.set(centre[0], centre[1], centre[2])
  scratchDirection.copy(scratchCentre).sub(camera.position)
  const distance = scratchDirection.length()
  camera.getWorldDirection(scratchVector)
  const inFront = scratchDirection.dot(scratchVector) > 0

  scratchCentre.project(camera)
  const ndcX = scratchCentre.x
  const ndcY = scratchCentre.y
  const ndcZ = scratchCentre.z
  const onScreen =
    inFront &&
    Number.isFinite(ndcX) &&
    Number.isFinite(ndcY) &&
    Math.abs(ndcX) <= 1 &&
    Math.abs(ndcY) <= 1 &&
    ndcZ >= -1 &&
    ndcZ <= 1

  return {
    x: (ndcX * 0.5 + 0.5) * viewport.width,
    y: (1 - (ndcY * 0.5 + 0.5)) * viewport.height,
    ndcX,
    ndcY,
    onScreen,
    distance,
  }
}

/** Smallest NDC distance a target of this category needs to win a near-tie. */
export function categoryPickBonus(category: InspectionCategory): number {
  const rank = INSPECTION_CATEGORY_ORDER.indexOf(category)
  const position = rank < 0 ? INSPECTION_CATEGORY_ORDER.length : rank
  return (INSPECTION_CATEGORY_ORDER.length - position) * 0.0015
}

/**
 * Picks the target under a cursor position.
 *
 * Returns `null` when no box is on the ray, which is the "clicked empty space"
 * case every caller treats as "release the focus".
 */
export function pickInspectionTarget(request: InspectionPickRequest): InspectionPick | null {
  const { camera, viewport, ndc, targets } = request
  const maxDistance = request.maxCentreDistance ?? DEFAULT_MAX_PICK_DISTANCE
  if (targets.length === 0) {
    return null
  }
  camera.updateMatrixWorld()
  const raycaster = new Raycaster()
  raycaster.setFromCamera(scratchCursor.set(ndc[0], ndc[1]), camera)

  let best: InspectionPick | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const target of targets) {
    const hitPoint = raycaster.ray.intersectBox(boxOfBounds(target.bounds), new Vector3())
    if (hitPoint === null) {
      continue
    }
    const screen = projectInspectionTarget(target, camera, viewport)
    if (!screen.onScreen) {
      continue
    }
    const centreDistance = Math.hypot(screen.ndcX - ndc[0], screen.ndcY - ndc[1])
    if (centreDistance > maxDistance) {
      continue
    }
    const score = centreDistance - categoryPickBonus(target.category)
    if (score < bestScore) {
      bestScore = score
      best = {
        target,
        centreDistance,
        rayDistance: hitPoint.distanceTo(raycaster.ray.origin),
        screen,
      }
    }
  }
  return best
}

/** A cursor position known to focus one category, for probes and checks. */
export interface PickProbe {
  readonly targetId: string
  readonly category: InspectionCategory
  readonly layerId: string
  readonly label: string
  readonly ndcX: number
  readonly ndcY: number
  /** CSS pixels inside the canvas. */
  readonly x: number
  readonly y: number
  readonly centreDistance: number
}

export interface PickProbeOptions {
  readonly maxCentreDistance?: number
  readonly perCategory?: number
  readonly maxRadius?: number
  /** Categories to probe; defaults to every category present on the surface. */
  readonly categories?: readonly InspectionCategory[]
}

/** How close to the viewport edge a probe may sit and still be clickable. */
export const PROBE_VIEWPORT_INSET = 0.02

/**
 * Finds, per category, a cursor position that focuses a target of that category.
 *
 * The published bounds are the measurement, so a probe is not a guess: it is the
 * projection of a real target's centre, verified by running the picker at that
 * exact position, and kept only when it lands inside the viewport so a browser
 * harness can click it. The interaction harness uses it to click each kind of
 * object the way a viewer would.
 */
export function computePickProbes(
  targets: readonly InspectionTarget[],
  camera: PerspectiveCamera,
  viewport: ViewportSize,
  options: PickProbeOptions = {},
): readonly PickProbe[] {
  const perCategory = Math.max(1, options.perCategory ?? DEFAULT_PROBES_PER_CATEGORY)
  const maxRadius = options.maxRadius ?? DEFAULT_PROBE_MAX_RADIUS
  const present = options.categories ?? INSPECTION_CATEGORY_ORDER
  const probes: PickProbe[] = []

  for (const category of present) {
    const candidates = targets
      .filter((target) => target.category === category && target.bounds.radius <= maxRadius)
      .sort((left, right) => {
        if (left.bounds.radius !== right.bounds.radius) {
          return left.bounds.radius - right.bounds.radius
        }
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      })
      .slice(0, perCategory)

    let best: PickProbe | null = null
    for (const candidate of candidates) {
      const screen = projectInspectionTarget(candidate, camera, viewport)
      if (
        !screen.onScreen ||
        Math.abs(screen.ndcX) > 1 - PROBE_VIEWPORT_INSET ||
        Math.abs(screen.ndcY) > 1 - PROBE_VIEWPORT_INSET
      ) {
        continue
      }
      const pick = pickInspectionTarget({
        camera,
        viewport,
        ndc: [screen.ndcX, screen.ndcY],
        targets,
        ...(options.maxCentreDistance === undefined
          ? {}
          : { maxCentreDistance: options.maxCentreDistance }),
      })
      if (pick === null || pick.target.id !== candidate.id) {
        continue
      }
      if (best === null || pick.centreDistance < best.centreDistance) {
        best = {
          targetId: candidate.id,
          category,
          layerId: candidate.layerId,
          label: candidate.label,
          ndcX: screen.ndcX,
          ndcY: screen.ndcY,
          x: screen.x,
          y: screen.y,
          centreDistance: pick.centreDistance,
        }
      }
    }
    if (best !== null) {
      probes.push(best)
    }
  }
  return probes
}

/* -------------------------------------------------------------------------- */
/* Focus framing                                                              */
/* -------------------------------------------------------------------------- */

/** Framing distance as a multiple of the target's bounding radius. */
const FOCUS_RADIUS_FACTOR = 3.2

/** Smallest framing distance, in metres. */
const FOCUS_MIN_DISTANCE = 6

/**
 * Camera state that zooms to a target.
 *
 * The framing comes from {@link framingForSubject}, which is what makes a claimed
 * zoom actually show the subject: the pipeline's envelope clamps every look-at
 * point into the block disc, so an eye that simply stood at the target would end
 * up looking past it. A target inside the disc is centred outright; one outside
 * it is framed from further out along its own bearing. The viewer's current
 * direction decides which side to approach from, so the move reads as a dolly
 * rather than a jump to a fixed camera.
 */
export function focusCameraForTarget(
  target: InspectionTarget,
  current: CameraState,
  bounds: CameraBounds,
): CameraState {
  const centre = focusPoint(target) as Vec3
  const view = cameraStateView(current)
  const offsetX = view.position[0] - centre[0]
  const offsetZ = view.position[2] - centre[2]
  const offset = Math.hypot(offsetX, offsetZ)
  const fallbackDirection: readonly [number, number] =
    offset > 1e-4 ? [offsetX / offset, offsetZ / offset] : [0, 1]
  const standoff = clampToRange(
    Math.max(target.bounds.radius * FOCUS_RADIUS_FACTOR, FOCUS_MIN_DISTANCE),
    bounds.orbitRadius,
  )
  return framingForSubject(centre, centre, bounds, current, { standoff, fallbackDirection })
}

/* -------------------------------------------------------------------------- */
/* Inspector                                                                  */
/* -------------------------------------------------------------------------- */

/** Result of focusing a target. */
export interface InspectorFocus {
  readonly target: InspectionTarget
  readonly card: InspectorCardModel
  /** Camera that frames the target. */
  readonly camera: CameraState
  /** Camera the viewer had before any focus; restored on release. */
  readonly previous: CameraState
}

export interface InspectorOptions {
  readonly getTargets: () => readonly InspectionTarget[]
  readonly getCamera: () => PerspectiveCamera
  readonly getViewport: () => ViewportSize
  readonly getCameraState: () => CameraState
  readonly bounds: CameraBounds
  readonly maxPickDistance?: number
}

/** Focus/release state machine behind the inspection extension. */
export interface Inspector {
  readonly focusedId: string | null
  focused(): InspectionTarget | null
  /**
   * Camera the viewer had before the first focus.
   *
   * Kept across focus changes so releasing always returns to where the viewer
   * was before the inspection started, not to the previous target's framing.
   */
  previousCamera(): CameraState | null
  /** Card of the focused target in the given era (defaults to its own). */
  card(eraId?: EraId): InspectorCardModel | null
  /** Focuses one target by id; `null` when the id is not on the surface. */
  focus(targetId: string): InspectorFocus | null
  /** Picks and focuses whatever sits under an NDC cursor position. */
  pick(ndc: readonly [number, number]): InspectorFocus | null
  /** Releases the focus; returns the camera to restore, or `null` if idle. */
  release(): CameraState | null
  probes(options?: PickProbeOptions): readonly PickProbe[]
  clear(): void
}

/** Creates the inspector over a live camera and a published target surface. */
export function createInspector(options: InspectorOptions): Inspector {
  let focusedId: string | null = null
  let previous: CameraState | null = null

  const findTarget = (targetId: string): InspectionTarget | null =>
    options.getTargets().find((candidate) => candidate.id === targetId) ?? null

  const enter = (target: InspectionTarget): InspectorFocus => {
    if (previous === null) {
      previous = options.getCameraState()
    }
    focusedId = target.id
    return {
      target,
      card: buildInspectorCardForEra(target),
      camera: focusCameraForTarget(target, options.getCameraState(), options.bounds),
      previous,
    }
  }

  return {
    get focusedId(): string | null {
      return focusedId
    },
    focused(): InspectionTarget | null {
      return focusedId === null ? null : findTarget(focusedId)
    },
    previousCamera(): CameraState | null {
      return previous
    },
    card(eraId?: EraId): InspectorCardModel | null {
      const target = focusedId === null ? null : findTarget(focusedId)
      if (target === null) {
        return null
      }
      return buildInspectorCardForEra(target, eraId ?? target.eraId)
    },
    focus(targetId: string): InspectorFocus | null {
      const target = findTarget(targetId)
      return target === null ? null : enter(target)
    },
    pick(ndc: readonly [number, number]): InspectorFocus | null {
      const pick = pickInspectionTarget({
        camera: options.getCamera(),
        viewport: options.getViewport(),
        ndc,
        targets: options.getTargets(),
        ...(options.maxPickDistance === undefined ? {} : { maxCentreDistance: options.maxPickDistance }),
      })
      return pick === null ? null : enter(pick.target)
    },
    release(): CameraState | null {
      const restore = previous
      focusedId = null
      previous = null
      return restore
    },
    probes(probeOptions: PickProbeOptions = {}): readonly PickProbe[] {
      return computePickProbes(options.getTargets(), options.getCamera(), options.getViewport(), probeOptions)
    },
    clear(): void {
      focusedId = null
      previous = null
    },
  }
}
