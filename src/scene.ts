import * as THREE from 'three';
import { EraId } from './eras.js';
import { getBuildingAssetsForEra } from './assetBuilder/buildings.js';
import { getVehicleAssetsForEra } from './assetBuilder/vehicles.js';
import { getPedestrianAssetsForEra } from './assetBuilder/pedestrians.js';
import { getStreetAssetsForEra, StreetLayout } from './assetBuilder/streets.js';
// Texture import no longer needed for placeholder implementation
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    
    // Set up renderer with proper size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Make canvas fill the container
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0;';

    this.initThreeJS();
    
    // Initialize camera controller AFTER camera position is set
    this.cameraController = new CameraController(this.container, this.camera);
    
    // Reset zoom after CameraController initialization (it may set zoom based on distance)
    // Use a small delay to ensure it runs after any async updates
    setTimeout(() => {
      this.camera.zoom = 1.0;
      this.camera.updateProjectionMatrix();
    }, 0);

    this.setupEventListeners();
    // Load initial era
    this.loadEra('1945');
  }

  private initThreeJS(): void {
    // Bright white background for debugging
    this.scene.background = new THREE.Color(0xffffff);

    // Camera - positioned close to see large cubes
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);

    // Add basic lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    // Create a large, bright colored quad in front of the camera
    // Use a plane geometry that fills most of the view
    const geometry1 = new THREE.PlaneGeometry(40, 40);
    const material1 = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      side: THREE.DoubleSide,
      depthTest: false 
    });
    const plane1 = new THREE.Mesh(geometry1, material1);
    plane1.position.z = 5;
    this.scene.add(plane1);

    const geometry2 = new THREE.PlaneGeometry(30, 30);
    const material2 = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      side: THREE.DoubleSide,
      depthTest: false 
    });
    const plane2 = new THREE.Mesh(geometry2, material2);
    plane2.position.set(-45, 30, 0);
    plane2.rotation.z = Math.PI / 8;
    this.scene.add(plane2);

    const geometry3 = new THREE.PlaneGeometry(25, 25);
    const material3 = new THREE.MeshBasicMaterial({ 
      color: 0x0000ff, 
      side: THREE.DoubleSide,
      depthTest: false 
    });
    const plane3 = new THREE.Mesh(geometry3, material3);
    plane3.position.set(45, -30, 0);
    plane3.rotation.z = -Math.PI / 8;
    this.scene.add(plane3);

    // Immediate render
    this.renderer.render(this.scene, this.camera);

    // Start animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private setupEventListeners(): void {
    window.addEventListener('era-changed', this.boundHandleEraChange);
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
    this.disposeCurrentAssets();

    try {
      console.log(`Loading era ${era}...`);

      const buildingAssets = getBuildingAssetsForEra(era);
      const vehicleAssets = getVehicleAssetsForEra(era);
      const pedestrianAssets = getPedestrianAssetsForEra(era);
      const streetAssets = getStreetAssetsForEra(era);

      const buildings = this.loadAssets(buildingAssets, 'buildings');
      const vehicles = this.loadAssets(vehicleAssets, 'vehicles');
      const pedestrians = this.loadAssets(pedestrianAssets, 'pedestrians');
      const streets = this.loadAssets(streetAssets.props, 'streets');

      this.currentAssets = { buildings, vehicles, pedestrians, streets, textures: [] };

      this.addAssetsToScene(this.currentAssets);
      this.applyStreetLayout(streetAssets.layout);

      this.currentEra = era;
      console.log(`Era ${era} loaded successfully`);
    } catch (error) {
      console.error('Failed to load era assets:', error);
    }
  }

  private loadAssets(paths: string[], category: 'buildings' | 'vehicles' | 'pedestrians' | 'streets'): THREE.Object3D[] {
    return paths.map((path) => this.createPlaceholderObject(path, category));
  }

  private createPlaceholderObject(name: string, category: 'buildings' | 'vehicles' | 'pedestrians' | 'streets'): THREE.Object3D {
    const geometry = new THREE.BoxGeometry(5, 5, 5);
    const colors = {
      buildings: 0xff6600,
      vehicles: 0xe24a4a,
      pedestrians: 0x4ae24a,
      streets: 0x808080,
    };
    const material = new THREE.MeshBasicMaterial({ color: colors[category] });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return mesh;
  }

  private addAssetsToScene(assets: {
    buildings: THREE.Object3D[];
    vehicles: THREE.Object3D[];
    pedestrians: THREE.Object3D[];
    streets: THREE.Object3D[];
    textures: THREE.Texture[];
  }): void {
    // Assets are added for future use but initial scene already has visible objects
    assets.buildings.forEach((obj) => this.scene.add(obj));
    assets.vehicles.forEach((obj) => this.scene.add(obj));
    assets.pedestrians.forEach((obj) => this.scene.add(obj));
    assets.streets.forEach((obj) => this.scene.add(obj));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private applyStreetLayout(_layout: StreetLayout): void {
    // Placeholder for future implementation
  }

  private animate = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    if (this.scene && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
    
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private disposeCurrentAssets(): void {
    if (this.currentAssets) {
      this.currentAssets.buildings.forEach((obj) => {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
      this.currentAssets = null;
    }
  }

  private onWindowResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

export function initScene(container: HTMLElement): void {
  new SceneManager(container);
}