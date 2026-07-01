/**
 * First-person camera controller — owns PointerLock mouse-look plus WASD
 * translational input. Orbit navigation is handled separately by OrbitControls;
 * this controller only drives the camera while in fly mode.
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

/** The two navigation paradigms the experience toggles between. */
export type CameraMode = 'orbit' | 'fly';

export class CameraController {
  private readonly pointerLock: PointerLockControls;
  private mode: CameraMode = 'orbit';

  /** Movement key state — true while the corresponding key is held. */
  private readonly move = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  /** Translation speed in world units per second. */
  private readonly speed = 30;

  /** Subscribers notified whenever the active mode changes. */
  private readonly modeChangeListeners = new Set<(mode: CameraMode) => void>();

  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onUnlock: () => void;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.pointerLock = new PointerLockControls(camera, domElement);

    this.onKeyDown = (event) => this.setKey(event.code, true);
    this.onKeyUp = (event) => this.setKey(event.code, false);
    this.onUnlock = () => {
      // Browser exits pointer lock on Escape — sync back to orbit mode.
      if (this.mode === 'fly') {
        this.applyMode('orbit');
      }
    };

    this.pointerLock.addEventListener('unlock', this.onUnlock);
  }

  /** Register a callback fired on every mode transition. */
  onModeChange(handler: (mode: CameraMode) => void): void {
    this.modeChangeListeners.add(handler);
  }

  /** Current navigation mode. */
  getMode(): CameraMode {
    return this.mode;
  }

  /**
   * Switch to the requested mode. Entering fly mode requests pointer lock
   * (must be triggered by a user gesture such as a button click); entering
   * orbit mode releases the pointer.
   */
  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.applyMode(mode);
  }

  /** Toggle between orbit and fly modes. */
  toggleMode(): void {
    this.setMode(this.mode === 'orbit' ? 'fly' : 'orbit');
  }

  private applyMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'fly') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.pointerLock.lock();
    } else {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      if (this.pointerLock.isLocked) {
        this.pointerLock.unlock();
      }
      this.resetKeys();
    }
    this.modeChangeListeners.forEach((fn) => fn(mode));
  }

  /**
   * Per-frame update — applies WASD translation while in fly mode.
   * @param delta Seconds elapsed since the previous frame.
   */
  update(delta: number): void {
    if (this.mode !== 'fly' || !this.pointerLock.isLocked) return;

    const distance = this.speed * delta;
    if (this.move.forward) this.pointerLock.moveForward(distance);
    if (this.move.backward) this.pointerLock.moveForward(-distance);
    if (this.move.right) this.pointerLock.moveRight(distance);
    if (this.move.left) this.pointerLock.moveRight(-distance);
  }

  /** Remove all listeners and release resources. */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pointerLock.removeEventListener('unlock', this.onUnlock);
    this.pointerLock.dispose();
    this.modeChangeListeners.clear();
  }

  private setKey(code: string, down: boolean): void {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.move.forward = down;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.move.backward = down;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.move.left = down;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.move.right = down;
        break;
      default:
        break;
    }
  }

  private resetKeys(): void {
    this.move.forward = false;
    this.move.backward = false;
    this.move.left = false;
    this.move.right = false;
  }
}
