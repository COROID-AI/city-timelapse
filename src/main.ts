import { TimelineSlider } from './hud/timeline.js';
import { initScene } from './scene.js';

function ensureContainerExists(): HTMLElement {
  const el = document.getElementById('app');
  if (!el) {
    throw new Error("Expected '#app' element to exist");
  }
  return el;
}

function hideLoading(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
}

function start(): void {
  hideLoading();

  const container = ensureContainerExists();
  // Initialize the 3D scene.
  initScene(container);

  // TimelineSlider dispatches a CustomEvent('era-changed') that the scene listens for.
  // It requires a container element id.
  // eslint-disable-next-line no-new
  new TimelineSlider('app');
}

start();