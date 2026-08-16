import * as THREE from 'three';
import { Engine } from './scene/engine.js';
import { setupLights } from './scene/lights.js';
import { Controls } from './scene/controls.js';
import { buildGround } from './scene/ground.js';
import { TextureFactory } from './util/textures.js';

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

// ── Render loop ───────────────────────────────────────────────────────

engine.animate((_delta) => {
  controls.update();
});

console.log('City Era Timelapse — scaffold loaded.');
