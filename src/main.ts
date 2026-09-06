/**
 * Application composition & boot — `src/main.ts`.
 *
 * This is the single composition owner for the City Time Period Timelapse.
 * It imports every producer module (the engine-core factory, the five era
 * scene modules, the top timeline UI + overlay, the Web Audio engine, the
 * era-agnostic simulation, and the post-processing stack) and wires them into
 * one runnable app:
 *
 *   1. Instantiates the renderer / camera / orbit+first-person controls / frame
 *      loop from `engine-core`.
 *   2. Imports the five era modules (each registers itself into the shared
 *      `eraRegistry` as a side effect) and reads their exported `eraXXXXProviders`
 *      bundles to build the era-parameterised simulation provider maps.
 *   3. Binds the top timeline slider (click / drag / arrow keys) and the
 *      `?era=YYYY` URL parameter.
 *   4. Drives the era-agnostic simulation with the current era's mesh providers,
 *      applies the era post-FX preset, crossfades the era ambience bed, and
 *      reveals the cinematic transition overlay on every switch.
 *   5. Boots to 1945 with the slider at 1945 and unlocks audio only on the
 *      first user gesture (autoplay policy).
 *
 * The exported `createApp` factory is the testable composition seam: it accepts
 * injected canvas / renderer / scene / audio / era-resolver so the composition
 * test can drive the whole app headlessly against a stubbed WebGL context. The
 * module-level `bootstrap()` at the bottom auto-starts the app in the browser.
 */

import * as THREE from 'three';

// Foundation + UI styles. The timeline/overlay styles are composed here (the
// composition owner's job) because no era/UI module imports them.
import './style.css';
import './ui/styles/timeline.css';

import type { EraContext, EraId, EraLayout } from './types';
import { BLOCK, CAMERA_ANCHORS, CURB, SIDEWALK, STREET } from './layout';

import { eraRegistry } from './eras/registry';
// Importing the five era modules registers each era into the shared singleton
// registry as a side effect, so bare imports make all five periods selectable.
import './eras/eras/1945';
import './eras/eras/1965';
import './eras/eras/1985';
import './eras/eras/2005';
import './eras/eras/2025';
// Provider bundles read by the composition to feed the simulation layer.
import { era1945Providers } from './eras/eras/1945';
import { era1965Providers } from './eras/eras/1965';
import { era1985Providers } from './eras/eras/1985';
import { era2005Providers } from './eras/eras/2005';
import { era2025Providers } from './eras/eras/2025';
import type { OutfitVariant as OutfitVariant2025, VehicleKind as VehicleKind2025 } from './eras/eras/2025.parts';
import type { VehicleKind as VehicleKind2005 } from './eras/eras/2005.parts';

import { createCamera, resizeCamera } from './engine/camera';
import { createRenderer } from './engine/renderer';
import { createEngine, readEraParam, type UpdateHook } from './engine/loop';

import { createTimeline, type Timeline } from './ui/timeline';
import { createOverlay, type Overlay } from './ui/overlay';

import { audioEngine, type AudioEngine } from './audio/engine';
import { createSimulation, type Simulation } from './sim/pedestrians';
import type { MeshProvider, SimulationProviders } from './sim/profiles';
import { createPostProcessing, type PostProcessing } from './post/processing';

/* -------------------------------------------------------------------------- */
/* Composition options / controller contract                                  */
/* -------------------------------------------------------------------------- */

/** Optionally-injectable dependencies so the app can be composed headlessly. */
export interface CreateAppOptions {
  /** Canvas the renderer/controls attach to. Defaults to `#view` in the browser. */
  canvas?: HTMLCanvasElement;
  /** Pre-built Three.js renderer (a stub in tests). Defaults to a real one. */
  renderer?: THREE.WebGLRenderer;
  /** Pre-built Three.js scene (tests share a scene). Defaults to a fresh one. */
  scene?: THREE.Scene;
  /** DOM mount for the top timeline. Defaults to `#timeline`, else body. */
  uiContainer?: HTMLElement;
  /** DOM mount for the transition overlay. Defaults to `#app`, else body. */
  overlayContainer?: HTMLElement;
  /** Audio engine (a stub in tests). Defaults to the process-wide singleton. */
  audio?: AudioEngine;
  /** Boot-era resolver. Defaults to the `?era=` URL parameter handler. */
  resolveEra?: (search?: string) => EraId | null;
}

/** The live composed app surface returned by {@link createApp}. */
export interface AppController {
  /** The shared era registry with all five eras registered. */
  readonly registry: typeof eraRegistry;
  /** The engine-core factory output (renderer, camera, controls, loop). */
  readonly engine: ReturnType<typeof createEngine>;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** The era-agnostic pedestrian + vehicle simulation. */
  readonly simulation: Simulation;
  /** The cinematic post-processing controller. */
  readonly post: PostProcessing;
  /** The top timeline slider UI. */
  readonly timeline: Timeline;
  /** The in-view transition overlay. */
  readonly overlay: Overlay;
  /** The era currently active in the scene. */
  readonly currentEra: EraId;
  /** Select an era programmatically (disposes old, builds new, applies FX/audio). */
  setEra(era: EraId): void;
  /** Advance one frame step with a raw delta (seconds); drives all update hooks. */
  tick(delta: number): number;
  /** Resize the drawing buffer to the canvas mount dimensions. */
  resize(): void;
  /** Start the requestAnimationFrame loop (browser only). */
  start(): void;
  /** Tear down the app and release every owned resource. */
  dispose(): void;
}

/* -------------------------------------------------------------------------- */
/* Shared layout + build context                                              */
/* -------------------------------------------------------------------------- */

/** The frozen layout the era-agnostic simulation and every era share. */
const LAYOUT: EraLayout = {
  block: BLOCK,
  street: STREET,
  sidewalk: SIDEWALK,
  curb: CURB,
  cameraAnchors: [...CAMERA_ANCHORS],
};

/** No-op asset loader used when building era scenes (everything is procedural). */
const makeLoader = (): EraContext['loader'] => ({
  load: async () => '#',
  release: () => undefined,
});

/** Recursively release geometries + materials owned by a provider-built mesh. */
function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) {
      for (const m of material) m.dispose();
    } else if (material) {
      material.dispose();
    }
  });
}

/** Adapt a mesh builder into the simulation's generic `MeshProvider` contract. */
function meshProvider(build: (seed: number) => THREE.Object3D): MeshProvider {
  return {
    build: (seed) => build(seed),
    dispose: (mesh) => disposeObject3D(mesh as THREE.Object3D),
  };
}

/** A simple boxy humanoid used to bridge eras that carry art data, not a builder. */
function buildGenericPedestrian(top: number, bottom: number, shoe: number, hair: number): THREE.Group {
  const group = new THREE.Group();
  const material = (color: number) => new THREE.MeshStandardMaterial({ color });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const SKIN = 0xd9a68c;
  box(0.2, 0.7, 0.22, -0.12, 0.35, 0, bottom); // legs
  box(0.2, 0.7, 0.22, 0.12, 0.35, 0, bottom);
  box(0.26, 0.12, 0.4, -0.12, 0.06, 0, shoe); // shoes
  box(0.26, 0.12, 0.4, 0.12, 0.06, 0, shoe);
  box(0.5, 0.6, 0.32, 0, 1.05, 0, top); // torso
  box(0.3, 0.3, 0.3, 0, 1.5, 0, SKIN); // head
  box(0.32, 0.1, 0.34, 0, 1.72, 0, hair); // hair
  return group;
}

/* -------------------------------------------------------------------------- */
/* Per-era simulation provider adapters                                       */
/* -------------------------------------------------------------------------- */

/** Factory kind / outfit enumerations for the 2025 + 2005 provider bundles. */
const OUTFITS_2025: readonly OutfitVariant2025[] = ['techwear', 'athleisure', 'puffer', 'business', 'casual'];
const VEHICLES_2025: readonly VehicleKind2025[] = ['ev', 'hybrid', 'ebike', 'scooter', 'evBus'];
const VEHICLES_2005: readonly VehicleKind2005[] = ['sedan', 'suv', 'hatchback', 'van'];

/** Mid-century accent palette (hex strings) reused by the 1965 vehicle adapters. */
const PALETTE_1965_VEHICLE = ['#e0e0e0', '#c0392b', '#2f6f9f', '#d4af37', '#f2f2f2'];

/**
 * Build the full `pedestrian`+`vehicle` provider maps for all five eras. This is
 * the composition owner's bridge between each era's exported `eraXXXXProviders`
 * bundle and the era-agnostic simulation's `SimulationProviders` keyed by the
 * per-era profile ids in `src/sim/profiles.ts`.
 */
function assembleSimulationProviders(): SimulationProviders {
  const pedestrian = new Map<string, MeshProvider>();
  const vehicle = new Map<string, MeshProvider>();

  // 1945 — provider exposes ready-to-build outfit + vehicle factories.
  {
    const outfits = era1945Providers.pedestrianOutfits;
    const cars = era1945Providers.vehicles;
    pedestrian.set('pedestrians-1945', meshProvider((seed) => outfits[seed % outfits.length].build()));
    vehicle.set('vehicles-1945', meshProvider((seed) => cars[seed % cars.length].build()));
  }

  // 1965 — provider exposes outfit data + vehicle builders + buildPedestrian.
  {
    const builders = era1965Providers.vehicleBuilders as Record<string, (color: string) => THREE.Group>;
    const names = Object.keys(builders);
    const variants = ['suit', 'dress', 'skirt'] as const;
    pedestrian.set(
      'pedestrians-1965',
      meshProvider((seed) => {
        const outfit = era1965Providers.outfits[seed % era1965Providers.outfits.length];
        return era1965Providers.buildPedestrian(outfit, variants[seed % variants.length]);
      }),
    );
    vehicle.set(
      'vehicles-1965',
      meshProvider((seed) => {
        const name = names[seed % names.length];
        return builders[name](PALETTE_1965_VEHICLE[seed % PALETTE_1965_VEHICLE.length]);
      }),
    );
  }

  // 1985 — provider exposes vehicle builders into a caller group + outfit data.
  {
    const builders = era1985Providers.vehicleProviders;
    pedestrian.set(
      'pedestrians-1985',
      meshProvider((seed) => {
        const variant = era1985Providers.outfitVariants[seed % era1985Providers.outfitVariants.length];
        return buildGenericPedestrian(variant.windbreaker, variant.denim, variant.sneaker, variant.hair);
      }),
    );
    vehicle.set(
      'vehicles-1985',
      meshProvider((seed) => {
        const provider = builders[seed % builders.length];
        const group = new THREE.Group();
        provider.build(group);
        return group;
      }),
    );
  }

  // 2005 — provider exposes makePedestrian / makeVehicle mesh factories.
  {
    pedestrian.set(
      'pedestrians-2005',
      meshProvider((seed) => era2005Providers.makePedestrian(era2005Providers.outfits[seed % era2005Providers.outfits.length])),
    );
    vehicle.set(
      'vehicles-2005',
      meshProvider((seed) =>
        era2005Providers.makeVehicle(VEHICLES_2005[seed % VEHICLES_2005.length], era2005Providers.vehicleColors[seed % era2005Providers.vehicleColors.length]),
      ),
    );
  }

  // 2025 — provider exposes outfit() / vehicle() factories.
  {
    pedestrian.set('pedestrians-2025', meshProvider((seed) => era2025Providers.outfit(OUTFITS_2025[seed % OUTFITS_2025.length])));
    vehicle.set('vehicles-2025', meshProvider((seed) => era2025Providers.vehicle(VEHICLES_2025[seed % VEHICLES_2025.length])));
  }

  return { pedestrian, vehicle };
}

/* -------------------------------------------------------------------------- */
/* The composition factory                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Compose the full app from every producer module. Returns an {@link AppController}
 * that exposes the engine, simulation, post-FX, timeline and overlay so tests can
 * assert integrated behaviour. In the browser, {@link AppController.start} drives
 * the frame loop.
 */
export function createApp(options: CreateAppOptions = {}): AppController {
  // --- DOM mounts -----------------------------------------------------------
  const canvas =
    options.canvas ?? (typeof document !== 'undefined' ? document.querySelector<HTMLCanvasElement>('#view') : undefined);
  if (!canvas) {
    throw new Error('createApp requires a canvas (pass options.canvas or mount #view).');
  }
  const uiContainer =
    options.uiContainer ??
    (typeof document !== 'undefined'
      ? (document.querySelector<HTMLElement>('#timeline') ?? document.body)
      : (undefined as unknown as HTMLElement));
  const overlayContainer =
    options.overlayContainer ??
    (typeof document !== 'undefined'
      ? (document.querySelector<HTMLElement>('#app') ?? document.body)
      : (undefined as unknown as HTMLElement));

  // --- Engine-core: renderer, camera, controls, frame loop ------------------
  const session = createRenderer(canvas, { renderer: options.renderer, scene: options.scene });
  const { renderer, scene } = session;
  const camera = createCamera();

  // --- Era-agnostic simulation (providers assembled from era bundles) -------
  const simulation = createSimulation(LAYOUT);
  simulation.setProviders(assembleSimulationProviders());

  // --- Live composition state -------------------------------------------------
  let activeEra: EraId = '1945';
  let audioUnlocked = false;
  let disposed = false;
  const audio = options.audio ?? audioEngine;

  // Declared before the engine so its onBootEra callback can reference them.
  let timeline: Timeline | undefined;
  let overlay: Overlay | undefined;

  // Drive the active era content + the simulation through the engine loop hooks.
  const contentHook: UpdateHook = (delta) => {
    eraRegistry.getEra(activeEra)?.update(delta);
  };
  const simulationHook: UpdateHook = (delta) => {
    simulation.update(delta, { x: camera.position.x, z: camera.position.z });
  };

  // Crossfade the ambience bed for an era once audio has been unlocked.
  const applyAudio = (era: EraId): void => {
    if (audioUnlocked) audio.setEra(era);
  };

  // Unlock the audio context. MUST run inside a user gesture (autoplay policy).
  const unlockAudio = (): void => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audio.unlock();
  };

  // --- Cinematic post-processing over the shared scene/camera ---------------
  const post = createPostProcessing({ engine: { renderer, scene, camera } });

  // Transition: dispose the old graph, rebuild the new one, swap sim providers,
  // apply the era post-FX preset, frame the camera, sync the slider, and
  // crossfade the ambience bed (once audio is unlocked).
  const activateEra = (era: EraId): void => {
    if (disposed) return;

    // Dispose the outgoing era graph and release its resources.
    eraRegistry.getEra(activeEra)?.dispose();

    activeEra = era;

    // Switch the era-agnostic simulation to this era's profile + providers.
    simulation.setProfile(era);

    // Build the incoming era scene graph.
    const content = eraRegistry.getEra(era);
    if (!content) {
      throw new Error(`Era '${era}' is not registered; cannot build it.`);
    }
    const context: EraContext = { scene, loader: makeLoader(), root: uiContainer, year: era };
    content.build(context);

    // Era-tuned cinematic look + camera framing for this period.
    post.setEraPreset(era);
    engine.controls.frameEra(era);

    // Keep the timeline slider in sync (programmatic boot does not fire onSelect).
    timeline?.setEra(era);

    // Crossfade the ambience bed (deferred until the first audio unlock).
    applyAudio(era);
  };

  // A timeline selection is itself a user gesture: unlock audio and drive the switch.
  const handleSelect = (era: EraId): void => {
    if (era === activeEra) return;
    unlockAudio();
    activateEra(era);
    overlay?.showTransition(era);
  };

  const engine = createEngine({
    renderer,
    scene,
    camera,
    canvas,
    hooks: { content: contentHook, ambience: null, simulation: simulationHook },
    resolveEra: options.resolveEra ?? readEraParam,
    initialEra: '1945',
    onBootEra: (era) => {
      activeEra = era;
      timeline?.setEra(era);
    },
  });

  timeline = createTimeline(uiContainer, {
    onSelect: (era) => handleSelect(era),
  });

  overlay = createOverlay(overlayContainer);

  // Boot to 1945 or the `?era=` value. The transition overlay is shown once and
  // auto-hides; audio stays locked until the first user gesture (see below).
  const bootEra = engine.readEraParam() ?? '1945';
  activateEra(bootEra);
  overlay.showTransition(bootEra);

  // First-gesture audio unlock: the boot overlay unlocks audio and disappears.
  const handleFirstGesture = (): void => {
    unlockAudio();
    applyAudio(activeEra);
    overlay?.hide();
    window.removeEventListener('pointerdown', handleFirstGesture);
    window.removeEventListener('keydown', handleFirstGesture);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);
  }

  // --- RAF loop driver (browser only) ---------------------------------------
  let rafId: number | null = null;
  let lastNow = 0;

  const tick = (delta: number): number => {
    if (disposed) return 0;
    const clamped = engine.tick(delta);
    post.tick(delta);
    return clamped;
  };

  const start = (): void => {
    if (disposed || typeof requestAnimationFrame !== 'function') return;
    lastNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const frame = (now: number): void => {
      if (disposed) return;
      const delta = Math.min(1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      tick(delta);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  };

  const resize = (): void => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width > 0 && height > 0) {
      renderer.setSize(width, height);
      resizeCamera(camera, width, height);
    }
  };

  const setEra = (era: EraId): void => {
    if (era === activeEra) return;
    activateEra(era);
    overlay?.showTransition(era);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    }
    engine.dispose();
    post.dispose();
    simulation.dispose();
    timeline?.dispose();
    overlay?.dispose();
    audio.dispose();
  };

  return {
    registry: eraRegistry,
    engine,
    renderer,
    scene,
    camera,
    simulation,
    post,
    timeline,
    overlay,
    get currentEra() {
      return activeEra;
    },
    setEra,
    tick,
    resize,
    start,
    dispose,
  };
}

/* -------------------------------------------------------------------------- */
/* Browser bootstrap                                                          */
/* -------------------------------------------------------------------------- */

let activeApp: AppController | null = null;

/**
 * Auto-start the composed app when main.ts loads in a real browser with the
 * foundation mount points present (see index.html). Headless imports (tests)
 * leave the DOM empty, so this returns without starting.
 */
function bootstrap(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const canvas = document.querySelector<HTMLCanvasElement>('#view');
  if (!canvas) return;
  activeApp = createApp({ canvas });
  activeApp.resize();
  activeApp.start();
  window.addEventListener('resize', () => activeApp?.resize());
  window.addEventListener('beforeunload', () => {
    activeApp?.dispose();
    activeApp = null;
  });
}

bootstrap();