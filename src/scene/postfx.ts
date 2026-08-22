/**
 * Cinematic post-processing pipeline for the city era timelapse.
 *
 * EffectComposer chain:
 *
 *   RenderPass -> UnrealBloomPass -> FXAA (ShaderPass) -> vignette (ShaderPass)
 *
 * Tuning contract:
 * - Bloom stays subtle (strength ~0.35) and uses a HIGH threshold (~0.85) so
 *   only emissive pixels — signage, lamps, neon — exceed it. Ordinary lit
 *   geometry sits far below the threshold and never blooms.
 * - FXAA provides cheap antialiasing without needing an MSAA render target.
 * - The vignette darkens corners gently (max ~32%) for a cinematic frame.
 *
 * Resilience contract (the scene must ALWAYS display):
 * - The heavy `three/examples/jsm` post-processing modules load lazily via
 *   dynamic import. Until they arrive — or forever, if the import fails —
 *   render() delegates to plain `renderer.render(scene, camera)`.
 * - Any composer construction, render, or resize failure permanently
 *   degrades this instance to direct rendering (single console warning).
 * - A lost WebGL context skips the composer frame-by-frame; if the context
 *   returns while the composer is healthy, effects resume automatically.
 */

import * as THREE from 'three';

/** Minimal structural contract for anything holding GPU resources. */
interface DisposableLike {
  dispose(): void;
}

/** Structural subset of EffectComposer the pipeline actually uses. */
interface ComposerLike extends DisposableLike {
  addPass(pass: DisposableLike): void;
  setSize(width: number, height: number): void;
  render(deltaTime?: number): void;
}

/** Structural subset of ShaderPass the pipeline actually uses. */
interface ShaderPassLike extends DisposableLike {
  uniforms: Record<string, { value?: unknown }>;
}

/**
 * The lazily imported `three/examples/jsm` post-processing modules, typed
 * structurally so tests can inject lightweight fakes through
 * {@link CreatePostFXOptions.modules}.
 */
export interface ComposerModules {
  EffectComposer: new (renderer: THREE.WebGLRenderer) => ComposerLike;
  RenderPass: new (scene: THREE.Scene, camera: THREE.Camera) => DisposableLike;
  UnrealBloomPass: new (
    resolution: THREE.Vector2,
    strength: number,
    radius: number,
    threshold: number,
  ) => DisposableLike;
  ShaderPass: new (shader: object) => ShaderPassLike;
  FXAAShader: object;
}

/** Public surface consumed by the renderer shell (main.ts). */
export interface PostFX {
  /** Renders one frame: composer pipeline, or a direct render when degraded. */
  render(): void;
  /** Resizes internal targets; mirrors onto the renderer when degraded. */
  resize(width: number, height: number): void;
  /** Releases GPU resources. Idempotent; renders become inert afterwards. */
  dispose(): void;
}

/**
 * Optional creation seam. Production callers omit it and the composer modules
 * load lazily via dynamic import; tests inject fakes (or a rejected promise)
 * to exercise the exact same code paths deterministically.
 */
export interface CreatePostFXOptions {
  modules?: ComposerModules | Promise<ComposerModules>;
}

interface PostFXBundle {
  composer: ComposerLike;
  fxaaPass: ShaderPassLike;
  disposables: DisposableLike[];
}

/**
 * Emissive-only bloom tuning: the low strength keeps the glow subtle and the
 * high threshold means only bright signage/lamp/neon pixels bloom.
 */
const BLOOM_STRENGTH = 0.35;
const BLOOM_RADIUS = 0.6;
const BLOOM_THRESHOLD = 0.85;

/** Gentle corner-darkening ceiling (0..1) for the cinematic vignette. */
const VIGNETTE_STRENGTH = 0.32;

const POSTFX_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VIGNETTE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float strength;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    float d = distance(vUv, vec2(0.5));
    float falloff = smoothstep(0.42, 0.98, d);
    gl_FragColor = vec4(texel.rgb * (1.0 - strength * falloff), texel.a);
  }
`;

/** ShaderPass definition for the gentle vignette (uniforms cloned per pass). */
const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: VIGNETTE_STRENGTH },
  },
  vertexShader: POSTFX_VERTEX_SHADER,
  fragmentShader: VIGNETTE_FRAGMENT_SHADER,
};

async function loadComposerModules(): Promise<ComposerModules> {
  const [effectComposer, renderPass, unrealBloomPass, shaderPass, fxaaShader] = await Promise.all([
    import('three/examples/jsm/postprocessing/EffectComposer.js'),
    import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
    import('three/examples/jsm/postprocessing/ShaderPass.js'),
    import('three/examples/jsm/shaders/FXAAShader.js'),
  ]);
  return {
    EffectComposer: effectComposer.EffectComposer,
    RenderPass: renderPass.RenderPass,
    UnrealBloomPass: unrealBloomPass.UnrealBloomPass,
    ShaderPass: shaderPass.ShaderPass,
    FXAAShader: fxaaShader.FXAAShader,
  };
}

function buildBundle(
  modules: ComposerModules,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostFXBundle {
  const disposables: DisposableLike[] = [];
  try {
    const composer = new modules.EffectComposer(renderer);
    disposables.push(composer);

    const renderPass = new modules.RenderPass(scene, camera);
    disposables.push(renderPass);
    composer.addPass(renderPass);

    const size = renderer.getSize(new THREE.Vector2());
    const bloom = new modules.UnrealBloomPass(
      new THREE.Vector2(Math.max(size.x, 1), Math.max(size.y, 1)),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    disposables.push(bloom);
    composer.addPass(bloom);

    const fxaaPass = new modules.ShaderPass(modules.FXAAShader);
    disposables.push(fxaaPass);
    composer.addPass(fxaaPass);

    const vignettePass = new modules.ShaderPass(VIGNETTE_SHADER);
    disposables.push(vignettePass);
    composer.addPass(vignettePass);

    return { composer, fxaaPass, disposables };
  } catch (cause) {
    disposeAll(disposables);
    throw cause;
  }
}

function disposeAll(disposables: DisposableLike[]): void {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    try {
      disposables[index].dispose();
    } catch {
      // Disposal must never mask the failure that triggered it.
    }
  }
  disposables.length = 0;
}

/** Keeps the FXAA resolution uniform in sync with drawing-buffer pixels. */
function applyFxaaResolution(
  pass: ShaderPassLike,
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
): void {
  const resolution = pass.uniforms['resolution']?.value as
    | { set?(x: number, y: number): void }
    | undefined;
  if (!resolution || typeof resolution.set !== 'function') return;
  const rawRatio = renderer.getPixelRatio();
  const ratio = Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : 1;
  resolution.set(1 / Math.max(width * ratio, 1), 1 / Math.max(height * ratio, 1));
}

function isWebGLContextLost(renderer: THREE.WebGLRenderer): boolean {
  try {
    const probe = renderer.getContext() as unknown as
      | { isContextLost?: () => boolean }
      | null
      | undefined;
    if (!probe || typeof probe.isContextLost !== 'function') return false;
    return probe.isContextLost();
  } catch {
    // If we cannot even ask, assume the context is gone.
    return true;
  }
}

function isUsableSize(width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  );
}

/**
 * Creates the post-processing pipeline around an existing renderer.
 *
 * Returns immediately with a working API: frames render directly until the
 * composer modules arrive, then transparently switch to the full chain. Every
 * failure mode degrades to direct rendering instead of breaking the scene.
 */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: CreatePostFXOptions = {},
): PostFX {
  let bundle: PostFXBundle | null = null;
  let disabled = false;
  let disposed = false;
  let warned = false;
  let pendingResize: { width: number; height: number } | null = null;

  const warnOnce = (message: string, cause: unknown): void => {
    if (warned) return;
    warned = true;
    console.warn(`[postfx] ${message}. Falling back to direct renderer.render(). Cause:`, cause);
  };

  const renderDirect = (): void => {
    renderer.render(scene, camera);
  };

  const applyResize = (width: number, height: number): void => {
    if (!bundle) {
      // Composer still loading (or startup failed): size the renderer now and
      // remember the request so the composer starts at the right resolution.
      if (!disabled) pendingResize = { width, height };
      renderer.setSize(width, height, false);
      return;
    }
    if (disabled) {
      renderer.setSize(width, height, false);
      return;
    }
    try {
      bundle.composer.setSize(width, height);
      applyFxaaResolution(bundle.fxaaPass, renderer, width, height);
    } catch (cause) {
      disabled = true;
      warnOnce('Composer resize failed', cause);
      renderer.setSize(width, height, false);
    }
  };

  async function bootstrap(): Promise<void> {
    try {
      if (disposed) return;
      if (isWebGLContextLost(renderer)) {
        // A lost context cannot allocate composer targets; direct rendering
        // still shows whatever the driver permits.
        throw new Error('WebGL context unavailable at PostFX startup');
      }
      const modules = await (options.modules ?? loadComposerModules());
      if (disposed) return;
      bundle = buildBundle(modules, renderer, scene, camera);
      if (pendingResize) {
        const pending = pendingResize;
        pendingResize = null;
        applyResize(pending.width, pending.height);
      }
    } catch (cause) {
      disabled = true;
      bundle = null;
      warnOnce('Post-processing unavailable', cause);
    }
  }

  void bootstrap();

  return {
    render(): void {
      if (disposed) return;
      const current = bundle;
      if (!current || disabled || isWebGLContextLost(renderer)) {
        renderDirect();
        return;
      }
      try {
        current.composer.render();
      } catch (cause) {
        disabled = true;
        warnOnce('Composer render failed', cause);
        renderDirect();
      }
    },

    resize(width: number, height: number): void {
      if (disposed || !isUsableSize(width, height)) return;
      applyResize(width, height);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      pendingResize = null;
      if (bundle) {
        disposeAll(bundle.disposables);
        bundle = null;
      }
    },
  };
}
