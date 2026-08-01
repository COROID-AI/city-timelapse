/**
 * Rigged pedestrian factory.
 *
 * Builds a low-poly humanoid as a THREE.Group with named bone pivots so the
 * traffic/walk systems can drive a natural walk cycle and idle sway. Each
 * pedestrian is assembled from capsule/box primitives (token-cost friendly) and
 * is varied within an era palette for clothing color, height and silhouette so
 * crowds do not look cloned.
 *
 * Bone hierarchy (origin at the feet, +Y up, facing +Z):
 *
 *   root
 *     pelvis            (hips pivot)
 *       spine
 *         chest         (shoulders pivot)
 *             head      (head pivot)
 *             shoulder_L -> elbow_L -> hand_L
 *             shoulder_R -> elbow_R -> hand_R
 *       hip_L -> knee_L -> ankle_L   (knee/ankle pivots)
 *       hip_R -> knee_R -> ankle_R
 *
 * Public API:
 *   - createPedestrian(spec): PedestrianRig  (a THREE.Group with bone refs)
 *   - rig.walk(t, speed): void                (pose the rig for walking)
 *   - rig.idle(t): void                       (pose the rig for standing)
 */

import * as THREE from 'three';
import type { WalkCycleRig, WalkPose } from '../eras/types';

/** Silhouette / body-type variation driving proportions. */
export type Silhouette = 'masculine' | 'feminine' | 'slender';

/** A clothing color set applied to the torso, legs and (optional) hair. */
export interface PedestrianOutfit {
  /** Torso/shirt color. */
  shirt: THREE.ColorRepresentation;
  /** Trousers/skirt color. */
  legs: THREE.ColorRepresentation;
  /** Skin tone applied to head and hands. */
  skin: THREE.ColorRepresentation;
  /** Optional hair color (falls back to a dark tone when omitted). */
  hair?: THREE.ColorRepresentation;
}

/**
 * Palette of clothing/skin swatches for an era. The factory samples from these
 * to vary each pedestrian within the era's look. Any field may be omitted to
 * fall back to neutral defaults.
 */
export interface PedestrianPalette {
  /** Candidate shirt colors. */
  shirts?: THREE.ColorRepresentation[];
  /** Candidate leg-wear colors. */
  legs?: THREE.ColorRepresentation[];
  /** Candidate skin tones. */
  skins?: THREE.ColorRepresentation[];
  /** Candidate hair colors. */
  hairs?: THREE.ColorRepresentation[];
}

/**
 * Specification for a single pedestrian. Everything except `era` is optional and
 * randomized within era-appropriate bounds when omitted, which is how crowds are
 * typically spawned.
 */
export interface PedestrianSpec {
  /** Era key (1945..2025); selects the default palette and walk cadence. */
  era: 1945 | 1965 | 1985 | 2005 | 2025;
  /** Override the deterministic height (metres). Defaults to era random range. */
  height?: number;
  /** Override the silhouette; randomized when omitted. */
  silhouette?: Silhouette;
  /** Explicit outfit; sampled from the era palette when omitted. */
  outfit?: PedestrianOutfit;
  /** Era palette swatches; falls back to built-in per-era palettes. */
  palette?: PedestrianPalette;
  /** Optional walk-cycle rig; falls back to a built-in natural cycle. */
  walkCycle?: WalkCycleRig;
  /**
   * Seed for deterministic variant selection. When omitted a random variant is
   * produced (useful for crowds, deterministic seed useful for tests).
   */
  seed?: number;
}

/** Named bone pivots exposed on the returned rig for downstream animators. */
export interface PedestrianBones {
  /** Pelvis / hip pivot (root of the spine and both legs). */
  hips: THREE.Object3D;
  /** Spine mid-point between hips and shoulders. */
  spine: THREE.Object3D;
  /** Chest / shoulder pivot (root of both arms and head). */
  shoulders: THREE.Object3D;
  /** Head pivot. */
  head: THREE.Object3D;
  /** Left shoulder pivot. */
  shoulderL: THREE.Object3D;
  /** Right shoulder pivot. */
  shoulderR: THREE.Object3D;
  /** Left elbow pivot. */
  elbowL: THREE.Object3D;
  /** Right elbow pivot. */
  elbowR: THREE.Object3D;
  /** Left hip pivot (top of upper leg). */
  hipL: THREE.Object3D;
  /** Right hip pivot (top of upper leg). */
  hipR: THREE.Object3D;
  /** Left knee pivot. */
  kneeL: THREE.Object3D;
  /** Right knee pivot. */
  kneeR: THREE.Object3D;
  /** Left ankle pivot. */
  ankleL: THREE.Object3D;
  /** Right ankle pivot. */
  ankleR: THREE.Object3D;
}

/**
 * A rigged pedestrian. This is a THREE.Group with extra fields for the named
 * bone pivots and the pose functions consumed by the walk/idle systems.
 */
export interface PedestrianRig extends THREE.Group {
  /** Named bone pivots (hips, knees, ankles, shoulders, elbows, head, ...). */
  bones: PedestrianBones;
  /** Walk-cycle descriptor used by `walk()`. */
  walkCycle: WalkCycleRig;
  /** Resolved height in metres (top of the head above the feet origin). */
  height: number;
  /** Resolved silhouette driving proportions. */
  silhouette: Silhouette;
  /** Resolved outfit actually applied to the meshes. */
  outfit: PedestrianOutfit;
  /** Pose the rig for walking. `t` is seconds, `speed` is m/s (cadence scale). */
  walk: (t: number, speed: number) => void;
  /** Pose the rig for an idle stand with subtle sway. `t` is seconds. */
  idle: (t: number) => void;
}

// ---------------------------------------------------------------------------
// Era palettes and walk cadences
// ---------------------------------------------------------------------------

/**
 * Built-in clothing palettes per era. These are deliberately muted, era-aware
 * swatches so crowds read correctly against each timeline backdrop. Consumers
 * can override any subset via `PedestrianSpec.palette`.
 */
const ERA_PALETTES: Record<PedestrianSpec['era'], Required<PedestrianPalette>> = {
  1945: {
    shirts: ['#3b4a5a', '#6b4f3a', '#8a8d8f', '#5a6b4a', '#4a3b2a'],
    legs: ['#2a2a33', '#3b3b45', '#5a4a3a', '#45413a'],
    skins: ['#e8b894', '#d4a373', '#b07d52', '#8d5524'],
    hairs: ['#2a1a10', '#4a3525', '#5a4030', '#707070'],
  },
  1965: {
    shirts: ['#c8b9a5', '#a87b5b', '#b89a6a', '#7a8a6a', '#d4a5a5'],
    legs: ['#2a2a33', '#4a3b2a', '#5a4a3a', '#606068'],
    skins: ['#e8b894', '#d4a373', '#b07d52', '#8d5524'],
    hairs: ['#2a1a10', '#4a3525', '#6a4030', '#c0a060'],
  },
  1985: {
    shirts: ['#b8403a', '#3a6b8a', '#5a8a5a', '#d4a530', '#8a3a8a'],
    legs: ['#1a1a2a', '#2a2a3a', '#3a3a4a', '#4a3a5a'],
    skins: ['#e8b894', '#d4a373', '#b07d52', '#8d5524'],
    hairs: ['#2a1a10', '#4a3525', '#6a4030', '#8a2020'],
  },
  2005: {
    shirts: ['#2a4a6a', '#6a2a4a', '#4a6a4a', '#6a6a4a', '#3a3a4a'],
    legs: ['#1a1a2a', '#2a2a3a', '#3a3a4a', '#4a3a3a'],
    skins: ['#e8b894', '#d4a373', '#b07d52', '#8d5524'],
    hairs: ['#2a1a10', '#4a3525', '#6a4030', '#707070'],
  },
  2025: {
    shirts: ['#2a7a8a', '#7a2a6a', '#5a8a4a', '#1a2a3a', '#aa3a3a'],
    legs: ['#1a1a2a', '#2a2a3a', '#3a3a4a', '#4a3a4a'],
    skins: ['#e8b894', '#d4a373', '#b07d52', '#8d5524'],
    hairs: ['#2a1a10', '#4a3525', '#6a4030', '#5a5a5a'],
  },
};

/**
 * Default walk-cycle duration (seconds per full stride loop) per era, reflecting
 * the era's typical stride cadence. Overridable via `PedestrianSpec.walkCycle`.
 */
const ERA_WALK_DURATION: Record<PedestrianSpec['era'], number> = {
  1945: 1.15,
  1965: 1.1,
  1985: 1.0,
  2005: 0.95,
  2025: 0.92,
};

/**
 * Default natural walk cycle: four keyframes that swing the legs and arms in
 * opposition with a soft vertical bob. Angles are in radians.
 *
 * The poses describe a half-and-half mirror so interpolating 0->1->2->3->0
 * yields a continuous, natural gait. `leftHip`/`rightHip` are swing angles about
 * the X axis (forward/back), matching the `WalkPose` contract.
 */
const DEFAULT_WALK_CYCLE: WalkPose[] = [
  // Contact: left foot forward, right foot back, arms opposite.
  { leftHip: 0.45, rightHip: -0.45, leftKnee: 0.1, rightKnee: 0.35, leftElbow: 0.5, rightElbow: 0.25, verticalBob: 0.0 },
  // Passing: legs together, highest bob.
  { leftHip: 0.0, rightHip: 0.0, leftKnee: 0.25, rightKnee: 0.25, leftElbow: 0.35, rightElbow: 0.35, verticalBob: 0.04 },
  // Contact: right foot forward, left foot back (mirror of frame 0).
  { leftHip: -0.45, rightHip: 0.45, leftKnee: 0.35, rightKnee: 0.1, leftElbow: 0.25, rightElbow: 0.5, verticalBob: 0.0 },
  // Passing (same as frame 1, keeps the bob symmetric).
  { leftHip: 0.0, rightHip: 0.0, leftKnee: 0.25, rightKnee: 0.25, leftElbow: 0.35, rightElbow: 0.35, verticalBob: 0.04 },
];

// ---------------------------------------------------------------------------
// Proportion helpers
// ---------------------------------------------------------------------------

/** Interpolates between two WalkPoses by `alpha` in [0,1]. */
function lerpPose(a: WalkPose, b: WalkPose, alpha: number): WalkPose {
  const t = alpha;
  return {
    leftHip: a.leftHip + (b.leftHip - a.leftHip) * t,
    rightHip: a.rightHip + (b.rightHip - a.rightHip) * t,
    leftKnee: a.leftKnee + (b.leftKnee - a.leftKnee) * t,
    rightKnee: a.rightKnee + (b.rightKnee - a.rightKnee) * t,
    leftElbow: a.leftElbow + (b.leftElbow - a.leftElbow) * t,
    rightElbow: a.rightElbow + (b.rightElbow - a.rightElbow) * t,
    verticalBob: a.verticalBob + (b.verticalBob - a.verticalBob) * t,
  };
}

/** Tiny deterministic PRNG (mulberry32) so seeded specs are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a random element, guarded against empty arrays. */
function pick<T>(rng: () => number, arr: readonly T[] | undefined, fallback: T): T {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(rng() * arr.length)] as T;
}

/** Builds a mesh with a flat-shaded standard-ish material (MeshStandardLite). */
function makePart(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.0,
    flatShading: true,
  });
  return new THREE.Mesh(geometry, material);
}

/** A capsule part centered on its pivot's origin (geometry offset downward). */
function makeCapsulePart(
  radius: number,
  length: number,
  color: THREE.ColorRepresentation,
): THREE.Mesh {
  // CapsuleGeometry is oriented along Y with its midpoint at the origin; we want
  // the top at the pivot origin so the part hangs below. Shift down by half the
  // total height (cylinder length + 2 * radius caps).
  const totalHeight = length + radius * 2;
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 8);
  geo.translate(0, -totalHeight / 2, 0);
  return makePart(geo, color);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Builds a rigged pedestrian per `spec`.
 *
 * The returned `PedestrianRig` is a `THREE.Group` whose origin sits at the
 * feet (ground contact) and which looks down the +Z axis. Named bone pivots are
 * available on `rig.bones` (hips, kneeL/R, ankleL/R, shoulders, elbowL/R,
 * head, etc.) and the pose functions `rig.walk(t, speed)` and `rig.idle(t)` are
 * ready to call each frame.
 *
 * Variation: height, silhouette and outfit are randomized within era bounds
 * when not supplied, so spawning many pedestrians yields a varied crowd.
 */
export function createPedestrian(spec: PedestrianSpec): PedestrianRig {
  const rng = mulberry32(spec.seed ?? (Math.random() * 0xffffffff) >>> 0);
  const basePalette = ERA_PALETTES[spec.era];
  const palette: Required<PedestrianPalette> = {
    shirts: spec.palette?.shirts ?? basePalette.shirts,
    legs: spec.palette?.legs ?? basePalette.legs,
    skins: spec.palette?.skins ?? basePalette.skins,
    hairs: spec.palette?.hairs ?? basePalette.hairs,
  };

  // Resolve variation.
  const silhouette: Silhouette = spec.silhouette ??
    (['masculine', 'feminine', 'slender'] as const)[Math.floor(rng() * 3)];
  // Era-typical adult heights (metres), varied by silhouette.
  const heightBase = spec.height ?? (1.62 + rng() * 0.22);
  const silhouetteScale = silhouette === 'masculine' ? 1.06 : silhouette === 'feminine' ? 0.98 : 0.92;
  const height = THREE.MathUtils.clamp(heightBase * silhouetteScale, 1.4, 2.1);

  // Resolve outfit.
  const outfit: Required<PedestrianOutfit> = {
    shirt: spec.outfit?.shirt ?? pick(rng, palette.shirts, '#6a6a6a'),
    legs: spec.outfit?.legs ?? pick(rng, palette.legs, '#2a2a33'),
    skin: spec.outfit?.skin ?? pick(rng, palette.skins, '#d4a373'),
    hair: spec.outfit?.hair ?? pick(rng, palette.hairs, '#2a1a10'),
  };

  // Walk cycle (use provided rig or built-in).
  const walkCycle: WalkCycleRig = spec.walkCycle ?? {
    duration: ERA_WALK_DURATION[spec.era],
    poses: DEFAULT_WALK_CYCLE,
  };

  // -----------------------------------------------------------------
  // Proportions (scaled to height). All values in metres relative to feet.
  // -----------------------------------------------------------------
  const shoulderWidth = silhouette === 'masculine' ? 0.46 : silhouette === 'feminine' ? 0.38 : 0.34;
  const hipWidth = silhouette === 'masculine' ? 0.34 : silhouette === 'feminine' ? 0.38 : 0.3;
  // Segment lengths as fractions of total height.
  const shinLen = height * 0.25;
  const thighLen = height * 0.25;
  const torsoLen = height * 0.3;
  const upperArmLen = height * 0.18;
  const foreArmLen = height * 0.16;
  const neckLen = height * 0.04;
  const headRadius = height * 0.06;

  const limbRadius = 0.055;
  const torsoRadius = shoulderWidth * 0.55;

  // -----------------------------------------------------------------
  // Build the bone hierarchy.
  // -----------------------------------------------------------------
  const root = new THREE.Group();
  root.name = 'pedestrian';

  // Hips / pelvis pivot at leg-top height.
  const hips = new THREE.Object3D();
  hips.name = 'hips';
  hips.position.y = thighLen + shinLen;
  root.add(hips);

  // Pelvis mesh (torso root visual).
  const pelvisMesh = makeCapsulePart(torsoRadius * 0.8, 0.06, outfit.legs);
  hips.add(pelvisMesh);

  // Spine pivot.
  const spine = new THREE.Object3D();
  spine.name = 'spine';
  spine.position.y = -torsoLen * 0.45;
  hips.add(spine);

  // Chest / shoulders pivot.
  const shoulders = new THREE.Object3D();
  shoulders.name = 'shoulders';
  shoulders.position.y = -torsoLen * 0.55;
  spine.add(shoulders);

  // Torso visual (shirt) hanging from shoulders down to hips.
  const torsoGeo = new THREE.CapsuleGeometry(torsoRadius, torsoLen * 0.5, 6, 12);
  // Center the torso roughly between shoulders and hips.
  torsoGeo.translate(0, -torsoLen * 0.25, 0);
  const torsoMesh = makePart(torsoGeo, outfit.shirt);
  shoulders.add(torsoMesh);

  // Neck + head pivot.
  const head = new THREE.Object3D();
  head.name = 'head';
  head.position.y = -(neckLen + headRadius);
  shoulders.add(head);

  // Head mesh (skin).
  const headGeo = new THREE.IcosahedronGeometry(headRadius, 1);
  headGeo.translate(0, -headRadius, 0);
  const headMesh = makePart(headGeo, outfit.skin);
  head.add(headMesh);

  // Hair cap (slightly larger, sits on top of the head).
  const hairGeo = new THREE.IcosahedronGeometry(headRadius * 1.05, 1);
  hairGeo.translate(0, -headRadius * 0.2, -headRadius * 0.1);
  const hairMesh = makePart(hairGeo, outfit.hair);
  head.add(hairMesh);

  // --- Arms (mirrored) ---
  function buildArm(side: 'L' | 'R'): { shoulder: THREE.Object3D; elbow: THREE.Object3D } {
    const sign = side === 'L' ? 1 : -1;
    const shoulder = new THREE.Object3D();
    shoulder.name = `shoulder_${side}`;
    shoulder.position.set(sign * (shoulderWidth * 0.5), 0, 0);
    shoulders.add(shoulder);

    // Upper arm (shirt sleeve).
    const upperArm = makeCapsulePart(limbRadius, upperArmLen, outfit.shirt);
    shoulder.add(upperArm);

    const elbow = new THREE.Object3D();
    elbow.name = `elbow_${side}`;
    elbow.position.y = -(upperArmLen + limbRadius * 2);
    shoulder.add(elbow);

    // Forearm + hand (skin).
    const forearm = makeCapsulePart(limbRadius * 0.9, foreArmLen, outfit.skin);
    elbow.add(forearm);

    return { shoulder, elbow };
  }

  const armL = buildArm('L');
  const armR = buildArm('R');

  // --- Legs (mirrored) ---
  function buildLeg(side: 'L' | 'R'): { hip: THREE.Object3D; knee: THREE.Object3D; ankle: THREE.Object3D } {
    const sign = side === 'L' ? 1 : -1;
    const hip = new THREE.Object3D();
    hip.name = `hip_${side}`;
    hip.position.set(sign * (hipWidth * 0.5), 0, 0);
    hips.add(hip);

    // Thigh (legs/trousers).
    const thigh = makeCapsulePart(limbRadius, thighLen, outfit.legs);
    hip.add(thigh);

    const knee = new THREE.Object3D();
    knee.name = `knee_${side}`;
    knee.position.y = -(thighLen + limbRadius * 2);
    hip.add(knee);

    // Shin (legs/trousers).
    const shin = makeCapsulePart(limbRadius * 0.9, shinLen, outfit.legs);
    knee.add(shin);

    const ankle = new THREE.Object3D();
    ankle.name = `ankle_${side}`;
    ankle.position.y = -(shinLen + limbRadius * 2);
    knee.add(ankle);

    // Foot (shoes).
    const footGeo = new THREE.BoxGeometry(0.1, 0.05, 0.22);
    footGeo.translate(0, -0.025, 0.05);
    const footMesh = makePart(footGeo, '#1a1a1a');
    ankle.add(footMesh);

    return { hip, knee, ankle };
  }

  const legL = buildLeg('L');
  const legR = buildLeg('R');

  // -----------------------------------------------------------------
  // Assemble rig.
  // -----------------------------------------------------------------
  const bones: PedestrianBones = {
    hips,
    spine,
    shoulders,
    head,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
    ankleL: legL.ankle,
    ankleR: legR.ankle,
  };

  const rig = root as PedestrianRig;
  rig.bones = bones;
  rig.walkCycle = walkCycle;
  rig.height = height;
  rig.silhouette = silhouette;
  rig.outfit = outfit;

  // -----------------------------------------------------------------
  // Pose functions.
  // -----------------------------------------------------------------

  /**
   * Drives a walk cycle. `t` is elapsed seconds, `speed` is m/s and scales the
   * stride cadence (faster walk = faster cadence). The hips bob vertically and
   * the legs/arms swing in opposition for a natural gait.
   */
  rig.walk = (t: number, speed: number): void => {
    const cycle = rig.walkCycle;
    const cadence = Math.max(0.1, speed);
    const phase = ((t * cadence) / Math.max(0.1, cycle.duration)) % 1;
    const poses = cycle.poses.length > 0 ? cycle.poses : DEFAULT_WALK_CYCLE;
    const n = poses.length;
    const scaled = phase * n;
    const i0 = Math.floor(scaled) % n;
    const i1 = (i0 + 1) % n;
    const alpha = scaled - Math.floor(scaled);
    const pose = lerpPose(poses[i0] as WalkPose, poses[i1] as WalkPose, alpha);

    // Vertical bob at the pelvis.
    hips.position.y = thighLen + shinLen + pose.verticalBob * height;

    // Legs swing about the X axis (forward/back). Knees bend in the swing direction.
    bones.hipL.rotation.x = pose.leftHip;
    bones.hipR.rotation.x = pose.rightHip;
    bones.kneeL.rotation.x = -Math.abs(pose.leftKnee);
    bones.kneeR.rotation.x = -Math.abs(pose.rightKnee);

    // Arms swing opposite to the legs (natural counterbalance). Shoulders drive
    // the swing; elbows bend slightly.
    bones.shoulderL.rotation.x = -pose.leftHip * 0.9;
    bones.shoulderR.rotation.x = -pose.rightHip * 0.9;
    bones.elbowL.rotation.x = -pose.leftElbow * 0.5;
    bones.elbowR.rotation.x = -pose.rightElbow * 0.5;

    // Subtle torso twist to sell the stride.
    bones.shoulders.rotation.y = pose.leftHip * 0.25;
    bones.hips.rotation.y = -pose.leftHip * 0.2;
  };

  /**
   * Drives an idle pose: a gentle breathing sway with weight shifts and small
n   * arm relaxation. `t` is elapsed seconds.
   */
  rig.idle = (t: number): void => {
    const breathe = Math.sin(t * 1.5) * 0.5 + 0.5;
    const sway = Math.sin(t * 0.8) * 0.5 + 0.5;

    // Reset limb rotations to a neutral stance.
    bones.hipL.rotation.x = 0;
    bones.hipR.rotation.x = 0;
    bones.kneeL.rotation.x = -0.05;
    bones.kneeR.rotation.x = -0.05;
    bones.shoulderL.rotation.x = 0;
    bones.shoulderR.rotation.x = 0;
    bones.elbowL.rotation.x = -0.2;
    bones.elbowR.rotation.x = -0.2;
    bones.hips.rotation.y = 0;
    bones.shoulders.rotation.y = 0;

    // Breathing: tiny vertical bob and shoulder rise.
    hips.position.y = thighLen + shinLen + breathe * 0.01 * height;
    bones.shoulders.rotation.x = -breathe * 0.03;

    // Weight shift: slow side-to-side sway at the spine and head.
    bones.spine.rotation.z = sway * 0.02 - 0.01;
    bones.head.rotation.z = -sway * 0.03;
    bones.head.rotation.y = Math.sin(t * 0.5) * 0.05;

    // Arms relax outward slightly with the sway.
    bones.shoulderL.rotation.z = 0.05 + sway * 0.02;
    bones.shoulderR.rotation.z = -0.05 - sway * 0.02;
  };

  // Initialize to a neutral idle frame so the rig is never in a T-pose at spawn.
  rig.idle(0);

  return rig;
}
