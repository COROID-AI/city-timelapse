/**
 * NavigationController — camera navigation for the city block.
 *
 * Wires the two rigs (damped orbit by default, pointer-lock walk on V) and
 * the POI fly-to presets into a single lifecycle contract consumed by the
 * compose-scene-app integration:
 *
 *     const nav = createNavigationController(camera, domElement, layout);
 *     nav.setMode('walk');
 *     nav.flyTo('rooftop');
 *     loop.update((dt) => nav.update(dt));
 *     nav.dispose(); // removes every listener, releases pointer lock
 *
 * Behavior highlights:
 *
 * - Orbit is the default mode: left-drag rotate (damped), wheel zoom, and
 *   right/middle-drag pan.
 * - Walk mode toggles with the V key (or `setMode('walk')`) and requests
 *   pointer lock; if lock is denied or exits it still walks with WASD/arrows,
 *   so a locked-up pointer never strands the user.
 * - POIs are flown to with an eased, interruptible move — any user input
 *   cancels the current flight.
 * - `prefers-reduced-motion` disables orbit auto-drift.
 * - The camera is always clamped to the BlockLayout bounds and never drops
 *   below ground.
 */
import type { PerspectiveCamera } from 'three';
import type { BlockLayout } from '../world/layout/types';
import { OrbitRig, clampToBlockBounds, type ClampBounds } from './orbitRig';
import { WalkRig, WALK_EYE_HEIGHT } from './walkRig';
import { getPoiTargets, type PoiId } from './pois';

/** Camera modes the controller models. */
export type NavigationMode = 'orbit' | 'walk';

export interface NavigationControllerOptions {
  /** Block layout whose bounds clamp the camera. */
  layout: BlockLayout;
  /** Ground plane Y value; the camera never sits below it. */
  groundHeight?: number;
  /** Orbit auto-drift yaw in rad/s (disabled under reduced motion). */
  autoDrift?: number;
  /** Motion preference probe; returning false disables auto-drift. */
  motionReduced?: () => boolean;
  /** Initial POI flight duration in seconds. */
  flyToDuration?: number;
  /** Initial camera mode. */
  mode?: NavigationMode;
}

export interface NavigationController {
  /** Current navigation mode. */
  getMode(): NavigationMode;
  /** Switch between 'orbit' and 'walk'; cancels any active flight. */
  setMode(mode: NavigationMode): void;
  /** Eased, interruptible fly-to of a preset POI. */
  flyTo(poiId: PoiId): void;
  /** Per-frame integration; call from the render loop with delta seconds. */
  update(dt: number): void;
  /** Removes every listener, releases pointer lock. Safe to call twice. */
  dispose(): void;
  /** Optional mode-change hook (used by the HUD toggle button). */
  onModeChange?: (mode: NavigationMode) => void;
}

interface EasedFlight {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  t: number; // 0..1 progress
  duration: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Standard easeInOut cubic for flight progress. */
function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a pose to the block bounds and above ground. */
function clampPoseToBounds(
  p: { x: number; y: number; z: number },
  bounds: ClampBounds,
  groundHeight: number,
): void {
  const c = clampToBlockBounds(p.x, p.z, bounds);
  p.x = c.x;
  p.z = c.z;
  p.y = Math.max(groundHeight, p.y);
}

/**
 * Create the navigation controller over `camera`. `domElement` receives the
 * pointer/wheel listeners (with `touch-action: none` so drags never scroll),
 * and the window receives keyboard / pointer-lock listeners. Every returned
 * handle mutates only the camera — the world systems stay untouched.
 */
export function createNavigationController(
  camera: PerspectiveCamera,
  domElement: HTMLElement,
  options: NavigationControllerOptions,
): NavigationController {
  const layout = options.layout;
  const bounds: ClampBounds = { ...layout.blockBounds };
  const groundHeight = options.groundHeight ?? 0;
  const flyToDuration = options.flyToDuration ?? 2.4;
  const autoDrift = options.autoDrift ?? 0;
  const motionReduced = options.motionReduced ?? (() => false);

  let mode: NavigationMode = options.mode ?? 'orbit';
  let disposed = false;
  let flight: EasedFlight | null = null;
  let pointerLockActive = false;

  const driftEnabled = autoDrift !== 0 && !motionReduced();

  const orbit = new OrbitRig(camera, bounds, {
    groundHeight,
    targetHeight: WALK_EYE_HEIGHT,
    autoDrift: driftEnabled ? Math.max(0, autoDrift) : 0,
  });

  const walk = new WalkRig(camera, bounds, { groundHeight, eyeHeight: WALK_EYE_HEIGHT });

  const poiTargets = getPoiTargets(layout);

  /* ------------------------------------------------------------------ */
  /* Fly-to                                                             */
  /* ------------------------------------------------------------------ */

  function cancelFlight(): void {
    flight = null;
  }

  /* ------------------------------------------------------------------ */
  /* Pointer / wheel orbit input                                        */
  /* ------------------------------------------------------------------ */

  let activePointer: number | null = null;
  let dragMode: 'rotate' | 'pan' = 'rotate';
  let lastPointerX = 0;
  let lastPointerY = 0;

  function beginDrag(event: PointerEvent, pan: boolean): void {
    if (mode !== 'orbit') return;
    activePointer = event.pointerId;
    dragMode = pan ? 'pan' : 'rotate';
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    cancelFlight();
    domElement.setPointerCapture?.(event.pointerId);
    domElement.addEventListener('pointermove', onPointerMoveOrbit);
    domElement.addEventListener('pointerup', onPointerUpOrbit);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button === 0) beginDrag(event, false);
    else if (event.button === 2 || event.button === 1) beginDrag(event, true);
  }

  function onPointerMoveOrbit(event: PointerEvent): void {
    if (activePointer !== event.pointerId) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (dragMode === 'rotate') orbit.rotateByPixels(dx, dy);
    else orbit.panByPixels(dx, dy);
  }

  function onPointerUpOrbit(event: PointerEvent): void {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    domElement.removeEventListener('pointermove', onPointerMoveOrbit);
    domElement.removeEventListener('pointerup', onPointerUpOrbit);
  }

  function onContextMenu(event: Event): void {
    event.preventDefault(); // right-drag pans; never show the browser menu
  }

  function onWheel(event: WheelEvent): void {
    if (mode !== 'orbit') return;
    event.preventDefault();
    cancelFlight();
    const delta = Math.max(-1, Math.min(1, -event.deltaY / 100));
    orbit.zoomBy(delta);
  }

  /* ------------------------------------------------------------------ */
  /* Pointer-lock walk look                                             */
  /* ------------------------------------------------------------------ */

  function onPointerLockChange(): void {
    const locked = document.pointerLockElement === domElement;
    if (pointerLockActive && !locked && !disposed) {
      // Lock released: keep walking with the keyboard; reset accumulated look.
      walk.setAxes(0, 0);
    }
    pointerLockActive = locked;
  }

  function onMouseMove(event: MouseEvent): void {
    if (mode !== 'walk' || !pointerLockActive) return;
    walk.lookBy(event.movementX, event.movementY);
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard walk + shortcuts                                          */
  /* ------------------------------------------------------------------ */

  const heldKeys = new Set<string>();

  const FORWARD_CODES = new Set(['KeyW', 'ArrowUp']);
  const BACK_CODES = new Set(['KeyS', 'ArrowDown']);
  const LEFT_CODES = new Set(['KeyA', 'ArrowLeft']);
  const RIGHT_CODES = new Set(['KeyD', 'ArrowRight']);

  function refreshAxes(): void {
    let fwd = 0;
    let strafe = 0;
    for (const code of heldKeys) {
      if (FORWARD_CODES.has(code)) fwd += 1;
      if (BACK_CODES.has(code)) fwd -= 1;
      if (LEFT_CODES.has(code)) strafe -= 1;
      if (RIGHT_CODES.has(code)) strafe += 1;
    }
    walk.setAxes(fwd, strafe);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'v' || event.key === 'V') {
      handle.setMode(mode === 'orbit' ? 'walk' : 'orbit');
      return;
    }
    if (event.key === '1') {
      handle.flyTo('corner');
      return;
    }
    if (event.key === '2') {
      handle.flyTo('midblock');
      return;
    }
    if (event.key === '3') {
      handle.flyTo('rooftop');
      return;
    }
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow')) {
      cancelFlight(); // any movement key interrupts a fly-to
      heldKeys.add(event.code);
      refreshAxes();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow')) {
      heldKeys.delete(event.code);
      refreshAxes();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mode switching / pointer lock                                      */
  /* ------------------------------------------------------------------ */

  function tryLock(): void {
    if (typeof domElement.requestPointerLock === 'function') {
      try {
        const result = domElement.requestPointerLock();
        // Some browsers return a promise-like; ignore rejections so a denied
        // lock degrades to keyboard-only walk instead of throwing.
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            pointerLockActive = false;
          });
        }
      } catch {
        pointerLockActive = false;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public handle                                                      */
  /* ------------------------------------------------------------------ */

  const handle: NavigationController = {
    getMode(): NavigationMode {
      return mode;
    },

    setMode(next: NavigationMode): void {
      if (disposed) return;
      if (next !== 'orbit' && next !== 'walk') return;
      if (next === mode) return;

      mode = next;
      cancelFlight();
      if (next === 'walk') {
        walk.setPosition(camera.position.x, camera.position.z);
        tryLock();
      } else {
        heldKeys.clear();
        walk.setAxes(0, 0);
        orbit.recenterAt(walk.getPositionX(), walk.getPositionZ(), true);
        if (document.pointerLockElement === domElement) {
          document.exitPointerLock?.();
        }
        pointerLockActive = false;
      }
      handle.onModeChange?.(next);
    },

    flyTo(poiId: PoiId): void {
      if (disposed) return;
      const target = poiTargets[poiId];
      if (!target) return;
      const start = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const end = { x: target.position.x, y: target.position.y, z: target.position.z };
      clampPoseToBounds(end, bounds, groundHeight);
      flight = {
        start,
        end,
        lookAt: { x: target.lookAt.x, y: target.lookAt.y, z: target.lookAt.z },
        t: 0,
        duration: flyToDuration,
      };
    },

    update(dt: number): void {
      if (disposed) return;

      if (flight) {
        flight.t += dt / flight.duration;
        const t = easeInOutCubic(Math.min(1, flight.t));
        camera.position.set(
          lerp(flight.start.x, flight.end.x, t),
          lerp(flight.start.y, flight.end.y, t),
          lerp(flight.start.z, flight.end.z, t),
        );
        const la = flight.lookAt;
        camera.lookAt(la.x, la.y, la.z);

        if (flight.t >= 1) {
          const end = flight.end;
          const look = flight.lookAt;
          flight = null;
          // Hand the final pose to the active rig so the next frame stays
          // continuous instead of snapping back to an old orbit.
          if (mode === 'orbit') {
            // Anchor the orbit on the flight's look-at point: the camera
            // keeps its current distance/orientation, just re-targeted.
            orbit.adoptPose(look.x, look.y, look.z);
          } else {
            walk.setPosition(end.x, end.z);
            const dx = look.x - end.x;
            const dz = look.z - end.z;
            const yaw = Math.atan2(-dx, -dz);
            const pitch = 0;
            walk.setOrientation(yaw, pitch);
          }
        }
        return;
      }

      if (mode === 'orbit') orbit.update(dt);
      else walk.update(dt);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('contextmenu', onContextMenu);
      domElement.removeEventListener('wheel', onWheel);
      domElement.style.touchAction = '';
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerlockchange', onPointerLockChange);

      if (activePointer !== null) {
        domElement.removeEventListener('pointermove', onPointerMoveOrbit);
        domElement.removeEventListener('pointerup', onPointerUpOrbit);
      }
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock?.();
      }
      pointerLockActive = false;
      flight = null;
    },
  };

  /* ------------------------------------------------------------------ */
  /* Wiring                                                             */
  /* ------------------------------------------------------------------ */

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('contextmenu', onContextMenu);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('pointerlockchange', onPointerLockChange);
  domElement.style.touchAction = 'none';

  return handle;
}