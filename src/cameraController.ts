import * as THREE from 'three';

interface CameraState {
  target: THREE.Vector3;
  distance: number;
  azimuth: number; // horizontal angle
  polar: number; // vertical angle (0 = up, PI/2 = horizon)
  panOffset: THREE.Vector3;
}

const MIN_DIST = 18;
const MAX_DIST = 120;
const MIN_POLAR = 0.2;
const MAX_POLAR = Math.PI / 2 - 0.05;

/**
 * Custom orbit camera with mouse drag-orbit, scroll-zoom, right-drag-pan,
 * and WASD movement. Bounds keep the view sensible.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private state: CameraState;
  private keys: Record<string, boolean> = {};
  private moveSpeed = 20;
  private enabled = true;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    this.state = {
      target: new THREE.Vector3(0, 6, 0),
      distance: 70,
      azimuth: Math.PI * 0.25,
      polar: Math.PI * 0.34,
      panOffset: new THREE.Vector3(0, 0, 0),
    };
    this.bind();
    this.apply();
  }

  private bind(): void {
    let dragging = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: MouseEvent) => {
      if (!this.enabled) return;
      if (e.button === 2 || e.shiftKey) panning = true;
      else if (e.button === 0) dragging = true;
      else return;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging && !panning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dragging) {
        this.state.azimuth -= dx * 0.005;
        this.state.polar = clamp(this.state.polar - dy * 0.005, MIN_POLAR, MAX_POLAR);
      } else if (panning) {
        // pan in the camera's right/up basis
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        const scale = this.state.distance * 0.0015;
        this.state.panOffset.addScaledVector(right, -dx * scale);
        this.state.panOffset.addScaledVector(up, dy * scale);
      }
    };
    const onUp = () => {
      dragging = false;
      panning = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (!this.enabled) return;
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this.state.distance = clamp(this.state.distance * factor, MIN_DIST, MAX_DIST);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    this.dom.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    this.dom.addEventListener('wheel', onWheel, { passive: false });
    this.dom.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.unbind = () => {
      this.dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.dom.removeEventListener('wheel', onWheel);
      this.dom.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  private unbind: () => void = () => {};

  public setEnabled(v: boolean): void {
    this.enabled = v;
  }

  /** Advance WASD movement and reapply the camera transform. Call each frame. */
  public update(dt: number): void {
    const fwd = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    if (fwd || strafe) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
      const move = new THREE.Vector3()
        .addScaledVector(forward, fwd * this.moveSpeed * dt)
        .addScaledVector(right, strafe * this.moveSpeed * dt);
      this.state.panOffset.add(move);
    }
    this.apply();
  }

  private apply(): void {
    const { target, distance, azimuth, polar, panOffset } = this.state;
    const sinP = Math.sin(polar);
    const x = distance * sinP * Math.sin(azimuth);
    const y = distance * Math.cos(polar);
    const z = distance * sinP * Math.cos(azimuth);
    const center = target.clone().add(panOffset);
    this.camera.position.set(center.x + x, center.y + y, center.z + z);
    this.camera.lookAt(center);
  }

  public dispose(): void {
    this.unbind();
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
