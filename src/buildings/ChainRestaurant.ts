import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * ChainRestaurant - Represents a 1985-era chain restaurant with drive-through
 * Features: bold branding, canopy, drive-through lane, ATM kiosk
 * Signature fast-food restaurant design of the mid-1980s
 */
export class ChainRestaurant {
  private mesh: THREE.Group;
  private readonly buildingWidth = 30;
  private readonly buildingDepth = 50;
  private readonly buildingHeight = 35;
  private animationTimer = 0;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'chainRestaurant';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createBoldBranding();
    this.createCanopy();
    this.createDriveThrough();
    this.createATMKiosk();
    this.createWindows();
    this.createSignage();

    console.log(`ChainRestaurant created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  update(deltaTime: number): void {
    // Update drive-through animation or signage
    this.animationTimer += deltaTime;
    // Could animate car movements or sign flashing
  }

  private createStructure(): void {
    // Main building footprint
    const concreteColor = new THREE.Color(0xE0E0E0);
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 5, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: concreteColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 2.5;
    this.mesh.add(base);

    // Ground floor area (restaurant interior height)
    const floorHeight = 10;
    const upperWidth = this.buildingWidth - 4;
    const upperDepth = this.buildingDepth - 4;

    for (let floor = 1; floor < 8; floor++) {
      const floorY = 5 + (floor * floorHeight);
      const floorGeometry = new THREE.BoxGeometry(upperWidth, floorHeight, upperDepth);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xF0F0F0,
        roughness: 0.7,
        metalness: 0.1,
      });
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.position.y = floorY;
      this.mesh.add(floorMesh);
    }
  }

  private createBoldBranding(): void {
    // Chain restaurant bold branding/color blocks
    const primaryColor = new THREE.Color(0xE74C3C); // Red - common chain color
    const accentColor = new THREE.Color(0xF1C40F); // Yellow accent
    const whiteColor = new THREE.Color(0xFFFFFF);

    // Branding panels on facade
    const brandingMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
    });

    // Red color block on left side
    const redPanelGeometry = new THREE.BoxGeometry(8, 15, 1);
    const redPanel = new THREE.Mesh(redPanelGeometry, new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.9,
      metalness: 0.1,
    }));
    redPanel.position.x = -7;
    redPanel.position.y = 7.5;
    redPanel.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(redPanel);

    // Yellow accent stripe
    const yellowStripeGeometry = new THREE.BoxGeometry(this.buildingWidth - 16, 1, 1);
    const yellowStripe = new THREE.Mesh(yellowStripeGeometry, new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.9,
      metalness: 0.1,
    }));
    yellowStripe.position.x = 0;
    yellowStripe.position.y = 3;
    yellowStripe.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(yellowStripe);

    // White window bands
    const whiteBandColor = new THREE.Color(0xFFFFFF);
    for (let i = 0; i < 4; i++) {
      const bandHeight = 0.5;
      const bandGeometry = new THREE.BoxGeometry(this.buildingWidth - 16, bandHeight, 1);
      const whiteBand = new THREE.Mesh(bandGeometry, new THREE.MeshStandardMaterial({
        color: whiteBandColor,
        roughness: 0.8,
        metalness: 0.1,
      }));
      whiteBand.position.x = 0;
      whiteBand.position.y = 8 + (i * 3);
      whiteBand.position.z = -(this.buildingDepth / 2) + 1;
      this.mesh.add(whiteBand);
    }
  }

  private createCanopy(): void {
    // Metal canopy over entrance and drive-through
    const canopyColor = new THREE.Color(0x2C3E50);
    const canopyTrimColor = new THREE.Color(0xF1C40F); // Yellow trim
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: canopyColor,
      roughness: 0.6,
      metalness: 0.3,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: canopyTrimColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Main canopy structure over entrance
    const canopyWidth = 20;
    const canopyDepth = 5;
    const canopyHeight = 3;

    // canopy top
    const topGeometry = new THREE.BoxGeometry(canopyWidth, canopyHeight, canopyDepth);
    const top = new THREE.Mesh(topGeometry, canopyMaterial);
    top.position.x = 0;
    top.position.y = 5 + canopyHeight / 2;
    top.position.z = -(this.buildingDepth / 2) + canopyDepth / 2;
    this.mesh.add(top);

    // canopy front face
    const frontGeometry = new THREE.BoxGeometry(canopyWidth, canopyHeight, 0.5);
    const front = new THREE.Mesh(frontGeometry, canopyMaterial);
    front.position.x = 0;
    front.position.y = 5 + canopyHeight / 2;
    front.position.z = -(this.buildingDepth / 2) + canopyDepth + 0.25;
    this.mesh.add(front);

    // canopy side panels
    const sideGeometry = new THREE.BoxGeometry(canopyDepth, canopyHeight, canopyWidth);
    const side1 = new THREE.Mesh(sideGeometry, canopyMaterial);
    side1.position.x = (canopyWidth / 2) - canopyDepth / 2;
    side1.position.y = 5 + canopyHeight / 2;
    side1.position.z = 0;
    this.mesh.add(side1);

    const side2 = new THREE.Mesh(sideGeometry, canopyMaterial);
    side2.position.x = -(canopyWidth / 2) + canopyDepth / 2;
    side2.position.y = 5 + canopyHeight / 2;
    side2.position.z = 0;
    this.mesh.add(side2);

    // Yellow trim along canopy edges
    // Front trim
    const frontTrimGeometry = new THREE.BoxGeometry(canopyWidth, 0.3, 0.3);
    const frontTrim = new THREE.Mesh(frontTrimGeometry, trimMaterial);
    frontTrim.position.x = 0;
    frontTrim.position.y = 5 + canopyHeight + 0.15;
    frontTrim.position.z = -(this.buildingDepth / 2) + canopyDepth / 2;
    this.mesh.add(frontTrim);

    // Side trims
    const sideTrimGeometry = new THREE.BoxGeometry(0.3, canopyHeight, 0.3);
    const sideTrim1 = new THREE.Mesh(sideTrimGeometry, trimMaterial);
    sideTrim1.position.x = (canopyWidth / 2) - 0.3 / 2;
    sideTrim1.position.y = 5 + canopyHeight / 2;
    sideTrim1.position.z = -(this.buildingDepth / 2) + canopyDepth / 2;
    this.mesh.add(sideTrim1);

    const sideTrim2 = new THREE.Mesh(sideTrimGeometry, trimMaterial);
    sideTrim2.position.x = -(canopyWidth / 2) + 0.3 / 2;
    sideTrim2.position.y = 5 + canopyHeight / 2;
    sideTrim2.position.z = -(this.buildingDepth / 2) + canopyDepth / 2;
    this.mesh.add(sideTrim2);
  }

  private createDriveThrough(): void {
    // Drive-through lane configuration
    const laneColor = new THREE.Color(0xFFFFFF);
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: laneColor,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Drive-through lane markings - red paint
    const markingColor = new THREE.Color(0xFF0000);
    const markingMaterial = new THREE.MeshStandardMaterial({
      color: markingColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Order board
    const orderBoardGeometry = new THREE.BoxGeometry(4, 3, 2);
    const orderBoardMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2C3E50),
      roughness: 0.7,
      metalness: 0.3,
    });
    const orderBoard = new THREE.Mesh(orderBoardGeometry, orderBoardMaterial);
    orderBoard.position.x = -8;
    orderBoard.position.y = 4;
    orderBoard.position.z = -(this.buildingDepth / 2) + 5;
    this.mesh.add(orderBoard);

    // Menu board
    const menuBoardGeometry = new THREE.BoxGeometry(4, 3, 2);
    const menuBoard = new THREE.Mesh(orderBoardGeometry, orderBoardMaterial);
    menuBoard.position.x = 8;
    menuBoard.position.y = 4;
    menuBoard.position.z = -(this.buildingDepth / 2) + 5;
    this.mesh.add(menuBoard);

    // Drive-through lane guide lines
    for (let i = 0; i < 6; i++) {
      const lineGeometry = new THREE.BoxGeometry(3, 0.2, 3);
      const line = new THREE.Mesh(lineGeometry, markingMaterial);
      line.position.x = 0;
      line.position.y = 1 + i * 1.5;
      line.position.z = -(this.buildingDepth / 2) + 8 + i * 1.5;
      this.mesh.add(line);
    }

    // Car stacking spaces markers
    const markerColor = new THREE.Color(0xFFFF00);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: markerColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 5; i++) {
      const markerGeometry = new THREE.BoxGeometry(2, 0.3, 2);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.x = -5;
      marker.position.y = 0.5;
      marker.position.z = -(this.buildingDepth / 2) + 6 + i * 2;
      this.mesh.add(marker);
    }
  }

  private createATMKiosk(): void {
    // Integrated ATM kiosk on side of building
    const atm = new ATMKiosk(new THREE.Vector3(-12, 0, 0), '1985');
    const atmMesh = atm.getMesh();
    atmMesh.position.x = -12;
    this.mesh.add(atmMesh);
  }

  private createWindows(): void {
    // Window details
    const windowSize = 3;
    const windowDepth = 0.3;
    const frameColor = new THREE.Color(0x999999);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.4,
      metalness: 0.8,
    });
    const glassColor = new THREE.Color(0x87CEEB);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: glassColor,
      roughness: 0.2,
      metalness: 0.1,
    });

    // Grid of windows on upper floors
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 15; col++) {
        // Skip ground floor storefront area
        if (row < 3 && Math.abs(col - 7) < 5) continue;

        const x = (col * windowSize) - (7.5 * windowSize) + (windowSize / 2);
        const y = (row * windowSize) + (windowSize / 2) + 5; // Above ground floor

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

  private createSignage(): void {
    // Large chain restaurant signage
    const signColor = new THREE.Color(0xFF00FF); // Magenta - 1980s bold color
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Main chain name sign
    const signGeometry = new THREE.BoxGeometry(10, 3, 0.5);
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.x = 0;
    sign.position.y = 20;
    sign.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(sign);

    // Chain name "BURGERS" - simplified panel
    const accentColor = new THREE.Color(0xF1C40F); // Yellow
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Accent border around sign
    const borderGeometry = new THREE.BoxGeometry(10.2, 3.2, 0.3);
    const border = new THREE.Mesh(borderGeometry, accentMaterial);
    border.position.x = 0;
    border.position.y = 20;
    border.position.z = -(this.buildingDepth / 2) + 1.2;
    this.mesh.add(border);

    // Additional magenta accent panels
    const accentPanelGeometry = new THREE.BoxGeometry(3, 2, 0.3);
    const accentPanel1 = new THREE.Mesh(accentPanelGeometry, signMaterial);
    accentPanel1.position.x = -8;
    accentPanel1.position.y = 18;
    accentPanel1.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(accentPanel1);

    const accentPanel2 = new THREE.Mesh(accentPanelGeometry, signMaterial);
    accentPanel2.position.x = 8;
    accentPanel2.position.y = 18;
    accentPanel2.position.z = -(this.buildingDepth / 2) + 1;
    this.mesh.add(accentPanel2);
  }
}