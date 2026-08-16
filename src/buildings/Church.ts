import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * Church - Represents a 1945-era church/synagogue with steeple
 * Features: stone/brick facade, tall steeple with spire, gothic-style windows,
 * wooden entrance doors, period-appropriate signage, minimal exterior lighting,
 * rooftop water tower option, and cemetery/graveside details.
 *
 * Optimized for real-time rendering: max ~35k tris
 */
export class Church {
  private mesh: THREE.Group;
  private readonly buildingWidth = 15; // meters - wide church facade
  private readonly buildingDepth = 20; // meters
  private readonly buildingHeight = 30; // meters - tall with steeple

  constructor(position: THREE.Vector3, era: EraKey = '1945') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'church';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createSteeple();
    this.createFacade();
    this.createWindows();
    this.createDoor();
    this.createSignage();
    this.createWaterTower();
    this.createCourtyard();

    console.log(`Church created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main church body - stone foundation with brick upper sections
    const stoneColor = new THREE.Color(0x5A4A3A); // Stone/brick base

    // Base story - 3 floors
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 9, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: stoneColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 4.5;
    this.mesh.add(base);
  }

  private createSteeple(): void {
    // Iconic church steeple/spire rising from the roof

    // Tower base on roof
    const towerBaseRadius = 2.5;
    const towerBaseHeight = 3;

    const towerBaseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, towerBaseHeight, 16);
    const towerBaseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const towerBase = new THREE.Mesh(towerBaseGeometry, towerBaseMaterial);
    towerBase.position.y = 9 + 4 + towerBaseHeight / 2; // 9 (base) + 4 (upper) + base
    towerBase.position.z = -this.buildingDepth / 2 + 0.5;
    towerBase.position.x = 0;
    this.mesh.add(towerBase);

    // Tower shaft
    const towerShaftHeight = 8;
    const towerTopRadius = 1.2;

    const towerShaftGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerTopRadius, towerShaftHeight, 16);
    const towerShaftMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const towerShaft = new THREE.Mesh(towerShaftGeometry, towerShaftMaterial);
    towerShaft.position.y = 9 + 4 + towerBaseHeight + towerShaftHeight / 2;
    towerShaft.position.z = -this.buildingDepth / 2 + 0.5;
    towerShaft.position.x = 0;
    this.mesh.add(towerShaft);

    // Spire/needle on top
    const spireHeight = 6;
    const spireGeometry = new THREE.ConeGeometry(towerTopRadius, spireHeight, 16);
    const spireMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const spire = new THREE.Mesh(spireGeometry, spireMaterial);
    spire.position.y = 9 + 4 + towerBaseHeight + towerShaftHeight + spireHeight / 2;
    spire.position.z = -this.buildingDepth / 2 + 0.5;
    spire.position.x = 0;
    // Rotate spire to point up
    spire.rotation.x = Math.PI / 2;
    this.mesh.add(spire);

    // Weather vane on top of spire
    const weatherVaneGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.5);
    const weatherVaneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xC0C0C0),
      roughness: 0.4,
      metalness: 0.8,
    });
    const weatherVane = new THREE.Mesh(weatherVaneGeometry, weatherVaneMaterial);
    weatherVane.position.y = 9 + 4 + towerBaseHeight + towerShaftHeight + spireHeight + 0.15;
    weatherVane.position.z = -this.buildingDepth / 2 + 0.5;
    weatherVane.position.x = 0;
    this.mesh.add(weatherVane);
  }

  private createFacade(): void {
    // Gothic/romanques facade details

    // Main entrance arch
    const archRadius = 2;
    const archWidth = 4;
    const archDepth = 0.5;

    // Arch structure - simplified as a segment
    const archGeometry = new THREE.BoxGeometry(archWidth, 3, archDepth);
    const archMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.8,
      metalness: 0.1,
    });
    const arch = new THREE.Mesh(archGeometry, archMaterial);
    arch.position.set(0, 4.5 + 1.5, -this.buildingDepth / 2 + archDepth / 2);
    this.mesh.add(arch);

    // Left tower
    const towerLeftWidth = 4;
    const towerLeftDepth = 6;

    const towerLeftGeometry = new THREE.BoxGeometry(towerLeftWidth, 12, towerLeftDepth);
    const towerLeftMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.8,
      metalness: 0.1,
    });
    const towerLeft = new THREE.Mesh(towerLeftGeometry, towerLeftMaterial);
    towerLeft.position.set(-5, 6, -this.buildingDepth / 2 + towerLeftDepth + 0.5);
    this.mesh.add(towerLeft);

    // Right tower
    const towerRight = new THREE.Mesh(towerLeftGeometry, towerLeftMaterial);
    towerRight.position.set(5, 6, -this.buildingDepth / 2 + towerLeftDepth + 0.5);
    this.mesh.add(towerRight);

    // Gothic arch details on towers
    for (let i = 0; i < 3; i++) {
      const towerX = i === 0 ? -5 : 5;
      const archDetailGeometry = new THREE.BoxGeometry(1, 1.5, 0.3);
      const archDetailMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B5A2B),
        roughness: 0.7,
        metalness: 0.1,
      });
      const archDetail = new THREE.Mesh(archDetailGeometry, archDetailMaterial);
      archDetail.position.set(towerX, 8 + i * 2, -this.buildingDepth / 2 + 1);
      this.mesh.add(archDetail);
    }
  }

  private createWindows(): void {
    // Gothic-style stained glass windows

    // Ground floor entrance area (large arch window)
    const groundWindowGeometry = new THREE.BoxGeometry(3, 2, 0.2);
    const groundWindowMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1A1A1A),
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
    });
    const groundWindow = new THREE.Mesh(groundWindowGeometry, groundWindowMaterial);
    groundWindow.position.set(0, 5.5, -this.buildingDepth / 2 + 0.3);
    this.mesh.add(groundWindow);

    // Side windows - 3 floors, 2 per floor
    for (let floor = 0; floor < 3; floor++) {
      const yBase = 9 + floor * 4; // Each floor is 4m tall starting from y=9

      // Left window
      const leftWindowGeometry = new THREE.BoxGeometry(1.5, 2, 0.2);
      const leftWindowMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1A1A1A),
        roughness: 0.1,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
      });
      const leftWindow = new THREE.Mesh(leftWindowGeometry, leftWindowMaterial);
      leftWindow.position.set(-5.5, yBase + 2, -this.buildingDepth / 2 + 0.3);
      this.mesh.add(leftWindow);

      // Right window
      const rightWindow = new THREE.Mesh(leftWindowGeometry, leftWindowMaterial);
      rightWindow.position.set(5.5, yBase + 2, -this.buildingDepth / 2 + 0.3);
      this.mesh.add(rightWindow);
    }

    // Rose window on front facade (above the main entrance)
    const roseWindowRadius = 1.5;
    const roseWindowGeometry = new THREE.SphereGeometry(roseWindowRadius, 16, 16, 0, Math.PI, 0, Math.PI / 2);
    const roseWindowMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1A1A1A),
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.8,
    });
    const roseWindow = new THREE.Mesh(roseWindowGeometry, roseWindowMaterial);
    roseWindow.position.set(0, 12, -this.buildingDepth / 2 + 0.5);
    roseWindow.rotation.x = Math.PI / 2;
    this.mesh.add(roseWindow);

    // Stone surround for rose window
    const roseSurroundGeometry = new THREE.BoxGeometry(roseWindowRadius * 2 + 0.3, roseWindowRadius + 0.3, 0.3);
    const roseSurroundMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.8,
      metalness: 0.1,
    });
    const roseSurround = new THREE.Mesh(roseSurroundGeometry, roseSurroundMaterial);
    roseSurround.position.set(0, 12.5, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(roseSurround);
  }

  private createDoor(): void {
    // Grand wooden entrance doors with ornate frame

    // Door frame with arch top
    const doorWidth = 3;
    const doorHeight = 4;

    // Main door frame
    const frameGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.3);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5B483A),
      roughness: 0.7,
      metalness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, doorHeight / 2, -this.buildingDepth / 2 + 0.25);
    this.mesh.add(frame);

    // Door panels - vertical planks with cross-bracing
    const plankCount = 3;

    for (let i = 0; i < plankCount; i++) {
      const plankWidth = (doorWidth - 0.3) / plankCount;

      // Left plank
      const leftPlankGeometry = new THREE.BoxGeometry(plankWidth - 0.05, doorHeight - 0.3, 0.2);
      const leftPlankMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x6B5B4B),
        roughness: 0.7,
        metalness: 0.1,
      });
      const leftPlank = new THREE.Mesh(leftPlankGeometry, leftPlankMaterial);
      leftPlank.position.set(-doorWidth / 2 + plankWidth / 2 + i * plankWidth, doorHeight / 2, -this.buildingDepth / 2 + 0.25);
      this.mesh.add(leftPlank);

      // Right plank
      const rightPlank = new THREE.Mesh(leftPlankGeometry, leftPlankMaterial);
      rightPlank.position.set(doorWidth / 2 - plankWidth / 2 - i * plankWidth, doorHeight / 2, -this.buildingDepth / 2 + 0.25);
      this.mesh.add(rightPlank);
    }

    // Cross bracing
    const braceGeometry = new THREE.BoxGeometry(0.15, 3, 0.1);
    const braceMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.7,
      metalness: 0.1,
    });

    // Horizontal brace
    const horizontalBrace = new THREE.Mesh(braceGeometry, braceMaterial);
    horizontalBrace.position.set(0, doorHeight / 2 + 1, -this.buildingDepth / 2 + 0.25);
    this.mesh.add(horizontalBrace);

    // Vertical brace
    const verticalBrace = new THREE.Mesh(braceGeometry, braceMaterial);
    verticalBrace.position.set(-doorWidth / 2 + 0.2, 0, -this.buildingDepth / 2 + 0.25);
    this.mesh.add(verticalBrace);

    const verticalBrace2 = new THREE.Mesh(braceGeometry, braceMaterial);
    verticalBrace2.position.set(doorWidth / 2 - 0.2, 0, -this.buildingDepth / 2 + 0.25);
    this.mesh.add(verticalBrace2);

    // Door hardware - iron knocker and latch
    // Knocker
    const knockerGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const knockerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xB0B0B0),
      roughness: 0.5,
      metalness: 0.7,
    });
    const knocker = new THREE.Mesh(knockerGeometry, knockerMaterial);
    knocker.position.set(-0.5, 1.5, -this.buildingDepth / 2 + 0.3);
    this.mesh.add(knocker);

    // Latch plate
    const latchGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const latchMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B5A2B),
      roughness: 0.7,
      metalness: 0.1,
    });
    const latch = new THREE.Mesh(latchGeometry, latchMaterial);
    latch.position.set(0, 0.8, -this.buildingDepth / 2 + 0.3);
    this.mesh.add(latch);
  }

  private createSignage(): void {
    // Simple hand-painted signage below the rose window

    // Sign board background
    const signWidth = 4;
    const signHeight = 1;
    const signDepth = 0.3;

    const signGeometry = new THREE.BoxGeometry(signWidth, signHeight, signDepth);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.1,
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 3, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(sign);

    // Hand-painted lettering area
    const letteringWidth = signWidth - 0.3;
    const letteringHeight = signHeight - 0.3;
    const letteringGeometry = new THREE.BoxGeometry(letteringWidth, letteringHeight, 0.2);
    const letteringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xFFD700),
      roughness: 0.9,
      metalness: 0.0,
    });
    const lettering = new THREE.Mesh(letteringGeometry, letteringMaterial);
    lettering.position.set(0, 3.15, -this.buildingDepth / 2 + 0.45);
    this.mesh.add(lettering);

    // Two decorative gas pipes
    const pipeGeometry = new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8);
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.3,
    });

    const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe1.position.set(-signWidth / 2 + 0.2, 2.5, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe1);

    const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe2.position.set(signWidth / 2 - 0.2, 2.5, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe2);
  }

  private createWaterTower(): void {
    // Rooftop water tower on the church
    const towerBaseRadius = 1.5;
    const towerHeight = 3;
    const towerNeckHeight = 1;

    // Tower base
    const baseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 9 + 4 + 0.5 / 2; // Base y + upper section height + half base height
    base.position.z = -this.buildingDepth / 2 + 0.4;
    base.position.x = 0;
    this.mesh.add(base);

    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.8, towerBaseRadius * 0.8, towerHeight, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xA0522D),
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 9 + 4 + 0.5 / 2 + towerHeight / 2;
    body.position.z = -this.buildingDepth / 2 + 0.4;
    body.position.x = 0;
    this.mesh.add(body);

    // Tower neck
    const neckGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.5, towerBaseRadius * 0.3, towerNeckHeight, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 9 + 4 + 0.5 / 2 + towerHeight + towerNeckHeight / 2;
    neck.position.z = -this.buildingDepth / 2 + 0.4;
    neck.position.x = 0;
    this.mesh.add(neck);

    // Tank top
    const tankGeometry = new THREE.BoxGeometry(towerBaseRadius * 0.5, 0.2, towerBaseRadius * 0.5);
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.0,
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.y = 9 + 4 + 0.5 / 2 + towerHeight + towerNeckHeight + 0.1;
    tank.position.z = -this.buildingDepth / 2 + 0.4;
    tank.position.x = 0;
    this.mesh.add(tank);

    // Finial on tank
    const finialGeometry = new THREE.SphereGeometry(towerBaseRadius * 0.2, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 9 + 4 + 0.5 / 2 + towerHeight + towerNeckHeight + 0.1 + towerBaseRadius * 0.2;
    finial.position.z = -this.buildingDepth / 2 + 0.4;
    finial.position.x = 0;
    this.mesh.add(finial);
  }

  private createCourtyard(): void {
    // Small courtyard/grounds around the church

    // Grave markers/headstones
    for (let i = 0; i < 6; i++) {
      const markerGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.2);
      const markerMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B3A2B),
        roughness: 0.8,
        metalness: 0.1,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Random positions around the church
      const angle = (Math.PI * 2 / 6) * i;
      const radius = 5 + Math.random() * 3;
      marker.position.set(
        Math.cos(angle) * radius,
        0.4,
        Math.sin(angle) * radius
      );
      marker.rotation.z = Math.random() * Math.PI;
      this.mesh.add(marker);
    }

    // Simple fence around the courtyard
    const fencePostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
    const fencePostMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.2,
    });

    // Simple picket fence on the front side
    for (let i = 0; i < 8; i++) {
      const fencePost = new THREE.Mesh(fencePostGeometry, fencePostMaterial);
      fencePost.position.set(-6 + i * 1.5, 1, -this.buildingDepth / 2 + 2.1);
      fencePost.rotation.y = Math.PI / 2;
      this.mesh.add(fencePost);
    }

    // Picket tops (pointed)
    for (let i = 0; i < 8; i++) {
      const picketTopGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
      const picketTopMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B4513),
        roughness: 0.7,
        metalness: 0.2,
      });
      const picketTop = new THREE.Mesh(picketTopGeometry, picketTopMaterial);
      picketTop.position.set(-6 + i * 1.5, 1.3, -this.buildingDepth / 2 + 2.1);
      picketTop.rotation.y = Math.PI / 2;
      this.mesh.add(picketTop);
    }
  }
}