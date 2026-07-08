/**
 * First-Person Camera Controller for navigating the city block
 * Supports WASD movement and mouse look controls
 */

import * as THREE from 'three';

export interface CameraState {
  yaw: number;
  pitch: number;
  position: { x: number; y: number; z: number };
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private state: CameraState;
  private keys: Record<string, boolean> = {};
  private mouseSensitivity: number = 0.002;
  private moveSpeed: number = 0.15;
  private isLocked: boolean = false;
  private onLockChange?: (locked: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera, private canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.state = {
      yaw: 0,
      pitch: 0,
      position: { x: 0, y: 1.7, z: 25 }
    };
    this.camera.position.set(this.state.position.x, this.state.position.y, this.state.position.z);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Mouse look
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys[event.key.toLowerCase()] = true;
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys[event.key.toLowerCase()] = false;
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isLocked) return;
    
    this.state.yaw -= event.movementX * this.mouseSensitivity;
    this.state.pitch -= event.movementY * this.mouseSensitivity;
    
    // Clamp pitch to avoid gimbal lock
    this.state.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.state.pitch));
    
    this.updateCameraRotation();
  };

  private handleClick = async (): Promise<void> => {
    if (!this.isLocked) {
      await this.lockPointer();
    }
  };

  private updateCameraRotation(): void {
    this.camera.rotation.set(this.state.pitch, this.state.yaw, 0);
  }

  private async lockPointer(): Promise<void> {
    const requestPointerLock = this.canvas.requestPointerLock || 
                              (this.canvas as unknown as { mozRequestPointerLock: () => void }).mozRequestPointerLock ||
                              (this.canvas as unknown as { webkitRequestPointerLock: () => void }).webkitRequestPointerLock;
    
    if (requestPointerLock) {
      requestPointerLock.call(this.canvas);
    }
    
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mozpointerlockchange', this.handlePointerLockChange);
  }

  private handlePointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement === this.canvas;
    if (this.onLockChange) {
      this.onLockChange(this.isLocked);
    }
  };

  /**
   * Update camera position based on key input
   */
  update(deltaTime: number, bounds?: { min: THREE.Vector3; max: THREE.Vector3 }): void {
    const moveVector = new THREE.Vector3();
    
    // Calculate forward direction from yaw
    const forward = new THREE.Vector3(
      Math.sin(this.state.yaw),
      0,
      Math.cos(this.state.yaw)
    );
    
    const right = new THREE.Vector3(
      Math.sin(this.state.yaw + Math.PI / 2),
      0,
      Math.cos(this.state.yaw + Math.PI / 2)
    );
    
    if (this.keys['w']) moveVector.add(forward);
    if (this.keys['s']) moveVector.sub(forward);
    if (this.keys['a']) moveVector.sub(right);
    if (this.keys['d']) moveVector.add(right);
    if (this.keys[' ']) moveVector.y += 1;
    if (this.keys['c'] || this.keys['control']) moveVector.y -= 1;
    
    moveVector.normalize().multiplyScalar(this.moveSpeed * deltaTime * 60);
    
    // Apply movement with bounds checking
    const newPosition = this.camera.position.clone().add(moveVector);
    
    if (bounds) {
      newPosition.x = THREE.MathUtils.clamp(newPosition.x, bounds.min.x, bounds.max.x);
      newPosition.y = THREE.MathUtils.clamp(newPosition.y, bounds.min.y, bounds.max.y);
      newPosition.z = THREE.MathUtils.clamp(newPosition.z, bounds.min.z, bounds.max.z);
    }
    
    this.camera.position.copy(newPosition);
  }

  /**
   * Set callback for pointer lock changes
   */
  setLockChangeCallback(callback: (locked: boolean) => void): void {
    this.onLockChange = callback;
  }

  /**
   * Get camera for external access
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Smooth transition to new position (for era transitions)
   */
  transitionTo(position: { x: number; y: number; z: number }, duration: number = 1000): void {
    const start = this.camera.position.clone();
    const end = new THREE.Vector3(position.x, position.y, position.z);
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.cos(progress * Math.PI);
      
      this.camera.position.lerpVectors(start, end, ease);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}