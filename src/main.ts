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
import { CameraDirector } from './core/CameraDirector';
import { Polish } from './core/Polish';
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

  const lighting = new Lighting(scene, eraState, morphEngine);
  const weather = new Weather(scene, eraState, morphEngine);
  // Cinematic polish + camera director. Polish is constructed BEFORE the
  // SceneShell so its era subscription (detail veil capture) runs before the
  // building module rebuilds/disposes the leaving era's detail meshes.
  const polish = new Polish(scene, camera, renderer, eraState, morphEngine);
  scene.add(polish.group);

  // Scene modules (each exposes group/update/dispose; none own a loop).
  const shell = new SceneShell(eraState, morphEngine);
  scene.add(shell.group);

  const director = new CameraDirector({
    camera,
    controls,
    eraState,
    morphEngine,
  });

  // UI shell: the title + era readout + timeline mount into the fixed
  // top-center cluster (.top-ui). The body/_.ui-shell data-era attribute
  // drives the era-matched typography/colour of the whole shell.
  const shellWrap = document.createElement('div');
  shellWrap.className = 'ui-shell';
  shellWrap.dataset.era = eraState.era;
  document.body.appendChild(shellWrap);

  const topUi = document.createElement('div');
  topUi.className = 'top-ui';
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'City Time Period Timelapse';
  const subtitle = document.createElement('span');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = '1945 → 2025 · one city block, eighty years';
  title.appendChild(subtitle);
  topUi.appendChild(title);
  const slider = new TimelineSlider({
    container: topUi,
    eraState,
  });
  shellWrap.appendChild(topUi);

  // Mute toggle (first click also unlocks audio per autoplay policy).
  const audioToggle = document.createElement('button');
  audioToggle.type = 'button';
  audioToggle.className = 'audio-toggle';
  audioToggle.textContent = '🔊 Audio';
  audioToggle.setAttribute('aria-pressed', mixer.isMuted ? 'true' : 'false');
  audioToggle.setAttribute('aria-label', 'Toggle era ambient audio');
  shellWrap.appendChild(audioToggle);
  audioToggle.addEventListener('click', () => {
    mixer.init();
    mixer.unlock();
    const muted = mixer.toggleMute();
    audioToggle.textContent = muted ? '🔇 Muted' : '🔊 Audio';
    audioToggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
  });

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Drag to rotate · Right-drag to pan · Scroll to zoom · Tab to slider, arrows for era';
  shellWrap.appendChild(hint);

  // Single wiring point: any era change (slider, keyboard, later programmatic)
  // drives the morph engine and the SFX crossfade on the shared morph timeline.
  eraState.subscribe((era) => {
    morphEngine.setEra(era);
    mixer.setEra(era);
    // Era-matched UI shell theme (typography/colour) follows the selection.
    shellWrap.dataset.era = era;
    document.body.dataset.era = era;
  });

  // Autoplay-safe SFX: initialize on first user gesture anywhere.
  const unlockAudio = (): void => {
    mixer.init();
    mixer.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Keyboard timeline shortcuts (accessibility). Ignored while the slider
  // handle (or any other focusable control) has focus — the range input and
  // tick buttons handle their own arrow keys.
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const focusable =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute?.('role') === 'slider');
    if (focusable) {
      return;
    }
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
    polish.setSize(window.innerWidth, window.innerHeight);
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
    director.update();
    lighting.update();
    weather.update(dt);
    shell.update(dt);
    polish.update(dt);
    polish.render();

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
    polish.dispose();
    director.dispose();
    mixer.dispose();
    controls.dispose();
    renderer.dispose();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    shellWrap.remove();
  };
  window.addEventListener('beforeunload', dispose, { once: true });
}

boot();