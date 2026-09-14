/**
 * EraSceneRegistry — the scene-integration composition layer.
 *
 * Owns the single source of truth for "what is the city block for era X":
 *
 *   one shared `BlockLayout` (street grid, lots, furniture anchors)
 *   + buildBuildings(era, layout)      -> per-era building set
 *   + buildStreetLife(era, layout)     -> per-era vehicles + pedestrians
 *   + buildStorefronts(era, layout)    -> per-era storefronts / signage / ads
 *   + buildStreetFurniture(era)        -> ground + furniture data + atmosphere
 *
 * Every era composes into an `EraScene`: a ready-to-render THREE.Group holding
 * the three scene-graph producers (buildings, street life, storefronts) plus
 * the furniture data and the era atmosphere preset. The scene also exposes the
 * `EraContentBundle` surface the TransitionController morphs (per-layer
 * opacity/scale elements, per-frame update, dispose).
 *
 * `createEraSwapWiring` is the store -> transition -> swap -> audio pipeline:
 * a fresh `EraStore` request hands the current visible scene back as the
 * outgoing bundle of a `TransitionController` morph, mounts the incoming
 * scene's root on a shared *stage* group (attached exactly once to the engine
 * scene), mirrors the controller's progress back into the store, applies the
 * incoming era's atmosphere through the engine, and drives the AudioEngine
 * ambience crossfade + transition whoosh. The controller itself consults
 * `matchMedia('(prefers-reduced-motion: reduce)')`; when reduced motion is
 * preferred the wiring's zero-duration reduced-motion crossfade forces an
 * instant content swap with no staged morph animation.
 *
 * Lifecycle: build/get scenes lazily (cached), wire once, swap many times,
 * dispose on teardown. Switching eras disposes every outgoing resource
 * (geometries, materials, listeners) and the stage never grows beyond the
 * outgoing+incoming pair, so repeated rapid swaps stay memory-bounded.
 *
 * The module never imports the concrete renderer or WebGL: the engine/slider
 * factories are injected by src/main.ts, which keeps this layer headless-testable.
 */

import * as THREE from 'three';
import type { AtmospherePreset } from '../core/lighting';
import type { EraStoreSnapshot } from '../era/state';
import { EraStore } from '../era/state';
import { ERA_YEARS, type EraId, type EraTheme } from '../era/types';
import { createBlockLayout, type BlockLayout } from '../world/layout';
import { buildBuildings, disposeBuildings } from '../world/buildings/buildBuildings';
import { buildStreetLife, createDefaultEraTheme, type StreetLifeGroup } from '../world/streetLife/buildStreetLife';
import { buildStorefronts } from '../world/storefronts/buildStorefronts';
import { buildStreetFurniture, type EraStreetFurniture } from '../world/furniture/buildStreetFurniture';
import {
  DEFAULT_MORPH_DURATION,
  type EraContentBundle,
  type EraElement,
  TransitionController,
} from '../transition/transitionController';

/** Deterministic seed for the shared block layout (stable across runs). */
export const DEFAULT_LAYOUT_SEED = 90210;

/** The era the app boots into: the first chronological stop. */
export const DEFAULT_ERA: EraId = ERA_YEARS[0];

// ============================================================================
// EraScene
// ============================================================================

/** Options consumed when composing one `EraScene`. */
export interface EraSceneComposition {
  readonly era: EraId;
  readonly theme: EraTheme;
  readonly layout: BlockLayout;
  readonly root: THREE.Group;
  readonly buildings: THREE.Group;
  readonly streetLife: StreetLifeGroup;
  readonly storefronts: THREE.Group;
  readonly furniture: EraStreetFurniture;
}

/**
 * One complete, ready-to-render era scene graph.
 *
 * `root` is the composed THREE.Group (buildings + street life + storefronts)
 * that the stage mounts; `bundle` is the same scene in the form the
 * TransitionController morphs. `update` forwards to the animated street-life
 * layer, `setOpacity`/`setScale` drive every layer through the morph, and
 * `dispose` releases every geometry/material/listener the producers created.
 */
export interface EraScene {
  readonly era: EraId;
  readonly theme: EraTheme;
  /** The shared block layout this scene was composed on. */
  readonly layout: BlockLayout;
  /** Composed scene-graph root (add this to the engine scene stage). */
  readonly root: THREE.Group;
  /** Per-era building set (from buildBuildings). */
  readonly buildings: THREE.Group;
  /** Per-era vehicles + pedestrians (from buildStreetLife). */
  readonly streetLife: StreetLifeGroup;
  /** Per-era storefronts / signage / ads (from buildStorefronts). */
  readonly storefronts: THREE.Group;
  /** Ground + furniture data + atmosphere (from buildStreetFurniture). */
  readonly furniture: EraStreetFurniture;
  /** Engine-ready atmosphere preset for this era. */
  readonly atmosphere: AtmospherePreset;
  /** The `EraContentBundle` the TransitionController choreographs. */
  readonly bundle: EraContentBundle;
  readonly isDisposed: boolean;

  /** Advance animated content (vehicles / pedestrians) by `deltaSeconds`. */
  update(deltaSeconds: number): void;
  /** Apply a visibility factor in [0, 1] to every layer. */
  setOpacity(factor: number): void;
  /** Apply a uniform scale factor to every layer. */
  setScale(factor: number): void;
  /** Release every resource owned by this scene graph. Idempotent. */
  dispose(): void;
}

/** One composable layer element (THREE.Group) of an era scene. */
function groupElement(group: THREE.Group): EraElement {
  return {
    setOpacity(factor: number): void {
      applyGroupOpacity(group, factor);
    },
    setScale(factor: number): void {
      group.scale.set(factor, factor, factor);
    },
  };
}

/** Apply a visibility factor to every mesh material in a group (fade). */
function applyGroupOpacity(group: THREE.Group, factor: number): void {
  const clamped = Math.max(0, Math.min(1, factor));
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }
    const raw = (node as { material?: unknown }).material;
    const materials = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    for (const material of materials) {
      if (material === null || typeof material !== 'object') {
        continue;
      }
      const mat = material as { transparent?: boolean; opacity?: number; needsUpdate?: boolean };
      mat.transparent = clamped < 1;
      mat.opacity = clamped;
      mat.needsUpdate = true;
    }
  });
}

/** Release every geometry + material reachable from a group (teardown). */
function disposeGroupResources(group: THREE.Group): void {
  const visited = new Set<object>();
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }
    const mesh = node as THREE.Mesh & { geometry?: { dispose: () => void } };
    if (mesh.geometry !== undefined && !visited.has(mesh.geometry)) {
      visited.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const raw = (node as { material?: unknown }).material;
    const materials = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    for (const material of materials) {
      if (material !== null && typeof material === 'object' && !visited.has(material)) {
        visited.add(material);
        (material as { dispose?: () => void }).dispose?.();
      }
    }
  });
  group.clear();
}

/** Compose the producers into one `EraScene` and its morph bundle. */
function createEraScene(composition: EraSceneComposition): EraScene {
  let disposed = false;

  const layerElements: readonly EraElement[] = [
    groupElement(composition.buildings),
    // StreetLifeGroup structurally satisfies EraElement (setOpacity/setScale).
    composition.streetLife,
    groupElement(composition.storefronts),
  ];

  function disposeScene(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    disposeBuildings(composition.buildings);
    try {
      composition.streetLife.dispose();
    } catch {
      // Producer teardown must never break an era swap.
    }
    disposeGroupResources(composition.storefronts);
    composition.root.clear();
  }

  const bundle: EraContentBundle = {
    group: `era-${composition.era}`,
    elements: layerElements,
    update: (deltaSeconds: number) => {
      if (!disposed) {
        composition.streetLife.update(deltaSeconds);
      }
    },
    dispose: disposeScene,
  };

  const scene: EraScene = {
    era: composition.era,
    theme: composition.theme,
    layout: composition.layout,
    root: composition.root,
    buildings: composition.buildings,
    streetLife: composition.streetLife,
    storefronts: composition.storefronts,
    furniture: composition.furniture,
    atmosphere: composition.furniture.atmosphere,
    bundle,

    get isDisposed(): boolean {
      return disposed;
    },

    update(deltaSeconds: number): void {
      if (!disposed) {
        composition.streetLife.update(deltaSeconds);
      }
    },

    setOpacity(factor: number): void {
      if (disposed) {
        return;
      }
      for (const element of layerElements) {
        element.setOpacity(factor);
      }
    },

    setScale(factor: number): void {
      if (disposed) {
        return;
      }
      for (const element of layerElements) {
        element.setScale(factor);
      }
    },

    dispose: disposeScene,
  };

  return scene;
}

// ============================================================================
// EraSceneRegistry
// ============================================================================

/** Registry options. */
export interface EraSceneRegistryOptions {
  /** Seed for the shared block layout (defaults to `DEFAULT_LAYOUT_SEED`). */
  readonly seed?: number;
  /** Theme source per era (defaults to the street-life default themes). */
  readonly themeFor?: (era: EraId) => EraTheme;
}

/**
 * Composes BlockLayout + the four era builders into a cached `EraScene` per
 * timeline stop. All five eras share one layout so buildings, street life,
 * storefronts and furniture agree on coordinates.
 */
export class EraSceneRegistry {
  /** The one shared block layout every era composes on. */
  readonly layout: BlockLayout;

  private readonly themeFor: (era: EraId) => EraTheme;
  private readonly scenes = new Map<EraId, EraScene>();

  constructor(options: EraSceneRegistryOptions = {}) {
    this.layout = createBlockLayout(options.seed ?? DEFAULT_LAYOUT_SEED);
    this.themeFor = options.themeFor ?? ((era: EraId) => createDefaultEraTheme(era));
  }

  /** The five timeline stops, ascending (`ERA_YEARS`). */
  get eras(): readonly EraId[] {
    return ERA_YEARS;
  }

  /** Number of distinct eras composed so far (cached). */
  get size(): number {
    return this.scenes.size;
  }

  /** Whether the era scene has already been composed (cached). */
  has(era: EraId): boolean {
    return this.scenes.has(era);
  }

  /**
   * Composed scene for `era`, built lazily on first access and cached
   * afterwards. Repeated calls return the same object (no leaks), except
   * after the scene was disposed by a swap: revisiting the era rebuilds a
   * fresh scene so the timeline can cycle back to any stop.
   */
  get(era: EraId): EraScene {
    const cached = this.scenes.get(era);
    if (cached !== undefined && !cached.isDisposed) {
      return cached;
    }
    const scene = this.build(era);
    this.scenes.set(era, scene);
    return scene;
  }

  /**
   * Compose the full era scene graph from the shared layout + the four
   * builders. Deterministic for a given seed/theme source.
   */
  build(era: EraId): EraScene {
    const theme = this.themeFor(era);
    const layout = this.layout;

    const buildings = buildBuildings(era, layout);
    const streetLife = buildStreetLife(era, layout, theme);
    const storefronts = buildStorefronts(era, layout);
    const furniture = buildStreetFurniture(era, { layout });

    const root = new THREE.Group();
    root.name = `era-${era}`;
    root.add(buildings);
    root.add(streetLife.group);
    root.add(storefronts);

    return createEraScene({
      era,
      theme,
      layout,
      root,
      buildings,
      streetLife,
      storefronts,
      furniture,
    });
  }

  /** Dispose every composed scene and drop the cache. */
  dispose(): void {
    for (const scene of this.scenes.values()) {
      scene.dispose();
    }
    this.scenes.clear();
  }
}

// ============================================================================
// EraSwapWiring — store -> transition -> swap -> audio pipeline
// ============================================================================

/** Minimal audio surface the wiring drives (AudioEngine satisfies it). */
export interface EraSwapAudio {
  /** Crossfade the ambience to `era` over `duration` seconds. */
  setEra(era: string, ambience?: unknown, duration?: number): void;
  /** Play the time-travel whoosh SFX. */
  playTransitionWhoosh?(duration?: number, intensity?: number): unknown;
  /** Unlock autoplay (resume the AudioContext) on first user gesture. */
  unlock?(): Promise<boolean> | boolean;
}

/** Minimal engine surface the wiring needs (SceneEngine satisfies it). */
export interface EraWiringEngine {
  /** Register a per-fixed-step callback; returns an unsubscribe function. */
  onFrame(callback: (deltaSeconds: number) => void): () => void;
  /** Push an era atmosphere preset through the lighting pipeline. */
  setAtmosphere(preset: AtmospherePreset | null | undefined): void;
}

/** Options for `createEraSwapWiring`. */
export interface EraSwapWiringOptions {
  readonly store: EraStore;
  readonly registry: EraSceneRegistry;
  readonly controller: TransitionController;
  readonly engine: EraWiringEngine;
  /** Mounted once on the engine scene; holds outgoing+incoming roots. */
  readonly stage: THREE.Group;
  /** Audio engine (or compatible stub) for ambience/whoosh. */
  readonly audio?: EraSwapAudio;
  /** Called after a genuine era selection is applied. */
  readonly onEraSelected?: (era: EraId) => void;
  /** Ambience/crossfade duration in seconds; defaults to the morph duration. */
  readonly morphDuration?: number;
}

/** The wired store + transition + audio pipeline handle. */
export interface EraSwapWiring {
  readonly store: EraStore;
  readonly controller: TransitionController;
  /** The currently visible (settled or incoming) era. */
  readonly activeEra: EraId;
  /** The currently active scene (settled or incoming). */
  readonly activeScene: EraScene;
  /** Scenes whose roots are currently mounted on the stage. */
  readonly attached: readonly EraScene[];
  /** Request an era through the store; true only on a genuine change. */
  requestEra(era: EraId): boolean;
  /** Whether a scene's root is currently mounted on the stage. */
  isAttached(scene: EraScene): boolean;
  /** Detach the store/frame listeners, dispose the morph and content. */
  dispose(): void;
}

/**
 * Wire the full swap pipeline.
 *
 * Store freshness (a new era request) hands the visible scene back as the
 * outgoing bundle and mounts the incoming scene's root on the stage, then
 * applies the incoming atmosphere and drives audio ambience + whoosh. The
 * controller's progress is mirrored into the store so the HUD progress
 * indicator tracks the morph; completion disposes the outgoing content and
 * detaches its root. The controller (not this wiring) resolves
 * `matchMedia('(prefers-reduced-motion: reduce)')` — with reduced motion
 * active and a zero reduced-motion duration the swap completes on the next
 * frame with no staged morph animation.
 */
export function createEraSwapWiring(options: EraSwapWiringOptions): EraSwapWiring {
  const { store, registry, controller, engine, stage, audio } = options;
  const morphDuration = options.morphDuration ?? DEFAULT_MORPH_DURATION;

  let requestedEra: EraId = store.current;
  let activeScene: EraScene = registry.get(store.current);
  let outgoingScene: EraScene | null = null;
  let disposed = false;
  const attached = new Set<EraScene>([activeScene]);

  // The initial era is the first visible content: atmosphere + ambience.
  stage.add(activeScene.root);
  engine.setAtmosphere(activeScene.atmosphere);
  audio?.setEra(String(store.current), undefined, morphDuration);

  function detach(scene: EraScene): void {
    if (attached.delete(scene)) {
      stage.remove(scene.root);
    }
  }

  function handleStore(snapshot: EraStoreSnapshot): void {
    const transition = snapshot.transition;
    // Ignore progress-mirror and settle notifications — only act on fresh requests.
    if (transition === null || snapshot.current === requestedEra) {
      return;
    }
    requestedEra = snapshot.current;
    const outgoing = activeScene;
    const incoming = registry.get(snapshot.current);

    // The controller disposes every tracked bundle outside the new pair on
    // play(); detach those roots first so no disposed content stays staged.
    for (const scene of [...attached]) {
      if (scene !== outgoing && scene !== incoming) {
        detach(scene);
      }
    }

    outgoingScene = outgoing;
    controller.play(outgoing.bundle, incoming.bundle, snapshot.current);
    activeScene = incoming;
    if (!attached.has(incoming)) {
      stage.add(incoming.root);
      attached.add(incoming);
    }

    // The scene transforms: lighting mood + ambience crossfade + whoosh.
    engine.setAtmosphere(incoming.atmosphere);
    audio?.unlock?.();
    audio?.setEra(String(snapshot.current), undefined, morphDuration);
    audio?.playTransitionWhoosh?.(morphDuration);
    options.onEraSelected?.(snapshot.current);
  }
  const unsubscribeStore = store.subscribe(handleStore);

  function handleComplete(): void {
    if (outgoingScene !== null) {
      detach(outgoingScene);
      outgoingScene = null;
    }
    store.setTransitionProgress(1); // settle the store (HUD reflects it)
  }
  controller.onComplete(handleComplete);
  controller.onProgress((progress) => {
    if (store.transition !== null) {
      store.setTransitionProgress(progress);
    }
  });

  // One frame hook: steer the morph; when settled, animate the visible scene.
  const updateFrame = (deltaSeconds: number): void => {
    const morphWasRunning = controller.active;
    controller.update(deltaSeconds);
    if (!morphWasRunning) {
      activeScene.update(deltaSeconds);
    }
  };
  const unsubscribeFrame = engine.onFrame(updateFrame);

  return {
    get activeEra(): EraId {
      return store.current;
    },
    get activeScene(): EraScene {
      return activeScene;
    },
    get attached(): readonly EraScene[] {
      return [...attached];
    },
    store,
    controller,
    requestEra(era: EraId): boolean {
      if (disposed) {
        return false;
      }
      const before = store.current;
      store.requestEra(era);
      return store.current !== before;
    },
    isAttached(scene: EraScene): boolean {
      return attached.has(scene);
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      unsubscribeFrame();
      unsubscribeStore();
      controller.dispose(); // disposes outgoing + incoming bundles exactly once
      // Also release the settled/visible scene (idempotent with the above).
      activeScene.dispose();
      for (const scene of [...attached]) {
        stage.remove(scene.root);
      }
      attached.clear();
      outgoingScene = null;
    },
  };
}