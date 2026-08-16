/**
 * Camera rig factory stub.
 *
 * Provides an orbit-controlled camera wrapper with era-aware presets
 * (e.g. lower angle for 1945, higher for 2025). The concrete implementation
 * will use OrbitControls or a custom damped camera system.
 */

import * as THREE from 'three';
import type { EraId } from '../eras.js';

export interface CameraRigOptions {
  /** Initial FOV in degrees. */
  fov?: number;
  /** Whether to enable mouse interaction. */
  interactive?: boolean;
}

export interface CameraRig {
  /** The THREE.PerspectiveCamera managed by this rig. */
  readonly camera: THREE.PerspectiveCamera;
  /** Set the camera position/lookAt to an era-specific preset. */
  applyPreset(era: EraId): void;
  /** Update internal matrices / damping each frame. */
  update(deltaTime: number): void;
  /** Dispose underlying resources. */
  dispose(): void;
}

/**
 * Factory function for creating a CameraRig instance.
 * Currently returns a basic perspective camera rig with minimal logic.
 */
export function createCameraRig(options: CameraRigOptions = {}): CameraRig {
  const fov = options.fov ?? 60;
  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(30, 20, 30);
  camera.lookAt(0, 5, 0);

  const presets: Record<EraId, { pos: [number, number, number]; target: [number, number, number] }> = {
    '1945': { pos: [25, 15, 25], target: [0, 3, 0] },
    '1965': { pos: [30, 18, 30], target: [0, 5, 0] },
    '1985': { pos: [35, 22, 35], target: [0, 8, 0] },
    '2005': { pos: [40, 25, 40], target: [0, 10, 0] },
    '2025': { pos: [45, 30, 45], target: [0, 15, 0] },
  };

  return {
    get camera() {
      return camera;
    },
    applyPreset(era: EraId) {
      const p = presets[era];
      if (!p) return;
      camera.position.set(...p.pos);
      camera.lookAt(...p.target);
    },
    update(_deltaTime: number) {
      // Stub: apply damping or interpolation here
    },
    dispose() {
      // Camera resources freed when scene is disposed
    },
  };
}
