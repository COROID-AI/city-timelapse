import * as THREE from 'three';
import { EraData, ERAS } from './eras/eraData';

// NOTE: This file focuses on visual fidelity for the 1965 scene.
// Some TS types from three's Object3D/material are intentionally cast with `as any`
// to keep the build stable under strict mode.

export function create1965Buildings(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.userData.isEraObject = true;

  const era: EraData | undefined = ERAS['1965'] as any;
  if (!era) return group;

  // Base footprint shared with 1945 counterparts (smooth transitions requirement)
  const footprint = {
    w: 20,
    d: 30,
    storyH: 3.5,
    stories: 2,
  };

  // 4 distinct building types
  const renovatedBrick = createRenovatedBrickBuilding(footprint);
  const midRiseOffice = createMidRiseOfficeBuilding(footprint);
  const diner = createDinerBuilding(footprint);
  const departmentStore = createDepartmentStoreBuilding(footprint);

  // Layout inside city block (approx). Keep them in a compact strip.
  renovatedBrick.position.set(-28, 0, 0);
  midRiseOffice.position.set(-6, 0, 0);
  diner.position.set(16, 0, 0);
  departmentStore.position.set(38, 0, 0);

  group.add(renovatedBrick, midRiseOffice, diner, departmentStore);

  // At least 2 emissive neon tube signs with glow (controlled emissiveIntensity)
  addNeonTubeSigns(renovatedBrick, diner);

  // Rooftop AC units visible on rooftops
  addRooftopACUnits(renovatedBrick, midRiseOffice, diner, departmentStore);

  // Intersection street furniture (bus shelter + newspaper boxes)
  addBusStopShelter(scene);
  addNewspaperVendingBoxes(group);

  // Street-level signage style (printed vinyl) is embedded in storefront elements.

  return group;
}

function createRenovatedBrickBuilding(fp: { w: number; d: number; storyH: number; stories: number }) {
  const totalH = fp.storyH * fp.stories;
  const b = new THREE.Group();
  b.userData.isEraObject = true;
  b.userData.buildingStyle = 'renovated_brick';

  const brick = new THREE.MeshStandardMaterial({ color: new THREE.Color('#A5694F'), roughness: 0.7, metalness: 0.25 });
  const concrete = new THREE.MeshStandardMaterial({ color: new THREE.Color('#C0C0C0'), roughness: 0.6, metalness: 0.4 });
  const roof = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2C3E50'), roughness: 0.8, metalness: 0.2 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(fp.w, totalH, fp.d), brick);
  main.position.y = totalH / 2;
  main.castShadow = true;
  main.receiveShadow = true;
  b.add(main);

  // Concrete additions to older brick structures
  const addW = 8;
  const add1 = new THREE.Mesh(new THREE.BoxGeometry(addW, totalH, fp.d), concrete);
  add1.position.set(-(fp.w / 2 + addW / 2) + 0.0, totalH / 2, 0);
  add1.castShadow = true;
  b.add(add1);

  const add2 = new THREE.Mesh(new THREE.BoxGeometry(addW, totalH, fp.d), concrete);
  add2.position.set((fp.w / 2 + addW / 2) - 0.0, totalH / 2, 0);
  add2.castShadow = true;
  b.add(add2);

  // Large plate-glass storefront windows replacing small panes
  const storefrontGlass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.9 });
  const windowPlane = (w: number, h: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), storefrontGlass);
    m.castShadow = true;
    m.rotation.z = Math.PI / 2;
    return m;
  };

  const winW = 3.8;
  const winH = 2.6;
  const spacing = 4.4;
  const cols = Math.max(2, Math.floor(fp.w / spacing));

  for (let i = 0; i < cols; i++) {
    const x = -(fp.w / 2) + 2.2 + i * spacing;
    const w = windowPlane(winW, winH);
    w.position.set(x, fp.storyH / 2, fp.d / 2 + 0.01);
    b.add(w);
  }

  // Printed vinyl signage placeholder (no asset required)
  const vinyl = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.0),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#F8F8FF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.95 })
  );
  vinyl.rotation.z = Math.PI / 2;
  vinyl.position.set(0, totalH - 1.7, fp.d / 2 + 0.02);
  b.add(vinyl);

  // Roof cap (for silhouette)
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(fp.w, 0.2, fp.d), roof);
  roofCap.position.set(0, totalH + 0.1, 0);
  b.add(roofCap);

  return b;
}

function createMidRiseOfficeBuilding(fp: { w: number; d: number; storyH: number; stories: number }) {
  const totalH = fp.storyH * fp.stories;
  const b = new THREE.Group();
  b.userData.isEraObject = true;
  b.userData.buildingStyle = 'mid_rise_office';

  const concrete = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2C3E50'), roughness: 0.6, metalness: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D0D0D0'), roughness: 0.4, metalness: 0.85 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(fp.w, totalH, fp.d), concrete);
  main.position.y = totalH / 2;
  main.castShadow = true;
  main.receiveShadow = true;
  b.add(main);

  // Horizontal window banding characteristic of 1960s offices
  const bandH = 0.25;
  const bandD = 0.12;
  const bandMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#BFC6CE'), roughness: 0.45, metalness: 0.8 });

  for (let i = 1; i < fp.stories; i++) {
    const y = i * fp.storyH;
    const band = new THREE.Mesh(new THREE.BoxGeometry(fp.w, bandH, bandD), bandMat);
    band.position.set(0, y - bandH / 2, fp.d / 2 + bandD / 2);
    band.castShadow = false;
    b.add(band);

    // Glass ribbon
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(fp.w - 4, bandH * 1.8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.05, metalness: 0.02, transparent: true, opacity: 0.9 })
    );
    glass.rotation.z = Math.PI / 2;
    glass.position.set(0, y - 0.02, fp.d / 2 + 0.02);
    b.add(glass);
  }

  // Storefront larger display windows at ground level
  const groundGlass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.9 });
  const winW = 4.0;
  const winH = 2.8;
  const spacing = 4.6;
  const cols = Math.max(2, Math.floor(fp.w / spacing));
  for (let i = 0; i < cols; i++) {
    const x = -(fp.w / 2) + 2.2 + i * spacing;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), groundGlass);
    glass.rotation.z = Math.PI / 2;
    glass.position.set(x, fp.storyH / 2, fp.d / 2 + 0.01);
    b.add(glass);

    const frame = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.2, winH + 0.2), metal);
    frame.rotation.z = Math.PI / 2;
    frame.position.set(x, fp.storyH / 2, fp.d / 2 + 0.03);
    frame.scale.set(1, 1, 1);
    b.add(frame);
  }

  // Printed vinyl signage (early commercial signage)
  const vinyl = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 1.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.95 })
  );
  vinyl.rotation.z = Math.PI / 2;
  vinyl.position.set(0, totalH - 1.7, fp.d / 2 + 0.02);
  b.add(vinyl);

  // Rooftop roof cap
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(fp.w, 0.2, fp.d), new THREE.MeshStandardMaterial({ color: new THREE.Color('#5D4037'), roughness: 0.7, metalness: 0.2 }));
  roofCap.position.set(0, totalH + 0.1, 0);
  b.add(roofCap);

  return b;
}

function createDinerBuilding(fp: { w: number; d: number; storyH: number; stories: number }) {
  const totalH = fp.storyH * fp.stories;
  const b = new THREE.Group();
  b.userData.isEraObject = true;
  b.userData.buildingStyle = 'diner';

  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#B0C4DE'), roughness: 0.4, metalness: 0.95 });
  const chrome = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.15, metalness: 1.0 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(fp.w, totalH, fp.d), steel);
  main.position.y = totalH / 2;
  main.castShadow = true;
  main.receiveShadow = true;
  b.add(main);

  // Classic chrome trim
  const trimT = 0.12;
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(fp.w + trimT * 2, totalH, trimT), chrome);
  topTrim.position.set(0, totalH / 2, -fp.d / 2 - trimT / 2);
  b.add(topTrim);

  const bottomTrim = new THREE.Mesh(new THREE.BoxGeometry(fp.w + trimT * 2, totalH, trimT), chrome);
  bottomTrim.position.set(0, totalH / 2, fp.d / 2 + trimT / 2);
  bottomTrim.rotation.y = Math.PI;
  b.add(bottomTrim);

  // Large plate-glass storefront windows
  const glassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.08, metalness: 0.02, transparent: true, opacity: 0.9 });
  const winW = 4.5;
  const winH = 2.6;
  const spacing = 4.8;
  const cols = Math.max(2, Math.floor(fp.w / spacing));

  for (let i = 0; i < cols; i++) {
    const x = -(fp.w / 2) + 2.3 + i * spacing;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
    win.rotation.z = Math.PI / 2;
    win.position.set(x, fp.storyH / 4, fp.d / 2 + 0.01);
    b.add(win);

    const frame = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.2, winH + 0.2), chrome);
    frame.rotation.z = Math.PI / 2;
    frame.position.set(x, fp.storyH / 4, fp.d / 2 + 0.03);
    b.add(frame);
  }

  // Vinyl signage (printed vinyl)
  const vinyl = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.0),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.95 })
  );
  vinyl.rotation.z = Math.PI / 2;
  vinyl.position.set(0, totalH - 1.7, fp.d / 2 + 0.02);
  b.add(vinyl);

  // Roof cap
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(fp.w, 0.2, fp.d), new THREE.MeshStandardMaterial({ color: new THREE.Color('#8B4513'), roughness: 0.7, metalness: 0.2 }));
  roofCap.position.set(0, totalH + 0.1, 0);
  b.add(roofCap);

  return b;
}

function createDepartmentStoreBuilding(fp: { w: number; d: number; storyH: number; stories: number }) {
  const totalH = fp.storyH * fp.stories;
  const b = new THREE.Group();
  b.userData.isEraObject = true;
  b.userData.buildingStyle = 'department_store';

  const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.9 });
  const aluminum = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D0D0D0'), roughness: 0.45, metalness: 0.6 });

  const facade = new THREE.Mesh(new THREE.BoxGeometry(fp.w, totalH, fp.d), new THREE.MeshStandardMaterial({ color: new THREE.Color('#F7FBFF'), roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.25 }));
  facade.position.y = totalH / 2;
  b.add(facade);

  // Department store large display windows
  const winW = 5.5;
  const winH = 4.2;
  const spacing = 6.4;
  const cols = Math.max(2, Math.floor(fp.w / spacing));

  for (let i = 0; i < cols; i++) {
    const x = -(fp.w / 2) + 2.7 + i * spacing;
    const display = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glass);
    display.rotation.z = Math.PI / 2;
    display.position.set(x, 0.5 * totalH, fp.d / 2 + 0.01);
    b.add(display);

    const frame = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.25, winH + 0.25), aluminum);
    frame.rotation.z = Math.PI / 2;
    frame.position.set(x, 0.5 * totalH, fp.d / 2 + 0.03);
    b.add(frame);
  }

  // Upper windows
  const upperH = 3.1;
  const upperW = 2.8;
  const upperSpacing = 4.2;
  const upperCols = Math.max(2, Math.floor(fp.w / upperSpacing));

  for (let floor = 1; floor < fp.stories; floor++) {
    const y = floor * fp.storyH + fp.storyH / 2;
    for (let i = 0; i < upperCols; i++) {
      const x = -(fp.w / 2) + 1.7 + i * upperSpacing;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(upperW, upperH), glass);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, fp.d / 2 + 0.01);
      b.add(w);
    }
  }

  // Printed vinyl signage
  const vinyl = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 1.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.95 })
  );
  vinyl.rotation.z = Math.PI / 2;
  vinyl.position.set(0, totalH - 1.7, fp.d / 2 + 0.02);
  b.add(vinyl);

  // Roof cap
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(fp.w, 0.2, fp.d), new THREE.MeshStandardMaterial({ color: new THREE.Color('#ECF0F1'), roughness: 0.7, metalness: 0.2 }));
  roofCap.position.set(0, totalH + 0.1, 0);
  b.add(roofCap);

  return b;
}

function addNeonTubeSigns(renovatedBrick: THREE.Object3D, diner: THREE.Object3D) {
  // Controlled emissiveIntensity to avoid bloom overload.
  const makeNeon = (colorHex: string, glowHex: string, w: number, h: number, d: number, emissiveIntensity: number) => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(glowHex),
      emissiveIntensity,
      roughness: 0.25,
      metalness: 0.1,
    });
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  };

  // Renovated brick: orange tube sign on corner
  const neo1 = makeNeon('#FFFFFF', '#F1C40F', 3.0, 1.4, 0.2, 0.55);
  neo1.position.set(0, 5.6, 15.2);
  renovatedBrick.add(neo1);

  // Diner: blue tube sign on roof corner
  const neo2 = makeNeon('#FFFFFF', '#1A5E99', 3.2, 1.5, 0.25, 0.5);
  neo2.position.set(2, 5.6, 15.2);
  diner.add(neo2);
}

function addRooftopACUnits(...buildings: THREE.Object3D[]) {
  buildings.forEach((b) => {
    // Heuristic: place a few AC boxes near the top.
    const topY = 7.0;
    const depthOffset = 15.2;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#B0C4DE'),
      roughness: 0.5,
      metalness: 0.2,
      emissive: new THREE.Color('#1A5E99'),
      emissiveIntensity: 0.08,
    });

    const boxGeo = new THREE.BoxGeometry(1.5, 1.0, 1.0);
    const xs = [-6, -2, 2, 6];
    xs.forEach((x) => {
      const ac = new THREE.Mesh(boxGeo, mat);
      ac.position.set(x, topY, depthOffset);
      (ac as any).castShadow = true;
      b.add(ac);
    });
  });
}

function addBusStopShelter(scene: THREE.Scene) {
  const shelter = new THREE.Group();
  shelter.userData.isEraObject = true;
  shelter.userData.furnitureType = 'bus_stop_shelter';

  const baseW = 3.2;
  const baseD = 2.0;
  const baseH = 2.6;

  const frameMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2C3E50'), roughness: 0.7, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E67E22'), roughness: 0.5, metalness: 0.2 });

  const back = new THREE.Mesh(new THREE.PlaneGeometry(baseW, baseH), frameMat);
  back.position.set(0, baseH / 2, -baseD / 2 - 0.01);
  back.rotation.y = Math.PI / 2;
  shelter.add(back);

  const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, baseH * 0.85), glassMat);
  leftGlass.position.set(-baseW / 2 + 0.2, baseH / 2, baseD / 2);
  leftGlass.rotation.y = Math.PI / 4;
  shelter.add(leftGlass);

  const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, baseH * 0.85), glassMat);
  rightGlass.position.set(baseW / 2 - 0.2, baseH / 2, baseD / 2);
  rightGlass.rotation.y = -Math.PI / 4;
  shelter.add(rightGlass);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(baseW, 0.15, baseD), roofMat);
  roof.position.set(0, baseH + 0.3, 0);
  shelter.add(roof);

  // Printed vinyl ad panel
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.9 }));
  ad.position.set(baseW / 2 - 0.2, baseH / 2, 0.0);
  shelter.add(ad);

  // Place at one intersection corner
  shelter.position.set(0, 0, -50);
  shelter.traverse((o) => {
    (o as any).castShadow = true;
    (o as any).receiveShadow = true;
  });

  scene.add(shelter);
}

function addNewspaperVendingBoxes(buildings: THREE.Group) {
  const boxMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8B4513'), roughness: 0.6, metalness: 0.2 });
  const vinylMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.9 });

  const boxGeo = new THREE.BoxGeometry(0.55, 1.55, 0.35);
  const positions = [
    { x: -8, z: -50 },
    { x: 0, z: -50 },
    { x: 8, z: -50 },
    { x: -8, z: -55 },
  ];

  positions.forEach((p) => {
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(p.x, 0.775, p.z);
    (box as any).castShadow = true;

    const ad = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.85), vinylMat);
    ad.position.set(0, 0.55, 0.18);
    box.add(ad);

    buildings.add(box);
  });
}
