// ─── Staged Era-Change Transitions ──────────────────────────────────────
// Time-based, interruptible morph animations that transform the scene
// in front of the viewer instead of hard-cutting between eras.
//
// Layers (staggered):
//   1. Street furniture & ground-level props  — fastest out, fastest in
//   2. Vehicles / traffic                      — medium
//   3. Buildings (persisting) — reclad crossfade + floor growth/decay
//   4. Pedestrians                             — staggered with buildings
//   5. Rooftop elements on persisting buildings
//
// Constraints:
//   - Total transition window: ~2.4 s (configurable via TRANSITION_DURATION)
//   - Every visible element animates; no instant swaps.
//   - Starting a new era-change mid-transition aborts the current one and
//     converges cleanly to the target era.
//   - Camera navigation is NEVER interrupted.

import * as THREE from 'three';

// ── Configuration ────────────────────────────────────────────────────────

export const TRANSITION_DURATION = 2400; // ms — total bounded window

const LAYER_STAGGER = [0, 200, 400, 600, 800]; // ms offset per layer
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic
const EASE_IN = (t: number) => t * t * t; // ease-in cubic
const EASE_BOTH = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out cubic

// ── Public API types ─────────────────────────────────────────────────────

/** One-shot callback for building morph stages */
export interface BuildingMorphCallbacks {
  /** Called during recladding: set oldMaterial → newMaterial with opacity crossfade */
  recladCrossfade?: (progress: number) => void;
  /** Called to animate added-floor growth (scale Y or position) */
  floorGrowth?: (mesh: THREE.Mesh | THREE.Group, progress: number) => void;
  /** Called to swap signage textures */
  signageSwap?: (signMesh: THREE.Mesh, progress: number) => void;
}

/** Options passed to a staged transition run */
export interface TransitionOptions {
  /** Scene root to operate on */
  scene: THREE.Scene;
  /** Callbacks for per-building morph details */
  buildingMorph?: BuildingMorphCallbacks;
  /** Per-layer mesh selectors — override defaults */
  layerSelectors?: LayerSelectorMap;
  /** Duration override (ms) */
  duration?: number;
}

/** Custom selector function: returns meshes for a given layer */
export type LayerSelectorFn = (scene: THREE.Scene) => THREE.Object3D[];

export interface LayerSelectorMap {
  streetFurniture?: LayerSelectorFn;
  vehicles?: LayerSelectorFn;
  buildings?: LayerSelectorFn;
  pedestrians?: LayerSelectorFn;
  rooftops?: LayerSelectorFn;
}

// ── Default layer selectors ──────────────────────────────────────────────

const DEFAULT_SELECTORS: LayerSelectorMap = {
  streetFurniture: (scene: THREE.Scene) => collectByTag(scene, 'street-furniture'),
  vehicles: (scene: THREE.Scene) => collectByTag(scene, 'vehicle'),
  buildings: (scene: THREE.Scene) => collectByTag(scene, 'building'),
  pedestrians: (scene: THREE.Scene) => collectByTag(scene, 'pedestrian'),
  rooftops: (scene: THREE.Scene) => collectByTag(scene, 'rooftop'),
};

function collectByTag(scene: THREE.Scene, tag: string): THREE.Object3D[] {
  const result: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if ((child as any).__eraLayer === tag && child.visible) {
      result.push(child);
    }
  });
  return result;
}

// ── Easing helpers ───────────────────────────────────────────────────────

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// ── Animated fade/scale group ────────────────────────────────────────────

interface AnimatedGroup {
  objects: THREE.Object3D[];
  startTime: number;
  delay: number;
  duration: number;
  phase: 'out' | 'in'; // 'out' = fading out, 'in' = fading in
  onComplete?: () => void;
  _done: boolean;
}

class Animator {
  private groups: AnimatedGroup[] = [];
  private running = false;

  addGroup(group: AnimatedGroup): void {
    this.groups.push(group);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(() => this.tick());
    }
  }

  tick = (): void => {
    const now = performance.now();
    let anyRemaining = false;

    for (const g of this.groups) {
      if (g._done) continue;

      const elapsed = now - g.startTime - g.delay;
      if (elapsed < 0) {
        anyRemaining = true;
        continue;
      }

      const rawProgress = clamp01(elapsed / g.duration);
      const easedProgress = g.phase === 'out' ? EASE_OUT(rawProgress) : EASE_IN(rawProgress);

      for (const obj of g.objects) {
        this.applyPhase(obj, g.phase, easedProgress);
      }

      if (rawProgress >= 1) {
        g._done = true;
        g.onComplete?.();
      } else {
        anyRemaining = true;
      }
    }

    if (anyRemaining) {
      requestAnimationFrame(() => this.tick());
    } else {
      this.running = false;
    }
  };

  /** Abort all running transitions immediately */
  abort(): void {
    for (const g of this.groups) {
      if (!g._done) {
        // Snap to final state so nothing is left halfway
        for (const obj of g.objects) {
          this.applyPhase(obj, g.phase, 1);
        }
        g._done = true;
        g.onComplete?.();
      }
    }
    this.groups = [];
    this.running = false;
  }

  /** Get count of still-running groups */
  get activeCount(): number {
    return this.groups.filter((g) => !g._done).length;
  }

  private applyPhase(obj: THREE.Object3D, phase: 'out' | 'in', progress: number): void {
    if (phase === 'out') {
      // Spatial out: shrink + sink + rotate slightly — objects dissolve into ground
      const s = 1 - progress * 0.5; // scale down to half
      obj.scale.setScalar(s);
      // Sink downward progressively
      const objAny = obj as any;
      if (!objAny.__baseYSet) {
        objAny.__baseY = obj.position.y;
        objAny.__baseYSet = true;
      }
      obj.position.y = objAny.__baseY - progress * 2.0;
      // Slight rotation for organic feel
      obj.rotation.y += progress * 0.1;

      // Also fade material
      if ('material' in obj && (obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material as THREE.Material;
        if (mat.transparent || progress > 0.05) {
          mat.transparent = true;
          mat.opacity = Math.max(0, (1 - progress) * ((mat.userData as Record<string, unknown>)?.origOpacity as number ?? 1));
          mat.needsUpdate = true;
        }
      }
    } else {
      // Spatial in: rise from below + grow + unrotate — objects assemble from ground
      const objAny = obj as any;
      if (!objAny.__baseYSet) {
        objAny.__baseY = obj.position.y;
        objAny.__baseYSet = true;
      }
      const baseY = objAny.__baseY;
      // Rise up from below ground
      obj.position.y = baseY - (1 - progress) * 2.0;
      // Grow from half-size
      const s = 0.5 + progress * 0.5;
      obj.scale.setScalar(s);
      // Unrotate
      obj.rotation.y *= (1 - progress * 0.1);

      // Fade material in
      if ('material' in obj && (obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material as THREE.Material;
        const ud = mat.userData as Record<string, unknown>;
        if (!ud.origSet) {
          mat.userData = { ...ud, origOpacity: mat.opacity, origSet: true } as typeof mat.userData;
        }
        mat.transparent = true;
        mat.opacity = progress * ((mat.userData as Record<string, unknown>)?.origOpacity as number ?? 1);
        mat.needsUpdate = true;
      }
    }
  }
}

// ── Persisting building morph helpers ─────────────────────────────────────

/**
 * Animate a single persisting building through its morph stages:
 *   1. Reclad crossfade (facade materials blend over time)
 *   2. Floor growth / decay (extra floors appear/disappear)
 *   3. Signage swap (texture crossfade)
 */
export function morphBuilding(
  buildingGroup: THREE.Group,
  progress: number, // 0→1
  callbacks?: BuildingMorphCallbacks,
): void {
  if (!callbacks) return;

  // Stage 1: Reclad crossfade (0 → 0.4)
  const recladProgress = clamp01(progress / 0.4);
  callbacks.recladCrossfade?.(recladProgress);

  // Stage 2: Floor growth (0.2 → 0.7)
  const floorProgress = clamp01((progress - 0.2) / 0.5);
  if (callbacks.floorGrowth) {
    const fg = callbacks.floorGrowth;
    buildingGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        fg(child, EASE_BOTH(floorProgress));
      }
    });
  }

  // Stage 3: Signage swap (0.5 → 1.0)
  const signProgress = clamp01((progress - 0.5) / 0.5);
  if (callbacks.signageSwap) {
    const ss = callbacks.signageSwap;
    buildingGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ss(child, EASE_IN(signProgress));
      }
    });
  }
}

// ── Main orchestrated transition ──────────────────────────────────────────

interface RunningTransition {
  animator: Animator;
  resolve: () => void;
  reject: (err: Error) => void;
}

let activeTransition: RunningTransition | null = null;

/**
 * Run a full staged era-change transition.
 * If another transition is already running, it is aborted and replaced.
 * Returns a promise that resolves when the transition completes.
 */
export function runTransition(
  options: TransitionOptions,
  phase: 'outgoing' | 'incoming',
): Promise<void> {
  // Abort any existing transition
  if (activeTransition) {
    activeTransition.animator.abort();
    activeTransition.reject(new Error('transition_aborted'));
    activeTransition = null;
  }

  const duration = options.duration ?? TRANSITION_DURATION;
  const selectors = { ...DEFAULT_SELECTORS, ...options.layerSelectors };
  const animator = new Animator();

  // Map external phase names to internal ones
  const internalPhase: 'out' | 'in' = phase === 'outgoing' ? 'out' : 'in';

  const layers: Array<{ name: keyof LayerSelectorMap; delayOffset: number }> = [
    { name: 'streetFurniture', delayOffset: LAYER_STAGGER[0] },
    { name: 'vehicles', delayOffset: LAYER_STAGGER[1] },
    { name: 'buildings', delayOffset: LAYER_STAGGER[2] },
    { name: 'pedestrians', delayOffset: LAYER_STAGGER[3] },
    { name: 'rooftops', delayOffset: LAYER_STAGGER[4] },
  ];

  // Store original opacities before we start modifying them
  for (const layerDef of layers) {
    const selector = selectors[layerDef.name];
    if (!selector) continue;
    const meshes = selector(options.scene);
    for (const m of meshes) {
      if (m instanceof THREE.Mesh) {
        if (m.material) {
          (m.material.userData as Record<string, unknown>).origOpacity = m.material.opacity;
        }
      }
    }
  }

  // Phase: outgoing — everything fades/scales/sinks out
  // Phase: incoming — everything rises/fades in
  const layerDelay = internalPhase === 'out' ? 0 : LAYER_STAGGER[0];

  for (const layerDef of layers) {
    const selector = selectors[layerDef.name];
    if (!selector) continue;
    const meshes = selector(options.scene);
    if (meshes.length === 0) continue;

    const delay = layerDelay + layerDef.delayOffset;

    animator.addGroup({
      objects: meshes,
      startTime: performance.now(),
      delay,
      duration,
      phase: internalPhase,
      onComplete: () => {
        if (internalPhase === 'out') {
          // Remove from scene after fully faded out
          for (const obj of meshes) {
            if (obj.parent) obj.parent.remove(obj);
            // Dispose geometries/materials for cleanup
            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else if (child.material) {
                  child.material.dispose();
                }
              }
            });
          }
        }
      },
      _done: false,
    });
  }

  // For incoming phase, also handle persisting building morphs
  if (internalPhase === 'in' && options.buildingMorph) {
    const buildingSelector = selectors.buildings;
    if (buildingSelector) {
      const buildings = buildingSelector(options.scene);
      for (const bldg of buildings) {
        if (bldg instanceof THREE.Group) {
          // Schedule morph animation
          const morphStart = performance.now() + LAYER_STAGGER[2];
          const morphDuration = duration;
          scheduleMorph(bldg, morphStart, morphDuration, options.buildingMorph);
        }
      }
    }
  }

  const promise = new Promise<void>((resolve, reject) => {
    activeTransition = { animator, resolve, reject };
  });

  // Clean up reference when done
  promise.then(
    () => { if (activeTransition?.animator === animator) activeTransition = null; },
    () => { if (activeTransition?.animator === animator) activeTransition = null; },
  );

  return promise;
}

/**
 * Schedule a per-building morph animation loop.
 */
function scheduleMorph(
  building: THREE.Group,
  startTime: number,
  duration: number,
  callbacks: BuildingMorphCallbacks,
): void {
  const tick = (): void => {
    const elapsed = performance.now() - startTime;
    if (elapsed < 0) {
      requestAnimationFrame(tick);
      return;
    }
    const progress = clamp01(elapsed / duration);

    morphBuilding(building, progress, callbacks);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Immediately abort any running transition and reset all materials.
 * Call this before switching eras to prevent desync.
 */
export function abortTransition(): void {
  if (activeTransition) {
    activeTransition.animator.abort();
    activeTransition.reject(new Error('transition_aborted'));
    activeTransition = null;
  }
}

/** Check if a transition is currently running */
export function isTransitionRunning(): boolean {
  return activeTransition !== null && activeTransition.animator.activeCount > 0;
}
