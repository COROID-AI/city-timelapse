/**
 * SceneEngine: the era-agnostic runtime every era module plugs into.
 *
 * Owns and wires the four foundation pieces:
 * - a renderer created through an injectable {@link RendererFactory} (stub
 *   in tests, three.js/WebGL in browsers),
 * - a fixed-timestep {@link RenderLoop} that dispatches update callbacks
 *   (`onFrame`) and drives one render pass per frame,
 * - a damped {@link CameraRig} exposing orbit + walk navigation,
 * - the atmosphere pipeline (`setAtmosphere` -> pure `applyAtmosphere` ->
 *   `renderer.applyLighting`).
 *
 * The engine stays WebGL-free and era-agnostic: no era imports, no WebGL
 * imports — consumers hand it a factory and `AtmospherePreset` objects.
 *
 * Lifecycle: construct -> (start | step)* -> dispose. All methods are inert
 * after dispose.
 */

import type { AtmospherePreset, LightState } from './lighting';
import { applyAtmosphere, DEFAULT_LIGHT_STATE } from './lighting';
import type { CameraRigOptions } from './cameraRig';
import { CameraRig } from './cameraRig';
import type { RenderLoopOptions } from './loop';
import { RenderLoop } from './loop';
import type { RendererFactory, SceneRenderer } from './renderer';
import { createWebGLRenderer } from './renderer';
import type { NavigationController } from '../controls/navigation';
import { createNavigationController } from '../controls/navigation';

/** Input targets for the built-in navigation controls (optional). */
export interface NavigationTargets {
  /** Element receiving pointer drag / wheel events. */
  readonly pointerTarget: EventTarget;
  /** Element receiving keyboard events. Defaults to `pointerTarget`. */
  readonly keyTarget?: EventTarget;
}

export interface SceneEngineOptions<TScene = unknown> {
  /** DOM mount for the renderer's output surface. */
  readonly container: HTMLElement;
  /**
   * Renderer factory. Defaults to {@link createWebGLRenderer} (three.js).
   * Tests inject a stub factory to stay headless.
   */
  readonly factory?: RendererFactory<TScene>;
  /** Explicit initial size in CSS pixels (defaults to the container size). */
  readonly width?: number;
  readonly height?: number;
  /** Initial atmosphere preset (defaults to the neutral baseline). */
  readonly atmosphere?: AtmospherePreset | null;
  /** Camera rig options (mode, orbit limits, damping, speeds). */
  readonly camera?: CameraRigOptions;
  /** Render loop options (fixed step, max frame delta, clock). */
  readonly loop?: RenderLoopOptions;
  /** Wire the built-in navigation controls to the rig. */
  readonly navigation?: NavigationTargets;
}

const DEFAULT_RENDER_SIZE = Object.freeze({ width: 800, height: 600 });

interface ResizeObserverLike {
  new (callback: () => void): {
    observe(target: Element): void;
    disconnect(): void;
  };
}

function readContainerSize(container: HTMLElement, width?: number, height?: number): { width: number; height: number } {
  let w = width;
  let h = height;
  let rectWidth = 0;
  let rectHeight = 0;
  try {
    const rect = container.getBoundingClientRect();
    rectWidth = rect.width;
    rectHeight = rect.height;
  } catch {
    // Fall through to clientWidth/clientHeight/defaults.
  }
  if (w === undefined || w < 1) {
    w = rectWidth;
  }
  if (h === undefined || h < 1) {
    h = rectHeight;
  }
  if (w === undefined || w < 1) {
    w = container.clientWidth;
  }
  if (h === undefined || h < 1) {
    h = container.clientHeight;
  }
  if (w === undefined || w < 1) {
    w = DEFAULT_RENDER_SIZE.width;
  }
  if (h === undefined || h < 1) {
    h = DEFAULT_RENDER_SIZE.height;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export class SceneEngine<TScene = unknown> {
  private readonly container: HTMLElement;
  private readonly renderer: SceneRenderer<TScene>;
  private readonly loop: RenderLoop;
  private readonly cameraRig: CameraRig;

  private lightState: LightState;
  private navigationController: NavigationController | null;
  private resizeObserver: InstanceType<ResizeObserverLike> | null = null;
  private windowResizeAttached = false;

  private width: number;
  private height: number;
  private disposed = false;

  private readonly onWindowResize = (): void => {
    this.resize();
  };

  constructor(options: SceneEngineOptions<TScene>) {
    this.container = options.container;
    const size = readContainerSize(options.container, options.width, options.height);
    this.width = size.width;
    this.height = size.height;

    const factory: RendererFactory<TScene> =
      options.factory ?? (createWebGLRenderer as RendererFactory<TScene>);
    this.renderer = factory({ container: options.container, width: this.width, height: this.height });

    this.loop = new RenderLoop(options.loop);
    this.cameraRig = new CameraRig(options.camera);
    this.lightState = applyAtmosphere(options.atmosphere, DEFAULT_LIGHT_STATE);

    // Fixed-step pipeline: navigation input + camera damping first, then the
    // render pass every frame.
    this.loop.addUpdate((deltaSeconds) => {
      this.navigationController?.update(deltaSeconds);
      this.cameraRig.update(deltaSeconds);
    });
    this.loop.onRender(() => {
      this.renderer.updateCamera(this.cameraRig.getView());
      this.renderer.render();
    });

    this.navigationController =
      options.navigation !== undefined
        ? createNavigationController({ rig: this.cameraRig, ...options.navigation })
        : null;

    this.renderer.applyLighting(this.lightState);
    this.attachResizeWatcher();
  }

  // ------------------------------------------------------------------
  // Public surface (consumed by scene-integration / era modules)
  // ------------------------------------------------------------------

  /** The scene graph root era modules populate (THREE.Scene in browsers). */
  getScene(): TScene {
    return this.renderer.scene;
  }

  /** The damped navigation camera rig (orbit / walk). */
  getCamera(): CameraRig {
    return this.cameraRig;
  }

  /** The current normalized atmosphere state. */
  getLighting(): LightState {
    return this.lightState;
  }

  /** Current output size in CSS pixels. */
  getSize(): { readonly width: number; readonly height: number } {
    return { width: this.width, height: this.height };
  }

  get isRunning(): boolean {
    return this.loop.isRunning;
  }

  /**
   * Register a per-fixed-step update callback (delta in seconds). Returns an
   * unsubscribe function.
   */
  onFrame(callback: (deltaSeconds: number) => void): () => void {
    return this.loop.addUpdate(callback);
  }

  /**
   * Apply an atmosphere preset. Era-agnostic: mapping era → preset belongs
   * to era-furniture/scene-integration. Passing null keeps the current
   * state; applying the same preset twice is idempotent.
   */
  setAtmosphere(preset: AtmospherePreset | null | undefined): void {
    if (this.disposed) {
      return;
    }
    this.lightState = applyAtmosphere(preset, this.lightState);
    this.renderer.applyLighting(this.lightState);
  }

  /** Resize the renderer, optionally to an explicit CSS-pixel size. */
  resize(width?: number, height?: number): void {
    if (this.disposed) {
      return;
    }
    const size = readContainerSize(this.container, width, height);
    if (size.width === this.width && size.height === this.height) {
      return;
    }
    this.width = size.width;
    this.height = size.height;
    this.renderer.resize(size.width, size.height);
  }

  /** Start the real-time render loop. */
  start(): void {
    if (this.disposed) {
      return;
    }
    this.loop.start();
  }

  /** Stop the real-time render loop (frames already queued finish). */
  stop(): void {
    this.loop.stop();
  }

  /**
   * Advance fixed simulation steps by `frameDeltaSeconds` and render one
   * frame. Deterministic ticking for tests and fixed-step consumers.
   */
  step(frameDeltaSeconds: number): void {
    if (this.disposed) {
      return;
    }
    this.loop.step(frameDeltaSeconds);
  }

  /**
   * Stop the loop, detach resize/navigation listeners and dispose every
   * renderer resource (geometries, materials, canvases). Era swaps call
   * this before swapping the scene — afterwards the engine is inert.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.loop.dispose();
    this.navigationController?.dispose();
    this.navigationController = null;
    this.detachResizeWatcher();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------
  // Resize watching
  // ------------------------------------------------------------------

  private attachResizeWatcher(): void {
    const ResizeObserverLike = (globalThis as { ResizeObserver?: ResizeObserverLike }).ResizeObserver;
    if (typeof ResizeObserverLike === 'function') {
      try {
        this.resizeObserver = new ResizeObserverLike(() => {
          this.resize();
        });
        this.resizeObserver.observe(this.container);
        return;
      } catch {
        this.resizeObserver = null;
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
      this.windowResizeAttached = true;
    }
  }

  private detachResizeWatcher(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.windowResizeAttached && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
      this.windowResizeAttached = false;
    }
  }
}