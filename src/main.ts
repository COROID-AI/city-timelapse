/**
 * Main bootstrap for the City Time Period Timelapse.
 *
 * This is the application entry point. It creates the WebGL renderer, the
 * perspective camera, mounts them into the DOM, instantiates the
 * {@link SceneComposer}, and drives the render loop with `requestAnimationFrame`.
 *
 * The audio context is resumed on the first user gesture (per browser autoplay
 * policy) and the timeline HUD's era-change callback is wired to the scene
 * composer.
 */

import * as THREE from 'three';
import { SceneComposer } from './scene.js';
import { RenderPolicy } from './renderPolicy.js';

// ---------------------------------------------------------------------------
// Application bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialise the application.
 *
 * Creates the canvas, renderer, camera, and scene composer, then starts the
 * render loop. Returns a disposer for hot-reload / teardown.
 */
function main(): () => void {
  // --- Canvas ---
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element with id="canvas" not found in the DOM.');
  }

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(
    55, // FOV
    window.innerWidth / window.innerHeight, // aspect
    0.1, // near
    500, // far
  );
  camera.position.set(25, 20, 35);
  camera.lookAt(0, 5, 0);

  // --- Scene composer ---
  const composer = new SceneComposer({
    renderer,
    camera,
    canvas,
    initialEra: '1945',
    enableAudio: true,
  });

  // --- Resume audio on first user gesture ---
  const resumeAudio = (): void => {
    composer.resumeAudio();
  };
  window.addEventListener('pointerdown', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });

  // --- Render loop ---
  // The render policy caps cost during continuous animation: simulation
  // updates always run every frame, but the expensive GPU draw call is gated
  // so the experience stays smooth even on slower hardware.
  const renderPolicy = new RenderPolicy({ targetFps: 60, minFps: 24 });
  let rafId = 0;
  let lastFrameTime = performance.now();
  const loop = (): void => {
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    const deltaMs = now - lastFrameTime;
    lastFrameTime = now;

    // Always advance the simulation (traffic, pedestrians, camera, audio).
    composer.update();

    // Only render when the policy allows it.
    if (renderPolicy.shouldRender(deltaMs)) {
      const renderStart = performance.now();
      composer.render();
      renderPolicy.recordFrameTime(performance.now() - renderStart);
    }
  };
  rafId = requestAnimationFrame(loop);

  // --- Loading overlay removal ---
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.remove();
    }, 600);
  }

  // --- Disposer ---
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('pointerdown', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
    composer.dispose();
  };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

// Run once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    main();
  });
} else {
  main();
}

// Export for potential HMR / testing
export { main };
