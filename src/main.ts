/**
 * Main application entrypoint.
 *
 * Bootstraps Three.js renderer, camera, clock-driven render loop,
 * resize handling, loading screen dismissal, and wires up UI components
 * and era state subscriptions.
 */

import * as THREE from 'three';

// Era registry + SFX data
import { ERA_REGISTRY, getEraSpec } from './eras.js';
import defaultEras from './content/eraConfig.js';

// State
import { setEra, subscribe } from './state/eraState.js';

// Scene
import { createCityScene } from './scene/cityScene.js';

// UI
import { createTimeline } from './ui/timeline.js';
import { createInfoPanel } from './ui/infoPanel.js';

// Audio (stub modules — ready for later implementation)
import { createSfxMixer } from './audio/mixer.js';

// ─── Bootstrap ──────────────────────────────────────────────────────────

const containerEl = document.getElementById('canvas-container')!;
const loadingScreen = document.getElementById('loading-screen');

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // placeholder: disabled until geometry supports shadows
containerEl.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);
camera.position.set(30, 20, 30);
camera.lookAt(0, 5, 0);

// Clock
const clock = new THREE.Clock();

// Current scene reference
let currentSceneResult: ReturnType<typeof createCityScene> | null = null;
let prevEraId: EraId | null = null;

/**
 * Render one frame driven by the clock delta.
 */
function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta(); // tick the clock each frame

  // Update camera rig (if we had one active here)
  // cameraRig.update(delta);

  // Update atmosphere layer (sky animation + transition interpolation)
  if (currentSceneResult?.atmosphere) {
    currentSceneResult.atmosphere.update(delta);
  }

  renderer.render(currentSceneResult?.scene ?? new THREE.Scene(), camera);
}

// ─── Initial scene build ────────────────────────────────────────────────

const firstEraId = '1945' as const;
currentSceneResult = createCityScene(defaultEras[firstEraId]);

// Start render loop
requestAnimationFrame(animate);

// Dismiss loading screen after first frame
setTimeout(() => {
  if (loadingScreen) loadingScreen.classList.add('hidden');
}, 300);

// ─── Resize handling ────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ─── UI component mounting ──────────────────────────────────────────────

void createTimeline();
void createInfoPanel();

// ─── Audio mixer init ───────────────────────────────────────────────────

const mixer = createSfxMixer();

// ─── Era state wiring ───────────────────────────────────────────────────

subscribe((eraId) => {
  console.log(`[App] Era changed to ${eraId}`);
  const spec = getEraSpec(eraId);
  console.log(`  → ${spec.label}: ${spec.description.slice(0, 60)}…`);

  // Smooth atmosphere transition (no full scene rebuild)
  if (currentSceneResult?.atmosphere) {
    currentSceneResult.atmosphere.applyEra(eraId as EraId, 2.0);
    prevEraId = eraId;
  } else {
    // Fallback: rebuild entire scene for new era
    currentSceneResult?.dispose();
    currentSceneResult = createCityScene(defaultEras[eraId]);
  }

  // Notify audio mixer
  mixer.setEra(eraId);
});

// ─── Debug helpers on window ────────────────────────────────────────────

// Allow switching eras from browser console for testing
const debugApi = {
  setEra,
  getEras: () => ERA_REGISTRY.map((e) => e.id),
};
Object.assign(window, { cityTimelapse: debugApi });

console.log('[App] City timelapse initialized.');
console.log(`[App] Eras: ${ERA_REGISTRY.map((e) => e.label).join(', ')}`);
