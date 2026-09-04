/**
 * Composition root for the City Time Period Timelapse.
 *
 * Owns: WebGLRenderer, PerspectiveCamera, OrbitControls, the primary Scene,
 * ResizeObserver, the animation loop and global disposal. Each scene module
 * exposes { group, update, setEra, dispose } and is added to the scene here.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createInitialState, setEra, lerp } from './state';
import type { AppState } from './state';
import { ERA_REGISTRY, ERA_IDS, getEraSpec } from './eras';
import type { EraId } from './eras';
import { createTextureSet } from './textures';
import { createEnvironment } from './scene/environment';
import { createCity } from './scene/city';
import { createVehicles } from './scene/vehicles';
import { createPedestrians } from './scene/pedestrians';
import { SfxMixer } from './audio/mixer';
import { getEraId } from './state';
import './style.css';

interface SceneModule {
  group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: number, t: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot(): void {
  const app = document.getElementById('app') as HTMLElement | null;
  if (!app) return;

  // WebGL capability check with DOM fallback
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) {
    app.innerHTML =
      '<div style="padding:3rem;font-family:system-ui;color:#eee;background:#14161a;height:100vh">' +
      '<h1>WebGL2 is required</h1><p>Your browser does not expose WebGL2, which this experience needs.</p></div>';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    600,
  );
  camera.position.set(34, 26, 44);
  camera.lookAt(0, 4, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 6;
  controls.maxDistance = 130;
  controls.target.set(0, 5, 0);

  const state = createInitialState();

  /* ---------------- modules ---------------- */
  const textures = createTextureSet();
  const env = createEnvironment(textures);
  const city = createCity(textures);
  const vehicles = createVehicles();
  const pedestrians = createPedestrians();
  const modules: SceneModule[] = [env, city, vehicles, pedestrians];

  scene.fog = env.fog;
  for (const m of modules) scene.add(m.group);

  /* ---------------- audio ---------------- */
  const mixer = new SfxMixer({ masterVolume: 0.7, fadeSeconds: 1.5 });

  /* ---------------- UI ---------------- */
  const ui = createUI();

  function createUI(): {
    root: HTMLElement;
    setEraLabel(era: EraId): void;
    setMuted(muted: boolean): void;
    dispose(): void;
  } {
    const root = document.createElement('div');
    root.id = 'timelapse-ui';
    root.innerHTML = `
      <div class="hud-top">
        <h1 class="title">City Time Period Timelapse</h1>
        <div class="timeline" role="group" aria-label="Timeline year selector">
          <div class="track">
            <div class="fill"></div>
            ${ERA_REGISTRY.map(
              (e, i) => `
              <button class="era-btn" data-era="${i}" role="radio" aria-checked="${i === 0}"
                aria-label="Jump to ${e.label}">
                <span class="year">${e.label}</span>
                <span class="dot"></span>
              </button>`,
            ).join('')}
          </div>
        </div>
        <div class="hud-right">
          <button id="mute-btn" class="icon-btn" aria-label="Toggle sound">🔊</button>
          <button id="quality-btn" class="icon-btn" aria-label="Toggle quality">⚙</button>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="era-description"></div>
        <div class="controls-hint">Drag to orbit · Scroll to zoom · 1–5 to switch eras</div>
      </div>
    `;
    document.body.appendChild(root);

    const fill = root.querySelector('.fill') as HTMLElement;
    const desc = root.querySelector('.era-description') as HTMLElement;
    const btns = Array.from(root.querySelectorAll<HTMLButtonElement>('.era-btn'));
    const muteBtn = root.querySelector('#mute-btn') as HTMLButtonElement;
    const qualityBtn = root.querySelector('#quality-btn') as HTMLButtonElement;
    const track = root.querySelector('.track') as HTMLElement;

    function updateUI(): void {
      const idx = state.eraIndex;
      const spec = getEraSpec(ERA_IDS[idx]);
      desc.textContent = spec.description;
      btns.forEach((b, i) => {
        const active = i === idx;
        b.classList.toggle('active', active);
        b.setAttribute('aria-checked', String(active));
      });
      fill.style.transform = `scaleX(${idx / (ERA_IDS.length - 1)})`;
    }

    btns.forEach((b, i) => {
      b.addEventListener('click', () => {
        selectEra(i);
      });
    });

    // draggable slider: pointer position -> nearest era
    const eraFromPointer = (clientX: number): number => {
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(x * (ERA_IDS.length - 1));
    };
    let dragging = false;
    const onPointerDown = (e: PointerEvent): void => {
      dragging = true;
      track.setPointerCapture(e.pointerId);
      selectEra(eraFromPointer(e.clientX));
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (dragging) selectEra(eraFromPointer(e.clientX));
    };
    const onPointerUp = (): void => {
      dragging = false;
    };
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
    muteBtn.addEventListener('click', () => {
      state.muted = !state.muted;
      mixer.setMuted(state.muted);
      muteBtn.textContent = state.muted ? '🔇' : '🔊';
    });
    qualityBtn.addEventListener('click', () => {
      state.quality = state.quality === 'high' ? 'low' : 'high';
      qualityBtn.textContent = state.quality === 'high' ? '⚙' : '⚙';
      qualityBtn.classList.toggle('low', state.quality === 'low');
    });

    // keyboard: 1..5 selects eras, arrows step through the timeline
    window.addEventListener('keydown', (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= ERA_REGISTRY.length) {
        selectEra(n - 1);
      } else if (e.key === 'ArrowRight') {
        selectEra(Math.min(state.eraIndex + 1, ERA_REGISTRY.length - 1));
      } else if (e.key === 'ArrowLeft') {
        selectEra(Math.max(state.eraIndex - 1, 0));
      }
      if (e.key === 'm' || e.key === 'M') {
        state.muted = !state.muted;
        mixer.setMuted(state.muted);
        muteBtn.textContent = state.muted ? '🔇' : '🔊';
      }
    });

    function selectEra(i: number): void {
      setEra(state, i);
      mixer.unlock();
      state.audioUnlocked = true;
      mixer.setEra(getEraId(state));
      mixer.setMuted(state.muted);
      updateUI();
    }

    updateUI();
    return {
      root,
      setEraLabel: () => {},
      setMuted: (muted) => {
        muteBtn.textContent = muted ? '🔇' : '🔊';
      },
      dispose: () => {
        root.remove();
      },
    };
  }

  // First user gesture unlocks audio (autoplay policy).
  const unlockAudio = (): void => {
    if (!state.audioUnlocked) {
      mixer.unlock();
      state.audioUnlocked = true;
      mixer.setEra(getEraId(state));
      mixer.setMuted(state.muted);
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { once: false });
  window.addEventListener('keydown', unlockAudio, { once: false });

  /* ---------------- resize ---------------- */
  const resizeObserver = new ResizeObserver(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  resizeObserver.observe(document.body);

  /* ---------------- animation loop ---------------- */
  let lastTime = performance.now();

  function animate(): void {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    state.elapsed += dt;

    // ease eraFloat toward eraIndex (continuous transform)
    const target = state.eraIndex;
    const k = 1 - Math.exp(-dt * (state.reducedMotion ? 8 : 3.2));
    state.eraFloat = lerp(state.eraFloat, target, k);
    if (Math.abs(state.eraFloat - target) < 0.001) state.eraFloat = target;

    // modules
    for (const m of modules) m.update(dt, state);

    // audio
    if (state.audioUnlocked && !state.muted) {
      mixer.updateSpontaneousEvents();
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // loading overlay removal
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 400);
  }

  animate();

  /* ---------------- global disposal ---------------- */
  window.addEventListener('beforeunload', () => {
    resizeObserver.disconnect();
    for (const m of modules) m.dispose();
    mixer.dispose();
    ui.dispose();
    renderer.dispose();
  });
}

boot();