// ============================================================
//  CHRONOPOLIS — main entry
//  Wires together: renderer, scene, sky, city, traffic, controls,
//  audio, and the timeline UI that drives era transitions.
// ============================================================
import * as THREE from 'three';
import './styles.css';
import { ERAS, getEra, eraIndex } from './eras.js';
import { SkySystem } from './sky.js';
import { CityBuilder } from './city.js';
import { TrafficSystem } from './traffic.js';
import { CameraController } from './controls.js';
import { AudioEngine } from './audio.js';
import { PostFX } from './postfx.js';

// ---------------------------------------------------------
// Renderer
// ---------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Respect reduced-motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(40, 30, 40);

// ---------------------------------------------------------
// Systems
// ---------------------------------------------------------
const sky = new SkySystem(scene, camera);
const city = new CityBuilder(scene);
const traffic = new TrafficSystem(scene);
const controls = new CameraController(camera, canvas);
const audio = new AudioEngine();

// Post-processing (bloom + vignette + color grade)
const postfx = new PostFX(renderer, scene, camera);

// Propagate reduced-motion preference to all animated systems
if (prefersReducedMotion) {
  controls.setReducedMotion(true);
  sky.setReducedMotion(true);
  postfx.setReducedMotion(true);
}

// ---------------------------------------------------------
// State
// ---------------------------------------------------------
const state = {
  eraId: 2025,
  isNight: false,
  soundOn: true,
  transitioning: false,
  autoPlay: false,
  autoTimer: 0,
  autoInterval: prefersReducedMotion ? 9 : 6,
};

// ---------------------------------------------------------
// Build timeline UI
// ---------------------------------------------------------
const tlTrack = document.getElementById('tl-track');
const tlRail = document.createElement('div');
tlRail.className = 'tl-rail';
tlTrack.appendChild(tlRail);
const tlStops = document.createElement('div');
tlStops.className = 'tl-stops';
tlTrack.appendChild(tlStops);

const stopButtons = [];
ERAS.forEach((era) => {
  const btn = document.createElement('button');
  btn.className = 'tl-stop';
  btn.dataset.era = era.id;
  btn.innerHTML = `
    <span class="era-mini">${era.name}</span>
    <span class="dot"></span>
    <span class="yr">${era.year}</span>`;
  btn.addEventListener('click', () => selectEra(era.id, true));
  tlStops.appendChild(btn);
  stopButtons.push(btn);
});

// ---------------------------------------------------------
// Timeline drag-to-scrub: click or drag on the rail to jump eras
// ---------------------------------------------------------
function eraFromPointer(clientX) {
  const rect = tlTrack.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const idx = Math.round(ratio * (ERAS.length - 1));
  return ERAS[idx];
}

let scrubbing = false;
tlTrack.addEventListener('pointerdown', (e) => {
  // ignore clicks that land directly on a stop button (they handle their own click)
  if (e.target.closest('.tl-stop')) return;
  scrubbing = true;
  tlTrack.setPointerCapture(e.pointerId);
  const era = eraFromPointer(e.clientX);
  if (era.id !== state.eraId) selectEra(era.id, true);
});
tlTrack.addEventListener('pointermove', (e) => {
  if (!scrubbing) return;
  const era = eraFromPointer(e.clientX);
  if (era.id !== state.eraId) selectEra(era.id, true);
});
tlTrack.addEventListener('pointerup', () => { scrubbing = false; });
tlTrack.addEventListener('pointercancel', () => { scrubbing = false; });

// ---------------------------------------------------------
// Era transition
// ---------------------------------------------------------
function selectEra(eraId, playSfx = false) {
  state.eraId = eraId;
  const era = getEra(eraId);

  // update UI
  stopButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.era) === eraId));
  document.getElementById('tl-year').textContent = era.year;
  document.getElementById('tl-era').textContent = era.subtitle;
  document.getElementById('era-title').textContent = era.subtitle;
  document.getElementById('era-desc').textContent = era.description;
  const stats = document.getElementById('era-stats');
  stats.innerHTML = era.stats.map((s) => `<span class="stat-chip">${s}</span>`).join('');
  // rail progress
  const prog = eraIndex(eraId) / (ERAS.length - 1);
  tlRail.style.setProperty('--prog', prog);

  // visual flash (skip under reduced-motion)
  if (!prefersReducedMotion) {
    const flash = document.getElementById('flash') || makeFlash();
    flash.classList.add('show');
    setTimeout(() => flash.classList.remove('show'), 260);
  }

  // audio cue
  if (playSfx) {
    audio.resume();
    audio.whoosh(0.35);
    setTimeout(() => audio.shimmer(era.id >= 2055 ? [523, 659, 784, 988, 1175] : [392, 523, 659, 784]), 350);
  }

  // rebuild city + traffic, restyle sky
  city.buildEra(era, state.isNight);
  traffic.setEra(era);
  sky.setEra(era, state.isNight);
  audio.setEra(era);
  postfx.setEra(era.id, state.isNight);

  // accent the UI to era
  document.documentElement.style.setProperty('--accent', era.accent);
}

function makeFlash() {
  const f = document.createElement('div');
  f.id = 'flash';
  document.getElementById('app').appendChild(f);
  return f;
}

// ---------------------------------------------------------
// Toolbar handlers
// ---------------------------------------------------------
function toggleBtn(id, onChange) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    onChange(btn.classList.contains('active'));
    audio.blip(880, 0.06, 'square', 0.1);
  });
  return btn;
}

toggleBtn('btn-sound', (on) => {
  state.soundOn = on;
  audio.setMuted(!on);
  if (on) audio.resume();
});
toggleBtn('btn-daynight', (on) => {
  state.isNight = on;
  document.getElementById('btn-daynight').querySelector('.tb-glyph').textContent = on ? '☀️' : '🌙';
  document.getElementById('btn-daynight').querySelector('.tb-label').textContent = on ? 'Day' : 'Night';
  sky.setEra(getEra(state.eraId), state.isNight);
  city.buildEra(getEra(state.eraId), state.isNight); // rebuild for night window emissives
  postfx.setEra(state.eraId, state.isNight);
});
toggleBtn('btn-traffic', (on) => traffic.setVisible(on));
toggleBtn('btn-peds', (on) => traffic.setPedsVisible(on));

// Post-processing toggle
toggleBtn('btn-fx', (on) => postfx.setEnabled(on));

// Auto-advance
document.getElementById('btn-auto').addEventListener('click', (e) => {
  state.autoPlay = !state.autoPlay;
  e.currentTarget.classList.toggle('active', state.autoPlay);
  state.autoTimer = 0;
  audio.blip(state.autoPlay ? 660 : 440, 0.1, 'sine', 0.12);
});

// One-step cycle
document.getElementById('btn-cycle').addEventListener('click', () => {
  const idx = eraIndex(state.eraId);
  const next = ERAS[(idx + 1) % ERAS.length];
  selectEra(next.id, true);
});

// Reset camera
document.getElementById('btn-reset').addEventListener('click', () => {
  controls.reset();
  audio.blip(520, 0.08, 'triangle', 0.1);
});

// ---------------------------------------------------------
// Resize
// ---------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 6) {
    selectEra(ERAS[num - 1].id, true);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    const idx = eraIndex(state.eraId);
    const prev = ERAS[(idx - 1 + ERAS.length) % ERAS.length];
    selectEra(prev.id, true);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    const idx = eraIndex(state.eraId);
    const next = ERAS[(idx + 1) % ERAS.length];
    selectEra(next.id, true);
  } else if (e.key === ' ') {
    e.preventDefault();
    document.getElementById('btn-auto').click();
  } else if (e.key === 'n' || e.key === 'N') {
    document.getElementById('btn-daynight').click();
  }
});

// ---------------------------------------------------------
// Render loop
// ---------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // auto-advance
  if (state.autoPlay) {
    state.autoTimer += dt;
    if (state.autoTimer >= state.autoInterval) {
      state.autoTimer = 0;
      const idx = eraIndex(state.eraId);
      selectEra(ERAS[(idx + 1) % ERAS.length].id, true);
    }
  }

  controls.update(dt);
  sky.update(dt, elapsed);
  city.update(dt, elapsed, state.isNight);
  traffic.update(dt, elapsed);

  // occasional ambient sfx
  audio.ambientTick(getEra(state.eraId));

  postfx.update(dt);
  postfx.render();
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------
// Boot
// ---------------------------------------------------------
function boot() {
  // build base once
  city.buildBase();
  // first era
  selectEra(2025, false);

  // simulate loading progress then hide loader
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loader-fill');
  let prog = 0;
  const tickLoad = () => {
    prog = Math.min(100, prog + 8 + Math.random() * 12);
    fill.style.width = prog + '%';
    if (prog < 100) {
      setTimeout(tickLoad, 90);
    } else {
      setTimeout(() => {
        loader.classList.add('hidden');
        // start audio on first user gesture
        const startAudio = () => {
          audio.init();
          audio.setMuted(!state.soundOn);
          audio.setEra(getEra(state.eraId));
          window.removeEventListener('pointerdown', startAudio);
        };
        window.addEventListener('pointerdown', startAudio);
      }, 400);
    }
  };
  tickLoad();
  tick();
}

boot();
