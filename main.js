// ===== Three.js City Timelapse - Main Entry =====
// Imports
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== Globals =====
let scene, camera, renderer, controls;
let ground, buildings = [];
let timer = new THREE.Timer();

// Timeline configuration
const YEARS = [1945, 1965, 1985, 2005, 2025, 2055];
const slider = document.getElementById("timeline-slider");
const currentYearLabel = document.getElementById("current-year");
const labelSpans = document.querySelectorAll(".timeline-labels span");

// ===== Scene Initialization =====
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // light sky blue

  // Camera
  const fov = 60;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(30, 25, 40);

  // Renderer
  const canvas = document.getElementById("three-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // Orbit Controls
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0);
  controls.update();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(20, 40, 20);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  scene.add(directionalLight);

  // Build the placeholder city block
  createGround();
  createBuildings();

  // Event listeners
  window.addEventListener("resize", onWindowResize);
  slider.addEventListener("input", onTimelineChange);

  // Set initial state
  updateTimeline(parseInt(slider.value, 10));

  // Start render loop
  animate();
}

// ===== Ground Plane =====
function createGround() {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a7d34, // muted green for grass/streets
    roughness: 0.9,
    metalness: 0.1,
  });
  ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Simple street marking (placeholder)
  const lineGeometry = new THREE.PlaneGeometry(100, 1);
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const streetLine = new THREE.Mesh(lineGeometry, lineMaterial);
  streetLine.rotation.x = -Math.PI / 2 + 0.01;
  streetLine.position.y = 0.01;
  streetLine.receiveShadow = true;
  scene.add(streetLine);
}

// ===== Placeholder Buildings =====
function createBuildings() {
  // Clear any existing buildings
  buildings.forEach((b) => scene.remove(b));
  buildings = [];

  // Building definitions: [x, z, width, depth, height, color]
  const buildingDefs = [
    [-18, -8, 6, 6, 12, 0x8d6e63],
    [-10, -12, 4, 4, 8, 0x795548],
    [-2, -10, 8, 8, 16, 0x6d4c41],
    [8, -8, 5, 5, 10, 0xa1887f],
    [16, -6, 7, 7, 14, 0x8d6e63],
    [-18, 4, 6, 6, 9, 0x795548],
    [-8, 2, 5, 5, 11, 0x6d4c41],
    [2, 0, 9, 9, 18, 0x8d6e63],
    [14, 4, 6, 6, 7, 0xa1887f],
    [-4, 10, 7, 7, 13, 0x795548],
    [10, 8, 5, 5, 9, 0x6d4c41],
    [18, 10, 8, 8, 15, 0x8d6e63],
  ];

  buildingDefs.forEach((def) => {
    const [x, z, w, d, h, color] = def;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1,
    });
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, h / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    buildings.push(building);
  });
}

// ===== Timeline Logic =====
function onTimelineChange() {
  const value = parseInt(slider.value, 10);
  updateTimeline(value);
}

function updateTimeline(value) {
  const year = YEARS[value];

  // Update current year label
  currentYearLabel.textContent = String(year);

  // Update active label styling
  labelSpans.forEach((span, index) => {
    span.classList.toggle("active", index === value);
  });

  // Update slider background fill
  const percent = (value / 5) * 100;
  slider.style.background = `linear-gradient(to right, #4fc3f7 0%, #4fc3f7 ${percent}%, rgba(255,255,255,0.25) ${percent}%, rgba(255,255,255,0.25) 100%)`;

  // TODO: Swap assets based on era
  // For now, placeholder buildings remain constant
  console.log(`Selected era: ${year}`);
}

// ===== Resize Handler =====
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== Animation Loop =====
function animate() {
  requestAnimationFrame(animate);

  // Gentle idle rotation on buildings for visual interest (placeholder)
  const elapsed = timer.getElapsed();
  buildings.forEach((b, i) => {
    b.rotation.y = Math.sin(elapsed * 0.3 + i) * 0.01;
  });

  controls.update();
  renderer.render(scene, camera);
}

// ===== Start =====
init();
