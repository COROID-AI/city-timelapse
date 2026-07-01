/**
 * Application entry point for the city timelapse.
 *
 * Wires the scene shell, cinematic camera, city-block population and audio
 * mixer into a running web app with an OrbitControls-driven navigation model
 * and a timeline slider that hot-swaps eras.
 *
 * Run via `npm run dev` (Vite dev server).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createScene, type SceneController } from './scene';
import { createCameraController } from './cameraController';
import { createCityBlock, type CityBlockController } from './cityBlock';
import { buildEraAssets } from './assetBuilder/eras';
import type { Era } from './eras/types';
import { AudioMixer } from './audio/mixer';

// ---------------------------------------------------------------------------
// Era mapping
// ---------------------------------------------------------------------------

/** The five selectable timeline years in chronological order. */
const ERAS: readonly Era[] = [1945, 1965, 1985, 2005, 2025];

let currentEraIndex = 0;

// ---------------------------------------------------------------------------
// DOM bootstrap
// ---------------------------------------------------------------------------

const canvasEl = document.getElementById('scene');
if (!canvasEl) {
  throw new Error('Canvas element #scene not found in the document.');
}
const canvas = canvasEl as HTMLCanvasElement;

const sliderEl = document.getElementById('timeline');
if (!sliderEl) {
  throw new Error('Timeline slider #timeline not found in the document.');
}
const slider = sliderEl as HTMLInputElement;

const eraNameEl = document.getElementById('era-name');
if (!eraNameEl) {
  throw new Error('Era name label #era-name not found in the document.');
}
const eraNameLabel = eraNameEl as HTMLElement;

// ---------------------------------------------------------------------------
// Audio (lazy — browser autoplay policies require a user gesture)
// ---------------------------------------------------------------------------
//
// Declared BEFORE applyEra() is first called so the function can safely read
// `mixer` without hitting the temporal dead zone.

let mixer: AudioMixer | null = null;
let audioInitialized = false;

/** Create and start the audio mixer on the first user gesture. */
function initAudio(): void {
  if (audioInitialized) return;
  audioInitialized = true;
  mixer = new AudioMixer();
  void mixer.start(ERAS[currentEraIndex]);
}

document.body.addEventListener('click', initAudio, { once: true });

// ---------------------------------------------------------------------------
// Scene + city block + camera
// ---------------------------------------------------------------------------

const scene: SceneController = createScene(canvas, ERAS[0]);

const block: CityBlockController = createCityBlock();
scene.scene.add(block.root);

// Use the cinematic camera controller to frame a nice initial overview pose,
// then hand off entirely to OrbitControls for free browsing.
const cameraController = createCameraController({
  camera: scene.camera,
  bounds: { halfWidth: 40, halfDepth: 40 },
});
cameraController.update(0, 0);

const controls = new OrbitControls(scene.camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 300;
controls.maxPolarAngle = Math.PI * 0.49; // stay above the ground plane
controls.target.set(0, 5, 0);
controls.update();

// ---------------------------------------------------------------------------
// Era application
// ---------------------------------------------------------------------------

/**
 * Build and apply the content bundle for the era at `eraIndex`: update the
 * scene's fog/lighting/ground, repopulate the city block, refresh the era
 * label, and crossfade the audio bed if the mixer is running.
 */
function applyEra(eraIndex: number): void {
  const era = ERAS[eraIndex];
  const content = buildEraAssets(era);

  scene.updateEra(content);
  block.populate(content);
  eraNameLabel.textContent = content.name;

  if (mixer) {
    mixer.handleEraChange(era);
  }
}

// Populate the initial era before the first frame.
applyEra(0);

// ---------------------------------------------------------------------------
// Timeline slider
// ---------------------------------------------------------------------------

slider.addEventListener('input', () => {
  currentEraIndex = parseInt(slider.value, 10);
  applyEra(currentEraIndex);
});

// ---------------------------------------------------------------------------
// Resize handling
// ---------------------------------------------------------------------------

function onResize(): void {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  scene.camera.aspect = w / h;
  scene.camera.updateProjectionMatrix();
  scene.renderer.setSize(w, h, false);
}

window.addEventListener('resize', onResize);
onResize();

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate(): void {
  const elapsed = clock.getElapsedTime();

  controls.update();

  // Drive pedestrian walk-cycle poses so crowds feel alive while browsing.
  for (const ped of block.pedestrians) {
    ped.rig.walk(elapsed, 1.2);
  }

  scene.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
