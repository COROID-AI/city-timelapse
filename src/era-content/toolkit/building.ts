import * as THREE from 'three';

// ── Shared material cache ──────────────────────────────────────────
const _matCache = new Map<string, THREE.Material>();

function cachedMaterial(key: string, fn: () => THREE.Material): THREE.Material {
  if (!_matCache.has(key)) {
    _matCache.set(key, fn());
  }
  return _matCache.get(key)!;
}

// ── Parametric interfaces ──────────────────────────────────────────

export interface BuildingParams {
  width?: number;
  depth?: number;
  floors?: number;
  floorHeight?: number;
  bays?: number;
  style?: ArchitecturalStyle;
  wallMaterial?: WallMaterial;
  windowPattern?: WindowPattern;
  cornice?: CorniceDetail;
  rooftop?: RooftopType;
  fireEscape?: boolean;
  awning?: AwningStyle | false;
  condition?: number;
  baseColor?: number;
  sideWalls?: boolean;
}

export type ArchitecturalStyle =
  | 'brick_classic'
  | 'art_deco'
  | 'modernist'
  | 'beaux_arts'
  | 'industrial'
  | 'gothic_revival'
  | 'post_war'
  | 'brutalist';

export type WallMaterial = 'brick' | 'render' | 'curtain_wall' | 'glass' | 'stone' | 'concrete';
export type WindowPattern = 'grid' | 'arched' | 'strip' | 'casement' | 'punched';
export type CorniceDetail = 'none' | 'simple' | 'decorated' | 'elaborate';
export type RooftopType = 'flat' | 'parapet' | 'dome' | 'water_tank' | 'penthouse' | 'green_roof';
export type AwningStyle = 'canvas' | 'metal' | 'marquee' | 'awning_stripes';

export interface BuildingResult {
  group: THREE.Group;
  dispose(): void;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, mat);
}

function hexToThree(hex: number): THREE.Color {
  return new THREE.Color(hex);
}

// ── Material factories ─────────────────────────────────────────────

function brickMaterial(color: number, cond: number): THREE.Material {
  const shade = Math.max(0.3, cond);
  return new THREE.MeshStandardMaterial({ color: hexToThree(color).multiplyScalar(shade), roughness: 0.85 + (1 - cond) * 0.15, metalness: 0 });
}

function renderMaterial(color: number, cond: number): THREE.Material {
  const shade = Math.max(0.4, cond);
  return new THREE.MeshStandardMaterial({ color: hexToThree(color).multiplyScalar(shade), roughness: 0.7, metalness: 0 });
}

function curtainWallMaterial(cond: number): THREE.Material {
  const alpha = 0.3 + cond * 0.5;
  return new THREE.MeshPhysicalMaterial({ color: 0x88aacc, transparent: true, opacity: alpha, roughness: 0.05, metalness: 0.9, reflectivity: 1 });
}

function glassMaterial(cond: number): THREE.Material {
  const clarity = 0.2 + cond * 0.6;
  return new THREE.MeshPhysicalMaterial({ color: 0xaaddff, transparent: true, opacity: clarity, roughness: 0.02, metalness: 0.1, transmission: 0.5, thickness: 0.05 });
}

function stoneMaterial(color: number, cond: number): THREE.Material {
  const shade = Math.max(0.4, cond);
  return new THREE.MeshStandardMaterial({ color: hexToThree(color).multiplyScalar(shade), roughness: 0.9, metalness: 0 });
}

function concreteMaterial(cond: number): THREE.Material {
  const shade = 0.3 + cond * 0.4;
  return new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(shade, shade * 1.02, shade * 1.05), roughness: 0.95, metalness: 0 });
}

function getWallMaterial(type: WallMaterial, color: number, cond: number): THREE.Material {
  switch (type) {
    case 'brick': return cachedMaterial(`b_${color}_${cond}`, () => brickMaterial(color, cond));
    case 'render': return cachedMaterial(`r_${color}_${cond}`, () => renderMaterial(color, cond));
    case 'curtain_wall': return cachedMaterial('cw', () => curtainWallMaterial(cond));
    case 'glass': return cachedMaterial('g', () => glassMaterial(cond));
    case 'stone': return cachedMaterial(`s_${color}_${cond}`, () => stoneMaterial(color, cond));
    case 'concrete': return cachedMaterial(`c_${cond}`, () => concreteMaterial(cond));
  }
}

function windowFrameMaterial(cond: number): THREE.Material {
  const dark = 0.15 + (1 - cond) * 0.1;
  return new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(dark, dark, dark * 1.1), roughness: 0.6, metalness: 0.3 });
}

// ── Style builders ─────────────────────────────────────────────────

function buildBrickClassic(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_brick_classic';
  const W = p.width ?? 8, H = (p.floors ?? 4) * (p.floorHeight ?? 3), D = p.depth ?? 6;
  const bays = p.bays ?? 4, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'brick', p.baseColor ?? 0x8B4513, p.condition ?? 0.6);
  const frameMat = windowFrameMaterial(p.condition ?? 0.6);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 4); f++) {
    for (let b = 0; b < bays; b++) {
      const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.35;
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const win = makeBox(0.8, 1.2, 0.05, frameMat); win.position.set(wx, wy, D / 2 + 0.01); g.add(win);
      const glass = makeBox(0.6, 1.0, 0.02, glassMaterial(p.condition ?? 0.6));
      glass.position.set(wx, wy, D / 2 + 0.04); g.add(glass);
    }
  }
  for (let f = 1; f < (p.floors ?? 4); f++) {
    const band = makeBox(W + 0.1, 0.15, D + 0.1, wallMat);
    band.position.set(0, f * (p.floorHeight ?? 3), 0); g.add(band);
  }
  return g;
}

function buildArtDeco(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_art_deco';
  const W = p.width ?? 10, H = (p.floors ?? 8) * (p.floorHeight ?? 3), D = p.depth ?? 7;
  const bays = p.bays ?? 5, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'render', p.baseColor ?? 0xD4C5A9, p.condition ?? 0.7);
  const frameMat = windowFrameMaterial(p.condition ?? 0.7);
  const steps = Math.min(3, Math.floor((p.floors ?? 8) / 3));
  for (let s = 0; s <= steps; s++) {
    const stepH = H / (steps + 1);
    const stepW = W - s * (W / (steps + 2));
    const stepD = D - s * (D / (steps + 2));
    const yBase = s * stepH;
    const step = makeBox(stepW, stepH, stepD, wallMat);
    step.position.set(0, yBase + stepH / 2, 0); g.add(step);
  }
  for (let f = 0; f < (p.floors ?? 8); f++) {
    const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.2;
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const win = makeBox(0.3, (p.floorHeight ?? 3) * 0.6, 0.05, frameMat);
      win.position.set(wx, wy, D / 2 + 0.01); g.add(win);
      const glass = makeBox(0.2, (p.floorHeight ?? 3) * 0.5, 0.02, glassMaterial(p.condition ?? 0.7));
      glass.position.set(wx, wy, D / 2 + 0.04); g.add(glass);
    }
  }
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xC0A060, roughness: 0.4, metalness: 0.6 });
  for (let f = 0; f < (p.floors ?? 8); f += 4) {
    const band = makeBox(W + 0.2, 0.1, D + 0.2, bandMat);
    band.position.set(0, f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3), 0); g.add(band);
  }
  return g;
}

function buildModernist(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_modernist';
  const W = p.width ?? 12, H = (p.floors ?? 5) * (p.floorHeight ?? 3), D = p.depth ?? 8;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'render', p.baseColor ?? 0xF5F5F0, p.condition ?? 0.8);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 5); f++) {
    const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.45;
    const ribbonW = W * 0.85;
    const ribbon = makeBox(ribbonW, 0.6, 0.05, windowFrameMaterial(p.condition ?? 0.8));
    ribbon.position.set(0, wy, D / 2 + 0.01); g.add(ribbon);
    const glass = makeBox(ribbonW - 0.1, 0.45, 0.02, glassMaterial(p.condition ?? 0.8));
    glass.position.set(0, wy, D / 2 + 0.04); g.add(glass);
  }
  const canopy = makeBox(4, 0.1, 2, wallMat);
  canopy.position.set(0, 3, D / 2 + 1); g.add(canopy);
  return g;
}

function buildBeauxArts(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_beaux_arts';
  const W = p.width ?? 14, H = (p.floors ?? 5) * (p.floorHeight ?? 3), D = p.depth ?? 8;
  const bays = p.bays ?? 6, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'stone', p.baseColor ?? 0xE8E0D0, p.condition ?? 0.75);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 5); f++) {
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.4;
      const archGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 12, Math.PI);
      const arch = new THREE.Mesh(archGeo, windowFrameMaterial(p.condition ?? 0.75));
      arch.position.set(wx, wy + 0.8, D / 2 + 0.02); g.add(arch);
      const win = makeBox(0.7, 1.4, 0.05, windowFrameMaterial(p.condition ?? 0.75));
      win.position.set(wx, wy - 0.1, D / 2 + 0.01); g.add(win);
      const glass = makeBox(0.55, 1.2, 0.02, glassMaterial(p.condition ?? 0.75));
      glass.position.set(wx, wy - 0.1, D / 2 + 0.04); g.add(glass);
    }
  }
  const corniceMat = new THREE.MeshStandardMaterial({ color: 0xD0C8B8, roughness: 0.5, metalness: 0.2 });
  const cornice = makeBox(W + 0.6, 0.4, D + 0.6, corniceMat);
  cornice.position.set(0, H + 0.2, 0); g.add(cornice);
  const corniceTrim = makeBox(W + 0.8, 0.15, D + 0.8, corniceMat);
  corniceTrim.position.set(0, H + 0.5, 0); g.add(corniceTrim);
  return g;
}

function buildIndustrial(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_industrial';
  const W = p.width ?? 16, H = (p.floors ?? 3) * (p.floorHeight ?? 4), D = p.depth ?? 10;
  const bays = p.bays ?? 8, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'concrete', p.baseColor ?? 0x666666, p.condition ?? 0.5);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 3); f++) {
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const wy = f * (p.floorHeight ?? 4) + (p.floorHeight ?? 4) * 0.7;
      const win = makeBox(1.5, 1.5, 0.05, windowFrameMaterial(p.condition ?? 0.5));
      win.position.set(wx, wy, D / 2 + 0.01); g.add(win);
      const glass = makeBox(1.3, 1.3, 0.02, glassMaterial(p.condition ?? 0.5));
      glass.position.set(wx, wy, D / 2 + 0.04); g.add(glass);
    }
  }
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.8 });
  for (let b = 0; b <= bays; b += 2) {
    const colX = -W / 2 + b * bayW;
    const col = makeBox(0.15, H, 0.15, steelMat);
    col.position.set(colX, H / 2, D / 2 + 0.1); g.add(col);
  }
  return g;
}

function buildGothicRevival(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_gothic_revival';
  const W = p.width ?? 10, H = (p.floors ?? 6) * (p.floorHeight ?? 3), D = p.depth ?? 7;
  const bays = p.bays ?? 5, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'stone', p.baseColor ?? 0x808070, p.condition ?? 0.65);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 6); f++) {
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.4;
      const archShape = new THREE.Shape();
      archShape.moveTo(-0.35, 0); archShape.lineTo(-0.35, 1.2);
      archShape.quadraticCurveTo(0, 1.8, 0.35, 1.2); archShape.lineTo(0.35, 0); archShape.lineTo(-0.35, 0);
      const archGeo = new THREE.ExtrudeGeometry(archShape, { depth: 0.05, bevelEnabled: false });
      const archMesh = new THREE.Mesh(archGeo, windowFrameMaterial(p.condition ?? 0.65));
      archMesh.position.set(wx, wy - 0.2, D / 2 + 0.01); g.add(archMesh);
      const glass = makeBox(0.5, 1.0, 0.02, glassMaterial(p.condition ?? 0.65));
      glass.position.set(wx, wy - 0.1, D / 2 + 0.06); g.add(glass);
    }
  }
  const towerMat = getWallMaterial(p.wallMaterial ?? 'stone', p.baseColor ?? 0x707060, p.condition ?? 0.65);
  for (const side of [-1, 1]) {
    const tower = makeBox(1.5, H * 0.3, 1.5, towerMat);
    tower.position.set(side * (W / 2 - 0.75), H + H * 0.15, 0); g.add(tower);
  }
  return g;
}

function buildPostWar(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_post_war';
  const W = p.width ?? 10, H = (p.floors ?? 4) * (p.floorHeight ?? 3), D = p.depth ?? 7;
  const bays = p.bays ?? 4, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'render', p.baseColor ?? 0xC0B0A0, p.condition ?? 0.6);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 4); f++) {
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.45;
      const win = makeBox(0.9, 0.9, 0.05, windowFrameMaterial(p.condition ?? 0.6));
      win.position.set(wx, wy, D / 2 + 0.01); g.add(win);
      const glass = makeBox(0.7, 0.7, 0.02, glassMaterial(p.condition ?? 0.6));
      glass.position.set(wx, wy, D / 2 + 0.04); g.add(glass);
    }
  }
  return g;
}

function buildBrutalist(p: BuildingParams): THREE.Group {
  const g = new THREE.Group();
  g.name = 'building_brutalist';
  const W = p.width ?? 14, H = (p.floors ?? 6) * (p.floorHeight ?? 3), D = p.depth ?? 9;
  const bays = p.bays ?? 7, bayW = W / bays;
  const wallMat = getWallMaterial(p.wallMaterial ?? 'concrete', p.baseColor ?? 0x555550, p.condition ?? 0.5);
  g.add(makeBox(W, H, D, wallMat).translateY(H / 2));
  for (let f = 0; f < (p.floors ?? 6); f++) {
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + bayW / 2 + b * bayW;
      const wy = f * (p.floorHeight ?? 3) + (p.floorHeight ?? 3) * 0.35;
      const recess = makeBox(1.0, 1.2, 0.3, wallMat);
      recess.position.set(wx, wy, D / 2 + 0.15); g.add(recess);
      const win = makeBox(0.6, 0.8, 0.05, windowFrameMaterial(p.condition ?? 0.5));
      win.position.set(wx, wy, D / 2 + 0.3); g.add(win);
      const glass = makeBox(0.45, 0.65, 0.02, glassMaterial(p.condition ?? 0.5));
      glass.position.set(wx, wy, D / 2 + 0.33); g.add(glass);
    }
  }
  const balconyMat = wallMat;
  for (let f = 1; f < (p.floors ?? 6); f += 2) {
    const balcony = makeBox(W * 0.6, 0.2, 1.5, balconyMat);
    balcony.position.set(0, f * (p.floorHeight ?? 3), D / 2 + 0.75); g.add(balcony);
  }
  return g;
}

// ── Rooftop details ────────────────────────────────────────────────

function addRooftopDetails(group: THREE.Group, roofType: RooftopType, totalHeight: number, bldgW: number, bldgD: number, cond: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.3 });
  switch (roofType) {
    case 'parapet': {
      const ph = 0.8;
      const parapet = makeBox(bldgW + 0.3, ph, bldgD + 0.3, getWallMaterial('render', 0xD0D0C0, cond));
      parapet.position.set(0, totalHeight + ph / 2, 0); group.add(parapet);
      break;
    }
    case 'dome': {
      const domeGeo = new THREE.SphereGeometry(Math.min(bldgW, bldgD) * 0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, mat);
      dome.position.set(0, totalHeight, 0); group.add(dome);
      break;
    }
    case 'water_tank': {
      const tankGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 12);
      const tank = new THREE.Mesh(tankGeo, mat);
      tank.position.set(0, totalHeight + 1.5, 0); group.add(tank);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const leg = makeBox(0.08, 1.5, 0.08, mat);
        leg.position.set(Math.cos(angle) * 0.5, totalHeight + 0.75, Math.sin(angle) * 0.5); group.add(leg);
      }
      break;
    }
    case 'penthouse': {
      const phw = bldgW * 0.3, phd = bldgD * 0.4, phh = 2;
      const ph = makeBox(phw, phh, phd, getWallMaterial('render', 0xB0B0A0, cond));
      ph.position.set(0, totalHeight + phh / 2, 0); group.add(ph);
      break;
    }
    case 'green_roof': {
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x2D5A27, roughness: 1 });
      const greenLayer = makeBox(bldgW - 0.5, 0.3, bldgD - 0.5, greenMat);
      greenLayer.position.set(0, totalHeight + 0.15, 0); group.add(greenLayer);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x3A7A32, roughness: 0.9 });
      for (let i = 0; i < 6; i++) {
        const bx = (Math.random() - 0.5) * (bldgW - 2);
        const bz = (Math.random() - 0.5) * (bldgD - 2);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 8, 6), bushMat);
        bush.position.set(bx, totalHeight + 0.5, bz); group.add(bush);
      }
      break;
    }
  }
}

// ── Fire escape ────────────────────────────────────────────────────

function addFireEscape(group: THREE.Group, _totalHeight: number, floors: number, floorH: number, bldgD: number, _cond: number): void {
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.7, metalness: 0.6 });
  for (let f = 1; f < floors; f++) {
    const platformY = f * floorH - 0.3;
    const platform = makeBox(2, 0.05, 1.2, ironMat);
    platform.position.set(0, platformY, bldgD / 2 + 0.6); group.add(platform);
    const rail = makeBox(2, 0.8, 0.04, ironMat);
    rail.position.set(0, platformY + 0.4, bldgD / 2 + 1.15); group.add(rail);
    const ladder = makeBox(0.04, floorH, 0.04, ironMat);
    ladder.position.set(-0.8, platformY + floorH / 2, bldgD / 2 + 0.6); group.add(ladder);
    const ladder2 = ladder.clone();
    ladder2.position.x = 0.8; group.add(ladder2);
  }
}

// ── Awnings ────────────────────────────────────────────────────────

function addAwning(group: THREE.Group, bottomY: number, bldgW: number, bldgD: number, style: AwningStyle, _cond: number): void {
  const ext = 1.5;
  let mat: THREE.Material;
  switch (style) {
    case 'canvas': mat = new THREE.MeshStandardMaterial({ color: 0xCD853F, roughness: 0.8, side: THREE.DoubleSide }); break;
    case 'metal': mat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, roughness: 0.3, metalness: 0.7 }); break;
    case 'marquee': mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.2, metalness: 0.5, emissive: 0x332200 }); break;
    case 'awning_stripes': mat = new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.7, side: THREE.DoubleSide }); break;
    default: mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  const awningGeo = new THREE.PlaneGeometry(bldgW, ext);
  const awning = new THREE.Mesh(awningGeo, mat);
  awning.rotation.x = -Math.PI / 6;
  awning.position.set(0, bottomY, bldgD / 2 + ext / 2 * Math.cos(Math.PI / 6));
  group.add(awning);
}

// ── Main entry point ───────────────────────────────────────────────

const STYLE_BUILDERS: Record<ArchitecturalStyle, (p: BuildingParams) => THREE.Group> = {
  brick_classic: buildBrickClassic, art_deco: buildArtDeco, modernist: buildModernist,
  beaux_arts: buildBeauxArts, industrial: buildIndustrial, gothic_revival: buildGothicRevival,
  post_war: buildPostWar, brutalist: buildBrutalist,
};

export function generateBuilding(params: BuildingParams): BuildingResult {
  const {
    width = 8, depth = 6, floors = 4, floorHeight = 3,
    style = 'brick_classic', cornice = 'simple', rooftop = 'flat',
    fireEscape = false, awning = false, condition = 0.7,
  } = params;

  const group = new THREE.Group();
  group.name = `building_${style}`;
  const totalHeight = floors * floorHeight;

  // Build main facade based on style
  const builder = STYLE_BUILDERS[style];
  const facadeGroup = builder(params);
  group.add(facadeGroup);

  // Add cornice
  if (cornice !== 'none') {
    const corniceMat = new THREE.MeshStandardMaterial({ color: 0xC0B8A8, roughness: 0.6, metalness: 0.1 });
    const cW = width + (cornice === 'elaborate' ? 0.8 : cornice === 'decorated' ? 0.5 : 0.3);
    const cD = depth + (cornice === 'elaborate' ? 0.8 : cornice === 'decorated' ? 0.5 : 0.3);
    const cH = cornice === 'elaborate' ? 0.5 : cornice === 'decorated' ? 0.35 : 0.2;
    const corniceMesh = makeBox(cW, cH, cD, corniceMat);
    corniceMesh.position.set(0, totalHeight + cH / 2, 0); group.add(corniceMesh);
  }

  // Add rooftop details
  if (rooftop !== 'flat') {
    addRooftopDetails(group, rooftop, totalHeight, width, depth, condition);
  }

  // Add fire escape
  if (fireEscape) {
    addFireEscape(group, totalHeight, floors, floorHeight, depth, condition);
  }

  // Add awning
  if (awning && typeof awning === 'string') {
    addAwning(group, floorHeight * 0.3, width, depth, awning, condition);
  }

  return {
    group,
    dispose() {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) { for (const mat of m) mat.dispose(); } else if (m) { m.dispose(); }
        }
      });
    },
  };
}
