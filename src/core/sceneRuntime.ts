import { Camera, Group, Mesh, Object3D, PerspectiveCamera, Scene } from 'three';

/**
 * Headless-safe 3D runtime for the city block.
 *
 * SceneRuntime is WebGL-agnostic: it owns a three.js scene graph, camera,
 * renderer abstraction and frame loop, and never imports WebGLRenderer. In the
 * browser t11-app-integration supplies a RendererLike backed by WebGLRenderer;
 * in Node (unit tests, later era-layer tests) the runtime is driven with
 * step() and a null renderer.
 */

/**
 * Minimal renderer contract. three.js WebGLRenderer satisfies this
 * structurally; tests provide a mock.
 */
export interface RendererLike {
  readonly domElement?: HTMLElement;
  setSize(width: number, height: number): void;
  render(scene: Object3D, camera: Camera): void;
  dispose(): void;
}

/** Per-frame timing passed to layer update hooks. */
export interface FrameState {
  /** Seconds elapsed since the runtime was constructed. */
  readonly time: number;
  /** Seconds elapsed since the previous frame. */
  readonly delta: number;
}

/** A named scene contribution registered through SceneRuntime.attachLayer. */
export interface SceneLayer {
  readonly id: string;
  /** Build the layer's root object; added to the scene graph on attach. */
  createRoot?(): Object3D;
  /** Called every frame while the runtime is started, or on each step(). */
  update?(state: FrameState): void;
  /** Release layer-owned resources on runtime dispose. */
  dispose?(): void;
}

export function createDefaultScene(): Scene {
  return new Scene();
}

export function createDefaultCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 3000);
  camera.position.set(0, 110, 170);
  camera.lookAt(0, 0, 0);
  return camera;
}

export interface SceneRuntimeOptions {
  scene?: Scene;
  camera?: PerspectiveCamera;
  renderer?: RendererLike | null;
  /** Time source returning epoch milliseconds (defaults to performance.now). */
  timeSource?(): number;
  /** Frame scheduler used by start() (defaults to requestAnimationFrame). */
  raf?(callback: FrameRequestCallback): number;
  /** Cancels a scheduled frame (defaults to cancelAnimationFrame). */
  cancelRaf?(handle: number): void;
}

interface RegisteredLayer {
  readonly layer: SceneLayer;
  readonly root: Object3D;
}

const DEFAULT_FRAME_MS = 16;
/** Largest single-frame delta accepted by the loop (clamps tab-switch jumps). */
const MAX_DELTA_SECONDS = 0.05;

function defaultTimeSource(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Wrap globals so the browser receiver (window) is preserved on invocation. */
function browserRaf(callback: FrameRequestCallback): number {
  return requestAnimationFrame(callback);
}

function browserCancelRaf(handle: number): void {
  cancelAnimationFrame(handle);
}

function defaultRaf(callback: FrameRequestCallback): number {
  return setTimeout(() => callback(defaultTimeSource()), DEFAULT_FRAME_MS) as unknown as number;
}

function noopCancel(_handle: number): void {
  /* No cancellation available (Node fallback); the loop guards on `running`. */
}

export class SceneRuntime {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;

  private renderer: RendererLike | null;
  private readonly layers = new Map<string, RegisteredLayer>();
  private readonly timeSource: () => number;
  private readonly raf: (callback: FrameRequestCallback) => number;
  private readonly cancelRaf: (handle: number) => void;
  private rafHandle: number | null = null;
  private running = false;
  private lastFrameTimeMs = 0;
  private elapsedSeconds = 0;

  constructor(options: SceneRuntimeOptions = {}) {
    this.scene = options.scene ?? createDefaultScene();
    this.camera = options.camera ?? createDefaultCamera();
    this.renderer = options.renderer ?? null;
    this.timeSource = options.timeSource ?? defaultTimeSource;
    this.raf =
      options.raf ??
      (typeof requestAnimationFrame === 'function' ? browserRaf : defaultRaf);
    this.cancelRaf =
      options.cancelRaf ??
      (typeof cancelAnimationFrame === 'function' ? browserCancelRaf : noopCancel);
  }

  get layerCount(): number {
    return this.layers.size;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Register a layer and add its root object to the scene graph. */
  attachLayer(layer: SceneLayer): SceneLayer {
    if (this.layers.has(layer.id)) {
      throw new Error(`SceneRuntime: layer "${layer.id}" is already attached.`);
    }
    const root = layer.createRoot ? layer.createRoot() : new Group();
    root.name = root.name || `layer:${layer.id}`;
    this.scene.add(root);
    this.layers.set(layer.id, { layer, root });
    return layer;
  }

  /** Remove a layer's root from the scene graph. Returns false if unknown. */
  detachLayer(layerId: string): boolean {
    const registered = this.layers.get(layerId);
    if (!registered) return false;
    this.scene.remove(registered.root);
    this.layers.delete(layerId);
    return true;
  }

  hasLayer(layerId: string): boolean {
    return this.layers.has(layerId);
  }

  /** Start the frame loop. Safe to call when already running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTimeMs = this.timeSource();
    this.scheduleNextFrame();
  }

  /** Stop the frame loop. Safe to call when already stopped. */
  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      this.cancelRaf(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /**
   * Advance one frame manually. This is the headless primitive used by unit
   * tests and any non-rendered layer update; it runs layer updates and, when a
   * renderer is attached, issues a render.
   */
  step(deltaSeconds = 1 / 60): void {
    this.elapsedSeconds += deltaSeconds;
    const state: FrameState = Object.freeze({
      time: this.elapsedSeconds,
      delta: Math.max(0, deltaSeconds),
    });
    for (const { layer } of this.layers.values()) {
      layer.update?.(state);
    }
    this.renderer?.render(this.scene, this.camera);
  }

  /**
   * Resize the viewport: updates the camera aspect and the renderer backing
   * store. With no arguments the renderer's DOM element dimensions are used.
   */
  resize(width?: number, height?: number): void {
    const dom = this.renderer?.domElement;
    const w = width ?? dom?.clientWidth;
    const h = height ?? dom?.clientHeight;
    if (w === undefined || h === undefined || w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h);
  }

  /** Stop the loop, dispose layers/renderer and release the scene graph. */
  dispose(): void {
    this.stop();
    for (const { layer } of this.layers.values()) {
      layer.dispose?.();
    }
    this.layers.clear();
    this.disposeSceneAssets();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }

  private scheduleNextFrame(): void {
    const loop = (now: number): void => {
      if (!this.running) return;
      const nowMs = typeof now === 'number' ? now : this.timeSource();
      const delta = (nowMs - this.lastFrameTimeMs) / 1000;
      this.lastFrameTimeMs = nowMs;
      this.step(Math.max(0, Math.min(delta, MAX_DELTA_SECONDS)));
      if (!this.running) return;
      this.rafHandle = this.raf(loop);
    };
    this.rafHandle = this.raf(loop);
  }

  private disposeSceneAssets(): void {
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material?.dispose();
    });
  }
}
