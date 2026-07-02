/**
 * Camera controller with orbit and first-person navigation.
 *
 * Provides two navigation modes:
 *  - Orbit:  drag to rotate around a target, scroll to zoom, right-drag to pan.
 *  - First-person: drag to look, WASD / arrows to move along the ground.
 *
 * The controller attaches to a DOM element and mutates the supplied
 * THREE.PerspectiveCamera each frame via `update()`.
 */

import * as THREE from 'three';

export type CameraMode = 'orbit' | 'first-person';

export interface CameraControllerOptions {
  /** Initial orbit target. Default (0, 5, 0). */
  readonly target?: THREE.Vector3;
  /** Initial orbit distance. Default 40. */
  readonly distance?: number;
  /** Min / max orbit distance. Default [10, 120]. */
  readonly distanceRange?: readonly [number, number];
  /** Orbit rotation speed multiplier. Default 1. */
  readonly rotateSpeed?: number;
  /** First-person move speed in units/sec. Default 12. */
  readonly moveSpeed?: number;
  /** First-person look speed. Default 0.0025. */
  readonly lookSpeed?: number;
  /** Ground clamp height for first-person eye level. Default 1.7. */
  readonly eyeHeight?: number;
}

/**
 * A dual-mode camera controller.
 */
export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly options: Required<CameraControllerOptions>;

  private mode: CameraMode = 'orbit';

  // Orbit state
  private readonly orbitTarget: THREE.Vector3;
  private orbitDistance: number;
  private orbitTheta: number; // azimuth
  private orbitPhi: number; // polar

  // First-person state
  private readonly fpPosition: THREE.Vector3;
  private fpYaw: number;
  private fpPitch: number;

  // Input state
  private readonly keys = new Set<string>();
  private isDragging = false;
  private isRightDragging = false;
  private lastX = 0;
  private lastY = 0;

  private readonly spherical = new THREE.Spherical();
  private readonly tmpVec = new THREE.Vector3();

  private disposed = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: CameraControllerOptions = {},
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.options = {
      target: options.target ?? new THREE.Vector3(0, 5, 0),
      distance: options.distance ?? 40,
      distanceRange: options.distanceRange ?? [10, 120],
      rotateSpeed: options.rotateSpeed ?? 1,
      moveSpeed: options.moveSpeed ?? 12,
      lookSpeed: options.lookSpeed ?? 0.0025,
      eyeHeight: options.eyeHeight ?? 1.7,
    };

    this.orbitTarget = this.options.target.clone();
    this.orbitDistance = this.options.distance;
    this.orbitTheta = Math.PI / 4;
    this.orbitPhi = Math.PI / 3;

    this.fpPosition = new THREE.Vector3(0, this.options.eyeHeight, 20);
    this.fpYaw = Math.PI;
    this.fpPitch = 0;

    this.bindEvents();
    this.applyOrbit();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Switch between orbit and first-person modes. */
  setMode(mode: CameraMode): void {
    if (this.mode === mode) return;
    if (mode === 'first-person') {
      // Start first-person from the current camera position
      this.fpPosition.copy(this.camera.position);
      this.fpPosition.y = this.options.eyeHeight;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.fpYaw = Math.atan2(dir.x, dir.z);
      this.fpPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    }
    this.mode = mode;
  }

  /** Toggle between the two modes. */
  toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'first-person' : 'orbit');
  }

  /** Get the current navigation mode. */
  getMode(): CameraMode {
    return this.mode;
  }

  /** Set the orbit target (the point the camera revolves around). */
  setTarget(target: THREE.Vector3): void {
    this.orbitTarget.copy(target);
  }

  /** Frame a specific target at a given distance (useful for era transitions). */
  frameTarget(target: THREE.Vector3, distance: number): void {
    this.orbitTarget.copy(target);
    this.orbitDistance = THREE.MathUtils.clamp(
      distance,
      this.options.distanceRange[0],
      this.options.distanceRange[1],
    );
    if (this.mode === 'orbit') this.applyOrbit();
  }

  /**
   * Per-frame update. Call this in the render loop.
   * @param dt Delta time in seconds (for first-person movement).
   */
  update(dt: number): void {
    if (this.mode === 'first-person') {
      this.updateFirstPerson(dt);
    }
    // Orbit is applied directly from input; nothing to do per-frame unless animating
  }

  /** Tear down all event listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unbindEvents();
  }

  // ── Orbit ────────────────────────────────────────────────────────────────

  private applyOrbit(): void {
    this.spherical.set(this.orbitDistance, this.orbitPhi, this.orbitTheta);
    this.tmpVec.setFromSpherical(this.spherical).add(this.orbitTarget);
    this.camera.position.copy(this.tmpVec);
    this.camera.lookAt(this.orbitTarget);
  }

  // ── First-person ─────────────────────────────────────────────────────────

  private updateFirstPerson(dt: number): void {
    const speed = this.options.moveSpeed * dt;
    const forward = new THREE.Vector3(
      Math.sin(this.fpYaw) * Math.cos(this.fpPitch),
      0,
      Math.cos(this.fpYaw) * Math.cos(this.fpPitch),
    );
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      this.fpPosition.add(move);
      this.fpPosition.y = this.options.eyeHeight; // clamp to ground
    }

    this.camera.position.copy(this.fpPosition);
    this.tmpVec.set(
      this.fpPosition.x + Math.sin(this.fpYaw) * Math.cos(this.fpPitch),
      this.fpPosition.y + Math.sin(this.fpPitch),
      this.fpPosition.z + Math.cos(this.fpYaw) * Math.cos(this.fpPitch),
    );
    this.camera.lookAt(this.tmpVec);
  }

  // ── Event binding ────────────────────────────────────────────────────────

  private bindEvents(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private unbindEvents(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }

  // ── Event handlers (arrow functions to preserve `this`) ───────────────────

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      this.isRightDragging = true;
    } else if (e.button === 0) {
      this.isDragging = true;
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging && !this.isRightDragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.mode === 'orbit') {
      if (this.isDragging) {
        this.orbitTheta -= dx * 0.005 * this.options.rotateSpeed;
        this.orbitPhi -= dy * 0.005 * this.options.rotateSpeed;
        this.orbitPhi = THREE.MathUtils.clamp(
          this.orbitPhi,
          0.1,
          Math.PI - 0.1,
        );
        this.applyOrbit();
      } else if (this.isRightDragging) {
        // Pan the target
        const panSpeed = this.orbitDistance * 0.0015;
        const right = new THREE.Vector3();
        this.camera.getWorldDirection(right);
        right.crossVectors(this.camera.up, right).normalize();
        const up = this.camera.up.clone();
        this.orbitTarget.addScaledVector(right, dx * panSpeed);
        this.orbitTarget.addScaledVector(up, dy * panSpeed);
        this.applyOrbit();
      }
    } else {
      // First-person look
      if (this.isDragging) {
        this.fpYaw -= dx * this.options.lookSpeed;
        this.fpPitch -= dy * this.options.lookSpeed;
        this.fpPitch = THREE.MathUtils.clamp(
          this.fpPitch,
          -Math.PI / 2 + 0.05,
          Math.PI / 2 - 0.05,
        );
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.isDragging = false;
    if (e.button === 2) this.isRightDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.mode !== 'orbit') return;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.orbitDistance = THREE.MathUtils.clamp(
      this.orbitDistance * factor,
      this.options.distanceRange[0],
      this.options.distanceRange[1],
    );
    this.applyOrbit();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    // 'V' toggles mode
    if (e.code === 'KeyV') this.toggleMode();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
