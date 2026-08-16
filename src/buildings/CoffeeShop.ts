/** 
 * CoffeeShop - 2005-era coffee shop chain with outdoor seating area
 * Features:
 * - Modern storefront with automated sliding glass doors
 * - Digital menu boards (interactive display)
 * - Outdoor seating area with tables and umbrellas
 * - LED strip lighting along building edges
 * - Bike racks along sidewalk
 * - Solar panels on rooftop
 * - Green roof sections
 * - Contemporary public art integration
 */
import * as THREE from "three";

export class CoffeeShop {
  public mesh: THREE.Group;
  public era: "2005" = "2005";

  constructor(position: THREE.Vector3 = new THREE.Vector3(-25, 0, -25)) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;

    // Main building
    const buildingGeometry = new THREE.BoxGeometry(30, 18, 20);
    const facadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      metalness: 0.2,
      roughness: 0.4,
    });
    const building = new THREE.Mesh(buildingGeometry, facadeMaterial);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Storefront with display windows
    const storefrontGeometry = new THREE.BoxGeometry(24, 6, 2);
    const storefrontMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
      metalness: 0.1,
      roughness: 0.05,
    });
    const storefront = new THREE.Mesh(storefrontGeometry, storefrontMaterial);
    storefront.position.set(0, 3, 10.01);
    storefront.castShadow = true;
    storefront.receiveShadow = true;
    group.add(storefront);

    // Automated sliding glass doors
    const doorGeometry = new THREE.BoxGeometry(4, 6, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      metalness: 0.01,
      roughness: 0.01,
    });
    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-6, 3, 10.02);
    leftDoor.castShadow = true;
    leftDoor.receiveShadow = true;
    group.add(leftDoor);

    const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    rightDoor.position.set(6, 3, 10.02);
    rightDoor.castShadow = true;
    rightDoor.receiveShadow = true;
    group.add(rightDoor);

    // Outdoor seating area
    const seatingAreaGeometry = new THREE.BoxGeometry(20, 0.5, 20);
    const seatingMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.1,
      roughness: 0.6,
    });
    const seatingArea = new THREE.Mesh(seatingAreaGeometry, seatingMaterial);
    seatingArea.position.set(0, 0.25, -12);
    seatingArea.castShadow = true;
    seatingArea.receiveShadow = true;
    group.add(seatingArea);

    // Umbrellas for outdoor seating
    for (let i = 0; i < 6; i++) {
      const umbrellaGeometry = new THREE.CircleGeometry(2, 32);
      const umbrellaMaterial = new THREE.MeshStandardMaterial({
        color: 0xe74c3c,
        metalness: 0.0,
        roughness: 0.9,
      });
      const umbrella = new THREE.Mesh(umbrellaGeometry, umbrellaMaterial);
      umbrella.position.set(
        -8 + i * 3.5,
        2.5,
        -12 + Math.random() * 3
      );
      umbrella.rotation.x = Math.PI / 2;
      umbrella.castShadow = true;
      umbrella.receiveShadow = true;
      group.add(umbrella);
    }

    // LED strip lighting along building edges
    const ledGeometry = new THREE.BoxGeometry(0.2, 0.1, 27);
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.08,
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
    ledStrip.position.set(0, 9, 0);
    ledStrip.castShadow = true;
    ledStrip.receiveShadow = true;
    group.add(ledStrip);

    // Additional LED strips
    for (const pos of [
      new THREE.Vector3(0, 4, 14),
      new THREE.Vector3(0, 14, -14),
    ]) {
      const ledStrip2 = new THREE.Mesh(ledGeometry, ledMaterial);
      ledStrip2.position.copy(pos);
      ledStrip2.castShadow = true;
      ledStrip2.receiveShadow = true;
      group.add(ledStrip2);
    }

    // Solar panels on rooftop (blue-black PBR material)
    const solarPanelGeometry = new THREE.BoxGeometry(6, 0.2, 4);
    const solarPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x0d0d1a,
      emissiveIntensity: 0.15,
      metalness: 0.4,
      roughness: 0.2,
    });
    const solarPanels = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
    solarPanels.position.set(0, 18.1, 0);
    solarPanels.castShadow = true;
    solarPanels.receiveShadow = true;
    group.add(solarPanels);

    // Digital menu board
    const menuBoardGeometry = new THREE.BoxGeometry(5, 2.5, 0.1);
    const menuBoardMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x3498db,
      emissiveIntensity: 0.5,
      metalness: 0.1,
      roughness: 0.3,
    });
    const menuBoard = new THREE.Mesh(menuBoardGeometry, menuBoardMaterial);
    menuBoard.position.set(0, 8, 10.02);
    menuBoard.castShadow = true;
    menuBoard.receiveShadow = true;
    group.add(menuBoard);

    // Menu board screen
    const screenGeometry = new THREE.PlaneGeometry(4.5, 2);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x3498db,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 8, 10.27);
    screen.castShadow = true;
    screen.receiveShadow = true;
    group.add(screen);

    // Bike racks along sidewalk
    const rackGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.2,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(
        -10 + i * 4,
        0.25,
        -18 + Math.random() * 2
      );
      rack.castShadow = true;
      rack.receiveShadow = true;
      group.add(rack);
    }

    // Green roof section
    const greenRoofGeometry = new THREE.BoxGeometry(20, 0.1, 12);
    const greenRoofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      metalness: 0.1,
      roughness: 0.8,
    });
    const greenRoof = new THREE.Mesh(greenRoofGeometry, greenRoofMaterial);
    greenRoof.position.set(0, 18.05, 0);
    greenRoof.castShadow = true;
    greenRoof.receiveShadow = true;
    group.add(greenRoof);

    // Contemporary public art sculpture
    const artGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const artMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.5,
      roughness: 0.4,
    });
    const artSculpture = new THREE.Mesh(artGeometry, artMaterial);
    artSculpture.position.set(15, 3, 0);
    artSculpture.castShadow = true;
    artSculpture.receiveShadow = true;
    group.add(artSculpture);

    // Tables for outdoor seating
    for (let i = 0; i < 8; i++) {
      const tableGeometry = new THREE.BoxGeometry(2, 0.3, 2);
      const tableMaterial = new THREE.MeshStandardMaterial({
        color: 0xecf0f1,
        metalness: 0.1,
        roughness: 0.5,
      });
      const table = new THREE.Mesh(tableGeometry, tableMaterial);
      table.position.set(
        -8 + i * 2.5,
        0.15,
        -12 + Math.random() * 2
      );
      table.castShadow = true;
      table.receiveShadow = true;
      group.add(table);
    }

    // Chairs for outdoor seating
    for (let i = 0; i < 16; i++) {
      const chairGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.5);
      const chairMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        metalness: 0.1,
        roughness: 0.6,
      });
      const chair = new THREE.Mesh(chairGeometry, chairMaterial);
      chair.position.set(
        -8 + (i % 4) * 2.5,
        0.4,
        -12 + Math.floor(i / 4) * 1.5 + 0.5
      );
      chair.castShadow = true;
      chair.receiveShadow = true;
      group.add(chair);
    }

    this.mesh = group;
  }
}