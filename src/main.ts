/**
 * city-timelapse application composition root.
 *
 * This module is the single composition owner. It:
 *   - mounts the CityScene (renderer, clock loop, era factories, morph engine,
 *     camera navigation) into `#scene-container`,
 *   - mounts the top timeline HUD into `#timeline-hud`,
 *   - wires the HUD `yearChange` event into `CityScene.setYear` so selecting
 *     any of the 5 years transforms the whole scene in one eased transition,
 *   - owns the resize handler and the `app` handle used by downstream wiring.
 *
 * Lifecycle: `bootstrap` (module load) -> `update` (per frame via CityScene) ->
 * `dispose` (teardown).
 */
import { TimelineHud, YEAR_CHANGE_EVENT } from './ui/timeline';
import type { YearChangeDetail } from './ui/timeline';
import { ERA_KEYS } from './data/eraRegistry';
import type { EraKey } from './data/eraDefinition';
import { CityScene } from './scene';
import './style.css';

// --- Mount points ---------------------------------------------------------

const containerRaw = document.getElementById('scene-container');
const hudHostRaw = document.getElementById('timeline-hud');
if (!containerRaw || !hudHostRaw) {
  throw new Error('Missing #scene-container / #timeline-hud mount points');
}
const container: HTMLElement = containerRaw;
const hudHost: HTMLElement = hudHostRaw;

// --- Composition root -----------------------------------------------------

const scene = new CityScene({
  container,
  hudHost,
  initialYear: ERA_KEYS[0],
});

// --- Clock loop (CityScene owns the renderer + morph + navigation) --------

function animate(): void {
  requestAnimationFrame(animate);
  const delta = scene.clock.getDelta();
  scene.tick(delta);
}
animate();

// --- Timeline HUD wiring ---------------------------------------------------

const hud = new TimelineHud(hudHost, ERA_KEYS[0]);

/** Forward a year selection from the HUD into the scene morph engine. */
function onYearChange(event: Event): void {
  const detail = (event as CustomEvent<YearChangeDetail>).detail;
  scene.setYear(detail.year);
}

hudHost.addEventListener(YEAR_CHANGE_EVENT, onYearChange);

// --- Resize handling ------------------------------------------------------

function handleResize(): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  scene.camera.aspect = width / height;
  scene.camera.updateProjectionMatrix();
  scene.renderer.setSize(width, height);
}
window.addEventListener('resize', handleResize);

// --- App handle (downstream wiring / integration) --------------------------

export interface AppHandle {
  scene: CityScene;
  hud: TimelineHud;
  setYear: (year: EraKey) => void;
}

export const app: AppHandle = {
  scene,
  hud,
  setYear: (year: EraKey) => scene.setYear(year),
};