/** 
 * NetZeroOffice - 2025-era net-zero office tower with photovoltaic facade
 * Features:
 * - Smart glass facades with dynamic tinting capability
 * - Integrated solar glass facades (photovoltaic)
 * - Vertical gardens/green walls on exterior corners
 * - Rooftop garden with planters
 * - EV charging stations on street corner (attached)
 * - Smart streetlight with sensor array and WiFi node (attached)
 * - Biophilic design elements throughout
 * - Modular construction aesthetics
 * - Augmented reality markers on building faces
 */

import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/** 
 * Smart glass material that demonstrates tinting variation 
 * between clear and tinted states via emissive/opacity control
 */
class SmartGlassMaterial extends THREE.MeshStandardMaterial {
  private tintState: 'clear' | 'tinted' = 'clear';
  private tintAnimationId: number = 0;

  constructor() {
    // Start with clear glass - slight blue tint, slightly reflective
    super({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.95,
      metalness: 0.2,
      roughness: 0.05,
      emissive: 0x1a1a2e,
      emissiveIntensity: 0.02,
    });
  }

  /** Set the glass to tinted state */
  setTinted(state: boolean = true): void {
    this.tintState = state ? 'tinted' : 'clear';
    if (state) {
      // Tinted state - slightly darker, reduced transparency
      this.opacity = 0.7;
      this.emissiveIntensity = 0.05;
      this.color.setHex(0xbdc3c7);
    } else {
      // Clear state
      this.opacity = 0.95;
      this.emissiveIntensity = 0.02;
      this.color.setHex(0xecf0f1);
    }
  }

  /** Start continuous tint animation cycling between clear and tinted */
  startTintAnimation(cycleMs: number = 3000): void {
    const toggleTint = () => {
      this.setTinted(this.tintState === 'clear');
      this.tintAnimationId = window.setTimeout(toggleTint, cycleMs);
    };
    toggleTint();
  }

  /** Stop the tint animation */
  stopTintAnimation(): void {
    if (this.tintAnimationId) {
      clearTimeout(this.tintAnimationId);
      this.tintAnimationId = 0;
    }
    // Reset to clear state
    this.setTinted(false);
  }
}

/** 
 * Vertical garden/Green wall segment with layered vegetation textures
 */
class GreenWallSegment {
  private mesh: THREE.Group;
  private layerCount: number = 4;

  constructor(position: THREE.Vector3, width: number, depth: number = 0.5) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Create layered vegetation for depth effect
    for (let i = 0; i < this.layerCount; i++) {
      const layerOffset = (i / this.layerCount) * 0.3;
      const layerGeometry = new THREE.PlaneGeometry(width, 8, 32, 8);
      const layerMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x2ecc71).offsetHSL(0, 0.1 * (i + 1), 0),
        roughness: 0.6 - i * 0.1,
        metalness: 0.1,
      });

      const layer = new THREE.Mesh(layerGeometry, layerMaterial);
      layer.position.z = -depth / 2 + layerOffset;
      layer.rotation.x = -Math.PI / 2; // Vertical orientation
      layer.position.y = i * 2; // Staggered vertical positions
      this.mesh.add(layer);
    }
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * EV Charging Station model for street corner
 */
class EVChargingStation {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Base station post
    const postGeometry = new THREE.CylinderGeometry(0.2, 0.3, 3, 32);
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.8,
      roughness: 0.2,
    });
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.y = 1.5;
    this.mesh.add(post);

    // Charging connector arm
    const armGeometry = new THREE.BoxGeometry(0.3, 1, 0.2);
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.5,
      roughness: 0.4,
    });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(0, 2.5, 0);
    this.mesh.add(arm);

    // Connector head
    const connectorGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const connectorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.9,
      roughness: 0.1,
    });
    const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
    connector.position.set(0, 3.5, 0);
    this.mesh.add(connector);

    // Cable
    const cableGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 32);
    const cableMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.1,
      roughness: 0.5,
    });
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.position.set(0, 0.5, 0);
    cable.rotation.x = Math.PI / 2;
    this.mesh.add(cable);

    // Solar panel top cap
    const solarPanelGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.5);
    const solarPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x0d0d1a,
      emissiveIntensity: 0.1,
      metalness: 0.4,
      roughness: 0.2,
    });
    const solarPanel = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
    solarPanel.position.set(0, 3.2, -0.3);
    this.mesh.add(solarPanel);

    // LED indicator ring
    const ledGeometry = new THREE.TorusGeometry(0.35, 0.05, 8, 32);
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      emissive: 0x27ae60,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledRing = new THREE.Mesh(ledGeometry, ledMaterial);
    ledRing.position.set(0, 3.8, 0);
    ledRing.rotation.x = Math.PI / 2;
    this.mesh.add(ledRing);

    this.mesh.userData = { buildingType: 'evChargingStation', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Smart Streetlight with sensor array and WiFi node for 2025 era
 */
class SmartStreetlight {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Pole base
    const baseGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.9,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.5;
    this.mesh.add(base);

    // Main pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 6, 32);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x34495e,
      metalness: 0.9,
      roughness: 0.1,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 3;
    this.mesh.add(pole);

    // Sensor array module at top
    const sensorGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.2);
    const sensorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.5,
      roughness: 0.4,
    });
    const sensorArray = new THREE.Mesh(sensorGeometry, sensorMaterial);
    sensorArray.position.set(0, 6.2, 0);
    this.mesh.add(sensorArray);

    // WiFi node indicator
    const wifiGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const wifiMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      emissive: 0xf1c40f,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.2,
    });
    const wifiNode = new THREE.Mesh(wifiGeometry, wifiMaterial);
    wifiNode.position.set(0, 6.5, 0);
    this.mesh.add(wifiNode);

    // Light fixture with gentle glow
    const lightGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf39c1f,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.6,
    });
    const lightFixture = new THREE.Mesh(lightGeometry, lightMaterial);
    lightFixture.position.set(0, 5.8, 0);
    this.mesh.add(lightFixture);

    // Decorative ring around pole
    const ringGeometry = new THREE.TorusGeometry(0.35, 0.05, 8, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.3,
      roughness: 0.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, 3, 0);
    ring.rotation.x = Math.PI / 2;
    this.mesh.add(ring);

    this.mesh.userData = { buildingType: 'smartStreetlight', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Interactive Display Window with touchscreen overlay appearance
 */
class InteractiveDisplayWindow {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3, width: number = 4, height: number = 3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Window frame - slim metallic border
    const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.1);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.8,
      roughness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.y = height / 2;
    this.mesh.add(frame);

    // Glass panel with subtle tint and digital display appearance
    const glassGeometry = new THREE.BoxGeometry(width, height, 0.05);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xbdc3c7,
      transparent: true,
      opacity: 0.8,
      metalness: 0.1,
      roughness: 0.05,
    });
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.y = height / 2;
    this.mesh.add(glass);

    // Touchscreen overlay grid pattern
    const gridSpacing = 0.5;
    for (let x = -width / 2; x <= width / 2; x += gridSpacing) {
      for (let y = -height / 2; y <= height / 2; y += gridSpacing) {
        const gridGeometry = new THREE.PlaneGeometry(gridSpacing * 0.8, gridSpacing * 0.8);
        const gridMaterial = new THREE.MeshStandardMaterial({
          color: 0x34495e,
          metalness: 0.3,
          roughness: 0.7,
        });
        const gridLine = new THREE.Mesh(gridGeometry, gridMaterial);
        gridLine.position.set(x, y, 0.03);
        gridLine.rotation.x = Math.PI / 2;
        this.mesh.add(gridLine);
      }
    }

    // Central touch area indicator
    const touchAreaGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.4, 0.03);
    const touchAreaMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x3498db,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    const touchArea = new THREE.Mesh(touchAreaGeometry, touchAreaMaterial);
    touchArea.position.set(0, 0, 0.02);
    this.mesh.add(touchArea);

    // Corner notification dots
    const dotCount = 4;
    for (let i = 0; i < dotCount; i++) {
      const dotGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const dotMaterial = new THREE.MeshStandardMaterial({
        color: 0xe74c3c,
        emissive: 0x9b59b6,
        emissiveIntensity: 0.2,
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const angle = (i * Math.PI * 2) / dotCount;
      const radius = Math.min(width, height) * 0.35;
      dot.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.03
      );
      this.mesh.add(dot);
    }

    this.mesh.userData = { buildingType: 'interactiveDisplay', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Drone Landing Pad on rooftop
 */
class DroneLandingPad {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Landing pad platform - large flat surface
    const padGeometry = new THREE.BoxGeometry(12, 0.2, 12);
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.5,
      roughness: 0.3,
    });
    const pad = new THREE.Mesh(padGeometry, padMaterial);
    pad.position.y = 0.1;
    this.mesh.add(pad);

    // Landing pad markings - "H" for helicopter/drone
    const markingMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Horizontal bar of H
    const hBarGeometry = new THREE.BoxGeometry(8, 0.3, 0.2);
    const hBar = new THREE.Mesh(hBarGeometry, markingMaterial);
    hBar.position.set(0, 0.15, 4);
    this.mesh.add(hBar);

    // Vertical bar of H
    const vBarGeometry = new THREE.BoxGeometry(0.3, 4, 0.2);
    const vBar = new THREE.Mesh(vBarGeometry, markingMaterial);
    vBar.position.set(0, 2, 0);
    this.mesh.add(vBar);

    // Corner circles (4 quadrants)
    for (const xPos of [3, -3]) {
      for (const zPos of [3, -3]) {
        const circleGeometry = new THREE.TorusGeometry(0.8, 0.1, 16, 32);
        const circle = new THREE.Mesh(circleGeometry, markingMaterial);
        circle.position.set(xPos, 0.15, zPos);
        circle.rotation.x = Math.PI / 2;
        this.mesh.add(circle);
      }
    }

    // Center marker
    const centerCircleGeometry = new THREE.TorusGeometry(1.5, 0.15, 16, 32);
    const centerCircle = new THREE.Mesh(centerCircleGeometry, markingMaterial);
    centerCircle.position.set(0, 0.15, 0);
    centerCircle.rotation.x = Math.PI / 2;
    this.mesh.add(centerCircle);

    // Perimeter guide lights
    const lightGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      emissive: 0x9b59b6,
      emissiveIntensity: 0.5,
    });
    
    const perimeterPositions = [
      new THREE.Vector3(6, 0.15, 0),
      new THREE.Vector3(-6, 0.15, 0),
      new THREE.Vector3(0, 0.15, 6),
      new THREE.Vector3(0, 0.15, -6),
    ];

    for (const pos of perimeterPositions) {
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.copy(pos);
      this.mesh.add(light);
    }

    // Solar recharging indicator ring around edge
    const ringGeometry = new THREE.TorusGeometry(5.9, 0.08, 8, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x2ecc71,
      emissiveIntensity: 0.2,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.y = 0.15;
    ring.rotation.x = Math.PI / 2;
    this.mesh.add(ring);

    this.mesh.userData = { buildingType: 'droneLandingPad', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Biophilic Design Elements - living walls, natural materials visible throughout
 */
class BiophilicElements {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Living wall with varied plant textures
    const livingWallGeometry = new THREE.PlaneGeometry(8, 6, 32, 32);
    const livingWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      transparent: true,
      opacity: 0.9,
    });
    const livingWall = new THREE.Mesh(livingWallGeometry, livingWallMaterial);
    livingWall.position.y = 3;
    livingWall.rotation.x = -Math.PI / 2;
    this.mesh.add(livingWall);

    // Add plant texture layers for depth
    const plantCount = 8;
    for (let i = 0; i < plantCount; i++) {
      const plantGeometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 16, 16);
      const plantColors = [0x2ecc71, 0x27ae60, 0x1e8449, 0x16a085];
      const plantMaterial = new THREE.MeshStandardMaterial({
        color: plantColors[Math.floor(Math.random() * plantColors.length)],
        metalness: 0.1,
        roughness: 0.6 + Math.random() * 0.2,
      });
      const plant = new THREE.Mesh(plantGeometry, plantMaterial);
      
      const angle = (i / plantCount) * Math.PI * 2;
      const radius = 2 + Math.random() * 2;
      plant.position.set(
        Math.cos(angle) * radius,
        Math.random() * 3 + 1,
        Math.sin(angle) * radius
      );
      plant.position.y += Math.random();
      this.mesh.add(plant);
    }

    // Natural material elements (wood, stone) around base
    const naturalElements = 6;
    for (let i = 0; i < naturalElements; i++) {
      const elementType = Math.floor(Math.random() * 3);
      let elementGeometry: THREE.BufferGeometry;
      let elementMaterial: THREE.MeshStandardMaterial;

      const angle = (i / naturalElements) * Math.PI * 2;
      const radius = 1.5 + Math.random() * 2;

      if (elementType === 0) {
        // Wooden bench segment
        elementGeometry = new THREE.BoxGeometry(1.5, 0.4, 0.5);
        elementMaterial = new THREE.MeshStandardMaterial({
          color: 0xd4a574,
          metalness: 0.1,
          roughness: 0.5,
        });
      } else if (elementType === 1) {
        // Stone stepping stones
        elementGeometry = new THREE.BoxGeometry(1, 0.1, 1);
        elementMaterial = new THREE.MeshStandardMaterial({
          color: 0x95a5a6,
          metalness: 0.2,
          roughness: 0.7,
        });
      } else {
        // Potted plant
        elementGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        elementMaterial = new THREE.MeshStandardMaterial({
          color: 0x2ecc71,
          metalness: 0.1,
          roughness: 0.6,
        });
      }

      const element = new THREE.Mesh(elementGeometry, elementMaterial);
      element.position.set(
        Math.cos(angle) * radius,
        0.2,
        Math.sin(angle) * radius
      );
      this.mesh.add(element);
    }

    // Water feature element (small reflective pool)
    const waterGeometry = new THREE.PlaneGeometry(3, 0.5);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      reflective: true,
      metalness: 0.3,
      roughness: 0.1,
    });
    const waterFeature = new THREE.Mesh(waterGeometry, waterMaterial);
    waterFeature.position.y = 0.25;
    waterFeature.rotation.x = -Math.PI / 2;
    this.mesh.add(waterFeature);

    this.mesh.userData = { buildingType: 'biophilicElements', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * NetZeroOffice - the flagship 2025-era net-zero office tower
 * Features smart glass facades, photovoltaic solar panels, vertical gardens,
 * rooftop garden, and all the 2025 sustainable architecture elements
 */
export class NetZeroOffice {
  public mesh: THREE.Group;
  public era: "2025" = "2025";
  public smartGlass: SmartGlassMaterial;
  public greenWalls: GreenWallSegment[];
  public dronePad: DroneLandingPad | null = null;
  private tintAnimationRunning: boolean = false;

  constructor(position: THREE.Vector3 = new THREE.Vector3(-30, 0, 0)) {
    this.smartGlass = new SmartGlassMaterial();
    this.greenWalls = [];

    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;
    group.userData.buildingType = 'netZeroOffice';
    group.userData.era = '2025';

    // Main tower structure - glass curtain wall
    const towerWidth = 40;
    const towerHeight = 60;
    const towerDepth = 20;

    // Main building body with smart glass material
    const buildingGeometry = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);
    const buildingMaterial = this.smartGlass; // Use our smart glass material
    const mainBuilding = new THREE.Mesh(buildingGeometry, buildingMaterial);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    group.add(mainBuilding);

    // Architectural setbacks to show modular construction aesthetics
    const setbackOffsets = [5, 15, 25];
    for (const offset of setbackOffsets) {
      const setbackGeometry = new THREE.BoxGeometry(
        towerWidth - offset * 2,
        towerHeight,
        towerDepth - offset * 2
      );
      const setbackMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        metalness: 0.3,
        roughness: 0.4,
      });
      const setback = new THREE.Mesh(setbackGeometry, setbackMaterial);
      setback.position.set(offset, towerHeight / 2, offset);
      setback.castShadow = true;
      setback.receiveShadow = true;
      group.add(setback);
    }

    // Photovoltaic solar glass facade sections - integrated into the smart glass
    const solarPanelCount = 12;
    for (let i = 0; i < solarPanelCount; i++) {
      const panelPosition = (i / solarPanelCount) * towerWidth - towerWidth / 2 + 5;
      const panelGeometry = new THREE.BoxGeometry(3, 8, 0.5);
      const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        emissive: 0x0d0d1a,
        emissiveIntensity: 0.15,
        metalness: 0.4,
        roughness: 0.2,
      });
      const solarPanel = new THREE.Mesh(panelGeometry, panelMaterial);
      solarPanel.position.set(
        panelPosition,
        towerHeight / 2,
        -towerDepth / 2 + 2.5
      );
      solarPanel.castShadow = true;
      solarPanel.receiveShadow = true;
      group.add(solarPanel);
    }

    // Green wall segments on exterior corners (2 walls required by acceptance criteria)
    // Green wall on the left side
    const leftGreenWall = new GreenWallSegment(
      new THREE.Vector3(-towerWidth / 2 + 1, 0, 0),
      towerWidth - 2,
      towerDepth
    );
    this.greenWalls.push(leftGreenWall);
    group.add(leftGreenWall.getMesh());

    // Green wall on the right side
    const rightGreenWall = new GreenWallSegment(
      new THREE.Vector3(towerWidth / 2 - 1, 0, 0),
      towerWidth - 2,
      towerDepth
    );
    this.greenWalls.push(rightGreenWall);
    group.add(rightGreenWall.getMesh());

    // Modular construction joint lines - showing prefabricated assembly
    const jointLineMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.5,
      roughness: 0.3,
    });

    for (let level = 1; level <= 8; level++) {
      const jointLineGeometry = new THREE.BoxGeometry(towerWidth, 0.1, towerDepth);
      const jointLine = new THREE.Mesh(jointLineGeometry, jointLineMaterial);
      jointLine.position.set(0, level * (towerHeight / 8) - towerHeight / 16 + 0.05, 0);
      jointLine.rotation.x = Math.PI / 2;
      jointLine.opacity = 0.3;
      jointLine.visible = true;
      group.add(jointLine);
    }

    // Rooftop garden with planters
    const rooftopGeometry = new THREE.BoxGeometry(towerWidth, 0.5, towerDepth);
    const rooftopMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.1,
      roughness: 0.7,
    });
    const rooftop = new THREE.Mesh(rooftopGeometry, rooftopMaterial);
    rooftop.position.set(0, towerHeight, 0);
    rooftop.castShadow = true;
    rooftop.receiveShadow = true;
    group.add(rooftop);

    // Planter boxes on rooftop perimeter
    const planterDepth = 2;
    const planterWidth = towerWidth - 8;
    const planterHeight = 1;

    for (let corner = 0; corner < 4; corner++) {
      const planterGeometry = new THREE.BoxGeometry(planterWidth, planterHeight, planterDepth);
      const planterMaterial = new THREE.MeshStandardMaterial({
        color: 0x8e44ad,
        metalness: 0.2,
        roughness: 0.4,
      });
      const planter = new THREE.Mesh(planterGeometry, planterMaterial);

      const cornerOffsetX = corner % 2 === 0 ? -towerWidth / 2 + 4 : towerWidth / 2 - 4 - planterWidth;
      const cornerOffsetZ = Math.floor(corner / 2) === 0 ? -towerDepth / 2 + 2 : towerDepth / 2 - 2 - planterDepth;

      planter.position.set(cornerOffsetX, towerHeight + planterHeight / 2, cornerOffsetZ);
      planter.castShadow = true;
      planter.receiveShadow = true;
      group.add(planter);
    }

    // Plant specimens in planters
    const plantTypes = 12;
    for (let i = 0; i < plantTypes; i++) {
      const plantGeometry = new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 16, 16);
      const plantColors = [0x2ecc71, 0x27ae60, 0x1e8449, 0x16a085, 0xf1c40f];
      const plantMaterial = new THREE.MeshStandardMaterial({
        color: plantColors[Math.floor(Math.random() * plantColors.length)],
        metalness: 0.1,
        roughness: 0.5 + Math.random() * 0.3,
      });
      const plant = new THREE.Mesh(plantGeometry, plantMaterial);

      const planterX = (Math.random() - 0.5) * planterWidth + (corner % 2 === 0 ? -towerWidth / 2 + 4 : towerWidth / 2 - 4 - planterWidth);
      const planterZ = (Math.random() - 0.5) * planterDepth + (Math.floor(corner / 2) === 0 ? -towerDepth / 2 + 2 : towerDepth / 2 - 2 - planterDepth);
      const planterY = towerHeight + 0.3;

      plant.position.set(planterX, planterY, planterZ);
      group.add(plant);
    }

    // EV Charging Station on street corner attached to building
    const evStation = new EVChargingStation(new THREE.Vector3(-towerWidth / 2 + 2, 0, -towerDepth / 2 + 3));
    group.add(evStation.getMesh());

    // Smart Streetlight attached to building corner
    const streetlight = new SmartStreetlight(new THREE.Vector3(-towerWidth / 2 + 2, 0, -towerDepth / 2 + 3));
    group.add(streetlight.getMesh());

    // Drone Landing Pad on rooftop (select rooftops requirement)
    this.dronePad = new DroneLandingPad(new THREE.Vector3(0, towerHeight + 0.1, 0));
    group.add(this.dronePad.getMesh());

    // Biophilic design elements around building base
    const bioElements = new BiophilicElements(new THREE.Vector3(0, 0, 0));
    group.add(bioElements.getMesh());

    // AR Markers on building faces - simple square markers with pattern
    const arMarkerSize = 4;
    const arMarkerGeometry = new THREE.PlaneGeometry(arMarkerSize, arMarkerSize);
    const arMarkerMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
    });

    const arMarkerPositions = [
      new THREE.Vector3(-towerWidth / 2 + arMarkerSize / 2, towerHeight / 2 + 1, -towerDepth / 2 + 1),
      new THREE.Vector3(towerWidth / 2 - arMarkerSize / 2, towerHeight / 2 + 1, -towerDepth / 2 + 1),
      new THREE.Vector3(-towerWidth / 2 + arMarkerSize / 2, towerHeight / 2 + 1, towerDepth / 2 - 1),
      new THREE.Vector3(towerWidth / 2 - arMarkerSize / 2, towerHeight / 2 + 1, towerDepth / 2 - 1),
    ];

    // AR marker pattern (simple grid that would be recognizable as AR marker)
    for (const pos of arMarkerPositions) {
      const arMarker = new THREE.Mesh(arMarkerGeometry, arMarkerMaterial);
      arMarker.position.copy(pos);
      arMarker.rotation.x = Math.PI / 2; // Vertical
      // Add pattern to the marker - concentric squares
      const patternGeometry = new THREE.PlaneGeometry(arMarkerSize - 0.5, arMarkerSize - 0.5);
      const patternMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        metalness: 0.3,
        roughness: 0.5,
      });
      const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
      pattern.position.copy(pos);
      pattern.rotation.x = Math.PI / 2;
      group.add(pattern);
      group.add(arMarker);
    }

    // Touch-screen display panels on ground floor storefront area
    const displayPanelCount = 4;
    for (let i = 0; i < displayPanelCount; i++) {
      const displayGeometry = new THREE.BoxGeometry(3, 2, 0.1);
      const displayMaterial = new THREE.MeshStandardMaterial({
        color: 0x34495e,
        emissive: 0x3498db,
        emissiveIntensity: 0.4,
        metalness: 0.2,
        roughness: 0.3,
      });
      const display = new THREE.Mesh(displayGeometry, displayMaterial);
      display.position.set(
        (Math.random() - 0.5) * (towerWidth - 4),
        3 + Math.random() * 2,
        -towerDepth / 2 + 1.5
      );
      display.castShadow = true;
      display.receiveShadow = true;
      group.add(display);
    }

    // Glass block accents with subtle tint
    const glassBlockCount = 20;
    for (let i = 0; i < glassBlockCount; i++) {
      const glassBlockGeometry = new THREE.BoxGeometry(0.8, 1.5 + Math.random() * 2, 0.3);
      const glassBlockMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.2,
        metalness: 0.01,
        roughness: 0.01,
      });
      const glassBlock = new THREE.Mesh(glassBlockGeometry, glassBlockMaterial);
      glassBlock.position.set(
        (Math.random() - 0.5) * (towerWidth - 1),
        2 + Math.random() * 5,
        (Math.random() - 0.5) * (towerDepth - 1)
      );
      glassBlock.castShadow = true;
      glassBlock.receiveShadow = true;
      group.add(glassBlock);
    }

    // Natural wood tone accents at building base
    const woodAccentCount = 8;
    for (let i = 0; i < woodAccentCount; i++) {
      const woodGeometry = new THREE.BoxGeometry(1 + Math.random() * 1.5, 3 + Math.random() * 2, 0.3);
      const woodMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574, // warm wood
        metalness: 0.1,
        roughness: 0.6,
      });
      const woodAccent = new THREE.Mesh(woodGeometry, woodMaterial);
      woodAccent.position.set(
        (Math.random() - 0.5) * (towerWidth - 1),
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * (towerDepth - 1)
      );
      woodAccent.castShadow = true;
      woodAccent.receiveShadow = true;
      group.add(woodAccent);
    }

    // Night-time subtle LED edge lighting (low intensity, no bloom)
    const ledStripGeometry = new THREE.BoxGeometry(0.1, 0.1, towerWidth + towerDepth);
    const ledStripMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.03, // Very subtle, no bloom
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledStripGeometry, ledStripMaterial);
    ledStrip.position.set(0, towerHeight / 2, 0);
    ledStrip.rotation.z = Math.PI / 2;
    group.add(ledStrip);

    // Corner LED accent strips
    for (const pos of [
      new THREE.Vector3(0, towerHeight / 2 + 2, towerDepth / 2 + 1),
      new THREE.Vector3(0, towerHeight / 2 + 2, -towerDepth / 2 - 1),
    ]) {
      const cornerLed = new THREE.Mesh(ledStripGeometry, ledStripMaterial);
      cornerLed.position.copy(pos);
      cornerLed.rotation.z = Math.PI / 2;
      group.add(cornerLed);
    }

    this.mesh = group;
    
    // Start automatic tint animation for smart glass to demonstrate dynamic tinting
    this.startTintAnimation();
  }

  /** Start continuous tint animation cycling between clear and tinted */
  startTintAnimation(cycleMs: number = 3000): void {
    if (this.tintAnimationRunning) return;
    
    const toggleTint = () => {
      this.smartGlass.setTinted(this.tintState === 'clear');
      this.tintAnimationId = window.setTimeout(toggleTint, cycleMs);
    };
    toggleTint();
    this.tintAnimationRunning = true;
  }

  /** Stop the tint animation */
  stopTintAnimation(): void {
    if (this.tintAnimationId) {
      clearTimeout(this.tintAnimationId);
      this.tintAnimationId = 0;
    }
    this.smartGlass.setTinted(false);
    this.tintAnimationRunning = false;
  }

  /** Toggle smart glass tint state */
  toggleGlassTint(): void {
    this.smartGlass.setTinted(!this.smartGlass.tintState === 'tinted');
  }

  getGreenWallCount(): number {
    return this.greenWalls.length;
  }
}