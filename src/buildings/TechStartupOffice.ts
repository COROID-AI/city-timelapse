/** 
 * TechStartupOffice - 2005-era tech startup office with glass entrance
 * Features:
 * - Glass entrance with automated sliding doors
 * - LED strip lighting along building edges
 * - Solar panels on rooftop
 * - Digital menu boards / tech branding
 * - Bike racks along sidewalk
 * - Green roof sections
 * - Contemporary public art integration
 * - Mixed-use design with modern aesthetics
 */
import * as THREE from "three";

export class TechStartupOffice {
  public mesh: THREE.Group;
  public era: "2005" = "2005";

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 25)) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;

    // Main office building - glass and steel modern design
    const buildingGeometry = new THREE.BoxGeometry(30, 22, 20);
    // Glass facade material
    const glassFacadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.95,
      metalness: 0.4,
      roughness: 0.1,
    });
    const building = new THREE.Mesh(buildingGeometry, glassFacadeMaterial);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Structural steel frame accents
    const steelGeometry = new THREE.BoxGeometry(29.5, 0.5, 19.5);
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x7f8c8d,
      metalness: 0.8,
      roughness: 0.3,
    });
    const steelFrame = new THREE.Mesh(steelGeometry, steelMaterial);
    steelFrame.position.set(0, 11, 0);
    steelFrame.castShadow = true;
    steelFrame.receiveShadow = true;
    group.add(steelFrame);

    // Glass entrance with automated sliding doors
    const entranceGeometry = new THREE.BoxGeometry(8, 10, 0.2);
    const entranceMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.97,
      metalness: 0.01,
      roughness: 0.01,
    });
    const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
    entrance.position.set(0, 5, 10.1);
    entrance.castShadow = true;
    entrance.receiveShadow = true;
    group.add(entrance);

    // Door panels (glass sections)
    for (let i = 0; i < 4; i++) {
      const doorPanelGeometry = new THREE.BoxGeometry(1.5, 3.5, 0.1);
      const doorPanelMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        metalness: 0.01,
        roughness: 0.01,
      });
      const doorPanel = new THREE.Mesh(doorPanelGeometry, doorPanelMaterial);
      doorPanel.position.set(-3 + i * 2.5, 5.5, 10.11);
      doorPanel.castShadow = true;
      doorPanel.receiveShadow = true;
      group.add(doorPanel);
    }

    // LED strip lighting along building edges (subtle emissive, no bloom)
    const ledGeometry = new THREE.BoxGeometry(0.2, 0.1, 28);
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.08, // Subtle, no bloom
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
    ledStrip.position.set(0, 11, 0);
    ledStrip.castShadow = true;
    ledStrip.receiveShadow = true;
    group.add(ledStrip);

    // Additional LED strips on facade accents
    for (const pos of [
      new THREE.Vector3(0, 5, 14),
      new THREE.Vector3(0, 16, -14),
    ]) {
      const ledStrip2 = new THREE.Mesh(ledGeometry, ledMaterial);
      ledStrip2.position.copy(pos);
      ledStrip2.castShadow = true;
      ledStrip2.receiveShadow = true;
      group.add(ledStrip2);
    }

    // Solar panels on rooftop (blue-black PBR material - required: at least 2 rooftops)
    const solarPanelGeometry = new THREE.BoxGeometry(7, 0.2, 5);
    const solarPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x0d0d1a,
      emissiveIntensity: 0.15,
      metalness: 0.4,
      roughness: 0.2,
    });
    const solarPanels = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
    solarPanels.position.set(0, 22.1, 0);
    solarPanels.castShadow = true;
    solarPanels.receiveShadow = true;
    group.add(solarPanels);

    // Digital display/tech branding on facade
    const digitalDisplayGeometry = new THREE.BoxGeometry(4, 2, 0.1);
    const digitalDisplayMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x3498db,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.3,
    });
    const digitalDisplay = new THREE.Mesh(digitalDisplayGeometry, digitalDisplayMaterial);
    digitalDisplay.position.set(-12, 6, 9.5);
    digitalDisplay.castShadow = true;
    digitalDisplay.receiveShadow = true;
    group.add(digitalDisplay);

    // Display screen with tech branding emissive
    const displayScreenGeometry = new THREE.PlaneGeometry(3.5, 1.5);
    const displayScreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x3498db,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    const displayScreen = new THREE.Mesh(displayScreenGeometry, displayScreenMaterial);
    displayScreen.position.set(-12, 6.5, 9.75);
    displayScreen.castShadow = true;
    displayScreen.receiveShadow = true;
    group.add(displayScreen);

    // Bike racks along sidewalk
    const rackGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.2,
      roughness: 0.4,
    });
    for (let i = 0; i < 3; i++) {
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(
        -8 + i * 5,
        0.25,
        25 + Math.random() * 2
      );
      rack.castShadow = true;
      rack.receiveShadow = true;
      group.add(rack);
    }

    // Green roof section (partial)
    const greenRoofGeometry = new THREE.BoxGeometry(22, 0.1, 16);
    const greenRoofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      metalness: 0.1,
      roughness: 0.8,
    });
    const greenRoof = new THREE.Mesh(greenRoofGeometry, greenRoofMaterial);
    greenRoof.position.set(0, 22.05, 0);
    greenRoof.castShadow = true;
    greenRoof.receiveShadow = true;
    group.add(greenRoof);

    // Contemporary public art sculpture
    const artGeometry = new THREE.OctahedronGeometry(2, 0);
    const artMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.6,
      roughness: 0.4,
    });
    const artSculpture = new THREE.Mesh(artGeometry, artMaterial);
    artSculpture.position.set(-20, 4, 0);
    artSculpture.castShadow = true;
    artSculpture.receiveShadow = true;
    group.add(artSculpture);

    // Modern planters with greenery
    for (let i = 0; i < 4; i++) {
      const planterGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const planterMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        metalness: 0.1,
        roughness: 0.5,
      });
      const planter = new THREE.Mesh(planterGeometry, planterMaterial);
      planter.position.set(
        -12 + i * 4,
        0.75,
        -8 + Math.random() * 4
      );
      planter.castShadow = true;
      planter.receiveShadow = true;
      group.add(planter);
    }

    // Glass block accents
    const glassBlockGeometry = new THREE.BoxGeometry(0.5, 2, 0.5);
    const glassBlockMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.8,
      metalness: 0.01,
      roughness: 0.01,
    });
    for (let i = 0; i < 6; i++) {
      const glassBlock = new THREE.Mesh(glassBlockGeometry, glassBlockMaterial);
      glassBlock.position.set(
        -10 + i * 3,
        1 + Math.random() * 3,
        -6 + Math.random() * 4
      );
      glassBlock.castShadow = true;
      glassBlock.receiveShadow = true;
      group.add(glassBlock);
    }

    this.mesh = group;
  }
}