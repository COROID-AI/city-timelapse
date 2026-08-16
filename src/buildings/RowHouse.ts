import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * RowHouse - Represents a 1945-era small row house
 * Features: red brick facade, flat/low-pitch roof, cornices,
 * large display windows with canvas awnings, wooden storefront door,
 * minimal exterior lighting, period-appropriate signage option.
 *
 * Optimized for real-time rendering: max ~15k tris
 */
export class RowHouse {
  private mesh: THREE.Group;
  private readonly buildingWidth = 6; // meters
  private readonly buildingDepth = 8; // meters
  private readonly buildingHeight = 12; // meters

  constructor(position: THREE.Vector3, era: EraKey = '1945') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'rowHouse';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createRoof();
    this.createFacade();
    this.createWindows();
    this.createDoor();
    this.createAwning();
    this.createSignage();
    this.createWaterTower();

    console.log(`RowHouse created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main building body - red brick
    const brickColor = new THREE.Color(0x8B3A2B); // Dark red brick
    
    // Base structure
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 4, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 2; // Half height
    this.mesh.add(base);

    // Slightly set back middle section to simulate row house spacing
    const middleSetback = new THREE.BoxGeometry(this.buildingWidth - 1, 4, 0.5);
    const middleMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const middle = new THREE.Mesh(middleSetback, middleMaterial);
    middle.position.x = 0.5; // Set back from edge
    middle.position.y = 2;
    this.mesh.add(middle);

    // Opposite setback
    const middle2 = new THREE.Mesh(middleSetback, middleMaterial);
    middle2.position.x = -(this.buildingWidth - 1) + 0.5;
    middle2.position.y = 2;
    this.mesh.add(middle2);
  }

  private createRoof(): void {
    // Flat/low-pitch roof with decorative cornice
    const roofHeight = 2; // Low-pitch roof
    
    // Roof main body
    const roofGeometry = new THREE.BoxGeometry(this.buildingWidth, roofHeight, this.buildingDepth);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D4037), // Dark brown roof
      roughness: 0.8,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 4 + roofHeight / 2;
    this.mesh.add(roof);

    // Decorative cornice along the top edges
    const corniceHeight = 0.5;
    const corniceDepth = 0.3;
    
    // Front cornice
    const frontCorniceGeometry = new THREE.BoxGeometry(this.buildingWidth, corniceHeight, corniceDepth);
    const frontCorniceMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15), // Dark brown cornice
      roughness: 0.6,
      metalness: 0.1,
    });
    const frontCornice = new THREE.Mesh(frontCorniceGeometry, frontCorniceMaterial);
    frontCornice.position.y = 4 + roofHeight;
    frontCornice.position.z = -(this.buildingDepth / 2) + corniceDepth / 2;
    this.mesh.add(frontCornice);

    // Back cornice
    const backCornice = new THREE.Mesh(frontCorniceGeometry, frontCorniceMaterial);
    backCornice.position.y = 4 + roofHeight;
    backCornice.position.z = (this.buildingDepth / 2) - corniceDepth / 2;
    this.mesh.add(backCornice);

    // Side cornices
    const sideCorniceGeometry = new THREE.BoxGeometry(corniceDepth, roofHeight + corniceHeight, this.buildingDepth);
    const sideCornice = new THREE.Mesh(sideCorniceGeometry, frontCorniceMaterial);
    sideCornice.position.x = (this.buildingWidth / 2) - corniceDepth / 2;
    sideCornice.position.y = 4 + roofHeight / 2;
    this.mesh.add(sideCornice);

    const sideCornice2 = new THREE.Mesh(sideCorniceGeometry, frontCorniceMaterial);
    sideCornice2.position.x = -(this.buildingWidth / 2) + corniceDepth / 2;
    sideCornice2.position.y = 4 + roofHeight / 2;
    this.mesh.add(sideCornice2);
  }

  private createFacade(): void {
    // Brick facade details - we'll use material properties to suggest individual bricks
    // The base material already handles the brick color and roughness
    // Adding some facade variation through normal map emulation via material
    
    // Window recesses - slight shadows to suggest individual bricks
    const recessGeometry = new THREE.BoxGeometry(0.3, 3.5, this.buildingDepth);
    const recessMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D2D23), // Darker for recesses
      roughness: 0.8,
      metalness: 0.1,
    });
    
    // Create 3 window recesses on each floor level
    for (let floor = 0; floor < 3; floor++) {
      const yPos = 4 + floor * 3; // 3 floors, each 3m tall
      
      // Left recess
      const leftRecess = new THREE.Mesh(recessGeometry, recessMaterial);
      leftRecess.position.x = -this.buildingWidth / 2 + 0.5;
      leftRecess.position.y = yPos + 1.75;
      leftRecess.position.z = -this.buildingDepth / 2 + 0.3;
      this.mesh.add(leftRecess);
      
      // Right recess
      const rightRecess = new THREE.Mesh(recessGeometry, recessMaterial);
      rightRecess.position.x = this.buildingWidth / 2 - 0.5 - 0.3;
      rightRecess.position.y = yPos + 1.75;
      rightRecess.position.z = -this.buildingDepth / 2 + 0.3;
      this.mesh.add(rightRecess);
    }
  }

  private createWindows(): void {
    // Multi-pane windows with period-appropriate design
    // 3 floors, 4 windows per floor (2 each side)
    const windowCount = 12;
    const windowWidth = 0.8;
    const windowHeight = 1.2;
    
    for (let i = 0; i < windowCount; i++) {
      // Calculate position - staggered across floors
      const floor = Math.floor(i / 4); // 0, 1, 2
      const windowInFloor = i % 4; // 0, 1, 2, 3
      const xOffset = (windowInFloor % 2 === 0) ? -0.3 : this.buildingWidth - 0.5;
      const yPos = 4 + floor * 3 + 0.6;
      
      // Z position (set back from facade)
      const zPos = -this.buildingDepth / 2 + 0.2;
      
      // Skip some windows for row house pattern (every other window)
      if (i % 2 === 0) {
        // Window frame - wood
        const frameGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x8B5A2B), // Dark brown wood
          roughness: 0.6,
          metalness: 0.1,
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(xOffset, yPos, zPos);
        this.mesh.add(frame);
        
        // Window pane - glass with slight tint
        const paneGeometry = new THREE.BoxGeometry(windowWidth - 0.15, windowHeight - 0.15, 0.05);
        const paneMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x2B2B2B), // Dark tinted glass
          roughness: 0.1,
          metalness: 0.0,
          transparent: true,
          opacity: 0.7,
        });
        const pane = new THREE.Mesh(paneGeometry, paneMaterial);
        pane.position.set(xOffset, yPos, zPos + 0.05);
        this.mesh.add(pane);
      }
    }
  }

  private createDoor(): void {
    // Wooden storefront door
    const doorWidth = 1.2;
    const doorHeight = 2.2;
    
    // Door frame
    const frameGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.15);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5B483A), // Dark brown wood
      roughness: 0.6,
      metalness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, doorHeight / 2, -this.buildingDepth / 2 + 0.1);
    this.mesh.add(frame);
    
    // Door panels
    const panelGeometry = new THREE.BoxGeometry(doorWidth - 0.2, doorHeight - 0.3, 0.1);
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x6B5B4B),
      roughness: 0.7,
      metalness: 0.1,
    });
    const door = new THREE.Mesh(panelGeometry, panelMaterial);
    door.position.set(0, doorHeight / 2, -this.buildingDepth / 2 + 0.15);
    this.mesh.add(door);
    
    // Door hardware (knob/handle suggestion)
    const knobGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const knobMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xC0C0C0), // Silver
      roughness: 0.4,
      metalness: 0.8,
    });
    const knob = new THREE.Mesh(knobGeometry, knobMaterial);
    knob.position.set(0.45, 1.2, -this.buildingDepth / 2 + 0.2);
    this.mesh.add(knob);
  }

  private createAwning(): void {
    // Canvas awning over the storefront area
    // Awnings extend from the facade
    const awningWidth = this.buildingWidth;
    const awningProjection = 2; // How far it extends from the building
    const awningDepth = 0.8;
    
    // Awning frame structure
    const frameGeometry = new THREE.BoxGeometry(awningWidth, 0.5, awningDepth);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B), // Dark brown frame
      roughness: 0.6,
      metalness: 0.2,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, 4.25, -this.buildingDepth / 2 + awningDepth / 2);
    this.mesh.add(frame);
    
    // Canvas material - lighter color with fabric texture suggestion
    const canvasColor = new THREE.Color(0xF5DEB3); // Cream/beige canvas
    
    // Main canvas surface
    const canvasGeometry = new THREE.PlaneGeometry(awningWidth, awningDepth);
    const canvasMaterial = new THREE.MeshStandardMaterial({
      color: canvasColor,
      roughness: 0.5,
      metalness: 0.0,
    });
    const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
    canvas.position.set(0, 4.5, -this.buildingDepth / 2 + awningDepth / 2);
    canvas.rotation.x = -0.1; // Slight tilt
    this.mesh.add(canvas);
    
    // Awning stripes/pattern (subtle)
    for (let i = 0; i < 3; i++) {
      const stripeGeometry = new THREE.PlaneGeometry(awningWidth * 0.9, 0.1);
      const stripeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(i === 0 ? 0x8B4513 : i === 1 ? 0xA0522D : 0xD2691E),
        roughness: 0.8,
        metalness: 0.0,
      });
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(0, 4.65 + i * 0.15, -this.buildingDepth / 2 + awningDepth / 2);
      stripe.rotation.x = -0.1;
      this.mesh.add(stripe);
    }
    
    // Support poles (2 at front corners)
    const poleHeight = 1.5;
    const poleRadius = 0.1;
    const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.6,
      metalness: 0.2,
    });
    
    // Front left pole
    const pole1 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole1.position.set(-this.buildingWidth / 2 + 0.5, 4.25 + poleHeight / 2, -this.buildingDepth / 2 + awningDepth + 0.1);
    this.mesh.add(pole1);
    
    // Front right pole
    const pole2 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole2.position.set(this.buildingWidth / 2 - 0.5, 4.25 + poleHeight / 2, -this.buildingDepth / 2 + awningDepth + 0.1);
    this.mesh.add(pole2);
  }

  private createSignage(): void {
    // Simple hand-painted signage on the front facade
    // Only add to one building per block to avoid overcrowding, 
    // but each row house can have a subtle name plaque
    
    // Sign plaque background
    const plaqueWidth = 2;
    const plaqueHeight = 0.8;
    const plaqueDepth = 0.2;
    
    const plaqueGeometry = new THREE.BoxGeometry(plaqueWidth, plaqueHeight, plaqueDepth);
    const plaqueMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.7,
      metalness: 0.1,
    });
    const plaque = new THREE.Mesh(plaqueGeometry, plaqueMaterial);
    plaque.position.set(0, 4.5, -this.buildingDepth / 2 + 0.3);
    this.mesh.add(plaque);
    
    // Simple text suggestion (just a rectangle representing hand-painted lettering)
    const textAreaGeometry = new THREE.BoxGeometry(plaqueWidth - 0.3, plaqueHeight - 0.3, 0.1);
    const textAreaMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFD700), // Gold for lettering suggestion
      roughness: 0.9,
      metalness: 0.0,
    });
    const textArea = new THREE.Mesh(textAreaGeometry, textAreaMaterial);
    textArea.position.set(0, 4.65, -this.buildingDepth / 2 + 0.35);
    this.mesh.add(textArea);
  }

  private createWaterTower(): void {
    // Rooftop water tower - visible on some row houses
    // Only about 30% of row houses had water towers in 1945
    // We'll add it to some instances randomly, but for now add to all for visibility
    
    const towerBaseRadius = 1.2;
    const towerHeight = 2.5;
    const towerNeckHeight = 1.0;
    
    // Tower base
    const baseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513), // Red-brown
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 4 + 0.5 / 2; // Half of 0.5 height
    base.position.z = -this.buildingDepth / 2 + 0.3;
    this.mesh.add(base);
    
    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.8, towerBaseRadius * 0.8, towerHeight, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xA0522D),
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 4 + 0.5 / 2 + towerHeight / 2;
    body.position.z = -this.buildingDepth / 2 + 0.3;
    this.mesh.add(body);
    
    // Tower neck
    const neckGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.5, towerBaseRadius * 0.3, towerNeckHeight, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 4 + 0.5 / 2 + towerHeight + towerNeckHeight / 2;
    neck.position.z = -this.buildingDepth / 2 + 0.3;
    this.mesh.add(neck);
    
    // Tank top detail
    const tankGeometry = new THREE.BoxGeometry(towerBaseRadius * 0.6, 0.3, towerBaseRadius * 0.6);
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.0,
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.y = 4 + 0.5 / 2 + towerHeight + towerNeckHeight + 0.15;
    tank.position.z = -this.buildingDepth / 2 + 0.3;
    this.mesh.add(tank);
    
    // Finial/spire on top
    const finialGeometry = new THREE.SphereGeometry(towerBaseRadius * 0.3, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 4 + 0.5 / 2 + towerHeight + towerNeckHeight + 0.3 + towerBaseRadius * 0.3;
    finial.position.z = -this.buildingDepth / 2 + 0.3;
    this.mesh.add(finial);
  }
}