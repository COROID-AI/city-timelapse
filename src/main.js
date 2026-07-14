import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { LightingManager } from './world/LightingManager.js';
import { SkyManager } from './world/SkyManager.js';
import { StreetBuilder } from './factories/StreetBuilder.js';
import { EraTransitionManager } from './world/EraTransitionManager.js';
import { PostProcessingManager } from './world/PostProcessingManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { getEra } from './config/eras.js';
import { ERA_KEYS } from './core/constants.js';
import { TimelineSlider } from './ui/TimelineSlider.js';
import { EraInfoPanel } from './ui/EraInfoPanel.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { ControlsHint } from './ui/ControlsHint.js';
import { MuteButton } from './ui/MuteButton.js';
import './ui/styles.css';

async function main() {
  const canvas = document.getElementById('scene');
  const uiRoot = document.getElementById('ui-root');

  // --- UI elements ---
  const loading = new LoadingScreen();
  uiRoot.appendChild(loading.element);

  // --- Core systems ---
  const sceneMgr = new SceneManager(canvas);
  const camera = new THREE.PerspectiveCamera(
    52, window.innerWidth / window.innerHeight, 0.5, 1000
  );
  camera.position.set(70, 55, 70);

  const camController = new CameraController(camera, canvas);
  const lighting = new LightingManager(sceneMgr.scene);
  const sky = new SkyManager(sceneMgr.scene);

  // --- Post-processing ---
  loading.setProgress(0.12);
  const post = new PostProcessingManager(sceneMgr.renderer, sceneMgr.scene, camera);

  // --- Audio (lazy init on first gesture) ---
  const audio = new AudioManager();

  // --- Street (static, recolored per era) ---
  loading.setProgress(0.22);
  const street = new StreetBuilder(getEra(ERA_KEYS[0]));
  sceneMgr.add(street.group);
  sceneMgr.scene.fog = new THREE.Fog(0xd8c6a0, 40, 300);

  // --- Era transition manager ---
  const transitions = new EraTransitionManager(sceneMgr.scene);

  // --- Era application ---
  let currentEraKey = ERA_KEYS[0];
  function applyEraVisuals(eraKey, { immediate = false } = {}) {
    const era = getEra(eraKey);
    lighting.apply(era);
    sky.apply(era);
    const f = era.sky;
    sceneMgr.scene.fog.color.set(f.fog);
    sceneMgr.scene.fog.near = f.fogNear;
    sceneMgr.scene.fog.far = f.fogFar;
    post.setTarget(era.bloom);
    audio.applyEra(era, !immediate);
  }

  // Build initial era.
  loading.setProgress(0.4);
  const firstEra = getEra(ERA_KEYS[0]);
  applyEraVisuals(ERA_KEYS[0], { immediate: true });
  transitions.setInitial(firstEra, ERA_KEYS[0]);

  // --- UI wiring ---
  const eraInfo = new EraInfoPanel();
  const controlsHint = new ControlsHint();
  const muteBtn = new MuteButton(() => {
    const muted = audio.toggleMute();
    muteBtn.setMuted(muted);
  });

  let isTransitioning = false;

  const timeline = new TimelineSlider((key, index) => {
    selectEra(key);
  });

  function selectEra(eraKey) {
    if (eraKey === currentEraKey || isTransitioning) return;
    isTransitioning = true;
    const era = getEra(eraKey);
    applyEraVisuals(eraKey);
    audio.playWhoosh();
    transitions.transitionTo(era, eraKey, () => {
      currentEraKey = eraKey;
      isTransitioning = false;
    });
    eraInfo.show(era);
  }

  // Keyboard shortcuts: 1-6 eras, M mute, arrows camera.
  let audioStarted = false;
  function ensureAudioStarted() {
    audio.init();
    if (!audioStarted && audio.initialized) {
      audioStarted = true;
      audio.applyEra(getEra(currentEraKey), false);
    }
  }
  window.addEventListener('keydown', (e) => {
    // unlock audio on first keypress
    ensureAudioStarted();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= ERA_KEYS.length) {
      const key = ERA_KEYS[n - 1];
      timeline.select(n - 1);
      selectEra(key);
    } else if (e.key === 'm' || e.key === 'M') {
      ensureAudioStarted();
      const muted = audio.toggleMute();
      muteBtn.setMuted(muted);
    }
  });

  // Unlock audio on first click/tap anywhere.
  window.addEventListener('pointerdown', () => ensureAudioStarted(), { once: true });

  // Initial info panel.
  eraInfo.show(firstEra);

  // Mount UI.
  uiRoot.appendChild(timeline.element);
  uiRoot.appendChild(eraInfo.element);
  uiRoot.appendChild(controlsHint.element);
  uiRoot.appendChild(muteBtn.element);

  // --- Register frame updaters ---
  sceneMgr.registerUpdater((dt, elapsed) => {
    camController.update(dt);
    sky.update(dt, elapsed);
    transitions.update(dt, elapsed);
    audio.update(dt);
    post.update(dt);
  });

  // --- Start render loop & reveal ---
  loading.setProgress(0.85);
  sceneMgr.start();

  // Yield a couple frames so the first era is actually rendered, then fade out loader.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  loading.setProgress(1);
  await new Promise((r) => setTimeout(r, 250));
  loading.hide();
}

main().catch((err) => {
  console.error('Failed to start city timelapse:', err);
});
