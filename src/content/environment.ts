/**
 * Era-specific environment & atmosphere for the City Time Period Timelapse.
 *
 * Registers the `sky`, `lighting`, and `ground` slices of a fully-typed
 * {@link EraConfig} for every canonical era year (1945, 1965, 1985, 2005,
 * 2025) through the foundation era registry, merging alongside the sibling
 * content modules (buildings, vehicles, storefronts, pedestrians).
 *
 * Each era gets a distinct atmosphere:
 *  - 1945: warm sepia-tinted daylight, cobblestone/dirt roads, period street
 *    lamps and telephone poles
 *  - 1965: clear bright daylight, asphalt roads, mid-century street lamps and
 *    traffic signals
 *  - 1985: smoggy/hazy golden light, cracked asphalt, neon street furniture
 *    and payphones
 *  - 2005: clean modern daylight, smooth asphalt, modern LED street lamps and
 *    traffic signals
 *  - 2025: crisp light with a smart-city blue tinge, permeable pavement, EV
 *    charge stations, smart street lamps, and drone-flight markers
 *
 * All geometry is built from primitives and all textures are generated on
 * canvas (see ./textures.ts) — no external asset files.
 *
 * The downstream era-transition engine consumes {@link buildEraEnvironment} to
 * add/remove the era's atmosphere and {@link disposeEnvironment} for teardown.
 */
import * as THREE from 'three';
import { eraRegistry, type EraConfig, type EraYear } from '../eras';
import { assetRegistry } from '../core/assetRegistry';
import { PRNG } from '../core/prng';
import {
  makeAsphaltTexture,
  makeCobblestoneTexture,
  makePermeablePavementTexture,
  makeSidewalkTexture,
  makeSkyGradientTexture,
} from './textures';

// ---------------------------------------------------------------------------
// Texture cache (created lazily so the module can be imported headlessly).
// ---------------------------------------------------------------------------

interface EnvTextures {
  cobblestone: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  crackedAsphalt: THREE.CanvasTexture;
  permeable: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
}

let textures: EnvTextures | null = null;

function ensureTextures(): EnvTextures {
  if (textures) {
    return textures;
  }
  textures = {
    cobblestone: makeCobblestoneTexture(),
    asphalt: makeAsphaltTexture(),
    crackedAsphalt: makeAsphaltTexture({ cracked: true }),
    permeable: makePermeablePavementTexture(),
    sidewalk: makeSidewalkTexture(),
  };
  // Register generated textures in the shared asset registry so other
  // consumers can resolve them by key.
  assetRegistry.registerTexture('cobblestone', textures.cobblestone);
  assetRegistry.registerTexture('asphalt', textures.asphalt);
  assetRegistry.registerTexture('asphalt-cracked', textures.crackedAsphalt);
  assetRegistry.registerTexture('permeable-pavement', textures.permeable);
  assetRegistry.registerTexture('sidewalk', textures.sidewalk);
  return textures;
}

// ---------------------------------------------------------------------------
// Small geometry/material helpers
// ---------------------------------------------------------------------------

function solid(
  color: number,
  opts: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.6,
    metalness: opts.metalness ?? 0.15,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

function texMat(texture: THREE.Texture, repeat: [number, number], roughness = 0.9): THREE.MeshStandardMaterial {
  const t = texture.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(repeat[0], repeat[1]);
  return new THREE.MeshStandardMaterial({ map: t, roughness, metalness: 0 });
}

// ---------------------------------------------------------------------------
// Sky & lighting
// ---------------------------------------------------------------------------

function buildSky(sky: EraConfig['sky']): THREE.Mesh {
  const tex = makeSkyGradientTexture(sky.topColor, sky.bottomColor);
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), material);
  mesh.name = 'sky-dome';
  mesh.renderOrder = -1;
  return mesh;
}

function buildLighting(lighting: EraConfig['lighting'], sky: EraConfig['sky']): THREE.Group {
  const group = new THREE.Group();
  group.name = 'environment-lights';

  // Ambient fill (kept for consistent base illumination with the era config).
  const ambient = new THREE.AmbientLight(0xffffff, lighting.ambientIntensity);
  group.add(ambient);

  // Hemisphere fill: a soft sky/ground gradient that lifts shadows and gives
  // the scene a more natural, high-end ambient bounce without washing it out.
  const hemi = new THREE.HemisphereLight(
    lighting.sunColor,
    0x3a3f4a,
    lighting.ambientIntensity * 0.55,
  );
  group.add(hemi);

  const sun = new THREE.DirectionalLight(lighting.sunColor, lighting.sunIntensity);
  sun.position.set(sky.sunDirection[0], sky.sunDirection[1], sky.sunDirection[2]);
  sun.castShadow = true;
  // High-res shadow map + PCFShadowMap (set on the renderer) for soft,
  // high-quality shadows. Bias/normalBias avoid shadow acne on facades.
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 600;
  const d = 70;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = Math.round(lighting.shadowSoftness * 8);
  group.add(sun);

  return group;
}

// ---------------------------------------------------------------------------
// Ground: base plane + sidewalk ring + road ring around the city block
// ---------------------------------------------------------------------------

/** Add a rectangular ring of 4 flat planes from innerHalf to outerHalf. */
function addRing(
  group: THREE.Group,
  outerHalf: number,
  innerHalf: number,
  y: number,
  material: THREE.Material,
): void {
  const depth = outerHalf - innerHalf;
  const len = outerHalf * 2;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), material);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, y, innerHalf + depth / 2);
  top.receiveShadow = true;

  const bottom = top.clone();
  bottom.position.z = -(innerHalf + depth / 2);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, len), material);
  left.rotation.x = -Math.PI / 2;
  left.position.set(-(innerHalf + depth / 2), y, 0);
  left.receiveShadow = true;

  const right = left.clone();
  right.position.x = innerHalf + depth / 2;

  group.add(top, bottom, left, right);
}

function buildGround(ground: EraConfig['ground']): THREE.Group {
  const group = new THREE.Group();
  group.name = 'environment-ground';
  const t = ensureTextures();

  const byKey: Record<string, THREE.CanvasTexture> = {
    cobblestone: t.cobblestone,
    asphalt: t.asphalt,
    'asphalt-cracked': t.crackedAsphalt,
    'permeable-pavement': t.permeable,
    sidewalk: t.sidewalk,
  };

  // Base ground plane (the block surrounds; grass/dirt beyond the pavement).
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    texMat(byKey[ground.surfaceTexture] ?? t.cobblestone, [26, 26]),
  );
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  base.name = 'ground-plane';
  group.add(base);

  // Sidewalk ring just outside the road.
  addRing(group, 30, 28, 0.01, texMat(t.sidewalk, [5, 5]));

  // Road ring around the block (matches the vehicle traffic loop).
  addRing(group, 28, 22, 0.02, texMat(byKey[ground.roadTexture] ?? t.asphalt, [10, 10]));

  return group;
}

// ---------------------------------------------------------------------------
// Street props per era
// ---------------------------------------------------------------------------

function place(group: THREE.Group, prop: THREE.Group, x: number, z: number, rotY = 0): void {
  prop.position.set(x, 0, z);
  prop.rotation.y = rotY;
  group.add(prop);
}

/** Positions along the perimeter ring (avoiding corners). */
function ringPositions(count: number, half: number): [number, number][] {
  const perSide = Math.max(1, Math.ceil(count / 4));
  const sideLen = half * 2;
  const out: [number, number][] = [];
  for (let i = 0; i < perSide; i++) {
    const t = (i + 1) / (perSide + 1);
    const off = -half + t * sideLen;
    out.push([off, half], [off, -half], [half, off], [-half, off]);
  }
  return out;
}

function seedForYear(year: number): number {
  return (year * 2654435761) >>> 0;
}

/** 1945: ornate cast-iron lamppost with a warm lantern. */
function buildPeriodLamp(): THREE.Group {
  const g = new THREE.Group();
  const iron = solid(0x2b2b2e, { roughness: 0.5, metalness: 0.6 });
  const warm = solid(0xfff3d0, { roughness: 0.4, metalness: 0, emissive: 0xffb84d, emissiveIntensity: 1.6 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 8), iron);
  base.position.y = 0.15;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.1, 8), iron);
  pole.position.y = 2.35;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 8), iron);
  collar.position.y = 4.3;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), iron);
  arm.rotation.z = Math.PI / 2;
  arm.position.y = 4.35;
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), warm);
  lantern.position.y = 4.35;

  g.add(base, pole, collar, arm, lantern);
  return g;
}

/** 1945: wooden telephone pole with crossarms and insulators. */
function buildTelephonePole(): THREE.Group {
  const g = new THREE.Group();
  const wood = solid(0x6b4a2a, { roughness: 0.9, metalness: 0 });
  const dark = solid(0x2a2a2c, { roughness: 0.7, metalness: 0.2 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6.4, 6), wood);
  pole.position.y = 3.2;
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.09), wood);
  cross1.position.y = 5.6;
  const cross2 = cross1.clone();
  cross2.position.y = 6.1;

  g.add(pole, cross1, cross2);
  // insulators on the upper crossarm
  for (let i = -1; i <= 1; i += 2) {
    const ins = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), dark);
    ins.position.set(i * 0.85, 5.7, 0);
    g.add(ins);
  }
  return g;
}

/** 1965: mid-century saucer street lamp. */
function buildMidCenturyLamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = solid(0x3a3d40, { roughness: 0.45, metalness: 0.5 });
  const glow = solid(0xffffff, { roughness: 0.3, metalness: 0, emissive: 0xfff2c4, emissiveIntensity: 1.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8), metal);
  pole.position.y = 2.3;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.4, 12), metal);
  head.position.y = 4.7;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12), glow);
  disc.position.y = 4.52;

  g.add(pole, head, disc);
  return g;
}

/** 1965 / 2005: traffic signal with three lamp heads. */
function buildTrafficSignal(modern = false): THREE.Group {
  const g = new THREE.Group();
  const dark = solid(0x222528, { roughness: 0.5, metalness: 0.3 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(modern ? 0.05 : 0.06, modern ? 0.06 : 0.07, 3.4, 8), dark);
  pole.position.y = 1.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(modern ? 0.66 : 0.6, 1.7, 0.4), dark);
  head.position.y = 3.6;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(modern ? 0.7 : 0.64, 1.74, 0.08), dark);
  visor.position.set(0, 3.6, 0.2);

  const colors = [0xff3b30, 0xffcc00, 0x34c759];
  colors.forEach((c, i) => {
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), solid(c, { emissive: c, emissiveIntensity: 1.8 }));
    light.position.set(0, 3.6 + (1 - i) * 0.5, 0.24);
    g.add(light);
  });

  g.add(pole, head, visor);
  return g;
}

/** 1985: street bench with neon trim. */
function buildNeonBench(): THREE.Group {
  const g = new THREE.Group();
  const metal = solid(0x4a4a4d, { roughness: 0.5, metalness: 0.4 });
  const neon = solid(0xff2a6d, { roughness: 0.3, metalness: 0, emissive: 0xff2a6d, emissiveIntensity: 2.2 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.45), metal);
  seat.position.y = 0.5;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.06), metal);
  back.position.set(0, 0.85, -0.2);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.05, 0.05), neon);
  trim.position.set(0, 0.56, 0.24);

  g.add(seat, back, trim);
  return g;
}

/** 1985: payphone with a handset and coin slot. */
function buildPayphone(): THREE.Group {
  const g = new THREE.Group();
  const body = solid(0x2e3134, { roughness: 0.4, metalness: 0.4 });
  const screen = solid(0x9fc3d8, { roughness: 0.2, metalness: 0, emissive: 0xbfe0f0, emissiveIntensity: 0.5 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), body);
  pole.position.y = 1.15;
  const booth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.3), body);
  booth.position.y = 1.7;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), screen);
  display.position.set(0, 1.95, 0.16);
  const handset = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.12), body);
  handset.position.set(0, 1.42, 0.18);

  g.add(pole, booth, display, handset);
  return g;
}

/** 2005: sleek modern LED street lamp. */
function buildModernLedLamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = solid(0x4a5058, { roughness: 0.35, metalness: 0.55 });
  const white = solid(0xf3f6f8, { roughness: 0.3, metalness: 0, emissive: 0xeaf4ff, emissiveIntensity: 1.4 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 8), metal);
  pole.position.y = 2.5;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), metal);
  arm.position.set(0.45, 5, 0);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.22), white);
  panel.position.set(0.85, 4.9, 0);

  g.add(pole, arm, panel);
  return g;
}

/** 2025: EV charge station with a screen and charging cable. */
function buildEvCharger(): THREE.Group {
  const g = new THREE.Group();
  const casing = solid(0xdbe3e8, { roughness: 0.4, metalness: 0.2 });
  const accent = solid(0x2f9e6e, { roughness: 0.4, metalness: 0.1 });
  const screen = solid(0x0c1a28, { roughness: 0.2, metalness: 0, emissive: 0x2af0c8, emissiveIntensity: 1.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.35), casing);
  body.position.y = 0.6;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.37), accent);
  stripe.position.y = 0.18;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), screen);
  display.position.set(0, 0.85, 0.18);
  const cable = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 16), accent);
  cable.position.set(0.3, 0.5, 0);

  g.add(body, stripe, display, cable);
  return g;
}

/** 2025: smart street lamp with a sensor node and LED strip head. */
function buildSmartLamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = solid(0x3a4046, { roughness: 0.3, metalness: 0.6 });
  const white = solid(0xf3f6f8, { roughness: 0.3, metalness: 0, emissive: 0xeaf4ff, emissiveIntensity: 1.5 });
  const sensor = solid(0x2f86d6, { roughness: 0.25, metalness: 0.1, emissive: 0x2f86d6, emissiveIntensity: 1.2 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.6, 8), metal);
  pole.position.y = 2.8;
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), sensor);
  node.position.y = 5.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), metal);
  arm.position.set(0.48, 5.4, 0);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.16), white);
  panel.position.set(0.9, 5.28, 0);

  g.add(pole, node, arm, panel);
  return g;
}

/** 2025: drone-flight marker — a glowing beacon on a small mast. */
function buildDroneMarker(): THREE.Group {
  const g = new THREE.Group();
  const dark = solid(0x2a2d30, { roughness: 0.5, metalness: 0.3 });
  const beacon = solid(0x2af0ff, { roughness: 0.2, metalness: 0, emissive: 0x2af0ff, emissiveIntensity: 2 });

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 6), dark);
  mast.position.y = 0.6;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), beacon);
  glow.position.y = 1.25;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 16), beacon);
  ring.position.y = 1.25;

  g.add(mast, glow, ring);
  return g;
}

/** Assemble the era-appropriate set of street props around the block. */
function buildStreetProps(year: EraYear): THREE.Group {
  const group = new THREE.Group();
  group.name = 'environment-street-props';
  const rng = new PRNG(seedForYear(year));
  const spots = ringPositions(12, 29);

  const take = (n: number): [number, number][] => {
    const out = spots.splice(0, n);
    return out;
  };

  switch (year) {
    case 1945: {
      take(4).forEach(([x, z]) => place(group, buildPeriodLamp(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildTelephonePole(), x, z, rng.range(0, Math.PI)));
      break;
    }
    case 1965: {
      take(4).forEach(([x, z]) => place(group, buildMidCenturyLamp(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildTrafficSignal(false), x, z, rng.range(0, Math.PI)));
      break;
    }
    case 1985: {
      take(2).forEach(([x, z]) => place(group, buildNeonBench(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildPayphone(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildMidCenturyLamp(), x, z, rng.range(0, Math.PI)));
      break;
    }
    case 2005: {
      take(4).forEach(([x, z]) => place(group, buildModernLedLamp(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildTrafficSignal(true), x, z, rng.range(0, Math.PI)));
      break;
    }
    case 2025: {
      take(2).forEach(([x, z]) => place(group, buildEvCharger(), x, z, rng.range(0, Math.PI)));
      take(2).forEach(([x, z]) => place(group, buildSmartLamp(), x, z, rng.range(0, Math.PI)));
      take(3).forEach(([x, z]) => place(group, buildDroneMarker(), x, z, rng.range(0, Math.PI)));
      break;
    }
  }
  return group;
}

// ---------------------------------------------------------------------------
// Era configs (sky / lighting / ground slices)
// ---------------------------------------------------------------------------

type EnvSlice = Pick<EraConfig, 'sky' | 'lighting' | 'ground'>;

function makeEnv(
  sky: EraConfig['sky'],
  lighting: EraConfig['lighting'],
  ground: EraConfig['ground'],
): EnvSlice {
  return { sky, lighting, ground };
}

const env1945 = makeEnv(
  {
    topColor: 0x8a7f6a,
    bottomColor: 0xe8d9b8,
    sunDirection: [0.5, 0.55, 0.4],
    haze: 0.35,
    cloudTexture: 'clouds',
    stars: false,
  },
  {
    ambientIntensity: 0.55,
    sunIntensity: 0.85,
    sunColor: 0xffd9a0,
    shadowSoftness: 0.6,
    streetlightIntensity: 0.4,
    windowGlow: 0.15,
  },
  {
    surfaceTexture: 'cobblestone',
    roadTexture: 'road-cobble',
    sidewalkTexture: 'sidewalk',
    color: 0x7a6f5f,
  },
);

const env1965 = makeEnv(
  {
    topColor: 0x4a7fb8,
    bottomColor: 0xd8e8f5,
    sunDirection: [0.6, 0.8, 0.3],
    haze: 0.1,
    cloudTexture: 'clouds',
    stars: false,
  },
  {
    ambientIntensity: 0.6,
    sunIntensity: 1.0,
    sunColor: 0xfff6e6,
    shadowSoftness: 0.4,
    streetlightIntensity: 0.3,
    windowGlow: 0.3,
  },
  {
    surfaceTexture: 'asphalt',
    roadTexture: 'road-asphalt',
    sidewalkTexture: 'sidewalk',
    color: 0x5a6066,
  },
);

const env1985 = makeEnv(
  {
    topColor: 0x6b6a52,
    bottomColor: 0xc9b78a,
    sunDirection: [0.55, 0.62, 0.35],
    haze: 0.55,
    cloudTexture: 'clouds',
    stars: false,
  },
  {
    ambientIntensity: 0.55,
    sunIntensity: 0.72,
    sunColor: 0xffc27a,
    shadowSoftness: 0.75,
    streetlightIntensity: 0.5,
    windowGlow: 0.5,
  },
  {
    surfaceTexture: 'asphalt-cracked',
    roadTexture: 'road-asphalt-cracked',
    sidewalkTexture: 'sidewalk',
    color: 0x4a5055,
  },
);

const env2005 = makeEnv(
  {
    topColor: 0x3f7fbd,
    bottomColor: 0xd2e6f7,
    sunDirection: [0.6, 0.78, 0.3],
    haze: 0.15,
    cloudTexture: 'clouds',
    stars: false,
  },
  {
    ambientIntensity: 0.62,
    sunIntensity: 1.0,
    sunColor: 0xfff4e0,
    shadowSoftness: 0.45,
    streetlightIntensity: 0.45,
    windowGlow: 0.5,
  },
  {
    surfaceTexture: 'asphalt',
    roadTexture: 'road-asphalt',
    sidewalkTexture: 'sidewalk',
    color: 0x555b61,
  },
);

const env2025 = makeEnv(
  {
    topColor: 0x2f6fae,
    bottomColor: 0xcfe8fb,
    sunDirection: [0.62, 0.85, 0.28],
    haze: 0.08,
    cloudTexture: 'clouds',
    stars: false,
  },
  {
    ambientIntensity: 0.66,
    sunIntensity: 1.05,
    sunColor: 0xeaf4ff,
    shadowSoftness: 0.35,
    streetlightIntensity: 0.5,
    windowGlow: 0.6,
  },
  {
    surfaceTexture: 'permeable-pavement',
    roadTexture: 'road-permeable',
    sidewalkTexture: 'sidewalk',
    color: 0x5f666c,
  },
);

/** Merge a sky/lighting/ground slice into the shared era registry. */
function registerEnvSlice(year: EraYear, slice: EnvSlice): void {
  const existing: Partial<EraConfig> = eraRegistry[year] ?? {};
  eraRegistry[year] = { ...existing, ...slice } as EraConfig;
}

// Register environment configs for all five canonical years.
registerEnvSlice(1945, env1945);
registerEnvSlice(1965, env1965);
registerEnvSlice(1985, env1985);
registerEnvSlice(2005, env2005);
registerEnvSlice(2025, env2025);

// ---------------------------------------------------------------------------
// Public API for the era-transition engine
// ---------------------------------------------------------------------------

/**
 * Build the full environment & atmosphere for the given era as a positioned
 * {@link THREE.Group}: sky dome, directional/ambient lighting, ground planes,
 * and era-appropriate street props.
 */
export function buildEraEnvironment(year: EraYear): THREE.Group {
  ensureTextures();
  const config = eraRegistry[year];
  if (!config) {
    throw new Error(`No environment config registered for ${year}`);
  }
  const group = new THREE.Group();
  group.name = `environment-${year}`;
  group.add(buildSky(config.sky));
  group.add(buildLighting(config.lighting, config.sky));
  group.add(buildGround(config.ground));
  group.add(buildStreetProps(year));
  return group;
}

/**
 * Dispose all geometries and materials owned by an environment group. Call
 * when the group is removed from the scene so GPU resources are released.
 */
export function disposeEnvironment(group: THREE.Group): void {
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