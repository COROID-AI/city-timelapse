/**
 * Visual Showcase & Verification Scene for Procedural Graphics Library.
 *
 * Mounts interactive 3D displays for:
 * 1. Five Era Palettes side-by-side (1945, 1965, 1985, 2005, 2025)
 * 2. Canvas-generated texture sample gallery (brick, stone, stucco, siding, asphalt, cobblestone, concrete, wood, metal, fabric, glass atlas, painted signage, neon, grime)
 * 3. Architectural Geometry Builders gallery (window grids, cornices, lintels, fire escapes, balconies, doors, roof accessories)
 * 4. 500+ Window InstancedMesh stress test running at steady 60fps
 */

import * as THREE from 'three';
import { ERA_YEARS, MATERIAL_CATEGORIES, type EraYear } from './palettes';
import {
  createEraMaterial,
  createProceduralTexture,
  type ProceduralTextureType,
} from './materials';
import {
  createBeveledBoxGeometry,
  createWindowGridGeometry,
  createCorniceGeometry,
  createLintelGeometry,
  createFireEscapeGeometry,
  createBalconyGeometry,
  createDoorGeometry,
  createRoofAccessoryGeometry,
} from './geometry';
import { createInstancedMesh, populateInstancedGrid } from './instancing';

export interface ShowcaseOptions {
  mountPoint: THREE.Group | THREE.Scene;
}

/**
 * Builds the complete procedural graphics showcase inside a Three.js scene graph.
 */
export function buildGfxShowcase(options: ShowcaseOptions): {
  group: THREE.Group;
  instancedMesh: THREE.InstancedMesh;
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'gfxShowcaseRoot';
  options.mountPoint.add(root);

  // 1. Era Palettes Comparison (5 rows along Z)
  const palettesGroup = new THREE.Group();
  palettesGroup.name = 'eraPalettesShowcase';
  palettesGroup.position.set(-15, 0, 0);
  root.add(palettesGroup);

  const sphereGeom = new THREE.SphereGeometry(0.8, 32, 32);

  ERA_YEARS.forEach((year: EraYear, yearIdx: number) => {
    const eraGroup = new THREE.Group();
    eraGroup.position.set(0, 0, (yearIdx - 2) * 5);
    palettesGroup.add(eraGroup);

    MATERIAL_CATEGORIES.forEach((cat, catIdx) => {
      const mat = createEraMaterial(cat, year);
      const sphere = new THREE.Mesh(sphereGeom, mat);
      sphere.position.set((catIdx - 4) * 2.2, 1.0, 0);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.name = `swatch_${year}_${cat}`;
      eraGroup.add(sphere);
    });
  });

  // 2. Texture Sample Gallery (Flat panels with each texture generator)
  const textureGalleryGroup = new THREE.Group();
  textureGalleryGroup.name = 'textureGalleryShowcase';
  textureGalleryGroup.position.set(15, 0, -10);
  root.add(textureGalleryGroup);

  const textureTypes: ProceduralTextureType[] = [
    'brick',
    'stone',
    'stucco',
    'siding',
    'asphalt',
    'cobblestone',
    'concrete',
    'wood',
    'metal',
    'fabric',
    'windowAtlas',
    'signage',
    'neon',
    'grime',
  ];

  const panelGeom = new THREE.PlaneGeometry(1.8, 1.8);
  textureTypes.forEach((texType, idx) => {
    const tex = createProceduralTexture(texType, { seed: 100 + idx });
    const isNeon = texType === 'neon';
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.5,
      metalness: 0.1,
      emissive: isNeon ? new THREE.Color('#ff2b88') : new THREE.Color(0x000000),
      emissiveIntensity: isNeon ? 1.5 : 0,
      transparent: texType === 'grime',
    });

    const panel = new THREE.Mesh(panelGeom, mat);
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    panel.position.set((col - 3) * 2.2, 2.5 - row * 2.2, 0);
    panel.name = `texPanel_${texType}`;
    textureGalleryGroup.add(panel);
  });

  // 3. Architectural Geometry Builders
  const geomGalleryGroup = new THREE.Group();
  geomGalleryGroup.name = 'geometryBuildersShowcase';
  geomGalleryGroup.position.set(0, 0, -20);
  root.add(geomGalleryGroup);

  const defaultMat = new THREE.MeshStandardMaterial({
    color: 0xd0c8b8,
    roughness: 0.7,
    metalness: 0.1,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.4,
    metalness: 0.8,
  });

  // Beveled Box
  const beveledBox = new THREE.Mesh(createBeveledBoxGeometry({ width: 2, height: 2, depth: 1 }), defaultMat);
  beveledBox.position.set(-10, 1.5, 0);
  geomGalleryGroup.add(beveledBox);

  // Window Grid
  const windowGrid = new THREE.Mesh(createWindowGridGeometry({ rows: 3, columns: 2 }), defaultMat);
  windowGrid.position.set(-6, 1.5, 0);
  geomGalleryGroup.add(windowGrid);

  // Cornice
  const cornice = new THREE.Mesh(createCorniceGeometry({ width: 3.5, tiers: 3 }), defaultMat);
  cornice.position.set(-2, 1.5, 0);
  geomGalleryGroup.add(cornice);

  // Lintel & Pediment
  const lintel = new THREE.Mesh(createLintelGeometry({ pediment: 'triangular' }), defaultMat);
  lintel.position.set(2, 1.5, 0);
  geomGalleryGroup.add(lintel);

  // Balcony
  const balcony = new THREE.Mesh(createBalconyGeometry({ width: 2.5 }), defaultMat);
  balcony.position.set(6, 1.5, 0);
  geomGalleryGroup.add(balcony);

  // Door Assembly
  const door = new THREE.Mesh(createDoorGeometry({ panels: 4, transom: true }), defaultMat);
  door.position.set(10, 1.5, 0);
  geomGalleryGroup.add(door);

  // Fire Escape
  const fireEscape = new THREE.Mesh(createFireEscapeGeometry({ stories: 2 }), ironMat);
  fireEscape.position.set(-8, 1.5, 8);
  geomGalleryGroup.add(fireEscape);

  // Roof Accessories
  const hvac = new THREE.Mesh(createRoofAccessoryGeometry({ type: 'hvac' }), ironMat);
  hvac.position.set(-2, 1.0, 8);
  geomGalleryGroup.add(hvac);

  const waterTower = new THREE.Mesh(createRoofAccessoryGeometry({ type: 'water-tower' }), defaultMat);
  waterTower.position.set(4, 1.0, 8);
  geomGalleryGroup.add(waterTower);

  // 4. 500+ Window Instances Stress Test
  const instancedWindowGeom = createWindowGridGeometry({ width: 1.0, height: 1.5, rows: 2, columns: 2 });
  const instancedWindowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.2,
  });

  const instancedMesh = createInstancedMesh({
    geometry: instancedWindowGeom,
    material: instancedWindowMat,
    count: 500,
    name: 'showcaseWindowInstancedMesh',
    dynamic: false,
    colors: true,
  });

  populateInstancedGrid({
    mesh: instancedMesh,
    rows: 20,
    columns: 25,
    spacingX: 1.6,
    spacingY: 2.2,
    origin: [0, 2, 20],
    colorFn: (r, c) => ((r + c) % 3 === 0 ? '#ffda73' : (r + c) % 3 === 1 ? '#4997d0' : '#d8d8d8'),
  });

  root.add(instancedMesh);

  const dispose = (): void => {
    root.removeFromParent();
    beveledBox.geometry.dispose();
    windowGrid.geometry.dispose();
    cornice.geometry.dispose();
    lintel.geometry.dispose();
    balcony.geometry.dispose();
    door.geometry.dispose();
    fireEscape.geometry.dispose();
    hvac.geometry.dispose();
    waterTower.geometry.dispose();
    sphereGeom.dispose();
    panelGeom.dispose();
    instancedWindowGeom.dispose();
  };

  return { group: root, instancedMesh, dispose };
}
