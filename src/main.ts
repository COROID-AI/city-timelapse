import './style.css';
import { createScene } from './scene';
import { createCityBlock } from './cityBlock';
import { createTimeline, PERIOD_YEARS } from './timeline';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

// Three.js stage: camera, renderer, lighting and render loop.
const sceneContext = createScene(container);

// Camera mode toggle — switches between orbit and first-person fly (WASD).
const viewToggle = document.createElement('button');
viewToggle.className = 'view-toggle';
viewToggle.type = 'button';
viewToggle.textContent = 'View: Orbit';
viewToggle.addEventListener('click', () => {
  sceneContext.cameraController.toggleMode();
});
sceneContext.cameraController.onModeChange((mode) => {
  viewToggle.textContent =
    mode === 'orbit'
      ? 'View: Orbit'
      : 'View: Fly (WASD · Esc to exit)';
});
container.appendChild(viewToggle);

// Static city block: ground, streets, sidewalks and building plots.
createCityBlock(sceneContext.scene);

// Timeline overlay — emits a selection event for each of the five years.
const timeline = createTimeline(
  container,
  PERIOD_YEARS[PERIOD_YEARS.length - 1],
  (year) => {
    // Period-state wiring arrives in a downstream task.
    console.info('Period selected:', year);
  },
);

// Clean teardown on hot-module replacement during development.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneContext.dispose();
    timeline.dispose();
  });
}
