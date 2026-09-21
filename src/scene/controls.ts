/**
 * Camera state math and the bounded navigation controller.
 *
 * The controller is deliberately headless: it owns numbers, clamping and
 * damping, and only touches a three.js camera when one is handed to it. That
 * keeps every input path (mouse, touch, keyboard or a programmatic preset)
 * testable without a GPU and guarantees that all of them land in the same
 * serialisable {@link CameraState}.
 *
 * Conventions:
 * - Orbit: `eye = target + radius * (sin(polar)sin(azimuth), cos(polar),
 *   sin(polar)cos(azimuth))`, i.e. three.js spherical coordinates with azimuth
 *   measured clockwise from +Z.
 * - Street: `heading` 0 faces -Z (the three.js default); a positive heading
 *   turns the view to the left. `pitch` is positive when looking up. Both are
 *   applied as an Euler rotation in `YXZ` order.
 * - Every mutation clamps against the caller's bounds before it becomes the
 *   authoritative state, so `getState()` is always inside the block envelope.
 */

import { Euler, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import {
  CAMERA_MODES,
  type CameraBounds,
  type CameraMode,
  type CameraState,
  type CameraStatePatch,
  type CameraView,
  type KeyboardAction,
  type NavigationControls,
  type NavigationControlsOptions,
  type NavigationSensitivity,
  type NavigationStateListener,
  type PointerSample,
  type Range,
  type TouchListSample,
  type Vec3,
} from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Default vertical field of view, chosen for a cinematic 16:9 framing. */
export const DEFAULT_CAMERA_FOV = 46

export const DEFAULT_CAMERA_NEAR = 0.1
export const DEFAULT_CAMERA_FAR = 400

/** Field-of-view limits accepted from presets and URL overrides. */
export const CAMERA_FOV_RANGE: Range = { min: 18, max: 90 }

/** How far ahead of a street-level camera the derived look-at point sits. */
export const STREET_LOOK_AHEAD = 14

/**
 * Default envelope around the block.
 *
 * The block layout task owns the real dimensions; these numbers describe a
 * 34 m-radius downtown parcel and are intentionally generous so the viewer can
 * circle the block, rise above it and still walk the pavement without ever
 * leaving the interesting part of the scene.
 */
export const BLOCK_CAMERA_BOUNDS: CameraBounds = {
  center: [0, 0, 0],
  radius: 34,
  minY: 0,
  maxY: 60,
  orbitRadius: { min: 6, max: 140 },
  orbitPolar: { min: 0.12, max: 1.48 },
  streetHeight: { min: 1.6, max: 22 },
  streetPitch: { min: -0.95, max: 0.95 },
}

/** Opening viewpoint: three-quarter orbit, slightly above street level. */
export const DEFAULT_CAMERA_STATE: CameraState = {
  mode: 'orbit',
  target: [0, 4, 0],
  orbit: { azimuth: Math.PI * 0.25, polar: 1.05, radius: 46 },
  street: { position: [0, 1.75, 26], heading: 0, pitch: 0 },
  fov: DEFAULT_CAMERA_FOV,
  near: DEFAULT_CAMERA_NEAR,
  far: DEFAULT_CAMERA_FAR,
}

/** Default feel of the navigation controller. */
export const DEFAULT_NAVIGATION_SENSITIVITY: NavigationSensitivity = {
  orbit: 0.006,
  pan: 0.0022,
  zoom: 0.0016,
  move: 7,
  turn: 1.5,
  boost: 2.6,
  damping: 11,
}

/**
 * Keyboard map understood by {@link NavigationControls.handleKeyDown}.
 *
 * Arrows orbit (or turn the head at street level); holding Shift turns them
 * into panning, matching the middle-drag gesture. WASD pans/walks, +/- and the
 * page keys zoom, `M` toggles the camera mode and `R` restores the opening
 * viewpoint.
 */
export const KEY_BINDINGS: Readonly<Record<string, KeyboardAction>> = {
  ArrowLeft: 'orbitLeft',
  ArrowRight: 'orbitRight',
  ArrowUp: 'orbitUp',
  ArrowDown: 'orbitDown',
  KeyW: 'panForward',
  KeyS: 'panBack',
  KeyA: 'panLeft',
  KeyD: 'panRight',
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
  PageUp: 'zoomIn',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
  PageDown: 'zoomOut',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  KeyM: 'toggleMode',
  KeyR: 'reset',
}

/** Smallest meaningful change; below this the controller reports "settled". */
const SETTLE_EPSILON = 1e-4

/** Largest frame delta applied to damping, so a stalled tab cannot teleport. */
const MAX_DELTA_SECONDS = 0.25

/** World units per pixel of a two-finger / two-pointer translation gesture. */
const GESTURE_UNITS_PER_PIXEL = 0.02

/** Scratch objects: the controller is single-threaded and non-reentrant. */
const scratchOffset = new Vector3()
const scratchForward = new Vector3()
const scratchRight = new Vector3()
const scratchUp = new Vector3()
const scratchLookAt = new Vector3()
const scratchEuler = new Euler(0, 0, 0, 'YXZ')

/* -------------------------------------------------------------------------- */
/* Scalar + vector helpers                                                     */
/* -------------------------------------------------------------------------- */

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return value < min ? min : value > max ? max : value
}

export function clampToRange(value: number, range: Range): number {
  return clamp(value, range.min, range.max)
}

/** Wraps an angle into the half-open range `(-PI, PI]`. */
export function wrapAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0
  }
  let wrapped = (angle + Math.PI) % (Math.PI * 2)
  if (wrapped < 0) {
    wrapped += Math.PI * 2
  }
  wrapped -= Math.PI
  // `-PI` and `PI` describe the same heading; report the upper bound.
  return wrapped === -Math.PI ? Math.PI : wrapped
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/** Horizontal distance between two points, the quantity the bounds disc clamps. */
export function distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

export function vec3Equals(a: Vec3, b: Vec3, epsilon = 1e-6): boolean {
  return (
    Math.abs(a[0] - b[0]) <= epsilon &&
    Math.abs(a[1] - b[1]) <= epsilon &&
    Math.abs(a[2] - b[2]) <= epsilon
  )
}

/** Normalises a partial bounds record onto the documented defaults. */
export function createCameraBounds(partial: Partial<CameraBounds> = {}): CameraBounds {
  return {
    center: partial.center ?? BLOCK_CAMERA_BOUNDS.center,
    radius: partial.radius ?? BLOCK_CAMERA_BOUNDS.radius,
    minY: partial.minY ?? BLOCK_CAMERA_BOUNDS.minY,
    maxY: partial.maxY ?? BLOCK_CAMERA_BOUNDS.maxY,
    orbitRadius: partial.orbitRadius ?? BLOCK_CAMERA_BOUNDS.orbitRadius,
    orbitPolar: partial.orbitPolar ?? BLOCK_CAMERA_BOUNDS.orbitPolar,
    streetHeight: partial.streetHeight ?? BLOCK_CAMERA_BOUNDS.streetHeight,
    streetPitch: partial.streetPitch ?? BLOCK_CAMERA_BOUNDS.streetPitch,
  }
}

/** Horizontal clamp of a world point against the bounds disc. */
export function clampToBoundsDisc(x: number, z: number, bounds: CameraBounds): [number, number] {
  const dx = x - bounds.center[0]
  const dz = z - bounds.center[2]
  const distance = Math.hypot(dx, dz)
  if (distance <= bounds.radius || distance === 0) {
    return [x, z]
  }
  const scale = bounds.radius / distance
  return [bounds.center[0] + dx * scale, bounds.center[2] + dz * scale]
}

/* -------------------------------------------------------------------------- */
/* Camera state math                                                           */
/* -------------------------------------------------------------------------- */

/** Eye position of an orbit configuration. */
export function orbitPosition(
  target: Vec3,
  orbit: { azimuth: number; polar: number; radius: number },
): Vec3 {
  const sinPolar = Math.sin(orbit.polar)
  return [
    target[0] + orbit.radius * sinPolar * Math.sin(orbit.azimuth),
    target[1] + orbit.radius * Math.cos(orbit.polar),
    target[2] + orbit.radius * sinPolar * Math.cos(orbit.azimuth),
  ]
}

/** Unit vector a street-level camera looks along. */
export function streetForward(heading: number, pitch = 0): Vec3 {
  const cosPitch = Math.cos(pitch)
  return [-Math.sin(heading) * cosPitch, Math.sin(pitch), -Math.cos(heading) * cosPitch]
}

/** Ground-plane right vector of a street-level heading. */
export function streetRight(heading: number): Vec3 {
  return [Math.cos(heading), 0, -Math.sin(heading)]
}

/** Eye position of a camera state, whichever mode is active. */
export function cameraStatePosition(state: CameraState): Vec3 {
  return state.mode === 'street' ? state.street.position : orbitPosition(state.target, state.orbit)
}

/** Unit vector the camera looks along for the given viewpoint. */
export function cameraForward(
  mode: CameraMode,
  values: { heading: number; pitch: number; azimuth: number; polar: number },
): Vec3 {
  if (mode === 'street') {
    return streetForward(values.heading, values.pitch)
  }
  // Looking from the eye towards the target negates the eye offset.
  const sinPolar = Math.sin(values.polar)
  return [-sinPolar * Math.sin(values.azimuth), -Math.cos(values.polar), -sinPolar * Math.cos(values.azimuth)]
}

/** Derived read-only view (eye, look-ahead point and forward vector). */
export function cameraStateView(state: CameraState): CameraView {
  const position = cameraStatePosition(state)
  const forward =
    state.mode === 'street'
      ? streetForward(state.street.heading, state.street.pitch)
      : cameraForward('orbit', {
          heading: 0,
          pitch: 0,
          azimuth: state.orbit.azimuth,
          polar: state.orbit.polar,
        })
  const lookAhead = state.mode === 'street' ? STREET_LOOK_AHEAD : state.orbit.radius
  return {
    position,
    target: [
      position[0] + forward[0] * lookAhead,
      position[1] + forward[1] * lookAhead,
      position[2] + forward[2] * lookAhead,
    ],
    forward,
  }
}

/** Clamps every field of a camera state against the bounds. */
export function sanitizeCameraState(
  state: CameraState,
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  const [targetX, targetZ] = clampToBoundsDisc(state.target[0], state.target[2], bounds)
  const [streetX, streetZ] = clampToBoundsDisc(state.street.position[0], state.street.position[2], bounds)
  const near = clamp(state.near, 0.01, 50)
  return {
    mode: state.mode,
    target: [targetX, clamp(state.target[1], bounds.minY, bounds.maxY), targetZ],
    orbit: {
      azimuth: state.orbit.azimuth,
      polar: clampToRange(state.orbit.polar, bounds.orbitPolar),
      radius: clampToRange(state.orbit.radius, bounds.orbitRadius),
    },
    street: {
      position: [
        streetX,
        clamp(state.street.position[1], bounds.streetHeight.min, bounds.streetHeight.max),
        streetZ,
      ],
      heading: wrapAngle(state.street.heading),
      pitch: clampToRange(state.street.pitch, bounds.streetPitch),
    },
    fov: clampToRange(state.fov, CAMERA_FOV_RANGE),
    near,
    far: clamp(state.far, near + 1, 5000),
  }
}

/** Merges a sparse patch onto a base state (no clamping yet). */
function mergeCameraState(base: CameraState, patch: CameraStatePatch): CameraState {
  return {
    mode: patch.mode ?? base.mode,
    target: patch.target ?? base.target,
    orbit: { ...base.orbit, ...patch.orbit },
    street: { ...base.street, ...patch.street },
    fov: patch.fov ?? base.fov,
    near: patch.near ?? base.near,
    far: patch.far ?? base.far,
  }
}

/** Builds a complete camera state from the documented defaults plus a patch. */
export function createCameraState(
  patch: CameraStatePatch = {},
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  return sanitizeCameraState(mergeCameraState(DEFAULT_CAMERA_STATE, patch), bounds)
}

/**
 * Applies a patch to an existing state.
 *
 * When the patch changes the camera mode without supplying that mode's own
 * sub-state, the mode change is a *transition*: the new sub-state is derived
 * from the current eye and viewing direction so the viewer stays put instead of
 * jumping across the block.
 */
export function patchCameraState(
  base: CameraState,
  patch: CameraStatePatch,
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  if (patch.mode !== undefined && patch.mode !== base.mode) {
    const suppliedSubState = patch.mode === 'street' ? patch.street : patch.orbit
    if (suppliedSubState === undefined && patch.target === undefined) {
      return cameraStateForMode(base, patch.mode, bounds)
    }
  }
  return sanitizeCameraState(mergeCameraState(base, patch), bounds)
}

/** Serialisable deep copy (states are plain data). */
export function cloneCameraState(state: CameraState): CameraState {
  return {
    mode: state.mode,
    target: [state.target[0], state.target[1], state.target[2]],
    orbit: { ...state.orbit },
    street: {
      position: [state.street.position[0], state.street.position[1], state.street.position[2]],
      heading: state.street.heading,
      pitch: state.street.pitch,
    },
    fov: state.fov,
    near: state.near,
    far: state.far,
  }
}

/** True when two states describe the same viewpoint (within `epsilon`). */
export function cameraStatesEqual(a: CameraState, b: CameraState, epsilon = 1e-6): boolean {
  return (
    a.mode === b.mode &&
    vec3Equals(a.target, b.target, epsilon) &&
    Math.abs(a.orbit.azimuth - b.orbit.azimuth) <= epsilon &&
    Math.abs(a.orbit.polar - b.orbit.polar) <= epsilon &&
    Math.abs(a.orbit.radius - b.orbit.radius) <= epsilon &&
    vec3Equals(a.street.position, b.street.position, epsilon) &&
    Math.abs(a.street.heading - b.street.heading) <= epsilon &&
    Math.abs(a.street.pitch - b.street.pitch) <= epsilon &&
    Math.abs(a.fov - b.fov) <= epsilon &&
    Math.abs(a.near - b.near) <= epsilon &&
    Math.abs(a.far - b.far) <= epsilon
  )
}

/** Derives a street-level sub-state from the current eye/forward of any state. */
export function cameraStateToStreet(
  state: CameraState,
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  const view = cameraStateView(state)
  const [x, z] = clampToBoundsDisc(view.position[0], view.position[2], bounds)
  return sanitizeCameraState(
    {
      ...cloneCameraState(state),
      mode: 'street',
      street: {
        position: [x, view.position[1], z],
        heading: wrapAngle(Math.atan2(-view.forward[0], -view.forward[2])),
        pitch: Math.asin(clamp(view.forward[1], -1, 1)),
      },
    },
    bounds,
  )
}

/** Derives an orbit sub-state that reproduces the current eye/forward. */
export function cameraStateToOrbit(
  state: CameraState,
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  const view = cameraStateView(state)
  const radius = clampToRange(state.orbit.radius, bounds.orbitRadius)
  return sanitizeCameraState(
    {
      ...cloneCameraState(state),
      mode: 'orbit',
      target: [
        view.position[0] + view.forward[0] * radius,
        view.position[1] + view.forward[1] * radius,
        view.position[2] + view.forward[2] * radius,
      ],
      orbit: {
        azimuth: Math.atan2(-view.forward[0], -view.forward[2]),
        polar: Math.acos(clamp(-view.forward[1], -1, 1)),
        radius,
      },
    },
    bounds,
  )
}

/**
 * Switches mode while keeping the viewer in place.
 *
 * Both sub-states are kept in the returned value, so flipping back and forth
 * never loses the other viewpoint and era presets can mix modes safely.
 */
export function cameraStateForMode(
  state: CameraState,
  mode: CameraMode,
  bounds: CameraBounds = BLOCK_CAMERA_BOUNDS,
): CameraState {
  if (state.mode === mode) {
    return cloneCameraState(state)
  }
  return mode === 'street' ? cameraStateToStreet(state, bounds) : cameraStateToOrbit(state, bounds)
}

/** Writes a camera state onto a three.js camera (position, orientation, lens). */
export function applyCameraStateToCamera(camera: PerspectiveCamera, state: CameraState): void {
  camera.up.set(0, 1, 0)
  if (state.mode === 'street') {
    camera.position.set(state.street.position[0], state.street.position[1], state.street.position[2])
    scratchEuler.set(state.street.pitch, state.street.heading, 0, 'YXZ')
    camera.quaternion.setFromEuler(scratchEuler)
  } else {
    const sinPolar = Math.sin(state.orbit.polar)
    camera.position.set(
      state.target[0] + state.orbit.radius * sinPolar * Math.sin(state.orbit.azimuth),
      state.target[1] + state.orbit.radius * Math.cos(state.orbit.polar),
      state.target[2] + state.orbit.radius * sinPolar * Math.cos(state.orbit.azimuth),
    )
    scratchLookAt.set(state.target[0], state.target[1], state.target[2])
    camera.lookAt(scratchLookAt)
  }
  if (camera.fov !== state.fov || camera.near !== state.near || camera.far !== state.far) {
    camera.fov = state.fov
    camera.near = state.near
    camera.far = state.far
    camera.updateProjectionMatrix()
  }
}

/* -------------------------------------------------------------------------- */
/* Mutable state (allocation-free hot path)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Field-wise camera state used inside the controller.
 *
 * The public {@link CameraState} is a nested immutable value that is pleasant
 * to serialise but allocates on every read. The controller therefore keeps its
 * damping, clamping and camera writes on flat numbers, and only materialises a
 * `CameraState` when a caller explicitly asks for one.
 */
interface MutableCameraState {
  mode: CameraMode
  targetX: number
  targetY: number
  targetZ: number
  azimuth: number
  polar: number
  radius: number
  streetX: number
  streetY: number
  streetZ: number
  heading: number
  pitch: number
  fov: number
  near: number
  far: number
}

function writeMutable(target: MutableCameraState, state: CameraState): MutableCameraState {
  target.mode = state.mode
  target.targetX = state.target[0]
  target.targetY = state.target[1]
  target.targetZ = state.target[2]
  target.azimuth = state.orbit.azimuth
  target.polar = state.orbit.polar
  target.radius = state.orbit.radius
  target.streetX = state.street.position[0]
  target.streetY = state.street.position[1]
  target.streetZ = state.street.position[2]
  target.heading = state.street.heading
  target.pitch = state.street.pitch
  target.fov = state.fov
  target.near = state.near
  target.far = state.far
  return target
}

function createMutable(): MutableCameraState {
  return {
    mode: 'orbit',
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    azimuth: 0,
    polar: 0,
    radius: 0,
    streetX: 0,
    streetY: 0,
    streetZ: 0,
    heading: 0,
    pitch: 0,
    fov: 0,
    near: 0,
    far: 0,
  }
}

function mutableFromState(state: CameraState): MutableCameraState {
  return writeMutable(createMutable(), state)
}

function readMutable(source: MutableCameraState): CameraState {
  return {
    mode: source.mode,
    target: [source.targetX, source.targetY, source.targetZ],
    orbit: { azimuth: source.azimuth, polar: source.polar, radius: source.radius },
    street: {
      position: [source.streetX, source.streetY, source.streetZ],
      heading: source.heading,
      pitch: source.pitch,
    },
    fov: source.fov,
    near: source.near,
    far: source.far,
  }
}

/** Writes flat controller state straight onto a camera without allocating. */
function applyMutableToCamera(camera: PerspectiveCamera, state: MutableCameraState): void {
  camera.up.set(0, 1, 0)
  if (state.mode === 'street') {
    camera.position.set(state.streetX, state.streetY, state.streetZ)
    scratchEuler.set(state.pitch, state.heading, 0, 'YXZ')
    camera.quaternion.setFromEuler(scratchEuler)
  } else {
    const sinPolar = Math.sin(state.polar)
    camera.position.set(
      state.targetX + state.radius * sinPolar * Math.sin(state.azimuth),
      state.targetY + state.radius * Math.cos(state.polar),
      state.targetZ + state.radius * sinPolar * Math.cos(state.azimuth),
    )
    scratchLookAt.set(state.targetX, state.targetY, state.targetZ)
    camera.lookAt(scratchLookAt)
  }
  if (camera.fov !== state.fov || camera.near !== state.near || camera.far !== state.far) {
    camera.fov = state.fov
    camera.near = state.near
    camera.far = state.far
    camera.updateProjectionMatrix()
  }
}

/* -------------------------------------------------------------------------- */
/* Navigation controller                                                       */
/* -------------------------------------------------------------------------- */

interface Contact {
  readonly id: number
  x: number
  y: number
  readonly type: string
}

interface GestureState {
  readonly source: 'pointer' | 'touch'
  primary: Contact
  secondary: Contact | null
  /** Finger spacing of the last frame, used for pinch ratios. */
  pinchDistance: number
  /** True while the gesture should translate rather than rotate. */
  translating: boolean
}

function isFormElement(target: EventTarget | null): boolean {
  if (target === null || typeof (target as HTMLElement).tagName !== 'string') {
    return false
  }
  const element = target as HTMLElement
  const tag = element.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    tag === 'button' ||
    element.isContentEditable === true
  )
}

function contactOf(sample: PointerSample): Contact {
  return {
    id: sample.pointerId,
    x: sample.clientX,
    y: sample.clientY,
    type: sample.pointerType ?? 'mouse',
  }
}

function contactsOf(touches: TouchListSample): Contact[] {
  const contacts: Contact[] = []
  const count = Math.min(touches.length, 2)
  for (let index = 0; index < count; index += 1) {
    const touch = touches[index]
    if (touch !== undefined) {
      contacts.push({ id: index, x: touch.clientX, y: touch.clientY, type: 'touch' })
    }
  }
  return contacts
}

function spreadOf(a: Contact, b: Contact): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Creates the navigation controller.
 *
 * The controller mutates an authoritative *target* state and a damped *rendered*
 * state; {@link NavigationControls.update} closes the gap with frame-rate
 * independent exponential smoothing, so dragging feels identical at 30 or
 * 144 Hz. Inputs only ever move the target, which keeps clamping, serialisation
 * and preset handling in one place.
 */
export function createNavigationControls(
  options: NavigationControlsOptions = {},
): NavigationControls {
  const bounds = createCameraBounds(options.bounds)
  const sensitivity: NavigationSensitivity = { ...DEFAULT_NAVIGATION_SENSITIVITY, ...options.sensitivity }
  const initial = createCameraState(options.state, bounds)
  const target = mutableFromState(initial)
  const current = mutableFromState(initial)
  const camera = options.camera
  const notify = options.onStateChange

  const heldKeys = new Set<string>()
  const heldActions = new Set<KeyboardAction>()
  const listeners = new Set<NavigationStateListener>()
  let gesture: GestureState | null = null
  let settling = false

  if (notify !== undefined) {
    listeners.add(notify)
  }

  const emit = (): void => {
    if (listeners.size === 0) {
      return
    }
    const state = readMutable(target)
    for (const listener of listeners) {
      listener(state, api)
    }
  }

  const clampMutable = (state: MutableCameraState): MutableCameraState => {
    const [targetX, targetZ] = clampToBoundsDisc(state.targetX, state.targetZ, bounds)
    state.targetX = targetX
    state.targetZ = targetZ
    state.targetY = clamp(state.targetY, bounds.minY, bounds.maxY)
    state.polar = clampToRange(state.polar, bounds.orbitPolar)
    state.radius = clampToRange(state.radius, bounds.orbitRadius)
    const [streetX, streetZ] = clampToBoundsDisc(state.streetX, state.streetZ, bounds)
    state.streetX = streetX
    state.streetZ = streetZ
    state.streetY = clamp(state.streetY, bounds.streetHeight.min, bounds.streetHeight.max)
    state.heading = wrapAngle(state.heading)
    state.pitch = clampToRange(state.pitch, bounds.streetPitch)
    state.fov = clampToRange(state.fov, CAMERA_FOV_RANGE)
    state.near = clamp(state.near, 0.01, 50)
    state.far = clamp(state.far, state.near + 1, 5000)
    return state
  }

  /** Translates a drag into the active mode's movement. */
  const dragBy = (dx: number, dy: number, translating: boolean): void => {
    if (target.mode === 'street') {
      if (translating) {
        api.moveBy(-dy * GESTURE_UNITS_PER_PIXEL, -dx * GESTURE_UNITS_PER_PIXEL)
      } else {
        api.lookBy(-dx * sensitivity.orbit, -dy * sensitivity.orbit)
      }
      return
    }
    if (translating) {
      api.panBy(dx, dy)
      return
    }
    api.orbitBy(-dx * sensitivity.orbit, -dy * sensitivity.orbit)
  }

  /**
   * Moves the orbit target along the camera's own right/forward basis.
   *
   * Keyboard panning needs world-space steps rather than the pixel deltas
   * `panBy` takes, and it must follow the current viewing angle, so it shares
   * the basis maths with the drag path.
   */
  const translateTarget = (rightUnits: number, forwardUnits: number): void => {
    const sinPolar = Math.sin(target.polar)
    scratchOffset.set(
      sinPolar * Math.sin(target.azimuth),
      Math.cos(target.polar),
      sinPolar * Math.cos(target.azimuth),
    )
    scratchForward.copy(scratchOffset).multiplyScalar(-1).normalize()
    scratchUp.set(0, 1, 0)
    scratchRight.copy(scratchForward).cross(scratchUp).normalize()
    target.targetX += scratchRight.x * rightUnits + scratchForward.x * forwardUnits
    target.targetY += scratchRight.y * rightUnits + scratchForward.y * forwardUnits
    target.targetZ += scratchRight.z * rightUnits + scratchForward.z * forwardUnits
    clampMutable(target)
    settling = true
  }

  const api: NavigationControls = {
    get mode(): CameraMode {
      return target.mode
    },
    bounds,
    getState(): CameraState {
      return readMutable(target)
    },
    getView(): CameraState {
      return readMutable(current)
    },
    setState(patch: CameraStatePatch): void {
      const merged = patchCameraState(readMutable(target), patch, bounds)
      writeMutable(target, merged)
      writeMutable(current, merged)
      settling = false
      emit()
    },
    applyState(patch: CameraStatePatch): void {
      writeMutable(target, patchCameraState(readMutable(target), patch, bounds))
      settling = true
      emit()
    },
    setMode(mode: CameraMode): void {
      if (!CAMERA_MODES.includes(mode) || mode === target.mode) {
        return
      }
      const transitioned = cameraStateForMode(readMutable(current), mode, bounds)
      writeMutable(target, transitioned)
      writeMutable(current, transitioned)
      settling = false
      emit()
    },
    reset(): void {
      const fresh = createCameraState(options.state, bounds)
      writeMutable(target, fresh)
      writeMutable(current, fresh)
      heldKeys.clear()
      heldActions.clear()
      gesture = null
      settling = false
      emit()
    },
    orbitBy(deltaAzimuth: number, deltaPolar: number): void {
      target.azimuth += deltaAzimuth
      target.polar += deltaPolar
      clampMutable(target)
      settling = true
      emit()
    },
    panBy(deltaX: number, deltaY: number): void {
      if (target.mode === 'street') {
        api.moveBy(-deltaY * GESTURE_UNITS_PER_PIXEL, -deltaX * GESTURE_UNITS_PER_PIXEL)
        return
      }
      // Move the target so the world follows the cursor, scaled by the orbit
      // distance so panning feels the same whether zoomed in or out.
      const sinPolar = Math.sin(target.polar)
      scratchOffset.set(
        sinPolar * Math.sin(target.azimuth),
        Math.cos(target.polar),
        sinPolar * Math.cos(target.azimuth),
      )
      scratchForward.copy(scratchOffset).multiplyScalar(-1).normalize()
      scratchUp.set(0, 1, 0)
      scratchRight.copy(scratchForward).cross(scratchUp).normalize()
      scratchUp.copy(scratchRight).cross(scratchForward).normalize()
      const scale = sensitivity.pan * target.radius
      target.targetX += -deltaX * scale * scratchRight.x + deltaY * scale * scratchUp.x
      target.targetY += -deltaX * scale * scratchRight.y + deltaY * scale * scratchUp.y
      target.targetZ += -deltaX * scale * scratchRight.z + deltaY * scale * scratchUp.z
      clampMutable(target)
      settling = true
      emit()
    },
    moveBy(forward: number, right: number): void {
      const facing = streetForward(target.heading)
      const side = streetRight(target.heading)
      target.streetX += facing[0] * forward + side[0] * right
      target.streetZ += facing[2] * forward + side[2] * right
      clampMutable(target)
      settling = true
      emit()
    },
    lookBy(deltaHeading: number, deltaPitch: number): void {
      target.heading += deltaHeading
      target.pitch += deltaPitch
      clampMutable(target)
      settling = true
      emit()
    },
    zoomBy(factor: number): void {
      if (!Number.isFinite(factor) || factor <= 0) {
        return
      }
      if (target.mode === 'orbit') {
        target.radius = clampToRange(target.radius / factor, bounds.orbitRadius)
        clampMutable(target)
        settling = true
        emit()
        return
      }
      api.moveBy((factor - 1) * sensitivity.move, 0)
    },
    dollyBy(distance: number): void {
      if (!Number.isFinite(distance) || distance === 0) {
        return
      }
      if (target.mode === 'orbit') {
        target.radius = clampToRange(target.radius + distance, bounds.orbitRadius)
        clampMutable(target)
        settling = true
        emit()
        return
      }
      api.moveBy(distance, 0)
    },
    handleWheel(deltaY: number): void {
      if (!Number.isFinite(deltaY) || deltaY === 0) {
        return
      }
      if (target.mode === 'street') {
        api.moveBy(-deltaY * 0.02, 0)
        return
      }
      // Wheel up (negative deltaY) moves closer, which is the browser default.
      api.zoomBy(Math.exp(-deltaY * sensitivity.zoom))
    },
    handlePointerDown(sample: PointerSample): void {
      if (gesture !== null && gesture.source === 'touch') {
        return
      }
      const contact = contactOf(sample)
      if (gesture === null) {
        gesture = {
          source: 'pointer',
          primary: contact,
          secondary: null,
          pinchDistance: 0,
          translating: sample.secondary === true,
        }
        return
      }
      if (gesture.secondary === null && contact.id !== gesture.primary.id) {
        gesture.secondary = contact
        gesture.pinchDistance = spreadOf(gesture.primary, contact)
        gesture.translating = true
      }
    },
    handlePointerMove(sample: PointerSample): void {
      if (gesture === null) {
        return
      }
      const contact =
        gesture.primary.id === sample.pointerId
          ? gesture.primary
          : gesture.secondary !== null && gesture.secondary.id === sample.pointerId
            ? gesture.secondary
            : null
      if (contact === null) {
        return
      }
      const dx = sample.clientX - contact.x
      const dy = sample.clientY - contact.y
      contact.x = sample.clientX
      contact.y = sample.clientY
      if (gesture.secondary !== null) {
        const distance = spreadOf(gesture.primary, gesture.secondary)
        if (gesture.pinchDistance > 0 && distance > 0) {
          api.zoomBy(distance / gesture.pinchDistance)
        }
        gesture.pinchDistance = distance
        dragBy(dx, dy, true)
        return
      }
      dragBy(dx, dy, gesture.translating)
    },
    handlePointerUp(sample: PointerSample): void {
      if (gesture === null) {
        return
      }
      if (gesture.primary.id === sample.pointerId) {
        if (gesture.secondary !== null) {
          gesture.primary = gesture.secondary
          gesture.secondary = null
          gesture.pinchDistance = 0
          return
        }
        gesture = null
        return
      }
      if (gesture.secondary !== null && gesture.secondary.id === sample.pointerId) {
        gesture.secondary = null
        gesture.pinchDistance = 0
        gesture.translating = false
      }
    },
    handleTouchStart(touches: TouchListSample): void {
      if (gesture !== null && gesture.source === 'pointer') {
        // The browser synthesises pointer events for touch as well, and the
        // pointer gesture already owns these contacts.
        return
      }
      const contacts = contactsOf(touches)
      const first = contacts[0]
      if (first === undefined) {
        return
      }
      const second = contacts[1] ?? null
      gesture = {
        source: 'touch',
        primary: first,
        secondary: second,
        pinchDistance: second === null ? 0 : spreadOf(first, second),
        translating: second !== null,
      }
    },
    handleTouchMove(touches: TouchListSample): void {
      if (gesture === null || gesture.source !== 'touch') {
        return
      }
      const contacts = contactsOf(touches)
      const first = contacts[0]
      if (first === undefined) {
        return
      }
      const second = contacts[1]
      const dx = first.x - gesture.primary.x
      const dy = first.y - gesture.primary.y
      gesture.primary.x = first.x
      gesture.primary.y = first.y
      if (gesture.secondary !== null && second !== undefined) {
        gesture.secondary.x = second.x
        gesture.secondary.y = second.y
        const distance = spreadOf(gesture.primary, gesture.secondary)
        if (gesture.pinchDistance > 0 && distance > 0) {
          api.zoomBy(distance / gesture.pinchDistance)
        }
        gesture.pinchDistance = distance
        dragBy(dx, dy, true)
        return
      }
      if (second !== undefined) {
        gesture.secondary = { id: 1, x: second.x, y: second.y, type: 'touch' }
        gesture.pinchDistance = spreadOf(gesture.primary, gesture.secondary)
        gesture.translating = true
      }
      dragBy(dx, dy, gesture.translating)
    },
    handleTouchEnd(touches: TouchListSample): void {
      if (gesture === null || gesture.source !== 'touch') {
        return
      }
      const contacts = contactsOf(touches)
      const first = contacts[0]
      if (first === undefined) {
        gesture = null
        return
      }
      const second = contacts[1]
      gesture.primary = first
      gesture.secondary = second === undefined ? null : { id: 1, x: second.x, y: second.y, type: 'touch' }
      gesture.pinchDistance =
        gesture.secondary === null ? 0 : spreadOf(gesture.primary, gesture.secondary)
      gesture.translating = gesture.secondary !== null
    },
    handleKeyDown(code: string): boolean {
      const action = KEY_BINDINGS[code]
      if (action === undefined) {
        return false
      }
      heldKeys.add(code)
      heldActions.add(action)
      if (action === 'reset') {
        api.reset()
      } else if (action === 'toggleMode') {
        api.setMode(target.mode === 'orbit' ? 'street' : 'orbit')
      }
      return true
    },
    handleKeyUp(code: string): boolean {
      const action = KEY_BINDINGS[code]
      if (action === undefined) {
        return false
      }
      heldKeys.delete(code)
      let stillHeld = false
      for (const [key, value] of Object.entries(KEY_BINDINGS)) {
        if (value === action && heldKeys.has(key)) {
          stillHeld = true
          break
        }
      }
      if (!stillHeld) {
        heldActions.delete(action)
      }
      return true
    },
    isKeyDown(code: string): boolean {
      return heldKeys.has(code)
    },
    onStateChange(listener: NavigationStateListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(deltaSeconds: number): boolean {
      const dt = clamp(deltaSeconds, 0, MAX_DELTA_SECONDS)
      let targetChanged = false

      if (heldActions.size > 0 && dt > 0) {
        const boosting = heldActions.has('boost')
        const boost = boosting ? sensitivity.boost : 1
        const turning = sensitivity.turn * boost * dt
        const stepping = sensitivity.move * boost * dt
        const arrowRight = (heldActions.has('orbitRight') ? 1 : 0) - (heldActions.has('orbitLeft') ? 1 : 0)
        const arrowDown = (heldActions.has('orbitDown') ? 1 : 0) - (heldActions.has('orbitUp') ? 1 : 0)
        const orbitAzimuth = arrowRight * turning
        const orbitPolar = arrowDown * turning
        const forwardStep =
          (heldActions.has('panForward') ? stepping : 0) - (heldActions.has('panBack') ? stepping : 0)
        const sidewaysStep =
          (heldActions.has('panRight') ? stepping : 0) - (heldActions.has('panLeft') ? stepping : 0)
        const zoomIn = heldActions.has('zoomIn')
        const zoomOut = heldActions.has('zoomOut')

        if (target.mode === 'orbit') {
          if (boosting) {
            // Shift + arrows pans the target along the view basis, matching the
            // middle-drag gesture. Arrow keys double as pan keys while boosted.
            const panStep = stepping * 0.35
            const panRight = arrowRight + (heldActions.has('panRight') ? 1 : 0) - (heldActions.has('panLeft') ? 1 : 0)
            const panForward =
              -arrowDown + (heldActions.has('panForward') ? 1 : 0) - (heldActions.has('panBack') ? 1 : 0)
            translateTarget(panRight * panStep, panForward * panStep)
          } else {
            target.azimuth += orbitAzimuth
            target.polar += orbitPolar
          }
        } else {
          target.heading += orbitAzimuth
          target.pitch += orbitPolar
          api.moveBy(forwardStep, sidewaysStep)
        }

        if (zoomIn || zoomOut) {
          const rate = Math.exp(1.8 * dt)
          const factor = (zoomIn ? rate : 1) * (zoomOut ? 1 / rate : 1)
          if (target.mode === 'orbit') {
            target.radius = clampToRange(target.radius / factor, bounds.orbitRadius)
          } else {
            api.moveBy((factor - 1) * sensitivity.move, 0)
          }
        }

        clampMutable(target)
        targetChanged = true
        emit()
      }

      const alpha = sensitivity.damping <= 0 ? 1 : 1 - Math.exp(-sensitivity.damping * dt)
      const maxDelta = Math.max(
        Math.abs(current.targetX - target.targetX),
        Math.abs(current.targetY - target.targetY),
        Math.abs(current.targetZ - target.targetZ),
        Math.abs(current.streetX - target.streetX),
        Math.abs(current.streetY - target.streetY),
        Math.abs(current.streetZ - target.streetZ),
        Math.abs(current.radius - target.radius),
        Math.abs(current.polar - target.polar),
        Math.abs(current.fov - target.fov),
        Math.abs(current.near - target.near),
        Math.abs(current.far - target.far),
        Math.abs(wrapAngle(current.azimuth - target.azimuth)),
        Math.abs(wrapAngle(current.heading - target.heading)),
        Math.abs(current.pitch - target.pitch),
      )

      if (maxDelta <= SETTLE_EPSILON) {
        writeMutable(current, readMutable(target))
        const wasSettling = settling
        settling = false
        if (camera !== undefined) {
          applyMutableToCamera(camera, current)
        }
        return targetChanged || wasSettling
      }

      current.targetX += (target.targetX - current.targetX) * alpha
      current.targetY += (target.targetY - current.targetY) * alpha
      current.targetZ += (target.targetZ - current.targetZ) * alpha
      current.azimuth += wrapAngle(target.azimuth - current.azimuth) * alpha
      current.polar += (target.polar - current.polar) * alpha
      current.radius += (target.radius - current.radius) * alpha
      current.streetX += (target.streetX - current.streetX) * alpha
      current.streetY += (target.streetY - current.streetY) * alpha
      current.streetZ += (target.streetZ - current.streetZ) * alpha
      current.heading += wrapAngle(target.heading - current.heading) * alpha
      current.pitch += (target.pitch - current.pitch) * alpha
      current.fov += (target.fov - current.fov) * alpha
      current.near += (target.near - current.near) * alpha
      current.far += (target.far - current.far) * alpha
      current.mode = target.mode
      settling = true
      if (camera !== undefined) {
        applyMutableToCamera(camera, current)
      }
      return true
    },
    bind(element: HTMLElement): () => void {
      element.style.touchAction = 'none'

      const onPointerDown = (event: PointerEvent): void => {
        try {
          element.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is best-effort; the window listeners still work.
        }
        api.handlePointerDown({
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          pointerType: event.pointerType,
          secondary: event.button === 1 || event.button === 2 || event.shiftKey,
        })
      }
      const onPointerMove = (event: PointerEvent): void => {
        api.handlePointerMove({
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          pointerType: event.pointerType,
        })
      }
      const onPointerUp = (event: PointerEvent): void => {
        api.handlePointerUp({
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          pointerType: event.pointerType,
        })
      }
      const onWheel = (event: WheelEvent): void => {
        event.preventDefault()
        api.handleWheel(event.deltaY)
      }
      const onTouchStart = (event: TouchEvent): void => {
        event.preventDefault()
        api.handleTouchStart(event.touches)
      }
      const onTouchMove = (event: TouchEvent): void => {
        event.preventDefault()
        api.handleTouchMove(event.touches)
      }
      const onTouchEnd = (event: TouchEvent): void => {
        api.handleTouchEnd(event.touches)
      }
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.metaKey || event.ctrlKey || event.altKey || isFormElement(event.target)) {
          return
        }
        if (api.handleKeyDown(event.code)) {
          event.preventDefault()
        }
      }
      const onKeyUp = (event: KeyboardEvent): void => {
        api.handleKeyUp(event.code)
      }
      const onContextMenu = (event: Event): void => {
        event.preventDefault()
      }

      element.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      element.addEventListener('wheel', onWheel, { passive: false })
      element.addEventListener('touchstart', onTouchStart, { passive: false })
      element.addEventListener('touchmove', onTouchMove, { passive: false })
      element.addEventListener('touchend', onTouchEnd)
      element.addEventListener('touchcancel', onTouchEnd)
      element.addEventListener('contextmenu', onContextMenu)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)

      return () => {
        element.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        element.removeEventListener('wheel', onWheel)
        element.removeEventListener('touchstart', onTouchStart)
        element.removeEventListener('touchmove', onTouchMove)
        element.removeEventListener('touchend', onTouchEnd)
        element.removeEventListener('touchcancel', onTouchEnd)
        element.removeEventListener('contextmenu', onContextMenu)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        heldKeys.clear()
        heldActions.clear()
        gesture = null
      }
    },
  }

  if (camera !== undefined) {
    applyMutableToCamera(camera, current)
  }

  return api
}
