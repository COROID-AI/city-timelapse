import * as THREE from 'three';
import { Engine } from './scene/engine.js';
import { setupLights } from './scene/lights.js';
import { Controls } from './scene/controls.js';
import { buildGround } from './scene/ground.js';
import { TextureFactory } from './util/textures.js';
import { ERA_REGISTRY, type EraId } from './eras.js';
import { BuildingTextureBuilder } from './buildings/parts.js';
import { PedestrianController } from './pedestrians/controller.js';
import { EraCoordinator } from './app/eraCoordinator.js';
import { EnvironmentManager } from './app/environment.js';
import { AmbientParticles } from './fx/particles.js';
import { initInspection } from './app/inspection.js';
import { mountTimeline, setEraById as timelineSetEraById } from './ui/timeline.js';
import { mountControls } from './ui/controls-overlay.js';
import { mountHud, injectTimeOfDayControl } from './ui/hud.js';
import { isTransitionRunning } from './app/transitions.js';
import {
  initPerfSystem,
  perfTick,
} from './app/perf.js';

// ── Bootstrap ────────────────────────────────────────────────────────────

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// Initialize performance system (registers backtick hotkey immediately)
initPerfSystem();

const engine = new Engine(canvas, { maxPixelRatio: undefined }); // uses MAX_PIXEL_RATIO from config

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.5,
  500,
);
camera.position.set(35, 25, 35);
(engine.scene as any).__camera = camera;
engine.updateCameraAspect(camera);

// Lights — capture sun light reference for perf monitoring
const lights = setupLights(engine.scene);
const { sunLight } = lights;

// ── Era-Aware Environment Manager ────────────────────────────────────────

// Create night emissive point lights scattered across the scene
// These will dominate at night with era-specific color temperatures
const emissiveLights: THREE.Light[] = [];

function _addEmissive(x: number, y: number, z: number): void {
  const pl = new THREE.PointLight(0xffffff, 0, 25, 2);
  pl.position.set(x, y, z);
  pl.visible = false;
  engine.scene.add(pl);
  emissiveLights.push(pl);
}

_addEmissive(-15, 3, -10);
_addEmissive(10, 3, 5);
_addEmissive(-5, 3, 15);
_addEmissive(20, 3, -5);
_addEmissive(0, 3, -20);
_addEmissive(-20, 3, 10);

const envManager = new EnvironmentManager({
  scene: engine.scene,
  sunLight,
  hemiLight: lights.hemiLight,
  ambientLight: lights.ambientLight,
  emissiveLights,
});

// ── Ambient Particles ────────────────────────────────────────────────────

const ambientFX = new AmbientParticles({
  scene: engine.scene,
  initialEra: '1945',
});
ambientFX.start(); // auto-update via internal rAF loop

// ── Ground + Buildings ───────────────────────────────────────────────────

const textures = new TextureFactory();
buildGround(engine.scene, textures);

// ── Controls ─────────────────────────────────────────────────────────────

const controls = new Controls(camera, canvas);

// Per-building texture builder
const bldgTextures = new BuildingTextureBuilder();

// ── Era Coordinator (central state manager) ──────────────────────────────

const coordinator = new EraCoordinator({
  scene: engine.scene,
  textures,
  buildingTextures: bldgTextures,
});
coordinator.init();

let currentEra: EraId = coordinator.currentEra;

// ── UI Assembly ──────────────────────────────────────────────────────────

// Mount timeline slider (emits era-change events)
mountTimeline();

// Wire timeline → coordinator: listen for era-change DOM events
window.addEventListener('erachange', (e: Event) => {
  const detail = (e as CustomEvent<{ eraId: EraId; year: number; label: string; description: string }>).detail;
  if (detail && detail.eraId) {
    currentEra = detail.eraId;
    coordinator.handleEraChange(detail);
    // Also update environment manager directly for smooth blending
    envManager.setEra(detail.eraId);
  }
});

// HUD — show current era info
const hudEl = mountHud();

// Inject time-of-day slider into the HUD
injectTimeOfDayControl(hudEl, envManager);

// Controls overlay
mountControls();

// ── First-Gesture Audio Unlock ───────────────────────────────────────────

/**
 * Web Audio autoplay policy requires a user gesture before
 * creating an AudioContext. We initialize audio on the first
 * click or keypress, then set the initial era which starts playback.
 */
let audioInitialized = false;

async function unlockAudio(): Promise<void> {
  if (audioInitialized) return;
  audioInitialized = true;
  try {
    const ac = (coordinator as any)._audioController;
    if (ac) {
      await ac.init();
      await ac.setEra(currentEra);
    }
  } catch {
    console.warn('Audio init failed (autoplay policy)');
  }
}

function onFirstGesture(): void {
  unlockAudio();
  document.removeEventListener('pointerdown', onFirstGesture);
  document.removeEventListener('keydown', onFirstGesture);
}
document.addEventListener('pointerdown', onFirstGesture);
document.addEventListener('keydown', onFirstGesture);

// ── Debug Hotkeys ────────────────────────────────────────────────────────

/** Cycle through eras sequentially */
function cycleEra(delta: number): void {
  const idx = ERA_REGISTRY.findIndex((e) => e.id === currentEra);
  const nextIdx = ((idx + delta) % ERA_REGISTRY.length + ERA_REGISTRY.length) % ERA_REGISTRY.length;
  const nextEra = ERA_REGISTRY[nextIdx].id;
  currentEra = nextEra;

  if (isTransitionRunning()) {
    coordinator.forceSwitchEra(nextEra);
  } else {
    coordinator.switchEra(nextEra);
  }
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // D = dump scene stats
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    console.log(coordinator.dumpSceneStats());
  }

  // Left/Right arrow to cycle era
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    cycleEra(dir);
  }

  // Number keys 1-5 for direct era jump
  const ERA_KEYS: Record<string, EraId> = { '1': '1945', '2': '1965', '3': '1985', '4': '2005', '5': '2025' };
  const era = ERA_KEYS[e.key];
  if (era) {
    currentEra = era;
    timelineSetEraById(era);
    coordinator.switchEra(era);
    envManager.setEra(era);
  }
});

// ── Click-to-Inspect Interaction ────────────────────────────────────────

initInspection({
  renderer: engine.renderer,
  scene: engine.scene,
  getCurrentEra: () => currentEra,
  getCamera: () => camera,
  animateCallback: (_delta) => {
    // Internal inspection frame loop runs independently
    void _delta;
  },
});

// ── Render Loop ──────────────────────────────────────────────────────────

engine.animate((delta) => {
  controls.update();

  // Update pedestrian animation each frame
  const pc = (coordinator as any)._pedestrianController as PedestrianController | undefined;
  if (pc) {
    pc.update(delta);
  }

  // Update environment (sky/fog/sun/day-night) every frame
  envManager.updateFrame(delta);

  // Update particles every frame
  ambientFX.update(delta);

  // Performance monitoring tick (adaptive quality + debug overlay)
  const transitioning = isTransitionRunning();
  perfTick(
    engine.scene,
    engine.renderer,
    sunLight,
    currentEra,
    transitioning,
  );
});

console.log('City Era Timelapse — fully assembled.');
console.log('Press D to dump scene stats. Arrow keys or 1-5 to switch eras.');
console.log('Click or press any key to enable audio.');
console.log('Press ` (backtick) to toggle performance debug overlay.');
