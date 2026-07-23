// main.js
// City Era Timelapse 1945-2055
// 3D scene with timeline slider transforming the city block

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// === GLOBALS ===
let scene, camera, renderer, controls;
let currentYear = 1945;
let transitionProgress = 0;
let isTransitioning = false;
let clock = new THREE.Clock();
let mixer = null;
let ambientSound = null;
let soundEnabled = true;
let cityObjects = [];

const YEARS = [1945, 1965, 1985, 2005, 2025, 2055];
const YEAR_DATA = {
  1945: { label: "1945 - Post-War", color: "#8B4513", sfx: "sfx_1945" },
  1965: { label: "1965 - Swinging Sixties", color: "#FF69B4", sfx: "sfx_1965" },
  1985: { label: "1985 - Neon Nights", color: "#00FFFF", sfx: "sfx_1985" },
  2005: { label: "2005 - Digital Dawn", color: "#32CD32", sfx: "sfx_2005" },
  2025: { label: "2025 - Modern Day", color: "#FFFFFF", sfx: "sfx_2025" },
  2055: { label: "2055 - Cyber Future", color: "#9932CC", sfx: "sfx_2055" }
};

// === INIT ===
init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0x87CEEB, 0.0015);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(30, 20, 40);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas'), antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSilterShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.minDistance = 15;
  controls.maxDistance = 120;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  scene.add(dirLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sky color helper
  const skyColor = new THREE.Color(0x87CEEB);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { topColor: { value: skyColor }, bottomColor: { value: new THREE.Color(0x87CEEB) }, offset: { value: 0.5 }, exponent: { value: 0.5 } },
    vertexShader: `varying vec3 vWorldPosition;
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(0.0, (h + offset) / (1.0 - offset))), 1.0);
      }`,
    side: THREE.BackSide
  });
  const skyGeo = new THREE.SphereGeometry(180, 32, 32);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Build the city block
  buildCityBlock();

  // Setup UI
  setupUI();

  // Resize handler
  window.addEventListener('resize', onWindowResize);

  // Keyboard navigation
  window.addEventListener('keydown', onKeyDown);
}

// === CITY BLOCK ===

function buildCityBlock() {
  // Clear existing
  while (cityObjects.length > 0) {
    const obj = cityObjects.pop();
    scene.remove(obj);
  }

  // Buildings (4 main buildings around a central plaza)
  const buildingConfigs = [
    { pos: [-15, 0, -10], size: [10, 20, 10], type: 'residential' },
    { pos: [15, 0, -10], size: [10, 25, 10], type: 'commercial' },
    { pos: [-15, 0, 15], size: [10, 18, 10], type: 'mixed' },
    { pos: [15, 0, 15], size: [10, 22, 10], type: 'office' }
  ];

  buildingConfigs.forEach(cfg => {
    const building = createBuilding(cfg);
    scene.add(building);
    cityObjects.push(building);
  });

  // Streets
  const streetMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const streetGeo = new THREE.PlaneGeometry(40, 8);
  const street1 = new THREE.Mesh(streetGeo, streetMat);
  street1.rotation.x = -Math.PI / 2;
  street1.position.set(0, 0.01, 0);
  street1.receiveShadow = true;
  scene.add(street1);
  cityObjects.push(street1);

  const street2 = street1.clone();
  street2.rotation.z = Math.PI / 2;
  scene.add(street2);
  cityObjects.push(street2);

  // Crosswalks
  const crosswalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  const crosswalkGeo = new THREE.PlaneGeometry(6, 1);
  const cw1 = new THREE.Mesh(crosswalkGeo, crosswalkMat);
  cw1.rotation.x = -Math.PI / 2;
  cw1.position.set(0, 0.02, 2);
  scene.add(cw1);
  cityObjects.push(cw1);

  // Plaza in center
  const plazaGeo = new THREE.CylinderGeometry(8, 8, 0.5, 32);
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.set(0, 0.25, 0);
  plaza.receiveShadow = true;
  scene.add(plaza);
  cityObjects.push(plaza);

  // Trees
  for (let i = 0; i < 6; i++) {
    const tree = createTree();
    tree.position.set(
      (i % 2 === 0 ? -1 : 1) * (25 + Math.random() * 5),
      0,
      (i < 2 ? -1 : i < 4 ? 1 : 0) * (20 + Math.random() * 5)
    );
    scene.add(tree);
    cityObjects.push(tree);
  }

  // Vehicles
  for (let i = 0; i < 3; i++) {
    const vehicle = createVehicle();
    vehicle.position.set(-30 + i * 20, 0.5, -12);
    scene.add(vehicle);
    cityObjects.push(vehicle);
  }

  // Pedestrians
  for (let i = 0; i < 5; i++) {
    const pedestrian = createPedestrian();
    pedestrian.position.set(
      -10 + i * 5,
      0,
      8 + Math.sin(i) * 3
    );
    scene.add(pedestrian);
    cityObjects.push(pedestrian);
  }

  // Apply year-specific styling
  applyYearStyling();
}

function createBuilding(cfg) {
  const group = new THREE.Group();
  const { pos, size, type } = cfg;

  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });
  const building = new THREE.Mesh(geo, mat);
  building.position.y = size[1] / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  building.userData = { type, era: 'base' };
  group.add(building);

  // Windows
  const windowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, emissive: 0x000000, transparent: true });
  for (let i = 0; i < 12; i++) {
    const window = new THREE.Mesh(windowGeo, windowMat);
    window.position.set(
      -size[0] / 2 + 2 + (i % 3) * 3,
      size[1] / 2 - 3 - Math.floor(i / 3) * 3,
      size[2] / 2 + 0.01
    );
    window.userData = { lit: Math.random() > 0.5 };
    group.add(window);
  }

  group.position.set(pos[0], 0, pos[2]);
  return group;
}

function createTree() {
  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const leafGeo = new THREE.SphereGeometry(2, 16, 16);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const leaves = new THREE.Mesh(leafGeo, leafMat);
  leaves.position.y = 2.5;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);

  return group;
}

function createVehicle() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(5, 1.5, 2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1E90FF });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roofGeo = new THREE.BoxGeometry(3, 1, 2);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.y = 1.5;
  roof.castShadow = true;
  group.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(
      (i % 2 === 0 ? -1 : 1) * 1.8,
      -0.8,
      (i < 2 ? -1 : 1) * 1.2
    );
    wheel.castShadow = true;
    group.add(wheel);
  }

  return group;
}

function createPedestrian() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 2.3;
  head.castShadow = true;
  group.add(head);

  return group;
}

// === YEAR STYLING ===
function applyYearStyling() {
  const data = YEAR_DATA[currentYear];

  // Update ground color based on year
  scene.traverse((child) => {
    if (child.isMesh && child.material && child.material.color) {
      // Reset to base
      if (child.name === 'ground') {
        child.material.color.set(0x228B22);
      }
    }
  });

  // Year-specific adjustments
  switch (currentYear) {
    case 1945:
      scene.background = new THREE.Color(0x87CEEB);
      scene.fog.color.set(0x87CEEB);
      scene.fog.density = 0.0015;
      break;
    case 1965:
      scene.background = new THREE.Color(0x87CEEB);
      scene.fog.color.set(0x87CEEB);
      scene.fog.density = 0.001;
      break;
    case 1985:
      scene.background = new THREE.Color(0x1a1a2e);
      scene.fog.color.set(0x1a1a2e);
      scene.fog.density = 0.002;
      break;
    case 2005:
      scene.background = new THREE.Color(0x4682B4);
      scene.fog.color.set(0x4682B4);
      scene.fog.density = 0.001;
      break;
    case 2025:
      scene.background = new THREE.Color(0x87CEEB);
      scene.fog.color.set(0x87CEEB);
      scene.fog.density = 0.0005;
      break;
    case 2055:
      scene.background = new THREE.Color(0x0a0a1a);
      scene.fog.color.set(0x0a0a1a);
      scene.fog.density = 0.003;
      break;
  }

  // Update building colors
  scene.traverse((child) => {
    if (child.isGroup) {
      child.traverse((obj) => {
        if (obj.isMesh && obj.userData.type === 'residential') {
          obj.material.color.set(getBuildingColor(currentYear, 'residential'));
        } else if (obj.isMesh && obj.userData.type === 'commercial') {
          obj.material.color.set(getBuildingColor(currentYear, 'commercial'));
        }
      });
    }
  });

  // Update vehicle colors
  scene.traverse((child) => {
    if (child.isGroup) {
      child.traverse((obj) => {
        if (obj.isMesh && obj.material.color && obj.geometry && obj.geometry.type === 'BoxGeometry') {
          obj.material.color.set(getVehicleColor(currentYear));
        }
      });
    }
  });

  // Update pedestrian colors
  scene.traverse((child) => {
    if (child.isGroup) {
      child.traverse((obj) => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'CapsuleGeometry') {
          obj.material.color.set(getOutfitColor(currentYear));
        }
      });
    }
  });

  // Update window lighting
  scene.traverse((child) => {
    if (child.isMesh && child.userData.lit !== undefined) {
      const lit = child.userData.lit;
      if (currentYear <= 1965) {
        child.material.emissive.set(lit ? 0x442200 : 0x000000);
        child.material.color.set(0x87CEEB);
      } else if (currentYear <= 1985) {
        child.material.emissive.set(lit ? 0x440044 : 0x000000);
        child.material.color.set(0x00FFFF);
      } else if (currentYear <= 2005) {
        child.material.emissive.set(lit ? 0x002200 : 0x000000);
        child.material.color.set(0x32CD32);
      } else {
        child.material.emissive.set(lit ? 0x220044 : 0x000000);
        child.material.color.set(0x9932CC);
      }
    }
  });

  // Update SFX
  updateAmbientSound();
}

function getBuildingColor(year, type) {
  switch (year) {
    case 1945: return type === 'residential' ? 0x8B4513 : 0xA0522D;
    case 1965: return type === 'residential' ? 0xDEB887 : 0xF4A460;
    case 1985: return type === 'residential' ? 0x778899 : 0x708090;
    case 2005: return type === 'residential' ? 0xD2B48C : 0xC0C0C0;
    case 2025: return type === 'residential' ? 0xF5DEB3 : 0xE0E0E0;
    case 2055: return type === 'residential' ? 0x6A5ACD : 0x9370DB;
    default: return 0x8B4513;
  }
}

function getVehicleColor(year) {
  switch (year) {
    case 1945: return 0x8B0000;
    case 1965: return 0xFF69B4;
    case 1985: return 0x00FF00;
    case 2005: return 0x1E90FF;
    case 2025: return 0xFFFFFF;
    case 2055: return 0x00FFFF;
    default: return 0x1E90FF;
  }
}

function getOutfitColor(year) {
  switch (year) {
    case 1945: return 0x2F4F4F;
    case 1965: return 0xFF69B4;
    case 1985: return 0x00FF00;
    case 2005: return 0x32CD32;
    case 2025: return 0xFFFFFF;
    case 2055: return 0x9932CC;
    default: return 0x8B4513;
  }
}

// === SFX ===
function updateAmbientSound() {
  if (!soundEnabled || !ambientSound) return;
  const data = YEAR_DATA[currentYear];
  // In a full implementation, different SFX files would be loaded per era
  // For now, we adjust the volume based on the era
  ambientSound.volume = currentYear >= 1985 ? 0.8 : 0.4;
}

// === UI ===
function setupUI() {
  const slider = document.getElementById('timeline-slider');
  const yearDisplay = document.getElementById('year-display');

  slider.addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    const newYear = YEARS[index];
    if (newYear !== currentYear) {
      currentYear = newYear;
      yearDisplay.textContent = currentYear;
      yearDisplay.style.color = YEAR_DATA[currentYear].color;
      applyYearStyling();
    }
  });

  // Initialize display
  yearDisplay.textContent = currentYear;
  yearDisplay.style.color = YEAR_DATA[currentYear].color;
}

// === EVENT HANDLERS ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  // Arrow keys for navigation
  if (event.key === 'ArrowLeft') {
    const idx = YEARS.indexOf(currentYear);
    if (idx > 0) {
      currentYear = YEARS[idx - 1];
      document.getElementById('timeline-slider').value = idx - 1;
      document.getElementById('year-display').textContent = currentYear;
      document.getElementById('year-display').style.color = YEAR_DATA[currentYear].color;
      applyYearStyling();
    }
  } else if (event.key === 'ArrowRight') {
    const idx = YEARS.indexOf(currentYear);
    if (idx < YEARS.length - 1) {
      currentYear = YEARS[idx + 1];
      document.getElementById('timeline-slider').value = idx + 1;
      document.getElementById('year-display').textContent = currentYear;
      document.getElementById('year-display').style.color = YEAR_DATA[currentYear].color;
      applyYearStyling();
    }
  }
}

// === ANIMATE ===
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Update controls
  controls.update();

  // Update mixer if exists
  if (mixer) {
    mixer.update(delta);
  }

  renderer.render(scene, camera);
}
