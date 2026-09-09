/**
 * Application entrypoint for City Time Period Timelapse.
 *
 * Rewritten composition root wiring the full scene application:
 * - Boots sceneApp (instantiates, attaches, updates, and disposes all 6 subsystems)
 * - Handles WebGL unavailability fallback
 * - Displays a loading overlay until the first frame is rendered
 * - Sets up responsive window & container resize observers
 * - Wires the post-processing pipeline (bloom / vignette / film grade / ACES)
 *   and the Low/Medium/High quality tiers over the composed scene
 * - Runs the automatic FPS-based tier controller and renders a quality HUD
 */

import type { WebGLRenderer } from 'three';
import { type RenderLoopHandle } from './app/renderLoop';
import { createSceneApp, type QualityTier, type SceneApp } from './app/sceneApp';
import {
  createPostProcessing,
  createQualityController,
  type PostProcessingHandle,
  type QualityController,
} from './fx/postProcessing';
import { normalizeTier, TARGET_FPS } from './fx/qualityTiers';
import './styles/base.css';

export interface BootstrapHandle {
  readonly app: SceneApp | null;
  readonly renderer: WebGLRenderer | null;
  readonly loop: RenderLoopHandle;
  /** Post-processing pipeline handle (null when WebGL is unavailable). */
  readonly fx: PostProcessingHandle | null;
  /** Auto FPS controller handle (null when WebGL is unavailable). */
  readonly quality: QualityController | null;
  /** Sets the post-processing quality tier (low/medium/high/ultra). */
  setQuality(tier: QualityTier): void;
  /** Releases all 3D subsystems, audio nodes, UI listeners, and resize observers. */
  dispose(): void;
}

/**
 * Creates the loading overlay element.
 */
function createLoadingOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'timelapse-loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Loading city timelapse scene');

  const spinner = document.createElement('div');
  spinner.className = 'timelapse-loading-spinner';

  const label = document.createElement('div');
  label.className = 'timelapse-loading-text';
  label.textContent = 'Loading City Timelapse...';

  overlay.appendChild(spinner);
  overlay.appendChild(label);
  return overlay;
}

/** Formats the tier badge text, e.g. "Quality HIGH · 60 FPS". */
function tierLabel(tier: 'low' | 'medium' | 'high'): string {
  return tier.toUpperCase();
}

/**
 * Creates the compact quality/FPS HUD badge appended to the mount.
 * Disposes with the mount.
 */
function createQualityBadge(mount: HTMLElement): { update(fps: number, tier: 'low' | 'medium' | 'high'): void; dispose(): void } {
  const badge = document.createElement('div');
  badge.className = 'timelapse-quality-hud';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', 'Rendering quality and frame rate');
  badge.style.cssText = [
    'position:absolute',
    'top:0.75rem',
    'right:0.75rem',
    'z-index:60',
    'pointer-events:none',
    'background:rgba(15,23,42,0.78)',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:9999px',
    'padding:3px 10px',
    'font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'font-size:0.6875rem',
    'font-weight:600',
    'color:#e2e8f0',
    'letter-spacing:0.03em',
  ].join(';');

  const tierSpan = document.createElement('span');
  tierSpan.className = 'quality-hud-tier';
  tierSpan.style.color = '#38bdf8';

  const fpsSpan = document.createElement('span');
  fpsSpan.className = 'quality-hud-fps';
  fpsSpan.style.color = '#94a3b8';

  badge.appendChild(tierSpan);
  badge.appendChild(document.createTextNode(' · '));
  badge.appendChild(fpsSpan);
  mount.appendChild(badge);

  let disposed = false;
  return {
    update(fps: number, tier: 'low' | 'medium' | 'high'): void {
      if (disposed) return;
      tierSpan.textContent = `Quality ${tierLabel(tier)}`;
      fpsSpan.textContent = `${Math.round(fps)} FPS`;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    },
  };
}

/**
 * Boots the City Time Period Timelapse scene within `mount`.
 */
export function bootstrap(mount: HTMLElement): BootstrapHandle {
  if (!(mount instanceof HTMLElement)) {
    throw new TypeError('bootstrap requires an HTMLElement mount point');
  }

  // Clear existing content
  mount.replaceChildren();

  // 1. Create Canvas Element
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  mount.appendChild(canvas);

  // 2. Create and append Loading Overlay
  const loadingOverlay = createLoadingOverlay();
  mount.appendChild(loadingOverlay);

  // 3. Attempt SceneApp Instantiation (with WebGL fallback guard)
  let app: SceneApp;
  try {
    app = createSceneApp(canvas, {
      uiContainer: mount,
      onFirstFrame: () => {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
          if (loadingOverlay.parentNode) {
            loadingOverlay.parentNode.removeChild(loadingOverlay);
          }
        }, 400);
      },
    });
  } catch (err) {
    // Graceful WebGL-unavailable fallback
    const notice = document.createElement('div');
    notice.className = 'fallback';
    notice.textContent = 'This scene needs WebGL, which is unavailable in this browser.';
    mount.replaceChildren(notice);

    return {
      app: null,
      renderer: null,
      fx: null,
      quality: null,
      loop: { running: false, dispose: () => {} },
      setQuality: () => {},
      dispose: () => {
        mount.replaceChildren();
      },
    };
  }

  // 4. Wire Post-Processing + Quality Tiers over the composed scene.
  //    ACES tone mapping, vignette/film grade, and the bloom pass are owned by
  //    the fx pipeline; the tier table (Low/Medium/High) drives pixel ratio,
  //    shadow-map size, and bloom budget.
  const qualityBadge = createQualityBadge(mount);
  let fx: PostProcessingHandle;
  try {
    fx = createPostProcessing(
      { scene: app.scene, renderer: app.renderer },
      {
        onFpsSample: (fps) => qualityBadge.update(fps, fx.getTier()),
      },
      'high',
    );
  } catch (err) {
    // Non-fatal: the scene still renders (tone mapping / bloom are best-effort).
    const fallback: PostProcessingHandle = {
      light: null as never,
      getTier: () => 'high',
      getSettings: () => ({ pixelRatio: 1, shadowMapSize: 512, bloom: 0 }),
      isShadowMappingEnabled: () => false,
      getBloomTargetCount: () => 0,
      setQuality: () => {},
      update: () => {},
      dispose: () => {},
    };
    fx = fallback;
  }
  const quality = createQualityController(fx);

  // 5. Resize Handling
  function handleResize(): void {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    app.resize(w, h);
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(mount);
  window.addEventListener('resize', handleResize);

  // 6. Per-frame FPS controller tick (independent RAF so the autos tier runs
  //    over the composed app without restructuring sceneApp's loop).
  let disposed = false;
  let lastFxTime: number | null = null;
  let fxLoopId = 0;

  function fxTick(now: number): void {
    if (disposed) return;
    const dt = lastFxTime === null ? 0 : Math.min(0.25, Math.max(0, (now - lastFxTime) / 1000));
    lastFxTime = now;
    quality.update(dt);
    if (!disposed) {
      fxLoopId = requestAnimationFrame(fxTick);
    }
  }
  fxLoopId = requestAnimationFrame(fxTick);

  return {
    app,
    renderer: app.renderer,
    loop: app.loop,
    fx,
    quality,
    setQuality(tier: QualityTier): void {
      if (disposed) return;
      fx.setQuality(tier);
      qualityBadge.update(TARGET_FPS, normalizeTier(tier));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (fxLoopId !== 0) {
        cancelAnimationFrame(fxLoopId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      try {
        fx.dispose();
      } catch {
        // ignore renderer teardown edge cases
      }
      qualityBadge.dispose();
      app.dispose();
      mount.replaceChildren();
    },
  };
}

// Auto-boot if the #app root element is present in the document
if (typeof document !== 'undefined') {
  const root = document.querySelector<HTMLElement>('#app');
  if (root) {
    bootstrap(root);
  }
}