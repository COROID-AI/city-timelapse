// ============================================================
//  Camera Controller — orbit + pan + zoom with touch support
//  Lightweight custom controls (no external dependency).
// ============================================================
import * as THREE from 'three';
import { clamp, damp } from './util.js';

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    // Spherical coords
    this.target = new THREE.Vector3(0, 6, 0);
    this.radius = 55;
    this.theta = Math.PI * 0.25;   // azimuth
    this.phi = Math.PI * 0.34;     // polar (from Y)
    this.minRadius = 12;
    this.maxRadius = 130;
    this.minPhi = 0.08;
    this.maxPhi = Math.PI * 0.49;

    // Damped (current) values
    this._theta = this.theta;
    this._phi = this.phi;
    this._radius = this.radius;
    this._target = this.target.clone();

    this.autoRotate = false;
    this.autoRotateSpeed = 0.15;
    this.enabled = true;

    // pointer state
    this.pointers = new Map();
    this.mode = null; // 'rotate' | 'pan'
    this.lastX = 0; this.lastY = 0;
    this.pinchDist = 0;

    this._bind();
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => this._onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._onUp(e));
    window.addEventListener('pointercancel', (e) => this._onUp(e));
    el.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onDown(e) {
    if (!this.enabled) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.mode = e.button === 2 ? 'pan' : 'rotate';
      this.lastX = e.clientX; this.lastY = e.clientY;
    } else if (this.pointers.size === 2) {
      this.mode = 'pinch';
      const pts = [...this.pointers.values()];
      this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    this.dom.setPointerCapture && this.dom.setPointerCapture(e.pointerId);
  }

  _onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.mode === 'rotate' && this.pointers.size === 1) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.theta -= dx * 0.005;
      this.phi -= dy * 0.005;
      this.phi = clamp(this.phi, this.minPhi, this.maxPhi);
      this.lastX = e.clientX; this.lastY = e.clientY;
    } else if (this.mode === 'pan' && this.pointers.size === 1) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this._pan(dx, dy);
      this.lastX = e.clientX; this.lastY = e.clientY;
    } else if (this.mode === 'pinch' && this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const delta = d - this.pinchDist;
      this.radius = clamp(this.radius - delta * 0.05, this.minRadius, this.maxRadius);
      this.pinchDist = d;
    }
  }

  _onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.mode = null;
    if (this.pointers.size === 1) {
      const p = [...this.pointers.values()][0];
      this.lastX = p.x; this.lastY = p.y;
      this.mode = 'rotate';
    }
  }

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.radius = clamp(this.radius * factor, this.minRadius, this.maxRadius);
  }

  _pan(dx, dy) {
    const offset = new THREE.Vector3().subVectors(this._cameraPos(), this._target);
    const dist = offset.length();
    const panX = new THREE.Vector3();
    const panY = new THREE.Vector3();
    // build local right/up axes from current camera orientation
    const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    panX.copy(xAxis).multiplyScalar(-(dx * dist * 0.0015));
    panY.copy(yAxis).multiplyScalar(dy * dist * 0.0015);
    this.target.add(panX).add(panY);
    // clamp target to reasonable area
    this.target.x = clamp(this.target.x, -40, 40);
    this.target.z = clamp(this.target.z, -40, 40);
    this.target.y = clamp(this.target.y, -2, 40);
  }

  _cameraPos() {
    const sinPhi = Math.sin(this.phi);
    return new THREE.Vector3(
      this._target.x + this._radius * sinPhi * Math.sin(this._theta),
      this._target.y + this._radius * Math.cos(this.phi),
      this._target.z + this._radius * sinPhi * Math.cos(this._theta)
    );
  }

  reset() {
    this.target.set(0, 6, 0);
    this.theta = Math.PI * 0.25;
    this.phi = Math.PI * 0.34;
    this.radius = 55;
  }

  update(dt) {
    if (this.autoRotate) {
      this.theta += this.autoRotateSpeed * dt;
    }
    // damp spherical + target
    this._theta = damp(this._theta, this.theta, 8, dt);
    this._phi = damp(this._phi, this.phi, 8, dt);
    this._radius = damp(this._radius, this.radius, 8, dt);
    this._target.x = damp(this._target.x, this.target.x, 8, dt);
    this._target.y = damp(this._target.y, this.target.y, 8, dt);
    this._target.z = damp(this._target.z, this.target.z, 8, dt);

    const sinPhi = Math.sin(this._phi);
    const pos = new THREE.Vector3(
      this._target.x + this._radius * sinPhi * Math.sin(this._theta),
      this._target.y + this._radius * Math.cos(this._phi),
      this._target.z + this._radius * sinPhi * Math.cos(this._theta)
    );
    this.camera.position.copy(pos);
    this.camera.lookAt(this._target);
  }
}
