/** 
 * CoWorkingSpace - 2025-era co-working space with transparent facade
 * Features:
 * - Transparent facade with smart glass
 * - Integrated solar glass elements
 * - Smart streetlights with sensor arrays and WiFi nodes
 * - EV charging stations on street corners
 * - Interactive display windows
 * - Biophilic design elements (living walls, natural materials)
 * - Augmented reality markers on building faces
 * - Drone delivery landing pad on rooftop
 * - Modular construction aesthetics
 * - Biophilic design elements visible throughout
 */

import * as THREE from 'three';
import { EraKey } from '../eras/eraData';
import { SmartGlassMaterial } from './NetZeroOffice';
import { GreenWallSegment } from './NetZeroOffice';
import { EVChargingStation } from './NetZeroOffice';
import { SmartStreetlight } from './NetZeroOffice';
import { InteractiveDisplayWindow } from './NetZeroOffice';

/** 
 * Transparent facade panel with smart glass appearance
 */
class TransparentFacadePanel {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3, width: number, height: number) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Frame - slim metallic border
    const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.1);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.8,
      roughness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.y = height / 2;
    this.mesh.add(frame);

    // Glass panel - highly transparent smart glass
    const glassGeometry = new THREE.BoxGeometry(width, height, 0.05);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.95,
      metalness: 0.05,
      roughness: 0.02,
    });
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.y = height / 2;
    this.mesh.add(glass);

    // Grid pattern suggesting touch-screen overlay
    const gridSpacing = Math.max(1, Math.min(width, height) / 4);
    for (let x = -width / 2; x <= width / 2; x += gridSpacing) {
      for (let y = -height / 2; y <= height / 2; y += gridSpacing) {
        const gridGeometry = new THREE.PlaneGeometry(gridSpacing * 0.6, gridSpacing * 0.6);
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

    // Corner NFC touch points
    const cornerPositions = [
      new THREE.Vector2(-width / 2 + 0.5, -height / 2 + 0.5),
      new THREE.Vector2(width / 2 - 0.5, -height / 2 + 0.5),
      new THREE.Vector2(-width / 2 + 0.5, height / 2 - 0.5),
      new THREE.Vector2(width / 2 - 0.5, height / 2 - 0.5),
    ];

    for (const cornerPos of cornerPositions) {
      const nfcGeometry = new THREE.SphereGeometry(0.15, 12, 12);
      const nfcMaterial = new THREE.MeshStandardMaterial({
        color: 0xe74c3c,
        emissive: 0x9b59b6,
        emissiveIntensity: 0.2,
      });
      const nfc = new THREE.Mesh(nfcGeometry, nfcMaterial);
      nfc.position.set(cornerPos.x, cornerPos.y, 0.03);
      this.mesh.add(nfc);
    }

    this.mesh.userData = { buildingType: 'transparentFacade', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Drone Delivery Landing Pad on rooftop for co-working space
 */
class CoWorkingDronePad {
  private mesh: THREE.Group;

  constructor(position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Landing platform
    const platformGeometry = new THREE.BoxGeometry(10, 0.2, 10);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.5,
      roughness: 0.3,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = 0.1;
    this.mesh.add(platform);

    // Landing grid pattern
    const gridMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Grid lines
    for (let i = -4; i <= 4; i++) {
      const lineXGeometry = new THREE.BoxGeometry(0.2, 0.2, 5.2);
      const lineX = new THREE.Mesh(lineXGeometry, gridMaterial);
      lineX.position.set(i * 2.5, 0.15, 0);
      this.mesh.add(lineX);

      const lineZGeometry = new THREE.BoxGeometry(5.2, 0.2, 0.2);
      const lineZ = new THREE.Mesh(lineZGeometry, gridMaterial);
      lineZ.position.set(0, 0.15, i * 2.5);
      this.mesh.add(lineZ);
    }

    // Center "H" marker for helipad
    const hMarkerGeometry = new THREE.BoxGeometry(3, 0.3, 0.2);
    const hMarker = new THREE.Mesh(hMarkerGeometry, gridMaterial);
    hMarker.position.set(0, 0.15, 0);
    this.mesh.add(hMarker);

    // Perimeter guide lights
    const lightGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      emissive: 0x9b59b6,
      emissiveIntensity: 0.4,
    });

    const lightPositions = [
      new THREE.Vector3(5, 0.15, 0),
      new THREE.Vector3(-5, 0.15, 0),
      new THREE.Vector3(0, 0.15, 5),
      new THREE.Vector3(0, 0.15, -5),
      new THREE.Vector3(3.5, 0.15, 3.5),
      new THREE.Vector3(-3.5, 0.15, 3.5),
      new THREE.Vector3(3.5, 0.15, -3.5),
      new THREE.Vector3(-3.5, 0.15, -3.5),
    ];

    for (const pos of lightPositions) {
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.copy(pos);
      this.mesh.add(light);
    }

    // Solar recharging indicator ring
    const ringGeometry = new THREE.TorusGeometry(4.9, 0.05, 8, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x2ecc71,
      emissiveIntensity: 0.15,
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
 * Smart Streetlight with enhanced sensor array and WiFi node for co-working space
 */
class CoWorkingSmartStreetlight {
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

    // Main pole with segment indication
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 7, 32);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x34495e,
      metalness: 0.9,
      roughness: 0.1,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 3.5;
    this.mesh.add(pole);

    // Sensor array module - multi-sensor cluster
    const sensorArrayGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.3);
    const sensorArrayMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.6,
      roughness: 0.4,
    });
    const sensorArray = new THREE.Mesh(sensorArrayGeometry, sensorArrayMaterial);
    sensorArray.position.set(0, 5.5, 0);
    this.mesh.add(sensorArray);

    // Individual sensor domes on the array
    for (let i = 0; i < 4; i++) {
      const sensorDomeGeometry = new THREE.SphereGeometry(0.15, 12, 12);
      const sensorDomeMaterial = new THREE.MeshStandardMaterial({
        color: 0x2980b9,
        metalness: 0.7,
        roughness: 0.3,
      });
      const sensorDome = new THREE.Mesh(sensorDomeGeometry, sensorDomeMaterial);
      
      const angle = (i / 4) * Math.PI * 2;
      const radius = 0.35;
      sensorDome.position.set(
        Math.cos(angle) * radius,
        5.5 + Math.random() * 0.2,
        Math.sin(angle) * radius
      );
      this.mesh.add(sensorDome);
    }

    // WiFi node with data transmission indicator
    const wifiGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const wifiMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      emissive: 0xf1c40f,
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.2,
    });
    const wifiNode = new THREE.Mesh(wifiGeometry, wifiMaterial);
    wifiNode.position.set(0, 5.8, 0);
    this.mesh.add(wifiNode);

    // Data pulse effect rings around WiFi node
    for (let i = 0; i < 3; i++) {
      const pulseGeometry = new THREE.TorusGeometry(0.28 + i * 0.05, 0.03, 8, 32);
      const pulseMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        emissive: 0xf1c40f,
        emissiveIntensity: 0.2 - i * 0.05,
        transparent: true,
        opacity: 0.4 - i * 0.1,
      });
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.set(0, 6.0 + i * 0.1, 0);
      pulse.rotation.x = Math.PI / 2;
      this.mesh.add(pulse);
    }

    // Light fixture with soft glow
    const lightGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf39c1f,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.5,
    });
    const lightFixture = new THREE.Mesh(lightGeometry, lightMaterial);
    lightFixture.position.set(0, 5.2, 0);
    this.mesh.add(lightFixture);

    // Decorative fin/slit pattern on pole
    const finGeometry = new THREE.BoxGeometry(0.05, 1.5, 0.3);
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      metalness: 0.5,
      roughness: 0.5,
    });
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      fin.position.set(0, 3.5 + i * 0.25, 0);
      fin.rotation.y = (i / 6) * Math.PI;
      this.mesh.add(fin);
    }

    this.mesh.userData = { buildingType: 'smartStreetlight', era: '2025' };
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }
}

/** 
 * Interactive Display Window for co-working space (extends base version)
 */
class CoWorkingDisplayWindow extends InteractiveDisplayWindow {
  constructor(position: THREE.Vector3, width: number = 4, height: number = 3) {
    super(position, width, height);

    // Add co-working specific content indicators
    // Co-working space indicators: desk icons, meeting room symbols
    const deskIconCount = 8;
    const deskColors = [0x3498db, 0x9b59b6, 0x95a5a6, 0x2ecc71];
    
    for (let i = 0; i < deskIconCount; i++) {
      const deskAngle = (i / deskIconCount) * Math.PI * 2;
      const deskRadius = Math.min(width, height) * 0.3;
      
      // Desk rectangle
      const deskGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.2);
      const deskMaterial = new THREE.MeshStandardMaterial({
        color: deskColors[Math.floor(Math.random() * deskColors.length)],
        metalness: 0.3,
        roughness: 0.5,
      });
      const desk = new THREE.Mesh(deskGeometry, deskMaterial);
      
      desk.position.set(
        Math.cos(deskAngle) * radius,
        0,
        Math.sin(deskAngle) * radius
      );
      desk.position.y = 0.15;
      this.mesh.add(desk);

      // Monitor on desk
      const monitorGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
      const monitorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        metalness: 0.4,
        roughness: 0.3,
      });
      const monitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
      monitor.position.set(
        Math.cos(deskAngle) * radius,
        0.25,
        Math.sin(deskAngle) * radius
      );
      this.mesh.add(monitor);
    }

    // Meeting room indicator at top center
    const meetingGeometry = new THREE.BoxGeometry(width * 0.5, height * 0.3, 0.05);
    const meetingMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b59b6,
      emissive: 0x8e44ad,
      emissiveIntensity: 0.2,
    });
    const meetingRoom = new THREE.Mesh(meetingGeometry, meetingMaterial);
    meetingRoom.position.set(0, height / 2 - 0.2, 0.03);
    this.mesh.add(meetingRoom);

    // WiFi signal indicator bars at top corners
    const wifiBarCount = 3;
    for (let i = 0; i < wifiBarCount; i++) {
      const barGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.05);
      const barMaterial = new THREE.MeshStandardMaterial({
        color: 0x3498db,
        emissive: 0x2980b9,
        emissiveIntensity: 0.3,
      });
      const wifiBar = new THREE.Mesh(barGeometry, barMaterial);
      wifiBar.position.set(
        (i - 1) * 0.35,
        height / 2 - 0.1,
        0.03
      );
      this.mesh.add(wifiBar);
    }

    this.mesh.userData = { buildingType: 'coWorkingDisplay', era: '2025' };
  }
}

/** 
 * CoWorkingSpace - 2025-era co-working space with transparent facade
 * Features transparent facade, smart glass, drone landing pad, and all
 * the 2025 technology-integrated architecture elements
 */
export class CoWorkingSpace {
  public mesh: THREE.Group;
  public era: "2025" = "2025";
  public smartGlass: SmartGlassMaterial;
  public greenWalls: GreenWallSegment[];
  public dronePad: CoWorkingDronePad | null = null;
  private tintAnimationRunning: boolean = false;

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 30)) {
    this.smartGlass = new SmartGlassMaterial();
    this.greenWalls = [];

    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;
    group.userData.buildingType = 'coWorkingSpace';
    group.userData.era = '2025';

    // Building dimensions
    const buildingWidth = 45;
    const buildingHeight = 50;
    const buildingDepth = 35;

    // Main structure with transparent facade appearance
    const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
    // Use a transparent material with smart glass emulation
    const facadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
      metalness: 0.1,
      roughness: 0.03,
    });
    const mainBuilding = new THREE.Mesh(buildingGeometry, facadeMaterial);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    group.add(mainBuilding);

    // Setbacks showing modular construction aesthetics
    const setbackOffsets = [2, 8, 15, 25];
    for (const offset of setbackOffsets) {
      const setbackGeometry = new THREE.BoxGeometry(
        buildingWidth - offset * 2,
        buildingHeight,
        buildingDepth - offset * 2
      );
      const setbackMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        metalness: 0.2,
        roughness: 0.3,
      });
      const setback = new THREE.Mesh(setbackGeometry, setbackMaterial);
      setback.position.set(offset, buildingHeight / 2, offset);
      setback.castShadow = true;
      setback.receiveShadow = true;
      group.add(setback);
    }

    // Transparent facade panels on ground floor - key feature
    const facadePanelCountX = 8;
    const facadePanelCountZ = 6;
    const panelWidth = buildingWidth / facadePanelCountX;
    const panelHeight = 8; // height of ground floor panels

    for (let col = 0; col < facadePanelCountX; col++) {
      for (let row = 0; row < facadePanelCountZ; row++) {
        const panelX = -buildingWidth / 2 + panelWidth / 2 + col * panelWidth;
        const panelZ = -buildingDepth / 2 + panelHeight / 2 + row * panelHeight + 10; // start from ground floor
        const panelHeightActual = buildingHeight / 2 - 5; // panels cover upper half

        const panel = new TransparentFacadePanel(
          new THREE.Vector3(panelX, buildingHeight / 2, panelZ),
          panelWidth - 1,
          panelHeightActual
        );
        group.add(panel.getMesh());
      }
    }

    // Green walls on building corners (requirement: at least 2 building exteriors)
    const leftGreenWall = new GreenWallSegment(
      new THREE.Vector3(-buildingWidth / 2 + 1, 0, 0),
      buildingWidth - 2,
      buildingDepth
    );
    this.greenWalls.push(leftGreenWall);
    group.add(leftGreenWall.getMesh());

    const rearGreenWall = new GreenWallSegment(
      new THREE.Vector3(0, 0, -buildingDepth / 2 + 1),
      buildingWidth - 2,
      buildingDepth / 2
    );
    this.greenWalls.push(rearGreenWall);
    group.add(rearGreenWall.getMesh());

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

    // Rooftop drone delivery landing pad (key acceptance criteria feature)
    this.dronePad = new CoWorkingDronePad(new THREE.Vector3(0, buildingHeight + 0.1, 0));
    group.add(this.dronePad.getMesh());

    // Smart Streetlight with sensor array and WiFi node
    const streetlight = new CoWorkingSmartStreetlight(new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 3));
    group.add(streetlight.getMesh());

    // EV Charging Station on street corner
    const evStation = new EVChargingStation(new THREE.Vector3(-buildingWidth / 2 + 3, 0, -buildingDepth / 2 + 3));
    group.add(evStation.getMesh());

    // Interactive display windows on ground floor
    const displayWindowCount = 6;
    for (let i = 0; i < displayWindowCount; i++) {
      const display = new CoWorkingDisplayWindow(
        new THREE.Vector3(
          (Math.random() - 0.5) * (buildingWidth - 6),
          0,
          -buildingDepth / 2 + 2 + Math.random() * 3
        ),
        4,
        3
      );
      group.add(display.getMesh());
    }

    // Biophilic design elements - living wall at entrance
    const bioWallGeometry = new THREE.PlaneGeometry(8, 5, 32, 32);
    const bioWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      transparent: true,
      opacity: 0.9,
    });
    const bioWall = new THREE.Mesh(bioWallGeometry, bioWallMaterial);
    bioWall.position.set(0, buildingHeight / 2 - 2, 0);
    bioWall.rotation.x = -Math.PI / 2;
    group.add(bioWall);

    // Additional plant elements around the base
    const plantCount = 12;
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
      const radius = 1.5 + Math.random() * 2;
      plant.position.set(
        Math.cos(angle) * radius,
        0.5 + Math.random() * 2,
        Math.sin(angle) * radius
      );
      group.add(plant);
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

    // Night-time LED edge lighting
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