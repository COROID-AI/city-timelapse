/**
 * Era pedestrians: procedural street life per year.
 *
 * Builds and animates low-poly, rigged walkers whose outfits, silhouettes,
 * colours, accessories and walking pace change per era:
 *
 *   - 1945: military uniforms and long coats
 *   - 1965: mod suits / dresses
 *   - 1985: shoulder-pads and denim
 *   - 2005: casual streetwear
 *   - 2025: athleisure with phones / laptop bags
 *
 * Rigging is intentionally bone-less: each pedestrian is a hierarchy of
 * three.js groups (hips -> torso -> arms/head, hips -> legs) that swing
 * sinusoidally to simulate a walk cycle. No animation library is required.
 * Pedestrians walk along the sidewalk lane (beside the road loop), turning
 * around at the block ends and never entering the roadway.
 *
 * Lifecycle contract: `bootstrap(scene, era)` -> `update(delta, era)` ->
 * `dispose()`. On an era change the crowd is rebuilt in place (the "morph"
 * trigger the compose/scene owner keys off).
 *
 * This module owns only the `EraDefinition.pedestrians` segment: it never
 * mutates the era registry or any other era field.
 */
import * as THREE from 'three';
import { eraRegistry } from '../data/eraRegistry';
import type { EraDefinition, EraKey } from '../data/eraDefinition';

// ---------------------------------------------------------------------------
// Sidewalk lane convention
// ---------------------------------------------------------------------------

/**
 * The sidewalk is a straight lane along X at a fixed z offset from the road
 * centre. Pedestrians walk back and forth between `-WALK_EXTENT` and
 * `+WALK_EXTENT`, turning around at the ends. This keeps them on the sidewalk
 * and well clear of the road loop and buildings.
 */
export const WALK_EXTENT = 26;
export const SIDEWALK_Z = 14;

/** Walk direction: travelling toward -X or +X. */
enum Direction {
  West = -1,
  East = 1,
}

// ---------------------------------------------------------------------------
// Small procedural helpers
// ---------------------------------------------------------------------------

/** Build a MeshStandardMaterial from a hex colour. */
function mat(color: string, opts: { roughness?: number; metalness?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
  });
}

/** A low-poly box mesh. */
function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** A low-poly sphere mesh (for heads). */
function sphere(r: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), material);
}

// ---------------------------------------------------------------------------
// Pedestrian anatomy / rig
// ---------------------------------------------------------------------------

/** A single pedestrian instance with its animated limb groups. */
interface Pedestrian {
  root: THREE.Group;
  /** Local hip origin (the pivot around which the body swings). */
  hip: THREE.Object3D;
  torso: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  /** Walking phase offset so the crowd doesn't march in unison. */
  phase: number;
  /** Per-person speed multiplier. */
  speedMul: number;
  /** Current position along the sidewalk (world X). */
  x: number;
  /** Current walk direction. */
  dir: Direction;
}

/** Per-era outfit descriptor. */
interface Outfit {
  skin: string;
  /** Torso / shirt / coat colour. */
  top: string;
  /** Legs / trousers / skirt colour. */
  bottom: string;
  /** Headwear or hair colour. */
  hair: string;
  /** Accent colour (accessory, scarf, bag). */
  accent: string;
  /** Accessory identifiers for the era. */
  accessories: string[];
  /** Walking pace multiplier (per era cadence). */
  pace: number;
}

/** Build and rig a single pedestrian from an outfit. */
function buildPedestrian(outfit: Outfit, seed: number): Pedestrian {
  const root = new THREE.Group();
  const hip = new THREE.Group();
  hip.name = 'hip';
  root.add(hip);

  // --- Torso + head ---
  const torso = new THREE.Group();
  torso.name = 'torso';
  const body = box(0.62, 0.8, 0.34, mat(outfit.top));
  body.position.set(0, 0.4, 0);
  torso.add(body);

  // Head + hair.
  const head = sphere(0.24, mat(outfit.skin));
  head.position.set(0, 1.18, 0);
  torso.add(head);
  const hair = sphere(0.26, mat(outfit.hair));
  hair.position.set(0, 1.32, -0.02);
  hair.scale.set(1, 0.6, 1);
  torso.add(hair);

  // --- Arms (swing from shoulder pivots) ---
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const armW = 0.14;
  const armH = 0.62;
  const armMat = mat(outfit.top);
  const leftUpper = box(armW, armH, armW, armMat);
  leftUpper.position.set(0, -armH / 2, 0);
  leftArm.add(leftUpper);
  const rightUpper = box(armW, armH, armW, armMat);
  rightUpper.position.set(0, -armH / 2, 0);
  rightArm.add(rightUpper);

  // Hands (skin).
  const handMat = mat(outfit.skin);
  leftArm.add(box(armW, 0.14, armW, handMat).translateY(-armH - 0.07));
  rightArm.add(box(armW, 0.14, armW, handMat).translateY(-armH - 0.07));

  leftArm.position.set(0.4, 0.82, 0);
  rightArm.position.set(-0.4, 0.82, 0);
  torso.add(leftArm, rightArm);

  // --- Legs (swing from hip pivots) ---
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const legW = 0.16;
  const legH = 0.72;
  const legMat = mat(outfit.bottom);
  leftLeg.add(box(legW, legH, legW, legMat).translateY(-legH / 2));
  rightLeg.add(box(legW, legH, legW, legMat).translateY(-legH / 2));

  // Shoes.
  const shoeMat = mat(outfit.accent);
  leftLeg.add(box(0.22, 0.1, 0.32, shoeMat).translateY(-legH - 0.05).translateZ(0.06));
  rightLeg.add(box(0.22, 0.1, 0.32, shoeMat).translateY(-legH - 0.05).translateZ(0.06));

  leftLeg.position.set(0.16, 0.8, 0);
  rightLeg.position.set(-0.16, 0.8, 0);
  hip.add(leftLeg, rightLeg);

  // --- Accessories ---
  for (const acc of outfit.accessories) {
    applyAccessory(torso, rightArm, acc, outfit);
  }

  hip.add(torso);

  // Randomised walk phase, pace and direction.
  const phase = (seed * 2.399963) % 1.0 * Math.PI * 2;
  const speedMul = 0.85 + ((seed * 7.13) % 1.0) * 0.4;
  const dir = ((seed * 13.7) % 1.0) < 0.5 ? Direction.East : Direction.West;

  const ped: Pedestrian = {
    root,
    hip,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    phase,
    speedMul,
    x: -WALK_EXTENT + (seed % 1.0) * (WALK_EXTENT * 2),
    dir,
  };
  return ped;
}

/** Attach era-specific accessories to a pedestrian. */
function applyAccessory(torso: THREE.Object3D, rightArm: THREE.Object3D, acc: string, outfit: Outfit): void {
  const accentMat = mat(outfit.accent);
  switch (acc) {
    case 'militaryCap': {
      // 1945: olive peaked cap.
      const cap = box(0.3, 0.14, 0.3, mat(outfit.hair));
      cap.position.set(0, 1.42, 0);
      torso.add(cap);
      const visor = box(0.26, 0.06, 0.2, mat('#1f2a1f'));
      visor.position.set(0, 1.36, 0.2);
      torso.add(visor);
      break;
    }
    case 'scarf': {
      // 1945: long coat scarf.
      const scarf = box(0.5, 0.16, 0.16, accentMat);
      scarf.position.set(0, 0.78, 0.18);
      torso.add(scarf);
      break;
    }
    case 'modTie': {
      // 1965: slim mod tie.
      const tie = box(0.12, 0.5, 0.06, accentMat);
      tie.position.set(0, 0.32, 0.2);
      torso.add(tie);
      break;
    }
    case 'shoulderPads': {
      // 1985: exaggerated shoulder pads.
      for (const px of [-0.34, 0.34]) {
        const pad = box(0.3, 0.14, 0.3, mat(outfit.top));
        pad.position.set(px, 0.88, 0);
        torso.add(pad);
      }
      break;
    }
    case 'handbag': {
      // 1985 / 2005: a handbag hanging from the shoulder.
      const bag = box(0.3, 0.24, 0.14, accentMat);
      bag.position.set(0.42, 0.5, 0.1);
      torso.add(bag);
      break;
    }
    case 'phone': {
      // 2025: phone held up to the ear.
      const phone = box(0.08, 0.16, 0.02, mat('#1b1b1b', { metalness: 0.7 }));
      phone.position.set(0.12, -0.3, -0.06);
      rightArm.add(phone);
      break;
    }
    case 'laptopBag': {
      // 2025: messenger / laptop bag across the torso.
      const bag = box(0.5, 0.34, 0.18, mat(outfit.accent));
      bag.position.set(0, 0.5, 0.22);
      torso.add(bag);
      const strap = box(0.1, 0.6, 0.1, mat('#1b1b1b'));
      strap.position.set(0.34, 0.6, 0.1);
      torso.add(strap);
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Per-era pedestrian segment
// ---------------------------------------------------------------------------

/** The `EraDefinition.pedestrians` segment, keyed per year. */
export interface PedestrianSegment {
  /** Number of walkers to spawn for this era. */
  count: number;
  /** Outfit pool; each spawned walker picks one (seeded). */
  outfits: Outfit[];
}

/** Base outfit colours and accessories for each era. */
export const PEDESTRIAN_SEGMENT: Record<EraKey, PedestrianSegment> = {
  1945: {
    count: 4,
    outfits: [
      { skin: '#c9a68a', top: '#4a5a3a', bottom: '#3a4436', hair: '#2a2a2a', accent: '#5c4d3d', accessories: ['militaryCap'], pace: 1.05 },
      { skin: '#b8947a', top: '#6e6258', bottom: '#4a4038', hair: '#3b3228', accent: '#7a6a55', accessories: ['scarf'], pace: 1.0 },
      { skin: '#c9a68a', top: '#5a4a3c', bottom: '#3f3a2e', hair: '#2f2a26', accent: '#8a7f6d', accessories: ['militaryCap'], pace: 1.05 },
    ],
  },
  1965: {
    count: 4,
    outfits: [
      { skin: '#c9a68a', top: '#c05a3c', bottom: '#2f3b4a', hair: '#1f1f1f', accent: '#e0c060', accessories: ['modTie'], pace: 1.15 },
      { skin: '#d2b08c', top: '#e8d9c0', bottom: '#c05a3c', hair: '#b8860b', accent: '#d8a84f', accessories: [], pace: 1.1 },
      { skin: '#c9a68a', top: '#3a6b8a', bottom: '#3a3a3a', hair: '#222222', accent: '#e8e8e8', accessories: ['modTie'], pace: 1.15 },
    ],
  },
  1985: {
    count: 5,
    outfits: [
      { skin: '#c9a68a', top: '#e0457b', bottom: '#3a5a8a', hair: '#2a2a2a', accent: '#d8a84f', accessories: ['shoulderPads', 'handbag'], pace: 1.1 },
      { skin: '#b8947a', top: '#5f6b74', bottom: '#38567e', hair: '#1f1f1f', accent: '#c02a2a', accessories: ['shoulderPads'], pace: 1.08 },
      { skin: '#d2b08c', top: '#e8e0d0', bottom: '#7a5a8a', hair: '#b8860b', accent: '#e0457b', accessories: ['shoulderPads', 'handbag'], pace: 1.1 },
    ],
  },
  2005: {
    count: 5,
    outfits: [
      { skin: '#c9a68a', top: '#2f86c8', bottom: '#4a4a4a', hair: '#3b3228', accent: '#e8e8e8', accessories: ['handbag'], pace: 1.2 },
      { skin: '#b8947a', top: '#6b7d8c', bottom: '#5f5f5f', hair: '#2a2a2a', accent: '#cf6a3c', accessories: [], pace: 1.18 },
      { skin: '#d2b08c', top: '#e8e0d0', bottom: '#7d8b94', hair: '#b8860b', accent: '#2f86c8', accessories: ['handbag'], pace: 1.2 },
    ],
  },
  2025: {
    count: 5,
    outfits: [
      { skin: '#c9a68a', top: '#00d1ff', bottom: '#2a2a2a', hair: '#1f1f1f', accent: '#e8f0f4', accessories: ['phone', 'laptopBag'], pace: 1.3 },
      { skin: '#b8947a', top: '#e8e0d0', bottom: '#3a3a4a', hair: '#3b3228', accent: '#00d1ff', accessories: ['phone'], pace: 1.28 },
      { skin: '#d2b08c', top: '#6b7d8c', bottom: '#2f3b4a', hair: '#b8860b', accent: '#f0a020', accessories: ['laptopBag'], pace: 1.3 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface PedestriansFactory {
  /** Create the crowd group and attach it to the scene for the given era. */
  bootstrap(scene: THREE.Scene, era?: EraDefinition): PedestriansFactory;
  /** Advance time and rebuild the crowd when the era changes. */
  update(delta: number, era: EraDefinition): void;
  /** Remove the crowd from the scene and release resources. */
  dispose(): void;
  /** Root group owning all animated pedestrians (null before bootstrap). */
  readonly root: THREE.Group | null;
  /** The currently active year. */
  readonly year: EraKey | null;
}

/**
 * Create a pedestrians factory. The factory is a single registration point
 * for the `EraDefinition.pedestrians` segment: it builds and animates the
 * per-year crowd, and never touches any other era field.
 */
export function pedestriansFactory(): PedestriansFactory {
  const root = new THREE.Group();
  root.name = 'era-pedestrians';

  let scene: THREE.Scene | null = null;
  let elapsed = 0;
  let currentYear: EraKey | null = null;
  const crowd: Pedestrian[] = [];

  /** Rebuild the crowd for the given era (used on bootstrap and era change). */
  function rebuild(era: EraDefinition): void {
    root.clear();
    crowd.length = 0;
    const segment = PEDESTRIAN_SEGMENT[era.year];
    for (let i = 0; i < segment.count; i += 1) {
      // Deterministic pseudo-random selection so each spawn feels varied.
      const seed = (i * 0.6180339887) % 1.0;
      const outfit = segment.outfits[Math.floor(seed * segment.outfits.length) % segment.outfits.length];
      const ped = buildPedestrian(outfit, seed + i * 0.37);
      root.add(ped.root);
      crowd.push(ped);
    }
    currentYear = era.year;
  }

  return {
    get root() {
      return root;
    },
    get year() {
      return currentYear;
    },
    bootstrap(sceneArg: THREE.Scene, era?: EraDefinition): PedestriansFactory {
      scene = sceneArg;
      const def = era ?? eraRegistry[1945];
      scene.add(root);
      rebuild(def);
      return this;
    },
    update(delta: number, era: EraDefinition): void {
      elapsed += delta;
      if (era.year !== currentYear) {
        rebuild(era);
      }
      const segment = PEDESTRIAN_SEGMENT[era.year];
      // Cadence (rad/s of the limb swing) scales with era pace.
      const cadence = 6.0 * (segment.outfits[0]?.pace ?? 1.1);
      for (const ped of crowd) {
        // Advance along the sidewalk; turn around at the ends.
        const step = delta * 1.6 * ped.speedMul * (segment.outfits[0]?.pace ?? 1.1) * ped.dir;
        ped.x += step;
        if (ped.x > WALK_EXTENT) {
          ped.x = WALK_EXTENT;
          ped.dir = Direction.West;
        } else if (ped.x < -WALK_EXTENT) {
          ped.x = -WALK_EXTENT;
          ped.dir = Direction.East;
        }

        // Walk-cycle limb swing (bone-less hierarchical group rotation).
        const t = elapsed * cadence + ped.phase;
        const swing = Math.sin(t) * 0.55;
        const lift = Math.sin(t);
        ped.leftArm.rotation.x = swing;
        ped.rightArm.rotation.x = -swing;
        ped.leftLeg.rotation.x = -swing * 0.9;
        ped.rightLeg.rotation.x = swing * 0.9;
        // Subtle vertical bob for a natural gait.
        ped.hip.position.y = Math.abs(lift) * 0.06;

        // Face the walk direction (+Z forward toward +X when heading East).
        ped.root.position.set(ped.x, 0, SIDEWALK_Z);
        ped.root.rotation.y = ped.dir === Direction.East ? Math.PI / 2 : -Math.PI / 2;
      }
    },
    dispose(): void {
      if (scene) {
        scene.remove(root);
      }
      root.clear();
      crowd.length = 0;
      scene = null;
      currentYear = null;
    },
  };
}