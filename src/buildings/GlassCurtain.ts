import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * GlassCurtain - Represents a 1985-era glass curtain wall building
 * Features: extensive glass curtain wall facades, aluminum framing,
 * reflective coating with environment map, spandrel panels
 *
 * Optimized for real-time rendering with environment map reflections
 */
export class GlassCurtain {
  private mesh: THREE.Group;
  private readonly buildingWidth = 12;
  private readonly buildingDepth = 30;
  private readonly buildingHeight = 60;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'glassCurtain';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createCurtainWall();
    this.createWindows();
    this.createAluminumFraming();
    this.createEnvironmentMap();

    console.log(`GlassCurtain created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Building base footprint
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, this.buildingHeight, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.1,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = this.buildingHeight / 2;
    this.mesh.add(base);
  }

  private createCurtainWall(): void {
    // Glass curtain wall with aluminum framing
    const bayWidth = 4;
    const bayDepth = 0.5;
    const floorToCeiling = 3;

    // Aluminum framing material with slight metallic look
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Glass material with environment map will be applied later
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
    });

    // Create bays of curtain wall from ground up
    for (let floor = 0; floor < 20; floor++) {
      const floorY = floor * floorToCeiling;

      // Spandrel panels between floors (metal)
      const spandrelGeometry = new THREE.BoxGeometry(this.buildingWidth, 0.5, bayDepth);
      const spandrel = new THREE.Mesh(spandrelGeometry, aluminumMaterial);
      spandrel.position.y = floorToCeiling / 2 + floorY;
      spandrel.position.z = -(this.buildingDepth / 2) + bayDepth / 2;
      this.mesh.add(spandrel);

      // Glass panels between spandrels
      const glassGeometry = new THREE.BoxGeometry(this.buildingWidth - 1, floorToCeiling - 1, bayDepth);
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.position.y = floorToCeiling / 2 + floorY;
      glass.position.z = -(this.buildingDepth / 2) + bayDepth / 2;
      this.mesh.add(glass);
    }
  }

  private createWindows(): void {
    // Window details - slightly recessed appearance
    const windowSize = 3.5;
    const windowDepth = 0.2;
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Create grid of windows
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 10; col++) {
        const x = (col * windowSize) - (5 * windowSize) + (windowSize / 2);
        const y = (row * windowSize) + (windowSize / 2);
        const z = -0.5; // Slightly in from facade

        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, windowDepth);
        const windowMaterial = new THREE.MeshStandardMaterial({
          color: 0x87ceeb,
          roughness: 0.2,
          metalness: 0.1,
        });

        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.x = x;
        window.position.y = y;
        window.position.z = z;
        this.mesh.add(window);
      }
    }
  }

  private createAluminumFraming(): void {
    // Vertical aluminum mullions
    const mullionWidth = 0.2;
    const floorToCeiling = 3;
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.4,
      metalness: 0.8,
    });

    for (let col = 0; col <= 10; col++) {
      const x = (col * 4) - (5 * 4) + 2;
      
      // Vertical mullion
      const vertGeometry = new THREE.BoxGeometry(mullionWidth, this.buildingHeight, mullionWidth);
      const vertMullion = new THREE.Mesh(vertGeometry, aluminumMaterial);
      vertMullion.position.x = x;
      vertMullion.position.y = this.buildingHeight / 2;
      vertMullion.position.z = -(this.buildingDepth / 2) + 0.1;
      this.mesh.add(vertMullion);
      
      // Opposite vertical mullion
      const vertMullion2 = new THREE.Mesh(vertGeometry, aluminumMaterial);
      vertMullion2.position.x = x - 4 + (4 / 5);
      vertMullion2.position.y = this.buildingHeight / 2;
      vertMullion2.position.z = -(this.buildingDepth / 2) + 0.1;
      this.mesh.add(vertMullion2);
    }

    // Horizontal aluminum spandrels
    for (let row = 0; row < 20; row++) {
      const y = (row * 3) + 1.5;
      
      const horizGeometry = new THREE.BoxGeometry(this.buildingWidth - 2, mullionWidth, mullionWidth);
      const horizMullion = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizMullion.position.x = 0;
      horizMullion.position.y = y;
      horizMullion.position.z = -(this.buildingDepth / 2) + 0.1;
      this.mesh.add(horizMullion);
      
      const horizMullion2 = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizMullion2.position.x = 0;
      horizMullion2.position.y = y;
      horizMullion2.position.z = (this.buildingDepth / 2) - 0.1;
      this.mesh.add(horizMullion2);
    }
  }

  private createEnvironmentMap(): void {
    // This building uses environment map reflections
    // The glass material will reference an environment map for reflections
    // In the Three.js setup, this would be set via:
    // material.envMap = environmentMap;
    // material.refractionRatio = 0.98;
    // material.reflectivity = 0.8;
    
    // For now, create a subtle reflective effect using a light blue tint
    // and higher metalness to simulate reflective glass
    const materials = this.mesh.children;
    for (let i = 0; i < materials.length; i++) {
      if (materials[i] instanceof THREE.Mesh) {
        // Apply reflective properties to glass-like meshes
        if (materials[i].material && materials[i].material.color && 
            materials[i].material.color.getHex() === 0x87ceeb) {
          materials[i].material.metalness = 0.3;
          materials[i].material.roughness = 0.1;
          materials[i].material.reflectivity = 0.5;
        }
      }
    }
  }
}