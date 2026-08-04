import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ControlMode = 'walk' | 'orbit';

export interface ModeSwitchCallbacks {
  /** Fired after the active control mode changes (mode already updated). */
  onModeChange?: (mode: ControlMode) => void;
}

export interface ModeSwitchOptions {
  /** Optional camera position used when entering orbit mode. */
  orbitCameraPosition?: THREE.Vector3;
  /** Optional camera target used when entering orbit mode. */
  orbitTarget?: THREE.Vector3;
}

const TOGGLE_KEY = 'KeyR';

/**
 * Manages the active control set: first-person walk (PointerLockControls)
 * vs. the OrbitControls fallback.
 *
 * - `toggle()` switches modes; the toggle key is R.
 * - Orbit mode keeps the camera inside the same street grid by keeping its
 *   current position and resetting the target each frame, so the city stays
 *   viewable even when Pointer Lock is blocked.
 * - While orbit mode is active the walk camera keeps its last position; the
 *   pointer-lock error handler and Esc both route back to this mode.
 */
export class ModeSwitch {
  readonly walk: {
    isLocked: boolean;
    requestLock: () => void;
    releaseLock: () => void;
    respawn: (x: number, z: number) => void;
    update: (delta: number) => void;
  };
  private readonly orbit: OrbitControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly fallbackPosition: THREE.Vector3;
  private readonly fallbackTarget: THREE.Vector3;
  private mode: ControlMode = 'walk';
  private callbacks: ModeSwitchCallbacks = {};
  private readonly savedOrbitTarget = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    walk: ModeSwitch['walk'],
    options: ModeSwitchOptions = {},
  ) {
    this.camera = camera;
    this.walk = walk;
    this.fallbackPosition = (options.orbitCameraPosition ?? new THREE.Vector3(0, 70, 130)).clone();
    this.fallbackTarget = (options.orbitTarget ?? new THREE.Vector3(0, 0, 0)).clone();
    this.savedOrbitTarget.copy(this.fallbackTarget);
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enabled = false;
    this.orbit.target.copy(this.fallbackTarget);
  }

  /** Surface mode-change notifications (used for the on-screen prompt). */
  setCallbacks(callbacks: ModeSwitchCallbacks): void {
    this.callbacks = callbacks;
  }

  get activeMode(): ControlMode {
    return this.mode;
  }

  /**
   * Switch between walk and orbit modes. Entering orbit mode keeps the walk
   * camera position (it does not teleport), and the camera target converges
   * toward the city origin each frame so the scene stays framed. Entering
   * walk mode preserves the orbit camera position as the new walk spot.
   */
  toggle(): void {
    if (this.mode === 'walk') {
      this.mode = 'orbit';
      this.walk.releaseLock();
      this.savedOrbitTarget.copy(this.camera.position);
      this.orbit.enabled = true;
      this.orbit.target.copy(this.camera.position);
      this.orbit.update();
    } else {
      this.mode = 'walk';
      this.orbit.enabled = false;
      this.orbit.target.copy(this.camera.position);
      this.orbit.update();
      // Walk mode is ground-locked; put the camera back on foot if orbit
      // mode had moved it somewhere unusual.
      if (this.camera.position.y > this.fallbackPosition.y * 0.6) {
        this.walk.respawn(this.camera.position.x, this.camera.position.z);
      }
    }
    this.callbacks.onModeChange?.(this.mode);
  }

  /** Disable orbit mode and return to walk mode (used by pointer-lock errors). */
  forceWalk(): void {
    if (this.mode !== 'walk') {
      this.toggle();
    }
  }

  /** React to a pointer-lock error: fall back to orbit mode. */
  handlePointerLockError(): void {
    if (this.mode === 'walk') {
      this.mode = 'orbit';
      this.savedOrbitTarget.copy(this.camera.position);
      this.orbit.enabled = true;
      this.orbit.target.copy(this.camera.position);
      this.orbit.update();
      this.callbacks.onModeChange?.(this.mode);
    }
  }

  /** Per-frame update for the active control set. */
  update(delta: number): void {
    if (this.mode === 'walk') {
      this.walk.update(delta);
    } else {
      // Keep the camera within the city and nudge the target toward the
      // origin so a fresh orbit session starts around the city.
      this.camera.position.y = Math.max(this.camera.position.y, 1.6);
      this.savedOrbitTarget.lerp(this.fallbackTarget, 0.03);
      this.orbit.target.copy(this.savedOrbitTarget);
      this.orbit.update();
    }
  }
}

/** Handle the R toggle key: switch modes, never while typing in a field. */
export function handleModeToggleKey(
  event: KeyboardEvent,
  modeSwitch: ModeSwitch,
): void {
  if (event.code !== TOGGLE_KEY || event.repeat) {
    return;
  }
  const target = event.target;
  const tagName =
    target && typeof target === 'object' && 'tagName' in target
      ? (target as { tagName: unknown }).tagName
      : undefined;
  if (
    tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement)
    || (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement)
    || (typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement)
  ) {
    return;
  }
  modeSwitch.toggle();
}

export function isModeToggleKey(event: KeyboardEvent): boolean {
  return event.code === TOGGLE_KEY;
}
