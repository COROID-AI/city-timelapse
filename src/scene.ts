import * as THREE from 'three';
import type { EraId } from './eras.js';

/**
 * Scene manager for the City Time Period Timelapse
 * Handles Three.js scene setup, rendering, and era transitions
 */
export interface SceneManager {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  setEra(eraId: EraId): void;
  render(): void;
  handleResize(): void;
  dispose(): void;
}

/**
 * Sets up the Three.js scene with WebGL renderer, lighting, and ground plane
 */
export function setupScene(): SceneManager {
  // Create renderer with WebGL
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  // Create camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 50, 100);
  camera.lookAt(0, 0, 0);

  // Add lighting
  setupLighting(scene);

  // Add ground plane
  addGroundPlane(scene);

  // Add city block boundaries (marker boxes)
  addCityBlockBoundaries(scene);

  // Current era state
  let currentEra: EraId = '2025';

  return {
    camera,
    scene,
    renderer,
    setEra: (eraId: EraId) => {
      currentEra = eraId;
      // Scene transition logic will be implemented in later phases
    },
    render: () => {
      renderer.render(scene, camera);
    },
    handleResize: () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    dispose: () => {
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });
    }
  };
}

/**
 * Sets up scene lighting with ambient and directional lights
 */
function setupLighting(scene: THREE.Scene): void {
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Directional light (sun) with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  scene.add(directionalLight);

  // Hemisphere light for sky-like lighting
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2f4f2f, 0.4);
  scene.add(hemiLight);
}

/**
 * Adds a ground plane to the scene
 */
function addGroundPlane(scene: THREE.Scene): void {
  const groundGeometry = new THREE.PlaneGeometry(500, 500);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a5a3a,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper for reference
  const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
  gridHelper.position.y = 0.01; // Slightly above ground to avoid z-fighting
  scene.add(gridHelper);
}

/**
 * Adds visual markers for city block boundaries
 * Creates placeholder boxes at the corners of a city block area
 */
function addCityBlockBoundaries(scene: THREE.Scene): void {
  const blockSize = 200;
  const boundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.5,
    metalness: 0.5,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  });

  // Create a boundary box around the city area
  const boundaryGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boundaryHelper = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
  boundaryHelper.scale.set(blockSize, 1, blockSize);
  boundaryHelper.position.y = 0.5;
  scene.add(boundaryHelper);

  // Add corner markers
  const markerGeometry = new THREE.SphereGeometry(2, 8, 8);
  const corners = [
    [-blockSize / 2, 0, -blockSize / 2],
    [blockSize / 2, 0, -blockSize / 2],
    [-blockSize / 2, 0, blockSize / 2],
    [blockSize / 2, 0, blockSize / 2]
  ];

  corners.forEach((corner) => {
    const marker = new THREE.Mesh(markerGeometry, boundaryMaterial);
    marker.position.set(corner[0], corner[1], corner[2]);
    scene.add(marker);
  });
}