import * as THREE from 'three';
import type { EraId } from './eras.js';
import { createAssetSet, type AssetSet } from './assetBuilder/assetSet.js';
import type { EraAudioBuffers as EraAudioBuffersType } from './audio/sfx.js';
import { generateEraAudioBuffers } from './audio/sfx.js';
import { SfxMixer } from './audio/mixer.js';
import { createParticleSystem } from './particleSystem.js';

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
  stopDemo(): void;
  render(deltaTime: number): void;
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
 * Lighting configuration for each era
 */
interface EraLightingConfig {
  ambientIntensity: number;
  directionalIntensity: number;
  directionalColor: number;
  hemiSkyIntensity: number;
  hemiGroundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
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
 * Lighting configurations for each era
 */
const ERA_LIGHTING_CONFIGS: Record<EraId, EraLightingConfig> = {
  '1945': {
    ambientIntensity: 0.7,      // Warmer, softer
    directionalIntensity: 0.9,  // Natural sunlight
    directionalColor: 0xffe0a0, // Warm sunlight
    hemiSkyIntensity: 0.5,
    hemiGroundColor: 0x5d4037,  // Earthy ground tone
    fogColor: 0x87ceeb,
    fogNear: 100,
    fogFar: 300
  },
  '1965': {
    ambientIntensity: 0.6,
    directionalIntensity: 0.8,
    directionalColor: 0xffd54f, // Slightly warmer
    hemiSkyIntensity: 0.4,
    hemiGroundColor: 0x388e3c,
    fogColor: 0x81d4fa,
    fogNear: 120,
    fogFar: 350
  },
  '1985': {
    ambientIntensity: 0.5,
    directionalIntensity: 0.7,
    directionalColor: 0x81d4fa, // Cooler modern light
    hemiSkyIntensity: 0.4,
    hemiGroundColor: 0x424242,
    fogColor: 0x607d8b,
    fogNear: 150,
    fogFar: 400
  },
  '2005': {
    ambientIntensity: 0.4,
    directionalIntensity: 0.6,
    directionalColor: 0xb3e5fc, // Cool blue-white
    hemiSkyIntensity: 0.3,
    hemiGroundColor: 0x263238,
    fogColor: 0x4fc3f7,
    fogNear: 180,
    fogFar: 450
  },
  '2025': {
    ambientIntensity: 0.3,
    directionalIntensity: 0.5,
    directionalColor: 0x00bcd4, // Futuristic cyan
    hemiSkyIntensity: 0.3,
    hemiGroundColor: 0x004d40,
    fogColor: 0x00bfa5,
    fogNear: 200,
    fogFar: 500
  }
};

/**
 * Updates lighting for a specific era with smooth transition
 */
function updateEraLighting(
  eraId: EraId,
  ambientLight: THREE.AmbientLight,
  directionalLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight,
  scene: THREE.Scene
): void {
  const config = ERA_LIGHTING_CONFIGS[eraId];
  
  // Animate to new lighting values
  const tweenDuration = 1500;
  const start = performance.now();
  
  const initialAmbient = ambientLight.intensity;
  const initialDirIntensity = directionalLight.intensity;
  const initialDirColor = new THREE.Color(directionalLight.color.getHex());
  
  const animateLighting = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / tweenDuration, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    ambientLight.intensity = initialAmbient + (config.ambientIntensity - initialAmbient) * eased;
    directionalLight.intensity = initialDirIntensity + (config.directionalIntensity - initialDirIntensity) * eased;
    directionalLight.color.lerpColors(initialDirColor, new THREE.Color(config.directionalColor), eased);
    hemiLight.intensity = config.hemiSkyIntensity;
    hemiLight.groundColor.set(config.hemiGroundColor);
    
    // Update fog
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.set(config.fogColor);
      (scene.fog as THREE.Fog).near = config.fogNear;
      (scene.fog as THREE.Fog).far = config.fogFar;
    }
    
    if (t < 1) {
      requestAnimationFrame(animateLighting);
    }
  };
  
  animateLighting();
}

/**
 * Sets up the Three.js scene with WebGL renderer, lighting, and ground plane
 */
export function setupScene(): SceneManager {
  // Create renderer with WebGL
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 100, 300); // Add fog for depth

  // Create camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 50, 100);
  camera.lookAt(0, 0, 0);

  // Add lighting (stored for updates)
  const ambientLight = new THREE.AmbientLight(0xffffff, ERA_LIGHTING_CONFIGS['2025'].ambientIntensity);
  scene.add(ambientLight);

  // Directional light (sun) with shadows
  const directionalLight = new THREE.DirectionalLight(
    ERA_LIGHTING_CONFIGS['2025'].directionalColor,
    ERA_LIGHTING_CONFIGS['2025'].directionalIntensity
  );
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
  const hemiLight = new THREE.HemisphereLight(
    0x87ceeb,
    ERA_LIGHTING_CONFIGS['2025'].hemiGroundColor,
    ERA_LIGHTING_CONFIGS['2025'].hemiSkyIntensity
  );
  scene.add(hemiLight);

  // Add ground plane
  addGroundPlane(scene);

  // Add city block boundaries (marker boxes)
  addCityBlockBoundaries(scene);

  // Initialize particle system
  const particleSystem = createParticleSystem(scene);
  particleSystem.setEra('1945');

  // Current era state
  let currentEra: EraId = '1945';
  let currentAssetSet: AssetSet | null = null;
  let transitionState: TransitionState | null = null;
  let audioMixer: SfxMixer | null = null;
  let audioBuffers: Record<EraId, EraAudioBuffersType> | null = null;

  // Auto-cycle demo: automatically transition through all eras to showcase differences
  let demoMode = true;
  const demoEras: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
  let demoIndex = 0;
  let demoTimer: number | null = null;

  // Initialize with default era assets
  currentAssetSet = createAssetSet(currentEra);
  scene.add(currentAssetSet.group);

  // Apply 1945 lighting initially
  updateEraLighting('1945', ambientLight, directionalLight, hemiLight, scene);

  // Initial render to populate the canvas
  renderer.render(scene, camera);

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

  // Demo function - cycles through all eras automatically
  function runDemo(): void {
    if (!demoMode) return;
    
    // Wait for any ongoing transition to complete
    if (transitionState) {
      requestAnimationFrame(runDemo);
      return;
    }
    
    demoIndex = (demoIndex + 1) % demoEras.length;
    const nextEra = demoEras[demoIndex];
    if (nextEra !== currentEra) {
      setEra(nextEra);
    }
    
    demoTimer = window.setTimeout(() => {
      if (demoMode) {
        runDemo();
      }
    }, 4000);
  }

  // Expose setEra for demo and external use
  function setEra(eraId: EraId): void {
    if (currentEra === eraId || transitionState) return;
    
    // Update particle system
    particleSystem.setEra(eraId);
    
    // Update lighting
    updateEraLighting(eraId, ambientLight, directionalLight, hemiLight, scene);
    
    // Start smooth transition
    startTransition(eraId);
    
    // Update audio
    if (audioMixer) {
      audioMixer.setEra(eraId);
    }
  }

  // Start auto-demo after initial setup
  setTimeout(() => {
    if (demoMode) {
      runDemo();
    }
  }, 3000);

  return {
    camera,
    scene,
    renderer,
    setEra,
    render: (deltaTime: number = 1 / 60) => {
      // Update transition animation
      if (transitionState) {
        updateTransition();
      }
      
      // Update particle system
      particleSystem.update(deltaTime);
      
      renderer.render(scene, camera);
    },
    handleResize: () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    stopDemo: () => {
      demoMode = false;
      if (demoTimer) {
        clearTimeout(demoTimer);
        demoTimer = null;
      }
    },
    dispose: () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      
      // Stop demo timer
      demoMode = false;
      if (demoTimer) {
        clearTimeout(demoTimer);
        demoTimer = null;
      }
      
      particleSystem.dispose();
      
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
      audioMixer.playEvent(newEra, 'transition');
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

  // Central east-west road surface — matches the street layout used by the
  // asset set (vehicles at z = ±4, pedestrians at z = ±15, buildings at z = ±30).
  const roadGeometry = new THREE.PlaneGeometry(170, 20);
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.9,
    metalness: 0.1
  });
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  scene.add(road);

  // Centre lane marking on the road
  const markingGeometry = new THREE.PlaneGeometry(170, 0.4);
  const markingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    roughness: 0.6,
    emissive: 0x554400,
    emissiveIntensity: 0.3
  });
  const marking = new THREE.Mesh(markingGeometry, markingMaterial);
  marking.rotation.x = -Math.PI / 2;
  marking.position.y = 0.025;
  scene.add(marking);

  // Sidewalk strips flanking the road (under the pedestrian paths)
  const sidewalkGeometry = new THREE.PlaneGeometry(170, 8);
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a9a9a,
    roughness: 0.8,
    metalness: 0.1
  });
  for (const sz of [-15, 15]) {
    const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, 0.015, sz);
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);
  }
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