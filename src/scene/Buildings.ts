import * as THREE from 'three';
import type { EraConfig, BuildingStyle, SignConfig } from '../config/eras';
import { makeFacade, makeSign, makeGrass, shadeHex } from '../utils/textures';
import { hash, pick } from '../utils/math';

// ============================================================================
// Building factory. Creates era-specific buildings with facades, roofs,
// setbacks, ground-floor storefronts, and rooftop/sidewall billboards.
// Every building group has `userData.buildingInfo` for raycast info cards.
// ============================================================================

export interface BuildingInfo {
  name: string;
  year: number;
  style: string;
  height: number;
  floors: number;
  description: string;
}

export interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
}

export const LOTS: Lot[] = [
  // West side front row (faces the main road at x=0)
  { x: -19, z: -21, w: 12, d: 11 },
  { x: -19, z: -7, w: 12, d: 11 },
  { x: -19, z: 7, w: 12, d: 11 },
  { x: -19, z: 21, w: 12, d: 11 },
  // East side front row
  { x: 19, z: -21, w: 12, d: 11 },
  { x: 19, z: -7, w: 12, d: 11 },
  { x: 19, z: 7, w: 12, d: 11 },
  { x: 19, z: 21, w: 12, d: 11 },
  // West back row
  { x: -33, z: -14, w: 12, d: 14 },
  { x: -33, z: 14, w: 12, d: 14 },
  // East back row
  { x: 33, z: -14, w: 12, d: 14 },
  { x: 33, z: 14, w: 12, d: 14 },
];

// which side the storefront/billboard faces (toward the road)
function facingX(lot: Lot): number {
  return lot.x < 0 ? 1 : -1; // west lots face +X (toward road), east lots face -X
}

const STORE_NAMES = [
  'Atlas Building', 'Mercer House', 'The Vanguard', 'Liberty Tower',
  'Crown Hall', 'Pioneer Block', 'Heritage Court', 'Summit Place',
  'The Foundry', 'Beacon Lofts', 'Grand Central', 'Riverside Plaza',
];

export function buildCityBuildings(era: EraConfig, eraIndex: number): { group: THREE.Group; buildings: { mesh: THREE.Object3D; info: BuildingInfo }[] } {
  const group = new THREE.Group();
  group.name = `buildings-${era.year}`;
  const buildings: { mesh: THREE.Object3D; info: BuildingInfo }[] = [];
  const bs = era.building;

  LOTS.forEach((lot, i) => {
    const b = makeBuilding(lot, bs, era, eraIndex, i);
    group.add(b.group);
    buildings.push({ mesh: b.group, info: b.info });
  });

  return { group, buildings };
}

function makeBuilding(
  lot: Lot,
  bs: BuildingStyle,
  era: EraConfig,
  eraIndex: number,
  lotIndex: number,
): { group: THREE.Group; info: BuildingInfo } {
  const group = new THREE.Group();
  group.position.set(lot.x, 0, lot.z);

  // Deterministic height from era range
  const seed = lotIndex * 137 + eraIndex * 977;
  const heightF = hash(seed) * 0.7 + hash(seed + 3) * 0.3;
  const height = bs.minH + heightF * (bs.maxH - bs.minH);
  const floors = Math.max(2, Math.round(height / 3.2));
  const w = lot.w;
  const d = lot.d;

  const baseColor = pick(bs.baseColors, seed);
  const cols = Math.max(2, Math.round(w / 2.5));
  const rows = Math.max(2, floors);

  // Facade texture
  const facade = makeFacade({
    style: bs.windowStyle,
    baseColor,
    trimColor: bs.trimColor,
    windowColor: bs.windowColor,
    windowEmissive: bs.windowEmissive,
    emissiveInt: bs.windowEmissiveInt,
    accent: bs.accent,
    cols,
    rows,
    litChance: 0.3 + hash(seed + 7) * 0.25,
    seed,
  });

  // Main body material — one texture per face direction via cloning
  const bodyMat = new THREE.MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.emissive,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1,
    roughness: bs.windowStyle === 'curtain' || bs.windowStyle === 'holographic' ? 0.25 : 0.8,
    metalness: bs.windowStyle === 'curtain' ? 0.6 : bs.windowStyle === 'holographic' ? 0.5 : 0.1,
    transparent: true,
    opacity: 1,
  });

  // Repeat texture to match building proportions
  const sideMat = bodyMat.clone();
  sideMat.map = facade.map.clone();
  sideMat.map.wrapS = THREE.RepeatWrapping;
  sideMat.map.wrapT = THREE.RepeatWrapping;
  sideMat.map.repeat.set(Math.max(1, d / 3), rows);
  sideMat.map.needsUpdate = true;
  sideMat.emissiveMap = facade.emissive.clone();
  sideMat.emissiveMap.wrapS = THREE.RepeatWrapping;
  sideMat.emissiveMap.wrapT = THREE.RepeatWrapping;
  sideMat.emissiveMap.repeat.set(Math.max(1, d / 3), rows);
  sideMat.emissiveMap.needsUpdate = true;

  const frontMat = bodyMat.clone();
  frontMat.map = facade.map.clone();
  frontMat.map.wrapS = THREE.RepeatWrapping;
  frontMat.map.wrapT = THREE.RepeatWrapping;
  frontMat.map.repeat.set(Math.max(1, w / 3), rows);
  frontMat.map.needsUpdate = true;
  frontMat.emissiveMap = facade.emissive.clone();
  frontMat.emissiveMap.wrapS = THREE.RepeatWrapping;
  frontMat.emissiveMap.wrapT = THREE.RepeatWrapping;
  frontMat.emissiveMap.repeat.set(Math.max(1, w / 3), rows);
  frontMat.emissiveMap.needsUpdate = true;

  const roofMat = new THREE.MeshStandardMaterial({
    color: shadeHex(baseColor, 0.7),
    roughness: 0.9,
    transparent: true,
    opacity: 1,
  });

  const groundFloorMat = new THREE.MeshStandardMaterial({
    color: bs.groundFloorColor,
    roughness: 0.7,
    transparent: true,
    opacity: 1,
  });

  const mats = [sideMat, sideMat, roofMat, groundFloorMat, frontMat, frontMat];

  const bodyGeo = new THREE.BoxGeometry(w, height, d);
  const body = new THREE.Mesh(bodyGeo, mats);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'building-body';
  body.userData.isBuilding = true;
  group.add(body);

  // Setback / tiered upper section
  if (bs.setBack && height > 15) {
    const sbH = height * 0.25;
    const sbW = w * 0.7;
    const sbD = d * 0.7;
    const sbMat = bodyMat.clone();
    sbMat.map = facade.map.clone();
    sbMat.map.wrapS = THREE.RepeatWrapping;
    sbMat.map.wrapT = THREE.RepeatWrapping;
    sbMat.map.repeat.set(Math.max(1, sbW / 3), Math.round(sbH / 3));
    sbMat.map.needsUpdate = true;
    sbMat.emissiveMap = facade.emissive.clone();
    sbMat.emissiveMap.wrapS = THREE.RepeatWrapping;
    sbMat.emissiveMap.wrapT = THREE.RepeatWrapping;
    sbMat.emissiveMap.repeat.set(Math.max(1, sbW / 3), Math.round(sbH / 3));
    sbMat.emissiveMap.needsUpdate = true;
    const sb = new THREE.Mesh(new THREE.BoxGeometry(sbW, sbH, sbD), sbMat);
    sb.position.y = height + sbH / 2;
    sb.castShadow = true;
    sb.userData.isBuilding = true;
    group.add(sb);
  }

  // Roof details
  addRoof(group, bs.roofType, w, d, height, baseColor, era, seed);

  // Ground floor storefront + awning
  addStorefront(group, era, w, d, height, lotIndex, facingX(lot));

  // Billboards
  addBillboards(group, era, w, d, height, lotIndex, facingX(lot));

  // Building info for raycast
  const info: BuildingInfo = {
    name: STORE_NAMES[lotIndex % STORE_NAMES.length],
    year: era.year,
    style: getStyleLabel(eraIndex),
    height: Math.round(height),
    floors,
    description: getDescription(eraIndex, era),
  };
  group.userData.buildingInfo = info;
  group.userData.isBuilding = true;

  return { group, info };
}

function getStyleLabel(eraIndex: number): string {
  return ['Brick Tenement', 'Mid-Century Modern', 'Glass Tower', 'Contemporary', 'Eco-Tower', 'Holographic Spire'][eraIndex] ?? 'Building';
}

function getDescription(eraIndex: number, era: EraConfig): string {
  switch (eraIndex) {
    case 0: return `Classic ${era.year} brick construction with sash windows and a rooftop water tank. Home to mom-and-pop shops.`;
    case 1: return `${era.year} mid-century modernism: ribbon windows, pastel panels, and a clean flat roofline.`;
    case 2: return `${era.year} mirrored curtain-wall tower — all glass, all chrome, all excess.`;
    case 3: return `${era.year} precast concrete and digital signage. Beige, efficient, Wi-Fi ready.`;
    case 4: return `${era.year} eco-tower with a living green roof and smart-glass facade. Net-zero certified.`;
    case 5: return `${era.year} holographic spire: adaptive nanite facade, anti-grav foundation, neural-linked signage.`;
    default: return `A building from ${era.year}.`;
  }
}

// ---------------------------------------------------------------------------
// Roof details per era
// ---------------------------------------------------------------------------
function addRoof(
  group: THREE.Group,
  type: string,
  w: number,
  d: number,
  h: number,
  baseColor: string,
  era: EraConfig,
  seed: number,
): void {
  const roofY = h + (era.building.setBack && h > 15 ? h * 0.25 : 0);

  if (type === 'water') {
    // Water tank on legs (1945)
    const tankMat = new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.9, transparent: true, opacity: 1 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 10), tankMat);
    tank.position.set(hash(seed) * (w - 4) - (w - 4) / 2, roofY + 3, hash(seed + 1) * (d - 4) - (d - 4) / 2);
    tank.castShadow = true;
    tank.userData.isBuilding = true;
    group.add(tank);
    // conical top
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1, 10), tankMat);
    cone.position.copy(tank.position);
    cone.position.y += 1.5;
    cone.userData.isBuilding = true;
    group.add(cone);
    // cornice
    addCornice(group, w, d, h, baseColor);
  } else if (type === 'flat') {
    // AC units / parapet (1965/1985/2005)
    const unitMat = new THREE.MeshStandardMaterial({ color: '#6a6a6a', roughness: 0.7, transparent: true, opacity: 1 });
    const numUnits = 1 + Math.floor(hash(seed) * 3);
    for (let i = 0; i < numUnits; i++) {
      const uw = 1.5 + hash(seed + i * 10) * 1;
      const ud = 1.5 + hash(seed + i * 10 + 5) * 1;
      const uh = 0.8 + hash(seed + i * 10 + 9) * 0.6;
      const unit = new THREE.Mesh(new THREE.BoxGeometry(uw, uh, ud), unitMat);
      unit.position.set(
        hash(seed + i * 3) * (w - 3) - (w - 3) / 2,
        roofY + uh / 2 + 0.2,
        hash(seed + i * 7) * (d - 3) - (d - 3) / 2,
      );
      unit.castShadow = true;
      unit.userData.isBuilding = true;
      group.add(unit);
    }
    // parapet
    const parapetMat = new THREE.MeshStandardMaterial({ color: shadeHex(baseColor, 0.85), roughness: 0.8, transparent: true, opacity: 1 });
    const ph = 0.5;
    for (const [pw, pd, px, pz] of [[w, ph, 0, d / 2 - ph / 2], [w, ph, 0, -d / 2 + ph / 2], [ph, d, w / 2 - ph / 2, 0], [ph, d, -w / 2 + ph / 2, 0]] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), parapetMat);
      p.position.set(px, roofY + ph / 2 + 0.1, pz);
      p.userData.isBuilding = true;
      group.add(p);
    }
    // antenna for 1985
    if (era.year === 1985) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 6), unitMat);
      ant.position.set(w / 4, roofY + 2, d / 4);
      ant.userData.isBuilding = true;
      group.add(ant);
    }
  } else if (type === 'green') {
    // Green roof with grass + planters (2025)
    const grass = makeGrass();
    const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1, transparent: true, opacity: 1 });
    grass.repeat.set(Math.max(1, w / 3), Math.max(1, d / 3));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.4, d - 1), grassMat);
    roof.position.y = roofY + 0.3;
    roof.receiveShadow = true;
    roof.userData.isBuilding = true;
    group.add(roof);
    // solar panels
    const panelMat = new THREE.MeshStandardMaterial({ color: '#1a2a4a', roughness: 0.3, metalness: 0.7, transparent: true, opacity: 1 });
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2), panelMat);
      panel.position.set(hash(seed + i * 11) * (w - 6) - (w - 6) / 2, roofY + 0.8, hash(seed + i * 13) * (d - 6) - (d - 6) / 2);
      panel.rotation.x = -0.3;
      panel.castShadow = true;
      panel.userData.isBuilding = true;
      group.add(panel);
    }
  } else if (type === 'dome') {
    // Glowing dome roof (2055)
    const domeMat = new THREE.MeshStandardMaterial({
      color: '#0a1a1a',
      emissive: new THREE.Color(era.building.accent),
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 1,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = roofY;
    dome.castShadow = true;
    dome.userData.isBuilding = true;
    group.add(dome);
    // spire
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.15, 4, 6), domeMat);
    spire.position.y = roofY + 3;
    spire.userData.isBuilding = true;
    group.add(spire);
    // antenna glow
    const glowMat = new THREE.MeshBasicMaterial({ color: era.building.accent, transparent: true, opacity: 1 });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glowMat);
    tip.position.y = roofY + 5;
    tip.userData.isBuilding = true;
    group.add(tip);
  } else if (type === 'pitched') {
    const roofMat = new THREE.MeshStandardMaterial({ color: shadeHex(baseColor, 0.6), roughness: 0.9, transparent: true, opacity: 1 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.6, 3, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = roofY + 1.5;
    roof.castShadow = true;
    roof.userData.isBuilding = true;
    group.add(roof);
  }
}

function addCornice(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const mat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 1.1), roughness: 0.8, transparent: true, opacity: 1 });
  const ch = 0.4;
  for (const [pw, pd, px, pz] of [[w + 0.6, ch, 0, d / 2 + 0.1], [w + 0.6, ch, 0, -d / 2 - 0.1], [ch, d + 0.6, w / 2 + 0.1, 0], [ch, d + 0.6, -w / 2 - 0.1, 0]] as const) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(pw, ch, pd), mat);
    p.position.set(px, h - ch / 2 + 0.2, pz);
    p.userData.isBuilding = true;
    group.add(p);
  }
}

// ---------------------------------------------------------------------------
// Ground-floor storefronts with era-appropriate signage
// ---------------------------------------------------------------------------
function addStorefront(
  group: THREE.Group,
  era: EraConfig,
  w: number,
  d: number,
  h: number,
  lotIndex: number,
  face: number,
): void {
  const signs = era.signage.storefronts;
  const sign = signs[lotIndex % signs.length];

  // Storefront sign board above ground floor
  const signStyle = era.signage.billboardStyle;
  const signTex = makeSign({
    text: sign.text,
    bg: sign.bg,
    fg: sign.fg,
    font: sign.font,
    style: signStyle,
    width: 256,
    height: 64,
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissiveMap: signTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: era.signage.neonInt,
    roughness: 0.5,
    transparent: true,
    opacity: 1,
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.75, 1.2), signMat);
  signMesh.position.set(face * (w / 2 + 0.05), 3.5, 0);
  signMesh.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
  signMesh.userData.isBuilding = true;
  group.add(signMesh);

  // Awning (1945/1965 eras)
  if (era.year <= 1965) {
    const awnColor = pick(['#8a3a2a', '#2a4a6a', '#5a6a3a', '#6a3a5a'], lotIndex);
    const awnMat = new THREE.MeshStandardMaterial({ color: awnColor, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 2), awnMat);
    awn.position.set(face * (w / 2 + 1), 3.2, 0);
    awn.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    awn.rotation.x = -0.4;
    awn.userData.isBuilding = true;
    group.add(awn);
  }

  // Glowing doorway (2055)
  if (era.year === 2055) {
    const doorMat = new THREE.MeshBasicMaterial({ color: era.building.accent, transparent: true, opacity: 0.7 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), doorMat);
    door.position.set(face * (w / 2 + 0.02), 1.3, 0);
    door.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    door.userData.isBuilding = true;
    group.add(door);
  }
}

// ---------------------------------------------------------------------------
// Rooftop and sidewall billboards
// ---------------------------------------------------------------------------
function addBillboards(
  group: THREE.Group,
  era: EraConfig,
  w: number,
  d: number,
  h: number,
  lotIndex: number,
  face: number,
): void {
  const billboards = era.signage.billboards;
  // Only some buildings get billboards
  if (hash(lotIndex * 53 + era.year) < 0.5) return;

  const bb = billboards[lotIndex % billboards.length];
  const style = era.signage.billboardStyle;
  const isVertical = era.year >= 2005 && hash(lotIndex + 7) > 0.5;

  const tex = makeSign({
    text: bb.text,
    sub: bb.sub,
    bg: bb.bg,
    fg: bb.fg,
    font: bb.font,
    style,
    width: 256,
    height: isVertical ? 384 : 128,
    vertical: isVertical,
  });

  const bbMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: era.signage.neonInt,
    roughness: 0.4,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
  });

  const bbW = isVertical ? 2.5 : 4;
  const bbH = isVertical ? 3.75 : 1.5;

  if (era.year >= 1985) {
    // Rooftop billboard
    const bbMesh = new THREE.Mesh(new THREE.PlaneGeometry(bbW, bbH), bbMat);
    const roofY = h + (era.building.setBack && h > 15 ? h * 0.25 + 1.2 : 0.5);
    bbMesh.position.set(0, roofY + bbH / 2 + 1, face > 0 ? -d / 4 : d / 4);
    bbMesh.rotation.y = face > 0 ? 0 : Math.PI;
    bbMesh.userData.isBuilding = true;
    group.add(bbMesh);
    // support post
    const postMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.8, transparent: true, opacity: 1 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), postMat);
    post.position.set(0, roofY + 0.5, face > 0 ? -d / 4 : d / 4);
    post.userData.isBuilding = true;
    group.add(post);
  } else {
    // Sidewall painted sign (1945/1965)
    const bbMesh = new THREE.Mesh(new THREE.PlaneGeometry(bbW, bbH), bbMat);
    bbMesh.position.set(face * (w / 2 + 0.06), h * 0.6, 0);
    bbMesh.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    bbMesh.userData.isBuilding = true;
    group.add(bbMesh);
  }
}
