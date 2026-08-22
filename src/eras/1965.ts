import * as THREE from 'three';

/**
 * Era module: 1965 — "Mid-Century Boom".
 *
 * A procedurally-built city block profile for the 1965 timeline stop:
 *  - Layer 1: mid-century modern storefront buildings with large recessed
 *    glass window walls, pastel stucco facades and angled awnings, plus a
 *    background skyline of low-rise masses.
 *  - Layer 2: buzzing neon signage — facade blade signs, a cantilever-roof
 *    diner with neon roofline, and a pylon sign (traffic lights have replaced
 *    the gas lamps of 1945).
 *  - Layer 3: 1960s sedans and station wagons (chrome bumpers, whitewall
 *    wheels, woody trim, luggage rack) cruising wider asphalt avenues.
 *  - Layer 4: pedestrians in period suits (fedoras, ties) and swing dresses,
 *    with animated walk cycles and idle window-shopper poses.
 *  - Layer 5: billboards with mid-century advertising art drawn onto procedural
 *    CanvasTextures (no external assets), framed by chasing marquee bulbs.
 *  - Layer 6: street furniture — mast-arm traffic signals, cobra-head street
 *    lamps, parking meters, benches, hydrant, litter bins, crosswalks and
 *    lane markings — plus googie accents (starburst clock, boomerang fins).
 *
 * Everything is generated from three.js primitives and canvas-drawn textures;
 * there are no model or texture downloads. Animation state lives in
 * `group.userData.era1965` so `update(dt, group)` stays instance-safe.
 *
 * Polygon budget: boxes/cylinders with low segment counts keep the block
 * well under the ~50k triangle target.
 */

type Dir = 1 | -1;
type Axis = 'x' | 'z';

const CURB_HEIGHT = 0.14;
const AVENUE_LENGTH = 96;
const CAR_LANE_X = 3.1;
const CAR_WRAP_Z = 46;
const WHEEL_RADIUS = 0.34;
const WALKER_WRAP = 21;
const SIGNAL_PERIOD = 9;
const STORY_HEIGHT = 3.4;
const HIP_HEIGHT = 0.84;

/** Shared reusable scratch vector (never stored across frames). */
const scratchVec = new THREE.Vector3();

interface CarRuntime {
  group: THREE.Group;
  dirZ: Dir;
  speed: number;
  spinners: THREE.Object3D[];
}

interface WalkerParts {
  body: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  head: THREE.Mesh;
}

interface WalkerRuntime {
  group: THREE.Group;
  parts: WalkerParts;
  dir: THREE.Vector3;
  axis: Axis;
  speed: number;
  phase: number;
  seed: number;
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
  creamPaint: THREE.MeshStandardMaterial;
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
  position: THREE.Vector3;
  rotationY: number;
  width: number;
  depth: number;
  stories: number;
  paint: number;
  trim: number;
  awning: number;
  signText: string;
  signBg: number;
  signFg: number;
  googieFin: boolean;
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
    const slot = (canvas.height * 0.66) / Math.max(art.lines.length, 1);
    art.lines.forEach((line, index) => {
      const px = Math.min(slot * 0.92, (canvas.width * 0.92) / Math.max(line.length * 0.62, 1));
      ctx.font = `bold ${Math.max(px, 20)}px 'Futura', 'Century Gothic', 'Trebuchet MS', sans-serif`;
      ctx.fillText(line, canvas.width / 2, canvas.height * 0.48 + (index - (art.lines.length - 1) / 2) * slot);
    });
    if (art.sub !== undefined) {
      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillStyle = css(art.accent ?? art.fg);
      ctx.fillText(art.sub, canvas.width / 2, canvas.height * 0.76);
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
    creamPaint: std({ color: 0xf0e3c6, roughness: 0.55 }),
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
  };
}

/* ------------------------------------------------------------------ */
/* Layer 1: streets, storefront buildings, diner, background skyline   */
/* ------------------------------------------------------------------ */

function buildStreets(parent: THREE.Object3D, mats: MaterialSet): void {
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

  // Sidewalk quadrant plates (raised curbs).
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      addBox(parent, 18, CURB_HEIGHT, 18, mats.concrete, sx * 15, CURB_HEIGHT / 2, sz * 15);
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

  // Dashed white centerline on the cross street.
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 5; i++) {
      const x = side * (8 + i * 3.4);
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
  addBox(parent, 5.2, 0.012, 0.35, mats.lineWhite, -3.1, 0.031, 9.4);
  addBox(parent, 5.2, 0.012, 0.35, mats.lineWhite, 3.1, 0.031, -9.4);

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
  state.neons.push({ material: neonMat, base: 1.25, rate: 3.2, seed: unstable ? 4.1 : 1.3, unstable });

  return sign;
}

function buildStorefront(state: Era1965State, mats: MaterialSet, spec: LotSpec): void {
  const g = new THREE.Group();
  g.position.copy(spec.position);
  g.rotation.y = spec.rotationY;

  const height = spec.stories * STORY_HEIGHT + 0.5;
  const paintMat = std({ color: spec.paint, roughness: 0.6 });
  const trimMat = std({ color: spec.trim, roughness: 0.5 });
  const awningMat = std({ color: spec.awning, roughness: 0.65 });

  addBox(g, spec.width, height, spec.depth, paintMat, 0, height / 2, -spec.depth / 2);
  addBox(g, spec.width, 0.18, spec.depth, trimMat, 0, height + 0.09, -spec.depth / 2);
  addBox(g, spec.width, 0.35, 0.45, trimMat, 0, height + 0.15, -0.2);

  // Recessed ground-floor glass wall with warm interior glow behind it.
  addBox(g, spec.width - 1.4, 2.55, 0.14, mats.storefrontGlass, 0, 1.42, 0.03);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width - 1.7, 2.2), mats.glowInterior);
  glow.position.set(0, 1.42, -0.55);
  g.add(glow);

  const mullionCount = Math.max(2, Math.round((spec.width - 1.6) / 1.4));
  for (let i = 0; i < mullionCount; i++) {
    const x = -(spec.width - 1.7) / 2 + (i * (spec.width - 1.7)) / (mullionCount - 1);
    addBox(g, 0.09, 2.65, 0.18, mats.chrome, x, 1.44, 0.05);
  }
  addBox(g, spec.width - 1.4, 0.34, 0.16, mats.darkMetal, 0, 0.17, 0.04);
  addBox(g, spec.width - 1.4, 0.22, 0.16, mats.chrome, 0, 2.85, 0.04);

  // Entry door with chrome push bar.
  const doorX = spec.width / 2 - 1.1;
  addBox(g, 0.95, 2.35, 0.12, mats.doorGlass, doorX, 1.175, 0.06);
  addBox(g, 0.8, 0.06, 0.06, mats.chrome, doorX, 1.05, 0.14);

  // Angled awning on a pivot at the facade.
  const awningPivot = new THREE.Group();
  awningPivot.position.set(-0.4, 3.02, 0);
  awningPivot.rotation.x = -0.45;
  addBox(awningPivot, spec.width - 2.2, 0.07, 1.35, awningMat, 0, 0, 0.6);
  addBox(awningPivot, spec.width - 2.2, 0.07, 0.14, mats.lineWhite, 0, 0.005, 1.24);
  g.add(awningPivot);

  // Upper-story windows and sills.
  const windowCount = Math.max(2, Math.round((spec.width - 2) / 1.7));
  for (let story = 1; story < spec.stories; story++) {
    const floorY = story * STORY_HEIGHT;
    for (let i = 0; i < windowCount; i++) {
      const x =
        -(spec.width - 2.2) / 2 + (i * (spec.width - 2.2)) / Math.max(windowCount - 1, 1);
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
  addBox(g, 1.2, 0.7, 1.0, mats.galvanized, -spec.width / 4, height + 0.53, -spec.depth / 2);
  addCylinder(g, 0.02, 0.03, 2.0, 5, mats.darkMetal, spec.width / 4, height + 1.0, -spec.depth * 0.7);

  const blade = buildBladeSign(
    state,
    mats,
    { lines: [spec.signText], bg: spec.signBg, fg: spec.signFg },
    spec.signFg,
    false,
  );
  blade.position.set(-spec.width / 2 + 0.9, 4.0, 0.1);
  g.add(blade);

  state; // state is consumed by buildBladeSign; keeps signature uniform.
  parent_add: {
    g;
  }
  return void g.parent?.parent;
}

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

  root.add(buildPlaceholderMasses());
  root.userData.era1965 = state;
  return root;
}
