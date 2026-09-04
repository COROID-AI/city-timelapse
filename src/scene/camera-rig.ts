import * as THREE from 'three'

/**
 * Camera control modes.
 * - `orbit`: a target-centric spherical rig. Drag rotates, wheel zooms.
 * - `walk`: first-person look-and-move. Pointer lock drives the look,
 *   WASD/arrows move the camera at a fixed eye height.
 */
export type CameraMode = 'orbit' | 'walk'

export interface CameraRigOptions {
  camera: THREE.PerspectiveCamera
  /** Element that receives pointer/wheel input (usually the renderer canvas). */
  domElement: HTMLElement
  /** Point the orbit camera revolves around (defaults to the scene origin). */
  target?: THREE.Vector3
  minPolarAngle?: number
  /** Highest polar angle; keeps the orbit camera above the ground plane. */
  maxPolarAngle?: number
  minDistance?: number
  maxDistance?: number
  /** Eye height (y) applied while walking. */
  walkEyeHeight?: number
  /** Movement speed in world units per second while walking. */
  walkSpeed?: number
  /** Radians of rotation per pixel of pointer movement in walk mode. */
  lookSensitivity?: number
  onModeChange?: (mode: CameraMode) => void
}

const ORBIT_DRAG_SENSITIVITY = 0.0052
const WHEEL_ZOOM_FACTOR = 0.0012
const ORBIT_DAMPING = 10
const WALK_DAMPING = 12
const WALK_PITCH_LIMIT = 1.45

/** Clamp a polar angle (or any value) into [min, max]. */
export function clampPolar(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Convert a spherical coordinate around `target` into a world-space position. */
export function orbitToPosition(
  target: THREE.Vector3,
  spherical: THREE.Spherical,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.setFromSpherical(spherical).add(target)
  return out
}

/**
 * Build a horizontal movement vector from the pressed key set and the current
 * yaw. Forward is -Z at yaw 0, right is +X. The result is normalized.
 */
export function movementFromKeys(
  keys: ReadonlySet<string>,
  yaw: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  let forward = 0
  let strafe = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  out.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe)
  if (out.lengthSq() > 0) out.normalize()
  return out
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  readonly domElement: HTMLElement
  /** Called whenever the active mode changes (for UI sync). */
  onModeChange: ((mode: CameraMode) => void) | null = null

  private readonly target: THREE.Vector3
  private readonly spherical: THREE.Spherical
  private readonly sphericalTarget: THREE.Spherical
  private readonly velocity = new THREE.Vector3()
  private readonly tempEuler = new THREE.Euler()
  private readonly tempVector = new THREE.Vector3()

  private readonly minPolarAngle: number
  private readonly maxPolarAngle: number
  private readonly minDistance: number
  private readonly maxDistance: number
  private readonly walkEyeHeight: number
  private readonly walkSpeed: number
  private readonly lookSensitivity: number

  private mode: CameraMode = 'orbit'
  private orbitDragging = false
  private walkDragging = false
  private lastPointerX = 0
  private lastPointerY = 0
  private yaw = 0
  private pitch = 0
  private readonly keys = new Set<string>()
  private readonly disposers: Array<() => void> = []

  constructor(options: CameraRigOptions) {
    this.camera = options.camera
    this.domElement = options.domElement
    this.target = options.target ? options.target.clone() : new THREE.Vector3()
    this.minPolarAngle = options.minPolarAngle ?? 0.1
    this.maxPolarAngle = options.maxPolarAngle ?? Math.PI / 2 - 0.05
    this.minDistance = options.minDistance ?? 4
    this.maxDistance = options.maxDistance ?? 160
    this.walkEyeHeight = options.walkEyeHeight ?? 1.7
    this.walkSpeed = options.walkSpeed ?? 6
    this.lookSensitivity = options.lookSensitivity ?? 0.0023
    this.onModeChange = options.onModeChange ?? null

    this.spherical = new THREE.Spherical().setFromVector3(
      this.tempVector.copy(this.camera.position).sub(this.target),
    )
    this.sphericalTarget = this.spherical.clone()
    this.applyOrbitClamps()

    this.wireEvents()
  }

  get currentMode(): CameraMode {
    return this.mode
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return
    if (mode === 'walk') {
      this.enterWalk()
    } else {
      this.enterOrbit()
    }
    this.onModeChange?.(this.mode)
  }

  toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit')
  }

  /** Set the orbit radius (clamped to the configured distance range). */
  setOrbitDistance(distance: number): void {
    this.sphericalTarget.radius = Math.min(
      this.maxDistance,
      Math.max(this.minDistance, distance),
    )
    this.spherical.radius = this.sphericalTarget.radius
  }

  /** Advance the rig; call once per frame with the frame delta in seconds. */
  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05))
    if (this.mode === 'orbit') {
      this.updateOrbit(dt)
    } else {
      this.updateWalk(dt)
    }
  }

  dispose(): void {
    this.keys.clear()
    for (const dispose of this.disposers.splice(0)) dispose()
  }

  private enterWalk(): void {
    this.tempEuler.setFromQuaternion(this.camera.quaternion, 'YXZ')
    this.yaw = this.tempEuler.y
    this.pitch = clampPolar(this.tempEuler.x, -WALK_PITCH_LIMIT, WALK_PITCH_LIMIT)
    this.keys.clear()
    this.velocity.set(0, 0, 0)
    this.mode = 'walk'
    this.requestPointerLock()
  }

  private enterOrbit(): void {
    this.mode = 'orbit'
    this.exitPointerLock()
    this.tempVector.copy(this.camera.position).sub(this.target)
    this.spherical.setFromVector3(this.tempVector)
    this.sphericalTarget.copy(this.spherical)
    this.applyOrbitClamps()
  }

  private updateOrbit(dt: number): void {
    const strength = 1 - Math.exp(-dt * ORBIT_DAMPING)
    this.spherical.theta += (this.sphericalTarget.theta - this.spherical.theta) * strength
    this.spherical.phi += (this.sphericalTarget.phi - this.spherical.phi) * strength
    this.spherical.radius += (this.sphericalTarget.radius - this.spherical.radius) * strength
    orbitToPosition(this.target, this.spherical, this.camera.position)
    this.camera.lookAt(this.target)
  }

  private updateWalk(dt: number): void {
    movementFromKeys(this.keys, this.yaw, this.tempVector)
    const strength = 1 - Math.exp(-dt * WALK_DAMPING)
    this.velocity.lerp(this.tempVector, strength)
    this.camera.position.addScaledVector(this.velocity, this.walkSpeed * dt)
    this.camera.position.y = this.walkEyeHeight
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
  }

  private applyOrbitClamps(): void {
    this.sphericalTarget.phi = clampPolar(
      this.sphericalTarget.phi,
      this.minPolarAngle,
      this.maxPolarAngle,
    )
    this.sphericalTarget.radius = Math.min(
      this.maxDistance,
      Math.max(this.minDistance, this.sphericalTarget.radius),
    )
  }

  private applyLookDelta(dx: number, dy: number): void {
    this.yaw -= dx * this.lookSensitivity
    this.pitch -= dy * this.lookSensitivity
    this.pitch = clampPolar(this.pitch, -WALK_PITCH_LIMIT, WALK_PITCH_LIMIT)
  }

  private isPointerLocked(): boolean {
    return document.pointerLockElement === this.domElement
  }

  private requestPointerLock(): void {
    const el = this.domElement as HTMLElement & { requestPointerLock?: () => void }
    try {
      if (typeof el.requestPointerLock === 'function') el.requestPointerLock()
    } catch {
      // Pointer lock is best-effort; walk mode keeps a drag-look fallback.
    }
  }

  private exitPointerLock(): void {
    try {
      if (this.isPointerLocked() && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock()
      }
    } catch {
      // ignored
    }
  }

  // --- Input event wiring ---------------------------------------------------

  private wireEvents(): void {
    const el = this.domElement
    this.addDomListener(el, 'pointerdown', this.handlePointerDown)
    this.addDomListener(el, 'pointermove', this.handlePointerMove)
    this.addDomListener(el, 'pointerup', this.handlePointerUp)
    this.addDomListener(el, 'pointercancel', this.handlePointerUp)
    this.addDomListener(el, 'wheel', this.handleWheel, { passive: false })
    this.addWindowListener('keydown', this.handleKeyDown)
    this.addWindowListener('keyup', this.handleKeyUp)
    this.addWindowListener('blur', this.handleWindowBlur)
    this.addDocumentListener('pointerlockchange', this.handlePointerLockChange)
    this.addDocumentListener('pointerlockerror', this.handlePointerLockError)
  }

  private addDomListener(
    target: HTMLElement,
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options)
    this.disposers.push(() => target.removeEventListener(type, listener, options))
  }

  private addWindowListener(type: string, listener: (event: Event) => void): void {
    window.addEventListener(type, listener)
    this.disposers.push(() => window.removeEventListener(type, listener))
  }

  private addDocumentListener(type: string, listener: (event: Event) => void): void {
    document.addEventListener(type, listener)
    this.disposers.push(() => document.removeEventListener(type, listener))
  }

  private handlePointerDown = (event: Event): void => {
    const e = event as PointerEvent
    if (e.button !== 0) return
    this.lastPointerX = e.clientX
    this.lastPointerY = e.clientY
    if (this.mode === 'orbit') {
      this.orbitDragging = true
    } else if (!this.isPointerLocked()) {
      // Walk-look fallback for environments without pointer lock.
      this.walkDragging = true
    }
    try {
      this.domElement.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture is optional.
    }
  }

  private handlePointerMove = (event: Event): void => {
    const e = event as PointerEvent
    const dx = e.clientX - this.lastPointerX
    const dy = e.clientY - this.lastPointerY
    this.lastPointerX = e.clientX
    this.lastPointerY = e.clientY
    if (this.mode === 'orbit') {
      if (!this.orbitDragging) return
      this.sphericalTarget.theta -= dx * ORBIT_DRAG_SENSITIVITY
      this.sphericalTarget.phi -= dy * ORBIT_DRAG_SENSITIVITY
      this.applyOrbitClamps()
    } else if (this.isPointerLocked() || this.walkDragging) {
      this.applyLookDelta(dx, dy)
    }
  }

  private handlePointerUp = (event: Event): void => {
    this.orbitDragging = false
    this.walkDragging = false
    try {
      this.domElement.releasePointerCapture((event as PointerEvent).pointerId)
    } catch {
      // ignored
    }
  }

  private handleWheel = (event: Event): void => {
    const e = event as WheelEvent
    if (this.mode !== 'orbit') return
    e.preventDefault()
    this.sphericalTarget.radius *= 1 + e.deltaY * WHEEL_ZOOM_FACTOR
    this.applyOrbitClamps()
  }

  private handleKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent
    const tag = (document.activeElement?.tagName ?? '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.code === 'KeyM' && !e.repeat) {
      this.toggleMode()
      return
    }
    this.keys.add(e.code)
  }

  private handleKeyUp = (event: Event): void => {
    this.keys.delete((event as KeyboardEvent).code)
  }

  private handleWindowBlur = (): void => {
    this.keys.clear()
    this.orbitDragging = false
    this.walkDragging = false
  }

  private handlePointerLockChange = (): void => {
    if (!this.isPointerLocked() && this.mode === 'walk') {
      // Esc / focus loss releases the lock; return the user to orbit mode.
      this.setMode('orbit')
    }
  }

  private handlePointerLockError = (): void => {
    // Pointer lock could not be acquired (e.g. requested too soon after
    // release, or unsupported environment). Walk mode stays active with the
    // drag-look fallback.
    this.walkDragging = false
  }
}