/**
 * Era-specific pedestrian content for the City Time Period Timelapse.
 *
 * This module owns everything pedestrian-related for all five canonical eras:
 *
 *   - It registers a fully-typed {@link PedestrianOutfitConfig} for every era
 *     year (1945, 1965, 1985, 2005, 2025) into the shared foundation era
 *     registry, merging only the `pedestrianOutfits` field so it composes with
 *     the sibling content modules (buildings, vehicles, storefronts, ...).
 *   - It builds every pedestrian from procedural Three.js geometry — no
 *     external asset files — with era-correct outfits, silhouettes and color
 *     languages (muted wartime suits and dresses, mod miniskirts, 80s power
 *     suits and big hair, 00s hoodies and flip phones, 20s athleisure and
 *     earbuds).
 *   - It provides {@link createPedestrianCrowd}, a self-contained crowd system
 *     that spawns era-appropriate pedestrians and animates them walking (or
 *     idling) around a sidewalk loop path.
 *
 * Wire the crowd system into the scene (for example from main.ts) with:
 *
 *   const crowd = createPedestrianCrowd(scene);
 *   // in the animation loop:
 *   crowd.update(delta);
 *   // on era switch (keyboard hotkeys 1-5):
 *   crowd.setEra(year);
 *   // on teardown:
 *   crowd.dispose();
 */
import * as THREE from 'three';
import { eraRegistry } from '../eras';
import type { EraConfig, EraYear, PedestrianOutfitConfig } from '../eras';
import { seededFromString, PRNG } from '../core/prng';

/* ------------------------------------------------------------------ *
 * Shared material / part helpers
 * ------------------------------------------------------------------ */

interface PartMaterialOptions {
  color?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
}

/** Build a standard material from a small options object. */
function mat(options: PartMaterialOptions): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

/** Add a box mesh to a group and return it. */
function box(
  group: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Add a cylinder mesh to a group, optionally re-aimed along x or z. */
function cylinder(
  group: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  axis: 'x' | 'y' | 'z' = 'y',
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  else if (axis === 'z') geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Add a (possibly non-uniformly scaled) sphere mesh to a group. */
function sphere(
  group: THREE.Object3D,
  radius: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Create a pivoted limb: the returned group is placed at `pivotY` and its mesh
 * hangs downward so that rotating the group swings the limb around the joint.
 */
function limb(
  group: THREE.Group,
  w: number,
  d: number,
  length: number,
  material: THREE.Material,
  pivotY: number,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, pivotY, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, length, d), material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  g.add(mesh);
  group.add(g);
  return g;
}

/* ------------------------------------------------------------------ *
 * Figure (articulated pedestrian body)
 * ------------------------------------------------------------------ */

const SKIN_TONES = [0xf0c8a0, 0xd9a97e, 0xc08a5f, 0x8a5a3a, 0x6b4226, 0x3a2416];
const HAIR_COLORS = [0x2a2018, 0x3a2a1a, 0x5a3a20, 0x1a1a1a, 0x8a6a3a, 0x6a4a2a, 0xc8a020];

interface Figure {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Group;
  skinMat: THREE.Material;
  hairMat: THREE.Material;
}

/**
 * Build the neutral articulated body (head, torso, pivoted legs and arms).
 * Era-specific dress builders overlay clothing and accessories on top.
 */
function baseFigure(skin: number, hair: number): Figure {
  const group = new THREE.Group();
  const skinMat = mat({ color: skin, roughness: 0.7 });
  const hairMat = mat({ color: hair, roughness: 0.85 });
  const shoeMat = mat({ color: 0x1a1a1a, roughness: 0.8 });
  const baseMat = mat({ color: 0x8a8a8a, roughness: 0.8 });

  // Legs (pivoted at the hips).
  const leftLeg = limb(group, 0.17, 0.17, 0.8, baseMat, 0.82);
  const rightLeg = limb(group, 0.17, 0.17, 0.8, baseMat, 0.82);
  leftLeg.position.x = -0.11;
  rightLeg.position.x = 0.11;
  // Feet.
  box(leftLeg, 0.2, 0.08, 0.3, 0, -0.76, 0.05, shoeMat);
  box(rightLeg, 0.2, 0.08, 0.3, 0, -0.76, 0.05, shoeMat);

  // Torso.
  box(group, 0.62, 0.5, 0.34, 0, 1.08, 0, baseMat);

  // Arms (pivoted at the shoulders).
  const leftArm = limb(group, 0.13, 0.13, 0.66, skinMat, 1.3);
  const rightArm = limb(group, 0.13, 0.13, 0.66, skinMat, 1.3);
  leftArm.position.x = -0.4;
  rightArm.position.x = 0.4;

  // Head + hair cap.
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  sphere(head, 0.19, 0, 0, 0, skinMat);
  sphere(head, 0.2, 0, 0.02, -0.02, hairMat, 1, 0.85, 1);
  group.add(head);

  return { group, leftLeg, rightLeg, leftArm, rightArm, head, skinMat, hairMat };
}

/* ------------------------------------------------------------------ *
 * Era dress builders
 * ------------------------------------------------------------------ */

/** Add trousers over the legs in the given color. */
function trousers(f: Figure, color: number, roughness = 0.6): void {
  const m = mat({ color, roughness });
  box(f.leftLeg, 0.18, 0.72, 0.18, 0, -0.4, 0, m);
  box(f.rightLeg, 0.18, 0.72, 0.18, 0, -0.4, 0, m);
}

/** Add a fedora (brim + crown) on the head. */
function fedora(f: Figure, color = 0x2a2620): void {
  const hat = mat({ color, roughness: 0.6 });
  cylinder(f.head, 0.12, 0.12, 0.12, 12, 0, 0.18, 0, hat);
  cylinder(f.head, 0.22, 0.22, 0.03, 16, 0, 0.12, 0, hat);
}

/** Add a small pillbox-style hat on the head. */
function pillbox(f: Figure, color: number): void {
  box(f.head, 0.26, 0.07, 0.26, 0, 0.2, 0, mat({ color, roughness: 0.6 }));
}

/** Add a small handheld device (flip phone / smartphone) to the right hand. */
function handheld(f: Figure, color = 0x1a1a1a): void {
  box(f.rightArm, 0.15, 0.24, 0.07, 0, -0.5, 0.06, mat({ color, roughness: 0.35, metalness: 0.45 }));
}

/** Add a pair of wireless earbuds to the head. */
function earbuds(f: Figure): void {
  const bud = mat({ color: 0xffffff, roughness: 0.3 });
  sphere(f.head, 0.045, -0.15, 0.05, 0.15, bud);
  sphere(f.head, 0.045, 0.15, 0.05, 0.15, bud);
}

/** Add a face mask over the lower face. */
function faceMask(f: Figure): void {
  box(f.head, 0.2, 0.12, 0.04, 0, -0.06, 0.17, mat({ color: 0xf2f2f2, roughness: 0.7 }));
}

/** Add a backpack behind the torso. */
function backpack(f: Figure, color: number): void {
  box(f.group, 0.5, 0.42, 0.22, 0, 1.12, -0.3, mat({ color, roughness: 0.7 }));
}

/** 1945: tailored suit (and fedora variant). */
function dressSuit(f: Figure, palette: number[], prng: PRNG, withFedora: boolean): void {
  const suit = mat({ color: prng.pick(palette), roughness: 0.55 });
  const shirt = mat({ color: 0xf2ede2, roughness: 0.7 });
  const tie = mat({ color: 0x3a2a2a, roughness: 0.6 });
  box(f.group, 0.7, 0.55, 0.4, 0, 1.12, 0, suit);
  box(f.group, 0.3, 0.2, 0.02, 0, 1.26, 0.2, shirt);
  box(f.group, 0.08, 0.32, 0.02, 0, 1.12, 0.2, tie);
  trousers(f, 0x2f2a26);
  if (withFedora) fedora(f);
}

/** 1945: flared wartime dress. */
function dressDress(f: Figure, palette: number[], prng: PRNG): void {
  const dress = mat({ color: prng.pick(palette), roughness: 0.6 });
  cylinder(f.group, 0.28, 0.5, 0.85, 16, 0, 1.0, 0, dress);
  box(f.group, 0.5, 0.25, 0.32, 0, 1.28, 0, dress);
  pillbox(f, prng.pick(palette));
}

/** 1945: long wool overcoat. */
function dressOvercoat(f: Figure, palette: number[], prng: PRNG): void {
  const coat = mat({ color: prng.pick(palette), roughness: 0.7 });
  box(f.group, 0.78, 1.0, 0.45, 0, 1.0, 0, coat);
  box(f.group, 0.3, 0.3, 0.03, 0, 1.32, 0.24, coat);
  trousers(f, 0x2a2620);
  fedora(f, 0x2a2620);
}

/** 1965: bright mod minidress with beehive hair. */
function dressModDress(f: Figure, palette: number[], prng: PRNG): void {
  const mod = mat({ color: prng.pick(palette), roughness: 0.5 });
  cylinder(f.group, 0.26, 0.42, 0.32, 16, 0, 0.95, 0, mod);
  box(f.group, 0.52, 0.3, 0.32, 0, 1.25, 0, mod);
  trousers(f, prng.pick(palette), 0.5);
  // Big beehive hair.
  sphere(f.head, 0.22, 0, 0.18, -0.02, f.hairMat, 1, 1.35, 1);
}

/** 1965: slim mod suit (narrow lapels, skinny trousers). */
function dressSlimSuit(f: Figure, palette: number[], prng: PRNG): void {
  const suit = mat({ color: prng.pick(palette), roughness: 0.45 });
  box(f.group, 0.62, 0.55, 0.34, 0, 1.12, 0, suit);
  box(f.group, 0.28, 0.18, 0.02, 0, 1.26, 0.17, mat({ color: 0xf5f5f5, roughness: 0.7 }));
  box(f.group, 0.05, 0.3, 0.02, 0, 1.12, 0.17, mat({ color: 0x111111, roughness: 0.5 }));
  trousers(f, prng.pick(palette), 0.45);
}

/** 1965: casual mod look with bright shirt and headband. */
function dressModCasual(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.6, 0.5, 0.34, 0, 1.08, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, prng.pick(palette), 0.5);
  box(f.head, 0.24, 0.06, 0.24, 0, 0.14, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
}

/** 1985: power suit with shoulder pads and big hair. */
function dressPowerSuit(f: Figure, palette: number[], prng: PRNG): void {
  const jacket = mat({ color: prng.pick(palette), roughness: 0.5 });
  box(f.group, 0.86, 0.12, 0.42, 0, 1.34, 0, jacket); // shoulder pads
  box(f.group, 0.7, 0.5, 0.4, 0, 1.12, 0, jacket);
  trousers(f, prng.pick(palette), 0.5);
  // Big hair.
  sphere(f.head, 0.24, 0, 0.16, -0.02, f.hairMat, 1, 1.4, 1);
  // Earrings.
  const gold = mat({ color: 0xd8b028, roughness: 0.3, metalness: 0.6 });
  sphere(f.head, 0.03, -0.2, -0.05, 0.18, gold);
  sphere(f.head, 0.03, 0.2, -0.05, 0.18, gold);
}

/** 1985: denim jacket over jeans with a band tee. */
function dressDenim(f: Figure, palette: number[], prng: PRNG): void {
  const denim = mat({ color: 0x3a5a8a, roughness: 0.75 });
  box(f.group, 0.7, 0.55, 0.4, 0, 1.12, 0, denim);
  box(f.group, 0.5, 0.2, 0.3, 0, 1.28, 0.05, mat({ color: prng.pick(palette), roughness: 0.7 }));
  trousers(f, 0x2f4a7a, 0.75);
  // Denim jacket collar.
  box(f.group, 0.4, 0.1, 0.04, 0, 1.4, 0.2, denim);
}

/** 1985: bright athletic wear with a sweatband and sneakers. */
function dressAthletic(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.62, 0.5, 0.34, 0, 1.08, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, prng.pick(palette), 0.6);
  box(f.head, 0.24, 0.06, 0.24, 0, 0.14, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  const sneaker = mat({ color: 0xffffff, roughness: 0.5 });
  box(f.leftLeg, 0.22, 0.1, 0.32, 0, -0.75, 0.05, sneaker);
  box(f.rightLeg, 0.22, 0.1, 0.32, 0, -0.75, 0.05, sneaker);
}

/** 2005: hoodie with low-rise jeans and a flip phone. */
function dressHoodie(f: Figure, palette: number[], prng: PRNG): void {
  const hoodie = mat({ color: prng.pick(palette), roughness: 0.7 });
  box(f.group, 0.66, 0.55, 0.4, 0, 1.12, 0, hoodie);
  box(f.group, 0.5, 0.2, 0.16, 0, 1.42, -0.22, hoodie);
  trousers(f, 0x3a4a6a, 0.7);
  handheld(f, 0x222222);
}

/** 2005: cropped top with low-rise jeans. */
function dressLowRise(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.56, 0.28, 0.32, 0, 1.16, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, 0x3a4a6a, 0.7);
  handheld(f, 0x222222);
}

/** 2005: smart-casual with headphones around the neck. */
function dressSmartCasual(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.62, 0.5, 0.34, 0, 1.08, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, 0x8a7a5a, 0.6);
  box(f.group, 0.4, 0.12, 0.2, 0, 1.28, 0.14, mat({ color: 0x222222, roughness: 0.5 }));
}

/** 2025: athleisure with leggings, sneakers, earbuds and a smartphone. */
function dressAthleisure(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.6, 0.5, 0.34, 0, 1.08, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, prng.pick(palette), 0.5);
  const sneaker = mat({ color: 0xffffff, roughness: 0.5 });
  box(f.leftLeg, 0.22, 0.1, 0.32, 0, -0.75, 0.05, sneaker);
  box(f.rightLeg, 0.22, 0.1, 0.32, 0, -0.75, 0.05, sneaker);
  earbuds(f);
  handheld(f, 0x1a1a1a);
}

/** 2025: commuter with a backpack, mask and earbuds. */
function dressCommuter(f: Figure, palette: number[], prng: PRNG): void {
  box(f.group, 0.7, 0.55, 0.4, 0, 1.12, 0, mat({ color: prng.pick(palette), roughness: 0.6 }));
  trousers(f, prng.pick(palette), 0.6);
  backpack(f, prng.pick(palette));
  faceMask(f);
  earbuds(f);
}

/** 2025: casual tech look with a hoodie, joggers, backpack and earbuds. */
function dressCasualTech(f: Figure, palette: number[], prng: PRNG): void {
  const hoodie = mat({ color: prng.pick(palette), roughness: 0.7 });
  box(f.group, 0.66, 0.55, 0.4, 0, 1.12, 0, hoodie);
  box(f.group, 0.5, 0.2, 0.16, 0, 1.42, -0.22, hoodie);
  trousers(f, prng.pick(palette), 0.7);
  backpack(f, prng.pick(palette));
  earbuds(f);
}

/* ------------------------------------------------------------------ *
 * Pedestrian styles + per-era profiles
 * ------------------------------------------------------------------ */

type PedestrianStyle =
  | 'suit'
  | 'fedora-suit'
  | 'dress'
  | 'overcoat'
  | 'mod-dress'
  | 'slim-suit'
  | 'mod-casual'
  | 'power-suit'
  | 'denim'
  | 'athletic'
  | 'hoodie'
  | 'low-rise'
  | 'smart-casual'
  | 'athleisure'
  | 'commuter'
  | 'casual-tech';

interface EraPedestrianProfile {
  year: number;
  palette: number[];
  accessories: string[];
  population: number;
  speedRange: [number, number];
  styles: PedestrianStyle[];
}

const ERA_PEDESTRIAN_PROFILES: Record<EraYear, EraPedestrianProfile> = {
  1945: {
    year: 1945,
    population: 12,
    speedRange: [1.4, 2.4],
    palette: [0x5a5248, 0x4a4238, 0x3f3f3f, 0x6b6257, 0x7a6a55, 0x8a8075, 0x2f3438],
    accessories: ['fedora', 'newsboy-cap', 'handbag', 'umbrella', 'gloves'],
    styles: ['suit', 'fedora-suit', 'dress', 'overcoat'],
  },
  1965: {
    year: 1965,
    population: 14,
    speedRange: [1.6, 2.6],
    palette: [0xe23a6e, 0x1f8a5f, 0x1f5aa8, 0xe8a400, 0x22262b, 0xffffff, 0x8a3ac8],
    accessories: ['sunglasses', 'handbag', 'headband', 'mod-earrings'],
    styles: ['mod-dress', 'slim-suit', 'mod-casual'],
  },
  1985: {
    year: 1985,
    population: 15,
    speedRange: [1.6, 2.7],
    palette: [0x3f4a8a, 0xc83a5a, 0x2a6a8a, 0x8a3a6a, 0x4a5a8a, 0x1a2a3a, 0xd8a000, 0x6a7a8a],
    accessories: ['earrings', 'headband', 'walkman', 'shoulder-bag', 'sunglasses'],
    styles: ['power-suit', 'denim', 'athletic'],
  },
  2005: {
    year: 2005,
    population: 16,
    speedRange: [1.7, 2.8],
    palette: [0x3b6ea5, 0x6b7a4f, 0x8a3a3a, 0x2a2a2a, 0x9aa5b1, 0x5a5a5a, 0x4a8a6a],
    accessories: ['hoodie', 'flip-phone', 'smartphone', 'headphones', 'backpack'],
    styles: ['hoodie', 'low-rise', 'smart-casual'],
  },
  2025: {
    year: 2025,
    population: 18,
    speedRange: [1.8, 3.0],
    palette: [0x1f2a38, 0x3f7d8c, 0x5a5a6e, 0x8a8a9a, 0x2c3e50, 0x6a8a7a, 0xd8dde2],
    accessories: ['wireless-earbuds', 'smartphone', 'mask', 'backpack', 'sunglasses'],
    styles: ['athleisure', 'commuter', 'casual-tech'],
  },
};

/** Read-only view of the era pedestrian profiles for introspection/tests. */
export const PEDESTRIAN_PROFILES: Readonly<Record<EraYear, EraPedestrianProfile>> =
  ERA_PEDESTRIAN_PROFILES;

/** Build the foundation {@link PedestrianOutfitConfig} for a profile. */
function buildPedestrianConfig(profile: EraPedestrianProfile): PedestrianOutfitConfig {
  return {
    palette: profile.palette,
    accessories: profile.accessories,
    population: profile.population,
    speedRange: profile.speedRange,
  };
}

/**
 * Merge a pedestrian config into the shared era registry, preserving any other
 * fields (buildings, vehicles, storefronts, ...) that sibling content modules
 * register.
 */
function registerPedestrianConfig(year: EraYear, config: PedestrianOutfitConfig): void {
  const existing: Partial<EraConfig> = eraRegistry[year] ?? {};
  eraRegistry[year] = { ...existing, pedestrianOutfits: config } as EraConfig;
}

// Register era-appropriate pedestrians for all five canonical years.
registerPedestrianConfig(1945, buildPedestrianConfig(ERA_PEDESTRIAN_PROFILES[1945]));
registerPedestrianConfig(1965, buildPedestrianConfig(ERA_PEDESTRIAN_PROFILES[1965]));
registerPedestrianConfig(1985, buildPedestrianConfig(ERA_PEDESTRIAN_PROFILES[1985]));
registerPedestrianConfig(2005, buildPedestrianConfig(ERA_PEDESTRIAN_PROFILES[2005]));
registerPedestrianConfig(2025, buildPedestrianConfig(ERA_PEDESTRIAN_PROFILES[2025]));

/** Assemble a fully-dressed, era-appropriate pedestrian figure. */
function buildFigure(profile: EraPedestrianProfile, style: PedestrianStyle, prng: PRNG): Figure {
  const f = baseFigure(prng.pick(SKIN_TONES), prng.pick(HAIR_COLORS));
  switch (style) {
    case 'suit':
      dressSuit(f, profile.palette, prng, false);
      break;
    case 'fedora-suit':
      dressSuit(f, profile.palette, prng, true);
      break;
    case 'dress':
      dressDress(f, profile.palette, prng);
      break;
    case 'overcoat':
      dressOvercoat(f, profile.palette, prng);
      break;
    case 'mod-dress':
      dressModDress(f, profile.palette, prng);
      break;
    case 'slim-suit':
      dressSlimSuit(f, profile.palette, prng);
      break;
    case 'mod-casual':
      dressModCasual(f, profile.palette, prng);
      break;
    case 'power-suit':
      dressPowerSuit(f, profile.palette, prng);
      break;
    case 'denim':
      dressDenim(f, profile.palette, prng);
      break;
    case 'athletic':
      dressAthletic(f, profile.palette, prng);
      break;
    case 'hoodie':
      dressHoodie(f, profile.palette, prng);
      break;
    case 'low-rise':
      dressLowRise(f, profile.palette, prng);
      break;
    case 'smart-casual':
      dressSmartCasual(f, profile.palette, prng);
      break;
    case 'athleisure':
      dressAthleisure(f, profile.palette, prng);
      break;
    case 'commuter':
      dressCommuter(f, profile.palette, prng);
      break;
    case 'casual-tech':
      dressCasualTech(f, profile.palette, prng);
      break;
  }
  return f;
}

/* ------------------------------------------------------------------ *
 * Sidewalk loop path + crowd system
 * ------------------------------------------------------------------ */

/**
 * A simple rectangular sidewalk loop. Pedestrians are walked along the
 * perimeter by an arc-length parameter; `getPointAt` returns the world
 * position plus the unit travel direction so a figure can be oriented.
 */
class SidewalkLoop {
  readonly width: number;
  readonly height: number;
  readonly perimeter: number;
  private readonly halfWidth: number;
  private readonly halfHeight: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.perimeter = 2 * (width + height);
    this.halfWidth = width / 2;
    this.halfHeight = height / 2;
  }

  getPointAt(s: number): { x: number; z: number; dx: number; dz: number } {
    const t = ((s % this.perimeter) + this.perimeter) % this.perimeter;
    const { halfWidth: hw, halfHeight: hh, width: w, height: h } = this;
    if (t < w) {
      const f = t / w;
      return { x: -hw + f * w, z: -hh, dx: 1, dz: 0 };
    }
    if (t < w + h) {
      const f = (t - w) / h;
      return { x: hw, z: -hh + f * h, dx: 0, dz: 1 };
    }
    if (t < 2 * w + h) {
      const f = (t - w - h) / w;
      return { x: hw - f * w, z: hh, dx: -1, dz: 0 };
    }
    const f = (t - 2 * w - h) / h;
    return { x: -hw, z: hh - f * h, dx: 0, dz: -1 };
  }
}

interface CrowdPedestrian {
  group: THREE.Group;
  parts: Figure;
  speed: number;
  arc: number;
  phase: number;
  mode: 'walk' | 'idle';
  t: number;
}

export interface PedestrianCrowdOptions {
  /** Street loop width in world units (default 44). */
  loopWidth?: number;
  /** Street loop height in world units (default 44). */
  loopHeight?: number;
  /** Sidewalk band width outside the road (default 6). */
  sidewalkOffset?: number;
  /** Initial era to render (default 2025). */
  era?: EraYear;
  /** Number of pedestrians to spawn (default derived from era population). */
  count?: number;
  /** Deterministic seed for reproducible pedestrian variety. */
  seed?: string;
}

export interface PedestrianCrowdHandle {
  /** Rebuild the crowd for the given era year. */
  setEra(year: EraYear): void;
  /** The era currently rendered. */
  getEra(): EraYear;
  /** Advance pedestrians along the sidewalk loop. Call every frame. */
  update(delta: number): void;
  /** Remove all pedestrians and release GPU resources. */
  dispose(): void;
}

/**
 * Create a self-contained pedestrian crowd: a sidewalk ring plus era-appropriate
 * procedural pedestrians that walk (or idle) around a sidewalk loop path.
 */
export function createPedestrianCrowd(
  scene: THREE.Scene,
  options: PedestrianCrowdOptions = {},
): PedestrianCrowdHandle {
  const loopWidth = options.loopWidth ?? 44;
  const loopHeight = options.loopHeight ?? 44;
  const offset = options.sidewalkOffset ?? 6;
  const seed = options.seed ?? 'pedestrians';

  // Sidewalk band sits just outside the road (road is loop+3 wide).
  const roadW = loopWidth + 3;
  const roadH = loopHeight + 3;
  const outerW = loopWidth + offset * 2;
  const outerH = loopHeight + offset * 2;
  const pedW = (outerW + roadW) / 2;
  const pedH = (outerH + roadH) / 2;
  const loop = new SidewalkLoop(pedW, pedH);

  const container = new THREE.Group();
  container.name = 'pedestrian-crowd';
  scene.add(container);

  // Sidewalk ring (a rectangle with a hole where the road sits).
  const outer = new THREE.Shape();
  const ow = outerW / 2;
  const oh = outerH / 2;
  outer.moveTo(-ow, -oh);
  outer.lineTo(ow, -oh);
  outer.lineTo(ow, oh);
  outer.lineTo(-ow, oh);
  outer.closePath();
  const hole = new THREE.Path();
  const rw = roadW / 2;
  const rh = roadH / 2;
  hole.moveTo(-rw, -rh);
  hole.lineTo(rw, -rh);
  hole.lineTo(rw, rh);
  hole.lineTo(-rw, rh);
  hole.closePath();
  outer.holes.push(hole);
  const sidewalkGeo = new THREE.ShapeGeometry(outer);
  sidewalkGeo.rotateX(-Math.PI / 2);
  const sidewalk = new THREE.Mesh(sidewalkGeo, mat({ color: 0x9aa0a4, roughness: 0.95 }));
  sidewalk.position.y = 0.006;
  sidewalk.receiveShadow = true;
  container.add(sidewalk);

  let currentYear: EraYear = options.era ?? 2025;
  let pedestrians: CrowdPedestrian[] = [];

  function buildFor(year: EraYear): void {
    for (const pedestrian of pedestrians) {
      container.remove(pedestrian.group);
    }
    pedestrians = [];

    const profile = ERA_PEDESTRIAN_PROFILES[year];
    const count = options.count ?? profile.population;
    const prng = seededFromString(`${seed}:${year}`);

    for (let i = 0; i < count; i++) {
      const style = prng.pick(profile.styles);
      const parts = buildFigure(profile, style, prng);
      const mode: 'walk' | 'idle' = prng.next() < 0.15 ? 'idle' : 'walk';
      const speed = mode === 'idle' ? 0 : prng.range(profile.speedRange[0], profile.speedRange[1]);
      const arc = prng.range(0, loop.perimeter);
      const point = loop.getPointAt(arc);
      parts.group.position.set(point.x, 0, point.z);
      parts.group.rotation.y = Math.atan2(point.dx, point.dz);
      container.add(parts.group);
      pedestrians.push({
        group: parts.group,
        parts,
        speed,
        arc,
        phase: prng.range(0, Math.PI * 2),
        mode,
        t: prng.range(0, 10),
      });
    }
  }

  buildFor(currentYear);

  function update(delta: number): void {
    for (const pedestrian of pedestrians) {
      pedestrian.t += delta;
      if (pedestrian.mode === 'walk') {
        pedestrian.arc = (pedestrian.arc + pedestrian.speed * delta) % loop.perimeter;
        const point = loop.getPointAt(pedestrian.arc);
        pedestrian.group.position.set(point.x, 0, point.z);
        pedestrian.group.rotation.y = Math.atan2(point.dx, point.dz);
      } else {
        // Idle: gentle bob in place.
        pedestrian.group.position.y = 0.03 + Math.sin(pedestrian.t * 2 + pedestrian.phase) * 0.02;
      }

      // Walk cycle: swing opposing limbs; idle just sways gently.
      const swing =
        pedestrian.mode === 'walk'
          ? Math.sin(pedestrian.t * 6 + pedestrian.phase) * 0.5
          : Math.sin(pedestrian.t * 1.5 + pedestrian.phase) * 0.03;
      pedestrian.parts.leftLeg.rotation.x = swing;
      pedestrian.parts.rightLeg.rotation.x = -swing;
      pedestrian.parts.leftArm.rotation.x = -swing * 0.7;
      pedestrian.parts.rightArm.rotation.x = swing * 0.7;
    }
  }

  function dispose(): void {
    container.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    });
    scene.remove(container);
  }

  return {
    setEra(year: EraYear): void {
      currentYear = year;
      buildFor(year);
    },
    getEra: () => currentYear,
    update,
    dispose,
  };
}
