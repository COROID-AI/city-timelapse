import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { CollisionBox } from '../city/types';
import {
  type CityBounds,
  integrateVertical,
  resolveStep,
} from './movement';

/** Input snapshot read from the keyboard every frame. */
export interface WalkInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
}

export interface WalkOptions {
  /** Walk speed (world units/second). */
  walkSpeed?: number;
  /** Sprint speed multiplier applied while sprint is held. */
  sprintMultiplier?: number;
  /** Optional rectangular boundary kept inside the city. */
  bounds?: CityBounds;
  /** Y coordinate of the ground plane. */
  groundY?: number;
  /** Camera height above the ground plane while standing. */
  eyeHeight?: number;
  /** Gravity applied while airborne (positive = pulls down). */
  gravity?: number;
  /** Initial vertical speed of a jump (positive = up). */
  jumpSpeed?: number;
  /** Player collision radius. */
  radius?: number;
  /** Lock/unlock notifications (surfaced from main.ts). */
  callbacks?: WalkControlsCallbacks;
}

export interface WalkControlsCallbacks {
  /** Fired when pointer lock is acquired (walk mode starts). */
  onLock?: () => void;
  /** Fired when pointer lock is lost (Esc or browser refusal). */
  onUnlock?: () => void;
}

interface ResolvedWalkOptions {
  walkSpeed: number;
  sprintMultiplier: number;
  bounds?: CityBounds;
  groundY: number;
  eyeHeight: number;
  gravity: number;
  jumpSpeed: number;
  radius: number;
  collisionData: readonly CollisionBox[];
  callbacks?: WalkControlsCallbacks;
}

const JUMP_KEY = 'Space';
const SPRINT_KEY = 'ShiftLeft';
const MOVE_KEYS: ReadonlySet<string> = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const UP = new THREE.Vector3(0, 1, 0);

/**
 * First-person walk controller built on THREE PointerLockControls.
 *
 * - WASD/arrow keys move the camera at walking speed; Shift sprints, Space
 *   jumps (and lands back on the ground plane).
 * - Mouse look comes from PointerLockControls while the pointer is locked.
 * - Movement resolves against the building collision boxes exported by
 *   city-generation with axis-separated sliding collision, so the player
 *   cannot walk through buildings and stays at eye height above the ground.
 */
export class WalkControls {
  readonly pointerLock: PointerLockControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly options: ResolvedWalkOptions;
  private readonly input: WalkInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };
  private vertical: { y: number; verticalVelocity: number; onGround: boolean };
  private readonly tempDirection = new THREE.Vector3();
  private readonly tempRight = new THREE.Vector3();
  private readonly tempOffset = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    collisionData: readonly CollisionBox[],
    options: WalkOptions = {},
  ) {
    this.camera = camera;
    this.pointerLock = new PointerLockControls(camera, domElement);
    this.options = {
      walkSpeed: options.walkSpeed ?? 2.4,
      sprintMultiplier: options.sprintMultiplier ?? 1.7,
      bounds: options.bounds,
      groundY: options.groundY ?? 0,
      eyeHeight: options.eyeHeight ?? 1.6,
      gravity: options.gravity ?? 14,
      jumpSpeed: options.jumpSpeed ?? 4.4,
      radius: options.radius ?? 0.5,
      collisionData,
      callbacks: options.callbacks,
    };
    this.vertical = {
      y: camera.position.y,
      verticalVelocity: 0,
      onGround: true,
    };

    this.pointerLock.addEventListener('lock', () => {
      this.vertical.onGround = true;
      this.vertical.verticalVelocity = 0;
      this.vertical.y = this.options.groundY + this.options.eyeHeight;
      this.options.callbacks?.onLock?.();
    });
    this.pointerLock.addEventListener('unlock', () => {
      this.options.callbacks?.onUnlock?.();
    });
  }

  /** Configure lock/unlock notifications (surfaced from main.ts). */
  setCallbacks(callbacks: WalkControlsCallbacks): void {
    this.options.callbacks = callbacks;
  }

  /** Lock the pointer to start mouse-look walk mode (no-op if already locked). */
  requestLock(): void {
    this.pointerLock.lock();
  }

  /** Release the pointer (Esc inside the browser also triggers this). */
  releaseLock(): void {
    this.pointerLock.unlock();
  }

  get isLocked(): boolean {
    return this.pointerLock.isLocked;
  }

  /** Reset the camera to a safe spot at ground level (e.g. after fallback). */
  respawn(x: number, z: number): void {
    this.camera.position.set(x, this.options.groundY + this.options.eyeHeight, z);
    this.vertical.y = this.camera.position.y;
    this.vertical.verticalVelocity = 0;
    this.vertical.onGround = true;
  }

  /** Feed a keyboard event into the movement state (keydown and keyup). */
  handleKey(event: KeyboardEvent): void {
    const update = readWalkInput(event);
    if (update) {
      Object.assign(this.input, update);
    }
  }

  /** Advance the simulation by `delta` seconds (call from the render loop). */
  update(delta: number): void {
    if (!this.isLocked) {
      this.input.jump = false;
      return;
    }
    this.updateMove(delta);
    this.vertical = integrateVertical(
      this.vertical,
      delta,
      {
        groundY: this.options.groundY,
        eyeHeight: this.options.eyeHeight,
        gravity: this.options.gravity,
        jumpSpeed: this.options.jumpSpeed,
      },
      this.input.jump,
    );
    this.input.jump = false;
    this.camera.position.y = this.vertical.y;
  }

  private updateMove(delta: number): void {
    const speed =
      this.options.walkSpeed * (this.input.sprint ? this.options.sprintMultiplier : 1);
    const move = speed * delta;

    let forward = 0;
    let strafe = 0;
    if (this.input.forward) forward += 1;
    if (this.input.backward) forward -= 1;
    if (this.input.left) strafe += 1;
    if (this.input.right) strafe -= 1;
    if (forward === 0 && strafe === 0) return;

    // Normalize so diagonal movement is not faster than straight movement.
    const length = Math.hypot(forward, strafe);
    forward /= length;
    strafe /= length;

    this.camera.getWorldDirection(this.tempDirection);
    this.tempDirection.y = 0;
    if (this.tempDirection.lengthSq() < 1e-6) {
      return;
    }
    this.tempDirection.normalize();
    this.tempRight.crossVectors(this.tempDirection, UP).normalize();

    this.tempOffset
      .set(0, 0, 0)
      .addScaledVector(this.tempDirection, forward * move)
      .addScaledVector(this.tempRight, strafe * move);

    const next = resolveStep(
      this.camera.position.x,
      this.camera.position.z,
      this.tempOffset.x,
      this.tempOffset.z,
      this.options.collisionData,
      this.options.radius,
      this.options.bounds,
    );
    this.camera.position.x = next.x;
    this.camera.position.z = next.z;
  }
}

/**
 * Read a keyboard event into a partial input update containing only the
 * field(s) that key actually affects, so merge helpers never clobber other
 * held keys (e.g. pressing Shift while W is held must not stop forward
 * movement). Returns null for unrelated keys.
 */
export function readWalkInput(event: KeyboardEvent): Partial<WalkInput> | null {
  if (!MOVE_KEYS.has(event.code) && event.code !== SPRINT_KEY && event.code !== JUMP_KEY) {
    return null;
  }
  const down = event.type === 'keydown';
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      return { forward: down };
    case 'KeyS':
    case 'ArrowDown':
      return { backward: down };
    case 'KeyA':
    case 'ArrowLeft':
      return { left: down };
    case 'KeyD':
    case 'ArrowRight':
      return { right: down };
    case SPRINT_KEY:
      return { sprint: down };
    case JUMP_KEY:
      // Ignore auto-repeat so holding Space does not bounce forever.
      return { jump: down && !event.repeat };
  }
  return null;
}

/** Merge a key event into the shared input state (only affected fields). */
export function applyKeyEvent(input: WalkInput, event: KeyboardEvent): void {
  const update = readWalkInput(event);
  if (update) {
    Object.assign(input, update);
  }
}
