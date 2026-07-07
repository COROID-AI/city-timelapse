import * as THREE from 'three';

/**
 * Camera controller interface for navigation around the scene
 */
export interface CameraController {
  update(): void;
  dispose(): void;
}

/**
 * Camera controller options
 */
export interface CameraControllerOptions {
  enabled?: boolean;
  speed?: number;
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Spherical coordinates for camera position
 */
interface SphericalPosition {
  radius: number;
  theta: number;
  phi: number;
}

/**
 * Creates an orbital camera controller for navigation around the scene
 * Uses pointer lock for smooth first-person style navigation
 */
export function createCameraController(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  options: CameraControllerOptions = {}
): CameraController {
  const {
    enabled = true,
    speed = 1.0,
    minDistance = 10,
    maxDistance = 500
  } = options;

  // Camera position in spherical coordinates
  const spherical: SphericalPosition = {
    radius: 150,
    theta: 0,
    phi: Math.PI / 4
  };

  // Target point to orbit around
  const target = new THREE.Vector3(0, 0, 0);

  // Mouse state for orbit controls
  let isMouseDown = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  // Movement state
  const movement = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  };

  // Event handlers
  const onMouseDown = (event: MouseEvent) => {
    if (!enabled) return;
    isMouseDown = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!enabled || !isMouseDown) return;
    const deltaX = event.clientX - prevMouseX;
    const deltaY = event.clientY - prevMouseY;

    spherical.theta -= deltaX * 0.005 * speed;
    spherical.phi -= deltaY * 0.005 * speed;

    // Clamp phi to avoid flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
  };

  const onMouseUp = () => {
    isMouseDown = false;
  };

  const onWheel = (event: WheelEvent) => {
    if (!enabled) return;
    spherical.radius += event.deltaY * 0.5 * speed;
    spherical.radius = Math.max(minDistance, Math.min(maxDistance, spherical.radius));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;
    switch (event.code) {
      case 'KeyW':
        movement.forward = true;
        break;
      case 'KeyS':
        movement.backward = true;
        break;
      case 'KeyA':
        movement.left = true;
        break;
      case 'KeyD':
        movement.right = true;
        break;
      case 'Space':
        movement.up = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        movement.down = true;
        break;
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        movement.forward = false;
        break;
      case 'KeyS':
        movement.backward = false;
        break;
      case 'KeyA':
        movement.left = false;
        break;
      case 'KeyD':
        movement.right = false;
        break;
      case 'Space':
        movement.up = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        movement.down = false;
        break;
    }
  };

  // Attach event listeners
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel', onWheel);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Prevent context menu on right click
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    update: () => {
      // Handle keyboard movement
      if (movement.forward) {
        // Create direction in XY plane based on camera angle
        const dirX = Math.sin(spherical.theta);
        const dirZ = Math.cos(spherical.theta);
        target.x += dirX * -2 * speed;
        target.z += dirZ * -2 * speed;
      }
      if (movement.backward) {
        const dirX = Math.sin(spherical.theta);
        const dirZ = Math.cos(spherical.theta);
        target.x += dirX * 2 * speed;
        target.z += dirZ * 2 * speed;
      }
      if (movement.left) {
        target.x -= 2 * speed;
      }
      if (movement.right) {
        target.x += 2 * speed;
      }
      if (movement.up) {
        target.y += 2 * speed;
      }
      if (movement.down) {
        target.y -= 2 * speed;
      }

      // Update camera position based on spherical coordinates
      const offset = new THREE.Vector3(
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        spherical.radius * Math.cos(spherical.phi),
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      );
      camera.position.copy(target.clone().add(offset));
      camera.lookAt(target);
    },

    dispose: () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };
}