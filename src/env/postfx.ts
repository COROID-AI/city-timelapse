/**
 * Restrained, cheap post-processing for the era atmosphere:
 * - **Tone mapping**: fixed ACES filmic curve with a per-era blended exposure,
 *   so the curve never swaps mid-transition (no popping) while the look still
 *   shifts between hazy 1945 and crisp 2005/2025 grades;
 * - **Bloom**: a real `UnrealBloomPass` chain (RenderPass -> bloom ->
 *   OutputPass) enabled only at `high` quality, with strengths kept deliberately
 *   low (<= 0.65) so windows, neon, and the sun glow without smearing the UI;
 * - **Vignette**: a GPU-free CSS radial-gradient layer over the canvas and
 *   under the timeline overlay (`pointer-events: none`, `z-index` below the
 *   UI overlay) — one composited layer instead of another render pass.
 *
 * Quality scaling: `high` renders through the bloom composer, `medium` and
 * `low` render directly (`renderer.render`) and drop the bloom chain first —
 * the most expensive effect — while vignette and tone mapping always remain.
 * Without a WebGL renderer (unit tests, SSR) every call is a safe no-throw
 * state bookkeeping operation.
 *
 * `AtmosphereQuality` lives here because it is the shared quality tier used by
 * both post-processing and the weather particle budgets.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { EraYear } from '../era/timeline';

/** Atmosphere quality tier: `high` keeps bloom, lower tiers drop it first. */
export type AtmosphereQuality = 'low' | 'medium' | 'high';

/** Blendable post-processing look for one era at one time option. */
export interface PostFxState {
  /** Renderer `toneMappingExposure` (ACES stays fixed; exposure blends). */
  exposure: number;
  /** Bloom strength; era presets stay within (0, 0.65] — restrained by design. */
  bloomStrength: number;
  /** Luminance threshold where bloom starts (lower = more smoggy glow). */
  bloomThreshold: number;
  /** Bloom spread, 0..1. */
  bloomRadius: number;
  /** Vignette darkness strength, 0..1 (drives the CSS overlay opacity). */
  vignette: number;
}

function state(partial: Partial<PostFxState> = {}): PostFxState {
  return {
    exposure: partial.exposure ?? 1,
    bloomStrength: partial.bloomStrength ?? 0.2,
    bloomThreshold: partial.bloomThreshold ?? 0.85,
    bloomRadius: partial.bloomRadius ?? 0.5,
    vignette: partial.vignette ?? 0.4,
  };
}

/** Allocate a zeroed/neutral working post state. */
export function createPostFxState(partial: Partial<PostFxState> = {}): PostFxState {
  return state(partial);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Blend two post states into `target` (allocates when no target given). */
export function lerpPostFxState(
  a: PostFxState,
  b: PostFxState,
  t: number,
  target: PostFxState = createPostFxState(),
): PostFxState {
  const k = clamp01(t);
  target.exposure = a.exposure + (b.exposure - a.exposure) * k;
  target.bloomStrength = a.bloomStrength + (b.bloomStrength - a.bloomStrength) * k;
  target.bloomThreshold = a.bloomThreshold + (b.bloomThreshold - a.bloomThreshold) * k;
  target.bloomRadius = a.bloomRadius + (b.bloomRadius - a.bloomRadius) * k;
  target.vignette = a.vignette + (b.vignette - a.vignette) * k;
  return target;
}

/** Daylight grade per era: hazy/underexposed 1945, crisp bright 2005/2025. */
export const POSTFX_DAY_STATES: Readonly<Record<EraYear, PostFxState>> = Object.freeze({
  1945: state({ exposure: 0.95, bloomStrength: 0.18, bloomThreshold: 0.88, bloomRadius: 0.5, vignette: 0.55 }),
  1965: state({ exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 0.88, bloomRadius: 0.5, vignette: 0.42 }),
  1985: state({ exposure: 1.0, bloomStrength: 0.3, bloomThreshold: 0.85, bloomRadius: 0.55, vignette: 0.45 }),
  2005: state({ exposure: 1.05, bloomStrength: 0.2, bloomThreshold: 0.9, bloomRadius: 0.45, vignette: 0.3 }),
  2025: state({ exposure: 1.06, bloomStrength: 0.24, bloomThreshold: 0.9, bloomRadius: 0.45, vignette: 0.28 }),
}) as Readonly<Record<EraYear, PostFxState>>;

/**
 * Night grade per era. 1985 is the smoggy neon night option: the strongest
 * (still restrained) bloom of the set so magenta/cyan signage actually glows.
 */
export const POSTFX_NIGHT_STATES: Readonly<Record<EraYear, PostFxState>> = Object.freeze({
  1945: state({ exposure: 0.92, bloomStrength: 0.3, bloomThreshold: 0.75, bloomRadius: 0.55, vignette: 0.62 }),
  1965: state({ exposure: 0.98, bloomStrength: 0.34, bloomThreshold: 0.75, bloomRadius: 0.55, vignette: 0.52 }),
  1985: state({ exposure: 1.02, bloomStrength: 0.62, bloomThreshold: 0.6, bloomRadius: 0.6, vignette: 0.55 }),
  2005: state({ exposure: 1.02, bloomStrength: 0.32, bloomThreshold: 0.75, bloomRadius: 0.5, vignette: 0.42 }),
  2025: state({ exposure: 1.04, bloomStrength: 0.36, bloomThreshold: 0.75, bloomRadius: 0.5, vignette: 0.4 }),
}) as Readonly<Record<EraYear, PostFxState>>;

/** Construction options; every renderer/container dependency is optional. */
export interface PostFxOptions {
  /** WebGL renderer; when omitted (tests/headless) no GPU work is ever created. */
  renderer?: THREE.WebGLRenderer | null;
  /** Element that owns the canvas; the vignette layer is appended here. */
  container?: HTMLElement | null;
  /** Starting quality tier. Defaults to `high`. */
  quality?: AtmosphereQuality;
}

/** Live post-processing controller owned by the atmosphere module. */
export interface PostFxController {
  /** Last applied grade (live values; safe to read every frame). */
  readonly state: Readonly<PostFxState>;
  /** Current quality tier. */
  readonly quality: AtmosphereQuality;
  /** True only when the bloom composer is actually built and rendering. */
  readonly usesBloom: boolean;
  /** CSS vignette layer, or `null` when no container/document is available. */
  readonly vignetteElement: HTMLElement | null;
  /** Apply an era grade (exposure, bloom uniforms, vignette opacity). */
  apply(next: PostFxState): void;
  /** Switch quality tier; dropping below `high` tears the bloom chain down. */
  setQuality(quality: AtmosphereQuality): void;
  /** Sync composer buffers to an explicit size in CSS pixels. */
  resize(width: number, height: number): void;
  /** Render the frame through the composer (high) or directly (medium/low). */
  render(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds?: number): void;
  /** Dispose composer passes and remove the vignette layer. */
  dispose(): void;
}

type ComposerPass = EffectComposer['passes'][number];

function disposePass(pass: ComposerPass): void {
  const disposable = pass as { dispose?: () => void };
  if (typeof disposable.dispose === 'function') disposable.dispose();
}

function vignetteGradient(vignette: number): string {
  const alpha = (0.55 * clamp01(vignette)).toFixed(3);
  return `radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 42%, rgba(0, 0, 0, ${alpha}) 100%)`;
}

/**
 * Create the post-processing controller. The bloom chain is built lazily on
 * the first `high`-quality render (so a missing WebGL context can never throw
 * during construction) and is torn down whenever quality drops.
 */
export function createPostFx(options: PostFxOptions = {}): PostFxController {
  const renderer = options.renderer ?? null;
  let quality: AtmosphereQuality = options.quality ?? 'high';
  let disposed = false;
  const applied = createPostFxState();

  let composer: EffectComposer | null = null;
  let renderPass: RenderPass | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let outputPass: OutputPass | null = null;
  let lastWidth = -1;
  let lastHeight = -1;
  let lastPixelRatio = -1;

  // Vignette: one CSS layer above the canvas, below the timeline overlay,
  // and never interactive — it cannot block or obscure the timeline UI.
  const container = options.container ?? renderer?.domElement.parentElement ?? null;
  const doc = container?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  let vignetteElement: HTMLElement | null = null;
  if (container && doc) {
    const element = doc.createElement('div');
    element.className = 'atmosphere-vignette';
    element.setAttribute('data-atmosphere-vignette', '');
    element.setAttribute('aria-hidden', 'true');
    const style = element.style;
    style.position = 'absolute';
    style.left = '0';
    style.top = '0';
    style.right = '0';
    style.bottom = '0';
    style.pointerEvents = 'none';
    style.zIndex = '5';
    container.appendChild(element);
    vignetteElement = element;
  }

  if (renderer) {
    // Fixed filmic curve for every era; only exposure blends between eras.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }

  const applyBloom = (): void => {
    if (!bloomPass) return;
    bloomPass.strength = applied.bloomStrength;
    bloomPass.radius = applied.bloomRadius;
    bloomPass.threshold = applied.bloomThreshold;
  };

  const teardownComposer = (): void => {
    if (!composer) return;
    for (const pass of composer.passes) disposePass(pass);
    composer.dispose();
    composer = null;
    renderPass = null;
    bloomPass = null;
    outputPass = null;
    lastWidth = -1;
    lastHeight = -1;
    lastPixelRatio = -1;
  };

  const ensureComposer = (scene: THREE.Scene, camera: THREE.Camera): void => {
    if (disposed || !renderer || quality !== 'high' || composer) return;
    try {
      const nextComposer = new EffectComposer(renderer);
      const nextRenderPass = new RenderPass(scene, camera);
      const nextBloomPass = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        applied.bloomStrength,
        applied.bloomRadius,
        applied.bloomThreshold,
      );
      const nextOutputPass = new OutputPass();
      nextComposer.addPass(nextRenderPass);
      nextComposer.addPass(nextBloomPass);
      nextComposer.addPass(nextOutputPass);
      composer = nextComposer;
      renderPass = nextRenderPass;
      bloomPass = nextBloomPass;
      outputPass = nextOutputPass;
      applyBloom();
    } catch {
      // No usable WebGL/composer path: fall back to direct rendering.
      teardownComposer();
    }
  };

  const syncSize = (): void => {
    if (!renderer || !composer) return;
    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();
    if (size.x === lastWidth && size.y === lastHeight && pixelRatio === lastPixelRatio) return;
    lastWidth = size.x;
    lastHeight = size.y;
    lastPixelRatio = pixelRatio;
    composer.setPixelRatio(pixelRatio);
    composer.setSize(size.x, size.y);
  };

  // Prime the grade so a controller is usable before the first apply().
  if (renderer) renderer.toneMappingExposure = applied.exposure;
  if (vignetteElement) vignetteElement.style.background = vignetteGradient(applied.vignette);

  return {
    state: applied,
    get quality(): AtmosphereQuality {
      return quality;
    },
    get usesBloom(): boolean {
      return composer !== null && bloomPass !== null && outputPass !== null;
    },
    vignetteElement,

    apply(next: PostFxState): void {
      applied.exposure = finiteOr(next.exposure, applied.exposure);
      applied.bloomStrength = finiteOr(next.bloomStrength, applied.bloomStrength);
      applied.bloomThreshold = finiteOr(next.bloomThreshold, applied.bloomThreshold);
      applied.bloomRadius = finiteOr(next.bloomRadius, applied.bloomRadius);
      applied.vignette = finiteOr(next.vignette, applied.vignette);
      if (renderer) renderer.toneMappingExposure = applied.exposure;
      applyBloom();
      if (vignetteElement) vignetteElement.style.background = vignetteGradient(applied.vignette);
    },

    setQuality(next: AtmosphereQuality): void {
      if (next === quality) return;
      quality = next;
      if (quality !== 'high') teardownComposer();
      // `high` rebuilds lazily on the next render, where scene/camera exist.
    },

    resize(width: number, height: number): void {
      if (!composer) return;
      lastWidth = width;
      lastHeight = height;
      lastPixelRatio = renderer ? renderer.getPixelRatio() : lastPixelRatio;
      composer.setSize(width, height);
    },

    render(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds: number = 0): void {
      if (disposed) return;
      if (quality === 'high' && renderer) {
        ensureComposer(scene, camera);
        if (renderPass) {
          renderPass.scene = scene;
          renderPass.camera = camera;
        }
        syncSize();
        if (composer) {
          composer.render(deltaSeconds);
          return;
        }
      }
      if (renderer) renderer.render(scene, camera);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      teardownComposer();
      vignetteElement?.remove();
      vignetteElement = null;
    },
  };
}
