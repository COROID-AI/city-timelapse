/**
 * Named viewpoints: street-level and aerial framings of the frozen block.
 *
 * A viewpoint is not a hard-coded camera position. Every framing is *resolved*
 * from geometry the composition already publishes:
 *
 * | viewpoint            | subject (derived from)                                  |
 * | -------------------- | ------------------------------------------------------- |
 * | `street-corner`      | the block's corner `inspection-focus` anchor             |
 * | `curb-crossing`      | a `parking-bay` anchor, across its street's carriageway  |
 * | `storefront-closeup` | a `storefront-bay` anchor, out along its own normal      |
 * | `rooftop`            | the parcel `prop-point` anchor tagged `rooftop`          |
 * | `aerial`             | the union of the published inspection-target bounds      |
 *
 * Standing outside the block
 * -------------------------
 * The render pipeline's navigation envelope clamps every look-at point into a
 * disc around the block centre and forbids an orbit camera from dropping below
 * `bounds.orbitPolar.max`. A viewpoint that framed a kerbside subject the naive
 * way — eye at the subject, look-at at the subject — would therefore end up with
 * its subject *behind* the camera once the look-at point was pulled inwards.
 *
 * {@link framingForSubject} solves that: it clamps the look-at point exactly the
 * way the pipeline does, then places the eye on the ray from that clamped point
 * through the subject, a little beyond the subject, at a distance wide enough
 * that the envelope's polar limit keeps the subject comfortably inside the
 * frame. The subject ends up centred; the eye ends up on the pavement, across the
 * intersection or above the parapet — wherever the subject actually is. Nothing
 * here duplicates a world coordinate: positions come from anchors, distances from
 * layout constants and measured bounds.
 *
 * {@link createCameraTween} is the camera *motion* every authored move uses:
 * monotonic, eased, and exact at both ends (`sample(1)` is the destination state
 * byte-for-byte), so a viewpoint change, a focus and a tour never leave the
 * camera between two framings.
 */

import type { Anchor, BlockLayout } from '../city/layout'
import { CURB_HEIGHT, ROAD_WIDTH, anchorsOfKind } from '../city/layout'
import type { InspectionBounds, InspectionTarget, InspectionTargets } from '../app/inspectionTargets'
import type { CameraBounds, CameraMode, CameraState, Vec3 } from '../scene'
import {
  CAMERA_FOV_RANGE,
  DEFAULT_CAMERA_STATE,
  cameraStateForMode,
  clamp,
  clampToBoundsDisc,
  clampToRange,
  cloneCameraState,
  sanitizeCameraState,
} from '../scene'

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/** The named viewpoints, in presentation order. */
export const VIEWPOINT_IDS = [
  'street-corner',
  'curb-crossing',
  'storefront-closeup',
  'rooftop',
  'aerial',
] as const

export type ViewpointId = (typeof VIEWPOINT_IDS)[number]

/** Eye height of the street-level viewpoints, metres above the deck. */
export const VIEWPOINT_EYE_HEIGHT = 1.75

/**
 * Widest off-centre angle a framed subject may sit at, in radians (~16°).
 *
 * A 46° vertical field of view keeps a subject inside the frame long before this;
 * the margin is what makes a "close-up" still read as a close-up when the
 * envelope's polar limit tilts the view.
 */
export const FRAMING_MAX_OFFSET_RAD = 0.28

/** Where a viewpoint's camera is derived from. */
export type ViewpointSource =
  | 'corner-anchor'
  | 'parking-bay-anchor'
  | 'storefront-anchor'
  | 'rooftop-anchor'
  | 'target-bounds'

/** One named viewpoint, without any resolved geometry. */
export interface ViewpointDefinition {
  readonly id: ViewpointId
  readonly label: string
  readonly summary: string
  /** Camera behaviour the framing uses (`orbit` for every shipped viewpoint). */
  readonly mode: CameraMode
  readonly source: ViewpointSource
}

/** The shipped viewpoint catalogue: five framings, each with one job. */
export const VIEWPOINT_DEFINITIONS: readonly ViewpointDefinition[] = [
  {
    id: 'street-corner',
    label: 'Street corner',
    summary: 'Across the intersection, looking back at the corner of the block.',
    mode: 'orbit',
    source: 'corner-anchor',
  },
  {
    id: 'curb-crossing',
    label: 'Curb-level crossing',
    summary: 'Kerb height on the far side of the carriageway, looking along the crossing.',
    mode: 'orbit',
    source: 'parking-bay-anchor',
  },
  {
    id: 'storefront-closeup',
    label: 'Storefront close-up',
    summary: 'A few metres back from a shopfront, at eye height.',
    mode: 'orbit',
    source: 'storefront-anchor',
  },
  {
    id: 'rooftop',
    label: 'Rooftop',
    summary: 'Level with the parapet of a parcel, looking along the roofline.',
    mode: 'orbit',
    source: 'rooftop-anchor',
  },
  {
    id: 'aerial',
    label: 'Aerial establishing shot',
    summary: 'High three-quarter view framed from the block’s measured extent.',
    mode: 'orbit',
    source: 'target-bounds',
  },
]

/** Narrows an untrusted value to a viewpoint id. */
export function isViewpointId(value: unknown): value is ViewpointId {
  return typeof value === 'string' && (VIEWPOINT_IDS as readonly string[]).includes(value)
}

/** A viewpoint resolved against real geometry. */
export interface ViewpointFraming {
  readonly id: ViewpointId
  readonly label: string
  readonly mode: CameraMode
  readonly source: ViewpointSource
  /** Camera state the viewpoint resolves to; already inside the envelope. */
  readonly camera: CameraState
  /** Anchor the framing was derived from, when it used one. */
  readonly anchorName: string | null
  /** Published inspection target the framing was derived from, when one was used. */
  readonly targetId: string | null
  /** Point the camera is aimed at, in world units. */
  readonly subject: Vec3
  /** Eye height above the block deck, in metres, for reports and assertions. */
  readonly eyeHeight: number
  /** True when the framing is a fixed point of the pipeline's own clamp. */
  readonly withinBounds: boolean
}

/** Everything viewpoint resolution needs. */
export interface ViewpointContext {
  readonly layout: BlockLayout
  /** The composition's published surface (or its target list). */
  readonly targets: InspectionTargets | readonly InspectionTarget[]
  /** Camera envelope the running pipeline reports. */
  readonly bounds: CameraBounds
  /** Viewer's current state; its other-mode sub-state is carried through. */
  readonly current?: CameraState
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

function vec3(anchor: Anchor): Vec3 {
  return [anchor.position.x, anchor.position.y, anchor.position.z]
}

/** Normalised ground direction of a horizontal vector, falling back to +Z. */
function groundDirection(x: number, z: number): readonly [number, number] {
  const length = Math.hypot(x, z)
  if (!(length > 1e-6)) {
    return [0, 1]
  }
  return [x / length, z / length]
}

/** Deterministic order for anchors, so two runs pick the same one. */
function byName(left: Anchor, right: Anchor): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
}

function firstOfKind(layout: BlockLayout, kind: Anchor['kind']): Anchor | null {
  return anchorsOfKind(layout, kind).sort(byName)[0] ?? null
}

/** The anchor closest to a point: the least clamp distortion when it is framed. */
function closestTo(anchors: readonly Anchor[], point: Vec3): Anchor | null {
  let best: Anchor | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.position.x - point[0], anchor.position.z - point[2])
    if (distance < bestDistance) {
      best = anchor
      bestDistance = distance
    }
  }
  return best
}

/** Every target of a surface record or a plain list. */
export function targetList(
  targets: InspectionTargets | readonly InspectionTarget[],
): readonly InspectionTarget[] {
  return Array.isArray(targets)
    ? (targets as readonly InspectionTarget[])
    : (targets as InspectionTargets).targets
}

/** Axis-aligned union of every target's bounds, or null for an empty surface. */
export function unionTargetBounds(targets: readonly InspectionTarget[]): InspectionBounds | null {
  if (targets.length === 0) {
    return null
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  for (const target of targets) {
    minX = Math.min(minX, target.bounds.min[0])
    minY = Math.min(minY, target.bounds.min[1])
    minZ = Math.min(minZ, target.bounds.min[2])
    maxX = Math.max(maxX, target.bounds.max[0])
    maxY = Math.max(maxY, target.bounds.max[1])
    maxZ = Math.max(maxZ, target.bounds.max[2])
  }
  const size: readonly [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ]
  const center: readonly [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ]
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center,
    size,
    radius: Math.max(Math.hypot(size[0], size[1], size[2]) / 2, Number.EPSILON),
  }
}

/**
 * The shallowest climb the pipeline's orbit envelope allows, as a slope.
 *
 * `polar` is measured from straight up, so a camera can never sit closer to the
 * horizon than `bounds.orbitPolar.max`; `cot` of that angle is the smallest
 * `height / horizontal distance` ratio any orbit eye may have relative to its
 * look-at point.
 */
export function envelopeMinSlope(bounds: CameraBounds): number {
  const tangent = Math.tan(bounds.orbitPolar.max)
  return tangent > 0 ? 1 / tangent : Number.POSITIVE_INFINITY
}

/** Builds the orbit state for an explicit eye and look-at point. */
export function orbitFramingFor(
  eye: Vec3,
  lookAt: Vec3,
  bounds: CameraBounds,
  previous: CameraState = DEFAULT_CAMERA_STATE,
): CameraState {
  const [targetX, targetZ] = clampToBoundsDisc(lookAt[0], lookAt[2], bounds)
  const targetY = clamp(lookAt[1], bounds.minY, bounds.maxY)

  const dx = eye[0] - targetX
  const dy = eye[1] - targetY
  const dz = eye[2] - targetZ
  // Elevation comes from the requested offset (so the eye keeps its angle) and
  // the distance is clamped afterwards, which is what keeps the shot's shape
  // when the envelope is narrower than the requested framing.
  const requestedRadius = Math.hypot(dx, dy, dz)
  const radius = clampToRange(requestedRadius, bounds.orbitRadius)
  const polar = clampToRange(
    Math.acos(clamp(dy / (requestedRadius || 1), -1, 1)),
    bounds.orbitPolar,
  )
  const azimuth = Math.atan2(dx, dz)

  return sanitizeCameraState(
    {
      mode: 'orbit',
      target: [targetX, targetY, targetZ],
      orbit: { azimuth, polar, radius },
      // The viewer's street-level place is carried through untouched, so a
      // viewpoint change never forgets where they were walking.
      street: { ...previous.street },
      fov: clampToRange(previous.fov, CAMERA_FOV_RANGE),
      near: previous.near,
      far: previous.far,
    },
    bounds,
  )
}

export interface SubjectFramingOptions {
  /** Extra distance beyond the subject the eye should stand, in metres. */
  readonly standoff?: number
  /** Direction to retreat along when the subject is the look-at point itself. */
  readonly fallbackDirection?: readonly [number, number]
  /** Widest off-centre angle allowed; defaults to {@link FRAMING_MAX_OFFSET_RAD}. */
  readonly maxOffsetRad?: number
}

/**
 * Frames a subject the way the pipeline's envelope permits.
 *
 * The look-at point is clamped first, exactly as the controller would clamp it.
 * The eye is then put on the ray from that clamped point through the subject, a
 * little past the subject, with the distance widened until the envelope's polar
 * limit leaves the subject inside {@link FRAMING_MAX_OFFSET_RAD} of the view
 * axis. A subject that *is* the look-at point (anything already inside the
 * block's disc) has no such ray, so the eye retreats along
 * `fallbackDirection` and the camera looks straight at it.
 */
export function framingForSubject(
  subject: Vec3,
  lookAt: Vec3,
  bounds: CameraBounds,
  previous: CameraState = DEFAULT_CAMERA_STATE,
  options: SubjectFramingOptions = {},
): CameraState {
  const [lookX, lookZ] = clampToBoundsDisc(lookAt[0], lookAt[2], bounds)
  const lookY = clamp(lookAt[1], bounds.minY, bounds.maxY)
  const dx = subject[0] - lookX
  const dz = subject[2] - lookZ
  const horizontal = Math.hypot(dx, dz)
  const subjectRise = subject[1] - lookY
  const requestedStandoff = Math.max(0, options.standoff ?? 0)
  const maxOffset = Math.max(1e-3, options.maxOffsetRad ?? FRAMING_MAX_OFFSET_RAD)

  if (!(horizontal > 1e-4)) {
    // The subject is the look-at point: retreat so the camera looks straight at
    // it, at least as far as the envelope's own orbit floor allows.
    const [fx, fz] = options.fallbackDirection ?? groundDirection(subject[0] - bounds.center[0], subject[2] - bounds.center[2])
    const distance = Math.max(requestedStandoff, bounds.orbitRadius.min)
    return orbitFramingFor(
      [subject[0] + fx * distance, subject[1] + distance * envelopeMinSlope(bounds), subject[2] + fz * distance],
      lookAt,
      bounds,
      previous,
    )
  }

  // How much higher than the subject the axis still has to sit after the polar
  // limit has had its say, per metre of horizontal distance from the look-at.
  const minSlope = envelopeMinSlope(bounds)
  const slope = subjectRise / horizontal
  const shortfall = Math.max(0, minSlope - slope)
  const widened = (horizontal * shortfall) / Math.tan(maxOffset)
  const standoff = Math.max(requestedStandoff, widened)
  const scale = 1 + standoff / horizontal

  return orbitFramingFor(
    [lookX + dx * scale, lookY + subjectRise * scale, lookZ + dz * scale],
    lookAt,
    bounds,
    previous,
  )
}

/**
 * True when a camera state is a fixed point of the pipeline's clamp.
 *
 * This is the honest form of "in bounds" for an orbit framing: the look-at point
 * is inside the disc and height range, and the orbit angles are inside their
 * limits. The eye is unconstrained by the contract — that is exactly what lets a
 * viewpoint stand on the pavement while the look-at point stays in the block.
 */
export function cameraStateWithinBounds(state: CameraState, bounds: CameraBounds): boolean {
  const targetDistance = Math.hypot(
    state.target[0] - bounds.center[0],
    state.target[2] - bounds.center[2],
  )
  if (!Number.isFinite(targetDistance) || targetDistance > bounds.radius + 1e-6) {
    return false
  }
  if (state.target[1] < bounds.minY - 1e-6 || state.target[1] > bounds.maxY + 1e-6) {
    return false
  }
  if (
    state.orbit.radius < bounds.orbitRadius.min - 1e-6 ||
    state.orbit.radius > bounds.orbitRadius.max + 1e-6
  ) {
    return false
  }
  if (
    state.orbit.polar < bounds.orbitPolar.min - 1e-6 ||
    state.orbit.polar > bounds.orbitPolar.max + 1e-6
  ) {
    return false
  }
  if (
    state.street.position[1] < bounds.streetHeight.min - 1e-6 ||
    state.street.position[1] > bounds.streetHeight.max + 1e-6
  ) {
    return false
  }
  return (
    Number.isFinite(state.orbit.azimuth) &&
    Number.isFinite(state.orbit.radius) &&
    Number.isFinite(state.orbit.polar) &&
    Number.isFinite(state.fov)
  )
}

/** Eye position of a resolved camera state, whichever mode is active. */
export function framingEye(state: CameraState): Vec3 {
  if (state.mode === 'street') {
    return [state.street.position[0], state.street.position[1], state.street.position[2]]
  }
  const sinPolar = Math.sin(state.orbit.polar)
  return [
    state.target[0] + state.orbit.radius * sinPolar * Math.sin(state.orbit.azimuth),
    state.target[1] + state.orbit.radius * Math.cos(state.orbit.polar),
    state.target[2] + state.orbit.radius * sinPolar * Math.cos(state.orbit.azimuth),
  ]
}

/* -------------------------------------------------------------------------- */
/* Viewpoint resolution                                                       */
/* -------------------------------------------------------------------------- */

/** Extra distance beyond the subject each viewpoint retreats, in metres. */
const STREET_LEVEL_STANDOFF = 2.5
const STOREFRONT_STANDOFF = 8

/** Fractions of the block's measured radius used by the aerial shot. */
const AERIAL_OUTWARD = 0.5
const AERIAL_ABOVE = 1.7

interface SubjectRequest {
  /** Point the framing is aimed at. */
  readonly subject: Vec3
  /** Point the camera should orbit around; normally the subject. */
  readonly lookAt: Vec3
  readonly standoff: number
  readonly anchorName: string | null
  readonly targetId: string | null
}

function requestStreetCorner(context: ViewpointContext, centre: Vec3): SubjectRequest | null {
  const anchor = closestTo(
    anchorsOfKind(context.layout, 'inspection-focus').filter((candidate) => candidate.owner.kind === 'corner'),
    centre,
  )
  if (anchor === null) {
    return null
  }
  return {
    subject: vec3(anchor),
    lookAt: vec3(anchor),
    // Across the intersection: the kerb-to-kerb crossing plus the far pavement.
    standoff: ROAD_WIDTH * 1.3 + STREET_LEVEL_STANDOFF,
    anchorName: anchor.name,
    targetId: null,
  }
}

function requestCurbCrossing(context: ViewpointContext): SubjectRequest | null {
  const anchor = firstOfKind(context.layout, 'parking-bay')
  if (anchor === null) {
    return null
  }
  // Parking bays face the block, so the anchor's normal points inwards and its
  // negation is the direction across the carriageway to the far kerb.
  const [dx, dz] = groundDirection(-anchor.normal.x, -anchor.normal.z)
  const subject = vec3(anchor)
  return {
    subject,
    lookAt: [subject[0] + dx * ROAD_WIDTH, CURB_HEIGHT + VIEWPOINT_EYE_HEIGHT, subject[2] + dz * ROAD_WIDTH],
    standoff: ROAD_WIDTH + STREET_LEVEL_STANDOFF,
    anchorName: anchor.name,
    targetId: null,
  }
}

function requestStorefrontCloseup(context: ViewpointContext): SubjectRequest | null {
  const anchor = firstOfKind(context.layout, 'storefront-bay')
  if (anchor === null) {
    return null
  }
  return {
    subject: vec3(anchor),
    lookAt: vec3(anchor),
    standoff: STOREFRONT_STANDOFF,
    anchorName: anchor.name,
    targetId: null,
  }
}

/** The rooftop anchor with the highest parapet; the view must clear the roofs. */
function highestOf(anchors: readonly Anchor[]): Anchor | null {
  let best: Anchor | null = null
  for (const anchor of [...anchors].sort(byName)) {
    if (best === null || anchor.position.y > best.position.y) {
      best = anchor
    }
  }
  return best
}

function requestRooftop(context: ViewpointContext): SubjectRequest | null {
  const anchor = highestOf(
    anchorsOfKind(context.layout, 'prop-point').filter((candidate) => candidate.tags.includes('rooftop')),
  )
  if (anchor === null) {
    return null
  }
  return {
    subject: vec3(anchor),
    lookAt: vec3(anchor),
    standoff: 4,
    anchorName: anchor.name,
    targetId: null,
  }
}

/**
 * The aerial shot is the one framing with no anchor behind it: its subject is the
 * whole block, measured from the union of every published target's bounds. The
 * look-at point is the block centre, which is inside the envelope's disc, so it
 * is never clamped and the shot needs no ray trick — only a high eye.
 */
function aerialFraming(targets: readonly InspectionTarget[], bounds: CameraBounds, previous: CameraState): CameraState | null {
  const union = unionTargetBounds(targets)
  if (union === null) {
    return null
  }
  const [dx, dz] = groundDirection(union.center[0] - bounds.center[0], union.center[2] - bounds.center[2])
  const radius = Math.max(union.radius, 1)
  const eye: Vec3 = [
    union.center[0] + dx * radius * AERIAL_OUTWARD,
    union.center[1] + radius * AERIAL_ABOVE,
    union.center[2] + dz * radius * AERIAL_OUTWARD,
  ]
  return orbitFramingFor(eye, union.center, bounds, previous)
}

function requestFor(
  definition: ViewpointDefinition,
  context: ViewpointContext,
  centre: Vec3,
): SubjectRequest | null {
  switch (definition.id) {
    case 'street-corner':
      return requestStreetCorner(context, centre)
    case 'curb-crossing':
      return requestCurbCrossing(context)
    case 'storefront-closeup':
      return requestStorefrontCloseup(context)
    case 'rooftop':
      return requestRooftop(context)
    case 'aerial':
      return null
  }
}

/**
 * Resolves one viewpoint against the block.
 *
 * Returns `null` when the geometry the viewpoint needs is not present (a block
 * without corner anchors, an empty inspection surface), so a caller renders only
 * the viewpoints that actually resolve.
 */
export function resolveViewpoint(id: ViewpointId, context: ViewpointContext): ViewpointFraming | null {
  const definition = VIEWPOINT_DEFINITIONS.find((candidate) => candidate.id === id)
  if (definition === undefined) {
    return null
  }
  const targets = targetList(context.targets)
  const centre: Vec3 = [...context.bounds.center]
  const previous = context.current ?? DEFAULT_CAMERA_STATE

  if (definition.id === 'aerial') {
    const camera = aerialFraming(targets, context.bounds, previous)
    if (camera === null) {
      return null
    }
    const union = unionTargetBounds(targets)
    return {
      id: definition.id,
      label: definition.label,
      mode: definition.mode,
      source: definition.source,
      camera,
      anchorName: null,
      targetId: null,
      subject: union?.center ?? centre,
      eyeHeight: framingEye(camera)[1],
      withinBounds: cameraStateWithinBounds(camera, context.bounds),
    }
  }

  const request = requestFor(definition, context, centre)
  if (request === null) {
    return null
  }
  const camera = framingForSubject(request.subject, request.lookAt, context.bounds, previous, {
    standoff: request.standoff,
    fallbackDirection: groundDirection(
      request.subject[0] - context.bounds.center[0],
      request.subject[2] - context.bounds.center[2],
    ),
  })
  return {
    id: definition.id,
    label: definition.label,
    mode: definition.mode,
    source: definition.source,
    camera,
    anchorName: request.anchorName,
    targetId: request.targetId,
    subject: request.subject,
    eyeHeight: framingEye(camera)[1],
    withinBounds: cameraStateWithinBounds(camera, context.bounds),
  }
}

/** Resolves every viewpoint the block can support, in catalogue order. */
export function resolveViewpoints(context: ViewpointContext): readonly ViewpointFraming[] {
  const framings: ViewpointFraming[] = []
  for (const definition of VIEWPOINT_DEFINITIONS) {
    const framing = resolveViewpoint(definition.id, context)
    if (framing !== null) {
      framings.push(framing)
    }
  }
  return framings
}

/** Looks up one resolved framing in a resolved catalogue. */
export function findFraming(
  framings: readonly ViewpointFraming[],
  id: ViewpointId,
): ViewpointFraming | null {
  return framings.find((framing) => framing.id === id) ?? null
}

/* -------------------------------------------------------------------------- */
/* Camera tween                                                               */
/* -------------------------------------------------------------------------- */

/** Monotonic easing used by every authored camera move. */
export function easeInOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1)
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

/** Shortest signed angular delta, so a tween never spins the long way round. */
export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) {
    delta -= Math.PI * 2
  }
  if (delta < -Math.PI) {
    delta += Math.PI * 2
  }
  return delta
}

export interface CameraTweenOptions {
  readonly durationSeconds?: number
  readonly easing?: (t: number) => number
  /** Bounds used when the start state has to be converted to the target mode. */
  readonly bounds?: CameraBounds
  /** Label for the debug surface (`viewpoint`, `focus`, …). */
  readonly kind?: string
}

/** A monotonic, eased move from one camera state to another. */
export interface CameraTween {
  readonly kind: string
  /** Start state; already converted to the destination's mode. */
  readonly from: CameraState
  readonly to: CameraState
  readonly durationSeconds: number
  readonly elapsedSeconds: number
  readonly progress: number
  readonly done: boolean
  /** Eased sample at a normalised time (defaults to the current progress). */
  sample(progress?: number): CameraState
  /** Advances the clock and returns the next camera state. */
  advance(deltaSeconds: number): CameraState
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function lerpVec3(from: Vec3, to: Vec3, t: number): Vec3 {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]
}

/**
 * Starts a camera move.
 *
 * When the two states use different modes the start is first converted with the
 * pipeline's own `cameraStateForMode`, which reproduces the current eye and
 * looking direction in the destination mode — the viewer never sees the camera
 * jump across the block when a viewpoint switches modes.
 */
export function createCameraTween(
  from: CameraState,
  to: CameraState,
  options: CameraTweenOptions = {},
): CameraTween {
  const durationSeconds = Math.max(0, options.durationSeconds ?? 0.9)
  const easing = options.easing ?? easeInOutCubic
  const bounds = options.bounds
  const start =
    from.mode === to.mode || bounds === undefined
      ? cloneCameraState(from)
      : cameraStateForMode(from, to.mode, bounds)
  const end = cloneCameraState(to)
  const azimuthDelta = shortestAngleDelta(start.orbit.azimuth, end.orbit.azimuth)

  let elapsed = 0

  const sample = (progress?: number): CameraState => {
    const t = clamp(progress ?? (durationSeconds === 0 ? 1 : elapsed / durationSeconds), 0, 1)
    if (t <= 0) {
      return cloneCameraState(start)
    }
    if (t >= 1) {
      // Exact end state: no floating-point drift at the destination.
      return cloneCameraState(end)
    }
    const eased = easing(t)
    return sanitizeCameraState(
      {
        mode: end.mode,
        target: lerpVec3(start.target, end.target, eased),
        orbit: {
          azimuth: start.orbit.azimuth + azimuthDelta * eased,
          polar: lerp(start.orbit.polar, end.orbit.polar, eased),
          radius: lerp(start.orbit.radius, end.orbit.radius, eased),
        },
        street: {
          position: lerpVec3(start.street.position, end.street.position, eased),
          heading:
            start.street.heading +
            shortestAngleDelta(start.street.heading, end.street.heading) * eased,
          pitch: lerp(start.street.pitch, end.street.pitch, eased),
        },
        fov: lerp(start.fov, end.fov, eased),
        near: lerp(start.near, end.near, eased),
        far: lerp(start.far, end.far, eased),
      },
      bounds ?? undefined,
    )
  }

  return {
    kind: options.kind ?? 'camera',
    from: start,
    to: end,
    durationSeconds,
    get elapsedSeconds(): number {
      return elapsed
    },
    get progress(): number {
      return durationSeconds === 0 ? 1 : clamp(elapsed / durationSeconds, 0, 1)
    },
    get done(): boolean {
      return durationSeconds === 0 || elapsed >= durationSeconds
    },
    sample,
    advance(deltaSeconds: number): CameraState {
      elapsed = Math.min(durationSeconds, elapsed + Math.max(0, deltaSeconds))
      return sample()
    },
  }
}
