import type * as THREE from 'three'
import type { CameraMode } from './camera-rig'

/**
 * Shared registration contracts for the scene shell.
 *
 * Later milestones (buildings, vehicles, pedestrians, storefronts, audio)
 * add content by implementing these hooks instead of editing the core loop.
 * The shell owns the primary `THREE.Scene`; modules own their own `Group`
 * and mutate it freely.
 */

export interface SceneModule {
  /** Root object; attach it to the scene (or leave it out of the tree). */
  readonly group: THREE.Group
  /** Called every frame with the clamped frame delta in seconds. */
  update?(deltaSeconds: number): void
  /** Called when the camera control mode changes. */
  onCameraModeChange?(mode: CameraMode): void
  /** Called when the user selects a different era index. */
  onEraChange?(eraIndex: number): void
  /** Release GPU resources and detach listeners. */
  dispose(): void
}

export interface SceneShellCallbacks {
  /** Fired once after the first render completes (browser smoke tests). */
  onFirstRender?: () => void
}

export interface SceneContext {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  /** Set/read the transient camera mode. */
  cameraMode: CameraMode
}