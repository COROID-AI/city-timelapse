import './style.css';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { createCityScene } from './scene/createScene';
import { CameraControls } from './core/cameraControls';
import { ERA_YEARS, setActiveEra } from './eras';

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

// Status overlay
const statusEl = document.getElementById('era-status');
const updateStatus = (year: number | null): void => {
  if (statusEl) {
    statusEl.textContent = year === null ? 'No era loaded' : `Era: ${year}`;
  }
};
updateStatus(null);

// Wire keyboard era hotkeys (1-5) to the timeline state.
controls.onEraSelect((year) => {
  setActiveEra(year);
  updateStatus(year);
});

// Animate loop
const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  const delta = Math.min(timer.getDelta(), 0.05);
  controls.update(delta);
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
  dispose();
  window.removeEventListener('resize', onResize);
});
