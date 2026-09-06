import './style.css';

/**
 * Inert application entry point for the foundation scaffold.
 *
 * This module is intentionally a placeholder: it mounts the foundation DOM
 * (already present in index.html) and no-ops. The `main-integration` task
 * replaces this file with the real Three.js boot, era registry composition,
 * and render loop.
 */

const app = document.querySelector<HTMLDivElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#view');

if (!app || !canvas) {
  throw new Error('Foundation mount points (#app, #view) missing from index.html.');
}

// No-op: the 3D scene, timeline interactivity, and era switching are wired by
// main-integration and the UI task on top of the shared contracts in
// src/types.ts and src/eras/registry.ts.

void app;
void canvas;