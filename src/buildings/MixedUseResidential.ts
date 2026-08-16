/** 
 * MixedUseResidential - 2025-era mixed-use residential building with terraced gardens
 * Features:
 * - Terraced garden levels on exterior
 * - Smart glass facades with dynamic tinting
 * - Integrated solar glass elements
 * - Vertical gardens/green walls
 * - Biophilic design elements
 * - Modular construction aesthetics
 * - Accessible design (ramps, tactile paving)
 * - EV charging station access
 * - Smart streetlight proximity
 */

import * as THREE from 'three';
import { EraKey } from '../eras/eraData';
import { SmartGlassMaterial } from './NetZeroOffice';
import { GreenWallSegment } from './NetZeroOffice';
import { EVChargingStation } from './NetZeroOffice';
import { SmartStreetlight } from './NetZeroOffice';

/** 
 * Terraced garden level - stepped garden platform
 */
class TerracedGardenLevel {
  private mesh: THREE.Group;
  private levelIndex: number;
  private stepHeight: number;

  constructor(position: THREE.Vector3, width: number, depth: number, levelIndex: number, totalLevels: number) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.levelIndex = levelIndex;
    this.stepHeight = 3; // 3 meters per level

    // Garden platform
    const platformWidth = width - 4;
    const platformDepth = depth - 4;
    const platformGeometry = new THREE.BoxGeometry(platformWidth, 0.5, platformDepth);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x8e44ad,
      metalness: 0.2,
      roughness: 0.5,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = levelIndex * this.stepHeight + 0.25;
    this.mesh.add(platform);

    // Planter boxes along the edge
    const planterDepth = 1.5;
    const planterHeight = 1.2;
    const planterWidth = platformWidth - 2;

    // Front planter
    const frontPlanterGeometry = new THREE.BoxGeometry(planterWidth, planterHeight, planterDepth);
    const frontPlanterMaterial = new THREE.MeshStandardMaterial({
      color: 0x8e44ad,
      metalness: 0.2,
      roughness: 0.4,
    });
    const frontPlanter = new THREE.Mesh(frontPlanterGeometry, frontPlanterMaterial);
    frontPlanter.position.set(0, levelIndex * this.stepHeight + planterHeight / 2 + 0.5, -platformDepth / 2 + planterDepth / 2 + 0.1);
    this.mesh.add(frontPlanter);

    // Back planter
    const backPlanter = new THREE.Mesh(frontPlanterGeometry, frontPlanterMaterial);
    backPlanter.position.set(0, levelIndex * this.stepHeight + planterHeight / 2 + 0.5, platformDepth / 2 - planterDepth / 2 - 0.1);
    this.mesh.add(backPlanter);

    // Side planters
    const sidePlanterGeometry = new THREE.BoxGeometry(planterDepth, planterHeight, planterWidth);
    for (const sidePos of [-platformWidth / 2 + planterDepth / 2, platformWidth / 2 - planterDepth / 2]) {
      const sidePlanter = new THREE.Mesh(sidePlanterGeometry, frontPlanterMaterial);
      sidePlanter.position.set(sidePos, levelIndex * this.stepHeight + planterHeight / 2 + 0.5, 0);
      this.mesh.add(sidePlanter);
    }

    // Plants in planters
    const plantCount = 6;
    const plantColors = [0x2ecc71, 0x27ae60, 0x1e8449, 0x16a085];
    for (let i = 0; i < plantCount; i++) {
      const plantGeometry = new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 16, 16);
      const plantMaterial = new THREE.MeshStandardMaterial({
        color: plantColors[Math.floor(Math.random() * plantColors.length)],
        metalness: 0.1,
        roughness: 0.6 + Math.random() * 0.2,
      });
      const plant = new THREE.Mesh(plantGeometry, plantMaterial);
      
      const angle = (i / plantCount) * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1;
      plant.position.set(
        Math.cos(angle) * radius,
        levelIndex * this.stepHeight + 0.8 + Math.random() * 0.3,
        (Math.random() - 0.5) * (platformDepth / 2 - 0.5)
      );
      this.mesh.add(plant);
    }

    // Ground cover texture variation
    const groundCoverGeometry = new THREE.PlaneGeometry(platformWidth - 2, platformDepth - 2);
    const groundCoverMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x27ae60).offsetHSL(0, -0.1 * levelIndex, 0),
      metalness: 0.1,
      roughness: 0.8,
    });
    const groundCover = new THREE.Mesh(groundCoverGeometry, groundCoverMaterial);
    groundCover.position.y = levelIndex * this.stepHeight + 0.05;
    groundCover.rotation.x = -Math.PI / 2;
    this.mesh.add(groundCover);

    this.mesh.userData = { buildingType: 'terracedGarden', level: levelIndex, era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Accessible Ramp module for building entrances with tactile paving
 */
class AccessibleRamp {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3, length: number, rise: number) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    const rampRunHeight = 0.15; // height per run
    const rampRunDepth = 0.3; // depth per run
    const rampRunCount = Math.ceil(rise / rampRunHeight);
    const rampRiseActual = rampRunCount * rampRunHeight;

    // Ramp surface segments
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.3,
      roughness: 0.5,
    });

    for (let i = 0; i < rampRunCount; i++) {
      const runGeometry = new THREE.BoxGeometry(length, rampRunHeight, rampRunDepth);
      const run = new THREE.Mesh(runGeometry, rampMaterial);
      run.position.set(0, i * rampRunHeight + rampRunHeight / 2, -i * rampRunDepth - rampRunDepth / 2);
      run.castShadow = true;
      run.receiveShadow = true;
      this.mesh.add(run);
    }

    // Handrails
    const handrailHeight = rise + 0.8;
    const handrailGeometry = new THREE.BoxGeometry(length + 0.5, 0.2, 0.3);
    const handrailMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.5,
      roughness: 0.3,
    });

    // Inner handrail
    const innerHandrail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.5, 0.2, 0.3), handrailMaterial);
    innerHandrail.position.set(0.5, handrailHeight / 2, -rampRunCount * rampRunDepth);
    this.mesh.add(innerHandrail);

    // Outer handrail
    const outerHandrail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.5, 0.2, 0.3), handrailMaterial);
    outerHandrail.position.set(-0.5, handrailHeight / 2, -rampRunCount * rampRunDepth);
    this.mesh.add(outerHandrail);

    // Add tactile paving at the top
    const tactileGeometry = new THREE.BoxGeometry(length, 0.1, 0.3);
    const tactileMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const tactilePaving = new THREE.Mesh(tactileGeometry, tactileMaterial);
    tactilePaving.position.set(0, 0.05, -rampRunCount * rampRunDepth + 0.15);
    this.mesh.add(tactilePaving);

    this.mesh.userData = { buildingType: 'accessibleRamp', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Co-working Space with transparent facade for 2025 era
 */
export class MixedUseResidential {
  public mesh: THREE.Group;
  public era: "2025" = "2025";
  public smartGlass: SmartGlassMaterial;
  public greenWalls: GreenWallSegment[];
  public terracedGardens: TerracedGardenLevel[];
  public accessibleRamp: AccessibleRamp | null = null;
  private tintAnimationRunning: boolean = false;

  constructor(position: THREE.Vector3 = new THREE.Vector3(30, 0, 0)) {
    this.smartGlass = new SmartGlassMaterial();
    this.greenWalls = [];
    this.terracedGardens = [];

    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;
    group.userData.buildingType = 'mixedUseResidential';
    group.userData.era = '2025';

    // Building dimensions
    const buildingWidth = 50;
    const buildingHeight = 55;
    const buildingDepth = 30;

    // Main building structure with smart glass
    const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
    const buildingMaterial = this.smartGlass;
    const mainBuilding = new THREE.Mesh(buildingGeometry, buildingMaterial);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    group.add(mainBuilding);

    // Setbacks showing modular construction
    const setbackOffsets = [3, 10, 20, 30];
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

    // Terraced garden levels on the building exterior (key acceptance criteria feature)
    // Left side terraces
    const leftTerraceCount = 5;
    for (let i = 0; i < leftTerraceCount; i++) {
      const terrace = new TerracedGardenLevel(
        new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 8 + i * 6),
        buildingWidth - 8,
        buildingDepth / 2 - 16,
        i,
        leftTerraceCount
      );
      this.terracedGardens.push(terrace);
      group.add(terrace.getMesh());
    }

    // Right side terraces
    const rightTerraceCount = 5;
    for (let i = 0; i < rightTerraceCount; i++) {
      const terrace = new TerracedGardenLevel(
        new THREE.Vector3(buildingWidth / 2 - 3, 0, -buildingDepth / 2 + 8 + i * 6),
        buildingWidth - 8,
        buildingDepth / 2 - 16,
        i,
        rightTerraceCount
      );
      this.terracedGardens.push(terrace);
      group.add(terrace.getMesh());
    }

    // Green wall on building facade (requirement: at least 2 building exteriors with green walls)
    const leftGreenWall = new GreenWallSegment(
      new THREE.Vector3(-buildingWidth / 2 + 1, 0, 0),
      buildingWidth - 2,
      buildingDepth
    );
    this.greenWalls.push(leftGreenWall);
    group.add(leftGreenWall.getMesh());

    // Additional green wall on right side or rear
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

    for (let level = 1; level <= 10; level++) {
      const jointLineGeometry = new THREE.BoxGeometry(buildingWidth, 0.1, buildingDepth);
      const jointLine = new THREE.Mesh(jointLineGeometry, jointLineMaterial);
      jointLine.position.set(0, level * (buildingHeight / 10) - buildingHeight / 20 + 0.05, 0);
      jointLine.rotation.x = Math.PI / 2;
      jointLine.opacity = 0.3;
      jointLine.visible = true;
      group.add(jointLine);
    }

    // Rooftop terrace with garden
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
    for (let i = 0; i < 16; i++) {
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

    // Accessible ramp at building entrance (key accessibility requirement)
    this.accessibleRamp = new AccessibleRamp(
      new THREE.Vector3(buildingWidth / 2 - 8, 0, -buildingDepth / 2 + 1),
      15, // ramp length
      2.5 // rise (2.5 meters over 15m length = compliant gradient)
    );
    group.add(this.accessibleRamp.getMesh());

    // EV Charging Station access
    const evStation = new EVChargingStation(new THREE.Vector3(buildingWidth / 2 - 5, 0, -buildingDepth / 2 + 3));
    group.add(evStation.getMesh());

    // Smart Streetlight
    const streetlight = new SmartStreetlight(new THREE.Vector3(buildingWidth / 2 - 5, 0, -buildingDepth / 2 + 3));
    group.add(streetlight.getMesh());

    // Biophilic elements around building base
    const bioElements = new (class extends BiophilicElements {
      constructor(position: THREE.Vector3) {
        super(position);
      }
    })(new THREE.Vector3(0, 0, 0));
    group.add(bioElements.getMesh());

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

    // Ground floor residential units with balcony indicators
    const unitCount = 20;
    for (let i = 0; i < unitCount; i++) {
      const unitX = (Math.random() - 0.5) * (buildingWidth - 8);
      const unitZ = (Math.random() - 0.5) * (buildingDepth - 8);
      const unitY = 5 + Math.random() * 3; // various floor levels

      // Balcony indicator
      const balconyGeometry = new THREE.BoxGeometry(2, 0.5, 0.2);
      const balconyMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        metalness: 0.1,
        roughness: 0.6,
      });
      const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
      balcony.position.set(unitX, unitY + 1.5, unitZ + buildingDepth / 2 - 1);
      balcony.castShadow = true;
      balcony.receiveShadow = true;
      group.add(balcony);

      // Window with smart glass appearance
      const windowGeometry = new THREE.BoxGeometry(1.5, 2, 0.05);
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xbdc3c7,
        transparent: true,
        opacity: 0.9,
        metalness: 0.1,
        roughness: 0.05,
      });
      const window = new THREE.Mesh(windowGeometry, windowMaterial);
      window.position.set(unitX, unitY + 1, unitZ);
      window.castShadow = true;
      window.receiveShadow = true;
      group.add(window);
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

    // Corner LED accents
    for (const pos of [
      new THREE.Vector3(0, buildingHeight / 2 + 3, buildingDepth / 2 + 1),
      new THREE.Vector3(0, buildingHeight / 2 + 3, -buildingDepth / 2 - 1),
    ]) {
      const cornerLed = new THREE.Mesh(ledStripGeometry, ledStripMaterial);
      cornerLed.position.copy(pos);
      cornerLed.rotation.z = Math.PI / 2;
      group.add(cornerLed);
    }

    this.mesh = group;
    
    // Start automatic tint animation for smart glass
    this.startTintAnimation();
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