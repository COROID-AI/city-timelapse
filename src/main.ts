import './style.css';
import { createScene } from './scene';
import { createCityBlock } from './cityBlock';
import { createTimeline, PERIOD_YEARS } from './timeline';
import type { PeriodYear } from './timeline';
import { ERAS } from './eras/data';
import { Mixer } from './audio/mixer';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

// ---- Three.js stage: camera, renderer, lighting, fog and render loop ----
const sceneContext = createScene(container);

// ---- Era-driven city block: procedural buildings, vehicles, pedestrians ----
const cityBlock = createCityBlock(sceneContext.scene, 1945);

// ---- Procedural ambient audio mixer (starts muted; user gesture unlocks) ----
const mixer = new Mixer();

// ---- Atmospheric overlays: gradient sky tint, vignette, film grain ----
buildAtmosphereOverlays(container);

// ---- UI control bar: view-mode toggle, audio toggle, FPS readout ----
const { controlBar, viewToggle, audioToggle, fpsReadout } = buildControlBar();
container.appendChild(controlBar);

// View-mode toggle — switches between orbit and first-person fly (WASD).
sceneContext.cameraController.onModeChange((mode) => {
  viewToggle.textContent =
    mode === 'orbit' ? 'View: Orbit' : 'View: Fly (WASD · Esc)';
});
viewToggle.addEventListener('click', () =>
  sceneContext.cameraController.toggleMode(),
);

// Audio toggle — must be triggered from a click to satisfy autoplay policy.
let audioOn = false;
const toggleAudio = (): void => {
  if (audioOn) {
    mixer.stop();
    audioOn = false;
    audioToggle.textContent = 'Audio: Off';
    audioToggle.classList.remove('is-on');
  } else {
    mixer.play();
    audioOn = true;
    audioToggle.textContent = 'Audio: On';
    audioToggle.classList.add('is-on');
  }
};
audioToggle.addEventListener('click', toggleAudio);

// ---- Apply a full era change across every subsystem ----
let eraIndex = 0;
const applyEra = (year: PeriodYear): void => {
  eraIndex = PERIOD_YEARS.indexOf(year);
  sceneContext.setEra(ERAS[year]);
  cityBlock.setActiveEra(year);
  mixer.setEra(year);
  document.documentElement.style.setProperty('--sky-tint', ERAS[year].skyTint);
};

// ---- Timeline overlay — emits a debounced selection for each of the 5 years ----
const timeline = createTimeline(container, PERIOD_YEARS[0], (year) => {
  applyEra(year);
});

// ---- Keyboard shortcuts: V, M, Arrow keys ----
const stepEra = (direction: number): void => {
  const next = Math.max(
    0,
    Math.min(PERIOD_YEARS.length - 1, eraIndex + direction),
  );
  if (next !== eraIndex) timeline.setValue(PERIOD_YEARS[next]);
};

window.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

  switch (event.code) {
    case 'KeyV':
      sceneContext.cameraController.toggleMode();
      break;
    case 'KeyM':
      toggleAudio();
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      // Arrows steer the player in fly mode; the timeline thumb handles its
      // own keyboard events when focused.
      if (sceneContext.cameraController.getMode() === 'fly') return;
      if (target.classList.contains('timeline-thumb')) return;
      stepEra(event.code === 'ArrowRight' ? 1 : -1);
      event.preventDefault();
      break;
  }
});

// ---- FPS readout (updates at least once per second) ----
let frameCount = 0;
let fpsLastTime = performance.now();
const fpsLoop = (): void => {
  requestAnimationFrame(fpsLoop);
  frameCount++;
  const now = performance.now();
  const elapsed = now - fpsLastTime;
  if (elapsed >= 1000) {
    fpsReadout.textContent = `${Math.round((frameCount * 1000) / elapsed)} FPS`;
    frameCount = 0;
    fpsLastTime = now;
  }
};
fpsLoop();

// Sync the initial era atmosphere across every subsystem.
applyEra(PERIOD_YEARS[0]);

// ---- Clean teardown on hot-module replacement during development ----
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneContext.dispose();
    cityBlock.dispose();
    mixer.dispose();
    timeline.dispose();
  });
}

// ---- DOM helpers ----

function buildControlBar(): {
  controlBar: HTMLDivElement;
  viewToggle: HTMLButtonElement;
  audioToggle: HTMLButtonElement;
  fpsReadout: HTMLSpanElement;
} {
  const controlBar = document.createElement('div');
  controlBar.className = 'control-bar';

  const viewToggle = document.createElement('button');
  viewToggle.className = 'control-btn';
  viewToggle.type = 'button';
  viewToggle.textContent = 'View: Orbit';

  const audioToggle = document.createElement('button');
  audioToggle.className = 'control-btn';
  audioToggle.type = 'button';
  audioToggle.textContent = 'Audio: Off';

  const divider = document.createElement('span');
  divider.className = 'control-divider';

  const fpsLabel = document.createElement('span');
  fpsLabel.className = 'fps-label';
  fpsLabel.textContent = 'FPS';

  const fpsReadout = document.createElement('span');
  fpsReadout.className = 'fps-readout';
  fpsReadout.textContent = '—';

  controlBar.append(viewToggle, audioToggle, divider, fpsLabel, fpsReadout);
  return { controlBar, viewToggle, audioToggle, fpsReadout };
}

function buildAtmosphereOverlays(root: HTMLElement): void {
  const sky = document.createElement('div');
  sky.className = 'atmosphere-overlay';

  const vignette = document.createElement('div');
  vignette.className = 'vignette-overlay';

  const grain = document.createElement('div');
  grain.className = 'grain-overlay';

  root.append(sky, vignette, grain);
}
