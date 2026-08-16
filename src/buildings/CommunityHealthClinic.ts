/** 
 * CommunityHealthClinic - 2025-era community health clinic with welcoming entrance
 * Features:
 * - Welcoming entrance with accessible design
 * - Smart glass facades with dynamic tinting
 * - Integrated solar glass elements
 * - Vertical gardens/green walls
 * - Biophilic design elements (living walls, natural materials)
 * - Modular construction aesthetics
 * - Accessible design throughout (ramps, tactile paving)
 * - Smart streetlight with sensor array and WiFi node
 * - Interactive display windows
 * - Augmented reality markers on building faces
 * - Color palette: whites, natural wood tones, living green
 */

import * as THREE from 'three';
import { EraKey } from '../eras/eraData';
import { SmartGlassMaterial } from './NetZeroOffice';
import { GreenWallSegment } from './NetZeroOffice';
import { EVChargingStation } from './NetZeroOffice';
import { SmartStreetlight } from './NetZeroOffice';
import { InteractiveDisplayWindow } from './NetZeroOffice';

/** 
 * Welcoming Entrance Canopy for clinic
 */
class WelcomingEntrance {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3, width: number, depth: number, height: number) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Entrance canopy structure
    const canopyGeometry = new THREE.BoxGeometry(width, height, depth);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      metalness: 0.2,
      roughness: 0.4,
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.position.y = height / 2;
    this.mesh.add(canopy);

    // Curved glass canopy effect using multiple panels
    const panelCount = 8;
    for (let i = 0; i < panelCount; i++) {
      const panelAngle = (i / panelCount) * Math.PI * 2;
      const panelRadius = width / 2 - 0.5;
      
      const panelGeometry = new THREE.BoxGeometry(3, height, depth * 0.2);
      const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        transparent: true,
        opacity: 0.8,
        metalness: 0.1,
        roughness: 0.05,
      });
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.position.set(
        Math.cos(panelAngle) * panelRadius,
        height / 2,
        Math.sin(panelAngle) * panelRadius
      );
      panel.rotation.y = panelAngle;
      this.mesh.add(panel);
    }

    // Side columns
    const columnGeometry = new THREE.CylinderGeometry(0.3, 0.3, height, 32);
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574, // warm wood tone
      metalness: 0.1,
      roughness: 0.6,
    });
    
    for (const sidePos of [-width / 2 + 1, width / 2 - 1]) {
      const column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(sidePos, height / 2, 0);
      column.rotation.x = -Math.PI / 2;
      this.mesh.add(column);
    }

    // Step-up entries
    const stepCount = 3;
    const stepDepth = 0.3;
    const stepHeight = height / stepCount;
    
    for (let i = 0; i <= stepCount; i++) {
      const stepGeometry = new THREE.BoxGeometry(width, stepHeight, stepDepth);
      const stepMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        metalness: 0.3,
        roughness: 0.5,
      });
      const step = new THREE.Mesh(stepGeometry, stepMaterial);
      step.position.set(0, i * stepHeight + stepHeight / 2, depth / 2 + stepDepth / 2);
      this.mesh.add(step);
    }

    // Tactile paving at entrance
    const tactileGeometry = new THREE.BoxGeometry(width, 0.1, 1);
    const tactileMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const tactilePaving = new THREE.Mesh(tactileGeometry, tactileMaterial);
    tactilePaving.position.set(0, 0.05, depth / 2 + 0.55);
    this.mesh.add(tactilePaving);

    this.mesh.userData = { buildingType: 'welcomingEntrance', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Community Health Clinic - 2025-era community health clinic with welcoming entrance
 * Features smart glass facades, biophilic design, accessible design throughout,
 * and all the 2025 sustainable architecture elements
 */
export class CommunityHealthClinic {
  public mesh: THREE.Group;
  public era: "2025" = "2025";
  public smartGlass: SmartGlassMaterial;
  public greenWalls: GreenWallSegment[];
  public accessibleRamp: AccessibleRamp | null = null;
  private tintAnimationRunning: boolean = false;

  constructor(position: THREE.Vector3 = new THREE.Vector3(-15, 0, 30)) {
    this.smartGlass = new SmartGlassMaterial();
    this.greenWalls = [];

    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;
    group.userData.buildingType = 'communityHealthClinic';
    group.userData.era = '2025';

    // Building dimensions
    const buildingWidth = 40;
    const buildingHeight = 45;
    const buildingDepth = 30;

    // Main building structure with smart glass
    const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
    const buildingMaterial = this.smartGlass;
    const mainBuilding = new THREE.Mesh(buildingGeometry, buildingMaterial);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    group.add(mainBuilding);

    // Setbacks showing modular construction
    const setbackOffsets = [3, 8, 15, 25];
    for (const offset of setbackOffsets) {
      const setbackGeometry = new THREE.BoxGeometry(
        buildingWidth - offset * 2,
        buildingHeight,
        buildingDepth - offset * 2
      );
      const setbackMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        metalness: 0.3,
        roughness: 0.4,
      });
      const setback = new THREE.Mesh(setbackGeometry, setbackMaterial);
      setback.position.set(offset, buildingHeight / 2, offset);
      setback.castShadow = true;
      setback.receiveShadow = true;
      group.add(setback);
    }

    // Welcoming entrance canopy at ground floor center
    const entrance = new WelcomingEntrance(
      new THREE.Vector3(0, buildingHeight / 2 - 3, -buildingDepth / 2 + 5),
      buildingWidth - 4,
      8,
      6
    );
    group.add(entrance.getMesh());

    // Green wall on building facade (requirement: at least 2 building exteriors with green walls)
    const leftGreenWall = new GreenWallSegment(
      new THREE.Vector3(-buildingWidth / 2 + 1, 0, 0),
      buildingWidth - 2,
      buildingDepth
    );
    this.greenWalls.push(leftGreenWall);
    group.add(leftGreenWall.getMesh());

    const rightGreenWall = new GreenWallSegment(
      new THREE.Vector3(buildingWidth / 2 - 1, 0, 0),
      buildingWidth - 2,
      buildingDepth
    );
    this.greenWalls.push(rightGreenWall);
    group.add(rightGreenWall.getMesh());

    // Modular construction joint lines
    const jointLineMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.5,
      roughness: 0.3,
    });

    for (let level = 1; level <= 8; level++) {
      const jointLineGeometry = new THREE.BoxGeometry(buildingWidth, 0.1, buildingDepth);
      const jointLine = new THREE.Mesh(jointLineGeometry, jointLineMaterial);
      jointLine.position.set(0, level * (buildingHeight / 8) - buildingHeight / 16 + 0.05, 0);
      jointLine.rotation.x = Math.PI / 2;
      jointLine.opacity = 0.3;
      jointLine.visible = true;
      group.add(jointLine);
    }

    // Rooftop garden with planters
    const rooftopGeometry = new THREE.BoxGeometry(buildingWidth, 0.5, buildingDepth);
    const rooftopMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.1,
      roughness: 0.7,
    });
    const rooftop = new THREE.Mesh(rooftopGeometry, rooftopMaterial);
    rooftop.position.set(0, buildingHeight, 0);
    rooftop.castShadow = true;
    rooftop.receiveShadow = true;
    group.add(rooftop);

    // Rooftop planters
    const planterDepth = 2;
    const planterWidth = buildingWidth - 6;
    const planterHeight = 1;

    const rooftopPlanterPositions = [
      new THREE.Vector3(-buildingWidth / 2 + 3, buildingHeight + planterHeight / 2, -buildingDepth / 2 + planterDepth / 2 + 0.5),
      new THREE.Vector3(buildingWidth / 2 - 3 - planterWidth, buildingHeight + planterHeight / 2, -buildingDepth / 2 + planterDepth / 2 + 0.5),
      new THREE.Vector3(0, buildingHeight + planterHeight / 2, -buildingDepth / 2 + planterDepth / 2 + 0.5),
      new THREE.Vector3(0, buildingHeight + planterHeight / 2, buildingDepth / 2 - planterDepth / 2 - 0.5),
    ];

    for (const planterPos of rooftopPlanterPositions) {
      const planterGeometry = new THREE.BoxGeometry(planterWidth, planterHeight, planterDepth);
      const planterMaterial = new THREE.MeshStandardMaterial({
        color: 0x8e44ad,
        metalness: 0.2,
        roughness: 0.4,
      });
      const planter = new THREE.Mesh(planterGeometry, planterMaterial);
      planter.position.copy(planterPos);
      planter.castShadow = true;
      planter.receiveShadow = true;
      group.add(planter);
    }

    // Plants in rooftop planters
    const rooftopPlantColors = [0x2ecc71, 0x27ae60, 0x1e8449, 0x16a085];
    for (let i = 0; i < 12; i++) {
      const plantGeometry = new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 16, 16);
      const plantMaterial = new THREE.MeshStandardMaterial({
        color: rooftopPlantColors[Math.floor(Math.random() * rooftopPlantColors.length)],
        metalness: 0.1,
        roughness: 0.5 + Math.random() * 0.3,
      });
      const plant = new THREE.Mesh(plantGeometry, plantMaterial);
      
      const planterOffsetX = (Math.random() - 0.5) * (buildingWidth - 10);
      const planterOffsetZ = (Math.random() - 0.5) * (buildingDepth - 10) + buildingHeight;
      plant.position.set(planterOffsetX, planterOffsetZ, (Math.random() - 0.5) * (buildingDepth - 10));
      plant.position.y += buildingHeight;
      group.add(plant);
    }

    // Accessible ramp at clinic entrance (key accessibility requirement)
    this.accessibleRamp = new AccessibleRamp(
      new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 1),
      12, // ramp length
      1.8 // rise (1.8 meters over 12m length)
    );
    group.add(this.accessibleRamp.getMesh());

    // EV Charging Station
    const evStation = new EVChargingStation(new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 3));
    group.add(evStation.getMesh());

    // Smart Streetlight with sensor array and WiFi node
    const streetlight = new SmartStreetlight(new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 3));
    group.add(streetlight.getMesh());

    // Interactive display windows on ground floor
    const displayWindowCount = 4;
    for (let i = 0; i < displayWindowCount; i++) {
      const display = new InteractiveDisplayWindow(
        new THREE.Vector3(
          (Math.random() - 0.5) * (buildingWidth - 6),
          0,
          -buildingDepth / 2 + 2 + Math.random() * 3
        ),
        3,
        2.5
      );
      group.add(display.getMesh());
    }

    // Biophilic design elements - living wall at main entrance
    const bioWallGeometry = new THREE.PlaneGeometry(10, 6, 32, 32);
    const bioWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      transparent: true,
      opacity: 0.9,
    });
    const bioWall = new THREE.Mesh(bioWallGeometry, bioWallMaterial);
    bioWall.position.set(0, buildingHeight / 2 - 1, 0);
    bioWall.rotation.x = -Math.PI / 2;
    group.add(bioWall);

    // Additional natural material elements
    // Wood tone accents
    const woodAccentCount = 10;
    for (let i = 0; i < woodAccentCount; i++) {
      const woodGeometry = new THREE.BoxGeometry(1 + Math.random() * 1.5, 2 + Math.random() * 2, 0.3);
      const woodMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574, // warm wood
        metalness: 0.1,
        roughness: 0.6,
      });
      const woodAccent = new THREE.Mesh(woodGeometry, woodMaterial);
      woodAccent.position.set(
        (Math.random() - 0.5) * (buildingWidth - 1),
        1 + Math.random() * 3,
        (Math.random() - 0.5) * (buildingDepth - 1)
      );
      woodAccent.castShadow = true;
      woodAccent.receiveShadow = true;
      group.add(woodAccent);
    }

    // Stone elements around base
    const stoneCount = 8;
    for (let i = 0; i < stoneCount; i++) {
      const stoneGeometry = new THREE.BoxGeometry(0.8 + Math.random() * 0.5, 0.3 + Math.random() * 0.5, 0.3 + Math.random() * 0.3);
      const stoneMaterial = new THREE.MeshStandardMaterial({
        color: 0x95a5a6,
        metalness: 0.2,
        roughness: 0.7,
      });
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      const angle = (i / stoneCount) * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1;
      stone.position.set(
        Math.cos(angle) * radius,
        0.15,
        Math.sin(angle) * radius
      );
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(stone);
    }

    // AR Markers on building faces
    const arMarkerSize = 4;
    const arMarkerGeometry = new THREE.PlaneGeometry(arMarkerSize, arMarkerSize);
    const arMarkerMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
    });

    const arMarkerPositions = [
      new THREE.Vector3(-buildingWidth / 2 + arMarkerSize / 2, buildingHeight / 2 + 1, -buildingDepth / 2 + 1),
      new THREE.Vector3(buildingWidth / 2 - arMarkerSize / 2, buildingHeight / 2 + 1, -buildingDepth / 2 + 1),
      new THREE.Vector3(-buildingWidth / 2 + arMarkerSize / 2, buildingHeight / 2 + 1, buildingDepth / 2 - 1),
      new THREE.Vector3(buildingWidth / 2 - arMarkerSize / 2, buildingHeight / 2 + 1, buildingDepth / 2 - 1),
    ];

    for (const pos of arMarkerPositions) {
      const arMarker = new THREE.Mesh(arMarkerGeometry, arMarkerMaterial);
      arMarker.position.copy(pos);
      arMarker.rotation.x = Math.PI / 2;
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

    // Night-time subtle LED edge lighting
    const ledStripGeometry = new THREE.BoxGeometry(0.1, 0.1, buildingWidth + buildingDepth);
    const ledStripMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.03,
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledStripGeometry, ledStripMaterial);
    ledStrip.position.set(0, buildingHeight / 2, 0);
    ledStrip.rotation.z = Math.PI / 2;
    group.add(ledStrip);

    // Corner LED accent strips
    for (const pos of [
      new THREE.Vector3(0, buildingHeight / 2 + 2, buildingDepth / 2 + 1),
      new THREE.Vector3(0, buildingHeight / 2 + 2, -buildingDepth / 2 - 1),
    ]) {
      const cornerLed = new THREE.Mesh(ledStripGeometry, ledStripMaterial);
      cornerLed.position.copy(pos);
      cornerLed.rotation.z = Math.PI / 2;
      group.add(cornerLed);
    }

    // Smart glass tint animation start
    this.startTintAnimation();
    
    this.mesh = group;
  }

  /** Start continuous tint animation cycling between clear and tinted */
  startTintAnimation(cycleMs: number = 3000): void {
    if (this.tintAnimationRunning) return;
    
    const toggleTint = () => {
      this.smartGlass.setTinted(this.smartGlass.tintState === 'clear');
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