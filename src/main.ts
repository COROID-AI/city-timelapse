import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EraState } from './scene/EraState';
import { CameraController, type CameraPresetId } from './scene/cameraController';
import { createAtmosphere } from './scene/atmosphere';
import {
  makeMaterial,
  makeBuildingGeometry,
  makeStreetFurniture,
  makeSignMaterial,
} from './scene/assetFactory';
import { createBuildingBlock } from './scene/buildings';
import { createVehicleSystem } from './scene/vehicles';
import { createPedestrianSystem } from './scene/pedestrians';
import { createStorefrontSystem } from './scene/storefronts';
import { mountCameraUI } from './ui/cameraControls';
import { mountTimeline } from './ui/timeline';
import { SfxMixer } from './audio/mixer';


// =============================================================================
// City Timelapse — Integrated Scene Composition
//
// Composes every subsystem — procedural asset factory, four era-content
// systems (buildings, vehicles, pedestrians, storefronts), timeline UI, SFX
// mixer, camera controls, and an era-aware atmosphere system — into a single
// runnable experience. A loading overlay fades out only after the first
// rendered frame so the user never sees a blank canvas.
//
// No external model or texture files are loaded — everything is procedural.
// =============================================================================

// ---------------------------------------------------------------------------
// Loading overlay — created first so it covers the canvas immediately.
// Fades out only after the first frame is rendered and never blocks the
// timeline slider (pointer-events set to 'none' before fade).
// ---------------------------------------------------------------------------

const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'city-loading-overlay';
loadingOverlay.textContent = 'Loading city…';
Object.assign(loadingOverlay.style, {
  position: 'fixed' as const,
  inset: '0',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  background: '#0a0a0a',
  color: '#e0e0e0',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '1.2rem',
  letterSpacing: '0.05em',
  zIndex: '9999',
  transition: 'opacity 0.6s ease',
  opacity: '1',
  pointerEvents: 'all' as const,
});
document.body.appendChild(loadingOverlay);

// ---------------------------------------------------------------------------
// Canvas & Renderer
// ---------------------------------------------------------------------------

const canvas = document.getElementById('app') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('Root canvas element #app not found in index.html');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});

// Pixel ratio capped at 1.5 for performance.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------------------
// Shadow mapping — autoUpdate with a single bounded directional light.
// ---------------------------------------------------------------------------
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();

// Era-aware exponential fog; colour & density are tweened by the atmosphere
// system on every era change.
scene.fog = new THREE.FogExp2(0x9a7a52, 0.012);

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const camera = new THREE.PerspectiveCamera(
  60, // field of view (degrees)
  window.innerWidth / window.innerHeight, // aspect ratio
  0.1, // near plane
  2000, // far plane
);

// Position the camera to overlook the city block at a pleasant angle.
camera.position.set(45, 35, 55);
camera.lookAt(0, 0, 0);

// ---------------------------------------------------------------------------
// Lighting — hemisphere + directional + ambient
// ---------------------------------------------------------------------------

const hemisphereLight = new THREE.HemisphereLight(
  0xbfd4ff, // sky color (soft blue)
  0x6b5a3e, // ground color (warm earth)
  0.6, // intensity
);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
directionalLight.position.set(50, 80, 30);
directionalLight.castShadow = true;
// Bounded shadow camera covering the city block — tight frustum for quality.
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 10;
directionalLight.shadow.camera.far = 200;
directionalLight.shadow.camera.left = -60;
directionalLight.shadow.camera.right = 60;
directionalLight.shadow.camera.top = 60;
directionalLight.shadow.camera.bottom = -60;
directionalLight.shadow.bias = -0.0005;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404050, 0.3);
scene.add(ambientLight);

// ---------------------------------------------------------------------------
// Skybox — procedural gradient sphere
// ---------------------------------------------------------------------------

const skyGeometry = new THREE.SphereGeometry(1000, 32, 16);

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTopColor: { value: new THREE.Color(0x1a4d8f) },
    uBottomColor: { value: new THREE.Color(0xc9d6e8) },
    uOffset: { value: 33.0 },
    uExponent: { value: 0.6 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uOffset;
    uniform float uExponent;
    varying vec3 vWorldPosition;

    void main() {
      float h = normalize(vWorldPosition + uOffset).y;
      float t = max(pow(max(h, 0.0), uExponent), 0.0);
      gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
    }
  `,
});

const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skybox);

// ---------------------------------------------------------------------------
// Ground plane
// ---------------------------------------------------------------------------

const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  roughness: 0.9,
  metalness: 0.0,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------------------
// EraState — shared timeline controller (created before content systems)
// ---------------------------------------------------------------------------

const eraState = new EraState();

// ---------------------------------------------------------------------------
// Procedural asset factory — single source of visual primitives
// ---------------------------------------------------------------------------

const assetFactory = {
  makeMaterial,
  makeBuildingGeometry,
  makeStreetFurniture,
  makeSignMaterial,
};

// ---------------------------------------------------------------------------
// Content systems — buildings, vehicles, pedestrians, storefronts
// ---------------------------------------------------------------------------

const buildingBlock = createBuildingBlock(eraState, assetFactory);
scene.add(buildingBlock);

const vehicleSystem = createVehicleSystem(eraState, assetFactory);
scene.add(vehicleSystem.group);

const pedestrianSystem = createPedestrianSystem(eraState, assetFactory);
scene.add(pedestrianSystem.group);

const storefrontSystem = createStorefrontSystem(eraState, assetFactory);
scene.add(storefrontSystem.group);

// Collect all building meshes as camera collidables.
const cameraCollidables: THREE.Object3D[] = [ground];
buildingBlock.traverse((obj) => {
  if (obj instanceof THREE.Mesh) cameraCollidables.push(obj);
});

// ---------------------------------------------------------------------------
// OrbitControls — damping enabled, distance bounded
// ---------------------------------------------------------------------------

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 10;
controls.maxDistance = 300;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.target.set(0, 5, 0);
controls.update();

// ---------------------------------------------------------------------------
// Window resize — keep canvas filling the viewport
// ---------------------------------------------------------------------------

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}

window.addEventListener('resize', onWindowResize);

// ---------------------------------------------------------------------------
// Timeline UI — fixed top-of-viewport era slider
// ---------------------------------------------------------------------------

const disposeTimeline = mountTimeline(eraState);

// ---------------------------------------------------------------------------
// Camera controller — presets, cinematic orbit, smoothed zoom, keyboard pan
// ---------------------------------------------------------------------------

const cameraController = new CameraController({
  controls,
  camera,
  domElement: renderer.domElement,
  collidables: cameraCollidables,
  cinematicSpeed: 0.16,
  cinematicHeight: 30,
  cinematicRadius: 72,
  cinematicTarget: new THREE.Vector3(0, 6, 0),
  cinematicResumeDelayMs: 4500,
});

const disposeCameraUI = mountCameraUI({
  onPreset: (id: CameraPresetId) => cameraController.goToPreset(id),
  onToggleCinematic: () => cameraController.toggleCinematic(),
});

// ---------------------------------------------------------------------------
// Atmosphere system — era-aware sky / fog / light / shadow tween
// ---------------------------------------------------------------------------

const atmosphere = createAtmosphere(eraState, {
  skyMaterial,
  fog: scene.fog as THREE.FogExp2,
  ambientLight,
  directionalLight,
});

// ---------------------------------------------------------------------------
// SFX mixer — procedural era-aware audio, driven by EraState
// ---------------------------------------------------------------------------

const sfxMixer = new SfxMixer({
  crossfadeSeconds: 1.5,
  masterVolume: 0.45,
  eventIntervalSeconds: 4,
});

// Subscribe SFX mixer to era changes so audio follows visuals.
eraState.subscribe((update) => {
  void sfxMixer.setEra(update.eraId);
});

// Resume AudioContext on first user gesture (browser autoplay policy).
function onFirstGesture(): void {
  void sfxMixer.resume();
  void sfxMixer.setEra(eraState.getEraId());
  window.removeEventListener('pointerdown', onFirstGesture);
  window.removeEventListener('keydown', onFirstGesture);
}
window.addEventListener('pointerdown', onFirstGesture);
window.addEventListener('keydown', onFirstGesture);

// ---------------------------------------------------------------------------
// Render loop — fixed-dt update + atmosphere + render
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let firstFrameRendered = false;

// Fixed timestep for deterministic simulation updates.
const FIXED_DT = 1 / 60;
let accumulator = 0;

function animate(): void {
  const frameDt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  // Accumulate elapsed time and step simulation at a fixed rate.
  accumulator += frameDt;
  // Clamp to avoid spiral-of-death after tab switches.
  if (accumulator > 0.25) accumulator = 0.25;

  while (accumulator >= FIXED_DT) {
    vehicleSystem.update(FIXED_DT);
    pedestrianSystem.update(FIXED_DT);
    storefrontSystem.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  // Subtle directional light orbit to hint at time passing.
  directionalLight.position.x = Math.cos(elapsed * 0.02) * 50;
  directionalLight.position.z = Math.sin(elapsed * 0.02) * 50;

  // Apply era-aware atmosphere before rendering.
  atmosphere.update();

  // Advance camera (smoothed zoom, keyboard pan, cinematic orbit).
  cameraController.update(frameDt);
  controls.update();
  // Step the camera back out of any collidable after controls settle.
  cameraController.resolveCollision();
  renderer.render(scene, camera);

  // Fade out loading overlay only after the first frame is rendered.
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    // Allow pointer events to pass through immediately so the slider is never
    // blocked, then fade the visual.
    loadingOverlay.style.pointerEvents = 'none';
    loadingOverlay.style.opacity = '0';
    window.setTimeout(() => {
      loadingOverlay.remove();
    }, 700);
  }

  requestAnimationFrame(animate);
}

animate();

// ---------------------------------------------------------------------------
// Cleanup (for HMR and future disposal patterns)
// ---------------------------------------------------------------------------

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    cameraController.dispose();
    atmosphere.dispose();
    vehicleSystem.dispose();
    pedestrianSystem.dispose();
    storefrontSystem.dispose();
    if (typeof buildingBlock.userData.dispose === 'function') {
      buildingBlock.userData.dispose();
    }
    sfxMixer.dispose();
    disposeTimeline();
    disposeCameraUI();
    renderer.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
  });
}
