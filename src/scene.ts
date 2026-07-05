import * as THREE from 'three';
import { EraId } from './eras';
import { getBuildingAssetsForEra } from './assetBuilder/buildings';
import { getVehicleAssetsForEra } from './assetBuilder/vehicles';
import { getPedestrianAssetsForEra } from './assetBuilder/pedestrians';
import { getStreetAssetsForEra, StreetLayout } from './assetBuilder/streets';
import { getTextureAssetsForEra } from './assetBuilder/textures';

/**
 * Scene manager that handles era transitions and asset loading
 */
class SceneManager {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private currentEra: EraId | null = null;
  private currentAssets: {
    buildings: THREE.Object3D[];
    vehicles: THREE.Object3D[];
    pedestrians: THREE.Object3D[];
    streets: THREE.Object3D[];
    textures: THREE.Texture[];
  } | null = null;
  private container: HTMLElement;
  private boundHandleEraChange: (event: Event) => void;
  private boundOnWindowResize: () => void;
  private animationFrameId: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundHandleEraChange = this.handleEraChange.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    
    // Initialize three.js objects to satisfy definite assignment
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.initThreeJS();
    this.setupEventListeners();
    // Load initial era
    this.loadEra('1945');
  }

  private initThreeJS(): void {
    // Set up scene
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Set up camera
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // Set up renderer
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Start animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private setupEventListeners(): void {
    // Listen for era changes from the timeline slider
    window.addEventListener('era-changed', this.boundHandleEraChange);
    
    // Handle window resize
    window.addEventListener('resize', this.boundOnWindowResize);
  }

  private handleEraChange(event: Event): void {
    const customEvent = event as CustomEvent<{ era: EraId }>;
    const newEra = customEvent.detail.era;
    
    if (newEra !== this.currentEra) {
      this.loadEra(newEra);
    }
  }

  private async loadEra(era: EraId): Promise<void> {
    // Dispose of previous era assets
    this.disposeCurrentAssets();

    try {
      // Show loading indicator (in a real app, you'd show a spinner or progress bar)
      console.log(`Loading era ${era}...`);

      // Get asset lists for this era from all builders
      const buildingAssets = getBuildingAssetsForEra(era);
      const vehicleAssets = getVehicleAssetsForEra(era);
      const pedestrianAssets = getPedestrianAssetsForEra(era);
      const streetAssets = getStreetAssetsForEra(era);
      const textureAssets = getTextureAssetsForEra(era);

      // Load all assets in parallel to prevent frame drops
      const [
        buildings,
        vehicles,
        pedestrians,
        streets,
        textures
      ] = await Promise.all([
        this.loadAssets(buildingAssets),
        this.loadAssets(vehicleAssets),
        this.loadAssets(pedestrianAssets),
        this.loadAssets(streetAssets.props), // Street assets return {layout, props}
        this.loadTextures(textureAssets)
      ]);

      // Store current assets
      this.currentAssets = {
        buildings,
        vehicles,
        pedestrians,
        streets,
        textures
      };

      // Add assets to scene
      this.addAssetsToScene(this.currentAssets);
      
      // Apply street layout
      this.applyStreetLayout(streetAssets.layout);

      this.currentEra = era;
      console.log(`Era ${era} loaded successfully`);
    } catch (error) {
      console.error('Failed to load era assets:', error);
      // In a production app, you'd show an error message to the user
    }
  }

  private async loadAssets(paths: string[]): Promise<THREE.Object3D[]> {
    // In a real implementation, this would use actual loaders like GLTFLoader, TextureLoader, etc.
    // For now, we'll create simple placeholder objects to demonstrate the concept
    const promises = paths.map(path => this.createPlaceholderObject(path));
    return Promise.all(promises);
  }

  private async loadTextures(paths: string[]): Promise<THREE.Texture[]> {
    // In a real implementation, this would use THREE.TextureLoader
    const promises = paths.map(path => this.createPlaceholderTexture(path));
    return Promise.all(promises);
  }

  private createPlaceholderObject(name: string): Promise<THREE.Object3D> {
    // Simulate async loading
    return new Promise(resolve => {
      setTimeout(() => {
        // Create a simple placeholder object
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
          color: Math.random() * 0xffffff,
          metalness: Math.random(),
          roughness: Math.random() * 0.5 + 0.5
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        
        // Position randomly in the scene
        mesh.position.set(
          (Math.random() - 0.5) * 20,
          0.5, // Keep things above ground
          (Math.random() - 0.5) * 20
        );
        
        // Random scale
        const scale = 0.5 + Math.random() * 1.5;
        mesh.scale.set(scale, scale, scale);
        
        resolve(mesh);
      }, 50 + Math.random() * 150); // Random delay to simulate loading
    });
  }

  private createPlaceholderTexture(name: string): Promise<THREE.Texture> {
    // Simulate async texture loading
    return new Promise(resolve => {
      setTimeout(() => {
        const texture = new THREE.Texture();
        texture.name = name;
        // In a real implementation, we'd load an actual image
        texture.needsUpdate = true;
        resolve(texture);
      }, 30 + Math.random() * 100);
    });
  }

  private addAssetsToScene(assets: {
    buildings: THREE.Object3D[];
    vehicles: THREE.Object3D[];
    pedestrians: THREE.Object3D[];
    streets: THREE.Object3D[];
    textures: THREE.Texture[];
  }): void {
    const addToScene = (objects: THREE.Object3D[]) => {
      objects.forEach(obj => this.scene.add(obj));
    };

    addToScene(assets.buildings);
    addToScene(assets.vehicles);
    addToScene(assets.pedestrians);
    addToScene(assets.streets);
    // Textures are applied to materials, not added directly to scene
  }

  private applyStreetLayout(layout: StreetLayout): void {
    // In a full implementation, this would create the actual street geometry
    // based on the layout parameters (road width, lanes, sidewalks, etc.)
    // For now, we'll just log it
    console.log('Applying street layout:', layout);
    
    // Create a simple ground plane to represent the street
    const removeExistingGround = this.scene.getObjectByName('ground');
    if (removeExistingGround) {
      this.scene.remove(removeExistingGround);
      // Dispose geometry and material
      if ((removeExistingGround as THREE.Mesh).geometry) {
        ((removeExistingGround as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
      }
      if ((removeExistingGround as THREE.Mesh).material) {
        const material = (removeExistingGround as THREE.Mesh).material;
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose());
        } else {
          material.dispose();
        }
      }
    }

    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0.01; // Slightly above zero to avoid z-fighting
    this.scene.add(ground);
  }

  private disposeCurrentAssets(): void {
    if (!this.currentAssets) return;

    const disposeObject = (obj: THREE.Object3D | THREE.Texture) => {
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
      // Dispose of textures
      if (obj instanceof THREE.Texture) {
        obj.dispose();
      }
      
      // Recursively dispose children (only for Object3D)
      if (obj instanceof THREE.Object3D) {
        obj.traverse((child) => {
          disposeObject(child);
        });
      }
    };

    // Dispose all assets
    if (this.currentAssets.buildings) {
      this.currentAssets.buildings.forEach(obj => {
        this.scene.remove(obj);
        disposeObject(obj);
      });
    }
    
    if (this.currentAssets.vehicles) {
      this.currentAssets.vehicles.forEach(obj => {
        this.scene.remove(obj);
        disposeObject(obj);
      });
    }
    
    if (this.currentAssets.pedestrians) {
      this.currentAssets.pedestrians.forEach(obj => {
        this.scene.remove(obj);
        disposeObject(obj);
      });
    }
    
    if (this.currentAssets.streets) {
      this.currentAssets.streets.forEach(obj => {
        this.scene.remove(obj);
        disposeObject(obj);
      });
    }
    
    if (this.currentAssets.textures) {
      this.currentAssets.textures.forEach(texture => {
        disposeObject(texture);
      });
    }

    this.currentAssets = null;
  }

  private onWindowResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private animate = (_time: number) => {
     void _time;
     this.animationFrameId = requestAnimationFrame(this.animate);
    
    // Simple animation for demonstration
    if (this.currentAssets) {
      // Slowly rotate buildings for visual interest
      this.currentAssets.buildings.forEach(building => {
        building.rotation.y += 0.001;
      });
      
      // Simulate vehicle movement
      this.currentAssets.vehicles.forEach(vehicle => {
        vehicle.position.x += Math.sin(Date.now() * 0.001 + vehicle.position.z) * 0.01;
        vehicle.position.z += Math.cos(Date.now() * 0.001 + vehicle.position.x) * 0.01;
      });
    }
    
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    window.removeEventListener('era-changed', this.boundHandleEraChange);
    window.removeEventListener('resize', this.boundOnWindowResize);
    
    this.disposeCurrentAssets();
    
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    
    this.renderer.dispose();
    cancelAnimationFrame(this.animationFrameId);
  }
}

/**
 * Initialize the 3D scene and return the scene manager
 * @param container The DOM element to contain the Three.js canvas
 * @returns The scene manager instance
 */
export function initScene(container: HTMLElement): SceneManager {
  return new SceneManager(container);
}

// Export types for external use
export type { SceneManager };