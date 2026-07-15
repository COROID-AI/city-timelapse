import * as THREE from "three";
import type { EraIndex, Interactable } from "../types";
import { ERAS } from "../config/eras";
import { Transitioner } from "../core/Transitioner";
import { Ground } from "./Ground";
import { Sky } from "./Sky";
import {
  EraSet,
  createSharedAssets,
  disposeSharedAssets,
  type SharedAssets,
} from "./EraSet";
import { createTextureSet, disposeTextureSet, type TextureSet } from "../utils/textures";

/**
 * Owns the Three.js scene graph and orchestrates era crossfades. Builds all six
 * era sets once at construction; during a transition only the from- and to-era
 * sets are visible and crossfaded, while atmosphere (sky/fog/light/ground) is
 * lerped continuously.
 */
export class SceneController {
  readonly scene: THREE.Scene;
  readonly interactables: Interactable[] = [];
  private readonly ground: Ground;
  private readonly sky: Sky;
  private readonly eraSets: EraSet[] = [];
  private readonly transitioner: Transitioner;
  private readonly shared: SharedAssets;
  private readonly textures: TextureSet;
  private current: EraIndex;
  private readonly _camTarget = new THREE.Vector3(0, 4, 0);
  private hoverCache = new WeakMap<THREE.Object3D, Interactable>();
  // Pre-allocated array reused across pick() calls to avoid per-frame GC.
  private readonly _pickCandidates: THREE.Object3D[] = [];

  constructor(reducedMotion: boolean, initial: EraIndex = 2) {
    this.scene = new THREE.Scene();
    this.current = initial;
    this.transitioner = new Transitioner(initial, reducedMotion);

    this.textures = createTextureSet();
    this.shared = createSharedAssets(this.textures);

    this.ground = new Ground(this.textures);
    this.sky = new Sky(this.scene);
    this.scene.add(this.ground.root);

    // Build all six era sets once.
    for (let i = 0; i < ERAS.length; i++) {
      const set = new EraSet(ERAS[i], this.shared);
      this.eraSets.push(set);
      this.scene.add(set.root);
    }

    // Initialize to the selected era.
    this.transitionTo(initial, true);
    this.applyFullState();
  }

  /** The camera orbit target (street level). */
  get cameraTarget(): THREE.Vector3 {
    return this._camTarget;
  }

  /** Currently displayed era index (settled or in-flight target). */
  get currentEra(): EraIndex {
    return this.current;
  }

  /** Whether a transition is currently animating. */
  get isTransitioning(): boolean {
    return this.transitioner.isActive;
  }

  /** Begin a transition to a new era. `snap` forces instant application. */
  transitionTo(target: EraIndex, snap = false): void {
    if (snap) {
      this.transitioner.snapTo(target);
    } else {
      this.transitioner.setTarget(target);
    }
    this.current = target;
    this.scene.userData.dirty = true;
  }

  /** Per-frame update: advance transition, crossfade sets, lerp atmosphere. */
  update(dt: number, time: number): void {
    this.transitioner.update(dt);
    this.applyFullState();

    // Only animate the visible (settled) era set; hidden sets skip work.
    const settled = this.current;
    this.eraSets[settled].updateAnim(dt, time);
    // If transitioning, also animate the from-set so motion continues mid-blend.
    if (this.transitioner.isActive && this.transitioner.from !== settled) {
      this.eraSets[this.transitioner.from].updateAnim(dt, time);
    }
  }

  private applyFullState(): void {
    const from = ERAS[this.transitioner.from];
    const to = ERAS[this.transitioner.to];
    const t = this.transitioner.eased;

    // Continuous atmosphere lerp.
    this.sky.applyAtmosphere(from, to, t);
    this.ground.applyAtmosphere(from, to, t);

    // Crossfade the two relevant era sets.
    const fromAlpha = 1 - t;
    const toAlpha = t;

    for (let i = 0; i < this.eraSets.length; i++) {
      const set = this.eraSets[i];
      let alpha = 0;
      if (i === this.transitioner.from) alpha = fromAlpha;
      else if (i === this.transitioner.to) alpha = toAlpha;
      set.setCrossfade(alpha);
    }
  }

  /**
   * Raycast against the currently-visible era set's interactables. Returns the
   * first hit or null. The caller provides a reusable Raycaster and vector to
   * avoid per-frame allocation.
   */
  pick(
    raycaster: THREE.Raycaster,
    pointer: THREE.Vector2,
    camera: THREE.Camera
  ): Interactable | null {
    raycaster.setFromCamera(pointer, camera);
    // Gather candidate objects from the active era set(s) into a reused array.
    const candidates = this._pickCandidates;
    candidates.length = 0;
    const activeIdx =
      this.transitioner.isActive && this.transitioner.from !== this.transitioner.to
        ? [this.transitioner.from, this.transitioner.to]
        : [this.current];

    for (const idx of activeIdx) {
      const set = this.eraSets[idx];
      for (const ia of set.interactables) {
        candidates.push(ia.object);
        this.hoverCache.set(ia.object, ia);
      }
    }

    const hits = raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      // Walk up the parent chain to find a registered interactable.
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const ia = this.hoverCache.get(obj);
        if (ia) return ia;
        obj = obj.parent;
      }
    }
    return null;
  }

  dispose(): void {
    for (const set of this.eraSets) set.dispose();
    this.ground.dispose();
    this.sky.dispose();
    disposeSharedAssets(this.shared);
    disposeTextureSet(this.textures);
    this.eraSets.length = 0;
    this.interactables.length = 0;
    this.hoverCache = new WeakMap();
  }
}
