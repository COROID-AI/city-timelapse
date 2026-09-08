import * as THREE from 'three';

import type { InputState } from './game/contracts';
import { createGameLoop } from './game/core';
import { createInputManager } from './game/input';

const FIXED_TIMESTEP_SECONDS = 1 / 60;

/**
 * Boots the neon street racer foundation: a WebGLRenderer/scene/camera
 * stub on the entry canvas plus the shared fixed-timestep game loop and
 * arrow-key input manager.
 *
 * Gameplay content (track, cars, AI, camera, HUD, effects) is owned by
 * later tasks; this bootstrap only proves the runtime foundation.
 */
export function bootNeonRacer(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Neon Street Racer: #game-canvas element not found');
  }
  if (!(window.WebGLRenderingContext && canvas.getContext('webgl2'))) {
    // canvas.getContext('webgl2') returned null — browser lacks WebGL2.
    throw new Error('Neon Street Racer: WebGL2 is not supported by this browser');
  }

  // --- Renderer / scene / camera stub -------------------------------------
  // The renderer resizes with the window so the canvas always fills it.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

  // --- Input --------------------------------------------------------------
  const inputManager = createInputManager();
  inputManager.attach();

  // --- Game loop ----------------------------------------------------------
  const gameLoop = createGameLoop(FIXED_TIMESTEP_SECONDS, {
    update: (_deltaSeconds: number, input: InputState) => {
      // Foundation callback: consume the shared input state.
      // Gameplay modules (track, cars, AI) replace this in later tasks.
      void input;
    },
    render: () => {
      renderer.render(scene, camera);
    },
  });

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  window.addEventListener('resize', resize);
  resize();

  gameLoop.start();

  // --- Cleanup hook (used by tests / hot module replacement) ---------------
  const dispose = () => {
    gameLoop.dispose();
    inputManager.dispose();
    window.removeEventListener('resize', resize);
    renderer.dispose();
  };
  (window as { __neonRacerDispose?: () => void }).__neonRacerDispose = dispose;
}

bootNeonRacer();