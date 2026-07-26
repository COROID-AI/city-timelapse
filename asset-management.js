// ===== Asset Management Module =====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Globals for asset management
let scene = null;
let loadingIndicator = null;
let assetLoaders = {};
let currentEra = null;
let eraAssets = {}; // Track assets by era

// Asset loading cache to avoid re-fetching same assets
const assetCache = {};

// ===== Loading Indicator Functions =====
function showLoadingIndicator() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

function hideLoadingIndicator() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// ===== Asset Loaders Setup =====
function setupAssetLoaders() {
  // GLTFLoader for .gltf and .glb files
  assetLoaders.gltf = new GLTFLoader();
  
  // Texture loader for textures
  const { TextureLoader } = THREE;
  assetLoaders.texture = new TextureLoader();
}

// ===== Asset Disposal =====
function disposeAsset(asset) {
  if (!asset) return;
  
  if (asset.geometry) {
    asset.geometry.dispose();
  }
  
  if (asset.material) {
    if (Array.isArray(asset.material)) {
      asset.material.forEach(material => {
        disposeMaterial(material);
      });
    } else {
      disposeMaterial(asset.material);
    }
  }
  
  if (asset.children && asset.children.length > 0) {
    asset.children.forEach(child => {
      disposeAsset(child);
    });
  }
}

function disposeMaterial(material) {
  if (!material) return;
  
  // Dispose textures
  if (material.map) {
    material.map.dispose();
  }
  if (material.normalMap) {
    material.normalMap.dispose();
  }
  if (material.aoMap) {
    material.aoMap.dispose();
  }
  if (material.roughnessMap) {
    material.roughnessMap.dispose();
  }
  if (material.metalnessMap) {
    material.metalnessMap.dispose();
  }
  if (material.emissiveMap) {
    material.emissiveMap.dispose();
  }
  
  // Dispose the material itself
  material.dispose();
}

function disposeEraAssets(era) {
  if (!eraAssets[era]) return;
  
  const assets = eraAssets[era];
  
  // Remove from scene and dispose
  assets.forEach(asset => {
    if (asset.parent) {
      asset.parent.remove(asset);
    }
    disposeAsset(asset);
  });
  
  delete eraAssets[era];
}

// ===== Asset Loading =====
async function loadAssetsForEra(era) {
  showLoadingIndicator();
  
  try {
    const loadedAssets = [];
    
    // Load buildings
    const buildings = await loadCategoryAssets(era, 'buildings');
    loadedAssets.push(...buildings);
    
    // Load vehicles
    const vehicles = await loadCategoryAssets(era, 'vehicles');
    loadedAssets.push(...vehicles);
    
    // Load environment
    const environment = await loadCategoryAssets(era, 'environment');
    loadedAssets.push(...environment);
    
    // Load pedestrians
    const pedestrians = await loadCategoryAssets(era, 'pedestrians');
    loadedAssets.push(...pedestrians);
    
    // Load storefronts
    const storefronts = await loadCategoryAssets(era, 'storefronts');
    loadedAssets.push(...storefronts);
    
    // Load ads
    const ads = await loadCategoryAssets(era, 'ads');
    loadedAssets.push(...ads);
    
    // Track loaded assets for this era
    eraAssets[era] = loadedAssets;
    
    hideLoadingIndicator();
    
    return loadedAssets;
  } catch (error) {
    console.error(`Failed to load assets for era ${era}:`, error);
    hideLoadingIndicator();
    throw error;
  }
}

async function loadCategoryAssets(era, category) {
  const cacheKey = `${era}_${category}`;
  
  if (assetCache[cacheKey]) {
    // Return cached assets (already loaded)
    return assetCache[cacheKey];
  }
  
  const assets = [];
  
  try {
    // Try to load files from the directory
    // This simulates fetching directory listing
    // In a real implementation, this would need to be handled server-side
    const files = await attemptLoadCategoryFiles(era, category);
    
    for (const file of files) {
      if (file.endsWith('.glb') || file.endsWith('.gltf')) {
        try {
          const gltf = await assetLoaders.gltf.loadAsync(file);
          const model = gltf.scene;
          
          // Enable shadows for all meshes in the model
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Add to scene
          scene.add(model);
          assets.push(model);
        } catch (loadError) {
          console.warn(`Failed to load model ${file}:`, loadError);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not load category ${category} for era ${era}:`, error);
  }
  
  assetCache[cacheKey] = assets;
  return assets;
}

// ===== Helper Functions =====
async function attemptLoadCategoryFiles(era, category) {
  const basePath = `/assets/${era}/${category}/`;

  // Optional manifest-based discovery.
  // If you provide /assets/<era>/<category>/manifest.json as an array of filenames,
  // this will use it. Otherwise, it falls back to common file names.
  try {
    const res = await fetch(`${basePath}manifest.json`);
    if (res.ok) {
      const manifest = await res.json();
      if (Array.isArray(manifest)) {
        return manifest
          .filter((f) => typeof f === "string")
          .map((f) => (f.startsWith("http") ? f : `${basePath}${f}`));
      }
    }
  } catch {
    // ignore and fall back
  }

  // Fallback guesses to still "attempt" loading common model files.
  return [
    "scene.glb",
    "scene.gltf",
    "model.glb",
    "model.gltf",
    "building.glb",
    "building.gltf",
    "buildings.glb",
    "buildings.gltf",
  ].map((f) => `${basePath}${f}`);
}

// ===== Era Switching =====
async function switchEra(era) {
  if (currentEra === era) {
    return;
  }
  
  // Dispose of previous era's assets
  if (currentEra) {
    console.log(`Disposing assets for era ${currentEra}`);
    disposeEraAssets(currentEra);
  }
  
  // Load new era's assets
  console.log(`Loading assets for era ${era}`);
  await loadAssetsForEra(era);
  
  currentEra = era;
}

// ===== Initialization =====
function initializeAssetManagement(_scene) {
  scene = _scene;
  
  // Setup loading indicator
  loadingIndicator = document.getElementById('loading-indicator');
  if (!loadingIndicator) {
    // Create loading indicator if it doesn't exist
    const container = document.querySelector('.scene-container');
    if (container) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'loading-indicator';
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading assets...</div>
      `;
      container.appendChild(loadingIndicator);
    }
  }
  
  // Hide initially
  hideLoadingIndicator();
  
  // Setup asset loaders
  setupAssetLoaders();
}

// ===== Exports =====
export {
  switchEra,
  initializeAssetManagement,
  showLoadingIndicator,
  hideLoadingIndicator
};