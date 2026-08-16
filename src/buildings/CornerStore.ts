import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * CornerStore - Represents a 1945-era corner grocery/store
 * Features: red brick facade, flat roof with cornice, large display windows
 * with canvas awnings, wooden storefront door, gas-lamp style signage,
 * hand-painted lettering, coal delivery chute, period-appropriate signage.
 *
 * Optimized for real-time rendering: max ~20k tris
 */
export class CornerStore {
  private mesh: THREE.Group;
  private readonly buildingWidth = 8; // meters - wider storefront
  private readonly buildingDepth = 10; // meters
  private readonly buildingHeight = 14; // meters

  constructor(position: THREE.Vector3, era: EraKey = '1945') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'cornerStore';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createRoof();
    this.createFacadeDetails();
    this.createWindows();
    this.createDoor();
    this.createAwning();
    this.createSignage(); // Hand-painted signage is key for corner store
    this.createCoalChute();
    this.createWaterTower();

    console.log(`CornerStore created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main store body - red brick with slightly different tone for variety
    const brickColor = new THREE.Color(0x8B3A2B); // Dark red brick
    
    // Base structure - wider than row house
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 4, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 2;
    this.mesh.add(base);
    
    // Set back middle section for entrance area
    const entranceSetbackGeometry = new THREE.BoxGeometry(this.buildingWidth - 2, 3, 1);
    const entranceSetbackMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const entranceSetback = new THREE.Mesh(entranceSetbackGeometry, entranceSetbackMaterial);
    entranceSetback.position.x = 1; // Set back from edge
    entranceSetback.position.y = 1.5;
    this.mesh.add(entranceSetback);
    
    const entranceSetback2 = new THREE.Mesh(entranceSetbackGeometry, entranceSetbackMaterial);
    entranceSetback2.position.x = -(this.buildingWidth - 2) + 1;
    entranceSetback2.position.y = 1.5;
    this.mesh.add(entranceSetback2);
  }

  private createRoof(): void {
    // Flat roof with decorative cornice
    const roofHeight = 2;
    
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

    // Decorative cornice
    const corniceHeight = 0.5;
    const corniceDepth = 0.3;
    const corniceColor = new THREE.Color(0x2F1A15);
    
    // Front cornice
    const frontCorniceGeometry = new THREE.BoxGeometry(this.buildingWidth, corniceHeight, corniceDepth);
    const frontCorniceMaterial = new THREE.MeshStandardMaterial({
      color: corniceColor,
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

  private createFacadeDetails(): void {
    // Brick facade variation - add some decorative elements
    
    // Decorative brick pattern around windows
    for (let i = 0; i < 4; i++) {
      const xPos = -(this.buildingWidth / 2) + 0.5 + i * 1.5;
      const yPos = 4 + 2 + 0.5; // Second floor level
      
      // Decorative brick panel
      const panelGeometry = new THREE.BoxGeometry(1.2, 1.5, 0.3);
      const panelMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B3A2B),
        roughness: 0.7,
        metalness: 0.2,
      });
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.position.set(xPos, yPos, -this.buildingDepth / 2 + 0.3);
      this.mesh.add(panel);
    }
    
    // Corner quoins (decorative brick corners)
    const quoinSize = 0.8;
    const quoins = [
      { x: -this.buildingWidth / 2 + quoinSize, z: -this.buildingDepth / 2 + quoinSize },
      { x: this.buildingWidth / 2 - quoinSize, z: -this.buildingDepth / 2 + quoinSize },
      { x: -this.buildingWidth / 2 + quoinSize, z: this.buildingDepth / 2 - quoinSize },
      { x: this.buildingWidth / 2 - quoinSize, z: this.buildingDepth / 2 - quoinSize },
    ];
    
    for (const quoin of quoins) {
      const quoinGeometry = new THREE.BoxGeometry(quoinSize, 5, quoinSize);
      const quoinMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B3A2B),
        roughness: 0.8,
        metalness: 0.1,
      });
      const quoinMesh = new THREE.Mesh(quoinGeometry, quoinMaterial);
      quoinMesh.position.set(quoin.x, 2.5, quoin.z);
      this.mesh.add(quoinMesh);
    }
  }

  private createWindows(): void {
    // Large display windows with multi-pane design
    // Storefront level + 2 upper floors
    const windowConfigs = [
      // Storefront display windows (2 large ones)
      { width: 2.2, height: 1.8, x: -this.buildingWidth / 2 + 0.5, y: 2.5, isDisplay: true },
      { width: 2.2, height: 1.8, x: this.buildingWidth / 2 - 2.7, y: 2.5, isDisplay: true },
      // Upper floor windows (3 per floor, 2 floors)
      { width: 0.9, height: 1.2, x: -this.buildingWidth / 2 + 0.5, y: 6.5, isDisplay: false },
      { width: 0.9, height: 1.2, x: 0, y: 6.5, isDisplay: false },
      { width: 0.9, height: 1.2, x: this.buildingWidth / 2 - 1.4, y: 6.5, isDisplay: false },
      { width: 0.9, height: 1.2, x: -this.buildingWidth / 2 + 0.5, y: 9.7, isDisplay: false },
      { width: 0.9, height: 1.2, x: 0, y: 9.7, isDisplay: false },
      { width: 0.9, height: 1.2, x: this.buildingWidth / 2 - 1.4, y: 9.7, isDisplay: false },
    ];
    
    for (const config of windowConfigs) {
      const windowWidth = config.width;
      const windowHeight = config.height;
      
      // Window frame - wood
      const frameGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, 0.15);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B5A2B), // Dark brown wood
        roughness: 0.6,
        metalness: 0.1,
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.set(config.x, config.y, -this.buildingDepth / 2 + 0.2);
      this.mesh.add(frame);
      
      // Window pane
      const paneColor = config.isDisplay ? new THREE.Color(0x2B2B2B) : new THREE.Color(0x4A4A4A);
      const paneGeometry = new THREE.BoxGeometry(windowWidth - 0.2, windowHeight - 0.2, 0.08);
      const paneMaterial = new THREE.MeshStandardMaterial({
        color: paneColor,
        roughness: 0.1,
        metalness: 0.0,
        transparent: true,
        opacity: 0.8,
      });
      const pane = new THREE.Mesh(paneGeometry, paneMaterial);
      pane.position.set(config.x, config.y, -this.buildingDepth / 2 + 0.25);
      this.mesh.add(pane);
    }
  }

  private createDoor(): void {
    // Wooden storefront door with transom
    const doorWidth = 1.5;
    const doorHeight = 2.5;
    
    // Door frame
    const frameGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.2);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5B483A),
      roughness: 0.6,
      metalness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, doorHeight / 2, -this.buildingDepth / 2 + 0.15);
    this.mesh.add(frame);
    
    // Door panels with vertical grain
    const panelCount = 3;
    const panelWidth = (doorWidth - 0.3) / panelCount;
    
    for (let i = 0; i < panelCount; i++) {
      const panelGeometry = new THREE.BoxGeometry(panelWidth - 0.05, doorHeight - 0.3, 0.1);
      const panelMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x6B5B4B),
        roughness: 0.7,
        metalness: 0.1,
      });
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.position.set(-doorWidth / 2 + 0.15 + i * (panelWidth + 0.05), doorHeight / 2, -this.buildingDepth / 2 + 0.17);
      this.mesh.add(panel);
    }
    
    // Transom window above door
    const transomGeometry = new THREE.BoxGeometry(doorWidth * 0.8, 0.8, 0.08);
    const transomMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x4A4A4A),
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.7,
    });
    const transom = new THREE.Mesh(transomGeometry, transomMaterial);
    transom.position.set(0, doorHeight + 0.1, -this.buildingDepth / 2 + 0.2);
    this.mesh.add(transom);
    
    // Door hardware
    const knobGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const knobMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xC0C0C0),
      roughness: 0.4,
      metalness: 0.8,
    });
    const knob = new THREE.Mesh(knobGeometry, knobMaterial);
    knob.position.set(0.8, 1.4, -this.buildingDepth / 2 + 0.2);
    this.mesh.add(knob);
  }

  private createAwning(): void {
    // Large canvas awning over the storefront
    const awningWidth = this.buildingWidth * 0.8;
    const awningProjection = 2.5;
    const awningDepth = 1.0;
    
    // Awning frame
    const frameGeometry = new THREE.BoxGeometry(awningWidth, 0.6, awningDepth);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.6,
      metalness: 0.2,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, 4.5, -this.buildingDepth / 2 + awningDepth / 2);
    this.mesh.add(frame);
    
    // Canvas - cream/beige color
    const canvasColor = new THREE.Color(0xF5DEB3);
    const canvasGeometry = new THREE.PlaneGeometry(awningWidth, awningDepth);
    const canvasMaterial = new THREE.MeshStandardMaterial({
      color: canvasColor,
      roughness: 0.5,
      metalness: 0.0,
    });
    const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
    canvas.position.set(0, 4.75, -this.buildingDepth / 2 + awningDepth / 2);
    canvas.rotation.x = -0.15;
    this.mesh.add(canvas);
    
    // Awning stripes
    for (let i = 0; i < 4; i++) {
      const stripeGeometry = new THREE.PlaneGeometry(awningWidth * 0.85, 0.12);
      const stripeColor = new THREE.Color(i === 0 ? 0x8B4513 : i === 1 ? 0xA0522D : i === 2 ? 0xD2691E : 0xC04000);
      const stripeMaterial = new THREE.MeshStandardMaterial({
        color: stripeColor,
        roughness: 0.8,
        metalness: 0.0,
      });
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(0, 4.85 + i * 0.18, -this.buildingDepth / 2 + awningDepth / 2);
      stripe.rotation.x = -0.15;
      this.mesh.add(stripe);
    }
    
    // Support poles (3 poles)
    const poleHeight = 2;
    const poleRadius = 0.12;
    const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 12);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.6,
      metalness: 0.2,
    });
    
    // Front left pole
    const pole1 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole1.position.set(-this.buildingWidth / 2 + 0.8, 4.5 + poleHeight / 2, -this.buildingDepth / 2 + awningDepth + 0.15);
    this.mesh.add(pole1);
    
    // Front right pole
    const pole2 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole2.position.set(this.buildingWidth / 2 - 0.8, 4.5 + poleHeight / 2, -this.buildingDepth / 2 + awningDepth + 0.15);
    this.mesh.add(pole2);
    
    // Middle pole
    const pole3 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole3.position.set(0, 4.5 + poleHeight / 2, -this.buildingDepth / 2 + awningDepth + 0.15);
    this.mesh.add(pole3);
  }

  private createSignage(): void {
    // Hand-painted style signage - this is the corner store's identity
    // Gas-lamp style illuminated signage
    
    // Sign board background
    const signWidth = 3;
    const signHeight = 1.5;
    const signDepth = 0.3;
    
    const signGeometry = new THREE.BoxGeometry(signWidth, signHeight, signDepth);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.1,
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 5.2, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(sign);
    
    // Hand-painted lettering area (gold suggestion)
    const letteringWidth = signWidth - 0.4;
    const letteringHeight = signHeight - 0.4;
    const letteringGeometry = new THREE.BoxGeometry(letteringWidth, letteringHeight, 0.2);
    const letteringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFD700),
      roughness: 0.9,
      metalness: 0.0,
    });
    const lettering = new THREE.Mesh(letteringGeometry, letteringMaterial);
    lettering.position.set(0, 5.35, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(lettering);
    
    // Gas pipe detail for illumination
    const pipeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.3,
    });
    
    // Gas pipe along bottom of sign
    const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe1.position.set(-signWidth / 2 + 0.1, 5.0, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe1);
    
    const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe2.position.set(signWidth / 2 - 0.1, 5.0, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe2);
  }

  private createCoalChute(): void {
    // Coal delivery chute on the side facade
    const chuteWidth = 0.5;
    const chuteHeight = 3;
    const chuteDepth = 0.4;
    
    const chuteGeometry = new THREE.BoxGeometry(chuteWidth, chuteHeight, chuteDepth);
    const chuteMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.2,
    });
    const chute = new THREE.Mesh(chuteGeometry, chuteMaterial);
    // Position on side of building, near the entrance
    chute.position.set(this.buildingWidth / 2 - 0.7, chuteHeight / 2, 0);
    this.mesh.add(chute);
    
    // Coal bucket near the chute
    const bucketGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const bucketMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x3D3D3D),
      roughness: 0.7,
      metalness: 0.1,
    });
    const bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
    bucket.position.set(this.buildingWidth / 2 - 0.7, 0.25, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(bucket);
  }

  private createWaterTower(): void {
    // Rooftop water tower
    const towerBaseRadius = 1.5;
    const towerHeight = 3;
    const towerNeckHeight = 1.2;
    
    // Tower base
    const baseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, 0.8, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 4 + 0.8 / 2;
    base.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(base);
    
    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.85, towerBaseRadius * 0.85, towerHeight, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xA0522D),
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 4 + 0.8 / 2 + towerHeight / 2;
    body.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(body);
    
    // Tower neck
    const neckGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.6, towerBaseRadius * 0.35, towerNeckHeight, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 4 + 0.8 / 2 + towerHeight + towerNeckHeight / 2;
    neck.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(neck);
    
    // Tank top
    const tankGeometry = new THREE.BoxGeometry(towerBaseRadius * 0.55, 0.4, towerBaseRadius * 0.55);
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.0,
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.y = 4 + 0.8 / 2 + towerHeight + towerNeckHeight + 0.2;
    tank.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(tank);
    
    // Finial
    const finialGeometry = new THREE.SphereGeometry(towerBaseRadius * 0.35, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 4 + 0.8 / 2 + towerHeight + towerNeckHeight + 0.2 + towerBaseRadius * 0.35;
    finial.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(finial);
  }
}