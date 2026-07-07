import * as THREE from 'three';
import type { EraId } from './eras.js';
import { createAssetSet, type AssetSet } from './assetBuilder/assetSet.js';
import type { EraAudioBuffers as EraAudioBuffersType } from './audio/sfx.js';
import { generateEraAudioBuffers } from './audio/sfx.js';
import { SfxMixer } from './audio/mixer.js';

/**
 * Transition animation state
 */
interface TransitionState {
  progress: number; // 0 to 1
  fromEra: EraId;
  toEra: EraId;
  startTime: number;
  duration: number;
  meshesToTransition: THREE.Mesh[];
}

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
 * Era style configuration for smooth transitions
 */
interface EraStyleConfig {
  colors: number[];
  heights: [number, number];
  featureWeights: Record<string, number>;
}

/**
 * Style configurations for each era with interpolation values
 */
const ERA_STYLE_CONFIGS: Record<EraId, EraStyleConfig> = {
  '1945': {
    colors: [0x8B4513, 0xCD853F, 0xA0522D, 0x654321],
    heights: [4, 8],
    featureWeights: {
      'brick-facade': 1,
      'glass-facade': 0,
      'modern': 0
    }
  },
  '1965': {
    colors: [0x9370DB, 0x4169E1, 0x8B008B, 0x2F4F4F],
    heights: [6, 12],
    featureWeights: {
      'brick-facade': 1,
      'glass-facade': 0,
      'modern': 0.3
    }
  },
  '1985': {
    colors: [0x2F4F4F, 0x708090, 0x778899, 0x2C3539],
    heights: [10, 20],
    featureWeights: {
      'brick-facade': 0,
      'glass-facade': 1,
      'modern': 0.6
    }
  },
  '2005': {
    colors: [0x000080, 0x87CEEB, 0xFFFFFF, 0xC0C0C0],
    heights: [15, 30],
    featureWeights: {
      'brick-facade': 0,
      'glass-facade': 1,
      'modern': 1
    }
  },
  '2025': {
    colors: [0x00CED1, 0x1E90FF, 0x87CEFA, 0x98FB98],
    heights: [20, 40],
    featureWeights: {
      'brick-facade': 0,
      'glass-facade': 0.3,
      'modern': 1
    }
  }
};

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
  let currentAssetSet: AssetSet | null = null;
  let transitionState: TransitionState | null = null;
  let audioMixer: SfxMixer | null = null;
  let audioBuffers: Record<EraId, EraAudioBuffersType> | null = null;

  // Initialize with default era assets
  currentAssetSet = createAssetSet(currentEra);
  scene.add(currentAssetSet.group);

  // Initialize audio mixer on first user interaction
  const initAudio = async () => {
    if (!audioBuffers && !audioMixer) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        
        // Generate all era buffers
        audioBuffers = {} as Record<EraId, EraAudioBuffersType>;
        const eraIds: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
        
        for (const eraId of eraIds) {
          audioBuffers[eraId] = generateEraAudioBuffers(ctx, eraId, (await import('./eras.js')).SFX_ERA_DATA[eraId]);
        }
        
        audioMixer = new SfxMixer();
        await audioMixer.init(audioBuffers);
        audioMixer.setEra(currentEra);
      } catch (error) {
        console.warn('Failed to initialize audio:', error);
      }
    }
  };

  // Initialize audio on user interaction
  const handleUserInteraction = () => {
    initAudio();
    document.removeEventListener('click', handleUserInteraction);
    document.removeEventListener('keydown', handleUserInteraction);
  };
  document.addEventListener('click', handleUserInteraction);
  document.addEventListener('keydown', handleUserInteraction);

  return {
    camera,
    scene,
    renderer,
    setEra: (eraId: EraId) => {
      if (currentEra === eraId || transitionState) return;
      
      // Start smooth transition
      startTransition(eraId);
      
      // Update audio
      if (audioMixer) {
        audioMixer.setEra(eraId);
      }
    },
    render: () => {
      // Update transition animation
      if (transitionState) {
        updateTransition();
      }
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
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      
      if (currentAssetSet) {
        scene.remove(currentAssetSet.group);
        disposeAssetSet(currentAssetSet);
      }
      
      audioMixer?.dispose();
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

  /**
   * Starts a smooth transition between eras
   */
  function startTransition(toEra: EraId): void {
    transitionState = {
      progress: 0,
      fromEra: currentEra,
      toEra,
      startTime: performance.now(),
      duration: 1500, // 1.5 second transition
      meshesToTransition: []
    };

    // Collect meshes to transition
    if (currentAssetSet) {
      currentAssetSet.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          transitionState!.meshesToTransition.push(obj);
        }
      });
    }
  }

  /**
   * Updates the transition animation each frame
   */
  function updateTransition(): void {
    if (!transitionState || !currentAssetSet) return;

    const elapsed = performance.now() - transitionState.startTime;
    transitionState.progress = Math.min(elapsed / transitionState.duration, 1);

    // Apply interpolation to meshes
    const t = easeInOutCubic(transitionState.progress);
    interpolateVisuals(transitionState.meshesToTransition, t, transitionState.toEra);

    // Complete transition when done
    if (transitionState.progress >= 1) {
      completeTransition();
    }
  }

  /**
   * Interpolates visual properties between eras
   */
  function interpolateVisuals(meshes: THREE.Mesh[], t: number, targetEra: EraId): void {
    const fromConfig = ERA_STYLE_CONFIGS[currentEra];
    const toConfig = ERA_STYLE_CONFIGS[targetEra];

    meshes.forEach((mesh, index) => {
      // Stagger the transition based on mesh index
      const stagger = (index % 30) / 30;
      const individualT = Math.min(1, t * 3 - stagger * 2);
      
      if (individualT <= 0) return;

      // Interpolate color
      if (mesh.material && 'color' in mesh.material) {
        const fromColor = new THREE.Color(fromConfig.colors[index % fromConfig.colors.length]);
        const toColor = new THREE.Color(toConfig.colors[index % toConfig.colors.length]);
        const interpolated = new THREE.Color().lerpColors(fromColor, toColor, individualT);
        (mesh.material as THREE.MeshStandardMaterial).color.copy(interpolated);
      }

      // Interpolate scale for morphing effect
      if (individualT > 0) {
        const fromHeight = fromConfig.heights[0] + (fromConfig.heights[1] - fromConfig.heights[0]) * (Math.random() * 0.5 + 0.25);
        const toHeight = toConfig.heights[0] + (toConfig.heights[1] - toConfig.heights[0]) * (Math.random() * 0.5 + 0.25);
        
        const yScale = 1 + (toHeight / fromHeight - 1) * individualT;
        mesh.scale.y = yScale;
        mesh.position.y = mesh.position.y * yScale;
      }
    });
  }

  /**
   * Completes the transition by swapping to new era assets
   */
  function completeTransition(): void {
    if (!transitionState || !currentAssetSet) return;

    const oldEra = currentEra;
    const newEra = transitionState.toEra;

    // Remove old assets
    scene.remove(currentAssetSet.group);
    disposeAssetSet(currentAssetSet);

    // Create new era assets
    currentAssetSet = createAssetSet(newEra);
    scene.add(currentAssetSet.group);
    currentEra = newEra;

    // Clear transition state
    transitionState = null;

    // Play transition sound
    if (audioMixer) {
      audioMixer.playEvent(newEra, '');
    }
  }

  /**
   * Disposes an asset set's geometries and materials
   */
  function disposeAssetSet(assetSet: AssetSet): void {
    assetSet.group.traverse((obj) => {
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

/**
 * Easing function for smooth transitions
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}