/**
 * src/main.ts — Integration wiring
 *
 * Boots the full City Timelapse app: scene core + armature + sky, registers
 * all five era modules with EraStage, connects timeline UI to
 * timelineController (onEraChange → SfxMixer.setEra + sky lerp), defaults to
 * 1945, and provides HUD + loading state + audio-enable button.
 *
 * Composition only — no new scene/audio/timeline systems.
 */

import { SceneEngine } from './scene/engine.js';
import { buildArmature } from './scene/armature.js';
import { SkyRig, ATMOSPHERE_1945, ATMOSPHERE_2025 } from './scene/sky.js';
import { EraStage } from './scene/eraStage.js';
import { fpsMonitor } from './scene/resources.js';
import { DebugFPSOverlay } from './ui/components/debugOverlay.js';
import { TimelineController } from './scene/timelineController.js';
import { SfxMixer } from './audio/mixer.js';
import { mountTimeline, selectEra as timelineSelectEra } from './ui/timeline.js';
import type { EraId } from './eras.js';
import { era1945 } from './eras/1945.js';
import { era1965 } from './eras/1965.js';
import { era1985 } from './eras/1985.js';
import { era2005 } from './eras/2005.js';
import { era2025 } from './eras/2025.js';
import { ERA_REGISTRY } from './eras.js';
import { getEraAtmosphere } from './scene/sky.js';

// ── Constants ────────────────────────────────────────────────

// Map era IDs to pre-built module instances.
const ERA_CONTENT_MODULES: Record<string, typeof era1945> = {
  '1945': era1945,
  '1965': era1965,
  '1985': era1985,
  '2005': era2005,
  '2025': era2025,
};

// ══════════════════════════════════════════════════════════════
// Scene core
// ══════════════════════════════════════════════════════════════

// Create canvas dynamically (original pattern: renderer without canvas param).
let canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.id = 'webgl-canvas';
  const container = document.getElementById('container');
  if (container) container.appendChild(canvas);
}

const engine = new SceneEngine(canvas);
const { scene, camera, renderer } = engine;

// buildArmature() takes no args — creates its own group internally.
const armatureGroup = buildArmature();
scene.add(armatureGroup);

// ── Per-era atmosphere rig ────────────────────────────────────────
// Start with 2025 (A) → 1945 (B), then swap at runtime when eras change.
const skyRig = new SkyRig(scene, renderer, ATMOSPHERE_2025, ATMOSPHERE_1945);

// EraStage manages per-era content mounting, visibility, and transition.
const eraStage = new EraStage(scene);

// ══════════════════════════════════════════════════════════════
// Loading overlay
// ══════════════════════════════════════════════════════════════

// Loading overlay (guarded — may not exist in all environments).
const _loadingOverlay = document.getElementById('loading-overlay');

function showLoading(message: string): void {
  if (!_loadingOverlay) return;
  const msgEl = _loadingOverlay.querySelector('.loading-message') as HTMLElement;
  const barEl = _loadingOverlay.querySelector('.loading-bar-inner') as HTMLElement;
  if (msgEl) msgEl.textContent = message;
  if (barEl) barEl.style.width = '0%';
  _loadingOverlay.classList.add('visible');
}

function hideLoading(): void {
  if (!_loadingOverlay) return;
  _loadingOverlay.classList.remove('visible');
}

function setProgress(pct: number): void {
  if (!_loadingOverlay) return;
  const barEl = _loadingOverlay.querySelector('.loading-bar-inner') as HTMLElement;
  if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

// ══════════════════════════════════════════════════════════════
// HUD & Controls
// ══════════════════════════════════════════════════════════════

const hud = document.getElementById('hud')!;

// Current-year display (top-left, outside the timeline strip).
const yearDisplay = document.createElement('div');
yearDisplay.id = 'hud-year-display';
hud.appendChild(yearDisplay);

// Era caption (below timeline, centered).
const eraCaption = document.createElement('div');
eraCaption.id = 'hud-era-caption';
hud.appendChild(eraCaption);

// Camera-mode hint (bottom-left).
const cameraHint = document.createElement('div');
cameraHint.id = 'hud-camera-hint';
hud.appendChild(cameraHint);

// Help overlay (controls legend, toggled with H).
const helpOverlay = document.createElement('div');
helpOverlay.id = 'hud-help-overlay';
helpOverlay.innerHTML = `
  <h2>Controls</h2>
  <ul>
    <li><kbd>H</kbd> Toggle help overlay</li>
    <li><kbd>A</kbd> / <kbd>D</kbd> Cycle eras backwards / forwards</li>
    <li><kbd>Q</kbd> / <kbd>E</kbd> Switch orbit ↔ dolly camera mode</li>
    <li><kbd>M</kbd> Mute / unmute audio</li>
    <li><kbd>F</kbd> Toggle FPS debug overlay</li>
    <li><kbd>Click</kbd> Era stops on timeline slider</li>
  </ul>
`;
hud.appendChild(helpOverlay);

let helpVisible = false;

// ── Debug FPS Overlay ───────────────────────────────────────
const fpsOverlay = new DebugFPSOverlay();

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'h' || e.key === 'H') {
    helpVisible = !helpVisible;
    helpOverlay.classList.toggle('visible', helpVisible);
    return;
  }

  // Era cycling with A/D
  const currentEraId = eraStage.currentEraId as EraId | null;
  if (!currentEraId) return;
  const currentIndex = ERA_REGISTRY.findIndex((er) => er.id === currentEraId);
  if (currentIndex === -1) return;

  if (e.key === 'a' || e.key === 'A') {
    const prevIdx = ((currentIndex - 1) % ERA_REGISTRY.length + ERA_REGISTRY.length) % ERA_REGISTRY.length;
    timelineSelectEra(ERA_REGISTRY[prevIdx].id);
    return;
  }

  if (e.key === 'd' || e.key === 'D') {
    const nextIdx = (currentIndex + 1) % ERA_REGISTRY.length;
    timelineSelectEra(ERA_REGISTRY[nextIdx].id);
    return;
  }

  // Camera mode with Q/E
  if (e.key === 'q' || e.key === 'Q') {
    cameraHint.textContent = '🎥 Orbit mode — drag to rotate';
    return;
  }

  if (e.key === 'e' || e.key === 'E') {
    cameraHint.textContent = '🎥 Dolly mode — drag to move forward/back';
    return;
  }

  // Mute with M
  if (e.key === 'm' || e.key === 'M') {
    muted = !muted;
    sfxMixer.setMute(muted);
    audioBtn.textContent = muted ? '🔇' : '🔊';
    return;
  }

  // FPS debug overlay with F
  if (e.key === 'f' || e.key === 'F') {
    fpsOverlay.toggle();
    return;
  }
});

// Audio enable / mute button (must satisfy autoplay policy — user gesture).
const audioBtn = document.createElement('button');
audioBtn.id = 'hud-audio-btn';
audioBtn.textContent = '🔇';
audioBtn.title = 'Enable audio';
hud.appendChild(audioBtn);

let muted = false;
let audioInitialized = false;

audioBtn.addEventListener('click', async () => {
  if (!audioInitialized) {
    // First click: initialize audio context (user gesture satisfies autoplay).
    await sfxMixer.init();
    audioInitialized = true;
    // Set initial era to prime audio layers.
    await sfxMixer.setEra('1945');
    muted = false;
    audioBtn.textContent = '🔊';
    audioBtn.title = 'Mute audio';
    return;
  }

  // Subsequent clicks: toggle mute.
  muted = !muted;
  sfxMixer.setMute(muted);
  audioBtn.textContent = muted ? '🔇' : '🔊';
  audioBtn.title = muted ? 'Unmute audio' : 'Mute audio';
});

// ══════════════════════════════════════════════════════════════
// Timeline controller
// ══════════════════════════════════════════════════════════════

const timelineController = new TimelineController({
  onEraChange: async (eraId, _year) => {
    // Fired by TimelineController during a transition — sync audio + swap atmosphere.
    await sfxMixer.setEra(eraId);
    // Swap sky/atmosphere: current era becomes A, target era becomes B.
    const targetAtm = getEraAtmosphere(eraId);
    if (targetAtm && skyRig) {
      // Get current era's atmosphere as the "from" side for smooth lerp.
      const fromAtm = getEraAtmosphere(eraStage.currentEraId ?? '1945');
      if (fromAtm) {
        skyRig._swapAtmospheres(fromAtm, targetAtm);
      }
    }
  },
});

// Bind timeline controller to era stage and sky rig.
timelineController.bind(eraStage, skyRig);

// ══════════════════════════════════════════════════════════════
// Timeline UI
// ══════════════════════════════════════════════════════════════

mountTimeline({
  onEraChange: (eraId: EraId, _year: number) => {
    // Timeline UI fired an era change — drive scene transition.
    timelineController.requestEraChange(eraId);
    // Load the era module into EraStage (handles content fade).
    const module = ERA_CONTENT_MODULES[eraId];
    if (module) {
      eraStage.load(module);
    }
  },
});

// ══════════════════════════════════════════════════════════════
// Audio mixer
// ══════════════════════════════════════════════════════════════

const sfxMixer = new SfxMixer({
  onProgress: (pct: number) => setProgress(pct * 100),
});

// ══════════════════════════════════════════════════════════════
// Boot sequence — load 1945, generate SFX buffers, then launch
// ══════════════════════════════════════════════════════════════

async function boot(): Promise<void> {
  showLoading('Preparing 1945 era…');

  // Pre-load the initial era's audio buffers (lazy generation reports progress).
  await sfxMixer.setEra('1945');

  // Mount the initial era content on the era stage.
  eraStage.load(era1945);

  setProgress(100);
  showLoading('Ready — welcome to the City Timelapse.');

  // Brief pause so the user sees the completion message.
  await new Promise((r) => setTimeout(r, 600));
  hideLoading();

  // Update HUD with initial era info.
  updateHUD('1945');
}

// ══════════════════════════════════════════════════════════════
// HUD updates
// ══════════════════════════════════════════════════════════════

cameraHint.textContent = '🎥 Orbit mode — drag to rotate';

function updateHUD(eraId: string): void {
  const spec = ERA_REGISTRY.find((e) => e.id === eraId);
  if (!spec) return;

  // Year display
  yearDisplay.textContent = String(spec.year);

  // Era caption
  eraCaption.innerHTML = `<strong>${spec.label}</strong><br>${spec.description}`;
}

// ══════════════════════════════════════════════════════════════
// Render loop
// ══════════════════════════════════════════════════════════════

let lastTime = performance.now();
let elapsedSec = 0;

function render(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap at 100 ms
  lastTime = now;
  elapsedSec += dt;

  // Update era stage (manages content visibility / transition).
  eraStage.update(dt, elapsedSec);

  renderer.render(engine.scene, camera);

  // Track FPS & update debug overlay
  const fpsData = fpsMonitor.tick();
  const info = renderer.info;
  fpsOverlay.update(fpsData, info.render.calls, info.render.triangles);

  requestAnimationFrame(render);
}

// ══════════════════════════════════════════════════════════════
// Resize — SceneEngine handles resize internally via its listener.
// ══════════════════════════════════════════════════════════════

// No-op: SceneEngine already adds a window resize listener that updates
// camera aspect ratio and renderer size automatically.

// ══════════════════════════════════════════════════════════════
// Cleanup
// ══════════════════════════════════════════════════════════════

window.addEventListener('beforeunload', () => {
  timelineController.dispose();
  eraStage.disposeCurrent();
  skyRig.dispose();
  engine.dispose();
  sfxMixer.dispose();
  fpsOverlay.dispose();
});

// ══════════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════════

boot().then(() => {
  requestAnimationFrame(render);
});
