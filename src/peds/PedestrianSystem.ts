/**
 * PedestrianSystem — the Three.js visual layer for the walking population.
 *
 * Builds low-poly humanoid figures from parametric geometry, skins them with
 * era-correct outfit color sets (suits/hats → mod → sportswear →
 * low-rise/athleisure → futuristic smart-fabric), animates a simple walk cycle
 * (leg/arm swing + torso bob), and registers a TransitionManager domain so the
 * whole population cross-fades its outfits when the era changes — *never
 * rebuilding the scene graph*.
 *
 * The locomotion brain (path following, crosswalk right-of-way, separation)
 * lives in the framework-free {@link file://./pedestrianAgent.ts}. This module
 * owns the meshes and drives them from the agent state every frame.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { lerp, lerpHex, type ApplyEraFn, type EraKey } from '../eras/eraConfig.js';
import type { RoadNetwork } from '../world/roadNetwork.js';
import type { TrafficLightController } from '../world/trafficLight.js';
import {
  type PedestrianAgent,
  buildWalkGraph,
  createAgent,
  stepAgents,
} from './pedestrianAgent.js';

// ---------------------------------------------------------------------------
// Population cap
// ---------------------------------------------------------------------------

/** Maximum concurrent pedestrians (the system never exceeds this). */
const DEFAULT_MAX_PEDESTRIANS = 18;

// ---------------------------------------------------------------------------
// Era outfit palettes
// ---------------------------------------------------------------------------

/**
 * Colour set for one outfit. Each era exposes exactly three outfits (matching
 * the `outfits` identifiers in `eraConfig.ts`); a pedestrian keeps a stable
 * slot index so it always wears the corresponding era-correct look.
 */
interface OutfitPalette {
  /** Exposed skin tone (face + hands). */
  skin: string;
  /** Shirt / jacket / top colour. */
  shirt: string;
  /** Trousers / skirt / lower-body colour. */
  pants: string;
  /** Footwear colour. */
  shoes: string;
  /** Hair colour (and hat band where applicable). */
  hair: string;
  /** Emissive accent — used for futuristic smart-fabric glow. */
  accent: string;
}

/**
 * Silhouette modifier per era: which accessories are present and how the
 * proportions read (big-hair eras, low-rise eras, etc.). This is the *shape*
 * vocabulary; {@link OutfitPalette} is the colour vocabulary.
 */
interface SilhouetteProfile {
  /** Headgear archetype (toggles a mesh). */
  hat: 'fedora' | 'cap' | 'none';
  /** Hair bulk multiplier (1 = normal, >1 = "big hair"). */
  hairScale: number;
  /** Shoulder breadth multiplier. */
  shoulderScale: number;
  /** Torso/hip proportion ("low-rise" lowers the hip line slightly). */
  lowRise: boolean;
  /** Carries a hand-held device (early-smartphone / phone eras). */
  hasPhone: boolean;
  /** Wears a face covering (2025 masks-optional). */
  hasMask: boolean;
  /** Smart-fabric emissive accent strength [0,1] (2055). */
  emissiveAccent: number;
}

/**
 * Per-era outfit definition: three colour palettes + one shared silhouette.
 * The palette indices line up with the `outfits` array in `eraConfig.ts`.
 */
interface EraOutfitDef {
  /** Era-matching archetype names (for traceability; mirrors eraConfig). */
  archetypes: readonly [string, string, string];
  /** Three colour sets, one per archetype. */
  palettes: readonly [OutfitPalette, OutfitPalette, OutfitPalette];
  /** Shared silhouette for the era. */
  silhouette: SilhouetteProfile;
}

/**
 * The full era-correct wardrobe. Colours are chosen to read as the era at a
 * glance: 1945 muted suiting/wartime, 1965 pastel mod, 1985 saturated neon
 * sportswear + denim, 2005 low-rise denim + polos, 2025 athleisure neutrals,
 * 2055 sleek futuristic minimal with a glow accent.
 */
const ERA_OUTFITS: Record<EraKey, EraOutfitDef> = {
  '1945': {
    archetypes: ['suit_fedora', 'house_dress', 'overalls'],
    palettes: [
      { skin: '#e3b48a', shirt: '#3a3f4a', pants: '#2c2f36', shoes: '#1c1e22', hair: '#3a2a1a', accent: '#000000' },
      { skin: '#eac5a0', shirt: '#6b4f5a', pants: '#4a3a44', shoes: '#2a2024', hair: '#4a3526', accent: '#000000' },
      { skin: '#c8946a', shirt: '#7a6a4a', pants: '#5a5036', shoes: '#322a1e', hair: '#2a1e12', accent: '#000000' },
    ],
    silhouette: { hat: 'fedora', hairScale: 0.9, shoulderScale: 1.0, lowRise: false, hasPhone: false, hasMask: false, emissiveAccent: 0 },
  },
  '1965': {
    archetypes: ['mod_dress', 'slacks_sweater', 'business_suit'],
    palettes: [
      { skin: '#eabf96', shirt: '#d86a8a', pants: '#f0f0f4', shoes: '#f4f0e8', hair: '#5a3a26', accent: '#000000' },
      { skin: '#e0b088', shirt: '#9ac4d6', pants: '#3a4250', shoes: '#2a2e34', hair: '#3a2a1e', accent: '#000000' },
      { skin: '#eac5a0', shirt: '#2a2f3a', pants: '#4a4f5a', shoes: '#1c1e22', hair: '#2a2018', accent: '#000000' },
    ],
    silhouette: { hat: 'none', hairScale: 1.0, shoulderScale: 0.95, lowRise: false, hasPhone: false, hasMask: false, emissiveAccent: 0 },
  },
  '1985': {
    archetypes: ['power_suit', 'denim_jacket', 'tracksuit'],
    palettes: [
      { skin: '#e8b890', shirt: '#c8344a', pants: '#2a2f3a', shoes: '#1c1e22', hair: '#2a1a0e', accent: '#000000' },
      { skin: '#e0b088', shirt: '#5a7ab0', pants: '#3a6aa0', shoes: '#e8e4dc', hair: '#1a1208', accent: '#000000' },
      { skin: '#eac5a0', shirt: '#f0a030', pants: '#3a8ad0', shoes: '#f4f0e8', hair: '#221a10', accent: '#000000' },
    ],
    silhouette: { hat: 'none', hairScale: 1.55, shoulderScale: 1.12, lowRise: false, hasPhone: false, hasMask: false, emissiveAccent: 0 },
  },
  '2005': {
    archetypes: ['smart_casual', 'hoodie_jeans', 'business_modern'],
    palettes: [
      { skin: '#eabf96', shirt: '#d8dce4', pants: '#4a6a9a', shoes: '#2a2e34', hair: '#3a2a1e', accent: '#000000' },
      { skin: '#e0b088', shirt: '#6a707a', pants: '#3a5a8a', shoes: '#f4f0e8', hair: '#2a2018', accent: '#000000' },
      { skin: '#c8946a', shirt: '#2a2f3a', pants: '#1c1e22', shoes: '#1a1a1e', hair: '#1a1208', accent: '#000000' },
    ],
    silhouette: { hat: 'none', hairScale: 1.0, shoulderScale: 1.05, lowRise: true, hasPhone: true, hasMask: false, emissiveAccent: 0 },
  },
  '2025': {
    archetypes: ['athleisure', 'tech_wear', 'minimalist'],
    palettes: [
      { skin: '#eabf96', shirt: '#3a3f4a', pants: '#2c2f36', shoes: '#f4f0e8', hair: '#2a2018', accent: '#000000' },
      { skin: '#d8a878', shirt: '#1a1e24', pants: '#2a2f36', shoes: '#1a1a1e', hair: '#1a1208', accent: '#5ad0e0' },
      { skin: '#eac5a0', shirt: '#e8e8ec', pants: '#9a9aa0', shoes: '#f4f0e8', hair: '#3a2a1e', accent: '#000000' },
    ],
    silhouette: { hat: 'cap', hairScale: 0.95, shoulderScale: 1.02, lowRise: false, hasPhone: true, hasMask: false, emissiveAccent: 0.05 },
  },
  '2055': {
    archetypes: ['smart_fabric', 'utility_exo', 'climate_suit'],
    palettes: [
      { skin: '#d8a878', shirt: '#2a3a4a', pants: '#1a2838', shoes: '#0e1620', hair: '#1a1208', accent: '#5affd0' },
      { skin: '#e0b088', shirt: '#3a4a5a', pants: '#243240', shoes: '#12181f', hair: '#2a2018', accent: '#b08aff' },
      { skin: '#c8946a', shirt: '#c8d8e8', pants: '#a8b8c8', shoes: '#8898a8', hair: '#1a1208', accent: '#80ffd0' },
    ],
    silhouette: { hat: 'none', hairScale: 0.85, shoulderScale: 1.0, lowRise: false, hasPhone: false, hasMask: false, emissiveAccent: 0.55 },
  },
};

// ---------------------------------------------------------------------------
// Humanoid body constants (world units; ~1.7 m figure)
// ---------------------------------------------------------------------------

const LEG_LEN = 0.78;
const LEG_RAD = 0.13;
const TORSO_LEN = 0.52;
const TORSO_RAD = 0.2;
const HEAD_SIZE = 0.26;
const ARM_LEN = 0.54;
const ARM_RAD = 0.085;
const HIP_WIDTH = 0.21;
const SHOULDER_WIDTH = 0.24;

/** Walk-cycle limb swing amplitude (radians). */
const SWING_AMP = 0.5;
/** Walk-cycle torso bob amplitude (world units). */
const BOB_AMP = 0.03;

// ---------------------------------------------------------------------------
// Humanoid mesh
// ---------------------------------------------------------------------------

/**
 * The animatable parts of one low-poly humanoid. Limbs are parented to pivot
 * groups positioned at the hip/shoulder joints so a rotation swings the limb.
 */
interface HumanoidParts {
  /** Root group placed in world space. */
  root: Group;
  /** Body container (bobbed each frame). */
  body: Group;
  /** Head (for hair/hat scale tweaks per era). */
  head: Mesh;
  /** Hair bulk (scaled per era for "big hair"). */
  hair: Mesh;
  /** Fedora brim + crown (toggled per era). */
  hatBrim: Mesh;
  hatCrown: Mesh;
  /** Cap (toggled per era). */
  cap: Mesh;
  /** Face covering (toggled per era). */
  mask: Mesh;
  /** Hand-held device (toggled per era). */
  phone: Mesh;
  /** Left/right leg pivot groups (walk-cycle swing). */
  legL: Group;
  legR: Group;
  /** Left/right arm pivot groups (walk-cycle swing). */
  armL: Group;
  armR: Group;
  /** Leg capsules (children of the pivot groups) — direct material refs. */
  legLMesh: Mesh;
  legRMesh: Mesh;
  /** Arm capsules (children of the pivot groups) — direct material refs. */
  armLMesh: Mesh;
  armRMesh: Mesh;
}

/** Materials owned by one humanoid (lerped every frame during a transition). */
interface HumanoidMats {
  skin: MeshStandardMaterial;
  shirt: MeshStandardMaterial;
  pants: MeshStandardMaterial;
  shoes: MeshStandardMaterial;
  hair: MeshStandardMaterial;
  accent: MeshStandardMaterial;
}

/** A fully-wired pedestrian: its agent brain + its visual humanoid. */
interface PedestrianInstance {
  agent: PedestrianAgent;
  parts: HumanoidParts;
  mats: HumanoidMats;
  /** Stable slot in [0,2] selecting which of the three era outfits it wears. */
  slot: number;
}

// ---------------------------------------------------------------------------
// Public module interface
// ---------------------------------------------------------------------------

/** Options for {@link createPedestrianSystem}. */
export interface PedestrianSystemOptions {
  /** Maximum concurrent pedestrians. Defaults to {@link DEFAULT_MAX_PEDESTRIANS}. */
  maxPedestrians?: number;
}

/** Public interface for the pedestrian system. */
export interface PedestrianSystem {
  /** Root group containing every humanoid — add this to the scene. */
  group: Group;
  /**
   * Era-application callback. Register this with
   * `TransitionManager.registerDomain('pedestrians', module.applyEra)`.
   */
  applyEra: ApplyEraFn;
  /** Advance the population one frame; call from the render loop with ms. */
  update: (deltaMs: number) => void;
  /** Current live population count (never exceeds the cap). */
  getPopulation: () => number;
  /** Release GPU resources owned by the system. */
  dispose: () => void;
}

/**
 * Create the pedestrian system: builds the walk graph from the shared road
 * network, spawns a capped population of low-poly humanoids on the sidewalk
 * lanes, and wires a cross-fading era domain.
 *
 * @param network    Shared road network (walking + crosswalk lanes consumed).
 * @param controller Traffic-light controller used for crosswalk right-of-way.
 * @param initialEra Era the population should appear in on first frame.
 */
export function createPedestrianSystem(
  network: RoadNetwork,
  controller: TrafficLightController,
  initialEra: EraKey = '1945',
  options: PedestrianSystemOptions = {},
): PedestrianSystem {
  const group = new Group();
  group.name = 'pedestrians';

  const max = options.maxPedestrians ?? DEFAULT_MAX_PEDESTRIANS;
  const graph = buildWalkGraph(network);

  const instances: PedestrianInstance[] = [];

  // Spawn the capped population. Each agent is placed on a random walking
  // segment; its outfit slot is stable so era swaps are coherent.
  const population = Math.min(max, countWalkJunctions(graph) > 0 ? max : 0);
  for (let i = 0; i < population; i++) {
    const agent = createAgent(i, graph);
    const parts = buildHumanoid(i);
    const mats = createMaterials(initialEra, i % 3);
    wireMaterials(parts, mats);
    group.add(parts.root);

    const inst: PedestrianInstance = { agent, parts, mats, slot: i % 3 };
    instances.push(inst);
    // Apply the initial era silhouette so accessories read correctly on load.
    applyOutfitToHumanoid(inst, initialEra, 1, initialEra);
  }

  // ---- applyEra: cross-fade outfit colours + swap silhouette per pedestrian --
  const applyEra: ApplyEraFn = (toKey, t, fromKey) => {
    for (const inst of instances) {
      applyOutfitToHumanoid(inst, toKey, t, fromKey);
    }
  };

  // ---- update: step the simulation, then drive the meshes -----------------
  function update(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    const agents = instances.map((i) => i.agent);
    stepAgents(agents, deltaSec, graph, controller);
    for (const inst of instances) {
      driveMesh(inst);
    }
  }

  function getPopulation(): number {
    return instances.length;
  }

  function dispose(): void {
    for (const inst of instances) {
      disposeHumanoid(inst);
    }
    group.clear();
  }

  return { group, applyEra, update, getPopulation, dispose };
}

// ---------------------------------------------------------------------------
// Era outfit application (the cross-fade)
// ---------------------------------------------------------------------------

/**
 * Apply the era-correct outfit to a humanoid, cross-fading colours from the
 * source era to the destination era over `t` in [0,1] and swapping the
 * discrete silhouette (accessories + proportions) at the midpoint — exactly
 * the pattern storefronts use for sign textures, so the population morphs
 * smoothly without ever rebuilding geometry.
 */
function applyOutfitToHumanoid(
  inst: PedestrianInstance,
  toKey: EraKey,
  t: number,
  fromKey: EraKey,
): void {
  const fromP = ERA_OUTFITS[fromKey].palettes[inst.slot];
  const toP = ERA_OUTFITS[toKey].palettes[inst.slot];

  // Continuous colour cross-fade across every body part.
  inst.mats.skin.color.set(lerpHex(fromP.skin, toP.skin, t));
  inst.mats.shirt.color.set(lerpHex(fromP.shirt, toP.shirt, t));
  inst.mats.pants.color.set(lerpHex(fromP.pants, toP.pants, t));
  inst.mats.shoes.color.set(lerpHex(fromP.shoes, toP.shoes, t));
  inst.mats.hair.color.set(lerpHex(fromP.hair, toP.hair, t));
  inst.mats.accent.color.set(lerpHex(fromP.accent, toP.accent, t));

  // Emissive accent strength cross-fade (futuristic smart-fabric glow).
  const fromEm = ERA_OUTFITS[fromKey].silhouette.emissiveAccent;
  const toEm = ERA_OUTFITS[toKey].silhouette.emissiveAccent;
  const em = lerp(fromEm, toEm, t);
  inst.mats.shirt.emissive.set(inst.mats.shirt.color);
  inst.mats.shirt.emissiveIntensity = em * 0.6;
  inst.mats.accent.emissive.set(inst.mats.accent.color);
  inst.mats.accent.emissiveIntensity = em;

  // Discrete silhouette swap at the midpoint (source for t<0.5, dest after).
  const silhouette = t < 0.5
    ? ERA_OUTFITS[fromKey].silhouette
    : ERA_OUTFITS[toKey].silhouette;
  applySilhouette(inst.parts, silhouette);
}

/**
 * Toggle/scale the accessory meshes and proportions for one silhouette. This
 * mutates only transforms and visibility — never geometry — so it is cheap and
 * safe to call every frame.
 */
function applySilhouette(parts: HumanoidParts, s: SilhouetteProfile): void {
  // Headgear: exactly one of fedora / cap / none is visible.
  const isFedora = s.hat === 'fedora';
  const isCap = s.hat === 'cap';
  parts.hatBrim.visible = isFedora;
  parts.hatCrown.visible = isFedora;
  parts.cap.visible = isCap;

  // Hair bulk ("big hair" 1985 grows the hair sphere).
  parts.hair.scale.setScalar(s.hairScale);
  // When a hat covers the crown, shrink the hair so it does not poke through.
  if (isFedora || isCap) {
    parts.hair.scale.y *= 0.4;
  }

  // Shoulder breadth.
  parts.armL.position.x = -SHOULDER_WIDTH * 0.5 * s.shoulderScale;
  parts.armR.position.x = SHOULDER_WIDTH * 0.5 * s.shoulderScale;

  // Low-rise hip line (2005) drops the leg pivots slightly.
  const hipY = s.lowRise ? -0.04 : 0;
  parts.legL.position.y = hipY;
  parts.legR.position.y = hipY;

  // Accessories.
  parts.phone.visible = s.hasPhone;
  parts.mask.visible = s.hasMask;
}

// ---------------------------------------------------------------------------
// Per-frame mesh driving (walk cycle)
// ---------------------------------------------------------------------------

/**
 * Drive one humanoid's meshes from its agent state: place the root, set the
 * facing, bob the torso, and swing the limbs via the walk cycle phase. While
 * the agent is waiting at a crosswalk the limbs ease to a neutral stance.
 */
function driveMesh(inst: PedestrianInstance): void {
  const { agent, parts } = inst;

  parts.root.position.set(agent.position.x, 0, agent.position.z);
  parts.root.rotation.y = agent.facing;

  if (agent.waiting) {
    // Standing still: ease limbs toward neutral.
    parts.legL.rotation.x = damp(parts.legL.rotation.x, 0, 0.2);
    parts.legR.rotation.x = damp(parts.legR.rotation.x, 0, 0.2);
    parts.armL.rotation.x = damp(parts.armL.rotation.x, 0, 0.2);
    parts.armR.rotation.x = damp(parts.armR.rotation.x, 0, 0.2);
    parts.body.position.y = damp(parts.body.position.y, 0, 0.2);
    return;
  }

  // Walk cycle: opposite legs, opposing arms, slight torso bob on each step.
  const s = Math.sin(agent.phase);
  parts.legL.rotation.x = s * SWING_AMP;
  parts.legR.rotation.x = -s * SWING_AMP;
  parts.armL.rotation.x = -s * SWING_AMP * 0.8;
  parts.armR.rotation.x = s * SWING_AMP * 0.8;
  parts.body.position.y = Math.abs(Math.sin(agent.phase)) * BOB_AMP;
}

/** Frame-rate-ish exponential damp toward a target. */
function damp(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

// ---------------------------------------------------------------------------
// Humanoid construction
// ---------------------------------------------------------------------------

/**
 * Build one low-poly humanoid from parametric capsule/box geometry. Limbs are
 * parented to pivot groups at the joints so the walk cycle needs only rotation.
 * All accessory meshes are created up-front and toggled by visibility per era.
 */
function buildHumanoid(id: number): HumanoidParts {
  const root = new Group();
  root.name = `ped-${id}`;
  // Small per-ped variance so the population is not lockstep-identical.
  root.scale.setScalar(0.96 + (id % 5) * 0.012);

  const body = new Group();
  body.name = 'body';
  root.add(body);

  // Shared, reusable geometry (capsules give a clean low-poly silhouette).
  const limbGeom = new CapsuleGeometry(LEG_RAD, LEG_LEN, 3, 6);
  const armGeom = new CapsuleGeometry(ARM_RAD, ARM_LEN, 3, 6);
  const torsoGeom = new CapsuleGeometry(TORSO_RAD, TORSO_LEN, 4, 8);
  const headGeom = new BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE);

  // --- Legs (pivot at the hip, capsule hangs below) ------------------------
  const legPair = makeLimbPivot(limbGeom, 'legL');
  const legL = legPair.pivot;
  const legLMesh = legPair.mesh;
  legL.position.set(-HIP_WIDTH, LEG_LEN, 0);
  const legRPair = makeLimbPivot(limbGeom, 'legR');
  const legR = legRPair.pivot;
  const legRMesh = legRPair.mesh;
  legR.position.set(HIP_WIDTH, LEG_LEN, 0);
  body.add(legL, legR);

  // --- Torso ---------------------------------------------------------------
  const torso = new Mesh(torsoGeom, undefined);
  torso.name = 'torso';
  torso.position.y = LEG_LEN + TORSO_LEN / 2 + TORSO_RAD;
  body.add(torso);

  // --- Arms (pivot at the shoulder, capsule hangs below) -------------------
  const shoulderY = LEG_LEN + TORSO_LEN + TORSO_RAD * 0.4;
  const armPair = makeLimbPivot(armGeom, 'armL');
  const armL = armPair.pivot;
  const armLMesh = armPair.mesh;
  armL.position.set(-SHOULDER_WIDTH * 0.5, shoulderY, 0);
  const armRPair = makeLimbPivot(armGeom, 'armR');
  const armR = armRPair.pivot;
  const armRMesh = armRPair.mesh;
  armR.position.set(SHOULDER_WIDTH * 0.5, shoulderY, 0);
  body.add(armL, armR);

  // --- Head ----------------------------------------------------------------
  const neckY = shoulderY + TORSO_LEN * 0.5 + HEAD_SIZE * 0.5;
  const head = new Mesh(headGeom, undefined);
  head.name = 'head';
  head.position.y = neckY + HEAD_SIZE * 0.1;
  body.add(head);

  // --- Hair (a slightly larger box behind/over the head) -------------------
  const hair = new Mesh(new BoxGeometry(HEAD_SIZE * 1.04, HEAD_SIZE * 0.9, HEAD_SIZE * 1.04), undefined);
  hair.name = 'hair';
  hair.position.y = neckY + HEAD_SIZE * 0.12;
  hair.visible = true;
  body.add(hair);

  // --- Hat: fedora (brim + crown) -----------------------------------------
  const hatBrim = new Mesh(new BoxGeometry(HEAD_SIZE * 1.7, 0.04, HEAD_SIZE * 1.7), undefined);
  hatBrim.name = 'hatBrim';
  hatBrim.position.y = neckY + HEAD_SIZE * 0.5;
  const hatCrown = new Mesh(new BoxGeometry(HEAD_SIZE * 1.05, HEAD_SIZE * 0.7, HEAD_SIZE * 1.05), undefined);
  hatCrown.name = 'hatCrown';
  hatCrown.position.y = neckY + HEAD_SIZE * 0.7;
  hatBrim.visible = false;
  hatCrown.visible = false;
  body.add(hatBrim, hatCrown);

  // --- Cap -----------------------------------------------------------------
  const cap = new Mesh(new BoxGeometry(HEAD_SIZE * 1.05, HEAD_SIZE * 0.45, HEAD_SIZE * 1.05), undefined);
  cap.name = 'cap';
  cap.position.y = neckY + HEAD_SIZE * 0.45;
  cap.visible = false;
  body.add(cap);

  // --- Mask (thin slab across the lower face) ------------------------------
  const mask = new Mesh(new BoxGeometry(HEAD_SIZE * 1.02, HEAD_SIZE * 0.4, 0.04), undefined);
  mask.name = 'mask';
  mask.position.set(0, neckY - HEAD_SIZE * 0.1, HEAD_SIZE * 0.5);
  mask.visible = false;
  body.add(mask);

  // --- Phone (small slab held at the right hand) ---------------------------
  const phone = new Mesh(new BoxGeometry(0.1, 0.18, 0.02), undefined);
  phone.name = 'phone';
  // Attach to the right arm pivot so it moves with the swing.
  phone.position.set(0, -ARM_LEN - 0.1, 0.06);
  phone.visible = false;
  armR.add(phone);

  // All meshes cast shadows for scene cohesion.
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true;
    }
  });

  return {
    root, body, head, hair, hatBrim, hatCrown, cap, mask, phone,
    legL, legR, armL, armR,
    legLMesh, legRMesh, armLMesh, armRMesh,
  };
}

/** A limb pivot group and its hanging capsule mesh. */
interface LimbPivot {
  pivot: Group;
  mesh: Mesh;
}

/** Create a limb pivot group with a capsule mesh hanging below the pivot. */
function makeLimbPivot(geom: CapsuleGeometry, name: string): LimbPivot {
  const pivot = new Group();
  pivot.name = name;
  const mesh = new Mesh(geom, undefined);
  // CapsuleGeometry is centred; shift down so the pivot sits at the top joint.
  mesh.position.y = -(geom.parameters.height as number) / 2 - (geom.parameters.radius as number);
  pivot.add(mesh);
  return { pivot, mesh };
}

/** Create the six materials for a humanoid, initialised to an era/slot. */
function createMaterials(era: EraKey, slot: number): HumanoidMats {
  const p = ERA_OUTFITS[era].palettes[slot];
  const s = ERA_OUTFITS[era].silhouette;
  return {
    skin: new MeshStandardMaterial({ color: p.skin, roughness: 0.7 }),
    shirt: new MeshStandardMaterial({
      color: p.shirt,
      roughness: 0.65,
      emissive: new Color(p.shirt),
      emissiveIntensity: s.emissiveAccent * 0.6,
    }),
    pants: new MeshStandardMaterial({ color: p.pants, roughness: 0.75 }),
    shoes: new MeshStandardMaterial({ color: p.shoes, roughness: 0.6 }),
    hair: new MeshStandardMaterial({ color: p.hair, roughness: 0.8 }),
    accent: new MeshStandardMaterial({
      color: p.accent,
      roughness: 0.3,
      emissive: new Color(p.accent),
      emissiveIntensity: s.emissiveAccent,
    }),
  };
}

/** Assign materials to the correct body-part meshes. Limb capsules are wired
 *  directly via their stored references; named meshes via a lookup. */
function wireMaterials(parts: HumanoidParts, mats: HumanoidMats): void {
  // Limb capsules — direct references (they are unnamed children of pivots).
  parts.legLMesh.material = mats.pants;
  parts.legRMesh.material = mats.pants;
  parts.armLMesh.material = mats.shirt;
  parts.armRMesh.material = mats.shirt;

  // Named body parts.
  const byName = new Map<string, Mesh>();
  parts.root.traverse((obj) => {
    if (obj instanceof Mesh) {
      byName.set(obj.name, obj);
    }
  });
  byName.get('torso')!.material = mats.shirt;
  byName.get('head')!.material = mats.skin;
  byName.get('hair')!.material = mats.hair;
  byName.get('hatBrim')!.material = mats.hair;
  byName.get('hatCrown')!.material = mats.hair;
  byName.get('cap')!.material = mats.hair;
  byName.get('mask')!.material = mats.skin;
  byName.get('phone')!.material = mats.accent;
}

// ---------------------------------------------------------------------------
// Disposal & helpers
// ---------------------------------------------------------------------------

/** Release every geometry + material owned by one humanoid. */
function disposeHumanoid(inst: PedestrianInstance): void {
  inst.parts.root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry?.dispose();
    }
  });
  for (const mat of Object.values(inst.mats)) {
    mat.dispose();
  }
}

/** Count junctions that have at least one outbound link (spawnable points). */
function countWalkJunctions(graph: ReturnType<typeof buildWalkGraph>): number {
  let n = 0;
  for (const links of graph.adjacency.values()) {
    if (links.length > 0) n++;
  }
  return n;
}
