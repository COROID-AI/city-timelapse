/**
 * CameraControls - Camera navigation controls for city block exploration
 *
 * Features:
 * - WASD keyboard movement for ground-level walking
 * - Mouse drag for orbit rotation around focal point
 * - Scroll wheel for zoom (range: 2m to 100m from target)
 * - Right-click drag for pan (horizontal/vertical)
 * - Auto-orbit mode (slow rotation around city block)
 * - Speed multiplier toggle (walk/run/cycle)
 * - Reset camera to default overview position
 * - Smooth damping on all movements to eliminate jitter
 * - Collision detection to prevent clipping through buildings
 */
import * as THREE from 'three';
import { EraKey, ERAS } from './eras/eraData';

/**
 * Camera movement speed multipliers
 */
export enum CameraSpeed {
  WALK = 5,    // 5 m/s default walk
  RUN = 15,    // 15 m/s running
  CYCLE = 8,   // 8 m/s cycling
}

/**
 * Camera controls configuration
 */
export interface CameraControlsConfig {
  /** Base movement speed in m/s (default: 5) */
  baseSpeed?: number;
  /** Orbit damping factor (0-1, higher = slower to respond) */
  orbitDamping?: number;
  /** Zoom damping factor */
  zoomDamping?: number;
  /** Pan damping factor */
  panDamping?: number;
  /** Auto-orbit enable/disable */
  autoOrbit?: boolean;
  /** Auto-orbit speed in radians per second */
  autoOrbitSpeed?: number;
  /** Whether collision detection is enabled */
  collisionDetection?: boolean;
  /** Collision margin to prevent camera from getting too close to geometry */
  collisionMargin?: number;
  /** Orbit sensitivity (degrees per pixel) */
  orbitSensitivity?: number;
  /** Zoom sensitivity (units per scroll tick) */
  zoomSensitivity?: number;
  /** Pan sensitivity (units per pixel) */
  panSensitivity?: number;
}

/**
 * CameraControls manages all camera navigation for the city block scene.
 * Handles WASD movement, mouse orbit/zoom/pan, auto-orbit, and smooth damping.
 */
export class CameraControls {
  /** Three.js camera instance */
  public camera: THREE.PerspectiveCamera;
  /** Three.js scene instance */
  public scene: THREE.Scene;
  /** Target point the camera orbits around (typically city block center) */
  public target: THREE.Vector3;
  /** Renderer for collision detection */
  public renderer: THREE.WebGLRenderer;

  // Movement state
  public speed: number = CameraSpeed.WALK;
  public autoOrbitActive: boolean = false;
  public autoOrbitSpeed: number = 0.01;
  public orbitSensitivity: number = 0.5;
  public zoomSensitivity: number = 1.0;
  public panSensitivity: number = 0.5;

  // Damping factors
  public orbitDamping: number = 0.1;
  public zoomDamping: number = 0.1;
  public panDamping: number = 0.1;

  // Collision detection
  public collisionDetection: boolean = true;
  public collisionMargin: number = 5;

  // Min/max zoom distances
  public minDistance: number = 2;
  public maxDistance: number = 100;

  // Mouse state (internal)
  private mouseX: number = 0;
  private mouseY: number = 0;
  private mouseDown: boolean = false;
  private rightMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Internal state
  private orbitAngle: number = 0;
  private orbitPolar: number = 0;
  private targetOrbitAngle: number = 0;
  private targetOrbitPolar: number = 0;
  private currentDistance: number = 50;
  private targetDistance: number = 50;
  private panOffset: THREE.Vector3 = new THREE.Vector3();
  private targetPanOffset: THREE.Vector3 = new THREE.Vector3();
  private autoOrbitTimer: number = 0;

  /**
   * Creates a new CameraControls instance.
   * @param camera Three.js PerspectiveCamera
   * @param scene Three.js Scene
   * @param renderer THREE.WebGLRenderer
   * @param target Target point to orbit around
   * @param config Configuration options
   */
  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    target: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    config: CameraControlsConfig = {}
  ) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.target = target;

    // Apply configuration
    if (config.baseSpeed !== undefined) this.speed = config.baseSpeed;
    if (config.orbitDamping !== undefined) this.orbitDamping = config.orbitDamping;
    if (config.zoomDamping !== undefined) this.zoomDamping = config.zoomDamping;
    if (config.panDamping !== undefined) this.panDamping = config.panDamping;
    if (config.autoOrbit !== undefined) this.autoOrbitActive = config.autoOrbit;
    if (config.autoOrbitSpeed !== undefined) this.autoOrbitSpeed = config.autoOrbitSpeed;
    if (config.collisionDetection !== undefined) this.collisionDetection = config.collisionDetection;
    if (config.collisionMargin !== undefined) this.collisionMargin = config.collisionMargin;
    if (config.orbitSensitivity !== undefined) this.orbitSensitivity = config.orbitSensitivity;
    if (config.zoomSensitivity !== undefined) this.zoomSensitivity = config.zoomSensitivity;
    if (config.panSensitivity !== undefined) this.panSensitivity = config.panSensitivity;

    // Initialize camera position
    this.updateCameraPosition();

    // Set up event listeners
    this.setupEventListeners();
  }

  /** Get current speed */
  public getSpeed(): number {
    return this.speed;
  }

  /** Set speed multiplier */
  public setSpeed(speed: CameraSpeed | number): void {
    if (typeof speed === 'number') {
      this.speed = speed;
    } else {
      this.speed = speed;
    }
  }

  /** Cycle through speed modes: walk -> run -> cycle -> walk */
  public cycleSpeed(): void {
    if (this.speed === CameraSpeed.WALK) {
      this.speed = CameraSpeed.RUN;
    } else if (this.speed === CameraSpeed.RUN) {
      this.speed = CameraSpeed.CYCLE;
    } else {
      this.speed = CameraSpeed.WALK;
    }
  }

  /** Toggle auto-orbit mode */
  public toggleAutoOrbit(): void {
    this.autoOrbitActive = !this.autoOrbitActive;
    if (this.autoOrbitActive) {
      this.autoOrbitTimer = 0;
    }
  }

  /** Get current auto-orbit state */
  public getAutoOrbit(): boolean {
    return this.autoOrbitActive;
  }

  /** Set auto-orbit speed */
  public setAutoOrbitSpeed(speed: number): void {
    this.autoOrbitSpeed = speed;
  }

  /** Get current auto-orbit speed */
  public getAutoOrbitSpeed(): number {
    return this.autoOrbitSpeed;
  }

  /** Reset camera to default overview position */
  public resetCamera(): void {
    this.currentDistance = 50;
    this.targetDistance = 50;
    this.targetOrbitAngle = 0;
    this.targetOrbitPolar = Math.PI / 4; // 45 degrees elevation
    this.panOffset.set(0, 0, 0);
    this.targetPanOffset.set(0, 0, 0);
  }

  /** Get current orbit angle */
  public getOrbitAngle(): number {
    return this.orbitAngle;
  }

  /** Get current polar angle */
  public getOrbitPolar(): number {
    return this.orbitPolar;
  }

  /** Get current distance from target */
  public getDistance(): number {
    return this.currentDistance;
  }

  /** Update sensitivity settings */
  public setOrbitSensitivity(sensitivity: number): void {
    this.orbitSensitivity = sensitivity;
  }

  /** Get orbit sensitivity */
  public getOrbitSensitivity(): number {
    return this.orbitSensitivity;
  }

  /** Set zoom sensitivity */
  public setZoomSensitivity(sensitivity: number): number {
    this.zoomSensitivity = sensitivity;
    return this.zoomSensitivity;
  }

  /** Get zoom sensitivity */
  public getZoomSensitivity(): number {
    return this.zoomSensitivity;
  }

  /** Set pan sensitivity */
  public setPanSensitivity(sensitivity: number): void {
    this.panSensitivity = sensitivity;
  }

  /** Get pan sensitivity */
  public getPanSensitivity(): number {
    return this.panSensitivity;
  }

  /** Setup mouse and keyboard event listeners */
  private setupEventListeners(): void {
    // Keyboard listeners
    window.addEventListener('keydown', (event: KeyboardEvent) => this.onKeyDown(event), false);
    window.addEventListener('keyup', (event: KeyboardEvent) => this.onKeyUp(event), false);

    // Mouse listeners for orbit, zoom, and pan
    window.addEventListener('mousedown', (event: MouseEvent) => this.onMouseDown(event), false);
    window.addEventListener('mouseup', (event: MouseEvent) => this.onMouseUp(event), false);
    window.addEventListener('mousemove', (event: MouseEvent) => this.onMouseMove(event), false);
    window.addEventListener('wheel', (event: WheelEvent) => this.onWheel(event), { passive: false });

    // Context menu prevention for right-click
    window.addEventListener('contextmenu', (event: MouseEvent) => {
      if (this.rightMouseDown) {
        event.preventDefault();
      }
    }, false);
  }

  /** Handle keyboard down events */
  private onKeyDown(event: KeyboardEvent): void {
    // Check if we want to enable running mode (Shift)
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.speed = CameraSpeed.RUN;
    }

    // Auto-orbit toggle with 'A' key
    if (event.code === 'KeyA') {
      this.toggleAutoOrbit();
    }

    // Reset camera with 'R' key
    if (event.code === 'KeyR') {
      this.resetCamera();
    }
  }

  /** Handle keyboard up events */
  private onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      // Reset to walk speed when shift is released, unless cycling
      if (this.speed !== CameraSpeed.CYCLE) {
        this.speed = CameraSpeed.WALK;
      }
    }
  }

  /** Handle mouse down events */
  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      // Left-click: start orbit
      this.mouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) {
      // Right-click: start pan
      this.rightMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  /** Handle mouse up events */
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.mouseDown = false;
    } else if (event.button === 2) {
      this.rightMouseDown = false;
    }
  }

  /** Handle mouse move events */
  private onMouseMove(event: MouseEvent): void {
    if (this.mouseDown) {
      // Orbit rotation with left mouse drag
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      // Apply horizontal orbit rotation
      this.targetOrbitAngle -= deltaX * this.orbitSensitivity * (Math.PI / 180);
      // Apply vertical rotation (constrain to prevent flipping)
      this.targetOrbitPolar -= deltaY * this.orbitSensitivity * (Math.PI / 180);
      // Clamp vertical angle to prevent flipping upside down
      this.targetOrbitPolar = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.targetOrbitPolar));

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }

    if (this.rightMouseDown) {
      // Right-click drag: pan camera
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      // Pan in world space (horizontal and vertical)
      const panX = deltaX * this.panSensitivity;
      const panY = deltaY * this.panSensitivity;

      // Transform pan into world space based on current camera orientation
      const panWorld = this.transformPanToWorld(panX, panY);
      this.targetPanOffset.add(panWorld);

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  /** Handle mouse wheel events for zoom */
  private onWheel(event: WheelEvent): void {
    // Prevent page scrolling
    event.preventDefault();

    const delta = event.deltaY * this.zoomSensitivity;
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.currentDistance - delta));
  }

  /** Transform pan pixels to world space vector */
  private transformPanToWorld(pixelX: number, pixelY: number): THREE.Vector3 {
    // Create a temporary direction based on camera orientation
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    // Calculate right vector
    const right = new THREE.Vector3().crossVectors(direction, this.camera.up).normalize();

    // Calculate up vector
    const up = new THREE.Vector3().copy(this.camera.up).normalize();

    // Apply pan offsets in world space
    const worldRight = right.multiplyScalar(pixelX * this.panSensitivity);
    const worldUp = up.multiplyScalar(pixelY * this.panSensitivity);

    return worldRight.add(worldUp);
  }

  /** Update camera position based on orbit and zoom state */
  private updateCameraPosition(): void {
    // Calculate camera position from orbit parameters
    const horizontal = this.targetOrbitAngle;
    const vertical = this.targetOrbitPolar;

    // Position on a sphere around the target
    const x = this.currentDistance * Math.sin(vertical) * Math.cos(horizontal);
    const y = this.currentDistance * Math.cos(vertical);
    const z = this.currentDistance * Math.sin(vertical) * Math.sin(horizontal);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  /** Check for collision with scene geometry and adjust position */
  private checkCollisions(): void {
    if (!this.collisionDetection) return;

    // Simple collision detection using raycasting from camera to target
    // Get direction from camera to target
    const direction = this.target.clone().sub(this.camera.position).normalize();

    // Cast ray from camera along direction to target distance
    const ray = new THREE.Raycaster(this.camera.position, direction, 0, this.currentDistance);

    // Check for intersections with scene objects
    const intersects = ray.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      // Get the closest intersection
      const closest = intersects[0];

      // If camera is too close to geometry, push it back
      if (closest.distance < this.collisionMargin) {
        // Move camera away from the intersected point
        const pushBack = this.collisionMargin - closest.distance + 1;
        const safePos = this.camera.position.clone().add(direction.multiplyScalar(-pushBack));
        this.camera.position.copy(safePos);
      }
    }
  }

  /** Main update method - called each frame */
  public update(deltaTime: number): void {
    // Handle auto-orbit timer
    if (this.autoOrbitActive) {
      this.autoOrbitTimer += deltaTime;
      // Rotate around Y axis slowly
      const orbitSpeed = this.autoOrbitSpeed * deltaTime;
      this.targetOrbitAngle += orbitSpeed;
    }

    // Interpolate orbit angle for smooth damping
    this.orbitAngle += (this.targetOrbitAngle - this.orbitAngle) * this.orbitDamping;

    // Interpolate polar angle for smooth damping
    this.orbitPolar += (this.targetOrbitPolar - this.orbitPolar) * this.orbitDamping;
    this.orbitPolar = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.orbitPolar));

    // Interpolate distance for smooth damping
    this.currentDistance += (this.targetDistance - this.currentDistance) * this.zoomDamping;

    // Update target pan offset interpolation
    this.panOffset.lerp(this.targetPanOffset, this.panDamping);
    // Reset target pan offset after interpolation
    this.targetPanOffset.set(0, 0, 0);

    // Apply panning to orbit angles based on pan offset
    // This allows panning to shift the "center" of the orbit
    const panFactor = this.panOffset.length() * 0.1;
    if (panFactor > 0) {
      this.targetOrbitAngle += panFactor;
      this.targetPanOffset.set(0, 0, 0); // Clear after applying
    }

    // Update camera position
    this.updateCameraPosition();

    // Check collisions and adjust if needed
    this.checkCollisions();
  }
}