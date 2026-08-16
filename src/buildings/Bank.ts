import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * Bank - Represents a 1945-era bank/building with classical columns
 * Features: classical columns, stone facade, tall windows, ornate cornice,
 * period-appropriate signage, gas-lamp style street lighting, minimal exterior lighting.
 *
 * Optimized for real-time rendering: max ~25k tris
 */
export class Bank {
  private mesh: THREE.Group;
  private readonly buildingWidth = 12; // meters - prominent building
  private readonly buildingDepth = 15; // meters
  private readonly buildingHeight = 20; // meters - taller bank building

  constructor(position: THREE.Vector3, era: EraKey = '1945') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'bank';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createClassicalColumns();
    this.createRoof();
    this.createFacade();
    this.createWindows();
    this.createDoor();
    this.createSignage();
    this.createWaterTower();

    console.log(`Bank created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main bank body - stone/brick base with different material
    const baseColor = new THREE.Color(0x5A4A3A); // Stone/brick base

    // Base story - 4 floors
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 8, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 4;
    this.mesh.add(base);

    // Additional base accent
    const accentGeometry = new THREE.BoxGeometry(this.buildingWidth, 2, this.buildingDepth);
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x7A5A4A),
      roughness: 0.7,
      metalness: 0.1,
    });
    const accent = new THREE.Mesh(accentGeometry, accentMaterial);
    accent.position.y = 8 + 1;
    this.mesh.add(accent);
  }

  private createClassicalColumns(): void {
    // Classical columns at the front entrance - 4 columns
    const columnHeight = 8;
    const columnRadius = 0.6;
    const columnGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 16);
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFFFFF), // White marble/stone
      roughness: 0.8,
      metalness: 0.2,
    });

    // Column bases
    const baseHeight = 1;
    const baseGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius * 1.5, baseHeight, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.7,
      metalness: 0.1,
    });

    // Column positions - symmetrical across front
    const columnPositions = [
      { x: -2.5, z: -this.buildingDepth / 2 + columnHeight / 2 + baseHeight },
      { x: 0, z: -this.buildingDepth / 2 + columnHeight / 2 + baseHeight },
      { x: 2.5, z: -this.buildingDepth / 2 + columnHeight / 2 + baseHeight },
      { x: -2.5, z: this.buildingDepth / 2 - baseHeight },
      { x: 0, z: this.buildingDepth / 2 - baseHeight },
      { x: 2.5, z: this.buildingDepth / 2 - baseHeight },
    ];

    for (const pos of columnPositions) {
      // Column base
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.set(pos.x, baseHeight / 2, pos.z);
      this.mesh.add(base);

      // Column shaft
      const column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(pos.x, baseHeight + columnHeight / 2, pos.z);
      this.mesh.add(column);
    }

    // Column capitals (decorative tops)
    const capitalHeight = 1;
    const capitalGeometry = new THREE.BoxGeometry(columnRadius * 2.5, capitalHeight, columnRadius * 2.5);
    const capitalMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFFFFF),
      roughness: 0.7,
      metalness: 0.1,
    });

    for (const pos of columnPositions.slice(0, 3)) { // Only front columns have capitals
      const capital = new THREE.Mesh(capitalGeometry, capitalMaterial);
      capital.position.set(pos.x, baseHeight + columnHeight + capitalHeight / 2, pos.z);
      this.mesh.add(capital);
    }
  }

  private createRoof(): void {
    // Classically inspired low-pitch roof with parapet
    const parapetHeight = 2;

    // Main roof structure - simplified low-pitch representation
    const roofWidth = this.buildingWidth;
    const roofDepth = this.buildingDepth;
    const roofHeight = 3;

    const roofGeometry = new THREE.BoxGeometry(roofWidth, roofHeight, roofDepth);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D4037),
      roughness: 0.8,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 8 + 4 + roofHeight / 2; // 8 (base) + 4 (upper) + roof
    roof.position.z = -(this.buildingDepth / 2) + roofDepth / 2; // Flat roof approximation
    this.mesh.add(roof);

    // Parapet wall around the roof edge
    const parapetThickness = 0.5;

    // Front parapet
    const frontParapetGeometry = new THREE.BoxGeometry(roofWidth, parapetHeight, parapetThickness);
    const parapetMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.8,
      metalness: 0.1,
    });
    const frontParapet = new THREE.Mesh(frontParapetGeometry, parapetMaterial);
    frontParapet.position.y = 8 + 4 + roofHeight + parapetHeight / 2;
    frontParapet.position.z = -(this.buildingDepth / 2) + parapetThickness / 2;
    this.mesh.add(frontParapet);

    // Back parapet
    const backParapet = new THREE.Mesh(frontParapetGeometry, parapetMaterial);
    backParapet.position.y = 8 + 4 + roofHeight + parapetHeight / 2;
    backParapet.position.z = (this.buildingDepth / 2) - parapetThickness / 2;
    this.mesh.add(backParapet);

    // Side parapets
    const sideParapetDepth = this.buildingDepth - parapetThickness * 2;
    const sideParapetGeometry = new THREE.BoxGeometry(parapetThickness, parapetHeight, sideParapetDepth);
    const sideParapetLeft = new THREE.Mesh(sideParapetGeometry, parapetMaterial);
    sideParapetLeft.position.x = -(roofWidth / 2) + parapetThickness / 2;
    sideParapetLeft.position.y = 8 + 4 + roofHeight + parapetHeight / 2;
    sideParapetLeft.position.z = 0;
    this.mesh.add(sideParapetLeft);

    const sideParapetRight = new THREE.Mesh(sideParapetGeometry, parapetMaterial);
    sideParapetRight.position.x = (roofWidth / 2) - parapetThickness / 2;
    sideParapetRight.position.y = 8 + 4 + roofHeight + parapetHeight / 2;
    sideParapetRight.position.z = 0;
    this.mesh.add(sideParapetRight);
  }

  private createFacade(): void {
    // Decorative facade details for the bank

    // Rusticated stone corners
    const quoinSize = 1.2;
    const quoins = [
      { x: -this.buildingWidth / 2 + quoinSize, z: -this.buildingDepth / 2 + quoinSize },
      { x: this.buildingWidth / 2 - quoinSize, z: -this.buildingDepth / 2 + quoinSize },
      { x: -this.buildingWidth / 2 + quoinSize, z: this.buildingDepth / 2 - quoinSize },
      { x: this.buildingWidth / 2 - quoinSize, z: this.buildingDepth / 2 - quoinSize },
    ];

    for (const quoin of quoins) {
      const quoinGeometry = new THREE.BoxGeometry(quoinSize, 10, quoinSize);
      const quoinMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x5A4A3A),
        roughness: 0.8,
        metalness: 0.1,
      });
      const quoinMesh = new THREE.Mesh(quoinGeometry, quoinMaterial);
      quoinMesh.position.set(quoin.x, 5, quoin.z);
      this.mesh.add(quoinMesh);
    }

    // Window surround details - alternating between ground and upper floors
    for (let floor = 0; floor < 4; floor++) {
      const yBase = 8 + floor * 3; // Each floor is 3m

      // Window frame surrounds
      const surroundWidth = 1.5;
      const surroundHeight = 2.5;

      // Three window pairs per floor
      const windowPairs = [
        { x: -3, y: yBase + 1.25 },
        { x: 0, y: yBase + 1.25 },
        { x: 3, y: yBase + 1.25 },
      ];

      for (const pair of windowPairs) {
        // Window surround frame
        const surroundGeometry = new THREE.BoxGeometry(surroundWidth, surroundHeight, 0.3);
        const surroundMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x8B5A2B),
          roughness: 0.7,
          metalness: 0.1,
        });
        const surround = new THREE.Mesh(surroundGeometry, surroundMaterial);
        surround.position.set(pair.x, pair.y, -this.buildingDepth / 2 + 0.4);
        this.mesh.add(surround);
      }
    }
  }

  private createWindows(): void {
    // Tall multi-pane windows - bank style
    // 4 floors, 3 window pairs per floor
    const windowConfigs: any[] = [];

    for (let floor = 0; floor < 4; floor++) {
      const yBase = 8 + floor * 3;

      // Three window pairs per floor
      const pairPositions = [-3, 0, 3];

      for (const xOffset of pairPositions) {
        windowConfigs.push({
          x: xOffset,
          y: yBase + 1.5,
          width: 1.8,
          height: 2.2,
          floor: floor,
        });
      }
    }

    for (const config of windowConfigs) {
      const windowWidth = config.width;
      const windowHeight = config.height;

      // Window frame - dark wood
      const frameGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, 0.2);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B5A2B),
        roughness: 0.6,
        metalness: 0.1,
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.set(config.x, config.y, -this.buildingDepth / 2 + 0.2);
      this.mesh.add(frame);

      // Window panes - multiple panes per window
      const paneCount = 4; // 2x2 grid
      const paneCols = 2;
      const paneRows = 2;
      const paneWidth = (windowWidth - 0.3) / paneCols;
      const paneHeight = (windowHeight - 0.3) / paneRows;

      for (let row = 0; row < paneRows; row++) {
        for (let col = 0; col < paneCols; col++) {
          const paneGeometry = new THREE.BoxGeometry(paneWidth, paneHeight, 0.08);
          const paneMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x4A4A4A),
            roughness: 0.1,
            metalness: 0.0,
            transparent: true,
            opacity: 0.8,
          });
          const pane = new THREE.Mesh(paneGeometry, paneMaterial);
          pane.position.set(
            config.x - windowWidth / 2 + 0.15 + col * (paneWidth + 0.05),
            config.y - windowHeight / 2 + 0.15 + row * (paneHeight + 0.05),
            -this.buildingDepth / 2 + 0.25
          );
          this.mesh.add(pane);
        }
      }
    }
  }

  private createDoor(): void {
    // Grand entrance door with ornate frame
    const doorWidth = 2.5;
    const doorHeight = 4;

    // Door frame with classical detailing
    const frameGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.4);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.7,
      metalness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, doorHeight / 2, -this.buildingDepth / 2 + 0.3);
    this.mesh.add(frame);

    // Door panels - vertical planks
    const plankCount = 5;
    const plankWidth = (doorWidth - 0.5) / plankCount;

    for (let i = 0; i < plankCount; i++) {
      const plankGeometry = new THREE.BoxGeometry(plankWidth - 0.05, doorHeight - 0.3, 0.2);
      const plankMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x6B5B4B),
        roughness: 0.7,
        metalness: 0.1,
      });
      const plank = new THREE.Mesh(plankGeometry, plankMaterial);
      plank.position.set(-doorWidth / 2 + 0.25 + i * (plankWidth + 0.05), doorHeight / 2, -this.buildingDepth / 2 + 0.3);
      this.mesh.add(plank);
    }

    // Ornate door hardware - lion head knockers, etc.
    // Left knocker
    const leftKnockerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const leftKnockerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xC0C0C0),
      roughness: 0.4,
      metalness: 0.8,
    });
    const leftKnocker = new THREE.Mesh(leftKnockerGeometry, leftKnockerMaterial);
    leftKnocker.position.set(-0.7, 1.5, -this.buildingDepth / 2 + 0.35);
    this.mesh.add(leftKnocker);

    // Right knocker
    const rightKnocker = new THREE.Mesh(leftKnockerGeometry, leftKnockerMaterial);
    rightKnocker.position.set(0.7, 1.5, -this.buildingDepth / 2 + 0.35);
    this.mesh.add(rightKnocker);

    // Keyhole plate
    const keyholeGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.1);
    const keyholeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.7,
      metalness: 0.1,
    });
    const keyhole = new THREE.Mesh(keyholeGeometry, keyholeMaterial);
    keyhole.position.set(0, 0.8, -this.buildingDepth / 2 + 0.35);
    this.mesh.add(keyhole);
  }

  private createSignage(): void {
    // Elegant bank signage with hand-painted lettering
    const signWidth = 4;
    const signHeight = 2;
    const signDepth = 0.4;

    // Sign board background
    const signGeometry = new THREE.BoxGeometry(signWidth, signHeight, signDepth);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.1,
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 9.5, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(sign);

    // Hand-painted lettering area
    const letteringWidth = signWidth - 0.5;
    const letteringHeight = signHeight - 0.5;
    const letteringGeometry = new THREE.BoxGeometry(letteringWidth, letteringHeight, 0.3);
    const letteringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFD700),
      roughness: 0.9,
      metalness: 0.0,
    });
    const lettering = new THREE.Mesh(letteringGeometry, letteringMaterial);
    lettering.position.set(0, 9.75, -this.buildingDepth / 2 + 0.55);
    this.mesh.add(lettering);

    // Decorative elements below sign
    // Gold decorative line
    const decorGeometry = new THREE.BoxGeometry(signWidth, 0.1, 0.1);
    const decorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFD700),
      roughness: 0.9,
      metalness: 0.0,
    });
    const decor = new THREE.Mesh(decorGeometry, decorMaterial);
    decor.position.set(0, 9.4, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(decor);

    // Two gas pipes
    const pipeGeometry = new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8);
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.3,
    });

    const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe1.position.set(-signWidth / 2 + 0.2, 9.0, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(pipe1);

    const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe2.position.set(signWidth / 2 - 0.2, 9.0, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(pipe2);
  }

  private createWaterTower(): void {
    // Rooftop water tower on the bank
    const towerBaseRadius = 1.8;
    const towerHeight = 3.5;
    const towerNeckHeight = 1.2;

    // Tower base
    const baseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, 0.6, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 8 + 4 + 0.6 / 2;
    base.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(base);

    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.88, towerBaseRadius * 0.88, towerHeight, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xA0522D),
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 8 + 4 + 0.6 / 2 + towerHeight / 2;
    body.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(body);

    // Tower neck
    const neckGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.65, towerBaseRadius * 0.35, towerNeckHeight, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 8 + 4 + 0.6 / 2 + towerHeight + towerNeckHeight / 2;
    neck.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(neck);

    // Tank top
    const tankGeometry = new THREE.BoxGeometry(towerBaseRadius * 0.6, 0.3, towerBaseRadius * 0.6);
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.0,
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.y = 8 + 4 + 0.6 / 2 + towerHeight + towerNeckHeight + 0.15;
    tank.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(tank);

    // Finial
    const finialGeometry = new THREE.SphereGeometry(towerBaseRadius * 0.3, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 8 + 4 + 0.6 / 2 + towerHeight + towerNeckHeight + 0.15 + towerBaseRadius * 0.3;
    finial.position.z = -this.buildingDepth / 2 + 0.4;
    this.mesh.add(finial);
  }
}