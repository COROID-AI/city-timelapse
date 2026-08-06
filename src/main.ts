import './style.css';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { createCityScene } from './scene/createScene';
import { CameraControls } from './core/cameraControls';
import { ERA_YEARS } from './eras';
import { createEraTransitionEngine } from './transition/eraTransition';
import { TimelineSlider } from './ui/timelineSlider';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app mount element');
}

if (!WebGL.isWebGL2Available()) {
  container.appendChild(WebGL.getWebGL2ErrorMessage());
  throw new Error('WebGL2 is not available');
}

const { renderer, scene, camera, resize, dispose } = createCityScene(container);

const controls = new CameraControls({
  domElement: renderer.domElement,
  camera,
});

// Era-transition engine: loads the initial era (1945) and animates era switches.
const transition = createEraTransitionEngine({
  scene,
  camera,
  initialEra: 1945,
});

// Status overlay
const statusEl = document.getElementById('era-status');
const updateStatus = (year: number | null): void => {
  if (statusEl) {
    statusEl.textContent = year === null ? 'No era loaded' : `Era: ${year}`;
  }
};
// Reflect the automatically-loaded initial era (1945) in the status overlay.
updateStatus(transition.getEra());

// Top-of-screen timeline slider. On user selection it dispatches the
// era-selection event (transition.selectEra) that the engine listens to.
const sliderMount = document.getElementById('timeline-slider');
let slider: TimelineSlider | null = null;
if (sliderMount) {
  slider = new TimelineSlider({
    container: sliderMount,
    initialYear: transition.getEra() ?? 1945,
    onSelect: (year) => {
      transition.selectEra(year);
      updateStatus(year);
    },
  });
}

// Wire keyboard era hotkeys (1-5) to the transition engine and keep the
// slider position in sync with the selected era.
controls.onEraSelect((year) => {
  transition.selectEra(year);
  updateStatus(year);
  slider?.setYear(year);
});

// Animate loop
const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  const delta = Math.min(timer.getDelta(), 0.05);
  controls.update(delta);
  transition.update(delta);
  renderer.render(scene, camera);
});

// Resize handling
const onResize = () => resize();
window.addEventListener('resize', onResize);

// Pointer-lock toggle button
const lockToggle = document.getElementById('lock-toggle');
lockToggle?.addEventListener('click', () => controls.togglePointerLock());

// Hotkey hints
const hintsEl = document.getElementById('era-hints');
if (hintsEl) {
  hintsEl.textContent = ERA_YEARS.map((year, i) => `${i + 1}: ${year}`).join('  ·  ');
}

// Best-effort teardown on page unload.
window.addEventListener('beforeunload', () => {
  controls.dispose();
  transition.dispose();
  slider?.dispose();
  dispose();
  window.removeEventListener('resize', onResize);
});
