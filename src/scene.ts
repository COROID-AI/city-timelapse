import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EraDefinition } from './eras/types';
import { CameraController } from './cameraController';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  cameraController: CameraController;
  renderLoop: { start(): void; stop(): void };
  setEra: (era: EraDefinition) => void;
  dispose: () => void;
}

/**
 * Creates the core Three.js stage: a perspective camera, a WebGL renderer with
 * ACES Filmic tone mapping and soft shadows, a HemisphereLight + directional
 * sun driven by era data, OrbitControls with damping, and a first-person fly
 * controller. Handles viewport resizing and full cleanup via `dispose`.
 */
export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();

  // Shared sky color — updated in place by setEra so background, fog and
  // hemisphere light all stay in sync.
  const skyColor = new THREE.Color(0x8fb4d6);
  scene.background = skyColor;

  const fog = new THREE.Fog(skyColor.getHex(), 80, 240);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(48, 42, 58);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ---- Lighting rig: hemisphere fill + directional sun ----
  const hemi = new THREE.HemisphereLight(skyColor.getHex(), 0x4a5a3a, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(40, 64, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  scene.add(sun);

  // ---- Navigation ----
  const domElement = renderer.domElement;

  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 6, 0);
  controls.update();

  const cameraController = new CameraController(camera, domElement);
  // Disable orbit input while the user is in first-person fly mode.
  cameraController.onModeChange((mode) => {
    controls.enabled = mode === 'orbit';
  });

  // ---- Resize handling ----
  const onResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener('resize', onResize);

  // ---- Render loop ----
  const clock = new THREE.Clock();
  let animationId = 0;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();
    cameraController.update(delta);
    renderer.render(scene, camera);
  };

  const renderLoop = {
    start: () => {
      if (animationId === 0) animate();
    },
    stop: () => {
      cancelAnimationFrame(animationId);
      animationId = 0;
    },
  };

  // Start rendering immediately.
  animate();

  // ---- Era application ----
  const setEra = (era: EraDefinition): void => {
    skyColor.set(era.skyTint);
    fog.color.copy(skyColor);
    fog.near = era.fog.near;
    fog.far = era.fog.far;
    hemi.color.copy(skyColor);
    sun.intensity = era.sunIntensity;
  };

  // ---- Teardown ----
  const dispose = () => {
    renderLoop.stop();
    window.removeEventListener('resize', onResize);
    controls.dispose();
    cameraController.dispose();
    renderer.dispose();
    if (domElement.parentNode === container) {
      container.removeChild(domElement);
    }
  };

  return { scene, camera, controls, cameraController, renderLoop, setEra, dispose };
}
