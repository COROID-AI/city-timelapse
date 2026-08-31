/**
 * Composition root.
 *
 * Owns: WebGLRenderer, Camera, OrbitControls, lights, the animation loop,
 * resize handling, global disposal. All city modules are created here and
 * driven through update/setEra/dispose.
 *
 * Flow:
 *   1. WebGL capability check (fallback overlay if missing).
 *   2. Build assets offline (procedural textures) -> loading screen.
 *   3. Show boot overlay; audio is gated behind the "Enter" user gesture.
 *   4. Render loop eases the continuous eraIndex toward the selected era and
 *      calls each module's update().
 *
 * Era pipeline: the UI callbacks mutate `eraTarget` — the eased, continuous
 * cursor state.eraIndex follows it, and every city module interpolates from
 * state.eraIndex (the single source of truth). Audio crossfades ride the same
 * eased cursor so visuals and sound stay in sync during a transition.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ERA_IDS, type EraId } from './eras';
import { createInitialState, clamp, type AppState } from './state';
import { createCityScene, type CityScene } from './city/scene';
import { SfxMixer } from './audio/mixer';
import { createCityUi, createBootControls } from './ui';

const boot = createBootControls();
boot.show();

const statusEl = document.getElementById('boot-status');
function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg;
}

// ---- WebGL capability check -------------------------------------------------
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function showFallback(): void {
  const fb = document.getElementById('fallback');
  if (fb) fb.classList.add('visible');
}

if (!detectWebGL()) {
  setStatus('WebGL unavailable');
  showFallback();
  throw new Error('WebGL not supported');
}

// ---- Core objects -----------------------------------------------------------
const appEl = document.getElementById('app');
if (!appEl) throw new Error('#app missing');
const app = appEl;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
camera.position.set(38, 26, 46);

const city: CityScene = createCityScene();
const scene = city.scene;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 4;
controls.maxDistance = 160;
controls.autoRotate = false;

// ---- Lights -----------------------------------------------------------------
scene.add(new THREE.AmbientLight('#ffffff', 0.55));

const sunLight = new THREE.DirectionalLight('#fff2dd', 2.4);
sunLight.position.set(60, 80, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 220;
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight('#9ab8ff', 0.5);
fillLight.position.set(-40, 30, -60);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight('#ffc89a', 0.35);
rimLight.position.set(20, 10, -70);
scene.add(rimLight);

// ---- State & audio ----------------------------------------------------------
const state: AppState = createInitialState();
let mixer: SfxMixer | null = null;
let audioInitialized = false;

// Era easing: eraTarget holds the discrete selection; eraIndex follows it.
const eraTarget = { value: 0 };

function applyEra(era: EraId): void {
  state.era = era;
  eraTarget.value = ERA_IDS.indexOf(era);
}

const ui = createCityUi(
  {
    onEraChange(era: EraId): void {
      applyEra(era);
    },
    onToggleMute(): void {
      state.muted = !state.muted;
      if (mixer) mixer.setMuted(state.muted);
      ui.setMuted(state.muted);
    },
    onToggleQuality(): void {
      state.lowQuality = !state.lowQuality;
      renderer.setPixelRatio(state.lowQuality ? 1 : Math.min(window.devicePixelRatio, 2));
      ui.setLowQuality(state.lowQuality);
    },
  },
);

boot.onEnter(() => {
  if (audioInitialized) return;
  try {
    mixer = new SfxMixer();
    void mixer.init();
    audioInitialized = true;
    setStatus('Audio ready');
  } catch (err) {
    console.warn('Audio unavailable', err);
    setStatus('Audio unavailable');
  }
});

// ---- Resize -----------------------------------------------------------------
function handleResize(): void {
  const w = app.clientWidth || window.innerWidth;
  const h = app.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
handleResize();
const ro = new ResizeObserver(handleResize);
ro.observe(app);

// ---- Render loop ------------------------------------------------------------
const timer = new THREE.Timer();

function stepEra(dt: number): void {
  const rate = state.reducedMotion ? 6 : 2.4;
  const diff = eraTarget.value - state.eraIndex;
  state.eraIndex += clamp(diff, -1, 1) * Math.min(1, dt * rate);
  if (Math.abs(diff) < 0.002) state.eraIndex = eraTarget.value;
  state.era = ERA_IDS[Math.round(state.eraIndex)];
}

function loop(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  state.time += dt;
  stepEra(dt);

  // Open the audio context on the first user gesture (autoplay policy).
  if (!audioInitialized && state.time > 0.5) {
    try {
      mixer = new SfxMixer();
      void mixer.init();
      audioInitialized = true;
    } catch (err) {
      console.warn('Audio unavailable', err);
      audioInitialized = true;
    }
  }
  if (mixer) {
    mixer.eraCursor = state.eraIndex;
    mixer.update(state.time);
  }

  city.update(dt, state);

  controls.update();

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop);

// ---- Initial era ------------------------------------------------------------
applyEra('1945');
city.setEra('1945', 0);

// ---- Dispose -----------------------------------------------------------------
function dispose(): void {
  renderer.setAnimationLoop(null);
  ro.disconnect();
  controls.dispose();
  mixer?.dispose();
  city.dispose();
  renderer.dispose();
  ui.dispose();
}
window.addEventListener('beforeunload', dispose);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) dispose();
});

setStatus('Ready — drag to explore');