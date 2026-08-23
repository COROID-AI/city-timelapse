/**
 * Scene director — the central orchestrator of the City Era Timelapse.
 *
 * One factory owns every subsystem and exposes a tiny handle:
 *
 * - **Foundation renderer + scene**: the director owns the `WebGLRenderer`,
 *   primary `THREE.Scene`, canvas mounting, DPR capping and resize handling.
 * - **Render loop**: `renderer.setAnimationLoop` drives the active era's
 *   `update(dt)` tick(s) every frame (both sides tick during a hand-off),
 *   advances the orbit-camera damping inertia and issues the draw call.
 * - **Eras**: groups come exclusively from `ERA_MANIFEST` and are built
 *   *lazily* on first visit, so startup only pays for `'1945'`.
 * - **Environment**: a three-light rig (sun / hemisphere / ambient) is restyled
 *   per era via `applyEnvironmentProfile(scene, ENVIRONMENT_PROFILES[id])`.
 * - **Camera**: `createOrbitCamera` attaches smooth orbit navigation to the
 *   foundation renderer's viewport and canvas.
 * - **UI**: `createTimelineSlider` is mounted at the top of the container;
 *   slider clicks feed back into {@link SceneDirector.setEra}.
 * - **Automation hooks**: the renderer canvas carries a stable
 *   `data-testid="city-canvas"` identity plus ARIA semantics, and the mount
 *   container publishes machine-readable `data-era` / `data-era-transitioning`
 *   attributes so browser evidence probes can select the viewport and wait for
 *   deterministic era endpoints without reaching into scene internals.
 * - **Audio**: `SfxMixer` from the foundation is initialized on the first user
 *   gesture (autoplay policy); until then era selections are remembered and
 *   applied as the mixer's `initialEra`.
 *
 * `setEra(id)` performs the four-step hand-off in a fixed order:
 *   1. `mixer.setEra(id)`
 *   2. `applyEnvironmentProfile(...)`
 *   3. era-transition choreography (crossfade of the two era groups)
 *   4. `timeline.setEra(id)`
 *
 * Transition choreography lives here rather than in a sibling module because
 * this task's contract restricts changes to `src/scene/director.ts` and its
 * tests; the section below is self-contained so it can be extracted verbatim
 * into `src/scene/transitions.ts` later without touching callers.
 */

import * as THREE from 'three';

import { SfxMixer } from '../audio/mixer';
import { generateAllEraBuffers } from '../audio/sfx';
import { createOrbitCamera } from '../controls/camera';
import { isEraId } from '../eras';
import type { EraId } from '../eras';
import { update as updateEra1945 } from '../eras/1945';
import { update as updateEra1965 } from '../eras/1965';
import { update as updateEra1985 } from '../eras/1985';
import { update as updateEra2005 } from '../eras/2005';
import { update as updateEra2025 } from '../eras/2025';
import { ERA_MANIFEST } from '../eras/index';
import { applyEnvironmentProfile, ENVIRONMENT_PROFILES } from '../environment/profiles';
import { createTimelineSlider } from '../ui/timeline';

/** Full-length era crossfade (seconds). */
export const DEFAULT_TRANSITION_SECONDS = 2;

/** Crossfade length under `prefers-reduced-motion: reduce` (seconds). */
export const REDUCED_MOTION_TRANSITION_SECONDS = 0.4;

/** Upper bound for a single frame delta, so tab-switch pauses don't teleport. */
export const MAX_FRAME_DELTA_SECONDS = 0.1;

/** Foundation-quality DPR cap: crisp on retina, cheap on 3x phones. */
const MAX_PIXEL_RATIO = 2;

/** Initial era shown before the visitor touches the timeline. */
const INITIAL_ERA: EraId = '1945';

/**
 * Structural subset of `SfxMixer` consumed by the director. The real
 * `SfxMixer` satisfies it; tests inject lightweight stand-ins.
 */
export interface SceneDirectorMixer {
  setEra(id: EraId): void;
  handleUserGesture(): Promise<void>;
  dispose(): void;
}

/** Optional overrides/injection points (tests, embedding shells). */
export interface SceneDirectorOptions {
  /**
   * Pre-built mixer. When omitted the director lazily constructs a real
   * `SfxMixer` (with `generateAllEraBuffers`) on the first user gesture.
   */
  readonly mixer?: SceneDirectorMixer;
  /** Override AudioContext construction for procedural buffer generation. */
  readonly contextFactory?: () => AudioContext;
  /** Fixed transition length in seconds; overrides reduced-motion detection. */
  readonly transitionSeconds?: number;
  /**
   * Observability seam fired at step 3 of the hand-off, when the visual
   * transition begins (used by analytics/debugging and director tests).
   */
  readonly onTransitionStart?: (from: EraId, to: EraId) => void;
}

/** Public handle returned by {@link createSceneDirector}. */
export interface SceneDirector {
  /** The primary scene owned by the director. */
  readonly scene: THREE.Scene;
  /** The perspective camera driven by the orbit controls. */
  readonly camera: THREE.PerspectiveCamera;
  /** The foundation renderer (canvas is `renderer.domElement`). */
  readonly renderer: THREE.WebGLRenderer;
  /** Currently selected era id. */
  getEra(): EraId;
  /** True while an era-to-era visual crossfade is in flight. */
  isTransitioning(): boolean;
  /** Live mixer, or `null` until the first user gesture unlocks audio. */
  getMixer(): SceneDirectorMixer | null;
  /**
   * Select an era: mixer → environment → transition choreography → timeline
   * highlight, in that order. Same-id requests are ignored; unknown ids throw
   * `RangeError`; calls after dispose are silently ignored.
   */
  setEra(id: EraId): void;
  /** Start the render loop (idempotent). */
  start(): void;
  /** Pause the render loop without tearing anything down (idempotent). */
  stop(): void;
  /** Tear down every subsystem and release GPU/DOM resources. Idempotent. */
  dispose(): void;
}

/**
 * Per-era animation tick adapters. Era modules export module-scoped
 * `update(dt, group)` functions (state kept on `group.userData.*`), except
 * 1985 whose state is module-scoped — the manifest only carries builders, so
 * these adapters give the director a uniform tick surface without modifying
 * any era module.
 */
const ERA_UPDATERS: Readonly<Record<EraId, (dt: number, group: THREE.Group) => void>> = {
  '1945': (dt, group) => updateEra1945(dt, group),
  '1965': (dt, group) => updateEra1965(dt, group),
  '1985': (dt, _group) => updateEra1985(dt),
  '2005': (dt, group) => updateEra2005(dt, group),
  '2025': (dt, group) => updateEra2025(dt, group),
};

// ---------------------------------------------------------------------------
// Transition choreography
// ---------------------------------------------------------------------------

/** One captured material with the values that must be restored post-fade. */
interface MaterialFadeEntry {
  readonly material: THREE.Material;
  readonly baseOpacity: number;
  readonly wasTransparent: boolean;
}

/** In-flight visual hand-off between two era groups. */
interface ActiveTransition {
  readonly from: EraId;
  readonly to: EraId;
  elapsedSeconds: number;
  readonly durationSeconds: number;
}

/** Deterministic S-curve easing for era crossfades. */
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Snapshot every unique material reachable from `group` so the crossfade can
 * mutate `opacity`/`transparent` freely and still restore byte-exact originals
 * when the hand-off completes (deterministic endpoints).
 */
function collectFadeEntries(group: THREE.Group): MaterialFadeEntry[] {
  const seen = new Set<THREE.Material>();
  const entries: MaterialFadeEntry[] = [];
  group.traverse((obj) => {
    const material = (obj as Partial<THREE.Mesh>).material;
    if (!material) return;
    for (const mat of Array.isArray(material) ? material : [material]) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      entries.push({
        material: mat,
        baseOpacity: mat.opacity,
        wasTransparent: mat.transparent === true,
      });
    }
  });
  return entries;
}

/**
 * Scale a group's materials toward (or exactly onto) their captured baselines.
 * `factor >= 1` restores the pristine values; factors in (0..1) force
 * `transparent` so partially faded meshes actually blend.
 */
function applyFadeFactor(
  entries: MaterialFadeEntry[] | undefined,
  factor: number,
): void {
  if (!entries) return;
  for (const entry of entries) {
    if (factor >= 1) {
      entry.material.opacity = entry.baseOpacity;
      entry.material.transparent = entry.wasTransparent;
    } else {
      entry.material.opacity = entry.baseOpacity * factor;
      entry.material.transparent = true;
    }
  }
}

function createDefaultAudioContext(): AudioContext {
  const scope = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) {
    throw new Error('SceneDirector: Web Audio (AudioContext) unavailable.');
  }
  return new Ctor();
}

/** Best-effort GPU resource release for one scene-graph node. */
function disposeObjectResources(obj: THREE.Object3D): void {
  const candidate = obj as Partial<THREE.Mesh>;
  const geometry = candidate.geometry as { dispose?: () => void } | undefined;
  if (geometry && typeof geometry.dispose === 'function') geometry.dispose();

  const material = candidate.material;
  if (!material) return;
  for (const mat of Array.isArray(material) ? material : [material]) {
    if (!mat) continue;
    const slots = mat as unknown as Record<string, { dispose?: () => void } | undefined>;
    for (const key of [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
    ]) {
      slots[key]?.dispose?.();
    }
    mat.dispose?.();
  }
}

/**
 * Create the scene director for `container`.
 *
 * Mounts the renderer canvas and the top timeline slider into the container,
 * builds the `'1945'` era group (lazily — every other era is built on first
 * visit), applies its environment profile and leaves the render loop stopped
 * until {@link SceneDirector.start} is called.
 */
export function createSceneDirector(
  container: HTMLElement,
  options: SceneDirectorOptions = {},
): SceneDirector {
  const {
    mixer: injectedMixer = null,
    contextFactory = null,
    transitionSeconds: transitionSecondsOverride = null,
    onTransitionStart = null,
  } = options;

  const reducedMotion = prefersReducedMotion();
  const transitionSeconds =
    transitionSecondsOverride ??
    (reducedMotion ? REDUCED_MOTION_TRANSITION_SECONDS : DEFAULT_TRANSITION_SECONDS);

  // --- Foundation renderer -------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  container.appendChild(renderer.domElement);

  // Stable automation/a11y identity for the interactive viewport. Evidence
  // probes target these selectors for orbit/zoom/pan gestures instead of
  // guessing at an unnamed canvas node.
  const canvas = renderer.domElement;
  canvas.dataset.testid = 'city-canvas';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Interactive city block viewport: left-drag to orbit, scroll to zoom, right-drag to pan',
  );
  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');

  // --- Scene + environment light rig ---------------------------------------
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(42, 64, 26);
  const hemisphere = new THREE.HemisphereLight(0xbfd4ff, 0x3a2f28, 0.9);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(sun, hemisphere, ambient);
  const rig = { sun, hemisphere, ambient };

  // --- Camera --------------------------------------------------------------
  const orbit = createOrbitCamera(renderer, renderer.domElement);

  // --- Lazy era groups -----------------------------------------------------
  const groups = new Map<EraId, THREE.Group>();
  const fadeEntries = new Map<EraId, MaterialFadeEntry[]>();

  const ensureGroup = (id: EraId): THREE.Group => {
    const existing = groups.get(id);
    if (existing) return existing;
    const group = ERA_MANIFEST[id]();
    scene.add(group);
    groups.set(id, group);
    fadeEntries.set(id, collectFadeEntries(group));
    group.visible = false;
    return group;
  };

  // First visit happens right now; the other four stay unbuilt until asked.
  ensureGroup(INITIAL_ERA).visible = true;
  applyEnvironmentProfile(scene, ENVIRONMENT_PROFILES[INITIAL_ERA], { lights: rig });

  // --- Timeline slider (mounted at the top of the container) ---------------
  const timeline = createTimelineSlider(container, (id) => {
    if (!disposed && isEraId(id)) setEra(id);
  });
  container.appendChild(timeline.root);
  const timelineRoot: HTMLElement = timeline.root;
  timeline.setEra(INITIAL_ERA);

  // --- Audio (autoplay-policy friendly) -------------------------------------
  let mixer: SceneDirectorMixer | null = injectedMixer;
  const gestureController = new AbortController();

  const detachGestureUnlock = (): void => {
    gestureController.abort();
  };

  const onFirstGesture = (): void => {
    detachGestureUnlock();
    if (disposed) return;
    if (!mixer) {
      try {
        const ctx = contextFactory
          ? contextFactory()
          : createDefaultAudioContext();
        mixer = new SfxMixer({
          buffers: generateAllEraBuffers(ctx),
          initialEra: era,
          // Reuse exactly the context the procedural buffers were rendered on;
          // falling back to a second default context breaks headless shells.
          contextFactory: () => ctx,
        });
      } catch {
        mixer = null; // Audio simply stays off; visuals keep running.
      }
    }
    void mixer?.handleUserGesture().catch(() => undefined);
  };

  for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
    document.addEventListener(type, onFirstGesture, {
      signal: gestureController.signal,
      capture: true,
    });
  }

  // --- Transition choreography ---------------------------------------------
  let activeTransition: ActiveTransition | null = null;
  let era: EraId = INITIAL_ERA;

  /**
   * Publish machine-readable era state onto the mount container so browser
   * evidence probes can drive and await era swaps from the outside:
   * `data-era` is the committed era id, `data-era-transitioning` is `"true"`
   * while a visual crossfade is in flight and `"false"` at the deterministic
   * endpoints (so a screenshot taken when it reads `"false"` shows a settled
   * single-era scene).
   */
  const publishEraState = (): void => {
    container.setAttribute('data-era', era);
    container.setAttribute('data-era-transitioning', activeTransition ? 'true' : 'false');
  };

  const finishTransition = (): void => {
    const transition = activeTransition;
    if (!transition) return;
    applyFadeFactor(fadeEntries.get(transition.from), 1);
    applyFadeFactor(fadeEntries.get(transition.to), 1);
    const fromGroup = groups.get(transition.from);
    const toGroup = groups.get(transition.to);
    if (fromGroup) fromGroup.visible = false;
    if (toGroup) toGroup.visible = true;
    activeTransition = null;
    publishEraState();
  };

  const advanceTransition = (dt: number): boolean => {
    const transition = activeTransition;
    if (!transition) return false;
    transition.elapsedSeconds += dt;
    const progress =
      transition.durationSeconds > 0
        ? Math.min(1, transition.elapsedSeconds / transition.durationSeconds)
        : 1;
    const eased = easeInOutCubic(progress);
    applyFadeFactor(fadeEntries.get(transition.from), 1 - eased);
    applyFadeFactor(fadeEntries.get(transition.to), eased);
    if (progress >= 1) {
      finishTransition();
      return true;
    }
    return false;
  };

  const beginTransition = (from: EraId, to: EraId): void => {
    // A request landing mid-hand-off settles the previous crossfade instantly
    // (restored materials, clean visibility) so endpoints stay deterministic.
    if (activeTransition) finishTransition();
    ensureGroup(from);
    ensureGroup(to).visible = true;
    activeTransition = { from, to, elapsedSeconds: 0, durationSeconds: transitionSeconds };
    onTransitionStart?.(from, to);
    publishEraState();
  };

  publishEraState();

  // --- Render loop ----------------------------------------------------------
  let running = false;
  let disposed = false;
  let lastFrameTime: number | null = null;

  const frame = (timeMs?: number): void => {
    if (disposed || !running) return;
    const now = typeof timeMs === 'number' ? timeMs : performance.now();
    const rawDt = lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    const dt = Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, rawDt));

    // Active-era ticks: the selected era always animates, and the outgoing
    // era keeps animating until its crossfade completes.
    const ticking = new Set<EraId>([era]);
    if (activeTransition) ticking.add(activeTransition.from);
    for (const id of ticking) {
      const group = groups.get(id);
      if (group) ERA_UPDATERS[id](dt, group);
    }

    orbit.update(dt);

    // Advance (and possibly finish) the hand-off before drawing, so the final
    // frame of a transition shows restored, deterministic endpoint materials.
    if (activeTransition) advanceTransition(dt);

    renderer.render(scene, orbit.camera);
  };

  const start = (): void => {
    if (disposed || running) return;
    running = true;
    renderer.setAnimationLoop(frame);
  };

  const stop = (): void => {
    running = false;
    lastFrameTime = null;
    renderer.setAnimationLoop(null);
  };

  // --- Resize handling ------------------------------------------------------
  const resize = (): void => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    orbit.camera.aspect = width / Math.max(height, 1);
    orbit.camera.updateProjectionMatrix();
  };
  resize();

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    try {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } catch {
      resizeObserver = null;
    }
  }
  window.addEventListener('resize', resize);

  // --- Era selection (fixed four-step hand-off order) ------------------------
  const setEra = (id: EraId): void => {
    if (disposed) return;
    if (!isEraId(id)) {
      throw new RangeError(`SceneDirector.setEra: unknown era id "${String(id)}"`);
    }
    if (id === era) return;

    const from = era;
    era = id; // Recorded first so a not-yet-created mixer adopts this era.
    mixer?.setEra(id); // 1 — audio crossfade
    applyEnvironmentProfile(scene, ENVIRONMENT_PROFILES[id], { lights: rig }); // 2 — sky/sun/fog
    beginTransition(from, id); // 3 — visual hand-off choreography
    timeline.setEra(id); // 4 — slider highlight (never re-fires onEraChange)
  };

  // --- Teardown ---------------------------------------------------------------
  const onPageHide = (): void => dispose();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stop();
    detachGestureUnlock();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', onPageHide);
    orbit.dispose();
    timeline.dispose();
    if (timelineRoot.isConnected) timelineRoot.parentNode?.removeChild(timelineRoot);
    mixer?.dispose();
    mixer = null;
    scene.traverse(disposeObjectResources);
    renderer.dispose();
    const canvas = renderer.domElement;
    if (canvas.isConnected) canvas.parentNode?.removeChild(canvas);
    groups.clear();
    fadeEntries.clear();
  };

  window.addEventListener('pagehide', onPageHide, { once: true });

  return {
    get scene() {
      return scene;
    },
    get camera() {
      return orbit.camera;
    },
    get renderer() {
      return renderer;
    },
    getEra: () => era,
    isTransitioning: () => activeTransition !== null,
    getMixer: () => mixer,
    setEra,
    start,
    stop,
    dispose,
  };
}
