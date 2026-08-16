/** 
 * BoutiqueHotel - 2005-era boutique hotel with modern facade
 * Features:
 * - Modern minimalist facade with warm wood accents
 * - Automated sliding glass doors on retail storefront
 * - Digital menu board integration (for ground floor cafe)
 * - LED strip lighting along building edges
 * - Solar panels on select rooftop areas
 * - Mixed-use: ground floor retail + upper-level residential balconies
 * - Green roof sections
 * - Contemporary public art integration
 */
import * as THREE from "three";

export class BoutiqueHotel {
  public mesh: THREE.Group;
  public era: "2005" = "2005";

  constructor(position: THREE.Vector3 = new THREE.Vector3(25, 0, 0)) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;

    // Main hotel building
    const buildingGeometry = new THREE.BoxGeometry(35, 25, 25);
    // Modern facade with warm wood accent strips
    const facadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      metalness: 0.2,
      roughness: 0.4,
    });
    const building = new THREE.Mesh(buildingGeometry, facadeMaterial);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Warm wood accent strips on facade
    const woodAccentGeometry = new THREE.BoxGeometry(34, 0.3, 1);
    const woodAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574, // warm wood accent
      metalness: 0.1,
      roughness: 0.6,
    });
    for (let i = 0; i < 5; i++) {
      const woodStrip = new THREE.Mesh(woodAccentGeometry, woodAccentMaterial);
      woodStrip.position.set(0, i * 5 + 2.5, 12.5);
      woodStrip.castShadow = true;
      woodStrip.receiveShadow = true;
      group.add(woodStrip);
    }

    // Ground floor retail storefront with automated sliding glass doors
    const storefrontGeometry = new THREE.BoxGeometry(25, 8, 2);
    const storefrontMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
      metalness: 0.1,
      roughness: 0.05,
    });
    const storefront = new THREE.Mesh(storefrontGeometry, storefrontMaterial);
    storefront.position.set(0, 4, 12.51);
    storefront.castShadow = true;
    storefront.receiveShadow = true;
    group.add(storefront);

    // Automated sliding glass doors (entrance)
    const doorGeometry = new THREE.BoxGeometry(4, 7, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      metalness: 0.01,
      roughness: 0.01,
    });
    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-7, 3.5, 12.52);
    leftDoor.castShadow = true;
    leftDoor.receiveShadow = true;
    group.add(leftDoor);

    const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    rightDoor.position.set(7, 3.5, 12.52);
    rightDoor.castShadow = true;
    rightDoor.receiveShadow = true;
    group.add(rightDoor);

    // Balconies on upper levels (mixed-use residential)
    const balconyGeometry = new THREE.BoxGeometry(6, 1, 0.5);
    const balconyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574, // warm wood
      metalness: 0.1,
      roughness: 0.6,
    });
    for (let level = 1; level <= 4; level++) {
      const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
      balcony.position.set(0, level * 5 + 1, 14.5);
      balcony.castShadow = true;
      balcony.receiveShadow = true;
      group.add(balcony);
    }

    // LED strip lighting along building edges (subtle emissive, no bloom)
    const ledGeometry = new THREE.BoxGeometry(0.2, 0.1, 37);
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.08, // Subtle, no bloom
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
    ledStrip.position.set(0, 12.5, 0);
    ledStrip.castShadow = true;
    ledStrip.receiveShadow = true;
    group.add(ledStrip);

    // Additional LED strips
    for (const pos of [
      new THREE.Vector3(0, 5, 16),
      new THREE.Vector3(0, 18, -16),
    ]) {
      const ledStrip2 = new THREE.Mesh(ledGeometry, ledMaterial);
      ledStrip2.position.copy(pos);
      ledStrip2.castShadow = true;
      ledStrip2.receiveShadow = true;
      group.add(ledStrip2);
    }

    // Solar panels on rooftop (blue-black PBR material - at least 2 rooftops requirement)
    const solarPanelGeometry = new THREE.BoxGeometry(8, 0.2, 6);
    const solarPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x0d0d1a,
      emissiveIntensity: 0.15,
      metalness: 0.4,
      roughness: 0.2,
    });
    const solarPanels1 = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
    solarPanels1.position.set(0, 26, 0);
    solarPanels1.castShadow = true;
    solarPanels1.receiveShadow = true;
    group.add(solarPanels1);

    // Second set of solar panels
    const solarPanels2 = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
    solarPanels2.position.set(-12, 26.2, 8);
    solarPanels2.rotation.z = 0.3;
    solarPanels2.castShadow = true;
    solarPanels2.receiveShadow = true;
    group.add(solarPanels2);

    // Digital menu board on ground floor (cafe/restaurant)
    const menuBoardGeometry = new THREE.BoxGeometry(6, 3, 0.1);
    const menuBoardMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x3498db,
      emissiveIntensity: 0.5, // Active digital display
      metalness: 0.1,
      roughness: 0.3,
    });
    const menuBoard = new THREE.Mesh(menuBoardGeometry, menuBoardMaterial);
    menuBoard.position.set(0, 9, 12.52);
    menuBoard.castShadow = true;
    menuBoard.receiveShadow = true;
    group.add(menuBoard);

    // Menu board display screen
    const screenGeometry = new THREE.PlaneGeometry(5.5, 2.5);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x3498db,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 9, 12.85);
    screen.castShadow = true;
    screen.receiveShadow = true;
    group.add(screen);

    // Bike racks at ground level
    const rackGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.2,
      roughness: 0.4,
    });
    for (let i = 0; i < 3; i++) {
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(
        -10 + i * 4,
        0.25,
        -13 + Math.random() * 2
      );
      rack.castShadow = true;
      rack.receiveShadow = true;
      group.add(rack);
    }

    // Green roof section (partial)
    const greenRoofGeometry = new THREE.BoxGeometry(25, 0.1, 15);
    const greenRoofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      metalness: 0.1,
      roughness: 0.8,
    });
    const greenRoof = new THREE.Mesh(greenRoofGeometry, greenRoofMaterial);
    greenRoof.position.set(0, 25.05, 0);
    greenRoof.castShadow = true;
    greenRoof.receiveShadow = true;
    group.add(greenRoof);

    // Contemporary public art sculpture
    const artGeometry = new THREE.CylinderGeometry(1.5, 2, 6, 32);
    const artMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.3,
      roughness: 0.5,
    });
    const artSculpture = new THREE.Mesh(artGeometry, artMaterial);
    artSculpture.position.set(20, 3, 0);
    artSculpture.rotation.x = Math.PI / 2;
    artSculpture.castShadow = true;
    artSculpture.receiveShadow = true;
    group.add(artSculpture);

    // Glass block accents
    const glassBlockGeometry = new THREE.BoxGeometry(0.5, 2, 0.5);
    const glassBlockMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.7,
      metalness: 0.01,
      roughness: 0.01,
    });
    for (let i = 0; i < 6; i++) {
      const glassBlock = new THREE.Mesh(glassBlockGeometry, glassBlockMaterial);
      glassBlock.position.set(
        -14 + i * 3,
        1 + Math.random() * 3,
        13 + Math.random() * 2
      );
      glassBlock.castShadow = true;
      glassBlock.receiveShadow = true;
      group.add(glassBlock);
    }

    this.mesh = group;
  }
}