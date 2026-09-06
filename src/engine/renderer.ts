import * as THREE from 'three';

/**
 * Rendering engine core — owns the {@link THREE.WebGLRenderer} and the scene
 * graph root. This module is the only place that touches renderer internals
 * (tone mapping, color space, shadow map, default lighting). Era, UI, audio
 * and simulation modules interact with the scene and camera, never the
 * renderer directly.
 *
 * Lighting in Three r180 is physically based by default: point/spot lights are
 * luminous-intensity based and directional light intensity is in lux. We set
 * ACES filmic tone mapping and a neutral physically-blanced light rig that era
 * scenes build on top of.
 */

/** The three lights installed into the scene by default. */
export interface LightRig {
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
}

/** Everything the engine needs to draw a frame: renderer, scene, lights. */
export interface RendererSession {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  lights: LightRig;
  /** Resize the drawing buffer to the given logical pixel size. */
  resize(width: number, height: number): void;
}

/**
 * Dependency injection point so tests can boot the engine without opening a
 * real WebGL context. `renderer`/`scene` fall back to freshly created real
 * instances when omitted.
 */
export interface RendererDeps {
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
}

/** Neutral dusk-ish backdrop so empty scenes still read as a lit environment. */
const BACKGROUND_COLOR = 0x0a0e16;

/** Maximum device pixel ratio; keeps the drawing buffer sane on retina. */
const MAX_PIXEL_RATIO = 2;

/**
 * Apply the renderer profile shared by every frame: ACES filmic tone mapping,
 * sRGB output, and soft shadows. Accepts a stub renderer (no shadowMap) for
 * headless tests.
 */
export function configureRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  if (typeof renderer.setPixelRatio === 'function') {
    const ratio = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_PIXEL_RATIO);
    renderer.setPixelRatio(ratio);
  }
}

/**
 * Create the WebGL renderer and scene root with physically-correct lighting.
 *
 * @param canvas The canvas the renderer draws into.
 * @param deps Optional injected renderer/scene for headless tests.
 */
export function createRenderer(canvas: HTMLCanvasElement, deps: RendererDeps = {}): RendererSession {
  const renderer =
    deps.renderer ??
    new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  const scene = deps.scene ?? new THREE.Scene();

  configureRenderer(renderer);
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  // Physically-based default light rig. Intensities are tuned for the city
  // block scale; era scenes add their own mood lighting on top.
  const ambient = new THREE.AmbientLight(0x445066, 2.0);
  const sun = new THREE.DirectionalLight(0xfff3e0, 7.0);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  const fill = new THREE.DirectionalLight(0x88b4ff, 2.0);
  fill.position.set(-50, 80, -40);

  scene.add(ambient, sun, fill);

  function resize(width: number, height: number): void {
    renderer.setSize(width, height);
  }

  return { renderer, scene, lights: { ambient, sun, fill }, resize };
}