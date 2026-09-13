/**
 * Renderer abstraction for the SceneEngine.
 *
 * The engine never talks to WebGL directly: it consumes a minimal
 * {@link SceneRenderer} produced by an injectable {@link RendererFactory}.
 * Tests substitute a stub factory, and the shipped {@link createWebGLRenderer}
 * builds the real three.js/WebGL pipeline for browsers.
 *
 * The renderer owns the scene graph root (the object era modules add meshes
 * to), the camera pose application, and the atmosphere sink
 * ({@link SceneRenderer.applyLighting}).
 */

import * as THREE from 'three';
import type { CameraView } from './cameraRig';
import type { Color3, LightState, Vec3 } from './lighting';

/** Values every renderer factory needs at boot. */
export interface RendererFactoryOptions {
  /** Mount element the renderer may attach its canvas to. */
  readonly container: HTMLElement;
  readonly width: number;
  readonly height: number;
}

/**
 * The engine's contract with any rendering backend. `TScene` is the scene
 * graph root type the engine exposes via `getScene()` (for the shipped
 * renderer this is `THREE.Scene`).
 */
export interface SceneRenderer<TScene = unknown> {
  /** Root scene graph object that era modules mutate. */
  readonly scene: TScene;
  /**
   * Handle a container resize (in CSS pixels). The renderer resizes its
   * output surface and updates the camera frustum aspect.
   */
  resize(width: number, height: number): void;
  /** Apply the engine's current atmosphere/lighting state. */
  applyLighting(state: LightState): void;
  /** Point the renderer's camera at a world-space pose. */
  updateCamera(view: CameraView): void;
  /** Render one frame of the current scene. */
  render(): void;
  /** Release every geometry/material/listener/WGL resource owned here. */
  dispose(): void;
}

export type RendererFactory<TScene = unknown> = (options: RendererFactoryOptions) => SceneRenderer<TScene>;

/** Vertical sky gradient size (CSS pixels, 2D-canvas texture; no WebGL). */
const SKY_GRADIENT_SIZE = 256;

function toHexByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

/** sRGB Color3 (0..1) -> 0xRRGGBB number, three's ColorRepresentation. */
function colorToHex(color: Color3): number {
  return (toHexByte(color.r) << 16) | (toHexByte(color.g) << 8) | toHexByte(color.b);
}

/** sRGB Color3 (0..1) -> CSS rgb() string. */
function colorToCss(color: Color3): string {
  return `rgb(${toHexByte(color.r)}, ${toHexByte(color.g)}, ${toHexByte(color.b)})`;
}

function normalizeVec(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length <= 1e-9) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Paint a top→horizon vertical gradient on a tiny 2D canvas texture so the
 * scene background is a real sky gradient. Returns null when a canvas is
 * unavailable (headless); callers then fall back to a flat horizon color.
 */
function createSkyGradientTexture(top: Color3, horizon: Color3): THREE.CanvasTexture | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SKY_GRADIENT_SIZE;
  canvas.height = SKY_GRADIENT_SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const gradient = context.createLinearGradient(0, 0, 0, SKY_GRADIENT_SIZE);
  gradient.addColorStop(0, colorToCss(top));
  gradient.addColorStop(1, colorToCss(horizon));
  context.fillStyle = gradient;
  context.fillRect(0, 0, SKY_GRADIENT_SIZE, SKY_GRADIENT_SIZE);
  try {
    return new THREE.CanvasTexture(canvas);
  } catch {
    return null;
  }
}

/** Distance (world units) placed between the sun source and its target. */
const SUN_ORIGIN_DISTANCE = 1200;

/** Three.js/WebGL renderer backing the engine in browsers. */
export class WebGLSceneRenderer implements SceneRenderer<THREE.Scene> {
  readonly scene: THREE.Scene;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly canvas: HTMLCanvasElement;

  private fog: THREE.FogExp2 | null = null;
  private skyTexture: THREE.CanvasTexture | null = null;
  private disposed = false;

  constructor(options: RendererFactoryOptions) {
    const width = Math.max(1, Math.round(options.width));
    const height = Math.max(1, Math.round(options.height));

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    options.container.append(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 3000);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setSize(width, height, true);
  }

  resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyLighting(state: LightState): void {
    if (this.disposed) {
      return;
    }

    // Sky gradient (or flat horizon-color fallback when canvases are absent).
    const texture = createSkyGradientTexture(state.sky.top, state.sky.horizon);
    if (texture !== null) {
      this.skyTexture?.dispose();
      this.skyTexture = texture;
      this.scene.background = texture;
    } else {
      this.scene.background = new THREE.Color(colorToHex(state.sky.horizon));
    }

    // Exponential-squared fog.
    const fog = this.fog ?? new THREE.FogExp2(colorToHex(state.fog.color), state.fog.density);
    fog.color = new THREE.Color(colorToHex(state.fog.color));
    fog.density = state.fog.density;
    this.fog = fog;
    this.scene.fog = fog;

    // Directional sun: parallel rays along `direction`, sourced far away.
    const dir = normalizeVec(state.sun.direction);
    this.sun.color = new THREE.Color(colorToHex(state.sun.color));
    this.sun.intensity = state.sun.intensity;
    this.sun.position.set(-dir.x * SUN_ORIGIN_DISTANCE, -dir.y * SUN_ORIGIN_DISTANCE, -dir.z * SUN_ORIGIN_DISTANCE);

    // Global fill light.
    this.ambient.color = new THREE.Color(colorToHex(state.ambient.color));
    this.ambient.intensity = state.ambient.intensity;
  }

  updateCamera(view: CameraView): void {
    if (this.disposed) {
      return;
    }
    this.camera.position.set(view.position.x, view.position.y, view.position.z);
    this.camera.lookAt(view.lookAt.x, view.lookAt.y, view.lookAt.z);
  }

  render(): void {
    if (this.disposed) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    try {
      this.renderer.dispose();
    } catch {
      // Renderer teardown must never break an era swap.
    }
    this.skyTexture?.dispose();
    this.skyTexture = null;
    this.fog = null;
    this.scene.fog = null;
    this.canvas.remove();
  }
}

/**
 * Default renderer factory: builds the three.js WebGL pipeline inside
 * `container` (a full-size canvas is appended to it).
 */
export function createWebGLRenderer(options: RendererFactoryOptions): SceneRenderer<THREE.Scene> {
  return new WebGLSceneRenderer(options);
}