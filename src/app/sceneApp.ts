/**
 * City Time Period Timelapse — Scene Application Composition Root.
 *
 * Instantiates, attaches, updates, and disposes all subsystems:
 * - Deterministic city-block layout & ground meshes
 * - Six era-driven world systems: buildings, signage, vehicles, pedestrians, atmosphere, audio
 * - Camera navigation controller (orbit + walk modes, POI fly-to)
 * - Timeline controller & transition director (synchronized channel tween)
 * - Timeline UI (top slider, HUD, start overlay)
 * - Single master requestAnimationFrame heartbeat (render loop)
 *
 * Supports injectable renderer & audio context creation for headless testing.
 */

import {
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { createAudioEngine, type AudioEngine } from '../audio/audioEngine';
import {
  createNavigationController,
  type NavigationController,
  type NavigationMode,
} from '../controls/navigationController';
import type { EraId } from '../era/years';
import {
  createTimelineController,
  type TimelineController,
} from '../state/timelineStore';
import { createTimelineUI, type TimelineUI } from '../ui/timelineUI';
import { createCityBlockLayout } from '../world/layout/cityBlockLayout';
import { buildGroundMeshes, disposeGroundMeshes } from '../world/layout/ground';
import type { BlockLayout } from '../world/layout/types';
import {
  createAtmosphereSystem,
  type AtmosphereEraSystem,
} from '../world/systems/atmosphere/atmosphereSystem';
import {
  createBuildingsSystem,
  type BuildingsSystemHandle,
} from '../world/systems/buildings/buildingsSystem';
import {
  createPedestriansSystem,
  type PedestriansSystemInstance,
} from '../world/systems/pedestrians/pedestrianSystem';
import {
  createSignageSystem,
  type SignageSystem,
} from '../world/systems/signage/signageSystem';
import {
  createVehiclesSystem,
  type VehiclesSystem,
} from '../world/systems/vehicles/vehiclesSystem';
import { startRenderLoop, type RenderLoopHandle } from './renderLoop';
import {
  createTransitionDirector,
  type TransitionDirector,
} from './transitionDirector';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface SceneAppOptions {
  /** Layout generator seed string. Defaults to 'city-timelapse-seed-1945'. */
  seed?: string;
  /** Initial era to boot the city into. Defaults to '1945'. */
  initialEra?: EraId;
  /** Duration in seconds for automated era transitions. Defaults to 1.4s. */
  transitionDuration?: number;
  /** Injectable renderer factory so composition tests run headless without WebGL. */
  rendererFactory?: (canvas: HTMLCanvasElement, width: number, height: number) => WebGLRenderer;
  /** Injectable AudioContext factory for tests and custom audio environments. */
  audioContextFactory?: () => AudioContext;
  /** Initial master volume level [0.0..1.0]. Defaults to 0.7. */
  masterVolume?: number;
  /** Whether to auto-resume audio on user gesture. Defaults to true. */
  autoResumeOnGesture?: boolean;
  /** Reduced motion probe function or static flag. */
  motionReduced?: boolean | (() => boolean);
  /** Optional DOM container to mount the Timeline UI into. */
  uiContainer?: HTMLElement | null;
  /** Initial camera mode ('orbit' | 'walk'). Defaults to 'orbit'. */
  navigationMode?: NavigationMode;
  /** Initial rendering quality tier. Defaults to 'high'. */
  quality?: QualityTier;
  /** Callback fired once on the very first rendered frame. */
  onFirstFrame?: () => void;
  /** Callback fired when an era transition begins. */
  onTransitionStart?: (fromEra: EraId, toEra: EraId) => void;
  /** Callback fired when an era transition arrives at the target era. */
  onTransitionEnd?: (era: EraId) => void;
}

export interface SceneAppSystems {
  readonly buildings: BuildingsSystemHandle;
  readonly signage: SignageSystem;
  readonly vehicles: VehiclesSystem;
  readonly pedestrians: PedestriansSystemInstance;
  readonly atmosphere: AtmosphereEraSystem;
}

export interface SceneApp {
  /** Target HTML canvas element. */
  readonly canvas: HTMLCanvasElement;
  /** Three.js root scene. */
  readonly scene: Scene;
  /** Perspective camera. */
  readonly camera: PerspectiveCamera;
  /** Active WebGL (or stub) renderer. */
  readonly renderer: WebGLRenderer;
  /** Deterministic physical city layout. */
  readonly layout: BlockLayout;
  /** THREE.Group holding the physical ground meshes. */
  readonly groundGroup: Group;
  /** The 5 3D world subsystems. */
  readonly systems: SceneAppSystems;
  /** Procedural WebAudio engine. */
  readonly audio: AudioEngine;
  /** Central timeline store controller. */
  readonly controller: TimelineController;
  /** Synchronized era transition director. */
  readonly director: TransitionDirector;
  /** Camera navigation controller. */
  readonly navigation: NavigationController;
  /** Interactive timeline UI overlay (null if uiContainer was omitted). */
  readonly ui: TimelineUI | null;
  /** Master requestAnimationFrame loop handle. */
  readonly loop: RenderLoopHandle;

  /** Returns whether this SceneApp instance has been disposed. */
  isDisposed(): boolean;

  /**
   * Advances all subsystems by `deltaSeconds` and renders the scene.
   * Driven automatically by `loop`, or called manually in tests.
   */
  update(deltaSeconds: number): void;

  /**
   * Smoothly transitions the city block to `targetEra`.
   */
  setYear(era: EraId, options?: { immediate?: boolean; duration?: number }): void;

  /**
   * Configures rendering quality tier (pixel ratio, shadows, particle budget).
   * Consumed by polish-performance-docs.
   */
  setQuality(tier: QualityTier): void;

  /**
   * Resizes renderer and camera projection matrix to match container dimensions.
   */
  resize(width?: number, height?: number): void;

  /**
   * Complete teardown releasing all geometries, textures, materials, audio nodes,
   * event listeners, and observers. Safe to call repeatedly.
   */
  dispose(): void;
}

const DEFAULT_SEED = 'city-timelapse-seed-1945';
const DEFAULT_ERA: EraId = '1945';
const DEFAULT_TRANSITION_DURATION = 1.4;

/**
 * Creates and boots the complete SceneApp composition root.
 */
export function createSceneApp(
  canvas: HTMLCanvasElement,
  options: SceneAppOptions = {},
): SceneApp {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('createSceneApp requires an HTMLCanvasElement');
  }

  let disposed = false;
  let isFirstFrame = true;
  let currentQuality: QualityTier = options.quality ?? 'high';

  const width = Math.max(1, canvas.clientWidth || 800);
  const height = Math.max(1, canvas.clientHeight || 600);

  // 1. Scene & Camera Setup
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, width / height, 0.1, 500);
  // Default isometric-style vantage point over the city block
  camera.position.set(24, 16, 28);
  camera.lookAt(14, 2, 9);

  // 2. Renderer Instantiation
  let renderer: WebGLRenderer;
  if (options.rendererFactory) {
    renderer = options.rendererFactory(canvas, width, height);
  } else {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
  }

  const initialPixelRatio = typeof window !== 'undefined'
    ? Math.min(window.devicePixelRatio || 1, 2)
    : 1;
  renderer.setPixelRatio(initialPixelRatio);
  renderer.setSize(width, height, false);

  // 3. Layout and Ground Plane Construction
  const seed = options.seed ?? DEFAULT_SEED;
  const layout = createCityBlockLayout(seed);
  const groundGroup = buildGroundMeshes(layout);
  scene.add(groundGroup);

  // 4. Six Era Subsystems Instantiation
  const buildings = createBuildingsSystem(layout);
  const signage = createSignageSystem(layout);
  const vehicles = createVehiclesSystem(layout);
  const pedestrians = createPedestriansSystem(layout);
  const atmosphere = createAtmosphereSystem(layout);
  const audio = createAudioEngine({
    contextFactory: options.audioContextFactory,
    masterVolume: options.masterVolume,
    autoResumeOnGesture: options.autoResumeOnGesture,
  });

  const systems: SceneAppSystems = {
    buildings,
    signage,
    vehicles,
    pedestrians,
    atmosphere,
  };

  // 5. Attach Subsystems to Scene / Context
  buildings.attach({ scene: scene as unknown as Group });
  signage.attach({ scene });
  vehicles.attach({ scene });
  pedestrians.attach(scene);
  atmosphere.attach({ scene, renderer });
  audio.attach();

  // 6. Timeline Controller & Transition Director
  const initialEra = options.initialEra ?? DEFAULT_ERA;
  const transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION_DURATION;

  const controller = createTimelineController({
    initialEra,
    transitionDuration,
  });

  const director = createTransitionDirector(
    controller,
    systems,
    audio,
    {
      duration: transitionDuration,
      reducedMotion: options.motionReduced,
      onTransitionStart: options.onTransitionStart,
      onTransitionEnd: options.onTransitionEnd,
    },
  );

  // 7. Camera Navigation Controller
  const navigation = createNavigationController(camera, canvas, {
    layout,
    mode: options.navigationMode ?? 'orbit',
    motionReduced: () => director.isReducedMotion(),
  });

  // 8. Interactive Timeline UI (if uiContainer provided)
  let ui: TimelineUI | null = null;
  if (options.uiContainer) {
    ui = createTimelineUI(options.uiContainer, controller, {
      onToggleMute: (muted) => audio.setMuted(muted),
      onSelectPoi: (poiId) => {
        navigation.flyTo(poiId);
      },
      onYearRequested: (year) => {
        director.transitionTo(year);
      },
      onStart: () => {
        audio.resume().catch(() => {});
      },
    });
  }

  // 9. Quality Configuration Helper
  function applyQuality(tier: QualityTier): void {
    currentQuality = tier;
    switch (tier) {
      case 'low':
        renderer.setPixelRatio(1);
        break;
      case 'medium':
        renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5));
        break;
      case 'high':
      case 'ultra':
        renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2));
        break;
    }
  }
  applyQuality(currentQuality);

  // 10. Master App Update & Render Method
  function update(deltaSeconds: number): void {
    if (disposed) return;

    // 1. Advance timeline & synchronized world systems + audio
    director.update(deltaSeconds);

    // 2. Advance camera navigation
    navigation.update(deltaSeconds);

    // 3. Render 3D frame
    renderer.render(scene, camera);

    // 4. Notify first frame ready
    if (isFirstFrame) {
      isFirstFrame = false;
      options.onFirstFrame?.();
    }
  }

  // 11. Master Render Loop Heartbeat
  const loop = startRenderLoop(canvas, {
    update: (dt) => {
      update(dt);
    },
  });

  // 12. Resize Handler
  function resize(w?: number, h?: number): void {
    if (disposed) return;
    const targetWidth = Math.max(1, w ?? canvas.clientWidth ?? width);
    const targetHeight = Math.max(1, h ?? canvas.clientHeight ?? height);
    camera.aspect = targetWidth / targetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(targetWidth, targetHeight, false);
  }

  // 13. Complete Teardown
  function dispose(): void {
    if (disposed) return;
    disposed = true;

    // 1. Stop animation loop
    loop.dispose();

    // 2. Dispose UI
    ui?.dispose();

    // 3. Dispose navigation
    navigation.dispose();

    // 4. Dispose director & timeline
    director.dispose();
    controller.dispose();

    // 5. Dispose 3D world systems
    buildings.dispose();
    signage.dispose();
    vehicles.dispose();
    pedestrians.dispose();
    atmosphere.dispose();

    // 6. Dispose audio engine
    audio.dispose();

    // 7. Dispose ground meshes
    disposeGroundMeshes(groundGroup);

    // 8. Dispose renderer
    renderer.dispose();
  }

  return {
    canvas,
    scene,
    camera,
    renderer,
    layout,
    groundGroup,
    systems,
    audio,
    controller,
    director,
    navigation,
    ui,
    loop,

    isDisposed(): boolean {
      return disposed;
    },

    update,

    setYear(era: EraId, setOpts = {}): void {
      director.transitionTo(era, setOpts);
    },

    setQuality(tier: QualityTier): void {
      applyQuality(tier);
    },

    resize,
    dispose,
  };
}
