/**
 * Cinematic camera controller: damped orbit, pan, zoom, bounds clamping, and
 * per-era fly-to vantage points.
 *
 * The controller wraps a PerspectiveCamera and a target point the camera
 * orbits around. The orbit radius, azimuth angle, and polar angle are all
 * damped toward user/script intent so motion is smooth and never snappy.
 * The target is translated in screen space by pan gestures, and the scroll
 * wheel / pinch gesture zooms the orbit radius.
 *
 * The controller is decoupled from the DOM: it accepts a canvas element in
 * the constructor and attaches all pointer/wheel listeners to it. It never
 * reaches for `document` or global DOM state, so the same instance works in
 * the app, in HMR, and in unit tests (which drive `update()` and the math
 * directly).
 *
 * Constraints (bounds clamping):
 *   - The orbit target is clamped to the shared city-block extents
 *     (`src/config/paths.ts`).
 *   - The camera position is derived from the target plus a spherical offset,
 *     so it cannot leave the block footprint; the camera is also not allowed
 *     to go below street level (y = 0 plus a small pad).
 *
 * Auto-rotate idle mode: when enabled, the azimuth slowly increases each
 * frame while the user is idle. Any user interaction (pointer down, wheel,
 * touch start) pauses auto-rotate, and it resumes after
 * `autoRotateIdleDelaySec` of sustained inactivity.
 *
 * The controller exposes a programmatic `flyTo(year)` camera move so the
 * timeline slider can showcase each era from a good vantage point. Fly-tos
 * are damped like regular user motion and pause auto-rotate while active.
 *
 * This module only mutates the passed camera; it creates no renderer, no
 * animation loop, and no scene. `update(deltaSec)` must be called every
 * frame by the composition root.
 */
import { MathUtils, Vector2, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';

import {
  BLOCK_MAX_HEIGHT,
  BLOCK_MAX_X,
  BLOCK_MAX_Z,
  BLOCK_MIN_X,
  BLOCK_MIN_Z,
} from '../config/paths';

import type { EraId } from './eras';

const clamp = MathUtils.clamp;
const damp = MathUtils.damp;

/** 2π; used for angle normalization. */
const TAU = Math.PI * 2;

/** Street level (world Y of the ground) — the camera may not go below it. */
const STREET_LEVEL = 0;
/** Small pad above street level so the camera never sits exactly at y=0. */
const MIN_HEIGHT_PAD = 0.5;

/** Hard clamp so the camera never clips into the block center. */
const HARD_MIN_RADIUS = 1.2;
/** Hard clamp so the camera stays inside the sky dome / far plane. */
const HARD_MAX_RADIUS = 24;

/** Angles smaller than this are treated as converged. */
const ANGLE_EPSILON = 1e-4;
/** Distances smaller than this are treated as converged. */
const DIST_EPSILON = 1e-4;

/** Damping rate used for ordinary (non fly-to) orbit/zoom motion. */
const REGULAR_DAMPING = 8;

/** Damping rate used for the pan velocity decay. */
const PAN_SMOOTHING = 6;

/** Per-screen-pixel sensitivity used for orbit drags. */
const ORBIT_SENSITIVITY = 0.004;

/**
 * Per-era cinematic vantage points. The timeline slider calls `flyTo(year)`
 * to land on one of these; each entry was chosen to showcase the era's key
 * visual from a pleasing angle.
 */
export interface CameraVantage {
  /** Aim point the camera orbits (clamped to the block extents). */
  readonly target: Vector3;
  /** Ideal orbit radius from the target, in world units. */
  readonly radius: number;
  /** Ideal azimuth (horizontal orbit angle, radians). */
  readonly azimuth: number;
  /** Ideal polar angle from the +Y axis (radians). 0 = straight down. */
  readonly polar: number;
  /** Easing/exponential damping rate for the fly-to (higher = snappier). */
  readonly flyDamping: number;
}

/**
 * Lookup of cinematic vantage points for each supported era. Callers may
 * override the whole set per-instance via `vantagePoints`.
 */
export const DEFAULT_ERA_VANTAGES: Record<EraId, CameraVantage> = {
  '1945': {
    target: new Vector3(-3.5, 0.5, -3),
    radius: 7.2,
    azimuth: Math.PI * 0.34,
    polar: Math.PI * 0.28,
    flyDamping: 2.4,
  },
  '1965': {
    target: new Vector3(2.4, 0.55, 1.6),
    radius: 7.8,
    azimuth: Math.PI * 0.68,
    polar: Math.PI * 0.26,
    flyDamping: 2.4,
  },
  '1985': {
    target: new Vector3(-0.8, 0.7, 2.6),
    radius: 8.4,
    azimuth: Math.PI * 0.52,
    polar: Math.PI * 0.24,
    flyDamping: 2.4,
  },
  '2005': {
    target: new Vector3(3.4, 0.6, -1.8),
    radius: 8.1,
    azimuth: Math.PI * 0.88,
    polar: Math.PI * 0.27,
    flyDamping: 2.4,
  },
  '2025': {
    target: new Vector3(0.4, 0.8, -0.6),
    radius: 6.6,
    azimuth: Math.PI * 0.6,
    polar: Math.PI * 0.22,
    flyDamping: 2.6,
  },
};

/** Options accepted by the CameraController constructor (all optional). */
export interface CameraControllerOptions {
  /** Target point the camera orbits; defaults to the block center. */
  target?: Vector3;
  /** Orbit radius from the target; defaults to 7. */
  radius?: number;
  /** Initial azimuth angle in radians; defaults to 0. */
  azimuth?: number;
  /** Initial polar angle from the +Y axis in radians; defaults to 0.5. */
  polar?: number;
  /** Minimum orbit radius (clamped into [minRadius, maxRadius]). */
  minRadius?: number;
  /** Maximum orbit radius. */
  maxRadius?: number;
  /** Vertical FOV of the camera (defaults to the camera's own fov). */
  fov?: number;
  /** Enable auto-rotate idle mode (defaults to true). */
  autoRotate?: boolean;
  /** Seconds of sustained inactivity before auto-rotate resumes (default 3). */
  autoRotateIdleDelaySec?: number;
  /** Auto-rotate speed in radians per second (default 0.35). */
  autoRotateSpeed?: number;
  /** Per-era vantage points used by flyTo (defaults to DEFAULT_ERA_VANTAGES). */
  vantagePoints?: Record<EraId, CameraVantage>;
}

/** A single ongoing fly-to move, animated by `update()`. */
interface ActiveFlyTo {
  /** Final azimuth (radians). */
  readonly targetAzimuth: number;
  /** Final polar angle from +Y (radians). */
  readonly targetPolar: number;
  /** Final orbit radius. */
  readonly targetRadius: number;
  /** Final orbit target point. */
  readonly targetPoint: Vector3;
  /** Easing rate for the fly-to (higher = faster). */
  readonly damping: number;
}

/** Returned by `update()` so the app can query controller activity. */
export interface CameraUpdateResult {
  /** True when a fly-to or damping is still in progress this frame. */
  readonly isAnimating: boolean;
  /** True when a pan gesture contributed movement this frame. */
  readonly didPan: boolean;
}

/**
 * Damped cinematic camera controller. Call `update(deltaSec)` every frame
 * after the controller has been given a camera; call `setSize()` whenever the
 * canvas resizes so pan speeds stay screen-relative.
 */
export class CameraController {
  /** The camera this controller drives. */
  readonly camera: PerspectiveCamera;
  /** The point the camera orbits around (always clamped to block bounds). */
  readonly target: Vector3;

  private readonly canvas: HTMLCanvasElement;
  private readonly minRadius: number;
  private readonly maxRadius: number;
  private readonly autoRotate: boolean;
  private readonly autoRotateIdleDelaySec: number;
  private readonly autoRotateSpeed: number;
  private readonly vantagePoints: Record<EraId, CameraVantage>;

  /** Desired azimuth (radians) — what damping moves toward. */
  private desiredAzimuth: number;
  /** Desired polar angle from +Y (radians). */
  private desiredPolar: number;
  /** Desired orbit radius. */
  private desiredRadius: number;
  /** Desired target point (clamped on every update). */
  private desiredTarget: Vector3;

  /** Current smoothed values (early-returned to `desired*` when at rest). */
  private currentAzimuth: number;
  private currentPolar: number;
  private currentRadius: number;

  /** Initial pose — double-click / double-tap recenters to this. */
  private readonly initialTarget: Vector3;
  private readonly initialAzimuth: number;
  private readonly initialPolar: number;
  private readonly initialRadius: number;

  /** True while a drag gesture is active. */
  private pointerDown = false;
  private pointerId: number | null = null;
  private lastPointer = new Vector2();
  /** True when the current drag is a pan (vs. an orbit). */
  private currentGestureIsPan = false;

  /** Accumulated pending pan delta in screen pixels, decayed each frame. */
  private recenterVelocity = new Vector2();

  private touches: Array<{ identifier: number; x: number; y: number }> = [];
  private pinchDistance = 0;

  private activeFlyTo: ActiveFlyTo | null = null;

  /** Set on any user input; auto-rotate stays off until idle delay elapses. */
  private userInteracted = false;
  private idleTimeSec = 0;

  private canvasHeight = 1;

  private disposed = false;

  /**
   * Creates the controller, binds all input listeners to `canvas`, and applies
   * the initial camera pose.
   */
  constructor(
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
    options: CameraControllerOptions = {},
  ) {
    this.camera = camera;
    this.canvas = canvas;

    this.minRadius = clamp(options.minRadius ?? 3, HARD_MIN_RADIUS, HARD_MAX_RADIUS);
    this.maxRadius = clamp(options.maxRadius ?? 15, HARD_MIN_RADIUS, HARD_MAX_RADIUS);
    this.maxRadius = Math.max(this.maxRadius, this.minRadius);

    // Initialize from options, falling back to the camera's current pose when
    // an option was omitted so the app can pre-position the camera.
    const currentPosition = this.camera.position.clone();
    const currentTarget = options.target?.clone() ?? new Vector3(0, 0.5, 0);
    const offset = currentPosition.clone().sub(currentTarget);
    this.target = currentTarget;
    const requestedRadius = options.radius !== undefined ? options.radius : offset.length();
    this.currentRadius = clamp(requestedRadius, this.minRadius, this.maxRadius);
    if (this.currentRadius < ANGLE_EPSILON) {
      this.currentRadius = this.minRadius;
      this.currentAzimuth = options.azimuth ?? 0;
      this.currentPolar = options.polar ?? 0.5;
    } else {
      this.currentPolar = Math.acos(clamp(offset.y / this.currentRadius, -1, 1));
      this.currentAzimuth = Math.atan2(offset.x, offset.z);
    }
    if (options.azimuth !== undefined) this.currentAzimuth = options.azimuth;
    if (options.polar !== undefined) this.currentPolar = options.polar;

    this.desiredAzimuth = this.currentAzimuth;
    this.desiredPolar = this.currentPolar;
    this.desiredRadius = this.currentRadius;
    this.desiredTarget = currentTarget.clone();
    this.clampTarget();
    this.target.copy(this.desiredTarget);

    this.initialTarget = currentTarget.clone();
    this.initialAzimuth = this.currentAzimuth;
    this.initialPolar = this.currentPolar;
    this.initialRadius = this.currentRadius;

    this.autoRotate = options.autoRotate ?? true;
    this.autoRotateIdleDelaySec = Math.max(0, options.autoRotateIdleDelaySec ?? 3);
    this.autoRotateSpeed = Math.max(0, options.autoRotateSpeed ?? 0.35);
    this.vantagePoints = options.vantagePoints ?? DEFAULT_ERA_VANTAGES;

    // Camera config.
    this.camera.fov = options.fov ?? this.camera.fov;
    this.camera.near = 0.1;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();

    // Apply the computed pose immediately so the first frame is already good.
    this.clampTarget();
    this.applyPose(true);

    this.sizeFromCanvas();
    this.bindInput();
  }

  /** Updates the controller for one frame. Call every frame from the loop. */
  update(deltaSec: number): CameraUpdateResult {
    if (this.disposed || deltaSec <= 0) {
      return { isAnimating: false, didPan: false };
    }

    const dt = Math.min(deltaSec, 0.1);

    // Apply pending pan velocity (accumulated in screen pixels) to the target.
    if (this.recenterVelocity.lengthSq() > 0) {
      this.applyPanVelocity(dt);
    }

    const flyTo = this.activeFlyTo;
    if (flyTo !== null) {
      this.desiredAzimuth = flyTo.targetAzimuth;
      this.desiredPolar = flyTo.targetPolar;
      this.desiredRadius = flyTo.targetRadius;
      this.desiredTarget.copy(flyTo.targetPoint);

      this.currentAzimuth = dampAngle(this.currentAzimuth, this.desiredAzimuth, flyTo.damping, dt);
      this.currentPolar = damp(this.currentPolar, this.desiredPolar, flyTo.damping, dt);
      this.currentRadius = damp(this.currentRadius, this.desiredRadius, flyTo.damping, dt);
      this.target.lerp(this.desiredTarget, 1 - Math.exp(-flyTo.damping * dt));

      // Clamp the target *after* applying it so it never escapes the block.
      this.clampTarget();

      if (
        angleDelta(this.currentAzimuth, this.desiredAzimuth) < ANGLE_EPSILON &&
        Math.abs(this.currentPolar - this.desiredPolar) < ANGLE_EPSILON &&
        Math.abs(this.currentRadius - this.desiredRadius) < DIST_EPSILON &&
        this.target.distanceTo(this.desiredTarget) < DIST_EPSILON
      ) {
        this.currentAzimuth = this.desiredAzimuth;
        this.currentPolar = this.desiredPolar;
        this.currentRadius = this.desiredRadius;
        this.target.copy(this.desiredTarget);
        this.activeFlyTo = null;
        this.idleTimeSec = 0;
      }
    } else {
      // Ordinary damping toward user/script intent.
      this.currentAzimuth = dampAngle(this.currentAzimuth, this.desiredAzimuth, REGULAR_DAMPING, dt);
      this.currentPolar = damp(this.currentPolar, this.desiredPolar, REGULAR_DAMPING, dt);
      this.currentRadius = damp(this.currentRadius, this.desiredRadius, REGULAR_DAMPING, dt);
      if (Math.abs(this.currentPolar - this.desiredPolar) < ANGLE_EPSILON) {
        this.currentPolar = this.desiredPolar;
      }
      if (Math.abs(this.currentRadius - this.desiredRadius) < DIST_EPSILON) {
        this.currentRadius = this.desiredRadius;
      }
      this.clampTarget();
      this.target.copy(this.desiredTarget);

      // Auto-rotate idle mode. Any interaction pauses rotation; once the
      // user has been idle for `autoRotateIdleDelaySec`, rotation resumes.
      if (!this.pointerDown && this.activeFlyTo === null) {
        this.idleTimeSec += dt;
        if (this.idleTimeSec >= this.autoRotateIdleDelaySec) {
          this.userInteracted = false;
        }
      } else {
        this.idleTimeSec = 0;
      }

      if (this.autoRotate && !this.userInteracted && !this.pointerDown && this.activeFlyTo === null) {
        this.currentAzimuth = (this.currentAzimuth + this.autoRotateSpeed * dt) % TAU;
        this.desiredAzimuth = this.currentAzimuth;
      }
    }

    const didPan = this.recenterVelocity.lengthSq() > 0;
    this.applyPose(false);
    const converged =
      angleDelta(this.currentAzimuth, this.desiredAzimuth) < ANGLE_EPSILON &&
      Math.abs(this.currentPolar - this.desiredPolar) < ANGLE_EPSILON &&
      Math.abs(this.currentRadius - this.desiredRadius) < DIST_EPSILON;
    return {
      isAnimating: this.activeFlyTo !== null || !converged,
      didPan,
    };
  }

  /** Sets the camera's vertical FOV and updates the projection matrix. */
  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Call whenever the canvas/viewport resizes so pan speeds stay correct. */
  setSize(_width: number, height: number): void {
    this.canvasHeight = Math.max(height, 1);
  }

  /** Starts an orbit drag at the given canvas position. */
  startOrbit(pointerX: number, pointerY: number): void {
    this.beginGesture(pointerX, pointerY, false);
  }

  /** Starts a pan drag at the given canvas position. */
  startPan(pointerX: number, pointerY: number): void {
    this.beginGesture(pointerX, pointerY, true);
  }

  /**
   * Applies an analytic orbit delta (radians). Equivalent to a drag orbit:
   * positive `azimuthDelta` orbits right, positive `polarDelta` orbits up.
   */
  orbitDelta(azimuthDelta: number, polarDelta: number): void {
    this.desiredAzimuth = normAngle(this.desiredAzimuth + azimuthDelta);
    this.desiredPolar = clamp(this.desiredPolar + polarDelta, 0.05, Math.PI / 2 - 0.05);
    this.notifyInteraction();
  }

  /** Moves the orbit target by a screen-space delta (in CSS pixels). */
  panBy(deltaX: number, deltaY: number): void {
    this.recenterVelocity.x += deltaX;
    this.recenterVelocity.y += deltaY;
    this.notifyInteraction();
  }

  /**
   * Zooms the orbit radius. `deltaRadius > 0` zooms in, `< 0` zooms out.
   * The radius chases the new desired value with the regular damping.
   */
  zoomBy(deltaRadius: number): void {
    this.desiredRadius = clamp(this.desiredRadius + deltaRadius, this.minRadius, this.maxRadius);
    this.notifyInteraction();
  }

  /** Convenience wheel handler: scroll-up zooms in, scroll-down zooms out. */
  wheelZoom(deltaY: number): void {
    this.zoomBy(-deltaY * 0.0012);
  }

  /**
   * Flys the camera to the cinematic vantage point for the given era.
   * The move is damped, pauses auto-rotate until it completes, and clamps to
   * the block bounds.
   */
  flyTo(year: EraId): void {
    const vantage = this.vantagePoints[year];
    if (!vantage) return;
    this.activeFlyTo = {
      targetAzimuth: normAngle(vantage.azimuth),
      targetPolar: clamp(vantage.polar, 0.05, Math.PI / 2 - 0.05),
      targetRadius: clamp(vantage.radius, this.minRadius, this.maxRadius),
      targetPoint: vantage.target.clone(),
      damping: Math.max(0.5, vantage.flyDamping),
    };
    this.notifyInteraction();
  }

  /** Stops any in-flight fly-to, damping back to the current pose. */
  cancelFlyTo(): void {
    this.activeFlyTo = null;
    this.notifyInteraction();
  }

  /** Re-centers to the initial pose (double-click / double-tap). */
  recenter(): void {
    this.desiredAzimuth = this.initialAzimuth;
    this.desiredPolar = this.initialPolar;
    this.desiredRadius = this.initialRadius;
    this.desiredTarget.copy(this.initialTarget);
    this.activeFlyTo = null;
    this.notifyInteraction();
  }

  /** Detaches all input listeners. Call before dropping the controller. */
  dispose(): void {
    if (this.disposed) return;
    this.unbindInput();
    this.disposed = true;
  }

  // ---------------------------------------------------------------------
  // Input plumbing
  // ---------------------------------------------------------------------

  private notifyInteraction(): void {
    this.userInteracted = true;
    this.idleTimeSec = 0;
  }

  private beginGesture(pointerX: number, pointerY: number, isPan: boolean): void {
    this.pointerDown = true;
    this.pointerId = null;
    this.lastPointer.set(pointerX, pointerY);
    this.currentGestureIsPan = isPan;
    this.notifyInteraction();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed || event.pointerType === 'touch') return;
    this.pointerDown = true;
    this.pointerId = event.pointerId;
    this.lastPointer.set(event.clientX, event.clientY);
    this.currentGestureIsPan = event.button === 1 || event.button === 2 || event.shiftKey;
    if (!this.currentGestureIsPan) this.canvas.setPointerCapture?.(event.pointerId);
    this.notifyInteraction();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || !this.pointerDown || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer.set(event.clientX, event.clientY);
    if (this.currentGestureIsPan) {
      this.panBy(dx, dy);
    } else {
      this.orbitDelta(-dx * ORBIT_SENSITIVITY, -dy * ORBIT_SENSITIVITY);
    }
  };

  private handlePointerUp = (): void => {
    this.pointerDown = false;
    this.pointerId = null;
    this.userInteracted = true;
  };

  private handlePointerCancel = (): void => this.handlePointerUp();

  private handlePointerLeave = (): void => {
    if (this.pointerDown) this.handlePointerUp();
  };

  private handleWheel = (event: WheelEvent): void => {
    if (this.disposed) return;
    event.preventDefault();
    this.wheelZoom(event.deltaY);
  };

  private handleTouchStart = (event: TouchEvent): void => {
    if (this.disposed) return;
    this.notifyInteraction();
    this.touches = Array.from(event.touches, (t) => ({
      identifier: t.identifier,
      x: t.clientX,
      y: t.clientY,
    }));
    if (this.touches.length === 1) {
      this.currentGestureIsPan = true;
      this.pointerDown = true;
      this.lastPointer.set(this.touches[0].x, this.touches[0].y);
    } else if (this.touches.length === 2) {
      this.currentGestureIsPan = false;
      this.pointerDown = true;
      this.pinchDistance = this.touchDistance();
    }
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (this.disposed) return;
    if (this.touches.length === 1 && event.touches.length === 1) {
      const nx = event.touches[0].clientX;
      const ny = event.touches[0].clientY;
      const dx = nx - this.touches[0].x;
      const dy = ny - this.touches[0].y;
      this.touches[0] = { identifier: this.touches[0].identifier, x: nx, y: ny };
      this.panBy(dx, dy);
      this.lastPointer.set(nx, ny);
    } else if (event.touches.length === 2) {
      this.updateTouches(event);
      const distance = this.touchDistance();
      const delta = distance - this.pinchDistance;
      this.pinchDistance = distance;
      // Spreading fingers zooms in (radius shrinks).
      this.zoomBy(-delta * 0.01);
    }
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (this.disposed) return;
    this.touches = Array.from(event.touches, (t) => ({
      identifier: t.identifier,
      x: t.clientX,
      y: t.clientY,
    }));
    if (this.touches.length === 0) {
      this.pointerDown = false;
    } else if (this.touches.length === 1) {
      this.pointerDown = true;
      this.currentGestureIsPan = true;
      const t = this.touches[0];
      this.lastPointer.set(t.x, t.y);
    } else if (this.touches.length === 2) {
      this.pointerDown = true;
      this.pinchDistance = this.touchDistance();
    }
  };

  private handleDoubleClick = (): void => {
    if (this.disposed) return;
    this.recenter();
  };

  /** Distance between the two active touches (CSS pixels). */
  private touchDistance(): number {
    if (this.touches.length < 2) return 0;
    const dx = this.touches[0].x - this.touches[1].x;
    const dy = this.touches[0].y - this.touches[1].y;
    return Math.hypot(dx, dy);
  }

  private updateTouches(event: TouchEvent): void {
    for (const touch of event.touches) {
      const existing = this.touches.find((t) => t.identifier === touch.identifier);
      if (existing) {
        existing.x = touch.clientX;
        existing.y = touch.clientY;
      }
    }
  }

  /** Converts the pending pan velocity (screen px) into target translation. */
  private applyPanVelocity(dt: number): void {
    if (this.recenterVelocity.lengthSq() > 0) {
      const zDist = this.currentRadius * Math.cos(this.currentPolar);
      if (zDist > 0.01) {
        const fovRad = (this.camera.fov * Math.PI) / 360;
        const worldHeight = 2 * zDist * Math.tan(fovRad);
        const worldPerPixel = worldHeight / Math.max(this.canvasHeight, 1);

        const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);

        const px = this.recenterVelocity.x;
        const py = this.recenterVelocity.y;

        // Dragging right moves the target left (grab the world and pull it).
        this.desiredTarget.addScaledVector(right, -px * worldPerPixel);
        this.desiredTarget.addScaledVector(up, py * worldPerPixel);
        this.clampTarget();
      }

      this.recenterVelocity.multiplyScalar(Math.exp(-PAN_SMOOTHING * dt));
      if (this.recenterVelocity.lengthSq() < 1e-8) this.recenterVelocity.set(0, 0);
    }
  }

  /** Clamps the orbit target to the block footprint (X/Z) and street level. */
  private clampTarget(): void {
    this.desiredTarget.x = clamp(this.desiredTarget.x, BLOCK_MIN_X, BLOCK_MAX_X);
    this.desiredTarget.z = clamp(this.desiredTarget.z, BLOCK_MIN_Z, BLOCK_MAX_Z);
    this.desiredTarget.y = clamp(this.desiredTarget.y, STREET_LEVEL, BLOCK_MAX_HEIGHT);
  }

  /** Computes the camera position from target + spherical offset. */
  private applyPose(force: boolean): void {
    const target = this.target;
    const radius = this.currentRadius;
    const minCameraY = STREET_LEVEL + MIN_HEIGHT_PAD;

    // Clamp the polar angle so the camera never goes below street level:
    // cameraY = target.y + radius * cos(polar) >= minCameraY.
    let polar = this.currentPolar;
    const cosTargetY = (target.y - minCameraY) / radius;
    if (Math.cos(polar) < cosTargetY) {
      polar = Math.acos(clamp(cosTargetY, -1, 1));
    }
    polar = clamp(polar, 0.05, Math.PI / 2 - 0.02);

    const azimuth = this.currentAzimuth;
    const sinP = Math.sin(polar);
    const cosP = Math.cos(polar);
    const sinA = Math.sin(azimuth);
    const cosA = Math.cos(azimuth);

    // Clamp the camera position to the shared city-block footprint so the
    // user can never leave the block bounds, and never below street level.
    const x = clamp(target.x + radius * sinP * sinA, BLOCK_MIN_X, BLOCK_MAX_X);
    const y = Math.max(minCameraY, target.y + radius * cosP);
    const z = clamp(target.z + radius * sinP * cosA, BLOCK_MIN_Z, BLOCK_MAX_Z);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(force);
  }

  private bindInput(): void {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('touchstart', this.handleTouchStart);
    canvas.addEventListener('touchmove', this.handleTouchMove);
    canvas.addEventListener('touchend', this.handleTouchEnd);
    canvas.addEventListener('touchcancel', this.handleTouchEnd);
    canvas.addEventListener('dblclick', this.handleDoubleClick);
  }

  private unbindInput(): void {
    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);
    canvas.removeEventListener('touchcancel', this.handleTouchEnd);
    canvas.removeEventListener('dblclick', this.handleDoubleClick);
  }

  private sizeFromCanvas(): void {
    this.canvasHeight = this.canvas.clientHeight || 1;
  }
}

/** Normalizes an angle into [0, 2π). */
function normAngle(angle: number): number {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}

/** Smallest signed angular distance between two angles (radians). */
function angleDelta(a: number, b: number): number {
  const diff = normAngle(b - a);
  return diff > Math.PI ? diff - TAU : diff;
}

/** Damped angle interpolation that wraps past ±π (shortest path). */
function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = normAngle(target - current);
  const wrapped = diff > Math.PI ? diff - TAU : diff;
  const step = wrapped * (1 - Math.exp(-lambda * dt));
  // Snap when the remaining step is below the convergence epsilon so the
  // value truly converges instead of asymptotically hovering.
  if (Math.abs(step) < ANGLE_EPSILON) {
    return target;
  }
  return normAngle(current + step);
}