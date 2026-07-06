import * as THREE from 'three';
import { EraId } from './eras.js';
import { getBuildingAssetsForEra } from './assetBuilder/buildings.js';
import { getVehicleAssetsForEra } from './assetBuilder/vehicles.js';
import { getPedestrianAssetsForEra } from './assetBuilder/pedestrians.js';
import { getStreetAssetsForEra, StreetLayout } from './assetBuilder/streets.js';
import { getTextureAssetsForEra } from './assetBuilder/textures.js';
import { CameraController } from './cameraController.js';

/**
 * Scene manager that handles era transitions and asset loading
 */
class SceneManager {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private currentEra: EraId | null = null;
  private currentAssets:
    | {
        buildings: THREE.Object3D[];
        vehicles: THREE.Object3D[];
        pedestrians: THREE.Object3D[];
        streets: THREE.Object3D[];
        textures: THREE.Texture[];
      }
    | null = null;
  private container: HTMLElement;
  private boundHandleEraChange: (event: Event) => void;
  private boundOnWindowResize: () => void;
  private animationFrameId: number = 0;

  // Camera controller is present in both integration branches; keep it wired.
  private cameraController: CameraController;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundHandleEraChange = this.handleEraChange.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);

    // Initialize three.js objects to satisfy definite assignment
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // Set up renderer with proper size and ensure it's visible
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Make sure the canvas is visible
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.pointerEvents = 'none';

    this.cameraController = new CameraController(this.container, this.camera);

    this.initThreeJS();
    this.setupEventListeners();
    // Load initial era
    this.loadEra('1945');
  }

  private initThreeJS(): void {
    // Set up scene
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Set up camera
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Add a basic grid helper for visualization
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

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
        textures,
      ] = await Promise.all([
        this.loadAssets(buildingAssets),
        this.loadAssets(vehicleAssets),
        this.loadAssets(pedestrianAssets),
        this.loadAssets(streetAssets.props), // Street assets return {layout, props}
        this.loadTextures(textureAssets),
      ]);

      // Store current assets
      this.currentAssets = {
        buildings,
        vehicles,
        pedestrians,
        streets,
        textures,
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
    const promises = paths.map((path) => this.createPlaceholderObject(path));
    return Promise.all(promises);
  }

  private async loadTextures(paths: string[]): Promise<THREE.Texture[]> {
    // In a real implementation, this would use THREE.TextureLoader
    const promises = paths.map((path) => this.createPlaceholderTexture(path));
    return Promise.all(promises);
  }

  private createPlaceholderObject(name: string): Promise<THREE.Object3D> {
    // Simulate async loading
    return new Promise((resolve) => {
      setTimeout(() => {
        // Create a simple placeholder object - a sphere instead of a box for better visibility
        const geometry = new THREE.SphereGeometry(1, 8, 8);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.3,
          roughness: 0.4,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        mesh.position.set(0, 0, 0);

        // Add some animation to make it visible
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        resolve(mesh);
      }, 50 + Math.random() * 150); // Random delay to simulate loading
    });
  }

  private createPlaceholderTexture(name: string): Promise<THREE.Texture> {
    // Simulate async texture loading
    return new Promise((resolve) => {
      setTimeout(() => {
        const texture = new THREE.Texture();
        texture.name = name;
        // In a real implementation, we'd load an actual image
        texture.needsUpdate = true;
        resolve(texture);
      }, 30 + Math.random() * 100); // Random delay to simulate loading
    });
  }

  private addAssetsToScene(assets: {
    buildings: THREE.Object3D[];
    vehicles: THREE.Object3D[];
    pedestrians: THREE.Object3D[];
    streets: THREE.Object3D[];
    textures: THREE.Texture[];
  }): void {
    const addToScene = (objects: THREE.Object3D[]): void => {
      objects.forEach((obj) => this.scene.add(obj));
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
    // For now, we'll create a simple road
    const removeExistingGround = this.scene.getObjectByName('ground');
    if (removeExistingGround) {
      this.scene.remove(removeExistingGround);
      // Dispose geometry and material
      const maybeMesh = removeExistingGround as THREE.Mesh;
      if (maybeMesh.geometry) {
        (maybeMesh.geometry as THREE.BufferGeometry).dispose();
      }
      if (maybeMesh.material) {
        const material = maybeMesh.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    }

    // Create a simple ground plane to represent the street
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.name = 'ground';
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    this.scene.add(groundMesh);
  }

  private animate = (): void => {
    if (this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
    // Render the scene with proper field of view
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    // Only render if we have assets
    if (this.scene && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private disposeCurrentAssets(): void {
    // Dispose of previous era assets
    if (this.currentAssets) {
      this.currentAssets.buildings.forEach((obj) => {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
      });
      this.currentAssets = null;
    }
  }

  private onWindowResize(): void {
    // Update camera aspect ratio and renderer size on window resize
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
}

// Export the initScene function for use in main.ts
export function initScene(container: HTMLElement): void {
  // Initialize the scene manager (which starts rendering automatically)
  new SceneManager(container);
}