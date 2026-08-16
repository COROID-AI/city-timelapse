import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Walk-mode state ────────────────────────────────────────────────
interface WalkState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  yaw: number;       // radians (horizontal)
  pitch: number;     // radians (vertical)
}

/**
 * Camera controller supporting two modes:
 *  - Orbit: rotate / pan / zoom around a target
 *  - Walk:  WASD movement + pointer-look, clamped inside block bounds
 *
 * Toggle between modes by pressing **Tab**.
 */
export class SceneControls {
  private _orbit: OrbitControls;
  private _walk: WalkState;
  private _mode: 'orbit' | 'walk' = 'orbit';
  private _blockBounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  /** Speed in world units per second for walk mode. */
  walkSpeed = 6;
  sprintMultiplier = 1.8;
  lookSensitivity = 0.002;

  /** Minimum orbit distance from target. */
  minDistance = 4;
  /** Maximum orbit distance from target. */
  maxDistance = 60;
  /** Orbit vertical angle limits (radians). */
  minPolarAngle = 0.1;
  maxPolarAngle = Math.PI / 2.15;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    blockBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ) {
    this._blockBounds = blockBounds;

    // ── Orbit controls ──────────────────────────────────────────
    this._orbit = new OrbitControls(camera, domElement);
    this._orbit.enableDamping = true;
    this._orbit.dampingFactor = 0.08;
    this._orbit.minDistance = this.minDistance;
    this._orbit.maxDistance = this.maxDistance;
    this._orbit.minPolarAngle = this.minPolarAngle;
    this._orbit.maxPolarAngle = this.maxPolarAngle;
    this._orbit.target.set(0, 2, 0);
    this._orbit.update();

    // ── Walk controls init ──────────────────────────────────────
    this._walk = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      yaw: 0,
      pitch: 0,
    };

    // Start camera at a sensible position for both modes
    camera.position.set(12, 6, 12);

    this._setupKeyboard(camera);
    this._setupPointerLock();
  }

  // ── Keyboard ────────────────────────────────────────────────────
  private _setupKeyboard(camera: THREE.PerspectiveCamera): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleMode(camera);
        return;
      }
      switch (e.code) {
        case 'KeyW': this._walk.forward = true; break;
        case 'KeyS': this._walk.backward = true; break;
        case 'KeyA': this._walk.left = true; break;
        case 'KeyD': this._walk.right = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this._walk.sprint = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this._walk.forward = false; break;
        case 'KeyS': this._walk.backward = false; break;
        case 'KeyA': this._walk.left = false; break;
        case 'KeyD': this._walk.right = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this._walk.sprint = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  // ── Pointer lock for walk mode ──────────────────────────────────
  private _setupPointerLock(): void {
    const onMove = (e: MouseEvent) => {
      if (this._mode !== 'walk') return;
      this._walk.yaw -= e.movementX * this.lookSensitivity;
      this._walk.pitch -= e.movementY * this.lookSensitivity;
      this._walk.pitch = Math.max(-Math.PI / 2.15, Math.min(Math.PI / 2.15, this._walk.pitch));
    };
    document.addEventListener('mousemove', onMove);

    // Request pointer lock when entering walk mode and clicking
    const onClick = () => {
      if (this._mode === 'walk') {
        document.body.requestPointerLock();
      }
    };
    window.addEventListener('click', onClick);
  }

  // ── Mode toggle ─────────────────────────────────────────────────
  toggleMode(camera: THREE.PerspectiveCamera): void {
    if (this._mode === 'orbit') {
      this._mode = 'walk';
      this._orbit.enabled = false;
      // Preserve camera height, set yaw/pitch from current orientation
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      this._walk.yaw = Math.atan2(-dir.x, -dir.z);
      this._walk.pitch = Math.asin(dir.y);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } else {
      this._mode = 'orbit';
      this._orbit.enabled = true;
      this._orbit.target.copy(camera.position).add(
        new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).multiplyScalar(-1),
      );
      this._orbit.update();
    }
  }

  /** Update camera based on current mode. Call every frame. */
  update(camera: THREE.PerspectiveCamera, dt: number): void {
    if (this._mode === 'orbit') {
      this._orbit.update();
    } else {
      this._updateWalk(camera, dt);
    }
  }

  private _updateWalk(camera: THREE.PerspectiveCamera, dt: number): void {
    const speed = this.walkSpeed * (this._walk.sprint ? this.sprintMultiplier : 1);
    const move = new THREE.Vector3();

    // Forward / backward along yaw plane
    const fwd = new THREE.Vector3(-Math.sin(this._walk.yaw), 0, -Math.cos(this._walk.yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

    if (this._walk.forward) move.add(fwd);
    if (this._walk.backward) move.sub(fwd);
    if (this._walk.right) move.add(right);
    if (this._walk.left) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      camera.position.add(move);
    }

    // Clamp inside block bounds (leave 1 unit margin)
    const margin = 1;
    camera.position.x = Math.max(
      this._blockBounds.minX + margin,
      Math.min(this._blockBounds.maxX - margin, camera.position.x),
    );
    camera.position.z = Math.max(
      this._blockBounds.minZ + margin,
      Math.min(this._blockBounds.maxZ - margin, camera.position.z),
    );
    // Keep camera above ground
    camera.position.y = Math.max(1.7, camera.position.y);

    // Apply rotation
    const euler = new THREE.Euler(this._walk.pitch, this._walk.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }

  get mode(): 'orbit' | 'walk' {
    return this._mode;
  }
}
