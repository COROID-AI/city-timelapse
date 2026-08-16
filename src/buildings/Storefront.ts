import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * Storefront - Represents a 1985-era steel-and-glass storefront
 * Features: aluminum framing, steel mullions, large glass display,
 * awning, period-appropriate storefront design
 *
 * Signature 1980s commercial aesthetic with bold glass and metal
 */
export class Storefront {
  private mesh: THREE.Group;
  private readonly buildingWidth = 15;
  private readonly buildingDepth = 25;
  private readonly buildingHeight = 35;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'storefront';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createAluminumFraming();
    this.createGlassDisplay();
    this.createAwning();
    this.createSignage();
    this.createWindows();

    console.log(`Storefront created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main building body - slightly textured concrete base
    const concreteColor = new THREE.Color(0xE0E0E0);
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 4, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: concreteColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 2;
    this.mesh.add(base);

    // Upper floor structure
    const floorHeight = 3;
    const upperWidth = this.buildingWidth - 2;
    const upperDepth = this.buildingDepth - 2;

    for (let floor = 1; floor < 12; floor++) {
      const floorY = 4 + (floor * floorHeight);
      const floorGeometry = new THREE.BoxGeometry(upperWidth, floorHeight, upperDepth);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xF5F5F5,
        roughness: 0.7,
        metalness: 0.1,
      });
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.position.y = floorY;
      this.mesh.add(floorMesh);
    }
  }

  private createAluminumFraming(): void {
    // Aluminum framing material
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Vertical mullions (columns) at regular intervals
    const mullionSpacing = 4;
    const mullionWidth = 0.2;

    for (let i = 0; i <= 8; i++) {
      const xPos = (i * mullionSpacing) - (4 * mullionSpacing) + (mullionSpacing / 2);

      // Full-height vertical mullion
      const vertGeometry = new THREE.BoxGeometry(mullionWidth, this.buildingHeight, mullionWidth);
      const verticalMullion = new THREE.Mesh(vertGeometry, aluminumMaterial);
      verticalMullion.position.x = xPos;
      verticalMullion.position.y = this.buildingHeight / 2;
      verticalMullion.position.z = -(this.buildingDepth / 2) + mullionWidth / 2;
      this.mesh.add(verticalMullion);

      // Opposite side
      const verticalMullion2 = new THREE.Mesh(vertGeometry, aluminumMaterial);
      verticalMullion2.position.x = xPos - mullionSpacing + (mullionSpacing / 5);
      verticalMullion2.position.y = this.buildingHeight / 2;
      verticalMullion2.position.z = -(this.buildingDepth / 2) + mullionWidth / 2;
      this.mesh.add(verticalMullion2);
    }

    // Horizontal spandrel bands between floors
    for (let floor = 0; floor < 12; floor++) {
      const yPos = 4 + (floor * 3) + 1.5;

      const horizGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, mullionWidth, mullionWidth);
      const horizSpandrel = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizSpandrel.position.x = 0;
      horizSpandrel.position.y = yPos;
      horizSpandrel.position.z = -(this.buildingDepth / 2) + mullionWidth / 2;
      this.mesh.add(horizSpandrel);

      const horizSpandrel2 = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizSpandrel2.position.x = 0;
      horizSpandrel2.position.y = yPos;
      horizSpandrel2.position.z = (this.buildingDepth / 2) - mullionWidth / 2;
      this.mesh.add(horizSpandrel2);
    }
  }

  private createGlassDisplay(): void {
    // Large glass display windows on ground floor
    const glassColor = new THREE.Color(0x87ceeb);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: glassColor,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    // Ground floor display area (height 8 meters)
    const displayHeight = 8;

    // Main display glass
    const displayGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, displayHeight, 3);
    const displayGlass = new THREE.Mesh(displayGeometry, glassMaterial);
    displayGlass.position.x = 0;
    displayGlass.position.y = displayHeight / 2;
    displayGlass.position.z = -(this.buildingDepth / 2) + 3.5;
    this.mesh.add(displayGlass);

    // Aluminum framing around display
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Top display frame
    const topFrameGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, 0.3, 0.3);
    const topFrame = new THREE.Mesh(topFrameGeometry, aluminumMaterial);
    topFrame.position.x = 0;
    topFrame.position.y = this.buildingHeight - 0.15;
    topFrame.position.z = -(this.buildingDepth / 2) + 3.5;
    this.mesh.add(topFrame);

    // Bottom display frame
    const bottomFrame = new THREE.Mesh(topFrameGeometry, aluminumMaterial);
    bottomFrame.position.x = 0;
    bottomFrame.position.y = 4; // Above base
    bottomFrame.position.z = -(this.buildingDepth / 2) + 3.5;
    this.mesh.add(bottomFrame);

    // Side display frames
    const sideFrameGeometry = new THREE.BoxGeometry(0.3, displayHeight, 0.3);
    const sideFrame = new THREE.Mesh(sideFrameGeometry, aluminumMaterial);
    sideFrame.position.x = (this.buildingWidth / 2) - 0.15;
    sideFrame.position.y = displayHeight / 2;
    sideFrame.position.z = -(this.buildingDepth / 2) + 3.5;
    this.mesh.add(sideFrame);

    const sideFrame2 = new THREE.Mesh(sideFrameGeometry, aluminumMaterial);
    sideFrame2.position.x = -(this.buildingWidth / 2) + 0.15;
    sideFrame2.position.y = displayHeight / 2;
    sideFrame2.position.z = -(this.buildingDepth / 2) + 3.5;
    this.mesh.add(sideFrame2);

    // Divided light panes in the display
    const paneColor = new THREE.Color(0x2a2a2a);
    const paneMaterial = new THREE.MeshStandardMaterial({
      color: paneColor,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Vertical mullions in display
    for (let i = 0; i < 5; i++) {
      const xPos = (i * 3) - 6;
      const paneGeom = new THREE.BoxGeometry(0.3, displayHeight - 1, 0.3);
      const verticalPane = new THREE.Mesh(paneGeom, paneMaterial);
      verticalPane.position.x = xPos;
      verticalPane.position.y = displayHeight / 2;
      verticalPane.position.z = -(this.buildingDepth / 2) + 4;
      this.mesh.add(verticalPane);
    }

    // Horizontal mullions in display
    for (let i = 0; i < 3; i++) {
      const yPos = (i * 2.5) + 2.5;
      const paneGeom = new THREE.BoxGeometry(this.buildingWidth - 6, 0.3, 0.3);
      const horizontalPane = new THREE.Mesh(paneGeom, paneMaterial);
      horizontalPane.position.x = 0;
      horizontalPane.position.y = yPos;
      horizontalPane.position.z = -(this.buildingDepth / 2) + 4;
      this.mesh.add(horizontalPane);
    }
  }

  private createAwning(): void {
    // 1980s-style awning over the storefront awning
    const awningColor = new THREE.Color(0xFF6B6B); // Bold accent color
    const awningMaterial = new THREE.MeshStandardMaterial({
      color: awningColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Awning structure - extends over the sidewalk area
    const awningDepth = 3;
    const awningHeight = 2;
    const awningWidth = this.buildingWidth - 2;

    // Awning top curve (simplified with flat panels)
    const topGeometry = new THREE.BoxGeometry(awningWidth, awningHeight, awningDepth);
    const top = new THREE.Mesh(topGeometry, awningMaterial);
    top.position.x = 0;
    top.position.y = 4 + awningHeight; // Above ground floor
    top.position.z = -(this.buildingDepth / 2) + awningDepth / 2;
    this.mesh.add(top);

    // Awning front face (vertical)
    const frontGeometry = new THREE.BoxGeometry(awningWidth, awningHeight, 0.5);
    const front = new THREE.Mesh(frontGeometry, awningMaterial);
    front.position.x = 0;
    front.position.y = 4 + awningHeight / 2;
    front.position.z = -(this.buildingDepth / 2) + awningDepth + 0.25;
    this.mesh.add(front);

    // Awning side panels
    const sideGeometry = new THREE.BoxGeometry(awningDepth, awningHeight, awningWidth);
    const side1 = new THREE.Mesh(sideGeometry, awningMaterial);
    side1.position.x = (this.buildingWidth / 2) - awningDepth / 2;
    side1.position.y = 4 + awningHeight / 2;
    side1.position.z = 0;
    this.mesh.add(side1);

    const side2 = new THREE.Mesh(sideGeometry, awningMaterial);
    side2.position.x = -(this.buildingWidth / 2) + awningDepth / 2;
    side2.position.y = 4 + awningHeight / 2;
    side2.position.z = 0;
    this.mesh.add(side2);

    // Awning support cables/strings
    const cableColor = new THREE.Color(0x000000);
    const cableMaterial = new THREE.MeshStandardMaterial({
      color: cableColor,
      roughness: 0.8,
      metalness: 0.9,
    });

    // Front cables
    for (let i = 0; i < 4; i++) {
      const cableY = 4 + (i * 2) + 1;
      const cableGeometry = new THREE.CylinderGeometry(0.05, 0.05, awningWidth / 2, 8);
      const cable = new THREE.Mesh(cableGeometry, cableMaterial);
      cable.position.x = 0;
      cable.position.y = cableY;
      cable.position.z = -(this.buildingDepth / 2) + 0.5;
      cable.rotation.x = Math.PI / 2;
      this.mesh.add(cable);
    }
  }

  private createSignage(): void {
    // 1985-style projecting signage
    const signColor = new THREE.Color(0xFF00FF); // Magenta - popular 1980s color
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Projecting sign bracket
    const bracketGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const bracketMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x999999),
      roughness: 0.4,
      metalness: 0.8,
    });

    // Sign bracket projecting from building
    const bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
    bracket.position.x = (this.buildingWidth / 2) - 0.25;
    bracket.position.y = 6;
    bracket.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(bracket);

    // Sign face (magenta panel)
    const signGeometry = new THREE.BoxGeometry(3, 1, 0.2);
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.x = (this.buildingWidth / 2) - 1.5;
    sign.position.y = 6;
    sign.position.z = -(this.buildingDepth / 2) + 1.1;
    this.mesh.add(sign);

    // Sign text "SHOP" - simplified as just the panel
    // In a full implementation, this would have actual text geometry

    // Additional decorative elements
    const accentColor = new THREE.Color(0xF1C40F); // Yellow accent
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Accent trim along sign edges
    const trimGeometry = new THREE.BoxGeometry(3.1, 0.2, 0.1);
    const trim1 = new THREE.Mesh(trimGeometry, accentMaterial);
    trim1.position.x = (this.buildingWidth / 2) - 1.5;
    trim1.position.y = 6.1;
    trim1.position.z = -(this.buildingDepth / 2) + 0.05;
    this.mesh.add(trim1);

    const trim2 = new THREE.Mesh(trimGeometry, accentMaterial);
    trim2.position.x = (this.buildingWidth / 2) - 1.5;
    trim2.position.y = 4.9;
    trim2.position.z = -(this.buildingDepth / 2) + 0.05;
    this.mesh.add(trim2);
  }

  private createWindows(): void {
    // Window details on upper floors
    const windowSize = 3;
    const windowDepth = 0.3;
    const frameColor = new THREE.Color(0x999999);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.4,
      metalness: 0.8,
    });
    const glassColorInner = new THREE.Color(0x87ceeb);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: glassColorInner,
      roughness: 0.2,
      metalness: 0.1,
    });

    // Grid of windows on upper floors (above the ground storefront)
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        // Skip ground floor area
        if (row < 3) continue;

        const x = (col * windowSize) - (5 * windowSize) + (windowSize / 2);
        const y = (row * windowSize) + (windowSize / 2) + 8; // Above ground floor

        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, windowDepth);
        const window = new THREE.Mesh(windowGeometry, glassMaterial);
        window.position.x = x;
        window.position.y = y;
        window.position.z = -(this.buildingDepth / 2) + 1;
        this.mesh.add(window);

        // Window frames
        const frameGeometry = new THREE.BoxGeometry(windowSize + 0.2, windowSize + 0.2, windowDepth / 2);
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.x = x;
        frame.position.y = y;
        frame.position.z = -(this.buildingDepth / 2) + windowDepth / 4;
        this.mesh.add(frame);
      }
    }
  }
}