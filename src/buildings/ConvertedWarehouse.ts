/** 
 * ConvertedWarehouse - 2005-era converted warehouse with industrial-chic loft conversions
 * Features: 
 * - Industrial architecture with preserved structural elements
 * - Loft-style residential conversions with large windows
 * - Solar panels on rooftop (blue-black PBR material)
 * - LED strip lighting along building edges
 * - Bike racks at ground level
 * - Green roof section
 * - Contemporary public art integration
 */
import * as THREE from "three";

export class ConvertedWarehouse {
  public mesh: THREE.Group;
  public era: "2005" = "2005";

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.isEraObject = true;

    // Main warehouse structure
    const warehouseGeometry = new THREE.BoxGeometry(40, 20, 20);
    const warehouseMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.3,
      roughness: 0.7,
    });
    const warehouse = new THREE.Mesh(warehouseGeometry, warehouseMaterial);
    warehouse.castShadow = true;
    warehouse.receiveShadow = true;
    group.add(warehouse);

    // Industrial structural elements (exposed beams)
    const beamGeometry = new THREE.BoxGeometry(3.5, 0.5, 3.5);
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.5,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(
        (i % 2 === 0 ? -15 : 15) * (i < 2 ? 1 : -1),
        10,
        i < 2 ? -8 : 8
      );
      beam.castShadow = true;
      beam.receiveShadow = true;
      group.add(beam);
    }

    // Loft-style windows (floor-to-ceiling on upper levels)
    const windowGeometry = new THREE.PlaneGeometry(4, 3);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.9,
      metalness: 0.1,
      roughness: 0.05,
    });
    for (let floor = 0; floor < 4; floor++) {
      for (let side = 0; side < 2; side++) {
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(
          side === 0 ? -18 : 18,
          floor * 4 + 2,
          (side === 0 ? -8 : 8) + (Math.random() - 0.5) * 2
        );
        window.rotation.z = side === 0 ? Math.PI / 2 : -Math.PI / 2;
        window.castShadow = true;
        window.receiveShadow = true;
        group.add(window);
      }
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
    solarPanels.position.set(0, 21, 0);
    solarPanels.castShadow = true;
    solarPanels.receiveShadow = true;
    group.add(solarPanels);

    // LED strip lighting along building edges (subtle emissive, no bloom)
    const ledGeometry = new THREE.BoxGeometry(0.2, 0.1, 42);
    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.08, // Subtle, no bloom
      metalness: 0.1,
      roughness: 0.3,
    });
    const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
    ledStrip.position.set(0, 10, 0);
    ledStrip.castShadow = true;
    ledStrip.receiveShadow = true;
    group.add(ledStrip);

    // Additional LED strips on other edges
    for (const pos of [
      new THREE.Vector3(0, 5, 21),
      new THREE.Vector3(0, 15, -21),
    ]) {
      const ledStrip2 = new THREE.Mesh(ledGeometry, ledMaterial);
      ledStrip2.position.copy(pos);
      ledStrip2.castShadow = true;
      ledStrip2.receiveShadow = true;
      group.add(ledStrip2);
    }

    // Bike racks at ground level
    const rackGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.2,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(
        (i % 2 === 0 ? -12 : 12) + (Math.random() - 0.5) * 1,
        0.25,
        -10 + i * 3
      );
      rack.castShadow = true;
      rack.receiveShadow = true;
      group.add(rack);
    }

    // Green roof section (partial)
    const greenRoofGeometry = new THREE.BoxGeometry(30, 0.1, 18);
    const greenRoofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      metalness: 0.1,
      roughness: 0.8,
    });
    const greenRoof = new THREE.Mesh(greenRoofGeometry, greenRoofMaterial);
    greenRoof.position.set(0, 20.05, 0);
    greenRoof.castShadow = true;
    greenRoof.receiveShadow = true;
    group.add(greenRoof);

    // Contemporary public art sculpture
    const artGeometry = new THREE.SphereGeometry(2, 32, 32);
    const artMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.5,
      roughness: 0.4,
    });
    const artSculpture = new THREE.Mesh(artGeometry, artMaterial);
    artSculpture.position.set(-20, 5, 0);
    artSculpture.castShadow = true;
    artSculpture.receiveShadow = true;
    group.add(artSculpture);

    // Glass block accents
    const glassBlockGeometry = new THREE.BoxGeometry(0.5, 3, 0.5);
    const glassBlockMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.7,
      metalness: 0.01,
      roughness: 0.01,
    });
    for (let i = 0; i < 8; i++) {
      const glassBlock = new THREE.Mesh(glassBlockGeometry, glassBlockMaterial);
      glassBlock.position.set(
        -18 + i * 3,
        2 + Math.random() * 4,
        -9 + Math.random() * 4
      );
      glassBlock.castShadow = true;
      glassBlock.receiveShadow = true;
      group.add(glassBlock);
    }

    this.mesh = group;
  }
}