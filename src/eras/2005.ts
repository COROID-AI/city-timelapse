import * as THREE from 'three';

/**
 * Era module: 2005 — "Digital Age".
 *
 * Procedural mid-2000s city block profile built from three.js primitives and
 * canvas-drawn textures only (no model or texture downloads):
 *  - Layer 1 (buildings): mixed-use mid-rises with blue-green glass curtain
 *    walls over precast retail podiums, rooftop HVAC/antennas, and a lit
 *    low-rise background skyline.
 *  - Layer 2 (storefronts): chain retail row — a green-logo coffee chain, a
 *    backlit mobile-phone store and sandwich shops, with clear glazing,
 *    glowing interiors and menu/display props.
 *  - Layer 3 (advertising): LED-backlit sign bands, two animated digital
 *    billboards (frame-cycling screens plus scrolling tickers) and backlit
 *    bus-shelter ad panels.
 *  - Layer 4 (vehicles): 2000s sedans and tall SUVs with roof rails and body
 *    cladding cruising both avenue lanes with rolling wheels.
 *  - Layer 5 (pedestrians): casual-era walkers (jeans, tees, hoodies, caps,
 *    backpacks) with walk cycles; several pause to check their phones.
 *  - Layer 6 (street furniture): white-LED street lamps, mast-arm traffic
 *    signals, panning traffic cameras, inverted-U bike racks, newspaper
 *    boxes, bus shelters, benches, litter bins, a hydrant, a mail drop and
 *    street trees.
 *
 * Animation state lives in `group.userData.era2005` so `update(dt, group)`
 * stays instance-safe; `update(dt)` after `buildEra2005()` also works.
 * Polygon budget: boxes plus low-segment cylinders/spheres keep the block
 * far below the ~50k triangle target (~18k triangles when assembled).
 */

type Dir = 1 | -1;

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const AVENUE_LENGTH = 96;
const HALF_LEN = AVENUE_LENGTH / 2;
const ROAD_HALF_W = 6.4;
const WALK_INNER = ROAD_HALF_W + 0.25;
const WALK_OUTER = WALK_INNER + 4;
/** Building/podium streetwall face, flush with the outer sidewalk edge. */
const FACE_X = WALK_OUTER;
const CURB_H = 0.28;
const SIDEWALK_TOP = 0.15;
const CAR_WRAP_Z = 46;
const WALKER_WRAP_Z = 21;
const WALKER_X = 7.85;
const CROSSWALK_HALF = 7.2;
const SIGNAL_PERIOD = 8.5;
const HIP_Y = 0.86;

/* ------------------------------------------------------------------ */
/* Runtime state                                                       */
/* ------------------------------------------------------------------ */

interface CarRuntime {
  group: THREE.Group;
  dirZ: Dir;
  speed: number;
  wheels: THREE.Object3D[];
  wheelRadius: number;
}

interface WalkerParts {
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Mesh;
}

interface WalkerRuntime {
  group: THREE.Group;
  parts: WalkerParts;
  dirZ: Dir;
  speed: number;
  phase: number;
  seed: number;
  curY: number;
  phone: boolean;
  idle: boolean;
}

interface SignalRuntime {
  red: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  offset: number;
}

interface ScreenRuntime {
  material: THREE.MeshBasicMaterial;
  frames: THREE.Texture[];
  period: number;
  phase: number;
  current: number;
}

interface TickerRuntime {
  texture: THREE.Texture | null;
  speed: number;
}

interface FlickerRuntime {
  material: THREE.MeshStandardMaterial;
  base: number;
  rate: number;
  seed: number;
}

interface CamRuntime {
  pivot: THREE.Group;
  rate: number;
  seed: number;
}

interface Era2005State {
  elapsed: number;
  cars: CarRuntime[];
  walkers: WalkerRuntime[];
  signals: SignalRuntime[];
  screens: ScreenRuntime[];
  tickers: TickerRuntime[];
  flickers: FlickerRuntime[];
  cameras: CamRuntime[];
  walkersRoot: THREE.Group;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function std(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, ...params });
}

function basic(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function boxAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  rTop: number,
  rBottom: number,
  h: number,
  seg: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function sphereAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  r: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Deterministic LCG so every rebuild is identical. */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * Draws onto a CanvasTexture. Returns null when DOM canvas is unavailable
 * (node-side smoke tests) so callers can fall back to flat materials.
 */
function canvasTexture(w: number, h: number, draw: Draw): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

/** Blue-green glass curtain wall: mullion grid with mixed lit panes. */
function makeCurtainWallMaterial(cols: number, rows: number, seedNum: number): THREE.MeshStandardMaterial {
  const rng = createRng(seedNum);
  const panes = ['#9fc4c9', '#7fb0b8', '#5f95a3', '#88b7bd', '#6fa3ae', '#a9ccd1'];
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b333c';
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const lit = rng() < 0.22;
        ctx.fillStyle = lit ? '#ffe9b8' : panes[Math.floor(rng() * panes.length)];
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      }
    }
  });
  if (!texture) {
    return std({ color: 0x6f98a2, metalness: 0.65, roughness: 0.28 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.3,
    metalness: 0.6,
    roughness: 0.26,
  });
}

/** Sparse warm window grid for the background skyline. */
function makeWindowGridMaterial(seedNum: number): THREE.MeshStandardMaterial {
  const rng = createRng(seedNum);
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(0, 0, w, h);
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 8; r++) {
        ctx.fillStyle = rng() < 0.3 ? '#f5dfa8' : '#565d66';
        ctx.fillRect(c * 16 + 3, r * 16 + 3, 10, 10);
      }
    }
  });
  if (!texture) {
    return std({ color: 0x4a5058 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.22,
    roughness: 0.8,
  });
}

/** LED-backlit channel-letter sign band above a storefront. */
function makeLedSignMaterial(text: string, bg: number, fg: number): THREE.MeshStandardMaterial {
  const texture = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = `bold ${Math.min(64, (w * 0.9) / Math.max(text.length * 0.62, 1))}px Arial, Helvetica, sans-serif`;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  if (!texture) {
    return std({ color: bg, emissive: new THREE.Color(bg), emissiveIntensity: 0.9 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: texture,
    emissiveIntensity: 1.15,
    roughness: 0.5,
  });
}

/** Round coffee-chain logo disc. */
function makeLogoMaterial(bg: number, fg: number, ring: number): THREE.MeshStandardMaterial {
  const texture = canvasTexture(256, 256, (ctx, w, _h) => {
    ctx.fillStyle = css(bg);
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(ring);
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = 'bold 44px Arial, Helvetica, sans-serif';
    ctx.fillText('COFFEE', w / 2, w / 2 - 18);
    ctx.fillText('CO.', w / 2, w / 2 + 30);
  });
  if (!texture) {
    return std({ color: bg, emissive: new THREE.Color(bg), emissiveIntensity: 0.7 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: texture,
    emissiveIntensity: 0.85,
    roughness: 0.45,
  });
}

/** One digital-billboard frame of mid-2000s advertising. */
function makeAdFrameTexture(headline: string, sub: string, bg: number, fg: number): THREE.Texture | null {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, w, 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = `bold ${Math.min(72, (w * 0.88) / Math.max(headline.length * 0.58, 1))}px Arial, Helvetica, sans-serif`;
    ctx.fillText(headline, w / 2, h * 0.42);
    ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, w / 2, h * 0.74);
  });
}

/** Horizontally tiling ticker strip for LED screens. */
function makeTickerMaterial(text: string, bg: number, fg: number): {
  material: THREE.MeshBasicMaterial;
  texture: THREE.Texture | null;
} {
  const texture = canvasTexture(1024, 96, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = 'bold 52px Arial, Helvetica, sans-serif';
    ctx.fillText(text, 8, h / 2 + 2);
    ctx.fillText(text, w / 2 + 8, h / 2 + 2);
  });
  if (!texture) {
    return { material: basic(0x0a2a4a), texture: null };
  }
  texture.wrapS = THREE.RepeatWrapping;
  return { material: new THREE.MeshBasicMaterial({ map: texture }), texture };
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

interface MaterialSet {
  asphalt: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  plaza: THREE.MeshStandardMaterial;
  paintYellow: THREE.MeshStandardMaterial;
  paintWhite: THREE.MeshStandardMaterial;
  precast: THREE.MeshStandardMaterial;
  precastDark: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  shopGlass: THREE.MeshStandardMaterial;
  interiorWarm: THREE.MeshBasicMaterial;
  interiorCool: THREE.MeshBasicMaterial;
  tire: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  cladding: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
  ledPanel: THREE.MeshStandardMaterial;
  signalBox: THREE.MeshStandardMaterial;
  backplate: THREE.MeshStandardMaterial;
  seatSlat: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  hydrant: THREE.MeshStandardMaterial;
  mailbox: THREE.MeshStandardMaterial;
  phoneGlow: THREE.MeshStandardMaterial;
}

function createMaterials(): MaterialSet {
  return {
    asphalt: std({ color: 0x33363c, roughness: 0.96 }),
    curb: std({ color: 0xb6b3ab, roughness: 0.9 }),
    sidewalk: std({ color: 0xc4c1b8, roughness: 0.92 }),
    plaza: std({ color: 0xa9a69d, roughness: 0.94 }),
    paintYellow: std({ color: 0xd9a531, roughness: 0.65 }),
    paintWhite: std({ color: 0xe8e6de, roughness: 0.65 }),
    precast: std({ color: 0xcfc6b4, roughness: 0.85 }),
    precastDark: std({ color: 0x8e8778, roughness: 0.85 }),
    darkMetal: std({ color: 0x3a3f45, metalness: 0.55, roughness: 0.45 }),
    aluminum: std({ color: 0xc9ced2, metalness: 0.8, roughness: 0.32 }),
    shopGlass: std({ color: 0x9fc6cf, metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.32 }),
    interiorWarm: basic(0xffe3b0),
    interiorCool: basic(0xbfe6ff),
    tire: std({ color: 0x1c1e20, roughness: 0.95 }),
    rim: std({ color: 0xcfd4d8, metalness: 0.85, roughness: 0.28 }),
    cladding: std({ color: 0x2e3236, roughness: 0.9 }),
    chrome: std({ color: 0xd8dde0, metalness: 0.85, roughness: 0.2 }),
    headlight: std({ color: 0xfff3d6, emissive: new THREE.Color(0xffe9c4), emissiveIntensity: 1.6 }),
    taillight: std({ color: 0x8e2020, emissive: new THREE.Color(0xff2a22), emissiveIntensity: 1.3 }),
    ledPanel: std({ color: 0xffffff, emissive: new THREE.Color(0xf4faff), emissiveIntensity: 2.2 }),
    signalBox: std({ color: 0x2c2f33, roughness: 0.7 }),
    backplate: std({ color: 0x1d1f22, roughness: 0.8 }),
    seatSlat: std({ color: 0x6f5a3e, roughness: 0.85 }),
    foliage: std({ color: 0x4a6b3a, roughness: 0.95 }),
    trunk: std({ color: 0x5b4632, roughness: 0.95 }),
    hydrant: std({ color: 0xd9b13b, roughness: 0.6, metalness: 0.2 }),
    mailbox: std({ color: 0x2a4a8e, roughness: 0.55, metalness: 0.35 }),
    phoneGlow: std({ color: 0x9fd8ff, emissive: new THREE.Color(0x9fd8ff), emissiveIntensity: 0.9 }),
  };
}

/* ------------------------------------------------------------------ */
/* Layer 4: vehicles — 2000s sedans and SUVs                           */
/* ------------------------------------------------------------------ */

function addWheel(parent: THREE.Object3D, mats: MaterialSet, x: number, y: number, z: number, radius: number): THREE.Object3D {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.3, 10), mats.tire);
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.32, 8), mats.rim);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(x, y, z);
  parent.add(wheel);
  return wheel;
}

function buildSuv(mats: MaterialSet, paint: number): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  const body = std({ color: paint, metalness: 0.45, roughness: 0.38 });
  boxAt(g, body, 1.9, 0.62, 4.6, 0, 0.86, 0);
  boxAt(g, mats.cladding, 1.92, 0.16, 4.62, 0, 0.56, 0);
  // Greenhouse: dark glass box with a body-color roof slab.
  boxAt(g, mats.shopGlass, 1.74, 0.56, 2.9, 0, 1.42, -0.2);
  boxAt(g, body, 1.7, 0.09, 3.0, 0, 1.74, -0.2);
  // Roof rails.
  boxAt(g, mats.darkMetal, 0.06, 0.08, 2.7, -0.62, 1.82, -0.2);
  boxAt(g, mats.darkMetal, 0.06, 0.08, 2.7, 0.62, 1.82, -0.2);
  // Chrome grille + bumpers.
  boxAt(g, mats.chrome, 1.2, 0.24, 0.08, 0, 0.92, 2.32);
  boxAt(g, mats.cladding, 1.94, 0.22, 0.14, 0, 0.6, 2.3);
  boxAt(g, mats.cladding, 1.94, 0.22, 0.14, 0, 0.6, -2.3);
  // Mirrors.
  boxAt(g, body, 0.16, 0.1, 0.24, -1.0, 1.34, 1.2);
  boxAt(g, body, 0.16, 0.1, 0.24, 1.0, 1.34, 1.2);
  // Lights + plate.
  boxAt(g, mats.headlight, 0.34, 0.14, 0.06, -0.62, 1.02, 2.33);
  boxAt(g, mats.headlight, 0.34, 0.14, 0.06, 0.62, 1.02, 2.33);
  boxAt(g, mats.taillight, 0.3, 0.16, 0.06, -0.66, 1.06, -2.33);
  boxAt(g, mats.taillight, 0.3, 0.16, 0.06, 0.66, 1.06, -2.33);
  boxAt(g, mats.paintWhite, 0.5, 0.14, 0.03, 0, 0.72, -2.36);
  const wheels = [
    addWheel(g, mats, -0.86, 0.4, 1.55, 0.4),
    addWheel(g, mats, 0.86, 0.4, 1.55, 0.4),
    addWheel(g, mats, -0.86, 0.4, -1.55, 0.4),
    addWheel(g, mats, 0.86, 0.4, -1.55, 0.4),
  ];
  return { group: g, wheels };
}

function buildSedan(mats: MaterialSet, paint: number): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  const body = std({ color: paint, metalness: 0.5, roughness: 0.35 });
  boxAt(g, body, 1.8, 0.52, 4.4, 0, 0.76, 0);
  boxAt(g, mats.shopGlass, 1.66, 0.48, 2.2, 0, 1.24, -0.12);
  boxAt(g, body, 1.6, 0.07, 2.3, 0, 1.5, -0.12);
  boxAt(g, mats.chrome, 0.06, 0.05, 4.2, -0.91, 0.86, 0);
  boxAt(g, mats.chrome, 0.06, 0.05, 4.2, 0.91, 0.86, 0);
  boxAt(g, mats.chrome, 1.1, 0.2, 0.08, 0, 0.84, 2.22);
  boxAt(g, body, 1.82, 0.18, 0.12, 0, 0.58, 2.2);
  boxAt(g, body, 1.82, 0.18, 0.12, 0, 0.58, -2.2);
  boxAt(g, body, 0.14, 0.09, 0.22, -0.96, 1.2, 1.05);
  boxAt(g, body, 0.14, 0.09, 0.22, 0.96, 1.2, 1.05);
  boxAt(g, mats.headlight, 0.36, 0.12, 0.06, -0.58, 0.92, 2.23);
  boxAt(g, mats.headlight, 0.36, 0.12, 0.06, 0.58, 0.92, 2.23);
  boxAt(g, mats.taillight, 0.34, 0.13, 0.06, -0.6, 0.94, -2.23);
  boxAt(g, mats.taillight, 0.34, 0.13, 0.06, 0.6, 0.94, -2.23);
  boxAt(g, mats.paintWhite, 0.48, 0.13, 0.03, 0, 0.68, -2.26);
  const wheels = [
    addWheel(g, mats, -0.8, 0.36, 1.45, 0.36),
    addWheel(g, mats, 0.8, 0.36, 1.45, 0.36),
    addWheel(g, mats, -0.8, 0.36, -1.45, 0.36),
    addWheel(g, mats, 0.8, 0.36, -1.45, 0.36),
  ];
  return { group: g, wheels };
}

function buildVehicles(state: Era2005State, mats: MaterialSet, root: THREE.Group, rng: () => number): void {
  const paints = [0xc8ccd0, 0x15181c, 0x243a5e, 0x8e2020, 0xb8a06a, 0xe8eaec, 0x2f4636, 0x6b7078];
  for (let i = 0; i < 8; i++) {
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const isSuv = i % 3 !== 1; // SUV-boom mix: 2 of every 3 vehicles are SUVs.
    const kind = isSuv ? buildSuv(mats, paints[i]) : buildSedan(mats, paints[i]);
    kind.group.position.set(dirZ === 1 ? 1.7 : -1.7, 0, ((i + 0.5) / 8 * 2 - 1) * CAR_WRAP_Z);
    kind.group.rotation.y = dirZ === 1 ? 0 : Math.PI;
    root.add(kind.group);
    state.cars.push({
      group: kind.group,
      dirZ,
      speed: 7 + rng() * 4,
      wheels: kind.wheels,
      wheelRadius: isSuv ? 0.4 : 0.36,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Layer 5: pedestrians — 2000s casual fashion                         */
/* ------------------------------------------------------------------ */

interface WalkerSpec {
  x: number;
  z: number;
  faceYaw: number;
  dirZ: Dir;
  phone: boolean;
  idle: boolean;
}

function buildWalker(state: Era2005State, mats: MaterialSet, spec: WalkerSpec, rng: () => number): void {
  const jeans = [0x39557c, 0x2c3e58, 0x4a6076][Math.floor(rng() * 3)];
  const pants = rng() < 0.7 ? jeans : [0x8a7d5a, 0x3a3f45, 0x27412f][Math.floor(rng() * 3)];
  const hoodie = rng() < 0.35;
  const top = hoodie
    ? [0x4a5568, 0x773344, 0x365a52][Math.floor(rng() * 3)]
    : [0xd8dade, 0xa33226, 0x2e4a72, 0x5b6570, 0xc7cbb8][Math.floor(rng() * 5)];
  const skin = [0xf1c9a5, 0xd9a06b, 0xb97e52, 0x8d5a3b, 0xefd7b8][Math.floor(rng() * 5)];
  const capColor = [0x22252a, 0x742f2f, 0x2e4a72, 0x3d5a3d][Math.floor(rng() * 4)];
  const hasCap = rng() < 0.4;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legMat = std({ color: pants, roughness: 0.9 });
  const topMat = std({ color: top, roughness: 0.9 });
  const skinMat = std({ color: skin, roughness: 0.75 });

  const makeLimb = (x: number, y: number, r: number, len: number, mat: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), mat);
    mesh.position.y = -len / 2;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };

  const legL = makeLimb(-0.13, HIP_Y, 0.09, 0.86, legMat);
  const legR = makeLimb(0.13, HIP_Y, 0.09, 0.86, legMat);
  boxAt(legL, mats.cladding, 0.16, 0.1, 0.34, 0, -0.84, 0.06);
  boxAt(legR, mats.cladding, 0.16, 0.1, 0.34, 0, -0.84, 0.06);

  boxAt(body, topMat, 0.46, 0.62, 0.26, 0, HIP_Y + 0.31, 0);
  const armL = makeLimb(-0.29, HIP_Y + 0.56, 0.065, 0.64, topMat);
  const armR = makeLimb(0.29, HIP_Y + 0.56, 0.065, 0.64, topMat);

  const head = sphereAt(body, skinMat, 0.155, 0, HIP_Y + 0.78, 0);
  if (hasCap) {
    const cap = sphereAt(body, std({ color: capColor }), 0.165, 0, HIP_Y + 0.84, 0);
    cap.scale.set(1, 0.55, 1);
    boxAt(body, std({ color: capColor }), 0.22, 0.03, 0.16, 0, HIP_Y + 0.84, 0.18);
  }
  if (hoodie) {
    const hood = sphereAt(body, topMat, 0.13, 0, HIP_Y + 0.72, -0.12);
    hood.scale.set(1, 0.8, 0.7);
  }
  if (rng() < 0.4) {
    boxAt(body, std({ color: [0x33363b, 0x5a4632, 0x27412f][Math.floor(rng() * 3)] }), 0.32, 0.42, 0.14, 0, HIP_Y + 0.36, -0.21);
  }

  if (spec.phone) {
    // Texting pose: glowing phone held up in front of the face.
    boxAt(armR, mats.phoneGlow, 0.09, 0.16, 0.02, 0, -0.62, 0.14);
  }

  root.position.set(spec.x, SIDEWALK_TOP, spec.z);
  root.rotation.y = spec.faceYaw;
  state.walkersRoot.add(root);
  state.walkers.push({
    group: root,
    parts: { body, legL, legR, armL, armR, head },
    dirZ: spec.dirZ,
    speed: spec.idle ? 0 : 1.1 + rng() * 0.7,
    phase: rng() * Math.PI * 2,
    seed: rng() * Math.PI * 2,
    curY: SIDEWALK_TOP,
    phone: spec.phone,
    idle: spec.idle,
  });
}

function buildPedestrians(state: Era2005State, mats: MaterialSet, rng: () => number): void {
  const specs: WalkerSpec[] = [
    { x: WALKER_X, z: -14, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: WALKER_X, z: 6, faceYaw: Math.PI, dirZ: -1, phone: true, idle: false },
    { x: -WALKER_X, z: -20, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: -WALKER_X, z: 2, faceYaw: Math.PI, dirZ: -1, phone: false, idle: false },
    { x: WALKER_X, z: 19, faceYaw: 0, dirZ: 1, phone: true, idle: false },
    { x: -WALKER_X, z: 16, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: WALKER_X, z: -30, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: -WALKER_X, z: -6, faceYaw: Math.PI, dirZ: -1, phone: true, idle: false },
    { x: 7.3, z: 10.6, faceYaw: -Math.PI / 2, dirZ: 1, phone: true, idle: true },
    { x: -7.3, z: -10.4, faceYaw: Math.PI / 2, dirZ: 1, phone: false, idle: true },
    { x: 8.6, z: -17.2, faceYaw: -Math.PI / 2, dirZ: 1, phone: false, idle: true },
  ];
  for (const spec of specs) buildWalker(state, mats, spec, rng);
}

/* ------------------------------------------------------------------ */
/* Layers 1–3: buildings, storefronts, advertising                     */
/* ------------------------------------------------------------------ */

interface TowerSpec {
  /** -1 = west side of the avenue, +1 = east side. */
  side: -1 | 1;
  z: number;
  towerW: number;
  towerD: number;
  podiumH: number;
  towerH: number;
  seed: number;
}

function buildTower(
  mats: MaterialSet,
  parent: THREE.Group,
  spec: TowerSpec,
  rng: () => number,
): void {
  const glass = makeCurtainWallMaterial(6, 8, spec.seed);
  const podiumDepth = 6;

  if (spec.podiumH > 0) {
    // Retail podium whose street face sits flush with the sidewalk edge.
    const px = spec.side * (FACE_X + podiumDepth / 2);
    boxAt(parent, mats.precast, podiumDepth, spec.podiumH, spec.towerD + 14, px, spec.podiumH / 2, spec.z);
    // Cornice strip along the street face.
    boxAt(parent, mats.precastDark, 0.3, 0.35, spec.towerD + 14, spec.side * FACE_X, spec.podiumH + 0.17, spec.z);
  } else {
    // Background towers get a thin grounding pad instead.
    boxAt(parent, mats.plaza, spec.towerW + 4, 0.08, spec.towerD + 4, spec.side * (FACE_X + podiumDepth + spec.towerW / 2), 0.04, spec.z);
  }

  // Curtain-wall tower mass rising behind the podium.
  const towerX = spec.side * (FACE_X + podiumDepth + spec.towerW / 2 - 1);
  boxAt(parent, glass, spec.towerW, spec.towerH, spec.towerD, towerX, spec.podiumH + spec.towerH / 2, spec.z);
  // Corner mullion strips emphasize the curtain-wall grid.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      boxAt(
        parent,
        mats.darkMetal,
        0.22,
        spec.towerH,
        0.22,
        towerX + (sx * spec.towerW) / 2,
        spec.podiumH + spec.towerH / 2,
        spec.z + (sz * spec.towerD) / 2,
      );
    }
  }
  // Roof cap, parapet and rooftop HVAC + antenna.
  const roofY = spec.podiumH + spec.towerH;
  boxAt(parent, mats.precastDark, spec.towerW + 0.6, 0.4, spec.towerD + 0.6, towerX, roofY + 0.2, spec.z);
  const units = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < units; i++) {
    boxAt(parent, mats.aluminum, 2.4, 1.1, 1.8, towerX + (rng() - 0.5) * (spec.towerW - 4), roofY + 0.95, spec.z + (rng() - 0.5) * (spec.towerD - 4));
  }
  cylAt(parent, mats.darkMetal, 0.06, 0.09, 4.2, 6, towerX + spec.towerW / 4, roofY + 2.5, spec.z - spec.towerD / 4);
}

function buildBackgroundSkyline(parent: THREE.Group): void {
  const blocks: Array<[number, number, number, number, number]> = [
    [-47, -28, 11, 12, 26],
    [-44, 27, 10, 11, 17],
    [47, -6, 12, 11, 30],
    [49, 27, 10, 12, 20],
    [-43, 46, 12, 10, 14],
    [45, -42, 11, 12, 22],
  ];
  blocks.forEach(([x, z, w, d, h], i) => {
    const mesh = boxAt(parent, makeWindowGridMaterial(7000 + i * 13), w, h, d, x, h / 2, z);
    mesh.name = 'background-block';
  });
}

interface StorefrontSpec {
  side: -1 | 1;
  z: number;
  width: number;
  kind: 'coffee' | 'phones' | 'deli';
}

function buildStorefront(state: Era2005State, mats: MaterialSet, parent: THREE.Group, spec: StorefrontSpec): void {
  const toStreet = -spec.side; // unit step toward the road
  const inward = spec.side; // unit step into the block interior
  const faceX = spec.side * FACE_X;

  // Glazing wall, recessed door pair and glowing interior.
  boxAt(parent, mats.shopGlass, 0.1, 2.9, spec.width, faceX + inward * 0.03, 1.55, spec.z);
  boxAt(parent, mats.interiorWarm, 0.06, 2.7, spec.width - 0.6, faceX + inward * 0.9, 1.45, spec.z);
  const doorMat = std({ color: 0x6b7d84, metalness: 0.5, roughness: 0.2, transparent: true, opacity: 0.55 });
  boxAt(parent, doorMat, 0.12, 2.2, 1.1, faceX + inward * 0.35, 1.1, spec.z - spec.width * 0.22);
  boxAt(parent, doorMat, 0.12, 2.2, 1.1, faceX + inward * 0.35, 1.1, spec.z + spec.width * 0.22);

  // LED sign band (registered for subtle flicker).
  let sign: THREE.MeshStandardMaterial;
  if (spec.kind === 'coffee') {
    sign = makeLedSignMaterial('COFFEE CO.', 0x0f4d3a, 0xf3f7ee);
  } else if (spec.kind === 'phones') {
    sign = makeLedSignMaterial('MOBILE CITY', 0x1140a0, 0xeaf4ff);
  } else {
    sign = makeLedSignMaterial('SANDWICH STUDIO', 0x8e2020, 0xfff3d6);
  }
  boxAt(parent, sign, 0.16, 0.85, spec.width, faceX + toStreet * 0.12, 3.55, spec.z);
  state.flickers.push({ material: sign, base: 1.15, rate: 2.2 + spec.z * 0.05, seed: spec.z });

  if (spec.kind === 'coffee') {
    // Green awning + round logo disc + menu board.
    const awning = boxAt(parent, std({ color: 0x1d6b4f, roughness: 0.7 }), 1.5, 0.08, spec.width, faceX + toStreet * 0.75, 2.95, spec.z);
    awning.rotation.z = -toStreet * 0.32;
    boxAt(parent, mats.paintWhite, 1.5, 0.05, 0.18, faceX + toStreet * 1.42, 2.72, spec.z);
    const logoMat = makeLogoMaterial(0x0f4d3a, 0xf3f7ee, 0xf2b134);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 24), logoMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(faceX + toStreet * 0.5, 4.7, spec.z);
    parent.add(disc);
    state.flickers.push({ material: logoMat, base: 0.85, rate: 1.6, seed: 1.3 });
    boxAt(parent, mats.darkMetal, 0.9, 0.3, 0.9, faceX + toStreet * 0.9, 0.55, spec.z + spec.width * 0.34);
  } else if (spec.kind === 'phones') {
    // Cool backlit interior with display pedestals.
    boxAt(parent, mats.interiorCool, 0.06, 2.7, spec.width - 0.6, faceX + inward * 0.55, 1.45, spec.z);
    for (const dz of [-1.4, 0, 1.4]) {
      boxAt(parent, mats.aluminum, 0.7, 0.95, 0.5, faceX + inward * 1.5, 0.48, spec.z + dz);
      boxAt(parent, mats.phoneGlow, 0.3, 0.04, 0.16, faceX + inward * 1.5, 0.98, spec.z + dz);
    }
  } else {
    // Deli: menu strip and warm pendant glow.
    boxAt(parent, mats.darkMetal, 0.14, 0.7, spec.width * 0.6, faceX + toStreet * 0.3, 2.2, spec.z);
    boxAt(parent, mats.interiorWarm, 0.06, 1.6, spec.width * 0.5, faceX + inward * 0.7, 1.0, spec.z);
  }
}

interface AdFrameSpec {
  headline: string;
  sub: string;
  bg: number;
  fg: number;
}

/**
 * Digital billboard: bezel + frame-cycling LED screen + scrolling ticker,
 * assembled in a subgroup the caller can position/rotate as a unit.
 */
function buildBillboardScreen(
  state: Era2005State,
  mats: MaterialSet,
  specs: ReadonlyArray<AdFrameSpec>,
  width: number,
  height: number,
  period: number,
  phase: number,
  fallbackColor: number,
): THREE.Group {
  const g = new THREE.Group();

  const frames: THREE.Texture[] = [];
  for (const spec of specs) {
    const tex = makeAdFrameTexture(spec.headline, spec.sub, spec.bg, spec.fg);
    if (tex) frames.push(tex);
  }
  const material = new THREE.MeshBasicMaterial({ color: frames.length > 0 ? 0xffffff : fallbackColor });
  if (frames.length > 0) material.map = frames[0];
  const screen = boxAt(g, material, width, height, 0.12, 0, 0, 0);
  screen.name = 'led-screen';
  // Bezel frame around the screen.
  boxAt(g, mats.darkMetal, width + 0.5, 0.25, 0.3, 0, height / 2 + 0.12, 0);
  boxAt(g, mats.darkMetal, width + 0.5, 0.25, 0.3, 0, -height / 2 - 0.12, 0);
  boxAt(g, mats.darkMetal, 0.25, height + 0.5, 0.3, -width / 2 - 0.12, 0, 0);
  boxAt(g, mats.darkMetal, 0.25, height + 0.5, 0.3, width / 2 + 0.12, 0, 0);

  // Scrolling news ticker under the screen.
  const { material: tickerMat, texture } = makeTickerMaterial(
    'BREAKING: BLOCK GOES WIRELESS • TRAFFIC ON THE ONES • RINGTONE CHART TOPPED • ',
    0x0a1e33,
    0x7fe3ff,
  );
  boxAt(g, tickerMat, width, 0.55, 0.1, 0, -height / 2 - 0.42, 0);
  state.tickers.push({ texture, speed: 0.06 });

  state.screens.push({ material, frames, period, phase, current: 0 });
  return g;
}

function buildBillboards(state: Era2005State, mats: MaterialSet, parent: THREE.Group): void {
  // Rooftop billboard on the west background tower (tower top at y = 17).
  const roofBase = new THREE.Group();
  roofBase.position.set(-34, 17, 10);
  roofBase.rotation.y = Math.PI / 2; // screen faces the avenue (+x)
  parent.add(roofBase);
  cylAt(roofBase, mats.darkMetal, 0.14, 0.18, 1.0, 8, -3, 0.5, 0);
  cylAt(roofBase, mats.darkMetal, 0.14, 0.18, 1.0, 8, 3, 0.5, 0);
  const roofBoard = buildBillboardScreen(
    state,
    mats,
    [
      { headline: 'MEGA MART', sub: 'Back to school blowout', bg: 0x1450a0, fg: 0xffe14d },
      { headline: 'RINGZ!', sub: 'Text RING to 4404', bg: 0x8e1d8e, fg: 0x7fe3ff },
      { headline: 'GET BROADBAND', sub: '100x faster dial-up', bg: 0x0f6b4f, fg: 0xffffff },
    ],
    9,
    4.4,
    4.2,
    0,
    0x1450a0,
  );
  roofBoard.position.y = 3.2;
  roofBase.add(roofBoard);

  // Ground-pylon digital billboard near the intersection, east side.
  const pylon = new THREE.Group();
  pylon.position.set(11.4, 0, -30);
  pylon.rotation.y = -Math.PI / 2; // screen faces the avenue (-x)
  parent.add(pylon);
  cylAt(pylon, mats.darkMetal, 0.22, 0.3, 7.0, 10, -2.4, 3.5, 0);
  cylAt(pylon, mats.darkMetal, 0.22, 0.3, 7.0, 10, 2.4, 3.5, 0);
  const pylonBoard = buildBillboardScreen(
    state,
    mats,
    [
      { headline: 'FIESTA COLA', sub: 'Ice cold, always', bg: 0xc22f2f, fg: 0xffffff },
      { headline: 'MEGAPLEX 16', sub: 'Now showing nightly', bg: 0x1a1f4d, fg: 0xf2b134 },
      { headline: 'LOANMART', sub: 'Cash in 15 minutes', bg: 0xd9a531, fg: 0x22262c },
    ],
    8,
    4.2,
    5.1,
    0.4,
    0xc22f2f,
  );
  pylonBoard.position.y = 9.4;
  pylon.add(pylonBoard);
}

function buildBusShelters(mats: MaterialSet, parent: THREE.Group): void {
  const ads: AdFrameSpec[] = [
    { headline: 'ISLAND GETAWAY', sub: 'Flights from $299', bg: 0x0e7d8a, fg: 0xffffff },
    { headline: 'SMOOTH GUM', sub: 'Whiten while you chew', bg: 0x2e9e4f, fg: 0xffffff },
  ];
  const spots: Array<[number, number, number]> = [
    [8.6, -18, -Math.PI / 2],
    [-8.6, 14, Math.PI / 2],
  ];
  spots.forEach(([x, z, yaw], i) => {
    const g = new THREE.Group();
    g.position.set(x, SIDEWALK_TOP, z);
    g.rotation.y = yaw;
    parent.add(g);
    // Roof, rear glass wall, posts, bench.
    boxAt(g, mats.darkMetal, 4.6, 0.1, 1.6, 0, 2.5, 0);
    boxAt(g, mats.shopGlass, 4.2, 2.2, 0.06, 0, 1.25, -0.72);
    for (const px of [-2.1, 2.1]) cylAt(g, mats.darkMetal, 0.05, 0.05, 2.5, 6, px, 1.25, 0.6);
    boxAt(g, mats.seatSlat, 3.2, 0.08, 0.45, 0, 0.55, -0.4);
    // Backlit ad panel facing the street (proud of its frame).
    const ad = ads[i % ads.length];
    const tex = makeAdFrameTexture(ad.headline, ad.sub, ad.bg, ad.fg);
    const mat: THREE.Material = tex ? new THREE.MeshBasicMaterial({ map: tex }) : basic(ad.bg);
    boxAt(g, mats.darkMetal, 1.6, 2.1, 0.14, 1.55, 1.25, -0.3);
    boxAt(g, mat, 1.5, 2.0, 0.08, 1.55, 1.25, -0.2);
  });
}

/* ------------------------------------------------------------------ */
/* Layer 6: street furniture                                           */
/* ------------------------------------------------------------------ */

function buildLedStreetLamp(mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.06, 0.1, 7.2, 8, 0, 3.6, 0);
  boxAt(g, mats.darkMetal, 0.12, 0.12, 1.7, 0, 7.15, 0.75);
  const panel = boxAt(g, mats.ledPanel, 0.62, 0.08, 0.34, 0, 7.02, 1.35);
  panel.rotation.x = 0.35;
  cylAt(g, mats.darkMetal, 0.16, 0.2, 0.3, 8, 0, 0.15, 0);
}

function buildCameraHead(mats: MaterialSet, pivot: THREE.Group): void {
  cylAt(pivot, mats.darkMetal, 0.05, 0.05, 0.5, 6, 0, 0.25, 0);
  boxAt(pivot, mats.aluminum, 0.26, 0.2, 0.52, 0, 0, 0.14);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), mats.darkMetal);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.44);
  pivot.add(lens);
  boxAt(pivot, mats.darkMetal, 0.32, 0.04, 0.36, 0, 0.14, 0.16);
}

function buildTrafficSignal(
  state: Era2005State,
  mats: MaterialSet,
  parent: THREE.Group,
  x: number,
  z: number,
  armYaw: number,
  offset: number,
  withCamera: boolean,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = armYaw;
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.09, 0.12, 5.6, 8, 0, 2.8, 0);
  boxAt(g, mats.darkMetal, 0.12, 0.12, 4.6, 0, 5.5, 2.1);

  // Signal head hanging from the mast arm.
  boxAt(g, mats.backplate, 0.66, 1.5, 0.06, 0, 4.85, 4.1);
  boxAt(g, mats.signalBox, 0.5, 1.34, 0.24, 0, 4.85, 4.22);
  const red = std({ color: 0x5a1010, emissive: new THREE.Color(0xff2a22), emissiveIntensity: 0.18 });
  const yellow = std({ color: 0x5a4a10, emissive: new THREE.Color(0xffc22a), emissiveIntensity: 0.18 });
  const green = std({ color: 0x105a20, emissive: new THREE.Color(0x2aff5a), emissiveIntensity: 0.18 });
  const lens = (mat: THREE.Material, y: number): void => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, y, 4.36);
    g.add(m);
  };
  lens(red, 5.28);
  lens(yellow, 4.85);
  lens(green, 4.42);
  state.signals.push({ red, yellow, green, offset });

  // Pedestrian signal box on the pole.
  boxAt(g, mats.signalBox, 0.26, 0.4, 0.18, 0, 3.1, 0.16);

  if (withCamera) {
    // Panning traffic camera clamped to the mast arm.
    const pivot = new THREE.Group();
    pivot.position.set(0, 5.9, 1.4);
    g.add(pivot);
    buildCameraHead(mats, pivot);
    state.cameras.push({ pivot, rate: 0.32 + Math.abs(x) * 0.01, seed: z * 0.1 });
  }
}

function buildMidblockCamera(state: Era2005State, mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.07, 0.1, 6.2, 8, 0, 3.1, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0, 6.3, 0);
  g.add(pivot);
  buildCameraHead(mats, pivot);
  state.cameras.push({ pivot, rate: 0.24, seed: 2.1 });
}

function buildBikeRack(mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 12, Math.PI), mats.aluminum);
  g.add(hoop);
  boxAt(g, mats.darkMetal, 0.2, 0.04, 0.2, -0.42, 0.02, 0);
  boxAt(g, mats.darkMetal, 0.2, 0.04, 0.2, 0.42, 0.02, 0);
}

function buildNewspaperBoxes(mats: MaterialSet, parent: THREE.Group, x: number, zStart: number): void {
  const colors = [0xc22f2f, 0x1450a0, 0xd9a531, 0x2e9e4f, 0x773344];
  colors.forEach((color, i) => {
    const g = new THREE.Group();
    g.position.set(x, SIDEWALK_TOP, zStart - i * 0.78);
    parent.add(g);
    boxAt(g, std({ color, roughness: 0.6, metalness: 0.15 }), 0.55, 0.9, 0.5, 0, 0.45, 0);
    const display = boxAt(g, std({ color: 0x22262c, roughness: 0.4 }), 0.45, 0.34, 0.06, -0.06, 1.0, 0.18);
    display.rotation.x = -0.5;
    boxAt(g, mats.paintWhite, 0.4, 0.12, 0.02, 0, 0.62, 0.26);
  });
}

function buildBench(mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = yaw;
  parent.add(g);
  boxAt(g, mats.seatSlat, 2.0, 0.08, 0.5, 0, 0.5, 0);
  boxAt(g, mats.seatSlat, 2.0, 0.5, 0.08, 0, 0.75, -0.24);
  for (const px of [-0.85, 0.85]) boxAt(g, mats.darkMetal, 0.08, 0.5, 0.45, px, 0.25, 0);
}

function buildLitterBin(mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.28, 0.24, 0.85, 10, 0, 0.43, 0);
  cylAt(g, mats.aluminum, 0.3, 0.3, 0.06, 10, 0, 0.88, 0);
}

function buildHydrant(mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  cylAt(g, mats.hydrant, 0.13, 0.16, 0.5, 10, 0, 0.25, 0);
  sphereAt(g, mats.hydrant, 0.13, 0, 0.52, 0);
  const valve = cylAt(g, mats.hydrant, 0.06, 0.06, 0.34, 8, 0, 0.34, 0);
  valve.rotation.z = Math.PI / 2;
}

function buildMailDrop(mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  boxAt(g, mats.mailbox, 0.55, 1.0, 0.5, 0, 0.5, 0);
  const top = boxAt(g, mats.mailbox, 0.55, 0.18, 0.5, 0, 1.06, 0);
  top.rotation.z = 0.18;
  boxAt(g, mats.darkMetal, 0.34, 0.05, 0.03, 0, 0.86, 0.26);
}

function buildStreetTree(mats: MaterialSet, parent: THREE.Group, x: number, z: number, rng: () => number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  boxAt(g, mats.plaza, 1.0, 0.4, 1.0, 0, 0.2, 0);
  cylAt(g, mats.trunk, 0.09, 0.13, 2.2, 7, 0, 1.5, 0);
  const blobY = 3.0 + rng() * 0.4;
  sphereAt(g, mats.foliage, 0.9 + rng() * 0.25, 0, blobY, 0);
  sphereAt(g, mats.foliage, 0.6 + rng() * 0.2, 0.5, blobY - 0.4, 0.3);
  sphereAt(g, mats.foliage, 0.55 + rng() * 0.2, -0.45, blobY - 0.3, -0.25);
}

function buildStreetFurniture(
  state: Era2005State,
  mats: MaterialSet,
  parent: THREE.Group,
  rng: () => number,
): void {
  // White-LED street lamps (the 2000s transition away from sodium vapor).
  buildLedStreetLamp(mats, parent, 9.0, -26, Math.PI);
  buildLedStreetLamp(mats, parent, 9.0, 22, Math.PI);
  buildLedStreetLamp(mats, parent, -9.0, -22, 0);
  buildLedStreetLamp(mats, parent, -9.0, 26, 0);

  // Mast-arm signals; two corners carry panning traffic cameras.
  buildTrafficSignal(state, mats, parent, 6.9, -6.9, -Math.PI / 2, 0, true);
  buildTrafficSignal(state, mats, parent, -6.9, 6.9, Math.PI / 2, 0.5, true);
  buildTrafficSignal(state, mats, parent, 6.9, 6.9, -Math.PI / 2, 0.5, false);
  buildTrafficSignal(state, mats, parent, -6.9, -6.9, Math.PI / 2, 0, false);
  buildMidblockCamera(state, mats, parent, 7.1, 30);

  // Bike racks: cluster by the coffee shop plus office-side pair.
  buildBikeRack(mats, parent, 7.3, 6.4);
  buildBikeRack(mats, parent, 7.3, 7.7);
  buildBikeRack(mats, parent, 7.3, 9.0);
  buildBikeRack(mats, parent, -7.3, -13.4);
  buildBikeRack(mats, parent, -7.3, -14.7);

  // Busier sidewalk: newspaper boxes by the crosswalk, benches, bins.
  buildNewspaperBoxes(mats, parent, 7.25, -2.2);
  buildBench(mats, parent, 8.6, -18, -Math.PI / 2);
  buildBench(mats, parent, -8.6, 14, Math.PI / 2);
  buildBench(mats, parent, 7.4, 12.4, Math.PI / 2);
  buildLitterBin(mats, parent, 7.3, 20.2);
  buildLitterBin(mats, parent, -7.3, -22.4);
  buildHydrant(mats, parent, 7.25, -9.2);
  buildMailDrop(mats, parent, -7.3, 18.4);

  // Street trees in planters.
  buildStreetTree(mats, parent, -8.9, -12, rng);
  buildStreetTree(mats, parent, -8.9, 8, rng);
  buildStreetTree(mats, parent, 8.9, 26, rng);
  buildStreetTree(mats, parent, 8.9, -34, rng);
}

/* ------------------------------------------------------------------ */
/* Streetscape base: road, sidewalks, markings                         */
/* ------------------------------------------------------------------ */

function buildStreetscape(mats: MaterialSet, parent: THREE.Group): void {
  boxAt(parent, mats.asphalt, ROAD_HALF_W * 2, 0.06, AVENUE_LENGTH, 0, 0.03, 0);
  // Sidewalks and curbs are split so pedestrians can dip through the
  // intersection at grade.
  const segLen = HALF_LEN - CROSSWALK_HALF;
  const segCenter = CROSSWALK_HALF + segLen / 2;
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.curb, 0.25, CURB_H, segLen, side * (ROAD_HALF_W + 0.125), CURB_H / 2, segCenter);
    boxAt(parent, mats.curb, 0.25, CURB_H, segLen, side * (ROAD_HALF_W + 0.125), CURB_H / 2, -segCenter);
    boxAt(parent, mats.sidewalk, WALK_OUTER - WALK_INNER, SIDEWALK_TOP, segLen, side * (WALK_INNER + (WALK_OUTER - WALK_INNER) / 2), SIDEWALK_TOP / 2, segCenter);
    boxAt(parent, mats.sidewalk, WALK_OUTER - WALK_INNER, SIDEWALK_TOP, segLen, side * (WALK_INNER + (WALK_OUTER - WALK_INNER) / 2), SIDEWALK_TOP / 2, -segCenter);
  }
  // Center double yellow, broken through the intersection.
  const yellowLen = HALF_LEN - 4 - CROSSWALK_HALF;
  const yellowCenter = CROSSWALK_HALF + yellowLen / 2;
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.paintYellow, 0.12, 0.02, yellowLen, -0.16, 0.07, side * yellowCenter);
    boxAt(parent, mats.paintYellow, 0.12, 0.02, yellowLen, 0.16, 0.07, side * yellowCenter);
  }
  // Dashed lane-edge lines between travel and parking lanes.
  for (const side of [-1, 1] as const) {
    for (let z = -45; z <= 45; z += 5) {
      if (Math.abs(z) < CROSSWALK_HALF + 1.2) continue;
      boxAt(parent, mats.paintWhite, 0.12, 0.02, 2, side * 3.3, 0.07, z);
    }
  }
  // Continental crosswalk + stop lines at the intersection.
  for (let i = 0; i < 8; i++) {
    boxAt(parent, mats.paintWhite, 0.7, 0.02, 5.2, -5.6 + i * 1.6, 0.075, 0);
  }
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.paintWhite, 6.0, 0.02, 0.4, side * 3.2, 0.075, side * (CROSSWALK_HALF + 0.4));
  }
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

/** Module-level handle so `update(dt)` works without passing the group. */
let activeState: Era2005State | null = null;

function resolveState(group?: THREE.Group): Era2005State | null {
  if (group) {
    const own = group.userData.era2005 as Era2005State | undefined;
    if (own) return own;
  }
  return activeState;
}

export function buildEra2005(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'era-2005';
  const rng = createRng(20052005);
  const mats = createMaterials();

  const pedestriansRoot = new THREE.Group();
  pedestriansRoot.name = 'pedestrians';

  const state: Era2005State = {
    elapsed: 0,
    cars: [],
    walkers: [],
    signals: [],
    screens: [],
    tickers: [],
    flickers: [],
    cameras: [],
    walkersRoot: pedestriansRoot,
  };

  const streetscape = new THREE.Group();
  streetscape.name = 'streetscape-base';
  buildStreetscape(mats, streetscape);
  root.add(streetscape);

  const buildings = new THREE.Group();
  buildings.name = 'buildings';
  const towers: TowerSpec[] = [
    { side: -1, z: -6, towerW: 13, towerD: 13, podiumH: 6.8, towerH: 16.2, seed: 101 },
    { side: -1, z: 10, towerW: 12, towerD: 12, podiumH: 0, towerH: 17, seed: 202 },
    { side: 1, z: 8, towerW: 13, towerD: 13, podiumH: 6.8, towerH: 19.2, seed: 303 },
    { side: 1, z: -12, towerW: 12, towerD: 12, podiumH: 0, towerH: 20, seed: 404 },
  ];
  for (const spec of towers) buildTower(mats, buildings, spec, rng);
  buildBackgroundSkyline(buildings);
  root.add(buildings);

  const storefronts = new THREE.Group();
  storefronts.name = 'storefronts';
  const units: StorefrontSpec[] = [
    { side: -1, z: -12, width: 8.4, kind: 'coffee' },
    { side: -1, z: -3, width: 8.4, kind: 'deli' },
    { side: -1, z: 6, width: 8.4, kind: 'deli' },
    { side: 1, z: -10, width: 8.4, kind: 'phones' },
    { side: 1, z: -1, width: 8.4, kind: 'phones' },
    { side: 1, z: 8, width: 8.4, kind: 'deli' },
  ];
  for (const unit of units) buildStorefront(state, mats, storefronts, unit);
  root.add(storefronts);

  const advertising = new THREE.Group();
  advertising.name = 'advertising';
  buildBillboards(state, mats, advertising);
  buildBusShelters(mats, advertising);
  root.add(advertising);

  const vehicles = new THREE.Group();
  vehicles.name = 'vehicles';
  buildVehicles(state, mats, vehicles, rng);
  root.add(vehicles);

  buildPedestrians(state, mats, rng);
  root.add(pedestriansRoot);

  const furniture = new THREE.Group();
  furniture.name = 'street-furniture';
  buildStreetFurniture(state, mats, furniture, rng);
  root.add(furniture);

  root.userData.era2005 = state;
  activeState = state;
  return root;
}

/* ------------------------------------------------------------------ */
/* Per-frame update                                                    */
/* ------------------------------------------------------------------ */

export function update(dt: number, group?: THREE.Group): void {
  const state = resolveState(group);
  if (!state) return;
  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
  if (step <= 0) return;
  state.elapsed += step;
  const t = state.elapsed;

  // SUV/sedan convoys cruise both lanes; wheels roll with travel speed.
  for (const car of state.cars) {
    car.group.position.z += car.dirZ * car.speed * step;
    if (car.group.position.z > CAR_WRAP_Z) {
      car.group.position.z -= CAR_WRAP_Z * 2;
    } else if (car.group.position.z < -CAR_WRAP_Z) {
      car.group.position.z += CAR_WRAP_Z * 2;
    }
    const spin = (car.dirZ * car.speed * step) / car.wheelRadius;
    for (const wheel of car.wheels) {
      wheel.rotation.x += spin;
    }
  }

  // Pedestrians walk the sidewalks and dip to street level at the crossing.
  for (const w of state.walkers) {
    if (w.idle) {
      // Phone-check idlers: head down, gentle sway.
      w.parts.body.rotation.y = Math.sin(t * 0.8 + w.seed) * 0.1;
      w.parts.head.rotation.x = w.phone
        ? 0.42 + Math.sin(t * 1.3 + w.seed) * 0.04
        : Math.sin(t * 0.5 + w.seed) * 0.2;
      w.parts.head.rotation.y = w.phone
        ? Math.sin(t * 0.9 + w.seed) * 0.06
        : Math.sin(t * 0.55 + w.seed * 1.7) * 0.4;
      w.parts.body.position.y = Math.abs(Math.sin(t * 0.45 + w.seed)) * 0.02;
      if (w.phone) w.parts.armR.rotation.x = -1.9 + Math.sin(t * 1.1 + w.seed) * 0.06;
      continue;
    }
    w.phase += w.speed * step * 4.4;
    w.group.position.z += w.dirZ * w.speed * step;
    if (w.group.position.z > WALKER_WRAP_Z) {
      w.group.position.z -= WALKER_WRAP_Z * 2;
    } else if (w.group.position.z < -WALKER_WRAP_Z) {
      w.group.position.z += WALKER_WRAP_Z * 2;
    }
    const targetY = Math.abs(w.group.position.z) < CROSSWALK_HALF ? 0.02 : SIDEWALK_TOP;
    w.curY += (targetY - w.curY) * Math.min(step * 6, 1);
    w.group.position.y = w.curY;

    const swing = Math.sin(w.phase) * 0.55;
    w.parts.legL.rotation.x = swing;
    w.parts.legR.rotation.x = -swing;
    w.parts.armL.rotation.x = -swing * 0.6;
    w.parts.armR.rotation.x = w.phone ? -1.9 + Math.sin(w.phase) * 0.08 : swing * 0.6;
    w.parts.body.position.y = Math.abs(Math.cos(w.phase)) * 0.05;
    w.parts.body.rotation.x = 0.04;
    w.parts.head.rotation.x = w.phone ? 0.35 : Math.sin(w.phase * 0.21) * 0.08;
  }

  // Signal cycle (north-south vs east-west phases).
  for (const signal of state.signals) {
    const phase = (t / SIGNAL_PERIOD + signal.offset) % 1;
    let ri = 0.18;
    let yi = 0.18;
    let gi = 0.18;
    if (phase < 0.42) gi = 2.4;
    else if (phase < 0.5) yi = 2.4;
    else ri = 2.4;
    signal.red.emissiveIntensity = ri;
    signal.yellow.emissiveIntensity = yi;
    signal.green.emissiveIntensity = gi;
  }

  // Digital billboards cycle their ad frames.
  for (const screen of state.screens) {
    if (screen.frames.length === 0) continue;
    const idx = Math.floor(t / screen.period + screen.phase) % screen.frames.length;
    if (idx !== screen.current) {
      screen.current = idx;
      screen.material.map = screen.frames[idx];
      screen.material.needsUpdate = true;
    }
  }

  // LED tickers scroll continuously.
  for (const ticker of state.tickers) {
    if (!ticker.texture) continue;
    ticker.texture.offset.x = (((ticker.texture.offset.x - ticker.speed * step) % 1) + 1) % 1;
  }

  // LED sign bands flicker subtly.
  for (const flicker of state.flickers) {
    flicker.material.emissiveIntensity = flicker.base * (0.93 + 0.07 * Math.sin(t * flicker.rate + flicker.seed));
  }

  // Traffic cameras pan across the avenue.
  for (const cam of state.cameras) {
    cam.pivot.rotation.y = Math.sin(t * cam.rate + cam.seed) * 0.65;
  }
}
