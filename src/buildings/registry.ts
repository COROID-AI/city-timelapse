import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { TextureFactory } from '../util/textures.js';
import { BuildingTextureBuilder, mergeGeometries, buildFacade, buildCornice, buildBayWindow, buildFireEscape, buildStorefront, buildWaterTower, buildTVAntenna, buildSatelliteDish, buildACUnit, buildACBank, buildSolarArray, buildGreenRoof, buildChimney, buildHelipad } from './parts.js';
import type { BuildingSpec } from './specs.js';
import { ERA_BUILDING_MAP } from './specs.js';

// ── Era material palette definitions ──────────────────────────────────

/** Resolve era-specific materials from a BuildingMaterials spec */
export function resolveMaterials(
  spec: BuildingSpec,
  textures: TextureFactory,
  bldgTextures: BuildingTextureBuilder,
): {
  primaryMat: THREE.Material;
  secondaryMat?: THREE.Material;
  windowMat: THREE.Material;
  roofMat?: THREE.Material;
} {
  const matKey = spec.materials.primaryMaterial;

  let primaryMat: THREE.Material;
  switch (matKey) {
    case 'brick_red':
    case 'brick_warm':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createBrick(),
        roughness: 0.85,
        metalness: 0.05,
      });
      break;
    case 'brick_dark':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createBrick(),
        color: 0x6b3a2a,
        roughness: 0.9,
        metalness: 0.02,
      });
      break;
    case 'limestone':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createLimestone(),
        roughness: 0.7,
        metalness: 0.0,
      });
      break;
    case 'beige_plaster':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createPlaster(),
        color: 0xf5deb3,
        roughness: 0.8,
        metalness: 0.0,
      });
      break;
    case 'turquoise_tile':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createConcrete(),
        color: 0x40e0d0,
        roughness: 0.6,
        metalness: 0.1,
      });
      break;
    case 'concrete':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createConcrete(),
        roughness: 0.9,
        metalness: 0.05,
      });
      break;
    case 'metal_panel_gray':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createMetalPanel(256, 0x888888),
        roughness: 0.5,
        metalness: 0.6,
      });
      break;
    case 'metal_panel_dark':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createMetalPanel(256, 0x333333),
        roughness: 0.4,
        metalness: 0.7,
      });
      break;
    case 'metal_panel_beige':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createMetalPanel(256, 0xccaa77),
        roughness: 0.5,
        metalness: 0.5,
      });
      break;
    case 'glass_tinted_brown':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createTintedGlass(256, '#5c4033'),
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      });
      break;
    case 'glass_tinted_smoke':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createTintedGlass(256, '#3a3a3a'),
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.8,
      });
      break;
    case 'glass_tinted_blue':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createTintedGlass(256, '#4a6fa5'),
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      });
      break;
    case 'glass_mirror':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.05,
        metalness: 0.8,
        transparent: true,
        opacity: 0.75,
      });
      break;
    case 'glass_steel':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.15,
        metalness: 0.5,
        transparent: true,
        opacity: 0.7,
      });
      break;
    case 'glass_reflective':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.08,
        metalness: 0.7,
        transparent: true,
        opacity: 0.75,
      });
      break;
    case 'glass_modern':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.1,
        metalness: 0.6,
        transparent: true,
        opacity: 0.65,
      });
      break;
    case 'glass_tinted':
    case 'glass_tinted_green':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createTintedGlass(256, '#2f4f2f'),
        roughness: 0.15,
        metalness: 0.3,
        transparent: true,
        opacity: 0.8,
      });
      break;
    case 'glass_clear':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.2,
        metalness: 0.2,
        transparent: true,
        opacity: 0.6,
      });
      break;
    case 'EIFS_beige':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createEIFS(256, '#c8b89a'),
        roughness: 0.85,
        metalness: 0.0,
      });
      break;
    case 'steel_frame':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createMetalPanel(256, 0x666666),
        roughness: 0.4,
        metalness: 0.8,
      });
      break;
    case 'floor_to_ceiling_glass':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.05,
        metalness: 0.6,
        transparent: true,
        opacity: 0.55,
      });
      break;
    case 'smart_glass':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createGlass(),
        roughness: 0.03,
        metalness: 0.7,
        transparent: true,
        opacity: 0.5,
      });
      break;
    case 'LED_accent':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createLEDAccent(256, '#00ff88'),
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5,
      });
      break;
    case 'green_roof':
      primaryMat = new THREE.MeshStandardMaterial({
        map: bldgTextures.createGreenRoof(),
        roughness: 0.95,
        metalness: 0.0,
      });
      break;
    case 'wood':
      primaryMat = new THREE.MeshStandardMaterial({
        map: textures.createWood(),
        roughness: 0.9,
        metalness: 0.0,
      });
      break;
    default:
      primaryMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.0,
      });
  }

  // Window material
  let windowMat: THREE.Material;
  const winKey = spec.materials.windowMaterial || 'glass_clear';
  if (winKey.includes('tinted') || winKey.includes('mirror')) {
    windowMat = new THREE.MeshStandardMaterial({
      map: textures.createGlass(),
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.6,
      color: 0x8899bb,
    });
  } else {
    windowMat = new THREE.MeshStandardMaterial({
      map: textures.createGlass(),
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.5,
    });
  }

  // Secondary material
  let secondaryMat: THREE.Material | undefined;
  if (spec.materials.secondaryMaterial && spec.materials.secondaryMaterial !== 'none') {
    secondaryMat = new THREE.MeshStandardMaterial({
      map: textures.createConcrete(),
      color: 0xaaaaaa,
      roughness: 0.7,
      metalness: 0.1,
    });
  }

  return { primaryMat, secondaryMat, windowMat };
}

// ── Per-era facade color overrides ────────────────────────────────────

function eraAccentColor(eraId: EraId): number {
  switch (eraId) {
    case '1945': return 0x8B4513; // warm brick red
    case '1965': return 0xff6b35; // mid-century orange/turquoise
    case '1985': return 0x1a0a2e; // dark purple/neon
    case '2005': return 0x888899; // gray steel
    case '2025': return 0x00ff88; // LED green accent
    default: return 0x888888;
  }
}

// ── Main building builder ─────────────────────────────────────────────

/**
 * Build a single building from its spec into a THREE.Group.
 * Returns a group with castShadow/receiveShadow enabled.
 * Static wall geometry is merged for performance.
 */
export function buildBuilding(
  spec: BuildingSpec,
  textures: TextureFactory,
  bldgTextures: BuildingTextureBuilder,
  eraId: EraId,
): THREE.Group | null {
  if (!spec.active) {
    // Return an empty placeholder or demolished lot indicator
    return buildDemolishedLot(spec, textures, bldgTextures, eraId);
  }

  const { width, depth, x, z } = spec.footprint;
  const totalFloors = spec.floors + (spec.retrofits?.addedFloors ?? 0);
  const floorHeight = 3.5; // standard floor-to-floor height
  const buildingHeight = totalFloors * floorHeight;

  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const { primaryMat, secondaryMat: _secondaryMat, windowMat } = resolveMaterials(spec, textures, bldgTextures);

  // ── Core structure: merge all wall panels into one geometry ──────
  const facadeParts = buildFacade({
    width,
    height: buildingHeight,
    depth: 0.5,
    floors: totalFloors,
    windowCols: Math.max(2, Math.floor(width / 2)),
    windowWidth: Math.min(1.4, (width - 1) / Math.max(2, Math.floor(width / 2))),
    windowHeight: floorHeight * 0.65,
    sillHeight: 0.6,
  });

  // Merge wall geometry (non-window parts)
  const wallMerged = mergeGeometries(facadeParts.wallParts);
  if (wallMerged.getAttribute('position').count > 0) {
    const wallMesh = new THREE.Mesh(wallMerged, primaryMat);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);
  }

  // Add window meshes
  for (const win of facadeParts.windowMeshes) {
    win.material = windowMat;
    win.castShadow = false;
    win.receiveShadow = false;
    group.add(win);
  }

  // Merge mullions
  if (facadeParts.mullions.length > 0) {
    const mullionMerged = mergeGeometries(facadeParts.mullions);
    const mullionMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.6,
    });
    const mullionMesh = new THREE.Mesh(mullionMerged, mullionMat);
    mullionMesh.castShadow = true;
    group.add(mullionMesh);
  }

  // ── Cornice at roof line ─────────────────────────────────────────
  const corniceStyle = spec.style === 'artdeco_tower' ? 'artdeco'
    : spec.style === 'warbrick_corner' ? 'classical'
    : 'modern';
  const corniceParts = buildCornice({ width, depth, style: corniceStyle });
  const corniceMerged = mergeGeometries(corniceParts.map(p => ({
    ...p,
    matrix: p.matrix.clone().makeTranslation(0, buildingHeight, 0),
  })));
  if (corniceMerged.getAttribute('position').count > 0) {
    const corniceMat = new THREE.MeshStandardMaterial({
      color: spec.materials.trimColor ? parseInt(spec.materials.trimColor.slice(1), 16) : 0xdddddd,
      roughness: 0.6,
      metalness: 0.1,
    });
    const corniceMesh = new THREE.Mesh(corniceMerged, corniceMat);
    corniceMesh.castShadow = true;
    group.add(corniceMesh);
  }

  // ── Rooftop elements ─────────────────────────────────────────────
  const roofY = buildingHeight;

  if (spec.rooftop.waterTower) {
    const wt = buildWaterTower({});
    wt.position.set(width * 0.2, roofY, depth * 0.1);
    wt.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(wt);
  }

  if (spec.rooftop.chimney) {
    const ch = buildChimney({});
    ch.position.set(-width * 0.3, roofY, -depth * 0.2);
    ch.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(ch);
  }

  if (spec.rooftop.tvAntenna) {
    const ant = buildTVAntenna({});
    ant.position.set(width * 0.1, roofY, -depth * 0.3);
    ant.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(ant);
  }

  if (spec.rooftop.satelliteDish) {
    const dish = buildSatelliteDish({});
    dish.position.set(-width * 0.3, roofY, depth * 0.2);
    dish.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(dish);
  }

  if (spec.rooftop.acUnit) {
    const ac = buildACUnit({});
    ac.position.set(width * 0.25, roofY, depth * 0.25);
    ac.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(ac);
  }

  if (spec.rooftop.acBankCount && spec.rooftop.acBankCount > 0) {
    const acBank = buildACBank({ count: spec.rooftop.acBankCount });
    acBank.position.set(0, roofY, -depth * 0.1);
    acBank.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(acBank);
  }

  if (spec.rooftop.solarPanels) {
    const solar = buildSolarArray({ panels: 6 });
    solar.position.set(0, roofY, -depth * 0.2);
    solar.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(solar);
  }

  if (spec.rooftop.greenRoof) {
    const green = buildGreenRoof({ width: width * 0.7, depth: depth * 0.7 });
    green.position.set(0, roofY, 0);
    green.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(green);
  }

  if (spec.rooftop.helipad) {
    const heli = buildHelipad({ diameter: Math.min(width, depth) * 0.6 });
    heli.position.set(0, roofY, 0);
    heli.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(heli);
  }

  // ── Retrofits ────────────────────────────────────────────────────
  const retrofits = spec.retrofits;

  // Storefront base
  if (retrofits?.storeFront || spec.style === 'retail_strip') {
    const storefront = buildStorefront({ width: width * 0.8, height: floorHeight * 0.8 });
    storefront.glassPanels.forEach(panel => {
      panel.material = windowMat;
      panel.position.z = 0.25;
      panel.castShadow = false;
    });
    const storeMerged = mergeGeometries(storefront.solidParts);
    if (storeMerged.getAttribute('position').count > 0) {
      const sm = new THREE.Mesh(storeMerged, primaryMat);
      sm.castShadow = true;
      sm.receiveShadow = true;
      group.add(sm);
    }
    for (const gp of storefront.glassPanels) {
      group.add(gp);
    }

    // Signage
    if (spec.materials.signageText) {
      const signTex = textures.createTextSign(spec.materials.signageText, eraId);
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: eraId === '1965' || eraId === '1985' || eraId === '2025' ? 0.3 : 0.1,
        roughness: 0.4,
        metalness: 0.0,
      });
      const signGeo = new THREE.PlaneGeometry(width * 0.6, 1.2);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, buildingHeight - 1.5, 0.3);
      group.add(signMesh);
    }
  }

  // Neon sign retrofit
  if (retrofits?.hasNeonSign) {
    const neonGeo = new THREE.BoxGeometry(width * 0.7, 0.3, 0.05);
    const neonMat = new THREE.MeshStandardMaterial({
      color: eraAccentColor(eraId),
      emissive: eraAccentColor(eraId),
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.0,
    });
    const neonMesh = new THREE.Mesh(neonGeo, neonMat);
    neonMesh.position.set(0, buildingHeight - 0.5, 0.35);
    group.add(neonMesh);
  }

  // Fire escape
  if (retrofits?.fireEscape) {
    const fe = buildFireEscape({ width: width * 0.6, floors: totalFloors, floorHeight });
    fe.position.set(width / 2 + 0.3, 0, 0);
    fe.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(fe);
  }

  // Bay windows
  if (retrofits?.bayWindows) {
    const bw = buildBayWindow({ width: 2, depth: 1.2, height: floorHeight * 0.8 });
    bw.position.set(0, floorHeight * 0.5, depth / 2 + 0.6);
    bw.children.forEach(c => { c.castShadow = true; c.receiveShadow = false; });
    group.add(bw);
  }

  // Cladding retrofit visual (add thin overlay layer on facade)
  if (retrofits?.claddingRetrofit) {
    const claddingGeo = new THREE.BoxGeometry(width + 0.1, buildingHeight, 0.15);
    const claddingMat = new THREE.MeshStandardMaterial({
      map: textures.createGlass(),
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.3,
    });
    const claddingMesh = new THREE.Mesh(claddingGeo, claddingMat);
    claddingMesh.position.set(0, buildingHeight / 2, 0.3);
    claddingMesh.castShadow = false;
    claddingMesh.receiveShadow = true;
    group.add(claddingMesh);
  }

  // LED accent strips
  if (retrofits?.ledAccents) {
    const ledColors = [0x00ff88, 0x00ddff, 0xff00ff];
    let lastLedMat: THREE.MeshStandardMaterial | undefined;
    for (let i = 0; i < 3; i++) {
      const ledGeo = new THREE.BoxGeometry(width + 0.2, 0.05, 0.05);
      lastLedMat = new THREE.MeshStandardMaterial({
        color: ledColors[i],
        emissive: ledColors[i],
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.0,
      });
      const ledMesh = new THREE.Mesh(ledGeo, lastLedMat);
      ledMesh.position.set(0, buildingHeight * ((i + 1) / 4), depth / 2 + 0.1);
      group.add(ledMesh);
    }
    // Vertical LED strips on corners
    if (lastLedMat) {
      for (const side of [-1, 1]) {
        const vLedGeo = new THREE.BoxGeometry(0.05, buildingHeight, 0.05);
        const vLed = new THREE.Mesh(vLedGeo, lastLedMat.clone());
        vLed.position.set(side * (width / 2 + 0.025), buildingHeight / 2, depth / 2 + 0.1);
        group.add(vLed);
      }
    }
  }

  // ── Side walls (simplified — just solid boxes for sides) ─────────
  const sideWallH = buildingHeight;
  for (const side of [-1, 1]) {
    const swGeo = new THREE.BoxGeometry(0.3, sideWallH, depth);
    const swMesh = new THREE.Mesh(swGeo, primaryMat);
    swMesh.position.set(side * (width / 2 - 0.15), sideWallH / 2, 0);
    swMesh.castShadow = true;
    swMesh.receiveShadow = true;
    group.add(swMesh);
  }

  // ── Back wall ────────────────────────────────────────────────────
  const backGeo = new THREE.BoxGeometry(width, buildingHeight, 0.3);
  const backMesh = new THREE.Mesh(backGeo, primaryMat);
  backMesh.position.set(0, buildingHeight / 2, -depth / 2 + 0.15);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  group.add(backMesh);

  // ── Roof slab ────────────────────────────────────────────────────
  const roofGeo = new THREE.BoxGeometry(width + 0.2, 0.2, depth + 0.2);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.0,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, buildingHeight + 0.1, 0);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  return group;
}

/** Build a demolished/empty lot indicator */
function buildDemolishedLot(
  spec: BuildingSpec,
  _textures: TextureFactory,
  _bldgTextures: BuildingTextureBuilder,
  _eraId: EraId,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(spec.footprint.x, 0, spec.footprint.z);

  // Empty ground patch
  const groundGeo = new THREE.PlaneGeometry(spec.footprint.width, spec.footprint.depth);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5a5a4a,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  ground.receiveShadow = true;
  group.add(ground);

  // Rubble/debris hints (small scattered boxes)
  const debrisMat = new THREE.MeshStandardMaterial({
    color: 0x777766,
    roughness: 0.9,
    metalness: 0.0,
  });
  for (let i = 0; i < 8; i++) {
    const dSize = 0.1 + Math.random() * 0.3;
    const dGeo = new THREE.BoxGeometry(dSize, dSize, dSize);
    const debris = new THREE.Mesh(dGeo, debrisMat);
    debris.position.set(
      (Math.random() - 0.5) * spec.footprint.width * 0.7,
      dSize / 2,
      (Math.random() - 0.5) * spec.footprint.depth * 0.7,
    );
    debris.rotation.set(Math.random(), Math.random(), Math.random());
    debris.castShadow = true;
    debris.receiveShadow = true;
    group.add(debris);
  }

  // "Demolished" warning tape (thin yellow plane)
  const tapeGeo = new THREE.PlaneGeometry(spec.footprint.width + 2, 0.1);
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const tape = new THREE.Mesh(tapeGeo, tapeMat);
  tape.position.set(0, 0.5, spec.footprint.depth / 2 + 1);
  group.add(tape);

  return group;
}

// ── Era batch builder ─────────────────────────────────────────────────

/**
 * Build all buildings for a given era into a single THREE.Group.
 * Returns null if the era has no active buildings.
 */
export function buildEraBuildings(
  eraId: EraId,
  textures: TextureFactory,
  bldgTextures: BuildingTextureBuilder,
): THREE.Group | null {
  const specs = ERA_BUILDING_MAP[eraId];
  if (!specs) return null;

  const group = new THREE.Group();

  for (const spec of specs) {
    const building = buildBuilding(spec, textures, bldgTextures, eraId);
    if (building) {
      group.add(building);
    }
  }

  return group;
}

// ── Debug dump: compare footprints across eras ────────────────────────

/**
 * Console debug dump comparing building footprints across all eras.
 * Persisting buildings should have identical position/width/depth.
 */
export function debugFootprintComparison(): void {
  console.log('=== Building Footprint Comparison Across Eras ===');
  console.log('Format: building_id → [{era, x, z, width, depth}]');

  // Collect all unique building IDs
  const allIds = new Set<string>();
  for (const eraSpecs of Object.values(ERA_BUILDING_MAP)) {
    for (const spec of eraSpecs) {
      allIds.add(spec.id);
    }
  }

  for (const id of [...allIds].sort()) {
    const entries: Array<{ era: string; x: number; z: number; w: number; d: number }> = [];

    for (const [eraId, eraSpecs] of Object.entries(ERA_BUILDING_MAP)) {
      const spec = eraSpecs.find(s => s.id === id);
      if (spec) {
        entries.push({
          era: eraId,
          x: spec.footprint.x,
          z: spec.footprint.z,
          w: spec.footprint.width,
          d: spec.footprint.depth,
        });
      }
    }

    const footprintStr = entries.map(e => `${e.era}:${e.x.toFixed(1)},${e.z.toFixed(1)}(${e.w}×${e.d})`).join(' → ');
    console.log(`  ${id.padEnd(20)} ${footprintStr}`);
  }

  // Verify persisting buildings match
  console.log('\n--- Persistence Verification ---');
  for (const id of [...allIds].sort()) {
    const footprints: Array<{ era: string; fp: { x: number; z: number; width: number; depth: number } }> = [];

    for (const [eraId, eraSpecs] of Object.entries(ERA_BUILDING_MAP)) {
      const spec = eraSpecs.find(s => s.id === id && s.active);
      if (spec) {
        footprints.push({ era: eraId, fp: spec.footprint });
      }
    }

    if (footprints.length > 1) {
      const ref = footprints[0].fp;
      let matches = true;
      for (const fp of footprints.slice(1)) {
        if (fp.fp.x !== ref.x || fp.fp.z !== ref.z || fp.fp.width !== ref.width || fp.fp.depth !== ref.depth) {
          matches = false;
          break;
        }
      }
      const status = matches ? '✓ MATCH' : '✗ MISMATCH';
      console.log(`  ${status} ${id}: ${footprints.map(f => f.era).join(', ')}`);
    }
  }

  // Note demolitions
  console.log('\n--- Demolition Notes ---');
  const prevEras: EraId[] = ['1945', '1965', '1985', '2005'];
  for (const id of [...allIds].sort()) {
    const history: { era: EraId; active: boolean }[] = [];
    for (const eraId of prevEras) {
      const spec = ERA_BUILDING_MAP[eraId]?.find(s => s.id === id);
      if (spec) {
        history.push({ era: eraId, active: spec.active });
      }
    }

    let wasActive = false;
    for (const h of history) {
      if (wasActive && !h.active) {
        console.log(`  DEMOLISHED between ${h.era} and next: ${id}`);
        break;
      }
      wasActive = h.active;
    }
  }

  // Note retrofits
  console.log('\n--- Retrofit Summary ---');
  for (const eraId of ['1965', '1985', '2005', '2025'] as EraId[]) {
    for (const spec of ERA_BUILDING_MAP[eraId]) {
      if (spec.retrofits && Object.keys(spec.retrofits).length > 0) {
        const retrofitDesc = Object.entries(spec.retrofits)
          .map(([k, v]) => `${k}${v !== true ? `=${v}` : ''}`)
          .join(', ');
        console.log(`  ${eraId} ${spec.id}: ${retrofitDesc}`);
      }
    }
  }
}
