import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EraState } from './scene/EraState';
import { mountTimeline } from './ui/timeline';


// =============================================================================
// City Timelapse — Foundation Scaffold
//
// Establishes the shared 3D scene scaffold that every later era-content task
// will build upon: a WebGLRenderer (antialias, sRGB, ACESFilmic), a
// PerspectiveCamera, a Scene with hemisphere + directional + ambient lights,
// OrbitControls with damping, a procedural gradient skybox, a ground plane,
// and a viewport-filling resize handler.
//
// No external model or texture files are loaded — everything is procedural.
// =============================================================================

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

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();

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
scene.add(ground);

const gridHelper = new THREE.GridHelper(400, 80, 0x666666, 0x333333);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize);

// ---------------------------------------------------------------------------
// Timeline UI — fixed top-of-viewport era slider
// ---------------------------------------------------------------------------

const eraState = new EraState();
const disposeTimeline = mountTimeline(eraState);

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate(): void {
  const elapsed = clock.getElapsedTime();

  // Subtle directional light orbit to hint at time passing.
  directionalLight.position.x = Math.cos(elapsed * 0.02) * 50;
  directionalLight.position.z = Math.sin(elapsed * 0.02) * 50;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

// ---------------------------------------------------------------------------
// Cleanup (for HMR and future disposal patterns)
// ---------------------------------------------------------------------------

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', onWindowResize);
    disposeTimeline();
    renderer.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
  });
}
