import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Bounded OrbitControls wrapper. Supports pointer, touch, and keyboard.
 * Provides a deterministic reset-camera action.
 */
export class CameraController {
  readonly controls: OrbitControls;
  private readonly defaultPos: THREE.Vector3;
  private readonly defaultTarget: THREE.Vector3;
  private isAnimatingTo = false;
  private flyFrom = new THREE.Vector3();
  private flyTargetPos = new THREE.Vector3();
  private flyTargetLook = new THREE.Vector3();
  private flyElapsed = 0;
  private flyDuration = 1;
  private reducedMotion: boolean;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    target: THREE.Vector3,
    reducedMotion: boolean
  ) {
    this.reducedMotion = reducedMotion;
    this.defaultTarget = target.clone();
    this.defaultPos = new THREE.Vector3(28, 18, 28);

    camera.position.copy(this.defaultPos);
    camera.lookAt(target);

    this.controls = new OrbitControls(camera, domElement);
    this.controls.target.copy(target);

    // Bounds.
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 70;
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(12);
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;

    // Keyboard support (pan with arrows).
    this.controls.listenToKeyEvents(window);
    this.controls.keyPanSpeed = 7;

    this.controls.update();
  }

  /** Per-frame update (call every frame for damping). */
  update(dt: number): void {
    if (this.isAnimatingTo) {
      this.flyElapsed += dt;
      const raw = this.flyDuration > 0 ? this.flyElapsed / this.flyDuration : 1;
      const t = raw >= 1 ? 1 : easeInOutCubic(raw);
      this.controls.object.position.lerpVectors(this.flyFrom, this.flyTargetPos, t);
      this.controls.target.lerp(this.flyTargetLook, 0.12);
      if (raw >= 1) {
        this.isAnimatingTo = false;
      }
    }
    this.controls.update();
    // Clamp pan target so users can't lose the scene.
    const tg = this.controls.target;
    tg.x = THREE.MathUtils.clamp(tg.x, -20, 20);
    tg.z = THREE.MathUtils.clamp(tg.z, -20, 20);
    tg.y = THREE.MathUtils.clamp(tg.y, 0, 12);
  }

  /** Smoothly reset the camera to the default view. */
  resetCamera(): void {
    if (this.reducedMotion) {
      this.controls.object.position.copy(this.defaultPos);
      this.controls.target.copy(this.defaultTarget);
      this.controls.update();
      return;
    }
    this.flyFrom.copy(this.controls.object.position);
    this.flyTargetPos.copy(this.defaultPos);
    this.flyTargetLook.copy(this.defaultTarget);
    this.flyElapsed = 0;
    this.flyDuration = 0.9;
    this.isAnimatingTo = true;
  }

  dispose(): void {
    this.controls.dispose();
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
