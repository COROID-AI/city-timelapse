/**
 * "City Era Timelapse" composition root.
 *
 * Owns the WebGL renderer boot sequence:
 *   1. Locate the #app mount point.
 *   2. Detect WebGL2 support (with graceful DOM fallback).
 *   3. Create the renderer, scene, camera, and animation loop.
 *   4. Wire the cinematic camera controller, era transformation engine, and
 *      LOD culler into the frame loop.
 *   5. Hide the loading overlay once the first frame has actually rendered.
 */
import './styles.css';
import { PerspectiveCamera } from 'three';
import { APP_MOUNT_SELECTOR } from './config/paths';
import { bootRenderer } from './engine/renderer';
import { attachLoadingOverlay } from './engine/mount';
import { createBootScene } from './engine/Scene';
import { CameraController } from './engine/CameraController';
import { TransformationEngine } from './engine/TransformationEngine';
import { LodCuller } from './engine/LodCuller';
import { eraStateStore } from './engine/EraStateStore';
import { applyEraToModules } from './engine/SceneRegistry';
import { TimelineSlider } from './ui/TimelineSlider';

function main(): void {
  const mount = document.querySelector(APP_MOUNT_SELECTOR);
  if (!(mount instanceof HTMLElement)) {
    console.error(`[boot] Mount point ${APP_MOUNT_SELECTOR} not found.`);
    return;
  }

  const hideLoading = attachLoadingOverlay(mount);

  if (!supportsWebGL2()) {
    hideLoading();
    showFallbackMessage(mount, 'WebGL2 is not supported by this browser.');
    return;
  }

  try {
    const booted = bootRenderer(mount);
    const renderer = booted.renderer;
    const scene = createBootScene();
    const camera = new PerspectiveCamera(60, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 1000);
    camera.position.set(0, 2.2, 6);

    // Cinematic camera: damped orbit/pan/zoom, bounds clamping, auto-rotate,
    // and per-era fly-to vantage points.
    const controller = new CameraController(camera, renderer.domElement, {
      autoRotate: true,
      autoRotateIdleDelaySec: 3,
      autoRotateSpeed: 0.35,
    });

    // Timeline slider: top-anchored era picker with play/pause auto-advance.
    // All selections flow through the EraStateStore; on user-driven era
    // changes the camera flies to the era's cinematic vantage point.
    const slider = new TimelineSlider({
      onEraChange: (year) => controller.flyTo(year),
    });
    slider.mount(document.body);

    // Era transformation blending: lerps material colors, emissive, fog, and
    // visibility between era datasets over a configurable duration.
    const transformEngine = new TransformationEngine({ duration: 2 });

    // LOD culling: hides distant/off-screen/occluded groups.
    const lodCuller = new LodCuller();

    let firstFrameRendered = false;
    let lastTimeMs = 0;

    // Drive the era transition from the store: whenever the selected year
    // changes, apply it to all registered scene modules in one pass.
    eraStateStore.subscribe((state) => {
      applyEraToModules(state.selectedYear, state.transitionProgress);
    });

    booted.setAnimationLoop((timeMs) => {
      const deltaSec = lastTimeMs === 0 ? 0 : Math.min((timeMs - lastTimeMs) / 1000, 0.1);
      lastTimeMs = timeMs;

      // Advance the cinematic camera (damped orbit/pan/zoom + auto-rotate).
      controller.update(deltaSec);

      // Advance era blending toward the currently selected era.
      const state = eraStateStore.getSnapshot();
      transformEngine.update(deltaSec, state.selectedYear);

      // Cull distant/occluded groups from the camera's current view.
      lodCuller.update({
        position: camera.position.clone(),
        viewMatrix: camera.matrixWorldInverse.clone(),
        projectionMatrix: camera.projectionMatrix.clone(),
      });

      // Notify scene modules of the current era each frame.
      applyEraToModules(state.selectedYear, state.transitionProgress);

      renderer.render(scene, camera);
      if (!firstFrameRendered) {
        firstFrameRendered = true;
        hideLoading();
      }
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        controller.setSize(width, height);
      }
    });
    resizeObserver.observe(mount);

    console.info('[boot] WebGL2 renderer started.');
    console.info('[boot] Timeline slider mounted.');
  } catch (error) {
    hideLoading();
    console.error('[boot] Failed to start renderer:', error);
    showFallbackMessage(mount, 'Could not initialize the 3D scene.');
  }
}

/** True when the browser exposes a WebGL2RenderingContext. */
function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function showFallbackMessage(mount: HTMLElement, message: string): void {
  const fallback = document.createElement('div');
  fallback.className = 'fallback-message';
  fallback.textContent = message;
  mount.appendChild(fallback);
}

main();