import * as THREE from 'three';

// ── Category subgroup names ────────────────────────────────────────
export const CATEGORY = {
  buildings: 'buildings',
  vehicles: 'vehicles',
  signage: 'signage',
  pedestrians: 'pedestrians',
  props: 'props',
} as const;

export type CategoryKey = (typeof CATEGORY)[keyof typeof CATEGORY];

/**
 * EraContentModule — the sole mounting contract for era-specific content.
 *
 * Every era module must implement this interface. The EraStage
 * creates category subgroups, calls build() to populate them, and
 * manages mount/visibility/disposal per era.
 */
export interface EraContentModule {
  /** Stable identifier used by the timeline orchestrator. */
  id: string;

  /**
   * Build and return a THREE.Group whose children are organized into
   * named category subgroups under `.children` keyed by CATEGORY keys.
   *
   * The returned group must have these properties on its .children array:
   *   - buildings: THREE.Group | undefined
   *   - vehicles:  THREE.Group | undefined
   *   - signage:   THREE.Group | undefined
   *   - pedestrians: THREE.Group | undefined
   *   - props:     THREE.Group | undefined
   *
   * Each subgroup contains the era-appropriate meshes.
   */
  build(): THREE.Group;

  /**
   * Per-frame update called while this era is active.
   * @param dt    Delta time in seconds since last frame.
   * @param elapsed Elapsed wall-clock time in seconds since loop start.
   */
  update(dt: number, elapsed: number): void;

  /**
   * Called during era transitions to smoothly blend content.
   * @param p Progress from 0 (current era fading out) to 1 (target era fading in).
   */
  setTransitionProgress(p: number): void;

  /** Dispose all resources owned by this module. */
  dispose(): void;
}

/**
 * EraStage — manages per-era group mounting, visibility, and transition.
 *
 * Holds one EraContentModule at a time. When switching eras it:
 * 1. Calls `setTransitionProgress(0)` on the outgoing module.
 * 2. Disposes the outgoing module's group from the scene.
 * 3. Mounts the incoming module's group.
 * 4. Calls `update()` / `setTransitionProgress()` each frame.
 */
export class EraStage {
  private _scene: THREE.Scene;
  private _currentModule: EraContentModule | null = null;
  private _currentGroup: THREE.Group | null = null;
  private _transitionProgress = 1; // 1 = fully visible, 0 = invisible
  private _fadeDuration = 1.5; // seconds for fade in/out
  private _fadeTimer = 0;
  private _fading = false;

  constructor(scene: THREE.Scene) {
    this._scene = scene;
  }

  /**
   * Load a new era module. If one is already loaded it will be faded out
   * first; otherwise the new era appears immediately.
   */
  load(module: EraContentModule): void {
    // Fade out current if present
    if (this._currentModule && this._currentGroup) {
      this._startFadeOut();
      // Delay mount until fade completes
      setTimeout(() => {
        this._doLoad(module);
      }, this._fadeDuration * 1000);
    } else {
      this._doLoad(module);
    }
  }

  private _doLoad(module: EraContentModule): void {
    // Dispose previous
    this.disposeCurrent();

    this._currentModule = module;
    this._currentGroup = module.build();
    this._currentGroup.name = `era_${module.id}`;

    // Add category subgroups to scene
    for (const key of Object.values(CATEGORY)) {
      const subgroup = this._currentGroup.children.find(
        (c) => c.name === key,
      ) as THREE.Group | undefined;
      if (subgroup) {
        this._scene.add(subgroup);
      }
    }

    this._transitionProgress = 1;
    this._fading = false;
  }

  /** Update all category groups and the active module. */
  update(dt: number, elapsed: number): void {
    // Handle fade
    if (this._fading) {
      this._fadeTimer += dt;
      const t = Math.min(this._fadeTimer / this._fadeDuration, 1);
      this._transitionProgress = this._fadeOut ? 1 - t : t;

      if (t >= 1) {
        this._fading = false;
        this._transitionProgress = this._fadeOut ? 0 : 1;
      }
    }

    // Apply visibility to category subgroups
    if (this._currentGroup) {
      for (const child of this._currentGroup.children) {
        if (child instanceof THREE.Group) {
          child.visible = this._transitionProgress > 0.01;
          (child as THREE.Group).traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.visible = this._transitionProgress > 0.01;
            }
          });
        }
      }
    }

    // Delegate to module
    this._currentModule?.update(dt, elapsed);
    this._currentModule?.setTransitionProgress(this._transitionProgress);
  }

  get currentEraId(): string | null {
    return this._currentModule?.id ?? null;
  }

  get transitionProgress(): number {
    return this._transitionProgress;
  }

  /** Explicitly dispose the currently loaded era. */
  disposeCurrent(): void {
    if (this._currentModule) {
      this._currentModule.dispose();
      this._currentModule = null;
    }
    if (this._currentGroup) {
      // Remove category subgroups from scene
      for (const child of this._currentGroup.children) {
        if (child instanceof THREE.Group) {
          this._scene.remove(child);
        }
      }
      this._currentGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) m.dispose();
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      this._currentGroup = null;
    }
  }

  private _fadeOut = false;
  private _startFadeOut(): void {
    this._fadeOut = true;
    this._fading = true;
    this._fadeTimer = 0;
  }
}
