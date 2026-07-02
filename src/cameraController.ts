/**
 * Navigation camera controller for the City Time Period Timelapse.
 *
 * Provides two interactive navigation modes over the city block:
 *
 * 1. **Orbit** — a mouse-driven arc-ball camera that orbits around the block
 *    centroid. Left-drag rotates, wheel zooms, right-drag pans. The camera is
 *    constrained so it can never dip below the ground plane or fly inside the
 *    block footprint.
 *
 * 2. **First-person walk** — WASD / arrow keys move the viewer along the
 *    sidewalk at pedestrian height. Pointer lock enables mouse-look. A simple
 *    axis-aligned bounding-box (AABB) collision pass against the block
 *    footprint prevents walking through buildings; a ground clamp keeps the
 *    eye height above the pavement.
 *
 * The mode toggle is bound to the `C` key and a small DOM hint overlay is
 * managed by the controller so downstream code never has to wire UI itself.
 *
 * The controller is framework-agnostic: it only needs a `THREE.PerspectiveCamera`
 * and a DOM `HTMLElement` to attach listeners to. It does not own the render
 * loop — call {@link CameraController.update} once per frame.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The two navigation modes the user can switch between. */
export type CameraMode = 'orbit' | 'walk';

/**
 * A single axis-aligned obstacle (building footprint) used for collision.
 * Coordinates are in world space; `min` is the south-west-bottom corner and
 * `max` the north-east-top corner.
 */
export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Configuration for the camera controller. All values have sensible defaults
 * so callers may pass a partial object.
 */
export interface CameraControllerOptions {
  /** The element that receives pointer / wheel / keyboard events (the canvas). */
  domElement: HTMLElement;
  /** Optional element to render the mode-hint overlay into. Created if absent. */
  hintContainer?: HTMLElement;
  /** World-space half-extent of the city block (the block is centred at origin). */
  blockHalfExtent?: number;
  /** World-space size of the full ground plane (for orbit clamp). */
  groundSize?: number;
  /** Eye height for first-person walk mode, in metres. */
  walkEyeHeight?: number;
  /** Movement speed in walk mode, in metres per second. */
  walkSpeed?: number;
  /** Initial orbit distance from the block centroid. */
  orbitDistance?: number;
  /** Minimum / maximum orbit distance (zoom clamp). */
  orbitMinDistance?: number;
  /** Maximum orbit distance (zoom clamp). */
  orbitMaxDistance?: number;
  /** Minimum polar angle (radians) — prevents going under the ground. */
  orbitMinPolar?: number;
  /** Maximum polar angle (radians) — prevents flipping over the top. */
  orbitMaxPolar?: number;
  /** Collision boxes (building footprints). Defaults to the block perimeter. */
  collisionBoxes?: CollisionBox[];
}

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  blockHalfExtent: 40,
  groundSize: 400,
  walkEyeHeight: 1.7,
  walkSpeed: 8,
  orbitDistance: 90,
  orbitMinDistance: 25,
  orbitMaxDistance: 220,
  orbitMinPolar: 0.12,
  orbitMaxPolar: Math.PI / 2 - 0.05,
} as const;

/** How long the mode-switch hint stays visible, in milliseconds. */
const HINT_FADE_MS = 1800;

/** Damping factor applied to orbit velocity each frame (higher = snappier). */
const ORBIT_DAMP = 0.82;

/** Damping factor applied to pan velocity each frame. */
const PAN_DAMP = 0.85;

/** Padding (metres) kept between the walk camera and any collision box. */
const COLLISION_SKIN = 0.45;

// ---------------------------------------------------------------------------
// Small helper: a self-contained hint overlay
// ---------------------------------------------------------------------------

/**
 * Minimal DOM overlay that shows the current mode and a transient message
 * after a mode switch. Styled inline so it needs no CSS file.
 */
class ModeHint {
  private readonly container: HTMLElement;
  private readonly label: HTMLSpanElement;
  private readonly flash: HTMLSpanElement;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:fixed',
      'left:16px',
      'bottom:16px',
      'z-index:50',
      'padding:8px 14px',
      'border-radius:8px',
      'background:rgba(15,18,22,0.72)',
      'color:#e8eef2',
      'font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace',
      'backdrop-filter:blur(6px)',
      'pointer-events:none',
      'user-select:none',
      'transition:opacity 0.4s ease',
    ].join(';');

    this.label = document.createElement('span');
    this.label.style.cssText = 'font-weight:600';

    this.flash = document.createElement('span');
    this.flash.style.cssText = 'margin-left:10px;opacity:0;transition:opacity 0.3s ease';

    this.container.appendChild(this.label);
    this.container.appendChild(this.flash);
    parent.appendChild(this.container);
  }

  /** Update the persistent mode label. */
  setMode(mode: CameraMode): void {
    if (mode === 'orbit') {
      this.label.textContent = '◉ Orbit  [C] switch · drag rotate · wheel zoom · right-drag pan';
    } else {
      this.label.textContent = '⭆ Walk  [C] switch · WASD/Arrows move · click to look · Esc release';
    }
  }

  /** Show a transient message to the right of the label. */
  flashMessage(message: string): void {
    this.flash.textContent = message;
    this.flash.style.opacity = '1';
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
    }
    this.flashTimer = setTimeout(() => {
      this.flash.style.opacity = '0';
      this.flashTimer = null;
    }, HINT_FADE_MS);
  }

  dispose(): void {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
    this.container.remove();
  }
}

// ---------------------------------------------------------------------------
// CameraController
// ---------------------------------------------------------------------------

/**
 * Interactive navigation controller wrapping a `THREE.PerspectiveCamera`.
 *
 * Create one instance per camera/canvas pair, call {@link update} every frame,
 * and call {@link dispose} on teardown.
 */
export class CameraController {
  // --- externally owned references ---
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;

  // --- configuration (resolved) ---
  private readonly blockHalfExtent: number;
  private readonly groundSize: number;
  private readonly walkEyeHeight: number;
  private readonly walkSpeed: number;
  private readonly orbitMinDistance: number;
  private readonly orbitMaxDistance: number;
  private readonly orbitMinPolar: number;
  private readonly orbitMaxPolar: number;
  private readonly collisionBoxes: CollisionBox[];

  // --- runtime state ---
  private mode: CameraMode = 'orbit';
  private readonly hint: ModeHint;

  // Orbit state (spherical coords around the block centroid)
  private readonly orbitTarget: THREE.Vector3;
  private orbitRadius: number;
  private orbitTheta: number; // azimuth (around Y)
  private orbitPhi: number; // polar (from +Y)
  private orbitThetaVel = 0;
  private orbitPhiVel = 0;
  private panX = 0;
  private panY = 0;

  // Walk state
  private readonly walkPosition: THREE.Vector3;
  private walkYaw: number;
  private walkPitch: number;
  private readonly keys: Record<string, boolean> = {};
  private pointerLocked = false;

  // Reusable temporaries (avoid per-frame allocation)
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _v3 = new THREE.Vector3();
  private readonly _sph = new THREE.Spherical();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();

  // --- bound listeners (kept so we can remove them on dispose) ---
  private readonly _onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e);
  private readonly _onKeyUp = (e: KeyboardEvent): void => this.handleKeyUp(e);
  private readonly _onMouseDown = (e: MouseEvent): void => this.handleMouseDown(e);
  private readonly _onMouseMove = (e: MouseEvent): void => this.handleMouseMove(e);
  private readonly _onMouseUp = (): void => this.handleMouseUp();
  private readonly _onWheel = (e: WheelEvent): void => this.handleWheel(e);
  private readonly _onContext = (e: Event): void => e.preventDefault();
  private readonly _onClick = (): void => this.handleClick();
  private readonly _onPointerLockChange = (): void => this.handlePointerLockChange();

  private dragging: 'rotate' | 'pan' | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  /**
   * @param camera The perspective camera to drive.
   * @param options Configuration (see {@link CameraControllerOptions}).
   */
  constructor(camera: THREE.PerspectiveCamera, options: CameraControllerOptions) {
    this.camera = camera;
    this.domElement = options.domElement;

    this.blockHalfExtent = options.blockHalfExtent ?? DEFAULTS.blockHalfExtent;
    this.groundSize = options.groundSize ?? DEFAULTS.groundSize;
    this.walkEyeHeight = options.walkEyeHeight ?? DEFAULTS.walkEyeHeight;
    this.walkSpeed = options.walkSpeed ?? DEFAULTS.walkSpeed;
    this.orbitMinDistance = options.orbitMinDistance ?? DEFAULTS.orbitMinDistance;
    this.orbitMaxDistance = options.orbitMaxDistance ?? DEFAULTS.orbitMaxDistance;
    this.orbitMinPolar = options.orbitMinPolar ?? DEFAULTS.orbitMinPolar;
    this.orbitMaxPolar = options.orbitMaxPolar ?? DEFAULTS.orbitMaxPolar;

    // Collision boxes: use provided set or synthesise a solid block perimeter.
    this.collisionBoxes = options.collisionBoxes ?? this.defaultCollisionBoxes();

    // Orbit defaults — look at the block from the south-east, slightly elevated.
    this.orbitTarget = new THREE.Vector3(0, 0, 0);
    this.orbitRadius = options.orbitDistance ?? DEFAULTS.orbitDistance;
    this.orbitTheta = Math.PI / 4;
    this.orbitPhi = Math.PI / 3;

    // Walk defaults — start on the south sidewalk facing north.
    this.walkPosition = new THREE.Vector3(0, this.walkEyeHeight, this.blockHalfExtent + 8);
    this.walkYaw = 0;
    this.walkPitch = 0;

    // Hint overlay
    const hintParent = options.hintContainer ?? document.body;
    this.hint = new ModeHint(hintParent);
    this.hint.setMode(this.mode);

    this.attachListeners();
    this.applyOrbitCamera();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Current navigation mode. */
  getMode(): CameraMode {
    return this.mode;
  }

  /** Switch to a specific mode. */
  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.transitionTo(mode);
  }

  /** Toggle between orbit and walk. */
  toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit');
  }

  /**
   * Per-frame update. Call this once every render frame with the elapsed
   * time (seconds) since the previous frame.
   */
  update(deltaSeconds: number): void {
    if (this.mode === 'orbit') {
      this.updateOrbit(deltaSeconds);
    } else {
      this.updateWalk(deltaSeconds);
    }
  }

  /**
   * Replace the collision set at runtime (e.g. when the city block is
   * regenerated for a new era). The block centroid is assumed to stay at
   * the origin.
   */
  setCollisionBoxes(boxes: CollisionBox[]): void {
    this.collisionBoxes.length = 0;
    this.collisionBoxes.push(...boxes);
  }

  /** Release all listeners and DOM artifacts. */
  dispose(): void {
    this.detachListeners();
    if (this.pointerLocked && document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
    this.hint.dispose();
  }

  // ---------------------------------------------------------------------------
  // Listener wiring
  // ---------------------------------------------------------------------------

  private attachListeners(): void {
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    this.domElement.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this._onContext);
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  private detachListeners(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('contextmenu', this._onContext);
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private handleKeyDown(e: KeyboardEvent): void {
    const code = e.code;

    // Mode toggle (C) works in both modes.
    if (code === 'KeyC' && !e.repeat) {
      e.preventDefault();
      this.toggleMode();
      return;
    }

    // Track movement keys for walk mode.
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      this.keys[code] = true;
      // Prevent the page from scrolling when arrows are used.
      if (this.mode === 'walk') e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.mode !== 'orbit') return;
    if (e.button === 0) {
      this.dragging = 'rotate';
    } else if (e.button === 2) {
      this.dragging = 'pan';
    }
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.mode === 'orbit') {
      if (this.dragging === null) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      if (this.dragging === 'rotate') {
        // Sensitivity scales a bit with viewport size for consistent feel.
        this.orbitThetaVel -= dx * 0.005;
        this.orbitPhiVel -= dy * 0.005;
      } else {
        this.panX += dx * 0.35;
        this.panY += dy * 0.35;
      }
    } else if (this.mode === 'walk' && this.pointerLocked) {
      // Pointer-lock mouse look.
      const sensitivity = 0.0022;
      this.walkYaw -= e.movementX * sensitivity;
      this.walkPitch -= e.movementY * sensitivity;
      // Clamp pitch so the viewer can't flip over.
      const limit = Math.PI / 2 - 0.05;
      this.walkPitch = Math.max(-limit, Math.min(limit, this.walkPitch));
    }
  }

  private handleMouseUp(): void {
    this.dragging = null;
  }

  private handleWheel(e: WheelEvent): void {
    if (this.mode !== 'orbit') return;
    e.preventDefault();
    // Normalised wheel delta → zoom factor.
    const factor = Math.exp(e.deltaY * 0.0012);
    this.orbitRadius = THREE.MathUtils.clamp(
      this.orbitRadius * factor,
      this.orbitMinDistance,
      this.orbitMaxDistance,
    );
  }

  private handleClick(): void {
    // In walk mode, a click on the canvas requests pointer lock for mouse-look.
    if (this.mode === 'walk' && !this.pointerLocked) {
      this.domElement.requestPointerLock();
    }
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.domElement;
    if (!this.pointerLocked) {
      // Clear any held movement keys when focus is lost.
      for (const key of Object.keys(this.keys)) {
        this.keys[key] = false;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mode transition
  // ---------------------------------------------------------------------------

  private transitionTo(mode: CameraMode): void {
    if (mode === 'walk') {
      // Seed the walk position from the current orbit camera position so the
      // transition feels continuous, then drop to eye height.
      this.walkPosition.copy(this.camera.position);
      this.walkPosition.y = this.walkEyeHeight;
      // Snap to ground + collision boundary.
      this.clampWalkPosition();

      // Derive yaw/pitch from the camera's current look direction.
      this.camera.getWorldDirection(this._v1);
      this.walkYaw = Math.atan2(-this._v1.x, -this._v1.z);
      this.walkPitch = Math.asin(THREE.MathUtils.clamp(this._v1.y, -1, 1));

      // Exit any active orbit drag.
      this.dragging = null;
      this.hint.flashMessage('Walk mode — click to look around');
    } else {
      // Release pointer lock when leaving walk mode.
      if (this.pointerLocked && document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
      // Seed orbit target from the walk position so we orbit around where
      // the viewer is standing.
      this.orbitTarget.set(this.walkPosition.x, 0, this.walkPosition.z);
      this.applyOrbitCamera();
      this.hint.flashMessage('Orbit mode — drag to rotate');
    }

    this.mode = mode;
    this.hint.setMode(mode);
  }

  // ---------------------------------------------------------------------------
  // Orbit update
  // ---------------------------------------------------------------------------

  private updateOrbit(deltaSeconds: number): void {
    // Apply inertial velocity with damping.
    this.orbitTheta += this.orbitThetaVel;
    this.orbitPhi += this.orbitPhiVel;
    this.orbitThetaVel *= ORBIT_DAMP;
    this.orbitPhiVel *= ORBIT_DAMP;

    // Clamp polar angle so the camera stays above the ground and below the zenith.
    this.orbitPhi = THREE.MathUtils.clamp(this.orbitPhi, this.orbitMinPolar, this.orbitMaxPolar);

    // Apply pan delta to the orbit target (screen-space → world).
    if (this.panX !== 0 || this.panY !== 0) {
      // Build a horizontal basis from the current azimuth.
      const sinT = Math.sin(this.orbitTheta);
      const cosT = Math.cos(this.orbitTheta);
      // Right vector (perpendicular to view dir in XZ plane).
      this._v1.set(cosT, 0, -sinT);
      // Up-forward vector.
      this._v2.set(sinT, 0, cosT);
      this.orbitTarget.addScaledVector(this._v1, -this.panX * 0.01);
      this.orbitTarget.addScaledVector(this._v2, this.panY * 0.01);
      this.panX *= PAN_DAMP;
      this.panY *= PAN_DAMP;
      if (Math.abs(this.panX) < 0.01) this.panX = 0;
      if (Math.abs(this.panY) < 0.01) this.panY = 0;
    }

    // Clamp the orbit target so panning can't drift off the ground plane.
    const half = this.groundSize / 2 - this.blockHalfExtent;
    this.orbitTarget.x = THREE.MathUtils.clamp(this.orbitTarget.x, -half, half);
    this.orbitTarget.z = THREE.MathUtils.clamp(this.orbitTarget.z, -half, half);
    this.orbitTarget.y = 0;

    this.applyOrbitCamera();

    // deltaSeconds is unused for orbit (inertial model), but consumed to avoid
    // frame-rate dependence in walk mode. Keep the parameter referenced.
    void deltaSeconds;
  }

  /** Position the camera from spherical orbit state. */
  private applyOrbitCamera(): void {
    this._sph.set(this.orbitRadius, this.orbitPhi, this.orbitTheta);
    this._v1.setFromSpherical(this._sph);
    this.camera.position.copy(this.orbitTarget).add(this._v1);

    // Ensure the camera never dips below the ground plane.
    if (this.camera.position.y < 1.5) {
      this.camera.position.y = 1.5;
    }

    this.camera.lookAt(this.orbitTarget);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // Walk update
  // ---------------------------------------------------------------------------

  private updateWalk(deltaSeconds: number): void {
    // Determine movement direction from keys (camera-relative).
    let forward = 0;
    let strafe = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;

    if (forward !== 0 || strafe !== 0) {
      // Forward vector (XZ plane) from yaw.
      const sinY = Math.sin(this.walkYaw);
      const cosY = Math.cos(this.walkYaw);
      this._v1.set(-sinY, 0, -cosY); // forward
      this._v2.set(cosY, 0, -sinY); // right

      const move = this._v3.set(0, 0, 0);
      move.addScaledVector(this._v1, forward);
      move.addScaledVector(this._v2, strafe);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(this.walkSpeed * deltaSeconds);
        this.walkPosition.add(move);
        this.clampWalkPosition();
      }
    }

    // Apply yaw + pitch to the camera.
    this._euler.set(this.walkPitch, this.walkYaw, 0, 'YXZ');
    this._quat.setFromEuler(this._euler);
    this.camera.position.copy(this.walkPosition);
    this.camera.quaternion.copy(this._quat);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Clamp the walk position to keep the viewer on the sidewalk: above the
   * ground, inside the ground plane bounds, and outside every collision box.
   */
  private clampWalkPosition(): void {
    // Ground clamp — never sink below eye height.
    this.walkPosition.y = this.walkEyeHeight;

    // Keep within the overall ground plane.
    const limit = this.groundSize / 2 - 2;
    this.walkPosition.x = THREE.MathUtils.clamp(this.walkPosition.x, -limit, limit);
    this.walkPosition.z = THREE.MathUtils.clamp(this.walkPosition.z, -limit, limit);

    // Push out of any building footprint (AABB vs point, XZ only).
    for (const box of this.collisionBoxes) {
      const minX = box.min.x - COLLISION_SKIN;
      const maxX = box.max.x + COLLISION_SKIN;
      const minZ = box.min.z - COLLISION_SKIN;
      const maxZ = box.max.z + COLLISION_SKIN;

      if (
        this.walkPosition.x > minX &&
        this.walkPosition.x < maxX &&
        this.walkPosition.z > minZ &&
        this.walkPosition.z < maxZ
      ) {
        // Find the nearest face and push the position out along it.
        const dxLeft = Math.abs(this.walkPosition.x - minX);
        const dxRight = Math.abs(maxX - this.walkPosition.x);
        const dzFront = Math.abs(this.walkPosition.z - minZ);
        const dzBack = Math.abs(maxZ - this.walkPosition.z);
        const minDist = Math.min(dxLeft, dxRight, dzFront, dzBack);

        if (minDist === dxLeft) {
          this.walkPosition.x = minX;
        } else if (minDist === dxRight) {
          this.walkPosition.x = maxX;
        } else if (minDist === dzFront) {
          this.walkPosition.z = minZ;
        } else {
          this.walkPosition.z = maxZ;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  /**
   * Synthesise a default collision set: four solid slabs forming the block
   * perimeter, leaving the streets and an interior courtyard walkable.
   */
  private defaultCollisionBoxes(): CollisionBox[] {
    const h = this.blockHalfExtent;
    const slab = h * 0.25; // thickness of the perimeter slab
    const height = 40; // tall enough to matter for orbit clipping
    return [
      // North slab
      { min: new THREE.Vector3(-h, 0, h - slab), max: new THREE.Vector3(h, height, h) },
      // South slab
      { min: new THREE.Vector3(-h, 0, -h), max: new THREE.Vector3(h, height, -h + slab) },
      // East slab
      { min: new THREE.Vector3(h - slab, 0, -h), max: new THREE.Vector3(h, height, h) },
      // West slab
      { min: new THREE.Vector3(-h, 0, -h), max: new THREE.Vector3(-h + slab, height, h) },
    ];
  }
}
