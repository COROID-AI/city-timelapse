import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * BrickRestoration - Represents a 1985-era building with brick restoration
 * Features: cleaned brick facade, restored mortar, accent strips,
 * steel-and-glass storefront integration
 *
 * Contrasts with original 1945 brick through cleaning and restoration
 */
export class BrickRestoration {
  private mesh: THREE.Group;
  private readonly buildingWidth = 20;
  private readonly buildingDepth = 40;
  private readonly buildingHeight = 45;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'brickRestoration';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createRestoredBrickFacade();
    this.createSteelAndGlassStorefront();
    this.createWindows();
    this.createRoof();

    console.log(`BrickRestoration created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Building base footprint with slightly setback sections
    const baseWidth = this.buildingWidth;
    const baseDepth = this.buildingDepth;
    const baseHeight = 4;

    // Main base structure - cleaned brick color
    const cleanedBrickColor = new THREE.Color(0xE8E8E8); // Cleaned light brick
    const originalBrickColor = new THREE.Color(0x8B3A2B); // Original dark brick from 1945

    // Main body
    const baseGeometry = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: cleanedBrickColor,
      roughness: 0.5,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = baseHeight / 2;
    this.mesh.add(base);

    // Setback middle section to show restoration contrast
    const setbackWidth = baseWidth - 3;
    const setbackDepth = 3;
    const setbackGeometry = new THREE.BoxGeometry(setbackWidth, baseHeight, setbackDepth);
    const setbackMaterial = new THREE.MeshStandardMaterial({
      color: cleanedBrickColor,
      roughness: 0.4, // Slightly cleaner/more polished
      metalness: 0.1,
    });
    const setback = new THREE.Mesh(setbackGeometry, setbackMaterial);
    setback.position.x = 1.5; // Set back from edge
    setback.position.y = baseHeight / 2;
    this.mesh.add(setback);

    // Opposite setback
    const setback2 = new THREE.Mesh(setbackGeometry, setbackMaterial);
    setback2.position.x = -(setbackWidth + 1.5);
    setback2.position.y = baseHeight / 2;
    this.mesh.add(setback2);
  }

  private createRestoredBrickFacade(): void {
    // Show the contrast between restored 1985 brick and original 1945 brick
    const cleanedBrickColor = new THREE.Color(0xE8E8E8);
    const originalBrickColor = new THREE.Color(0x8B3A2B);
    const mortarColor = new THREE.Color(0xB5B5B5);

    // Brick material with cleaned appearance
    const cleanedBrickMaterial = new THREE.MeshStandardMaterial({
      color: cleanedBrickColor,
      roughness: 0.6,
      metalness: 0.05,
    });

    // Original (unrestored) brick sections - show as patches or base layer
    // These represent the 1945 original that's been partially cleaned
    for (let i = 0; i < 4; i++) {
      const xOffset = (i * 5) - 5;
      const originalGeometry = new THREE.BoxGeometry(4.5, 12, 4);
      const originalMaterial = new THREE.MeshStandardMaterial({
        color: originalBrickColor,
        roughness: 0.8,
        metalness: 0.1,
      });
      const originalBrick = new THREE.Mesh(originalGeometry, originalMaterial);
      originalBrick.position.x = xOffset;
      originalBrick.position.y = 6;
      originalBrick.position.z = -(this.buildingDepth / 2) + 4;
      this.mesh.add(originalBrick);
    }

    // Main cleaned/restored brick surface
    const mainGeometry = new THREE.BoxGeometry(this.buildingWidth - 8, 20, this.buildingDepth - 8);
    const mainBrick = new THREE.Mesh(mainGeometry, cleanedBrickMaterial);
    mainBrick.position.y = 10;
    mainBrick.position.z = 0;
    this.mesh.add(mainBrick);

    // Restored mortar lines
    const mortarThickness = 0.2;
    const mortarGeometry = new THREE.BoxGeometry(this.buildingWidth - 8 + mortarThickness * 2, this.buildingHeight, mortarThickness);
    const mortarMaterial = new THREE.MeshStandardMaterial({
      color: mortarColor,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Vertical mortar lines
    for (let i = 0; i < 10; i++) {
      const yPos = (i * 2) + 1;
      const verticalMortar = new THREE.Mesh(mortarGeometry, mortarMaterial);
      verticalMortar.position.x = -(this.buildingWidth / 2) + mortarThickness / 2;
      verticalMortar.position.y = yPos;
      verticalMortar.position.z = 0;
      this.mesh.add(verticalMortar);

      const verticalMortar2 = new THREE.Mesh(mortarGeometry, mortarMaterial);
      verticalMortar2.position.x = (this.buildingWidth / 2) - mortarThickness / 2;
      verticalMortar2.position.y = yPos;
      verticalMortar2.position.z = 0;
      this.mesh.add(verticalMortar2);
    }

    // Horizontal mortar lines
    for (let i = 0; i < 15; i++) {
      const xPos = (i * 2) - 5;
      const horizontalMortar = new THREE.BoxGeometry(mortarThickness, mortarThickness, this.buildingDepth - 8 + mortarThickness * 2);
      const horizontalMortarMesh = new THREE.Mesh(horizontalMortar, mortarMaterial);
      horizontalMortarMesh.position.x = xPos;
      horizontalMortarMesh.position.y = 1;
      horizontalMortarMesh.position.z = 0;
      this.mesh.add(horizontalMortarMesh);
    }
  }

  private createSteelAndGlassStorefront(): void {
    // Steel-and-glass storefront on ground floor
    const aluminumColor = new THREE.Color(0x999999);
    const glassColor = new THREE.Color(0xffffff);

    // Aluminum framing for storefront
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Glass material
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: glassColor,
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
    });

    // Ground floor storefront area (height 10 meters from ground up)
    const storefrontHeight = 10;

    // Storefront bulk - glass
    const storefrontGeometry = new THREE.BoxGeometry(this.buildingWidth - 6, storefrontHeight, 4);
    const storefrontGlass = new THREE.Mesh(storefrontGeometry, glassMaterial);
    storefrontGlass.position.x = 0;
    storefrontGlass.position.y = storefrontHeight / 2;
    storefrontGlass.position.z = -(this.buildingDepth / 2) + 4 + 0.5;
    this.mesh.add(storefrontGlass);

    // Aluminum framing around storefront
    // Top frame
    const topFrameGeometry = new THREE.BoxGeometry(this.buildingWidth - 6, 0.5, 0.5);
    const topFrame = new THREE.Mesh(topFrameGeometry, aluminumMaterial);
    topFrame.position.x = 0;
    topFrame.position.y = this.buildingHeight - 0.25;
    topFrame.position.z = -(this.buildingDepth / 2) + 4 + 0.5;
    this.mesh.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(topFrameGeometry, aluminumMaterial);
    bottomFrame.position.x = 0;
    bottomFrame.position.y = 5; // Above base
    bottomFrame.position.z = -(this.buildingDepth / 2) + 4 + 0.5;
    this.mesh.add(bottomFrame);

    // Side frames
    const sideFrameGeometry = new THREE.BoxGeometry(0.5, storefrontHeight, 0.5);
    const sideFrame = new THREE.Mesh(sideFrameGeometry, aluminumMaterial);
    sideFrame.position.x = (this.buildingWidth / 2) - 0.25;
    sideFrame.position.y = storefrontHeight / 2;
    sideFrame.position.z = -(this.buildingDepth / 2) + 4 + 0.5;
    this.mesh.add(sideFrame);

    const sideFrame2 = new THREE.Mesh(sideFrameGeometry, aluminumMaterial);
    sideFrame2.position.x = -(this.buildingWidth / 2) + 0.25;
    sideFrame2.position.y = storefrontHeight / 2;
    sideFrame2.position.z = -(this.buildingDepth / 2) + 4 + 0.5;
    this.mesh.add(sideFrame2);

    // Display window panes (divided lights)
    const paneColor = new THREE.Color(0x2a2a2a);
    const paneMaterial = new THREE.MeshStandardMaterial({
      color: paneColor,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Vertical mullions
    for (let i = 0; i < 5; i++) {
      const xPos = (i * 4) - 8;
      const paneGeom = new THREE.BoxGeometry(0.5, storefrontHeight - 1, 0.5);
      const verticalPane = new THREE.Mesh(paneGeom, paneMaterial);
      verticalPane.position.x = xPos;
      verticalPane.position.y = storefrontHeight / 2;
      verticalPane.position.z = -(this.buildingDepth / 2) + 4.5;
      this.mesh.add(verticalPane);
    }

    // Horizontal mullions
    for (let i = 0; i < 3; i++) {
      const yPos = (i * 3.5) + 3.5;
      const paneGeom = new THREE.BoxGeometry(this.buildingWidth - 8, 0.5, 0.5);
      const horizontalPane = new THREE.Mesh(paneGeom, paneMaterial);
      horizontalPane.position.x = 0;
      horizontalPane.position.y = yPos;
      horizontalPane.position.z = -(this.buildingDepth / 2) + 4.5;
      this.mesh.add(horizontalPane);
    }
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

    // Grid of windows on upper floors (not the ground storefront)
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 12; col++) {
        // Skip ground floor storefront area (rows 0-2)
        if (row < 3 && Math.abs(col - 5.5) < 3.5) continue;

        const x = (col * windowSize) - (6 * windowSize) + (windowSize / 2);
        const y = (row * windowSize) + (windowSize / 2) + 10; // Start above ground floor

        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, windowDepth);
        const windowMaterial = new THREE.MeshStandardMaterial({
          color: glassColorInner,
          roughness: 0.2,
          metalness: 0.1,
        });

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

  private createRoof(): void {
    // Flat roof with parapet
    const roofHeight = 3;
    const parapetHeight = 1;

    // Roof material - dark gray
    const roofColor = new THREE.Color(0x333333);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.7,
      metalness: 0.2,
    });

    // Main roof
    const roofGeometry = new THREE.BoxGeometry(this.buildingWidth, roofHeight, this.buildingDepth);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = this.buildingHeight + roofHeight / 2;
    this.mesh.add(roof);

    // Parapet wall around roof edge
    const parapetGeometry = new THREE.BoxGeometry(this.buildingWidth + 2, parapetHeight, this.buildingDepth + 2);
    const parapetMaterial = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const parapet = new THREE.Mesh(parapetGeometry, parapetMaterial);
    parapet.position.y = this.buildingHeight + roofHeight;
    this.mesh.add(parapet);
  }
}