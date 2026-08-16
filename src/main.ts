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
import { initInspection } from './app/inspection.js';
import { mountTimeline, setEraById as timelineSetEraById } from './ui/timeline.js';
import { mountControls } from './ui/controls-overlay.js';
import { mountHud } from './ui/hud.js';
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
const { sunLight } = setupLights(engine.scene);

// Ground + buildings
const textures = new TextureFactory();
buildGround(engine.scene, textures);

// Controls
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
  }
});

// HUD — show current era info
mountHud();

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
    // Trigger audio controller initialization
    const ac = (coordinator as any)._audioController;
    if (ac) {
      await ac.init();
      await ac.setEra(currentEra);
    }
  } catch {
    // Audio may not be available in all environments
    console.warn('Audio init failed (autoplay policy)');
  }
}

// Listen for first user interaction anywhere on the page
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
    // Already transitioning — force-sync to new target
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
