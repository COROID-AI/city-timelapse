/**
 * src/main.ts — single composition root.
 *
 * Owns the WebGLRenderer, camera, OrbitControls, primary Scene,
 * setAnimationLoop, ResizeObserver and global disposal. Creates the era store,
 * morph engine, env systems, audio mixer and top UI, then wires them together.
 *
 * Per the threejs ownership model, no other module starts its own
 * renderer/loop.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SfxMixer } from './audio/mixer';
import { Lighting } from './env/Lighting';
import { Weather } from './env/Weather';
import { MorphEngine } from './core/MorphEngine';
import { SceneShell } from './scene/SceneShell';
import { EraState } from './state/EraState';
import { TimelineSlider } from './ui/TimelineSlider';
import './ui/styles.css';

// --- WebGL capability check ------------------------------------------------

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function showError(message: string): void {
  const el = document.createElement('div');
  el.className = 'no-webgl';
  el.textContent = message;
  document.body.appendChild(el);
}

// --- App --------------------------------------------------------------------

function boot(): void {
  const app = document.getElementById('app');
  if (!app) {
    showError('App mount point (#app) missing.');
    return;
  }

  if (!supportsWebGL()) {
    showError(
      'WebGL is not available in this browser. The city timelapse needs WebGL to render.',
    );
    return;
  }

  // Loading screen (hidden once first frame renders).
  const loading = document.createElement('div');
  loading.className = 'loading-screen';
  loading.textContent = 'Building city…';
  document.body.appendChild(loading);

  // State + engines.
  const eraState = new EraState('1945');
  const morphEngine = new MorphEngine({
    durationMs: eraState.transitionMs,
    reducedDurationMs: 500,
  });
  const mixer = new SfxMixer();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    300,
  );
  camera.position.set(12, 10, 18);
  camera.lookAt(0, 1.5, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);
  controls.minDistance = 2;
  controls.maxDistance = 80;

  // Scene modules (each exposes group/update/dispose; none own a loop).
  const shell = new SceneShell(eraState, morphEngine);
  scene.add(shell.group);

  const lighting = new Lighting(scene, eraState, morphEngine);
  const weather = new Weather(scene, eraState, morphEngine);

  // Single wiring point: any era change (slider, keyboard, later programmatic)
  // drives the morph engine and the SFX crossfade.
  eraState.subscribe((era) => {
    morphEngine.setEra(era);
    mixer.setEra(era);
  });

  // UI.
  const topUi = document.createElement('div');
  topUi.className = 'top-ui';
  app.appendChild(topUi);
  const slider = new TimelineSlider({
    container: topUi,
    eraState,
  });

  // Mute toggle (first click also unlocks audio per autoplay policy).
  const audioToggle = document.createElement('button');
  audioToggle.type = 'button';
  audioToggle.className = 'audio-toggle';
  audioToggle.textContent = '🔊 Audio';
  app.appendChild(audioToggle);
  audioToggle.addEventListener('click', () => {
    mixer.init();
    mixer.unlock();
    const muted = mixer.toggleMute();
    audioToggle.textContent = muted ? '🔇 Muted' : '🔊 Audio';
  });

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Drag to rotate · Right-drag to pan · Scroll to zoom · ←/→ to change era';
  app.appendChild(hint);

  // Autoplay-safe SFX: initialize on first user gesture anywhere.
  const unlockAudio = (): void => {
    mixer.init();
    mixer.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Keyboard timeline shortcuts (accessibility).
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      eraState.step(-1);
    } else if (event.key === 'ArrowRight') {
      eraState.step(1);
    }
  });

  // Resize.
  const onResize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // Frame loop.
  let last = performance.now();
  let firstFrame = true;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    controls.update();
    morphEngine.update(dt);
    lighting.update();
    weather.update(dt);
    shell.update(dt);
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      loading.classList.add('hidden');
      window.setTimeout(() => loading.remove(), 500);
    }
  });

  // Global disposal (hot reload / teardown).
  const dispose = (): void => {
    renderer.setAnimationLoop(null);
    slider.dispose();
    eraState.dispose();
    morphEngine.dispose();
    shell.dispose();
    lighting.dispose();
    weather.dispose();
    mixer.dispose();
    controls.dispose();
    renderer.dispose();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('beforeunload', dispose, { once: true });
}

boot();