import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * Marquee - Represents a 1985-era digital LED marquee sign
 * Features: LED scrolling sign, digital display, animated text,
 * aluminum framing, seamless looping animation capability
 *
 * The LED marquee animates with scrolling text that loops seamlessly
 * through a series of frames displayed on LED panels
 */
export class Marquee {
  private mesh: THREE.Group;
  private readonly signWidth = 20;
  private readonly signHeight = 8;
  private readonly panelDepth = 0.5;
  private animationTimer = 0;
  private currentFrame = 0;
  private readonly totalFrames = 24; // 24 frames for smooth loop

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'marquee';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createLedPanels();
    this.createAluminumFrame();
    this.createScrollingText();

    console.log(`Marquee created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  update(deltaTime: number): void {
    // Update the LED marquee animation
    this.animationTimer += deltaTime;
    const animationSpeed = 200; // milliseconds per frame

    if (this.animationTimer >= animationSpeed) {
      this.animationTimer = 0;
      this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
      this.updateTextFrame();
    }
  }

  private createStructure(): void {
    // Base structure for the marquee sign
    const baseColor = new THREE.Color(0x2C3E50);
    const baseGeometry = new THREE.BoxGeometry(this.signWidth, 2, this.signHeight);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.7,
      metalness: 0.3,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 1;
    this.mesh.add(base);
  }

  private createLedPanels(): void {
    // LED panel material with slight glow effect
    const ledOnColor = new THREE.Color(0x00FF00); // LED green when on
    const ledOffColor = new THREE.Color(0x003300); // LED dark when off
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: ledOffColor,
      roughness: 0.1,
      metalness: 0.9,
      emissive: new THREE.Color(0x006600),
      emissiveIntensity: 0.5,
    });

    // Create matrix of LED panels
    const panelWidth = 2;
    const panelHeight = 1;
    const rows = 4;
    const cols = 10;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col * panelWidth) - (cols * panelWidth / 2) + (panelWidth / 2);
        const y = (row * panelHeight) + (panelHeight / 2);
        const z = -(this.signHeight / 2) + this.panelDepth / 2;

        const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, this.panelDepth);
        const panel = new THREE.Mesh(panelGeometry, ledMaterial);
        panel.position.x = x;
        panel.position.y = y;
        panel.position.z = z;
        this.mesh.add(panel);
      }
    }

    // Store reference to panels for animation
    (this.mesh as any).ledPanels = this.mesh.children.filter(
      child => child instanceof THREE.Mesh
    );
  }

  private createAluminumFrame(): void {
    // Aluminum framing material
    const aluminumColor = new THREE.Color(0x999999);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluminumColor,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Top frame
    const topGeometry = new THREE.BoxGeometry(this.signWidth, 0.3, this.signHeight);
    const topFrame = new THREE.Mesh(topGeometry, aluminumMaterial);
    topFrame.position.y = 1 + 0.3 / 2;
    this.mesh.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(topGeometry, aluminumMaterial);
    bottomFrame.position.y = 1 - 0.3 / 2;
    this.mesh.add(bottomFrame);

    // Side frames
    const sideGeometry = new THREE.BoxGeometry(0.3, 2, this.signHeight);
    const sideFrame = new THREE.Mesh(sideGeometry, aluminumMaterial);
    sideFrame.position.x = this.signWidth / 2 - 0.3 / 2;
    sideFrame.position.y = 1;
    this.mesh.add(sideFrame);

    const sideFrame2 = new THREE.Mesh(sideGeometry, aluminumMaterial);
    sideFrame2.position.x = -(this.signWidth / 2) + 0.3 / 2;
    sideFrame2.position.y = 1;
    this.mesh.add(sideFrame2);

    // Horizontal dividers between rows
    for (let row = 0; row < 4; row++) {
      const yPos = (row * 2) + 1.3;
      const horizGeometry = new THREE.BoxGeometry(this.signWidth - 0.6, 0.3, this.signHeight);
      const horizFrame = new THREE.Mesh(horizGeometry, aluminumMaterial);
      horizFrame.position.y = yPos;
      this.mesh.add(horizFrame);
    }
  }

  private createScrollingText(): void {
    // Create the appearance of scrolling text on LED panels
    // In a real implementation, this would use texture maps or font geometries
    // For now, create the visual appearance of text characters

    // Create "WELCOME" text appearance using LED panels
    const textColor = new THREE.Color(0xFFFFFF);
    const textMaterial = new THREE.MeshStandardMaterial({
      color: textColor,
      roughness: 0.2,
      metalness: 0.1,
    });

    // Simulate scrolling text by highlighting different panels
    // Create "1985" text pattern
    const labelText = '1985';

    const fontColor = new THREE.Color(0xFFFF00); // Yellow for 1980s style
    const fontMaterial = new THREE.MeshStandardMaterial({
      color: fontColor,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Create each digit/character using panels
    const digits = ['1', '9', '8', '5'];
    const digitWidth = 2;
    const digitHeight = 4;
    const rowOffsets = [1, 1, 1, 1]; // All on same row for simplicity

    for (let i = 0; i < digits.length; i++) {
      const digitX = (i * (digitWidth + 0.5)) - 4 + (digitWidth / 2);
      
      // Create digit using a panel
      const digitGeometry = new THREE.BoxGeometry(digitWidth, digitHeight, this.panelDepth);
      const digit = new THREE.Mesh(digitGeometry, fontMaterial);
      digit.position.x = digitX;
      digit.position.y = 1;
      digit.position.z = -(this.signHeight / 2) + this.panelDepth / 2 + 0.1;
      this.mesh.add(digit);
    }

    // Additional decorative elements
    const accentColor = new THREE.Color(0xFF00FF); // Magenta accent
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Accent border
    const borderGeometry = new THREE.BoxGeometry(this.signWidth - 0.5, 2 - 0.5, this.signHeight - 0.5);
    const border = new THREE.Mesh(borderGeometry, accentMaterial);
    border.position.y = 1;
    border.position.z = -(this.signHeight / 2) + this.panelDepth / 2 + 0.05;
    this.mesh.add(border);
  }
}