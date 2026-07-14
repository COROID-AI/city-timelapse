import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Wraps OrbitControls with smooth damping and keyboard nudge navigation.
export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 12, 0);

    this.keys = { left: false, right: false, up: false, down: false };
    this.nudgeSpeed = 22;
    this.zoomSpeed = 16;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  onKey(e, down) {
    switch (e.key) {
      case 'ArrowLeft': this.keys.left = down; break;
      case 'ArrowRight': this.keys.right = down; break;
      case 'ArrowUp': this.keys.up = down; break;
      case 'ArrowDown': this.keys.down = down; break;
      default: break;
    }
  }

  update(dt) {
    // Arrow keys nudge the orbit target (pan/orbit by re-aiming the camera).
    const v = new THREE.Vector3();
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, this.camera.up).normalize();

    const sp = this.nudgeSpeed * dt;
    if (this.keys.left) v.addScaledVector(right, -sp);
    if (this.keys.right) v.addScaledVector(right, sp);
    if (this.keys.up) v.addScaledVector(forward, sp);
    if (this.keys.down) v.addScaledVector(forward, -sp);

    if (v.lengthSq() > 0) {
      this.controls.target.add(v);
      this.camera.position.add(v);
    }

    this.controls.update();
  }
}
