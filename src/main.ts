/**
 * City Era Timelapse — application composition root.
 *
 * Replaces the Phase-1 placeholder shell with the real entry point. This file
 * wires the existing subsystems together (and nothing more):
 *
 * - {@link createSceneDirector} instantiates the WebGLRenderer (plus primary
 *   scene, camera, orbit controls, environment rig, lazy era groups), mounts
 *   the timeline slider UI and registers the autoplay-policy-safe first
 * -gesture audio unlock.
 * - {@link createPostFX} attaches the bloom → vignette → FXAA chain around the
 *   director's renderer/scene/camera, degrading gracefully to direct rendering.
 * - {@link QualityManager} adaptively steers device pixel ratio and shadow map
 *   resolution from measured frame times.
 *
 * The director owns `renderer.setAnimationLoop`; each of its frames drives the
 * active era ticks, the transition choreography, the orbit controls and one
 * final draw call. At this composition root that final draw call is routed
 * through `postfx.render()` so frames exit via the composer pipeline whenever
 * it is available (and fall back to the untouched native render otherwise).
 */

import { createSceneDirector } from './scene/director';
import type { SceneDirector } from './scene/director';
import { createPostFX } from './scene/postfx';
import { QualityManager } from './scene/quality';
import { findSceneEnvironmentLights } from './environment/profiles';

function supportsWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

function showFatalFallback(message: string): void {
  const el = document.createElement('div');
  el.className = 'shell-error';
  el.textContent = message;
  document.body.appendChild(el);
}

/** Bottom-center controls hint so the navigation affordances are discoverable. */
function mountControlsHint(container: HTMLElement): HTMLElement {
  const hint = document.createElement('div');
  hint.dataset.testid = 'controls-hint';
  hint.textContent =
    'Drag to orbit · Scroll to zoom · Right-drag to pan · Pick a year above (← → Home End)';
  Object.assign(hint.style, {
    position: 'fixed',
    bottom: '14px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100vw - 24px)',
    padding: '6px 14px',
    borderRadius: '999px',
    background: 'rgba(10, 12, 18, 0.72)',
    color: '#cfd6e4',
    font: '13px system-ui, -apple-system, "Segoe UI", sans-serif',
    letterSpacing: '0.03em',
    textAlign: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>);
  container.appendChild(hint);
  return hint;
}

function bootstrap(): void {
  const container = document.querySelector('#app');
  if (!(container instanceof HTMLElement)) {
    showFatalFallback('City Era Timelapse: missing #app mount point.');
    return;
  }
  if (!supportsWebGL2()) {
    showFatalFallback('City Era Timelapse requires a WebGL2-capable browser.');
    return;
  }

  let director: SceneDirector;
  try {
    // Creates the renderer, primary scene/camera, orbit controls, environment
    // rig and era groups, mounts the timeline slider UI, and registers the
    // first user-gesture listener that resumes the AudioContext.
    director = createSceneDirector(container);
  } catch (error) {
    showFatalFallback(`City Era Timelapse failed to initialize: ${String(error)}`);
    return;
  }

  const renderer = director.renderer;
  const hint = mountControlsHint(container);

  // --- PostFX ---------------------------------------------------------------
  // Wraps the director's renderer/scene/camera. Until the composer modules
  // finish loading — or if they fail — render() transparently falls back to a
  // direct renderer.draw call, so attaching it can never break the scene.
  const postfx = createPostFX(renderer, director.scene, director.camera);

  // Composition-root adapter: the director's animation loop ends every frame
  // with `renderer.render(scene, camera)`. Shadowing that method on the
  // renderer instance routes that single top-level draw through PostFX, while
  // the recursion guard keeps calls that originate *inside*
  // `postfx.render()` (composer passes and the degraded fallback) on the
  // untouched native renderer.
  const nativeRender = renderer.render.bind(renderer);
  let routingFrame = false;
  const renderViaPostFX: typeof renderer.render = (scene, camera) => {
    if (routingFrame) {
      nativeRender(scene, camera);
      return;
    }
    routingFrame = true;
    try {
      postfx.render();
    } finally {
      routingFrame = false;
    }
  };
  renderer.render = renderViaPostFX;

  // --- QualityManager --------------------------------------------------------
  const rigLights = findSceneEnvironmentLights(director.scene);
  const quality = new QualityManager({
    onChange: () => applyQualitySettings(),
  });

  const applyQualitySettings = (): void => {
    renderer.setPixelRatio(quality.getPixelRatio());
    const sun = rigLights.sun;
    if (sun && sun.castShadow) {
      const size = quality.getShadowMapSize();
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
  };
  applyQualitySettings();

  // The director consumes the frame deltas internally; this lightweight rAF
  // sampler feeds the same cadence to the quality manager so it can step the
  // detail level without owning the render loop.
  let lastSampleMs = performance.now();
  let sampleRafId = 0;
  const sampleFrame = (now: number): void => {
    const dtSeconds = Math.max(0, (now - lastSampleMs) / 1000);
    lastSampleMs = now;
    quality.update(dtSeconds);
    sampleRafId = requestAnimationFrame(sampleFrame);
  };

  // --- Window resize → renderer (director) + composer (here) -----------------
  const resize = (): void => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    // The director's own resize handler sizes the renderer and updates the
    // camera aspect; keep the composer render targets in lockstep.
    postfx.resize(width, height);
  };
  window.addEventListener('resize', resize);
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    try {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } catch {
      resizeObserver = null;
    }
  }
  resize();

  // --- AudioContext resume on the first user gesture --------------------------
  // The director already lazily constructs the SfxMixer and resumes its
  // AudioContext on the first gesture; this explicit hook guarantees the
  // mixer's autoplay handling is driven from the entry point too. Both paths
  // are idempotent (the mixer de-duplicates concurrent starts).
  const gestureTypes = ['pointerdown', 'touchstart', 'keydown'] as const;
  const onFirstGesture = (): void => {
    void director.getMixer()?.handleUserGesture().catch(() => undefined);
  };
  for (const type of gestureTypes) {
    document.addEventListener(type, onFirstGesture, { capture: true });
  }

  // --- Teardown ----------------------------------------------------------------
  const disposeApp = (): void => {
    cancelAnimationFrame(sampleRafId);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    for (const type of gestureTypes) {
      document.removeEventListener(type, onFirstGesture, { capture: true });
    }
    hint.remove();
    renderer.render = nativeRender; // stop routing before tearing down PostFX
    postfx.dispose();
    quality.dispose();
    director.dispose();
  };
  window.addEventListener('pagehide', disposeApp, { once: true });

  // --- Render loop ---------------------------------------------------------------
  // Drives per-frame: active-era updates, transition choreography, orbit
  // damping, the PostFX-composited draw call (via the adapter above) and the
  // quality sampler started alongside it.
  sampleRafId = requestAnimationFrame(sampleFrame);
  director.start();
  container.setAttribute('data-app-ready', 'true');
}

bootstrap();
