import * as THREE from 'three';
import { generateCity } from './city';

// Mount target for the renderer canvas.
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app mount element in index.html');
}

// Scene and lighting.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
sunLight.position.set(80, 140, 50);
scene.add(sunLight);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  3000,
);
camera.position.set(0, 24, 78);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

// Procedural city generation (deterministic seeded RNG).
const city = generateCity({ seed: 20260804 });
scene.add(city.group);

// Keep the collision boundaries alive on the scene for the walk controls
// phase, which consumes them to keep movement collision-aware.
(city.group as THREE.Group & { userData: Record<string, unknown> }).userData.collisionBoxes =
  city.collisionBoxes;

// The walk controls phase will remove this static camera once it lands.
const groundY = 0;
const walkSpeed = 2.4;
const forward = new THREE.Vector3(0, 0, 1);
const desiredPos = new THREE.Vector3();

function updateWalkControls(delta: number): void {
  desiredPos.copy(camera.position).addScaledVector(forward, walkSpeed * delta);
  let blocked = false;
  for (const box of city.collisionBoxes) {
    if (desiredPos.x > box.min.x - 0.5 && desiredPos.x < box.max.x + 0.5
      && desiredPos.z > box.min.z - 0.5 && desiredPos.z < box.max.z + 0.5) {
      blocked = true;
      break;
    }
  }
  if (!blocked) {
    camera.position.copy(desiredPos);
  }
  camera.position.y = groundY + 1.6;
  camera.lookAt(
    camera.position.x + forward.x,
    camera.position.y,
    camera.position.z + forward.z,
  );
}

// Keep the renderer in sync with the window size.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop with a slow automatic stroll through the streets.
const timer = new THREE.Timer();
function animate(): void {
  requestAnimationFrame(animate);
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);
  updateWalkControls(delta);
  renderer.render(scene, camera);
}
animate();
