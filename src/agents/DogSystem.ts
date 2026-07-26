/**
 * DogSystem — dogs walking/running on the sidewalks of the shared RoadNetwork.
 *
 * Spawns a capped population of era-neutral dogs (see {@link dogs}) that walk
 * and trot along the sidewalk (walking) lanes and cross the driving lanes via
 * the marked crosswalks. Each dog is animated with a simple quadruped **trot
 * gait**: the system holds one {@link InstancedMesh} per gait phase, and every
 * frame assigns each dog to the mesh matching its current phase, so the legs
 * genuinely swing under instancing — cheaply.
 *
 * A fraction of dogs are *leashed* to an era-neutral owner that also walks the
 * sidewalk; a thin instanced leash cylinder spans owner↔dog each frame, tying
 * the dog population to the pedestrian flow "where cheap" (no full pedestrian
 * simulation is required — the owner simply shadows the dog at a fixed offset).
 *
 * Dogs are breed/era-neutral by requirement, so the {@link applyEra} domain is
 * registered with the {@link TransitionManager} (so the system participates in
 * era cross-fades and is driven each transition frame) but keeps a stable model
 * across all six eras — only the population rhythm nudges slightly per era.
 */

import {
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type BufferGeometry,
} from 'three';
import { type ApplyEraFn, type EraKey } from '../eras/eraConfig.js';
import type { RoadNetwork } from '../world/roadNetwork.js';
import type { TrafficLightController } from '../world/trafficLight.js';
import {
  buildCrossingDogRoutes,
  buildSidewalkPaths,
  sampleAgent,
  stepAgent,
  type AgentPath,
  type AgentState,
  type SignalAxis,
} from './agentPaths.js';
import {
  DOG_GAIT_PHASES,
  buildDogGeometry,
  buildLeashGeometry,
  buildOwnerGeometry,
  dogPalettes,
  type DogPalette,
} from './dogs.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hard cap on the number of dogs, regardless of lane count. */
export const MAX_DOGS = 10;

/** Fraction of dogs that are leashed to a walking owner. */
const LEASHED_FRACTION = 0.4;

/** Base walk speed (world units / second). */
const BASE_SPEED = 1.4;

/** Gait cadence: gait phases advanced per world unit travelled. */
const GAIT_RATE = 6.0;

/**
 * Era population multiplier — slightly more dogs in the mid-century/residential
 * eras, fewer in the hyper-dense future core. Kept subtle; dogs are era-neutral
 * in *appearance*, not in *presence*.
 */
const ERA_POPULATION: Record<EraKey, number> = {
  '1945': 1.0,
  '1965': 1.15,
  '1985': 1.1,
  '2005': 1.0,
  '2025': 0.85,
  '2055': 0.75,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One dog agent: path, motion state, gait phase, and look. */
interface Dog {
  path: AgentPath;
  state: AgentState;
  /** Continuous gait phase accumulator (advanced by distance travelled). */
  gait: number;
  /** Coat palette (breed variety). */
  palette: DogPalette;
  /** Body scale multiplier (small/medium/large variety). */
  scale: number;
  /** True if leashed to an owner walking the same sidewalk. */
  leashed: boolean;
}

/** Public surface of the dog system. */
export interface DogSystem {
  /** Group to add to the scene. */
  group: Group;
  /** TransitionManager era domain (era-neutral model; registered + driven). */
  applyEra: ApplyEraFn;
  /** Advance dogs one frame; call from the render loop with delta in ms. */
  update: (deltaMs: number) => void;
  /** Release GPU resources. */
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create the dog system over a shared road network and its signal controller.
 * Dogs are seeded across the sidewalk lanes and crosswalk routes immediately.
 */
export function createDogSystem(
  network: RoadNetwork,
  controller: TrafficLightController,
  initialEra: EraKey = '1945',
): DogSystem {
  const group = new Group();
  group.name = 'dogs';

  // --- Paths consumed from the shared network ------------------------------
  // Most dogs walk a sidewalk; a few take a crosswalk route (and thus gate).
  const sidewalkPaths = buildSidewalkPaths(network);
  const crossingPaths = buildCrossingDogRoutes(network);
  const allPaths: AgentPath[] = [...sidewalkPaths];
  // Fold a couple of crossing routes in so some dogs visibly respect signals.
  for (let i = 0; i < Math.min(2, crossingPaths.length); i++) {
    allPaths.push(crossingPaths[i]);
  }

  // --- Dog population (capped, era-scaled) ---------------------------------
  const palettes = dogPalettes();
  const scales = [0.85, 1.0, 1.15];
  const dogs: Dog[] = [];
  if (allPaths.length > 0) {
    const eraPop = ERA_POPULATION[initialEra];
    const count = Math.min(MAX_DOGS, Math.max(3, Math.round(5 * eraPop)));
    for (let i = 0; i < count; i++) {
      const path = allPaths[i % allPaths.length];
      const total = path.total;
      dogs.push({
        path,
        state: {
          d: (total * (i + 0.5)) / count,
          dir: i % 2 === 0 ? 1 : -1,
          speed: BASE_SPEED,
          waiting: false,
        },
        gait: (i / count) * DOG_GAIT_PHASES,
        palette: palettes[i % palettes.length],
        scale: scales[i % scales.length],
        leashed: i < Math.round(count * LEASHED_FRACTION),
      });
    }
  }

  // --- Shared geometry + materials (instanced, era-neutral) ----------------
  const phaseGeometries: BufferGeometry[] = [];
  for (let p = 0; p < DOG_GAIT_PHASES; p++) {
    // Breed variety across the population is baked by using the first palette
    // for the shared geometry; per-instance tint is approximated by grouping —
    // to keep instancing cheap we use one geometry per phase, one material.
    phaseGeometries.push(buildDogGeometry(palettes[0], 1, p));
  }
  const dogMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
  });

  // One InstancedMesh per gait phase; capacity = whole population (worst case
  // every dog lands in the same phase for a frame).
  const phaseMeshes: InstancedMesh[] = phaseGeometries.map((geo) => {
    const mesh = new InstancedMesh(geo, dogMaterial, Math.max(1, dogs.length));
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  });

  // Owners + leashes for the leashed subset.
  const ownerCapacity = Math.max(1, dogs.length);
  const ownerGeo = buildOwnerGeometry();
  const ownerMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const ownerMesh = new InstancedMesh(ownerGeo, ownerMaterial, ownerCapacity);
  ownerMesh.count = 0;
  ownerMesh.frustumCulled = false;
  group.add(ownerMesh);

  const leashGeo = buildLeashGeometry();
  const leashMaterial = new MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const leashMesh = new InstancedMesh(leashGeo, leashMaterial, Math.max(1, dogs.length));
  leashMesh.count = 0;
  leashMesh.frustumCulled = false;
  group.add(leashMesh);

  // Reusable transform dummies.
  const dummy = new Object3D();
  const ownerDummy = new Object3D();
  const leashDummy = new Object3D();

  /** Is the signal green for `axis`? Dogs proceed on their route's axis. */
  function isGreen(axis: SignalAxis): boolean {
    const phase = axis === 'ew' ? controller.getPhase() : controller.getComplementaryPhase();
    return phase === 'green';
  }

  /** Orient a dummy so its local +X points along a world heading (xz). */
  function faceHeading(out: Object3D, hx: number, hz: number): void {
    out.rotation.set(0, Math.atan2(-hz, hx), 0);
  }

  /**
   * Reseed the dog population when the era changes the target count. Keeps the
   * paths; only the population size + per-dog speed rhythm shifts per era.
   */
  function reseedPopulation(era: EraKey): void {
    if (allPaths.length === 0) return;
    const target = Math.min(MAX_DOGS, Math.max(3, Math.round(5 * ERA_POPULATION[era])));
    while (dogs.length > target) dogs.pop();
    let i = dogs.length;
    while (dogs.length < target) {
      const path = allPaths[i % allPaths.length];
      dogs.push({
        path,
        state: {
          d: (path.total * (i + 0.5)) / target,
          dir: i % 2 === 0 ? 1 : -1,
          speed: BASE_SPEED,
          waiting: false,
        },
        gait: (i / target) * DOG_GAIT_PHASES,
        palette: palettes[i % palettes.length],
        scale: scales[i % scales.length],
        leashed: i < Math.round(target * LEASHED_FRACTION),
      });
      i++;
    }
  }

  /**
   * Write every dog into its current-phase mesh, plus owners + leashes for the
   * leashed subset. Called each frame after stepping motion.
   */
  function writeMatrices(): void {
    const counters = new Array<number>(DOG_GAIT_PHASES).fill(0);
    let ownerCount = 0;

    for (const dog of dogs) {
      const { pos, dir } = sampleAgent(dog.path, dog.state.d);
      const hx = dir.x * dog.state.dir;
      const hz = dir.z * dog.state.dir;
      // Body bob: a small vertical oscillation synced to the gait, plus the
      // scale so big dogs sit higher.
      const bob = Math.sin(dog.gait * Math.PI) * 0.02 * dog.scale;
      const phase = Math.floor(((dog.gait % DOG_GAIT_PHASES) + DOG_GAIT_PHASES) % DOG_GAIT_PHASES);

      dummy.position.set(pos.x, bob, pos.z);
      faceHeading(dummy, hx, hz);
      dummy.scale.setScalar(dog.scale);
      dummy.updateMatrix();
      const mesh = phaseMeshes[phase];
      mesh.setMatrixAt(counters[phase]++, dummy.matrix);

      // Owner walks a fixed offset behind the dog along the sidewalk; leash
      // spans from the owner's hand to the dog's collar.
      if (dog.leashed && ownerCount < ownerCapacity) {
        const back = 1.1;
        const ox = pos.x - hx * back;
        const oz = pos.z - hz * back;
        ownerDummy.position.set(ox, 0, oz);
        faceHeading(ownerDummy, hx, hz);
        ownerDummy.scale.setScalar(1);
        ownerDummy.updateMatrix();
        ownerMesh.setMatrixAt(ownerCount, ownerDummy.matrix);

        // Orient a unit cylinder (base at owner hand y≈1.25) toward the dog
        // collar (y≈0.3*scale) and scale it to the span length.
        const handY = 1.25;
        const collarY = 0.3 * dog.scale + bob;
        const sx = pos.x - ox;
        const sz = pos.z - oz;
        const sy = collarY - handY;
        const span = Math.hypot(sx, sy, sz) || 1e-3;
        leashDummy.position.set(ox, handY, oz);
        // Default cylinder points up (+Y); rotate +Y onto the span direction.
        leashDir.set(sx / span, sy / span, sz / span);
        leashDummy.quaternion.setFromUnitVectors(UP_VEC, leashDir);
        leashDummy.scale.set(1, span, 1);
        leashDummy.updateMatrix();
        leashMesh.setMatrixAt(ownerCount, leashDummy.matrix);
        ownerCount++;
      }
    }

    for (let p = 0; p < DOG_GAIT_PHASES; p++) {
      phaseMeshes[p].count = counters[p];
      phaseMeshes[p].instanceMatrix.needsUpdate = true;
    }
    ownerMesh.count = ownerCount;
    ownerMesh.instanceMatrix.needsUpdate = true;
    leashMesh.count = ownerCount;
    leashMesh.instanceMatrix.needsUpdate = true;
  }

  // --- Era domain (era-neutral model; registered + driven per requirement) --
  let currentEra: EraKey = initialEra;
  const applyEra: ApplyEraFn = (toKey, _t, _fromKey) => {
    // Dogs are intentionally era-neutral in appearance, so there is no geometry
    // swap. We still register/drive the domain and keep the population rhythm
    // aligned to the destination era once a transition settles.
    if (toKey !== currentEra) {
      currentEra = toKey;
      reseedPopulation(toKey);
    }
  };

  // --- Per-frame update ----------------------------------------------------
  function update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 64) / 1000; // seconds, clamped
    for (const dog of dogs) {
      const before = dog.state.d;
      stepAgent(dog.state, dog.path, dt, isGreen);
      const moved = Math.abs(dog.state.d - before);
      // Advance the gait by distance travelled (dogs "trot" faster when moving).
      if (!dog.state.waiting) {
        dog.gait += moved * GAIT_RATE;
      }
    }
    writeMatrices();
  }

  function dispose(): void {
    for (const mesh of phaseMeshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    dogMaterial.dispose();
    ownerGeo.dispose();
    ownerMaterial.dispose();
    ownerMesh.dispose();
    leashGeo.dispose();
    leashMaterial.dispose();
    leashMesh.dispose();
  }

  return { group, applyEra, update, dispose };
}

// ---------------------------------------------------------------------------
// Reusable scratch vectors (module-local) for leash orientation, kept out of
// the per-dog loop to avoid allocations in the hot path.
// ---------------------------------------------------------------------------

const UP_VEC = new Vector3(0, 1, 0);
const leashDir = new Vector3();
