/**
 * src/core/CameraDirector.ts — cinematic era-to-era camera glides.
 *
 * When the user selects a new era the director performs a smooth, era-aware
 * glide (1.5–2.5s ease-in-out, driven by the SAME shared morph timeline that
 * the whole scene swaps on) from the current orbit position to a shared
 * standard viewpoint, so every transformation is framed from a consistent
 * place. The glide reads the foundation timeline's eased progress each frame,
 * so the camera arrives at the destination exactly when the morph completes.
 *
 * OrbitControls are frozen ONLY while the glide is active ("the director only
 * runs during era transitions"); the instant the timeline reports the morph is
 * finished the director snaps to the standard endpoint, re-enables
 * OrbitControls and steps out of the way — no further camera writes, so the
 * user's orbit and pan stay fully responsive again.
 */

import * as THREE from 'three';

import type { MorphEngine } from './MorphEngine';
import type { EraState } from '../state/EraState';

export interface CameraDirectorOptions {
  camera: THREE.PerspectiveCamera;
  /** OrbitControls the director hands control back to after the glide. */
  controls: { enabled: boolean; target: THREE.Vector3 };
  eraState: EraState;
  morphEngine: MorphEngine;
  /**
   * Shared standard viewpoint every era transition converges on. When omitted
   * the director uses the app's hero framing of the city block.
   */
  viewpoint?: {
    position?: THREE.Vector3;
    target?: THREE.Vector3;
  };
}

/** Default framing that reads the whole block transformation at a glance. */
const DEFAULT_VIEWPOINT = {
  position: new THREE.Vector3(12, 8, 16),
  target: new THREE.Vector3(0, 2, 0),
};

export class CameraDirector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: { enabled: boolean; target: THREE.Vector3 };
  private readonly morphEngine: MorphEngine;
  private readonly endPosition: THREE.Vector3;
  private readonly endTarget: THREE.Vector3;
  private readonly startPosition = new THREE.Vector3();
  private readonly startTarget = new THREE.Vector3();
  private active = false;
  private readonly unsubscribe: () => void;

  constructor(options: CameraDirectorOptions) {
    this.camera = options.camera;
    this.controls = options.controls;
    this.morphEngine = options.morphEngine;
    this.endPosition = options.viewpoint?.position?.clone() ?? DEFAULT_VIEWPOINT.position.clone();
    this.endTarget = options.viewpoint?.target?.clone() ?? DEFAULT_VIEWPOINT.target.clone();

    // Any era change (slider, keyboard, later programmatic) starts a glide.
    this.unsubscribe = options.eraState.subscribe(() => {
      this.startGlide();
    });
  }

  /** Whether the director currently owns the camera (OrbitControls frozen). */
  get isGliding(): boolean {
    return this.active;
  }

  /**
   * Advance the glide. Call from the render loop right after the morph engine's
   * `update(dt)` so `timelineState` reflects the current frame's progress.
   */
  update(): void {
    if (!this.active) {
      return;
    }
    const state = this.morphEngine.timelineState;
    if (!state.active) {
      // Timeline finished (morph complete) — snap to the shared viewpoint and
      // hand control back to OrbitControls.
      this.finish();
      return;
    }
    const t = state.progress;
    this.camera.position.lerpVectors(this.startPosition, this.endPosition, t);
    this.controls.target.lerpVectors(this.startTarget, this.endTarget, t);
  }

  dispose(): void {
    this.unsubscribe();
    this.active = false;
    this.controls.enabled = true;
  }

  private startGlide(): void {
    this.active = true;
    this.controls.enabled = false;
    // Capture the orbit start exactly where the user left the camera, so the
    // glide departs smoothly from their current framing.
    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
  }

  private finish(): void {
    this.camera.position.copy(this.endPosition);
    this.controls.target.copy(this.endTarget);
    this.active = false;
    this.controls.enabled = true;
  }
}