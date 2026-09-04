// Composition root: owns WebGLRenderer, camera, OrbitControls, Scene,
// frame loop, resize handling, the timeline HUD, and global disposal.
// Scene modules never start their own renderer or loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { EraId } from './eras';
import { ERA_IDS, getEraSpec, eraIndex } from './eras';
import { createInitialState, createHUDState, type AppState } from './state';
import { SfxMixer } from './audio/mixer';
import { SkyModule } from './scene/sky';
import { GroundModule } from './scene/ground';
import { BuildingsModule } from './scene/buildings';
import { VehiclesModule } from './scene/vehicles';
import { PedestriansModule } from './scene/pedestrians';
import { StreetPropsModule } from './scene/street-props';
import { BillboardsModule } from './scene/billboards';
import type { SceneModule } from './scene/module';

function webgl2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGL2RenderingContext &&
      canvas.getContext('webgl2')
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function main(): void {
  // Validity
  if (!webgl2Available()) {
    document.getElementById('fallback')!.hidden = false;
    document.getElementById('loading-screen')!.hidden = true;
    return;
  }

  const app = document.getElementById('app')!;
  const hud = document.getElementById('hud')!;
  const loading = document.getElementById('loading-screen')!;

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);

  // ---------- Scene & camera ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a3344');
  scene.fog = new THREE.Fog(new THREE.Color('#7c8899'), 40, 320);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(30, 20, 52);
  camera.lookAt(0, 6, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 160;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.update();

  // ---------- State ----------
  const state: AppState = createInitialState();
  state.reducedMotion = prefersReducedMotion();
  state.pixelRatio = Math.min(window.devicePixelRatio, 2);

  const modules: SceneModule[] = [];
  const sky = new SkyModule(scene);
  modules.push(sky);
  modules.push(new GroundModule());
  modules.push(new BuildingsModule());
  modules.push(new VehiclesModule());
  modules.push(new PedestriansModule());
  modules.push(new StreetPropsModule());
  modules.push(new BillboardsModule());
  for (const m of modules) scene.add(m.group);

  // ---------- Audio ----------
  const mixer = new SfxMixer({ volume: 0.8 });

  const hudState = createHUDState();
  buildHUD(hud, hudState, () => {
    mixer.setMuted(!mixer.isMuted);
    hudState.muted = mixer.isMuted;
    renderHUD(hud, hudState);
  });
  hud.hidden = false;

  function showLoadingDone(): void {
    loading.classList.add('hidden');
    loading.hidden = true;
  }

  // Transition driver
  let targetEraIndex = eraIndex(state.era);

  function setEra(id: EraId): void {
    if (id === state.era && !state.transitioning) return;
    state.era = id;
    targetEraIndex = eraIndex(id);
    state.transitioning = true;
    for (const m of modules) m.setEra(id);
    mixer.setEra(id);
    const spec = getEraSpec(id);
    hudState.era = id;
    hudState.description = spec.description;
    renderHUD(hud, hudState);
    updateTimelineUI(id);
  }

  function updateTimelineUI(id: EraId): void {
    const ticks = hud.querySelectorAll<HTMLElement>('[data-era]');
    ticks.forEach((t) => {
      const on = t.dataset.era === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---------- Timeline controls ----------
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = (ERA_IDS.length - 1).toString();
  slider.step = '1';
  slider.value = '0';
  slider.classList.add('era-slider');
  slider.setAttribute('aria-label', 'Timeline era');
  hud.appendChild(slider);

  const ticksRow = document.createElement('div');
  ticksRow.className = 'era-ticks';
  for (let i = 0; i < ERA_IDS.length; i++) {
    const btn = document.createElement('button');
    btn.className = 'era-tick';
    btn.dataset.era = ERA_IDS[i];
    btn.textContent = ERA_IDS[i];
    btn.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    btn.addEventListener('click', () => {
      ensureAudio();
      setEra(ERA_IDS[i]);
      slider.value = String(i);
    });
    ticksRow.appendChild(btn);
  }
  hud.appendChild(ticksRow);

  slider.addEventListener('input', () => {
    const idx = Math.round(Number(slider.value));
    ensureAudio();
    setEra(ERA_IDS[idx]);
  });

  function setSlider(idx: number): void {
    slider.value = String(idx);
  }

  // Keyboard timeline (A/Left = previous, D/Right = next)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      const idx = Math.max(0, Math.round(Number(slider.value)) - 1);
      ensureAudio();
      setEra(ERA_IDS[idx]);
      setSlider(idx);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      const idx = Math.min(ERA_IDS.length - 1, Math.round(Number(slider.value)) + 1);
      ensureAudio();
      setEra(ERA_IDS[idx]);
      setSlider(idx);
      e.preventDefault();
    } else if (e.key === 'm' || e.key === 'M') {
      mixer.setMuted(!mixer.isMuted);
      hudState.muted = mixer.isMuted;
      renderHUD(hud, hudState);
    }
  });

  // ---------- Audio user-gesture hook ----------
  function ensureAudio(): void {
    if (!mixer.isReady) {
      mixer.init();
      state.audioEnabled = true;
      hudState.audioEnabled = true;
      renderHUD(hud, hudState);
      mixer.setEra(state.era);
    }
  }
  window.addEventListener('pointerdown', ensureAudio, { once: false });
  window.addEventListener('keydown', ensureAudio);

  // ---------- Resize ----------
  const onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // ---------- Frame loop ----------
  const timer = new THREE.Timer();
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = timer.getDelta();

    // Ease eraFloat toward target index.
    const target = targetEraIndex;
    const dist = target - state.eraFloat;
    const speed = state.reducedMotion ? 0.2 : 0.06;
    if (Math.abs(dist) > 0.001) {
      state.eraFloat += dist * speed;
      if (Math.abs(dist) < 0.008) state.eraFloat = target;
    }
    if (Math.abs(state.eraFloat - target) < 0.001) {
      state.eraFloat = target;
      state.transitioning = false;
    }

    for (const m of modules) m.update(dt, state);
    controls.update();
    renderer.render(scene, camera);
    mixer.update(dt);
  });

  // Final reveal
  requestAnimationFrame(() => {
    showLoadingDone();
  });
}

// ---------- HUD builders ----------

function buildHUD(
  hud: HTMLElement,
  hudState: ReturnType<typeof createHUDState>,
  onMute: () => void,
): void {
  const top = document.createElement('div');
  top.className = 'hud-top';

  const title = document.createElement('div');
  title.className = 'hud-title';
  title.textContent = 'CITY TIME PERIOD TIMELAPSE';
  top.appendChild(title);

  const eraLabel = document.createElement('div');
  eraLabel.className = 'hud-era';
  top.appendChild(eraLabel);

  const desc = document.createElement('div');
  desc.className = 'hud-desc';
  top.appendChild(desc);

  const volumeRow = document.createElement('div');
  volumeRow.className = 'hud-volume';
  const muteBtn = document.createElement('button');
  muteBtn.className = 'hud-mute';
  muteBtn.textContent = hudState.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', 'Toggle sound');
  muteBtn.addEventListener('click', onMute);
  volumeRow.appendChild(muteBtn);
  top.appendChild(volumeRow);

  hud.appendChild(top);
}

function renderHUD(hud: HTMLElement, hudState: ReturnType<typeof createHUDState>): void {
  const eraEl = hud.querySelector<HTMLElement>('.hud-era');
  const descEl = hud.querySelector<HTMLElement>('.hud-desc');
  const muteEl = hud.querySelector<HTMLElement>('.hud-mute');
  const spec = getEraSpec(hudState.era);
  if (eraEl) eraEl.textContent = spec.label;
  if (descEl) descEl.textContent = hudState.description;
  if (muteEl) muteEl.textContent = hudState.muted ? '🔇' : '🔊';
}

window.addEventListener('DOMContentLoaded', main);