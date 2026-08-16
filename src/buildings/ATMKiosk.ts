import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * ATMKiosk - Represents a 1985-era ATM kiosk on sidewalk
 * Features: ATM machine, drive-up lane, aluminum framing,
 * sidewalk integration with pedestrian access
 */
export class ATMKiosk {
  private mesh: THREE.Group;
  private readonly kioskWidth = 4;
  private readonly kioskDepth = 6;
  private readonly kioskHeight = 3;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'atmKiosk';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createATMFacade();
    this.createDriveUpLane();
    this.createAluminumFraming();
    this.createSignage();

    console.log(`ATMKiosk created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main kiosk base - brick texture to match 1985 era
    const brickColor = new THREE.Color(0xE8E8E8);
    const baseGeometry = new THREE.BoxGeometry(this.kioskWidth, this.kioskHeight, this.kioskDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = this.kioskHeight / 2;
    this.mesh.add(base);
  }

  private createATMFacade(): void {
    // ATM machine front face
    const atmColor = new THREE.Color(0x2C3E50);
    const atmMaterial = new THREE.MeshStandardMaterial({
      color: atmColor,
      roughness: 0.5,
      metalness: 0.3,
    });

    // ATM machine body
    const atmGeometry = new THREE.BoxGeometry(this.kioskWidth - 1, this.kioskHeight - 1, 2);
    const atm = new THREE.Mesh(atmGeometry, atmMaterial);
    atm.position.x = 0;
    atm.position.y = this.kioskHeight / 2;
    atm.position.z = -(this.kioskDepth / 2) + 2;
    this.mesh.add(atm);

    // ATM screen
    const screenColor = new THREE.Color(0x00FF00); // Green screen
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: screenColor,
      roughness: 0.3,
      metalness: 0.1,
      emissive: new THREE.Color(0x003300),
      emissiveIntensity: 0.3,
    });

    const screenGeometry = new THREE.BoxGeometry(this.kioskWidth - 2, 1.5, 0.2);
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.x = 0;
    screen.position.y = this.kioskHeight / 2 - 0.2;
    screen.position.z = -(this.kioskDepth / 2) + 2.1;
    this.mesh.add(screen);

    // Keypad
    const keypadColor = new THREE.Color(0x000000);
    const keypadMaterial = new THREE.MeshStandardMaterial({
      color: keypadColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    const keypadGeometry = new THREE.BoxGeometry(this.kioskWidth - 2, 1, 0.3);
    const keypad = new THREE.Mesh(keypadGeometry, keypadMaterial);
    keypad.position.x = 0;
    keypad.position.y = 0.8;
    keypad.position.z = -(this.kioskDepth / 2) + 2.4;
    this.mesh.add(keypad);

    // Buttons on keypad
    const buttonColor = new THREE.Color(0xFFFFFF);
    for (let i = 0; i < 10; i++) {
      const buttonGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
      const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
      button.position.x = -0.7 + (i % 3 * 0.4);
      button.position.y = 0.2 + Math.floor(i / 3) * 0.4;
      button.position.z = -(this.kioskDepth / 2) + 2.5;
      this.mesh.add(button);
    }
  }

  private createDriveUpLane(): void {
    // Drive-up lane marking
    const laneColor = new THREE.Color(0xFFFFFF);
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: laneColor,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Drive-up canopy/roof structure
    const canopyWidth = 6;
    const canopyDepth = 4;
    const canopyHeight = 3;

    const canopyGeometry = new THREE.BoxGeometry(canopyWidth, canopyHeight, canopyDepth);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513), // Brown roof
      roughness: 0.7,
      metalness: 0.2,
    });

    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.position.x = 0;
    canopy.position.y = this.kioskHeight + canopyHeight / 2;
    canopy.position.z = -(this.kioskDepth / 2) + canopyDepth / 2 + 1;
    this.mesh.add(canopy);

    // Support posts for canopy
    const postColor = new THREE.Color(0x999999);
    const postMaterial = new THREE.MeshStandardMaterial({
      color: postColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    for (let i = 0; i < 4; i++) {
      const postX = (i % 2 === 0 ? -1 : 1) * (canopyWidth / 2 - 0.5);
      const postZ = -(this.kioskDepth / 2) + canopyDepth / 2 + 0.5;
      const postY = this.kioskHeight + canopyHeight / 2;

      const postGeometry = new THREE.BoxGeometry(0.5, canopyHeight + 2, 0.5);
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.x = postX;
      post.position.y = postY;
      post.position.z = postZ;
      this.mesh.add(post);
    }

    // Drive-up payment lane marking lines
    const lineGeometry = new THREE.BoxGeometry(0.5, 0.1, 3);
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFF0000), // Red marking
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 4; i++) {
      const lineY = this.kioskHeight + 0.15;
      const lineZ = -(this.kioskDepth / 2) + 1.5 + i * 0.8;
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.position.x = 0;
      line.position.y = lineY;
      line.position.z = lineZ;
      this.mesh.add(line);
    }
  }

  private createAluminumFraming(): void {
    // Aluminum framing around ATM
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Top frame
    const topGeometry = new THREE.BoxGeometry(this.kioskWidth, 0.3, 0.3);
    const topFrame = new THREE.Mesh(topGeometry, aluminumMaterial);
    topFrame.position.y = this.kioskHeight - 0.15;
    topFrame.position.z = -(this.kioskDepth / 2) + 0.3;
    this.mesh.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(topGeometry, aluminumMaterial);
    bottomFrame.position.y = 0.15;
    bottomFrame.position.z = -(this.kioskDepth / 2) + 0.3;
    this.mesh.add(bottomFrame);

    // Side frames
    const sideGeometry = new THREE.BoxGeometry(0.3, this.kioskHeight, 0.3);
    const sideFrame = new THREE.Mesh(sideGeometry, aluminumMaterial);
    sideFrame.position.x = this.kioskWidth / 2 - 0.3 / 2;
    sideFrame.position.y = this.kioskHeight / 2;
    sideFrame.position.z = -(this.kioskDepth / 2) + 0.3;
    this.mesh.add(sideFrame);

    const sideFrame2 = new THREE.Mesh(sideGeometry, aluminumMaterial);
    sideFrame2.position.x = -(this.kioskWidth / 2) + 0.3 / 2;
    sideFrame2.position.y = this.kioskHeight / 2;
    sideFrame2.position.z = -(this.kioskDepth / 2) + 0.3;
    this.mesh.add(sideFrame2);
  }

  private createSignage(): void {
    // "ATM" signage on top of kiosk
    const signColor = new THREE.Color(0xFF00FF); // Magenta - 1980s color
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    // ATM sign
    const signGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.2);
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.x = 0;
    sign.position.y = this.kioskHeight + 0.6;
    sign.position.z = -(this.kioskDepth / 2) + 0.4;
    this.mesh.add(sign);

    // Accent trim
    const accentColor = new THREE.Color(0xF1C40F); // Yellow accent
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.6,
      metalness: 0.1,
    });

    const trimGeometry = new THREE.BoxGeometry(1.6, 0.2, 0.1);
    const trim1 = new THREE.Mesh(trimGeometry, accentMaterial);
    trim1.position.x = 0;
    trim1.position.y = this.kioskHeight + 0.65;
    trim1.position.z = -(this.kioskDepth / 2) + 0.5;
    this.mesh.add(trim1);

    const trim2 = new THREE.Mesh(trimGeometry, accentMaterial);
    trim2.position.x = 0;
    trim2.position.y = this.kioskHeight + 0.35;
    trim2.position.z = -(this.kioskDepth / 2) + 0.5;
    this.mesh.add(trim2);
  }
}