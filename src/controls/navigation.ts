/**
 * Scene navigation: damped orbit, ground-level walk, touch fallback, and
 * raycast click-to-focus with detail callouts.
 *
 * This module is the `navigation-api` interface declared in outline.yaml. It is
 * deliberately content-agnostic: it raycasts whatever descriptors are
 * registered in its pickable registry and renders callouts from a
 * `CalloutContentProvider` callback. The integration owner wires that provider
 * to era-aware content — no era or content module is imported here.
 *
 * Design notes:
 * - Orbit is driven by one spherical pose (yaw/pitch/distance around a target).
 *   Walk keeps an independent eye position (`walkPos`) and orients the camera
 *   with the same yaw/pitch. Every mode change re-derives goals from the
 *   current pose first, so transitions glide with a critically-damped spring
 *   and never jump. Focus flights are eased by a slower flight spring.
 * - Input is Pointer Events based with a pointer-move drag threshold, so drag
 *   gestures never trigger focus, plus a two-pointer pinch/midpoint path for
 *   touch pan/zoom. Nothing ever captures the cursor (no pointer lock), and
 *   keyboard shortcuts never hijack Tab, so the control overlay stays fully
 *   keyboard operable.
 * - The control loop allocates nothing per frame: all temporaries are module
 *   level, and raycast/registry structures are reused across frames.
 */

import * as THREE from 'three';
import { createCalloutPanel, type CalloutContent, type CalloutPanel } from './callouts';

export type { CalloutContent };

/* ------------------------------------------------------------------ *
 * Public API types
 * ------------------------------------------------------------------ */

/** One registered pickable scene object and how to frame/show it. */
export interface PickableDescriptor {
  /** Stable id used in events and provider lookups. */
  id: string;
  /** Object the raycaster intersects (or any of its descendants). */
  object: THREE.Object3D;
  /** Optional straight-line framing distance override for focus flights. */
  focusDistance?: number;
  /** Optional preferred eye height for the focus viewpoint. */
  focusHeight?: number;
}

/** Content supplied by the integration owner's era-aware provider callback. */
export type CalloutContentProvider = (
  descriptor: PickableDescriptor,
  hit: THREE.Vector3,
) => CalloutContent;

/** Axis-aligned block bounds; the camera clamps to these in every mode. */
export interface NavigationBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Minimum camera height above the ground (never clips through). */
  minY: number;
  /** Maximum camera height. */
  maxY: number;
}

/** Feedback events emitted by the navigation module for app-level wiring. */
export interface NavigationEvents {
  onFocusStart?: (descriptor: PickableDescriptor) => void;
  onFocusArrive?: (descriptor: PickableDescriptor) => void;
  onFocusDismiss?: () => void;
  onModeChange?: (mode: NavigationMode) => void;
}

export interface SceneNavigationOptions {
  /** Canvas the controls bind input listeners to (the renderer's element). */
  domElement: HTMLElement;
  /** Perspective camera to drive. */
  camera: THREE.PerspectiveCamera;
  /** Render loop hook (returns an unsubscribe function). */
  onUpdate: (callback: (deltaSeconds: number) => void) => () => void;
  /** Overlay root hosting the callout panel and control buttons. */
  overlayRoot?: HTMLElement;
  /** Content provider the integration owner wires to era-aware content. */
  calloutContentProvider?: CalloutContentProvider;
  /** Initial camera mode (default `'orbit'`). */
  initialMode?: NavigationMode;
  /** Block bounds; defaults to a ±40 unit block with 1.6..140 height. */
  bounds?: Partial<NavigationBounds>;
  /** Damped zoom limits in orbit mode (default 6..70). */
  minDistance?: number;
  maxDistance?: number;
  /** Damped pitch limits in radians; defaults ±78 degrees. */
  minPitch?: number;
  maxPitch?: number;
  /** Walk speed in units/second (default 8). */
  walkSpeed?: number;
  /** Pointer-move threshold in CSS pixels gating click-to-focus (default 6). */
  dragThreshold?: number;
  /** Disable the built-in control overlay buttons (default false). */
  controlsUi?: boolean;
  /** Extra feedback hooks (default none). */
  events?: NavigationEvents;
}

/** Camera control modes. */
export type NavigationMode = 'orbit' | 'walk';

/** Imperative handle for the integrated navigation module. */
export interface SceneNavigation {
  /** The mode currently active (goals are damped toward, never snapped). */
  readonly mode: NavigationMode;
  /** Whether the detail callout is currently open. */
  readonly isCalloutOpen: boolean;
  /** Whether a focus flight is in progress. */
  readonly isFocusing: boolean;
  /** Switch to `mode` with a damped transition; returns the new mode. */
  setMode(mode: NavigationMode): NavigationMode;
  /** Toggle between orbit and walk (bound to the `M` key/buttons). */
  toggleMode(): NavigationMode;
  /** Register a pickable object; returns an unregister function. */
  registerPickable(descriptor: PickableDescriptor): () => void;
  /** Register many pickables at once; returns one unregister function. */
  registerPickables(descriptors: readonly PickableDescriptor[]): () => void;
  /** Frame a registered descriptor as if it had been clicked. */
  focus(descriptorId: string): boolean;
  /** Dismiss the callout and cancel any focus flight. */
  dismissCallout(): void;
  /** Ease the camera back to the default overview framing (bound to `R`). */
  resetView(): void;
  /** Detach all listeners, remove overlay UI, and release the update hook. */
  dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Tuning constants
 * ------------------------------------------------------------------ */

const DEFAULT_BOUNDS: NavigationBounds = {
  minX: -40,
  maxX: 40,
  minZ: -40,
  maxZ: 40,
  minY: 1.6,
  maxY: 140,
};
const DEFAULT_MIN_DISTANCE = 6;
const DEFAULT_MAX_DISTANCE = 70;
const DEFAULT_MIN_PITCH = -THREE.MathUtils.degToRad(78);
const DEFAULT_MAX_PITCH = THREE.MathUtils.degToRad(78);
const DEFAULT_WALK_SPEED = 8;
const DEFAULT_DRAG_THRESHOLD = 6;
const WALK_EYE_HEIGHT = 1.7;
const WALK_LOOK_AHEAD = 6;
const ORBIT_TARGET_Y = 1;
const ORBIT_COMFORT_DISTANCE = 18;
const FOCUS_FLIGHT_TIME = 1.05;
const FOCUS_SETTLE_EPSILON = 2e-3;

/** Damping: exponential halving rates per second (higher = snappier). */
const DAMP_SLOWER = 5;
const DAMP_DEFAULT = 9;
const DAMP_FASTER = 13;
const DAMP_FLIGHT = 6;

/** How long a temporary damping rate is held before returning to default. */
const MODE_HOLD_TIME = 0.6;

/** Wheel zoom stepping factor per CSS pixel of wheel delta. */
const WHEEL_ZOOM_STEP = 0.0018;
/** Pinch zoom: e-folding scale per CSS pixel of pinch distance change. */
const PINCH_ZOOM_STEP = 0.006;
/** Two-finger pan: units per CSS pixel, scaled by current distance. */
const PAN_SCALE = 0.0016;
/** Keyboard orbit stepping. */
const KEY_YAW_STEP = 0.22;
const KEY_PITCH_STEP = 0.14;
const KEY_ZOOM_STEP = 0.86;

/* ------------------------------------------------------------------ *
 * Module-level temporaries (never allocated inside per-frame code)
 * ------------------------------------------------------------------ */

const TMP_VEC_A = new THREE.Vector3();
const TMP_VEC_B = new THREE.Vector3();
const TMP_VEC_C = new THREE.Vector3();
const TMP_NDC = new THREE.Vector2();
const TMP_BOUNDS = new THREE.Box3();
const TMP_SIZE = new THREE.Vector3();

/** Exponential damping factor: fraction of remaining error kept per second. */
function dampFactor(lambda: number, deltaSeconds: number): number {
  return Math.exp(-lambda * deltaSeconds);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Camera forward direction from yaw/pitch (y-up convention). */
function computeForward(out: THREE.Vector3, yaw: number, pitch: number): THREE.Vector3 {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

/* ------------------------------------------------------------------ *
 * Spherical camera state (orbit pose / shared look state for walk)
 * ------------------------------------------------------------------ */

interface CameraState {
  /** Orbit target point. */
  target: THREE.Vector3;
  /** Azimuth in radians; forward horizontal = (-sin yaw, 0, -cos yaw). */
  yaw: number;
  /** Elevation in radians; negative = camera above the target. */
  pitch: number;
  /** Distance from target to camera along the view ray. */
  distance: number;
}

function createStateFromCamera(camera: THREE.PerspectiveCamera, targetY: number): CameraState {
  const state: CameraState = { target: new THREE.Vector3(0, targetY, 0), yaw: 0, pitch: 0, distance: 30 };
  camera.getWorldDirection(TMP_VEC_A);
  state.pitch = Math.asin(clamp(TMP_VEC_A.y, -1, 1));
  state.yaw = Math.atan2(-TMP_VEC_A.x, -TMP_VEC_A.z);
  state.distance = clamp(camera.position.distanceTo(state.target), DEFAULT_MIN_DISTANCE, DEFAULT_MAX_DISTANCE);
  return state;
}

function copyState(dst: CameraState, src: CameraState): void {
  dst.target.copy(src.target);
  dst.yaw = src.yaw;
  dst.pitch = src.pitch;
  dst.distance = src.distance;
}

/**
 * Build an orbit pose that frames `focusPoint` from a straight-line distance
 * and eye height at the current azimuth (a flattering 3/4 angle). Pitch is
 * negative so the camera sits above the subject.
 */
function stateForFocus(
  focusPoint: THREE.Vector3,
  distance: number,
  height: number,
  yaw: number,
  minPitch: number,
  maxPitch: number,
): CameraState {
  let dy = height - focusPoint.y;
  dy = clamp(dy, -distance * 0.8, distance * 0.8);
  const horizontal = Math.sqrt(Math.max(distance * distance - dy * dy, 0.25));
  const pitch = clamp(-Math.atan2(dy, horizontal), minPitch, maxPitch);
  return { target: focusPoint.clone(), yaw, pitch, distance };
}

/* ------------------------------------------------------------------ *
 * Module implementation
 * ------------------------------------------------------------------ */

interface PendingFocus {
  descriptor: PickableDescriptor;
  point: THREE.Vector3;
}

/**
 * Create the navigation module. Pointer/wheel listeners bind to the canvas;
 * keyboard listeners bind to the owning document and ignore typing targets.
 */
export function createSceneNavigation(options: SceneNavigationOptions): SceneNavigation {
  const { domElement, camera, onUpdate } = options;
  const doc = domElement.ownerDocument;
  const bounds: NavigationBounds = { ...DEFAULT_BOUNDS, ...options.bounds };
  const minDistance = options.minDistance ?? DEFAULT_MIN_DISTANCE;
  const maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const minPitch = options.minPitch ?? DEFAULT_MIN_PITCH;
  const maxPitch = options.maxPitch ?? DEFAULT_MAX_PITCH;
  const walkSpeed = options.walkSpeed ?? DEFAULT_WALK_SPEED;
  const dragThreshold = options.dragThreshold ?? DEFAULT_DRAG_THRESHOLD;
  const events = options.events ?? {};

  /* ---------------- pose state ---------------- */

  const state = createStateFromCamera(camera, ORBIT_TARGET_Y);
  const goal: CameraState = {
    target: state.target.clone(),
    yaw: state.yaw,
    pitch: state.pitch,
    distance: state.distance,
  };
  const defaultView: CameraState = {
    target: state.target.clone(),
    yaw: state.yaw,
    pitch: state.pitch,
    distance: state.distance,
  };

  // Walk eye position (goal) and its smoothed rendering counterpart.
  const walkPos = new THREE.Vector3(
    clamp(camera.position.x, bounds.minX, bounds.maxX),
    Math.max(WALK_EYE_HEIGHT, bounds.minY),
    clamp(camera.position.z, bounds.minZ, bounds.maxZ),
  );
  const walkPosSmooth = walkPos.clone();

  let mode: NavigationMode = options.initialMode ?? 'orbit';
  let disposed = false;
  let focusing = false;
  let focusFlightTime = 0;
  let focusDescriptor: PickableDescriptor | null = null;
  let dampingLambda = DAMP_DEFAULT;
  let lambdaHoldTime = 0;

  // Walk movement input.
  const heldKeys = new Set<string>();

  // Pointer/touch input.
  let activePointerId = -1;
  let lastClientX = 0;
  let lastClientY = 0;
  let downClientX = 0;
  let downClientY = 0;
  let pendingFocus: PendingFocus | null = null;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let wheelZoomVelocity = 0;

  // Two-pointer pinch/pan state (touch fallback).
  const pinchPointers = new Map<number, { x: number; y: number }>();
  let pinchStartDistance = 0;
  let pinchStartTargetDistance = 0;
  let pinchMidX = 0;
  let pinchMidY = 0;

  // Pickable registry; raycaster reuses these across frames.
  const descriptors = new Map<string, PickableDescriptor>();
  const descriptorByObject = new Map<THREE.Object3D, PickableDescriptor>();
  const pickableObjects: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.1;
  raycaster.far = 400;

  // Reused resolved-hit holder (avoid per-click allocations).
  const resolvedHit: PendingFocus = {
    descriptor: undefined as unknown as PickableDescriptor,
    point: new THREE.Vector3(),
  };

  /* ---------------- callout panel ---------------- */

  const calloutHost = options.overlayRoot ?? domElement;
  let calloutPanel: CalloutPanel | null = null;
  if (options.overlayRoot) {
    calloutPanel = createCalloutPanel({
      container: calloutHost,
      onClose: () => navigation.dismissCallout(),
    });
  }

  /* ---------------- helpers ---------------- */

  const clampGoalBounds = (goalState: CameraState): void => {
    goalState.target.x = clamp(goalState.target.x, bounds.minX, bounds.maxX);
    goalState.target.z = clamp(goalState.target.z, bounds.minZ, bounds.maxZ);
    goalState.target.y = clamp(goalState.target.y, bounds.minY, bounds.maxY);
    goalState.pitch = clamp(goalState.pitch, minPitch, maxPitch);
    goalState.distance = clamp(goalState.distance, minDistance, maxDistance);
  };

  const rebuildPickableObjects = (): void => {
    pickableObjects.length = 0;
    descriptorByObject.clear();
    for (const descriptor of descriptors.values()) {
      pickableObjects.push(descriptor.object);
      descriptorByObject.set(descriptor.object, descriptor);
    }
  };

  const unregisterById = (id: string): void => {
    if (descriptors.delete(id)) rebuildPickableObjects();
  };

  /** Raycast through client coordinates; returns shared `resolvedHit` or null. */
  const resolvePick = (clientX: number, clientY: number): PendingFocus | null => {
    if (pickableObjects.length === 0) return null;
    const rect = domElement.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : doc.documentElement.clientWidth || 1;
    const height = rect.height > 0 ? rect.height : doc.documentElement.clientHeight || 1;
    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / height) * 2 + 1;
    TMP_NDC.set(ndcX, ndcY);
    raycaster.setFromCamera(TMP_NDC, camera);
    const hits = raycaster.intersectObjects(pickableObjects, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const descriptor = descriptorByObject.get(node);
        if (descriptor) {
          resolvedHit.descriptor = descriptor;
          resolvedHit.point.copy(hit.point);
          return resolvedHit;
        }
        node = node.parent;
      }
    }
    return null;
  };

  /** Measure the world bounding radius of a descriptor into `center`. */
  const measureDescriptor = (descriptor: PickableDescriptor, center: THREE.Vector3): number => {
    TMP_BOUNDS.setFromObject(descriptor.object);
    if (TMP_BOUNDS.isEmpty()) {
      center.copy(descriptor.object.getWorldPosition(TMP_SIZE));
      return 1.5;
    }
    TMP_BOUNDS.getCenter(center);
    TMP_BOUNDS.getSize(TMP_SIZE);
    return Math.max(TMP_SIZE.x, TMP_SIZE.y, TMP_SIZE.z) * 0.5;
  };

  const showCalloutFor = (descriptor: PickableDescriptor, hitPoint: THREE.Vector3): void => {
    if (!calloutPanel) return;
    const provider = options.calloutContentProvider;
    const content = provider
      ? provider(descriptor, hitPoint)
      : { title: descriptor.id, eyebrow: 'Details', description: 'Registered scene object.' };
    calloutPanel.show(content);
  };

  /**
   * Fly the camera to frame `descriptor`. Works from any mode: walk first
   * hands off to orbit (the flight lifts the camera off the ground), then the
   * spherical goals ease to the framing pose and the callout raises while the
   * camera is in motion.
   */
  const beginFocus = (descriptor: PickableDescriptor, hitPoint: THREE.Vector3 | null): void => {
    if (mode === 'walk') navigation.setMode('orbit');
    // Focus flights are rare, so one allocation here is fine.
    const center = new THREE.Vector3();
    const radius = measureDescriptor(descriptor, center);
    if (hitPoint) center.lerp(hitPoint, 0.15);
    const focusDistance = descriptor.focusDistance
      ? clamp(descriptor.focusDistance, minDistance, maxDistance)
      : clamp(radius * 3.4, minDistance * 1.2, Math.min(maxDistance, 42));
    const focusHeight =
      descriptor.focusHeight ?? clamp(center.y + Math.max(radius * 0.6, 2), bounds.minY, bounds.maxY);
    const next = stateForFocus(center, focusDistance, focusHeight, state.yaw, minPitch, maxPitch);
    clampGoalBounds(next);
    copyState(goal, next);

    focusDescriptor = descriptor;
    focusFlightTime = 0;
    focusing = true;
    dampingLambda = DAMP_FLIGHT;
    lambdaHoldTime = 0;
    showCalloutFor(descriptor, hitPoint ?? center);
    events.onFocusStart?.(descriptor);
  };

  /* ---------------- pointer input ---------------- */

  const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as { tagName?: string; isContentEditable?: boolean } | null;
    if (!el || typeof el.tagName !== 'string') return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true;
  };

  const readPinchMidpoint = (): number => {
    let ax = 0;
    let ay = 0;
    let bx = 0;
    let by = 0;
    let index = 0;
    for (const point of pinchPointers.values()) {
      if (index === 0) {
        ax = point.x;
        ay = point.y;
      } else {
        bx = point.x;
        by = point.y;
      }
      index += 1;
    }
    pinchMidX = (ax + bx) * 0.5;
    pinchMidY = (ay + by) * 0.5;
    return Math.hypot(ax - bx, ay - by);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) return;
    if (event.pointerType === 'touch') {
      pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinchPointers.size === 2) {
        // Second finger: switch to two-finger pan/zoom; release the first.
        if (activePointerId !== -1) {
          domElement.releasePointerCapture?.(activePointerId);
        }
        activePointerId = -1;
        pendingFocus = null;
        pinchStartDistance = readPinchMidpoint();
        pinchStartTargetDistance = state.distance;
        return;
      }
      if (pinchPointers.size > 2) return;
    }
    if (activePointerId !== -1) return;
    activePointerId = event.pointerId;
    lastClientX = downClientX = event.clientX;
    lastClientY = downClientY = event.clientY;
    pendingFocus = null;
    yawVelocity = 0;
    pitchVelocity = 0;
    wheelZoomVelocity = 0;
    // Grabbing the camera cancels focus flights and pending inertia.
    if (focusing) {
      focusing = false;
      focusDescriptor = null;
      dampingLambda = DAMP_DEFAULT;
    }
    domElement.setPointerCapture?.(event.pointerId);
  };

  const applyLookDelta = (dxPx: number, dyPx: number): void => {
    // Grab-the-world feel: drag right pulls the view right, drag down lifts
    // the camera above the target (pitch is negative when camera is above).
    const yawDelta = -dxPx * 0.005;
    const pitchDelta = -dyPx * 0.005;
    goal.yaw += yawDelta;
    goal.pitch = clamp(goal.pitch + pitchDelta, minPitch, maxPitch);
    yawVelocity = yawDelta;
    pitchVelocity = pitchDelta;
  };

  /** Two-finger midpoint drag pans the orbit target (or walk position). */
  const applyPanDelta = (dxPx: number, dyPx: number): void => {
    if (dxPx === 0 && dyPx === 0) return;
    computeForward(TMP_VEC_A, state.yaw, state.pitch);
    // Screen right = normalized horizontal of forward × up; screen up = right × forward.
    TMP_VEC_B.set(-TMP_VEC_A.z, 0, TMP_VEC_A.x);
    const rightLen = Math.hypot(TMP_VEC_B.x, TMP_VEC_B.z);
    if (rightLen > 1e-4) TMP_VEC_B.multiplyScalar(1 / rightLen);
    TMP_VEC_C.crossVectors(TMP_VEC_B, TMP_VEC_A);
    const scale = state.distance * PAN_SCALE;
    if (mode === 'walk') {
      walkPos.x = clamp(walkPos.x - TMP_VEC_B.x * dxPx * scale + TMP_VEC_C.x * dyPx * scale, bounds.minX, bounds.maxX);
      walkPos.z = clamp(walkPos.z - TMP_VEC_B.z * dxPx * scale + TMP_VEC_C.z * dyPx * scale, bounds.minZ, bounds.maxZ);
    } else {
      goal.target.addScaledVector(TMP_VEC_B, -dxPx * scale);
      goal.target.addScaledVector(TMP_VEC_C, dyPx * scale);
      clampGoalBounds(goal);
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) return;
    if (event.pointerType === 'touch' && pinchPointers.has(event.pointerId)) {
      pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinchPointers.size === 2) {
        const previousMidX = pinchMidX;
        const previousMidY = pinchMidY;
        const distance = readPinchMidpoint();
        if (pinchStartDistance > 0 && distance > 0) {
          goal.distance = clamp(
            pinchStartTargetDistance * Math.exp(-(distance - pinchStartDistance) * PINCH_ZOOM_STEP),
            minDistance,
            maxDistance,
          );
        }
        if (previousMidX !== 0 || previousMidY !== 0) {
          applyPanDelta(pinchMidX - previousMidX, pinchMidY - previousMidY);
        }
        return;
      }
    }
    if (event.pointerId !== activePointerId) return;
    // Hover motion (no button/contact) must never move or zoom the camera.
    if (event.buttons === 0) return;
    const dx = event.clientX - lastClientX;
    const dy = event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    applyLookDelta(dx, dy);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) return;
    if (event.pointerType === 'touch') {
      pinchPointers.delete(event.pointerId);
      if (pinchPointers.size === 1) {
        // Pinch ended with one finger left: let it resume single-finger look.
        pinchStartDistance = 0;
        for (const [pointerId, point] of pinchPointers) {
          activePointerId = pointerId;
          lastClientX = downClientX = point.x;
          lastClientY = downClientY = point.y;
          break;
        }
        pendingFocus = null;
        return;
      }
      if (pinchPointers.size >= 2) return;
      pinchStartDistance = 0;
    }
    if (event.pointerId !== activePointerId) return;
    activePointerId = -1;
    domElement.releasePointerCapture?.(event.pointerId);

    // Drag threshold: orbiting/drags never trigger focus.
    const moved = Math.hypot(event.clientX - downClientX, event.clientY - downClientY);
    if (moved > dragThreshold) {
      pendingFocus = null;
      return;
    }
    const pick = resolvePick(event.clientX, event.clientY);
    if (pick) {
      pendingFocus = { descriptor: pick.descriptor, point: pick.point.clone() };
    } else {
      // Empty click dismisses the callout.
      navigation.dismissCallout();
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    pinchPointers.delete(event.pointerId);
    if (event.pointerId === activePointerId) {
      activePointerId = -1;
      pendingFocus = null;
      domElement.releasePointerCapture?.(event.pointerId);
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (disposed) return;
    event.preventDefault();
    if (mode !== 'orbit') return;
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    wheelZoomVelocity += delta * WHEEL_ZOOM_STEP;
  };

  /* ---------------- keyboard input ---------------- */

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed || isTypingTarget(event.target)) return;
    const code = event.code;
    if (code === 'Escape') {
      navigation.dismissCallout();
      return;
    }
    // `M` toggles the mode. Tab is intentionally never hijacked so keyboard
    // focus always traverses the control overlay normally.
    if (code === 'KeyM' && !event.repeat) {
      navigation.toggleMode();
      return;
    }
    if (code === 'KeyR' && !event.repeat) {
      navigation.resetView();
      return;
    }
    if (mode === 'orbit') {
      // Full keyboard orbit: arrows look, +/- zoom.
      if (code === 'ArrowLeft') {
        event.preventDefault();
        goal.yaw += KEY_YAW_STEP;
        return;
      }
      if (code === 'ArrowRight') {
        event.preventDefault();
        goal.yaw -= KEY_YAW_STEP;
        return;
      }
      if (code === 'ArrowUp') {
        event.preventDefault();
        goal.pitch = clamp(goal.pitch - KEY_PITCH_STEP, minPitch, maxPitch);
        return;
      }
      if (code === 'ArrowDown') {
        event.preventDefault();
        goal.pitch = clamp(goal.pitch + KEY_PITCH_STEP, minPitch, maxPitch);
        return;
      }
      if (code === 'Equal' || code === 'NumpadAdd') {
        event.preventDefault();
        goal.distance = clamp(goal.distance * KEY_ZOOM_STEP, minDistance, maxDistance);
        return;
      }
      if (code === 'Minus' || code === 'NumpadSubtract') {
        event.preventDefault();
        goal.distance = clamp(goal.distance / KEY_ZOOM_STEP, minDistance, maxDistance);
        return;
      }
      return;
    }
    // Walk movement: WASD + arrows (arrows share look keys with orbit only
    // when the pointer-look is unavailable, so both are accepted here).
    if (
      code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
      code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight'
    ) {
      event.preventDefault();
      heldKeys.add(code);
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.code);
  };

  const onBlur = (): void => {
    heldKeys.clear();
    activePointerId = -1;
    pinchPointers.clear();
    pinchStartDistance = 0;
  };

  /* ---------------- control overlay UI ---------------- */

  let controlBar: HTMLElement | null = null;
  let orbitButton: HTMLButtonElement | null = null;
  let walkButton: HTMLButtonElement | null = null;

  const syncModeButtons = (): void => {
    const orbitActive = mode === 'orbit';
    orbitButton?.setAttribute('aria-pressed', String(orbitActive));
    walkButton?.setAttribute('aria-pressed', String(!orbitActive));
  };

  const buildControlsUi = (): void => {
    if (options.controlsUi === false || !options.overlayRoot) return;
    const host = options.overlayRoot;
    const docLocal = host.ownerDocument;
    controlBar = docLocal.createElement('div');
    controlBar.className = 'nav-controls';
    controlBar.setAttribute('data-testid', 'nav-controls');
    controlBar.setAttribute('role', 'group');
    controlBar.setAttribute('aria-label', 'Camera controls');

    orbitButton = docLocal.createElement('button');
    orbitButton.type = 'button';
    orbitButton.className = 'nav-controls__button';
    orbitButton.setAttribute('data-testid', 'nav-orbit-button');
    orbitButton.setAttribute('data-action', 'set-mode-orbit');
    orbitButton.setAttribute('aria-pressed', 'false');
    orbitButton.textContent = 'Orbit';
    orbitButton.addEventListener('click', () => navigation.setMode('orbit'));

    walkButton = docLocal.createElement('button');
    walkButton.type = 'button';
    walkButton.className = 'nav-controls__button';
    walkButton.setAttribute('data-testid', 'nav-walk-button');
    walkButton.setAttribute('data-action', 'set-mode-walk');
    walkButton.setAttribute('aria-pressed', 'false');
    walkButton.textContent = 'Walk';
    walkButton.addEventListener('click', () => navigation.setMode('walk'));

    const resetButton = docLocal.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'nav-controls__button';
    resetButton.setAttribute('data-testid', 'nav-reset-button');
    resetButton.setAttribute('data-action', 'reset-view');
    resetButton.textContent = 'Reset view';
    resetButton.addEventListener('click', () => navigation.resetView());

    const hint = docLocal.createElement('p');
    hint.className = 'nav-controls__hint';
    hint.setAttribute('data-testid', 'nav-hint');
    hint.textContent =
      'Drag to orbit · scroll to zoom · click an object to inspect · M toggles walk (WASD to move) · arrows orbit · +/- zoom · Esc closes · R resets';

    controlBar.appendChild(orbitButton);
    controlBar.appendChild(walkButton);
    controlBar.appendChild(resetButton);
    controlBar.appendChild(hint);
    host.appendChild(controlBar);
    syncModeButtons();
  };

  /* ---------------- per-frame update (allocation free) ---------------- */

  const update = (deltaSeconds: number): void => {
    if (disposed) return;
    const delta = Math.min(deltaSeconds, 0.1);
    const keep = dampFactor(dampingLambda, delta);
    const blend = 1 - keep;

    if (lambdaHoldTime > 0 && !focusing) {
      lambdaHoldTime -= delta;
      if (lambdaHoldTime <= 0) dampingLambda = DAMP_DEFAULT;
    }

    // Damped wheel zoom inertia feeds the orbit distance goal.
    if (Math.abs(wheelZoomVelocity) > 1e-5) {
      goal.distance = clamp(goal.distance * (1 + wheelZoomVelocity), minDistance, maxDistance);
      wheelZoomVelocity *= dampFactor(DAMP_SLOWER, delta);
    }

    if (mode === 'orbit') {
      // Inertial look: keep gliding briefly after the pointer is released.
      if (activePointerId === -1 && (Math.abs(yawVelocity) > 1e-5 || Math.abs(pitchVelocity) > 1e-5)) {
        goal.yaw += yawVelocity * delta * 60;
        goal.pitch = clamp(goal.pitch + pitchVelocity * delta * 60, minPitch, maxPitch);
        const inertiaKeep = dampFactor(DAMP_SLOWER, delta);
        yawVelocity *= inertiaKeep;
        pitchVelocity *= inertiaKeep;
      }
      // Spring the spherical pose toward the goal.
      state.target.lerp(goal.target, blend);
      state.yaw += (goal.yaw - state.yaw) * blend;
      state.pitch += (goal.pitch - state.pitch) * blend;
      state.distance += (goal.distance - state.distance) * blend;
      clampGoalBounds(state);
      computeForward(TMP_VEC_A, state.yaw, state.pitch);
      TMP_VEC_B.copy(state.target).addScaledVector(TMP_VEC_A, -state.distance);
      if (TMP_VEC_B.y < bounds.minY) TMP_VEC_B.y = bounds.minY;
      if (TMP_VEC_B.y > bounds.maxY) TMP_VEC_B.y = bounds.maxY;
      TMP_VEC_B.x = clamp(TMP_VEC_B.x, bounds.minX, bounds.maxX);
      TMP_VEC_B.z = clamp(TMP_VEC_B.z, bounds.minZ, bounds.maxZ);
      camera.position.copy(TMP_VEC_B);
      TMP_VEC_C.copy(state.target);
      camera.lookAt(TMP_VEC_C);
    } else {
      // Walk: WASD/arrow movement along the ground with boundary clamping.
      let forwardInput = 0;
      let strafeInput = 0;
      if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) forwardInput += 1;
      if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) forwardInput -= 1;
      if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) strafeInput += 1;
      if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) strafeInput -= 1;
      if (forwardInput !== 0 || strafeInput !== 0) {
        const invLen = 1 / Math.hypot(forwardInput, strafeInput);
        forwardInput *= invLen;
        strafeInput *= invLen;
        const sinYaw = Math.sin(state.yaw);
        const cosYaw = Math.cos(state.yaw);
        // Forward on the ground plane; right = (cos yaw, 0, -sin yaw).
        TMP_VEC_A.set(-sinYaw * forwardInput + cosYaw * strafeInput, 0, -cosYaw * forwardInput - sinYaw * strafeInput);
        TMP_VEC_A.multiplyScalar(walkSpeed * delta);
        walkPos.x = clamp(walkPos.x + TMP_VEC_A.x, bounds.minX, bounds.maxX);
        walkPos.z = clamp(walkPos.z + TMP_VEC_A.z, bounds.minZ, bounds.maxZ);
      }
      // Smoothly glide the eye toward the walk position; look state springs.
      walkPosSmooth.lerp(walkPos, blend);
      state.yaw += (goal.yaw - state.yaw) * blend;
      state.pitch += (goal.pitch - state.pitch) * blend;
      camera.position.copy(walkPosSmooth);
      computeForward(TMP_VEC_A, state.yaw, state.pitch);
      TMP_VEC_B.copy(walkPosSmooth).addScaledVector(TMP_VEC_A, WALK_LOOK_AHEAD);
      camera.lookAt(TMP_VEC_B);
      // Keep the spherical look point synced so mode switches stay continuous.
      state.target.copy(walkPosSmooth).addScaledVector(TMP_VEC_A, state.distance);
      state.distance += (WALK_LOOK_AHEAD - state.distance) * blend;
      goal.distance = WALK_LOOK_AHEAD;
    }

    // Finish focus flights once the pose has settled on its goals.
    if (focusing) {
      focusFlightTime += delta;
      const error =
        Math.abs(state.distance - goal.distance) +
        Math.abs(state.yaw - goal.yaw) +
        Math.abs(state.pitch - goal.pitch) +
        state.target.distanceTo(goal.target);
      if (focusFlightTime >= FOCUS_FLIGHT_TIME && error < FOCUS_SETTLE_EPSILON) {
        focusing = false;
        dampingLambda = DAMP_DEFAULT;
        if (focusDescriptor) events.onFocusArrive?.(focusDescriptor);
        focusDescriptor = null;
      }
    }

    // Commit a queued click-to-focus after pointer events have settled.
    if (pendingFocus && activePointerId === -1) {
      const pick = pendingFocus;
      pendingFocus = null;
      beginFocus(pick.descriptor, pick.point);
    }
  };

  /* ---------------- public handle ---------------- */

  const unsubscribe = onUpdate(update);

  const navigation: SceneNavigation = {
    get mode(): NavigationMode {
      return mode;
    },
    get isCalloutOpen(): boolean {
      return calloutPanel?.isOpen ?? false;
    },
    get isFocusing(): boolean {
      return focusing;
    },
    setMode(next: NavigationMode): NavigationMode {
      if (next === mode || disposed) return mode;
      heldKeys.clear();
      yawVelocity = 0;
      pitchVelocity = 0;
      wheelZoomVelocity = 0;
      if (next === 'walk') {
        // Place the eye under the current camera (no visual jump) and glide.
        walkPos.set(
          clamp(camera.position.x, bounds.minX, bounds.maxX),
          Math.max(WALK_EYE_HEIGHT, bounds.minY),
          clamp(camera.position.z, bounds.minZ, bounds.maxZ),
        );
        walkPosSmooth.copy(camera.position);
        goal.yaw = state.yaw;
        goal.pitch = state.pitch;
        goal.distance = WALK_LOOK_AHEAD;
        state.distance = WALK_LOOK_AHEAD;
      } else {
        // Hand the current pose to the orbit rig first so nothing jumps, then
        // ease out to a comfortable framing distance.
        computeForward(TMP_VEC_A, state.yaw, state.pitch);
        state.target.copy(camera.position).addScaledVector(TMP_VEC_A, state.distance);
        goal.target.copy(state.target);
        goal.yaw = state.yaw;
        goal.pitch = clamp(state.pitch, minPitch, maxPitch);
        goal.distance = clamp(
          Math.max(state.distance * 3, ORBIT_COMFORT_DISTANCE),
          minDistance,
          maxDistance,
        );
      }
      clampGoalBounds(goal);
      dampingLambda = DAMP_SLOWER;
      lambdaHoldTime = MODE_HOLD_TIME;
      mode = next;
      events.onModeChange?.(mode);
      syncModeButtons();
      return mode;
    },
    toggleMode(): NavigationMode {
      return navigation.setMode(mode === 'orbit' ? 'walk' : 'orbit');
    },
    registerPickable(descriptor: PickableDescriptor): () => void {
      if (descriptors.has(descriptor.id)) {
        throw new Error(`Pickable "${descriptor.id}" is already registered`);
      }
      descriptors.set(descriptor.id, descriptor);
      rebuildPickableObjects();
      return () => unregisterById(descriptor.id);
    },
    registerPickables(list: readonly PickableDescriptor[]): () => void {
      const undos = list.map((descriptor) => navigation.registerPickable(descriptor));
      return () => {
        for (const undo of undos) undo();
      };
    },
    focus(descriptorId: string): boolean {
      const descriptor = descriptors.get(descriptorId);
      if (!descriptor) return false;
      beginFocus(descriptor, null);
      return true;
    },
    dismissCallout(): void {
      const wasOpen = calloutPanel?.isOpen ?? false;
      calloutPanel?.hide();
      if (focusing) {
        focusing = false;
        focusDescriptor = null;
        dampingLambda = DAMP_DEFAULT;
      }
      if (wasOpen) events.onFocusDismiss?.();
    },
    resetView(): void {
      if (mode !== 'orbit') navigation.setMode('orbit');
      copyState(goal, defaultView);
      clampGoalBounds(goal);
      focusing = false;
      focusDescriptor = null;
      dampingLambda = DAMP_FASTER;
      lambdaHoldTime = MODE_HOLD_TIME;
      navigation.dismissCallout();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('keyup', onKeyUp);
      doc.removeEventListener('blur', onBlur);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', onPointerCancel);
      domElement.removeEventListener('wheel', onWheel);
      calloutPanel?.dispose();
      controlBar?.remove();
      controlBar = null;
      orbitButton = null;
      walkButton = null;
      descriptors.clear();
      descriptorByObject.clear();
      pickableObjects.length = 0;
      heldKeys.clear();
      pinchPointers.clear();
    },
  };

  /* ---------------- bind input ---------------- */

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerCancel);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('keyup', onKeyUp);
  doc.addEventListener('blur', onBlur);

  buildControlsUi();
  syncModeButtons();
  return navigation;
}
