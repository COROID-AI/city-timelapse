import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ERA_YEARS, type EraYear } from '../eras';

export type EraSelectionListener = (year: EraYear) => void;

export interface CameraControlsOptions {
  domElement: HTMLElement;
  camera: THREE.PerspectiveCamera;
  /** Fly speed in world units/second. */
  flySpeed?: number;
  /** Element to lock the pointer on (defaults to document.body). */
  lockTarget?: HTMLElement;
}

/**
 * Camera navigation combining OrbitControls (drag-rotate, scroll-zoom) with a
 * Pointer Lock fly mode (WASD + mouse-look). Also owns the keyboard era
 * hotkeys 1-5, which emit era-selection events to be wired to the timeline.
 */
export class CameraControls {
  readonly orbit: OrbitControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly lockTarget: HTMLElement;
  private readonly flySpeed: number;
  private readonly keys = new Set<string>();
  private readonly eraListeners = new Set<EraSelectionListener>();
  private flyEnabled = false;

  private readonly temp = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor(options: CameraControlsOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.flySpeed = options.flySpeed ?? 8;
    this.lockTarget = options.lockTarget ?? document.body;

    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.screenSpacePanning = true;

    this.domElement.addEventListener('click', this.handleClick);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  /** Subscribe to era selection (keyboard 1-5). Returns an unsubscribe fn. */
  onEraSelect(listener: EraSelectionListener): () => void {
    this.eraListeners.add(listener);
    return () => {
      this.eraListeners.delete(listener);
    };
  }

  get isLocked(): boolean {
    return this.flyEnabled;
  }

  togglePointerLock(): void {
    if (this.flyEnabled) {
      document.exitPointerLock();
    } else {
      this.lockTarget.requestPointerLock();
    }
  }

  private handleClick = (): void => {
    // A click on the canvas enters pointer-lock fly mode.
    this.togglePointerLock();
  };

  private handlePointerLockChange = (): void => {
    this.flyEnabled = document.pointerLockElement === this.lockTarget;
    this.orbit.enabled = !this.flyEnabled;
    if (!this.flyEnabled) {
      this.keys.clear();
    }
  };

  private handlePointerLockError = (): void => {
    this.flyEnabled = false;
    this.orbit.enabled = true;
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.flyEnabled) {
      return;
    }
    const yaw = -event.movementX * 0.002;
    const pitch = -event.movementY * 0.002;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y += yaw;
    this.camera.rotation.x = THREE.MathUtils.clamp(
      this.camera.rotation.x + pitch,
      -Math.PI / 2,
      Math.PI / 2,
    );
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.flyEnabled) {
      this.keys.add(event.code);
    }
    this.handleEraHotkey(event);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private handleEraHotkey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
    if (index >= 0 && index < ERA_YEARS.length) {
      const year = ERA_YEARS[index];
      this.eraListeners.forEach((listener) => listener(year));
    }
  }

  /** Advance fly motion and damped orbit. Call each frame. */
  update(delta: number): void {
    if (this.flyEnabled) {
      this.updateFly(delta);
    }
    this.orbit.update();
  }

  private updateFly(delta: number): void {
    const speed = this.flySpeed * delta;
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, this.camera.up).normalize();

    const move = this.temp.set(0, 0, 0);
    if (this.keys.has('KeyW')) {
      move.add(this.forward);
    }
    if (this.keys.has('KeyS')) {
      move.sub(this.forward);
    }
    if (this.keys.has('KeyD')) {
      move.add(this.right);
    }
    if (this.keys.has('KeyA')) {
      move.sub(this.right);
    }
    if (this.keys.has('Space')) {
      move.y += 1;
    }
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      move.y -= 1;
    }
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      this.camera.position.add(move);
    }

    // Keep the orbit target roughly ahead so unlocking doesn't snap oddly.
    this.orbit.target.copy(this.camera.position).addScaledVector(this.forward, 10);
  }

  dispose(): void {
    this.domElement.removeEventListener('click', this.handleClick);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.orbit.dispose();
    if (document.pointerLockElement === this.lockTarget) {
      document.exitPointerLock();
    }
  }
}
