// =============================================================================
// City Timelapse — Camera Controller
//
// A high-end, self-contained navigation layer wrapping three.js
// OrbitControls. It adds:
//
//   • Preset views (Overview, Street Level, Close-up) that tween the camera
//     position and target over ~1s using the *same* easeInOutCubic as
//     EraState — so camera moves feel visually consistent with era morphs.
//   • A 'Cinematic' auto-orbit that slowly rotates the camera horizontally
//     around the block at a configurable speed and fixed height. It pauses
//     the instant the user touches any control (mouse, wheel, or key), and
//     resumes after a quiet period so the scene can showcase itself.
//   • Smoothed scroll-wheel zoom — instead of discrete stepped zooms the
//     distance eases toward the wheel target.
//   • WASD / arrow-key panning of the orbit target.
//
// The controller is pure three.js + DOM; no external UI or tween library.
//
// Lifecycle: construct once after the scene/camera/controls exist, then call
// `update(dt)` every frame. Call `dispose()` on teardown (HMR).
// =============================================================================

import { Raycaster, Vector2, Vector3 } from 'three';
import type { Object3D, PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic } from './EraState';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The three preset camera views. */
export type CameraPresetId = 'overview' | 'street' | 'closeup';

/** Description of a preset: where the camera sits and where it looks. */
export interface CameraPreset {
  /** World-space camera position. */
  readonly position: Vector3;
  /** World-space orbit target (look-at point). */
  readonly target: Vector3;
  /** Short label shown on the preset button. */
  readonly label: string;
}

/** Options accepted by {@link CameraController}. */
export interface CameraControllerOptions {
  /** The orbit controls instance being enhanced. */
  readonly controls: OrbitControls;
  /** The perspective camera the controls drive. */
  readonly camera: PerspectiveCamera;
  /** DOM element that receives pointer / wheel input (the renderer canvas). */
  readonly domElement: HTMLElement;
  /** Collidable scene objects, used to step the camera back out of buildings. */
  readonly collidables?: Object3D[];
  /** Cinematic auto-orbit angular speed, radians per second. Default ~0.16. */
  readonly cinematicSpeed?: number;
  /** Height (Y) the cinematic orbit holds. Default 30. */
  readonly cinematicHeight?: number;
  /** Radius the cinematic orbit holds from the block center. Default 72. */
  readonly cinematicRadius?: number;
  /** Center the cinematic orbit rotates around. Default (0, 6, 0). */
  readonly cinematicTarget?: Vector3;
  /** Idle ms before cinematic resumes after user input. Default 4500. */
  readonly cinematicResumeDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Easing — shared with EraState for visual consistency
// ---------------------------------------------------------------------------

// `easeInOutCubic` is imported from EraState so camera tweens and era morphs
// use the identical curve. This is a stated acceptance criterion.

// ---------------------------------------------------------------------------
// Tween driver — advances position/target 0→1 over a duration
// ---------------------------------------------------------------------------

interface TweenState {
  active: boolean;
  start: number; // performance.now() at start
  durationMs: number;
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  rafId: number | null;
}

function createIdleTween(): TweenState {
  return {
    active: false,
    start: 0,
    durationMs: 0,
    fromPos: new Vector3(),
    toPos: new Vector3(),
    fromTarget: new Vector3(),
    toTarget: new Vector3(),
    rafId: null,
  };
}

// ---------------------------------------------------------------------------
// CameraController
// ---------------------------------------------------------------------------

/**
 * Enhances OrbitControls with preset tweening, cinematic auto-orbit, smoothed
 * zoom, keyboard panning, and camera collision stepping. Construct once, call
 * {@link update} each frame, and {@link dispose} on teardown.
 */
export class CameraController {
  private readonly controls: OrbitControls;
  private readonly camera: PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly collidables: Object3D[];

  // Cinematic tuning
  private readonly cinematicSpeed: number;
  private readonly cinematicHeight: number;
  private readonly cinematicRadius: number;
  private readonly cinematicTarget: Vector3;
  private readonly cinematicResumeDelayMs: number;

  // Preset tween
  private readonly tween: TweenState = createIdleTween();

  // Cinematic state
  private _cinematic = false;
  private lastInputAt = 0;
  private cinematicAngle = 0; // current orbit angle (radians)

  // Smoothed zoom
  private targetDistance: number;
  private readonly zoomSmooth = 0.18; // lerp factor toward target distance

  // Keyboard pan
  private readonly keys = new Set<string>();

  // Reusable scratch objects (avoid per-frame allocations)
  private readonly _raycaster = new Raycaster();
  private readonly _v2 = new Vector2();
  private readonly _v3a = new Vector3();
  private readonly _v3b = new Vector3();
  private readonly _v3c = new Vector3();

  // Bound handlers (so removeEventListener works)
  private readonly _onPointerDown = (): void => this.pauseCinematicForInput();
  private readonly _onWheel = (e: WheelEvent): void => this.handleWheel(e);
  private readonly _onKeyDown = (e: KeyboardEvent): void =>
    this.handleKeyDown(e);
  private readonly _onKeyUp = (e: KeyboardEvent): void =>
    this.handleKeyUp(e);
  private readonly _onBlur = (): void => this.keys.clear();

  constructor(opts: CameraControllerOptions) {
    this.controls = opts.controls;
    this.camera = opts.camera;
    this.domElement = opts.domElement;
    this.collidables = opts.collidables ?? [];

    this.cinematicSpeed = opts.cinematicSpeed ?? 0.16;
    this.cinematicHeight = opts.cinematicHeight ?? 30;
    this.cinematicRadius = opts.cinematicRadius ?? 72;
    this.cinematicTarget = (opts.cinematicTarget ?? new Vector3(0, 6, 0)).clone();
    this.cinematicResumeDelayMs = opts.cinematicResumeDelayMs ?? 4500;

    this.targetDistance = this.controls.getDistance();

    // Neutralize OrbitControls' built-in keyboard handling; we drive panning
    // ourselves so WASD and arrow keys both work and we can pause cinematic.
    // (three r160 removed `enableKeys`; we blank the key map instead.)
    this.controls.keys = { LEFT: '', UP: '', RIGHT: '', BOTTOM: '' };

    // We intercept the wheel to set a smoothed target distance rather than
    // letting OrbitControls step it directly. Damping still applies to orbit.
    this.controls.enableZoom = false;

    this.domElement.addEventListener('pointerdown', this._onPointerDown, {
      passive: true,
    });
    this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  // -------------------------------------------------------------------------
  // Presets
  // -------------------------------------------------------------------------

  /** The three preset view definitions, keyed by id. */
  private static readonly PRESETS: Record<CameraPresetId, CameraPreset> = {
    overview: {
      position: new Vector3(55, 42, 65),
      target: new Vector3(0, 6, 0),
      label: 'Overview',
    },
    street: {
      position: new Vector3(28, 9, 34),
      target: new Vector3(0, 5, 0),
      label: 'Street Level',
    },
    closeup: {
      position: new Vector3(14, 6, 16),
      target: new Vector3(0, 6, 0),
      label: 'Close-up',
    },
  };

  /** Lookup a preset by id (throws on unknown id — a programming error). */
  public static getPreset(id: CameraPresetId): CameraPreset {
    const preset = CameraController.PRESETS[id];
    if (!preset) {
      throw new Error(`[cameraController] Unknown preset: "${id}"`);
    }
    return preset;
  }

  /**
   * Tween the camera to a preset over ~1s using easeInOutCubic (the same
   * curve EraState uses), so camera moves feel consistent with era morphs.
   * Cancels any in-flight tween. Collides with cinematic: enabling a preset
   * pauses cinematic orbit so the user sees the move complete.
   */
  public goToPreset(id: CameraPresetId, durationMs = 1000): void {
    const preset = CameraController.getPreset(id);

    // Pause cinematic for the duration of the tween (and beyond, until idle).
    this.pauseCinematicForInput();

    // Cancel any in-flight tween.
    if (this.tween.rafId !== null) {
      cancelAnimationFrame(this.tween.rafId);
      this.tween.rafId = null;
    }
    this.tween.active = true;
    this.tween.start = performance.now();
    this.tween.durationMs = durationMs;
    this.tween.fromPos.copy(this.camera.position);
    this.tween.toPos.copy(preset.position);
    this.tween.fromTarget.copy(this.controls.target);
    this.tween.toTarget.copy(preset.target);

    // Snap OrbitControls so it does not fight the tween.
    this.controls.enabled = false;

    const tick = (): void => {
      if (!this.tween.active) return;
      const now = performance.now();
      const p = Math.min((now - this.tween.start) / this.tween.durationMs, 1);
      const e = easeInOutCubic(p);

      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      this.controls.target.lerpVectors(
        this.tween.fromTarget,
        this.tween.toTarget,
        e,
      );
      this.camera.lookAt(this.controls.target);

      // Keep the smoothed-zoom target in sync with the actual distance.
      this.targetDistance = this.camera.position.distanceTo(this.controls.target);

      if (p < 1) {
        this.tween.rafId = requestAnimationFrame(tick);
      } else {
        // Settle exactly on the target and hand control back to OrbitControls.
        this.camera.position.copy(this.tween.toPos);
        this.controls.target.copy(this.tween.toTarget);
        this.targetDistance = this.camera.position.distanceTo(this.controls.target);
        this.tween.active = false;
        this.tween.rafId = null;
        this.controls.enabled = true;
        this.controls.update();
      }
    };

    this.tween.rafId = requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------
  // Cinematic auto-orbit
  // -------------------------------------------------------------------------

  /** Whether cinematic auto-orbit is currently enabled (toggle state). */
  public get cinematicEnabled(): boolean {
    return this._cinematic;
  }

  /** Enable or disable the cinematic auto-orbit toggle. */
  public setCinematic(enabled: boolean): void {
    this._cinematic = enabled;
    if (enabled) {
      // Seed the orbit angle from the current camera azimuth so the move is
      // continuous rather than a jump.
      this.seedCinematicAngleFromCamera();
      // Treat the enable itself as "input" so we don't immediately spin.
      this.lastInputAt = performance.now();
    }
  }

  /** Toggle cinematic on/off. Returns the new state. */
  public toggleCinematic(): boolean {
    this.setCinematic(!this._cinematic);
    return this._cinematic;
  }

  /** Seed the cinematic orbit angle from the camera's current azimuth. */
  private seedCinematicAngleFromCamera(): void {
    const dx = this.camera.position.x - this.cinematicTarget.x;
    const dz = this.camera.position.z - this.cinematicTarget.z;
    this.cinematicAngle = Math.atan2(dz, dx);
  }

  /**
   * Mark that the user provided input. Pauses cinematic orbit immediately and
   * arms the resume timer (cinematic restarts after `cinematicResumeDelayMs`
   * of quiet, if the toggle is still on).
   */
  private pauseCinematicForInput(): void {
    this.lastInputAt = performance.now();
  }

  /** Whether enough idle time has elapsed for cinematic to resume. */
  private get cinematicShouldSpin(): boolean {
    if (!this._cinematic) return false;
    if (this.tween.active) return false;
    return performance.now() - this.lastInputAt >= this.cinematicResumeDelayMs;
  }

  /** Advance the cinematic orbit by `dt` seconds. */
  private updateCinematic(dt: number): void {
    if (!this.cinematicShouldSpin) return;

    this.cinematicAngle += this.cinematicSpeed * dt;

    const r = this.cinematicRadius;
    const cx = this.cinematicTarget.x + Math.cos(this.cinematicAngle) * r;
    const cz = this.cinematicTarget.z + Math.sin(this.cinematicAngle) * r;

    // Smoothly glide the camera toward the orbit ring point. Using a lerp
    // keeps the transition from manual → cinematic seamless.
    this.camera.position.x += (cx - this.camera.position.x) * 0.06;
    this.camera.position.z += (cz - this.camera.position.z) * 0.06;
    this.camera.position.y +=
      (this.cinematicHeight - this.camera.position.y) * 0.04;

    this.controls.target.lerp(this.cinematicTarget, 0.05);
    this.camera.lookAt(this.controls.target);

    this.targetDistance = this.camera.position.distanceTo(this.controls.target);
  }

  // -------------------------------------------------------------------------
  // Smoothed zoom
  // -------------------------------------------------------------------------

  /** Intercept wheel events to set a smoothed target distance. */
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    this.pauseCinematicForInput();

    // OrbitControls-style zoom step, scaled by current distance for feel.
    const step = Math.max(
      this.controls.minDistance * 0.15,
      this.targetDistance * 0.08,
    );
    const dir = e.deltaY > 0 ? 1 : -1;
    this.targetDistance = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, this.targetDistance + dir * step),
    );
  }

  /** Ease the actual orbit distance toward the smoothed target. */
  private updateSmoothedZoom(): void {
    if (this.tween.active || this.cinematicShouldSpin) return;

    const current = this.controls.getDistance();
    const diff = this.targetDistance - current;
    if (Math.abs(diff) < 1e-3) return;

    const next = current + diff * this.zoomSmooth;

    // Move the camera along the view direction to hit the new distance.
    this._v3a.copy(this.camera.position).sub(this.controls.target);
    const len = this._v3a.length();
    if (len > 1e-6) {
      this._v3a.multiplyScalar(next / len);
      this.camera.position.copy(this.controls.target).add(this._v3a);
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard pan (WASD + left/right arrows)
  // -------------------------------------------------------------------------

  /** Keys that pan the orbit target. ArrowUp/Down are reserved for the
   * timeline; we only map left/right arrows to horizontal pan here, while
   * WASD gives full 2D target panning. */
  private static readonly PAN_KEYS: Record<string, Vector2> = {
    KeyW: new Vector2(0, -1),
    KeyS: new Vector2(0, 1),
    KeyA: new Vector2(-1, 0),
    KeyD: new Vector2(1, 0),
    ArrowLeft: new Vector2(-1, 0),
    ArrowRight: new Vector2(1, 0),
  };

  private handleKeyDown(e: KeyboardEvent): void {
    // Don't hijack typing in form fields.
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable)
    ) {
      return;
    }

    // Any of our managed keys counts as user input → pause cinematic.
    if (CameraController.PAN_KEYS[e.code]) {
      this.keys.add(e.code);
      this.pauseCinematicForInput();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  /** Apply continuous keyboard panning for this frame. */
  private updateKeyboardPan(dt: number): void {
    if (this.keys.size === 0) return;
    if (this.tween.active) return;

    // Build the pan direction in the camera's right/forward basis so panning
    // feels natural relative to the view.
    const move = this._v2.set(0, 0);
    for (const code of this.keys) {
      const dir = CameraController.PAN_KEYS[code];
      if (dir) {
        move.x += dir.x;
        move.y += dir.y;
      }
    }
    if (move.lengthSq() === 0) return;

    // Pan speed scales with current distance so far-away moves feel bigger.
    const dist = this.controls.getDistance();
    const speed = Math.max(8, dist * 0.6); // world units / second
    const mag = speed * dt;

    // Camera right and forward (flattened to XZ) vectors.
    this._v3a.set(1, 0, 0).applyQuaternion(this.camera.quaternion); // right
    this._v3b.set(0, 0, -1).applyQuaternion(this.camera.quaternion); // forward
    this._v3a.y = 0;
    this._v3b.y = 0;
    if (this._v3a.lengthSq() < 1e-8) this._v3a.set(1, 0, 0);
    if (this._v3b.lengthSq() < 1e-8) this._v3b.set(0, 0, -1);
    this._v3a.normalize();
    this._v3b.normalize();

    // move.x → right, move.y → forward/back (screen y inverted)
    this._v3c.set(0, 0, 0);
    this._v3c.addScaledVector(this._v3a, move.x * mag);
    this._v3c.addScaledVector(this._v3b, -move.y * mag);

    this.controls.target.add(this._v3c);
    this.camera.position.add(this._v3c);
  }

  // -------------------------------------------------------------------------
  // Collision — step back if the camera is inside/near a building
  // -------------------------------------------------------------------------

  /**
   * Raycast from the orbit target toward the camera; if a collidable is in the
   * way closer than the current distance, push the camera to just in front of
   * it. Prevents clipping inside buildings. Called each frame after controls
   * settle (cheap when collidables is small).
   */
  public resolveCollision(): void {
    if (this.collidables.length === 0) return;
    if (this.tween.active) return;

    const origin = this.controls.target;
    const dir = this._v3a.copy(this.camera.position).sub(origin);
    const dist = dir.length();
    if (dist < 1e-6) return;
    dir.normalize();

    this._raycaster.set(origin, dir);
    this._raycaster.far = dist;
    const hits = this._raycaster.intersectObjects(this.collidables, true);
    if (hits.length === 0) return;

    const hit = hits[0];
    // Step the camera back to just in front of the collision surface.
    const safeDist = Math.max(this.controls.minDistance, hit.distance - 0.5);
    if (safeDist < dist) {
      this.camera.position.copy(origin).addScaledVector(dir, safeDist);
      this.targetDistance = safeDist;
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------

  /**
   * Advance the controller by `dt` seconds. Call once per render frame,
   * *before* `controls.update()`.
   */
  public update(dt: number): void {
    // Preset tween drives its own rAF, so only smoothed zoom / cinematic /
    // keyboard pan run here (they're skipped while a tween is active).
    this.updateKeyboardPan(dt);
    this.updateSmoothedZoom();
    this.updateCinematic(dt);
  }

  // -------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------

  /** Tear down all listeners and cancel any in-flight tween. */
  public dispose(): void {
    if (this.tween.rafId !== null) {
      cancelAnimationFrame(this.tween.rafId);
      this.tween.rafId = null;
      this.tween.active = false;
    }
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.keys.clear();
  }
}
