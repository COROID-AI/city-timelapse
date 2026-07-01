import './styles.css';
import * as THREE from 'three';
import { Scene } from './scene';
import { CityBlock } from './cityBlock';
import { CameraController } from './cameraController';
import { Timeline } from './timeline';
import { ERA_IDS, ERA_TWEEN_MS, DEFAULT_ERA_INDEX } from './eras/constants';
import { ERAS } from './eras/data';
import { AudioMixer } from './audio/mixer';
import { SfxPlayer } from './audio/sfx';
import { disposeTextureCache } from './assetBuilder';

/**
 * Detect whether the current environment can create a WebGL context. Falls back
 * to a static message instead of crashing if WebGL is unavailable.
 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    );
  } catch {
    return false;
  }
}

/**
 * Application bootstrap. Orchestrates the renderer, city block, camera, UI
 * timeline, audio mixer and interaction (hover tooltips + click-to-focus).
 */
async function main(): Promise<void> {
  const container = document.getElementById('scene-container');
  const timelineEl = document.getElementById('timeline');
  const eraLabel = document.getElementById('era-label');
  const muteToggle = document.getElementById('mute-toggle');
  const tooltip = document.getElementById('tooltip');
  const overlay = document.getElementById('transition-overlay');
  const loading = document.getElementById('loading');
  const fallback = document.getElementById('webgl-fallback');

  if (!container || !timelineEl || !eraLabel || !muteToggle || !tooltip || !overlay || !loading) {
    console.error('[city-timelapse] Required DOM roots missing.');
    return;
  }

  // Build the timeline UI stops.
  const { progress, stopButtons } = buildTimeline(timelineEl);

  if (!detectWebGL()) {
    loading.classList.add('is-hidden');
    if (fallback) fallback.hidden = false;
    return;
  }

  // Create the renderer canvas owned by the scene.
  const canvas = document.createElement('canvas');
  canvas.className = 'city-canvas';
  container.appendChild(canvas);

  const scene = new Scene(canvas);
  const city = new CityBlock();
  scene.threeScene.add(city.group);

  const camera = new CameraController(window.innerWidth / window.innerHeight);
  camera.attach(canvas);

  const timeline = new Timeline();
  const mixer = new AudioMixer();
  const sfx = new SfxPlayer(mixer);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: THREE.Object3D | null = null;

  // Initial build.
  city.build(ERA_IDS[DEFAULT_ERA_INDEX]);
  setActiveStop(DEFAULT_ERA_INDEX);
  syncLabel(DEFAULT_ERA_INDEX);
  mixer.setEra(ERA_IDS[DEFAULT_ERA_INDEX], 0);

  // Reveal once the first frame is ready.
  requestAnimationFrame(() => loading.classList.add('is-hidden'));

  // ---------- Era transitions ----------
  timeline.subscribe((state) => {
    if (state.pending === null) return;
    const toId = ERA_IDS[state.pending];
    startTransition(toId);
  });

  function startTransition(toId: (typeof ERA_IDS)[number]): void {
    // Audio crossfade + SFX whoosh.
    sfx.playTransition();
    mixer.setEra(toId, ERA_TWEEN_MS);

    // Quick fade overlay to mask asset swap, then rebuild the block.
    overlay!.style.transition = 'opacity 0.1s linear';
    overlay!.style.opacity = '0.0';
    requestAnimationFrame(() => {
      overlay!.style.opacity = '0.6';
    });

    window.setTimeout(
      () => {
        city.pauseAndReset();
        city.build(toId);
        overlay!.style.transition = 'opacity 0.5s ease';
        overlay!.style.opacity = '0.0';
        scene.transitionTo(toId, ERA_TWEEN_MS);
      },
      Math.round(ERA_TWEEN_MS / 2),
    );
  }

  // ---------- Timeline UI wiring ----------
  stopButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      unlockAudio();
      sfx.playClick();
      timeline.select(index, ERA_TWEEN_MS);
      setActiveStop(index);
      syncLabel(index);
      updateProgress(index);
    });
  });

  function setActiveStop(index: number): void {
    stopButtons.forEach((b, i) => b.classList.toggle('is-active', i === index));
  }

  function syncLabel(index: number): void {
    const id = ERA_IDS[index];
    eraLabel!.textContent = `${ERAS[id].year}`;
  }

  function updateProgress(index: number): void {
    const span = ERA_IDS.length - 1;
    const pct = span === 0 ? 0 : (index / span) * 100;
    progress.style.width = `${pct}%`;
  }

  // ---------- Audio / mute ----------
  let audioUnlocked = false;
  function unlockAudio(): void {
    if (audioUnlocked) return;
    audioUnlocked = true;
    mixer.resume().then(() => mixer.setEra(timeline.currentId, 400));
  }

  muteToggle.addEventListener('click', () => {
    const muted = !mixer.isMuted();
    mixer.setMuted(muted);
    muteToggle.setAttribute('aria-pressed', String(muted));
    muteToggle.classList.toggle('is-muted', muted);
  });

  // ---------- Interaction: hover tooltip + click to focus ----------
  canvas.addEventListener('pointermove', (ev) => {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera.camera);
    const hit = city.hitBuildings(raycaster);
    if (hit) {
      tooltip!.hidden = false;
      tooltip!.style.left = `${ev.clientX}px`;
      tooltip!.style.top = `${ev.clientY}px`;
      tooltip!.textContent = hit.storefrontName;
      canvas.style.cursor = 'pointer';
      hovered = hit.object;
    } else {
      tooltip!.hidden = true;
      canvas.style.cursor = 'grab';
      hovered = null;
    }
  });

  canvas.addEventListener('click', () => {
    unlockAudio();
    if (hovered) {
      const hit = city.hitBuildings(raycaster);
      if (hit) {
        sfx.playClick();
        camera.focusOn(hit.focusPoint, ERA_TWEEN_MS);
      }
    } else {
      camera.resetView(ERA_TWEEN_MS);
    }
  });

  // ---------- Resize ----------
  const onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    scene.resize(w, h);
    camera.resize(w, h);
  };
  window.addEventListener('resize', onResize);
  onResize();

  // ---------- Animation loop ----------
  const clock = new THREE.Clock();
  function animate(): void {
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    city.update(dt, elapsed);
    camera.update();
    scene.render(camera.camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ---------- Cleanup ----------
  window.addEventListener('beforeunload', () => {
    city.dispose();
    scene.dispose();
    mixer.dispose();
    disposeTextureCache();
    timeline.dispose();
  });
}

/** Build the timeline DOM: rail, progress fill and 5 stop buttons. */
function buildTimeline(root: HTMLElement): {
  progress: HTMLDivElement;
  stopButtons: HTMLButtonElement[];
} {
  const track = document.createElement('div');
  track.className = 'timeline-track';

  const rail = document.createElement('div');
  rail.className = 'timeline-rail';
  track.appendChild(rail);

  const progress = document.createElement('div');
  progress.className = 'timeline-progress';
  progress.style.width = '0%';
  track.appendChild(progress);

  const stopButtons: HTMLButtonElement[] = [];
  for (const id of ERA_IDS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stop';
    btn.dataset.era = id;
    btn.setAttribute('aria-label', `Era ${ERAS[id].year}`);

    const dot = document.createElement('span');
    dot.className = 'stop-dot';
    btn.appendChild(dot);

    const year = document.createElement('span');
    year.className = 'stop-year';
    year.textContent = String(ERAS[id].year);
    btn.appendChild(year);

    track.appendChild(btn);
    stopButtons.push(btn);
  }

  root.appendChild(track);
  return { progress, stopButtons };
}

void main();
