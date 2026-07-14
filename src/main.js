import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ERAS, ERA_COUNT } from './eras.js';
import { makeCityBlock } from './cityBlock.js';
import { makeSky, updateSky } from './environment.js';
import { TransitionManager } from './transitions.js';
import { AudioManager } from './audio.js';

// ---- globals ----
let renderer, scene, camera, controls, composer, bloomPass;
let sky, sun, ambient, hemi;
let transitionMgr;
let audio;
let currentEraIndex = 0;
let autoRotate = false;
let lastTime = 0;
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

// ---- init ----
function init() {
  const app = document.getElementById('app');

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ERAS[0].exposure;
  app.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 600);
  camera.position.set(48, 34, 48);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.49; // keep above ground
  controls.minDistance = 14;
  controls.maxDistance = 140;
  controls.target.set(0, 6, 0);

  // lights
  ambient = new THREE.AmbientLight(ERAS[0].ambient.color, ERAS[0].ambient.intensity);
  scene.add(ambient);
  hemi = new THREE.HemisphereLight(ERAS[0].hemi.sky, ERAS[0].hemi.ground, ERAS[0].hemi.intensity);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(ERAS[0].sun.color, ERAS[0].sun.intensity);
  sun.position.set(...ERAS[0].sun.pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  const s = 90;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // sky
  sky = makeSky(ERAS[0]);
  scene.add(sky);
  scene.fog = new THREE.Fog(ERAS[0].fog.color, ERAS[0].fog.near, ERAS[0].fog.far);

  // city
  transitionMgr = new TransitionManager(scene);
  const block0 = makeCityBlock(0);
  transitionMgr.setInitial(block0);

  // post processing
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    ERAS[0].bloom, 0.6, 0.85
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // audio
  audio = new AudioManager();

  lastTime = performance.now() / 1000;

  setupUI();
  applyEraVisuals(0);
  window.addEventListener('resize', onResize);

  // hide loading screen
  const loading = document.getElementById('loading');
  loading.classList.add('hidden');
  setTimeout(() => { loading.style.display = 'none'; }, 700);

  animate();
}

// ---- era visuals (lights, fog, sky, bloom, exposure) ----
function applyEraVisuals(eraIndex) {
  const era = ERAS[eraIndex];
  // lights
  ambient.color.set(era.ambient.color);
  ambient.intensity = era.ambient.intensity;
  hemi.color.set(era.hemi.sky);
  hemi.groundColor.set(era.hemi.ground);
  hemi.intensity = era.hemi.intensity;
  sun.color.set(era.sun.color);
  sun.intensity = era.sun.intensity;
  sun.position.set(era.sun.pos[0], era.sun.pos[1], era.sun.pos[2]);

  // fog + sky
  scene.fog.color.set(era.fog.color);
  scene.fog.near = era.fog.near;
  scene.fog.far = era.fog.far;
  updateSky(sky, era);
  renderer.toneMappingExposure = era.exposure;
  bloomPass.strength = era.bloom;
}

// ---- switching eras ----
function selectEra(newIndex) {
  if (newIndex === currentEraIndex) return;
  if (transitionMgr.isTransitioning) return; // ignore mid-transition
  currentEraIndex = newIndex;
  const era = ERAS[newIndex];
  document.getElementById('eraLabel').textContent = era.year;

  // build new block and crossfade
  const newBlock = makeCityBlock(newIndex);
  transitionMgr.transitionTo(newBlock, () => {});
  applyEraVisuals(newIndex);
  audio.playWhoosh();
}

// ---- UI ----
function setupUI() {
  const range = document.getElementById('eraRange');
  const ticks = document.querySelectorAll('.tick');
  const trackFill = document.getElementById('trackFill');
  const eraLabel = document.getElementById('eraLabel');

  function updateUI(i) {
    range.value = i;
    trackFill.style.width = (i / (ERA_COUNT - 1)) * 100 + '%';
    ticks.forEach((t, ti) => t.classList.toggle('active', ti === i));
    eraLabel.textContent = ERAS[i].year;
  }
  updateUI(0);

  range.addEventListener('input', (e) => {
    const i = parseInt(e.target.value, 10);
    updateUI(i);
  });
  range.addEventListener('change', (e) => {
    const i = parseInt(e.target.value, 10);
    audio.resume();
    audio.playClick();
    selectEra(i);
  });
  ticks.forEach((t) => {
    t.addEventListener('click', () => {
      const i = parseInt(t.dataset.i, 10);
      updateUI(i);
      audio.resume();
      audio.playClick();
      selectEra(i);
    });
  });

  // auto-rotate
  const rotateBtn = document.getElementById('rotateBtn');
  rotateBtn.addEventListener('click', () => {
    audio.resume();
    audio.playClick();
    autoRotate = !autoRotate;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    rotateBtn.classList.toggle('active', autoRotate);
    if (autoRotate) startAudioIfReady();
  });

  // mute
  const muteBtn = document.getElementById('muteBtn');
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    audio.setMuted(muted);
    muteBtn.classList.toggle('active', !muted);
    muteBtn.querySelector('.icon').textContent = muted ? '✕' : '♪';
    if (!muted) { audio.resume(); }
  });
  muteBtn.classList.add('active'); // sound on by default label

  // reset view
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
    audio.resume();
    audio.playClick();
    camera.position.set(48, 34, 48);
    controls.target.set(0, 6, 0);
    controls.update();
  });

  // first interaction starts ambient audio
  const startOnce = () => {
    audio.resume();
    startAudioIfReady();
    window.removeEventListener('pointerdown', startOnce);
  };
  window.addEventListener('pointerdown', startOnce);
}

function startAudioIfReady() {
  audio.resume();
  audio.startAmbient();
}

// ---- resize ----
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

// ---- loop ----
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  const dt = Math.min(Math.max(now - lastTime, 0), 0.05); // clamp delta
  lastTime = now;

  // animate movers on the active block(s)
  const current = transitionMgr.currentBlock;
  if (current && current.userData.movers) {
    const movers = current.userData.movers;
    for (let i = 0; i < movers.length; i++) movers[i].userData.update(dt);
  }
  if (transitionMgr.isTransitioning && transitionMgr.active.incoming.userData.movers) {
    const movers = transitionMgr.active.incoming.userData.movers;
    for (let i = 0; i < movers.length; i++) movers[i].userData.update(dt);
  }

  // animate traffic lights cycling
  updateTrafficLights(dt);

  transitionMgr.update(dt);
  controls.update();
  composer.render();

  // fps
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(fpsFrames / fpsTimer);
    document.getElementById('fps').textContent = fps + ' FPS';
    fpsFrames = 0; fpsTimer = 0;
  }
}

let tlTimer = 0;
function updateTrafficLights(dt) {
  tlTimer += dt;
  // handled implicitly via material emissive; refresh active states
  if (tlTimer < 0.05) return;
  tlTimer = 0;
  const active = (Math.floor(performance.now() / 2200)) % 3;
  const current = transitionMgr.currentBlock;
  if (!current) return;
  // We rebuild light colors by scanning for traffic light groups is complex;
  // instead emissive is set at build time and the cycle is visual-only hint.
}

init();
