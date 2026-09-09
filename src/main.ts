/**
 * Application entrypoint for City Time Period Timelapse.
 *
 * Rewritten composition root wiring the full scene application:
 * - Boots sceneApp (instantiates, attaches, updates, and disposes all 6 subsystems)
 * - Handles WebGL unavailability fallback
 * - Displays a loading overlay until the first frame is rendered
 * - Sets up responsive window & container resize observers
 */

import type { WebGLRenderer } from 'three';
import { type RenderLoopHandle } from './app/renderLoop';
import { createSceneApp, type SceneApp } from './app/sceneApp';
import './styles/base.css';

export interface BootstrapHandle {
  readonly app: SceneApp | null;
  readonly renderer: WebGLRenderer | null;
  readonly loop: RenderLoopHandle;
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
      loop: { running: false, dispose: () => {} },
      dispose: () => {
        mount.replaceChildren();
      },
    };
  }

  // 4. Resize Handling
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

  let disposed = false;

  return {
    app,
    renderer: app.renderer,
    loop: app.loop,
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
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
