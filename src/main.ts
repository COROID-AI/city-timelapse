import * as THREE from 'three';
import { generateCity } from './city';
import { createDaytimeLighting, updateSkyDome } from './lighting';
import {
  createHud,
  handleModeToggleKey,
  ModeSwitch,
  updateHudMode,
  WalkControls,
} from './controls';

// Mount target for the renderer canvas.
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app mount element in index.html');
}

// Scene.
const scene = new THREE.Scene();

// Daytime atmosphere: gradient sky dome with a visible sun, a directional sun
// light that casts building shadows onto the streets, and ambient/hemisphere
// fill bright enough to read street-level detail in shade.
const lighting = createDaytimeLighting(scene);
const { sky } = lighting;

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  3000,
);
camera.position.set(0, 1.6, 78);
camera.lookAt(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

// Procedural city generation (deterministic seeded RNG).
const city = generateCity({ seed: 20260804 });
scene.add(city.group);

// Shadow participation: buildings cast shadows; ground, roads and sidewalks
// receive them. Applied at the scene level so city-generation stays untouched.
city.group.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    if (object.name !== 'skyDome') {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  }
});

// ---- Controls ----------------------------------------------------------
// First-person walk controls with collision against the building bounding
// boxes exported by city-generation, plus an OrbitControls fallback (toggle
// with R) so the city stays viewable when Pointer Lock is unavailable.
const walk = new WalkControls(camera, renderer.domElement, city.collisionData, {
  bounds: computeCityExtent(city.collisionData),
  walkSpeed: 2.4,
  sprintMultiplier: 1.7,
  eyeHeight: 1.6,
  jumpSpeed: 4.4,
  gravity: 14,
  radius: 0.5,
});
walk.respawn(0, 78);

const modeSwitch = new ModeSwitch(camera, renderer.domElement, walk, {
  orbitCameraPosition: new THREE.Vector3(0, 70, 130),
  orbitTarget: new THREE.Vector3(0, 0, 0),
});

const hud = createHud();
app.appendChild(hud);

// Keep the on-screen prompt in sync with the active control mode.
modeSwitch.setCallbacks({
  onModeChange: (mode) => updateHudMode(hud, mode),
});
walk.setCallbacks({
  onUnlock: () => updateHudMode(hud, 'walk'),
});

// Clicking the canvas requests pointer lock; browsers that block it fire the
// pointer-lock error event, which routes to the OrbitControls fallback so the
// city stays viewable.
renderer.domElement.addEventListener('click', () => {
  if (modeSwitch.activeMode === 'walk' && !walk.isLocked) {
    walk.requestLock();
  }
});
document.addEventListener('pointerlockerror', () => {
  modeSwitch.handlePointerLockError();
});

// WASD/arrows move while pointer-locked; R toggles the control mode.
window.addEventListener('keydown', (event) => {
  walk.handleKey(event);
  handleModeToggleKey(event, modeSwitch);
});
window.addEventListener('keyup', (event) => {
  walk.handleKey(event);
});

// Keep the renderer in sync with the window size.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop drives the active control set every frame.
const timer = new THREE.Timer();
function animate(): void {
  requestAnimationFrame(animate);
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);
  modeSwitch.update(delta);
  updateSkyDome(sky, camera);
  renderer.render(scene, camera);
}
animate();

// ---- Helpers -----------------------------------------------------------

/** Keep the walk camera inside the city streets. */
function computeCityExtent(
  collisionData: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[],
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const box of collisionData) {
    minX = Math.min(minX, box.minX);
    maxX = Math.max(maxX, box.maxX);
    minZ = Math.min(minZ, box.minZ);
    maxZ = Math.max(maxZ, box.maxZ);
  }
  if (!Number.isFinite(minX)) {
    return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
  }
  return { minX, maxX, minZ, maxZ };
}
