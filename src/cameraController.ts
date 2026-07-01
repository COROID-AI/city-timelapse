import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, easeInOutCubic, lerp } from './utils/rng';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

/**
 * Wraps a PerspectiveCamera + OrbitControls and provides tweened era-focus
 * transitions. Enforces min/max distance and damping per the plan.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly defaultTarget = new THREE.Vector3(0, 6, 0);
  private readonly defaultPos = new THREE.Vector3(34, 22, 34);

  private tweenId = 0;
  private tweenActive = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.copy(this.defaultPos);

    this.controls = new OrbitControls(this.camera, this.getDomElement());
    this.controls.target.copy(this.defaultTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 90;
    this.controls.maxPolarAngle = Math.PI * 0.49; // keep above ground
    this.controls.update();
  }

  /** Placeholder canvas-less element; OrbitControls attaches to renderer.domElement later. */
  private getDomElement(): HTMLElement {
    return document.body;
  }

  /** Attach controls to the actual renderer canvas once available. */
  attach(canvas: HTMLCanvasElement): void {
    (this.controls as unknown as { domElement: HTMLElement }).domElement = canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private onPointerDown = (): void => {
    this.cancelTween();
  };

  private onWheel = (): void => {
    this.cancelTween();
  };

  /** Resize handler keeps the projection matrix correct. */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Smoothly move the camera to look at a world point from a framed distance.
   * @param focus World-space point to frame (e.g. a building facade).
   * @param duration ms, clamped to [0, 5000].
   */
  focusOn(focus: THREE.Vector3, duration = 800): void {
    this.tweenTo(
      focus.clone().add(new THREE.Vector3(0, 4, 16)),
      focus.clone(),
      duration,
    );
  }

  /** Return the camera to the default overview framing. */
  resetView(duration = 800): void {
    this.tweenTo(this.defaultPos.clone(), this.defaultTarget.clone(), duration);
  }

  /** Imperative camera update per frame (damping etc.). */
  update(): void {
    this.controls.update();
  }

  private cancelTween(): void {
    this.tweenActive = false;
    this.tweenId++;
  }

  /**
   * Tween camera position + controls target with eased interpolation. Cancels
   * any in-flight tween (mid-era-swap safe).
   */
  tweenTo(
    toPos: THREE.Vector3,
    toTarget: THREE.Vector3,
    durationMs: number,
    onDone?: () => void,
  ): void {
    const duration = clamp(durationMs, 0, 5000);
    const id = ++this.tweenId;
    if (duration <= 0) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.controls.update();
      onDone?.();
      return;
    }

    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const start = performance.now();
    this.tweenActive = true;

    const step = (now: number): void => {
      if (id !== this.tweenId) return; // cancelled
      const t = clamp((now - start) / duration, 0, 1);
      const e = easeInOutCubic(t);
      this.camera.position.lerpVectors(fromPos, toPos, e);
      this.controls.target.lerpVectors(fromTarget, toTarget, e);
      this.controls.update();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.tweenActive = false;
        onDone?.();
      }
    };
    requestAnimationFrame(step);
  }

  isTweening(): boolean {
    return this.tweenActive;
  }

  /** Current normalized view distance (0 nearest .. 1 farthest). */
  normalizedDistance(): number {
    const d = this.camera.position.distanceTo(this.controls.target);
    const span = this.controls.maxDistance - this.controls.minDistance;
    return clamp((d - this.controls.minDistance) / span, 0, 1);
  }

  /** Linear blend helper exposed for consumers. */
  static blend(a: number, b: number, t: number): number {
    return lerp(a, b, t);
  }
}
