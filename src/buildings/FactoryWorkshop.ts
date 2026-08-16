import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * FactoryWorkshop - Represents a 1945-era factory/workshop on the edge of the city block
 * Features: red brick facade, monitor roof with water tank, large industrial windows,
 * wooden garage doors, coal chute, smokestack, period-appropriate signage, minimal lighting.
 *
 * Optimized for real-time rendering: max ~30k tris
 */
export class FactoryWorkshop {
  private mesh: THREE.Group;
  private readonly buildingWidth = 15; // meters - wide industrial building
  private readonly buildingDepth = 20; // meters
  private readonly buildingHeight = 25; // meters - tall factory

  constructor(position: THREE.Vector3, era: EraKey = '1945') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'factoryWorkshop';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createMonitorRoof();
    this.createFacade();
    this.createWindows();
    this.createGarageDoors();
    this.createCoalChute();
    this.createSmokestack();
    this.createSignage();
    this.createWaterTower();

    console.log(`FactoryWorkshop created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main factory body - red brick
    const brickColor = new THREE.Color(0x8B3A2B); // Dark red brick

    // Base structure - 2 story base
    const baseGeometry = new THREE.BoxGeometry(this.buildingWidth, 6, this.buildingDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 3;
    this.mesh.add(base);

    // Upper factory section
    const upperGeometry = new THREE.BoxGeometry(this.buildingWidth - 2, 12, this.buildingDepth - 2);
    const upperMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const upper = new THREE.Mesh(upperGeometry, upperMaterial);
    upper.position.y = 3 + 6;
    upper.position.x = 1; // Set back from edge
    upper.position.z = 1;
    this.mesh.add(upper);
  }

  private createMonitorRoof(): void {
    // Monitor (raised) roof structure for factory ventilation
    // 1945 factories often had monitor roofs for natural light and ventilation

    // Main roof
    const roofHeight = 4;
    const roofGeometry = new THREE.BoxGeometry(this.buildingWidth, roofHeight, this.buildingDepth);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D4037),
      roughness: 0.8,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 6 + roofHeight / 2;
    this.mesh.add(roof);

    // Monitor base - raised center section
    const monitorBaseHeight = 2;
    const monitorBaseWidth = this.buildingWidth - 4;
    const monitorBaseDepth = this.buildingDepth - 4;

    const monitorBaseGeometry = new THREE.BoxGeometry(monitorBaseWidth, monitorBaseHeight, monitorBaseDepth);
    const monitorBaseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D4037),
      roughness: 0.8,
      metalness: 0.1,
    });
    const monitorBase = new THREE.Mesh(monitorBaseGeometry, monitorBaseMaterial);
    monitorBase.position.y = 6 + roofHeight / 2 + monitorBaseHeight / 2;
    monitorBase.position.x = this.buildingWidth / 2 - monitorBaseWidth / 2;
    monitorBase.position.z = this.buildingDepth / 2 - monitorBaseDepth / 2;
    this.mesh.add(monitorBase);

    // Monitor side walls (vertical sections)
    const monitorWallHeight = roofHeight + monitorBaseHeight;
    const monitorWallThickness = 1;

    // Front monitor wall
    const frontWallGeometry = new THREE.BoxGeometry(monitorBaseWidth, monitorWallHeight, monitorWallThickness);
    const frontWallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D4037),
      roughness: 0.8,
      metalness: 0.1,
    });
    const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
    frontWall.position.y = 6 + monitorWallHeight / 2;
    frontWall.position.x = this.buildingWidth / 2 - monitorBaseWidth / 2;
    frontWall.position.z = this.buildingDepth / 2 - monitorWallThickness / 2;
    this.mesh.add(frontWall);

    // Back monitor wall
    const backWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
    backWall.position.y = 6 + monitorWallHeight / 2;
    backWall.position.x = this.buildingWidth / 2 - monitorBaseWidth / 2;
    backWall.position.z = -(this.buildingDepth / 2) + monitorWallThickness / 2;
    this.mesh.add(backWall);

    // Side monitor walls
    const sideWallDepth = this.buildingDepth - monitorBaseDepth - monitorWallThickness * 2;
    const sideWallGeometry = new THREE.BoxGeometry(monitorWallThickness, monitorWallHeight, sideWallDepth);
    const sideWallLeft = new THREE.Mesh(sideWallGeometry, frontWallMaterial);
    sideWallLeft.position.x = -(this.buildingWidth / 2) + monitorBaseWidth / 2 + monitorWallThickness / 2;
    sideWallLeft.position.y = 6 + monitorWallHeight / 2;
    sideWallLeft.position.z = 0;
    this.mesh.add(sideWallLeft);

    const sideWallRight = new THREE.Mesh(sideWallGeometry, frontWallMaterial);
    sideWallRight.position.x = (this.buildingWidth / 2) - monitorBaseWidth / 2 - monitorWallThickness / 2;
    sideWallRight.position.y = 6 + monitorWallHeight / 2;
    sideWallRight.position.z = 0;
    this.mesh.add(sideWallRight);

    // Monitor roof ridge
    const ridgeLength = monitorBaseWidth - 2;
    const ridgeGeometry = new THREE.BoxGeometry(ridgeLength, 0.5, monitorWallThickness);
    const ridgeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.7,
      metalness: 0.1,
    });
    const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
    ridge.position.y = 6 + roofHeight + monitorBaseHeight / 2;
    ridge.position.x = this.buildingWidth / 2 - ridgeLength / 2;
    ridge.position.z = 0;
    this.mesh.add(ridge);
  }

  private createFacade(): void {
    // Brick facade details with industrial variation

    // Decorative brick courses (horizontal bands)
    for (let courseIndex = 0; courseIndex < 5; courseIndex++) {
      const course = courseIndex;
      const yPos = 3 + course * 1.5; // Courses spaced vertically

      // Course length spans most of the facade
      const courseGeometry = new THREE.BoxGeometry(this.buildingWidth - 2, 0.2, this.buildingDepth);
      const courseMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B3A2B),
        roughness: 0.8,
        metalness: 0.2,
      });
      const courseMesh = new THREE.Mesh(courseGeometry, courseMaterial);
      courseMesh.position.y = yPos;
      courseMesh.position.z = -(this.buildingDepth / 2) + 0.2;
      this.mesh.add(courseMesh);
    }

    // Window surround variations - industrial style
    // Larger, simpler frames than commercial buildings
    for (let floor = 0; floor < 4; floor++) {
      const yBase = 3 + floor * 4; // 4 floors

      // Two large industrial windows per floor
      const windowXPositions = [-4, 4];

      for (const xPos of windowXPositions) {
        // Window frame - darker metal/iron
        const frameGeometry = new THREE.BoxGeometry(2.5, 3.5, 0.3);
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x3D3D3D),
          roughness: 0.5,
          metalness: 0.4,
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(xPos, yBase + 1.75, -this.buildingDepth / 2 + 0.3);
        this.mesh.add(frame);

        // Window panes - larger panes, industrial style
        const paneCols = 3;
        const paneRows = 2;
        const paneWidth = (2.5 - 0.2) / paneCols;
        const paneHeight = (3.5 - 0.2) / paneRows;

        for (let row = 0; row < paneRows; row++) {
          for (let col = 0; col < paneCols; col++) {
            const paneGeometry = new THREE.BoxGeometry(paneWidth, paneHeight, 0.1);
            const paneMaterial = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x1A1A1A),
              roughness: 0.1,
              metalness: 0.0,
              transparent: true,
              opacity: 0.6,
            });
            const pane = new THREE.Mesh(paneGeometry, paneMaterial);
            pane.position.set(
              xPos - 1.25 + 0.1 + col * (paneWidth + 0.05),
              yBase + 1.75 - 1.75 + row * (paneHeight + 0.05),
              -this.buildingDepth / 2 + 0.15
            );
            this.mesh.add(pane);
          }
        }
      }
    }
  }

  private createWindows(): void {
    // Large multi-pane factory windows - covered in createFacade
    // This method adds supplementary window details
  }

  private createGarageDoors(): void {
    // Large wooden garage/loading doors on the ground floor
    // 3 loading bays on one side, 1 on the other

    const bayWidth = 4;
    const bayHeight = 5;
    const bayDepth = 0.5;

    // Loading bay 1 (left side)
    const bay1Geometry = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
    const bay1Material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D2D23),
      roughness: 0.6,
      metalness: 0.2,
    });
    const bay1 = new THREE.Mesh(bay1Geometry, bay1Material);
    bay1.position.set(-5, bayHeight / 2, -this.buildingDepth / 2 + bayDepth / 2 + 0.1);
    this.mesh.add(bay1);

    // Loading bay 2 (center left)
    const bay2Geometry = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
    const bay2 = new THREE.Mesh(bay1Geometry, bay1Material);
    bay2.position.set(0, bayHeight / 2, -this.buildingDepth / 2 + bayDepth / 2 + 0.1);
    this.mesh.add(bay2);

    // Loading bay 3 (center right)
    const bay3 = new THREE.Mesh(bay2Geometry, bay1Material);
    bay3.position.set(5, bayHeight / 2, -this.buildingDepth / 2 + bayDepth / 2 + 0.1);
    this.mesh.add(bay3);

    // Loading bay 4 (right side)
    const bay4Geometry = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
    const bay4Material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5D2D23),
      roughness: 0.6,
      metalness: 0.2,
    });
    const bay4 = new THREE.Mesh(bay4Geometry, bay4Material);
    bay4.position.set(10, bayHeight / 2, -this.buildingDepth / 2 + bayDepth / 2 + 0.1);
    this.mesh.add(bay4);

    // Door planks for each bay
    for (let i = 0; i < 4; i++) {
      const plankCount = 4;
      const plankWidth = (bayWidth - 0.3) / plankCount;

      for (let j = 0; j < plankCount; j++) {
        const plankGeometry = new THREE.BoxGeometry(plankWidth - 0.03, bayHeight - 0.3, bayDepth - 0.1);
        const plankMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x6B5B4B),
          roughness: 0.7,
          metalness: 0.1,
        });
        const plank = new THREE.Mesh(plankGeometry, plankMaterial);
        plank.position.set(
          -5 + i * (bayWidth + 0.1) + plankWidth / 2 + 0.015 * j,
          bayHeight / 2,
          -this.buildingDepth / 2 + bayDepth / 2 + 0.05
        );
        this.mesh.add(plank);
      }
    }

    // Loading bay doors on right side (similar pattern)
    for (let i = 0; i < 2; i++) {
      const bayPosX = 11 + i * 6;

      const bayGeometry = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
      const bayMaterialClone = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x5D2D23),
        roughness: 0.6,
        metalness: 0.2,
      });
      const bay = new THREE.Mesh(bayGeometry, bayMaterialClone);
      bay.position.set(bayPosX, bayHeight / 2, -this.buildingDepth / 2 + bayDepth / 2 + 0.1);
      this.mesh.add(bay);

      for (let j = 0; j < 4; j++) {
        const plankWidth = (bayWidth - 0.3) / 4;
        const plankGeometry = new THREE.BoxGeometry(plankWidth - 0.03, bayHeight - 0.3, bayDepth - 0.1);
        const plankMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x6B5B4B),
          roughness: 0.7,
          metalness: 0.1,
        });
        const plank = new THREE.Mesh(plankGeometry, plankMaterial);
        plank.position.set(
          bayPosX - bayWidth / 2 + plankWidth / 2 + 0.015 * j,
          bayHeight / 2,
          -this.buildingDepth / 2 + bayDepth / 2 + 0.05
        );
        this.mesh.add(plank);
      }
    }
  }

  private createCoalChute(): void {
    // Coal delivery chute on the side facade
    const chuteWidth = 0.5;
    const chuteHeight = 5;
    const chuteDepth = 0.4;

    const chuteGeometry = new THREE.BoxGeometry(chuteWidth, chuteHeight, chuteDepth);
    const chuteMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.2,
    });
    const chute = new THREE.Mesh(chuteGeometry, chuteMaterial);
    // Position on side of building
    chute.position.set(this.buildingWidth / 2 - 0.7, chuteHeight / 2, 0);
    this.mesh.add(chute);

    // Coal bucket near the chute
    const bucketGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const bucketMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x3D3D3D),
      roughness: 0.7,
      metalness: 0.1,
    });
    const bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
    bucket.position.set(this.buildingWidth / 2 - 0.7, 0.25, -this.buildingDepth / 2 + 0.5);
    this.mesh.add(bucket);
  }

  private createSmokestack(): void {
    // Factory smokestack - iconic 1945 industrial feature
    const stackBaseRadius = 1.5;
    const stackHeight = 15;
    const stackWallThickness = 0.3;

    // Stack base
    const baseGeometry = new THREE.CylinderGeometry(stackBaseRadius, stackBaseRadius, stackWallThickness, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = stackWallThickness / 2;
    base.position.x = this.buildingWidth / 2 - stackBaseRadius + 0.5;
    base.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(base);

    // Stack body - tapered
    const stackSegments = 4;
    for (let i = 0; i < stackSegments; i++) {
      const taperFactor = 1 - (i / stackSegments) * 0.2;
      const currentRadius = stackBaseRadius * taperFactor;
      const segmentHeight = stackHeight / stackSegments;

      const segmentGeometry = new THREE.CylinderGeometry(currentRadius, currentRadius, segmentHeight, 16);
      const segmentMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8B4513),
        roughness: 0.7,
        metalness: 0.1,
      });
      const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
      segment.position.y = stackWallThickness / 2 + segmentHeight / 2 + i * segmentHeight;
      segment.position.x = this.buildingWidth / 2 - currentRadius + 0.5;
      segment.position.z = -(this.buildingDepth / 2) + 0.5;
      this.mesh.add(segment);
    }

    // Stack cap
    const capGeometry = new THREE.BoxGeometry(stackBaseRadius * 0.8, 0.5, stackBaseRadius * 0.8);
    const capMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.1,
    });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = stackWallThickness + stackHeight;
    cap.position.x = this.buildingWidth / 2 - stackBaseRadius * 0.4 + 0.5;
    cap.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(cap);

    // Finial on top
    const finialGeometry = new THREE.SphereGeometry(stackBaseRadius * 0.3, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = stackWallThickness + stackHeight + 0.5 + stackBaseRadius * 0.3;
    finial.position.x = this.buildingWidth / 2 - stackBaseRadius * 0.4 + 0.5;
    finial.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(finial);

    // Platform around the base of smokestack
    const platformGeometry = new THREE.PlaneGeometry(stackBaseRadius * 2, stackBaseRadius * 2);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5A4A3A),
      roughness: 0.8,
      metalness: 0.1,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = stackWallThickness / 2;
    platform.position.x = this.buildingWidth / 2;
    platform.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(platform);
  }

  private createSignage(): void {
    // Simple factory signage - hand-painted on wood
    const signWidth = 3;
    const signHeight = 1;
    const signDepth = 0.3;

    // Sign board
    const signGeometry = new THREE.BoxGeometry(signWidth, signHeight, signDepth);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F1A15),
      roughness: 0.8,
      metalness: 0.1,
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 3.5, -this.buildingDepth / 2 + 0.4);
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
    lettering.position.set(0, 3.65, -this.buildingDepth / 2 + 0.45);
    this.mesh.add(lettering);

    // Gas pipe details
    const pipeGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.3,
    });

    const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe1.position.set(-signWidth / 2 + 0.15, 3.4, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe1);

    const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe2.position.set(signWidth / 2 - 0.15, 3.4, -this.buildingDepth / 2 + 0.4);
    this.mesh.add(pipe2);
  }

  private createWaterTower(): void {
    // Rooftop water tower on the factory
    const towerBaseRadius = 2;
    const towerHeight = 4;
    const towerNeckHeight = 1.5;

    // Tower base
    const baseGeometry = new THREE.CylinderGeometry(towerBaseRadius, towerBaseRadius, 0.8, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 6 + 4 + 0.8 / 2; // Base y + roof height + half base height
    base.position.x = this.buildingWidth / 2 - 1;
    base.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(base);

    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.85, towerBaseRadius * 0.85, towerHeight, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xA0522D),
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 6 + 4 + 0.8 / 2 + towerHeight / 2;
    body.position.x = this.buildingWidth / 2 - 1;
    body.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(body);

    // Tower neck
    const neckGeometry = new THREE.CylinderGeometry(towerBaseRadius * 0.6, towerBaseRadius * 0.35, towerNeckHeight, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.7,
      metalness: 0.1,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 6 + 4 + 0.8 / 2 + towerHeight + towerNeckHeight / 2;
    neck.position.x = this.buildingWidth / 2 - 1;
    neck.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(neck);

    // Tank top
    const tankGeometry = new THREE.BoxGeometry(towerBaseRadius * 0.55, 0.4, towerBaseRadius * 0.55);
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.8,
      metalness: 0.0,
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.y = 6 + 4 + 0.8 / 2 + towerHeight + towerNeckHeight + 0.2;
    tank.position.x = this.buildingWidth / 2 - 1;
    tank.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(tank);

    // Finial
    const finialGeometry = new THREE.SphereGeometry(towerBaseRadius * 0.35, 16, 16);
    const finialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B4513),
      roughness: 0.5,
      metalness: 0.1,
    });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 6 + 4 + 0.8 / 2 + towerHeight + towerNeckHeight + 0.2 + towerBaseRadius * 0.35;
    finial.position.x = this.buildingWidth / 2 - 1;
    finial.position.z = -(this.buildingDepth / 2) + 0.5;
    this.mesh.add(finial);
  }
}