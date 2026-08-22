import * as THREE from 'three';

/**
 * Era module: 1945 — postwar brick tenements, vintage cars, period pedestrians & signage.
 *
 * The scene is composed from procedural three.js primitives and a few
 * CanvasTexture-generated period signs/posters.
 */

type Dir = 1 | -1;

const STORY_HEIGHT = 3.2;
const SIDEWALK_Y = 0.16;
const CURB_HEIGHT = 0.14;
const ROAD_LENGTH_Z = 96;
const ROAD_CENTER_Z = 0;

const AVE_HALF_WIDTH_X = 6.7;
const WALKWAY_STRIP_Z = 5.6;
const STREETLAMP_Y = 0;
const CAR_LANE_X = 3.25;
const CAR_WRAP_Z = 46;
const WALKER_WRAP_Z = 24;

const HIP_HEIGHT = 0.78;
const WALKER_BODY_Y = 0.0;

const SIGNAL_PERIOD = 6.8;

interface VehicleRuntime {
  group: THREE.Group;
  dirZ: Dir;
  speed: number;
  wheelSpinners: THREE.Object3D[];
  wobbleSeed: number;
}

interface WalkerRuntime {
  group: THREE.Group;
  dir: THREE.Vector3;
  speed: number;
  phase: number;
  seed: number;
  curY: number;
  parts: {
    body: THREE.Object3D;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
    armL: THREE.Object3D;
    armR: THREE.Object3D;
    head: THREE.Object3D;
    hat?: THREE.Object3D;
  };
  moving: boolean;
}

interface BarbsRuntime {
  pole: THREE.Group;
}

interface MarqueeRuntime {
  materials: THREE.MeshStandardMaterial[];
  rate: number;
  seed: number;
}

interface LampRuntime {
  lightMat: THREE.MeshStandardMaterial;
  flickerSeed: number;
}

interface Era1945State {
  elapsed: number;
  vehicles: VehicleRuntime[];
  walkers: WalkerRuntime[];
  barbers: BarbsRuntime[];
  marquees: MarqueeRuntime[];
  lamps: LampRuntime[];
}

/** Small deterministic PRNG so layout is stable between rebuilds. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    const t = Math.imul(s ^ (s >>> 15), 1 | s);
    return (((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0) / 4294967296;
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

type SignArt = {
  lines: string[];
  sub?: string;
  bg: number;
  fg: number;
  accent?: number;
  square?: boolean;
  stripes?: boolean;
};

function makeCanvasMaterial(art: SignArt, fallbackColor: number): THREE.MeshStandardMaterial {
  const fallback = std({ color: fallbackColor, roughness: 0.55, metalness: 0.0 });
  if (typeof document === 'undefined') return fallback;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = art.square ? 512 : 700;
    canvas.height = art.square ? 512 : 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

    ctx.fillStyle = css(art.bg);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (art.stripes) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 10);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      const stripeCount = 18;
      for (let i = 0; i < stripeCount; i++) {
        const x = (i / stripeCount) * canvas.width;
        ctx.fillStyle = css(art.accent ?? art.fg);
        ctx.globalAlpha = i % 2 === 0 ? 0.85 : 0.55;
        ctx.fillRect(x - canvas.width * 0.03, 0, canvas.width * 0.08, canvas.height);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (art.accent !== undefined) {
      ctx.fillStyle = css(art.accent);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(art.fg);

    const slot = (canvas.height * 0.62) / Math.max(art.lines.length, 1);
    art.lines.forEach((line, i) => {
      const px = Math.max(22, Math.min(canvas.width * 0.12, 56 - line.length * 1.5));
      ctx.font = `bold ${px}px 'Trebuchet MS', 'Century Gothic', Arial, sans-serif`;
      ctx.fillText(
        line,
        canvas.width / 2,
        canvas.height * 0.44 + (i - (art.lines.length - 1) / 2) * slot,
      );
    });

    if (art.sub) {
      ctx.font = `italic ${Math.max(20, Math.min(38, canvas.width * 0.06))}px Georgia, serif`;
      ctx.fillStyle = css(art.accent ?? art.fg);
      ctx.fillText(art.sub, canvas.width / 2, canvas.height * 0.78);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return std({ map: texture, roughness: 0.55, metalness: 0.0 });
  } catch {
    return fallback;
  }
}

function makePaperMaterial(hex: number): THREE.MeshStandardMaterial {
  // Paper: low metalness, matte.
  return std({ color: hex, roughness: 0.95, metalness: 0.0 });
}

function createMaterials() {
  return {
    asphalt: std({ color: 0x2a2f34, roughness: 0.97, metalness: 0.0 }),
    cobble: std({ color: 0x34393f, roughness: 0.95, metalness: 0.0 }),
    concrete: std({ color: 0xb2aa9d, roughness: 0.92, metalness: 0.0 }),
    brick: std({ color: 0x7b3f2a, roughness: 0.88, metalness: 0.05 }),
    brickDark: std({ color: 0x5e2f20, roughness: 0.9, metalness: 0.05 }),
    wood: std({ color: 0x6b3f26, roughness: 0.75, metalness: 0.15 }),
    woodDark: std({ color: 0x4f2b18, roughness: 0.8, metalness: 0.1 }),
    windowGlass: std({ color: 0x9fb9c6, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.68 }),
    interiorGlow: new THREE.MeshBasicMaterial({ color: 0xfff2bf }),
    metal: std({ color: 0x7a7f86, roughness: 0.55, metalness: 0.35 }),
    galvanized: std({ color: 0x9aa0a3, roughness: 0.65, metalness: 0.55 }),
    darkMetal: std({ color: 0x2b2f36, roughness: 0.6, metalness: 0.4 }),
    lineWhite: std({ color: 0xf1ead9, roughness: 0.75, metalness: 0.0 }),
    lineYellow: std({ color: 0xd8a53a, roughness: 0.75, metalness: 0.0 }),
    rubber: std({ color: 0x141414, roughness: 0.95, metalness: 0.0 }),
    headlight: std({ color: 0xfff1c9, emissive: 0xffe7a0, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.0 }),
    tailLight: std({ color: 0x9a2525, emissive: 0xff2f2f, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.0 }),
    paintRed: std({ color: 0x7f1f1f, roughness: 0.35, metalness: 0.15 }),
    paintCream: std({ color: 0xe8ddc2, roughness: 0.3, metalness: 0.12 }),
    paintBlue: std({ color: 0x2b4b7c, roughness: 0.28, metalness: 0.12 }),
    poster: makePaperMaterial(0xd9c38e),
    posterBlue: makePaperMaterial(0x8fbbe0),
    signRed: std({ color: 0xb6382b, roughness: 0.5, metalness: 0.0 }),
    streetLampGold: std({ color: 0x996a2a, roughness: 0.6, metalness: 0.35 }),
    streetLampGlass: std({ color: 0xffe3a0, roughness: 0.2, metalness: 0.0, emissive: 0xffd37a, emissiveIntensity: 0.4 }),
    marqueeTube: std({ color: 0xffe8a8, emissive: 0xffc86a, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.0 }),
  };
}

function buildStreets(parent: THREE.Object3D, mats: ReturnType<typeof createMaterials>): void {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12.2, ROAD_LENGTH_Z), mats.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.position.z = ROAD_CENTER_Z;
  parent.add(road);

  // Cobblestone edges.
  const cobEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.3, ROAD_LENGTH_Z), mats.cobble);
  cobEdge.rotation.x = -Math.PI / 2;
  cobEdge.position.y = 0.021;
  cobEdge.position.x = AVE_HALF_WIDTH_X + 2.0;
  parent.add(cobEdge);
  const cobEdge2 = cobEdge.clone();
  cobEdge2.position.x *= -1;
  parent.add(cobEdge2);

  // Raised curb strips along the avenue.
  for (const side of [1, -1] as const) {
    addBox(
      parent,
      12.6,
      CURB_HEIGHT,
      2.0,
      mats.concrete,
      0,
      CURB_HEIGHT / 2,
      side * (ROAD_LENGTH_Z / 2 - 1.2),
    );
  }

  // Sidewalk curbs and slabs.
  for (const sx of [1, -1] as const) {
    // curb line
    addBox(parent, AVE_HALF_WIDTH_X * 0.9, CURB_HEIGHT, 4.0, mats.concrete, sx * AVE_HALF_WIDTH_X, CURB_HEIGHT / 2, 0);
  }

  // Walkway slabs.
  for (const sx of [1, -1] as const) {
    addBox(
      parent,
      18.0,
      SIDEWALK_Y,
      72,
      mats.concrete,
      sx * 8.2,
      SIDEWALK_Y / 2,
      0,
    );
  }

  // Lane divider: sparse dashed.
  for (let i = 0; i < 10; i++) {
    const z = -34 + i * 7.0;
    addBox(parent, 0.12, 0.012, 3.4, mats.lineYellow, 0, 0.032, z);
  }

  // Crosswalks.
  for (const z0 of [-18, 0, 18]) {
    for (const sx of [1, -1] as const) {
      for (let i = 0; i < 6; i++) {
        addBox(parent, 2.0, 0.012, 0.42, mats.lineWhite, sx * 5.1 - i * 0.35, 0.032, z0);
      }
    }
  }
}

function buildBrickTenement(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
  side: Dir,
  stories: 2 | 3,
  width: number,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;

  const height = stories * STORY_HEIGHT;
  const facadeDepth = 5.6;

  // Base brick block.
  addBox(g, width, height, facadeDepth, mats.brick, 0, height / 2, 0);

  // Window bays.
  const windowRows = stories * 2;
  const bays = Math.max(3, Math.round(width / 2.3));
  for (let row = 0; row < windowRows; row++) {
    const fy = (row + 0.5) * (STORY_HEIGHT / 2);
    for (let b = 0; b < bays; b++) {
      const px = -width / 2 + ((b + 0.5) * width) / bays;
      addBox(g, 0.45, 0.95, 0.18, mats.windowGlass, px, fy, facadeDepth * 0.49);
      if (row % 2 === 0) {
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.86), mats.interiorGlow);
        glow.position.set(px, fy, facadeDepth * 0.46 + 0.01);
        g.add(glow);
      }
      addBox(g, 0.09, 1.0, 0.16, mats.brickDark, px, fy, facadeDepth * 0.48);
    }
  }

  // Fire escape if 3 stories.
  if (stories === 3) {
    const fx = width / 2 - 0.9;
    for (let level = 0; level < 2; level++) {
      const plateY = STORY_HEIGHT * (level + 1) + 0.22;
      addBox(g, 1.1, 0.06, 2.3, mats.metal, fx, plateY, facadeDepth * 0.16);
      // rails
      addBox(g, 1.1, 0.03, 2.3, mats.darkMetal, fx, plateY + 0.08, facadeDepth * 0.18);

      // ladder/steps along side.
      const ladderX = fx - 0.55;
      addBox(g, 0.05, 2.3, 0.08, mats.galvanized, ladderX, plateY + 1.0, facadeDepth * 0.17);
      for (let rung = 0; rung < 4; rung++) {
        const rz = facadeDepth * 0.17 + 0.12;
        addBox(g, 1.0, 0.05, 0.08, mats.galvanized, ladderX + 0.1, plateY + 0.35 + rung * 0.45, rz);
      }
    }
  }

  root.add(g);

  // Sidewalk entry door.
  const doorW = 0.85;
  const doorH = 2.25;
  const door = new THREE.Group();
  door.position.set(x + (side === 1 ? 1.8 : -1.8), 0, z + 2.0);
  addBox(door, doorW, doorH, 0.18, mats.darkMetal, 0, doorH / 2, 0.0);
  const window = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.75), mats.windowGlass);
  window.position.set(0, doorH * 0.7, 0.09);
  door.add(window);
  addBox(door, 0.06, 0.9, 0.04, mats.metal, -0.28, doorH * 0.52, 0.12);
  root.add(door);
}

function buildWallAds(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
  side: Dir,
): void {
  // Hand-painted wall ads: CanvasTexture planes.
  const art1 = makeCanvasMaterial(
    { lines: ['WAR BONDS'], sub: 'Buy a share', bg: 0x3b2b47, fg: 0xfff2d6, accent: 0xffd16a, square: false, stripes: true },
    0xffd16a,
  );
  const art2 = makeCanvasMaterial(
    { lines: ['SUGAR'], sub: 'RATIONED', bg: 0x263d56, fg: 0xe8f3ff, accent: 0x7bdcff, square: false, stripes: true },
    0xe8f3ff,
  );
  const art3 = makeCanvasMaterial(
    { lines: ['COFFEE'], sub: 'FRESH ROAST', bg: 0x2a4a2a, fg: 0xfff0cf, accent: 0xd3a85a, square: false },
    0xfff0cf,
  );

  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  holder.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;

  // Two posters high on the wall.
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8), art1);
  p1.position.set(0.7, 3.2, 0.49);
  holder.add(p1);

  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8), art2);
  p2.position.set(-0.8, 3.2, 0.49);
  holder.add(p2);

  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), art3);
  p3.position.set(-0.05, 1.9, 0.49);
  holder.add(p3);

  root.add(holder);
}

function buildCornerGrocery(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
): void {
  // Two facades (approximated) via a corner block and one sign.
  const width = 6.8;
  const height = STORY_HEIGHT * 2 + 0.6;
  const depth = 5.6;

  const g = new THREE.Group();
  g.position.set(x, 0, z);

  addBox(g, width, height, depth, mats.brick, 0, height / 2, 0);

  // Wooden trim.
  addBox(g, width, 0.22, depth, mats.woodDark, 0, height + 0.12, 0);
  addBox(g, width * 0.92, 0.1, depth * 0.95, mats.woodDark, 0, STORY_HEIGHT * 1 + 0.12, 0);

  // Grocery windows.
  const winY = STORY_HEIGHT * 0.8;
  for (const sx of [-1, 1]) {
    const wx = sx * 2.2;
    addBox(g, 0.6, 1.0, 0.2, mats.windowGlass, wx, winY, depth * 0.48);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.88), mats.interiorGlow);
    glow.position.set(wx, winY, depth * 0.46 + 0.01);
    g.add(glow);
  }

  // Hand-painted wooden signage.
  const signMat = makeCanvasMaterial(
    { lines: ['CORNER', 'GROCERIES'], sub: 'FRESH & FAIR', bg: 0x3a2416, fg: 0xfff0d6, accent: 0xffc36a, stripes: false },
    0xfff0d6,
  );

  const plaque = new THREE.Group();
  addBox(plaque, 2.6, 1.0, 0.15, mats.wood, 0, height * 0.72, depth * 0.5 + 0.01);
  const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 0.88), signMat);
  signPlane.position.set(0, height * 0.72 + 0.0, depth * 0.5 + 0.08);
  plaque.add(signPlane);
  plaque.position.set(0, 0, 0);
  g.add(plaque);

  // Corner awning.
  const awning = new THREE.Group();
  awning.position.set(0, STORY_HEIGHT * 0.78, depth * 0.22);
  addBox(awning, width * 0.6, 0.07, depth * 0.5, mats.woodDark, 0, 0, -0.14);
  addBox(awning, width * 0.6, 0.03, depth * 0.5, mats.metal, 0, 0.06, -0.11);
  g.add(awning);

  // Fire escape ladder from side.
  const esc = new THREE.Group();
  esc.position.set(width * 0.33, 0, depth * 0.05);
  for (let i = 0; i < 2; i++) {
    const y = STORY_HEIGHT * (i + 1) + 0.1;
    addBox(esc, 1.0, 0.06, 2.2, mats.metal, 0, y, 0.2);
    addBox(esc, 0.05, 1.8, 0.08, mats.galvanized, -0.3, y + 0.9, 0.1);
    addBox(esc, 0.05, 1.8, 0.08, mats.galvanized, 0.3, y + 0.9, 0.1);
    for (let r = 0; r < 4; r++) addBox(esc, 0.9, 0.04, 0.06, mats.galvanized, 0, y + 0.2 + r * 0.4, 0.2);
  }
  g.add(esc);

  root.add(g);
}

function buildBarbershopPole(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
): BarbsRuntime {
  const poleGroup = new THREE.Group();
  poleGroup.position.set(x, SIDEWALK_Y, z);

  // Pole base.
  addCylinder(poleGroup, 0.06, 0.06, 0.2, mats.darkMetal, 0, 0.1, 0);
  addCylinder(poleGroup, 0.05, 0.05, 3.2, 10, mats.metal, 0, 1.6, 0);

  const stripeRed = std({ color: 0xb43a3a, roughness: 0.4, metalness: 0.1, emissive: 0x000000 });
  const stripeWhite = std({ color: 0xf2f2ea, roughness: 0.5, metalness: 0.05 });

  // Make stripes as a stack of thin boxes around the pole.
  const stripeStack: THREE.Object3D[] = [];
  const segs = 18;
  for (let i = 0; i < segs; i++) {
    const h = 0.12;
    const y = (i / segs) * 2.8;
    const angle = (i / segs) * Math.PI * 2;
    const mat = i % 2 === 0 ? stripeRed : stripeWhite;
    const stripe = addBox(poleGroup, 0.17, h, 0.06, mat, 0.08 * Math.cos(angle), y + 0.2, 0.08 * Math.sin(angle));
    stripe.rotation.z = angle;
    stripeStack.push(stripe);
  }

  // Barbershop base sign plate.
  const signMat = makeCanvasMaterial(
    { lines: ['BARBER'], sub: 'SHAVE & TRIM', bg: 0x2a1c12, fg: 0xfff0d6, accent: 0xd3a85a, square: false },
    0xfff0d6,
  );
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat);
  plate.position.set(0, 0.28, 0.28);
  plate.rotation.y = -Math.PI / 2;
  poleGroup.add(plate);

  root.add(poleGroup);
  // Animate by rotating stripeStack container.
  poleGroup.userData.stripeStack = stripeStack;

  return { pole: poleGroup };
}

function buildCinema(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
): MarqueeRuntime {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const w = 7.2;
  const h = STORY_HEIGHT * 2 + 1.0;
  const d = 5.6;

  addBox(g, w, h, d, mats.brickDark, h / 2 - 0.2, 0, 0);

  // Cinema door.
  const door = new THREE.Group();
  addBox(door, 2.1, 2.3, 0.18, mats.darkMetal, 0, 1.15, d * 0.5);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), mats.windowGlass);
  glass.position.set(0, 1.15 + 0.1, d * 0.5 + 0.1);
  door.add(glass);
  addBox(door, 1.6, 0.08, 0.1, mats.metal, 0, 1.2, d * 0.5 + 0.03);
  g.add(door);
  door.position.set(0, 0, 0);
  door.rotation.y = 0;
  // Door placement
  door.position.y = 1.25;

  // Marquee frame.
  const marqueeFrame = new THREE.Group();
  marqueeFrame.position.set(0, h - 1.1, d * 0.51);
  addBox(marqueeFrame, 4.9, 1.1, 0.06, mats.darkMetal, 0, 0, 0.02);
  addBox(marqueeFrame, 4.7, 0.06, 0.06, mats.marqueeTube, 0, -0.3, 0.02);
  addBox(marqueeFrame, 4.7, 0.06, 0.06, mats.marqueeTube, 0, 0.3, 0.02);

  const bulbMats: THREE.MeshStandardMaterial[] = [];
  const bulbColor = 0xffdca0;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const px = -2.35 + t * 4.7;
    const bulbMat = std({ color: bulbColor, emissive: 0xffc86a, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.0 });
    bulbMats.push(bulbMat);
    const bulb = addSphere(marqueeFrame, 0.09, 8, 6, bulbMat, px, 0, 0.16);
    bulb.scale.set(1, 1, 1);
    bulb.rotation.y = i;
  }

  g.add(marqueeFrame);

  // Marquee art plate.
  const marqueeMat = makeCanvasMaterial(
    { lines: ['THE', 'PICTURE HOUSE'], sub: 'ONE SCREEN', bg: 0x1b1b2a, fg: 0xfff2cf, accent: 0xff6aa3, stripes: false },
    0xfff2cf,
  );
  const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.65), marqueeMat);
  artPlane.position.set(0, h - 1.25, d * 0.52);
  g.add(artPlane);

  // Projector box prop.
  const projector = addBox(g, 0.55, 0.28, 0.45, mats.metal, -2.6, 1.65, d * 0.05);
  projector.rotation.y = 0.1;
  projector.position.z = d * 0.2;

  // Wrap to slightly face the street.
  g.rotation.y = Math.PI / 2;
  root.add(g);

  return { materials: bulbMats, rate: 6.2, seed: 0.33 };
}

function buildVehicles(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  state: Era1945State,
): void {
  // Wheels shared geometry.
  const wheelRadius = 0.36;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.23, 10);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.27, 8);
  hubGeo.rotateZ(Math.PI / 2);

  function buildSedan(paintMat: THREE.MeshStandardMaterial, xLane: number, zStart: number, dirZ: Dir, speed: number, wobbleSeed: number): void {
    const g = new THREE.Group();
    // Chassis.
    addBox(g, 5.2, 0.52, 2.4, paintMat, 0, 0.26, 0);
    // Running boards.
    addBox(g, 4.6, 0.08, 0.9, mats.darkMetal, 0, 0.16, 1.15);
    addBox(g, 4.6, 0.08, 0.9, mats.darkMetal, 0, 0.16, -1.15);

    // Cabin.
    addBox(g, 1.8, 0.58, 1.6, paintMat, 0, 0.63, -0.18);
    // Trunk.
    addBox(g, 1.4, 0.45, 1.1, paintMat, 0, 0.48, 1.0);

    // Grille and headlights.
    addBox(g, 0.3, 0.12, 0.2, mats.darkMetal, 0.82, 0.62, -1.2);
    addSphere(g, 0.09, 8, 6, mats.headlight, 1.0, 0.62, -1.2);
    addSphere(g, 0.09, 8, 6, mats.headlight, -1.0, 0.62, -1.2);
    addBox(g, 0.22, 0.12, 0.2, mats.tailLight, 0.75, 0.45, 1.18);
    addBox(g, 0.22, 0.12, 0.2, mats.tailLight, -0.75, 0.45, 1.18);

    // Whitewall wheels.
    const spinners: THREE.Object3D[] = [];
    const wheelY = 0.0;
    for (const sx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * 2.0, wheelY + 0.14, cz * 0.95);
        wheel.add(new THREE.Mesh(tireGeo, mats.rubber));
        wheel.add(new THREE.Mesh(hubGeo, mats.metal));
        g.add(wheel);
        spinners.push(wheel);
      }
    }

    // Fenders.
    addBox(g, 4.9, 0.14, 2.1, paintMat, 0, 0.40, 0);

    // Orientation.
    g.rotation.y = dirZ === 1 ? 0 : Math.PI;
    g.position.set(xLane * dirZ, 0, zStart);

    root.add(g);
    state.vehicles.push({ group: g, dirZ, speed, wheelSpinners: spinners, wobbleSeed });
  }

  function buildTrolley(paintMat: THREE.MeshStandardMaterial, xLane: number, zStart: number, dirZ: Dir, speed: number, wobbleSeed: number): void {
    const g = new THREE.Group();
    // Body.
    addBox(g, 7.8, 0.85, 3.4, paintMat, 0, 0.43, 0);
    // Side running boards.
    addBox(g, 7.0, 0.08, 1.4, mats.darkMetal, 0, 0.27, 1.7);
    // Upper deck.
    addBox(g, 7.2, 0.32, 2.2, paintMat, 0, 0.92, 0.2);

    // Windows.
    const winMat = mats.windowGlass;
    for (const i of [-1, 0, 1]) {
      addBox(g, 0.95, 0.38, 0.12, winMat, i * 1.55, 0.78, 1.71);
      addBox(g, 0.95, 0.38, 0.12, winMat, i * 1.55, 0.78, -1.71);
    }

    // Wheels.
    const spinners: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * 2.7, 0.18, cz * 0.8);
        wheel.add(new THREE.Mesh(tireGeo, mats.rubber));
        wheel.add(new THREE.Mesh(hubGeo, mats.metal));
        g.add(wheel);
        spinners.push(wheel);
      }
    }

    // Pantograph simplification.
    const pan = new THREE.Group();
    pan.position.set(0, 1.15, 0);
    addCylinder(pan, 0.03, 0.04, 1.2, 6, mats.darkMetal, 0, 0.62, 0);
    addBox(pan, 0.9, 0.04, 0.3, mats.metal, -0.42, 1.05, -0.2);
    addBox(pan, 0.9, 0.04, 0.3, mats.metal, 0.42, 1.05, -0.2);
    g.add(pan);

    // Bumpers.
    addBox(g, 1.0, 0.14, 0.25, mats.metal, 0, 0.5, 1.78);
    addBox(g, 1.0, 0.14, 0.25, mats.metal, 0, 0.5, -1.78);

    g.rotation.y = dirZ === 1 ? 0 : Math.PI;
    g.position.set(xLane * dirZ, 0, zStart);
    root.add(g);

    state.vehicles.push({ group: g, dirZ, speed, wheelSpinners: spinners, wobbleSeed });
  }

  // Sparse pre-1950 traffic: a couple of sedans plus one trolley.
  buildSedan(mats.paintBlue, CAR_LANE_X, -28, 1, 7.0, 1.2);
  buildSedan(mats.paintRed, -CAR_LANE_X, 18, -1, 6.2, 2.0);
  buildSedan(mats.paintCream, CAR_LANE_X, 35, 1, 7.6, 3.7);

  buildTrolley(mats.metal, -CAR_LANE_X, -8, -1, 4.8, 4.4);
}

function buildWalker(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
  dirZ: Dir,
  moving: boolean,
  kind: 'suit' | 'dress',
  seed: number,
  speed: number,
): WalkerRuntime {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_Y, z);
  g.rotation.y = dirZ === 1 ? Math.PI / 2 : -Math.PI / 2;

  const body = new THREE.Group();
  g.add(body);

  const skin = std({ color: kind === 'suit' ? 0xe6b88c : 0xd7a27d, roughness: 0.6, metalness: 0 });
  const cloth = kind === 'suit' ? std({ color: 0x3b4652, roughness: 0.85, metalness: 0.05 }) : std({ color: 0x9a5d79, roughness: 0.85, metalness: 0.05 });

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const head = new THREE.Group();

  const phase = seed * 10.31;

  // Body.
  if (kind === 'suit') {
    addBox(body, 0.5, 0.98, 0.26, cloth, 0, 0.58, 0);
    addBox(body, 0.44, 0.08, 0.26, std({ color: 0x2a3440, roughness: 0.6, metalness: 0.02 }), 0, 0.68, 0.13);
  } else {
    // Dress.
    addBox(body, 0.46, 0.92, 0.3, cloth, 0, 0.54, 0);
    addBox(body, 0.3, 0.05, 0.3, std({ color: 0x6c3451, roughness: 0.6, metalness: 0.02 }), 0, 0.64, 0.15);
    // Skirt flare.
    addBox(body, 0.55, 0.25, 0.32, std({ color: 0xb57a9a, roughness: 0.88, metalness: 0.02 }), 0, 0.3, 0);
  }

  // Legs pivot at hips.
  legL.position.set(0.14, HIP_HEIGHT, 0);
  legR.position.set(-0.14, HIP_HEIGHT, 0);
  body.add(legL);
  body.add(legR);

  const shoeCol = std({ color: 0x1b1b1b, roughness: 0.9, metalness: 0 });
  for (const [leg, xz] of [
    [legL, 0.02],
    [legR, -0.02],
  ] as const) {
    addBox(leg, 0.14, 0.55, 0.14, cloth, 0, -0.18, xz);
    addBox(leg, 0.16, 0.08, 0.3, shoeCol, 0, -0.44, xz + 0.02);
  }

  // Arms.
  const shoulderY = 1.13;
  armL.position.set(0.28, shoulderY, 0);
  armR.position.set(-0.28, shoulderY, 0);
  body.add(armL);
  body.add(armR);

  const sleeveCol = kind === 'suit' ? cloth : std({ color: 0x8e4a6c, roughness: 0.9, metalness: 0.02 });
  for (const arm of [armL, armR]) {
    addBox(arm, 0.1, 0.52, 0.1, sleeveCol, 0, 0.0, 0.04);
    addSphere(arm, 0.07, 8, 6, skin, 0, 0.34, 0.06);
  }

  // Head & hat.
  head.position.set(0, 1.42, 0.02);
  body.add(head);
  addSphere(head, 0.12, 8, 7, skin, 0, 0, 0);
  // Hat / hair.
  if (kind === 'suit') {
    const hat = addCylinder(head, 0.07, 0.08, 0.18, 8, std({ color: 0x2e2f35, roughness: 0.7, metalness: 0.05 }), 0, 0.12, 0);
    const brim = addBox(head, 0.18, 0.05, 0.12, std({ color: 0x26262b, roughness: 0.75, metalness: 0.05 }), 0, 0.07, 0);
    void brim;
    head.userData.hat = hat;
  } else {
    const hair = addSphere(head, 0.13, 8, 7, std({ color: 0x2e1f1e, roughness: 0.6, metalness: 0.05 }), 0, 0.05, 0);
    hair.scale.set(1, 0.55, 1);
  }

  // Subtle umbrella-like accessory for variety.
  if (seed % 2 === 0) {
    const bag = addBox(body, 0.12, 0.22, 0.08, std({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.0 }), 0.2, 0.45, -0.1);
    bag.rotation.z = 0.3;
  }

  const runtime: WalkerRuntime = {
    group: g,
    dir: new THREE.Vector3(0, 0, dirZ),
    speed,
    phase,
    seed,
    curY: SIDEWALK_Y,
    parts: {
      body,
      legL,
      legR,
      armL,
      armR,
      head,
      hat: kind === 'suit' ? head.userData.hat : undefined,
    },
    moving,
  };

  root.add(g);
  return runtime;
}

function buildMarqueeAndPole(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  state: Era1945State,
): void {
  // Barbershop pole.
  const pole = buildBarbershopPole(root, mats, -9.3, 10.0);
  state.barbers.push(pole);

  // Cinema marquee.
  const marquee = buildCinema(root, mats, 9.2, -20.0);
  state.marquees.push(marquee);
}

function buildStreetFurniture(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  state: Era1945State,
): void {
  // Gas streetlamps.
  for (const [i, side] of [
    [0, -1],
    [1, 1],
    [2, -1],
    [3, 1],
  ] as const) {
    const x = side * 9.6;
    const z = -24 + i * 16.0;

    const g = new THREE.Group();
    g.position.set(x, SIDEWALK_Y, z);

    addCylinder(g, 0.07, 0.08, 3.9, 10, mats.darkMetal, 0, 2.0, 0);

    const lampArm = new THREE.Group();
    lampArm.position.set(0, 3.05, 0);
    addCylinder(lampArm, 0.03, 0.04, 0.75, 8, mats.darkMetal, 0.24, 0.0, 0);

    const lampHead = new THREE.Group();
    lampHead.position.set(0.26, 0.05, 0);
    addBox(lampHead, 0.18, 0.1, 0.18, mats.darkMetal, 0, 0, 0);
    const glassMat = mats.streetLampGlass;
    const glass = addSphere(lampHead, 0.13, 10, 8, glassMat, 0.0, 0.0, 0);
    glass.scale.set(1.05, 0.9, 1.05);
    lampArm.add(lampHead);

    g.add(lampArm);

    // Add a small poster on the pole base.
    const posterMat = makeCanvasMaterial(
      { lines: ['NEED', 'CLOTHES'], sub: 'DONATE TODAY', bg: 0x1e2a44, fg: 0xeaf3ff, accent: 0x93c5ff, square: false, stripes: true },
      0xeaf3ff,
    );
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), posterMat);
    paper.position.set(0.0, 0.9, 0.21);
    paper.rotation.y = Math.PI / 2;
    g.add(paper);

    root.add(g);
    state.lamps.push({ lightMat: glassMat, flickerSeed: i * 1.7 + (side === 1 ? 3.2 : 0.6) });
  }

  // Basic bench / hydrant-ish prop.
  const bench = new THREE.Group();
  bench.position.set(0, SIDEWALK_Y, 18.5);
  addBox(bench, 1.8, 0.08, 0.55, mats.woodDark, 0, 0.2, 0);
  addBox(bench, 1.8, 0.18, 0.08, mats.wood, 0, 0.62, -0.24);
  addCylinder(bench, 0.04, 0.04, 0.5, 8, mats.darkMetal, -0.7, 0.45, 0.22);
  addCylinder(bench, 0.04, 0.04, 0.5, 8, mats.darkMetal, 0.7, 0.45, 0.22);
  root.add(bench);
}

/**
 * Build entire era group.
 *
 * Returns a THREE.Group containing all 6 content layers:
 * - buildings/storefronts
 * - ads/signage
 * - vehicles
 * - pedestrians
 * - marquee poster signage
 * - street furniture
 */
export function buildEra1945(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'era-1945';

  const rng = mulberry32(19450022);
  const mats = createMaterials();

  const state: Era1945State = {
    elapsed: 0,
    vehicles: [],
    walkers: [],
    barbers: [],
    marquees: [],
    lamps: [],
  };

  // Layer 6: streets and street-level geometry.
  buildStreets(root, mats);

  // Layer 1: buildings — 2–3 story brick/wood tenements + corner grocery + cinema.
  // Avenue side blocks.
  buildBrickTenement(root, mats, -9.8, 19.5, 1, 3, 7.2);
  buildBrickTenement(root, mats, -9.8, -22.0, 1, 2, 6.4);
  buildBrickTenement(root, mats, 9.8, -1.5, -1, 3, 7.4);

  // Corner grocery.
  buildCornerGrocery(root, mats, 0.0, 8.0);

  // Background brick rowhouses.
  for (let i = 0; i < 4; i++) {
    const z = -30 + i * 20;
    const x = i % 2 === 0 ? -16.2 : 16.2;
    buildBrickTenement(root, mats, x, z, i % 2 === 0 ? 1 : -1, (i % 3 === 0 ? 3 : 2) as 2 | 3, 6.0);
  }

  // Layer 5: wall ads/posters.
  buildWallAds(root, mats, -2.2, 1.0, 1);
  buildWallAds(root, mats, 6.0, -18.0, -1);

  // Layer 2 + 5: hand-painted and marquee signage.
  buildMarqueeAndPole(root, mats, state);

  // Layer 3: vehicles.
  buildVehicles(root, mats, state);

  // Layer 4: pedestrians.
  const walkerSeeds = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < walkerSeeds.length; i++) {
    const seed = walkerSeeds[i];
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const x = (i % 4 < 2 ? 7.8 : -7.8) + (i % 2 === 0 ? 0.25 : -0.25);
    const z = (i - 3.5) * 6.2 + (rng() - 0.5) * 2.8;
    const moving = i % 3 !== 0;
    const kind: 'suit' | 'dress' = i % 2 === 0 ? 'suit' : 'dress';
    const speed = 0.85 + rng() * 0.7;
    const runtime = buildWalker(root, mats, x, z, dirZ, moving, kind, seed, speed);
    state.walkers.push(runtime);
  }

  // Add a few static idle pedestrians in the storefront area.
  for (let i = 0; i < 3; i++) {
    const seed = 20 + i;
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const runtime = buildWalker(
      root,
      mats,
      i === 0 ? -4.8 : i === 1 ? 0.6 : 4.6,
      i === 0 ? 6.8 : i === 1 ? -2.5 : 12.5,
      dirZ,
      false,
      i % 2 === 0 ? 'suit' : 'dress',
      seed,
      0.4,
    );
    state.walkers.push(runtime);
  }

  // Layer 6: gas lamps and street furniture.
  buildStreetFurniture(root, mats, state);

  root.userData.era1945 = state;
  return root;
}

/**
 * Update tick.
 */
export function update(dt: number, group: THREE.Group): void {
  const state = group.userData.era1945 as Era1945State | undefined;
  if (!state) return;

  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
  if (step <= 0) return;

  state.elapsed += step;
  const t = state.elapsed;

  // Vehicles motion.
  for (const v of state.vehicles) {
    v.group.position.z += v.dirZ * v.speed * step;

    if (v.group.position.z > CAR_WRAP_Z) v.group.position.z -= CAR_WRAP_Z * 2;
    if (v.group.position.z < -CAR_WRAP_Z) v.group.position.z += CAR_WRAP_Z * 2;

    // Wheel spin.
    const spin = (t * v.speed) / 0.36;
    for (const wheel of v.wheelSpinners) {
      wheel.rotation.x = spin * v.dirZ;
      wheel.rotation.z = Math.sin(t * 1.2 + v.wobbleSeed) * 0.02;
    }

    // Mild suspension wobble.
    const wobble = Math.sin(t * 2.1 + v.wobbleSeed) * 0.02;
    v.group.position.y = wobble;
  }

  // Pedestrians gait/idle cycles.
  for (const w of state.walkers) {
    if (w.moving) {
      w.phase += w.speed * step * 3.2;
      w.group.position.z += w.dir.z * w.speed * step * 1.4;
      if (w.group.position.z > WALKER_WRAP_Z) w.group.position.z -= WALKER_WRAP_Z * 2;
      if (w.group.position.z < -WALKER_WRAP_Z) w.group.position.z += WALKER_WRAP_Z * 2;

      const sideBob = Math.abs(Math.sin(w.phase)) * 0.07;
      const targetY = w.group.position.z > 14 || w.group.position.z < -14 ? SIDEWALK_Y - 0.02 : SIDEWALK_Y + sideBob;
      w.curY += (targetY - w.curY) * Math.min(step * 7, 1);
      w.group.position.y = w.curY;

      const swing = Math.sin(w.phase) * 0.55;
      w.parts.legL['rotation'].x = swing;
      w.parts.legR['rotation'].x = -swing;
      w.parts.armL['rotation'].x = -swing * 0.62;
      w.parts.armR['rotation'].x = swing * 0.62;

      // Body lean.
      w.parts.body.position.y = 0.01 + Math.abs(Math.cos(w.phase * 0.5)) * 0.02;
      w.parts.body['rotation'].y = Math.sin(w.phase * 0.25 + w.seed) * 0.05;
      w.parts.head['rotation'].y = Math.sin(t * 0.7 + w.seed) * 0.15;
    } else {
      // Idle: subtle sway and head turns.
      w.group.position.y += Math.sin(t * 0.9 + w.seed) * 0.0015;
      w.parts.body['rotation'].y = Math.sin(t * 0.45 + w.seed) * 0.12;
      w.parts.armL['rotation'].x = Math.sin(t * 0.55 + w.seed) * 0.05;
      w.parts.armR['rotation'].x = -Math.sin(t * 0.55 + w.seed) * 0.05;
      w.parts.legL['rotation'].x = 0;
      w.parts.legR['rotation'].x = 0;
      w.parts.head['rotation'].y = Math.sin(t * 0.7 + w.seed * 2) * 0.3;
    }
  }

  // Barbershop pole stripe rotation.
  for (const b of state.barbers) {
    b.pole.rotation.y += step * 1.9;
  }

  // Marquee bulbs animation.
  for (const m of state.marquees) {
    for (let i = 0; i < m.materials.length; i++) {
      const mat = m.materials[i];
      const phase = (i / m.materials.length) * Math.PI * 2;
      const flicker = 0.55 + 0.45 * Math.sin(t * m.rate + phase + m.seed);
      mat.emissiveIntensity = 0.55 + 1.25 * Math.max(0, flicker);
    }
  }

  // Gas lamp flicker.
  for (const lamp of state.lamps) {
    const flick = 0.78 + 0.22 * Math.sin(t * 6.5 + lamp.flickerSeed) + 0.08 * Math.sin(t * 13.1 + lamp.flickerSeed * 2.2);
    lamp.lightMat.emissiveIntensity = 0.25 + 0.55 * Math.max(0, flick);
  }
}

/**
 * Type-compatibility shim for the era-manifest contract.
 *
 * The manifest currently types the build factory name as `buildEra1965`.
 * We export it here as an alias so the 1945 module can be registered
 * without needing a contract-breaking change.
 */
export function buildEra1965(): THREE.Group {
  return buildEra1945();
}
