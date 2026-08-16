import * as THREE from 'three';

/**
 * Orbit-style free navigation using a virtual trackball approach.
 * Supports rotate (left-drag), pan (right-drag), zoom (scroll).
 */
export class Controls {
  private _target = new THREE.Vector3(0, 0, 0);
  private spherical = new THREE.Spherical().setFromVector3(
    new THREE.Vector3(30, 20, 30),
  );
  private isRotating = false;
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };

  private readonly _sphericalDelta = new THREE.Spherical();
  private readonly _panOffset = new THREE.Vector3();
  private readonly _scale = 1;

  private readonly domElement: HTMLElement;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    domElement.addEventListener('mousedown', this._onMouseDown.bind(this));
    domElement.addEventListener('mousemove', this._onMouseMove.bind(this));
    domElement.addEventListener('mouseup', this._onMouseUp.bind(this));
    domElement.addEventListener('wheel', this._onWheel.bind(this), {
      passive: false,
    });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support
    domElement.addEventListener('touchstart', this._onTouchStart.bind(this), {
      passive: false,
    });
    domElement.addEventListener('touchmove', this._onTouchMove.bind(this), {
      passive: false,
    });
    domElement.addEventListener('touchend', this._onTouchEnd.bind(this));
  }

  // ── Mouse handlers ────────────────────────────────────────────────

  private _onMouseDown(e: MouseEvent): void {
    if (e.button === 0) this.isRotating = true;
    else if (e.button === 2) this.isPanning = true;
    this.lastMouse.x = e.clientX;
    this.lastMouse.y = e.clientY;
  }

  private _onMouseMove(e: MouseEvent): void {
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.lastMouse.x = e.clientX;
    this.lastMouse.y = e.clientY;

    if (this.isRotating) {
      this._sphericalDelta.theta -= (2 * Math.PI * dx) / this.domElement.clientHeight;
      this._sphericalDelta.phi -= (2 * Math.PI * dy) / this.domElement.clientHeight;
    }

    if (this.isPanning) {
      const dist = this.spherical.radius;
      const factor = 0.002 * dist;
      const panLeft = new THREE.Vector3();
      const panUp = new THREE.Vector3();
      panLeft.setFromMatrixColumn(this.camera.matrix, 0);
      panLeft.multiplyScalar(-2 * factor * dx);
      panUp.setFromMatrixColumn(this.camera.matrix, 1);
      panUp.multiplyScalar(2 * factor * dy);
      this._panOffset.add(panLeft).add(panUp);
    }
  }

  private _onMouseUp(): void {
    this.isRotating = false;
    this.isPanning = false;
  }

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY > 0) {
      this.spherical.radius *= 1.1;
    } else {
      this.spherical.radius /= 1.1;
    }
    this.spherical.radius = Math.max(5, Math.min(200, this.spherical.radius));
  }

  // ── Touch handlers ────────────────────────────────────────────────

  private _touchStartDist = 0;

  private _onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isRotating = true;
      this.lastMouse.x = e.touches[0].clientX;
      this.lastMouse.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.isRotating = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this._touchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1 && this.isRotating) {
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.lastMouse.x = e.touches[0].clientX;
      this.lastMouse.y = e.touches[0].clientY;
      this._sphericalDelta.theta -= (2 * Math.PI * dx) / this.domElement.clientHeight;
      this._sphericalDelta.phi -= (2 * Math.PI * dy) / this.domElement.clientHeight;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = this._touchStartDist / dist;
      this.spherical.radius *= scale;
      this.spherical.radius = Math.max(5, Math.min(200, this.spherical.radius));
      this._touchStartDist = dist;
    }
  }

  private _onTouchEnd(): void {
    this.isRotating = false;
  }

  // ── Update loop (call each frame) ─────────────────────────────────

  update(): void {
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this._target);

    this.spherical.setFromVector3(offset);
    this.spherical.theta += this._sphericalDelta.theta;
    this.spherical.phi += this._sphericalDelta.phi;
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, this.spherical.phi));
    this.spherical.radius += this._scale;
    this.spherical.radius = Math.max(5, Math.min(200, this.spherical.radius));

    this._target.add(this._panOffset);

    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this._target).add(offset);
    this.camera.lookAt(this._target);

    // Decay deltas
    this._sphericalDelta.theta *= 0.85;
    this._sphericalDelta.phi *= 0.85;
    this._panOffset.multiplyScalar(0.85);
  }

  reset(position?: THREE.Vector3, target?: THREE.Vector3): void {
    if (position) this.camera.position.copy(position);
    if (target) this._target.copy(target);
    this._sphericalDelta.set(0, 0, 0);
    this._panOffset.set(0, 0, 0);
  }
}
