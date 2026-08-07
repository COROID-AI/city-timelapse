/**
 * Era-specific building architecture for the City Time Period Timelapse.
 *
 * Registers a fully-typed {@link EraConfig} for every canonical era year
 * (1945, 1965, 1985, 2005, 2025) through the foundation era registry, and
 * builds the actual city-block buildings with procedural Three.js geometry.
 *
 * Each era produces architecturally distinct buildings:
 *  - 1945: low-rise brick/stone walk-ups with striped awnings & fire escapes
 *  - 1965: mid-century concrete/brutalist mid-rises with flat roofs
 *  - 1985: glass curtain-wall office towers with neon-trim storefronts
 *  - 2005: mixed-use glass-and-steel with curtain walls, setbacks, awnings
 *  - 2025: smart-green facades with vertical gardens, solar panels, LED cladding
 *
 * All geometry is built from primitives and all textures are generated on
 * canvas (see ./textures.ts) — no external asset files.
 *
 * The downstream era-transition engine consumes {@link buildEraBuildings} to
 * add/remove the era's buildings and {@link disposeBuildings} for teardown.
 */
import * as THREE from 'three';
import { registerEra, eraRegistry, type EraConfig, type EraYear } from '../eras';
import { assetRegistry } from '../core/assetRegistry';
import { PRNG } from '../core/prng';
import {
  makeAwningTexture,
  makeBrickTexture,
  makeConcreteTexture,
  makeGlassCurtainTexture,
  makeGreenFacadeTexture,
  makeSolarTexture,
  makeStoneTexture,
  makeWindowGridTexture,
} from './textures';

// ---------------------------------------------------------------------------
// Texture cache (created lazily so the module can be imported headlessly).
// ---------------------------------------------------------------------------

interface BuildingTextures {
  brick: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  windowGrid: THREE.CanvasTexture;
  glass: THREE.CanvasTexture;
  green: THREE.CanvasTexture;
  solar: THREE.CanvasTexture;
}

let textures: BuildingTextures | null = null;

function ensureTextures(): BuildingTextures {
  if (textures) {
    return textures;
  }
  textures = {
    brick: makeBrickTexture(),
    stone: makeStoneTexture(),
    concrete: makeConcreteTexture(),
    windowGrid: makeWindowGridTexture(),
    glass: makeGlassCurtainTexture(),
    green: makeGreenFacadeTexture(),
    solar: makeSolarTexture(),
  };
  // Register generated textures in the shared asset registry so other
  // consumers can resolve them by key.
  assetRegistry.registerTexture('brick', textures.brick);
  assetRegistry.registerTexture('stone', textures.stone);
  assetRegistry.registerTexture('concrete', textures.concrete);
  assetRegistry.registerTexture('window-grid', textures.windowGrid);
  assetRegistry.registerTexture('glass-curtain', textures.glass);
  assetRegistry.registerTexture('green-facade', textures.green);
  assetRegistry.registerTexture('solar', textures.solar);
  return textures;
}

// ---------------------------------------------------------------------------
// Small geometry/material helpers
// ---------------------------------------------------------------------------

function texturedFacade(
  texture: THREE.Texture,
  roughness: number,
  repeat: [number, number],
): THREE.MeshStandardMaterial {
  const t = texture.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(repeat[0], repeat[1]);
  return new THREE.MeshStandardMaterial({
    map: t,
    roughness,
    metalness: 0.05,
  });
}

function solid(hex: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
}

/** Box geometry translated so its base sits at y=0. */
function box(w: number, h: number, d: number, materials: THREE.Material | THREE.Material[]): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return new THREE.Mesh(geo, materials);
}

/**
 * Building body with a distinct front (+z) facade material, plain side/back
 * walls, and a roof material. BoxGeometry material order is
 * [+x, -x, +y, -y, +z, -z].
 */
function bodyBox(
  w: number,
  h: number,
  d: number,
  front: THREE.Material,
  side: THREE.Material,
  top: THREE.Material,
): THREE.Mesh {
  const mats = [side, side, top, side, front, side];
  return box(w, h, d, mats);
}

// ---------------------------------------------------------------------------
// City block layout
// ---------------------------------------------------------------------------

interface Lot {
  x: number;
  z: number;
  rotY: number;
  width: number;
  depth: number;
}

/** Half-size of the square city block (block spans -EDGE..EDGE in x and z). */
const BLOCK_EDGE = 18;
const LOTS_PER_SIDE = 3;

/**
 * Compute building lots around the four edges of the block. Each building's
 * front facade faces outward (toward the street). Density controls how many
 * lots are actually built.
 */
function computeLots(density: number, rng: PRNG): Lot[] {
  const sideLen = BLOCK_EDGE * 2;
  const lotWidth = (sideLen / LOTS_PER_SIDE) * 0.9;
  const lots: Lot[] = [];

  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < LOTS_PER_SIDE; i++) {
      if (rng.next() > density) {
        continue; // empty lot / courtyard gap
      }
      const t = (i + 0.5) / LOTS_PER_SIDE;
      const along = -BLOCK_EDGE + t * sideLen;
      const depth = 7 + rng.range(0, 4);

      let x = 0;
      let z = 0;
      let rotY = 0;
      if (side === 0) {
        // north edge, front faces +z
        x = along;
        z = BLOCK_EDGE - depth / 2;
        rotY = 0;
      } else if (side === 1) {
        // east edge, front faces +x
        x = BLOCK_EDGE - depth / 2;
        z = along;
        rotY = Math.PI / 2;
      } else if (side === 2) {
        // south edge, front faces -z
        x = along;
        z = -BLOCK_EDGE + depth / 2;
        rotY = Math.PI;
      } else {
        // west edge, front faces -x
        x = -BLOCK_EDGE + depth / 2;
        z = along;
        rotY = -Math.PI / 2;
      }
      lots.push({ x, z, rotY, width: lotWidth, depth });
    }
  }
  return lots;
}

// ---------------------------------------------------------------------------
// Shared building details
// ---------------------------------------------------------------------------

function addParapet(g: THREE.Group, w: number, d: number, height: number, mat: THREE.Material): void {
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), mat);
  parapet.position.y = height + 0.25;
  g.add(parapet);
}

function addAwning(g: THREE.Group, w: number, d: number, y: number, rng: PRNG): void {
  const count = rng.int(1, 2);
  const awningMat = new THREE.MeshStandardMaterial({
    map: makeAwningTexture(rng.pick([0xd43a2f, 0x2f6fb0, 0x3a8f3a, 0xd4a22f]), 0xf2eee6),
    roughness: 0.8,
  });
  const aw = (w / count) * 0.8;
  const ad = 1.3;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(aw, 0.12, ad), awningMat);
    mesh.position.set(-w / 2 + aw / 2 + i * (w / count), y, d / 2 + ad / 2 - 0.1);
    mesh.rotation.x = -0.12;
    g.add(mesh);
  }
}

function addStorefrontBand(g: THREE.Group, w: number, d: number, rng: PRNG): void {
  const bandH = 2.4;
  const band = new THREE.Mesh(new THREE.BoxGeometry(w, bandH, 0.1), solid(0x2c2a28, 0.8));
  band.position.set(0, bandH / 2, d / 2 + 0.02);
  g.add(band);

  const glass = new THREE.MeshStandardMaterial({
    color: 0xbfd6e0,
    roughness: 0.2,
    metalness: 0.1,
  });
  const n = rng.int(2, 3);
  const gw = (w / n) * 0.7;
  for (let i = 0; i < n; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(gw, bandH * 0.7, 0.08), glass);
    win.position.set(-w / 2 + (i + 0.5) * (w / n), bandH * 0.55, d / 2 + 0.1);
    g.add(win);
  }
}

function addFireEscape(g: THREE.Group, w: number, height: number, d: number, rng: PRNG): void {
  void rng;
  const mat = solid(0x2b2b2b, 0.5, 0.6);
  const xOff = w * 0.32;
  const zOff = d / 2 + 0.06;
  const railH = height * 0.8;

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, railH, 0.06), mat);
  rail.position.set(xOff, railH / 2, zOff);
  g.add(rail);
  const rail2 = rail.clone();
  rail2.position.x = xOff + 0.55;
  g.add(rail2);

  const floorH = 3;
  const n = Math.floor(railH / floorH);
  for (let i = 1; i <= n; i++) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.35), mat);
    plat.position.set(xOff + 0.275, i * floorH, zOff);
    g.add(plat);
  }
}

function addWaterTower(g: THREE.Group, w: number, height: number, rng: PRNG): void {
  const tankMat = solid(0x8a7a5a, 0.7, 0.3);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 12), tankMat);
  const cx = rng.range(-w * 0.2, w * 0.2);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(cx, height + 1.5, 0);
  g.add(tank);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 12), tankMat);
  cone.position.set(cx, height + 2.3, 0);
  g.add(cone);

  const legMat = solid(0x5a4a30, 0.8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), legMat);
    leg.position.set(cx + Math.cos(a) * 0.9, height + 0.6, Math.sin(a) * 0.9);
    g.add(leg);
  }
}

function addPunchedWindows(g: THREE.Group, w: number, height: number, d: number): void {
  const mat = solid(0x1f262c, 0.4, 0.2);
  const cols = Math.max(2, Math.round(w / 2.5));
  const rows = Math.max(3, Math.round(height / 2.5));
  const cw = w / cols;
  const ch = height / rows;
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.55, ch * 0.45, 0.12), mat);
      win.position.set(-w / 2 + (c + 0.5) * cw, r * ch, d / 2 + 0.02);
      g.add(win);
    }
  }
}

function addVerticalRibs(g: THREE.Group, w: number, height: number, d: number): void {
  const mat = solid(0x9aa0a5, 0.85);
  const n = Math.max(2, Math.round(w / 3));
  for (let i = 0; i <= n; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, 0.15), mat);
    rib.position.set(-w / 2 + i * (w / n), height / 2, d / 2 + 0.02);
    g.add(rib);
  }
}

function addRooftopMechanical(g: THREE.Group, w: number, height: number, rng: PRNG): void {
  const mat = solid(0x6f7478, 0.9);
  const boxW = w * 0.4;
  const boxD = Math.max(1, w * 0.28);
  const unit = new THREE.Mesh(new THREE.BoxGeometry(boxW, 1.6, boxD), mat);
  unit.position.set(rng.range(-w * 0.15, w * 0.15), height + 0.8, rng.range(-1, 1));
  g.add(unit);

  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 10), mat);
  duct.position.set(unit.position.x, height + 2.2, unit.position.z);
  g.add(duct);
}

function addAntenna(g: THREE.Group, height: number): void {
  const mat = solid(0x777a7d, 0.4, 0.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, height * 0.2, 6), mat);
  pole.position.set(0, height + height * 0.1, 0);
  g.add(pole);
}

function addNeonStorefront(g: THREE.Group, w: number, d: number, rng: PRNG): void {
  const bandH = 3;
  const band = new THREE.Mesh(new THREE.BoxGeometry(w, bandH, 0.1), solid(0x11151a, 0.5));
  band.position.set(0, bandH / 2, d / 2 + 0.02);
  g.add(band);

  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd4e8,
    roughness: 0.15,
    metalness: 0.2,
    emissive: 0x1a2a33,
    emissiveIntensity: 0.3,
  });
  const neonColors = [0xff2a6d, 0x2af0ff, 0xffd23a, 0x7dff3a];
  const n = rng.int(2, 3);
  const gw = (w / n) * 0.7;
  for (let i = 0; i < n; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(gw, bandH * 0.7, 0.08), glass);
    win.position.set(-w / 2 + (i + 0.5) * (w / n), bandH * 0.55, d / 2 + 0.1);
    g.add(win);

    const neonTop = new THREE.Mesh(
      new THREE.BoxGeometry(gw + 0.12, 0.08, 0.06),
      new THREE.MeshStandardMaterial({
        color: rng.pick(neonColors),
        emissive: rng.pick(neonColors),
        emissiveIntensity: 2.2,
      }),
    );
    neonTop.position.set(win.position.x, bandH * 0.92, d / 2 + 0.16);
    g.add(neonTop);

    const neonBot = new THREE.Mesh(
      new THREE.BoxGeometry(gw + 0.12, 0.08, 0.06),
      new THREE.MeshStandardMaterial({
        color: rng.pick(neonColors),
        emissive: rng.pick(neonColors),
        emissiveIntensity: 2.2,
      }),
    );
    neonBot.position.set(win.position.x, 0.25, d / 2 + 0.16);
    g.add(neonBot);
  }
}

function addSteelFrame(g: THREE.Group, w: number, h: number, d: number): void {
  const mat = solid(0x9aa7b0, 0.3, 0.7);
  const n = Math.max(2, Math.round(w / 3));
  for (let i = 0; i <= n; i++) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), mat);
    col.position.set(-w / 2 + i * (w / n), h / 2, d / 2 + 0.1);
    g.add(col);
  }
}

function addVerticalGardens(g: THREE.Group, w: number, height: number, d: number, rng: PRNG): void {
  const mat = new THREE.MeshStandardMaterial({ map: makeGreenFacadeTexture(), roughness: 0.9, color: 0xffffff });
  const n = rng.int(2, 3);
  const gw = (w / n) * 0.5;
  const gh = height * 0.7;
  for (let i = 0; i < n; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 0.1), mat);
    panel.position.set(-w / 2 + (i + 0.5) * (w / n), gh / 2 + 1, d / 2 + 0.02);
    g.add(panel);
  }
}

function addLedCladding(g: THREE.Group, w: number, height: number, d: number, rng: PRNG): void {
  const color = rng.pick([0x00e5ff, 0x7dff3a, 0xffb020, 0x9a5cff]);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 });
  const rows = Math.max(3, Math.round(height / 6));
  for (let r = 0; r < rows; r++) {
    const y = (r + 1) * (height / (rows + 1));
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.05), mat);
    strip.position.set(0, y, d / 2 + 0.02);
    g.add(strip);

    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, d), mat);
    corner.position.set(w / 2 - 0.05, y, 0);
    g.add(corner);
  }
}

function addSolarPanels(g: THREE.Group, w: number, d: number, height: number, rng: PRNG): void {
  const mat = new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.3, metalness: 0.4 });
  const cols = rng.int(2, 3);
  const rows = rng.int(1, 2);
  const pw = (w / cols) * 0.8;
  const pd = (d / rows) * 0.8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.08, pd), mat);
      panel.position.set(-w / 2 + (c + 0.5) * (w / cols), height + 0.5 + r * 0.05, -d / 2 + (r + 0.5) * (d / rows));
      panel.rotation.x = rng.range(-0.15, 0.15);
      panel.rotation.z = rng.range(-0.05, 0.05);
      g.add(panel);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-era building builders (all built with front facing +z in local space)
// ---------------------------------------------------------------------------

function build1945(lot: Lot, height: number, rng: PRNG): THREE.Group {
  const T = ensureTextures();
  const g = new THREE.Group();
  const w = lot.width;
  const d = lot.depth;
  const isBrick = rng.next() < 0.7;

  const front = texturedFacade(isBrick ? T.brick : T.stone, 0.9, [
    Math.max(1, Math.round(w / 3)),
    Math.max(1, Math.round(height / 3)),
  ]);
  const side = solid(isBrick ? 0x8f3a28 : 0xb8b0a2, 0.9);
  const top = solid(0x5a5348, 0.95);

  g.add(bodyBox(w, height, d, front, side, top));
  addParapet(g, w, d, height, top);
  if (rng.next() < 0.5) {
    addWaterTower(g, w, height, rng);
  }
  addStorefrontBand(g, w, d, rng);
  addAwning(g, w, d, 2.6, rng);
  if (rng.next() < 0.8) {
    addFireEscape(g, w, height, d, rng);
  }
  return g;
}

function build1965(lot: Lot, height: number, rng: PRNG): THREE.Group {
  const T = ensureTextures();
  const g = new THREE.Group();
  const w = lot.width;
  const d = lot.depth;
  void rng;

  const front = texturedFacade(T.concrete, 0.85, [
    Math.max(1, Math.round(w / 4)),
    Math.max(1, Math.round(height / 4)),
  ]);
  const side = solid(0x8a8f94, 0.85);
  const top = solid(0x6f7478, 0.9);

  g.add(bodyBox(w, height, d, front, side, top));
  addParapet(g, w, d, height, top);
  addVerticalRibs(g, w, height, d);
  addPunchedWindows(g, w, height, d);
  addRooftopMechanical(g, w, height, rng);
  return g;
}

function build1985(lot: Lot, height: number, rng: PRNG): THREE.Group {
  const T = ensureTextures();
  const g = new THREE.Group();
  const w = lot.width;
  const d = lot.depth;

  const front = texturedFacade(T.glass, 0.25, [
    Math.max(1, Math.round(w / 3)),
    Math.max(1, Math.round(height / 3)),
  ]);
  const side = solid(0x2a3a44, 0.3, 0.4);
  const top = solid(0x1c2830, 0.4);

  g.add(bodyBox(w, height, d, front, side, top));
  addParapet(g, w, d, height, top);
  addAntenna(g, height);
  addNeonStorefront(g, w, d, rng);
  return g;
}

function build2005(lot: Lot, height: number, rng: PRNG): THREE.Group {
  const T = ensureTextures();
  const g = new THREE.Group();
  const w = lot.width;
  const d = lot.depth;

  const front = texturedFacade(T.glass, 0.3, [
    Math.max(1, Math.round(w / 3)),
    Math.max(1, Math.round(height / 3)),
  ]);
  const side = solid(0x3a4a55, 0.35, 0.5);
  const top = solid(0x2a3640, 0.5);

  // Lower podium (full footprint) with a setback tower above.
  const lowerH = height * 0.55;
  g.add(bodyBox(w, lowerH, d, front, side, top));
  addSteelFrame(g, w, lowerH, d);

  const setW = w * 0.7;
  const setD = d * 0.7;
  const upperH = height - lowerH;
  const upper = bodyBox(setW, upperH, setD, front, side, top);
  upper.position.set(0, lowerH + upperH / 2, 0);
  g.add(upper);

  addParapet(g, setW, setD, height, top);
  addAwning(g, w, d, 2.8, rng);
  addRooftopMechanical(g, setW, height, rng);
  return g;
}

function build2025(lot: Lot, height: number, rng: PRNG): THREE.Group {
  const T = ensureTextures();
  const g = new THREE.Group();
  const w = lot.width;
  const d = lot.depth;

  const front = texturedFacade(T.glass, 0.3, [
    Math.max(1, Math.round(w / 3)),
    Math.max(1, Math.round(height / 3)),
  ]);
  const side = solid(0x33444a, 0.4, 0.4);
  const top = solid(0x2a3a30, 0.6);

  g.add(bodyBox(w, height, d, front, side, top));
  addParapet(g, w, d, height, top);
  addVerticalGardens(g, w, height, d, rng);
  addLedCladding(g, w, height, d, rng);
  addSolarPanels(g, w, d, height, rng);
  return g;
}

function buildBuilding(year: EraYear, lot: Lot, height: number, rng: PRNG): THREE.Group {
  switch (year) {
    case 1945:
      return build1945(lot, height, rng);
    case 1965:
      return build1965(lot, height, rng);
    case 1985:
      return build1985(lot, height, rng);
    case 2005:
      return build2005(lot, height, rng);
    case 2025:
      return build2025(lot, height, rng);
  }
}

// ---------------------------------------------------------------------------
// Era configs
// ---------------------------------------------------------------------------

function makeEra(
  year: number,
  buildings: EraConfig['buildings'],
  patch: Partial<Omit<EraConfig, 'year' | 'buildings'>> = {},
): EraConfig {
  const neutral: Omit<EraConfig, 'year' | 'buildings'> = {
    vehicles: { types: ['sedan'], density: 0.5, palette: [0x445566], speedRange: [4, 8] },
    storefronts: {
      enabled: true,
      signTextures: ['sign'],
      awningPalette: [0xd43a2f],
      displayBrightness: 0.5,
    },
    advertisements: { billboards: ['ad'], neon: false, neonPalette: [], count: 2 },
    pedestrianOutfits: { palette: [0x8899aa], accessories: [], population: 6, speedRange: [1, 2] },
    sky: {
      topColor: 0x5a8fc2,
      bottomColor: 0xd5e4f0,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.2,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.6,
      sunIntensity: 1.0,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.2,
      windowGlow: 0.3,
    },
    ground: {
      surfaceTexture: 'ground',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['ambient'], events: ['event'], ui: ['ui'] },
  };
  return { year, buildings, ...neutral, ...patch };
}

const era1945 = makeEra(
  1945,
  {
    heightRange: [9, 16],
    palette: [0xa03c2a, 0xcfc7b8, 0x8f3a28],
    windowTexture: 'window-grid',
    roofStyle: 'flat',
    density: 0.9,
    roughness: 0.9,
  },
  {
    vehicles: {
      types: ['sedan', 'truck', 'taxi', 'horse-cart'],
      density: 0.4,
      palette: [0x3a3a3a, 0x6b4a2a, 0x223d5a, 0x5a2a2a],
      speedRange: [3, 6],
    },
    storefronts: {
      enabled: true,
      signTextures: ['sign-1945'],
      awningPalette: [0xd43a2f, 0x2f6fb0, 0x3a8f3a],
      displayBrightness: 0.3,
    },
    advertisements: { billboards: ['ad-1945'], neon: false, neonPalette: [], count: 2 },
    pedestrianOutfits: {
      palette: [0x6b4a2a, 0x3a3a3a, 0x7a6a4a, 0x2a2a2a],
      accessories: ['hat', 'umbrella', 'coat'],
      population: 8,
      speedRange: [0.8, 1.6],
    },
    sky: {
      topColor: 0x6d8aa6,
      bottomColor: 0xc9d6e0,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.25,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.55,
      sunIntensity: 0.9,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.2,
      windowGlow: 0.15,
    },
    ground: {
      surfaceTexture: 'ground-1945',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['city-1945'], events: ['car-horn', 'birds'], ui: ['ui-click'] },
  },
);

const era1965 = makeEra(
  1965,
  {
    heightRange: [20, 34],
    palette: [0x9aa0a5, 0x7d858c, 0xbfc4c9],
    windowTexture: 'window-grid',
    roofStyle: 'flat',
    density: 0.85,
    roughness: 0.8,
  },
  {
    vehicles: {
      types: ['sedan', 'bus', 'truck', 'taxi'],
      density: 0.55,
      palette: [0x445566, 0x7a3a2a, 0x2a4a6a, 0x556677],
      speedRange: [4, 8],
    },
    storefronts: {
      enabled: true,
      signTextures: ['sign-1965'],
      awningPalette: [0x2f6fb0, 0x3a8f3a, 0xd4a22f],
      displayBrightness: 0.4,
    },
    advertisements: { billboards: ['ad-1965'], neon: false, neonPalette: [], count: 3 },
    pedestrianOutfits: {
      palette: [0x445566, 0x6a4a3a, 0x2a3a4a, 0x7a7a7a],
      accessories: ['hat', 'briefcase'],
      population: 10,
      speedRange: [1, 2],
    },
    sky: {
      topColor: 0x7a93a8,
      bottomColor: 0xb8c6cf,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.3,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.6,
      sunIntensity: 0.95,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.25,
      windowGlow: 0.3,
    },
    ground: {
      surfaceTexture: 'ground-1965',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['city-1965'], events: ['car-horn'], ui: ['ui-click'] },
  },
);

const era1985 = makeEra(
  1985,
  {
    heightRange: [40, 60],
    palette: [0x2a3a44, 0x3a4a55, 0x1c2830],
    windowTexture: 'glass-curtain',
    roofStyle: 'flat',
    density: 0.8,
    roughness: 0.3,
  },
  {
    vehicles: {
      types: ['sedan', 'taxi', 'truck', 'bus'],
      density: 0.7,
      palette: [0x223344, 0xccaa22, 0x334455, 0x883322],
      speedRange: [5, 10],
    },
    storefronts: {
      enabled: true,
      signTextures: ['sign-1985'],
      awningPalette: [0x8822aa, 0x2266ff, 0xff2266],
      displayBrightness: 0.6,
    },
    advertisements: {
      billboards: ['ad-1985'],
      neon: true,
      neonPalette: [0xff2a6d, 0x2af0ff, 0xffd23a],
      count: 6,
    },
    pedestrianOutfits: {
      palette: [0x2a3a5a, 0x883344, 0x445566, 0xcc9933],
      accessories: ['walkman', 'shoulder-bag'],
      population: 12,
      speedRange: [1.2, 2.2],
    },
    sky: {
      topColor: 0x4f86b8,
      bottomColor: 0xcfe0ee,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.2,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.6,
      sunIntensity: 1.0,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.35,
      windowGlow: 0.5,
    },
    ground: {
      surfaceTexture: 'ground-1985',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['city-1985'], events: ['car-horn', 'siren'], ui: ['ui-click'] },
  },
);

const era2005 = makeEra(
  2005,
  {
    heightRange: [36, 58],
    palette: [0x3a4a55, 0x55687a, 0x9aa7b0],
    windowTexture: 'glass-curtain',
    roofStyle: 'flat',
    density: 0.8,
    roughness: 0.4,
  },
  {
    vehicles: {
      types: ['sedan', 'taxi', 'truck', 'bus', 'bicycle'],
      density: 0.8,
      palette: [0x224466, 0xccaa22, 0x556677, 0x883322, 0x336644],
      speedRange: [5, 11],
    },
    storefronts: {
      enabled: true,
      signTextures: ['sign-2005'],
      awningPalette: [0x2266ff, 0x22aa66, 0xaa2266],
      displayBrightness: 0.6,
    },
    advertisements: {
      billboards: ['ad-2005'],
      neon: true,
      neonPalette: [0x00e5ff, 0xff3a5a, 0xffd23a],
      count: 5,
    },
    pedestrianOutfits: {
      palette: [0x224466, 0x663322, 0x445566, 0x334455],
      accessories: ['cellphone', 'headphones'],
      population: 14,
      speedRange: [1.3, 2.4],
    },
    sky: {
      topColor: 0x5a8fc2,
      bottomColor: 0xd5e4f0,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.15,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.62,
      sunIntensity: 1.0,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.4,
      windowGlow: 0.5,
    },
    ground: {
      surfaceTexture: 'ground-2005',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['city-2005'], events: ['car-horn'], ui: ['ui-click'] },
  },
);

const era2025 = makeEra(
  2025,
  {
    heightRange: [34, 55],
    palette: [0x33444a, 0x3a7a5a, 0x2a3a30],
    windowTexture: 'glass-curtain',
    roofStyle: 'flat',
    density: 0.85,
    roughness: 0.5,
  },
  {
    vehicles: {
      types: ['sedan', 'taxi', 'bus', 'bicycle', 'truck'],
      density: 0.85,
      palette: [0x223344, 0x44aa66, 0x5577aa, 0xccaa22, 0x66aa44],
      speedRange: [5, 12],
    },
    storefronts: {
      enabled: true,
      signTextures: ['sign-2025'],
      awningPalette: [0x22aa66, 0x00e5ff, 0xaa66ff],
      displayBrightness: 0.7,
    },
    advertisements: {
      billboards: ['ad-2025'],
      neon: true,
      neonPalette: [0x00ff9d, 0xbf7bff, 0x2af0ff],
      count: 5,
    },
    pedestrianOutfits: {
      palette: [0x224466, 0x66aa44, 0x5577aa, 0x883344],
      accessories: ['smartphone', 'earbuds', 'backpack'],
      population: 16,
      speedRange: [1.4, 2.6],
    },
    sky: {
      topColor: 0x4f86b8,
      bottomColor: 0xd8e8f5,
      sunDirection: [0.6, 0.8, 0.3],
      haze: 0.1,
      cloudTexture: 'clouds',
      stars: false,
    },
    lighting: {
      ambientIntensity: 0.65,
      sunIntensity: 1.0,
      sunColor: 0xfff2d9,
      shadowSoftness: 0.5,
      streetlightIntensity: 0.45,
      windowGlow: 0.6,
    },
    ground: {
      surfaceTexture: 'ground-2025',
      roadTexture: 'road',
      sidewalkTexture: 'sidewalk',
      color: 0x6f7d57,
    },
    sfx: { ambient: ['city-2025'], events: ['car-horn', 'birds'], ui: ['ui-click'] },
  },
);

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

registerEra(1945, era1945);
registerEra(1965, era1965);
registerEra(1985, era1985);
registerEra(2005, era2005);
registerEra(2025, era2025);

// ---------------------------------------------------------------------------
// Public API for the era-transition engine
// ---------------------------------------------------------------------------

function seedForYear(year: number): number {
  return (year * 2654435761) >>> 0;
}

/**
 * Build all buildings for the given era as a positioned {@link THREE.Group}.
 * The group is centered on the city block; buildings face the surrounding
 * streets and are visible from the default navigable camera position.
 */
export function buildEraBuildings(year: EraYear): THREE.Group {
  ensureTextures();
  const building = eraRegistry[year]?.buildings;
  if (!building) {
    throw new Error(`No building config registered for ${year}`);
  }
  const rng = new PRNG(seedForYear(year));
  const group = new THREE.Group();
  const lots = computeLots(building.density, rng);
  for (const lot of lots) {
    const height = rng.range(building.heightRange[0], building.heightRange[1]);
    const buildingGroup = buildBuilding(year, lot, height, rng);
    buildingGroup.position.set(lot.x, 0, lot.z);
    buildingGroup.rotation.y = lot.rotY;
    group.add(buildingGroup);
  }

  // Enable shadow casting on all building meshes so the directional light's
  // shadow map produces soft, believable shadows across the city block.
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
    }
  });
  return group;
}

/**
 * Dispose all geometries and materials owned by a building group. Call when a
 * building group is removed from the scene so GPU resources are released.
 */
export function disposeBuildings(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}
