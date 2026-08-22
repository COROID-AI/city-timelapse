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
const CAR_LANE_X = 3.25;
const CAR_WRAP_Z = 46;
const WALKER_WRAP_Z = 24;

const HIP_HEIGHT = 0.78;

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
  spinner: THREE.Object3D;
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

  // Cobblestone gutters flanking the asphalt.
  const cobEdge = new THREE.Mesh(new THREE.PlaneGeometry(1.0, ROAD_LENGTH_Z), mats.cobble);
  cobEdge.rotation.x = -Math.PI / 2;
  cobEdge.position.y = 0.021;
  cobEdge.position.x = AVE_HALF_WIDTH_X - 0.08;
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

  // Sidewalk curb lines at the roadway edge.
  for (const sx of [1, -1] as const) {
    addBox(parent, 0.5, CURB_HEIGHT, ROAD_LENGTH_Z, mats.concrete, sx * (AVE_HALF_WIDTH_X - 0.35), CURB_HEIGHT / 2, 0);
  }

  // Walkway slabs beyond the gutter.
  for (const sx of [1, -1] as const) {
    addBox(
      parent,
      16.8,
      SIDEWALK_Y,
      72,
      mats.concrete,
      sx * 15.5,
      SIDEWALK_Y / 2,
      0,
    );
  }

  // Lane divider: sparse dashed.
  for (let i = 0; i < 10; i++) {
    const z = -34 + i * 7.0;
    addBox(parent, 0.12, 0.012, 3.4, mats.lineYellow, 0, 0.032, z);
  }

  // Crosswalks: zebra bars repeated across the full roadway width.
  for (const z0 of [-18, 0, 18]) {
    for (let i = 0; i < 10; i++) {
      addBox(parent, 0.55, 0.012, 2.4, mats.lineWhite, -4.95 + i * 1.1, 0.032, z0);
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
      addBox(g, 0.62, 0.1, 0.16, mats.brickDark, px, fy - 0.55, facadeDepth * 0.52);
      addBox(g, 0.62, 0.1, 0.16, mats.brickDark, px, fy + 0.55, facadeDepth * 0.52);
    }
  }

  // Fire escape if 3 stories.
  if (stories === 3) {
    const fx = width / 2 - 0.9;
    const fz = facadeDepth * 0.5 + 0.45; // landings hang just off the street facade
    for (let level = 0; level < 2; level++) {
      const plateY = STORY_HEIGHT * (level + 1) + 0.22;
      addBox(g, 1.2, 0.06, 1.0, mats.metal, fx, plateY, fz - 0.5);
      // Guard rails around the outer and side edges.
      addBox(g, 1.2, 0.04, 0.05, mats.darkMetal, fx, plateY + 0.5, fz);
      addBox(g, 0.05, 0.5, 1.0, mats.darkMetal, fx + 0.58, plateY + 0.25, fz - 0.5);
      // Drop ladder between landings.
      addBox(g, 0.05, STORY_HEIGHT, 0.07, mats.galvanized, fx - 0.45, plateY - STORY_HEIGHT / 2, fz - 0.25);
      addBox(g, 0.05, STORY_HEIGHT, 0.07, mats.galvanized, fx - 0.85, plateY - STORY_HEIGHT / 2, fz - 0.25);
      for (let rung = 0; rung < 6; rung++) {
        addBox(g, 0.44, 0.05, 0.05, mats.galvanized, fx - 0.65, plateY - 0.32 - rung * 0.46, fz - 0.25);
      }
    }
  }

  root.add(g);

  // Sidewalk entry door.
  const doorW = 0.85;
  const doorH = 2.25;
  const door = new THREE.Group();
  door.position.set(x + side * (facadeDepth / 2 + 0.12), 0, z + 2.0);
  door.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
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
  wallX: number,
  z: number,
  dirX: Dir,
): void {
  // Hand-painted wall ads: CanvasTexture planes mounted on wooden
  // backboards, hung flush on a facade that faces the street.
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
  holder.position.set(wallX, 0, z);
  holder.rotation.y = dirX === 1 ? Math.PI / 2 : -Math.PI / 2;

  const mountZ = 0.12; // just off the brick face
  const board = (w: number, h: number, bx: number, by: number, art: THREE.Material): void => {
    addBox(holder, w + 0.18, h + 0.18, 0.06, mats.woodDark, bx, by, mountZ - 0.05);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), art);
    plane.position.set(bx, by, mountZ);
    holder.add(plane);
  };

  // Two war-effort/rationing posters up high, one grocery ad below.
  board(2.0, 2.8, 1.2, 3.4, art1);
  board(2.0, 2.8, -1.2, 3.4, art2);
  board(2.0, 1.6, 0.0, 1.7, art3);

  root.add(holder);
}

function buildCornerGrocery(
  root: THREE.Object3D,
  mats: ReturnType<typeof createMaterials>,
  x: number,
  z: number,
  rotY: number,
): void {
  // Two facades (approximated) via a corner block and one sign.
  const width = 6.8;
  const height = STORY_HEIGHT * 2 + 0.6;
  const depth = 5.6;

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

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

  // Canvas awning shading the display windows, cantilevered past the facade.
  const awning = new THREE.Group();
  awning.position.set(0, STORY_HEIGHT * 0.78, depth * 0.5 + 1.05);
  addBox(awning, width * 0.62, 0.08, 2.1, mats.woodDark, 0, 0, -1.05);
  addBox(awning, width * 0.62, 0.05, 0.12, mats.signRed, 0, -0.05, 0);
  g.add(awning);

  // Fire escape ladder from side.
  const esc = new THREE.Group();
  esc.position.set(width * 0.33, 0, depth * 0.5 + 0.3);
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

  // Pole base and stem.
  addCylinder(poleGroup, 0.11, 0.13, 0.2, 8, mats.darkMetal, 0, 0.1, 0);
  addCylinder(poleGroup, 0.05, 0.05, 3.2, 10, mats.metal, 0, 1.6, 0);

  const stripeRed = std({ color: 0xb43a3a, roughness: 0.4, metalness: 0.1, emissive: 0x000000 });
  const stripeWhite = std({ color: 0xf2f2ea, roughness: 0.5, metalness: 0.05 });

  // Classic red/white barber rings on their own spinner so the wall sign
  // stays fixed while the stripes rotate inside a glass sleeve.
  const spinner = new THREE.Group();
  spinner.position.y = 0.35;
  const segs = 20;
  const segH = 2.7 / segs;
  for (let i = 0; i < segs; i++) {
    const mat = i % 2 === 0 ? stripeRed : stripeWhite;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, segH, 10), mat);
    ring.position.set(Math.sin(i * 0.9) * 0.02, (i + 0.5) * segH, Math.cos(i * 0.9) * 0.02);
    spinner.add(ring);
  }
  poleGroup.add(spinner);

  // Glass sleeve and brass caps.
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 2.78, 12, 1, true),
    std({ color: 0xdfe8ee, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.25 }),
  );
  sleeve.position.y = 1.7;
  poleGroup.add(sleeve);
  addSphere(poleGroup, 0.13, 10, 8, mats.streetLampGold, 0, 3.18, 0);
  addSphere(poleGroup, 0.13, 10, 8, mats.streetLampGold, 0, 0.32, 0);

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
  return { pole: poleGroup, spinner };
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

  addBox(g, w, h, d, mats.brickDark, 0, h / 2, 0);
  // Roof cornice.
  addBox(g, w + 0.35, 0.28, d + 0.35, mats.woodDark, 0, h + 0.1, 0);

  // Entrance doors plus a projecting ticket booth, flush with the facade.
  const doorZ = d * 0.5 + 0.03;
  addBox(g, 2.2, 2.4, 0.14, mats.darkMetal, -1.7, 1.2, doorZ);
  addBox(g, 1.7, 0.07, 0.1, mats.metal, -1.7, 1.32, doorZ + 0.07);
  const glassL = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.05), mats.windowGlass);
  glassL.position.set(-2.08, 1.52, doorZ + 0.08);
  g.add(glassL);
  const glassR = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.05), mats.windowGlass);
  glassR.position.set(-1.32, 1.52, doorZ + 0.08);
  g.add(glassR);
  addBox(g, 1.0, 2.05, 0.85, mats.paintCream, 0.75, 1.03, doorZ + 0.4);
  addBox(g, 0.82, 0.66, 0.06, mats.windowGlass, 0.75, 1.32, doorZ + 0.84);
  addBox(g, 1.06, 0.12, 0.95, mats.woodDark, 0.75, 2.1, doorZ + 0.4);

  // Marquee frame.
  const marqueeFrame = new THREE.Group();
  marqueeFrame.position.set(0, h - 1.1, d * 0.51);
  addBox(marqueeFrame, 4.9, 1.1, 0.06, mats.darkMetal, 0, 0, 0.02);
  addBox(marqueeFrame, 4.7, 0.06, 0.06, mats.marqueeTube, 0, -0.3, 0.02);
  addBox(marqueeFrame, 4.7, 0.06, 0.06, mats.marqueeTube, 0, 0.3, 0.02);

  // Support rods tying the marquee back to the facade.
  addBox(g, 0.09, 0.09, 0.55, mats.darkMetal, -2.35, h - 1.55, d * 0.5 + 0.22);
  addBox(g, 0.09, 0.09, 0.55, mats.darkMetal, 2.35, h - 1.55, d * 0.5 + 0.22);

  const bulbMats: THREE.MeshStandardMaterial[] = [];
  const bulbColor = 0xffdca0;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const px = -2.35 + t * 4.7;
    const bulbMat = std({ color: bulbColor, emissive: 0xffc86a, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.0 });
    bulbMats.push(bulbMat);
    const bulb = addSphere(marqueeFrame, 0.09, 8, 6, bulbMat, px, 0, 0.07);
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
  artPlane.position.set(0, h - 1.25, d * 0.51 + 0.06);
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
    // Chassis runs along the travel axis (z); hood faces local -z.
    addBox(g, 2.35, 0.62, 5.2, paintMat, 0, 0.82, 0);
    // Signature 1940s running boards outboard of the body.
    addBox(g, 0.55, 0.09, 4.4, mats.darkMetal, 1.32, 0.47, 0);
    addBox(g, 0.55, 0.09, 4.4, mats.darkMetal, -1.32, 0.47, 0);
    // Cabin with glasshouse band.
    addBox(g, 2.05, 0.68, 2.0, paintMat, 0, 1.45, -0.25);
    addBox(g, 1.9, 0.38, 1.72, mats.windowGlass, 0, 1.47, -0.25);
    // Trunk deck and stepped hood.
    addBox(g, 2.2, 0.52, 1.6, paintMat, 0, 1.12, 1.75);
    addBox(g, 2.15, 0.5, 1.7, paintMat, 0, 1.1, -1.7);
    // Fenders arching over the wheels.
    addBox(g, 2.5, 0.16, 5.0, paintMat, 0, 0.82, 0);

    // Chrome grille and drum headlamps at the front.
    addBox(g, 1.3, 0.55, 0.12, mats.galvanized, 0, 0.92, -2.6);
    addSphere(g, 0.11, 8, 6, mats.headlight, 0.8, 1.02, -2.56);
    addSphere(g, 0.11, 8, 6, mats.headlight, -0.8, 1.02, -2.56);
    addBox(g, 0.32, 0.16, 0.1, mats.tailLight, 0.74, 1.0, 2.56);
    addBox(g, 0.32, 0.16, 0.1, mats.tailLight, -0.74, 1.0, 2.56);

    // Whitewall wheels ride at axle height.
    const spinners: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * 1.18, wheelRadius, cz * 1.7);
        wheel.add(new THREE.Mesh(tireGeo, mats.rubber));
        wheel.add(new THREE.Mesh(hubGeo, mats.metal));
        g.add(wheel);
        spinners.push(wheel);
      }
    }

    // Yaw so the hood leads the direction of travel.
    g.rotation.y = dirZ === 1 ? Math.PI : 0;
    g.position.set(xLane, 0, zStart);

    root.add(g);
    state.vehicles.push({ group: g, dirZ, speed, wheelSpinners: spinners, wobbleSeed });
  }

  function buildTrolley(paintMat: THREE.MeshStandardMaterial, xLane: number, zStart: number, dirZ: Dir, speed: number, wobbleSeed: number): void {
    const g = new THREE.Group();
    // Body runs along the travel axis (z); destination board faces local -z.
    addBox(g, 2.5, 1.2, 7.6, paintMat, 0, 1.02, 0);
    addBox(g, 2.34, 0.34, 7.0, paintMat, 0, 2.02, 0); // clerestory roof
    // Side running boards.
    addBox(g, 0.5, 0.08, 6.6, mats.darkMetal, 1.44, 0.44, 0);
    addBox(g, 0.5, 0.08, 6.6, mats.darkMetal, -1.44, 0.44, 0);

    // Window band on both sides plus end windows.
    const winMat = mats.windowGlass;
    for (const i of [-1, 0, 1]) {
      addBox(g, 0.08, 0.55, 1.3, winMat, 1.26, 1.5, i * 2.2);
      addBox(g, 0.08, 0.55, 1.3, winMat, -1.26, 1.5, i * 2.2);
    }
    addBox(g, 1.7, 0.55, 0.08, winMat, 0, 1.5, -3.81);
    addBox(g, 1.7, 0.55, 0.08, winMat, 0, 1.5, 3.81);

    // Lit destination sign over the windshield.
    addBox(g, 1.5, 0.34, 0.06, mats.darkMetal, 0, 2.12, -3.79);
    addBox(g, 1.34, 0.22, 0.05, mats.interiorGlow, 0, 2.12, -3.83);

    // Wheels at axle height.
    const spinners: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * 1.06, wheelRadius, cz * 2.6);
        wheel.add(new THREE.Mesh(tireGeo, mats.rubber));
        wheel.add(new THREE.Mesh(hubGeo, mats.metal));
        g.add(wheel);
        spinners.push(wheel);
      }
    }

    // Rear trolley pole with contact wheel.
    const pan = new THREE.Group();
    pan.position.set(0, 2.2, 3.4);
    pan.rotation.x = 0.55;
    addCylinder(pan, 0.03, 0.045, 2.1, 6, mats.darkMetal, 0, 1.0, 0);
    const contact = addCylinder(pan, 0.09, 0.09, 0.08, 10, mats.metal, 0, 2.02, 0);
    contact.rotation.z = Math.PI / 2;
    g.add(pan);

    // Bumpers front and rear.
    addBox(g, 2.0, 0.16, 0.25, mats.metal, 0, 0.55, 3.92);
    addBox(g, 2.0, 0.16, 0.25, mats.metal, 0, 0.55, -3.92);

    // Yaw so the destination board leads the direction of travel.
    g.rotation.y = dirZ === 1 ? Math.PI : 0;
    g.position.set(xLane, 0, zStart);
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
  _mats: ReturnType<typeof createMaterials>,
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
    addBox(leg, 0.14, 0.68, 0.14, cloth, 0, -0.36, xz);
    addBox(leg, 0.15, 0.09, 0.28, shoeCol, 0, -0.73, xz + 0.04);
  }

  // Arms.
  const shoulderY = 1.13;
  armL.position.set(0.28, shoulderY, 0);
  armR.position.set(-0.28, shoulderY, 0);
  body.add(armL);
  body.add(armR);

  const sleeveCol = kind === 'suit' ? cloth : std({ color: 0x8e4a6c, roughness: 0.9, metalness: 0.02 });
  for (const arm of [armL, armR]) {
    addBox(arm, 0.1, 0.5, 0.1, sleeveCol, 0, -0.25, 0.04);
    addSphere(arm, 0.07, 8, 6, skin, 0, -0.52, 0.05);
  }

  // Head & hat.
  head.position.set(0, 1.42, 0.02);
  body.add(head);
  addSphere(head, 0.12, 8, 7, skin, 0, 0, 0);
  // Hat / hair.
  if (kind === 'suit') {
    // Fedora: crown plus full brim.
    addCylinder(head, 0.115, 0.125, 0.15, 8, std({ color: 0x2e2f35, roughness: 0.7, metalness: 0.05 }), 0, 0.2, 0);
    addCylinder(head, 0.21, 0.21, 0.03, 10, std({ color: 0x26262b, roughness: 0.75, metalness: 0.05 }), 0, 0.135, 0);
  } else {
    const hair = addSphere(head, 0.13, 8, 7, std({ color: 0x2e1f1e, roughness: 0.6, metalness: 0.05 }), 0, 0.05, 0);
    hair.scale.set(1, 0.55, 1);
  }

  // Subtle umbrella-like accessory for variety.
  if (seed % 2 === 0) {
    addBox(body, 0.26, 0.2, 0.08, std({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.0 }), 0.32, 0.58, 0);
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
  const marquee = buildCinema(root, mats, 11.0, -20.0);
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
    const x = side * 7.3;
    const z = -24 + i * 16.0;

    const g = new THREE.Group();
    g.position.set(x, SIDEWALK_Y, z);
    g.rotation.y = side === 1 ? Math.PI : 0;

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

  // Slatted wooden benches facing the street.
  for (const sx of [1, -1] as const) {
    const bench = new THREE.Group();
    bench.position.set(sx * 8.0, SIDEWALK_Y, sx === 1 ? 18.5 : -14.0);
    bench.rotation.y = sx === 1 ? -Math.PI / 2 : Math.PI / 2;
    addBox(bench, 1.8, 0.08, 0.55, mats.woodDark, 0, 0.42, 0);
    addBox(bench, 1.8, 0.5, 0.08, mats.wood, 0, 0.64, -0.26);
    addCylinder(bench, 0.04, 0.05, 0.42, 8, mats.darkMetal, -0.7, 0.21, 0.18);
    addCylinder(bench, 0.04, 0.05, 0.42, 8, mats.darkMetal, 0.7, 0.21, 0.18);
    root.add(bench);
  }

  // Cast-iron hydrant near the grocery corner.
  const hydrant = new THREE.Group();
  hydrant.position.set(7.6, SIDEWALK_Y, 9.4);
  addCylinder(hydrant, 0.24, 0.26, 0.08, 10, mats.darkMetal, 0, 0.04, 0);
  addCylinder(hydrant, 0.15, 0.19, 0.55, 10, mats.signRed, 0, 0.33, 0);
  addSphere(hydrant, 0.16, 10, 8, mats.signRed, 0, 0.62, 0);
  addCylinder(hydrant, 0.05, 0.05, 0.46, 8, mats.signRed, 0, 0.66, 0).rotation.z = Math.PI / 2;
  addSphere(hydrant, 0.07, 8, 6, mats.streetLampGold, 0, 0.76, 0);
  root.add(hydrant);
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
  buildBrickTenement(root, mats, -10.8, 19.5, 1, 3, 7.2);
  buildBrickTenement(root, mats, -10.8, -22.0, 1, 2, 6.4);
  buildBrickTenement(root, mats, 10.8, -1.5, -1, 3, 7.4);

  // Corner grocery anchoring the east retail corner.
  buildCornerGrocery(root, mats, 10.9, 14.0, -Math.PI / 2);

  // Background brick rowhouses.
  for (let i = 0; i < 4; i++) {
    const z = -30 + i * 20;
    const x = i % 2 === 0 ? -16.2 : 16.2;
    buildBrickTenement(root, mats, x, z, i % 2 === 0 ? 1 : -1, (i % 3 === 0 ? 3 : 2) as 2 | 3, 6.0);
  }

  // Layer 5: wall ads/posters.
  buildWallAds(root, mats, -8.0, 19.5, 1);
  buildWallAds(root, mats, 8.0, -1.5, -1);

  // Layer 2 + 5: hand-painted and marquee signage.
  buildMarqueeAndPole(root, mats, state);

  // Layer 3: vehicles.
  buildVehicles(root, mats, state);

  // Layer 4: pedestrians.
  const walkerSeeds = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < walkerSeeds.length; i++) {
    const seed = walkerSeeds[i];
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const x = (i % 4 < 2 ? 7.45 : -7.45) + (i % 2 === 0 ? 0.22 : -0.22);
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
      i === 0 ? -7.6 : i === 1 ? 7.5 : -7.5,
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
    b.spinner.rotation.y += step * 2.2;
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
