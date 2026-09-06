/**
 * city-timelapse entrypoint.
 *
 * Bootstraps the Three.js renderer + clock loop mounted into
 * `#scene-container`, and mounts the top timeline HUD into `#timeline-hud`.
 * The scene subscribes to the HUD's `yearChange` event so future era-content
 * tasks can react to year selection.
 *
 * This task owns the scaffold only: no era-specific 3D content is added here.
 * Downstream era modules will attach their content to the exported scene /
 * clock loop.
 */
import * as THREE from 'three';
import { TimelineHud, YEAR_CHANGE_EVENT } from './ui/timeline';
import type { YearChangeDetail } from './ui/timeline';
import { ERA_KEYS, eraRegistry } from './data/eraRegistry';
import type { EraKey } from './data/eraDefinition';
import './style.css';

// --- Renderer shell -------------------------------------------------------

const containerRaw = document.getElementById('scene-container');
const hudHostRaw = document.getElementById('timeline-hud');
if (!containerRaw || !hudHostRaw) {
  throw new Error('Missing #scene-container / #timeline-hud mount points');
}
const container: HTMLElement = containerRaw;
const hudHost: HTMLElement = hudHostRaw;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  2000,
);
camera.position.set(0, 8, 24);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: container.querySelector('canvas') ?? undefined });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);

if (!renderer.domElement.parentElement) {
  container.appendChild(renderer.domElement);
}

// Minimal, eras-agnostic baseline so the scene is non-empty and lit.
// Era-specific visuals are out of scope for this task.
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(20, 30, 10);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x8a7f6d, roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Clock loop -----------------------------------------------------------

const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  // Reserved for downstream era modules to drive time-based visuals.
  void delta;
  renderer.render(scene, camera);
}
animate();

// --- Timeline HUD ---------------------------------------------------------

const hud = new TimelineHud(hudHost, ERA_KEYS[0]);

/** Log the current era definition whenever the year changes. */
function onYearChange(event: Event): void {
  const detail = (event as CustomEvent<YearChangeDetail>).detail;
  const era = eraRegistry[detail.year];
  // eslint-disable-next-line no-console
  console.log(`yearChange -> ${detail.year}`, era);
}

hudHost.addEventListener(YEAR_CHANGE_EVENT, onYearChange);

// --- Resize handling ------------------------------------------------------

function handleResize(): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', handleResize);

// Expose a minimal, typed handle for downstream integration/testing.
export interface AppHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  hud: TimelineHud;
  setYear: (year: EraKey) => void;
}

export const app: AppHandle = {
  scene,
  camera,
  renderer,
  hud,
  setYear: (year: EraKey) => hud.setActiveYear(year),
};