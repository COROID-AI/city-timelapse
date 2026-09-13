/**
 * Navigation controls: pointer/keyboard input -> {@link CameraRig}.
 *
 * A controller captures input from a pointer target (drag to rotate/orbit or
 * look, wheel to zoom, two-pointer pinch to zoom) and a key target (WASD +
 * arrows to walk). Every gesture only mutates the rig's *targets*; the rig's
 * own exponential damping turns them into smooth motion when the engine
 * advances each frame (`controller.update(dt)` is wired to the engine's
 * update loop).
 *
 * The pure zoom helpers (`wheelZoomFactor`, `pinchZoomFactor`) are exported
 * so the control math is unit-testable without a DOM.
 */

import type { CameraRig } from '../core/cameraRig';

export interface NavigationOptions {
  /** The camera rig being driven. */
  readonly rig: CameraRig;
  /** Element receiving pointer drag / wheel events. */
  readonly pointerTarget: EventTarget;
  /** Element receiving keyboard events. Defaults to `pointerTarget`. */
  readonly keyTarget?: EventTarget;
  /** Orbit drag sensitivity (radians per pixel). Default `0.006`. */
  readonly rotateSensitivity?: number;
  /** Walk look sensitivity (radians per pixel). Default `0.004`. */
  readonly lookSensitivity?: number;
  /** Wheel zoom sensitivity (per `deltaY` unit). Default `0.0016`. */
  readonly wheelZoomSensitivity?: number;
}

export interface NavigationController {
  readonly rig: CameraRig;
  /** True once {@link dispose} has run; calls are then inert. */
  readonly disposed: boolean;
  /**
   * Advance held-key walk input by `deltaSeconds` (movement is applied to
   * the rig now; smoothing happens in {@link CameraRig.update}).
   */
  update(deltaSeconds: number): void;
  /** Detach every listener and drop all input state. */
  dispose(): void;
}

const FORWARD_KEYS = new Set(['W', 'ARROWUP']);
const BACKWARD_KEYS = new Set(['S', 'ARROWDOWN']);
const LEFT_KEYS = new Set(['A', 'ARROWLEFT']);
const RIGHT_KEYS = new Set(['D', 'ARROWRIGHT']);
const ALL_MOVEMENT_KEYS = new Set([...FORWARD_KEYS, ...BACKWARD_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS]);

/** Mouse pointer id used by the fallback (non-PointerEvent) backend. */
const MOUSE_POINTER_ID = 0;

/**
 * Wheel zoom factor for a browser `deltaY`: scrolling up (negative) zooms
 * in (factor < 1) and scrolling down zooms out (factor > 1), exponentially
 * scaled by `sensitivity`.
 */
export function wheelZoomFactor(deltaY: number, sensitivity = 0.0016): number {
  return Math.exp(deltaY * sensitivity);
}

/**
 * Pinch zoom factor from two consecutive pointer separations: spreading the
 * fingers (next > previous) zooms in (factor < 1). Degenerate/zero
 * separations yield a neutral factor of 1.
 */
export function pinchZoomFactor(previousSeparation: number, nextSeparation: number): number {
  if (!(previousSeparation > 0) || !(nextSeparation > 0)) {
    return 1;
  }
  return previousSeparation / nextSeparation;
}

function keyCodeOf(event: KeyboardEvent): string {
  const raw = (event.code ?? event.key ?? '').toUpperCase();
  // Physical-key codes arrive as "KeyW"; logical keys as "w". Normalize both
  // to the bare letter so one key table drives every keyboard backend.
  return raw.startsWith('KEY') ? raw.slice(3) : raw;
}

interface TrackedPointer {
  x: number;
  y: number;
}

export function createNavigationController(options: NavigationOptions): NavigationController {
  const rig = options.rig;
  const pointerTarget = options.pointerTarget;
  const keyTarget = options.keyTarget ?? pointerTarget;
  const rotateSensitivity = options.rotateSensitivity ?? 0.006;
  const lookSensitivity = options.lookSensitivity ?? 0.004;
  const wheelZoomSensitivity = options.wheelZoomSensitivity ?? 0.0016;
  const supportsPointerEvents = typeof PointerEvent !== 'undefined';

  let disposed = false;
  const heldKeys = new Set<string>();
  const pointers = new Map<number, TrackedPointer>();
  let pinchSeparation: number | null = null;

  const clearInputs = (): void => {
    heldKeys.clear();
    pointers.clear();
    pinchSeparation = null;
  };

  const applyDrag = (dx: number, dy: number): void => {
    if (rig.getMode() === 'orbit') {
      rig.rotate(dx * rotateSensitivity, dy * rotateSensitivity);
    } else {
      rig.look(dx * lookSensitivity, dy * lookSensitivity);
    }
  };

  const separationOf = (): number => {
    let first: TrackedPointer | null = null;
    let second: TrackedPointer | null = null;
    for (const pointer of pointers.values()) {
      if (first === null) {
        first = pointer;
      } else {
        second = pointer;
        break;
      }
    }
    if (first === null || second === null) {
      return 0;
    }
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const onPress = (id: number, x: number, y: number): void => {
    if (disposed) {
      return;
    }
    pointers.set(id, { x, y });
    if (pointers.size === 2) {
      pinchSeparation = null;
    }
  };

  const onMove = (id: number, x: number, y: number): void => {
    if (disposed) {
      return;
    }
    const previous = pointers.get(id);
    if (previous === undefined) {
      return;
    }
    const dx = x - previous.x;
    const dy = y - previous.y;
    pointers.set(id, { x, y });

    if (pointers.size === 2) {
      // Pinch zoom: scale by the separation ratio across moves.
      const separation = separationOf();
      if (pinchSeparation !== null) {
        rig.zoom(pinchZoomFactor(pinchSeparation, separation));
      }
      pinchSeparation = separation;
      return;
    }
    applyDrag(dx, dy);
  };

  const onRelease = (id: number): void => {
    if (disposed) {
      return;
    }
    pointers.delete(id);
    if (pointers.size < 2) {
      pinchSeparation = null;
    }
  };

  // --- mouse fallback backend -------------------------------------------------
  const onMouseDown = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (mouse.button !== 0) {
      return;
    }
    onPress(MOUSE_POINTER_ID, mouse.clientX, mouse.clientY);
  };
  const onMouseMove = (event: Event): void => {
    const mouse = event as MouseEvent;
    onMove(MOUSE_POINTER_ID, mouse.clientX, mouse.clientY);
  };
  const onMouseUp = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (mouse.button !== 0) {
      return;
    }
    onRelease(MOUSE_POINTER_ID);
  };

  // --- pointer-events backend (multi-touch pinch) -----------------------------
  const onPointerDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType === 'mouse' && pointer.button !== 0) {
      return;
    }
    onPress(pointer.pointerId, pointer.clientX, pointer.clientY);
  };
  const onPointerMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    onMove(pointer.pointerId, pointer.clientX, pointer.clientY);
  };
  const onPointerUp = (event: Event): void => {
    onRelease((event as PointerEvent).pointerId);
  };

  const onWheel = (event: Event): void => {
    if (disposed) {
      return;
    }
    const deltaY = (event as WheelEvent).deltaY ?? 0;
    if (deltaY === 0) {
      return;
    }
    rig.zoom(wheelZoomFactor(deltaY, wheelZoomSensitivity));
    event.preventDefault();
  };

  const onKeyDown = (event: Event): void => {
    if (disposed) {
      return;
    }
    const code = keyCodeOf(event as KeyboardEvent);
    if (ALL_MOVEMENT_KEYS.has(code)) {
      heldKeys.add(code);
      event.preventDefault();
    }
  };
  const onKeyUp = (event: Event): void => {
    heldKeys.delete(keyCodeOf(event as KeyboardEvent));
  };

  const onBlur = (): void => {
    clearInputs();
  };

  const removeListeners = (): void => {
    pointerTarget.removeEventListener('mousedown', onMouseDown as EventListener);
    pointerTarget.removeEventListener('mousemove', onMouseMove as EventListener);
    pointerTarget.removeEventListener('mouseup', onMouseUp as EventListener);
    if (supportsPointerEvents) {
      pointerTarget.removeEventListener('pointerdown', onPointerDown as EventListener);
      pointerTarget.removeEventListener('pointermove', onPointerMove as EventListener);
      pointerTarget.removeEventListener('pointerup', onPointerUp as EventListener);
      pointerTarget.removeEventListener('pointercancel', onPointerUp as EventListener);
    }
    pointerTarget.removeEventListener('wheel', onWheel as EventListener);
    keyTarget.removeEventListener('keydown', onKeyDown as EventListener);
    keyTarget.removeEventListener('keyup', onKeyUp as EventListener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', onBlur);
    }
  };

  // Attach listeners.
  pointerTarget.addEventListener('mousedown', onMouseDown as EventListener);
  pointerTarget.addEventListener('mousemove', onMouseMove as EventListener);
  pointerTarget.addEventListener('mouseup', onMouseUp as EventListener);
  if (supportsPointerEvents) {
    pointerTarget.addEventListener('pointerdown', onPointerDown as EventListener);
    pointerTarget.addEventListener('pointermove', onPointerMove as EventListener);
    pointerTarget.addEventListener('pointerup', onPointerUp as EventListener);
    pointerTarget.addEventListener('pointercancel', onPointerUp as EventListener);
  }
  pointerTarget.addEventListener('wheel', onWheel as EventListener);
  keyTarget.addEventListener('keydown', onKeyDown as EventListener);
  keyTarget.addEventListener('keyup', onKeyUp as EventListener);
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', onBlur);
  }

  const hasAny = (keys: ReadonlySet<string>): boolean => {
    for (const key of keys) {
      if (heldKeys.has(key)) {
        return true;
      }
    }
    return false;
  };

  return {
    get rig() {
      return rig;
    },
    get disposed() {
      return disposed;
    },
    update(deltaSeconds: number): void {
      if (disposed) {
        return;
      }
      const forward = (hasAny(FORWARD_KEYS) ? 1 : 0) - (hasAny(BACKWARD_KEYS) ? 1 : 0);
      const strafe = (hasAny(RIGHT_KEYS) ? 1 : 0) - (hasAny(LEFT_KEYS) ? 1 : 0);
      if (forward !== 0 || strafe !== 0) {
        rig.walkMove(forward, strafe, deltaSeconds);
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      removeListeners();
      clearInputs();
    },
  };
}