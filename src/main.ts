import './style.css';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { createCityScene } from './scene/createScene';
import { CameraControls } from './core/cameraControls';
import { ERA_YEARS, type EraYear } from './eras';
import { createEraTransitionEngine } from './transition/eraTransition';
import { SfxEngine } from './audio/sfx';
import { TimelineSlider } from './ui/timelineSlider';
import { LoadingScreen } from './ui/loadingScreen';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app mount element');
}

if (!WebGL.isWebGL2Available()) {
  container.appendChild(WebGL.getWebGL2ErrorMessage());
  throw new Error('WebGL2 is not available');
}

const { renderer, scene, camera, resize, render, dispose } = createCityScene(container);

// Full-screen loading overlay shown while the initial era assets build. It is
// hidden on the first rendered frame (see the animation loop below).
const loading = new LoadingScreen();

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

// The initial era is built synchronously by the engine above, so the app is
// fully interactive the moment construction returns. Hide the loading overlay
// right away (rather than waiting for the first rendered frame) so it never
// blocks the timeline controls while the first frame renders.
loading.hide();

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

// Top-of-screen timeline slider. On user selection it dispatches the
// era-selection event (transition.selectEra) that the engine listens to.
// Shared era-selection handler: drives the transition engine, keeps the SFX
// engine in sync (ambient bed + transition whoosh), updates the status overlay,
// and keeps the slider position in sync. Used by both the timeline slider and
// the keyboard hotkeys so every selection path plays SFX.
const selectEra = (year: EraYear): void => {
  transition.selectEra(year);
  sfx.setEra(year);
  sfx.playTransition();
  updateStatus(year);
  slider?.setYear(year);
};

const sliderMount = document.getElementById('timeline-slider');
let slider: TimelineSlider | null = null;
if (sliderMount) {
  slider = new TimelineSlider({
    container: sliderMount,
    initialYear: transition.getEra() ?? 1945,
    onSelect: selectEra,
  });
}

// Wire keyboard era hotkeys (1-5) to the shared selection handler.
controls.onEraSelect(selectEra);

// Animate loop
const timer = new THREE.Timer();
let firstFrame = true;
renderer.setAnimationLoop(() => {
  const delta = Math.min(timer.getDelta(), 0.05);
  controls.update(delta);
  transition.update(delta);
  render();
  // The initial era is fully built by now, so hide the loading screen.
  if (firstFrame) {
    firstFrame = false;
    loading.hide();
  }
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
  slider?.dispose();
  dispose();
  window.removeEventListener('resize', onResize);
});
