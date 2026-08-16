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

// ── Transition timing constants ──────────────────────────────────
// Staggered category exit order: sky first → buildings → signage → vehicles → pedestrians → props
const STAGGERED_EXIT_ORDER: CategoryKey[] = [
  'buildings',
  'signage',
  'vehicles',
  'pedestrians',
  'props',
];

const STAGGER_DELAY_MS = 300; // ms between each category's exit start
const FADE_DURATION_MS = 800; // ms per category crossfade
const INITIAL_LOAD_DELAY_MS = 400; // ms grace period for initial load

/** Smooth ease function: t ∈ [0,1] → eased t ∈ [0,1]. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * EraStage — manages per-era group mounting, visibility, and transition.
 *
 * Uses staggered crossfade transitions to avoid popping:
 * - Categories exit sequentially with 300ms offset
 * - Each category fades over 800ms using smoothstep easing
 * - New categories enter sequentially after old ones finish
 * - Total transition: ~2.5–3.0 seconds for full sweep
 *
 * Holds one EraContentModule at a time. When switching eras it:
 * 1. Fades out outgoing categories with staggered delays
 * 2. Disposes the outgoing module's group when all are invisible
 * 3. Mounts the incoming module's group with staggered fade-in
 * 4. Calls `update()` / `setTransitionProgress()` each frame
 */
export class EraStage {
  private _scene: THREE.Scene;
  private _currentModule: EraContentModule | null = null;
  private _currentGroup: THREE.Group | null = null;
  private _transitionProgress = 1; // 1 = fully visible, 0 = invisible
  private _fadeTimer = 0;
  private _fading = false;
  private _fadeOut = false;
  private _fadeComplete = false;
  private _categoryVisibility: Map<string, number> = new Map(); // name → opacity
  private _isFirstLoad = true;

  constructor(scene: THREE.Scene) {
    this._scene = scene;
  }

  /**
   * Load a new era module. If one is already loaded it will be faded out
   * first; otherwise the new era appears immediately with a brief grace period.
   */
  load(module: EraContentModule): void {
    if (this._isFirstLoad) {
      this._isFirstLoad = false;
      // Brief delay for initial load so the user sees the loading state
      setTimeout(() => {
        this._doLoad(module);
      }, INITIAL_LOAD_DELAY_MS);
      return;
    }

    // Start staggered fade-out of current categories
    this._startFadeOut();
    // Delay mounting until fade completes (~2.5s for full stagger + fade)
    const totalStaggerMs = STAGGERED_EXIT_ORDER.length * STAGGER_DELAY_MS + FADE_DURATION_MS;
    setTimeout(() => {
      this._doLoad(module);
    }, totalStaggerMs);
  }

  private _doLoad(module: EraContentModule): void {
    // Dispose previous
    this.disposeCurrent();

    this._currentModule = module;
    this._currentGroup = module.build();
    this._currentGroup.name = `era_${module.id}`;

    // Add category subgroups to scene, initially invisible
    for (const key of Object.values(CATEGORY)) {
      const subgroup = this._currentGroup.children.find(
        (c) => c.name === key,
      ) as THREE.Group | undefined;
      if (subgroup) {
        subgroup.visible = false;
        this._scene.add(subgroup);
        this._categoryVisibility.set(key, 0);
      }
    }

    // Start staggered fade-in of new categories
    this._startFadeIn();
  }

  /** Update all category groups and the active module. */
  update(dt: number, elapsed: number): void {
    // Handle staggered fade-out
    if (this._fading && this._fadeOut) {
      this._fadeTimer += dt * 1000; // work in ms for stagger calculations

      // Process staggered exits
      const currentStaggerIdx = Math.floor(this._fadeTimer / STAGGER_DELAY_MS);
      for (let i = 0; i < STAGGERED_EXIT_ORDER.length && i <= currentStaggerIdx; i++) {
        const catName = STAGGERED_EXIT_ORDER[i];
        const catElapsed = this._fadeTimer - i * STAGGER_DELAY_MS;
        const catT = Math.min(catElapsed / FADE_DURATION_MS, 1);
        const catOpacity = 1 - smoothstep(catT);
        this._categoryVisibility.set(catName, catOpacity);

        const group = this._currentGroup?.children.find((c) => c.name === catName) as THREE.Group | undefined;
        if (group) {
          group.visible = catOpacity > 0.01;
          group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.visible = catOpacity > 0.01;
            }
          });
        }
      }

      // Check if all categories have faded out
      const maxStagger = STAGGERED_EXIT_ORDER.length * STAGGER_DELAY_MS + FADE_DURATION_MS;
      if (this._fadeTimer >= maxStagger) {
        this._fading = false;
        this._fadeOut = false;
        this._fadeComplete = true;
        this._transitionProgress = 0;
      } else {
        // Overall progress based on stagger position
        this._transitionProgress = Math.max(0, 1 - this._fadeTimer / maxStagger);
      }
    }

    // Handle staggered fade-in
    if (this._fading && !this._fadeOut && this._fadeComplete) {
      this._fadeTimer += dt * 1000;

      const currentStaggerIdx = Math.floor(this._fadeTimer / STAGGER_DELAY_MS);
      let allVisible = true;

      for (let i = 0; i < STAGGERED_EXIT_ORDER.length && i <= currentStaggerIdx; i++) {
        const catName = STAGGERED_EXIT_ORDER[i];
        const catElapsed = this._fadeTimer - i * STAGGER_DELAY_MS;
        const catT = Math.min(catElapsed / FADE_DURATION_MS, 1);
        const catOpacity = smoothstep(catT);
        this._categoryVisibility.set(catName, catOpacity);

        const group = this._currentGroup?.children.find((c) => c.name === catName) as THREE.Group | undefined;
        if (group) {
          group.visible = catOpacity > 0.01;
          group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.visible = catOpacity > 0.01;
            }
          });
        }

        if (catT < 1) allVisible = false;
      }

      if (allVisible || currentStaggerIdx >= STAGGERED_EXIT_ORDER.length) {
        this._fading = false;
        this._fadeComplete = false;
        this._transitionProgress = 1;

        // Ensure final opacity is 1
        for (const [name, opacity] of this._categoryVisibility.entries()) {
          if (opacity < 1) {
            const group = this._currentGroup?.children.find((c) => c.name === name) as THREE.Group | undefined;
            if (group) {
              group.visible = true;
              group.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                  obj.visible = true;
                }
              });
            }
          }
        }
      } else {
        this._transitionProgress = Math.min(1, this._fadeTimer / (STAGGERED_EXIT_ORDER.length * STAGGER_DELAY_MS + FADE_DURATION_MS));
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
          // Dispose any InstancedMesh children (not handled by individual dispose())
          child.traverse((obj) => {
            if ((obj as THREE.InstancedMesh).isInstancedMesh) {
              const im = obj as THREE.InstancedMesh;
              im.geometry.dispose();
              if (Array.isArray(im.material)) {
                for (const m of im.material) m.dispose();
              } else if (im.material) {
                im.material.dispose();
              }
              im.dispose();
            }
          });
        }
      }
      // Full traversal: dispose all Mesh AND InstancedMesh resources
      this._currentGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.InstancedMesh).isInstancedMesh) {
          const mesh = obj as THREE.Mesh | THREE.InstancedMesh;
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
    this._categoryVisibility.clear();
    this._fadeTimer = 0;
    this._fading = false;
    this._fadeOut = false;
    this._fadeComplete = false;
    this._transitionProgress = 1;
  }

  private _startFadeOut(): void {
    this._fadeOut = true;
    this._fading = true;
    this._fadeTimer = 0;
    this._fadeComplete = false;
  }

  private _startFadeIn(): void {
    this._fadeOut = false;
    this._fading = true;
    this._fadeTimer = 0;
    this._fadeComplete = true; // signal that fade-out is complete
  }
}
