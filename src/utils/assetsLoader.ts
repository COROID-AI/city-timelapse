/**
 * Assets Loader - GLTF/GLB model loader with progress tracking, caching, and fallback geometry generators
 */

import * as THREE from 'three';

export interface LoadProgress {
  loaded: number;
  total: number;
  currentFile: string;
}

export interface AssetDescriptor {
  path: string;
  type: 'model' | 'texture' | 'audio';
}

// Import GLTFLoader dynamically to avoid type issues
// Using dynamic import for Three.js examples
let GLTFLoaderClass: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader | null = null;

async function getGLTFLoader(): Promise<typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader> {
  if (!GLTFLoaderClass) {
    const module = await import('three/examples/jsm/loaders/GLTFLoader.js');
    GLTFLoaderClass = module.GLTFLoader;
  }
  return GLTFLoaderClass;
}

export class AssetsLoader {
  private cache: Map<string, unknown> = new Map();
  private textureLoader: THREE.TextureLoader;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Load a GLTF/GLB model
   */
  async loadModel(path: string, onProgress?: (progress: number) => void): Promise<THREE.Group> {
    if (this.cache.has(path)) {
      return this.cache.get(path) as THREE.Group;
    }

    try {
      const GLTFLoader = await getGLTFLoader();
      const loader = new GLTFLoader();
      
      return new Promise((resolve) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = true;
                (child as THREE.Mesh).receiveShadow = true;
              }
            });
            this.cache.set(path, model);
            resolve(model);
          },
          (xhr) => {
            if (onProgress) {
              onProgress(xhr.loaded / xhr.total);
            }
          },
          (error) => {
            console.warn(`Failed to load model ${path}, using fallback`, error);
            resolve(this.createFallbackGeometry());
          }
        );
      });
    } catch (e) {
      console.warn(`GLTFLoader not available for ${path}, using fallback`);
      return this.createFallbackGeometry();
    }
  }

  /**
   * Load a texture
   */
  async loadTexture(path: string): Promise<THREE.Texture> {
    if (this.cache.has(path)) {
      return this.cache.get(path) as THREE.Texture;
    }

    return new Promise((resolve) => {
      this.textureLoader.load(
        path,
        (texture) => {
          this.cache.set(path, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load texture ${path}, using fallback`, error);
          resolve(this.createFallbackTexture());
        }
      );
    });
  }

  /**
   * Create fallback geometry for missing models
   */
  private createFallbackGeometry(): THREE.Group {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);
    
    const group = new THREE.Group();
    group.add(mesh);
    
    return group;
  }

  /**
   * Create fallback texture for missing textures
   */
  private createFallbackTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }

  /**
   * Clear cache and dispose of resources
   */
  dispose(): void {
    this.cache.forEach((asset) => {
      if (asset instanceof THREE.Group) {
        asset.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).geometry.dispose();
          }
        });
      } else if (asset instanceof THREE.Texture) {
        asset.dispose();
      }
    });
    this.cache.clear();
  }
}