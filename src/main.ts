/**
 * "City Era Timelapse" composition root.
 *
 * Owns the WebGL renderer boot sequence:
 *   1. Locate the #app mount point.
 *   2. Detect WebGL2 support (with graceful DOM fallback).
 *   3. Create the renderer, scene, camera, and animation loop.
 *   4. Hide the loading overlay once the first frame has actually rendered.
 */
import './styles.css';
import { PerspectiveCamera } from 'three';
import { APP_MOUNT_SELECTOR } from './config/paths';
import { bootRenderer } from './engine/renderer';
import { attachLoadingOverlay } from './engine/mount';
import { createBootScene } from './engine/Scene';

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

    let firstFrameRendered = false;

    booted.setAnimationLoop((_timeMs) => {
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
      }
    });
    resizeObserver.observe(mount);

    console.info('[boot] WebGL2 renderer started.');
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