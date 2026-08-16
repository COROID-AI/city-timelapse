import * as THREE from 'three';
import { Engine } from './scene/engine.js';
import { setupLights } from './scene/lights.js';
import { Controls } from './scene/controls.js';
import { buildGround } from './scene/ground.js';
import { TextureFactory } from './util/textures.js';
import { PedestrianController, type EraId } from './pedestrians/index.js';

// ── Bootstrap ─────────────────────────────────────────────────────────

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const engine = new Engine(canvas);

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.5,
  500,
);
camera.position.set(35, 25, 35);
(engine.scene as any).__camera = camera; // store for Engine.render
engine.updateCameraAspect(camera);

// Lights
setupLights(engine.scene);

// Ground + buildings
const textures = new TextureFactory();
buildGround(engine.scene, textures);

// Controls
const controls = new Controls(camera, canvas);

// ── Pedestrian crowd ──────────────────────────────────────────────────

const pedestrianController = new PedestrianController(engine.scene);
let currentEra: EraId = '1945';
pedestrianController.updateEra(currentEra);

// Keyboard era switcher (1-5 keys)
const ERA_KEYS: Record<string, EraId> = { '1': '1945', '2': '1965', '3': '1985', '4': '2005', '5': '2025' };
document.addEventListener('keydown', (e) => {
  const era = ERA_KEYS[e.key];
  if (era) {
    currentEra = era;
    pedestrianController.updateEra(era);
    console.log(`Era switched to ${era}`);
  }
});

// ── Render loop ───────────────────────────────────────────────────────

engine.animate((delta) => {
  controls.update();
  pedestrianController.update(delta);
});

console.log('City Era Timelapse — scaffold loaded.');
console.log('Press 1-5 to switch eras.');
