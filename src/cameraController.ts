/**
 * Camera Controller for City Timelapse
 *
 * Provides two navigation modes:
 * 1. Orbit mode - rotate, zoom, and pan around the city block center
 * 2. First-person mode - WASD/arrow movement, pointer-lock mouse look,
 *    with collision against building footprints and ground clamping
 *
 * Toggle between modes with the 'V' key or the UI hint button.
 */

import * as THREE from 'three';

/** The two navigation modes exposed by the controller. */
export type CameraMode = 'orbit' | 'first-person';

/** A 2D building footprint (axis-aligned bounding rectangle on XZ plane). */
export interface BuildingFootprint {
  /** Minimum X corner of the footprint. */
  minX: number;
  /** Maximum X corner of the footprint. */
  maxX: number;
  /** Minimum Z corner of the footprint. */
  minZ: number;
  /** Maximum Z corner of the footprint. */
  maxZ: number;
}

/** Options for constructing the CameraController. */
export interface CameraControllerOptions {
  /** The renderer DOM element for pointer/keyboard event attachment. */
  domElement: HTMLElement;
  /** The Three.js perspective camera to control. */
  camera: THREE.PerspectiveCamera;
  /** Center of the city block for orbit targeting. Defaults to origin. */
  blockCenter?: THREE.Vector3;
  /** Radius of the block for default orbit distance and bounds. */
  blockRadius?: number;
  /** Initial mode. Defaults to 'orbit'. */
  initialMode?: CameraMode;
  /** Building footprints for first-person collision. */
  footprints?: BuildingFootprint[];
}

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private mode: CameraMode;
  private readonly blockCenter: THREE.Vector3;
  private readonly blockRadius: number;
  private footprints: BuildingFootprint[];

  // Orbit state
  private orbitAzimuth = Math.PI / 4;
  private orbitPolar = Math.PI / 3;
  private orbitDistance: number;
  private readonly orbitTarget: THREE.Vector3;
  private readonly minOrbitDistance: number;
  private readonly maxOrbitDistance: number;
  private readonly minPolar = 0.1;
  private readonly maxPolar = Math.PI / 2 - 0.05;

  // First-person state
  private fpYaw = 0;
  private fpPitch = 0;
  private readonly fpEyeHeight = 1.7;
  private readonly fpMoveSpeed = 8;
  private readonly fpLookSensitivity = 0.0025;
  private readonly fpMinPitch = -Math.PI / 2 + 0.1;
  private readonly fpMaxPitch = Math.PI / 2 - 0.1;
  private readonly fpCollisionRadius = 0.6;
  private readonly fpMaxRoamRadius: number;

  // Input state
  private readonly keysDown = new Set<string>();
  private isPointerLocked = false;
  private isOrbitDragging = false;
  private isOrbitPanning = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // UI hint element
  private hintElement: HTMLDivElement | null = null;

  // Bound handlers (for add/removeEventListener)
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundKeyUp: (e: KeyboardEvent) => void;
  private readonly boundMouseDown: (e: MouseEvent) => void;
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundWheel: (e: WheelEvent) => void;
  private readonly boundPointerLockChange: () => void;
  private readonly boundContextMenu: (e: Event) => void;

  // Reusable temporaries
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpMove = new THREE.Vector3();
  private readonly tmpSpherical = new THREE.Spherical();
  private readonly tmpOffset = new THREE.Vector3();

  constructor(options: CameraControllerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.mode = options.initialMode ?? 'orbit';
    this.blockCenter = options.blockCenter ?? new THREE.Vector3(0, 0, 0);
    this.blockRadius = options.blockRadius ?? 50;
    this.footprints = options.footprints ?? [];
    this.orbitTarget = this.blockCenter.clone();
    this.orbitDistance = this.blockRadius * 2.5;
    this.minOrbitDistance = this.blockRadius * 0.3;
    this.maxOrbitDistance = this.blockRadius * 6;
    this.fpMaxRoamRadius = this.blockRadius * 1.8;

    // Bind handlers
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundPointerLockChange = this.onPointerLockChange.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();

    this.setupEventListeners();
    this.createHintElement();
    this.applyModeTransition();
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public setMode(mode: CameraMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyModeTransition();
    this.updateHint();
  }

  /** Toggle between orbit and first-person modes. */
  public toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'first-person' : 'orbit');
  }

  /** Update building footprints (e.g. after era change). */
  public updateFootprints(footprints: BuildingFootprint[]): void {
    this.footprints = footprints;
  }

  /** Per-frame update. Call from the render loop. */
  public update(deltaSeconds: number): void {
    if (this.mode === 'orbit') {
      this.updateOrbitCamera();
    } else {
      this.updateFirstPersonCamera(deltaSeconds);
    }
  }

  /** Release all event listeners and DOM elements. */
  public dispose(): void {
    this.domElement.removeEventListener('keydown', this.boundKeyDown);
    this.domElement.removeEventListener('keyup', this.boundKeyUp);
    this.domElement.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseup', this.boundMouseUp);
    this.domElement.removeEventListener('wheel', this.boundWheel);
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    this.domElement.removeEventListener('contextmenu', this.boundContextMenu);
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
    if (this.hintElement) {
      this.hintElement.remove();
      this.hintElement = null;
    }
  }

  // ---------- Event listener setup ----------

  private setupEventListeners(): void {
    this.domElement.addEventListener('keydown', this.boundKeyDown);
    this.domElement.addEventListener('keyup', this.boundKeyUp);
    this.domElement.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mouseup', this.boundMouseUp);
    this.domElement.addEventListener('wheel', this.boundWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    this.domElement.addEventListener('contextmenu', this.boundContextMenu);
    // Ensure the canvas is focusable for keyboard events
    this.domElement.tabIndex = 0;
  }

  // ---------- Input handlers ----------

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    // Mode toggle: 'V' key
    if (key === 'v') {
      this.toggleMode();
      e.preventDefault();
      return;
    }

    // Track movement keys
    this.keysDown.add(key);

    // Prevent page scroll for arrow keys
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.key.toLowerCase());
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.mode === 'orbit') {
      if (e.button === 0) {
        this.isOrbitDragging = true;
      } else if (e.button === 2) {
        this.isOrbitPanning = true;
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (this.mode === 'first-person') {
      // Request pointer lock on click for mouse look
      if (e.button === 0 && !this.isPointerLocked) {
        this.domElement.requestPointerLock();
      }
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.mode === 'orbit') {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      if (this.isOrbitDragging) {
        const rotateSpeed = 0.005;
        this.orbitAzimuth -= dx * rotateSpeed;
        this.orbitPolar -= dy * rotateSpeed;
        this.clampOrbitAngles();
      } else if (this.isOrbitPanning) {
        const panSpeed = this.orbitDistance * 0.0015;
        this.panOrbitTarget(dx, dy, panSpeed);
      }
    } else if (this.mode === 'first-person' && this.isPointerLocked) {
      this.fpYaw -= e.movementX * this.fpLookSensitivity;
      this.fpPitch -= e.movementY * this.fpLookSensitivity;
      this.clampFirstPersonAngles();
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isOrbitDragging = false;
    if (e.button === 2) this.isOrbitPanning = false;
  }

  private onWheel(e: WheelEvent): void {
    if (this.mode !== 'orbit') return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    this.orbitDistance *= zoomFactor;
    this.orbitDistance = THREE.MathUtils.clamp(
      this.orbitDistance,
      this.minOrbitDistance,
      this.maxOrbitDistance,
    );
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
  }

  // ---------- Orbit camera logic ----------

  private updateOrbitCamera(): void {
    this.tmpSpherical.set(this.orbitDistance, this.orbitPolar, this.orbitAzimuth);
    this.tmpOffset.setFromSpherical(this.tmpSpherical);
    this.camera.position.copy(this.orbitTarget).add(this.tmpOffset);
    this.camera.lookAt(this.orbitTarget);
  }

  private clampOrbitAngles(): void {
    this.orbitPolar = THREE.MathUtils.clamp(this.orbitPolar, this.minPolar, this.maxPolar);
  }

  private panOrbitTarget(dx: number, dy: number, speed: number): void {
    // Pan in screen-space using camera's right and up vectors
    this.tmpRight.setFromMatrixColumn(this.camera.matrix, 0);
    this.tmpForward.setFromMatrixColumn(this.camera.matrix, 1);
    this.orbitTarget.addScaledVector(this.tmpRight, -dx * speed);
    this.orbitTarget.addScaledVector(this.tmpForward, dy * speed);
  }

  // ---------- First-person camera logic ----------

  private updateFirstPersonCamera(deltaSeconds: number): void {
    // Build forward/right vectors from yaw (flat on XZ plane)
    const sinY = Math.sin(this.fpYaw);
    const cosY = Math.cos(this.fpYaw);
    this.tmpForward.set(-sinY, 0, -cosY);
    this.tmpRight.set(cosY, 0, -sinY);
    this.tmpMove.set(0, 0, 0);

    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) {
      this.tmpMove.add(this.tmpForward);
    }
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) {
      this.tmpMove.sub(this.tmpForward);
    }
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) {
      this.tmpMove.add(this.tmpRight);
    }
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) {
      this.tmpMove.sub(this.tmpRight);
    }

    if (this.tmpMove.lengthSq() > 0) {
      this.tmpMove.normalize().multiplyScalar(this.fpMoveSpeed * deltaSeconds);
      // Apply movement with collision
      this.applyCollision(this.camera.position, this.tmpMove);
    }

    // Clamp Y to never go below ground
    if (this.camera.position.y < this.fpEyeHeight) {
      this.camera.position.y = this.fpEyeHeight;
    }

    // Clamp horizontal position to roam radius
    const dx2 = this.camera.position.x - this.blockCenter.x;
    const dz2 = this.camera.position.z - this.blockCenter.z;
    const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    if (dist > this.fpMaxRoamRadius) {
      const scale = this.fpMaxRoamRadius / dist;
      this.camera.position.x = this.blockCenter.x + dx2 * scale;
      this.camera.position.z = this.blockCenter.z + dz2 * scale;
    }

    // Apply look direction from yaw/pitch
    const euler = new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  private clampFirstPersonAngles(): void {
    this.fpPitch = THREE.MathUtils.clamp(this.fpPitch, this.fpMinPitch, this.fpMaxPitch);
  }

  // ---------- Collision ----------

  /**
   * Resolve collision for a proposed XZ movement.
   * Prevents the camera from entering any building footprint.
   */
  private applyCollision(pos: THREE.Vector3, move: THREE.Vector3): void {
    const r = this.fpCollisionRadius;

    // Try full X then full Z (axis-separated) for smoother sliding along walls
    let newX = pos.x + move.x;
    let newZ = pos.z + move.z;

    if (this.isInsideFootprint(newX, pos.z, r)) {
      newX = pos.x; // block X movement
    }
    if (this.isInsideFootprint(pos.x, newZ, r)) {
      newZ = pos.z; // block Z movement
    }

    pos.x = newX;
    pos.z = newZ;
  }

  /** Check if point (x, z) with radius r overlaps any footprint. */
  private isInsideFootprint(x: number, z: number, r: number): boolean {
    for (const fp of this.footprints) {
      if (
        x + r > fp.minX && x - r < fp.maxX &&
        z + r > fp.minZ && z - r < fp.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  // ---------- Mode transitions ----------

  private applyModeTransition(): void {
    if (this.mode === 'first-person') {
      // Set eye height and capture current look direction
      this.camera.position.y = this.fpEyeHeight;
      this.camera.position.x = this.blockCenter.x + this.blockRadius * 0.7;
      this.camera.position.z = this.blockCenter.z + this.blockRadius * 0.7;
      // Face toward block center
      this.fpYaw = Math.atan2(
        this.blockCenter.x - this.camera.position.x,
        this.blockCenter.z - this.camera.position.z,
      );
      this.fpPitch = 0;
      // Clear keys to avoid stuck movement
      this.keysDown.clear();
    } else {
      // Exit pointer lock when returning to orbit
      if (this.isPointerLocked) {
        document.exitPointerLock();
      }
    }
  }

  // ---------- UI hint ----------

  private createHintElement(): void {
    this.hintElement = document.createElement('div');
    this.hintElement.style.cssText = [
      'position: fixed',
      'bottom: 16px',
      'left: 50%',
      'transform: translateX(-50%)',
      'padding: 8px 16px',
      'background: rgba(0,0,0,0.65)',
      'color: #fff',
      'font-family: sans-serif',
      'font-size: 13px',
      'border-radius: 8px',
      'pointer-events: none',
      'z-index: 9999',
      'user-select: none',
      'white-space: nowrap',
    ].join(';');
    document.body.appendChild(this.hintElement);
    this.updateHint();
  }

  private updateHint(): void {
    if (!this.hintElement) return;
    if (this.mode === 'orbit') {
      this.hintElement.textContent =
        'Orbit Mode — Drag to rotate, Right-drag to pan, Scroll to zoom. Press V for Walk Mode.';
    } else {
      this.hintElement.textContent =
        'Walk Mode — Click to look, WASD/Arrows to move. Press V for Orbit Mode.';
    }
  }
}