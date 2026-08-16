/**
 * Main entry point for the City Timelapse 3D scene.
 * Demonstrates the SceneManager initialization and render loop.
 * Creates the city block ground plane with era-appropriate infrastructure.
 * Implements camera controls, post-processing effects, mini-map, and era navigation.
 */

import * as THREE from 'three';
import { SceneManager } from './scene-manager';
import { EraKey, ERAS, applyEraStyle } from './eras/eraData';
import { EraTransitionEngine } from './eraTransition';
import { createCityBlockGroundPlane } from './CityBlockGroundPlane';
import { TimelineSlider } from './ui/timelineSlider';
import { CameraControls } from './camera-controls';
import { PostProcessing } from './post-processing';
import { MiniMap } from './minimap';

// Initialize scene manager
const sceneManager = new SceneManager({
  // AC acceptance criteria: antialiasing=true, toneMapping=ACESFilmicToneMapping
  antialias: true,
  shadows: true,

  // Configure camera defaults for orbit-ready position looking at city block center
  fov: 75,
  cameraZ: 150,
},
'document.body');

// Create the city block ground plane with era-appropriate materials
const initialEra: EraKey = '2025' as EraKey; // Default to 2025 era
const groundComponents = createCityBlockGroundPlane(initialEra, sceneManager.getScene());

// Initialize era transition engine
const transitionEngine = new EraTransitionEngine(sceneManager.getScene());

// Initialize timeline slider with config object
const timelineSlider = new TimelineSlider({
  onYearChange: (year: number) => {
    // Apply era style with smooth transition
    applyEraStyle(sceneManager.getScene(), year);
  },
  transitionDuration: 2,
  accentColor: '#4a90e2',
});

// Initialize with 2025 era snapshot directly (no transition on startup)
// (no transition on startup)
applyEraStyle(sceneManager.getScene(), parseInt(initialEra));

// Initialize ambient light and fog for 2025 era
sceneManager.getScene().background = new THREE.Color(
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255,
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255,
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255
);

// Get camera from scene manager
const camera = sceneManager.getCamera();

// Create camera controls
const controls = new CameraControls(
  camera,
  sceneManager.getScene(),
  sceneManager.getRenderer(),
  new THREE.Vector3(0, 0, 0), // target is city block center
  {
    baseSpeed: 5,           // 5 m/s default walk speed
    orbitDamping: 0.1,
    zoomDamping: 0.1,
    panDamping: 0.1,
    autoOrbit: false,       // disabled by default
    autoOrbitSpeed: 0.01,
    collisionDetection: true,
    collisionMargin: 5,
    orbitSensitivity: 0.5,
    zoomSensitivity: 1.0,
    panSensitivity: 0.5,
  }
);

// Set initial speed
controls.setSpeed(5);  // 5 m/s default walk speed

// Enable auto-orbit (optional feature) - toggle with 'A' key
controls.toggleAutoOrbit();

// Create post-processing effects
const width = window.innerWidth;
const height = window.innerHeight;
const postProcessing = new PostProcessing(
  sceneManager.getRenderer(),
  sceneManager.getScene(),
  camera,
  width,
  height
);

// Create mini-map container
const minimapContainer = document.createElement('div');
minimapContainer.id = 'minimap-container';
document.body.appendChild(minimapContainer);

// Create mini-map
const minimap = new MiniMap(minimapContainer, {
  size: 200,
  position: 'br', // bottom-right
  opacity: 0.8,
  showPosition: true,
  showDirection: true,
  eraColors: new Map([
    ['1945', 'brown'],
    ['1965', 'vibrant'],
    ['1985', 'purple'],
    ['2005', 'blue'],
    ['2025', 'darkblue'],
  ]),
});

// Initialize mini-map with 2025 era
minimap.updateEra('2025');

// Set up render loop
let lastRenderTime = 0;
const renderLoop = () => {
  requestAnimationFrame(renderLoop);
  const now = performance.now();
  const deltaTime = (now - lastRenderTime) / 1000;
  lastRenderTime = now;

  // Transition engine updates handled internally

  // Update camera controls with delta time
  controls.update(deltaTime);

  // Render scene with post-processing
  postProcessing.render(deltaTime);

  // Render mini-map
  minimap.render(deltaTime);

  // Render main scene
  sceneManager.getRenderer().render(sceneManager.getScene(), camera);
};

renderLoop();

// Handle era transitions - reposition camera and update effects
function switchEra(newEra: EraKey) {
  // Update post-processing for new era
  postProcessing.updateEra(newEra);
  // Update mini-map for new era
  minimap.updateEra(newEra);
  console.log(`Switched to era: ${newEra}`);
}

// Initial camera position verification
console.log('Camera position:', camera.position);
console.log('Scene fog:', sceneManager.getScene().fog);
console.log('Renderer tone mapping:', sceneManager.getRenderer().toneMapping);
console.log('Renderer shadow map type:', sceneManager.getRenderer().shadowMap.type);

// Set up keyboard event listeners for camera controls
window.addEventListener('keydown', (event) => {
  // Auto-orbit toggle with 'A' key
  if (event.code === 'KeyA') {
    controls.toggleAutoOrbit();
  }

  // Reset camera with 'R' key
  if (event.code === 'KeyR') {
    controls.resetCamera();
  }

  // Speed cycle with 'S' key
  if (event.code === 'KeyS') {
    controls.cycleSpeed();
  }
});

// Set up resize handler
window.addEventListener('resize', () => {
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;

  // Update scene manager resize
  sceneManager.resize(newWidth, newHeight);

  // Update post-processing resize
  postProcessing.resize(newWidth, newHeight);

  // Update mini-map container size
  if (minimapContainer) {
    minimapContainer.style.width = `${Math.min(newWidth, newHeight) * 0.2}px`;
    minimapContainer.style.height = `${Math.min(newWidth, newHeight) * 0.2}px`;
  }
});

// Start the animation loop
console.log('City Timelapse 3D scene initialized with camera controls, post-processing, and mini-map');