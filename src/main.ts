/**
 * Application entry point — composes the whole city block and mounts the
 * integrated experience.
 *
 * Wiring overview:
 * - One shared era system (`createEraMorphSystem`) owns the timeline core,
 *   the `EraTransformRegistry`, and the staged morph driver. The timeline UI
 *   mutates that same core, so a single slider move is the only era input.
 * - `createCityBlock` mounts buildings, storefront rows, street props, the
 *   traffic fleet, the crowd, and the atmosphere into `cityRoot`, all
 *   registered into the shared registry (facade → signage → fleet → crowd →
 *   lights; sound rides the core via the audio director).
 * - `createStagedEraPump` advances the morph driver each frame and also
 *   dispatches while the slider is dragged, keeping the scene WYSIWYG with
 *   the timeline. The app owns the frame pump, so the timeline UI runs with
 *   `autoAdvance: false`.
 * - Navigation mounts orbit/walk/click-to-focus with the block's era-aware
 *   callout provider and the merged pickable registry.
 * - The audio director subscribes to the shared core for era soundscapes;
 *   `block.connectAudio` bridges documented module sound hooks onto its bus.
 * - The render loop limits frames in flight with WebGL fences so software
 *   WebGL verification environments never queue a command backlog (canvas
 *   readbacks stay fast) while real GPUs keep the full vsynced budget.
 *
 * Client-only invariant: the bundle never performs runtime network access,
 * so no fetch, XMLHttpRequest, or WebSocket calls are used anywhere in src.
 */

import * as THREE from 'three';
import './styles.css';
import { createAppShell } from './scene/shell';
import { mountTimelineUI } from './ui/timeline';
import { createEraMorphSystem } from './era/contracts';
import { createCityBlock } from './city/block';
import { createStagedEraPump } from './city/choreography';
import { createSceneNavigation } from './controls/navigation';
import { AudioDirector } from './audio/director';

const container = document.querySelector<HTMLElement>('#app');
if (!container) {
  throw new Error('App container #app is missing from index.html');
}

const shell = createAppShell(container);

// Composition-budget trims, applied to shell instances (the shell module
// itself stays untouched):
// - explicit PCF shadows at 1024² (the legacy soft variant is removed
//   upstream and falls back to PCF anyway) — quarter the depth-pass cost of
//   the authored cast-shadow set with no visible loss at block scale;
// - pixel-ratio cap 1.5 — keeps retina clients crisp while bounding fill
//   rate, which is what keeps the block inside the 60fps budget.
shell.renderer.shadowMap.type = THREE.PCFShadowMap;
shell.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
shell.resize();
const sunLight = shell.scene.getObjectByName('sunLight');
if (sunLight instanceof THREE.DirectionalLight) {
  sunLight.shadow.mapSize.set(1024, 1024);
}

// Shared era system: one core for the slider, the morph registry, and audio.
const eraSystem = createEraMorphSystem();

// Composed block corner. `medium` quality keeps the per-era grade (sky, fog,
// blended exposure, CSS vignette) while leaving the bloom composer out of the
// 60fps composition loop — the shell owns presentation (`renderer.render`).
const block = createCityBlock({
  scene: shell.scene,
  cityRoot: shell.cityRoot,
  eraSystem,
  renderer: shell.renderer,
  quality: 'medium',
});

// Audio director on the same core; module hooks are bridged below.
const audio = new AudioDirector({ core: eraSystem.core });
block.connectAudio(audio);
audio.armFirstGesture(); // unlock on the first click/tap (browser autoplay policy)

// Fixed-top era timeline sharing the core; the app owns the frame pump, so
// the UI never advances the core on its own loop.
const timeline = mountTimelineUI({
  container: shell.overlayRoot,
  core: eraSystem.core,
  autoAdvance: false,
  onMuteChange: (muted) => {
    audio.setMuted(muted);
  },
});

/* ------------------------------------------------------------------ *
 * Frame pump — the app owns presentation pacing.
 *
 * The shell's built-in loop submits one render per rAF with no
 * backpressure. On a software WebGL renderer (the whole-block verification
 * environment) the command queue then runs far ahead of the GPU, so every
 * canvas readback — screenshots, verification captures — stalls behind the
 * backlog. This pump keeps every shell update semantic identical but limits
 * frames in flight with WebGL fences: while the GPU is still draining, an
 * rAF tick advances simulation and UI only, and rendering resumes as soon
 * as the queue drains. On a real GPU the fence signals within a frame, so
 * the loop stays vsynced at the full 60fps budget.
 *
 * Update consumers (navigation, future modules) register through the same
 * `onUpdate` contract the shell exposes; this app-local set replaces the
 * shell's internal pump, which stays untouched for its own tests.
 * ------------------------------------------------------------------ */
const MAX_FRAMES_IN_FLIGHT = 2;
const sceneUpdaters = new Set<(deltaSeconds: number) => void>();
const pump = createStagedEraPump(eraSystem);
const gl = shell.renderer.getContext();
/** WebGL2 context when fences are available (three renders through WebGL2). */
const gl2: WebGL2RenderingContext | null =
  typeof (gl as WebGL2RenderingContext).fenceSync === 'function'
    ? (gl as WebGL2RenderingContext)
    : null;
const inFlight: WebGLSync[] = [];
let elapsedSeconds = 0;
let previousTime = performance.now();
let rafId = 0;
let running = false;

const onUpdate = (callback: (deltaSeconds: number) => void): (() => void) => {
  sceneUpdaters.add(callback);
  return () => {
    sceneUpdaters.delete(callback);
  };
};

const collectFences = (): void => {
  if (!gl2) return;
  while (inFlight.length > 0) {
    const sync = inFlight[0];
    const status = gl2.clientWaitSync(sync, gl2.SYNC_FLUSH_COMMANDS_BIT, 0);
    if (
      status === gl2.WAIT_FAILED ||
      status === gl2.ALREADY_SIGNALED ||
      status === gl2.CONDITION_SATISFIED
    ) {
      inFlight.shift();
      gl2.deleteSync(sync);
      continue;
    }
    return; // oldest fence still pending
  }
};

const frame = (timestamp: number): void => {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  const deltaSeconds = Math.min(Math.max((timestamp - previousTime) / 1000, 0), 0.1);
  previousTime = timestamp;
  elapsedSeconds += deltaSeconds;

  // Staged era morph, module animation, navigation damping, HUD, audio —
  // every tick, regardless of render backpressure.
  pump.advance(deltaSeconds);
  block.update(deltaSeconds, elapsedSeconds, shell.camera);
  for (const update of sceneUpdaters) update(deltaSeconds);
  timeline.refresh();
  audio.update(deltaSeconds);
  audio.setListenerPosition(shell.camera.position.x, shell.camera.position.z);

  if (gl2) {
    collectFences();
    if (inFlight.length >= MAX_FRAMES_IN_FLIGHT) return; // GPU still draining
  }
  shell.renderer.render(shell.scene, shell.camera);
  if (gl2) {
    const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) {
      gl2.flush();
      inFlight.push(sync);
    }
  }
};

const startLoop = (): void => {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(frame);
};

const stopLoop = (): void => {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  if (gl2) for (const sync of inFlight) gl2.deleteSync(sync);
  inFlight.length = 0;
};

// Orbit + walk + click-to-focus with era-aware callouts for every pickable.
const navigation = createSceneNavigation({
  domElement: shell.renderer.domElement,
  camera: shell.camera,
  onUpdate,
  overlayRoot: shell.overlayRoot,
  calloutContentProvider: block.calloutContentProvider,
  bounds: block.navigationBounds(),
  maxDistance: 120,
});
block.registerPickables(navigation);

// Expose the composed runtime for dev debugging and browser-side verification.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__timelapseShell = shell;
  (window as unknown as Record<string, unknown>).__timelapseTimeline = timeline;
  (window as unknown as Record<string, unknown>).__timelapseBlock = block;
  (window as unknown as Record<string, unknown>).__timelapseNavigation = navigation;
  (window as unknown as Record<string, unknown>).__timelapseEra = eraSystem;
  (window as unknown as Record<string, unknown>).__timelapseStop = stopLoop;
}

startLoop();
