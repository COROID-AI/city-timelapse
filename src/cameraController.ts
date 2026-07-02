/**
 * CameraController — dual-mode navigation for the city timelapse scene.
 *
 * Modes
 *  - "orbit": Arcball-style orbit around the city block with mouse-drag rotate,
 *             wheel zoom, and right-drag (or two-finger) panning.
 *  - "walk":  First-person street-level walk with WASD / arrow-key movement,
 *             pointer-lock mouse look, gravity-bounded eye height, and collision
 *             against building footprints so the camera never clips underground
 *             or passes through walls.
 *
 * Toggle between modes with the "V" key (configurable). A lightweight DOM hint
 * overlay is created and kept in sync so the user always knows the active mode
 * and controls.
 *
 * The controller is framework-agnostic over Three.js: it owns no scene graph
 * other than mutating the supplied `PerspectiveCamera`. Building footprints for
 * collision are supplied via `setColliders()`.
 */

import {
  PerspectiveCamera,
  MathUtils,
  Vector3,
  Spherical,
  Box3,
  EventDispatcher,
} from 'three';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Active navigation mode. */
export type CameraMode = 'orbit' | 'walk';

/** A building footprint used for walk-mode collision. */
export interface BuildingCollider {
  /** Axis-aligned bounding box of the building volume (world space). */
  box: Box3;
}

export interface CameraControllerOptions {
  /** Initial mode. Defaults to "orbit". */
  initialMode?: CameraMode;
  /** Key code that toggles between orbit and walk. Defaults to "KeyV". */
  toggleKey?: string;
  /** Show an on-screen control hint overlay. Defaults to true. */
  showHint?: boolean;
  /** Element id for the hint overlay. Defaults to "camera-mode-hint". */
  hintId?: string;

  // --- Orbit defaults ---
  /** World point the orbit camera pivots around. */
  orbitTarget?: Vector3;
  /** Initial orbit distance. */
  orbitDistance?: number;
  /** Minimum / maximum orbit distance (zoom clamps). */
  minDistance?: number;
  maxDistance?: number;
  /** Initial azimuthal angle (radians, around Y). */
  azimuthAngle?: number;
  /** Initial polar angle (radians, from +Y). */
  polarAngle?: number;
  /** Minimum polar angle (prevents going under the ground plane). */
  minPolarAngle?: number;
  /** Maximum polar angle (prevents going under the ground plane). */
  maxPolarAngle?: number;
  /** Orbit rotate damping factor (0..1, higher = snappier). */
  rotateDamping?: number;
  /** Orbit zoom damping factor (0..1). */
  zoomDamping?: number;
  /** Orbit pan damping factor (0..1). */
  panDamping?: number;

  // --- Walk defaults ---
  /** Eye height above the ground plane in walk mode. */
  walkEyeHeight?: number;
  /** Movement speed in world units / second. */
  walkSpeed?: number;
  /** Sprint multiplier when Shift is held. */
  sprintMultiplier?: number;
  /** Mouse look sensitivity. */
  lookSensitivity?: number;
  /** Collision radius (padding around buildings). */
  collisionRadius?: number;
  /** Walkable region bounds — camera is clamped within this XZ box. */
  walkBounds?: { min: Vector3; max: Vector3 };
}

// ---------------------------------------------------------------------------
// Internal state containers
// ---------------------------------------------------------------------------

interface OrbitState {
  target: Vector3;
  spherical: Spherical;
  sphericalDelta: Spherical;
  panOffset: Vector3;
  scale: number;
  rotateDamping: number;
  zoomDamping: number;
  panDamping: number;
}

interface WalkState {
  yaw: number;
  pitch: number;
  position: Vector3;
  velocity: Vector3;
  keysDown: Set<string>;
  pointerLocked: boolean;
}
// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class CameraController extends EventDispatcher {
  readonly camera: PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly options: Required<CameraControllerOptions>;

  /** Current navigation mode. */
  mode: CameraMode;

  /** Building colliders for walk-mode collision. */
  private colliders: BuildingCollider[] = [];

  // Orbit state
  private orbit: OrbitState;

  // Walk state
  private walk: WalkState;

  // DOM hint overlay
  private hintEl: HTMLElement | null = null;

  // Pointer / drag tracking
  private pointers = new Map<number, { x: number; y: number; button: number }>();
  private rotateStart = new Vector3();
  private panStart = new Vector3();
  private isRotating = false;
  private isPanning = false;

  // Bound handlers (for removal on dispose).
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onPointerDownBound: (e: PointerEvent) => void;
  private readonly onPointerMoveBound: (e: PointerEvent) => void;
  private readonly onPointerUpBound: (e: PointerEvent) => void;
  private readonly onWheelBound: (e: WheelEvent) => void;
  private readonly onContextMenuBound: (e: Event) => void;
  private readonly onMouseMoveBound: (e: MouseEvent) => void;
  private readonly onPointerLockChangeBound: () => void;
  private readonly onToggleKeyBound: (e: KeyboardEvent) => void;
  private readonly onResizeBound: () => void;

  private disposed = false;

  constructor(
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    options: CameraControllerOptions = {},
  ) {
    super();
    this.camera = camera;
    this.domElement = domElement;

    // Merge defaults.
    const defaults: Required<CameraControllerOptions> = {
      initialMode: 'orbit',
      toggleKey: 'KeyV',
      showHint: true,
      hintId: 'camera-mode-hint',

      orbitTarget: new Vector3(0, 8, 0),
      orbitDistance: 60,
      minDistance: 12,
      maxDistance: 180,
      azimuthAngle: MathUtils.degToRad(35),
      polarAngle: MathUtils.degToRad(60),
      minPolarAngle: MathUtils.degToRad(15),
      maxPolarAngle: MathUtils.degToRad(84.5),
      rotateDamping: 0.08,
      zoomDamping: 0.12,
      panDamping: 0.12,

      walkEyeHeight: 1.7,
      walkSpeed: 8,
      sprintMultiplier: 2.2,
      lookSensitivity: 0.0022,
      collisionRadius: 0.6,
      walkBounds: {
        min: new Vector3(-80, 0, -80),
        max: new Vector3(80, 0, 80),
      },
    };
    this.options = { ...defaults, ...options } as Required<CameraControllerOptions>;

    this.mode = this.options.initialMode;

    // --- Orbit state init ---
    this.orbit = {
      target: this.options.orbitTarget.clone(),
      spherical: new Spherical(
        this.options.orbitDistance,
        this.options.polarAngle,
        this.options.azimuthAngle,
      ),
      sphericalDelta: new Spherical(),
      panOffset: new Vector3(),
      scale: 1,
      rotateDamping: this.options.rotateDamping,
      zoomDamping: this.options.zoomDamping,
      panDamping: this.options.panDamping,
    };

    // --- Walk state init ---
    const walkStart = this.options.orbitTarget.clone();
    walkStart.y = this.options.walkEyeHeight;
    const toCenter = this.options.orbitTarget.clone().sub(walkStart);
    this.walk = {
      yaw: Math.atan2(toCenter.x, toCenter.z),
      pitch: 0,
      position: walkStart,
      velocity: new Vector3(),
      keysDown: new Set<string>(),
      pointerLocked: false,
    };

    if (this.options.showHint) {
      this.createHint();
    }

    // --- Bind handlers ---
    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onPointerDownBound = (e) => this.handlePointerDown(e);
    this.onPointerMoveBound = (e) => this.handlePointerMove(e);
    this.onPointerUpBound = (e) => this.handlePointerUp(e);
    this.onWheelBound = (e) => this.handleWheel(e);
    this.onContextMenuBound = (e) => e.preventDefault();
    this.onMouseMoveBound = (e) => this.handleMouseMove(e);
    this.onPointerLockChangeBound = () => this.handlePointerLockChange();
    this.onToggleKeyBound = (e) => {
      if (e.code === this.options.toggleKey) {
        e.preventDefault();
        this.toggleMode();
      }
    };
    this.onResizeBound = () => this.camera.updateProjectionMatrix();

    this.attachEvents();
    this.applyMode();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Set the building colliders used for walk-mode collision. */
  setColliders(colliders: BuildingCollider[]): void {
    this.colliders = colliders;
  }

  /** Switch to a specific mode. */
  setMode(mode: CameraMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyMode();
  }

  /** Toggle between orbit and walk. */
  toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit');
  }

  /** Get the current mode. */
  getMode(): CameraMode {
    return this.mode;
  }

  /** Per-frame update. Call from the render loop with delta time in seconds. */
  update(deltaTime: number): void {
    if (this.disposed) return;
    const dt = MathUtils.clamp(deltaTime, 0, 0.1);
    if (this.mode === 'orbit') {
      this.updateOrbit(dt);
    } else {
      this.updateWalk(dt);
    }
  }

  /** Focus the orbit camera on a target (used when switching eras etc.). */
  focusOrbit(target: Vector3, distance?: number): void {
    this.orbit.target.copy(target);
    if (distance !== undefined) {
      this.orbit.spherical.radius = MathUtils.clamp(
        distance,
        this.options.minDistance,
        this.options.maxDistance,
      );
    }
  }

  /** Teleport the walk camera to a position (eye height applied). */
  teleportWalk(x: number, z: number): void {
    this.walk.position.set(x, this.options.walkEyeHeight, z);
    this.walk.velocity.set(0, 0, 0);
  }

  /** Clean up all event listeners and DOM nodes. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachEvents();
    if (this.hintEl && this.hintEl.parentElement) {
      this.hintEl.parentElement.removeChild(this.hintEl);
    }
    this.hintEl = null;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }
  // -----------------------------------------------------------------------
  // Event wiring
  // -----------------------------------------------------------------------

  private attachEvents(): void {
    const el = this.domElement;
    el.addEventListener('pointerdown', this.onPointerDownBound);
    el.addEventListener('pointermove', this.onPointerMoveBound);
    el.addEventListener('pointerup', this.onPointerUpBound);
    el.addEventListener('pointercancel', this.onPointerUpBound);
    el.addEventListener('wheel', this.onWheelBound, { passive: false });
    el.addEventListener('contextmenu', this.onContextMenuBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('keydown', this.onToggleKeyBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('resize', this.onResizeBound);
  }

  private detachEvents(): void {
    const el = this.domElement;
    el.removeEventListener('pointerdown', this.onPointerDownBound);
    el.removeEventListener('pointermove', this.onPointerMoveBound);
    el.removeEventListener('pointerup', this.onPointerUpBound);
    el.removeEventListener('pointercancel', this.onPointerUpBound);
    el.removeEventListener('wheel', this.onWheelBound);
    el.removeEventListener('contextmenu', this.onContextMenuBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('keydown', this.onToggleKeyBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('resize', this.onResizeBound);
  }

  // -----------------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------------

  private applyMode(): void {
    if (this.mode === 'walk') {
      // Place the walk eye at the current camera position, clamped to ground.
      this.walk.position.copy(this.camera.position);
      this.walk.position.y = this.options.walkEyeHeight;
      const dir = new Vector3();
      this.camera.getWorldDirection(dir);
      this.walk.yaw = Math.atan2(dir.x, dir.z);
      this.walk.pitch = Math.asin(MathUtils.clamp(dir.y, -1, 1));
      this.walk.velocity.set(0, 0, 0);
      this.walk.keysDown.clear();
      this.requestPointerLockHint();
    } else {
      // Returning to orbit: derive spherical from current camera position.
      const offset = this.camera.position.clone().sub(this.orbit.target);
      this.orbit.spherical.setFromVector3(offset);
      this.orbit.spherical.phi = MathUtils.clamp(
        this.orbit.spherical.phi,
        this.options.minPolarAngle,
        this.options.maxPolarAngle,
      );
      this.orbit.spherical.radius = MathUtils.clamp(
        this.orbit.spherical.radius,
        this.options.minDistance,
        this.options.maxDistance,
      );
      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
    }
    this.updateHint();
  }

  private requestPointerLockHint(): void {
    const lockOnClick = () => {
      if (this.mode === 'walk' && !this.walk.pointerLocked) {
        this.domElement.requestPointerLock?.();
      }
      this.domElement.removeEventListener('click', lockOnClick);
    };
    this.domElement.addEventListener('click', lockOnClick);
  }

  // -----------------------------------------------------------------------
  // Orbit update
  // -----------------------------------------------------------------------

  private updateOrbit(dt: number): void {
    const o = this.orbit;
    const spherical = o.spherical;

    spherical.theta += o.sphericalDelta.theta * (1 - o.rotateDamping);
    spherical.phi += o.sphericalDelta.phi * (1 - o.rotateDamping);

    spherical.phi = MathUtils.clamp(
      spherical.phi,
      this.options.minPolarAngle,
      this.options.maxPolarAngle,
    );
    spherical.theta = MathUtils.euclideanModulo(spherical.theta, Math.PI * 2);

    spherical.radius *= o.scale;
    spherical.radius = MathUtils.clamp(
      spherical.radius,
      this.options.minDistance,
      this.options.maxDistance,
    );

    o.target.addScaledVector(o.panOffset, 1 - o.panDamping);

    o.sphericalDelta.theta *= o.rotateDamping;
    o.sphericalDelta.phi *= o.rotateDamping;
    o.panOffset.multiplyScalar(o.panDamping);
    o.scale = 1 + (o.scale - 1) * o.zoomDamping;

    const offset = new Vector3().setFromSpherical(spherical);
    this.camera.position.copy(o.target).add(offset);
    this.camera.lookAt(o.target);

    void dt;
  }

  // -----------------------------------------------------------------------
  // Walk update
  // -----------------------------------------------------------------------

  private updateWalk(dt: number): void {
    const w = this.walk;
    const opt = this.options;

    const forward = new Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
    const right = new Vector3(Math.cos(w.yaw), 0, -Math.sin(w.yaw));

    const move = new Vector3();
    const k = w.keysDown;
    if (k.has('KeyW') || k.has('ArrowUp')) move.add(forward);
    if (k.has('KeyS') || k.has('ArrowDown')) move.sub(forward);
    if (k.has('KeyD') || k.has('ArrowRight')) move.add(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = opt.walkSpeed * (k.has('ShiftLeft') || k.has('ShiftRight') ? opt.sprintMultiplier : 1);
      move.multiplyScalar(speed);
    }

    w.velocity.lerp(move, 1 - Math.pow(0.001, dt));

    const next = w.position.clone().addScaledVector(w.velocity, dt);
    next.copy(this.resolveCollision(w.position, next));

    const b = opt.walkBounds;
    next.x = MathUtils.clamp(next.x, b.min.x, b.max.x);
    next.z = MathUtils.clamp(next.z, b.min.z, b.max.z);
    next.y = opt.walkEyeHeight;

    w.position.copy(next);

    this.camera.position.copy(w.position);
    this.camera.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
  }

  /**
   * Resolve collision: prevent `next` from entering any building AABB.
   * For each collider, if the point (expanded by collisionRadius) is inside
   * the box, push it to the nearest face. Iterated a few times for stability.
   */
  private resolveCollision(prev: Vector3, next: Vector3): Vector3 {
    const r = this.options.collisionRadius;
    const result = next.clone();

    for (let iter = 0; iter < 3; iter++) {
      let collided = false;
      for (const c of this.colliders) {
        const box = c.box;
        if (result.y < box.min.y - r || result.y > box.max.y + r) continue;

        const minX = box.min.x - r;
        const maxX = box.max.x + r;
        const minZ = box.min.z - r;
        const maxZ = box.max.z + r;

        if (result.x > minX && result.x < maxX && result.z > minZ && result.z < maxZ) {
          collided = true;
          const dLeft = result.x - minX;
          const dRight = maxX - result.x;
          const dFront = result.z - minZ;
          const dBack = maxZ - result.z;
          const minDist = Math.min(dLeft, dRight, dFront, dBack);

          if (minDist === dLeft) result.x = minX;
          else if (minDist === dRight) result.x = maxX;
          else if (minDist === dFront) result.z = minZ;
          else result.z = maxZ;
        }
      }
      if (!collided) break;
    }

    void prev;
    return result;
  }
  // -----------------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------------

  private handleKeyDown(e: KeyboardEvent): void {
    this.walk.keysDown.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.walk.keysDown.delete(e.code);
  }

  private handlePointerDown(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    this.domElement.setPointerCapture?.(e.pointerId);

    if (this.mode === 'walk') {
      if (!this.walk.pointerLocked) {
        this.domElement.requestPointerLock?.();
      }
      return;
    }

    if (e.button === 0) {
      this.isRotating = true;
      this.rotateStart.set(e.clientX, e.clientY, 0);
    } else if (e.button === 2 || e.button === 1) {
      this.isPanning = true;
      this.panStart.set(e.clientX, e.clientY, 0);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    }

    if (this.mode === 'walk') return;

    if (this.pointers.size === 2) {
      this.handleTwoFingerPanZoom();
      return;
    }

    if (this.isRotating) {
      const dx = e.clientX - this.rotateStart.x;
      const dy = e.clientY - this.rotateStart.y;
      this.rotateStart.set(e.clientX, e.clientY, 0);
      const rotSpeed = 0.005;
      this.orbit.sphericalDelta.theta -= dx * rotSpeed;
      this.orbit.sphericalDelta.phi -= dy * rotSpeed;
    }

    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.panStart.set(e.clientX, e.clientY, 0);
      this.panCamera(dx, dy);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.domElement.releasePointerCapture?.(e.pointerId);
    if (e.button === 0) this.isRotating = false;
    if (e.button === 2 || e.button === 1) this.isPanning = false;
  }

  private handleWheel(e: WheelEvent): void {
    if (this.mode !== 'orbit') return;
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = Math.pow(0.95, Math.sign(delta));
    this.orbit.scale *= delta > 0 ? 1 / factor : factor;
  }

  private handleTwoFingerPanZoom(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    void pts;
  }

  /** Pan the orbit target in screen space. */
  private panCamera(deltaX: number, deltaY: number): void {
    const o = this.orbit;
    const distance = o.spherical.radius;
    const panScale = distance * 0.0015;

    const offset = new Vector3().setFromSpherical(o.spherical);
    const forward = offset.clone().normalize();
    const right = new Vector3().crossVectors(this.camera.up, forward).normalize();
    const up = new Vector3().crossVectors(forward, right).normalize();

    o.panOffset.addScaledVector(right, -deltaX * panScale);
    o.panOffset.addScaledVector(up, deltaY * panScale);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.mode !== 'walk' || !this.walk.pointerLocked) return;
    const sens = this.options.lookSensitivity;
    this.walk.yaw -= e.movementX * sens;
    this.walk.pitch -= e.movementY * sens;
    const limit = MathUtils.degToRad(85);
    this.walk.pitch = MathUtils.clamp(this.walk.pitch, -limit, limit);
  }

  private handlePointerLockChange(): void {
    this.walk.pointerLocked = document.pointerLockElement === this.domElement;
    this.updateHint();
  }

  // -----------------------------------------------------------------------
  // Hint overlay
  // -----------------------------------------------------------------------

  private createHint(): void {
    const id = this.options.hintId;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: '1000',
        padding: '10px 14px',
        background: 'rgba(15, 18, 28, 0.82)',
        color: '#e8ecf4',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.12)',
        pointerEvents: 'none',
        userSelect: 'none',
        backdropFilter: 'blur(6px)',
        maxWidth: '320px',
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(el);
    }
    this.hintEl = el;
    this.updateHint();
  }

  private updateHint(): void {
    if (!this.hintEl) return;
    if (this.mode === 'orbit') {
      this.hintEl.innerHTML =
        '<b>Orbit Mode</b> — Drag to rotate · Scroll to zoom · Right-drag to pan<br>' +
        `Press <b>${this.keyLabel()}</b> for Walk mode`;
    } else {
      const lockMsg = this.walk.pointerLocked
        ? '<span style="color:#7ee787">● Mouse locked</span> — move to look'
        : '<span style="color:#f0a36e">Click to enable mouse look</span>';
      this.hintEl.innerHTML =
        '<b>Walk Mode</b> — WASD/Arrows to move · Shift to sprint · ' + lockMsg + '<br>' +
        `Press <b>${this.keyLabel()}</b> for Orbit mode`;
    }
  }

  private keyLabel(): string {
    const code = this.options.toggleKey;
    return code.replace(/^Key/, '').replace(/^Digit/, '');
  }
}
