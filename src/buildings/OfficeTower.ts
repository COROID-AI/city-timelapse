import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * OfficeTower - Represents a 1985-era office tower with reflective glass
 * Features: reflective glass facade with environment map,
 * aluminum framing, modern HVAC systems, reflective coating
 *
 * The reflective glass uses environment map for reflections, not solid color
 */
export class OfficeTower {
  private mesh: THREE.Group;
  private readonly buildingWidth = 25;
  private readonly buildingDepth = 25;
  private readonly buildingHeight = 80;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'officeTower';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createReflectiveCurtainWall();
    this.createAluminumFraming();
    this.createHVACSystems();

    console.log(`OfficeTower created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Building core footprint
    const coreColor = new THREE.Color(0x1A1A2E);
    const coreGeometry = new THREE.BoxGeometry(8, this.buildingHeight, 8);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: coreColor,
      roughness: 0.3,
      metalness: 0.1,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = this.buildingHeight / 2;
    this.mesh.add(core);

    // Setback floors to create tiered effect
    const setbackAmount = 4;
    for (let floor = 0; floor < 30; floor++) {
      const floorHeight = 2.5;
      const floorY = floor * floorHeight + floorHeight / 2;
      
      // Each floor has a setback every 5 floors
      const setback = (floor % 5 === 0) ? setbackAmount : 0;
      const floorWidth = this.buildingWidth - (setback * 2);
      const floorDepth = this.buildingDepth - (setback * 2);
      
      if (floorWidth > 0 && floorDepth > 0) {
        const floorGeometry = new THREE.BoxGeometry(floorWidth, floorHeight, floorDepth);
        const floorMaterial = new THREE.MeshStandardMaterial({
          color: 0x2C3E50,
          roughness: 0.4,
          metalness: 0.2,
        });
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.position.y = floorY;
        floorMesh.position.x = setback;
        floorMesh.position.z = setback;
        this.mesh.add(floorMesh);
      }
    }
  }

  private createReflectiveCurtainWall(): void {
    // Reflective glass curtain wall with environment map
    const bayWidth = 5;
    const bayDepth = 0.5;
    const floorToCeiling = 2.8;

    // Reflective glass material - uses environment map for reflections
    // In Three.js, this would be set as:
    // material.envMap = environmentMap;
    // material.reflectivity = 0.8;
    // material.refractionRatio = 0.98;
    
    const reflectiveGlassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
      reflectivity: 0.8,
      envMap: null, // Will be set by the scene's environment
    });

    // Aluminum framing material
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Create curtain wall bays from ground to top
    for (let floor = 0; floor < 30; floor++) {
      const floorY = floor * floorToCeiling;

      // Spandrel panels between floors (aluminum)
      const spandrelGeometry = new THREE.BoxGeometry(this.buildingWidth - 2, 0.3, bayDepth);
      const spandrel = new THREE.Mesh(spandrelGeometry, aluminumMaterial);
      spandrel.position.y = floorToCeiling / 2 + floorY;
      spandrel.position.z = -(this.buildingDepth / 2) + bayDepth / 2;
      spandrel.position.x = 1; // Slight inset from edges
      this.mesh.add(spandrel);

      // Glass panels between spandrels (reflective)
      const glassGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, floorToCeiling - 0.4, bayDepth);
      const glass = new THREE.Mesh(glassGeometry, reflectiveGlassMaterial);
      glass.position.y = floorToCeiling / 2 + floorY;
      glass.position.z = -(this.buildingDepth / 2) + bayDepth / 2;
      glass.position.x = 1; // Slight inset from edges
      this.mesh.add(glass);
    }

    // Add vertical aluminum mullions
    for (let col = 0; col <= 10; col++) {
      const x = (col * 5) - (5 * 5) + 2.5;
      
      // Vertical mullion full height
      const vertGeometry = new THREE.BoxGeometry(0.3, this.buildingHeight, 0.3);
      const vertMullion = new THREE.Mesh(vertGeometry, aluminumMaterial);
      vertMullion.position.x = x;
      vertMullion.position.y = this.buildingHeight / 2;
      vertMullion.position.z = -(this.buildingDepth / 2) + 0.2;
      this.mesh.add(vertMullion);
    }

    // Add horizontal spandrel bands
    for (let row = 0; row < 30; row++) {
      const y = (row * 2.8) + 1.4;
      
      const horizGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, 0.3, 0.3);
      const horizSpandrel = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizSpandrel.position.x = 1;
      horizSpandrel.position.y = y;
      horizSpandrel.position.z = -(this.buildingDepth / 2) + 0.2;
      this.mesh.add(horizSpandrel);
    }
  }

  private createAluminumFraming(): void {
    // Additional aluminum details around the building base
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Base aluminum cladding
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 2, this.buildingDepth);
    const baseCladding = new THREE.Mesh(baseGeometry, aluminumMaterial);
    baseCladding.position.y = 1;
    baseCladding.position.z = -(this.buildingDepth / 2) + 2;
    baseCladding.position.x = 0;
    this.mesh.add(baseCladding);

    // Corner aluminum strips
    const cornerHeight = this.buildingHeight;
    const cornerWidth = 0.3;

    // 4 corners
    for (let i = 0; i < 4; i++) {
      const cornerZ = -(this.buildingDepth / 2) + 2;
      const cornerX = (i === 0 || i === 3) ? -(this.buildingWidth / 2) + 2 : (this.buildingWidth / 2) - 2;
      
      // Adjust X for corners
      const actualX = (i % 2 === 0) ? -(this.buildingWidth / 2) + 2 : (this.buildingWidth / 2) - 2;
      
      const cornerGeometry = new THREE.BoxGeometry(cornerWidth, cornerHeight, cornerWidth);
      const corner = new THREE.Mesh(cornerGeometry, aluminumMaterial);
      corner.position.x = actualX;
      corner.position.y = this.buildingHeight / 2;
      corner.position.z = cornerZ;
      this.mesh.add(corner);
    }
  }

  private createHVACSystems(): void {
    // Modern HVAC equipment on roof and visible sections
    const hvacColor = new THREE.Color(0x5D5D5D);
    const hvacMaterial = new THREE.MeshStandardMaterial({
      color: hvacColor,
      roughness: 0.6,
      metalness: 0.7,
    });

    // Roof-mounted HVAC units
    for (let i = 0; i < 6; i++) {
      const xPos = (Math.random() - 0.5) * (this.buildingWidth - 8);
      const zPos = -(this.buildingDepth / 2) + 15 + Math.random() * 10;
      const yPos = this.buildingHeight + 5; // Above roof
      
      const unitWidth = 4 + Math.random() * 3;
      const unitDepth = 4 + Math.random() * 3;
      const unitHeight = 3 + Math.random() * 2;

      const unitGeometry = new THREE.BoxGeometry(unitWidth, unitHeight, unitDepth);
      const unit = new THREE.Mesh(unitGeometry, hvacMaterial);
      unit.position.x = xPos;
      unit.position.y = yPos;
      unit.position.z = zPos;
      this.mesh.add(unit);
    }

    // Visible ductwork on facade sides
    for (let side = 0; side < 2; side++) {
      const sideX = side === 0 ? -(this.buildingWidth / 2) + 2 : (this.buildingWidth / 2) - 2;
      
      for (let i = 0; i < 8; i++) {
        const ductY = 10 + (i * 6);
        const ductGeometry = new THREE.BoxGeometry(1.5, 1.5, 0.3);
        const duct = new THREE.Mesh(ductGeometry, hvacMaterial);
        duct.position.x = sideX;
        duct.position.y = ductY;
        duct.position.z = -(this.buildingDepth / 2) + 5;
        this.mesh.add(duct);
      }
    }
  }
}