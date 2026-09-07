import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createEraState } from './state/eraState';
import { createCityBlockLayout, createDefaultBuildingShells } from './layout/cityBlockLayout';
import { createCameraRig, CameraRig } from './camera/cameraRig';
import { createSfxContext } from './audio/sfxContext';
import { createUiRoot } from './ui/uiRoot';
import { createTimelineSlider } from './ui/timelineSlider';
import { createRenderer } from './render/renderer';
import { createPlaceholderVehicle } from './vehicles/placeholderVehicle';
import './styles.css';

/**
 * Application bootstrap: wires the Three.js scene, renderer, camera rig,
 * era state, timeline slider, joystick, vehicle, and audio hook together.
 */
export interface App {
  /** The Three.js scene. */
  readonly scene: Scene;
  /** The WebGL renderer. */
  readonly renderer: WebGLRenderer;
  /** The camera rig. */
  readonly cameraRig: CameraRig;
  /** The era state store. */
  readonly eraState: ReturnType<typeof createEraState>;
  /** Time-of-day preview in [0, 1]. */
  timeOfDay: number;
  /** Dispose the app. */
  dispose(): void;
}

export function createApp(appRoot: HTMLElement): App {
  // Era state (defaults to 1945).
  const eraState = createEraState(1945);

  // Layout.
  const layout = createCityBlockLayout();
  const shells = createDefaultBuildingShells(layout, eraState.year);

  // Three.js scene + camera + renderer.
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1.0);
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  appRoot.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas });

  // Build scene content.
  const render = createRenderer(layout, shells);
  const vehicle = createPlaceholderVehicle(scene, layout);
  const light = render.light;

  // Camera rig.
  const cameraRig = createCameraRig(camera, layout.bounds);

  // UI overlay root + timeline slider.
  const uiRoot = createUiRoot(appRoot, eraState);
  const timeline = createTimelineSlider(uiRoot.element, eraState);

  // Audio hook (initialized on first gesture).
  const sfx = createSfxContext();

  // Time-of-day preview.
  let timeOfDay = 0.5;
  light.setTimeOfDay(timeOfDay);

  // --- Mouse look ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    sfx.blip(220);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    cameraRig.look(dx, dy);
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  // --- Orbit button ---
  const orbitButton = document.createElement('button');
  orbitButton.className = 'orbit-button';
  orbitButton.textContent = 'Orbit';
  orbitButton.addEventListener('click', () => {
    if (cameraRig.orbiting) {
      cameraRig.stopOrbit();
      orbitButton.textContent = 'Orbit';
    } else {
      cameraRig.startOrbit();
      orbitButton.textContent = 'Free';
    }
  });
  uiRoot.element.appendChild(orbitButton);

  // --- Joystick (touch/mobile) ---
  const joystick = document.createElement('div');
  joystick.className = 'joystick';
  const base = document.createElement('div');
  base.className = 'joystick-base';
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);
  joystick.appendChild(base);
  uiRoot.element.appendChild(joystick);

  let joystickActive = false;
  const joystickCenter = { x: 0, y: 0 };
  const JOY_RADIUS = 40;

  const updateJoystick = (cx: number, cy: number) => {
    let dx = cx - joystickCenter.x;
    let dy = cy - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    cameraRig.setJoystick(dx / JOY_RADIUS, dy / JOY_RADIUS);
  };

  joystick.addEventListener('pointerdown', (e) => {
    joystickActive = true;
    const r = base.getBoundingClientRect();
    joystickCenter.x = r.left + r.width / 2;
    joystickCenter.y = r.top + r.height / 2;
    updateJoystick(e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!joystickActive) return;
    updateJoystick(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', () => {
    if (!joystickActive) return;
    joystickActive = false;
    knob.style.transform = 'translate(0px, 0px)';
    cameraRig.setJoystick(0, 0);
  });

  // --- Time-of-day preview slider ---
  const tod = document.createElement('div');
  tod.className = 'tod';
  const label = document.createElement('label');
  label.textContent = 'Time of day';
  const todInput = document.createElement('input');
  todInput.type = 'range';
  todInput.min = '0';
  todInput.max = '1';
  todInput.step = '0.01';
  todInput.value = '0.5';
  tod.appendChild(label);
  tod.appendChild(todInput);
  uiRoot.element.appendChild(tod);
  todInput.addEventListener('input', () => {
    const v = Number(todInput.value);
    timeOfDay = v;
    light.setTimeOfDay(v);
  });

  // --- Main loop ---
  let last = performance.now();
  let disposed = false;
  const loop = () => {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    cameraRig.update(dt);
    vehicle.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    scene,
    renderer,
    cameraRig,
    eraState,
    get timeOfDay() {
      return timeOfDay;
    },
    set timeOfDay(v) {
      timeOfDay = v;
      light.setTimeOfDay(v);
    },
    dispose() {
      disposed = true;
      cameraRig.dispose();
      sfx.dispose();
      timeline.dispose();
      renderer.dispose();
    },
  };
}

// Bootstrap when loaded as the module entrypoint.
const appRoot = document.getElementById('app');
if (appRoot) {
  createApp(appRoot);
}