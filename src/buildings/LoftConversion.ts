import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * LoftConversion - Represents a 1985-era loft conversion building
 * Features: exposed brick interior visible through large windows,
 * steel beams, industrial-chic design popular in 1980s urban renewal
 *
 * Shows the blend of old and new: original brick preserved inside
 * with modern window installations
 */
export class LoftConversion {
  private mesh: THREE.Group;
  private readonly buildingWidth = 20;
  private readonly buildingDepth = 30;
  private readonly buildingHeight = 35;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'loftConversion';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createExposedBrickFacade();
    this.createLargeWindows();
    this.createSteelBeams();
    this.createFireEscape();
    this.createBalcony();

    console.log(`LoftConversion created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main building footprint
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

    // Upper floor structure - open loft concept
    const floorHeight = 3;
    const upperWidth = this.buildingWidth - 2;
    const upperDepth = this.buildingDepth - 2;

    for (let floor = 1; floor < 6; floor++) {
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

  private createExposedBrickFacade(): void {
    // Exposed brick interior visible through windows
    const cleanedBrickColor = new THREE.Color(0xE8E8E8); // Cleaned brick
    const originalBrickColor = new THREE.Color(0x8B3A2B); // Original 1945 brick
    const mortarColor = new THREE.Color(0xB5B5B5);

    // Brick material - showing restoration
    const brickMaterial = new THREE.MeshStandardMaterial({
      color: cleanedBrickColor,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Original 1945 brick patch showing through
    const originalPatchGeometry = new THREE.BoxGeometry(6, 8, 2);
    const originalPatchMaterial = new THREE.MeshStandardMaterial({
      color: originalBrickColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const originalPatch = new THREE.Mesh(originalPatchGeometry, originalPatchMaterial);
    originalPatch.position.x = -5;
    originalPatch.position.y = 4;
    originalPatch.position.z = -(this.buildingDepth / 2) + 2;
    this.mesh.add(originalPatch);

    // Opposite patch
    const originalPatch2 = new THREE.Mesh(originalPatchGeometry, originalPatchMaterial);
    originalPatch2.position.x = 5;
    originalPatch2.position.y = 4;
    originalPatch2.position.z = -(this.buildingDepth / 2) + 2;
    this.mesh.add(originalPatch2);

    // Main exposed brick wall surface
    const mainBrickGeometry = new THREE.BoxGeometry(this.buildingWidth - 8, 15, this.buildingDepth - 8);
    const mainBrick = new THREE.Mesh(mainBrickGeometry, brickMaterial);
    mainBrick.position.y = 7.5;
    mainBrick.position.z = 0;
    this.mesh.add(mainBrick);

    // Mortar lines
    const mortarThickness = 0.2;
    const mortarGeometry = new THREE.BoxGeometry(this.buildingWidth - 8 + mortarThickness * 2, mortarThickness, this.buildingDepth - 8 + mortarThickness * 2);
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
    for (let i = 0; i < 10; i++) {
      const xPos = (i * 2) - 7;
      const horizontalMortar = new THREE.BoxGeometry(mortarThickness, mortarThickness, this.buildingDepth - 8 + mortarThickness * 2);
      const horizontalMortarMesh = new THREE.Mesh(horizontalMortar, mortarMaterial);
      horizontalMortarMesh.position.x = xPos;
      horizontalMortarMesh.position.y = 1;
      horizontalMortarMesh.position.z = 0;
      this.mesh.add(horizontalMortarMesh);
    }
  }

  private createLargeWindows(): void {
    // Large floor-to-ceiling windows showing exposed brick interior
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
      transparent: true,
      opacity: 0.9,
    });

    // Window grid - floor to ceiling, floor_to_ceiling style
    const windowWidth = 5;
    const windowHeight = 2.5;
    const windowDepth = 0.3;

    // Create windows across the facade
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const x = (col * (windowWidth + 0.5)) - 15 + (windowWidth / 2);
        const y = (row * (windowHeight + 0.5)) + 2 + (windowHeight / 2) + 2; // Raised from ground

        const windowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth);
        const window = new THREE.Mesh(windowGeometry, glassMaterial);
        window.position.x = x;
        window.position.y = y;
        window.position.z = -(this.buildingDepth / 2) + windowDepth / 2;
        this.mesh.add(window);

        // Window frames
        const frameGeometry = new THREE.BoxGeometry(windowWidth + 0.2, windowHeight + 0.2, windowDepth / 2);
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.x = x;
        frame.position.y = y;
        frame.position.z = -(this.buildingDepth / 2) + windowDepth / 4;
        this.mesh.add(frame);
      }
    }

    // Show interior exposed brick visible through windows (simulated)
    // Interior brick patches visible through glass
    const interiorBrickColor = new THREE.Color(0xD0C0A0);
    const interiorBrickMaterial = new THREE.MeshStandardMaterial({
      color: interiorBrickColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    // A few interior brick sections visible through windows
    for (let i = 0; i < 6; i++) {
      const interiorX = (Math.random() - 0.5) * 12;
      const interiorY = 5 + Math.random() * 15;
      const interiorGeometry = new THREE.BoxGeometry(2, 2, 0.5);
      const interiorBrick = new THREE.Mesh(interiorGeometry, interiorBrickMaterial);
      interiorBrick.position.x = interiorX;
      interiorBrick.position.y = interiorY;
      interiorBrick.position.z = -(this.buildingDepth / 2) + 1;
      this.mesh.add(interiorBrick);
    }
  }

  private createSteelBeams(): void {
    // Exposed steel beams characteristic of loft conversions
    const steelColor = new THREE.Color(0x5D5D5D);
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: steelColor,
      roughness: 0.5,
      metalness: 0.9,
    });

    // Main longitudinal beams
    const beamLength = this.buildingDepth - 4;
    const beamWidth = 0.3;
    const beamHeight = 0.3;

    // 4 main beams running the length
    for (let i = 0; i < 4; i++) {
      const yPos = 4 + 3 + (i * 4); // At floor levels
      const beamGeometry = new THREE.BoxGeometry(beamLength, beamHeight, beamWidth);
      const beam = new THREE.Mesh(beamGeometry, steelMaterial);
      beam.position.x = 0;
      beam.position.y = yPos;
      beam.position.z = -(this.buildingDepth / 2) + 2;
      this.mesh.add(beam);
    }

    // Cross beams
    for (let i = 0; i < 5; i++) {
      const xPos = -(this.buildingWidth / 2) + 2 + (i * 4);
      const beamGeometry = new THREE.BoxGeometry(beamWidth, beamLength, beamHeight);
      const beam = new THREE.Mesh(beamGeometry, steelMaterial);
      beam.position.x = xPos;
      beam.position.y = 4 + 3 + 2;
      beam.position.z = 0;
      this.mesh.add(beam);
    }
  }

  private createFireEscape(): void {
    // 1980s fire escape staircase
    const stepColor = new THREE.Color(0x999999);
    const stepMaterial = new THREE.MeshStandardMaterial({
      color: stepColor,
      roughness: 0.5,
      metalness: 0.7,
    });

    const stringColor = new THREE.Color(0x2C3E50);
    const stringMaterial = new THREE.MeshStandardMaterial({
      color: stringColor,
      roughness: 0.6,
      metalness: 0.3,
    });

    // Fire escape steps
    const stepWidth = 0.6;
    const stepDepth = 0.3;
    const stepHeight = 0.2;

    for (let i = 0; i < 10; i++) {
      const stepY = 4 + (i * 0.2);
      const stepGeometry = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
      const step = new THREE.Mesh(stepGeometry, stepMaterial);
      step.position.x = -(this.buildingWidth / 2) + 0.5;
      step.position.y = 4 + (i * 0.2) + stepHeight / 2;
      step.position.z = -(this.buildingDepth / 2) + 3;
      this.mesh.add(step);
    }

    // Vertical stringers (side rails support)
    for (let i = 0; i < 4; i++) {
      const stringerY = 4 + (i * 2.5);
      const stringerGeometry = new THREE.BoxGeometry(0.2, 2.5, this.buildingDepth / 2 - 2);
      const stringer = new THREE.Mesh(stringerGeometry, stringMaterial);
      stringer.position.x = -(this.buildingWidth / 2) + 0.3;
      stringer.position.y = stringerY;
      stringer.position.z = -(this.buildingDepth / 2) + 2;
      this.mesh.add(stringer);
    }

    // Horizontal rail at top
    const railGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, 0.3, 0.3);
    const rail = new THREE.Mesh(railGeometry, stepMaterial);
    rail.position.x = 0;
    rail.position.y = 4 + 2.5 + 0.15;
    rail.position.z = -(this.buildingDepth / 2) + 3;
    this.mesh.add(rail);
  }

  private createBalcony(): void {
    // Small balcony with iron railing
    const balconyDepth = 2;
    const balconyHeight = 0.5;
    const railingColor = new THREE.Color(0x999999);
    const railingMaterial = new THREE.MeshStandardMaterial({
      color: railingColor,
      roughness: 0.5,
      metalness: 0.7,
    });

    // Balcony platform
    const balconyGeometry = new THREE.BoxGeometry(this.buildingWidth - 4, balconyHeight, balconyDepth);
    const balcony = new THREE.Mesh(balconyGeometry, railingMaterial);
    balcony.position.x = 0;
    balcony.position.y = 20 + balconyHeight / 2; // 5th floor level
    balcony.position.z = -(this.buildingDepth / 2) + balconyDepth / 2;
    this.mesh.add(balcony);

    // Iron railing along balcony edge
    const railingGeometry = new THREE.BoxGeometry(this.buildingWidth - 6, 0.3, 0.3);
    const railing = new THREE.Mesh(railingGeometry, railingMaterial);
    railing.position.x = 0;
    railing.position.y = 20 + railingHeight / 2;
    railing.position.z = -(this.buildingDepth / 2) + 0.3;
    this.mesh.add(railing);

    // Railing posts
    for (let i = 0; i < 4; i++) {
      const postX = -(this.buildingWidth / 2) + 2 + (i * 6);
      const postGeometry = new THREE.BoxGeometry(0.3, 1, 0.3);
      const post = new THREE.Mesh(postGeometry, railingMaterial);
      post.position.x = postX;
      post.position.y = 20 + 1;
      post.position.z = -(this.buildingDepth / 2) + 0.3;
      this.mesh.add(post);
    }
  }
}