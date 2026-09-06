/**
 * Procedural geometry + texture builders for the 2025 era scene.
 *
 * Everything here is generated at runtime from primitives and canvas/data
 * textures so the repository stays free of binary assets. Builders are pure
 * Three.js and make no DOM assumptions: screen textures fall back to solid
 * data textures when no canvas is available (e.g. headless tests), so the
 * scene remains fully composable in Node.
 *
 * The module exposes small, composable builders plus a `build2025Scene`
 * convenience that lays out a complete contemporary city block. The era
 * module (`2025.ts`) owns lifecycle (build/update/dispose) and interactive
 * points; this file only creates geometry.
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export const PALETTE = {
  glass: 0x9fc4d8,
  glassDark: 0x6f9bbd,
  glassFrame: 0x2a3a4a,
  concrete: 0xd8d4cc,
  concreteDark: 0xb9b4aa,
  asphalt: 0x3a3a3c,
  asphaltLight: 0x4a4a4c,
  curb: 0x9a958c,
  greenRoof: 0x4a7c3f,
  greenRoofDark: 0x3a6a32,
  plant: 0x3f7d30,
  plantLight: 0x6fae4a,
  solar: 0x2a3a55,
  solarFrame: 0x1e2a3d,
  ledCyan: 0x00e5ff,
  ledMagenta: 0xff2d78,
  ledAmber: 0xffb03a,
  ledWhite: 0xeaf6ff,
  facade: 0xc9b18f,
  facadeDark: 0xa88f6c,
  brick: 0xb56a4a,
  steel: 0x9aa3ab,
  white: 0xf2f2f2,
  black: 0x141416,
  tire: 0x1c1c1e,
  rim: 0xd8d8da,
  skin: 0xe8b98a,
  hair: 0x2b2118,
  evBody: 0xbfe3ff,
  evBodyDark: 0x7fb9e0,
  hybridBody: 0xd8d8da,
  busBody: 0x3fb8af,
  bikeFrame: 0xff6b6b,
  scooterBody: 0x9b8cff,
  charger: 0x3fb8af,
  chargerDark: 0x2c8f88,
  lightPole: 0x5a6270,
  lightHead: 0xeaf6ff,
  bench: 0x7a5c3e,
  benchFrame: 0x4a4a4c,
  treeTrunk: 0x6b4a2f,
  treeLeaf: 0x3f7d30,
  mulch: 0x6b4a2f,
  water: 0x3f7fb0,
  cycle: 0x2e8b57,
  crosswalk: 0xd8d8da,
} as const;

/* ------------------------------------------------------------------ */
/* Texture helpers (headless-safe)                                     */
/* ------------------------------------------------------------------ */

/** A 1x1 solid-color data texture (no DOM required). */
function solidTexture(r: number, g: number, b: number): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/**
 * Build a screen texture for LED panels / digital menu boards. When a DOM
 * canvas is available it draws a gradient plus a text label for "modern
 * typography"; otherwise it falls back to a solid emissive data texture so
 * the scene still builds headlessly.
 */
export function makeScreenTexture(
  width: number,
  height: number,
  label: string,
  accent: number,
): THREE.Texture {
  const [ar, ag, ab] = hexToRgb(accent);
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0a1620');
        grad.addColorStop(1, '#12303a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.9)`;
        ctx.lineWidth = Math.max(2, Math.floor(width / 40));
        ctx.strokeRect(2, 2, width - 4, height - 4);
        ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
        ctx.font = `bold ${Math.floor(height / 3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, width / 2, height / 2 - height * 0.08);
        ctx.font = `${Math.floor(height / 7)}px sans-serif`;
        ctx.fillStyle = '#bfd9e6';
        ctx.fillText('EST. 2025', width / 2, height / 2 + height * 0.22);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
      }
    } catch {
      // Fall through to the data texture below.
    }
  }
  return solidTexture(ar, ag, ab);
}

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

/** Create a box mesh and add it to a parent group. */
export function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rotY = 0,
  rotX = 0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, 0);
  parent.add(mesh);
  return mesh;
}

/** Create a cylinder mesh and add it to a parent group. */
export function cyl(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 12,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, height, segments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opts });
}

function emissiveMat(color: number, intensity = 2, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    ...opts,
  });
}

function glassMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.55,
  });
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

export type BuildingStyle = 'glass' | 'mixed';

export interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  style: BuildingStyle;
  /** Deterministic variation seed (0..1). */
  seed?: number;
}

/** A low planter strip of green used as a green roof / vertical planting. */
function addGreenRoof(parent: THREE.Object3D, w: number, d: number, y: number, density = 1): void {
  const base = mat(PALETTE.greenRoof);
  box(parent, w, 0.5, d, base, 0, y, 0);
  const tuft = mat(PALETTE.plantLight);
  const cols = Math.max(3, Math.floor(w / 2.2) * density);
  const rows = Math.max(3, Math.floor(d / 2.2) * density);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 3 === 0) {
        const x = -w / 2 + 1 + i * ((w - 2) / Math.max(1, cols - 1));
        const z = -d / 2 + 1 + j * ((d - 2) / Math.max(1, rows - 1));
        const hh = 0.5 + ((i * 7 + j * 13) % 4) * 0.15;
        box(parent, 0.5, hh, 0.5, tuft, x, y + 0.25 + hh / 2, z);
      }
    }
  }
}

/** Rooftop solar panel array. */
function addSolarPanels(parent: THREE.Object3D, w: number, d: number, y: number): void {
  const panel = mat(PALETTE.solar, { metalness: 0.6, roughness: 0.3 });
  const frame = mat(PALETTE.solarFrame);
  const cols = Math.max(2, Math.floor(w / 3));
  const rows = Math.max(2, Math.floor(d / 3));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = -w / 2 + 1.5 + i * ((w - 3) / Math.max(1, cols - 1));
      const z = -d / 2 + 1.5 + j * ((d - 3) / Math.max(1, rows - 1));
      box(parent, 2.6, 0.08, 1.4, panel, x, y, z, 0, -0.25);
      box(parent, 2.7, 0.06, 0.08, frame, x, y, z - 0.7, 0, -0.25);
      box(parent, 0.08, 0.06, 1.5, frame, x - 1.3, y, z, 0, -0.25);
    }
  }
}

/** Rooftop HVAC units. */
function addHvac(parent: THREE.Object3D, w: number, d: number, y: number): void {
  const hvac = mat(PALETTE.steel, { metalness: 0.5, roughness: 0.5 });
  const duct = mat(PALETTE.concreteDark);
  const n = Math.max(2, Math.floor(w / 6));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 2.5 + i * ((w - 5) / Math.max(1, n - 1));
    box(parent, 2.4, 1.2, 2.4, hvac, x, y + 0.6, d / 2 - 2.5);
    box(parent, 1.0, 0.7, 1.0, duct, x, y + 2.0, d / 2 - 2.5);
  }
}

/** Glass office tower: podium + glazed tower + green roof + solar + HVAC. */
function buildGlassTower(parent: THREE.Object3D, spec: BuildingSpec): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  parent.add(g);

  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;
  const podiumH = 4.5;

  // Podium base.
  const podiumMat = mat(PALETTE.concrete);
  box(g, w, podiumH, d, podiumMat, 0, podiumH / 2, 0);

  // Glazed tower.
  const glass = glassMat(PALETTE.glass);
  const towerH = h - podiumH;
  box(g, w * 0.82, towerH, d * 0.82, glass, 0, podiumH + towerH / 2, 0);

  // Vertical mullions on the tower facades.
  const frameMat = mat(PALETTE.glassFrame, { metalness: 0.7, roughness: 0.4 });
  const mullCount = Math.max(5, Math.floor(w * 0.82 / 2.2));
  for (let i = 0; i <= mullCount; i++) {
    const x = -w * 0.41 + i * (w * 0.82 / mullCount);
    box(g, 0.14, towerH, d * 0.84, frameMat, x, podiumH + towerH / 2, 0);
  }
  const horizCount = Math.max(6, Math.floor(towerH / 3));
  for (let j = 0; j <= horizCount; j++) {
    const y = podiumH + j * (towerH / horizCount);
    box(g, w * 0.84, 0.12, d * 0.84, frameMat, 0, y, 0);
  }

  // Roof: green roof edge + solar + HVAC.
  const roofY = h;
  addGreenRoof(g, w * 0.9, d * 0.9, roofY, 0.6);
  addSolarPanels(g, w * 0.7, d * 0.5, roofY + 0.7);
  addHvac(g, w * 0.5, d * 0.5, roofY + 0.5);

  // Parapet.
  const parapet = mat(PALETTE.concreteDark);
  box(g, w, 0.8, 0.3, parapet, 0, roofY + 0.4, -d / 2);
  box(g, w, 0.8, 0.3, parapet, 0, roofY + 0.4, d / 2);
  box(g, 0.3, 0.8, d, parapet, -w / 2, roofY + 0.4, 0);
  box(g, 0.3, 0.8, d, parapet, w / 2, roofY + 0.4, 0);

  return g;
}

/** Mixed-use building: retail base + upper floors + green roof + solar + HVAC + vertical planting. */
function buildMixedUse(parent: THREE.Object3D, spec: BuildingSpec): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  parent.add(g);

  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;
  const retailH = 4.2;
  const upperH = h - retailH;

  // Retail base.
  const baseMat = mat(PALETTE.concrete);
  box(g, w, retailH, d, baseMat, 0, retailH / 2, 0);

  // Upper facade.
  const facadeMat = mat(PALETTE.facade);
  box(g, w, upperH, d, facadeMat, 0, retailH + upperH / 2, 0);

  // Window bands on upper floors.
  const winMat = glassMat(PALETTE.glassDark);
  const floors = Math.max(2, Math.floor(upperH / 3));
  const winW = w * 0.7;
  const winH = 1.4;
  for (let f = 0; f < floors; f++) {
    const y = retailH + 1.5 + f * (upperH / floors);
    // Front and back window bands.
    box(g, winW, winH, 0.3, winMat, 0, y, d / 2);
    box(g, winW, winH, 0.3, winMat, 0, y, -d / 2);
    // Side windows.
    box(g, 0.3, winH, d * 0.6, winMat, w / 2, y, 0);
    box(g, 0.3, winH, d * 0.6, winMat, -w / 2, y, 0);
  }

  // Vertical planting strips on the facade corners.
  const plantMat = mat(PALETTE.plant);
  const colH = h;
  box(g, 0.5, colH, 0.5, plantMat, -w / 2 + 0.6, h / 2, -d / 2 + 0.6);
  box(g, 0.5, colH, 0.5, plantMat, w / 2 - 0.6, h / 2, -d / 2 + 0.6);
  box(g, 0.5, colH, 0.5, plantMat, -w / 2 + 0.6, h / 2, d / 2 - 0.6);
  box(g, 0.5, colH, 0.5, plantMat, w / 2 - 0.6, h / 2, d / 2 - 0.6);

  // Green roof + solar + HVAC.
  const roofY = h;
  addGreenRoof(g, w * 0.9, d * 0.9, roofY, 0.9);
  addSolarPanels(g, w * 0.55, d * 0.5, roofY + 0.7);
  addHvac(g, w * 0.5, d * 0.5, roofY + 0.5);

  return g;
}

/** Build a building of the given style into a parent group. */
export function buildBuilding(parent: THREE.Object3D, spec: BuildingSpec): THREE.Group {
  return spec.style === 'glass' ? buildGlassTower(parent, spec) : buildMixedUse(parent, spec);
}

/* ------------------------------------------------------------------ */
/* Storefronts                                                         */
/* ------------------------------------------------------------------ */

export type StorefrontKind = 'coffee' | 'smoothie' | 'evshowroom' | 'cowork';

export interface StorefrontSpec {
  x: number;
  z: number;
  kind: StorefrontKind;
  /** Rotation around Y applied after building (0 = facing +z). */
  rotY: number;
  width?: number;
}

const STOREFRONT_COLORS: Record<StorefrontKind, number> = {
  coffee: 0x8a5a2b,
  smoothie: 0x2e8b57,
  evshowroom: 0x2a7fb8,
  cowork: 0x7a5cc0,
};

const STOREFRONT_LABELS: Record<StorefrontKind, string> = {
  coffee: 'ROAST LAB',
  smoothie: 'VITA BAR',
  evshowroom: 'VOLT EV',
  cowork: 'HUB 2025',
};

/** A single storefront with a backlit fascia and a digital menu board. */
export function buildStorefront(parent: THREE.Object3D, spec: StorefrontSpec): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const w = spec.width ?? 7;
  const h = 4.2;
  const accent = STOREFRONT_COLORS[spec.kind];

  // Glazed storefront body.
  const glass = glassMat(PALETTE.glass);
  box(g, w, h, 0.2, glass, 0, h / 2, 0);
  const frame = mat(PALETTE.concreteDark);
  box(g, w, 0.35, 0.4, frame, 0, h - 0.2, 0);
  box(g, 0.3, h, 0.4, frame, -w / 2, h / 2, 0);
  box(g, 0.3, h, 0.4, frame, w / 2, h / 2, 0);

  // Backlit fascia (emissive sign band above the glass).
  const fascia = emissiveMat(accent, 2.2);
  box(g, w - 0.6, 1.0, 0.5, fascia, 0, h + 0.5, 0);

  // Digital menu board beside the door.
  const menuTex = makeScreenTexture(256, 128, STOREFRONT_LABELS[spec.kind], accent);
  const menuMat = new THREE.MeshBasicMaterial({ map: menuTex });
  box(g, 1.6, 0.9, 0.12, menuMat, w * 0.3, h - 0.6, 0.2);

  // Door.
  const doorMat = mat(PALETTE.glassDark);
  box(g, 1.2, 2.4, 0.15, doorMat, -w * 0.28, 1.2, 0.25);

  // Storefront-specific accent.
  if (spec.kind === 'evshowroom') {
    // A small EV in the window.
    const ev = buildVehicle(g, 'ev', { x: 0, z: 0.6, rotY: 0, scale: 0.5 });
    ev.rotation.y = Math.PI;
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* LED billboards & digital kiosks                                     */
/* ------------------------------------------------------------------ */

/** A large LED billboard on a post or facade. */
export function buildLedBillboard(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number; y?: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, spec.y ?? 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const pole = mat(PALETTE.steel, { metalness: 0.6, roughness: 0.4 });
  cyl(g, 0.18, 6.5, pole, 0, 3.25, 0);

  const tex = makeScreenTexture(512, 256, 'CITY 2025', PALETTE.ledCyan);
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  box(g, 6.0, 3.0, 0.25, screenMat, 0, 6.6, 0);
  const frameMat = mat(PALETTE.black, { metalness: 0.4, roughness: 0.5 });
  box(g, 6.4, 3.4, 0.3, frameMat, 0, 6.6, 0);

  return g;
}

/** A sidewalk digital kiosk with a touchscreen. */
export function buildDigitalKiosk(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const bodyMat = mat(PALETTE.steel, { metalness: 0.5, roughness: 0.5 });
  box(g, 0.7, 2.0, 0.4, bodyMat, 0, 1.0, 0);
  const tex = makeScreenTexture(128, 160, 'INFO', PALETTE.ledMagenta);
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  box(g, 0.55, 1.2, 0.06, screenMat, 0, 1.35, 0.22);
  const baseMat = mat(PALETTE.concreteDark);
  box(g, 0.9, 0.2, 0.6, baseMat, 0, 0.1, 0);

  return g;
}

/* ------------------------------------------------------------------ */
/* Street furniture                                                    */
/* ------------------------------------------------------------------ */

/** A smart streetlight with a slim LED head. */
export function buildSmartStreetlight(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const pole = mat(PALETTE.lightPole, { metalness: 0.6, roughness: 0.4 });
  cyl(g, 0.14, 6.0, pole, 0, 3.0, 0);
  const arm = mat(PALETTE.lightPole, { metalness: 0.6, roughness: 0.4 });
  box(g, 1.6, 0.12, 0.12, arm, 0.8, 5.9, 0);
  const head = emissiveMat(PALETTE.ledWhite, 2.4);
  box(g, 1.1, 0.2, 0.35, head, 1.3, 5.75, 0);
  // Camera/sensor puck.
  const sensor = emissiveMat(PALETTE.ledCyan, 1.6);
  cyl(g, 0.08, 0.12, sensor, 0, 5.7, 0, 8);

  return g;
}

/** A public bench. */
export function buildBench(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const frameMat = mat(PALETTE.benchFrame, { metalness: 0.5, roughness: 0.6 });
  const seatMat = mat(PALETTE.bench);
  box(g, 1.8, 0.1, 0.5, seatMat, 0, 0.5, 0);
  box(g, 1.8, 0.1, 0.4, seatMat, 0, 0.85, 0.05);
  box(g, 0.08, 0.55, 0.5, frameMat, 0.8, 0.27, 0);
  box(g, 0.08, 0.55, 0.5, frameMat, -0.8, 0.27, 0);
  box(g, 1.8, 0.7, 0.06, frameMat, 0, 0.9, -0.22);

  return g;
}

/** A street tree with trunk and canopy. */
export function buildTree(parent: THREE.Object3D, spec: { x: number; z: number; scale?: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  const s = spec.scale ?? 1;
  g.scale.setScalar(s);
  parent.add(g);

  const trunk = mat(PALETTE.treeTrunk);
  cyl(g, 0.22, 2.6, trunk, 0, 1.3, 0, 8);
  const leaf = mat(PALETTE.treeLeaf);
  box(g, 2.6, 1.8, 2.6, leaf, 0, 3.4, 0);
  box(g, 1.8, 1.4, 1.8, mat(PALETTE.plantLight), 0, 4.6, 0);

  return g;
}

/** A parklet: a raised platform with seating, planters and a bike rack. */
export function buildParklet(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const deckMat = mat(PALETTE.bench);
  box(g, 4.0, 0.25, 2.4, deckMat, 0, 0.12, 0);
  const planterMat = mat(PALETTE.concreteDark);
  box(g, 1.2, 0.7, 1.2, planterMat, -1.2, 0.35, 0);
  const plantMat = mat(PALETTE.plant);
  box(g, 1.0, 0.9, 1.0, plantMat, -1.2, 0.95, 0);
  // Seating.
  box(g, 1.6, 0.1, 0.5, mat(PALETTE.bench), 1.1, 0.6, 0);
  box(g, 0.08, 0.5, 0.5, mat(PALETTE.benchFrame), 0.7, 0.3, 0);
  box(g, 0.08, 0.5, 0.5, mat(PALETTE.benchFrame), 1.5, 0.3, 0);
  // Bike rack.
  const rackMat = mat(PALETTE.steel, { metalness: 0.6, roughness: 0.4 });
  box(g, 0.06, 0.5, 0.06, rackMat, 0.4, 0.4, 0.6);
  box(g, 0.06, 0.5, 0.06, rackMat, 0.7, 0.4, 0.6);

  return g;
}

/** A rain garden: a sunken planted area with a water feature and mulch. */
export function buildRainGarden(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number; scale?: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  const s = spec.scale ?? 1;
  g.scale.setScalar(s);
  parent.add(g);

  const bedMat = mat(PALETTE.concreteDark);
  box(g, 3.0, 0.2, 2.0, bedMat, 0, 0.05, 0);
  const mulchMat = mat(PALETTE.mulch);
  box(g, 2.6, 0.12, 1.6, mulchMat, 0, 0.16, 0);
  const plantMat = mat(PALETTE.plant);
  box(g, 0.7, 0.8, 0.7, plantMat, -0.8, 0.6, 0);
  box(g, 0.6, 0.6, 0.6, mat(PALETTE.plantLight), 0.8, 0.5, 0);
  const waterMat = mat(PALETTE.water, { metalness: 0.2, roughness: 0.1 });
  box(g, 1.0, 0.1, 0.7, waterMat, 0, 0.22, 0);

  return g;
}

/** An EV charging station with a cable + charging port. */
export function buildEvCharger(parent: THREE.Object3D, spec: { x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const bodyMat = mat(PALETTE.charger, { metalness: 0.4, roughness: 0.5 });
  box(g, 0.7, 1.6, 0.4, bodyMat, 0, 0.8, 0);
  const screen = emissiveMat(PALETTE.ledCyan, 1.8);
  box(g, 0.5, 0.5, 0.06, screen, 0, 1.1, 0.22);
  const cable = mat(PALETTE.black);
  box(g, 0.06, 0.06, 0.9, cable, 0, 0.4, 0.5);
  const plug = mat(PALETTE.chargerDark);
  box(g, 0.14, 0.14, 0.2, plug, 0, 0.4, 1.0);
  box(g, 0.9, 0.2, 0.6, mat(PALETTE.concreteDark), 0, 0.1, 0);

  return g;
}

/** A protected cycle lane strip (green painted asphalt). */
export function buildCycleLane(parent: THREE.Object3D, spec: { width: number; depth: number; x: number; z: number; rotY: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0.03, spec.z);
  g.rotation.y = spec.rotY;
  parent.add(g);

  const laneMat = mat(PALETTE.cycle, { roughness: 0.9 });
  box(g, spec.width, 0.06, spec.depth, laneMat, 0, 0, 0);
  // Dashed center line.
  const dashMat = mat(PALETTE.white);
  const n = Math.max(6, Math.floor(spec.depth / 4));
  for (let i = 0; i < n; i++) {
    const z = -spec.depth / 2 + 2 + i * ((spec.depth - 4) / Math.max(1, n - 1));
    box(g, spec.width, 0.07, 1.2, dashMat, 0, 0, z);
  }
  // Bicycle glyph (two small circles + frame) near the start.
  const glyphMat = mat(PALETTE.white);
  cyl(g, 0.22, 0.05, glyphMat, -0.6, 0.05, -spec.depth / 2 + 1.2, 12);
  cyl(g, 0.22, 0.05, glyphMat, 0.6, 0.05, -spec.depth / 2 + 1.2, 12);

  return g;
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export type VehicleKind = 'ev' | 'hybrid' | 'ebike' | 'scooter' | 'evBus';

export interface VehicleSpec {
  x: number;
  z: number;
  rotY: number;
  scale?: number;
}

function buildCar(parent: THREE.Group, bodyColor: number, isEv: boolean): THREE.Group {
  const body = mat(bodyColor, { metalness: 0.4, roughness: 0.4 });
  const glass = glassMat(PALETTE.glassDark);
  const tire = mat(PALETTE.tire);
  const rim = mat(PALETTE.rim, { metalness: 0.8, roughness: 0.2 });

  // Lower body.
  box(parent, 4.4, 0.7, 1.9, body, 0, 0.55, 0);
  // Cabin.
  box(parent, 2.2, 0.7, 1.7, glass, -0.2, 1.2, 0);
  // Hood + trunk.
  box(parent, 1.1, 0.35, 1.8, body, 1.6, 0.85, 0);
  box(parent, 1.1, 0.35, 1.8, body, -1.6, 0.85, 0);
  // Wheels.
  const wPos = [1.4, -1.4];
  for (const x of wPos) {
    cyl(parent, 0.42, 0.3, tire, x, 0.42, 0.95, 14);
    cyl(parent, 0.42, 0.3, tire, x, 0.42, -0.95, 14);
    cyl(parent, 0.2, 0.32, rim, x, 0.42, 0.95, 10);
    cyl(parent, 0.2, 0.32, rim, x, 0.42, -0.95, 10);
  }
  // Headlights / taillights.
  const light = emissiveMat(isEv ? PALETTE.ledCyan : PALETTE.ledWhite, 2);
  box(parent, 0.3, 0.2, 0.1, light, 2.05, 0.75, 0.6);
  box(parent, 0.3, 0.2, 0.1, light, 2.05, 0.75, -0.6);
  const tail = emissiveMat(PALETTE.ledMagenta, 1.6);
  box(parent, 0.3, 0.2, 0.1, tail, -2.05, 0.75, 0.6);
  box(parent, 0.3, 0.2, 0.1, tail, -2.05, 0.75, -0.6);
  // EV charge port indicator.
  if (isEv) {
    const port = emissiveMat(PALETTE.ledCyan, 2);
    box(parent, 0.25, 0.18, 0.06, port, 0.2, 0.8, 0.96);
  }
  return parent;
}

function buildBus(parent: THREE.Group): THREE.Group {
  const body = mat(PALETTE.busBody, { metalness: 0.3, roughness: 0.5 });
  const glass = glassMat(PALETTE.glassDark);
  const tire = mat(PALETTE.tire);
  const rim = mat(PALETTE.rim, { metalness: 0.8, roughness: 0.2 });
  const accent = emissiveMat(PALETTE.ledCyan, 2);

  box(parent, 9.5, 2.4, 2.5, body, 0, 1.7, 0);
  // Windshield and side windows.
  box(parent, 0.4, 1.5, 2.2, glass, 4.5, 2.0, 0);
  for (let i = 0; i < 5; i++) {
    box(parent, 1.4, 1.2, 0.2, glass, 2.4 - i * 1.6, 2.0, 1.26);
    box(parent, 1.4, 1.2, 0.2, glass, 2.4 - i * 1.6, 2.0, -1.26);
  }
  // Wheels.
  for (const x of [3.2, 0.4, -2.6]) {
    cyl(parent, 0.5, 0.34, tire, x, 0.5, 1.25, 14);
    cyl(parent, 0.5, 0.34, tire, x, 0.5, -1.25, 14);
    cyl(parent, 0.24, 0.36, rim, x, 0.5, 1.25, 10);
    cyl(parent, 0.24, 0.36, rim, x, 0.5, -1.25, 10);
  }
  // Route display.
  box(parent, 1.6, 0.4, 0.1, accent, 4.3, 2.9, 0);
  // Headlights.
  box(parent, 0.4, 0.3, 0.16, accent, 4.55, 1.5, 0.8);
  box(parent, 0.4, 0.3, 0.16, accent, 4.55, 1.5, -0.8);
  return parent;
}

function buildEbike(parent: THREE.Group): THREE.Group {
  const frame = mat(PALETTE.bikeFrame, { metalness: 0.4, roughness: 0.4 });
  const tire = mat(PALETTE.tire);
  const rim = mat(PALETTE.rim, { metalness: 0.8, roughness: 0.2 });
  // Wheels.
  cyl(parent, 0.32, 0.06, tire, 0.7, 0.32, 0, 14);
  cyl(parent, 0.32, 0.06, tire, -0.7, 0.32, 0, 14);
  cyl(parent, 0.16, 0.08, rim, 0.7, 0.32, 0, 10);
  cyl(parent, 0.16, 0.08, rim, -0.7, 0.32, 0, 10);
  // Frame.
  box(parent, 0.06, 0.06, 1.4, frame, 0, 0.5, 0);
  box(parent, 0.5, 0.06, 0.06, frame, 0.2, 0.5, 0);
  box(parent, 0.06, 0.5, 0.06, frame, -0.3, 0.75, 0);
  // Seat + handlebar.
  box(parent, 0.16, 0.08, 0.3, mat(PALETTE.black), -0.3, 1.05, 0);
  box(parent, 0.08, 0.3, 0.08, frame, 0.7, 0.75, 0);
  box(parent, 0.3, 0.06, 0.06, frame, 0.7, 0.85, 0);
  // Battery pack.
  box(parent, 0.22, 0.18, 0.4, mat(PALETTE.chargerDark), -0.05, 0.55, 0);
  return parent;
}

function buildScooter(parent: THREE.Group): THREE.Group {
  const body = mat(PALETTE.scooterBody, { metalness: 0.4, roughness: 0.4 });
  const tire = mat(PALETTE.tire);
  const rim = mat(PALETTE.rim, { metalness: 0.8, roughness: 0.2 });
  // Deck.
  box(parent, 0.9, 0.08, 0.28, body, 0, 0.22, 0);
  // Stem.
  box(parent, 0.08, 0.9, 0.08, body, -0.35, 0.7, 0);
  box(parent, 0.34, 0.07, 0.07, body, -0.35, 1.14, 0);
  // Wheels.
  cyl(parent, 0.14, 0.06, tire, -0.35, 0.14, 0, 10);
  cyl(parent, 0.14, 0.06, tire, 0.4, 0.14, 0, 10);
  cyl(parent, 0.07, 0.08, rim, -0.35, 0.14, 0, 8);
  cyl(parent, 0.07, 0.08, rim, 0.4, 0.14, 0, 8);
  // Headlight.
  const light = emissiveMat(PALETTE.ledCyan, 2);
  box(parent, 0.14, 0.1, 0.06, light, -0.42, 1.0, 0);
  return parent;
}

/** Build a vehicle mesh (not added to any parent). */
export function buildVehicleMesh(kind: VehicleKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'ev':
      buildCar(g, PALETTE.evBody, true);
      break;
    case 'hybrid':
      buildCar(g, PALETTE.hybridBody, false);
      break;
    case 'evBus':
      buildBus(g);
      break;
    case 'ebike':
      buildEbike(g);
      break;
    case 'scooter':
      buildScooter(g);
      break;
  }
  return g;
}

/** Build a vehicle into a parent group at a world position. */
export function buildVehicle(parent: THREE.Object3D, kind: VehicleKind, spec: VehicleSpec): THREE.Group {
  const g = buildVehicleMesh(kind);
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  if (spec.scale) g.scale.setScalar(spec.scale);
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                         */
/* ------------------------------------------------------------------ */

export type OutfitVariant = 'techwear' | 'athleisure' | 'puffer' | 'business' | 'casual';

export interface PedestrianSpec {
  x: number;
  z: number;
  rotY: number;
  variant: OutfitVariant;
  scale?: number;
}

const OUTFIT_COLORS: Record<OutfitVariant, { top: number; bottom: number; accent: number }> = {
  techwear: { top: 0x2b2b33, bottom: 0x1f1f26, accent: 0x00e5ff },
  athleisure: { top: 0x3f7d30, bottom: 0x222222, accent: 0xffb03a },
  puffer: { top: 0xd05a5a, bottom: 0x2b2b33, accent: 0xffffff },
  business: { top: 0x3a4a5a, bottom: 0x2b3542, accent: 0xbfd9e6 },
  casual: { top: 0x6a8fb0, bottom: 0x4a4a52, accent: 0xf2f2f2 },
};

/** Build a pedestrian mesh (not added to any parent). */
export function buildPedestrianMesh(variant: OutfitVariant): THREE.Group {
  const g = new THREE.Group();
  const c = OUTFIT_COLORS[variant];
  const skin = mat(PALETTE.skin);
  const hair = mat(PALETTE.hair);
  const top = mat(c.top, { roughness: 0.85 });
  const bottom = mat(c.bottom, { roughness: 0.85 });
  const accent = emissiveMat(c.accent, 1.6);

  // Legs.
  box(g, 0.16, 0.7, 0.16, bottom, -0.12, 0.35, 0);
  box(g, 0.16, 0.7, 0.16, bottom, 0.12, 0.35, 0);
  // Shoes.
  box(g, 0.18, 0.1, 0.3, mat(PALETTE.black), -0.12, 0.05, 0.04);
  box(g, 0.18, 0.1, 0.3, mat(PALETTE.black), 0.12, 0.05, 0.04);
  // Torso.
  const torsoH = variant === 'puffer' ? 0.85 : 0.75;
  box(g, 0.5, torsoH, 0.3, top, 0, 0.75 + torsoH / 2, 0);
  // Puffer bulk.
  if (variant === 'puffer') {
    box(g, 0.56, torsoH, 0.36, mat(c.top, { roughness: 0.95 }), 0, 0.75 + torsoH / 2, 0);
  }
  // Arms.
  box(g, 0.14, 0.6, 0.14, top, -0.36, 1.15, 0);
  box(g, 0.14, 0.6, 0.14, top, 0.36, 1.15, 0);
  // Head.
  box(g, 0.3, 0.3, 0.3, skin, 0, 1.75, 0);
  box(g, 0.32, 0.12, 0.32, hair, 0, 1.95, 0);
  // Accessories.
  if (variant === 'techwear' || variant === 'business' || variant === 'casual') {
    // Phone held out in hand.
    box(g, 0.1, 0.18, 0.03, accent, 0.42, 1.2, 0.05);
  }
  if (variant === 'techwear') {
    // Backpack / visor.
    box(g, 0.3, 0.4, 0.12, mat(c.bottom), -0.3, 1.1, 0);
    box(g, 0.3, 0.06, 0.3, accent, 0, 2.02, 0);
  }
  if (variant === 'athleisure') {
    // Headphones.
    box(g, 0.36, 0.08, 0.1, mat(PALETTE.black), 0, 1.85, 0);
  }
  return g;
}

/** Build a pedestrian into a parent group at a world position. */
export function buildPedestrian(parent: THREE.Object3D, spec: PedestrianSpec): THREE.Group {
  const g = buildPedestrianMesh(spec.variant);
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rotY;
  if (spec.scale) g.scale.setScalar(spec.scale);
  parent.add(g);
  return g;
}