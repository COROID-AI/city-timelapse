import './style.css';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { createCityScene } from './scene/createScene';
import { CameraControls } from './core/cameraControls';
import { ERA_YEARS } from './eras';
import { createEraTransitionEngine } from './transition/eraTransition';
import { SfxEngine } from './audio/sfx';

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

// Procedural SFX / ambient audio engine (era-appropriate beds + transition whoosh).
const sfx = new SfxEngine();

// Status overlay
const statusEl = document.getElementById('era-status');
const updateStatus = (year: number | null): void => {
  if (statusEl) {
    statusEl.textContent = year === null ? 'No era loaded' : `Era: ${year}`;
  }
};
// Reflect the automatically-loaded initial era (1945) in the status overlay.
updateStatus(transition.getEra());

// Wire keyboard era hotkeys (1-5) to the transition engine + SFX.
controls.onEraSelect((year) => {
  transition.selectEra(year);
  sfx.setEra(year);
  sfx.playTransition();
  updateStatus(year);
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

// --- Audio: autoplay unlock + mute toggle -----------------------------------
// Browsers block audio until a user gesture, so unlock the SFX engine on the
// first interaction and start the loaded era's ambient bed at that point.
const unlockAudio = (): void => {
  sfx.init();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('click', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('click', unlockAudio);

// Mute toggle button (created in JS to stay within the audio wiring surface).
const uiEl = document.getElementById('ui');
const muteButton = document.createElement('button');
muteButton.id = 'audio-toggle';
muteButton.type = 'button';
muteButton.textContent = 'Audio: On';
muteButton.style.cssText =
  'pointer-events:auto;font-size:13px;padding:6px 14px;border:none;' +
  'border-radius:8px;background:rgba(255,255,255,0.9);color:#111;cursor:pointer;';
const syncMuteButton = (): void => {
  muteButton.textContent = sfx.isMuted() ? 'Audio: Muted' : 'Audio: On';
};
muteButton.addEventListener('click', () => {
  sfx.init();
  sfx.setMuted(!sfx.isMuted());
  syncMuteButton();
});
uiEl?.appendChild(muteButton);

// Hotkey hints
const hintsEl = document.getElementById('era-hints');
if (hintsEl) {
  hintsEl.textContent = ERA_YEARS.map((year, i) => `${i + 1}: ${year}`).join('  ·  ');
}

// Best-effort teardown on page unload.
window.addEventListener('beforeunload', () => {
  controls.dispose();
  transition.dispose();
  sfx.dispose();
  dispose();
  window.removeEventListener('resize', onResize);
});
