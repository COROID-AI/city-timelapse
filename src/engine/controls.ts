import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { BLOCK } from '../layout';
import { clampWalkHeight, frameEra, resizeCamera, type GameCamera } from './camera';

/**
 * Camera navigation. Two toggleable modes share one camera:
 *
 *  - **Orbit**: rotate/pan/zoom around a target, with damping and the target
 *    clamped to the block footprint so the camera stays aimed at the city.
 *  - **First-person**: pointer lock + WASD + mouse look, eye height clamped to
 *    the walking band [1.6, 1.7]. Collision-less by design (planned walk).
 *
 * Works headlessly: if `window`/`document` are absent (unit tests), the
 * corresponding listeners are skipped and pointer lock degrades to a no-op.
 */

export type CameraMode = 'orbit' | 'first-person';

/** Orbit target clamp derived from the block footprint. */
const TARGET_BOUNDS = {
  minX: -BLOCK.width / 2,
  maxX: BLOCK.width / 2,
  minZ: -BLOCK.depth / 2,
  maxZ: BLOCK.depth / 2,
};

/** Orbit keeps its distance from the block. */
const ORBIT_REACH = { min: 4, max: 260 };

/** First-person walk speed (world units / second) and mouse look sensitivity. */
const WALK = { speed: 6.0, lookSpeed: 0.0022 };

/** Keyboard toggle: `x` switches between orbit and first-person. */
const TOGGLE_KEY = 'KeyX';

export interface CreateControlsOptions {
  /** Element targeted for pointer lock when entering first-person mode. */
  lockTarget: HTMLElement;
  /** Called whenever the active mode changes (for UI label updates). */
  onModeChange?: (mode: CameraMode) => void;
  /**
   * Injectable event host for headless tests. Defaults to the global
   * `window`/`document` when present; without one, key/mouse listeners are
   * no-ops so the controls can still be constructed and driven directly.
   */
  host?: {
    window?: {
      addEventListener(kind: string, fn: EventListener): void;
      removeEventListener(kind: string, fn: EventListener): void;
    };
    document?: {
      pointerLockElement: unknown;
      exitPointerLock?(): void;
    };
  };
}

/**
 * Unified camera controls contract. `update` must be called every frame so
 * damping continues to settle and first-person movement applies.
 */
export interface CameraControls {
  /** The currently active navigation mode. */
  mode: CameraMode;
  /** Switch to a specific mode. */
  setMode(mode: CameraMode): void;
  /** Flip orbit <-> first-person. */
  toggle(): void;
  /** Apply per-frame movement/damping. `delta` is seconds. */
  update(delta: number): void;
  /** Frame the active era anchor and reset the orbit target. */
  frameEra(era: '1945' | '1965' | '1985' | '2005' | '2025'): void;
  /** Release all event listeners and the current pointer lock. */
  dispose(): void;
}

/** Clamp a vector's x/z into the block footprint with a small margin. */
function clampTarget(target: THREE.Vector3, margin: number): void {
  target.x = Math.max(TARGET_BOUNDS.minX + margin, Math.min(TARGET_BOUNDS.maxX - margin, target.x));
  target.z = Math.max(TARGET_BOUNDS.minZ + margin, Math.min(TARGET_BOUNDS.maxZ - margin, target.z));
}

/** Derive the ground-projected forward direction from the camera quaternion. */
function facingForward(camera: GameCamera): THREE.Vector3 {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
  return dir.normalize();
}

/**
 * Create the camera controls. Orbit is the default mode. Accepts a stub
 * pointer-lock controller when running headless.
 */
export function createControls(
  camera: GameCamera,
  canvas: HTMLCanvasElement,
  options: CreateControlsOptions,
): CameraControls {
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.enableRotate = true;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  orbit.minDistance = ORBIT_REACH.min;
  orbit.maxDistance = ORBIT_REACH.max;
  orbit.maxPolarAngle = Math.PI / 2 - 0.06;

  let mode: CameraMode = 'orbit';
  const move = { forward: false, backward: false, left: false, right: false };
  let disposed = false;

  const win = options.host?.window ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = options.host?.document ?? (typeof document !== 'undefined' ? document : undefined);

  const lockOwner = doc && 'pointerLockElement' in doc ? doc : undefined;

  function requestLock(): void {
    if (!disposed && lockOwner) {
      const req = options.lockTarget.requestPointerLock?.();
      if (req && typeof req === 'object' && 'catch' in req) {
        void req.catch(() => undefined);
      }
    }
  }

  function emitMode(): void {
    options.onModeChange?.(mode);
    if (doc && typeof Event !== 'undefined') {
      options.lockTarget.dispatchEvent(new Event('enginemodechange'));
    }
  }

  function enableOrbit(): void {
    mode = 'orbit';
    orbit.connect(canvas);
    orbit.update();
    emitMode();
  }

  function enableFirstPerson(): void {
    mode = 'first-person';
    orbit.disconnect();
    clampWalkHeight(camera);
    requestLock();
    emitMode();
  }

  function setMode(next: CameraMode): void {
    if (disposed || next === mode) return;
    if (next === 'orbit') enableOrbit();
    else enableFirstPerson();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (disposed) return;
    switch (e.code) {
      case TOGGLE_KEY:
        setMode(mode === 'orbit' ? 'first-person' : 'orbit');
        break;
      case 'KeyW':
      case 'ArrowUp':
        move.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        move.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        move.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        move.right = true;
        break;
      default:
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        move.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        move.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        move.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        move.right = false;
        break;
      default:
        break;
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (disposed || mode !== 'first-person') return;
    if (lockOwner && !(lockOwner as Document).pointerLockElement) return;
    const yaw = -e.movementX * WALK.lookSpeed;
    const pitch = -e.movementY * WALK.lookSpeed;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    euler.y += yaw;
    euler.x += pitch;
    const LIMIT = Math.PI / 2 - 0.03;
    euler.x = Math.max(-LIMIT, Math.min(LIMIT, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  function step(delta: number): void {
    if (mode === 'orbit') {
      orbit.update(delta);
    } else {
      const forward = facingForward(camera);
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      if (move.forward) camera.position.addScaledVector(forward, WALK.speed * delta);
      if (move.backward) camera.position.addScaledVector(forward, -WALK.speed * delta);
      if (move.right) camera.position.addScaledVector(right, WALK.speed * delta);
      if (move.left) camera.position.addScaledVector(right, -WALK.speed * delta);
      clampWalkHeight(camera);
    }
  }

  function update(delta: number): void {
    if (disposed) return;
    step(delta);
    if (mode === 'orbit') clampTarget(orbit.target, 2);
  }

  const onKeyDownRef = onKeyDown as unknown as EventListener;
  const onKeyUpRef = onKeyUp as unknown as EventListener;
  const onPointerMoveRef = onPointerMove as unknown as EventListener;
  win?.addEventListener('keydown', onKeyDownRef);
  win?.addEventListener('keyup', onKeyUpRef);
  canvas.addEventListener('pointermove', onPointerMoveRef);

  return {
    get mode() {
      return mode;
    },
    setMode,
    toggle: () => setMode(mode === 'orbit' ? 'first-person' : 'orbit'),
    update,
    frameEra: (era) => {
      frameEra(camera, era);
      orbit.target.set(0, 0, 0);
      orbit.update();
      clampWalkHeight(camera);
    },
    dispose: () => {
      disposed = true;
      win?.removeEventListener('keydown', onKeyDownRef);
      win?.removeEventListener('keyup', onKeyUpRef);
      canvas.removeEventListener('pointermove', onPointerMoveRef);
      orbit.dispose();
      if (lockOwner && (lockOwner as { pointerLockElement?: unknown }).pointerLockElement) {
        try {
          (lockOwner as { exitPointerLock?: () => void }).exitPointerLock?.();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

export { clampWalkHeight, frameEra, resizeCamera };