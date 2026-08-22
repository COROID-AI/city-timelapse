import * as THREE from 'three';

/**
 * Era module: 1965 — "Mid-Century Boom".
 *
 * A procedurally-built city block profile for the 1965 timeline stop:
 *  - Layer 1 (buildings/storefronts): mid-century modern storefront rows with
 *    large recessed glass window walls, pastel stucco facades, angled awnings
 *    and upper-story sash windows, plus a low-rise background skyline.
 *  - Layer 2 (signage): buzzing neon blade signs, a cantilever-roof diner
 *    with a flickering neon roofline, a pylon sign, and googie accents
 *    (boomerang fins, rotating starburst clock).
 *  - Layer 3 (vehicles): 1960s sedans and station wagons with chrome
 *    bumpers, whitewall wheels and woody side trim cruising wider asphalt
 *    avenues in both directions.
 *  - Layer 4 (pedestrians): period suits with fedoras and swing dresses,
 *    animated walk cycles plus idle window-shopper poses.
 *  - Layer 5 (advertisements): rooftop billboards with mid-century
 *    advertising art drawn onto procedural CanvasTextures, framed by chasing
 *    marquee bulbs.
 *  - Layer 6 (street furniture): mast-arm traffic signals (gas lamps are
 *    gone by 1965), cobra-head street lamps, parking meters, benches, a
 *    hydrant, litter bin, mailbox, phone booth, crosswalks and lane markings.
 *
 * Everything is generated from three.js primitives and canvas-drawn textures;
 * there are no model or texture downloads. Animation state lives in
 * `group.userData.era1965` so `update(dt, group)` stays instance-safe.
 *
 * Polygon budget: boxes plus low-segment cylinders/spheres keep the block
 * well under the ~50k triangle target (~20k triangles when assembled).
 */

type Dir = 1 | -1;

const CURB_HEIGHT = 0.14;
const SIDEWALK_TOP = 0.15;
const AVENUE_LENGTH = 96;
const CAR_LANE_X = 3.1;
const CAR_WRAP_Z = 46;
const WHEEL_RADIUS = 0.34;
const WALKER_WRAP = 21;
const SIGNAL_PERIOD = 9;
const STORY_HEIGHT = 3.4;
const HIP_HEIGHT = 0.84;
const LOT_FRONT_X = 7.2;
const LOT_DEPTH = 10;
const LOT_WIDTH = 14;

interface CarRuntime {
  group: THREE.Group;
  dirZ: Dir;
  speed: number;
  spinners: THREE.Group[];
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
  dir: THREE.Vector3;
  speed: number;
  phase: number;
  seed: number;
  curY: number;
}

interface SignalRuntime {
  red: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  offset: number;
}

interface NeonRuntime {
  material: THREE.MeshStandardMaterial;
  base: number;
  rate: number;
  seed: number;
  unstable: boolean;
}

interface BulbRowRuntime {
  materials: THREE.MeshStandardMaterial[];
}

interface Era1965State {
  elapsed: number;
  cars: CarRuntime[];
  walkers: WalkerRuntime[];
  idlers: WalkerRuntime[];
  signals: SignalRuntime[];
  neons: NeonRuntime[];
  bulbRows: BulbRowRuntime[];
  starbursts: THREE.Object3D[];
}

interface MaterialSet {
  asphalt: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  lineYellow: THREE.MeshStandardMaterial;
  lineWhite: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  stainless: THREE.MeshStandardMaterial;
  porcelainCream: THREE.MeshStandardMaterial;
  storefrontGlass: THREE.MeshStandardMaterial;
  dayGlass: THREE.MeshStandardMaterial;
  doorGlass: THREE.MeshStandardMaterial;
  glowInterior: THREE.MeshBasicMaterial;
  tire: THREE.MeshStandardMaterial;
  whitewall: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
  woodTrim: THREE.MeshStandardMaterial;
  benchWood: THREE.MeshStandardMaterial;
  hydrantRed: THREE.MeshStandardMaterial;
  galvanized: THREE.MeshStandardMaterial;
  backplateYellow: THREE.MeshStandardMaterial;
  mailboxBlue: THREE.MeshStandardMaterial;
  signRed: THREE.MeshStandardMaterial;
}

interface SignArt {
  lines: string[];
  sub?: string;
  bg: number;
  fg: number;
  accent?: number;
  square?: boolean;
}

interface LotSpec {
  z: number;
  side: Dir;
  stories: number;
  paint: number;
  trim: number;
  awning: number;
  signText: string;
  signBg: number;
  signFg: number;
  googieFin: boolean;
}

interface WalkerSpec {
  x: number;
  z: number;
  faceYaw: number;
  moving: boolean;
  dirZ: Dir;
  kind: 'suit' | 'dress';
  cloth: number;
  skin: number;
  accent: number;
}

interface WheelGeos {
  tire: THREE.CylinderGeometry;
  wall: THREE.CylinderGeometry;
  hub: THREE.CylinderGeometry;
}

/** Small deterministic PRNG so layout is stable between rebuilds. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function std(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(params);
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  rTop: number,
  rBottom: number,
  height: number,
  segments: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addSphere(
  parent: THREE.Object3D,
  radius: number,
  widthSeg: number,
  heightSeg: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSeg, heightSeg), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

let wheelCache: WheelGeos | undefined;

/** Lazily-created shared wheel geometries reused by every vehicle. */
function getWheelGeos(): WheelGeos {
  if (!wheelCache) {
    const tire = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 10);
    tire.rotateZ(Math.PI / 2);
    const wall = new THREE.CylinderGeometry(0.205, 0.205, 0.27, 10);
    wall.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.285, 8);
    hub.rotateZ(Math.PI / 2);
    wheelCache = { tire, wall, hub };
  }
  return wheelCache;
}

/**
 * Draws mid-century advertising art onto a CanvasTexture. Falls back to a flat
 * colored material when DOM canvas is unavailable (node-side smoke tests).
 */
function makeSignMaterial(art: SignArt): THREE.MeshStandardMaterial {
  const fallback = (): THREE.MeshStandardMaterial => std({ color: art.bg, roughness: 0.55 });
  if (typeof document === 'undefined') return fallback();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = art.square === true ? 512 : 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback();
    const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = css(art.bg);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (art.accent !== undefined) {
      ctx.fillStyle = css(art.accent);
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15);
      ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(art.fg);
    const slot = (canvas.height * 0.62) / Math.max(art.lines.length, 1);
    art.lines.forEach((line, index) => {
      const px = Math.min(slot * 0.92, (canvas.width * 0.92) / Math.max(line.length * 0.6, 1));
      ctx.font = `bold ${Math.max(px, 20)}px 'Futura', 'Century Gothic', 'Trebuchet MS', sans-serif`;
      ctx.fillText(line, canvas.width / 2, canvas.height * 0.46 + (index - (art.lines.length - 1) / 2) * slot);
    });
    if (art.sub !== undefined) {
      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillStyle = css(art.accent ?? art.fg);
      ctx.fillText(art.sub, canvas.width / 2, canvas.height * 0.8);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 });
  } catch {
    return fallback();
  }
}

function createMaterials(): MaterialSet {
  return {
    asphalt: std({ color: 0x2e2e33, roughness: 0.97 }),
    concrete: std({ color: 0xb9b2a4, roughness: 0.92 }),
    lineYellow: std({ color: 0xd9a531, roughness: 0.7 }),
    lineWhite: std({ color: 0xe6e2d6, roughness: 0.7 }),
    chrome: std({ color: 0xd8dde0, metalness: 0.85, roughness: 0.22 }),
    darkMetal: std({ color: 0x3a3f44, metalness: 0.6, roughness: 0.45 }),
    stainless: std({ color: 0xdfe4e6, metalness: 0.72, roughness: 0.3 }),
    porcelainCream: std({ color: 0xf2e8d4, roughness: 0.4 }),
    storefrontGlass: std({
      color: 0x2a4a54,
      metalness: 0.5,
      roughness: 0.12,
      transparent: true,
      opacity: 0.62,
    }),
    dayGlass: std({ color: 0x9fb8bd, metalness: 0.4, roughness: 0.18 }),
    doorGlass: std({ color: 0x1c3038, metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.8 }),
    glowInterior: new THREE.MeshBasicMaterial({ color: 0xffe3b0 }),
    tire: std({ color: 0x17181a, roughness: 0.9 }),
    whitewall: std({ color: 0xece7db, roughness: 0.5 }),
    headlight: std({ color: 0xfff2cf, emissive: 0xffe9b0, emissiveIntensity: 0.9 }),
    taillight: std({ color: 0x8c2020, emissive: 0xff2a1a, emissiveIntensity: 0.7 }),
    woodTrim: std({ color: 0x6e4a26, roughness: 0.65 }),
    benchWood: std({ color: 0x7c5a34, roughness: 0.7 }),
    hydrantRed: std({ color: 0xbf3a2b, roughness: 0.5 }),
    galvanized: std({ color: 0x9aa0a3, metalness: 0.55, roughness: 0.5 }),
    backplateYellow: std({ color: 0xc7a23c, roughness: 0.6 }),
    mailboxBlue: std({ color: 0x2b4f8c, roughness: 0.55 }),
    signRed: std({ color: 0xc0392b, roughness: 0.5 }),
  };
}

/* ------------------------------------------------------------------ */
/* Layer 1: streets, sidewalks, lane markings                          */
/* ------------------------------------------------------------------ */

function buildStreets(parent: THREE.Object3D, mats: MaterialSet): void {
  // Wide asphalt avenue running along Z.
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, AVENUE_LENGTH), mats.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  parent.add(road);

  // Cross-street segments stop at the avenue edge so tops never z-fight.
  for (const side of [1, -1] as const) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(42, 12), mats.asphalt);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(side * 27, 0.02, 0);
    parent.add(seg);
  }

  // Continuous raised sidewalks flanking the avenue (split at the crossing so
  // pedestrians visibly step down onto asphalt while crossing).
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      addBox(parent, 3.2, CURB_HEIGHT, 42, mats.concrete, sx * 7.6, CURB_HEIGHT / 2, sz * 27);
    }
  }
  // Cross-street sidewalk stubs.
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      addBox(parent, 38.8, CURB_HEIGHT, 3.2, mats.concrete, sx * 28.6, CURB_HEIGHT / 2, sz * 7.6);
    }
  }

  // Corner block slabs sit one centimetre above the strips (no z-fighting).
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      addBox(parent, 18, SIDEWALK_TOP, 18, mats.concrete, sx * 15, SIDEWALK_TOP / 2, sz * 15);
      addBox(parent, 18, SIDEWALK_TOP, 24, mats.concrete, sx * 15, SIDEWALK_TOP / 2, sz * 36);
    }
  }

  // Double-yellow centerline on the avenue (split around the intersection).
  for (const zs of [
    [7, 46],
    [-46, -7],
  ]) {
    const len = zs[1] - zs[0];
    const midZ = (zs[0] + zs[1]) / 2;
    for (const sx of [1, -1] as const) {
      addBox(parent, 0.12, 0.012, len, mats.lineYellow, sx * 0.16, 0.031, midZ);
    }
  }

  // Dashed white centerline on each cross street.
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 5; i++) {
      const x = side * (10 + i * 3.4);
      addBox(parent, 2.2, 0.012, 0.12, mats.lineWhite, x, 0.031, 0);
    }
  }

  // Continental crosswalks on all four approaches.
  for (const sz of [1, -1] as const) {
    for (let i = 0; i < 6; i++) {
      addBox(parent, 0.55, 0.012, 2.3, mats.lineWhite, -4.4 + i * 1.76, 0.032, sz * 7.8);
    }
  }
  for (const sx of [1, -1] as const) {
    for (let i = 0; i < 6; i++) {
      addBox(parent, 2.3, 0.012, 0.55, mats.lineWhite, sx * 7.8, 0.032, -4.4 + i * 1.76);
    }
  }

  // Stop lines for each approaching lane.
  addBox(parent, 5.2, 0.012, 0.35, mats.lineWhite, -CAR_LANE_X, 0.031, 9.4);
  addBox(parent, 5.2, 0.012, 0.35, mats.lineWhite, CAR_LANE_X, 0.031, -9.4);

  // Manhole covers.
  for (const [mx, mz] of [
    [2.1, 22],
    [-2.1, -28],
  ]) {
    const cover = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), mats.darkMetal);
    cover.rotation.x = -Math.PI / 2;
    cover.position.set(mx, 0.033, mz);
    parent.add(cover);
  }
}

/* ------------------------------------------------------------------ */
/* Layer 2: neon signage helpers                                       */
/* ------------------------------------------------------------------ */

function buildBladeSign(
  state: Era1965State,
  mats: MaterialSet,
  art: SignArt,
  neonColor: number,
  unstable: boolean,
): THREE.Group {
  const sign = new THREE.Group();
  addBox(sign, 0.07, 0.07, 0.8, mats.darkMetal, 0, 0, 0.4);
  addBox(sign, 0.14, 2.2, 1.0, mats.darkMetal, 0, 0, 1.15);

  const panel = makeSignMaterial(art);
  for (const side of [1, -1] as const) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 2.02), panel);
    face.rotation.y = (side * Math.PI) / 2;
    face.position.set(side * 0.078, 0, 1.15);
    sign.add(face);
  }

  const neonMat = std({ color: neonColor, emissive: neonColor, emissiveIntensity: 1.2 });
  addBox(sign, 0.05, 0.05, 0.98, neonMat, 0.1, 1.06, 1.15);
  addBox(sign, 0.05, 0.05, 0.98, neonMat, 0.1, -1.06, 1.15);
  addBox(sign, 0.05, 2.06, 0.05, neonMat, 0.1, 0, 0.69);
  addBox(sign, 0.05, 2.06, 0.05, neonMat, 0.1, 0, 1.61);
  state.neons.push({
    material: neonMat,
    base: 1.25,
    rate: unstable ? 6.4 : 3.2,
    seed: unstable ? 4.1 : 1.3,
    unstable,
  });

  return sign;
}

/* ------------------------------------------------------------------ */
/* Layer 1: storefront buildings                                       */
/* ------------------------------------------------------------------ */

function buildStorefront(state: Era1965State, mats: MaterialSet, root: THREE.Object3D, spec: LotSpec): void {
  const g = new THREE.Group();
  g.position.set(spec.side * (LOT_FRONT_X + LOT_DEPTH / 2), 0, spec.z);
  g.rotation.y = spec.side === 1 ? -Math.PI / 2 : Math.PI / 2;

  const height = spec.stories * STORY_HEIGHT + 0.5;
  const paintMat = std({ color: spec.paint, roughness: 0.6 });
  const trimMat = std({ color: spec.trim, roughness: 0.5 });
  const awningMat = std({ color: spec.awning, roughness: 0.65 });

  addBox(g, LOT_WIDTH, height, LOT_DEPTH, paintMat, 0, height / 2, -LOT_DEPTH / 2);
  addBox(g, LOT_WIDTH, 0.18, LOT_DEPTH, trimMat, 0, height + 0.09, -LOT_DEPTH / 2);
  addBox(g, LOT_WIDTH, 0.35, 0.45, trimMat, 0, height + 0.15, -0.2);

  // Recessed ground-floor glass wall with warm interior glow behind it.
  addBox(g, LOT_WIDTH - 1.4, 2.55, 0.14, mats.storefrontGlass, 0, 1.42, 0.03);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(LOT_WIDTH - 1.7, 2.2), mats.glowInterior);
  glow.position.set(0, 1.42, -0.55);
  g.add(glow);

  const mullionCount = Math.max(2, Math.round((LOT_WIDTH - 1.6) / 1.6));
  for (let i = 0; i < mullionCount; i++) {
    const x = -(LOT_WIDTH - 1.7) / 2 + (i * (LOT_WIDTH - 1.7)) / (mullionCount - 1);
    addBox(g, 0.09, 2.65, 0.18, mats.chrome, x, 1.44, 0.05);
  }
  addBox(g, LOT_WIDTH - 1.4, 0.34, 0.16, mats.darkMetal, 0, 0.17, 0.04);
  addBox(g, LOT_WIDTH - 1.4, 0.22, 0.16, mats.chrome, 0, 2.85, 0.04);

  // Entry door with chrome push bar.
  const doorX = LOT_WIDTH / 2 - 1.1;
  addBox(g, 0.95, 2.35, 0.12, mats.doorGlass, doorX, 1.175, 0.06);
  addBox(g, 0.8, 0.06, 0.06, mats.chrome, doorX, 1.05, 0.14);

  // Angled awning on a pivot at the facade.
  const awningPivot = new THREE.Group();
  awningPivot.position.set(-0.4, 3.02, 0);
  awningPivot.rotation.x = -0.45;
  addBox(awningPivot, LOT_WIDTH - 2.2, 0.07, 1.35, awningMat, 0, 0, 0.6);
  addBox(awningPivot, LOT_WIDTH - 2.2, 0.07, 0.14, mats.lineWhite, 0, 0.005, 1.24);
  g.add(awningPivot);

  // Upper-story windows and sills.
  const windowCount = Math.max(2, Math.round((LOT_WIDTH - 2) / 1.7));
  for (let story = 1; story < spec.stories; story++) {
    const floorY = story * STORY_HEIGHT;
    for (let i = 0; i < windowCount; i++) {
      const x =
        -(LOT_WIDTH - 2.2) / 2 + (i * (LOT_WIDTH - 2.2)) / Math.max(windowCount - 1, 1);
      addBox(g, 0.95, 1.35, 0.1, mats.dayGlass, x, floorY + 1.7, 0.06);
      addBox(g, 1.15, 0.09, 0.16, trimMat, x, floorY + 0.95, 0.08);
    }
  }

  // Googie boomerang fin rising above the parapet.
  if (spec.googieFin) {
    const finMat = std({ color: spec.signBg, roughness: 0.5 });
    const finL = addBox(g, 0.12, 1.7, 0.35, finMat, -0.5, height + 0.8, -0.25);
    finL.rotation.z = 0.55;
    const finR = addBox(g, 0.12, 1.7, 0.35, finMat, 0.5, height + 0.8, -0.25);
    finR.rotation.z = -0.55;
  }

  // Rooftop props of the era: AC unit + whip antenna.
  addBox(g, 1.2, 0.7, 1.0, mats.galvanized, -LOT_WIDTH / 4, height + 0.53, -LOT_DEPTH / 2);
  addCylinder(g, 0.02, 0.03, 2.0, 5, mats.darkMetal, LOT_WIDTH / 4, height + 1.0, -LOT_DEPTH * 0.7);

  const blade = buildBladeSign(
    state,
    mats,
    { lines: [spec.signText], bg: spec.signBg, fg: spec.signFg },
    spec.signFg,
    false,
  );
  blade.position.set(-LOT_WIDTH / 2 + 0.9, 4.0, 0.5);
  g.add(blade);

  root.add(g);
}

/* ------------------------------------------------------------------ */
/* Layer 1+2: the cantilever-roof diner with neon roofline             */
/* ------------------------------------------------------------------ */

function buildDiner(state: Era1965State, mats: MaterialSet, root: THREE.Object3D, z: number): void {
  const g = new THREE.Group();
  g.position.set(LOT_FRONT_X + LOT_DEPTH / 2, 0, z);
  g.rotation.y = -Math.PI / 2;

  const roofNeon = std({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 1.4 });
  state.neons.push({ material: roofNeon, base: 1.4, rate: 5.2, seed: 2.6, unstable: true });

  // Porcelain body with glass band on three sides.
  addBox(g, 8.8, 0.22, 6.6, mats.stainless, 0, 0.11, -1.2);
  addBox(g, 8.2, 2.3, 0.12, mats.storefrontGlass, 0, 1.45, 0.02);
  addBox(g, 0.12, 2.3, 3.0, mats.storefrontGlass, 4.08, 1.45, -1.5);
  addBox(g, 0.12, 2.3, 3.0, mats.storefrontGlass, -4.08, 1.45, -1.5);
  addBox(g, 8.4, 2.6, 0.14, mats.porcelainCream, 0, 1.5, -3.0);
  for (const cx of [4.05, -4.05]) {
    addCylinder(g, 0.14, 0.14, 2.6, 6, mats.porcelainCream, cx, 1.3, 0);
    addCylinder(g, 0.14, 0.14, 2.6, 6, mats.porcelainCream, cx, 1.3, -3);
  }
  addBox(g, 8.5, 0.32, 3.3, mats.stainless, 0, 2.76, -1.5);
  addBox(g, 8.6, 0.22, 3.5, mats.porcelainCream, 0, 3.03, -1.55);
  addBox(g, 8.6, 0.5, 1.0, mats.porcelainCream, 0, 3.39, -2.9);

  // Warm interior glow behind the glass band.
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.0), mats.glowInterior);
  glow.position.set(0, 1.45, -1.2);
  g.add(glow);

  // Double glass doors with chrome pulls.
  for (const dx of [0.52, -0.52]) {
    addBox(g, 0.85, 2.25, 0.1, mats.doorGlass, dx, 1.28, 0.04);
    addBox(g, 0.7, 0.06, 0.06, mats.chrome, dx, 1.2, 0.13);
  }

  // Cantilevered front canopy with a neon edge tube.
  const canopy = new THREE.Group();
  canopy.position.set(0, 2.95, 0);
  canopy.rotation.x = -0.42;
  addBox(canopy, 8.6, 0.12, 2.2, mats.porcelainCream, 0, 0, 0.95);
  addBox(canopy, 8.6, 0.06, 0.06, roofNeon, 0, 0.03, 2.0);
  g.add(canopy);

  // Vertical neon tubes framing the facade corners.
  addBox(g, 0.06, 2.4, 0.06, roofNeon, 4.16, 1.35, 0.08);
  addBox(g, 0.06, 2.4, 0.06, roofNeon, -4.16, 1.35, 0.08);

  // Rooftop pylon sign: pole + double-faced cabinet + mini starburst.
  addCylinder(g, 0.09, 0.11, 6.4, 8, mats.darkMetal, 5.6, 3.2, -0.4);
  const pylonArt = makeSignMaterial({
    lines: ['SKY', 'LINE'],
    sub: 'DINER',
    bg: 0x0f7d7d,
    fg: 0xfff3d0,
    accent: 0xff8c42,
    square: true,
  });
  const cabinet = new THREE.Group();
  cabinet.position.set(5.6, 7.0, -0.4);
  addBox(cabinet, 1.7, 3.0, 0.5, mats.darkMetal, 0, 0, 0);
  for (const side of [1, -1] as const) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), pylonArt);
    face.rotation.y = (side * Math.PI) / 2;
    face.position.z = side * 0.26;
    cabinet.add(face);
  }
  const borderMat = std({ color: 0xff8ccf, emissive: 0xff8ccf, emissiveIntensity: 1.2 });
  addBox(cabinet, 1.78, 0.07, 0.56, borderMat, 0, 1.53, 0);
  addBox(cabinet, 1.78, 0.07, 0.56, borderMat, 0, -1.53, 0);
  state.neons.push({ material: borderMat, base: 1.2, rate: 3.8, seed: 5.5, unstable: false });

  const star = new THREE.Group();
  star.position.set(0, 2.1, 0);
  addSphere(star, 0.12, 6, 4, mats.chrome, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const holder = new THREE.Group();
    holder.rotation.y = (i / 6) * Math.PI * 2;
    const spike = addBox(holder, 0.05, i % 2 === 0 ? 1.0 : 0.66, 0.05, mats.hydrantRed, 0, 0, i % 2 === 0 ? 0.5 : 0.33);
    spike.rotation.x = Math.PI / 2;
    star.add(holder);
  }
  cabinet.add(star);
  state.starbursts.push(star);

  root.add(g);
}

/* ------------------------------------------------------------------ */
/* Layer 1: background skyline                                         */
/* ------------------------------------------------------------------ */

function buildSkyline(root: THREE.Object3D, mats: MaterialSet): void {
  const palette = [0xcdd5cd, 0xd6d0c2, 0xc2cbd4, 0xd9cfc0, 0xbfc7cf];
  const blocks: Array<[number, number, number, number, number]> = [
    [-30, 22, 6, 14, 6],
    [-36, 2, 7, 17, 7],
    [30, 18, 6, 12, 7],
    [38, -6, 6, 15, 6],
    [-30, -22, 6, 10, 6],
    [32, -30, 7, 13, 6],
    [-42, -4, 6, 9, 7],
    [26, 40, 6, 11, 6],
    [-26, 42, 6, 9, 6],
    [9, 55, 6, 12, 5],
    [-9, -55, 6, 11, 5],
  ];
  blocks.forEach(([x, z, w, h, d], index) => {
    const mat = std({ color: palette[index % palette.length], roughness: 0.85 });
    addBox(root, w, h, d, mat, x, h / 2, z);
    if (index % 3 === 0) {
      addBox(root, 1.4, 0.8, 1.2, mats.galvanized, x - w / 4, h + 0.4, z - d / 4);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Layer 5: rooftop billboards with chasing marquee bulbs              */
/* ------------------------------------------------------------------ */

function bulbRing(count: number, w: number, h: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const perimeter = 2 * (w + h);
  for (let i = 0; i < count; i++) {
    const d = (i / count) * perimeter;
    let x: number;
    let y: number;
    if (d < w) {
      x = -w / 2 + d;
      y = h / 2;
    } else if (d < w + h) {
      x = w / 2;
      y = h / 2 - (d - w);
    } else if (d < 2 * w + h) {
      x = w / 2 - (d - w - h);
      y = -h / 2;
    } else {
      x = -w / 2;
      y = -h / 2 + (d - 2 * w - h);
    }
    pts.push([x, y]);
  }
  return pts;
}

function buildBillboardTower(
  state: Era1965State,
  mats: MaterialSet,
  root: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  art: SignArt,
): void {
  addBox(root, 7, 11, 5, std({ color: 0xb4aca0, roughness: 0.85 }), x, 5.5, z);
  addBox(root, 1.6, 0.9, 1.4, mats.galvanized, x + 1.2, 11.45, z + 0.8);

  const frame = new THREE.Group();
  frame.position.set(x, 12.3, z);
  frame.rotation.y = rotY;

  addBox(frame, 8.4, 4.4, 0.22, mats.porcelainCream, 0, 0, 0);
  const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 4.0), makeSignMaterial(art));
  artPlane.position.set(0, 0, 0.13);
  frame.add(artPlane);
  addBox(frame, 0.24, 2.4, 0.24, mats.darkMetal, 3.3, -1.15, 0);
  addBox(frame, 0.24, 2.4, 0.24, mats.darkMetal, -3.3, -1.15, 0);

  const row: BulbRowRuntime = { materials: [] };
  for (const [bx, by] of bulbRing(12, 8.2, 4.2)) {
    const bulbMat = std({ color: 0xffd27a, emissive: 0xffc95e, emissiveIntensity: 0.5 });
    addSphere(frame, 0.11, 6, 4, bulbMat, bx, by, 0.18);
    row.materials.push(bulbMat);
  }
  state.bulbRows.push(row);

  root.add(frame);
}

/* ------------------------------------------------------------------ */
/* Layer 6: traffic signals, lamps, street furniture                   */
/* ------------------------------------------------------------------ */

function buildTrafficSignal(
  state: Era1965State,
  mats: MaterialSet,
  root: THREE.Object3D,
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  offset: number,
): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = Math.atan2(dirX, dirZ);

  addCylinder(g, 0.16, 0.2, 0.26, 8, mats.darkMetal, 0, 0.13, 0);
  addCylinder(g, 0.08, 0.09, 4.6, 8, mats.darkMetal, 0, 2.3, 0);
  const arm = addCylinder(g, 0.05, 0.06, 3.4, 6, mats.darkMetal, 0, 4.45, 1.7);
  arm.rotation.x = Math.PI / 2;

  const red = std({ color: 0x5a1010, emissive: 0xff2020, emissiveIntensity: 0.18 });
  const yellow = std({ color: 0x5a4a10, emissive: 0xffc020, emissiveIntensity: 0.18 });
  const green = std({ color: 0x105a20, emissive: 0x20ff50, emissiveIntensity: 0.18 });

  addBox(g, 0.62, 1.72, 0.08, mats.backplateYellow, 0, 3.9, 3.24);
  addBox(g, 0.44, 1.5, 0.3, mats.darkMetal, 0, 3.9, 3.36);
  const lensY = [0.48, 0, -0.48];
  const lensMats = [red, yellow, green];
  for (let i = 0; i < 3; i++) {
    const lens = addCylinder(g, 0.17, 0.17, 0.1, 10, lensMats[i], 0, 3.9 + lensY[i], 3.54);
    lens.rotation.x = Math.PI / 2;
  }

  state.signals.push({ red, yellow, green, offset });
  root.add(g);
}

function buildCobraLamp(mats: MaterialSet, root: THREE.Object3D, side: Dir, z: number): void {
  const g = new THREE.Group();
  g.position.set(side * 7.1, SIDEWALK_TOP, z);
  g.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;

  addCylinder(g, 0.09, 0.12, 0.3, 8, mats.darkMetal, 0, 0.15, 0);
  addCylinder(g, 0.06, 0.08, 5.2, 8, mats.darkMetal, 0, 2.6, 0);
  const arm = addCylinder(g, 0.045, 0.055, 1.5, 6, mats.darkMetal, 0, 5.0, 0.55);
  arm.rotation.x = Math.PI / 2 - 0.35;
  addBox(g, 0.55, 0.14, 0.26, mats.darkMetal, 0, 5.42, 1.25);
  addBox(g, 0.48, 0.04, 0.22, mats.headlight, 0, 5.33, 1.25);

  root.add(g);
}

function buildParkingMeter(mats: MaterialSet, root: THREE.Object3D, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  addCylinder(g, 0.035, 0.045, 1.05, 6, mats.galvanized, 0, 0.52, 0);
  addBox(g, 0.16, 0.24, 0.12, mats.darkMetal, 0, 1.14, 0);
  addBox(g, 0.14, 0.06, 0.1, mats.stainless, 0, 1.29, 0);
  root.add(g);
}

function buildBench(mats: MaterialSet, root: THREE.Object3D, x: number, z: number, rotY: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = rotY;
  addBox(g, 1.7, 0.06, 0.45, mats.benchWood, 0, 0.46, 0);
  const back = addBox(g, 1.7, 0.4, 0.06, mats.benchWood, 0, 0.78, -0.2);
  back.rotation.x = -0.15;
  addBox(g, 0.06, 0.46, 0.4, mats.darkMetal, 0.75, 0.23, 0);
  addBox(g, 0.06, 0.46, 0.4, mats.darkMetal, -0.75, 0.23, 0);
  root.add(g);
}

function buildHydrant(mats: MaterialSet, root: THREE.Object3D, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  addCylinder(g, 0.17, 0.19, 0.3, 8, mats.hydrantRed, 0, 0.15, 0);
  addCylinder(g, 0.13, 0.13, 0.45, 8, mats.hydrantRed, 0, 0.5, 0);
  addSphere(g, 0.13, 6, 4, mats.hydrantRed, 0, 0.76, 0);
  for (const sx of [1, -1]) {
    const cap = addCylinder(g, 0.05, 0.05, 0.12, 6, mats.hydrantRed, sx * 0.17, 0.55, 0);
    cap.rotation.z = Math.PI / 2;
  }
  root.add(g);
}

function buildLitterBin(mats: MaterialSet, root: THREE.Object3D, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  addCylinder(g, 0.3, 0.26, 0.75, 8, mats.galvanized, 0, 0.38, 0);
  addCylinder(g, 0.32, 0.32, 0.06, 8, mats.darkMetal, 0, 0.78, 0);
  root.add(g);
}

function buildMailbox(mats: MaterialSet, root: THREE.Object3D, x: number, z: number, rotY: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = rotY;
  addBox(g, 0.5, 0.5, 0.4, mats.mailboxBlue, 0, 0.4, 0);
  const top = addCylinder(g, 0.225, 0.225, 0.55, 8, mats.mailboxBlue, 0, 0.65, 0);
  top.rotation.z = Math.PI / 2;
  addBox(g, 0.3, 0.05, 0.03, mats.darkMetal, 0, 0.62, 0.21);
  root.add(g);
}

function buildPhoneBooth(mats: MaterialSet, root: THREE.Object3D, x: number, z: number, rotY: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = rotY;
  addBox(g, 1.0, 0.1, 1.0, mats.concrete, 0, 0.05, 0);
  for (const px of [0.42, -0.42]) {
    for (const pz of [0.42, -0.42]) {
      addBox(g, 0.07, 2.3, 0.07, mats.darkMetal, px, 1.25, pz);
    }
  }
  addBox(g, 0.86, 2.2, 0.04, mats.dayGlass, 0, 1.3, 0.42);
  addBox(g, 0.04, 2.2, 0.86, mats.dayGlass, 0.42, 1.3, 0);
  addBox(g, 0.04, 2.2, 0.86, mats.dayGlass, -0.42, 1.3, 0);
  const innerGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), mats.glowInterior);
  innerGlow.position.set(0, 1.3, -0.36);
  g.add(innerGlow);
  addBox(g, 1.05, 0.12, 1.05, mats.darkMetal, 0, 2.46, 0);
  addBox(g, 1.0, 0.3, 0.12, mats.signRed, 0, 2.68, 0);
  const phoneSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.26),
    makeSignMaterial({ lines: ['PHONE'], bg: 0xc0392b, fg: 0xffffff }),
  );
  phoneSign.position.set(0, 2.68, 0.07);
  g.add(phoneSign);
  root.add(g);
}

function buildStarburstClock(state: Era1965State, mats: MaterialSet, root: THREE.Object3D, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);

  addCylinder(g, 0.12, 0.3, 0.4, 8, mats.stainless, 0, 0.2, 0);
  addCylinder(g, 0.07, 0.09, 3.4, 8, mats.darkMetal, 0, 1.7, 0);

  // Rotating googie starburst crowning the pole.
  const star = new THREE.Group();
  star.position.y = 3.75;
  addSphere(star, 0.13, 6, 4, mats.chrome, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const length = i % 2 === 0 ? 1.1 : 0.75;
    const holder = new THREE.Group();
    holder.rotation.y = -angle;
    const spoke = addBox(holder, 0.06, length, 0.06, i % 2 === 0 ? mats.hydrantRed : mats.porcelainCream, 0, 0, length / 2);
    spoke.rotation.x = Math.PI / 2;
    star.add(holder);
  }
  state.starbursts.push(star);

  // Clock face below the star.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 16), mats.stainless);
  rim.position.set(0, 2.9, 0.06);
  g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), mats.lineWhite);
  face.position.set(0, 2.9, 0.05);
  g.add(face);
  const hourHand = addBox(g, 0.04, 0.24, 0.02, mats.darkMetal, 0, 2.98, 0.08);
  hourHand.rotation.z = 0.9;
  const minuteHand = addBox(g, 0.03, 0.34, 0.02, mats.darkMetal, 0, 3.0, 0.09);
  minuteHand.rotation.z = -0.5;

  g.add(star);
  root.add(g);
}

/* ------------------------------------------------------------------ */
/* Layer 3: 1960s sedans & station wagons                              */
/* ------------------------------------------------------------------ */

function buildVehicle(
  state: Era1965State,
  mats: MaterialSet,
  kind: 'sedan' | 'wagon',
  paint: number,
  dirZ: Dir,
  startZ: number,
  speed: number,
): void {
  const g = new THREE.Group();
  const spinners: THREE.Group[] = [];
  const paintMat = std({ color: paint, roughness: 0.35, metalness: 0.25 });

  // Main body shell.
  addBox(g, 1.86, 0.6, 4.7, paintMat, 0, 0.66, 0);
  addBox(g, 1.7, 0.28, 1.1, paintMat, 0, 0.95, 1.85);

  let cabinCenter = -0.15;
  if (kind === 'sedan') {
    addBox(g, 1.72, 0.55, 2.2, paintMat, 0, 1.23, cabinCenter);
    addBox(g, 1.74, 0.3, 0.9, paintMat, 0, 1.01, -2.0);
    for (const fx of [0.83, -0.83]) {
      addBox(g, 0.16, 0.22, 0.9, paintMat, fx, 1.16, -2.0);
    }
  } else {
    cabinCenter = -0.45;
    addBox(g, 1.74, 0.58, 3.5, paintMat, 0, 1.25, cabinCenter);
    // Woody side trim planks.
    for (const wx of [0.88, -0.88]) {
      addBox(g, 0.05, 0.34, 3.4, mats.woodTrim, wx, 0.98, -0.4);
    }
    // Roof luggage rack.
    for (const rx of [0.6, -0.6]) {
      addBox(g, 0.05, 0.06, 3.2, mats.chrome, rx, 1.58, cabinCenter);
    }
    for (const rz of [-1.6, -0.45, 0.7]) {
      addBox(g, 1.25, 0.05, 0.05, mats.chrome, 0, 1.61, rz);
    }
  }

  // Greenhouse glazing: raked windshield, rear glass, side windows.
  const windshield = addBox(g, 1.6, 0.5, 0.06, mats.dayGlass, 0, 1.28, cabinCenter + 1.1);
  windshield.rotation.x = -0.42;
  const rearGlass = addBox(g, 1.5, 0.52, 0.06, mats.dayGlass, 0, kind === 'sedan' ? 1.26 : 1.3, kind === 'sedan' ? cabinCenter - 1.13 : cabinCenter - 1.75);
  rearGlass.rotation.x = kind === 'sedan' ? 0.5 : 0.12;
  for (const sx of [0.87, -0.87]) {
    addBox(g, 0.05, 0.4, kind === 'sedan' ? 1.6 : 2.6, mats.dayGlass, sx, 1.32, cabinCenter - (kind === 'sedan' ? 0 : 0.4));
  }

  // Chrome bumpers, grille, lights, plate and beltline trim.
  addBox(g, 1.94, 0.2, 0.24, mats.chrome, 0, 0.52, 2.42);
  addBox(g, 1.94, 0.2, 0.24, mats.chrome, 0, 0.52, -2.42);
  addBox(g, 1.1, 0.3, 0.08, mats.chrome, 0, 0.82, 2.36);
  addSphere(g, 0.08, 6, 4, mats.headlight, 0.62, 0.86, 2.37);
  addSphere(g, 0.08, 6, 4, mats.headlight, -0.62, 0.86, 2.37);
  addBox(g, 0.3, 0.14, 0.06, mats.taillight, 0.68, 0.92, -2.38);
  addBox(g, 0.3, 0.14, 0.06, mats.taillight, -0.68, 0.92, -2.38);
  addBox(g, 0.5, 0.18, 0.03, mats.lineWhite, 0, 0.55, -2.47);
  for (const tx of [0.94, -0.94]) {
    addBox(g, 0.03, 0.06, 4.2, mats.chrome, tx, 0.72, 0);
  }

  // Whitewall wheels on spinning hub groups (shared geometry).
  const geos = getWheelGeos();
  for (const wx of [1, -1]) {
    for (const wz of [1, -1]) {
      const wheel = new THREE.Group();
      wheel.position.set(wx * 0.93, WHEEL_RADIUS, wz * 1.55);
      wheel.add(new THREE.Mesh(geos.tire, mats.tire));
      wheel.add(new THREE.Mesh(geos.wall, mats.whitewall));
      wheel.add(new THREE.Mesh(geos.hub, mats.chrome));
      g.add(wheel);
      spinners.push(wheel);
    }
  }

  g.position.set(dirZ === 1 ? CAR_LANE_X : -CAR_LANE_X, 0, startZ);
  if (dirZ === -1) {
    g.rotation.y = Math.PI;
  }

  state.cars.push({ group: g, dirZ, speed, spinners });
}

/* ------------------------------------------------------------------ */
/* Layer 4: pedestrians in suits & swing dresses                       */
/* ------------------------------------------------------------------ */

function buildWalker(state: Era1965State, mats: MaterialSet, spec: WalkerSpec, rng: () => number): void {
  const g = new THREE.Group();
  g.position.set(spec.x, SIDEWALK_TOP, spec.z);
  g.rotation.y = spec.faceYaw;

  const clothMat = std({ color: spec.cloth, roughness: 0.75 });
  const skinMat = std({ color: spec.skin, roughness: 0.6 });
  const accentMat = std({ color: spec.accent, roughness: 0.7 });

  const body = new THREE.Group();
  g.add(body);

  // Legs pivoting at the hips.
  const legL = new THREE.Group();
  legL.position.set(0.11, HIP_HEIGHT, 0);
  body.add(legL);
  const legR = new THREE.Group();
  legR.position.set(-0.11, HIP_HEIGHT, 0);
  body.add(legR);

  const shoulderY = spec.kind === 'suit' ? 1.56 : 1.72;
  const armL = new THREE.Group();
  armL.position.set(0.27, shoulderY, 0);
  body.add(armL);
  const armR = new THREE.Group();
  armR.position.set(-0.27, shoulderY, 0);
  body.add(armR);

  if (spec.kind === 'suit') {
    addBox(body, 0.44, 0.6, 0.26, clothMat, 0, 1.32, 0);
    addBox(body, 0.16, 0.3, 0.02, mats.lineWhite, 0, 1.45, 0.135);
    addBox(body, 0.05, 0.26, 0.015, mats.signRed, 0, 1.42, 0.145);
    for (const leg of [legL, legR]) {
      addBox(leg, 0.15, 0.8, 0.16, clothMat, 0, -0.4, 0);
      addBox(leg, 0.15, 0.09, 0.26, mats.darkMetal, 0, -0.82, 0.05);
    }
  } else {
    addCylinder(body, 0.24, 0.44, 0.95, 7, clothMat, 0, 0.975, 0);
    addBox(body, 0.4, 0.42, 0.24, clothMat, 0, 1.64, 0);
    for (const leg of [legL, legR]) {
      addBox(leg, 0.12, 0.5, 0.12, skinMat, 0, -0.25, 0);
      addBox(leg, 0.12, 0.08, 0.22, mats.darkMetal, 0, -0.52, 0.04);
    }
  }

  for (const arm of [armL, armR]) {
    addBox(arm, 0.1, spec.kind === 'suit' ? 0.58 : 0.5, 0.1, clothMat, 0, spec.kind === 'suit' ? -0.29 : -0.25, 0);
    addSphere(arm, 0.055, 6, 4, skinMat, 0, spec.kind === 'suit' ? -0.62 : -0.54, 0);
  }

  const head = addSphere(body, 0.155, 8, 6, skinMat, 0, 1.9, 0);
  if (spec.kind === 'suit') {
    addCylinder(body, 0.26, 0.26, 0.03, 10, accentMat, 0, 2.03, 0);
    addCylinder(body, 0.155, 0.165, 0.16, 10, accentMat, 0, 2.12, 0);
  } else {
    const hairCap = addSphere(body, 0.165, 8, 6, accentMat, 0, 1.99, -0.03);
    hairCap.scale.set(1, 0.62, 1);
    addSphere(body, 0.08, 6, 4, accentMat, 0, 2.0, -0.14);
  }

  const runtime: WalkerRuntime = {
    group: g,
    parts: { body, legL, legR, armL, armR, head },
    dir: new THREE.Vector3(0, 0, spec.dirZ),
    speed: 1.3 + rng() * 0.5,
    phase: rng() * Math.PI * 2,
    seed: rng() * 10,
    curY: SIDEWALK_TOP,
  };

  if (spec.moving) {
    state.walkers.push(runtime);
  } else {
    state.idlers.push(runtime);
  }
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function buildEra1965(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'era-1965';

  const rng = mulberry32(19650822);
  const mats = createMaterials();

  const state: Era1965State = {
    elapsed: 0,
    cars: [],
    walkers: [],
    idlers: [],
    signals: [],
    neons: [],
    bulbRows: [],
    starbursts: [],
  };

  buildStreets(root, mats);

  const lots: LotSpec[] = [
    { z: 17, side: 1, stories: 2, paint: 0xbfe3c6, trim: 0xf7f3e8, awning: 0xd94f3d, signText: 'TIP TOP', signBg: 0xd94f3d, signFg: 0xfff6e0, googieFin: true },
    { z: -15, side: 1, stories: 2, paint: 0xf2dda0, trim: 0x8a5a33, awning: 0x3f7d5a, signText: 'DRUG STORE', signBg: 0x2e5e46, signFg: 0xfff3d6, googieFin: false },
    { z: -37, side: 1, stories: 3, paint: 0xa9c8e0, trim: 0xe8eef2, awning: 0x2f5d8a, signText: 'BOWL-O-RAMA', signBg: 0x274b73, signFg: 0xffe9a8, googieFin: false },
    { z: 17, side: -1, stories: 3, paint: 0x9fd4cf, trim: 0xf4efe2, awning: 0xc96a8b, signText: 'FASHIONS', signBg: 0xc96a8b, signFg: 0xfff6ec, googieFin: true },
    { z: -15, side: -1, stories: 2, paint: 0xefc9d6, trim: 0x6b4632, awning: 0x7a4ea3, signText: 'BAKERY', signBg: 0x7a4ea3, signFg: 0xffefd2, googieFin: false },
    { z: -37, side: -1, stories: 2, paint: 0xd9d2b8, trim: 0x4f6451, awning: 0x4f6451, signText: 'HARDWARE', signBg: 0x39543c, signFg: 0xfff0c9, googieFin: false },
  ];
  for (const lot of lots) {
    buildStorefront(state, mats, root, lot);
  }

  buildDiner(state, mats, root, 39);
  buildSkyline(root, mats);

  buildBillboardTower(state, mats, root, 10.5, 47, Math.PI, {
    lines: ['ICE COLD', 'COLA'],
    sub: 'Still 5 cents',
    bg: 0xc22f3f,
    fg: 0xfff2cf,
    accent: 0xf2b134,
  });
  buildBillboardTower(state, mats, root, -10.5, -47, 0, {
    lines: ['FLY JET STREAM'],
    sub: 'Coast to coast in hours',
    bg: 0x1e5f9e,
    fg: 0xffffff,
    accent: 0xf2b134,
  });

  // Traffic lights have replaced the gas lamps of earlier eras.
  buildTrafficSignal(state, mats, root, 7.6, -7.6, -1, 1, 0);
  buildTrafficSignal(state, mats, root, -7.6, 7.6, 1, -1, 0);
  buildTrafficSignal(state, mats, root, 7.6, 7.6, -1, -1, 0.5);
  buildTrafficSignal(state, mats, root, -7.6, -7.6, 1, 1, 0.5);

  buildCobraLamp(mats, root, 1, -30);
  buildCobraLamp(mats, root, 1, 30);
  buildCobraLamp(mats, root, -1, -34);
  buildCobraLamp(mats, root, -1, 34);

  for (const side of [1, -1] as const) {
    for (const mz of [-24, -16, 26, 32]) {
      buildParkingMeter(mats, root, side * 6.65, mz);
    }
  }

  buildBench(mats, root, -9.2, 17, Math.PI / 2);
  buildBench(mats, root, 9.2, -31, -Math.PI / 2);
  buildHydrant(mats, root, 6.85, 9.6);
  buildLitterBin(mats, root, 6.9, 24.4);
  buildMailbox(mats, root, -8.3, 20.5, Math.PI / 2);
  buildPhoneBooth(mats, root, 8.6, 21.5, -Math.PI / 2);
  buildStarburstClock(state, mats, root, -8.8, 12.5);

  const paints = [0x3f8fa8, 0xc34a36, 0xe8dcc0, 0x33404b, 0x77a06b, 0x9db8d6, 0xb8763e, 0xf0e8da, 0x5b4632];
  for (let i = 0; i < 9; i++) {
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const startZ = ((i + 0.5) / 9 * 2 - 1) * CAR_WRAP_Z;
    const speed = 6.5 + rng() * 3.5;
    const kind = i % 3 === 2 ? 'wagon' : 'sedan';
    buildVehicle(state, mats, kind, paints[i % paints.length], dirZ, startZ, speed);
  }

  const walkerSpecs: WalkerSpec[] = [
    { x: 7.7, z: -12, faceYaw: 0, moving: true, dirZ: 1, kind: 'suit', cloth: 0x2e3a4c, skin: 0xe8b48c, accent: 0x222c3a },
    { x: 7.7, z: 9, faceYaw: Math.PI, moving: true, dirZ: -1, kind: 'dress', cloth: 0xd96a59, skin: 0xc98a5e, accent: 0x4a2f22 },
    { x: -7.7, z: -20, faceYaw: 0, moving: true, dirZ: 1, kind: 'suit', cloth: 0x4b4f57, skin: 0x8d5a3b, accent: 0x33363c },
    { x: -7.7, z: 4, faceYaw: Math.PI, moving: true, dirZ: -1, kind: 'dress', cloth: 0x3f8f8a, skin: 0xefc9a4, accent: 0x1d1a17 },
    { x: 7.7, z: 18, faceYaw: 0, moving: true, dirZ: 1, kind: 'suit', cloth: 0x5d4a36, skin: 0xf1cfa8, accent: 0x3f3125 },
    { x: 7.4, z: 12.2, faceYaw: -Math.PI / 2, moving: false, dirZ: 1, kind: 'dress', cloth: 0xead489, skin: 0xd9a06b, accent: 0x7a3b2a },
    { x: -7.4, z: -12.5, faceYaw: Math.PI / 2, moving: false, dirZ: 1, kind: 'suit', cloth: 0x30343b, skin: 0xb97e52, accent: 0x1f2329 },
    { x: 8.3, z: -33, faceYaw: -Math.PI / 2, moving: false, dirZ: 1, kind: 'suit', cloth: 0x55603f, skin: 0xe8b48c, accent: 0x3a412e },
  ];
  for (const spec of walkerSpecs) {
    buildWalker(state, mats, spec, rng);
  }

  root.userData.era1965 = state;
  return root;
}

/* ------------------------------------------------------------------ */
/* Per-frame update                                                    */
/* ------------------------------------------------------------------ */

export function update(dt: number, group: THREE.Group): void {
  const state = group.userData.era1965 as Era1965State | undefined;
  if (!state) return;
  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
  if (step <= 0) return;
  state.elapsed += step;
  const t = state.elapsed;

  // Vehicles cruise both lanes; wheels roll with travel speed.
  for (const car of state.cars) {
    car.group.position.z += car.dirZ * car.speed * step;
    if (car.group.position.z > CAR_WRAP_Z) {
      car.group.position.z -= CAR_WRAP_Z * 2;
    } else if (car.group.position.z < -CAR_WRAP_Z) {
      car.group.position.z += CAR_WRAP_Z * 2;
    }
    const spin = ((t * car.speed) / WHEEL_RADIUS) * car.dirZ;
    for (const wheel of car.spinners) {
      wheel.rotation.x = spin;
    }
  }

  // Pedestrians walk the sidewalks, dipping to street level to cross.
  for (const w of state.walkers) {
    w.phase += w.speed * step * 4.2;
    w.group.position.x += w.dir.x * w.speed * step;
    w.group.position.z += w.dir.z * w.speed * step;
    if (w.group.position.z > WALKER_WRAP) {
      w.group.position.z -= WALKER_WRAP * 2;
    } else if (w.group.position.z < -WALKER_WRAP) {
      w.group.position.z += WALKER_WRAP * 2;
    }
    const targetY = Math.abs(w.group.position.z) < 7 ? 0.02 : SIDEWALK_TOP;
    w.curY += (targetY - w.curY) * Math.min(step * 6, 1);
    w.group.position.y = w.curY;

    const swing = Math.sin(w.phase) * 0.55;
    w.parts.legL.rotation.x = swing;
    w.parts.legR.rotation.x = -swing;
    w.parts.armL.rotation.x = -swing * 0.6;
    w.parts.armR.rotation.x = swing * 0.6;
    w.parts.body.position.y = Math.abs(Math.cos(w.phase)) * 0.05;
    w.parts.body.rotation.x = 0.05;
    w.parts.body.rotation.y = Math.sin(w.phase * 0.23) * 0.06;
  }

  // Idle window-shoppers sway and look around.
  for (const idle of state.idlers) {
    idle.parts.body.rotation.y = Math.sin(t * 0.9 + idle.seed) * 0.14;
    idle.parts.body.position.y = Math.abs(Math.sin(t * 0.45 + idle.seed)) * 0.02;
    idle.parts.head.rotation.y = Math.sin(t * 0.55 + idle.seed * 1.7) * 0.45;
    idle.parts.armL.rotation.x = 0.07;
    idle.parts.armR.rotation.x = -0.05;
    idle.parts.legL.rotation.x = 0;
    idle.parts.legR.rotation.x = 0;
  }

  // Traffic light cycle (north-south vs east-west phases).
  for (const signal of state.signals) {
    const phase = (t / SIGNAL_PERIOD + signal.offset) % 1;
    let ri = 0.18;
    let yi = 0.18;
    let gi = 0.18;
    if (phase < 0.4) gi = 2.4;
    else if (phase < 0.5) yi = 2.4;
    else ri = 2.4;
    signal.red.emissiveIntensity = ri;
    signal.yellow.emissiveIntensity = yi;
    signal.green.emissiveIntensity = gi;
  }

  // Neon buzz; the diner roofline occasionally drops out like a tired tube.
  for (const neon of state.neons) {
    let factor = 0.86 + 0.14 * Math.sin(t * neon.rate + neon.seed);
    if (neon.unstable && Math.sin(t * 17.3 + neon.seed * 3.1) > 0.93) {
      factor *= 0.22;
    }
    neon.material.emissiveIntensity = neon.base * factor;
  }

  // Marquee bulbs chase around the billboard borders.
  for (const row of state.bulbRows) {
    const count = row.materials.length;
    const onIndex = Math.floor(t * 7) % count;
    for (let i = 0; i < count; i++) {
      row.materials[i].emissiveIntensity = i === onIndex ? 2.6 : 0.45;
    }
  }

  // Googie starbursts rotate slowly.
  for (const star of state.starbursts) {
    star.rotation.y += step * 0.7;
  }
}
